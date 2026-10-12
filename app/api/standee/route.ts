import { NextRequest, NextResponse } from "next/server"
import { spawn } from "child_process"
import path from "path"
import fs from "fs"
import os from "os"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  return handleStandeeRequest(req)
}

export async function POST(req: NextRequest) {
  return handleStandeeRequest(req)
}

async function handleStandeeRequest(req: NextRequest) {
  try {
    let url = ""
    let company = "Company"
    let building = "Building"
    let cafe = "Cafeteria"
    let style = "criss_cross"
    let format = "pdf"

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}))
      url = body.url || ""
      company = body.company || "Company"
      building = body.building || "Building"
      cafe = body.cafe || "Cafeteria"
      style = body.style || "criss_cross"
      format = body.format || "pdf"
    } else {
      const sp = req.nextUrl.searchParams
      url = sp.get("url") || ""
      company = sp.get("company") || "Company"
      building = sp.get("building") || "Building"
      cafe = sp.get("cafe") || "Cafeteria"
      style = sp.get("style") || "criss_cross"
      format = sp.get("format") || "pdf"
    }

    if (!url) {
      return NextResponse.json({ error: "Missing required parameter: url" }, { status: 400 })
    }

    const safeCompany = company.replace(/[^a-zA-Z0-9_-]/g, "_")
    const safeBuilding = building.replace(/[^a-zA-Z0-9_-]/g, "_")
    const safeCafe = cafe.replace(/[^a-zA-Z0-9_-]/g, "_")
    const filename = `Cookhouse_Standee_6x2.5ft_${safeCompany}_${safeBuilding}_${safeCafe}_${style}.${format}`

    // Call python script to generate 100% Vector Standee PDF
    const scriptPath = path.join(process.cwd(), "scripts", "generate_standee_pdf.py")
    const logoPath = path.join(process.cwd(), "public", "cookhouse_logo.svg")
    const tempOutputDir = os.tmpdir()
    const tempOutputFile = path.join(tempOutputDir, `standee_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${format}`)

    const pyArgs = [
      scriptPath,
      "--url", url,
      "--company", company,
      "--building", building,
      "--cafe", cafe,
      "--style", style,
      "--logo", logoPath,
      "--output", tempOutputFile,
    ]

    await new Promise<void>((resolve, reject) => {
      const proc = spawn("python", pyArgs)
      let stderr = ""
      proc.stderr.on("data", (d) => {
        stderr += d.toString()
      })
      proc.on("close", (code) => {
        if (code === 0 && fs.existsSync(tempOutputFile)) {
          resolve()
        } else {
          reject(new Error(`Python process exited with code ${code}. Error: ${stderr}`))
        }
      })
      proc.on("error", (err) => {
        reject(err)
      })
    })

    const fileBuffer = fs.readFileSync(tempOutputFile)

    // Cleanup temp file
    try {
      fs.unlinkSync(tempOutputFile)
    } catch {}

    const contentType = format === "svg" ? "image/svg+xml" : "application/pdf"

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err: any) {
    console.error("Standee generation error:", err)
    return NextResponse.json(
      {
        error: "Failed to generate standee PDF",
        details: err?.message || String(err),
      },
      { status: 500 }
    )
  }
}
