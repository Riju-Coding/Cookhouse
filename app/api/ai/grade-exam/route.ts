import { NextResponse } from "next/server"
import OpenAI from "openai"
import { techCandidatesService, techRoundsService } from "@/lib/services"

export const runtime = "nodejs"
export const maxDuration = 300 // allow up to 5 minutes

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { candidateId, roundId, answers } = body

    if (!candidateId || !roundId || !answers) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const [candidate, round] = await Promise.all([
      techCandidatesService.getById(candidateId),
      techRoundsService.getById(roundId)
    ])

    if (!candidate || !round) {
      return NextResponse.json({ error: "Candidate or Round not found" }, { status: 404 })
    }

    const apiKey = process.env.AWS_BEARER_TOKEN_BEDROCK || process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.warn("No OPENAI_API_KEY found, skipping grading")
      return NextResponse.json({ success: true, warning: "No API key" })
    }

    const baseURL = process.env.OPENAI_BASE_URL || "https://bedrock-mantle.ap-south-1.api.aws/v1"
    const model = process.env.BEDROCK_MANTLE_MODEL || "openai.gpt-oss-120b"

    const openai = new OpenAI({ apiKey, baseURL })

    // Build the prompt for the AI
    let prompt = `You are a strict, senior technical recruiter.
Please evaluate the following candidate's answers against the provided ideal answers.
Provide two things:
1. A total score out of ${round.questions.length * 10} (each question is worth 10 points).
2. A detailed paragraph of feedback discussing their strong and weak points.

Do NOT output Markdown. Just output plain text with the score clearly stated.

### Exam: ${round.title}
`

    round.questions.forEach((q, i) => {
      prompt += `\n--- Question ${i + 1} (${q.type}) ---\n`
      prompt += `Prompt: ${q.prompt}\n`
      if (q.type === "multiple_choice" && q.options) {
        prompt += `Options: ${q.options.join(" | ")}\n`
      }
      prompt += `Ideal Answer: ${q.idealAnswer}\n`
      prompt += `Candidate's Answer: ${answers[q.id] || "NO ANSWER"}\n`
    })

    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: "You are a technical grading assistant." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2
    })

    const feedback = response.choices[0]?.message?.content?.trim() || "No feedback generated."
    
    // Attempt to extract the numeric score using regex
    // Looks for patterns like "90 / 100", "Score: 90", "90/100"
    let parsedScore = 0
    const scoreMatch = feedback.match(/(\d+)\s*\/\s*\d+/)
    if (scoreMatch && scoreMatch[1]) {
      parsedScore = parseInt(scoreMatch[1], 10)
    }

    await techCandidatesService.update(candidateId, {
      score: parsedScore,
      feedback: feedback
    })

    return NextResponse.json({ success: true, score: parsedScore })
  } catch (error: any) {
    console.error("AI Grading Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
