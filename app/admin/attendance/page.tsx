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

import ExcelJS from "exceljs"
import { saveAs } from "file-saver"

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
      setShiftStart((editCafeteria as any).shiftStart ?? "09:00")
      setShiftEnd((editCafeteria as any).shiftEnd ?? "18:00")
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
        setShiftStart((cafe as any).shiftStart ?? "09:00")
        setShiftEnd((cafe as any).shiftEnd ?? "18:00")
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
  const [filterDate, setFilterDate] = useState("all")

  // Location modal
  const [locationModalOpen, setLocationModalOpen] = useState(false)
  const [editCafeteria, setEditCafeteria] = useState<Cafeteria | null>(null)
  const [locationFilter, setLocationFilter] = useState("all")

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

      // Load recent attendance records (sorted by timestamp descending)
      // Note: We fetch recent records and perform filtering client-side
      // to avoid Firestore composite index errors on compound queries.
      const rSnap = await getDocs(
        query(collection(db, "attendance"), orderBy("timestamp", "desc"), limit(500))
      )
      setRecords(
        rSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as AttendanceRecord[]
      )
    } catch (e: any) {
      console.error("Failed to fetch attendance data:", e)
      toast({
        title: "Error",
        description: e.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [])

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

  // Filtered records (client-side filtering for search, company, status, and date range)
  const filteredRecords = useMemo(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const weekStart = now.getTime() - 7 * 24 * 60 * 60 * 1000
    const monthStart = now.getTime() - 30 * 24 * 60 * 60 * 1000

    return records.filter((r) => {
      // Search filter
      if (search) {
        const query = search.toLowerCase()
        const matchesEmployee = r.employeeName?.toLowerCase().includes(query)
        const matchesSite = r.siteName?.toLowerCase().includes(query)
        if (!matchesEmployee && !matchesSite) return false
      }

      // Company filter
      if (filterCompany !== "all" && r.companyId !== filterCompany) {
        return false
      }

      // Status filter
      if (filterStatus !== "all" && r.status !== filterStatus) {
        return false
      }

      // Date filter
      if (filterDate !== "all") {
        const rTime = r.timestamp?.toDate
          ? r.timestamp.toDate().getTime()
          : r.timestamp
          ? new Date(r.timestamp).getTime()
          : 0

        if (filterDate === "today" && rTime < todayStart) return false
        if (filterDate === "week" && rTime < weekStart) return false
        if (filterDate === "month" && rTime < monthStart) return false
      }

      return true
    })
  }, [records, search, filterCompany, filterStatus, filterDate])

  // Stats
  const stats = useMemo(
    () => ({
      totalCheckIns: filteredRecords.filter((r) => r.status === "IN").length,
      totalCheckOuts: filteredRecords.filter((r) => r.status === "OUT").length,
      mockLocationFlags: filteredRecords.filter((r) => r.mockLocation).length,
      geoEnabledCafeterias: geoEnabledCount,
      uniqueUsers: new Set(filteredRecords.map((r) => r.userId)).size,
    }),
    [filteredRecords, geoEnabledCount]
  )

  // Export Attendance XLSX (Modern Office OpenXML format via ExcelJS)
  const exportXLSX = async () => {
    if (filteredRecords.length === 0) {
      toast({
        title: "No records to export",
        description: "There are no attendance records matching your filter.",
        variant: "destructive",
      })
      return
    }

    try {
      const workbook = new ExcelJS.Workbook()
      workbook.creator = "Cookhouse Admin"
      workbook.lastModifiedBy = "Cookhouse Admin"
      workbook.created = new Date()
      workbook.modified = new Date()

      const worksheet = workbook.addWorksheet("Attendance Records", {
        views: [{ state: "frozen", ySplit: 1 }],
      })

      // Define columns
      worksheet.columns = [
        { header: "Date", key: "date", width: 14 },
        { header: "Time", key: "time", width: 12 },
        { header: "Employee Name", key: "employee", width: 22 },
        { header: "Company", key: "company", width: 22 },
        { header: "Cafeteria / Site", key: "site", width: 24 },
        { header: "Status", key: "status", width: 14 },
        { header: "Distance", key: "distance", width: 14 },
        { header: "GPS Accuracy", key: "accuracy", width: 14 },
        { header: "Device ID", key: "device", width: 16 },
        { header: "Mock GPS Flag", key: "mock", width: 16 },
        { header: "Battery", key: "battery", width: 12 },
        { header: "Latitude", key: "latitude", width: 14 },
        { header: "Longitude", key: "longitude", width: 14 },
      ]

      // Style Header Row
      const headerRow = worksheet.getRow(1)
      headerRow.height = 28
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 }
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF15803D" }, // Forest Green (matching Cookhouse theme)
        }
        cell.alignment = { vertical: "middle", horizontal: "center" }
        cell.border = {
          top: { style: "thin", color: { argb: "FFCCCCCC" } },
          bottom: { style: "medium", color: { argb: "FF15803D" } },
          left: { style: "thin", color: { argb: "FFCCCCCC" } },
          right: { style: "thin", color: { argb: "FFCCCCCC" } },
        }
      })

      // Add Data Rows
      filteredRecords.forEach((r) => {
        const row = worksheet.addRow({
          date: fmtDate(r.timestamp),
          time: fmtTime(r.timestamp),
          employee: r.employeeName || "N/A",
          company: companies.find((c) => c.id === r.companyId)?.name ?? (r.companyId || "N/A"),
          site: r.siteName || "N/A",
          status: r.status === "IN" ? "Check In" : r.status === "OUT" ? "Check Out" : r.status,
          distance: fmtDist(r.distance),
          accuracy: `±${Math.round(r.accuracy || 0)}m`,
          device: r.deviceId?.substring(0, 12) || "N/A",
          mock: r.mockLocation ? "YES (Flagged)" : "No",
          battery: r.batteryLevel != null ? `${Math.round((r.batteryLevel ?? 0) * 100)}%` : "N/A",
          latitude: r.latitude != null ? r.latitude : "",
          longitude: r.longitude != null ? r.longitude : "",
        })

        row.height = 22
        row.eachCell((cell, colNumber) => {
          cell.alignment = {
            vertical: "middle",
            horizontal: [1, 2, 6, 10, 11].includes(colNumber)
              ? "center"
              : [7, 8, 12, 13].includes(colNumber)
              ? "right"
              : "left",
          }
          cell.border = {
            top: { style: "thin", color: { argb: "FFE5E7EB" } },
            bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
            left: { style: "thin", color: { argb: "FFE5E7EB" } },
            right: { style: "thin", color: { argb: "FFE5E7EB" } },
          }
          // Highlight Mock GPS
          if (colNumber === 10 && r.mockLocation) {
            cell.font = { bold: true, color: { argb: "FFDC2626" } }
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFEE2E2" },
            }
          }
        })
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      const fileName = `Attendance_Records_${new Date().toISOString().split("T")[0]}.xlsx`
      saveAs(blob, fileName)

      toast({
        title: "Export Successful ✅",
        description: `Exported ${filteredRecords.length} records to ${fileName}`,
      })
    } catch (err: any) {
      console.error("Attendance export error:", err)
      toast({
        title: "Export Failed",
        description: err.message || "Failed to export attendance records",
        variant: "destructive",
      })
    }
  }

  // Export Locations XLSX (Modern Office OpenXML format via ExcelJS)
  const exportLocationsXlsx = async () => {
    try {
      const workbook = new ExcelJS.Workbook()
      workbook.creator = "Cookhouse Admin"
      workbook.lastModifiedBy = "Cookhouse Admin"
      workbook.created = new Date()
      workbook.modified = new Date()

      const worksheet = workbook.addWorksheet("Cafeteria Locations", {
        views: [{ state: "frozen", ySplit: 1 }],
      })

      worksheet.columns = [
        { header: "Company", key: "company", width: 24 },
        { header: "Building", key: "building", width: 24 },
        { header: "Cafeteria", key: "cafeteria", width: 24 },
        { header: "Geo Status", key: "status", width: 16 },
        { header: "Latitude", key: "latitude", width: 14 },
        { header: "Longitude", key: "longitude", width: 14 },
        { header: "Radius", key: "radius", width: 14 },
        { header: "Shift Start", key: "shiftStart", width: 14 },
        { header: "Shift End", key: "shiftEnd", width: 14 },
        { header: "Address", key: "address", width: 36 },
      ]

      // Style Header Row
      const headerRow = worksheet.getRow(1)
      headerRow.height = 28
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 }
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF15803D" }, // Forest Green
        }
        cell.alignment = { vertical: "middle", horizontal: "center" }
        cell.border = {
          top: { style: "thin", color: { argb: "FFCCCCCC" } },
          bottom: { style: "medium", color: { argb: "FF15803D" } },
          left: { style: "thin", color: { argb: "FFCCCCCC" } },
          right: { style: "thin", color: { argb: "FFCCCCCC" } },
        }
      })

      // Add Data Rows
      enrichedCafeterias.forEach((cafe) => {
        const hasGeo = cafe.latitude != null && cafe.longitude != null
        const row = worksheet.addRow({
          company: cafe.companyName || "N/A",
          building: cafe.buildingName || "N/A",
          cafeteria: cafe.name,
          status: hasGeo ? "Configured" : "Not Set",
          latitude: cafe.latitude != null ? cafe.latitude : "",
          longitude: cafe.longitude != null ? cafe.longitude : "",
          radius: cafe.radius ? fmtDist(cafe.radius) : "100m",
          shiftStart: (cafe as any).shiftStart || "09:00",
          shiftEnd: (cafe as any).shiftEnd || "18:00",
          address: cafe.address || "",
        })

        row.height = 22
        row.eachCell((cell, colNumber) => {
          cell.alignment = {
            vertical: "middle",
            horizontal: [4, 8, 9].includes(colNumber)
              ? "center"
              : [5, 6, 7].includes(colNumber)
              ? "right"
              : "left",
          }
          cell.border = {
            top: { style: "thin", color: { argb: "FFE5E7EB" } },
            bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
            left: { style: "thin", color: { argb: "FFE5E7EB" } },
            right: { style: "thin", color: { argb: "FFE5E7EB" } },
          }
          // Status styling
          if (colNumber === 4) {
            cell.font = { bold: true, color: { argb: hasGeo ? "FF166534" : "FF9A3412" } }
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: hasGeo ? "FFDCFCE7" : "FFFFEDD5" },
            }
          }
        })
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      const fileName = `Cafeteria_Locations_${new Date().toISOString().split("T")[0]}.xlsx`
      saveAs(blob, fileName)

      toast({
        title: "Export Successful ✅",
        description: `Exported ${enrichedCafeterias.length} locations to ${fileName}`,
      })
    } catch (err: any) {
      console.error("Locations export error:", err)
      toast({
        title: "Export Failed",
        description: err.message || "Failed to export locations",
        variant: "destructive",
      })
    }
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
          <Button variant="outline" size="sm" onClick={exportXLSX}>
            <Download className="h-4 w-4 mr-1" /> Export XLSX
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
                      className="text-center py-10 text-gray-400"
                    >
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <Clock className="h-8 w-8 text-gray-300 mb-1" />
                        <p className="font-semibold text-gray-600">No attendance records found</p>
                        {filterDate === "today" ? (
                          <p className="text-xs text-gray-400 max-w-sm">
                            No check-ins have been logged for today yet. Try switching the date filter to &quot;Last 7 Days&quot; or &quot;All Time&quot; above to view historical punches.
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400 max-w-sm">
                            No records match the current filter criteria. Try changing the company or status filter.
                          </p>
                        )}
                      </div>
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
              {geoEnabledCount} of {cafeterias.length} cafeterias have locations set
            </p>
            <div className="flex items-center gap-4">
              <Button size="sm" variant="outline" onClick={exportLocationsXlsx}>
                <Download className="h-4 w-4 mr-1" /> Export XLSX
              </Button>
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  <SelectItem value="set">Location Set</SelectItem>
                  <SelectItem value="not_set">Location Not Set</SelectItem>
                </SelectContent>
              </Select>
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

          {/* Map Overview */}
          <CafeteriaLocationsMap
            cafeterias={enrichedCafeterias}
            height="400px"
            onCafeteriaClick={(cafe) => {
              setEditCafeteria(cafe)
              setLocationModalOpen(true)
            }}
          />

          {/* Cafeteria Table */}
          <div className="rounded-md border bg-white shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead>Cafeteria</TableHead>
                  <TableHead>Location Details</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrichedCafeterias
                  .filter((cafe) => {
                    const hasGeo = cafe.latitude != null && cafe.longitude != null;
                    if (locationFilter === "set") return hasGeo;
                    if (locationFilter === "not_set") return !hasGeo;
                    return true;
                  })
                  .map((cafe) => {
                    const hasGeo = cafe.latitude != null && cafe.longitude != null;
                    return (
                      <TableRow key={cafe.id}>
                        <TableCell>
                          <div className="font-semibold text-blue-600">{cafe.name}</div>
                          <div className="text-xs text-gray-500">{cafe.companyName} · {cafe.buildingName}</div>
                        </TableCell>
                        <TableCell>
                          {hasGeo ? (
                            <div className="text-xs text-gray-500">
                              <p>📍 {cafe.latitude!.toFixed(5)}, {cafe.longitude!.toFixed(5)}</p>
                              <p>⭕ Radius: {fmtDist(cafe.radius ?? 100)}</p>
                              {cafe.address && <p className="text-gray-400 truncate w-48" title={cafe.address}>🏢 {cafe.address}</p>}
                            </div>
                          ) : (
                            <span className="text-xs text-amber-600">No geo-fence set</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={hasGeo ? "default" : "secondary"}
                            className={hasGeo ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-amber-100 text-amber-800 hover:bg-amber-200"}
                          >
                            {hasGeo ? "📍 Located" : "⚠️ Not Set"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-blue-600"
                            onClick={() => {
                              setEditCafeteria(cafe)
                              setLocationModalOpen(true)
                            }}
                          >
                            {hasGeo ? <Edit2 className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                {enrichedCafeterias.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                      No cafeterias found matching the filter
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
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
