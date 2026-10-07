import { NextResponse } from "next/server"
import OpenAI from "openai"
import { doc, getDoc, collection, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { menuPlanningRulesService } from "@/lib/services"

export const runtime = "nodejs"
export const maxDuration = 300

function getEnv(name: string): string | undefined {
  const v = process.env[name]
  if (!v) return undefined
  const t = v.trim()
  return t.length ? t : undefined
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      serviceId,
      subServiceId,
      datesToGenerate,
      currentMenuData,
      aiModel,
      companyId,
      companyName,
      menuType,
      allowedCellsByDate,
      usedItemIdsBySubMealPlan,
    } = body

    if (!serviceId || !subServiceId || !datesToGenerate || !datesToGenerate.length) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // --- Model Candidates ---
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ""
    const geminiURL = "https://generativelanguage.googleapis.com/v1beta/openai/"
    const naraKey = process.env.NARA_API_KEY || ""
    const bedrockKey = process.env.AWS_BEARER_TOKEN_BEDROCK || process.env.OPENAI_API_KEY || ""
    const bedrockURL = process.env.OPENAI_BASE_URL || "https://bedrock-mantle.ap-south-1.api.aws/v1"
    const bedrockModel = process.env.BEDROCK_MANTLE_MODEL || "openai.gpt-oss-120b"

    let candidateModels: { model: string; apiKey: string; baseURL: string }[] = []

    if (aiModel === "aws") {
      candidateModels = [
        { model: bedrockModel, apiKey: bedrockKey, baseURL: bedrockURL },
        { model: "gemini-2.5-flash", apiKey: geminiKey, baseURL: geminiURL },
        { model: "gemini-2.0-flash", apiKey: geminiKey, baseURL: geminiURL },
        { model: "gemini-1.5-flash", apiKey: geminiKey, baseURL: geminiURL },
        { model: "gemini-3.5-flash-lite", apiKey: geminiKey, baseURL: geminiURL },
      ]
    } else if (aiModel === "ollama") {
      candidateModels = [
        { model: "llama3.1", apiKey: "ollama", baseURL: "http://127.0.0.1:11434/v1" },
        { model: "gemini-2.5-flash", apiKey: geminiKey, baseURL: geminiURL },
        { model: "gemini-2.0-flash", apiKey: geminiKey, baseURL: geminiURL },
        { model: "gemini-3.5-flash-lite", apiKey: geminiKey, baseURL: geminiURL },
      ]
    } else if (aiModel === "nara") {
      candidateModels = [
        { model: "claude-sonnet-5", apiKey: naraKey, baseURL: "https://router.bynara.id/v1" },
        { model: "gemini-2.5-flash", apiKey: geminiKey, baseURL: geminiURL },
        { model: "gemini-2.0-flash", apiKey: geminiKey, baseURL: geminiURL },
        { model: "gemini-3.5-flash-lite", apiKey: geminiKey, baseURL: geminiURL },
        { model: "llama3.1", apiKey: "ollama", baseURL: "http://127.0.0.1:11434/v1" },
      ]
    } else {
      // Prioritize modern Gemini models with multi-tier fallback
      candidateModels = [
        { model: "gemini-2.5-flash", apiKey: geminiKey, baseURL: geminiURL },
        { model: "gemini-2.0-flash", apiKey: geminiKey, baseURL: geminiURL },
        { model: "gemini-1.5-flash", apiKey: geminiKey, baseURL: geminiURL },
        { model: "gemini-3.5-flash-lite", apiKey: geminiKey, baseURL: geminiURL },
        { model: "gemini-flash-lite-latest", apiKey: geminiKey, baseURL: geminiURL },
        { model: "gemini-3.1-flash-lite", apiKey: geminiKey, baseURL: geminiURL },
        { model: "gemini-3.5-flash", apiKey: geminiKey, baseURL: geminiURL },
        { model: "llama3.1", apiKey: "ollama", baseURL: "http://127.0.0.1:11434/v1" },
      ]
    }

    // --- Fetch OKF Knowledge ---
    let okfDocRef = null
    let okfSnap = null

    if (companyId) {
      okfDocRef = doc(db, "aiTrainingProfiles", `${serviceId}_${subServiceId}_${companyId}`)
      okfSnap = await getDoc(okfDocRef)
    }

    if (!okfSnap || !okfSnap.exists()) {
      okfDocRef = doc(db, "aiTrainingProfiles", `${serviceId}_${subServiceId}`)
      okfSnap = await getDoc(okfDocRef)
    }

    if (!okfSnap || !okfSnap.exists()) {
      okfDocRef = doc(db, "aiTrainingProfiles", "GLOBAL_GLOBAL")
      okfSnap = await getDoc(okfDocRef)
    }

    let okfKnowledge = ""
    if (okfSnap && okfSnap.exists()) {
      const data = okfSnap.data()
      okfKnowledge = data.profileText?.substring(0, 10000) || ""
      if (data.lastFeedback) {
        okfKnowledge += `\n\n### Training Insights & Feedback:\n${data.lastFeedback.substring(0, 2000)}`
      }
    } else {
      okfKnowledge = "No previous training profile available. Follow standard culinary guidelines and balance."
    }

    // --- Fetch Merged Menu Planning Rules (Grand Rules & Day Rules) ---
    let rulesText = ""
    try {
      const mergedRule = await menuPlanningRulesService.getMergedRule(serviceId, subServiceId, companyId || null)
      if (mergedRule) {
        const rulesParts: string[] = []
        if (mergedRule.grandRules && mergedRule.grandRules.length > 0) {
          rulesParts.push("### Grand Rules (Strict Operational Guidelines):")
          mergedRule.grandRules.forEach(gr => rulesParts.push(`- ${gr}`))
        }
        if (mergedRule.dayRules && Object.keys(mergedRule.dayRules).length > 0) {
          rulesParts.push("### Day of Week Rules:")
          for (const [dayName, dayRule] of Object.entries(mergedRule.dayRules)) {
            if (dayRule.globalDayRule) {
              rulesParts.push(`- ${dayName.toUpperCase()}: ${dayRule.globalDayRule}`)
            }
            if (dayRule.cellRules && Object.keys(dayRule.cellRules).length > 0) {
              for (const [cellKey, cr] of Object.entries(dayRule.cellRules)) {
                const constraintList: string[] = []
                if (cr.allowedCuisines?.length) constraintList.push(`Cuisines: ${cr.allowedCuisines.join(", ")}`)
                if (cr.allowedIngredients?.length) constraintList.push(`Ingredients: ${cr.allowedIngredients.join(", ")}`)
                if (cr.allowedFlavorProfiles?.length) constraintList.push(`Flavors: ${cr.allowedFlavorProfiles.join(", ")}`)
                if (cr.heavyLight) constraintList.push(`Weight: ${cr.heavyLight}`)
                if (constraintList.length) {
                  rulesParts.push(`  * ${dayName.toUpperCase()} [${cellKey}]: ${constraintList.join("; ")}`)
                }
              }
            }
          }
        }
        rulesText = rulesParts.join("\n")
      }
    } catch (ruleErr) {
      console.warn("[AI Suggest Batch] Could not load menu planning rules:", ruleErr)
    }

    // --- Fetch Meal Plans ---
    const allMealPlansSnap = await getDocs(collection(db, "mealPlans"))
    const mealPlanData = allMealPlansSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter((mp: any) => mp.status === "active" || !mp.status)

    // --- Fetch Sub Meal Plans (including isRepeatPlan for staples) ---
    const subMealPlansSnap = await getDocs(collection(db, "subMealPlans"))
    const subMealPlans = subMealPlansSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter((smp: any) => smp.status === "active" || !smp.status)

    const repeatSmpIds = new Set(
      subMealPlans.filter((smp: any) => smp.isRepeatPlan === true).map(s => s.id)
    )

    // --- Fetch ALL menu items ---
    const itemsSnap = await getDocs(collection(db, "menuItems"))
    const allItems = itemsSnap.docs.map(d => ({
      id: d.id,
      name: (d.data() as any).name,
      category: (d.data() as any).category || "",
    }))
    const availableItems = allItems.slice(0, 500)

    // --- Fetch Buildings & Companies for Strict Building Assignment Validation ---
    const [buildingsSnap, companiesSnap, structAssignSnap] = await Promise.all([
      getDocs(collection(db, "buildings")),
      getDocs(collection(db, "companies")),
      getDocs(collection(db, "mealPlanStructureAssignments")),
    ])

    const activeBuildingIds = new Set(
      buildingsSnap.docs
        .filter(d => (d.data() as any).status === "active" || !(d.data() as any).status)
        .map(d => d.id)
    )
    const activeCompanyIds = new Set(
      companiesSnap.docs
        .filter(d => (d.data() as any).status === "active" || !(d.data() as any).status)
        .map(d => d.id)
    )

    // Only include structure assignments that have a valid, active building and company
    let allStructAssignments = structAssignSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter((a: any) => {
        if (a.status !== "active" && a.status !== undefined) return false
        // CRITICAL: Must have a valid active building assigned!
        if (!a.buildingId || !activeBuildingIds.has(a.buildingId)) return false
        // Must have an active company
        if (!a.companyId || !activeCompanyIds.has(a.companyId)) return false
        // For company-specific menus, filter assignments strictly to this company
        if (menuType === "company" && companyId && a.companyId !== companyId) return false
        return true
      })

    // --- Resolve Service/SubService names ---
    const serviceDoc = await getDoc(doc(db, "services", serviceId))
    const serviceName = serviceDoc.exists() ? serviceDoc.data().name : serviceId
    const subServiceDoc = await getDoc(doc(db, "subServices", subServiceId))
    const subServiceName = subServiceDoc.exists() ? subServiceDoc.data().name : subServiceId

    // --- Build the VALID CELLS MAP ---
    // For each date, determine the day-of-week, then check structure assignments
    // A cell is ONLY valid if at least one active building has it in its contract on this day!
    const validCellsPerDate: Record<string, Array<{ mealPlanId: string; mealPlanName: string; subMealPlanId: string; subMealPlanName: string; isRepeatPlan: boolean }>> = {}

    // Check if this sub-service has ANY contracted assignments across any building/day in allStructAssignments
    const subServiceHasAnyAssignments = allStructAssignments.some((a: any) =>
      Object.values(a.weekStructure || {}).some((svcs: any) =>
        Array.isArray(svcs) && svcs.some((s: any) =>
          s.serviceId === serviceId && s.subServices?.some((ss: any) => ss.subServiceId === subServiceId)
        )
      )
    )

    for (const dateStr of datesToGenerate) {
      const [y, m, dNum] = dateStr.split("-").map(Number)
      const dateObj = new Date(y, m - 1, dNum, 12, 0, 0)
      const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
      const dayKey = dayNames[dateObj.getDay()]

      const isCellAllowed = (mpId: string, smpId: string) => {
        if (!allowedCellsByDate || !allowedCellsByDate[dateStr] || allowedCellsByDate[dateStr].length === 0) return true
        const list = allowedCellsByDate[dateStr]
        return list.includes(`${mpId}|${smpId}`) || list.includes(smpId) || list.some((k: string) => k.endsWith(`|${smpId}`))
      }

      const cellsForDate = new Set<string>() // Set of "mpId|smpId" to deduplicate
      const cellsArray: Array<{ mealPlanId: string; mealPlanName: string; subMealPlanId: string; subMealPlanName: string; isRepeatPlan: boolean }> = []

      for (const assignment of allStructAssignments) {
        const dayStructure = assignment.weekStructure?.[dayKey] || []
        for (const svc of dayStructure) {
          if (svc.serviceId !== serviceId) continue
          for (const ss of (svc.subServices || [])) {
            if (ss.subServiceId !== subServiceId) continue
            for (const mp of (ss.mealPlans || [])) {
              for (const smp of (mp.subMealPlans || [])) {
                if (!isCellAllowed(mp.mealPlanId, smp.subMealPlanId)) {
                  continue
                }

                const key = `${mp.mealPlanId}|${smp.subMealPlanId}`
                if (!cellsForDate.has(key)) {
                  cellsForDate.add(key)
                  const mpInfo = mealPlanData.find((m: any) => m.id === mp.mealPlanId)
                  const smpInfo = subMealPlans.find((s: any) => s.id === smp.subMealPlanId)
                  cellsArray.push({
                    mealPlanId: mp.mealPlanId,
                    mealPlanName: mpInfo?.name || mp.mealPlanId,
                    subMealPlanId: smp.subMealPlanId,
                    subMealPlanName: smpInfo?.name || smp.subMealPlanId,
                    isRepeatPlan: Boolean(smpInfo?.isRepeatPlan),
                  })
                }
              }
            }

            // Also include subMealPlans that appear under choices for this day
            const choicesList = Array.isArray(ss.choices)
              ? ss.choices
              : Array.isArray(ss.choices?.[dayKey])
                ? ss.choices[dayKey]
                : Object.values(ss.choices || {}).flat()

            if (Array.isArray(choicesList)) {
              for (const choice of choicesList) {
                for (const mp of (choice.mealPlans || [])) {
                  for (const smp of (mp.subMealPlans || [])) {
                    if (!isCellAllowed(mp.mealPlanId, smp.subMealPlanId)) {
                      continue
                    }
                    const key = `${mp.mealPlanId}|${smp.subMealPlanId}`
                    if (!cellsForDate.has(key)) {
                      cellsForDate.add(key)
                      const mpInfo = mealPlanData.find((m: any) => m.id === mp.mealPlanId)
                      const smpInfo = subMealPlans.find((s: any) => s.id === smp.subMealPlanId)
                      cellsArray.push({
                        mealPlanId: mp.mealPlanId,
                        mealPlanName: mpInfo?.name || mp.mealPlanId,
                        subMealPlanId: smp.subMealPlanId,
                        subMealPlanName: smpInfo?.name || smp.subMealPlanId,
                        isRepeatPlan: Boolean(smpInfo?.isRepeatPlan),
                      })
                    }
                  }
                }
              }
            }
          }
        }
      }

      // If this sub-service has ZERO building contracts overall (e.g. Party, Special, or unassigned sub-services),
      // fallback to all active subMealPlans belonging to this sub-service so generation works!
      if (!subServiceHasAnyAssignments && cellsArray.length === 0) {
        for (const mp of mealPlanData) {
          const smps = subMealPlans.filter((s: any) => s.mealPlanId === mp.id)
          for (const smp of smps) {
            const key = `${mp.id}|${smp.id}`
            if (!cellsForDate.has(key)) {
              cellsForDate.add(key)
              cellsArray.push({
                mealPlanId: mp.id,
                mealPlanName: mp.name,
                subMealPlanId: smp.id,
                subMealPlanName: smp.name,
                isRepeatPlan: Boolean(smp.isRepeatPlan),
              })
            }
          }
        }
      }

      validCellsPerDate[dateStr] = cellsArray
    }

    // Build a clean instruction for the AI about which cells to fill
    const validCellsInstruction = Object.entries(validCellsPerDate).map(([date, cells]) => {
      if (cells.length === 0) return `${date}: NO BUILDING ASSIGNED — leave this date completely empty, generate NOTHING.`
      const cellsList = cells.map(c => `  - MealPlan: "${c.mealPlanName}" (ID: ${c.mealPlanId}) → SubMealPlan: "${c.subMealPlanName}" (ID: ${c.subMealPlanId}) [${c.isRepeatPlan ? "STAPLE - Daily Repetition Allowed" : "VARIETY - Strictly Rotate, No Repeat"}]`).join("\n")
      return `${date} (${new Date(date).toLocaleDateString("en", { weekday: "long" })}):\n${cellsList}`
    }).join("\n\n")

    // Format previously used items for the prompt so the AI avoids repeating them
    let usedItemsNotice = ""
    if (usedItemIdsBySubMealPlan && typeof usedItemIdsBySubMealPlan === "object") {
      const parts: string[] = []
      for (const [smpId, itemIds] of Object.entries(usedItemIdsBySubMealPlan)) {
        if (!repeatSmpIds.has(smpId) && Array.isArray(itemIds) && itemIds.length > 0) {
          const smpName = subMealPlans.find((s: any) => s.id === smpId)?.name || smpId
          const itemNames = (itemIds as string[]).map(id => allItems.find(i => i.id === id)?.name || id)
          parts.push(`  * SubMealPlan "${smpName}": already used [${itemNames.join(", ")}]`)
        }
      }
      if (parts.length > 0) {
        usedItemsNotice = `\n# PREVIOUSLY ASSIGNED ITEMS (DO NOT REPEAT for non-repeat SubMealPlans):\n${parts.join("\n")}\n`
      }
    }

    // Build the system prompt
    const systemPrompt = `You are an expert autonomous AI Menu Planner for a catering company.

# Context
- Service: ${serviceName} (ID: ${serviceId})
- Sub-Service: ${subServiceName} (ID: ${subServiceId})
${companyName ? `- Target Client: ${companyName} (Company ID: ${companyId})` : "- Target Scope: Combined Master Menu"}
- Dates to generate: ${datesToGenerate.join(", ")}

# CRITICAL RULES: Only Fill Cells With Buildings Assigned
1. You MUST ONLY generate items for the EXACT cells listed in "Valid Cells Per Date" below.
   Every listed cell has active client buildings contracted.
2. If a SubMealPlan is NOT listed under a date, NO building is assigned to it on that date — you MUST NOT generate anything for it!
3. DO NOT invent new cells or fill cells not listed here.

## Valid Cells Per Date:
${validCellsInstruction}

${rulesText ? `# Configured Menu Planning Rules\n${rulesText}\n` : ""}
${usedItemsNotice}
# OKF Knowledge (Learned Patterns & History)
${okfKnowledge}

# Available Menu Items
Use ONLY item IDs from this list. Pick items whose name/category fits the SubMealPlan category.
${JSON.stringify(availableItems.map(i => ({ id: i.id, name: i.name, category: i.category })))}

# Current Menu State
Items already assigned to cells. Keep good existing items, fill empty cells, or improve weak selections.
${JSON.stringify(currentMenuData)}

# Output Format
Generate a JSON array. Each object = ONE cell (one date + one subMealPlanId):
[
  {
    "date": "YYYY-MM-DD",
    "mealPlanId": "<EXACT mealPlanId from valid cells list>",
    "subMealPlanId": "<EXACT subMealPlanId from valid cells list>",
    "menuItemIds": ["item_id_1", "item_id_2"]
  }
]

RULES:
1. Use EXACT IDs from the valid cells list. Do NOT use names as IDs.
2. Pick 1-4 items per cell that match the SubMealPlan category.
3. STRICT REPETITION RULES:
   - For SubMealPlans marked [STAPLE - Daily Repetition Allowed] (such as Breads, Rotis, Rice, Dal, Beverages, Curd): Daily repetition across consecutive days is ALLOWED and ENCOURAGED. The customer expects staple items every day.
   - For SubMealPlans marked [VARIETY - Strictly Rotate, No Repeat] (such as Curries, Paneer dishes, Non-Veg, Desserts, Special Vegetables):
     * NEVER repeat the same item on consecutive days!
     * NEVER repeat items across different dates in this date range!
     * NEVER reuse any item listed in "PREVIOUSLY ASSIGNED ITEMS" above!
     * Ensure rich, fresh culinary variety across every date.
4. CHOICE SELECTION CELLS:
   - For SubMealPlans that participate in Choice Conditions (e.g., Non-Veg vs Egg, or alternative gravies/rices):
   - Generate distinct, well-balanced options for each competing cell so that client companies have top-tier dishes to choose from matching the OKF Training profile.
5. Output ONLY valid JSON array. No markdown, no explanation.`

    const userPrompt = `Generate the menu for: ${datesToGenerate.join(", ")}. Fill only the valid cells listed above.`

    let completion: any = null
    let successfulModel = ""
    let lastError: any = null

    for (const candidate of candidateModels) {
      console.log(`[AI Suggest Batch] Attempting model: ${candidate.model} via ${candidate.baseURL}...`)
      try {
        const client = new OpenAI({ apiKey: candidate.apiKey, baseURL: candidate.baseURL })
        completion = await client.chat.completions.create({
          model: candidate.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.3,
        })
        successfulModel = candidate.model
        console.log(`[AI Suggest Batch] Successfully generated with model: ${candidate.model}`)
        break
      } catch (err: any) {
        lastError = err
        console.warn(`[AI Suggest Batch] Model ${candidate.model} failed with ${err.status || err.message}. Trying next candidate...`)
        if (err.status === 429 || err.status === 503) {
          await new Promise(r => setTimeout(r, 1200))
        }
      }
    }

    if (!completion) {
      console.error("[AI Suggest Batch] All model candidates failed. Last error:", lastError?.message)
      return NextResponse.json({
        success: false,
        error: `AI Error: ${lastError?.message || "Rate limit or quota exhausted across models. Please retry shortly or switch to Ollama."}`,
        debug: { message: lastError?.message, status: lastError?.status }
      }, { status: 500 })
    }

    if (!completion) {
      return NextResponse.json({ success: false, error: "Failed to generate completion." }, { status: 500 });
    }

    let generatedJsonString = completion.choices[0].message.content
    if (!generatedJsonString) throw new Error("Empty response from AI")

    // Strip markdown code fences if present
    if (generatedJsonString.startsWith("\`\`\`json")) {
      generatedJsonString = generatedJsonString.replace(/^\`\`\`json\n/, "").replace(/\n\`\`\`$/, "")
    } else if (generatedJsonString.startsWith("\`\`\`")) {
      generatedJsonString = generatedJsonString.replace(/^\`\`\`\n/, "").replace(/\n\`\`\`$/, "")
    }

    let parsedArray = []
    try {
      parsedArray = JSON.parse(generatedJsonString)
    } catch (e) {
      console.error("[AI] Failed to parse JSON:", generatedJsonString.substring(0, 500))
      throw new Error("AI did not return valid JSON.")
    }

    // --- Build lookup maps ---
    const subMealPlanToMealPlan: Record<string, string> = {}
    for (const smp of subMealPlans) {
      subMealPlanToMealPlan[smp.id] = smp.mealPlanId
    }

    const itemNameToId: Record<string, string> = {}
    allItems.forEach(item => {
      itemNameToId[item.name.toLowerCase()] = item.id
    })

    // Build set of valid cell keys for validation (strictly requiring assigned buildings)
    const validCellKeys = new Set<string>()
    for (const dateStr of Object.keys(validCellsPerDate)) {
      for (const cell of validCellsPerDate[dateStr]) {
        validCellKeys.add(`${dateStr}|${cell.mealPlanId}|${cell.subMealPlanId}`)
        validCellKeys.add(`${dateStr}|${cell.subMealPlanId}`)
      }
    }

    // --- Deterministic Repetition Guard for Non-Repeat SubMealPlans ---
    // Initialize tracking sets from previously used items across the menu
    const usedItemsInNonRepeatPlans: Record<string, Set<string>> = {}
    for (const smp of subMealPlans) {
      if (!repeatSmpIds.has(smp.id)) {
        const priorIds = (usedItemIdsBySubMealPlan && usedItemIdsBySubMealPlan[smp.id]) || []
        usedItemsInNonRepeatPlans[smp.id] = new Set(priorIds.map((id: any) => String(id)))
      }
    }

    // Sort parsed items chronologically to enforce progressive deduplication
    parsedArray.sort((a: any, b: any) => String(a.date || "").localeCompare(String(b.date || "")))

    // Group available items by category and name keywords for smart substitution
    const itemsByCategory: Record<string, typeof availableItems> = {}
    availableItems.forEach(item => {
      const cat = (item.category || "General").toLowerCase()
      if (!itemsByCategory[cat]) itemsByCategory[cat] = []
      itemsByCategory[cat].push(item)
    })

    // Process and deduplicate parsed items
    for (const item of parsedArray) {
      if (!item.date || !item.subMealPlanId) continue

      let smpId = item.subMealPlanId
      if (!subMealPlanToMealPlan[smpId]) {
        const matchedSmp = subMealPlans.find((s: any) => s.name.toLowerCase() === smpId.toLowerCase())
        if (matchedSmp) smpId = matchedSmp.id
      }

      // If this SubMealPlan does NOT allow repeats (isRepeatPlan=false), prevent repetitions
      if (!repeatSmpIds.has(smpId)) {
        if (!usedItemsInNonRepeatPlans[smpId]) {
          usedItemsInNonRepeatPlans[smpId] = new Set()
        }
        const usedSet = usedItemsInNonRepeatPlans[smpId]
        const dedupedItemIds: string[] = []

        for (const rawId of (item.menuItemIds || [])) {
          // Resolve ID
          let resolvedId = rawId
          if (!allItems.some(i => i.id === resolvedId)) {
            if (itemNameToId[rawId.toLowerCase()]) {
              resolvedId = itemNameToId[rawId.toLowerCase()]
            } else {
              const partialMatch = Object.keys(itemNameToId).find(name =>
                name.includes(rawId.toLowerCase()) || rawId.toLowerCase().includes(name)
              )
              if (partialMatch) resolvedId = itemNameToId[partialMatch]
            }
          }

          if (!usedSet.has(resolvedId)) {
            dedupedItemIds.push(resolvedId)
            usedSet.add(resolvedId)
          } else {
            // DUPLICATE DETECTED for non-repeat submeal plan! Find alternative item from available catalog
            const origItem = allItems.find(i => i.id === resolvedId)
            const cat = (origItem?.category || "").toLowerCase()
            const smpDoc = subMealPlans.find((s: any) => s.id === smpId)
            const smpWord = (smpDoc?.name || "").split(" ")[0].toLowerCase()

            const candidate = availableItems.find(i =>
              !usedSet.has(i.id) &&
              !dedupedItemIds.includes(i.id) &&
              ((cat && (i.category || "").toLowerCase() === cat) ||
               (smpWord && i.name.toLowerCase().includes(smpWord)))
            ) || availableItems.find(i => !usedSet.has(i.id) && !dedupedItemIds.includes(i.id))

            if (candidate) {
              console.log(`[AI Deduplication] SubMealPlan "${smpDoc?.name || smpId}": Replaced repeated item "${origItem?.name || resolvedId}" with "${candidate.name}" on ${item.date}`)
              dedupedItemIds.push(candidate.id)
              usedSet.add(candidate.id)
            } else {
              console.log(`[AI Deduplication] SubMealPlan "${smpDoc?.name || smpId}": Dropped duplicate item "${origItem?.name || resolvedId}" on ${item.date}`)
            }
          }
        }

        // If all items were duplicates and dropped, ensure at least one fresh item is assigned
        if (dedupedItemIds.length === 0) {
          const fallbackCandidate = availableItems.find(i => !usedSet.has(i.id))
          if (fallbackCandidate) {
            dedupedItemIds.push(fallbackCandidate.id)
            usedSet.add(fallbackCandidate.id)
          }
        }

        item.menuItemIds = dedupedItemIds
      }
    }

    // --- Transform flat array into nested menuData slice ---
    const generatedSlice: any = {}

    for (const item of parsedArray) {
      if (!item.date || !item.subMealPlanId) continue;

      let smpId = item.subMealPlanId
      let mpId = item.mealPlanId || subMealPlanToMealPlan[smpId]

      // If AI used name instead of ID, try to resolve
      if (!mpId) {
        const matchedSmp = subMealPlans.find((s: any) => s.name.toLowerCase() === smpId.toLowerCase())
        if (matchedSmp) {
          smpId = matchedSmp.id
          mpId = matchedSmp.mealPlanId
        } else {
          console.warn(`[AI] Unknown subMealPlanId: ${item.subMealPlanId}, skipping`)
          continue
        }
      }

      // CRITICAL: Validate this cell actually has an active building assigned on this date
      const cellKey = `${item.date}|${mpId}|${smpId}`
      const smpCellKey = `${item.date}|${smpId}`
      if (!validCellKeys.has(cellKey) && !validCellKeys.has(smpCellKey)) {
        console.warn(`[AI] Cell ${cellKey} has NO building assigned for date ${item.date}, skipping (will NOT map items)`)
        continue
      }

      // Resolve menuItemIds — convert names to IDs if needed
      const resolvedItemIds = (item.menuItemIds || []).map((id: string) => {
        // Already a valid ID?
        if (allItems.some(i => i.id === id)) return id
        // Try exact name match
        if (itemNameToId[id.toLowerCase()]) return itemNameToId[id.toLowerCase()]
        // Try partial match
        const partialMatch = Object.keys(itemNameToId).find(name =>
          name.includes(id.toLowerCase()) || id.toLowerCase().includes(name)
        )
        if (partialMatch) return itemNameToId[partialMatch]
        return id // Return as-is, might be a new item
      })

      // Build nested structure
      if (!generatedSlice[item.date]) generatedSlice[item.date] = {}
      if (!generatedSlice[item.date][serviceId]) generatedSlice[item.date][serviceId] = {}
      if (!generatedSlice[item.date][serviceId][subServiceId]) generatedSlice[item.date][serviceId][subServiceId] = {}
      if (!generatedSlice[item.date][serviceId][subServiceId][mpId]) generatedSlice[item.date][serviceId][subServiceId][mpId] = {}

      generatedSlice[item.date][serviceId][subServiceId][mpId][smpId] = {
        menuItemIds: resolvedItemIds,
        customAssignments: {},
      }
    }

    console.log("[AI Suggest Batch] generatedSlice keys:", Object.keys(generatedSlice));
    console.log("[AI Suggest Batch] total valid cells:", validCellKeys.size, "| AI generated cells:", parsedArray.length);

    return NextResponse.json({ success: true, menuDataSlice: generatedSlice })

  } catch (error: any) {
    console.error("Error generating batch:", error)
    return NextResponse.json({ error: error.message || "Failed to generate batch" }, { status: 500 })
  }
}
