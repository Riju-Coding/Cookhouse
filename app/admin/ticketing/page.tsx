"use client"

import React, { useState, useEffect, useMemo } from "react"
import { ticketService, type Ticket, type TicketComment } from "@/lib/firestore/ticketService"
import { rewardService, type UserStats } from "@/lib/firestore/rewardService"
import { useAuth } from "@/hooks/use-auth"
import * as xlsx from "xlsx"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  Ticket as TicketIcon, Award, MessageSquare, ShieldAlert, Star, 
  UserCircle2, ArrowRightCircle, CheckCircle2, Search, Filter, 
  Download, AlertTriangle, Activity 
} from "lucide-react"

export default function TicketingDashboard() {
  const { userProfile, userType } = useAuth()
  
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [leaderboard, setLeaderboard] = useState<UserStats[]>([])
  const [loading, setLoading] = useState(true)

  // Filters State
    const [exportModalOpen, setExportModalOpen] = useState(false)
  const [exportTimeframe, setExportTimeframe] = useState("Today")
  const [exportStartDate, setExportStartDate] = useState("")
  const [exportEndDate, setExportEndDate] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  
  const [statusFilter, setStatusFilter] = useState("All")
  const [companyFilter, setCompanyFilter] = useState("All")
  const [categoryFilter, setCategoryFilter] = useState("All")
  const [employeeIdFilter, setEmployeeIdFilter] = useState("")

  // Reward Modal State
  const [rewardModalOpen, setRewardModalOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [rewardPoints, setRewardPoints] = useState("10")
  const [rewardBadge, setRewardBadge] = useState<string>("Gold Star")
  const [rewardMessage, setRewardMessage] = useState("")

  // Comments & Resolution Modal State
  const [commentsModalOpen, setCommentsModalOpen] = useState(false)
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null)
  const [comments, setComments] = useState<TicketComment[]>([])
  const [newComment, setNewComment] = useState("")
  const [loadingComments, setLoadingComments] = useState(false)
  const [commentRole, setCommentRole] = useState("Super Admin")

  const isCompanyAdmin = userType === "company_user"
  const isSuperAdmin = userType === "super_admin"

  const fetchData = async () => {
    setLoading(true)
    try {
      const [fetchedTickets, fetchedLeaderboard] = await Promise.all([
        ticketService.getTickets(),
        isCompanyAdmin ? Promise.resolve([]) : rewardService.getLeaderboard(5)
      ])
      
      let initialTickets = fetchedTickets
      if (isCompanyAdmin && userProfile?.companyIds?.length) {
        initialTickets = fetchedTickets.filter(t => userProfile.companyIds.includes(t.companyId))
      }
      
      setTickets(initialTickets)
      if (!isCompanyAdmin) setLeaderboard(fetchedLeaderboard)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.companyIds, userType])

  // derived filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      // text search
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesSearch = t.title.toLowerCase().includes(query) || t.description.toLowerCase().includes(query)
        if (!matchesSearch) return false
      }
      
      if (statusFilter !== "All" && t.status !== statusFilter) return false
      
      // Super admin company filter
      if (!isCompanyAdmin && companyFilter !== "All" && t.companyName !== companyFilter) return false
      
      const cat = t.category || "Uncategorized"
      if (categoryFilter !== "All" && cat !== categoryFilter) return false
      
            if (employeeIdFilter && !t.creatorId.toLowerCase().includes(employeeIdFilter.toLowerCase())) return false
      
      
      
      return true
    })
  }, [tickets, searchQuery, statusFilter, companyFilter, categoryFilter, employeeIdFilter, isCompanyAdmin])

  // Stats
  const stats = useMemo(() => {
    let opened = 0
    let resolved = 0
    let breached = 0
    const now = Date.now()
    
    filteredTickets.forEach(t => {
      if (t.status === 'Resolved' || t.status === 'Closed') {
        resolved++
      } else {
        opened++
        if (t.slaBreachAt.toMillis() < now) {
          breached++
        }
      }
    })
    
    return { opened, resolved, breached }
  }, [filteredTickets])

  const handleExport = () => {
    // Filter the current filteredTickets based on the exportTimeframe
    let finalTickets = filteredTickets;
    const now = new Date();
    
    if (exportTimeframe === "Today") {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      finalTickets = filteredTickets.filter(t => t.createdAt.toDate() >= today);
    } else if (exportTimeframe === "This Month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      finalTickets = filteredTickets.filter(t => t.createdAt.toDate() >= startOfMonth);
    } else if (exportTimeframe === "Custom") {
      if (exportStartDate) {
        const start = new Date(exportStartDate);
        start.setHours(0, 0, 0, 0);
        finalTickets = finalTickets.filter(t => t.createdAt.toDate() >= start);
      }
      if (exportEndDate) {
        const end = new Date(exportEndDate);
        end.setHours(23, 59, 59, 999);
        finalTickets = finalTickets.filter(t => t.createdAt.toDate() <= end);
      }
    }

    const exportData: any[] = []
    const merges: any[] = []
    let currentRowIndex = 1 // Row 0 is the header row

    finalTickets.forEach(t => {
      let items: any[] = []
      
      if (t.category === "Food Quality") {
        const desc = t.description || ""
        const itemRegex = /Item:\s*(.+)\nRating:\s*(.+)(?:\nRemark:\s*(.*))?/g
        let match
        while ((match = itemRegex.exec(desc)) !== null) {
          items.push({
            name: match[1].trim(),
            rating: match[2].trim(),
            remark: match[3] ? match[3].trim() : ""
          })
        }
      }

      if (items.length === 0) {
        items.push({ name: "N/A", rating: "N/A", remark: "N/A" })
      }

      const rowCount = items.length
      
      let generalDesc = t.description || ""
      if (t.category === "Food Quality") {
        const parts = generalDesc.split("--- Meal Feedback")
        const firstPart = parts[0]
        const match = firstPart.match(/Complaint:\s*([\s\S]*)/)
        generalDesc = match ? match[1].trim() : firstPart.trim()
      }

      const baseRow: any = {
        "Ticket ID": t.id,
        "Employee ID": t.creatorId === "public_user" ? ((t.description || "").match(/Employee ID:\s*([^\n]+)/)?.[1]?.trim() || "N/A") : t.creatorId,
        "Employee Name": t.creatorName,
        "Company": t.companyName,
        "Category": t.category || "Uncategorized",
        "Priority": t.priority,
        "Status": t.status,
        "Submitted At": t.createdAt.toDate().toLocaleString(),
        "Is Breached": (t.slaBreachAt.toMillis() < Date.now() && t.status !== 'Resolved' && t.status !== 'Closed') ? "Yes" : "No",
        "General Description": generalDesc,
        "Attached Images": Array.isArray(t.photos) && t.photos.length > 0 ? t.photos.join(", ") : "None",
      }

      items.forEach(item => {
        exportData.push({
          ...baseRow,
          "Food Item": item.name,
          "Item Rating": item.rating,
          "Item Remark": item.remark
        })
      })

      if (rowCount > 1) {
        // We have 11 base columns (from Ticket ID up to Attached Images). Index 0 to 10.
        for (let col = 0; col <= 10; col++) {
          merges.push({
            s: { r: currentRowIndex, c: col },
            e: { r: currentRowIndex + rowCount - 1, c: col }
          })
        }
      }

      currentRowIndex += rowCount
    })
    
    const ws = xlsx.utils.json_to_sheet(exportData)
    if (merges.length > 0) {
      ws['!merges'] = merges
    }
    
    const wb = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(wb, ws, "Tickets")
    
    // Add summary sheet
    let totalLoved = 0;
    let totalGood = 0;
    let totalOkay = 0;
    let totalNeedsImprovement = 0;
    
    finalTickets.forEach(t => {
      if (t.category === "Food Quality") {
        const desc = t.description || ""
        totalLoved += (desc.match(/Rating: Loved it/gi) || []).length;
        totalGood += (desc.match(/Rating: Good/gi) || []).length;
        totalOkay += (desc.match(/Rating: Okay/gi) || []).length;
        totalNeedsImprovement += (desc.match(/Rating: (Nope|Needs Improvement)/gi) || []).length;
      }
    })
    
    const totalRatings = totalLoved + totalGood + totalOkay + totalNeedsImprovement;
    
    const summaryData = [
      { "Rating Type": "Loved It", "Count": totalLoved, "Percentage": totalRatings > 0 ? ((totalLoved / totalRatings) * 100).toFixed(2) + "%" : "0%" },
      { "Rating Type": "Good", "Count": totalGood, "Percentage": totalRatings > 0 ? ((totalGood / totalRatings) * 100).toFixed(2) + "%" : "0%" },
      { "Rating Type": "Okay", "Count": totalOkay, "Percentage": totalRatings > 0 ? ((totalOkay / totalRatings) * 100).toFixed(2) + "%" : "0%" },
      { "Rating Type": "Needs Improvement", "Count": totalNeedsImprovement, "Percentage": totalRatings > 0 ? ((totalNeedsImprovement / totalRatings) * 100).toFixed(2) + "%" : "0%" },
      { "Rating Type": "Total Reviews", "Count": totalRatings, "Percentage": "100%" }
    ]
    
    const wsSummary = xlsx.utils.json_to_sheet(summaryData)
    xlsx.utils.book_append_sheet(wb, wsSummary, "Summary")
    xlsx.writeFile(wb, `Tickets_Export_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const uniqueCompanies = useMemo(() => Array.from(new Set(tickets.map(t => t.companyName))).filter(Boolean), [tickets])
  const uniqueCategories = useMemo(() => Array.from(new Set(tickets.map(t => t.category || "Uncategorized"))), [tickets])

  const handleGrantReward = async () => {
    if (!selectedTicket || !userProfile) return
    try {
      await rewardService.grantReward({
        kamId: selectedTicket.creatorId,
        kamName: selectedTicket.creatorName,
        managerId: userProfile.id,
        managerName: userProfile.name,
        ticketId: selectedTicket.id,
        points: parseInt(rewardPoints),
        badgeType: rewardBadge as any,
        message: rewardMessage || "Great job resolving this issue!"
      })
      setRewardModalOpen(false)
      fetchData()
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

  const handleEscalate = async (ticket: Ticket) => {
    try {
      await ticketService.addTicketComment(ticket.id, userProfile?.id || "admin", userProfile?.name || "Company Admin", "ESCALATION REQUESTED: We need immediate attention on this issue.", [], "Company Admin")
      alert("Escalation request posted!")
    } catch (e) {
      console.error(e)
    }
  }

  const handlePostComment = async () => {
    if (!activeTicket || !newComment.trim() || !userProfile) return
    const roleToPost = isCompanyAdmin ? "Company Admin" : commentRole

    try {
      await ticketService.addTicketComment(activeTicket.id, userProfile.id, userProfile.name, newComment.trim(), [], roleToPost)
      setNewComment("")
      // refresh comments
      const fetchedComments = await ticketService.getTicketComments(activeTicket.id)
      setComments(fetchedComments)
    } catch (e) {
      console.error(e)
    }
  }

  const handleUpdateStatus = async (status: any) => {
    if (!activeTicket || isCompanyAdmin) return
    try {
      await ticketService.updateTicketStatus(activeTicket.id, status)
      fetchData()
      setActiveTicket({ ...activeTicket, status })
    } catch (e) {
      console.error(e)
    }
  }

  if (loading) return <div className="p-8 text-center text-gray-500 flex flex-col items-center gap-4"><div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div> Loading Data...</div>

  return (
    <div className="space-y-6 p-2 lg:p-6 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TicketIcon className="h-6 w-6 text-purple-600" /> Support Tickets
          </h1>
          <p className="text-gray-600 text-sm mt-0.5">
            {isCompanyAdmin ? "View and track your company's complaints." : "Manage SLA-based tickets and rewards."}
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => setExportModalOpen(true)}>
          <Download className="w-4 h-4" /> Export XLSX
        </Button>
      </div>

      {/* Stats Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50/50 border-blue-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Open Tickets</p>
                <h3 className="text-3xl font-bold text-blue-900 mt-1">{stats.opened}</h3>
              </div>
              <Activity className="w-8 h-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-50/50 border-red-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Breached SLA</p>
                <h3 className="text-3xl font-bold text-red-900 mt-1">{stats.breached}</h3>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50/50 border-green-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Resolved</p>
                <h3 className="text-3xl font-bold text-green-900 mt-1">{stats.resolved}</h3>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            
            <div className="flex-1 w-full space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase">Search</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <Input 
                  placeholder="Search titles or description..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <div className="w-full md:w-[150px] space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Statuses</SelectItem>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Resolved">Resolved</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!isCompanyAdmin && (
              <div className="w-full md:w-[180px] space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase">Company</label>
                <Select value={companyFilter} onValueChange={setCompanyFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Companies</SelectItem>
                    {uniqueCompanies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="w-full md:w-[150px] space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase">Category</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Categories</SelectItem>
                  {uniqueCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full md:w-[140px] space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase">Employee ID</label>
              <Input 
                placeholder="Emp ID..." 
                value={employeeIdFilter}
                onChange={e => setEmployeeIdFilter(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={isCompanyAdmin ? "lg:col-span-3 space-y-4" : "lg:col-span-2 space-y-4"}>
          
          {filteredTickets.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-gray-500 flex flex-col items-center">
                <Filter className="w-12 h-12 text-gray-200 mb-3" />
                <p>No tickets match your filters.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead>Ticket</TableHead>
                      {!isCompanyAdmin && <TableHead>Company</TableHead>}
                      <TableHead>Reporter</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Deadline</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTickets.map(ticket => {
                      const isBreached = ticket.slaBreachAt.toMillis() < Date.now() && ticket.status !== 'Resolved' && ticket.status !== 'Closed'
                      
                      return (
                        <TableRow key={ticket.id} className={isBreached ? 'bg-red-50/50 hover:bg-red-50' : ''}>
                          <TableCell className="font-medium">
                            <div className="flex flex-col gap-1">
                              <span>{ticket.title}</span>
                              <div className="flex gap-2 items-center">
                                <Badge variant="outline" className="text-[10px] text-gray-500 bg-white">{ticket.category || 'Uncategorized'}</Badge>
                                <span className="text-xs text-gray-400 truncate max-w-[200px]" title={ticket.description}>{ticket.description}</span>
                              </div>
                            </div>
                          </TableCell>
                          {!isCompanyAdmin && <TableCell className="text-sm">{ticket.companyName}</TableCell>}
                          <TableCell className="text-sm text-gray-600">
                            <div>{ticket.creatorName}</div>
                            <div className="text-xs text-gray-400">ID: {ticket.creatorId}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={ticket.status === 'Resolved' ? 'secondary' : 'default'} className="whitespace-nowrap">
                              {ticket.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className={`text-xs ${isBreached ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                                {ticket.slaBreachAt.toDate().toLocaleString()}
                              </span>
                              {isBreached && <span className="text-[10px] font-bold text-red-600">BREACHED</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {isCompanyAdmin ? (
                              <>
                                <Button variant="outline" size="sm" onClick={() => handleOpenComments(ticket)} className="mr-2">
                                  View
                                </Button>
                                {ticket.status !== 'Resolved' && ticket.status !== 'Closed' && (
                                  <Button size="sm" variant="destructive" onClick={() => handleEscalate(ticket)}>
                                    Escalate
                                  </Button>
                                )}
                              </>
                            ) : (
                              <>
                                <Button variant="outline" size="sm" onClick={() => handleOpenComments(ticket)} className="mr-2">
                                  Resolve
                                </Button>
                                {(ticket.status === 'Resolved' || ticket.status === 'Closed') && (
                                  <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-white" onClick={() => {
                                    setSelectedTicket(ticket)
                                    setRewardModalOpen(true)
                                  }}>
                                    <Award className="w-4 h-4" />
                                  </Button>
                                )}
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </div>

        {!isCompanyAdmin && (
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
        )}
      </div>

      {/* Modals */}
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

      {/* Ticket Resolution Modal */}
      <Dialog open={commentsModalOpen} onOpenChange={setCommentsModalOpen}>
        <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 overflow-hidden bg-gray-50">
          <div className="bg-white px-6 py-4 border-b flex items-center justify-between z-10 shrink-0">
            <div>
              <DialogTitle className="flex items-center gap-2 text-xl mb-1">
                <TicketIcon className="w-5 h-5 text-indigo-600" />
                {activeTicket?.title}
              </DialogTitle>
              <div className="text-sm text-gray-500">
                {activeTicket?.companyName} • Reported by {activeTicket?.creatorName}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant={activeTicket?.status === 'Resolved' ? 'secondary' : 'default'} className="text-sm">
                Status: {activeTicket?.status}
              </Badge>
              {!isCompanyAdmin && activeTicket?.status !== 'Closed' && activeTicket?.status !== 'Resolved' && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleUpdateStatus('In Progress')} className="h-7 text-xs">
                    Mark In Progress
                  </Button>
                  <Button size="sm" variant="default" onClick={() => handleUpdateStatus('Resolved')} className="h-7 text-xs bg-green-600 hover:bg-green-700">
                    <CheckCircle2 className="w-3 h-3 mr-1"/> Resolve
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="bg-white p-4 rounded-xl border shadow-sm mb-6">
              <h4 className="font-semibold text-gray-900 mb-2">Original Complaint</h4>
              <p className="text-gray-700 whitespace-pre-wrap">{activeTicket?.description}</p>
            </div>

            <div className="space-y-4">
              {loadingComments ? (
                <div className="text-center text-gray-500 py-10 flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div> Loading resolution timeline...
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center text-gray-400 py-10 italic">No updates or remarks yet.</div>
              ) : (
                comments.map(c => {
                  const isStaff = c.userRole === 'Vendor Staff'
                  const isKAM = c.userRole === 'Key Account Manager'
                  const isAdmin = c.userRole === 'Super Admin'
                  
                  return (
                    <div key={c.id} className={`flex gap-3 ${isAdmin ? 'flex-row-reverse' : ''}`}>
                      <div className="shrink-0 pt-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isAdmin ? 'bg-indigo-100 text-indigo-700' : 
                          isKAM ? 'bg-blue-100 text-blue-700' : 
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          <UserCircle2 className="w-5 h-5" />
                        </div>
                      </div>
                      <div className={`bg-white p-4 rounded-xl border shadow-sm max-w-[85%] ${
                        isAdmin ? 'rounded-tr-none border-indigo-100' : 'rounded-tl-none'
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-bold text-sm text-gray-900">{c.userName}</span>
                          {c.userRole && (
                            <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${
                              isAdmin ? 'bg-indigo-50 text-indigo-700' :
                              isKAM ? 'bg-blue-50 text-blue-700' :
                              'bg-emerald-50 text-emerald-700'
                            }`}>
                              {c.userRole}
                            </Badge>
                          )}
                          <span className="text-xs text-gray-400 ml-auto">
                            {c.timestamp.toDate().toLocaleString(undefined, {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{c.text}</p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="bg-white border-t p-4 shrink-0">
            <div className="flex items-center gap-3 max-w-4xl mx-auto">
              {!isCompanyAdmin && (
                <Select value={commentRole} onValueChange={setCommentRole}>
                  <SelectTrigger className="w-[180px] h-11">
                    <SelectValue placeholder="Post As..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Super Admin">Super Admin</SelectItem>
                    <SelectItem value="Key Account Manager">KAM</SelectItem>
                    <SelectItem value="Vendor Staff">Vendor Staff</SelectItem>
                  </SelectContent>
                </Select>
              )}
              
              <Input 
                className="h-11 flex-1 bg-gray-50 focus-visible:ring-indigo-500"
                placeholder="Add a remark, update, or resolution note..." 
                value={newComment} 
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePostComment()}
              />
              <Button onClick={handlePostComment} disabled={!newComment.trim()} className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700">
                Post Update <ArrowRightCircle className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    
      {/* Export Options Modal */}
      <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Export Tickets</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Timeframe</label>
              <Select value={exportTimeframe} onValueChange={setExportTimeframe}>
                <SelectTrigger>
                  <SelectValue placeholder="Select timeframe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Time (No Filter)</SelectItem>
                  <SelectItem value="Today">Today</SelectItem>
                  <SelectItem value="This Month">This Month</SelectItem>
                  <SelectItem value="Custom">Custom Date Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {exportTimeframe === "Custom" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Date</label>
                  <Input type="date" value={exportStartDate} onChange={(e) => setExportStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">End Date</label>
                  <Input type="date" value={exportEndDate} onChange={(e) => setExportEndDate(e.target.value)} />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportModalOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              handleExport();
              setExportModalOpen(false);
            }}>
              Download Excel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}