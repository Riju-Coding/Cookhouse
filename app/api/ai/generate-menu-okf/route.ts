import { NextResponse } from "next/server"
import OpenAI from "openai"
import { doc, getDoc, collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"

export const runtime = "nodejs"
export const maxDuration = 300 // Max duration for long AI generation (Vercel/NextJS)

function getEnv(name: string): string | undefined {
  const v = process.env[name]
  if (!v) return undefined
  const t = v.trim()
  return t.length ? t : undefined
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { serviceId, subServiceId, startDate, endDate, mealPlanId } = body

    if (!serviceId || !subServiceId || !startDate || !endDate || !mealPlanId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ""
    const geminiURL = "https://generativelanguage.googleapis.com/v1beta/openai/"
    const naraKey = process.env.NARA_API_KEY || ""
    const bedrockKey = process.env.AWS_BEARER_TOKEN_BEDROCK || process.env.OPENAI_API_KEY || ""
    const bedrockURL = process.env.OPENAI_BASE_URL || "https://bedrock-mantle.ap-south-1.api.aws/v1"
    const bedrockModel = process.env.BEDROCK_MANTLE_MODEL || "openai.gpt-oss-120b"

    const candidateModels: { model: string; apiKey: string; baseURL: string }[] = []
    if (geminiKey) {
      candidateModels.push(
        { model: "gemini-2.5-flash", apiKey: geminiKey, baseURL: geminiURL },
        { model: "gemini-2.0-flash", apiKey: geminiKey, baseURL: geminiURL },
        { model: "gemini-1.5-flash", apiKey: geminiKey, baseURL: geminiURL },
        { model: "gemini-3.5-flash-lite", apiKey: geminiKey, baseURL: geminiURL },
      )
    }
    if (bedrockKey) {
      candidateModels.push({ model: bedrockModel, apiKey: bedrockKey, baseURL: bedrockURL })
    }
    if (naraKey) {
      candidateModels.push({ model: "claude-sonnet-5", apiKey: naraKey, baseURL: "https://router.bynara.id/v1" })
    }
    candidateModels.push({ model: "llama3.1", apiKey: "ollama", baseURL: "http://127.0.0.1:11434/v1" })

    if (candidateModels.length === 0) {
      return NextResponse.json({ error: "No AI model or API key configured" }, { status: 500 })
    }

    // Fetch OKF Knowledge
    let okfDocRef = doc(db, "aiTrainingProfiles", `${serviceId}_${subServiceId}`)
    let okfSnap = await getDoc(okfDocRef)
    
    // Fallback to Global Profile if specific one doesn't exist
    if (!okfSnap.exists()) {
      okfDocRef = doc(db, "aiTrainingProfiles", "GLOBAL_GLOBAL")
      okfSnap = await getDoc(okfDocRef)
    }

    let okfKnowledge = ""
    if (okfSnap.exists()) {
      okfKnowledge = okfSnap.data().profileText
    } else {
      return NextResponse.json({ error: "No OKF Knowledge found for this Service/SubService, and no Global Profile found. Please extract OKF first in the AI Training module." }, { status: 400 })
    }

    // Fetch Meal Plan Structure to enforce strict limits
    const mealPlanSnap = await getDoc(doc(db, "mealPlans", mealPlanId))
    if (!mealPlanSnap.exists()) {
       return NextResponse.json({ error: "Meal Plan not found" }, { status: 400 })
    }
    const mealPlanData = mealPlanSnap.data()
    const structureString = JSON.stringify(mealPlanData, null, 2)

    // Fetch sub meal plans for the selected meal plan to guide the AI
    const subMealPlansSnap = await getDocs(collection(db, "subMealPlans"))
    const subMealPlans = subMealPlansSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as any))
      .filter(smp => smp.mealPlanId === mealPlanId)
    const smpString = JSON.stringify(subMealPlans.map(s => ({id: s.id, name: s.name})), null, 2)

    // Optional: Fetch actual menu items (ingredients) so AI uses real IDs (limited to 200 for token limits)
    const itemsSnap = await getDocs(collection(db, "menuItems"))
    const availableItems = itemsSnap.docs.map(d => ({id: d.id, name: (d.data() as any).name})).slice(0, 200)
    const itemsString = JSON.stringify(availableItems)

    const systemPrompt = `You are an expert autonomous AI Menu Planner.
You are tasked with generating a "Combined Master Menu" for a corporate catering service from ${startDate} to ${endDate}.

# Guidelines (OKF Knowledge)
You must strictly follow these reverse-engineered rules regarding cuisine pairings, choice structures, and custom assignments:
${okfKnowledge}

# Mandatory Structure
You must strictly obey this Meal Plan Structure (categories and item limits):
${structureString}

# Sub Meal Plans
You must assign items to these sub meal plans (e.g. Breakfast, Lunch):
${smpString}

# Available Ingredients (Use these IDs if possible, else make them up)
${itemsString}

# Output Requirements
Generate the menu as a JSON array where each object represents a specific day and sub-meal plan.
Required JSON structure:
[
  {
    "date": "YYYY-MM-DD",
    "subMealPlanId": "the_sub_meal_plan_id",
    "menuItemIds": ["id_1", "id_2"],
    "customAssignments": {
       "company_name_or_id": {
          "menuItemIds": ["id_3"]
       }
    }
  }
]

Output ONLY valid JSON. No markdown wrappers. Just the JSON array.`

    const userPrompt = `Generate the menu from ${startDate} to ${endDate}.`

    let completion: any = null
    let lastError: any = null

    for (const candidate of candidateModels) {
      console.log(`[AI OKF Menu] Attempting model: ${candidate.model} via ${candidate.baseURL}...`)
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
        console.log(`[AI OKF Menu] Successfully generated with model: ${candidate.model}`)
        break
      } catch (err: any) {
        lastError = err
        console.warn(`[AI OKF Menu] Model ${candidate.model} failed with ${err.status || err.message}. Trying next candidate...`)
        if (err.status === 429 || err.status === 503) {
          await new Promise(r => setTimeout(r, 1200))
        }
      }
    }

    if (!completion) {
      return NextResponse.json({
        error: `AI Error: ${lastError?.message || "Failed to generate menu across all AI model candidates."}`
      }, { status: 500 })
    }

    let generatedJsonString = completion.choices[0].message.content
    if (!generatedJsonString) throw new Error("Empty response from AI")

    if (generatedJsonString.startsWith("\`\`\`json")) {
        generatedJsonString = generatedJsonString.replace(/^\`\`\`json\n/, "").replace(/\n\`\`\`$/, "")
    } else if (generatedJsonString.startsWith("\`\`\`")) {
        generatedJsonString = generatedJsonString.replace(/^\`\`\`\n/, "").replace(/\n\`\`\`$/, "")
    }

    let parsedArray = []
    try {
        parsedArray = JSON.parse(generatedJsonString)
    } catch(e) {
        throw new Error("AI did not return valid JSON.")
    }

    // Transform flat array into deeply nested menuData expected by the frontend
    // Format: menuData[date][serviceId][subServiceId][mealPlanId][subMealPlanId] = { menuItemIds, customAssignments }
    const finalMenuData: any = {}

    for (const item of parsedArray) {
       if (!item.date || !item.subMealPlanId) continue;
       
       if (!finalMenuData[item.date]) finalMenuData[item.date] = {}
       if (!finalMenuData[item.date][serviceId]) finalMenuData[item.date][serviceId] = {}
       if (!finalMenuData[item.date][serviceId][subServiceId]) finalMenuData[item.date][serviceId][subServiceId] = {}
       if (!finalMenuData[item.date][serviceId][subServiceId][mealPlanId]) finalMenuData[item.date][serviceId][subServiceId][mealPlanId] = {}
       
       finalMenuData[item.date][serviceId][subServiceId][mealPlanId][item.subMealPlanId] = {
           menuItemIds: item.menuItemIds || [],
           customAssignments: item.customAssignments || {}
       }
    }

    // Create the Combined Menu Document in Firestore
    const combinedMenuPayload = {
      startDate,
      endDate,
      serviceId,
      subServiceId,
      mealPlanId,
      status: "Draft",
      generatedBy: "OKF-Agent",
      menuData: finalMenuData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }

    const docRef = await addDoc(collection(db, "combinedMenus"), combinedMenuPayload)

    return NextResponse.json({ success: true, menuId: docRef.id })

  } catch (error: any) {
    console.error("Error generating menu:", error)
    return NextResponse.json({ error: error.message || "Failed to generate menu" }, { status: 500 })
  }
}
