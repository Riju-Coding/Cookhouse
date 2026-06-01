import { NextResponse } from "next/server"
import OpenAI from "openai"
import { collection, getDocs, query, limit, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import {
  servicesService,
  subServicesService,
  mealPlansService,
  subMealPlansService,
  menuItemsService,
} from "@/lib/services"

export const runtime = "nodejs"

function getEnv(name: string): string | undefined {
  const v = process.env[name]
  if (!v) return undefined
  const t = v.trim()
  return t.length ? t : undefined
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { serviceId, subServiceId } = body

    if (!serviceId || !subServiceId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const apiKey = getEnv("AWS_BEARER_TOKEN_BEDROCK") ?? getEnv("OPENAI_API_KEY")
    const baseURL = getEnv("OPENAI_BASE_URL") ?? "https://bedrock-mantle.ap-south-1.api.aws/v1"
    const model = getEnv("BEDROCK_MANTLE_MODEL") ?? "openai.gpt-oss-120b"

    if (!apiKey) {
      return NextResponse.json({ error: "No API key configured" }, { status: 500 })
    }

    const openai = new OpenAI({ apiKey, baseURL })

    // 1. Fetch metadata to resolve IDs to names
    const [svcs, ssvcs, mps, smps, menuItems] = await Promise.all([
      servicesService.getAll(),
      subServicesService.getAll(),
      mealPlansService.getAll(),
      subMealPlansService.getAll(),
      menuItemsService.getAll(),
    ])

    const svcName = svcs.find(s => s.id === serviceId)?.name || serviceId
    const subSvcName = ssvcs.find(s => s.id === subServiceId)?.name || subServiceId

    const menuItemsMap = new Map(menuItems.map(item => [item.id, item]))

    // 2. Fetch past combined menus to analyze
    // We fetch a few recent menus to look at historical data
    const combinedMenusRef = collection(db, "combinedMenus")
    const q = query(combinedMenusRef, orderBy("createdAt", "desc"), limit(5))
    const menuSnaps = await getDocs(q)
    
    if (menuSnaps.empty) {
      return NextResponse.json({ error: "No historical menus found to analyze." }, { status: 400 })
    }

    // 3. Extract the relevant daily data for this specific service and sub-service
    const historicalData: any = {}
    
    // Process each combined menu document
    menuSnaps.docs.forEach(doc => {
      const data = doc.data()
      // data.menuData is a nested map: date -> serviceId -> subServiceId -> mealPlanId -> subMealPlanId -> { menuItemIds }
      if (!data.menuData) return

      for (const [date, serviceMap] of Object.entries(data.menuData as Record<string, any>)) {
        const d = new Date(date)
        const dayName = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][d.getDay()]
        
        const subServiceMap = serviceMap[serviceId]
        if (!subServiceMap) continue
        
        const mealPlansMap = subServiceMap[subServiceId]
        if (!mealPlansMap) continue

        if (!historicalData[dayName]) historicalData[dayName] = {}

        // For each meal plan and sub meal plan, resolve the items
        for (const [mpId, smpMap] of Object.entries(mealPlansMap as Record<string, any>)) {
          const mpName = mps.find(m => m.id === mpId)?.name || mpId
          
          for (const [smpId, cell] of Object.entries(smpMap as Record<string, any>)) {
            const smpName = smps.find(s => s.id === smpId)?.name || smpId
            const cellKey = `${mpName}|${smpName} (IDs: ${mpId}|${smpId})`
            
            if (!historicalData[dayName][cellKey]) historicalData[dayName][cellKey] = []
            
            // Map item IDs to their names and tags
            const resolvedItems = (cell.menuItemIds || []).map((id: string) => {
              const item = menuItemsMap.get(id)
              return item ? { name: item.name, tags: item.aiTags || {} } : { id }
            })
            
            if (resolvedItems.length > 0) {
              historicalData[dayName][cellKey].push(resolvedItems)
            }
          }
        }
      }
    })

    // 4. Construct prompt for AI
    const systemPrompt = `You are an expert culinary Menu Planner AI.
Your goal is to analyze historical menu data for a specific service and infer the underlying menu planning rules.
Service: ${svcName}
Sub-Service: ${subSvcName}

I will provide you with historical data grouped by Day of the Week and Meal Plan cell.
Analyze this data and infer:
1. "grandRules": 2-4 overarching rules for this service/sub-service. (e.g. "Do not repeat the primary ingredient across any meal in the same day", "Dinner should always be light", "Include at least one vegetarian dish per day").
2. "dayRules": Specific rules for each day.
   - globalDayRule: A rule spanning the whole day (e.g., "Meatless Monday", "Fish on Friday").
   - cellRules: For each Meal Plan/Sub Meal Plan cell, infer the typical constraints (allowedColors, allowedCuisines, allowedIngredients, allowedFlavorProfiles, heavyLight). Return only arrays of strings for the allowed arrays.

You MUST respond in valid JSON format matching this schema:
{
  "grandRules": ["Rule 1", "Rule 2"],
  "dayRules": {
    "monday": {
      "globalDayRule": "String",
      "cellRules": {
        "mpId|smpId": {
          "allowedColors": ["Red", "Green"],
          "allowedCuisines": ["Indian"],
          "allowedIngredients": ["Chicken"],
          "allowedFlavorProfiles": ["Spicy"],
          "heavyLight": "Heavy" // Must be "Heavy", "Light", or "Medium"
        }
      }
    }
  }
}

Use the exact same IDs for the cell keys (mpId|smpId) provided in the data.`

    const userPrompt = `Historical Data:\n${JSON.stringify(historicalData, null, 2)}\n\nInfer the rules and output JSON.`

    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    })

    const rawResponse = completion.choices[0].message.content
    if (!rawResponse) throw new Error("Empty response from AI")

    let inferredRules
    try {
      inferredRules = JSON.parse(rawResponse)
    } catch (e) {
      console.error("JSON Parse Error on AI response", rawResponse)
      throw new Error("AI returned invalid JSON")
    }

    return NextResponse.json({ rules: inferredRules })

  } catch (error: any) {
    console.error("Error inferring rules:", error)
    return NextResponse.json({ error: error.message || "Failed to infer rules" }, { status: 500 })
  }
}
