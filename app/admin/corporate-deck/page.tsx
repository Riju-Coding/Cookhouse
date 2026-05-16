"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Download, Loader2, ShieldCheck, ClipboardList, Network, Zap, Activity, Layers } from "lucide-react"

type Feature = {
  title: string
  points: string[]
  icon: React.ComponentType<{ className?: string }>
}

async function generateCorporateDeckPdf(features: Feature[], filename: string) {
  // NOTE: We intentionally do NOT use html2canvas because it can't parse Tailwind v4 `oklch(...)` colors.
  const { jsPDF } = await import("jspdf")

  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4", compress: true })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()

  const margin = 14
  const contentW = pageW - margin * 2

  const setHeader = (title: string, subtitle?: string) => {
    pdf.setFillColor(245, 247, 250)
    pdf.rect(0, 0, pageW, 34, "F")
    pdf.setTextColor(15, 23, 42)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(16)
    pdf.text(title, margin, 16)

    if (subtitle) {
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(10)
      pdf.setTextColor(71, 85, 105)
      pdf.text(subtitle, margin, 26)
    }
  }

  const setFooter = (pageNo: number) => {
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(9)
    pdf.setTextColor(100, 116, 139)
    pdf.text(`Page ${pageNo}`, pageW - margin, pageH - 8, { align: "right" })
  }

  const drawBadgeRow = (badges: string[], y: number) => {
    let x = margin
    const h = 7
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(9)
    badges.forEach((b) => {
      const padX = 3
      const w = pdf.getTextWidth(b) + padX * 2
      if (x + w > pageW - margin) return
      pdf.setFillColor(226, 232, 240)
      pdf.roundedRect(x, y, w, h, 2, 2, "F")
      pdf.setTextColor(30, 41, 59)
      pdf.text(b, x + padX, y + 4.8)
      x += w + 3
    })
  }

  const drawMockImage = (kind: "combined" | "structure" | "distribution" | "choices" | "updations" | "compliance", y: number) => {
    const x = margin
    const w = contentW
    const h = 68

    // Outer frame
    pdf.setDrawColor(226, 232, 240)
    pdf.setFillColor(248, 250, 252)
    pdf.roundedRect(x, y, w, h, 3, 3, "FD")

    // Top bar
    pdf.setFillColor(226, 232, 240)
    pdf.roundedRect(x, y, w, 10, 3, 3, "F")
    pdf.setTextColor(30, 41, 59)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(10)
    const title =
      kind === "combined"
        ? "Combined Menu Grid"
        : kind === "structure"
          ? "Meal Plan Structure"
          : kind === "distribution"
            ? "Company / Building Distribution"
            : kind === "choices"
              ? "Choices & Frequency Controls"
              : kind === "updations"
                ? "Updations / Change Log"
                : "Compliance Dashboard"
    pdf.text(title, x + 6, y + 7)

    // Mock content blocks
    const contentY = y + 14
    const contentH = h - 18
    pdf.setFillColor(241, 245, 249)
    pdf.roundedRect(x + 4, contentY, w - 8, contentH, 2, 2, "F")

    if (kind === "combined") {
      // Sidebar + grid
      pdf.setFillColor(226, 232, 240)
      pdf.roundedRect(x + 8, contentY + 4, 26, contentH - 8, 2, 2, "F")
      pdf.setFillColor(255, 255, 255)
      pdf.roundedRect(x + 38, contentY + 4, w - 46, contentH - 8, 2, 2, "F")
      pdf.setDrawColor(226, 232, 240)
      const gx = x + 40
      const gy = contentY + 8
      const gw = w - 50
      const gh = contentH - 16
      const cols = 6
      const rows = 4
      for (let i = 1; i < cols; i++) pdf.line(gx + (gw / cols) * i, gy, gx + (gw / cols) * i, gy + gh)
      for (let j = 1; j < rows; j++) pdf.line(gx, gy + (gh / rows) * j, gx + gw, gy + (gh / rows) * j)
    } else if (kind === "structure") {
      pdf.setFillColor(255, 255, 255)
      pdf.roundedRect(x + 8, contentY + 4, w - 16, contentH - 8, 2, 2, "F")
      pdf.setFillColor(226, 232, 240)
      for (let i = 0; i < 6; i++) {
        pdf.roundedRect(x + 12, contentY + 8 + i * 7.5, w - 24, 5, 2, 2, "F")
      }
    } else if (kind === "distribution") {
      pdf.setFillColor(255, 255, 255)
      pdf.roundedRect(x + 8, contentY + 4, (w - 20) / 2, contentH - 8, 2, 2, "F")
      pdf.roundedRect(x + 12 + (w - 20) / 2, contentY + 4, (w - 20) / 2, contentH - 8, 2, 2, "F")
      pdf.setFillColor(226, 232, 240)
      for (let i = 0; i < 5; i++) {
        pdf.roundedRect(x + 12, contentY + 8 + i * 10, (w - 28) / 2, 6, 2, 2, "F")
        pdf.roundedRect(x + 16 + (w - 20) / 2, contentY + 8 + i * 10, (w - 28) / 2, 6, 2, 2, "F")
      }
    } else if (kind === "choices") {
      pdf.setFillColor(255, 255, 255)
      pdf.roundedRect(x + 8, contentY + 4, w - 16, contentH - 8, 2, 2, "F")
      pdf.setFillColor(226, 232, 240)
      pdf.roundedRect(x + 12, contentY + 8, w - 24, 8, 2, 2, "F")
      for (let i = 0; i < 4; i++) {
        pdf.roundedRect(x + 12, contentY + 20 + i * 10, (w - 28) * 0.65, 6, 2, 2, "F")
        pdf.roundedRect(x + 16 + (w - 28) * 0.65, contentY + 20 + i * 10, (w - 28) * 0.35, 6, 2, 2, "F")
      }
    } else if (kind === "updations") {
      pdf.setFillColor(255, 255, 255)
      pdf.roundedRect(x + 8, contentY + 4, w - 16, contentH - 8, 2, 2, "F")
      pdf.setFillColor(226, 232, 240)
      for (let i = 0; i < 6; i++) {
        pdf.roundedRect(x + 12, contentY + 8 + i * 7.5, w - 24, 5, 2, 2, "F")
      }
      pdf.setFillColor(148, 163, 184)
      pdf.roundedRect(x + w - 28, contentY + 8, 12, 5, 2, 2, "F")
    } else {
      // compliance
      pdf.setFillColor(255, 255, 255)
      pdf.roundedRect(x + 8, contentY + 4, w - 16, contentH - 8, 2, 2, "F")
      pdf.setFillColor(226, 232, 240)
      pdf.roundedRect(x + 12, contentY + 8, w - 24, 10, 2, 2, "F")
      for (let i = 0; i < 4; i++) {
        pdf.roundedRect(x + 12, contentY + 22 + i * 10, w - 24, 6, 2, 2, "F")
      }
    }

    return y + h + 10
  }

  const drawBullets = (bullets: string[], startY: number, headerTitle: string) => {
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(11)
    pdf.setTextColor(30, 41, 59)

    let y = startY
    for (const b of bullets) {
      const lines = pdf.splitTextToSize(b, contentW - 10)
      const needed = lines.length * 5.4 + 4

      if (y + needed > pageH - margin - 8) {
        pdf.addPage()
        setHeader(headerTitle, "Continued")
        y = 48
      }

      pdf.setFillColor(15, 23, 42)
      pdf.circle(margin + 1.5, y - 1.6, 0.7, "F")
      pdf.text(lines, margin + 6, y, { maxWidth: contentW - 6 })
      y += needed
    }
  }

  let pageNo = 1

  // Cover page
  setHeader("Cookhouse Admin — Corporate Deck", "Menu building · Distribution · Choices · Updations · Compliance")
  pdf.setTextColor(15, 23, 42)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(22)
  pdf.text(pdf.splitTextToSize("End-to-end corporate menu operations platform", contentW), margin, 54)

  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(12)
  pdf.setTextColor(51, 65, 85)
  const intro =
    "Build menus structure-wise, distribute across companies/buildings, manage choices and repeat-control, track every item change via updations, and maintain compliance readiness through forms and templates."
  pdf.text(pdf.splitTextToSize(intro, contentW), margin, 66, { maxWidth: contentW })

  drawBadgeRow(["Menu Building", "Distribution", "Choices", "Updations", "Compliance"], 92)

  pdf.setDrawColor(226, 232, 240)
  pdf.line(margin, 108, pageW - margin, 108)

  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(12)
  pdf.setTextColor(15, 23, 42)
  pdf.text("Core workflow", margin, 120)
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(11)
  pdf.setTextColor(30, 41, 59)
  const flow = [
    "Define structure (meal/sub-meal plan)",
    "Build combined menu grid",
    "Distribute company/building menus",
    "Manage choices & repeat-control",
    "Track changes via updations",
    "Run compliances + store evidence",
  ]
  let yFlow = 130
  flow.forEach((step, idx) => {
    pdf.text(`${idx + 1}. ${step}`, margin, yFlow)
    yFlow += 7
  })
  setFooter(pageNo)

  // One page per feature (multi-page deck)
  for (const f of features) {
    pdf.addPage()
    pageNo += 1
    setHeader(f.title, "Key capability")

    // Mock image at top to make the deck more visual
    const kind: "combined" | "structure" | "distribution" | "choices" | "updations" | "compliance" =
      f.title.toLowerCase().includes("combined")
        ? "combined"
        : f.title.toLowerCase().includes("structure")
          ? "structure"
          : f.title.toLowerCase().includes("distribution")
            ? "distribution"
            : f.title.toLowerCase().includes("choice")
              ? "choices"
              : f.title.toLowerCase().includes("update")
                ? "updations"
                : "compliance"

    const afterImgY = drawMockImage(kind, 42)

    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(12)
    pdf.setTextColor(15, 23, 42)
    pdf.text("Highlights", margin, afterImgY)

    pdf.setDrawColor(226, 232, 240)
    pdf.line(margin, afterImgY + 3, pageW - margin, afterImgY + 3)

    drawBullets(f.points, afterImgY + 14, f.title)
    setFooter(pageNo)
  }

  pdf.save(filename)
}

export default function CorporateDeckPage() {
  const [downloading, setDownloading] = useState(false)

  const features: Feature[] = useMemo(
    () => [
      {
        title: "Combined Menu Creation (Structure-wise)",
        icon: Layers,
        points: [
          "Create menus by date range using Service → Sub-service hierarchy.",
          "Meal Plan → Sub Meal Plan grid ensures consistent structure across days.",
          "Cell-wise item assignment supports operational menu building at scale.",
        ],
      },
      {
        title: "Meal Plan & Sub Meal Plan Structure",
        icon: Network,
        points: [
          "Central structure definition drives what appears in the menu grid.",
          "Defaults (if configured) reduce manual work and enforce standardization.",
          "Structure mapping ensures every team builds menus the same way.",
        ],
      },
      {
        title: "Company-wise & Building-wise Distribution",
        icon: Activity,
        points: [
          "Distribute and manage menus per company and per building.",
          "Clear mapping of who receives what, reducing confusion at execution time.",
          "Supports operations across multiple sites with consistent controls.",
        ],
      },
      {
        title: "Choices & Frequency (Operational Controls)",
        icon: Zap,
        points: [
          "Choice-based flows to handle corporate variants and controlled alternatives.",
          "Frequency/duplication control helps prevent repetitive items across days.",
          "Operationally focused guardrails to keep menus compliant and balanced.",
        ],
      },
      {
        title: "Update Logs & Updations (Every Change Tracked)",
        icon: ClipboardList,
        points: [
          "Audit-friendly history of changes across menus, cells, and items.",
          "Updations provide a clear timeline of what changed and when.",
          "Supports accountability: changes are visible, reviewable, and attributable.",
        ],
      },
      {
        title: "Compliances",
        icon: ShieldCheck,
        points: [
          "Compliance programs managed in one place: list → details → assigned flows.",
          "Templates/forms support structured checks and documented evidence.",
          "Helps enforce and demonstrate compliance readiness for corporates.",
        ],
      },
    ],
    [],
  )

  const handleDownloadPdf = useCallback(async () => {
    setDownloading(true)
    try {
      await generateCorporateDeckPdf(features, "cookhouse-corporate-deck.pdf")
    } finally {
      setDownloading(false)
    }
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1200px] px-4 py-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Cookhouse Admin — Corporate Deck</h1>
            <p className="text-sm text-muted-foreground">
              One-page overview of core capabilities (custom UI) with PDF export.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="secondary">Menu Building</Badge>
              <Badge variant="secondary">Distribution</Badge>
              <Badge variant="secondary">Choices</Badge>
              <Badge variant="secondary">Updations</Badge>
              <Badge variant="secondary">Compliance</Badge>
            </div>
          </div>

          <Button onClick={handleDownloadPdf} disabled={downloading} className="gap-2">
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download PDF
          </Button>
        </div>

        <div className="rounded-xl border bg-white p-6 text-slate-900 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Product Summary</div>
              <div className="mt-1 text-xl font-semibold">End-to-end corporate menu operations platform</div>
              <div className="mt-2 max-w-[820px] text-sm text-slate-600">
                Build menus structure-wise, distribute across companies/buildings, manage choices and repeat-control,
                track every item change via updations, and maintain compliance readiness through forms and templates.
              </div>
            </div>
            <div className="hidden sm:block rounded-lg border bg-slate-50 px-4 py-3">
              <div className="text-xs font-medium text-slate-500">Output</div>
              <div className="mt-1 text-sm font-semibold">PDF-ready deck</div>
              <div className="mt-1 text-xs text-slate-600">A4 export with “Download PDF”</div>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {features.map((f) => {
              const Icon = f.icon
              return (
                <Card key={f.title} className="border-slate-200 shadow-none">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-slate-50">
                        <Icon className="h-4 w-4 text-slate-700" />
                      </span>
                      {f.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="mb-3 rounded-md border bg-slate-50 p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-slate-700">Mock screen</div>
                        <div className="flex gap-1">
                          <span className="h-2 w-2 rounded-full bg-slate-300" />
                          <span className="h-2 w-2 rounded-full bg-slate-300" />
                          <span className="h-2 w-2 rounded-full bg-slate-300" />
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-12 gap-2">
                        <div className="col-span-4 space-y-2">
                          <div className="h-3 w-full rounded bg-slate-200" />
                          <div className="h-3 w-10/12 rounded bg-slate-200" />
                          <div className="h-3 w-9/12 rounded bg-slate-200" />
                          <div className="h-3 w-11/12 rounded bg-slate-200" />
                        </div>
                        <div className="col-span-8 rounded bg-white p-2">
                          <div className="grid grid-cols-6 gap-1">
                            {Array.from({ length: 24 }).map((_, i) => (
                              <div key={i} className="h-5 rounded bg-slate-100" />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
                      {f.points.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <Separator className="my-6" />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card className="border-slate-200 shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">What corporates get</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-700">
                <ul className="list-disc space-y-1 pl-5">
                  <li>Standardized menu structure across sites</li>
                  <li>Operational control for choices/repeats</li>
                  <li>Full audit trail (updations)</li>
                  <li>Compliance evidence via forms/templates</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Core workflow</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-700">
                <ol className="list-decimal space-y-1 pl-5">
                  <li>Define structure (meal/sub-meal plan)</li>
                  <li>Build combined menu grid</li>
                  <li>Distribute company/building menus</li>
                  <li>Manage choices & repeat-control</li>
                  <li>Track changes via updations</li>
                  <li>Run compliances + store evidence</li>
                </ol>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Demo talking points</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-700">
                <ul className="list-disc space-y-1 pl-5">
                  <li>Structure-driven scale</li>
                  <li>Site-level distribution control</li>
                  <li>Transparent change history</li>
                  <li>Compliance readiness</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 text-xs text-slate-500">
            Note: This page is designed as a corporate-ready PDF deck. Use the “Download PDF” button at the top-right.
          </div>
        </div>
      </div>
    </div>
  )
}
