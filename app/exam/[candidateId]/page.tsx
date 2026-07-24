"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { techCandidatesService, techRoundsService } from "@/lib/services"
import { TechCandidate, TechRound } from "@/lib/types"
import { Loader2 } from "lucide-react"

export default function ExamInterface() {
  const params = useParams()
  const router = useRouter()
  const candidateId = params.candidateId as string

  const [candidate, setCandidate] = useState<TechCandidate | null>(null)
  const [round, setRound] = useState<TechRound | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    async function load() {
      try {
        const c = await techCandidatesService.getById(candidateId)
        if (!c) {
          setError("Candidate not found")
          return
        }
        if (c.status === "completed") {
          setError("You have already completed this exam.")
          return
        }

        const r = await techRoundsService.getById(c.techRoundId)
        if (!r) {
          setError("Tech round not found")
          return
        }

        setCandidate(c)
        setRound(r)
        
        // Mark as in-progress if it was pending
        if (c.status === "pending") {
          await techCandidatesService.update(c.id!, { status: "in_progress" })
        }
      } catch (e) {
        console.error(e)
        setError("Failed to load exam")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [candidateId])

  const handleSubmit = async () => {
    if (!candidate || !round) return
    
    // Check if all questions are answered
    const unanswered = round.questions.find(q => !answers[q.id])
    if (unanswered) {
      if (!confirm("You have unanswered questions. Are you sure you want to submit?")) {
        return
      }
    }

    setSubmitting(true)
    try {
      // 1. Save answers immediately and mark completed
      await techCandidatesService.update(candidate.id!, {
        answers,
        status: "completed",
        completedAt: new Date().toISOString()
      })

      // 2. Trigger background AI grading
      // We don't await this so the UI updates quickly for the candidate
      fetch("/api/ai/grade-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: candidate.id, answers, roundId: round.id })
      }).catch(console.error)

      alert("Exam submitted successfully! Thank you.")
      router.push("/exam")
    } catch (e) {
      console.error(e)
      alert("Failed to submit exam. Please try again.")
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin w-8 h-8" /></div>
  }

  if (error || !candidate || !round) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader><CardTitle className="text-red-500">Notice</CardTitle></CardHeader>
          <CardContent>{error}</CardContent>
          <CardContent><Button onClick={() => router.push("/exam")}>Go Back</Button></CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{round.title}</CardTitle>
            <CardDescription>Candidate: {candidate.email}</CardDescription>
          </CardHeader>
        </Card>

        {round.questions.map((q, index) => (
          <Card key={q.id}>
            <CardHeader>
              <CardTitle className="text-lg">Question {index + 1}</CardTitle>
              <p className="text-sm font-medium whitespace-pre-wrap">{q.prompt}</p>
            </CardHeader>
            <CardContent>
              {q.type === "multiple_choice" && q.options && (
                <RadioGroup 
                  value={answers[q.id] || ""} 
                  onValueChange={(v) => setAnswers(prev => ({ ...prev, [q.id]: v }))}
                >
                  <div className="space-y-3 mt-2">
                    {q.options.map((opt, i) => (
                      <div key={i} className="flex items-center space-x-2 border p-3 rounded-md hover:bg-slate-50 cursor-pointer" onClick={() => setAnswers(prev => ({ ...prev, [q.id]: opt }))}>
                        <RadioGroupItem value={opt} id={`${q.id}-${i}`} />
                        <Label htmlFor={`${q.id}-${i}`} className="cursor-pointer">{opt}</Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              )}

              {q.type === "code" && (
                <div className="mt-2">
                  <Textarea 
                    className="font-mono min-h-[200px]" 
                    placeholder="Write your code or answer here..."
                    value={answers[q.id] || ""}
                    onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        <div className="flex justify-end pt-4 pb-12">
          <Button size="lg" onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Exam
          </Button>
        </div>
      </div>
    </div>
  )
}
