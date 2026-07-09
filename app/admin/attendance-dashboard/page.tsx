"use client"

import React, { useState, useEffect } from "react"
import { loginSessionService, type LoginSession } from "@/lib/firestore/loginSessionService"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, Clock, ShieldAlert, User, Laptop, Mouse, Keyboard, Eye, EyeOff, Bell, BellOff, Camera, CameraOff, MapPin, MapPinOff, AlertTriangle, RefreshCw, AppWindow } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ActivityDetailModal } from "@/components/attendance/ActivityDetailModal"

export default function AttendanceDashboardPage() {
  const [sessions, setSessions] = useState<LoginSession[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<LoginSession | null>(null)

  const loadSessions = async () => {
    try {
      const active = await loginSessionService.getActiveSessionsToday()
      setSessions(active)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSessions()
    const interval = setInterval(loadSessions, 30000) // refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const activeSessions = sessions.filter(s => s.status !== 'ended')
  const endedSessions = sessions.filter(s => s.status === 'ended')
  const idleSessions = sessions.filter(s => s.status === 'idle')
  
  // Find sessions with permission denials
  const sessionsWithDenials = sessions.filter(s => 
    s.permissionDenials && s.permissionDenials.length > 0
  )

  const totalActiveMinutes = activeSessions.reduce((sum, s) => sum + (s.totalActiveMinutes || 0), 0)
  const avgScore = activeSessions.length > 0 
    ? Math.round(activeSessions.reduce((sum, s) => sum + (s.activityScore || 0), 0) / activeSessions.length)
    : 0

  return (
    <div className="space-y-6 p-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="h-6 w-6 text-indigo-600" /> Live Activity Monitor
          </h1>
          <p className="text-gray-600 text-sm mt-0.5">
            Real-time employee activity, browser permissions, and session tracking.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setLoading(true); loadSessions(); }} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Active Now</div>
            <div className="text-2xl font-bold text-green-600 mt-1">{activeSessions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Idle</div>
            <div className="text-2xl font-bold text-orange-500 mt-1">{idleSessions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Today</div>
            <div className="text-2xl font-bold text-gray-800 mt-1">{sessions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Avg Score</div>
            <div className={`text-2xl font-bold mt-1 ${avgScore > 80 ? 'text-green-600' : avgScore > 50 ? 'text-orange-500' : 'text-red-600'}`}>{avgScore}/100</div>
          </CardContent>
        </Card>
        <Card className={sessionsWithDenials.length > 0 ? 'border-red-200 bg-red-50/30' : ''}>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wider flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" /> Denials
            </div>
            <div className={`text-2xl font-bold mt-1 ${sessionsWithDenials.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              {sessionsWithDenials.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Permission Denial Alerts */}
      {sessionsWithDenials.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-red-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> 
            Permission Denial Alerts — {sessionsWithDenials.length} user{sessionsWithDenials.length > 1 ? 's' : ''} denied browser permissions
          </h3>
          <div className="divide-y divide-red-100">
            {sessionsWithDenials.map(s => (
              <div key={s.id} className="flex items-center justify-between py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-red-900">{s.userName}</span>
                  <Badge variant="outline" className="text-[10px] text-red-700 border-red-200">{s.roleKey}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  {s.permissionDenials?.map((d, i) => (
                    <Badge key={i} variant="destructive" className="text-[10px]">
                      {d.permission} denied
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Monitoring Grid */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Eye className="h-5 w-5 text-indigo-500" /> Live Sessions
          <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
        </h2>
        
        {loading && <p className="text-muted-foreground">Loading...</p>}
        {!loading && activeSessions.length === 0 && (
          <p className="text-muted-foreground">No active users currently.</p>
        )}

        {/* Table Header */}
        {activeSessions.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 text-[11px] uppercase tracking-wider font-semibold text-gray-500 bg-gray-50/80 border-b">
              <div className="col-span-3">User</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-1 text-center">Score</div>
              <div className="col-span-2 text-center">Activity</div>
              <div className="col-span-3">Permissions</div>
              <div className="col-span-2 text-right">Session</div>
            </div>
            <div className="divide-y divide-gray-100">
              {activeSessions.map(session => {
                const isIdle = session.status === 'idle'
                const scoreColor = session.activityScore > 80 ? 'text-green-600 bg-green-50' : session.activityScore > 50 ? 'text-orange-500 bg-orange-50' : 'text-red-600 bg-red-50'
                const lastSelfie = session.selfies?.[session.selfies.length - 1]
                const perms = session.permissionStatus

                return (
                  <div 
                    key={session.id} 
                    onClick={() => setSelectedSession(session)}
                    className={`grid grid-cols-12 gap-2 px-4 py-3 items-center text-sm hover:bg-gray-50 transition-colors relative cursor-pointer ${isIdle ? 'opacity-60' : ''}`}
                  >
                    {/* Left color accent */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${isIdle ? 'bg-orange-400' : 'bg-green-500'}`} />
                    
                    {/* User */}
                    <div className="col-span-3 flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        {lastSelfie ? (
                          <AvatarImage src={lastSelfie.url} />
                        ) : (
                          <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700">{session.userName?.charAt(0) || 'U'}</AvatarFallback>
                        )}
                      </Avatar>
                      <div>
                        <p className="font-semibold text-sm text-gray-900 truncate">{session.userName}</p>
                        <p className="text-[10px] text-gray-500 uppercase">{session.roleKey}</p>
                      </div>
                    </div>
                    
                    {/* Status */}
                    <div className="col-span-1">
                      <Badge className={`text-[10px] ${isIdle ? 'bg-orange-100 text-orange-800 hover:bg-orange-100' : 'bg-green-100 text-green-800 hover:bg-green-100'}`}>
                        {isIdle ? 'Idle' : 'Active'}
                      </Badge>
                    </div>
                    
                    {/* Score */}
                    <div className="col-span-1 text-center">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${scoreColor}`}>
                        {session.activityScore}
                      </span>
                    </div>
                    
                    {/* Activity Metrics */}
                    <div className="col-span-2 flex items-center gap-3 justify-center">
                      <div className="flex items-center gap-1 text-gray-500" title="Mouse movements">
                        <Mouse className="h-3 w-3" />
                        <span className="text-xs font-mono">{session.mouseMovements || 0}</span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-500" title="Keystrokes">
                        <Keyboard className="h-3 w-3" />
                        <span className="text-xs font-mono">{session.keystrokes || 0}</span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-500" title="Tab switches">
                        <EyeOff className="h-3 w-3" />
                        <span className="text-xs font-mono">{session.tabFocusChanges || 0}</span>
                      </div>
                    </div>
                    
                    {/* Permissions */}
                    <div className="col-span-3 flex items-center gap-1.5 flex-wrap">
                      {perms ? (
                        <>
                          <PermBadge name="Notif" status={perms.notification} icon={perms.notification === 'granted' ? Bell : BellOff} />
                          <PermBadge name="Cam" status={perms.camera} icon={perms.camera === 'granted' ? Camera : CameraOff} />
                          <PermBadge name="Loc" status={perms.location} icon={perms.location === 'granted' ? MapPin : MapPinOff} />
                        </>
                      ) : (
                        <span className="text-[10px] text-gray-400">Checking...</span>
                      )}
                    </div>
                    
                    {/* Session Info */}
                    <div className="col-span-2 text-right">
                      {session.activeOsApp ? (
                        <div className="text-xs text-indigo-600 flex items-center gap-1 justify-end font-medium mb-1" title={session.activeOsApp.title}>
                          <AppWindow className="h-3 w-3" />
                          <span className="truncate max-w-[100px]">{session.activeOsApp.ownerName || session.activeOsApp.title}</span>
                        </div>
                      ) : (
                        <div className="text-[10px] text-gray-400 flex items-center gap-1 justify-end mb-1">
                          <AppWindow className="h-3 w-3 opacity-50" />
                          <span>Web Only</span>
                        </div>
                      )}
                      <div className="text-xs text-gray-500 flex items-center gap-1 justify-end">
                        <Laptop className="h-3 w-3" />
                        <span className="truncate max-w-[80px]">{session.browserInfo?.browser}</span>
                      </div>
                      <div className="text-[10px] text-gray-400 flex items-center gap-1 justify-end mt-0.5">
                        <Clock className="h-3 w-3" />
                        {session.loginAt?.toDate ? session.loginAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '—'}
                        <span className="text-gray-300 mx-0.5">•</span>
                        {session.totalActiveMinutes || 0}m active
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
      
      {/* Ended Sessions */}
      {endedSessions.length > 0 && (
        <div className="space-y-3 pt-4">
          <h2 className="text-lg font-semibold text-gray-600">Ended Sessions Today</h2>
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-100">
              {endedSessions.map(session => (
                <div key={session.id} className="flex items-center justify-between px-4 py-3 text-sm opacity-60 hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-xs">{session.userName?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-gray-700">{session.userName}</p>
                      <p className="text-[10px] text-gray-400 uppercase">{session.roleKey}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="font-mono">{session.totalActiveMinutes || 0}m active</span>
                    <span className="font-mono">{session.totalIdleMinutes || 0}m idle</span>
                    <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                      (session.activityScore || 0) > 80 ? 'bg-green-50 text-green-700' : 
                      (session.activityScore || 0) > 50 ? 'bg-orange-50 text-orange-700' : 
                      'bg-red-50 text-red-700'
                    }`}>{session.activityScore || 0}/100</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Live Detail Modal */}
      <ActivityDetailModal 
        isOpen={!!selectedSession}
        session={selectedSession}
        onClose={() => setSelectedSession(null)}
      />
    </div>
  )
}

// Permission Badge sub-component
function PermBadge({ name, status, icon: Icon }: { name: string; status: string; icon: any }) {
  const isDenied = status === 'denied'
  const isGranted = status === 'granted'
  
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${
      isDenied ? 'bg-red-50 text-red-700 border-red-200' :
      isGranted ? 'bg-green-50 text-green-700 border-green-200' :
      'bg-gray-50 text-gray-500 border-gray-200'
    }`}>
      <Icon className="h-2.5 w-2.5" />
      {name}
    </span>
  )
}
