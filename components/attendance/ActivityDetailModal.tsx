import React, { useState, useEffect } from "react"
import { collection, query, orderBy, onSnapshot, limit } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MonitorPlay, MousePointer2, Keyboard, LayoutGrid, Clock, CalendarDays, Maximize2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface ActivityDetailModalProps {
  isOpen: boolean
  onClose: () => void
  session: any // LoginSession
}

export function ActivityDetailModal({ isOpen, onClose, session }: ActivityDetailModalProps) {
  const [screenshots, setScreenshots] = useState<any[]>([])
  const [activityLogs, setActivityLogs] = useState<any[]>([])

  useEffect(() => {
    if (!isOpen || !session?.id) return

    // Listen to Screenshots
    const screenshotsRef = collection(db, 'login_sessions', session.id, 'screenshots')
    const qScreenshots = query(screenshotsRef, orderBy('serverTime', 'desc'), limit(10))
    const unsubScreenshots = onSnapshot(qScreenshots, (snap) => {
      setScreenshots(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    })

    // Listen to Activity Logs
    const activityRef = collection(db, 'login_sessions', session.id, 'activity_logs')
    const qActivity = query(activityRef, orderBy('serverTime', 'desc'), limit(50))
    const unsubActivity = onSnapshot(qActivity, (snap) => {
      setActivityLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    })

    return () => {
      unsubScreenshots()
      unsubActivity()
    }
  }, [isOpen, session])

  if (!session) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b bg-gray-50/50">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl flex items-center gap-2">
                <MonitorPlay className="h-5 w-5 text-indigo-600" />
                Live Activity: {session.userName}
              </DialogTitle>
              <DialogDescription className="mt-1">
                Viewing real-time desktop agent logs for this session.
              </DialogDescription>
            </div>
            <div className="text-right">
              <Badge className={session.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                {session.status.toUpperCase()}
              </Badge>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1 justify-end">
                <Clock className="h-3 w-3" />
                {session.totalActiveMinutes || 0}m active
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* LEFT: Screenshots Gallery */}
          <div className="w-1/2 border-r bg-gray-50 p-4 flex flex-col">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2 mb-4">
              <LayoutGrid className="h-4 w-4 text-gray-500" /> Recent Screenshots
            </h3>
            
            <ScrollArea className="flex-1 pr-4">
              {screenshots.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
                  <Maximize2 className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-sm">No screenshots captured yet.</p>
                  <p className="text-xs mt-1 text-center px-4">The desktop agent captures the screen every 5 minutes while active.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {screenshots.map((shot, idx) => (
                    <div key={shot.id} className="bg-white p-2 rounded-lg border shadow-sm group">
                      <div className="flex items-center justify-between mb-2 px-1">
                        <span className="text-xs font-semibold text-gray-600">
                          {idx === 0 ? 'Latest Screen' : `Capture ${idx + 1}`}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(shot.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      <div className="relative aspect-video bg-gray-100 rounded overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={shot.image} 
                          alt="Screenshot" 
                          className="object-cover w-full h-full"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* RIGHT: Activity Feed */}
          <div className="w-1/2 p-4 flex flex-col">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2 mb-4">
              <CalendarDays className="h-4 w-4 text-gray-500" /> Activity Timeline
            </h3>
            
            <ScrollArea className="flex-1 pr-4">
              {activityLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
                  <MousePointer2 className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-sm">Waiting for activity logs...</p>
                </div>
              ) : (
                <div className="relative border-l border-gray-200 ml-3 space-y-6 pb-4">
                  {activityLogs.map((log, i) => (
                    <div key={log.id} className="relative pl-6">
                      <span className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full bg-indigo-500 border-[3px] border-white ring-1 ring-gray-200" />
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-500">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${log.keystrokes > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                            {log.keystrokes > 0 ? 'ACTIVE' : 'IDLE'}
                          </span>
                        </div>
                        
                        <div className="bg-white border rounded-lg p-3 shadow-sm mt-1">
                          {log.appInfo ? (
                            <div className="mb-2 pb-2 border-b">
                              <p className="text-sm font-semibold text-gray-800 line-clamp-1" title={log.appInfo.title}>
                                {log.appInfo.title}
                              </p>
                              <p className="text-xs text-indigo-600 font-medium">
                                App: {log.appInfo.ownerName}
                              </p>
                            </div>
                          ) : (
                            <div className="mb-2 pb-2 border-b">
                              <p className="text-xs text-gray-400 italic">No app info reported.</p>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-4 text-xs text-gray-600 font-mono">
                            <span className="flex items-center gap-1" title="Keystrokes">
                              <Keyboard className="h-3.5 w-3.5" /> {log.keystrokes} keys
                            </span>
                            <span className="flex items-center gap-1" title="Mouse Clicks">
                              <MousePointer2 className="h-3.5 w-3.5" /> {log.mouseClicks} clicks
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
