"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { techCandidatesService } from "@/lib/services"
import { TechRound } from "@/lib/types"

export function InviteCandidateModal({ open, onOpenChange, rounds, onSaved }: { open: boolean, onOpenChange: (v: boolean) => void, rounds: TechRound[], onSaved: () => void }) {
  const [email, setEmail] = useState("")
  const [selectedRoundId, setSelectedRoundId] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    if (!email || !selectedRoundId) return alert("Please fill all fields")
    
    const round = rounds.find(r => r.id === selectedRoundId)
    if (!round) return
    
    setLoading(true)
    try {
      await techCandidatesService.create({
        email: email.trim().toLowerCase(),
        techRoundId: round.id!,
        techRoundTitle: round.title,
        status: "pending",
        createdAt: new Date().toISOString()
      })
      onSaved()
      onOpenChange(false)
      setEmail("")
      setSelectedRoundId("")
    } catch (e) {
      console.error(e)
      alert("Error saving")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Candidate</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Candidate Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="candidate@example.com" />
          </div>

          <div className="space-y-2">
            <Label>Select Tech Round</Label>
            <Select value={selectedRoundId} onValueChange={setSelectedRoundId}>
              <SelectTrigger>
                <SelectValue placeholder="Select Round" />
              </SelectTrigger>
              <SelectContent>
                {rounds.map(r => (
                  <SelectItem key={r.id} value={r.id!}>{r.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading}>Invite Candidate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
