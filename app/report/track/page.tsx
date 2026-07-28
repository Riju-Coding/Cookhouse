"use client"
import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { ticketService, Ticket, TicketComment } from "@/lib/firestore/ticketService"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, Search, AlertCircle, CheckCircle2, MessageSquare } from "lucide-react"

function TrackTicketContent() {
  const searchParams = useSearchParams()
  const urlId = searchParams.get('id')

  const [ticketId, setTicketId] = useState(urlId || "")
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [comments, setComments] = useState<TicketComment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let idToSearch = urlId
    if (!idToSearch && typeof window !== "undefined") {
      idToSearch = localStorage.getItem("cookhouse_last_ticket_id")
      if (idToSearch) {
        setTicketId(idToSearch)
      }
    }
    
    if (idToSearch) {
      handleSearch(idToSearch)
    }
  }, [urlId])

  const handleSearch = async (idToSearch: string) => {
    if (!idToSearch.trim()) return
    setLoading(true)
    setError("")
    setTicket(null)
    try {
      const [data, commentsData] = await Promise.all([
        ticketService.getTicketById(idToSearch.trim()),
        ticketService.getTicketComments(idToSearch.trim())
      ])
      
      if (!data) {
        setError("We couldn't find a ticket with this ID. Please check and try again.")
      } else {
        setTicket(data)
        setComments(commentsData)
      }
    } catch (e: any) {
      console.error("Firestore Error:", e)
      setError(`An error occurred: ${e.message || "Unknown error"}`)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'In Progress': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'Resolved': return 'bg-green-100 text-green-800 border-green-200'
      case 'Closed': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <>
      <div className="bg-slate-800 text-white p-4 shadow-md sticky top-0 z-50 flex items-center justify-center relative">
        <h1 className="text-lg font-bold">Track Ticket</h1>
      </div>
      <div className="w-full max-w-2xl mx-auto space-y-6 p-4">
      <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-6 space-y-6">
      <div className="text-center space-y-2 mb-6">
        <h2 className="text-xl font-bold text-gray-900">Track Your Ticket</h2>
        <p className="text-sm text-gray-500">Enter your Ticket ID below to check its current status.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input 
          placeholder="Enter Ticket ID..." 
          value={ticketId} 
          onChange={e => setTicketId(e.target.value)}
          className="h-12 font-mono flex-1"
        />
        <Button className="h-12 px-8" onClick={() => handleSearch(ticketId)} disabled={loading}>
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Track"}
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-start gap-3 border border-red-100 mt-4">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {ticket && (
        <div className="border rounded-xl p-5 space-y-4 bg-slate-50 mt-6 shadow-inner">
          <div className="flex justify-between items-start gap-4">
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Status</p>
              <span className={`px-3 py-1 text-sm font-semibold rounded-full border ${getStatusColor(ticket.status)}`}>
                {ticket.status}
              </span>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Ticket ID</p>
              <p className="text-sm font-mono font-bold text-gray-700">{ticket.id}</p>
            </div>
          </div>
          
          <div className="pt-3 border-t">
            <h3 className="font-bold text-lg text-gray-900">{ticket.title}</h3>
            <p className="text-sm text-gray-500 mt-1">Submitted on {ticket.createdAt.toDate().toLocaleDateString()}</p>
          </div>

          <div className="bg-white p-4 rounded-lg border text-sm text-gray-700 whitespace-pre-wrap leading-relaxed shadow-sm">
            {ticket.description}
          </div>

          {/* Comments Section */}
          {comments.length > 0 && (
            <div className="pt-6 mt-6 border-t space-y-4">
              <h4 className="font-bold text-gray-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-gray-500" /> 
                Updates & Comments
              </h4>
              <div className="space-y-3">
                {comments.map(comment => {
                  const isStaff = comment.userRole === 'Vendor Staff'
                  const isKAM = comment.userRole === 'Key Account Manager'
                  const isAdmin = comment.userRole === 'Super Admin'
                  
                  return (
                    <div key={comment.id} className="bg-white p-4 rounded-lg border shadow-sm border-gray-200">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="font-semibold text-sm text-blue-700">{comment.userName}</span>
                        {comment.userRole && (
                          <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${
                            isAdmin ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                            isKAM ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {comment.userRole}
                          </Badge>
                        )}
                        <span className="text-xs text-gray-500 ml-auto">{comment.timestamp.toDate().toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{comment.text}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          
          {ticket.status === 'Resolved' && (
            <div className="bg-green-50 text-green-700 p-4 rounded-lg flex items-center gap-3 border border-green-100 mt-4">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">This issue has been resolved by our facility team!</p>
            </div>
          )}
        </div>
      )}
    </div>
    </div>
    </>
  )
}

export default function TrackTicketPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>}>
      <TrackTicketContent />
    </Suspense>
  )
}
