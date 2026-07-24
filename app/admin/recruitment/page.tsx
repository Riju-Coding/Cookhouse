"use client"

import { useState, useEffect } from "react"
import { Plus, Users, Code, CheckCircle, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { techRoundsService, techCandidatesService } from "@/lib/services"
import { TechRound, TechCandidate } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { CreateRoundModal } from "./create-round-modal"
import { InviteCandidateModal } from "./invite-candidate-modal"
import { ReviewSubmissionModal } from "./review-submission-modal"

export default function RecruitmentDashboard() {
  const [rounds, setRounds] = useState<TechRound[]>([])
  const [candidates, setCandidates] = useState<TechCandidate[]>([])
  const [loading, setLoading] = useState(true)

  const [isCreateRoundOpen, setIsCreateRoundOpen] = useState(false)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<TechCandidate | null>(null)

  const fetchData = async () => {
    try {
      const [r, c] = await Promise.all([
        techRoundsService.getAll(),
        techCandidatesService.getAll()
      ])
      setRounds(r)
      setCandidates(c)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Tech Recruitment</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsCreateRoundOpen(true)}>
            <Code className="mr-2 h-4 w-4" /> Create Tech Round
          </Button>
          <Button onClick={() => setIsInviteOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Invite Candidate
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Rounds</CardTitle>
            <Code className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rounds.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Candidates</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{candidates.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Candidates</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Round</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map(candidate => (
                  <TableRow key={candidate.id}>
                    <TableCell className="font-medium">{candidate.email}</TableCell>
                    <TableCell>{candidate.techRoundTitle}</TableCell>
                    <TableCell>
                      {candidate.status === "completed" && <Badge variant="default" className="bg-green-600">Completed</Badge>}
                      {candidate.status === "in_progress" && <Badge variant="secondary">In Progress</Badge>}
                      {candidate.status === "pending" && <Badge variant="outline">Pending</Badge>}
                    </TableCell>
                    <TableCell>
                      {candidate.score !== undefined ? `${candidate.score} / ${Object.keys(candidate.answers || {}).length * 10}` : "-"}
                    </TableCell>
                    <TableCell>
                      {candidate.status === "completed" && (
                        <Button variant="ghost" size="sm" onClick={() => setSelectedCandidate(candidate)}>
                          Review Submission
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {candidates.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No candidates yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateRoundModal open={isCreateRoundOpen} onOpenChange={setIsCreateRoundOpen} onSaved={fetchData} />
      <InviteCandidateModal open={isInviteOpen} onOpenChange={setIsInviteOpen} rounds={rounds} onSaved={fetchData} />
      
      {selectedCandidate && (
        <ReviewSubmissionModal
          candidate={selectedCandidate}
          open={!!selectedCandidate}
          onOpenChange={(v) => !v && setSelectedCandidate(null)}
        />
      )}
    </div>
  )
}
