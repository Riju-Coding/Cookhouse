"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronDown, ChevronRight, Copy, X } from 'lucide-react'
import { toast } from "@/hooks/use-toast"
import {
  companiesService,
  buildingsService,
  servicesService,
  mealPlansService,
  subMealPlansService,
  mealPlanStructureAssignmentsService,
  structureAssignmentsService,
  type Company,
  type Building,
  type Service,
  type SubService,
  type MealPlan,
  type SubMealPlan,
  type MealPlanStructureAssignment,
} from "@/lib/services"
import { collection, addDoc, updateDoc, doc } from "firebase/firestore"
import { db } from "@/lib/firebase"

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

interface MealPlanStructureData {
  mealPlanId: string
  mealPlanName?: string
  subMealPlans: {
    subMealPlanId: string
    subMealPlanName?: string
  }[]
}

interface SubServiceStructure {
  subServiceId: string
  subServiceName?: string
  mealPlans: MealPlanStructureData[]
}

interface ServiceStructure {
  serviceId: string
  serviceName?: string
  subServices: SubServiceStructure[]
}

type WeeklyStructure = {
  [key: string]: ServiceStructure[]
}

export default function MealPlanStructurePage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [subServices, setSubServices] = useState<SubService[]>([])
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([])
  const [subMealPlans, setSubMealPlans] = useState<SubMealPlan[]>([])

  const [selectedCompany, setSelectedCompany] = useState<string>("")
  const [selectedBuilding, setSelectedBuilding] = useState<string>("")
  const [weeklyStructure, setWeeklyStructure] = useState<WeeklyStructure>({})
  const [loading, setLoading] = useState(false)

  const [expandedMealPlans, setExpandedMealPlans] = useState<Set<string>>(new Set())
  const [selectedDaysMultiple, setSelectedDaysMultiple] = useState<Set<string>>(new Set())
  const [selectedServicesForBatch, setSelectedServicesForBatch] = useState<Set<string>>(new Set())
  const [selectedSubServicesForBatch, setSelectedSubServicesForBatch] = useState<Map<string, Set<string>>>(new Map())
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set())
  const [selectedMealPlansForBatch, setSelectedMealPlansForBatch] = useState<Set<string>>(new Set())
  const [selectedSubMealPlansForBatch, setSelectedSubMealPlansForBatch] = useState<Map<string, Set<string>>>(new Map())
  const [copyFromBuilding, setCopyFromBuilding] = useState<string>("")
  const [buildingServices, setBuildingServices] = useState<ServiceStructure[]>([])

  // Fetch all data on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [companiesData, servicesData, mealPlansData, subMealPlansData] = await Promise.all([
          companiesService.getAll(),
          servicesService.getAll(),
          mealPlansService.getAll(),
          subMealPlansService.getAll(),
        ])

        setCompanies(companiesData.filter((c) => c.status === "active"))
        setServices(servicesData.filter((s) => s.status === "active"))
        setMealPlans(mealPlansData.filter((mp) => mp.status === "active"))
        setSubMealPlans(subMealPlansData.filter((smp) => smp.status === "active"))
      } catch (error) {
        console.error("Error fetching data:", error)
        toast({
          title: "Error",
          description: "Failed to fetch data",
          variant: "destructive",
        })
      }
    }

    fetchData()
  }, [])

  // Fetch buildings when company changes
  useEffect(() => {
    const fetchBuildings = async () => {
      if (selectedCompany) {
        try {
          const buildingsData = await buildingsService.getAll()
          const filteredBuildings = buildingsData.filter(
            (b) => b.companyId === selectedCompany && b.status === "active",
          )
          setBuildings(filteredBuildings)
        } catch (error) {
          console.error("Error fetching buildings:", error)
        }
      } else {
        setBuildings([])
      }
    }

    fetchBuildings()
  }, [selectedCompany])

  // Load existing structure and get building-specific services
  useEffect(() => {
    const loadExistingStructure = async () => {
      if (selectedCompany && selectedBuilding) {
        try {
          const structureAssignments = await structureAssignmentsService.getAll()
          const structureAssignment = structureAssignments.find(
            (s) => s.companyId === selectedCompany && s.buildingId === selectedBuilding && s.status === "active",
          )

          // Build available services for this building
          const availableServices: ServiceStructure[] = []
          if (structureAssignment) {
            DAYS.forEach((day) => {
              const dayServices = structureAssignment.weekStructure[day] || []
              dayServices.forEach((service) => {
                const existing = availableServices.find((s) => s.serviceId === service.serviceId)
                if (!existing) {
                  const serviceData = services.find((s) => s.id === service.serviceId)
                  availableServices.push({
                    serviceId: service.serviceId,
                    serviceName: serviceData?.name || "Unknown Service",
                    subServices: (service as any).subServices || [],
                  })
                }
              })
            })
          }
          setBuildingServices(availableServices)

          // Load existing meal plan structure
          const mealPlanStructures = await mealPlanStructureAssignmentsService.getAll()
          const existingMealPlanStructure = mealPlanStructures.find(
            (s) => s.companyId === selectedCompany && s.buildingId === selectedBuilding,
          )

          if (existingMealPlanStructure) {
            setWeeklyStructure(existingMealPlanStructure.weekStructure || {})
          } else if (structureAssignment) {
            // Auto-populate from structure assignment
            const autoPopulatedStructure: WeeklyStructure = {}

            DAYS.forEach((day) => {
              const dayServices = structureAssignment.weekStructure[day] || []
              autoPopulatedStructure[day] = dayServices.map((service) => ({
                serviceId: service.serviceId,
                serviceName: service.serviceName,
                subServices:
                  (service as any).subServices?.map((subSvc: any) => ({
                    subServiceId: subSvc.subServiceId,
                    subServiceName: subSvc.subServiceName,
                    mealPlans: [],
                  })) || [],
              }))
            })

            setWeeklyStructure(autoPopulatedStructure)
          } else {
            setWeeklyStructure({})
          }

          // Reset batch selections
          setSelectedDaysMultiple(new Set())
          setSelectedMealPlansForBatch(new Set())
          setSelectedSubMealPlansForBatch(new Map())
          setExpandedMealPlans(new Set())
          setSelectedServicesForBatch(new Set())
          setSelectedSubServicesForBatch(new Map())
          setExpandedServices(new Set())
        } catch (error) {
          console.error("Error loading existing structure:", error)
        }
      }
    }

    loadExistingStructure()
  }, [selectedCompany, selectedBuilding, services])

  const toggleMealPlanExpanded = (mealPlanId: string) => {
    const updated = new Set(expandedMealPlans)
    if (updated.has(mealPlanId)) {
      updated.delete(mealPlanId)
    } else {
      updated.add(mealPlanId)
    }
    setExpandedMealPlans(updated)
  }

  const toggleServiceExpanded = (serviceId: string) => {
    const updated = new Set(expandedServices)
    if (updated.has(serviceId)) {
      updated.delete(serviceId)
    } else {
      updated.add(serviceId)
    }
    setExpandedServices(updated)
  }

  const toggleServiceBatch = (serviceId: string, checked: boolean) => {
    const updated = new Set(selectedServicesForBatch)
    if (checked) {
      updated.add(serviceId)
      if (!selectedSubServicesForBatch.has(serviceId)) {
        selectedSubServicesForBatch.set(serviceId, new Set())
      }
    } else {
      updated.delete(serviceId)
      selectedSubServicesForBatch.delete(serviceId)
    }
    setSelectedServicesForBatch(updated)
  }

  const toggleSubServiceBatch = (serviceId: string, subServiceId: string, checked: boolean) => {
    const updated = new Map(selectedSubServicesForBatch)
    if (!updated.has(serviceId)) {
      updated.set(serviceId, new Set())
    }

    const subServices = updated.get(serviceId)!
    if (checked) {
      subServices.add(subServiceId)
    } else {
      subServices.delete(subServiceId)
    }

    setSelectedSubServicesForBatch(updated)
  }

  const toggleMealPlanBatch = (mealPlanId: string, checked: boolean) => {
    const updated = new Set(selectedMealPlansForBatch)
    if (checked) {
      updated.add(mealPlanId)
      if (!selectedSubMealPlansForBatch.has(mealPlanId)) {
        selectedSubMealPlansForBatch.set(mealPlanId, new Set())
      }
    } else {
      updated.delete(mealPlanId)
      selectedSubMealPlansForBatch.delete(mealPlanId)
    }
    setSelectedMealPlansForBatch(updated)
  }

  const toggleSubMealPlanBatch = (mealPlanId: string, subMealPlanId: string, checked: boolean) => {
    const updated = new Map(selectedSubMealPlansForBatch)
    if (!updated.has(mealPlanId)) {
      updated.set(mealPlanId, new Set())
    }

    const subMeals = updated.get(mealPlanId)!
    if (checked) {
      subMeals.add(subMealPlanId)
    } else {
      subMeals.delete(subMealPlanId)
    }

    setSelectedSubMealPlansForBatch(updated)
  }

  const toggleDayMultiple = (day: string, checked: boolean) => {
    const updated = new Set(selectedDaysMultiple)
    if (checked) {
      updated.add(day)
    } else {
      updated.delete(day)
    }
    setSelectedDaysMultiple(updated)
  }

  const getFilteredSubMealPlans = (mealPlanId: string) => {
    return subMealPlans.filter((smp) => smp.mealPlanId === mealPlanId)
  }

  const assignBatchMealPlans = () => {
    if (selectedMealPlansForBatch.size === 0) {
      toast({
        title: "No Meal Plans Selected",
        description: "Please select at least one meal plan",
        variant: "destructive",
      })
      return
    }

    if (selectedDaysMultiple.size === 0) {
      toast({
        title: "No Days Selected",
        description: "Please select at least one day",
        variant: "destructive",
      })
      return
    }

    if (selectedServicesForBatch.size === 0) {
      toast({
        title: "No Services Selected",
        description: "Please select at least one service",
        variant: "destructive",
      })
      return
    }

    console.log("[v0] assignBatchMealPlans started")
    console.log("[v0] Selected days:", Array.from(selectedDaysMultiple))
    console.log("[v0] Selected services:", Array.from(selectedServicesForBatch))
    console.log("[v0] Selected meal plans:", Array.from(selectedMealPlansForBatch))
    console.log("[v0] Current weeklyStructure:", JSON.stringify(weeklyStructure, null, 2))

    setWeeklyStructure((prev) => {
      const updated = { ...prev }

      Array.from(selectedDaysMultiple).forEach((day) => {
        console.log(`[v0] Processing day: ${day}`)
        console.log(`[v0] Services in day BEFORE: ${updated[day]?.length || 0}`)

        if (!updated[day]) {
          updated[day] = []
        }

        updated[day] = updated[day].map((service) => {
          const shouldProcessService = selectedServicesForBatch.has(service.serviceId)
          console.log(
            `[v0] Service ${service.serviceName} (${service.serviceId}) - shouldProcess: ${shouldProcessService}`,
          )

          if (!shouldProcessService) {
            console.log(`[v0] Skipping service ${service.serviceName}`)
            return service
          }

          return {
            ...service,
            subServices: service.subServices.map((subService) => {
              const subServicesForThisService = selectedSubServicesForBatch.get(service.serviceId) || new Set()
              const shouldProcessSubService =
                subServicesForThisService.size === 0 || subServicesForThisService.has(subService.subServiceId)

              console.log(
                `[v0] SubService ${subService.subServiceName} (${subService.subServiceId}) - shouldProcess: ${shouldProcessSubService}`,
              )

              if (!shouldProcessSubService) {
                return subService
              }

              const newMealPlans: MealPlanStructureData[] = [...subService.mealPlans]
              console.log(`[v0] Current meal plans for ${subService.subServiceName}: ${newMealPlans.length}`)

              Array.from(selectedMealPlansForBatch).forEach((mealPlanId) => {
                const existingMealPlan = newMealPlans.find((mp) => mp.mealPlanId === mealPlanId)
                const subMealsForThisPlan = selectedSubMealPlansForBatch.get(mealPlanId) || new Set()

                console.log(
                  `[v0] Processing meal plan ${mealPlanId} - exists: ${!!existingMealPlan}, subMeals: ${subMealsForThisPlan.size}`,
                )

                if (existingMealPlan) {
                  const existingSubMealIds = new Set(existingMealPlan.subMealPlans.map((smp) => smp.subMealPlanId))
                  Array.from(subMealsForThisPlan).forEach((subMealPlanId) => {
                    if (!existingSubMealIds.has(subMealPlanId)) {
                      const subMealPlan = subMealPlans.find((smp) => smp.id === subMealPlanId)
                      existingMealPlan.subMealPlans.push({
                        subMealPlanId,
                        subMealPlanName: subMealPlan?.name || "",
                      })
                      console.log(`[v0] Added sub meal plan to existing meal plan`)
                    }
                  })
                } else {
                  const mealPlan = mealPlans.find((mp) => mp.id === mealPlanId)
                  newMealPlans.push({
                    mealPlanId,
                    mealPlanName: mealPlan?.name || "",
                    subMealPlans: Array.from(subMealsForThisPlan).map((subMealPlanId) => {
                      const subMealPlan = subMealPlans.find((smp) => smp.id === subMealPlanId)
                      return {
                        subMealPlanId,
                        subMealPlanName: subMealPlan?.name || "",
                      }
                    }),
                  })
                  console.log(`[v0] Created new meal plan entry`)
                }
              })

              console.log(`[v0] Final meal plans for ${subService.subServiceName}: ${newMealPlans.length}`)

              return {
                ...subService,
                mealPlans: newMealPlans,
              }
            }),
          }
        })

        const existingServiceIds = new Set(updated[day].map((s) => s.serviceId))
        Array.from(selectedServicesForBatch).forEach((serviceId) => {
          if (!existingServiceIds.has(serviceId)) {
            console.log(`[v0] Creating NEW service: ${serviceId}`)
            const buildingService = buildingServices.find((s) => s.serviceId === serviceId)

            if (buildingService) {
              const subServicesForThisService = selectedSubServicesForBatch.get(serviceId) || new Set()

              const newSubServices = buildingService.subServices
                .filter(
                  (subSvc) =>
                    subServicesForThisService.size === 0 || subServicesForThisService.has(subSvc.subServiceId),
                )
                .map((subSvc) => {
                  const newMealPlans = Array.from(selectedMealPlansForBatch).map((mealPlanId) => {
                    const mealPlan = mealPlans.find((mp) => mp.id === mealPlanId)
                    const subMealsForThisPlan = selectedSubMealPlansForBatch.get(mealPlanId) || new Set()

                    return {
                      mealPlanId,
                      mealPlanName: mealPlan?.name || "",
                      subMealPlans: Array.from(subMealsForThisPlan).map((subMealPlanId) => {
                        const subMealPlan = subMealPlans.find((smp) => smp.id === subMealPlanId)
                        return {
                          subMealPlanId,
                          subMealPlanName: subMealPlan?.name || "",
                        }
                      }),
                    }
                  })

                  return {
                    subServiceId: subSvc.subServiceId,
                    subServiceName: subSvc.subServiceName,
                    mealPlans: newMealPlans,
                  }
                })

              updated[day].push({
                serviceId,
                serviceName: buildingService.serviceName,
                subServices: newSubServices,
              })

              console.log(`[v0] Added new service to day`)
            }
          }
        })

        console.log(`[v0] Services in day AFTER: ${updated[day].length}`)
      })

      console.log("[v0] Final updated structure:", JSON.stringify(updated, null, 2))
      return updated
    })

    toast({
      title: "Success",
      description: `Assigned ${selectedMealPlansForBatch.size} meal plan(s) to ${selectedDaysMultiple.size} day(s)`,
    })

    setSelectedDaysMultiple(new Set())
    setSelectedServicesForBatch(new Set())
    setSelectedSubServicesForBatch(new Map())
    setSelectedMealPlansForBatch(new Set())
    setSelectedSubMealPlansForBatch(new Map())
  }

  const copyStructureToBuilding = async () => {
    if (!copyFromBuilding) {
      toast({
        title: "Select Target Building",
        description: "Please select a building to copy to",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const company = companies.find((c) => c.id === selectedCompany)
      const targetBuilding = buildings.find((b) => b.id === copyFromBuilding)

      const structureData: Omit<MealPlanStructureAssignment, "id" | "createdAt" | "updatedAt"> = {
        companyId: selectedCompany,
        buildingId: copyFromBuilding,
        companyName: company?.name || "",
        buildingName: targetBuilding?.name || "",
        weekStructure: JSON.parse(JSON.stringify(weeklyStructure)),
        status: "active",
      }

      const existingStructures = await mealPlanStructureAssignmentsService.getAll()
      const existingStructure = existingStructures.find(
        (s) => s.companyId === selectedCompany && s.buildingId === copyFromBuilding,
      )

      if (existingStructure) {
        // prefer service update if available, otherwise direct updateDoc
        try {
          if (typeof mealPlanStructureAssignmentsService.update === "function") {
            await mealPlanStructureAssignmentsService.update(existingStructure.id, structureData)
          } else {
            await updateDoc(doc(db, "mealPlanStructureAssignments", existingStructure.id), {
              ...structureData,
              updatedAt: new Date(),
            })
          }
        } catch (e) {
          // fallback direct update
          await updateDoc(doc(db, "mealPlanStructureAssignments", existingStructure.id), {
            ...structureData,
            updatedAt: new Date(),
          })
        }
      } else {
        // prefer service add if available, otherwise direct addDoc
        try {
          if (typeof mealPlanStructureAssignmentsService.add === "function") {
            await mealPlanStructureAssignmentsService.add(structureData)
          } else {
            await addDoc(collection(db, "mealPlanStructureAssignments"), {
              ...structureData,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
          }
        } catch (e) {
          // fallback direct add
          await addDoc(collection(db, "mealPlanStructureAssignments"), {
            ...structureData,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        }
      }

      toast({
        title: "Success",
        description: `Structure copied to ${targetBuilding?.name}`,
      })
      setCopyFromBuilding("")
    } catch (error) {
      console.error("Error copying structure:", error)
      toast({
        title: "Error",
        description: "Failed to copy structure",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const removeMealPlan = (day: string, serviceIndex: number, subServiceIndex: number, mealPlanIndex: number) => {
    setWeeklyStructure((prev) => ({
      ...prev,
      [day]:
        prev[day]?.map((service, index) =>
          index === serviceIndex
            ? {
                ...service,
                subServices: service.subServices.map((subSvc, subIndex) =>
                  subIndex === subServiceIndex
                    ? {
                        ...subSvc,
                        mealPlans: subSvc.mealPlans.filter((_, mpIndex) => mpIndex !== mealPlanIndex),
                      }
                    : subSvc,
                ),
              }
            : service,
        ) || [],
    }))
  }

  const deleteAllAssignments = () => {
    if (selectedDaysMultiple.size === 0) {
      toast({
        title: "No Days Selected",
        description: "Please select at least one day to delete",
        variant: "destructive",
      })
      return
    }

    const daysToDelete = Array.from(selectedDaysMultiple).join(", ")
    if (confirm(`Are you sure you want to delete all assignments for: ${daysToDelete}?`)) {
      setWeeklyStructure((prev) => {
        const updated = { ...prev }
        Array.from(selectedDaysMultiple).forEach((day) => {
          updated[day] =
            updated[day]?.map((service) => ({
              ...service,
              subServices: service.subServices.map((subService) => ({
                ...subService,
                mealPlans: [],
              })),
            })) || []
        })
        return updated
      })

      toast({
        title: "Success",
        description: `All assignments deleted for ${selectedDaysMultiple.size} day(s)`,
      })
    }
  }

  const handleSaveStructure = async () => {
    if (!selectedCompany || !selectedBuilding) {
      toast({
        title: "Missing Selection",
        description: "Please select both company and building",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const company = companies.find((c) => c.id === selectedCompany)
      const building = buildings.find((b) => b.id === selectedBuilding)

      const structureData: Omit<MealPlanStructureAssignment, "id" | "createdAt" | "updatedAt"> = {
        companyId: selectedCompany,
        buildingId: selectedBuilding,
        companyName: company?.name || "",
        buildingName: building?.name || "",
        weekStructure: weeklyStructure,
        status: "active",
      }

      const existingStructures = await mealPlanStructureAssignmentsService.getAll()
      const existingStructure = existingStructures.find(
        (s) => s.companyId === selectedCompany && s.buildingId === selectedBuilding,
      )

      if (existingStructure) {
        // prefer service update if available, otherwise direct updateDoc
        try {
          if (typeof mealPlanStructureAssignmentsService.update === "function") {
            await mealPlanStructureAssignmentsService.update(existingStructure.id, structureData)
          } else {
            await updateDoc(doc(db, "mealPlanStructureAssignments", existingStructure.id), {
              ...structureData,
              updatedAt: new Date(),
            })
          }
        } catch (e) {
          await updateDoc(doc(db, "mealPlanStructureAssignments", existingStructure.id), {
            ...structureData,
            updatedAt: new Date(),
          })
        }

        toast({
          title: "Success",
          description: "Meal plan structure updated successfully",
        })
      } else {
        // prefer service add if available, otherwise direct addDoc
        try {
          if (typeof mealPlanStructureAssignmentsService.add === "function") {
            await mealPlanStructureAssignmentsService.add(structureData)
          } else {
            await addDoc(collection(db, "mealPlanStructureAssignments"), {
              ...structureData,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
          }
        } catch (e) {
          await addDoc(collection(db, "mealPlanStructureAssignments"), {
            ...structureData,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        }

        toast({
          title: "Success",
          description: "Meal plan structure saved successfully",
        })
      }
    } catch (error) {
      console.error("Error saving structure:", error)
      toast({
        title: "Error",
        description: "Failed to save meal plan structure",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Meal Plan Structure Assignment</h1>
        <Button onClick={handleSaveStructure} disabled={loading || !selectedCompany || !selectedBuilding}>
          {loading ? "Saving..." : "Save Structure"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Company & Building</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="building">Building</Label>
              <Select value={selectedBuilding} onValueChange={setSelectedBuilding} disabled={!selectedCompany}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a building" />
                </SelectTrigger>
                <SelectContent>
                  {buildings.map((building) => (
                    <SelectItem key={building.id} value={building.id}>
                      {building.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedCompany && selectedBuilding && (
            <div className="flex items-end gap-2 pt-4 border-t">
              <div className="flex-1 space-y-2">
                <Label>Copy Structure to Another Building</Label>
                <Select value={copyFromBuilding} onValueChange={setCopyFromBuilding}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select building to copy to" />
                  </SelectTrigger>
                  <SelectContent>
                    {buildings
                      .filter((b) => b.id !== selectedBuilding) // Don't offer copying to itself
                      .map((building) => (
                        <SelectItem key={building.id} value={building.id}>
                          {building.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={copyStructureToBuilding} disabled={loading || !copyFromBuilding} variant="outline">
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedCompany && selectedBuilding && (
        <div className="space-y-4">
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-base">Batch Assign Meal Plans to Multiple Days</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Select Days */}
              <div>
                <Label className="text-sm font-medium mb-3 block">Select Days</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {DAYS.map((day) => (
                    <div key={day} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${day}`}
                        checked={selectedDaysMultiple.has(day)}
                        onCheckedChange={(checked) => toggleDayMultiple(day, checked as boolean)}
                      />
                      <label htmlFor={`day-${day}`} className="text-sm cursor-pointer capitalize">
                        {day}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium mb-3 block">Select Services & Sub-Services</Label>
                <div className="space-y-2">
                  {buildingServices.map((service) => {
                    const isExpanded = expandedServices.has(service.serviceId)
                    const isSelected = selectedServicesForBatch.has(service.serviceId)

                    return (
                      <div key={service.serviceId} className="border rounded-lg p-3 bg-white">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            id={`svc-${service.serviceId}`}
                            checked={isSelected}
                            onCheckedChange={(checked) => toggleServiceBatch(service.serviceId, checked as boolean)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <label
                                htmlFor={`svc-${service.serviceId}`}
                                className="font-medium cursor-pointer text-sm"
                              >
                                {service.serviceName || "Unnamed Service"}
                              </label>
                              {service.subServices && service.subServices.length > 0 && isSelected && (
                                <button
                                  onClick={() => toggleServiceExpanded(service.serviceId)}
                                  className="p-0.5 hover:bg-gray-200 rounded"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </button>
                              )}
                            </div>

                            {isSelected && isExpanded && service.subServices && service.subServices.length > 0 && (
                              <div className="mt-3 pl-6 space-y-2">
                                {service.subServices.map((subService) => (
                                  <div key={subService.subServiceId} className="flex items-center gap-2">
                                    <Checkbox
                                      id={`subsvc-${subService.subServiceId}`}
                                      checked={
                                        selectedSubServicesForBatch
                                          .get(service.serviceId)
                                          ?.has(subService.subServiceId) || false
                                      }
                                      onCheckedChange={(checked) =>
                                        toggleSubServiceBatch(
                                          service.serviceId,
                                          subService.subServiceId,
                                          checked as boolean,
                                        )
                                      }
                                    />
                                    <label
                                      htmlFor={`subsvc-${subService.subServiceId}`}
                                      className="text-sm cursor-pointer text-gray-700"
                                    >
                                      {subService.subServiceName || "Unnamed Sub Service"}
                                    </label>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {buildingServices.length === 0 && (
                    <div className="text-sm text-gray-500 italic">No services configured for this building</div>
                  )}
                </div>
              </div>

              {/* Select Meal Plans - Nested View */}
              <div>
                <Label className="text-sm font-medium mb-3 block">Select Meal Plans & Sub-Meal Plans</Label>
                <div className="space-y-2">
                  {mealPlans.map((mp) => {
                    const filteredSubMeals = getFilteredSubMealPlans(mp.id)
                    const isExpanded = expandedMealPlans.has(mp.id)
                    const isSelected = selectedMealPlansForBatch.has(mp.id)

                    return (
                      <div key={mp.id} className="border rounded-lg p-3 bg-white">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            id={`mp-${mp.id}`}
                            checked={isSelected}
                            onCheckedChange={(checked) => toggleMealPlanBatch(mp.id, checked as boolean)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <label htmlFor={`mp-${mp.id}`} className="font-medium cursor-pointer text-sm">
                                {mp.name}
                              </label>
                              {filteredSubMeals.length > 0 && isSelected && (
                                <button
                                  onClick={() => toggleMealPlanExpanded(mp.id)}
                                  className="p-0.5 hover:bg-gray-200 rounded"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </button>
                              )}
                            </div>

                            {isSelected && isExpanded && filteredSubMeals.length > 0 && (
                              <div className="mt-3 pl-6 space-y-2">
                                {filteredSubMeals.map((smp) => (
                                  <div key={smp.id} className="flex items-center gap-2">
                                    <Checkbox
                                      id={`smp-${smp.id}`}
                                      checked={selectedSubMealPlansForBatch.get(mp.id)?.has(smp.id) || false}
                                      onCheckedChange={(checked) =>
                                        toggleSubMealPlanBatch(mp.id, smp.id, checked as boolean)
                                      }
                                    />
                                    <label htmlFor={`smp-${smp.id}`} className="text-sm cursor-pointer text-gray-700">
                                      {smp.name}
                                    </label>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-2 flex-wrap">
                <Button
                  onClick={assignBatchMealPlans}
                  disabled={
                    selectedMealPlansForBatch.size === 0 ||
                    selectedDaysMultiple.size === 0 ||
                    selectedServicesForBatch.size === 0
                  }
                >
                  Assign to Selected Days
                </Button>
                <Button variant="destructive" onClick={deleteAllAssignments} disabled={selectedDaysMultiple.size === 0}>
                  Delete All for Selected Days
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedDaysMultiple(new Set())
                    setSelectedServicesForBatch(new Set())
                    setSelectedSubServicesForBatch(new Map())
                    setSelectedMealPlansForBatch(new Set())
                    setSelectedSubMealPlansForBatch(new Map())
                    setExpandedServices(new Set())
                    setExpandedMealPlans(new Set())
                  }}
                >
                  Clear Selection
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Display weekly structure */}
          {DAYS.map((day) => (
            <Card key={day}>
              <CardHeader>
                <CardTitle className="capitalize text-lg">{day}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {weeklyStructure[day]?.length > 0 ? (
                  weeklyStructure[day].map((service, serviceIndex) => (
                    <div key={serviceIndex} className="border rounded-lg p-4 space-y-3">
                      {/* Service name */}
                      <div className="font-semibold text-sm text-gray-700">
                        {service.serviceName || "Unnamed Service"}
                      </div>

                      {/* Sub-services and meal plans */}
                      <div className="space-y-3 pl-4 border-l-2 border-gray-300">
                        {service.subServices.map((subService, subServiceIndex) => (
                          <div key={subServiceIndex} className="space-y-2">
                            <div className="font-medium text-sm text-gray-600">
                              {subService.subServiceName || "Unnamed Sub Service"}
                            </div>

                            {/* Meal plans for this sub-service */}
                            {subService.mealPlans.length > 0 ? (
                              <div className="space-y-1">
                                {subService.mealPlans.map((mp, mpIndex) => (
                                  <div
                                    key={mpIndex}
                                    className="bg-green-100 rounded-lg p-3 flex items-start justify-between group hover:bg-green-200 transition"
                                  >
                                    <div className="flex-1">
                                      <div className="font-medium text-sm text-gray-800">{mp.mealPlanName}</div>
                                      {mp.subMealPlans.length > 0 && (
                                        <div className="text-xs text-gray-600 mt-1">
                                          Sub-plans: {mp.subMealPlans.map((smp) => smp.subMealPlanName).join(", ")}
                                        </div>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => removeMealPlan(day, serviceIndex, subServiceIndex, mpIndex)}
                                      className="opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                                      title="Remove meal plan"
                                    >
                                      <X className="h-4 w-4 text-red-600" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs text-gray-400 italic">No meal plans assigned</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">No services configured for {day}</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
