"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react"
import Link from "next/link"

type Slide = {
  id: string
  title: string
  bullets: string[]
  path: string
}

export default function PresentationPage() {
  const slides: Slide[] = useMemo(
    () => [
      {
        id: "combined-menu-structure",
        title: "Combined Menu Creation (Structure-wise)",
        bullets: ["Service → Sub-service", "Meal plan → Sub-meal plan grid", "Cell-wise menu items"],
        path: "/admin/combined-menu",
      },
      {
        id: "meal-plan-structure",
        title: "Meal Plan & Sub Meal Plan Structure",
        bullets: ["Structure definition", "Default items (if configured)", "Structure-driven cells"],
        path: "/admin/meal-plan-structure",
      },
      {
        id: "company-building-distribution",
        title: "Company-wise & Building-wise Distribution",
        bullets: ["Company menus", "Building mapping", "Operational distribution flow"],
        path: "/admin/company-menus",
      },
      {
        id: "choices-frequency",
        title: "Choices & Frequency (Operational View)",
        bullets: ["Choice selections flow", "Repeat/duplication prevention cues", "Operational consistency"],
        path: "/admin/combined-menu-management",
      },
      {
        id: "update-logs",
        title: "Update Logs & Item-level Updations",
        bullets: ["Every change tracked", "Cell-level logs", "Audit-friendly history"],
        path: "/admin/updations",
      },
      {
        id: "compliances",
        title: "Compliances",
        bullets: ["Compliance list", "Compliance details", "Templates / forms"],
        path: "/admin/compliances",
      },
    ],
    [],
  )

  const [activeSlideId, setActiveSlideId] = useState(slides[0]?.id ?? "combined-menu-structure")
  const activeSlide = slides.find((s) => s.id === activeSlideId) ?? slides[0]
  const activeIndex = Math.max(0, slides.findIndex((s) => s.id === activeSlideId))
  const canPrev = activeIndex > 0
  const canNext = activeIndex < slides.length - 1
  const goPrev = () => canPrev && setActiveSlideId(slides[activeIndex - 1].id)
  const goNext = () => canNext && setActiveSlideId(slides[activeIndex + 1].id)

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto grid max-w-[1400px] grid-cols-12 gap-4">
        <Card className="col-span-12 lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Corporate Deck</CardTitle>
            <div className="text-xs text-muted-foreground">
              Left: slides · Right: exact UI (embedded)
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              {slides.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSlideId(s.id)}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-left text-sm transition",
                    s.id === activeSlideId ? "border-primary bg-primary/5" : "hover:bg-muted/40",
                  )}
                >
                  <div className="font-medium">{s.title}</div>
                  <div className="text-xs text-muted-foreground">{s.path}</div>
                </button>
              ))}
            </div>

            <div className="rounded-md border p-3">
              <div className="mb-2 text-sm font-medium">Controls</div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={goPrev} disabled={!canPrev} variant="outline" className="gap-2">
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>
                <Button onClick={goNext} disabled={!canNext} className="gap-2">
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Slide {activeIndex + 1} / {slides.length}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-12 lg:col-span-9">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">{activeSlide?.title}</CardTitle>
                <div className="text-xs text-muted-foreground">{activeSlide?.bullets?.join(" · ")}</div>
              </div>
              <Button asChild variant="outline" className="gap-2">
                <Link href={activeSlide?.path || "/admin"} target="_blank">
                  <ExternalLink className="h-4 w-4" />
                  Open
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="aspect-video w-full overflow-hidden rounded-lg border bg-muted/10">
              <iframe key={activeSlide?.id} title="Cookhouse Demo" src={activeSlide?.path} className="h-full w-full" />
            </div>
            <div className="mt-3 rounded-md border bg-background p-3">
              <div className="mb-1 text-sm font-medium">Talking Points</div>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {activeSlide?.bullets?.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
