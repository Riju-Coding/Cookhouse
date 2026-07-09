"use client"

import React, { useState, useEffect } from "react"
import { ticketService, type Ticket, type TicketComment } from "@/lib/firestore/ticketService"
import { rewardService, type UserStats } from "@/lib/firestore/rewardService"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Ticket as TicketIcon, Award, Clock, MessageSquare, ShieldAlert, Star } from "lucide-react"

export default function TicketingDashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [leaderboard, setLeaderboard] = useState<UserStats[]>([])
  const [loading, setLoading] = useState(true)

  // Reward Modal State
  const [rewardModalOpen, setRewardModalOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [rewardPoints, setRewardPoints] = useState("10")
  const [rewardBadge, setRewardBadge] = useState<string>("Gold Star")
  const [rewardMessage, setRewardMessage] = useState("")

  // Comments Modal State
  const [commentsModalOpen, setCommentsModalOpen] = useState(false)
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null)
  const [comments, setComments] = useState<TicketComment[]>([])
  const [newComment, setNewComment] = useState("")
  const [loadingComments, setLoadingComments] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [fetchedTickets, fetchedLeaderboard] = await Promise.all([
        ticketService.getTickets(),
        rewardService.getLeaderboard(5)
      ])
      setTickets(fetchedTickets)
      setLeaderboard(fetchedLeaderboard)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleGrantReward = async () => {
    if (!selectedTicket) return
    try {
      await rewardService.grantReward({
        kamId: selectedTicket.creatorId,
        kamName: selectedTicket.creatorName,
        managerId: "admin", // Replace with real auth user later
        managerName: "Admin",
        ticketId: selectedTicket.id,
        points: parseInt(rewardPoints),
        badgeType: rewardBadge as any,
        message: rewardMessage || "Great job resolving this issue!"
      })
      setRewardModalOpen(false)
      fetchData() // refresh leaderboard
    } catch (e) {
      console.error(e)
    }
  }

  const handleOpenComments = async (ticket: Ticket) => {
    setActiveTicket(ticket)
    setCommentsModalOpen(true)
    setLoadingComments(true)
    try {
      const fetchedComments = await ticketService.getTicketComments(ticket.id)
      setComments(fetchedComments)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingComments(false)
    }
  }

  const handlePostComment = async () => {
    if (!activeTicket || !newComment.trim()) return
    try {
      await ticketService.addTicketComment(activeTicket.id, "admin", "Admin", newComment.trim())
      setNewComment("")
      // refresh comments
      const fetchedComments = await ticketService.getTicketComments(activeTicket.id)
      setComments(fetchedComments)
    } catch (e) {
      console.error(e)
    }
  }

  if (loading) return <div className="p-8 text-center">Loading Ticketing System...</div>

  return (
    <div className="space-y-6 p-2 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <TicketIcon className="h-6 w-6 text-purple-600" /> Support Tickets & Rewards
        </h1>
        <p className="text-gray-600 text-sm mt-0.5">
          Manage SLA-based tickets and grant rewards to KAMs for excellent work.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-500" /> Active Tickets
          </h2>
          
          {tickets.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                No tickets found.
              </CardContent>
            </Card>
          ) : (
            tickets.map(ticket => {
              const isBreached = ticket.slaBreachAt.toMillis() < Date.now() && ticket.status !== 'Resolved' && ticket.status !== 'Closed'
              
              return (
                <Card key={ticket.id} className={`overflow-hidden border-l-4 ${isBreached ? 'border-l-red-600' : 'border-l-blue-500'}`}>
                  <CardHeader className="bg-gray-50 border-b pb-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {ticket.title}
                          <Badge variant={ticket.status === 'Resolved' ? 'secondary' : 'default'}>{ticket.status}</Badge>
                          <Badge variant="outline">{ticket.priority}</Badge>
                        </CardTitle>
                        <CardDescription>{ticket.companyName} • Reported by {ticket.creatorName}</CardDescription>
                      </div>
                      <div className="text-right text-xs">
                        {isBreached && <Badge variant="destructive" className="mb-1">SLA BREACHED</Badge>}
                        <div className="text-gray-500">
                          Due: {ticket.slaBreachAt.toDate().toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <p className="text-sm text-gray-800">{ticket.description}</p>
                    
                    <div className="mt-4 flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleOpenComments(ticket)}>
                        <MessageSquare className="w-4 h-4 mr-2" /> View Comments
                      </Button>
                      {(ticket.status === 'Resolved' || ticket.status === 'Closed') && (
                        <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-white" onClick={() => {
                          setSelectedTicket(ticket)
                          setRewardModalOpen(true)
                        }}>
                          <Award className="w-4 h-4 mr-2" /> Reward KAM
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" /> Top KAM Leaderboard
          </h2>
          <Card>
            <CardContent className="p-0">
              {leaderboard.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">No rewards granted yet.</div>
              ) : (
                <div className="divide-y">
                  {leaderboard.map((user, i) => (
                    <div key={user.kamId} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-100 text-gray-700' : i === 2 ? 'bg-orange-100 text-orange-800' : 'bg-blue-50 text-blue-700'}`}>
                          #{i + 1}
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{user.kamName}</div>
                          <div className="text-xs text-gray-500 flex gap-1 mt-1">
                            {Object.entries(user.badges).map(([b, count]) => (
                              <Badge key={b} variant="secondary" className="text-[10px] px-1 py-0">{b} x{count as number}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg text-indigo-600">{user.totalPoints}</div>
                        <div className="text-[10px] text-gray-500 uppercase">pts</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={rewardModalOpen} onOpenChange={setRewardModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reward KAM</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Points to Award</label>
              <Input type="number" value={rewardPoints} onChange={e => setRewardPoints(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Badge</label>
              <Select value={rewardBadge} onValueChange={setRewardBadge}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Gold Star">Gold Star</SelectItem>
                  <SelectItem value="Fast Solver">Fast Solver</SelectItem>
                  <SelectItem value="Client Favorite">Client Favorite</SelectItem>
                  <SelectItem value="Team Player">Team Player</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Message of Praise</label>
              <Input placeholder="Great job solving this quickly!" value={rewardMessage} onChange={e => setRewardMessage(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRewardModalOpen(false)}>Cancel</Button>
            <Button className="bg-yellow-500 hover:bg-yellow-600 text-white" onClick={handleGrantReward}>Grant Reward</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comments Modal */}
      <Dialog open={commentsModalOpen} onOpenChange={setCommentsModalOpen}>
        <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              Ticket Comments: {activeTicket?.title}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 border rounded-md">
            {loadingComments ? (
              <div className="text-center text-gray-500 py-10">Loading comments...</div>
            ) : comments.length === 0 ? (
              <div className="text-center text-gray-500 py-10">No comments yet.</div>
            ) : (
              comments.map(c => (
                <div key={c.id} className="bg-white p-3 rounded-lg border shadow-sm">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-sm">{c.userName}</span>
                    <span className="text-xs text-gray-500">{c.timestamp.toDate().toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-gray-800">{c.text}</p>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <Input 
              placeholder="Type an update or comment to the user..." 
              value={newComment} 
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handlePostComment()}
            />
            <Button onClick={handlePostComment} disabled={!newComment.trim()}>Post</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
