import React, { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Monitor, Search, MapPin, Clock, Battery, AlertTriangle, Navigation } from "lucide-react"
import { APIProvider, Map as GoogleMap, AdvancedMarker } from "@vis.gl/react-google-maps"

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ""

export function LiveMonitorTab({ records }: { records: any[] }) {
  const [search, setSearch] = useState("")
  const [mapModalOpen, setMapModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)

  // Calculate live status based on the latest record for each user
  const liveUsers = useMemo(() => {
    const userMap = new Map<string, any>()

    // records are typically sorted by timestamp desc, so we just take the first one we see per user
    records.forEach(r => {
      if (!userMap.has(r.userId)) {
        userMap.set(r.userId, r)
      }
    })

    const users = Array.from(userMap.values())
    
    if (search) {
      return users.filter(u => 
        u.employeeName?.toLowerCase().includes(search.toLowerCase()) ||
        u.siteName?.toLowerCase().includes(search.toLowerCase())
      )
    }

    return users
  }, [records, search])

  const activeCount = liveUsers.filter(u => u.status === "IN").length
  const inactiveCount = liveUsers.filter(u => u.status === "OUT").length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-100 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-lg text-blue-600">
              <Monitor className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-800">Total Tracked Today</p>
              <h3 className="text-2xl font-bold text-blue-900">{liveUsers.length}</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="bg-green-100 p-3 rounded-lg text-green-600">
              <MapPin className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-green-800">Currently On Site (IN)</p>
              <h3 className="text-2xl font-bold text-green-900">{activeCount}</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-50 border-gray-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="bg-gray-200 p-3 rounded-lg text-gray-600">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Checked Out (OUT)</p>
              <h3 className="text-2xl font-bold text-gray-800">{inactiveCount}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-lg">Live Employee Status</CardTitle>
              <CardDescription>Real-time view of where everyone is right now.</CardDescription>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search employee or site..."
                className="pl-9 bg-gray-50"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Current Status</TableHead>
                  <TableHead>Last Known Site</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Device Info</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liveUsers.map(user => {
                  const d = user.timestamp?.toDate ? user.timestamp.toDate() : new Date(user.timestamp)
                  const timeString = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                  const dateString = d.toLocaleDateString("en-IN", { month: "short", day: "numeric" })
                  
                  return (
                    <TableRow key={user.userId}>
                      <TableCell className="font-medium">{user.employeeName}</TableCell>
                      <TableCell>
                        {user.status === "IN" ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                            On Site
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-500">
                            Checked Out
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {user.siteName}
                        {user.distance > 0 && <span className="text-xs text-gray-400 block">{Math.round(user.distance)}m away</span>}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {timeString}
                        <span className="text-xs text-gray-400 block">{dateString}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {user.batteryLevel != null && (
                            <div className="flex items-center text-xs text-gray-500 gap-1" title="Battery Level">
                              <Battery className="h-3 w-3" />
                              {Math.round(user.batteryLevel * 100)}%
                            </div>
                          )}
                          {user.mockLocation && (
                            <div className="flex items-center text-xs text-red-500 gap-1" title="Mock Location Detected!">
                              <AlertTriangle className="h-3 w-3" />
                              Mocked
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            setSelectedUser(user)
                            setMapModalOpen(true)
                          }}
                          disabled={!user.latitude || !user.longitude}
                        >
                          <Navigation className="h-4 w-4 mr-1 text-blue-500" />
                          View Map
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {liveUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      No live data found for today.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={mapModalOpen} onOpenChange={setMapModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Employee Location Map</DialogTitle>
            <DialogDescription>
              Last known GPS location for {selectedUser?.employeeName} ({selectedUser?.status === "IN" ? "On Site" : "Checked Out"}).
            </DialogDescription>
          </DialogHeader>
          
          <div className="h-[400px] w-full rounded-lg overflow-hidden border mt-2 relative">
            {selectedUser?.latitude && selectedUser?.longitude ? (
              <APIProvider apiKey={MAPS_KEY}>
                <GoogleMap
                  defaultCenter={{ lat: selectedUser.latitude, lng: selectedUser.longitude }}
                  defaultZoom={16}
                  mapId="employee-location-map"
                  gestureHandling="greedy"
                  disableDefaultUI={true}
                >
                  <AdvancedMarker 
                    position={{ lat: selectedUser.latitude, lng: selectedUser.longitude }}
                  >
                    <div className="flex flex-col items-center">
                      <div className="bg-white px-2 py-1 rounded shadow text-xs font-bold mb-1">
                        {selectedUser.employeeName}
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 border-white shadow-lg ${selectedUser.status === "IN" ? "bg-green-500" : "bg-gray-500"}`} />
                    </div>
                  </AdvancedMarker>
                </GoogleMap>
              </APIProvider>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 text-gray-400">
                <MapPin className="h-12 w-12 mb-2" />
                <p>Location data unavailable.</p>
              </div>
            )}
          </div>
          
          <div className="flex justify-between items-center text-xs text-gray-500 px-1 mt-2">
            <span>Accuracy: ±{Math.round(selectedUser?.accuracy || 0)}m</span>
            <span>Recorded: {selectedUser?.timestamp?.toDate ? selectedUser.timestamp.toDate().toLocaleTimeString() : new Date(selectedUser?.timestamp).toLocaleTimeString()}</span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
