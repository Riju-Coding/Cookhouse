import { NextResponse } from "next/server"
import OpenAI from "openai"
import { collection, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"

export const runtime = "nodejs"
export const maxDuration = 300

interface CandidateItem {
  id: string
  name: string
  category?: string
}

interface ChoiceOption {
  mealPlanId: string
  mealPlanName: string
  subMealPlanId: string
  subMealPlanName: string
  maxFrequency: number
  isRepeatPlan: boolean
  candidateDishes: CandidateItem[]
}

interface ChoiceTask {
  selectionKey: string
  companyId?: string
  companyName: string
  buildingId?: string
  buildingName: string
  choiceId: string
  choiceDay: string
  date: string
  quantity: number
  serviceId?: string
  subServiceId?: string
  options: ChoiceOption[]
  associations?: Array<{ companyId: string; buildingId: string; originalChoiceId: string }>
}

/**
 * Searches menuData for the menuItemIds belonging to a mealPlan + subMealPlan on a specific date.
 * Prioritizes the choice's own serviceId and subServiceId, then searches across all services.
 */
function findCellItemIds(
  menuData: any,
  dateStr: string,
  mpId: string,
  smpId: string,
  preferredServiceId?: string,
  preferredSubServiceId?: string
): string[] {
  if (!menuData || !menuData[dateStr]) return []
  const daySlice = menuData[dateStr]

  const getItemIdsFromSubService = (ssObj: any, targetMpId: string, targetSmpId: string): string[] => {
    if (!ssObj) return []
    // 1. Direct match with mpId + smpId
    const direct = ssObj[targetMpId]?.[targetSmpId]?.menuItemIds
    if (Array.isArray(direct) && direct.length > 0) return direct

    // 2. Scan all mpIds in this subService for targetSmpId
    for (const mpKey of Object.keys(ssObj)) {
      const cell = ssObj[mpKey]?.[targetSmpId]?.menuItemIds
      if (Array.isArray(cell) && cell.length > 0) return cell
    }
    return []
  }

  // 1. Preferred service & preferred subService
  if (preferredServiceId && preferredSubServiceId && daySlice[preferredServiceId]) {
    const ids = getItemIdsFromSubService(daySlice[preferredServiceId][preferredSubServiceId], mpId, smpId)
    if (ids.length > 0) return ids
  }

  // 2. Preferred service across ALL its other subServices (e.g. Buffet)
  if (preferredServiceId && daySlice[preferredServiceId]) {
    for (const ssId of Object.keys(daySlice[preferredServiceId])) {
      if (ssId === preferredSubServiceId) continue
      const ids = getItemIdsFromSubService(daySlice[preferredServiceId][ssId], mpId, smpId)
      if (ids.length > 0) return ids
    }
  }

  // 3. Fallback: Search other services on that date
  for (const sId of Object.keys(daySlice)) {
    if (sId === preferredServiceId) continue
    for (const ssId of Object.keys(daySlice[sId] || {})) {
      const ids = getItemIdsFromSubService(daySlice[sId][ssId], mpId, smpId)
      if (ids.length > 0) return ids
    }
  }

  return []
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      serviceId,
      subServiceId,
      dateRange,
      companiesWithChoices = [],
      universalChoices = [],
      universalAssociations = {},
      menuData = {},
      mode = "universal", // "universal" | "company" | "all_companies"
      targetCompanyId,
      targetBuildingId,
      aiModel = "gemini",
      existingSelections = {},
    } = body

    if (!dateRange || !dateRange.length) {
      return NextResponse.json({ error: "Missing required dateRange" }, { status: 400 })
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

    // --- Fetch Reference Data in Parallel ---
    const [trainingProfilesSnap, mealPlansSnap, subMealPlansSnap, menuItemsSnap] = await Promise.all([
      getDocs(collection(db, "aiTrainingProfiles")),
      getDocs(collection(db, "mealPlans")),
      getDocs(collection(db, "subMealPlans")),
      getDocs(collection(db, "menuItems")),
    ])

    const mealPlans = mealPlansSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
    const subMealPlans = subMealPlansSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
    const menuItems = menuItemsSnap.docs.map(d => ({ id: d.id, name: (d.data() as any).name, category: (d.data() as any).category || "" }))
    const menuItemMap = new Map(menuItems.map(i => [i.id, i]))

    // Map training profiles by document id
    const trainingProfilesMap = new Map<string, any>()
    trainingProfilesSnap.docs.forEach(d => trainingProfilesMap.set(d.id, d.data()))

    // --- Build Choice Tasks ---
    const tasks: ChoiceTask[] = []

    if (mode === "universal") {
      // Universal choices aggregated across companies
      for (const choice of (universalChoices || [])) {
        const choiceDay = (choice.choiceDay || "").toLowerCase()
        const matchDateObj = dateRange.find((d: any) => d.day?.toLowerCase() === choiceDay)
        if (!matchDateObj) continue
        const dateStr = matchDateObj.date

        const prefSvcId = choice.serviceId || serviceId
        const prefSubSvcId = choice.subServiceId || subServiceId

        const options: ChoiceOption[] = []
        for (const mp of (choice.mealPlans || [])) {
          const mpInfo = mealPlans.find((m: any) => m.id === mp.mealPlanId)
          for (const smp of (mp.subMealPlans || [])) {
            const smpInfo = subMealPlans.find((s: any) => s.id === smp.subMealPlanId)
            const cellItemsIds = findCellItemIds(menuData, dateStr, mp.mealPlanId, smp.subMealPlanId, prefSvcId, prefSubSvcId)
            const candidateDishes = cellItemsIds.map(id => menuItemMap.get(id)).filter(Boolean) as CandidateItem[]

            // IMPORTANT: A choice option can ONLY be selected if dishes are actually present in the menu cell!
            // No fake catalog injection.
            if (candidateDishes.length > 0) {
              options.push({
                mealPlanId: mp.mealPlanId,
                mealPlanName: mpInfo?.name || mp.mealPlanName || "Meal Plan",
                subMealPlanId: smp.subMealPlanId,
                subMealPlanName: smpInfo?.name || smp.subMealPlanName || "Sub Meal Plan",
                maxFrequency: smpInfo?.maxFrequency || 7,
                isRepeatPlan: Boolean(smpInfo?.isRepeatPlan),
                candidateDishes,
              })
            }
          }
        }

        // Only create task if we have options with real dishes in the menu
        if (options.length > 0) {
          const associations = Array.isArray(universalAssociations?.[choice.choiceId])
            ? universalAssociations[choice.choiceId]
            : (typeof universalAssociations?.get === 'function' ? universalAssociations.get(choice.choiceId) : [])

          tasks.push({
            selectionKey: choice.choiceId,
            companyName: "Universal (All Companies)",
            buildingName: "All Buildings",
            choiceId: choice.choiceId,
            choiceDay,
            date: dateStr,
            quantity: Number(choice.quantity) || 1,
            serviceId: prefSvcId,
            subServiceId: prefSubSvcId,
            options,
            associations: associations || [],
          })
        }
      }
    } else {
      // Per-company / building choices
      let targetCompanies = companiesWithChoices
      if (mode === "company" && targetCompanyId) {
        targetCompanies = companiesWithChoices.filter((c: any) =>
          c.companyId === targetCompanyId &&
          (targetBuildingId ? c.buildingId === targetBuildingId : true)
        )
      }

      for (const comp of targetCompanies) {
        for (const choice of (comp.choices || [])) {
          const choiceDay = (choice.choiceDay || "").toLowerCase()
          const matchDateObj = dateRange.find((d: any) => d.day?.toLowerCase() === choiceDay)
          if (!matchDateObj) continue
          const dateStr = matchDateObj.date

          const prefSvcId = choice.serviceId || serviceId
          const prefSubSvcId = choice.subServiceId || subServiceId

          const options: ChoiceOption[] = []
          for (const mp of (choice.mealPlans || [])) {
            const mpInfo = mealPlans.find((m: any) => m.id === mp.mealPlanId)
            for (const smp of (mp.subMealPlans || [])) {
              const smpInfo = subMealPlans.find((s: any) => s.id === smp.subMealPlanId)
              const cellItemsIds = findCellItemIds(menuData, dateStr, mp.mealPlanId, smp.subMealPlanId, prefSvcId, prefSubSvcId)
              const candidateDishes = cellItemsIds.map(id => menuItemMap.get(id)).filter(Boolean) as CandidateItem[]

              // Real dishes only
              if (candidateDishes.length > 0) {
                options.push({
                  mealPlanId: mp.mealPlanId,
                  mealPlanName: mpInfo?.name || mp.mealPlanName || "Meal Plan",
                  subMealPlanId: smp.subMealPlanId,
                  subMealPlanName: smpInfo?.name || smp.subMealPlanName || "Sub Meal Plan",
                  maxFrequency: smpInfo?.maxFrequency || 7,
                  isRepeatPlan: Boolean(smpInfo?.isRepeatPlan),
                  candidateDishes,
                })
              }
            }
          }

          if (options.length > 0) {
            tasks.push({
              selectionKey: `${comp.companyId}-${comp.buildingId}-${choice.choiceId}`,
              companyId: comp.companyId,
              companyName: comp.companyName,
              buildingId: comp.buildingId,
              buildingName: comp.buildingName,
              choiceId: choice.choiceId,
              choiceDay,
              date: dateStr,
              quantity: Number(choice.quantity) || 1,
              serviceId: prefSvcId,
              subServiceId: prefSubSvcId,
              options,
            })
          }
        }
      }
    }

    if (tasks.length === 0) {
      return NextResponse.json({
        success: true,
        selections: {},
        totalChoicesResolved: 0,
        summary: "No menu items were found in the menu grid for these choices. Please add or generate menu items into the menu first before selecting choices."
      })
    }

    // --- Build OKF Knowledge from Training Profiles ---
    const relevantRules: string[] = []
    const seenProfIds = new Set<string>()

    // Global training guidelines
    const globalProf = trainingProfilesMap.get("GLOBAL_GLOBAL")
    if (globalProf?.profileText) {
      relevantRules.push(`### Global Foodservice Guidelines:\n${globalProf.profileText}`)
      seenProfIds.add("GLOBAL_GLOBAL")
    }

    // Service-specific and company-specific training profiles
    tasks.forEach(t => {
      if (t.serviceId && t.subServiceId) {
        // 1. Company-specific profile if any
        if (t.companyId) {
          const compProfKey = `${t.serviceId}_${t.subServiceId}_${t.companyId}`
          const cProf = trainingProfilesMap.get(compProfKey)
          if (cProf?.profileText && !seenProfIds.has(compProfKey)) {
            relevantRules.push(`### Preferences for ${t.companyName}:\n${cProf.profileText}`)
            seenProfIds.add(compProfKey)
          }
        }
        // 2. Service/SubService profile
        const svcProfKey = `${t.serviceId}_${t.subServiceId}`
        const sProf = trainingProfilesMap.get(svcProfKey)
        if (sProf?.profileText && !seenProfIds.has(svcProfKey)) {
          relevantRules.push(`### Service Guidelines (${svcProfKey}):\n${sProf.profileText}`)
          seenProfIds.add(svcProfKey)
        }
      }
    })

    const okfKnowledge = relevantRules.length > 0
      ? relevantRules.join("\n\n")
      : "Balance dietary variety, respect weekly frequency limits, and obey company choice preferences."

    // --- Prepare Concise Prompt for AI Model ---
    const compactTasks = tasks.map(t => ({
      key: t.selectionKey,
      company: t.companyName,
      building: t.buildingName,
      day: t.choiceDay,
      date: t.date,
      quantityLimit: t.quantity,
      competingOptions: t.options.map(o => ({
        mealPlanId: o.mealPlanId,
        mealPlanName: o.mealPlanName,
        subMealPlanId: o.subMealPlanId,
        subMealPlanName: o.subMealPlanName,
        maxWeeklyFrequency: o.maxFrequency,
        availableDishes: o.candidateDishes.map(d => ({ id: d.id, name: d.name }))
      }))
    }))

    const systemPrompt = `You are Cookhouse Catering's AI Choice Selector and Dietary Architect.
Your task is to select the winning choice dishes for each company and day strictly based on the learned OKF Training profile and Choice Conditions.

### OKF TRAINING KNOWLEDGE & CLIENT RULES:
${okfKnowledge.substring(0, 9000)}

### CRITICAL RULES & CONDITIONS:
1. STRICT CANDIDATES ONLY: You may ONLY choose dishes from the "availableDishes" list of each option. NEVER invent dishes or IDs.
2. QUANTITY LIMIT: Each choice specifies a strict "quantityLimit" (e.g. 1 or 2).
   You MUST select EXACTLY the quantityLimit number of dishes across the options.
3. PREFERENCES & RULES: Obey company preferences from training (e.g. specific dishes or subMealPlans preferred on specific days).
4. FREQUENCY: Respect maxWeeklyFrequency. Do not select the same subMealPlan more times per week than permitted.
5. ROTATION: Rotate dishes across days; avoid consecutive repeats.

### OUTPUT FORMAT:
You MUST return a valid JSON object:
{
  "selections": {
    "<key>": [
      {
        "mealPlanId": "<mealPlanId>",
        "mealPlanName": "<mealPlanName>",
        "subMealPlanId": "<subMealPlanId>",
        "subMealPlanName": "<subMealPlanName>",
        "selectedItemId": "<exact id of chosen dish from availableDishes>",
        "selectedItemName": "<exact name of chosen dish>",
        "reason": "<short justification>"
      }
    ]
  },
  "summary": "Short explanation of the choice rationale"
}`

    const userPrompt = `Select the right choices for the following tasks:\n${JSON.stringify(compactTasks, null, 2)}`

    // --- Model Fallback Execution Loop ---
    let completion: any = null
    let successfulModel = ""
    let lastError: any = null

    for (const candidate of candidateModels) {
      console.log(`[AI Choice Suggest] Attempting model: ${candidate.model} via ${candidate.baseURL}...`)
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
        console.log(`[AI Choice Suggest] Successfully generated with model: ${candidate.model}`)
        break
      } catch (err: any) {
        lastError = err
        console.warn(`[AI Choice Suggest] Model ${candidate.model} failed with ${err.status || err.message}. Trying next candidate...`)
        if (err.status === 429 || err.status === 503) {
          await new Promise(r => setTimeout(r, 1000))
        }
      }
    }

    let parsedSelections: Record<string, any[]> = {}
    let rationaleSummary = ""

    if (completion) {
      try {
        let content = completion.choices[0]?.message?.content || "{}"
        if (content.startsWith("```json")) {
          content = content.replace(/^```json\n/, "").replace(/\n```$/, "")
        } else if (content.startsWith("```")) {
          content = content.replace(/^```\n/, "").replace(/\n```$/, "")
        }
        const parsed = JSON.parse(content)
        parsedSelections = parsed.selections || {}
        rationaleSummary = parsed.summary || ""
      } catch (parseErr) {
        console.warn("[AI Choice Suggest] Failed to parse AI JSON, falling back to deterministic resolution:", parseErr)
      }
    }

    // --- Strict Validation & Heuristic Selection ---
    // Enforce that EVERY selected item strictly exists in task.options[...].candidateDishes!
    const finalSelections: Record<string, any[]> = {}
    const smpWeeklyUsage: Record<string, number> = {}

    // Track existing selections frequency
    Object.values(existingSelections).forEach((arr: any) => {
      if (Array.isArray(arr)) {
        arr.forEach((item: any) => {
          if (item?.subMealPlanId) {
            smpWeeklyUsage[item.subMealPlanId] = (smpWeeklyUsage[item.subMealPlanId] || 0) + 1
          }
        })
      }
    })

    for (const task of tasks) {
      const rawAiItems = parsedSelections[task.selectionKey]
      const validItems: any[] = []
      const chosenSmpIds = new Set<string>()
      const chosenDishIds = new Set<string>()

      // 1. Validate items returned by AI
      if (Array.isArray(rawAiItems)) {
        for (const item of rawAiItems) {
          if (validItems.length >= task.quantity) break
          if (!item?.selectedItemId) continue

          // Find which option contains this candidate dish
          const matchingOption = task.options.find(o =>
            o.candidateDishes.some(d => d.id === item.selectedItemId)
          )

          if (matchingOption && !chosenDishIds.has(item.selectedItemId)) {
            const realDish = matchingOption.candidateDishes.find(d => d.id === item.selectedItemId)!
            validItems.push({
              mealPlanId: matchingOption.mealPlanId,
              mealPlanName: matchingOption.mealPlanName,
              subMealPlanId: matchingOption.subMealPlanId,
              subMealPlanName: matchingOption.subMealPlanName,
              selectedItemId: realDish.id,
              selectedItemName: realDish.name,
              reason: item.reason || "Selected according to OKF training profile",
            })
            chosenSmpIds.add(matchingOption.subMealPlanId)
            chosenDishIds.add(realDish.id)
            smpWeeklyUsage[matchingOption.subMealPlanId] = (smpWeeklyUsage[matchingOption.subMealPlanId] || 0) + 1
          }
        }
      }

      // 2. If AI did not select enough items to reach task.quantity, fill from candidate dishes
      if (validItems.length < task.quantity) {
        // Rank remaining options by training knowledge & lowest frequency usage
        const remainingOptions = task.options.filter(o => !chosenSmpIds.has(o.subMealPlanId))
        remainingOptions.sort((a, b) => {
          const aCount = smpWeeklyUsage[a.subMealPlanId] || 0
          const bCount = smpWeeklyUsage[b.subMealPlanId] || 0
          const aAtLimit = aCount >= a.maxFrequency ? 1 : 0
          const bAtLimit = bCount >= b.maxFrequency ? 1 : 0
          if (aAtLimit !== bAtLimit) return aAtLimit - bAtLimit

          const aInProfile = okfKnowledge.toLowerCase().includes(a.subMealPlanName.toLowerCase()) ? 1 : 0
          const bInProfile = okfKnowledge.toLowerCase().includes(b.subMealPlanName.toLowerCase()) ? 1 : 0
          if (aInProfile !== bInProfile) return bInProfile - aInProfile

          return b.candidateDishes.length - a.candidateDishes.length
        })

        for (const opt of remainingOptions) {
          if (validItems.length >= task.quantity) break
          const dish = opt.candidateDishes.find(d => !chosenDishIds.has(d.id)) || opt.candidateDishes[0]
          if (dish) {
            validItems.push({
              mealPlanId: opt.mealPlanId,
              mealPlanName: opt.mealPlanName,
              subMealPlanId: opt.subMealPlanId,
              subMealPlanName: opt.subMealPlanName,
              selectedItemId: dish.id,
              selectedItemName: dish.name,
              reason: "Selected from menu cell based on OKF rules and variety",
            })
            chosenSmpIds.add(opt.subMealPlanId)
            chosenDishIds.add(dish.id)
            smpWeeklyUsage[opt.subMealPlanId] = (smpWeeklyUsage[opt.subMealPlanId] || 0) + 1
          }
        }
      }

      // If still below quantity and options can repeat dishes, pick from any option with dishes
      if (validItems.length < task.quantity) {
        for (const opt of task.options) {
          if (validItems.length >= task.quantity) break
          const dish = opt.candidateDishes.find(d => !chosenDishIds.has(d.id))
          if (dish) {
            validItems.push({
              mealPlanId: opt.mealPlanId,
              mealPlanName: opt.mealPlanName,
              subMealPlanId: opt.subMealPlanId,
              subMealPlanName: opt.subMealPlanName,
              selectedItemId: dish.id,
              selectedItemName: dish.name,
              reason: "Selected to fulfill choice limit",
            })
            chosenDishIds.add(dish.id)
          }
        }
      }

      // 3. Store into final selections
      if (validItems.length > 0) {
        if (mode === "universal" && task.associations && task.associations.length > 0) {
          task.associations.forEach(assoc => {
            const bKey = `${assoc.companyId}-${assoc.buildingId}-${assoc.originalChoiceId || task.choiceId}`
            finalSelections[bKey] = validItems
          })
        } else {
          finalSelections[task.selectionKey] = validItems
        }
      }
    }

    const totalResolved = Object.keys(finalSelections).length

    return NextResponse.json({
      success: true,
      selections: finalSelections,
      totalChoicesResolved: totalResolved,
      modelUsed: successfulModel,
      summary: rationaleSummary || `Successfully auto-selected ${totalResolved} choice contracts strictly from menu cells according to OKF training.`,
    })
  } catch (err: any) {
    console.error("[AI Choice Suggest] Unexpected Error:", err)
    return NextResponse.json({
      error: `Failed to suggest choices: ${err.message || "Unknown error"}`,
      details: err.stack,
    }, { status: 500 })
  }
}
