import OpenAI from "openai"

export const runtime = "nodejs"

function getEnv(name: string): string | undefined {
  const v = process.env[name]
  if (!v) return undefined
  const trimmed = v.trim()
  return trimmed.length ? trimmed : undefined
}

export async function GET() {
  const apiKey = getEnv("AWS_BEARER_TOKEN_BEDROCK") ?? getEnv("OPENAI_API_KEY")
  const baseURL = getEnv("OPENAI_BASE_URL") ?? "https://bedrock-mantle.ap-south-1.api.aws/v1"
  const model = getEnv("BEDROCK_MANTLE_MODEL") ?? "openai.gpt-oss-120b"

  if (!apiKey) {
    return Response.json(
      {
        ok: false,
        error: "Missing AWS_BEARER_TOKEN_BEDROCK (or OPENAI_API_KEY).",
        required: ["AWS_BEARER_TOKEN_BEDROCK", "OPENAI_BASE_URL (optional)", "BEDROCK_MANTLE_MODEL (optional)"],
      },
      { status: 400 },
    )
  }

  const client = new OpenAI({ apiKey, baseURL })

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: "Say OK" }],
    })

    return Response.json({
      ok: true,
      model,
      baseURL,
      output_text: response.choices?.[0]?.message?.content ?? "",
    })
  } catch (err: any) {
    return Response.json(
      {
        ok: false,
        model,
        baseURL,
        error: err?.message ?? String(err),
        name: err?.name,
        status: err?.status,
      },
      { status: 500 },
    )
  }
}
