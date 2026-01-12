"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Trash2, ChevronDown, ChevronRight, Building2, Calendar, Settings, Search } from 'lucide-react'
import {
  companiesService,
  buildingsService,
  servicesService,
  subServicesService,
  structureAssignmentsService,
  mealPlanStructureAssignmentsService,
} from "@/lib/services"
import type { Service, SubService } from "@/lib/types"
import { toast } from "@/hooks/use-toast"

// Firestore direct functions (used because structureAssignmentsService.add wasn't available)
import { addDoc, updateDoc, doc, collection } from "firebase/firestore"
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
  
  // Search states
  const [companySearch, setCompanySearch] = useState("")
  const [buildingSearch, setBuildingSearch] = useState("")

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

      // Sort companies alphabetically by name
      const sortedCompanies = companiesData
        .filter((c) => c.status === "active")
        .sort((a, b) => a.name.localeCompare(b.name))
      
      // Sort buildings alphabetically by name
      const sortedBuildings = buildingsData
        .filter((b) => b.status === "active")
        .sort((a, b) => a.name.localeCompare(b.name))

      setCompanies(sortedCompanies)
      setBuildings(sortedBuildings)
      setServices(servicesData.filter((s) => s.status === "active"))
      setSubServices(subServicesData.filter((s) => s.status === "active"))
    } catch (error) {
      console.error("Error loading data:", error)
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Initialize empty structure for all days
  useEffect(() => {
    const initialStructure: DayStructure = {}
    daysOfWeek.forEach((day) => {
      initialStructure[day.key] = []
    })
    setWeekStructure(initialStructure)
  }, [])

  useEffect(() => {
    if (selectedCompany) {
      setSelectedBuilding("")
    }
  }, [selectedCompany])

  useEffect(() => {
    if (selectedCompany && selectedBuilding) {
      loadExistingStructure()
    }
  }, [selectedCompany, selectedBuilding])

  const loadExistingStructure = async () => {
    try {
      const structures = await structureAssignmentsService.getAll()
      const existing = structures.find(
        (s) => s.companyId === selectedCompany && s.buildingId === selectedBuilding && s.status === "active",
      )

      if (existing) {
        setExistingStructure(existing)
        // Convert the saved structure back to the component's format
        const convertedStructure: DayStructure = {}
        daysOfWeek.forEach((day) => {
          convertedStructure[day.key] =
            existing.weekStructure?.[day.key]?.map((service: any) => ({
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
        // Initialize empty structure
        const initialStructure: DayStructure = {}
        daysOfWeek.forEach((day) => {
          initialStructure[day.key] = []
        })
        setWeekStructure(initialStructure)
      }
    } catch (error) {
      console.error("Error loading existing structure:", error)
      toast({
        title: "Error",
        description: "Failed to load existing structure",
        variant: "destructive",
      })
    }
  }

  const addServiceToDay = (dayKey: string, serviceId: string) => {
    setWeekStructure((prev) => ({
      ...prev,
      [dayKey]: [
        ...prev[dayKey],
        {
          serviceId,
          subServices: [],
          expanded: true,
        },
      ],
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
            ? {
                ...service,
                subServices: [...service.subServices, { subServiceId: subService.id, rate: 0 }],
              }
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
          ? {
              ...service,
              subServices: service.subServices.filter((_, subIndex) => subIndex !== subServiceIndex),
            }
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
    setExpandedDays((prev) => ({
      ...prev,
      [dayKey]: !prev[dayKey],
    }))
  }

  const getServiceName = (serviceId: string) => {
    return services.find((s) => s.id === serviceId)?.name || "Unknown Service"
  }

  const getSubServiceName = (subServiceId: string) => {
    return subServices.find((sub) => sub.id === subServiceId)?.name || "Unknown Sub Service"
  }

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
    return buildings
      .filter((building) => building.companyId === selectedCompany)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  // Filter companies based on search term
  const getFilteredCompanies = () => {
    if (!companySearch) return companies
    return companies.filter(company => 
      company.name.toLowerCase().includes(companySearch.toLowerCase())
    )
  }

  // Filter buildings based on search term
  const getFilteredBuildings = () => {
    const companyBuildings = getCompanyBuildings()
    if (!buildingSearch) return companyBuildings
    return companyBuildings.filter(building => 
      building.name.toLowerCase().includes(buildingSearch.toLowerCase()) ||
      (building.address && building.address.toLowerCase().includes(buildingSearch.toLowerCase()))
    )
  }

  const handleSaveStructure = async () => {
    if (!selectedCompany || !selectedBuilding) {
      toast({
        title: "Error",
        description: "Please select both company and building",
        variant: "destructive",
      })
      return
    }

    try {
      setSaving(true)

      // Convert the week structure to the format expected by Firestore
      const structureToSave: any = {}

      daysOfWeek.forEach((day) => {
        structureToSave[day.key] =
          weekStructure[day.key]?.map((service) => ({
            serviceId: service.serviceId,
            serviceName: getServiceName(service.serviceId),
            subServices: service.subServices.map((sub) => ({
              subServiceId: sub.subServiceId,
              subServiceName: getSubServiceName(sub.subServiceId),
              rate: sub.rate,
            })),
          })) || []
      })

      const selectedCompanyData = companies.find((c) => c.id === selectedCompany)
      const selectedBuildingData = buildings.find((b) => b.id === selectedBuilding)

      const structureData = {
        companyId: selectedCompany,
        buildingId: selectedBuilding,
        companyName: selectedCompanyData?.name,
        buildingName: selectedBuildingData?.name,
        weekStructure: structureToSave,
        status: "active",
      }

      if (existingStructure && existingStructure.id) {
        // Update existing structure using Firestore directly (to avoid missing wrapper methods)
        await updateDoc(doc(db, "structureAssignments", existingStructure.id), {
          ...structureData,
          updatedAt: new Date(),
        })
        toast({
          title: "Success",
          description: "Structure updated successfully!",
        })
      } else {
        // Create new structure doc using Firestore directly
        await addDoc(collection(db, "structureAssignments"), {
          ...structureData,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        toast({
          title: "Success",
          description: "Structure saved successfully!",
        })
      }

      // Reload the structure to get the latest data
      await loadExistingStructure()
    } catch (error) {
      console.error("Error saving structure:", error)
      toast({
        title: "Error",
        description: "Failed to save structure. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const copyDayToAllDays = (sourceDayKey: string) => {
    const sourceStructure = weekStructure[sourceDayKey]
    if (!sourceStructure || sourceStructure.length === 0) {
      toast({
        title: "No Structure to Copy",
        description: "The selected day has no services configured.",
        variant: "destructive",
      })
      return
    }

    // Deep clone the source structure to avoid reference issues
    const clonedStructure = sourceStructure.map((service) => ({
      ...service,
      subServices: service.subServices.map((subService) => ({ ...subService })),
      expanded: false, // Collapse copied services by default
    }))

    setWeekStructure((prev) => {
      const newStructure = { ...prev }
      daysOfWeek.forEach((day) => {
        if (day.key !== sourceDayKey) {
          newStructure[day.key] = clonedStructure
        }
      })
      return newStructure
    })

    toast({
      title: "Structure Copied",
      description: `${sourceDayKey.charAt(0).toUpperCase() + sourceDayKey.slice(1)}'s structure has been copied to all other days.`,
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading data...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Structure Assignment</h1>
        <p className="text-gray-600">Assign services and sub-services to buildings by day of the week</p>
      </div>

      {/* Company and Building Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company & Building Selection
          </CardTitle>
          <CardDescription>Select the company and building to configure the service structure</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Select 
                value={selectedCompany} 
                onValueChange={(value) => {
                  setSelectedCompany(value)
                  setCompanySearch("") // Clear search when company is selected
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <div className="sticky top-0 z-10 bg-background p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search companies..."
                        className="pl-8"
                        value={companySearch}
                        onChange={(e) => setCompanySearch(e.target.value)}
                        onMouseDown={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  {getFilteredCompanies().map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                  {getFilteredCompanies().length === 0 && (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      No companies found
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="building">Building</Label>
              <Select 
                value={selectedBuilding} 
                onValueChange={(value) => {
                  setSelectedBuilding(value)
                  setBuildingSearch("") // Clear search when building is selected
                }} 
                disabled={!selectedCompany}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a building" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <div className="sticky top-0 z-10 bg-background p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search buildings..."
                        className="pl-8"
                        value={buildingSearch}
                        onChange={(e) => setBuildingSearch(e.target.value)}
                        onMouseDown={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  {getFilteredBuildings().map((building) => (
                    <SelectItem key={building.id} value={building.id}>
                      {building.name} {building.address && `- ${building.address}`}
                    </SelectItem>
                  ))}
                  {getFilteredBuildings().length === 0 && (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      {buildingSearch ? "No buildings found" : "No buildings available"}
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Structure Configuration */}
      {selectedCompany && selectedBuilding && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Weekly Service Structure
            </CardTitle>
            <CardDescription>Configure services and sub-services for each day of the week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {daysOfWeek.map((day) => (
                <div key={day.key} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <button
                      onClick={() => toggleDayExpansion(day.key)}
                      className="flex items-center gap-2 text-lg font-semibold hover:text-blue-600 transition-colors"
                    >
                      {expandedDays[day.key] ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      {day.fullName}
                      <Badge variant="secondary" className="ml-2">
                        {weekStructure[day.key]?.length || 0} services
                      </Badge>
                    </button>

                    <div className="flex items-center gap-2">
                      {weekStructure[day.key]?.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyDayToAllDays(day.key)}
                          className="text-xs"
                        >
                          Copy to All Days
                        </Button>
                      )}

                      {expandedDays[day.key] && (
                        <Select onValueChange={(serviceId) => addServiceToDay(day.key, serviceId)}>
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Add service" />
                          </SelectTrigger>
                          <SelectContent>
                            {getAvailableServices(day.key).map((service) => (
                              <SelectItem key={service.id} value={service.id}>
                                {service.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>

                  {expandedDays[day.key] && (
                    <div className="space-y-3">
                      {weekStructure[day.key]?.map((serviceAssignment, serviceIndex) => (
                        <div key={serviceIndex} className="bg-gray-50 rounded-lg p-3 ml-4">
                          <div className="flex items-center justify-between mb-2">
                            <button
                              onClick={() => toggleServiceExpansion(day.key, serviceIndex)}
                              className="flex items-center gap-2 font-medium hover:text-blue-600 transition-colors"
                            >
                              {serviceAssignment.expanded ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                              <Settings className="h-4 w-4" />
                              {getServiceName(serviceAssignment.serviceId)}
                              <Badge variant="outline" className="ml-2">
                                {serviceAssignment.subServices.length} sub-services
                              </Badge>
                            </button>

                            <div className="flex items-center gap-2">
                              {serviceAssignment.expanded && (
                                <Select
                                  onValueChange={(subServiceId) =>
                                    addSubServiceToService(day.key, serviceIndex, subServiceId)
                                  }
                                >
                                  <SelectTrigger className="w-40">
                                    <SelectValue placeholder="Add sub-service" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {getAvailableSubServices(day.key, serviceIndex).map((subService) => (
                                      <SelectItem key={subService.id} value={subService.id}>
                                        {subService.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => removeServiceFromDay(day.key, serviceIndex)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          {serviceAssignment.expanded && (
                            <div className="space-y-2 ml-6">
                              {serviceAssignment.subServices.map((subService, subServiceIndex) => (
                                <div key={subServiceIndex} className="flex items-center gap-3 bg-white rounded p-2">
                                  <span className="flex-1 text-sm">{getSubServiceName(subService.subServiceId)}</span>
                                  <div className="flex items-center gap-2">
                                    <Label
                                      htmlFor={`rate-${day.key}-${serviceIndex}-${subServiceIndex}`}
                                      className="text-xs"
                                    >
                                      Rate:
                                    </Label>
                                    <Input
                                      id={`rate-${day.key}-${serviceIndex}-${subServiceIndex}`}
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={subService.rate}
                                      onChange={(e) =>
                                        updateSubServiceRate(
                                          day.key,
                                          serviceIndex,
                                          subServiceIndex,
                                          Number.parseFloat(e.target.value) || 0,
                                        )
                                      }
                                      className="w-20 text-sm"
                                    />
                                    <span className="text-xs text-gray-500">$</span>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => removeSubService(day.key, serviceIndex, subServiceIndex)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
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
            </div>

            <div className="flex justify-end mt-6">
              <Button onClick={handleSaveStructure} className="px-8" disabled={saving}>
                {saving ? "Saving..." : existingStructure ? "Update Structure Assignment" : "Save Structure Assignment"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}