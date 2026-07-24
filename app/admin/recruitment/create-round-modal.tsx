"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { techRoundsService } from "@/lib/services"
import { TechQuestion } from "@/lib/types"
import { Plus, Trash } from "lucide-react"

export function CreateRoundModal({ open, onOpenChange, onSaved }: { open: boolean, onOpenChange: (v: boolean) => void, onSaved: () => void }) {
  const [title, setTitle] = useState("")
  const [questions, setQuestions] = useState<TechQuestion[]>([])
  const [loading, setLoading] = useState(false)
  const [aiTopic, setAiTopic] = useState("")
  const [generating, setGenerating] = useState(false)

  const addQuestion = (type: "code" | "multiple_choice") => {
    setQuestions([
      ...questions,
      {
        id: crypto.randomUUID(),
        type,
        prompt: "",
        idealAnswer: "",
        options: type === "multiple_choice" ? ["", ""] : undefined
      }
    ])
  }

  const updateQuestion = (index: number, updates: Partial<TechQuestion>) => {
    const newQs = [...questions]
    newQs[index] = { ...newQs[index], ...updates }
    setQuestions(newQs)
  }

  const updateOption = (qIndex: number, optIndex: number, val: string) => {
    const newQs = [...questions]
    if (newQs[qIndex].options) {
      newQs[qIndex].options![optIndex] = val
    }
    setQuestions(newQs)
  }

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (!title) return alert("Title required")
    if (questions.length === 0) return alert("At least one question required")
    
    setLoading(true)
    try {
      // JSON.parse(JSON.stringify()) strips out any 'undefined' fields which Firebase rejects
      const cleanQuestions = JSON.parse(JSON.stringify(questions))
      
      await techRoundsService.create({
        title,
        questions: cleanQuestions,
        createdAt: new Date().toISOString()
      })
      onSaved()
      onOpenChange(false)
      setTitle("")
      setQuestions([])
    } catch (e) {
      console.error(e)
      alert("Error saving")
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateAI = async () => {
    if (!aiTopic) return alert("Please enter a topic/role")
    
    setGenerating(true)
    try {
      const res = await fetch("/api/ai/suggest-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: aiTopic })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      
      const newQs = data.questions.map((q: any) => ({
        id: crypto.randomUUID(),
        type: q.type,
        prompt: q.prompt,
        options: q.options,
        idealAnswer: q.idealAnswer
      }))
      
      setQuestions([...questions, ...newQs])
      setAiTopic("")
    } catch (e) {
      console.error(e)
      alert("Failed to generate AI questions")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Tech Round</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Round Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Senior React Developer" />
          </div>

          <div className="p-4 bg-slate-50 border border-indigo-100 rounded-md space-y-3">
            <Label className="text-indigo-700 font-semibold">✨ Generate Questions with AI</Label>
            <div className="flex gap-2">
              <Input 
                value={aiTopic} 
                onChange={(e) => setAiTopic(e.target.value)} 
                placeholder="e.g. React Native with Expo and Firebase" 
                className="flex-1 border-indigo-200 focus-visible:ring-indigo-500"
              />
              <Button 
                onClick={handleGenerateAI} 
                disabled={generating || !aiTopic}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {generating ? "Generating..." : "Suggest"}
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              This will use the CookhouseAdmin and CatterCom tech stack to generate 10 tailored questions and ideal answers.
            </p>
          </div>

          <div className="space-y-4">
            <Label>Questions</Label>
            {questions.map((q, i) => (
              <div key={q.id} className="p-4 border rounded-md space-y-3 relative">
                <Button variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => removeQuestion(i)}>
                  <Trash className="h-4 w-4 text-red-500" />
                </Button>
                <div className="font-medium">{q.type === "code" ? "Code Question" : "Multiple Choice"}</div>
                
                <div className="space-y-1">
                  <Label>Prompt</Label>
                  <Textarea value={q.prompt} onChange={(e) => updateQuestion(i, { prompt: e.target.value })} placeholder="Question text..." />
                </div>

                {q.type === "multiple_choice" && (
                  <div className="space-y-2 pl-4 border-l-2">
                    <Label>Options</Label>
                    {q.options?.map((opt, optIndex) => (
                      <Input key={optIndex} value={opt} onChange={(e) => updateOption(i, optIndex, e.target.value)} placeholder={`Option ${optIndex + 1}`} />
                    ))}
                    <Button variant="outline" size="sm" onClick={() => updateQuestion(i, { options: [...(q.options || []), ""] })}>
                      Add Option
                    </Button>
                  </div>
                )}

                <div className="space-y-1">
                  <Label>Ideal Answer (Used by AI to grade)</Label>
                  <Textarea value={q.idealAnswer} onChange={(e) => updateQuestion(i, { idealAnswer: e.target.value })} placeholder="Provide the correct code or exact option text..." />
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => addQuestion("code")}>
              <Plus className="mr-2 h-4 w-4" /> Add Code Question
            </Button>
            <Button variant="outline" onClick={() => addQuestion("multiple_choice")}>
              <Plus className="mr-2 h-4 w-4" /> Add Multiple Choice
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading}>Save Round</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
