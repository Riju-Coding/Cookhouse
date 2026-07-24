"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TechCandidate, TechRound } from "@/lib/types"
import { techRoundsService } from "@/lib/services"
import { Badge } from "@/components/ui/badge"

export function ReviewSubmissionModal({ open, onOpenChange, candidate }: { open: boolean, onOpenChange: (v: boolean) => void, candidate: TechCandidate }) {
  const [round, setRound] = useState<TechRound | null>(null)

  useEffect(() => {
    if (open && candidate.techRoundId) {
      techRoundsService.getById(candidate.techRoundId).then(r => setRound(r))
    }
  }, [open, candidate])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Submission: {candidate.email}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
            <div>
              <h3 className="font-semibold text-lg">{candidate.techRoundTitle}</h3>
              <p className="text-sm text-muted-foreground">Submitted: {new Date(candidate.completedAt).toLocaleString()}</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">AI Score</div>
              <div className="text-3xl font-bold">{candidate.score} / {round ? round.questions.length * 10 : "?"}</div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">AI Overall Feedback</h4>
            <div className="p-4 bg-green-50 text-green-900 rounded-md whitespace-pre-wrap">
              {candidate.feedback || "No feedback generated."}
            </div>
          </div>

          <div className="space-y-6 mt-6">
            <h4 className="font-semibold border-b pb-2">Questions & Answers</h4>
            {round?.questions.map((q, i) => (
              <div key={q.id} className="space-y-2">
                <div className="font-medium">
                  {i + 1}. {q.prompt}
                  <Badge variant="outline" className="ml-2">{q.type}</Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground font-semibold uppercase">Candidate's Answer</div>
                    <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap font-mono">
                      {candidate.answers?.[q.id] || "No answer provided"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground font-semibold uppercase">Ideal Answer</div>
                    <div className="p-3 bg-slate-100 text-slate-700 rounded-md text-sm whitespace-pre-wrap font-mono">
                      {q.idealAnswer}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
