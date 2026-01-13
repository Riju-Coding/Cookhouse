"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Trash2, ChevronDown, ChevronRight, Building2, Calendar, Settings, Copy, CheckSquare, Square } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"

import {
  companiesService,
  buildingsService,
  servicesService,
  subServicesService,
  structureAssignmentsService,
} from "@/lib/services"
import type { Service, SubService } from "@/lib/types"
import { toast } from "@/hooks/use-toast"

import { addDoc, updateDoc, doc, collection, getDocs, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"

const daysOfWeek = [
  { key: "monday", label: "Mon", fullName: "Monday" },
  { key: "tuesday", label: "Tue", fullName: "Tuesday" },
  { key: "wednesday", label: "Wed", fullName: "Wednesday" },
  { key: "thursday", label: "Thu", fullName: "Thursday" },
  { key: "friday", label: "Fri", fullName: "Friday" },
  { key: "saturday", label: "Sat", fullName: "Saturday" },
  { key: "sunday", label: "Sun", fullName: "Sunday" },
]

interface SubServiceAssignment {
  subServiceId: string
  rate: number
}

interface ServiceAssignment {
  serviceId: string
  subServices: SubServiceAssignment[]
  expanded: boolean
}

interface DayStructure {
  [key: string]: ServiceAssignment[]
}

export default function StructureAssignmentPage() {
  const [companies, setCompanies] = useState<any[]>([])
  const [buildings, setBuildings] = useState<any[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [subServices, setSubServices] = useState<SubService[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [existingStructure, setExistingStructure] = useState<any | null>(null)

  const [selectedCompany, setSelectedCompany] = useState<string>("")
  const [selectedBuilding, setSelectedBuilding] = useState<string>("")
  const [weekStructure, setWeekStructure] = useState<DayStructure>({})
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({})

  // State for Bulk Copy
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false)
  const [selectedTargetBuildings, setSelectedTargetBuildings] = useState<string[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [companiesData, buildingsData, servicesData, subServicesData] = await Promise.all([
        companiesService.getAll(),
        buildingsService.getAll(),
        servicesService.getAll(),
        subServicesService.getAll(),
      ])

      setCompanies(companiesData.filter((c) => c.status === "active"))
      setBuildings(buildingsData.filter((b) => b.status === "active"))
      setServices(servicesData.filter((s) => s.status === "active"))
      setSubServices(subServicesData.filter((s) => s.status === "active"))
    } catch (error) {
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const initialStructure: DayStructure = {}
    daysOfWeek.forEach((day) => { initialStructure[day.key] = [] })
    setWeekStructure(initialStructure)
  }, [])

  useEffect(() => {
    if (selectedCompany && selectedBuilding) loadExistingStructure()
  }, [selectedCompany, selectedBuilding])

  const loadExistingStructure = async () => {
    try {
      const structures = await structureAssignmentsService.getAll()
      const existing = structures.find(
        (s) => s.companyId === selectedCompany && s.buildingId === selectedBuilding && s.status === "active",
      )

      if (existing) {
        setExistingStructure(existing)
        const convertedStructure: DayStructure = {}
        daysOfWeek.forEach((day) => {
          convertedStructure[day.key] = existing.weekStructure?.[day.key]?.map((service: any) => ({
            serviceId: service.serviceId,
            subServices: (service.subServices || []).map((sub: any) => ({
              subServiceId: sub.subServiceId,
              rate: sub.rate,
            })),
            expanded: false,
          })) || []
        })
        setWeekStructure(convertedStructure)
      } else {
        setExistingStructure(null)
        const initialStructure: DayStructure = {}
        daysOfWeek.forEach((day) => { initialStructure[day.key] = [] })
        setWeekStructure(initialStructure)
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to load existing structure", variant: "destructive" })
    }
  }

  const addServiceToDay = (dayKey: string, serviceId: string) => {
    setWeekStructure((prev) => ({
      ...prev,
      [dayKey]: [...prev[dayKey], { serviceId, subServices: [], expanded: true }],
    }))
  }

  const removeServiceFromDay = (dayKey: string, serviceIndex: number) => {
    setWeekStructure((prev) => ({
      ...prev,
      [dayKey]: prev[dayKey].filter((_, index) => index !== serviceIndex),
    }))
  }

  const toggleServiceExpansion = (dayKey: string, serviceIndex: number) => {
    setWeekStructure((prev) => ({
      ...prev,
      [dayKey]: prev[dayKey].map((service, index) =>
        index === serviceIndex ? { ...service, expanded: !service.expanded } : service,
      ),
    }))
  }

  const addSubServiceToService = (dayKey: string, serviceIndex: number, subServiceId: string) => {
    const subService = subServices.find((sub) => sub.id === subServiceId)
    if (subService) {
      setWeekStructure((prev) => ({
        ...prev,
        [dayKey]: prev[dayKey].map((service, index) =>
          index === serviceIndex
            ? { ...service, subServices: [...service.subServices, { subServiceId: subService.id, rate: 0 }] }
            : service,
        ),
      }))
    }
  }

  const removeSubService = (dayKey: string, serviceIndex: number, subServiceIndex: number) => {
    setWeekStructure((prev) => ({
      ...prev,
      [dayKey]: prev[dayKey].map((service, index) =>
        index === serviceIndex
          ? { ...service, subServices: service.subServices.filter((_, subIndex) => subIndex !== subServiceIndex) }
          : service,
      ),
    }))
  }

  const updateSubServiceRate = (dayKey: string, serviceIndex: number, subServiceIndex: number, rate: number) => {
    setWeekStructure((prev) => ({
      ...prev,
      [dayKey]: prev[dayKey].map((service, index) =>
        index === serviceIndex
          ? {
              ...service,
              subServices: service.subServices.map((subService, subIndex) =>
                subIndex === subServiceIndex ? { ...subService, rate } : subService,
              ),
            }
          : service,
      ),
    }))
  }

  const toggleDayExpansion = (dayKey: string) => {
    setExpandedDays((prev) => ({ ...prev, [dayKey]: !prev[dayKey] }))
  }

  const getServiceName = (serviceId: string) => services.find((s) => s.id === serviceId)?.name || "Unknown Service"
  const getSubServiceName = (subServiceId: string) => subServices.find((sub) => sub.id === subServiceId)?.name || "Unknown Sub Service"

  const getAvailableServices = (dayKey: string) => {
    const usedServiceIds = weekStructure[dayKey]?.map((s) => s.serviceId) || []
    return services.filter((service) => !usedServiceIds.includes(service.id))
  }

  const getAvailableSubServices = (dayKey: string, serviceIndex: number) => {
    const service = weekStructure[dayKey]?.[serviceIndex]
    if (!service) return []
    const usedSubServiceIds = service.subServices.map((sub) => sub.subServiceId)
    return subServices.filter((sub) => sub.serviceId === service.serviceId && !usedSubServiceIds.includes(sub.id))
  }

  const getCompanyBuildings = () => {
    if (!selectedCompany) return []
    return buildings.filter((building) => building.companyId === selectedCompany)
  }

  // Helper to format the UI state into the DB schema
  const prepareStructureData = () => {
    const structureToSave: any = {}
    daysOfWeek.forEach((day) => {
      structureToSave[day.key] = weekStructure[day.key]?.map((service) => ({
        serviceId: service.serviceId,
        serviceName: getServiceName(service.serviceId),
        subServices: service.subServices.map((sub) => ({
          subServiceId: sub.subServiceId,
          subServiceName: getSubServiceName(sub.subServiceId),
          rate: sub.rate,
        })),
      })) || []
    })
    return structureToSave
  }

  const handleSaveStructure = async () => {
    if (!selectedCompany || !selectedBuilding) {
      toast({ title: "Error", description: "Please select both company and building", variant: "destructive" })
      return
    }

    try {
      setSaving(true)
      const structureToSave = prepareStructureData()
      const selectedCompanyData = companies.find((c) => c.id === selectedCompany)
      const selectedBuildingData = buildings.find((b) => b.id === selectedBuilding)

      const structureData = {
        companyId: selectedCompany,
        buildingId: selectedBuilding,
        companyName: selectedCompanyData?.name,
        buildingName: selectedBuildingData?.name,
        weekStructure: structureToSave,
        status: "active",
        updatedAt: new Date()
      }

      if (existingStructure?.id) {
        await updateDoc(doc(db, "structureAssignments", existingStructure.id), structureData)
        toast({ title: "Success", description: "Structure updated successfully!" })
      } else {
        await addDoc(collection(db, "structureAssignments"), { ...structureData, createdAt: new Date() })
        toast({ title: "Success", description: "Structure saved successfully!" })
      }
      await loadExistingStructure()
    } catch (error) {
      toast({ title: "Error", description: "Failed to save structure", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleCopyToBuildings = async () => {
    if (selectedTargetBuildings.length === 0) {
      toast({ title: "No buildings selected", variant: "destructive" })
      return
    }

    try {
      setSaving(true)
      const structureToSave = prepareStructureData()
      const selectedCompanyData = companies.find((c) => c.id === selectedCompany)

      // Use Promise.all to run operations in parallel
      await Promise.all(selectedTargetBuildings.map(async (targetBuildingId) => {
        const targetBuildingData = buildings.find((b) => b.id === targetBuildingId)
        
        const q = query(
          collection(db, "structureAssignments"),
          where("buildingId", "==", targetBuildingId),
          where("status", "==", "active")
        )
        const querySnapshot = await getDocs(q)
        
        const structureData = {
          companyId: selectedCompany,
          buildingId: targetBuildingId,
          companyName: selectedCompanyData?.name,
          buildingName: targetBuildingData?.name,
          weekStructure: structureToSave,
          status: "active",
          updatedAt: new Date()
        }

        if (!querySnapshot.empty) {
          const existingDocId = querySnapshot.docs[0].id
          return updateDoc(doc(db, "structureAssignments", existingDocId), structureData)
        } else {
          return addDoc(collection(db, "structureAssignments"), { ...structureData, createdAt: new Date() })
        }
      }))

      toast({
        title: "Bulk Copy Successful",
        description: `Structure copied to ${selectedTargetBuildings.length} buildings.`,
      })
      setIsCopyDialogOpen(false)
      setSelectedTargetBuildings([])
    } catch (error) {
      toast({ title: "Error", description: "Failed to copy structures", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const toggleSelectAll = () => {
    const otherBuildings = getCompanyBuildings().filter(b => b.id !== selectedBuilding)
    if (selectedTargetBuildings.length === otherBuildings.length) {
      setSelectedTargetBuildings([])
    } else {
      setSelectedTargetBuildings(otherBuildings.map(b => b.id))
    }
  }

  const copyDayToAllDays = (sourceDayKey: string) => {
    const sourceStructure = weekStructure[sourceDayKey]
    if (!sourceStructure || sourceStructure.length === 0) return
    
    const clonedStructure = sourceStructure.map((service) => ({
      ...service,
      subServices: service.subServices.map((subService) => ({ ...subService })),
      expanded: false,
    }))

    setWeekStructure((prev) => {
      const newStructure = { ...prev }
      daysOfWeek.forEach((day) => { if (day.key !== sourceDayKey) newStructure[day.key] = clonedStructure })
      return newStructure
    })
    toast({ title: "Structure Copied", description: "Applied current day settings to the whole week." })
  }

  if (loading) return <div className="flex items-center justify-center h-64">Loading data...</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Structure Assignment</h1>
          <p className="text-gray-600">Configure weekly service schedules for each building</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 text-primary" />
            Location
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Company</Label>
            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
              <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
              <SelectContent>
                {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Building</Label>
            <Select value={selectedBuilding} onValueChange={setSelectedBuilding} disabled={!selectedCompany}>
              <SelectTrigger><SelectValue placeholder="Select building" /></SelectTrigger>
              <SelectContent>
                {getCompanyBuildings().map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedCompany && selectedBuilding && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-primary" />
              Weekly Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {daysOfWeek.map((day) => (
              <div key={day.key} className="border rounded-lg overflow-hidden bg-white">
                <div className="flex items-center justify-between p-3 bg-gray-50/50 border-b">
                  <button onClick={() => toggleDayExpansion(day.key)} className="flex items-center gap-2 font-semibold">
                    {expandedDays[day.key] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    {day.fullName}
                    <Badge variant="outline" className="ml-2 font-normal">{weekStructure[day.key]?.length || 0} Services</Badge>
                  </button>
                  <div className="flex items-center gap-2">
                    {weekStructure[day.key]?.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => copyDayToAllDays(day.key)} className="text-xs h-8">
                        <Copy className="h-3 w-3 mr-1" /> Copy to all days
                      </Button>
                    )}
                    <Select onValueChange={(serviceId) => addServiceToDay(day.key, serviceId)}>
                      <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Add Service" /></SelectTrigger>
                      <SelectContent>
                        {getAvailableServices(day.key).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {expandedDays[day.key] && (
                  <div className="p-4 space-y-3">
                    {weekStructure[day.key]?.length === 0 && <p className="text-sm text-gray-400 italic text-center py-2">No services assigned for this day</p>}
                    {weekStructure[day.key]?.map((serviceAssignment, sIdx) => (
                      <div key={sIdx} className="border rounded-md p-3 bg-white shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <button onClick={() => toggleServiceExpansion(day.key, sIdx)} className="flex items-center gap-2 font-medium text-sm">
                            {serviceAssignment.expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            {getServiceName(serviceAssignment.serviceId)}
                          </button>
                          <div className="flex items-center gap-2">
                            <Select onValueChange={(subId) => addSubServiceToService(day.key, sIdx, subId)}>
                              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Add Sub-service" /></SelectTrigger>
                              <SelectContent>
                                {getAvailableSubServices(day.key, sIdx).map((sub) => <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Button variant="ghost" size="sm" onClick={() => removeServiceFromDay(day.key, sIdx)} className="text-destructive h-8 w-8 p-0"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                        {serviceAssignment.expanded && (
                          <div className="space-y-2 pl-4 border-l-2 border-gray-100 ml-1">
                            {serviceAssignment.subServices.map((sub, subIdx) => (
                              <div key={subIdx} className="flex items-center gap-4 bg-gray-50/50 p-2 rounded">
                                <span className="flex-1 text-sm">{getSubServiceName(sub.subServiceId)}</span>
                                <div className="flex items-center gap-2">
                                  <Label className="text-xs text-gray-500">Rate ($)</Label>
                                  <Input type="number" step="0.01" value={sub.rate} onChange={(e) => updateSubServiceRate(day.key, sIdx, subIdx, parseFloat(e.target.value) || 0)} className="w-24 h-8" />
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => removeSubService(day.key, sIdx, subIdx)} className="h-8 w-8 p-0 text-gray-400 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div className="flex items-center justify-between pt-6 border-t mt-6">
              <Dialog open={isCopyDialogOpen} onOpenChange={setIsCopyDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Copy className="h-4 w-4" />
                    Copy to Other Buildings
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[450px]">
                  <DialogHeader>
                    <DialogTitle>Copy Schedule Structure</DialogTitle>
                    <DialogDescription>
                      This will apply the current weekly schedule to the selected buildings. Existing active structures for those buildings will be updated.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="py-4">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b">
                       <span className="text-sm font-semibold">Select Buildings</span>
                       <Button variant="ghost" size="sm" onClick={toggleSelectAll} className="text-xs h-7">
                         {selectedTargetBuildings.length === getCompanyBuildings().filter(b => b.id !== selectedBuilding).length 
                           ? <span className="flex items-center gap-1"><CheckSquare className="h-3 w-3" /> Deselect All</span>
                           : <span className="flex items-center gap-1"><Square className="h-3 w-3" /> Select All</span>
                         }
                       </Button>
                    </div>

                    <ScrollArea className="h-[250px] pr-4">
                      <div className="space-y-3">
                        {getCompanyBuildings()
                          .filter((b) => b.id !== selectedBuilding)
                          .map((building) => (
                            <div key={building.id} className="flex items-center space-x-3 p-2 rounded hover:bg-gray-50 transition-colors">
                              <Checkbox 
                                id={`copy-${building.id}`} 
                                checked={selectedTargetBuildings.includes(building.id)}
                                onCheckedChange={(checked) => {
                                  setSelectedTargetBuildings(prev => 
                                    checked ? [...prev, building.id] : prev.filter(id => id !== building.id)
                                  )
                                }}
                              />
                              <Label htmlFor={`copy-${building.id}`} className="text-sm cursor-pointer flex-1">
                                {building.name}
                              </Label>
                            </div>
                          ))}
                        {getCompanyBuildings().length <= 1 && (
                          <div className="text-center py-8 text-gray-500 text-sm italic">No other buildings available for this company.</div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>

                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsCopyDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleCopyToBuildings} disabled={saving || selectedTargetBuildings.length === 0}>
                      {saving ? "Processing..." : `Copy to ${selectedTargetBuildings.length} Building(s)`}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button onClick={handleSaveStructure} className="min-w-[200px]" disabled={saving}>
                {saving ? "Saving..." : existingStructure ? "Update Current Schedule" : "Save Schedule"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}