import { NextResponse } from "next/server"
import OpenAI from "openai"
import { doc, getDoc, collection, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"

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
    const { serviceId, subServiceId, datesToGenerate, currentMenuData, aiModel } = body

    if (!serviceId || !subServiceId || !datesToGenerate || !datesToGenerate.length) {
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
      // Prioritize flash-lite models (instant response, active quota, no 429)
      candidateModels = [
        { model: "gemini-3.5-flash-lite", apiKey: geminiKey, baseURL: geminiURL },
        { model: "gemini-flash-lite-latest", apiKey: geminiKey, baseURL: geminiURL },
        { model: "gemini-3.1-flash-lite", apiKey: geminiKey, baseURL: geminiURL },
        { model: "gemini-3.5-flash", apiKey: geminiKey, baseURL: geminiURL },
        { model: "llama3.1", apiKey: "ollama", baseURL: "http://127.0.0.1:11434/v1" },
      ]
    }

    // --- Fetch OKF Knowledge ---
    let okfDocRef = doc(db, "aiTrainingProfiles", `${serviceId}_${subServiceId}`)
    let okfSnap = await getDoc(okfDocRef)
    if (!okfSnap.exists()) {
      okfDocRef = doc(db, "aiTrainingProfiles", "GLOBAL_GLOBAL")
      okfSnap = await getDoc(okfDocRef)
    }

    let okfKnowledge = ""
    if (okfSnap.exists()) {
      okfKnowledge = okfSnap.data().profileText?.substring(0, 10000) || ""
    } else {
      okfKnowledge = "No previous training data available. Use your best judgment based on the structure and items provided."
    }

    // --- Fetch Meal Plans ---
    const allMealPlansSnap = await getDocs(collection(db, "mealPlans"))
    const mealPlanData = allMealPlansSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter((mp: any) => mp.status === "active")

    // --- Fetch Sub Meal Plans ---
    const subMealPlansSnap = await getDocs(collection(db, "subMealPlans"))
    const subMealPlans = subMealPlansSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter((smp: any) => smp.status === "active")

    // --- Fetch ALL menu items (not just 50) ---
    const itemsSnap = await getDocs(collection(db, "menuItems"))
    const allItems = itemsSnap.docs.map(d => ({
      id: d.id,
      name: (d.data() as any).name,
      category: (d.data() as any).category || "",
    }))
    // Send up to 500 items with category info for better matching
    const availableItems = allItems.slice(0, 500)

    // --- Fetch Structure Assignments (CRITICAL: determines which cells exist) ---
    const structAssignSnap = await getDocs(collection(db, "mealPlanStructureAssignments"))
    const allStructAssignments = structAssignSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter((a: any) => a.status === "active")

    // --- Resolve Service/SubService names ---
    const serviceDoc = await getDoc(doc(db, "services", serviceId))
    const serviceName = serviceDoc.exists() ? serviceDoc.data().name : serviceId
    const subServiceDoc = await getDoc(doc(db, "subServices", subServiceId))
    const subServiceName = subServiceDoc.exists() ? subServiceDoc.data().name : subServiceId

    // --- Build the VALID CELLS MAP ---
    // For each date, determine the day-of-week, then check all structure assignments
    // to find which mealPlanId + subMealPlanId combos are active for this service/subService
    const validCellsPerDate: Record<string, Array<{ mealPlanId: string; mealPlanName: string; subMealPlanId: string; subMealPlanName: string }>> = {}

    for (const dateStr of datesToGenerate) {
      const dateObj = new Date(dateStr)
      const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
      const dayKey = dayNames[dateObj.getDay()]

      const cellsForDate = new Set<string>() // Set of "mpId|smpId" to deduplicate
      const cellsArray: Array<{ mealPlanId: string; mealPlanName: string; subMealPlanId: string; subMealPlanName: string }> = []

      for (const assignment of allStructAssignments) {
        const dayStructure = assignment.weekStructure?.[dayKey] || []
        for (const svc of dayStructure) {
          if (svc.serviceId !== serviceId) continue
          for (const ss of (svc.subServices || [])) {
            if (ss.subServiceId !== subServiceId) continue
            for (const mp of (ss.mealPlans || [])) {
              for (const smp of (mp.subMealPlans || [])) {
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
                  })
                }
              }
            }
          }
        }
      }

      validCellsPerDate[dateStr] = cellsArray
    }

    // Build a clean instruction for the AI about which cells to fill
    const validCellsInstruction = Object.entries(validCellsPerDate).map(([date, cells]) => {
      if (cells.length === 0) return `${date}: NO CELLS — leave this date completely empty, generate nothing.`
      const cellsList = cells.map(c => `  - MealPlan: "${c.mealPlanName}" (ID: ${c.mealPlanId}) → SubMealPlan: "${c.subMealPlanName}" (ID: ${c.subMealPlanId})`).join("\n")
      return `${date} (${new Date(date).toLocaleDateString("en", { weekday: "long" })}):\n${cellsList}`
    }).join("\n\n")

    // Build the system prompt
    const systemPrompt = `You are an expert autonomous AI Menu Planner for a catering company.

# Context
- Service: ${serviceName} (ID: ${serviceId})
- Sub-Service: ${subServiceName} (ID: ${subServiceId})
- Dates to generate: ${datesToGenerate.join(", ")}

# CRITICAL RULE: Only Fill Valid Cells
You MUST ONLY generate items for the EXACT cells listed below. Each cell is defined by a date + mealPlanId + subMealPlanId combination.
If a date has NO cells listed, you must NOT generate anything for that date.
DO NOT invent new cells or fill cells not listed here.

## Valid Cells Per Date:
${validCellsInstruction}

# OKF Knowledge (Learned Patterns)
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
3. Do NOT repeat the same item on consecutive days.
4. Output ONLY valid JSON array. No markdown, no explanation.`

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

    // Build set of valid cell keys for validation
    const validCellKeys = new Set<string>()
    for (const dateStr of Object.keys(validCellsPerDate)) {
      for (const cell of validCellsPerDate[dateStr]) {
        validCellKeys.add(`${dateStr}|${cell.mealPlanId}|${cell.subMealPlanId}`)
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

      // Validate this cell actually exists in structure assignments
      const cellKey = `${item.date}|${mpId}|${smpId}`
      if (!validCellKeys.has(cellKey)) {
        console.warn(`[AI] Cell ${cellKey} is not in valid structure, skipping (would create a blank cell that shouldn't exist)`)
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
