"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { db } from "@/lib/firebase"
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore"
import { toast } from "@/hooks/use-toast"
import {
  MapPin, Users, Clock, TrendingUp, AlertTriangle,
  Building2, Search, Filter, Download, RefreshCw,
  CheckCircle, LogIn, LogOut, Smartphone, Shield, Plus,
  UtensilsCrossed, Navigation, Edit2, Settings, Monitor, Bell, Activity
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import Link from "next/link"
import dynamic from "next/dynamic"
import type { Cafeteria } from "@/lib/firestore/cafeteriasService"
import type { MapPickerLocation } from "@/components/google-map-picker"
import { ShiftsAndBreaksTab } from "@/components/attendance/shifts-breaks-tab"
import { PoliciesTab } from "@/components/attendance/policies-tab"
import { LiveMonitorTab } from "@/components/attendance/live-monitor-tab"

// ── Dynamic imports for Google Maps (avoid SSR) ──────────────────────────────
const GoogleMapPicker = dynamic(() => import("@/components/google-map-picker"), {
  ssr: false,
  loading: () => (
    <div className="h-[350px] rounded-lg bg-gray-100 animate-pulse flex items-center justify-center">
      <MapPin className="h-8 w-8 text-gray-300" />
    </div>
  ),
})

const CafeteriaLocationsMap = dynamic(
  () => import("@/components/cafeteria-locations-map"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[400px] rounded-lg bg-gray-100 animate-pulse flex items-center justify-center">
        <MapPin className="h-8 w-8 text-gray-300" />
      </div>
    ),
  }
)

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AttendanceRecord {
  id: string
  userId: string
  employeeName: string
  companyId: string
  siteId: string
  siteName: string
  latitude: number
  longitude: number
  distance: number
  status: "IN" | "OUT"
  timestamp: any
  accuracy: number
  deviceId: string
  mockLocation: boolean
  batteryLevel: number
  appVersion: string
  validated: boolean
}

interface Company {
  id: string
  name: string
  [key: string]: any
}

interface Building {
  id: string
  name: string
  companyId: string
  companyName?: string
  [key: string]: any
}

// ─── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview", label: "Overview", icon: TrendingUp },
  { id: "live", label: "Live Monitor", icon: Monitor },
  { id: "records", label: "Attendance Records", icon: Clock },
  { id: "locations", label: "Locations", icon: MapPin },
  { id: "policies", label: "Policies", icon: Shield },
  { id: "shifts", label: "Shifts & Breaks", icon: Settings },
  { id: "alerts", label: "Alerts", icon: Bell },
] as const
type TabId = typeof TABS[number]["id"]

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(ts: any): string {
  if (!ts) return "—"
  const d: Date = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
}

function fmtDate(ts: any): string {
  if (!ts) return "—"
  const d: Date = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })
}

function fmtDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`
}

// ─── Cafeteria Location Modal ───────────────────────────────────────────────

function CafeteriaLocationModal({
  open,
  onClose,
  onSaved,
  companies,
  buildings,
  cafeterias,
  editCafeteria,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  companies: Company[]
  buildings: Building[]
  cafeterias: Cafeteria[]
  editCafeteria: Cafeteria | null
}) {
  // Cascading selection state
  const [selectedCompanyId, setSelectedCompanyId] = useState("")
  const [selectedBuildingId, setSelectedBuildingId] = useState("")
  const [selectedCafeteriaId, setSelectedCafeteriaId] = useState("")

  // Geo state
  const [location, setLocation] = useState<MapPickerLocation | null>(null)
  const [radius, setRadius] = useState(100)
  const [shiftStart, setShiftStart] = useState("09:00")
  const [shiftEnd, setShiftEnd] = useState("18:00")
  const [saving, setSaving] = useState(false)

  // If editing an existing cafeteria with geo data
  useEffect(() => {
    if (editCafeteria) {
      setSelectedCompanyId(editCafeteria.companyId || "")
      setSelectedBuildingId(editCafeteria.buildingId || "")
      setSelectedCafeteriaId(editCafeteria.id)
      setRadius(editCafeteria.radius ?? 100)
      setShiftStart(editCafeteria.shiftStart ?? "09:00")
      setShiftEnd(editCafeteria.shiftEnd ?? "18:00")
      if (editCafeteria.latitude && editCafeteria.longitude) {
        setLocation({
          lat: editCafeteria.latitude,
          lng: editCafeteria.longitude,
          address: editCafeteria.address ?? "",
        })
      } else {
        setLocation(null)
      }
    } else {
      // Reset form
      setSelectedCompanyId(companies[0]?.id ?? "")
      setSelectedBuildingId("")
      setSelectedCafeteriaId("")
      setLocation(null)
      setRadius(100)
      setShiftStart("09:00")
      setShiftEnd("18:00")
    }
  }, [editCafeteria, open, companies])

  // Filtered lists
  const filteredBuildings = useMemo(
    () => buildings.filter((b) => b.companyId === selectedCompanyId),
    [buildings, selectedCompanyId]
  )

  const filteredCafeterias = useMemo(
    () =>
      cafeterias.filter(
        (c) =>
          c.companyId === selectedCompanyId &&
          c.buildingId === selectedBuildingId
      ),
    [cafeterias, selectedCompanyId, selectedBuildingId]
  )

  // Reset cascading on company change
  useEffect(() => {
    if (!editCafeteria) {
      setSelectedBuildingId("")
      setSelectedCafeteriaId("")
    }
  }, [selectedCompanyId])

  useEffect(() => {
    if (!editCafeteria) {
      setSelectedCafeteriaId("")
    }
  }, [selectedBuildingId])

  // When cafeteria selection changes, load existing geo data
  useEffect(() => {
    if (selectedCafeteriaId && !editCafeteria) {
      const cafe = cafeterias.find((c) => c.id === selectedCafeteriaId)
      if (cafe) {
        if (cafe.latitude && cafe.longitude) {
          setLocation({
            lat: cafe.latitude,
            lng: cafe.longitude,
            address: cafe.address ?? "",
          })
        } else {
          setLocation(null)
        }
        setRadius(cafe.radius ?? 100)
        setShiftStart(cafe.shiftStart ?? "09:00")
        setShiftEnd(cafe.shiftEnd ?? "18:00")
      }
    }
  }, [selectedCafeteriaId])

  const handleSave = async () => {
    if (!selectedCafeteriaId) {
      toast({
        title: "Select a cafeteria",
        description: "Please select company, building, and cafeteria first",
        variant: "destructive",
      })
      return
    }
    if (!location) {
      toast({
        title: "Set location",
        description: "Click on the map or use 'Get My Location' to set the attendance point",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      // Update the cafeteria document with geo data
      // Note: Firestore collection is spelled "cafetarias" as per existing code
      await updateDoc(doc(db, "cafetarias", selectedCafeteriaId), {
        latitude: location.lat,
        longitude: location.lng,
        radius,
        address: location.address || "",
        shiftStart,
        shiftEnd,
        geoSetAt: serverTimestamp(),
        geoSetBy: "admin", // TODO: replace with actual user ID from auth context
        updatedAt: serverTimestamp(),
      })

      toast({
        title: "Location saved ✅",
        description: "Cafeteria geo-fence has been updated successfully",
      })
      onSaved()
      onClose()
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const selectedCafe = cafeterias.find((c) => c.id === selectedCafeteriaId)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-green-600" />
            {editCafeteria ? "Edit Cafeteria Location" : "Set Cafeteria Location"}
          </DialogTitle>
          <DialogDescription>
            Select a cafeteria and set its geo-fenced attendance point on the map
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Step 1: Cascading selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Company *</Label>
              <Select
                value={selectedCompanyId}
                onValueChange={setSelectedCompanyId}
                disabled={!!editCafeteria}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Building *</Label>
              <Select
                value={selectedBuildingId}
                onValueChange={setSelectedBuildingId}
                disabled={!!editCafeteria || !selectedCompanyId}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue
                    placeholder={
                      !selectedCompanyId
                        ? "Select company first"
                        : filteredBuildings.length === 0
                        ? "No buildings"
                        : "Select building"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {filteredBuildings.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Cafeteria *</Label>
              <Select
                value={selectedCafeteriaId}
                onValueChange={setSelectedCafeteriaId}
                disabled={!!editCafeteria || !selectedBuildingId}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue
                    placeholder={
                      !selectedBuildingId
                        ? "Select building first"
                        : filteredCafeterias.length === 0
                        ? "No cafeterias"
                        : "Select cafeteria"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {filteredCafeterias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Step 2: Map Picker (show only when cafeteria selected) */}
          {selectedCafeteriaId && (
            <>
              <div className="border-t pt-4">
                <GoogleMapPicker
                  initialLat={location?.lat ?? selectedCafe?.latitude}
                  initialLng={location?.lng ?? selectedCafe?.longitude}
                  initialAddress={location?.address ?? selectedCafe?.address}
                  radius={radius}
                  onLocationChange={(loc) => setLocation(loc)}
                  onRadiusChange={setRadius}
                  height="300px"
                />
              </div>

              {/* Step 3: Shift times */}
              <div className="grid grid-cols-2 gap-3 border-t pt-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Shift Start</Label>
                  <Input
                    type="time"
                    value={shiftStart}
                    onChange={(e) => setShiftStart(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Shift End</Label>
                  <Input
                    type="time"
                    value={shiftEnd}
                    onChange={(e) => setShiftEnd(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !selectedCafeteriaId || !location}
            className="bg-green-600 hover:bg-green-700"
          >
            {saving
              ? "Saving..."
              : editCafeteria
              ? "Update Location"
              : "Save Location"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AttendanceAdminPage() {
  const [activeTab, setActiveTab] = useState<TabId>("overview")
  const [companies, setCompanies] = useState<Company[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [cafeterias, setCafeterias] = useState<Cafeteria[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState("")
  const [filterCompany, setFilterCompany] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterDate, setFilterDate] = useState("today")

  // Location modal
  const [locationModalOpen, setLocationModalOpen] = useState(false)
  const [editCafeteria, setEditCafeteria] = useState<Cafeteria | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      // Load companies
      const cSnap = await getDocs(collection(db, "companies"))
      const companiesData = cSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Company[]
      setCompanies(companiesData)

      // Load buildings
      const bSnap = await getDocs(collection(db, "buildings"))
      setBuildings(
        bSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Building[]
      )

      // Load cafeterias (from the "cafetarias" collection — existing spelling)
      const cafSnap = await getDocs(collection(db, "cafetarias"))
      setCafeterias(
        cafSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Cafeteria[]
      )

      // Load recent attendance records
      const dateStart = new Date()
      if (filterDate === "today") {
        dateStart.setHours(0, 0, 0, 0)
      } else if (filterDate === "week") {
        dateStart.setDate(dateStart.getDate() - 7)
      } else if (filterDate === "month") {
        dateStart.setDate(dateStart.getDate() - 30)
      } else {
        dateStart.setFullYear(2000)
      }

      const qConstraints: any[] = [
        where("timestamp", ">=", Timestamp.fromDate(dateStart)),
        orderBy("timestamp", "desc"),
        limit(200),
      ]
      if (filterCompany !== "all")
        qConstraints.unshift(where("companyId", "==", filterCompany))
      if (filterStatus !== "all")
        qConstraints.unshift(where("status", "==", filterStatus))

      const rSnap = await getDocs(
        query(collection(db, "attendance"), ...qConstraints)
      )
      setRecords(
        rSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as AttendanceRecord[]
      )
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [filterDate, filterCompany, filterStatus])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Enriched cafeterias with company/building names
  const enrichedCafeterias = useMemo(
    () =>
      cafeterias.map((c) => ({
        ...c,
        companyName:
          companies.find((co) => co.id === c.companyId)?.name ?? c.companyId,
        buildingName:
          buildings.find((b) => b.id === c.buildingId)?.name ?? c.buildingId,
      })),
    [cafeterias, companies, buildings]
  )

  // Geo-enabled cafeterias count
  const geoEnabledCount = cafeterias.filter(
    (c) => c.latitude != null && c.longitude != null
  ).length

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchSearch =
        !search ||
        r.employeeName?.toLowerCase().includes(search.toLowerCase()) ||
        r.siteName?.toLowerCase().includes(search.toLowerCase())
      return matchSearch
    })
  }, [records, search])

  // Stats
  const stats = useMemo(
    () => ({
      totalCheckIns: records.filter((r) => r.status === "IN").length,
      totalCheckOuts: records.filter((r) => r.status === "OUT").length,
      mockLocationFlags: records.filter((r) => r.mockLocation).length,
      geoEnabledCafeterias: geoEnabledCount,
      uniqueUsers: new Set(records.map((r) => r.userId)).size,
    }),
    [records, geoEnabledCount]
  )

  // Export CSV
  const exportCSV = () => {
    const headers = [
      "Date",
      "Time",
      "Employee",
      "Company",
      "Site",
      "Status",
      "Distance",
      "Accuracy",
      "Device",
      "Mock GPS",
      "Battery",
    ]
    const rows = filteredRecords.map((r) => [
      fmtDate(r.timestamp),
      fmtTime(r.timestamp),
      r.employeeName,
      companies.find((c) => c.id === r.companyId)?.name ?? r.companyId,
      r.siteName,
      r.status,
      fmtDist(r.distance),
      `±${Math.round(r.accuracy)}m`,
      r.deviceId?.substring(0, 12),
      r.mockLocation ? "YES" : "no",
      `${Math.round((r.batteryLevel ?? 0) * 100)}%`,
    ])
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `attendance_${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  return (
    <div className="space-y-6 p-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="h-6 w-6 text-green-600" /> Attendance Management
          </h1>
          <p className="text-gray-600 text-sm mt-0.5">
            Location-based geo-fenced attendance tracking
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchAll}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700"
            onClick={() => {
              setEditCafeteria(null)
              setLocationModalOpen(true)
            }}
          >
            <MapPin className="h-4 w-4 mr-1" /> Set Location
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          {
            label: "Check-ins",
            value: stats.totalCheckIns,
            icon: LogIn,
            color: "text-green-600",
            bg: "bg-green-50",
          },
          {
            label: "Check-outs",
            value: stats.totalCheckOuts,
            icon: LogOut,
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            label: "Unique Users",
            value: stats.uniqueUsers,
            icon: Users,
            color: "text-purple-600",
            bg: "bg-purple-50",
          },
          {
            label: "Locations Set",
            value: stats.geoEnabledCafeterias,
            icon: MapPin,
            color: "text-orange-600",
            bg: "bg-orange-50",
          },
          {
            label: "Mock GPS Flags",
            value: stats.mockLocationFlags,
            icon: AlertTriangle,
            color: "text-red-600",
            bg: "bg-red-50",
          },
        ].map((stat) => (
          <Card key={stat.label} className="shadow-sm">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-2xl font-bold ${stat.color}`}>
                    {stat.value}
                  </p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
                <div
                  className={`h-9 w-9 rounded-lg ${stat.bg} flex items-center justify-center`}
                >
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b bg-white rounded-t-lg shadow-sm">
        <div className="flex gap-1 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-green-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══ OVERVIEW TAB ══ */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <UtensilsCrossed className="h-4 w-4 text-green-600" />{" "}
                Cafeterias by Company
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {companies.map((company) => {
                const companyCafes = cafeterias.filter(
                  (c) => c.companyId === company.id
                )
                const geoSet = companyCafes.filter(
                  (c) => c.latitude != null && c.longitude != null
                ).length
                return (
                  <div
                    key={company.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-gray-50"
                  >
                    <div>
                      <p className="text-sm font-semibold">{company.name}</p>
                      <p className="text-xs text-gray-400">
                        {companyCafes.length} cafeteria
                        {companyCafes.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <Badge
                      variant={geoSet > 0 ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {geoSet}/{companyCafes.length} located
                    </Badge>
                  </div>
                )
              })}
              {companies.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  No companies found
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-green-600" /> Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {records.slice(0, 8).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 py-2 border-b last:border-0"
                >
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center ${
                      r.status === "IN" ? "bg-green-100" : "bg-orange-100"
                    }`}
                  >
                    {r.status === "IN" ? (
                      <LogIn className="h-4 w-4 text-green-600" />
                    ) : (
                      <LogOut className="h-4 w-4 text-orange-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">
                      {r.employeeName}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {r.siteName} · {fmtTime(r.timestamp)}
                    </p>
                  </div>
                  {r.mockLocation && (
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  )}
                </div>
              ))}
              {records.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">
                  No records for this period
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══ RECORDS TAB ══ */}
      {activeTab === "records" && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name or site..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select
              value={filterDate}
              onValueChange={(v) => setFilterDate(v)}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filterCompany}
              onValueChange={(v) => setFilterCompany(v)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filterStatus}
              onValueChange={(v) => setFilterStatus(v)}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="IN">Check In</SelectItem>
                <SelectItem value="OUT">Check Out</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border bg-white shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead>Date &amp; Time</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Distance</TableHead>
                  <TableHead>GPS Accuracy</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Flags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-8 text-gray-500"
                    >
                      Loading records...
                    </TableCell>
                  </TableRow>
                ) : filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-8 text-gray-400"
                    >
                      No attendance records found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((r) => (
                    <TableRow
                      key={r.id}
                      className={r.mockLocation ? "bg-red-50" : ""}
                    >
                      <TableCell className="text-xs">
                        <div className="font-semibold">
                          {fmtDate(r.timestamp)}
                        </div>
                        <div className="text-gray-400">
                          {fmtTime(r.timestamp)}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {r.employeeName}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.siteName || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`text-[10px] gap-1 ${
                            r.status === "IN"
                              ? "bg-green-100 text-green-700 border-green-200"
                              : "bg-orange-100 text-orange-700 border-orange-200"
                          } border`}
                        >
                          {r.status === "IN" ? (
                            <LogIn className="h-3 w-3" />
                          ) : (
                            <LogOut className="h-3 w-3" />
                          )}
                          {r.status === "IN" ? "Check In" : "Check Out"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {fmtDist(r.distance || 0)}
                      </TableCell>
                      <TableCell className="text-xs">
                        ±{Math.round(r.accuracy || 0)}m
                      </TableCell>
                      <TableCell className="text-xs text-gray-400 font-mono">
                        <div className="flex items-center gap-1">
                          <Smartphone className="h-3 w-3" />
                          {r.deviceId?.substring(0, 10)}…
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {r.mockLocation && (
                            <Badge
                              variant="destructive"
                              className="text-[10px] gap-1"
                            >
                              <AlertTriangle className="h-2.5 w-2.5" /> Mock GPS
                            </Badge>
                          )}
                          {r.validated && (
                            <Badge className="text-[10px] gap-1 bg-green-100 text-green-700 border-green-200 border">
                              <Shield className="h-2.5 w-2.5" /> Verified
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ══ LOCATIONS TAB ══ */}
      {activeTab === "locations" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">
              {geoEnabledCount} of {cafeterias.length} cafeterias have locations
              set
            </p>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => {
                setEditCafeteria(null)
                setLocationModalOpen(true)
              }}
            >
              <MapPin className="h-4 w-4 mr-1" /> Set Location
            </Button>
          </div>

          {/* Map Overview */}
          <CafeteriaLocationsMap
            cafeterias={enrichedCafeterias}
            height="400px"
            onCafeteriaClick={(cafe) => {
              setEditCafeteria(cafe)
              setLocationModalOpen(true)
            }}
          />

          {/* Cafeteria Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {enrichedCafeterias.map((cafe) => {
              const hasGeo =
                cafe.latitude != null && cafe.longitude != null
              return (
                <Card
                  key={cafe.id}
                  className={`shadow-sm border-l-4 ${
                    hasGeo
                      ? "border-l-green-500"
                      : "border-l-amber-400 opacity-80"
                  }`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-8 w-8 rounded-lg ${
                            hasGeo ? "bg-green-50" : "bg-amber-50"
                          } flex items-center justify-center`}
                        >
                          <UtensilsCrossed
                            className={`h-4 w-4 ${
                              hasGeo ? "text-green-600" : "text-amber-500"
                            }`}
                          />
                        </div>
                        <div>
                          <CardTitle className="text-sm">
                            {cafe.name}
                          </CardTitle>
                          <CardDescription className="text-[10px]">
                            {cafe.companyName} · {cafe.buildingName}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge
                        variant={hasGeo ? "default" : "outline"}
                        className={`text-[10px] ${
                          hasGeo
                            ? ""
                            : "border-amber-300 text-amber-600"
                        }`}
                      >
                        {hasGeo ? "📍 Located" : "⚠️ No Location"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-3 space-y-2">
                    {hasGeo ? (
                      <div className="text-xs text-gray-500 space-y-1">
                        <p>
                          📍 {cafe.latitude!.toFixed(5)},{" "}
                          {cafe.longitude!.toFixed(5)}
                        </p>
                        <p>
                          ⭕ Radius:{" "}
                          {fmtDist(cafe.radius ?? 100)}
                        </p>
                        {cafe.shiftStart && (
                          <p>
                            ⏰ Shift: {cafe.shiftStart} –{" "}
                            {cafe.shiftEnd}
                          </p>
                        )}
                        {cafe.address && (
                          <p className="text-gray-400 truncate">
                            🏢 {cafe.address}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-amber-600">
                        No geo-fence set. Click &quot;Set Location&quot; to
                        enable attendance tracking.
                      </p>
                    )}
                    <div className="flex items-center gap-1 pt-1 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-blue-600"
                        onClick={() => {
                          setEditCafeteria(cafe)
                          setLocationModalOpen(true)
                        }}
                      >
                        <Edit2 className="h-3 w-3 mr-1" />
                        {hasGeo ? "Edit Location" : "Set Location"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
            {cafeterias.length === 0 && !loading && (
              <div className="col-span-3 text-center py-12 border-2 border-dashed rounded-lg">
                <UtensilsCrossed className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">
                  No cafeterias found
                </p>
                <p className="text-gray-400 text-sm">
                  Add cafeterias in Structure Management first
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ LIVE MONITOR TAB ══ */}
      {activeTab === "live" && (
        <LiveMonitorTab records={filteredRecords} />
      )}

      {/* ══ POLICIES TAB ══ */}
      {activeTab === "policies" && (
        <PoliciesTab companies={companies} fetchAll={fetchAll} />
      )}

      {/* ══ SHIFTS & BREAKS TAB ══ */}
      {activeTab === "shifts" && (
        <ShiftsAndBreaksTab cafeterias={enrichedCafeterias} fetchAll={fetchAll} />
      )}

      {/* ══ ALERTS TAB ══ */}
      {activeTab === "alerts" && (
        <div className="bg-white rounded-lg p-8 text-center border">
            <Bell className="h-12 w-12 text-blue-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-800">Alerts & Notifications</h2>
            <p className="text-gray-500 max-w-md mx-auto mt-2">Monitor over-break limits, unauthorized exits, and battery low alerts.</p>
        </div>
      )}

      {/* Location Modal */}
      <CafeteriaLocationModal
        open={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        onSaved={fetchAll}
        companies={companies}
        buildings={buildings}
        cafeterias={cafeterias}
        editCafeteria={editCafeteria}
      />
    </div>
  )
}
