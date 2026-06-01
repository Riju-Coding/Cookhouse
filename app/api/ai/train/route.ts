import { NextResponse } from "next/server"
import OpenAI from "openai"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"

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
    const { serviceId, subServiceId, trainingData } = body

    if (!serviceId || !subServiceId || !trainingData) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const apiKey = getEnv("AWS_BEARER_TOKEN_BEDROCK") ?? getEnv("OPENAI_API_KEY")
    const baseURL = getEnv("OPENAI_BASE_URL") ?? "https://bedrock-mantle.ap-south-1.api.aws/v1"
    const model = getEnv("BEDROCK_MANTLE_MODEL") ?? "openai.gpt-oss-120b"

    if (!apiKey) {
      return NextResponse.json({ error: "No API key configured" }, { status: 500 })
    }

    const openai = new OpenAI({ apiKey, baseURL })

    // Truncate training data if it's too large to prevent hitting token limits
    // Convert to string and slice if necessary
    let dataString = JSON.stringify(trainingData)
    const MAX_CHARS = 150000 // Roughly 30-40k tokens
    if (dataString.length > MAX_CHARS) {
      console.warn("Training data too large, truncating...")
      dataString = dataString.slice(0, MAX_CHARS) + "\n...[TRUNCATED DUE TO SIZE]"
    }

    const systemPrompt = `You are an expert culinary AI Menu Planner.
You are in "Training Mode". The user has uploaded historical menu data (parsed from Excel files) for a specific Service and Sub-Service.
Your job is to analyze this raw data and extract a "Training Profile" - a comprehensive summary of the patterns, flavor combinations, repetition rules, and structural preferences present in these menus.

Extract insights such as:
- Which ingredients are commonly paired together?
- What is the distribution of heavy vs light meals?
- What cuisines are most popular?
- How often are primary ingredients repeated?
- Are there any implicit rules (e.g., Friday is always seafood, breakfast is always light)?

Output ONLY a detailed text summary (the "Training Profile") that can be injected into your system prompt for future menu generation tasks. Format it clearly using markdown bullet points and headings.`

    const userPrompt = `Historical Data:\n\n${dataString}`

    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3,
    })

    const profileText = completion.choices[0].message.content
    if (!profileText) throw new Error("Empty response from AI")

    // Save to Firestore
    const docId = `${serviceId}_${subServiceId}`
    const docRef = doc(db, "aiTrainingProfiles", docId)
    
    await setDoc(docRef, {
      serviceId,
      subServiceId,
      profileText,
      updatedAt: serverTimestamp()
    })

    return NextResponse.json({ success: true, profileText })

  } catch (error: any) {
    console.error("Error in AI training:", error)
    return NextResponse.json({ error: error.message || "Failed to train AI" }, { status: 500 })
  }
}
