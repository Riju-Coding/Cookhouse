"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import {
  ChevronDown,
  Building2,
  Save,
  Loader2,
  Maximize2,
  X,
  AlertCircle,
  Copy,
  ClipboardPaste,
  Search,
  Download,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import {
  companiesService,
  buildingsService,
  servicesService,
  subServicesService,
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
import { Input } from "@/components/ui/input"

// --- Types ---

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

interface BaseSubService {
  subServiceId: string
  rate: number
}
interface BaseService {
  serviceId: string
  subServices: BaseSubService[]
}

// --- Main Component ---

export default function MealPlanStructurePage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [subServices, setSubServices] = useState<SubService[]>([])
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([])
  const [subMealPlans, setSubMealPlans] = useState<SubMealPlan[]>([])

  const [selectedCompany, setSelectedCompany] = useState<string>("")
  const [selectedBuilding, setSelectedBuilding] = useState<string>("")

  const [companySearch, setCompanySearch] = useState("")
  const [buildingSearch, setBuildingSearch] = useState("")

  const [baseStructure, setBaseStructure] = useState<Record<string, BaseService[]>>({})
  const [weeklyStructure, setWeeklyStructure] = useState<WeeklyStructure>({})

  const [clipboard, setClipboard] = useState<MealPlanStructureData[] | null>(null)

  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false)
  const [selectedTargetBuildings, setSelectedTargetBuildings] = useState<string[]>([])
  const [copyLoading, setCopyLoading] = useState(false)

  const [loading, setLoading] = useState(false)
  const [isDataLoading, setIsDataLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsDataLoading(true)
        const [companiesData, servicesData, subServicesData, mealPlansData, subMealPlansData] = await Promise.all([
          companiesService.getAll(),
          servicesService.getAll(),
          subServicesService.getAll(),
          mealPlansService.getAll(),
          subMealPlansService.getAll(),
        ])

        const sortedCompanies = companiesData
          .filter((c) => !c.status || c.status === "active")
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""))

        setCompanies(sortedCompanies)
        setServices(servicesData.filter((s) => !s.status || s.status === "active"))
        setSubServices(subServicesData.filter((s) => !s.status || s.status === "active"))

        const sortedMealPlans = mealPlansData
          .filter((mp) => !mp.status || mp.status === "active")
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""))

        setMealPlans(sortedMealPlans)

        const sortedSubMealPlans = subMealPlansData
          .filter((smp) => !smp.status || smp.status === "active")
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""))

        setSubMealPlans(sortedSubMealPlans)
      } catch (error) {
        console.error("Error fetching data:", error)
        toast({ title: "Error", description: "Failed to load initial data", variant: "destructive" })
      } finally {
        setIsDataLoading(false)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    const fetchBuildings = async () => {
      if (selectedCompany) {
        try {
          const buildingsData = await buildingsService.getAll()
          const sortedBuildings = buildingsData
            .filter((b) => b.companyId === selectedCompany && (!b.status || b.status === "active"))
            .sort((a, b) => (a.name || "").localeCompare(b.name || ""))

          setBuildings(sortedBuildings)
        } catch (error) {
          console.error("Error fetching buildings:", error)
        }
      } else {
        setBuildings([])
      }
    }
    fetchBuildings()
  }, [selectedCompany])

  useEffect(() => {
    const loadStructures = async () => {
      if (selectedCompany && selectedBuilding) {
        setLoading(true)
        try {
          const structureAssignments = await structureAssignmentsService.getAll()
          const baseAssignment = structureAssignments.find(
            (s) => s.companyId === selectedCompany && s.buildingId === selectedBuilding && s.status === "active",
          )

          const mealPlanAssignments = await mealPlanStructureAssignmentsService.getAll()
          const existingMealPlanAssignment = mealPlanAssignments.find(
            (s) => s.companyId === selectedCompany && s.buildingId === selectedBuilding,
          )

          if (baseAssignment) {
            setBaseStructure(baseAssignment.weekStructure || {})
          } else {
            setBaseStructure({})
            toast({
              title: "No Base Structure",
              description: "Please configure 'Structure Assignment' first.",
              variant: "destructive",
            })
          }

          if (existingMealPlanAssignment) {
            setWeeklyStructure(existingMealPlanAssignment.weekStructure || {})
          } else {
            setWeeklyStructure({})
          }
        } catch (error) {
          console.error("Error loading structures:", error)
        } finally {
          setLoading(false)
        }
      }
    }

    loadStructures()
  }, [selectedCompany, selectedBuilding])

  const getServiceName = (id: string) => services.find((s) => s.id === id)?.name || "Unknown Service"
  const getSubServiceName = (id: string) => subServices.find((s) => s.id === id)?.name || "Unknown Sub Service"

  const matrixRows = useMemo(() => {
    const serviceMap = new Map<string, { serviceId: string; subServices: Set<string> }>()

    Object.values(baseStructure).forEach((dayServices) => {
      dayServices.forEach((svc) => {
        if (!serviceMap.has(svc.serviceId)) {
          serviceMap.set(svc.serviceId, { serviceId: svc.serviceId, subServices: new Set() })
        }
        const entry = serviceMap.get(svc.serviceId)!
        svc.subServices.forEach((sub) => entry.subServices.add(sub.subServiceId))
      })
    })

    return Array.from(serviceMap.values()).map((svc) => ({
      serviceId: svc.serviceId,
      serviceName: getServiceName(svc.serviceId),
      subServices: Array.from(svc.subServices).map((subId) => ({
        subServiceId: subId,
        subServiceName: getSubServiceName(subId),
      })),
    }))
  }, [baseStructure, services, subServices])

  const updateMealPlansForSubService = (
    day: string,
    serviceId: string,
    subServiceId: string,
    newMealPlans: MealPlanStructureData[],
  ) => {
    setWeeklyStructure((prev) => {
      const dayServices = prev[day] ? [...prev[day]] : []
      let serviceIndex = dayServices.findIndex((s) => s.serviceId === serviceId)

      if (serviceIndex === -1) {
        dayServices.push({ serviceId, serviceName: getServiceName(serviceId), subServices: [] })
        serviceIndex = dayServices.length - 1
      }

      const service = { ...dayServices[serviceIndex] }
      const subServicesList = [...service.subServices]
      const subIndex = subServicesList.findIndex((s) => s.subServiceId === subServiceId)

      if (subIndex === -1) {
        subServicesList.push({
          subServiceId,
          subServiceName: getSubServiceName(subServiceId),
          mealPlans: newMealPlans,
        })
      } else {
        subServicesList[subIndex] = { ...subServicesList[subIndex], mealPlans: newMealPlans }
      }

      service.subServices = subServicesList
      dayServices[serviceIndex] = service
      return { ...prev, [day]: dayServices }
    })
  }

  const handleCopy = (data: MealPlanStructureData[]) => {
    setClipboard(JSON.parse(JSON.stringify(data)))
    toast({ title: "Copied!", description: "Select other cells to paste." })
  }

  const handlePaste = (day: string, serviceId: string, subServiceId: string) => {
    if (clipboard) {
      updateMealPlansForSubService(day, serviceId, subServiceId, clipboard)
      toast({ title: "Pasted!", duration: 1000 })
    }
  }

  const getFilteredCompanies = () => {
    if (!companySearch) return companies
    return companies.filter((company) => (company.name || "").toLowerCase().includes(companySearch.toLowerCase()))
  }

  const getFilteredBuildings = () => {
    if (!buildingSearch) return buildings
    return buildings.filter(
      (building) =>
        (building.name || "").toLowerCase().includes(buildingSearch.toLowerCase()) ||
        (building.address && building.address.toLowerCase().includes(buildingSearch.toLowerCase())),
    )
  }

  const handleSaveStructure = async () => {
    if (!selectedCompany || !selectedBuilding) return

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
        await updateDoc(doc(db, "mealPlanStructureAssignments", existingStructure.id), {
          ...structureData,
          updatedAt: new Date(),
        })
      } else {
        await addDoc(collection(db, "mealPlanStructureAssignments"), {
          ...structureData,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }
      toast({ title: "Success", description: "Structure saved successfully" })
      setIsModalOpen(false)
      setClipboard(null)
    } catch (error) {
      console.error("Error saving:", error)
      toast({ title: "Error", description: "Failed to save", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleCopyStructureToBuildings = async () => {
    if (selectedTargetBuildings.length === 0) {
      toast({ title: "No selection", description: "Please select at least one building.", variant: "destructive" })
      return
    }

    setCopyLoading(true)
    try {
      const company = companies.find((c) => c.id === selectedCompany)
      const allStructures = await mealPlanStructureAssignmentsService.getAll()

      for (const targetBuildingId of selectedTargetBuildings) {
        const targetBuilding = buildings.find((b) => b.id === targetBuildingId)

        const structureData: Omit<MealPlanStructureAssignment, "id" | "createdAt" | "updatedAt"> = {
          companyId: selectedCompany,
          buildingId: targetBuildingId,
          companyName: company?.name || "",
          buildingName: targetBuilding?.name || "",
          weekStructure: weeklyStructure,
          status: "active",
        }

        const existingStructure = allStructures.find(
          (s) => s.companyId === selectedCompany && s.buildingId === targetBuildingId,
        )

        if (existingStructure) {
          await updateDoc(doc(db, "mealPlanStructureAssignments", existingStructure.id), {
            ...structureData,
            updatedAt: new Date(),
          })
        } else {
          await addDoc(collection(db, "mealPlanStructureAssignments"), {
            ...structureData,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        }
      }

      toast({
        title: "Copy Successful",
        description: `Meal plan structure copied to ${selectedTargetBuildings.length} building(s).`,
      })
      setIsCopyModalOpen(false)
      setSelectedTargetBuildings([])
    } catch (error) {
      console.error("Error copying structure:", error)
      toast({ title: "Error", description: "Failed to copy structure to other buildings.", variant: "destructive" })
    } finally {
      setCopyLoading(false)
    }
  }

  const toggleTargetBuilding = (buildingId: string) => {
    setSelectedTargetBuildings((prev) =>
      prev.includes(buildingId) ? prev.filter((id) => id !== buildingId) : [...prev, buildingId],
    )
  }

  const handleExportAllStructures = async () => {
    setIsExporting(true)
    try {
      const XLSX = await import("xlsx")

      const allStructures = await mealPlanStructureAssignmentsService.getAll()
      const allBuildings = await buildingsService.getAll()
      const allCompaniesList = companies

      const workbook = XLSX.utils.book_new()

      const groupedByBuilding = new Map<string, MealPlanStructureAssignment>()
      allStructures.forEach((structure) => {
        const key = `${structure.companyId}-${structure.buildingId}`
        groupedByBuilding.set(key, structure)
      })

      allCompaniesList.forEach((company) => {
        const companyBuildings = allBuildings.filter(
          (b) => b.companyId === company.id && (!b.status || b.status === "active"),
        )

        companyBuildings.forEach((building) => {
          const structureKey = `${company.id}-${building.id}`
          const structure = groupedByBuilding.get(structureKey)

          if (structure && structure.weekStructure) {
            // Clean sheet name for Excel (max 31 chars)
            const safeCompanyName = company.name.substring(0, 10).replace(/[\\*?:/[\]]/g, "")
            const safeBuildingName = building.name.substring(0, 15).replace(/[\\*?:/[\]]/g, "")
            const sheetName = `${safeCompanyName} - ${safeBuildingName}`

            const sheetData: any[] = []

            // Header Section
            sheetData.push([`MEAL PLAN STRUCTURE: ${company.name}`])
            sheetData.push([`Building: ${building.name}`])
            sheetData.push([]) // spacer

            // Column Headers
            const headers = ["Service / Sub-Service / Sub-Meal Plan", ...DAYS.map((day) => day.charAt(0).toUpperCase() + day.slice(1))]
            sheetData.push(headers)

            // Extract Matrix logic for this building to identify all unique Services & Sub-Services
            const serviceMapForExcel = new Map<string, { serviceId: string; subServices: Set<string> }>()
            Object.values(structure.weekStructure).forEach((dayServices: any) => {
              if (!dayServices) return
              dayServices.forEach((svc: any) => {
                if (!serviceMapForExcel.has(svc.serviceId)) {
                  serviceMapForExcel.set(svc.serviceId, { serviceId: svc.serviceId, subServices: new Set() })
                }
                const entry = serviceMapForExcel.get(svc.serviceId)!
                svc.subServices?.forEach((sub: any) => entry.subServices.add(sub.subServiceId))
              })
            })

            // Generate rows with hierarchy
            serviceMapForExcel.forEach((svcInfo, serviceId) => {
              const serviceName = getServiceName(serviceId)
              
              // 1. ADD SERVICE GROUP HEADER (Uppercase for visibility)
              sheetData.push([serviceName.toUpperCase(), "", "", "", "", "", "", ""])

              svcInfo.subServices.forEach((subServiceId) => {
                const subServiceName = getSubServiceName(subServiceId)
                
                // 2. ADD SUB-SERVICE NAME
                sheetData.push([`   • ${subServiceName}`, "", "", "", "", "", "", ""])

                // Collect all unique Sub-Meal Plans assigned to this Sub-Service across the ENTIRE week
                const uniqueSubMealPlansInSubService = new Map<string, string>() // ID -> Name
                DAYS.forEach(day => {
                   const dayService = structure.weekStructure[day]?.find((s: any) => s.serviceId === serviceId)
                   const daySubService = dayService?.subServices?.find((ss: any) => ss.subServiceId === subServiceId)
                   daySubService?.mealPlans?.forEach((mp: any) => {
                       mp.subMealPlans?.forEach((smp: any) => {
                           uniqueSubMealPlansInSubService.set(smp.subMealPlanId, smp.subMealPlanName)
                       })
                   })
                })

                // 3. ADD ROWS FOR EACH UNIQUE SUB-MEAL PLAN
                uniqueSubMealPlansInSubService.forEach((smpName, smpId) => {
                    const rowData = [`      - ${smpName}`] // Further indented

                    DAYS.forEach((day) => {
                        const dayService = structure.weekStructure[day]?.find((s: any) => s.serviceId === serviceId)
                        const daySubService = dayService?.subServices?.find((ss: any) => ss.subServiceId === subServiceId)
                        
                        // Check if THIS specific sub meal plan exists on THIS day
                        const isAssigned = daySubService?.mealPlans?.some((mp: any) => 
                            mp.subMealPlans?.some((sub: any) => sub.subMealPlanId === smpId)
                        )

                        if (isAssigned) {
                            // User requested day name in the cell if present
                            rowData.push(day.charAt(0).toUpperCase() + day.slice(1))
                        } else {
                            rowData.push("-")
                        }
                    })
                    sheetData.push(rowData)
                })
              })
              sheetData.push([]) // Spacer after each service group
            })

            const worksheet = XLSX.utils.aoa_to_sheet(sheetData)
            
            // Set Column Widths
            const colWidths = [{ wch: 45 }, ...DAYS.map(() => ({ wch: 15 }))]
            worksheet["!cols"] = colWidths

            XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
          }
        })
      })

      const timestamp = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(workbook, `Meal_Plan_Structures_${timestamp}.xlsx`)

      toast({ title: "Export Successful", description: `Data exported successfully.` })
    } catch (error) {
      console.error("Export Error:", error)
      toast({ title: "Error", description: "Failed to export data", variant: "destructive" })
    } finally {
      setIsExporting(false)
    }
  }

  if (isDataLoading)
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meal Plan Structure</h1>
          <p className="text-gray-500">Configure meal plans for building services</p>
        </div>
        <Button
          onClick={handleExportAllStructures}
          disabled={isExporting || companies.length === 0}
          variant="secondary"
          className="gap-2"
        >
          {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {isExporting ? "Exporting..." : "Export All"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Configuration
          </CardTitle>
          <CardDescription>Select a building to configure its meal plan structure.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Company</Label>
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Company" />
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
                  {getFilteredCompanies().map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                  {getFilteredCompanies().length === 0 && (
                    <div className="py-6 text-center text-sm text-muted-foreground">No companies found</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Building</Label>
              <Select
                value={selectedBuilding}
                onValueChange={(value) => {
                  setSelectedBuilding(value)
                  setBuildingSearch("")
                }}
                disabled={!selectedCompany}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Building" />
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
                  {getFilteredBuildings().map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
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

          <div className="pt-4 flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedTargetBuildings([])
                setIsCopyModalOpen(true)
              }}
              disabled={!selectedCompany || !selectedBuilding || matrixRows.length === 0}
              className="w-full sm:w-auto"
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy to Other Buildings
            </Button>

            <Button
              onClick={() => setIsModalOpen(true)}
              disabled={!selectedCompany || !selectedBuilding || matrixRows.length === 0}
              className="w-full sm:w-auto"
            >
              <Maximize2 className="mr-2 h-4 w-4" />
              Open Full Screen Editor
            </Button>
          </div>
        </CardContent>
      </Card>

      {!selectedCompany || !selectedBuilding ? null : matrixRows.length === 0 ? (
        <div className="text-center p-8 border-2 border-dashed rounded-lg text-gray-400">
          No services configured in Structure Assignment. Please configure that first.
        </div>
      ) : (
        <div className="text-center text-sm text-gray-500">
          Editor ready. Click "Open Full Screen Editor" to configure meal plans.
        </div>
      )}

      {/* --- COPY TO BUILDINGS DIALOG --- */}
      <Dialog open={isCopyModalOpen} onOpenChange={setIsCopyModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Copy Meal Plan Structure</DialogTitle>
            <DialogDescription>
              Copy the configuration from <strong>{buildings.find((b) => b.id === selectedBuilding)?.name}</strong> to
              other buildings in this company.
              <br />
              <span className="text-yellow-600 font-medium text-xs mt-2 block">
                Warning: This will overwrite existing meal plans in the selected buildings.
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="flex items-center justify-between mb-2">
              <Label>Select Target Buildings:</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => {
                  const otherBuildings = buildings.filter((b) => b.id !== selectedBuilding).map((b) => b.id)
                  if (selectedTargetBuildings.length === otherBuildings.length) {
                    setSelectedTargetBuildings([])
                  } else {
                    setSelectedTargetBuildings(otherBuildings)
                  }
                }}
              >
                Toggle All
              </Button>
            </div>

            <ScrollArea className="h-[200px] border rounded-md p-3">
              <div className="space-y-3">
                {buildings.filter((b) => b.id !== selectedBuilding).length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-8">No other buildings available.</p>
                )}
                {buildings
                  .filter((b) => b.id !== selectedBuilding)
                  .map((building) => (
                    <div key={building.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`target-${building.id}`}
                        checked={selectedTargetBuildings.includes(building.id)}
                        onCheckedChange={() => toggleTargetBuilding(building.id)}
                      />
                      <label
                        htmlFor={`target-${building.id}`}
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        {building.name}
                      </label>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCopyModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCopyStructureToBuildings}
              disabled={copyLoading || selectedTargetBuildings.length === 0}
            >
              {copyLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              Confirm Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- FULL SCREEN MODAL --- */}
      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open)
          if (!open) setClipboard(null)
        }}
      >
        <DialogContent className="!max-w-none !w-[100vw] !h-[100vh] !max-h-[100vh] !rounded-none !border-none !m-0 !p-0 flex flex-col bg-white shadow-none focus-visible:outline-none gap-0 !top-0 !left-0 !translate-x-0 !translate-y-0">
          <DialogHeader className="p-4 border-b shrink-0 flex flex-row items-center justify-between space-y-0 bg-white">
            <div>
              <DialogTitle className="text-xl">Edit Meal Plan Structure</DialogTitle>
              <DialogDescription className="mt-1">
                Assign Meal Plans to Services/Sub-Services for each day.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden relative bg-gray-50/50">
            <ScrollArea className="h-full w-full">
              <div className="min-w-[1400px] pb-20">
                <Table>
                  <TableHeader className="sticky top-0 z-30 shadow-sm bg-white">
                    <TableRow>
                      <TableHead className="w-[300px] font-bold bg-white border-r border-b text-gray-900 sticky left-0 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        Service / Sub-Service
                      </TableHead>
                      {DAYS.map((day) => (
                        <TableHead
                          key={day}
                          className="min-w-[240px] text-center capitalize font-semibold bg-white border-r border-b text-gray-900"
                        >
                          {day}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody className="bg-white">
                    {matrixRows.map((svc) => (
                      <div key={`svc-${svc.serviceId}`} className="display-contents">
                        <TableRow className="bg-blue-50 hover:bg-blue-50/80">
                          <TableCell className="font-bold text-blue-900 py-3 border-b border-r sticky left-0 bg-blue-50 z-20">
                            {svc.serviceName}
                          </TableCell>
                          <TableCell colSpan={7} className="border-b bg-blue-50/30"></TableCell>
                        </TableRow>

                        {svc.subServices.map((subSvc) => (
                          <TableRow key={`${svc.serviceId}-${subSvc.subServiceId}`} className="hover:bg-gray-50">
                            <TableCell className="font-medium text-gray-600 border-r border-b pl-8 sticky left-0 bg-white z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                              {subSvc.subServiceName}
                            </TableCell>

                            {DAYS.map((day) => {
                              const isAvailable = baseStructure[day]?.some(
                                (s) =>
                                  s.serviceId === svc.serviceId &&
                                  s.subServices.some((ss) => ss.subServiceId === subSvc.subServiceId),
                              )

                              if (!isAvailable) {
                                return (
                                  <TableCell
                                    key={day}
                                    className="bg-gray-100/50 border-r border-b text-center align-middle"
                                  >
                                    <span className="text-gray-300 text-xs italic select-none">N/A</span>
                                  </TableCell>
                                )
                              }

                              const currentService = weeklyStructure[day]?.find((s) => s.serviceId === svc.serviceId)
                              const currentSub = currentService?.subServices.find(
                                (ss) => ss.subServiceId === subSvc.subServiceId,
                              )
                              const assignedMealPlans = currentSub?.mealPlans || []

                              return (
                                <TableCell
                                  key={day}
                                  className={`border-r border-b p-2 align-top bg-white transition-colors ${clipboard ? "bg-blue-50/30" : ""}`}
                                >
                                  <MealPlanSelector
                                    availableMealPlans={mealPlans}
                                    availableSubMealPlans={subMealPlans}
                                    assignedMealPlans={assignedMealPlans}
                                    onUpdate={(newPlans) =>
                                      updateMealPlansForSubService(day, svc.serviceId, subSvc.subServiceId, newPlans)
                                    }
                                    clipboardMode={!!clipboard}
                                    onCopy={() => handleCopy(assignedMealPlans)}
                                    onPaste={() => handlePaste(day, svc.serviceId, subSvc.subServiceId)}
                                  />
                                </TableCell>
                              )
                            })}
                          </TableRow>
                        ))}
                      </div>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ScrollBar orientation="horizontal" />
              <ScrollBar orientation="vertical" />
            </ScrollArea>

            {clipboard && (
              <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-blue-900 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-4 z-50 animate-in slide-in-from-bottom-5">
                <div className="flex flex-col">
                  <span className="font-bold text-sm">Paste Mode Active</span>
                  <span className="text-xs text-blue-200">{clipboard.length} meal plans ready to paste</span>
                </div>
                <div className="h-8 w-[1px] bg-blue-700 mx-2"></div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setClipboard(null)}
                  className="rounded-full h-8 text-xs"
                >
                  <X className="w-3 h-3 mr-1" /> Cancel
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 border-t bg-white shrink-0 sm:justify-between">
            <div className="hidden sm:block text-sm text-gray-500 self-center">Changes are local until saved.</div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveStructure} disabled={loading} className="min-w-[120px]">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// --- SELECTOR COMPONENT ---
interface MealPlanSelectorProps {
  availableMealPlans: MealPlan[]
  availableSubMealPlans: SubMealPlan[]
  assignedMealPlans: MealPlanStructureData[]
  onUpdate: (newPlans: MealPlanStructureData[]) => void
  clipboardMode: boolean
  onCopy: () => void
  onPaste: () => void
}

function MealPlanSelector({
  availableMealPlans,
  availableSubMealPlans,
  assignedMealPlans,
  onUpdate,
  clipboardMode,
  onCopy,
  onPaste,
}: MealPlanSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const sortedMealPlans = useMemo(() => {
    return [...availableMealPlans].sort((a, b) => (a.name || "").localeCompare(b.name || ""))
  }, [availableMealPlans])

  const filteredMealPlans = useMemo(() => {
    if (!searchQuery.trim()) return sortedMealPlans
    const query = searchQuery.toLowerCase().trim()
    return sortedMealPlans.filter((mp) => {
      if (mp.name?.toLowerCase().includes(query)) return true
      const subMeals = availableSubMealPlans.filter(
        (sub) => sub.mealPlanId === mp.id && sub.name?.toLowerCase().includes(query),
      )
      return subMeals.length > 0
    })
  }, [sortedMealPlans, availableSubMealPlans, searchQuery])

  const toggleMealPlan = (mealPlanId: string, checked: boolean) => {
    let newAssignments = [...assignedMealPlans]
    if (checked) {
      if (!newAssignments.some((mp) => mp.mealPlanId === mealPlanId)) {
        const mpName = availableMealPlans.find((mp) => mp.id === mealPlanId)?.name
        newAssignments.push({ mealPlanId, mealPlanName: mpName || "", subMealPlans: [] })
      }
    } else {
      newAssignments = newAssignments.filter((mp) => mp.mealPlanId !== mealPlanId)
    }
    onUpdate(newAssignments)
  }

  const toggleSubMealPlan = (mealPlanId: string, subMealPlanId: string, checked: boolean) => {
    const newAssignments = assignedMealPlans.map((mp) => {
      if (mp.mealPlanId !== mealPlanId) return mp
      const currentSubs = [...(mp.subMealPlans || [])]
      if (checked) {
        if (!currentSubs.some((s) => s.subMealPlanId === subMealPlanId)) {
          const smpName = availableSubMealPlans.find((s) => s.id === subMealPlanId)?.name
          currentSubs.push({ subMealPlanId, subMealPlanName: smpName || "" })
        }
      } else {
        return {
          ...mp,
          subMealPlans: currentSubs.filter((s) => s.subMealPlanId !== subMealPlanId),
        }
      }
      return { ...mp, subMealPlans: currentSubs }
    })
    onUpdate(newAssignments)
  }

  const hasSelection = assignedMealPlans.length > 0

  return (
    <div className="flex flex-col gap-1.5 w-full group">
      <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) setSearchQuery(""); }}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className={`w-full justify-between text-left font-normal h-auto min-h-[40px] py-2 px-3 whitespace-normal ${hasSelection ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100" : "text-gray-500 hover:text-gray-700"}`}
          >
            <div className="flex flex-col gap-1 w-full overflow-hidden">
              {hasSelection ? (
                assignedMealPlans.map((mp, idx) => (
                  <div key={idx} className="flex flex-col text-xs font-medium border-b border-blue-100 last:border-0 pb-1 last:pb-0 mb-1 last:mb-0">
                    <span className="font-bold text-blue-900">{mp.mealPlanName}</span>
                    {mp.subMealPlans.length > 0 && (
                        <span className="text-[10px] text-blue-500 italic pl-2">
                           ↳ {mp.subMealPlans.map(s => s.subMealPlanName).join(", ")}
                        </span>
                    )}
                  </div>
                ))
              ) : (
                <span className="text-xs">Select Plans...</span>
              )}
            </div>
            <ChevronDown className="h-3 w-3 opacity-50 flex-shrink-0 ml-1" />
          </Button>
        </DialogTrigger>

        <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col z-[99999]">
          <DialogHeader>
            <DialogTitle>Select Meal Plans</DialogTitle>
            <DialogDescription>Choose meal plans and sub-plans for this service.</DialogDescription>
          </DialogHeader>

          <div className="px-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                type="search"
                placeholder="Search meal plans or sub-plans..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-hidden border rounded-md">
            <ScrollArea className="h-[400px] p-4">
              <div className="space-y-4">
                {filteredMealPlans.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-6 text-center text-gray-500 gap-2">
                    <AlertCircle className="h-8 w-8 text-yellow-500" />
                    <p className="text-sm font-medium">No Matching Meal Plans Found</p>
                  </div>
                )}
                {filteredMealPlans.map((mp) => {
                  const isSelected = assignedMealPlans.some((a) => a.mealPlanId === mp.id)
                  const currentAssignment = assignedMealPlans.find((a) => a.mealPlanId === mp.id)
                  const subMealsForPlan = availableSubMealPlans.filter((smp) => smp.mealPlanId === mp.id)

                  return (
                    <div key={mp.id} className="space-y-1">
                      <div className="flex items-center space-x-2 py-2 bg-gray-50 rounded px-2">
                        <Checkbox id={`mp-${mp.id}`} checked={isSelected} onCheckedChange={(c) => toggleMealPlan(mp.id, c as boolean)} />
                        <label htmlFor={`mp-${mp.id}`} className="text-sm font-medium cursor-pointer flex-1">{mp.name}</label>
                      </div>
                      {isSelected && subMealsForPlan.length > 0 && (
                        <div className="ml-6 space-y-1">
                          {subMealsForPlan.map((smp) => (
                            <div key={smp.id} className="flex items-center space-x-2">
                              <Checkbox id={`smp-${smp.id}`} checked={currentAssignment?.subMealPlans?.some(s => s.subMealPlanId === smp.id)} onCheckedChange={(c) => toggleSubMealPlan(mp.id, smp.id, c as boolean)} />
                              <label htmlFor={`smp-${smp.id}`} className="text-xs text-gray-600 cursor-pointer">{smp.name}</label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </div>

          <div className="flex gap-2 border-t pt-2">
            <Button variant="ghost" size="sm" onClick={onCopy} disabled={!hasSelection} className="flex-1">
              <Copy className="h-3 w-3 mr-1" /> Copy Cell
            </Button>
            <Button variant="ghost" size="sm" onClick={onPaste} disabled={!clipboardMode} className="flex-1">
              <ClipboardPaste className="h-3 w-3 mr-1" /> Paste
            </Button>
          </div>

          <DialogFooter>
            <Button onClick={() => setIsOpen(false)} className="w-full">Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}