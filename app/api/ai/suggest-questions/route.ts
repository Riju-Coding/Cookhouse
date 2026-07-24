import { NextResponse } from "next/server"
import OpenAI from "openai"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const { topic } = await req.json()

    if (!topic) {
      return NextResponse.json({ error: "Missing topic" }, { status: 400 })
    }

    const apiKey = process.env.AWS_BEARER_TOKEN_BEDROCK || process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "No API key configured" }, { status: 500 })
    }

    const baseURL = process.env.OPENAI_BASE_URL || "https://bedrock-mantle.ap-south-1.api.aws/v1"
    const model = process.env.BEDROCK_MANTLE_MODEL || "openai.gpt-oss-120b"

    const openai = new OpenAI({ apiKey, baseURL })

    const prompt = `You are a Senior Technical Recruiter hiring for a specific role.
Please generate 10 technical interview questions based on this prompt: "${topic}"

Important context about the stack: 
- "CatterCom" is a mobile app built with React Native and Expo.
- "CookhouseAdmin" is a web portal built with Next.js, React, and Tailwind CSS.
- Both use Firebase Firestore for the database.

Generate the output EXACTLY in this JSON array format (no markdown, no extra text):
[
  {
    "type": "code" | "multiple_choice",
    "prompt": "The question text",
    "options": ["opt1", "opt2", "opt3", "opt4"], // only if multiple_choice
    "idealAnswer": "The ideal answer or correct code snippet"
  }
]
`

    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: "You output only raw JSON." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7
    })

    const content = response.choices[0]?.message?.content?.trim() || "[]"
    
    // Strip possible markdown formatting if the AI ignores instructions
    const jsonStr = content.replace(/^```json/g, "").replace(/```$/g, "").trim()
    const questions = JSON.parse(jsonStr)

    return NextResponse.json({ questions })
  } catch (error: any) {
    console.error("AI Suggestion Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
