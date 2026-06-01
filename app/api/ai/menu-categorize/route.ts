import OpenAI from "openai"
import { doc, updateDoc, serverTimestamp, writeBatch } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { menuItemsService } from "@/lib/services"

export const runtime = "nodejs"

interface AiTagResult {
  menuItemId: string
  name: string
  tags: {
    color: string
    cuisine: string
    primaryIngredient: string
    flavorProfile: string
    submealCategory: string
    heavyLight: "Heavy" | "Light" | "Medium"
  }
}

function getEnv(name: string): string | undefined {
  const v = process.env[name]
  if (!v) return undefined
  const t = v.trim()
  return t.length ? t : undefined
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const SYSTEM_PROMPT = `You are a culinary classification expert for an Indian corporate catering system.
Given a list of recipe/dish names, classify each one across these 6 dimensions:

1. **color**: The dominant visual color of the finished dish (e.g., Yellow, Brown, Green, White, Red, Orange, Golden, Cream, Multi-color)
2. **cuisine**: The cuisine style (e.g., North Indian, South Indian, Chinese, Continental, Mughlai, Bengali, Punjabi, Gujarati, Indo-Chinese, Italian, Thai, Mexican, Pan-Asian, Multi-cuisine)
3. **primaryIngredient**: The main ingredient (e.g., Paneer, Chicken, Mutton, Fish, Egg, Rice, Dal, Potato, Chana, Mixed Vegetables, Wheat Flour, Milk, Curd, Besan, Moong, Soya)
4. **flavorProfile**: The dominant taste (e.g., Spicy, Mild, Sweet, Tangy, Savory, Bitter, Umami, Sweet-Spicy, Tangy-Spicy, Rich, Creamy)
5. **submealCategory**: The meal category (e.g., Main Course, Starter, Dessert, Beverage, Snack, Bread/Roti, Rice, Salad, Soup, Accompaniment, Chutney/Pickle, Grams/Balls, Raita, Papad, Dal, Dry Sabzi, Gravy Sabzi, Breakfast, Street Food)
6. **heavyLight**: Whether the dish is Heavy, Light, or Medium in terms of portion/caloric density

IMPORTANT: 
- "Grams/Balls" category is for small ball/grain-shaped items like peas curry, chana masala, matra, rajma, lobiya, chole, kala chana, moong, etc.
- Be specific. Don't default to generic values.
- Use your knowledge of Indian and international cuisine to classify accurately.

Return ONLY valid JSON array. No markdown. No extra text.
Output format: [{"name":"<dish name>","color":"...","cuisine":"...","primaryIngredient":"...","flavorProfile":"...","submealCategory":"...","heavyLight":"..."},...]`

async function classifyBatch(
  client: OpenAI,
  model: string,
  items: { id: string; name: string }[]
): Promise<AiTagResult[]> {
  const names = items.map((i) => i.name)

  const resp = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Classify these ${names.length} dishes:\n${JSON.stringify(names)}`,
      },
    ],
    temperature: 0.2,
  })

  const text = resp.choices?.[0]?.message?.content ?? ""
  // Try to extract JSON array from response
  let parsed: any[]
  try {
    parsed = JSON.parse(text)
  } catch {
    // Try to find JSON array in the text
    const match = text.match(/\[[\s\S]*\]/)
    if (match) {
      parsed = JSON.parse(match[0])
    } else {
      throw new Error(`Failed to parse AI response: ${text.substring(0, 200)}`)
    }
  }

  if (!Array.isArray(parsed)) {
    throw new Error("AI response is not an array")
  }

  // Map results back to item IDs by matching names
  const results: AiTagResult[] = []
  for (const item of items) {
    const match = parsed.find(
      (p: any) =>
        p.name?.toLowerCase().trim() === item.name.toLowerCase().trim()
    )
    if (match) {
      results.push({
        menuItemId: item.id,
        name: item.name,
        tags: {
          color: match.color || "Unknown",
          cuisine: match.cuisine || "Unknown",
          primaryIngredient: match.primaryIngredient || "Unknown",
          flavorProfile: match.flavorProfile || "Unknown",
          submealCategory: match.submealCategory || "Unknown",
          heavyLight: match.heavyLight || "Medium",
        },
      })
    } else {
      // If AI didn't return this item, find by index position as fallback
      const idx = items.indexOf(item)
      const fallback = parsed[idx]
      results.push({
        menuItemId: item.id,
        name: item.name,
        tags: {
          color: fallback?.color || "Unknown",
          cuisine: fallback?.cuisine || "Unknown",
          primaryIngredient: fallback?.primaryIngredient || "Unknown",
          flavorProfile: fallback?.flavorProfile || "Unknown",
          submealCategory: fallback?.submealCategory || "Unknown",
          heavyLight: fallback?.heavyLight || "Medium",
        },
      })
    }
  }

  return results
}

async function saveTags(results: AiTagResult[]): Promise<number> {
  const chunks = chunk(results, 400) // Firestore batch limit is 500
  let saved = 0

  for (const batch_items of chunks) {
    const batch = writeBatch(db)
    for (const result of batch_items) {
      const docRef = doc(db, "menuItems", result.menuItemId)
      batch.update(docRef, {
        aiTags: {
          ...result.tags,
          updatedAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      })
    }
    await batch.commit()
    saved += batch_items.length
  }

  return saved
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)

  const apiKey =
    getEnv("AWS_BEARER_TOKEN_BEDROCK") ?? getEnv("OPENAI_API_KEY")
  const baseURL =
    getEnv("OPENAI_BASE_URL") ?? "https://bedrock-mantle.us-east-1.api.aws/v1"
  const model = getEnv("BEDROCK_MANTLE_MODEL") ?? "openai.gpt-oss-120b"

  if (!apiKey) {
    return Response.json(
      { ok: false, error: "Missing AI API key configuration." },
      { status: 400 }
    )
  }

  const items: { id: string; name: string }[] | undefined = body?.items

  if (!items || !Array.isArray(items) || items.length === 0) {
    return Response.json({
      ok: true,
      message: "No items to categorize.",
      processed: 0,
      total: 0,
    })
  }

  try {
    const client = new OpenAI({ apiKey, baseURL })
    // We still chunk just in case the client sends a massive list
    const batches = chunk(items, 40)
    const allResults: AiTagResult[] = []

    for (const batch of batches) {
      try {
        const results = await classifyBatch(client, model, batch)
        allResults.push(...results)
      } catch (batchError: any) {
        console.error(
          `Batch classification failed for ${batch.length} items:`,
          batchError?.message
        )
        // Continue with next batch — partial success is better than total failure
      }
    }

    // Save to Firestore
    const savedCount = await saveTags(allResults)

    return Response.json({
      ok: true,
      message: `Categorized ${savedCount} of ${items.length} items.`,
      processed: savedCount,
      total: items.length,
      results: allResults,
    })
  } catch (err: any) {
    console.error("AI Categorize error:", err)
    return Response.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 500 }
    )
  }
}
