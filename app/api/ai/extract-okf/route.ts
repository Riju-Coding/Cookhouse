import { NextResponse } from "next/server"
import OpenAI from "openai"
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { serviceId, subServiceId, trainingData, includeDbMenus, aiModel, mealPlanMapping, targetCompanyId } = body

    if (!serviceId || !subServiceId || (!trainingData && !includeDbMenus)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // --- Model Candidates ---
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ""
    const geminiURL = "https://generativelanguage.googleapis.com/v1beta/openai/"
    const naraKey = process.env.NARA_API_KEY || ""
    let candidateModels: { model: string; apiKey: string; baseURL: string }[] = []

    if (aiModel === "ollama") {
      candidateModels = [
        { model: "llama3.1", apiKey: "ollama", baseURL: "http://127.0.0.1:11434/v1" },
        { model: "gemini-3.5-flash-lite", apiKey: geminiKey, baseURL: geminiURL },
      ]
    } else if (aiModel === "nara") {
      candidateModels = [
        { model: "claude-sonnet-5", apiKey: naraKey, baseURL: "https://router.bynara.id/v1" },
        { model: "gemini-3.5-flash-lite", apiKey: geminiKey, baseURL: geminiURL },
        { model: "llama3.1", apiKey: "ollama", baseURL: "http://127.0.0.1:11434/v1" },
      ]
    } else {
      candidateModels = [
        { model: "gemini-3.5-flash-lite", apiKey: geminiKey, baseURL: geminiURL },
        { model: "gemini-flash-lite-latest", apiKey: geminiKey, baseURL: geminiURL },
        { model: "gemini-3.1-flash-lite", apiKey: geminiKey, baseURL: geminiURL },
        { model: "gemini-3.5-flash", apiKey: geminiKey, baseURL: geminiURL },
        { model: "llama3.1", apiKey: "ollama", baseURL: "http://127.0.0.1:11434/v1" },
      ]
    }

    // --- Fetch reference data ---
    const [mealPlansSnap, subMealPlansSnap, menuItemsSnap] = await Promise.all([
      getDocs(collection(db, "mealPlans")),
      getDocs(collection(db, "subMealPlans")),
      getDocs(collection(db, "menuItems")),
    ])

    const mealPlans = mealPlansSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter((mp: any) => mp.status === "active")

    const subMealPlans = subMealPlansSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter((smp: any) => smp.status === "active")

    const menuItems = menuItemsSnap.docs
      .map(d => ({ id: d.id, name: (d.data() as any).name, category: (d.data() as any).category }))

    // Build reference: MealPlan hierarchy (compact names)
    const mealPlanHierarchy = mealPlans.map(mp => ({
      category: mp.name,
      subMealPlans: subMealPlans
        .filter((smp: any) => smp.mealPlanId === mp.id)
        .map((smp: any) => smp.name)
    }))

    // --- Gather training data ---
    let combinedTrainingData: any[] = []

    if (trainingData && Array.isArray(trainingData)) {
      trainingData.forEach((td: any) => {
        // Compact records to clean concise strings to prevent exceeding token quotas (429)
        const rawRecords = Array.isArray(td.data) ? td.data.slice(0, 160) : []
        const compactDishes = rawRecords.map((r: any) => {
          const mp = r.mappedMealPlanName || r.mealPlan || ""
          const smp = r.subMealPlan ? ` > ${r.subMealPlan}` : ""
          const date = r.date || "General"
          const items = r.items || ""
          const comp = r.company && r.company !== "Universal" ? ` [Company: ${r.company}]` : ""
          return `${date} | ${mp}${smp}: ${items}${comp}`
        })
        combinedTrainingData.push({
          source: "Uploaded Excel Spreadsheet",
          fileName: td.fileName,
          sheetName: td.sheetName,
          totalRecordsCount: td.data?.length || 0,
          sampleDishes: compactDishes,
        })
      })
    }

    if (includeDbMenus) {
      const companyMenusSnap = await getDocs(collection(db, "companyMenus"))
      const dbMenus = companyMenusSnap.docs.map(d => d.data())

      const combinedMenusSnap = await getDocs(collection(db, "combinedMenus"))
      const combinedMenus = combinedMenusSnap.docs.map(d => d.data())

      const structAssignSnap = await getDocs(collection(db, "mealPlanStructureAssignments"))
      const structAssignments = structAssignSnap.docs
        .map(d => ({ id: d.id, ...(d.data() as any) }))
        .filter((a: any) => a.status === "active")

      const filterMenuData = (menuData: any) => {
        const filtered: any = {}
        if (!menuData) return null
        for (const date in menuData) {
          if (serviceId === "GLOBAL" || menuData[date]?.[serviceId]) {
            if (serviceId === "GLOBAL") {
              filtered[date] = menuData[date]
            } else if (subServiceId === "GLOBAL" || menuData[date]?.[serviceId]?.[subServiceId]) {
              filtered[date] = {}
              filtered[date][serviceId] = {}
              if (subServiceId === "GLOBAL") {
                filtered[date][serviceId] = menuData[date][serviceId]
              } else {
                filtered[date][serviceId][subServiceId] = menuData[date][serviceId][subServiceId]
              }
            }
          }
        }
        return Object.keys(filtered).length > 0 ? filtered : null
      }

      const filteredCompanyMenus = dbMenus
        .map(menu => {
          const filtered = filterMenuData(menu.menuData)
          if (!filtered) return null
          return {
            source: "companyMenu",
            companyName: menu.companyName || "Unknown",
            buildingName: menu.buildingName || "Unknown",
            menuData: filtered,
          }
        })
        .filter(Boolean)

      const filteredCombinedMenus = combinedMenus
        .map(menu => {
          const filtered = filterMenuData(menu.menuData)
          if (!filtered) return null
          return {
            source: "combinedMenu",
            startDate: menu.startDate,
            endDate: menu.endDate,
            menuData: filtered,
          }
        })
        .filter(Boolean)

      if (filteredCompanyMenus.length > 0 || filteredCombinedMenus.length > 0) {
        const dbDishLines: string[] = []
        filteredCompanyMenus.slice(0, 5).forEach((menu: any) => {
          for (const date in menu.menuData || {}) {
            for (const sId in menu.menuData[date] || {}) {
              for (const ssId in menu.menuData[date][sId] || {}) {
                const cellObj = menu.menuData[date][sId][ssId]
                if (cellObj && typeof cellObj === "object") {
                  for (const mpId in cellObj) {
                    for (const smpId in cellObj[mpId] || {}) {
                      const itemArr = cellObj[mpId][smpId]?.items || []
                      if (itemArr.length > 0) {
                        const mpName = mealPlans.find((m: any) => m.id === mpId)?.name || mpId
                        const smpName = subMealPlans.find((s: any) => s.id === smpId)?.name || smpId
                        const itemNames = itemArr.map((it: any) => typeof it === "string" ? it : it.name).join(", ")
                        dbDishLines.push(`${date} [${menu.companyName}] | ${mpName} > ${smpName}: ${itemNames}`)
                      }
                    }
                  }
                }
              }
            }
          }
        })

        combinedTrainingData.push({
          source: "Existing Database Menus",
          totalCompanyMenus: filteredCompanyMenus.length,
          totalCombinedMenus: filteredCombinedMenus.length,
          sampleHistoricalDishes: dbDishLines.slice(0, 80),
        })
      }

      if (structAssignments.length > 0) {
        const structureSummary = structAssignments.slice(0, 4).map(a => ({
          companyId: a.companyId,
          buildingId: a.buildingId,
          sampleDay: a.weekStructure?.monday || a.weekStructure?.tuesday || [],
        }))
        combinedTrainingData.push({
          source: "Structure Assignments (Active vs Blank Cell Contract Rules)",
          description: "These define which MealPlan+SubMealPlan combinations are contracted per day per company. Unassigned cells should remain empty.",
          data: structureSummary,
        })
      }
    }

    // Apply mealPlanMapping if provided
    if (mealPlanMapping && Object.keys(mealPlanMapping).length > 0) {
      const detailedMapping: Record<string, any> = {}
      for (const key in mealPlanMapping) {
        const val = mealPlanMapping[key]
        const mpId = typeof val === "object" ? val.mealPlanId : val
        const smpId = typeof val === "object" ? val.subMealPlanId : ""

        const mpDoc = mealPlans.find((m: any) => m.id === mpId)
        const smpDoc = subMealPlans.find((s: any) => s.id === smpId)

        detailedMapping[key] = {
          targetMealPlan: mpDoc?.name || mpId,
          targetSubMealPlan: smpDoc?.name || "auto-classify by item category",
          instruction: smpId 
            ? `All items under Excel category '${key}' strictly belong to MealPlan '${mpDoc?.name}' and SubMealPlan '${smpDoc?.name}'.` 
            : `Items under Excel category '${key}' belong to MealPlan '${mpDoc?.name}'. Categorize them into its sub-plans.`
        }
      }
      combinedTrainingData.push({
        source: "User-Provided MealPlan and SubMealPlan Category Mapping",
        description: "The user explicitly mapped Excel categories to specific database MealPlans and SubMealPlans.",
        mapping: detailedMapping,
      })
    }

    // Apply targetCompanyId if provided
    if (targetCompanyId) {
      try {
        const compDoc = await getDoc(doc(db, "companies", targetCompanyId))
        if (compDoc.exists()) {
          const compName = (compDoc.data() as any).name
          combinedTrainingData.push({
            source: "Target Client Company",
            companyId: targetCompanyId,
            companyName: compName,
            instruction: `These menus are specifically for client company '${compName}'. Learn company-specific preferences, exclusions, and custom override tendencies for '${compName}'.`
          })
        }
      } catch (cErr) {
        console.warn("Could not fetch target company:", cErr)
      }
    }

    let dataString = JSON.stringify(combinedTrainingData, null, 2)
    // Keep under 25,000 chars (~5,500 tokens) so free tier rate limits (TPM) are never exceeded
    const MAX_CHARS = 25000
    if (dataString.length > MAX_CHARS) {
      console.warn(`Training data size (${dataString.length} chars), capping at ${MAX_CHARS} to prevent 429 quota exhaustion...`)
      dataString = dataString.slice(0, MAX_CHARS) + "\n...[TRUNCATED TO PREVENT TOKEN EXHAUSTION]"
    }

    // --- Load existing profile ---
    const docId = serviceId === "GLOBAL" ? "GLOBAL_GLOBAL" : `${serviceId}_${subServiceId}`
    const docRef = doc(db, "aiTrainingProfiles", docId)
    const existingSnap = await getDoc(docRef)
    const previousKnowledge = existingSnap.exists() ? existingSnap.data().profileText : "No previous knowledge."

    // --- Build the training prompt ---
    const systemPrompt = `You are an expert culinary AI Menu Planner and Data Architect for a large-scale catering operation.

You are in 'Reverse Engineering & OKF Generation Mode'. The user has provided menu data for analysis.

IMPORTANT HIERARCHY (get this right!):
- Service = meal TIME (e.g., Breakfast, Lunch, Dinner)
- SubService = service TYPE (e.g., Buffet, Salad Bar)
- MealPlan = food CATEGORY (e.g., Breads, Dal/Lentil, Rice, Paneer)
- SubMealPlan = specific course SLOT within a MealPlan (e.g., White Bread, Naan under Breads)

AVAILABLE MEAL PLAN HIERARCHY:
${JSON.stringify(mealPlanHierarchy, null, 2)}

AVAILABLE MENU ITEMS (sample):
${JSON.stringify(menuItems.slice(0, 80).map(i => ({ id: i.id, name: i.name, category: i.category })))}

YOUR TASKS:
1. Analyze the training data for quality and patterns.
2. Extract SPECIFIC, ACTIONABLE rules:
   - Which items commonly appear in which SubMealPlan?
   - What are the typical item counts per SubMealPlan per day?
   - Are there day-of-week patterns? (e.g., "Fridays tend to have biryani")
   - Are there items that always appear together?
   - Are there items that NEVER appear on the same day?
   - Which cells (MealPlan+SubMealPlan combos) are typically EMPTY on which days?
3. Merge with Previous Knowledge to create an updated OKF profile.
4. Generate strategic advice.

OUTPUT FORMAT — You MUST return a valid JSON object:
{
  "status": "success",
  "feedback": "Your analysis of the training data quality and what you learned",
  "profileText": "The updated OKF Markdown profile with SPECIFIC rules. Include:\n## Item Distribution Rules\n## Day-of-Week Patterns\n## Blank Cell Rules\n## Repetition Rules\n## Item Compatibility Rules",
  "advisory": "Strategic advice for menu improvement"
}

IMPORTANT:
- Focus on extracting SPECIFIC, ACTIONABLE rules — not vague descriptions.
- Use actual item NAMES and MealPlan/SubMealPlan NAMES in your rules.
- Output ONLY valid JSON.`

    const userPrompt = `Here is the previous knowledge profile:\n\n${previousKnowledge}\n\nHere is the new training data:\n\n${dataString}`

    // --- Multi-Model Fallback Execution Loop ---
    let completion: any = null
    let successfulModel = ""
    let lastError: any = null

    for (const candidate of candidateModels) {
      console.log(`[AI Training] Attempting model: ${candidate.model} via ${candidate.baseURL}...`)
      try {
        const client = new OpenAI({ apiKey: candidate.apiKey, baseURL: candidate.baseURL })
        completion = await client.chat.completions.create({
          model: candidate.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
        successfulModel = candidate.model
        console.log(`[AI Training] Successfully generated with model: ${candidate.model}`)
        break
      } catch (err: any) {
        lastError = err
        console.warn(`[AI Training] Model ${candidate.model} failed with ${err.status || err.message}. Trying next candidate...`)
        // If rate-limited (429) or busy (503), short pause before next model
        if (err.status === 429 || err.status === 503) {
          await new Promise(r => setTimeout(r, 1200))
        }
      }
    }

    if (!completion) {
      console.error("[AI Training] All model candidates failed. Last error:", lastError?.message)
      return NextResponse.json({
        error: `AI Error: ${lastError?.message || "Rate limit or quota exhausted across models. Please retry shortly or switch to Ollama."}`,
        debug: { message: lastError?.message, status: lastError?.status }
      }, { status: 500 })
    }

    let generatedJsonString = completion.choices[0]?.message?.content || "{}"

    // Strip markdown code fences if present
    if (generatedJsonString.startsWith("```json")) {
      generatedJsonString = generatedJsonString.replace(/^```json\n/, "").replace(/\n```$/, "")
    } else if (generatedJsonString.startsWith("```")) {
      generatedJsonString = generatedJsonString.replace(/^```\n/, "").replace(/\n```$/, "")
    }

    let parsedResult: any = {}
    try {
      parsedResult = JSON.parse(generatedJsonString)
    } catch (e) {
      console.error("Failed to parse AI response:", generatedJsonString.substring(0, 500))
      return NextResponse.json({ error: "Failed to parse AI JSON response" }, { status: 500 })
    }

    if (parsedResult.status === "success") {
      await setDoc(docRef, {
        profileText: parsedResult.profileText || "",
        lastFeedback: parsedResult.feedback || "",
        lastAdvisory: parsedResult.advisory || "",
        updatedAt: serverTimestamp()
      }, { merge: true })

      await addDoc(collection(db, "aiTrainingLogs"), {
        serviceId: serviceId || "GLOBAL",
        subServiceId: subServiceId || "GLOBAL",
        timestamp: serverTimestamp(),
        feedback: parsedResult.feedback || "",
        advisory: parsedResult.advisory || "",
        profileText: parsedResult.profileText || "",
        status: "success",
        aiModel: successfulModel || aiModel,
        dataSnapshot: dataString.slice(0, 1500),
        includeDbMenus: Boolean(includeDbMenus),
      })
    }

    return NextResponse.json(parsedResult)
  } catch (error: any) {
    console.error("Error training OKF:", error)
    return NextResponse.json({ error: error.message || "Failed to train OKF" }, { status: 500 })
  }
}
