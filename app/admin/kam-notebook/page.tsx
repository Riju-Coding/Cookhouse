"use client"

import React, { useState, useEffect } from "react"
import { visitLogService, type VisitLog } from "@/lib/firestore/visitLogService"
import { reminderService, type Reminder } from "@/lib/firestore/reminderService"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FileText, MapPin, Clock, CheckCircle, Bell, Image as ImageIcon } from "lucide-react"

export default function KAMNotebookPage() {
  const [logs, setLogs] = useState<VisitLog[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [fetchedLogs, fetchedReminders] = await Promise.all([
          visitLogService.getAllVisitLogs(),
          // For super admin view, we'd ideally fetch all reminders, but reminderService currently fetches by KAM ID.
          // Let's create an "all" or just leave it empty for now, or assume we pass current user ID.
          // For now, we'll just show logs.
          Promise.resolve([]) 
        ])
        setLogs(fetchedLogs)
        setReminders(fetchedReminders)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return <div className="p-8 text-center">Loading Notebook Data...</div>
  }

  return (
    <div className="space-y-6 p-2 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="h-6 w-6 text-blue-600" /> KAM Field Notebook
        </h1>
        <p className="text-gray-600 text-sm mt-0.5">
          Review visit logs, notes, and photos from Key Account Managers in the field.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="w-5 h-5" /> Recent Visit Logs
          </h2>
          
          {logs.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                No visit logs recorded yet.
              </CardContent>
            </Card>
          ) : (
            logs.map(log => (
              <Card key={log.id} className="overflow-hidden">
                <CardHeader className="bg-gray-50 border-b pb-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-base">{log.companyName}</CardTitle>
                      <CardDescription>Visited by {log.kamName}</CardDescription>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <div>{log.timestamp.toDate().toLocaleDateString()}</div>
                      <div>{log.timestamp.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <p className="whitespace-pre-wrap text-sm text-gray-800">{log.notes}</p>
                  
                  {log.photos && log.photos.length > 0 && (
                    <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                      {log.photos.map((photo, i) => (
                        <div key={i} className="relative w-32 h-32 rounded-md overflow-hidden flex-shrink-0 border bg-gray-100">
                          <img src={photo} alt="Visit proof" className="object-cover w-full h-full" />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Bell className="w-5 h-5" /> Upcoming Reminders
          </h2>
          <Card>
            <CardContent className="p-4 text-center text-sm text-gray-500">
              Select a KAM to view their specific reminders.
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
