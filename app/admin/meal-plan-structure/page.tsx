"use client"

import { useState, useEffect, useMemo, Fragment } from "react"
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
  Eye,
  Plus,
  Trash2,
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
  type Company,
  type Building,
  type Service,
  type SubService,
  type MealPlan,
  type SubMealPlan,
  type MealPlanStructureAssignment,
} from "@/lib/services"
import { collection, addDoc, updateDoc, doc, onSnapshot, query, where } from "firebase/firestore"
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

interface MealPlanChoice {
  choiceId: string
  quantity: number
  mealPlans: MealPlanStructureData[]
  createdAt?: string | Date
}

interface DayChoices {
  [key: string]: MealPlanChoice[] // day -> array of choices
}

interface SubServiceStructure {
  subServiceId: string
  subServiceName?: string
  mealPlans: MealPlanStructureData[]
  choices?: DayChoices
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
  const [currentAssignmentId, setCurrentAssignmentId] = useState<string | null>(null)

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
  
  // Choice management states
  const [isChoiceModalOpen, setIsChoiceModalOpen] = useState(false)
  const [choiceContext, setChoiceContext] = useState<{ day: string; serviceId: string; subServiceId: string } | null>(null)
  const [choiceQuantity, setChoiceQuantity] = useState(1)
  const [choiceStep, setChoiceStep] = useState<'quantity' | 'selection'>("quantity")
  const [choiceSelections, setChoiceSelections] = useState<MealPlanStructureData[]>([])
  const [choiceSearchQuery, setChoiceSearchQuery] = useState("")
  
  // New states for View All Companies - Full Screen Editor
  const [isViewAllModalOpen, setIsViewAllModalOpen] = useState(false)
  const [isLoadingAllData, setIsLoadingAllData] = useState(false)
  const [allCompaniesWithBuildings, setAllCompaniesWithBuildings] = useState<Array<{ company: Company; buildings: Building[] }>>([])
  const [allBuildingsWeeklyStructure, setAllBuildingsWeeklyStructure] = useState<Record<string, WeeklyStructure>>({})
  const [editingBuildingId, setEditingBuildingId] = useState<string | null>(null)
  const [editingBuildingStructure, setEditingBuildingStructure] = useState<WeeklyStructure>({})

  // Initial Fetch of Base Data
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

  // Fetch Buildings when Company Changes
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

  // --- LIVE REAL-TIME LISTENER FOR MAIN EDITOR ---
  useEffect(() => {
    let unsubscribeBase: () => void
    let unsubscribeMealPlans: () => void

    if (selectedCompany && selectedBuilding) {
      setLoading(true)

      // 1. Listen to Base Structure (Rows)
      const baseQuery = query(
        collection(db, "structureAssignments"),
        where("companyId", "==", selectedCompany),
        where("buildingId", "==", selectedBuilding),
        where("status", "==", "active")
      )

      unsubscribeBase = onSnapshot(baseQuery, (snapshot) => {
        if (!snapshot.empty) {
          const data = snapshot.docs[0].data()
          setBaseStructure(data.weekStructure || {})
        } else {
          setBaseStructure({})
          toast({
            title: "No Base Structure",
            description: "Please configure 'Structure Assignment' first.",
            variant: "destructive",
          })
        }
      }, (error) => console.error("Error listening to base structure:", error))

      // 2. Listen to Meal Plan Assignments (Grid Data)
      const mealPlanQuery = query(
        collection(db, "mealPlanStructureAssignments"),
        where("companyId", "==", selectedCompany),
        where("buildingId", "==", selectedBuilding),
        where("status", "==", "active") 
      )

      unsubscribeMealPlans = onSnapshot(mealPlanQuery, (snapshot) => {
        if (!snapshot.empty) {
          const docSnap = snapshot.docs[0]
          setCurrentAssignmentId(docSnap.id) 
          setWeeklyStructure(docSnap.data().weekStructure || {})
        } else {
          setCurrentAssignmentId(null)
          setWeeklyStructure({})
        }
        setLoading(false)
      }, (error) => {
        console.error("Error listening to meal plans:", error)
        setLoading(false)
      })

    } else {
      setBaseStructure({})
      setWeeklyStructure({})
      setCurrentAssignmentId(null)
    }

    return () => {
      if (unsubscribeBase) unsubscribeBase()
      if (unsubscribeMealPlans) unsubscribeMealPlans()
    }
  }, [selectedCompany, selectedBuilding])

  // --- LIVE REAL-TIME LISTENER FOR "VIEW ALL" MODAL ---
  useEffect(() => {
    let unsubscribeAssignments: () => void

    const fetchAllLive = async () => {
      if (!isViewAllModalOpen || companies.length === 0) return

      setIsLoadingAllData(true)
      try {
        const allBuildingsList = await buildingsService.getAll()
        const activeBuildings = allBuildingsList.filter(b => !b.status || b.status === "active")

        const q = query(
          collection(db, "mealPlanStructureAssignments"), 
          where("status", "==", "active")
        )

        unsubscribeAssignments = onSnapshot(q, (snapshot) => {
          const assignmentsData = snapshot.docs.map(doc => doc.data() as MealPlanStructureAssignment)
          const data: Array<{ company: Company; buildings: Building[] }> = []
          const weeklyData: Record<string, WeeklyStructure> = {}

          for (const company of companies) {
            const companyBuildings = activeBuildings
              .filter((b) => b.companyId === company.id)
              .sort((a, b) => (a.name || "").localeCompare(b.name || ""))

            data.push({ company, buildings: companyBuildings })

            for (const building of companyBuildings) {
              const buildingId = building.id
              weeklyData[buildingId] = {}

              DAYS.forEach((day) => { weeklyData[buildingId][day] = [] })

              const buildingMealPlanAssignment = assignmentsData.find(
                (s) => s.companyId === company.id && s.buildingId === buildingId
              )

              if (buildingMealPlanAssignment && buildingMealPlanAssignment.weekStructure) {
                weeklyData[buildingId] = buildingMealPlanAssignment.weekStructure
              }
            }
          }

          setAllCompaniesWithBuildings(data)
          setAllBuildingsWeeklyStructure(weeklyData)
          setIsLoadingAllData(false)
        })
      } catch (error) {
        console.error("Error setting up View All live listener:", error)
        setIsLoadingAllData(false)
      }
    }

    fetchAllLive()

    return () => {
      if (unsubscribeAssignments) unsubscribeAssignments()
    }
  }, [isViewAllModalOpen, companies])

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

  const handleOpenChoiceModal = (day: string, serviceId: string, subServiceId: string) => {
    setChoiceContext({ day, serviceId, subServiceId })
    setChoiceQuantity(1)
    setChoiceStep("quantity")
    setChoiceSelections([])
    setChoiceSearchQuery("")
    setIsChoiceModalOpen(true)
  }

  // Compute total selected sub meals for live counter
  const totalSelectedSubMeals = choiceSelections.reduce((sum, mp) => sum + (mp.subMealPlans?.length || 0), 0)

  const handleCreateChoice = () => {
    if (!choiceContext || choiceSelections.length === 0) {
      toast({ title: "Error", description: "Please select at least one meal plan", variant: "destructive" })
      return
    }

    // Validate that all selected meal plans have at least one sub-meal plan selected
    const hasInvalidMealPlan = choiceSelections.some((mp) => {
      const hasSubMealPlans = mp.subMealPlans && mp.subMealPlans.length > 0
      return !hasSubMealPlans
    })

    if (hasInvalidMealPlan) {
      toast({ title: "Error", description: "Please select sub meal plan, it's mandatory for each meal plan", variant: "destructive" })
      return
    }

    // Validate that item count is strictly less than total selected sub meals
    if (choiceQuantity >= totalSelectedSubMeals) {
      toast({
        title: "Invalid Item Count",
        description: `Item count (${choiceQuantity}) must be less than total sub meals selected (${totalSelectedSubMeals}). Please select more sub meals or reduce the item count.`,
        variant: "destructive",
      })
      return
    }

    const { day, serviceId, subServiceId } = choiceContext
    const choiceId = `choice-${Date.now()}-${Math.random().toString(36).substring(7)}`
    
    const newChoice: MealPlanChoice = {
      choiceId,
      quantity: choiceQuantity,
      choiceDay: day,
      serviceId, // Store service ID so we know which service this choice belongs to
      subServiceId, // Store sub-service ID so we know which sub-service this choice belongs to
      mealPlans: JSON.parse(JSON.stringify(choiceSelections)),
      createdAt: new Date(),
    }

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

      if (subIndex !== -1) {
        const subService = { ...subServicesList[subIndex] }
        subService.choices = subService.choices || {}
        
        // Check if a choice with identical meal plans already exists for this day
        const existingChoiceIndex = subService.choices[day]?.findIndex((c) =>
          JSON.stringify(c.mealPlans) === JSON.stringify(newChoice.mealPlans) &&
          c.quantity === newChoice.quantity
        ) ?? -1
        
        if (existingChoiceIndex !== -1) {
          // Replace existing choice instead of creating duplicate
          subService.choices[day][existingChoiceIndex] = newChoice
        } else {
          // Only add new choice if it doesn't already exist
          subService.choices[day] = subService.choices[day] ? [...subService.choices[day], newChoice] : [newChoice]
        }
        
        subServicesList[subIndex] = subService
      }

      service.subServices = subServicesList
      dayServices[serviceIndex] = service
      return { ...prev, [day]: dayServices }
    })

    toast({ title: "Success", description: `Choice created: ${choiceQuantity}x items` })
    setIsChoiceModalOpen(false)
    setChoiceContext(null)
    setChoiceSelections([])
  }

  const handleDeleteChoice = (day: string, serviceId: string, subServiceId: string, choiceId: string) => {
    setWeeklyStructure((prev) => {
      const dayServices = prev[day] ? [...prev[day]] : []
      const serviceIndex = dayServices.findIndex((s) => s.serviceId === serviceId)

      if (serviceIndex !== -1) {
        const service = { ...dayServices[serviceIndex] }
        const subServicesList = [...service.subServices]
        const subIndex = subServicesList.findIndex((s) => s.subServiceId === subServiceId)

        if (subIndex !== -1) {
          const subService = { ...subServicesList[subIndex] }
          if (subService.choices && subService.choices[day]) {
            subService.choices[day] = subService.choices[day].filter((c) => c.choiceId !== choiceId)
          }
          subServicesList[subIndex] = subService
        }

        service.subServices = subServicesList
        dayServices[serviceIndex] = service
      }

      return { ...prev, [day]: dayServices }
    })

    toast({ title: "Deleted", description: "Choice removed" })
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

    // Pre-save validation: ensure all choices have quantity < total sub meals
    for (const day of DAYS) {
      const dayServices = weeklyStructure[day] || []
      for (const svc of dayServices) {
        for (const sub of svc.subServices || []) {
          const dayChoices = sub.choices?.[day] || []
          for (const choice of dayChoices) {
            const totalSubMeals = (choice.mealPlans || []).reduce(
              (sum: number, mp: any) => sum + (mp.subMealPlans?.length || 0), 0
            )
            if (choice.quantity >= totalSubMeals) {
              toast({
                title: "Invalid Choice Configuration",
                description: `Choice on ${day} in ${svc.serviceName || 'service'} → ${sub.subServiceName || 'sub-service'}: item count (${choice.quantity}) must be less than total sub meals (${totalSubMeals}).`,
                variant: "destructive",
              })
              return
            }
          }
        }
      }
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

      if (currentAssignmentId) {
        await updateDoc(doc(db, "mealPlanStructureAssignments", currentAssignmentId), {
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
      const activeStructures = allStructures.filter(s => s.status === "active")

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

        const existingStructure = activeStructures.find(
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

  const handleRemoveSubService = (day: string, serviceId: string, subServiceId: string) => {
    setWeeklyStructure((prev) => {
      const dayServices = prev[day] ? [...prev[day]] : []
      const serviceIndex = dayServices.findIndex((s) => s.serviceId === serviceId)
      
      if (serviceIndex !== -1) {
        const service = { ...dayServices[serviceIndex] }
        service.subServices = service.subServices.filter((s) => s.subServiceId !== subServiceId)
        
        if (service.subServices.length === 0) {
          dayServices.splice(serviceIndex, 1)
        } else {
          dayServices[serviceIndex] = service
        }
        
        return { ...prev, [day]: dayServices }
      }
      return prev
    })
  }

  const handleAddSubService = (day: string, serviceId: string, subServiceId: string) => {
    const subServiceName = getSubServiceName(subServiceId)
    setWeeklyStructure((prev) => {
      const dayServices = prev[day] ? [...prev[day]] : []
      let serviceIndex = dayServices.findIndex((s) => s.serviceId === serviceId)

      if (serviceIndex === -1) {
        dayServices.push({ serviceId, serviceName: getServiceName(serviceId), subServices: [] })
        serviceIndex = dayServices.length - 1
      }

      const service = { ...dayServices[serviceIndex] }
      const subServicesList = [...service.subServices]
      
      if (!subServicesList.some((s) => s.subServiceId === subServiceId)) {
        subServicesList.push({
          subServiceId,
          subServiceName,
          mealPlans: [],
        })
      }

      service.subServices = subServicesList
      dayServices[serviceIndex] = service
      return { ...prev, [day]: dayServices }
    })
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
        if(structure.status === "active") {
           const key = `${structure.companyId}-${structure.buildingId}`
           groupedByBuilding.set(key, structure)
        }
      })

      allCompaniesList.forEach((company) => {
        const companyBuildings = allBuildings.filter(
          (b) => b.companyId === company.id && (!b.status || b.status === "active"),
        )

        companyBuildings.forEach((building) => {
          const structureKey = `${company.id}-${building.id}`
          const structure = groupedByBuilding.get(structureKey)

          if (structure && structure.weekStructure) {
            const safeCompanyName = company.name.substring(0, 10).replace(/[\\*?:/[\]]/g, "")
            const safeBuildingName = building.name.substring(0, 15).replace(/[\\*?:/[\]]/g, "")
            const sheetName = `${safeCompanyName} - ${safeBuildingName}`

            const sheetData: any[] = []

            sheetData.push([`MEAL PLAN STRUCTURE: ${company.name}`])
            sheetData.push([`Building: ${building.name}`])
            sheetData.push([])

            const headers = ["Service / Sub-Service / Sub-Meal Plan", ...DAYS.map((day) => day.charAt(0).toUpperCase() + day.slice(1))]
            sheetData.push(headers)

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

            serviceMapForExcel.forEach((svcInfo, serviceId) => {
              const serviceName = getServiceName(serviceId)
              sheetData.push([serviceName.toUpperCase(), "", "", "", "", "", "", ""])

              svcInfo.subServices.forEach((subServiceId) => {
                const subServiceName = getSubServiceName(subServiceId)
                sheetData.push([`   • ${subServiceName}`, "", "", "", "", "", "", ""])

                const uniqueSubMealPlansInSubService = new Map<string, string>()
                DAYS.forEach(day => {
                   const dayService = structure.weekStructure[day]?.find((s: any) => s.serviceId === serviceId)
                   const daySubService = dayService?.subServices?.find((ss: any) => ss.subServiceId === subServiceId)
                   daySubService?.mealPlans?.forEach((mp: any) => {
                       mp.subMealPlans?.forEach((smp: any) => {
                           // DYNAMIC LOOKUP FOR ACCURATE EXCEL EXPORT
                           const liveSubName = subMealPlans.find((s) => s.id === smp.subMealPlanId)?.name || smp.subMealPlanName
                           uniqueSubMealPlansInSubService.set(smp.subMealPlanId, liveSubName || "")
                       })
                   })
                })

                uniqueSubMealPlansInSubService.forEach((smpName, smpId) => {
                    const rowData = [`      - ${smpName}`]

                    DAYS.forEach((day) => {
                        const dayService = structure.weekStructure[day]?.find((s: any) => s.serviceId === serviceId)
                        const daySubService = dayService?.subServices?.find((ss: any) => ss.subServiceId === subServiceId)
                        
                        const isAssigned = daySubService?.mealPlans?.some((mp: any) => 
                            mp.subMealPlans?.some((sub: any) => sub.subMealPlanId === smpId)
                        )

                        if (isAssigned) {
                            rowData.push(day.charAt(0).toUpperCase() + day.slice(1))
                        } else {
                            rowData.push("-")
                        }
                    })
                    sheetData.push(rowData)
                })
              })
              sheetData.push([])
            })

            const worksheet = XLSX.utils.aoa_to_sheet(sheetData)
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

  // --- HELPER FUNCTION FOR VIEW ALL MODAL ---
  const getUnifiedRowsForBuilding = (weeklyStructure: WeeklyStructure) => {
    const serviceMap = new Map<string, { 
      serviceId: string; 
      serviceName: string; 
      subServices: Map<string, { subServiceId: string; subServiceName: string; mealPlans: any[] }> 
    }>();
  
    DAYS.forEach((day) => {
      const dayServices = weeklyStructure[day] || [];
      dayServices.forEach((svc) => {
        if (!serviceMap.has(svc.serviceId)) {
          serviceMap.set(svc.serviceId, {
            serviceId: svc.serviceId,
            serviceName: svc.serviceName || "Unknown",
            subServices: new Map()
          });
        }
        
        const serviceEntry = serviceMap.get(svc.serviceId)!;
        
        svc.subServices.forEach((sub) => {
          if (!serviceEntry.subServices.has(sub.subServiceId)) {
            serviceEntry.subServices.set(sub.subServiceId, {
              subServiceId: sub.subServiceId,
              subServiceName: sub.subServiceName || "Unknown",
              mealPlans: [] 
            });
          }
        });
      });
    });
  
    return Array.from(serviceMap.values()).map(svc => ({
      ...svc,
      subServices: Array.from(svc.subServices.values())
    }));
  };

  if (isDataLoading)
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Meal Plan Structure</h1>
          <p className="text-gray-500">Configure meal plans for building services</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => setIsViewAllModalOpen(true)}
            disabled={companies.length === 0}
            variant="outline"
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            View All Companies & Buildings
          </Button>
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

      {/* --- CHOICE CREATION MODAL --- */}
      <Dialog open={isChoiceModalOpen} onOpenChange={setIsChoiceModalOpen}>
        <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col z-[99999]">
          <DialogHeader>
            <DialogTitle>
              {choiceStep === 'quantity' ? 'Select Quantity' : 'Select Meal Plans for Choice'}
            </DialogTitle>
            <DialogDescription>
              {choiceStep === 'quantity' 
                ? 'How many items do you want in this choice?'
                : 'Choose meal plans and sub-plans for this choice.'}
            </DialogDescription>
          </DialogHeader>

          {choiceStep === 'quantity' ? (
            // STEP 1: Select Quantity
            <div className="px-1 py-4 space-y-4">
              <div className="flex items-center gap-4">
                <Label htmlFor="quantity" className="w-24">Quantity:</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  max="100"
                  value={choiceQuantity}
                  onChange={(e) => setChoiceQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1"
                />
              </div>
              <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
                Selected: <strong>{choiceQuantity}</strong> item{choiceQuantity !== 1 ? 's' : ''}
              </div>
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2.5 rounded flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>Item count must be <strong>less than</strong> the total number of sub meals you select in the next step.</span>
              </div>
            </div>
          ) : (
            // STEP 2: Select Meal Plans
            <div className="px-1 flex-1 overflow-hidden flex flex-col">
              {/* Live counter bar */}
              <div className={`mb-2 p-2.5 rounded-lg border text-sm font-medium flex items-center justify-between ${
                totalSelectedSubMeals > 0 && choiceQuantity >= totalSelectedSubMeals
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : totalSelectedSubMeals > choiceQuantity
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-gray-50 border-gray-200 text-gray-600'
              }`}>
                <span>Item count: <strong>{choiceQuantity}</strong> &nbsp;|&nbsp; Sub meals selected: <strong>{totalSelectedSubMeals}</strong></span>
                {totalSelectedSubMeals > 0 && choiceQuantity >= totalSelectedSubMeals && (
                  <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">⚠ Need more sub meals</span>
                )}
                {totalSelectedSubMeals > choiceQuantity && (
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">✓ Valid</span>
                )}
              </div>

              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  type="search"
                  placeholder="Search meal plans..."
                  className="pl-9"
                  value={choiceSearchQuery}
                  onChange={(e) => setChoiceSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex-1 overflow-hidden border rounded-md">
                <ScrollArea className="h-[300px] p-4">
                  <div className="space-y-3">
                    {mealPlans.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-6 text-center text-gray-500 gap-2">
                        <AlertCircle className="h-8 w-8 text-yellow-500" />
                        <p className="text-sm font-medium">No Meal Plans Available</p>
                      </div>
                    )}
                    {mealPlans
                      .filter((mp) => 
                        !choiceSearchQuery.trim() || mp.name?.toLowerCase().includes(choiceSearchQuery.toLowerCase())
                      )
                      .map((mp) => {
                        const isSelected = choiceSelections.some((a) => a.mealPlanId === mp.id)
                        const currentAssignment = choiceSelections.find((a) => a.mealPlanId === mp.id)
                        const subMealsForPlan = subMealPlans.filter((smp) => smp.mealPlanId === mp.id)

                        return (
                          <div key={mp.id} className="space-y-1">
                            <div className="flex items-center space-x-2 py-2 bg-gray-50 rounded px-2">
                              <Checkbox 
                                id={`choice-mp-${mp.id}`} 
                                checked={isSelected} 
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setChoiceSelections([...choiceSelections, { mealPlanId: mp.id, mealPlanName: mp.name || "", subMealPlans: [] }])
                                  } else {
                                    setChoiceSelections(choiceSelections.filter((a) => a.mealPlanId !== mp.id))
                                  }
                                }}
                              />
                              <label htmlFor={`choice-mp-${mp.id}`} className="text-sm font-medium cursor-pointer flex-1">
                                {mp.name}
                              </label>
                            </div>
                            {isSelected && subMealsForPlan.length > 0 && (
                              <div className="ml-6 space-y-1">
                                {subMealsForPlan.map((smp) => (
                                  <div key={smp.id} className="flex items-center space-x-2">
                                    <Checkbox 
                                      id={`choice-smp-${smp.id}`} 
                                      checked={currentAssignment?.subMealPlans?.some(s => s.subMealPlanId === smp.id) || false}
                                      onCheckedChange={(checked) => {
                                        setChoiceSelections(choiceSelections.map((a) => {
                                          if (a.mealPlanId !== mp.id) return a
                                          const currentSubs = [...(a.subMealPlans || [])]
                                          if (checked) {
                                            if (!currentSubs.some((s) => s.subMealPlanId === smp.id)) {
                                              currentSubs.push({ subMealPlanId: smp.id, subMealPlanName: smp.name || "" })
                                            }
                                          } else {
                                            return { ...a, subMealPlans: currentSubs.filter((s) => s.subMealPlanId !== smp.id) }
                                          }
                                          return { ...a, subMealPlans: currentSubs }
                                        }))
                                      }}
                                    />
                                    <label htmlFor={`choice-smp-${smp.id}`} className="text-xs text-gray-600 cursor-pointer">
                                      {smp.name}
                                    </label>
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
            </div>
          )}

          <DialogFooter className="pt-2 border-t">
            <Button 
              variant="outline" 
              onClick={() => {
                if (choiceStep === 'selection') {
                  setChoiceStep('quantity')
                } else {
                  setIsChoiceModalOpen(false)
                }
              }}
            >
              {choiceStep === 'quantity' ? 'Cancel' : 'Back'}
            </Button>
            <Button 
              onClick={() => {
                if (choiceStep === 'quantity') {
                  setChoiceStep('selection')
                  setChoiceSearchQuery('')
                } else {
                  handleCreateChoice()
                }
              }}
              disabled={choiceStep === 'selection' && choiceSelections.length === 0}
            >
              {choiceStep === 'quantity' ? 'Next' : 'Create Choice'}
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
                <Table className="border-collapse">
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
                      <Fragment key={`svc-group-${svc.serviceId}`}>
                        <TableRow className="bg-blue-50 hover:bg-blue-50/80 group">
                          <TableCell className="font-bold text-blue-900 py-3 border-b border-r sticky left-0 bg-blue-50 z-20">
                            <div className="flex items-center justify-between gap-2">
                              <span>{svc.serviceName}</span>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                                  >
                                    <Plus className="h-3 w-3 text-green-600" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                  <DialogHeader>
                                    <DialogTitle>Add Sub-Service to {svc.serviceName}</DialogTitle>
                                    <DialogDescription>
                                      Select a sub-service to add to this service
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 max-h-[300px] overflow-y-auto">
                                    {subServices
                                      .filter((ss) => !svc.subServices.some((s) => s.subServiceId === ss.id))
                                      .map((subService) => (
                                        <Button
                                          key={subService.id}
                                          variant="outline"
                                          className="w-full justify-start"
                                          onClick={() => {
                                            DAYS.forEach((day) => {
                                              handleAddSubService(day, svc.serviceId, subService.id)
                                            })
                                          }}
                                        >
                                          <Plus className="h-4 w-4 mr-2" />
                                          {subService.name}
                                        </Button>
                                      ))}
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </TableCell>
                          {/* ColSpan must be 8 (1 for label + 7 for days) */}
                          <TableCell colSpan={7} className="border-b bg-blue-50/30"></TableCell>
                        </TableRow>

                        {svc.subServices.map((subSvc) => (
                          <TableRow key={`${svc.serviceId}-${subSvc.subServiceId}`} className="hover:bg-gray-50 group">
                            <TableCell className="font-medium text-gray-600 border-r border-b pl-8 sticky left-0 bg-white z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                              <div className="flex items-center justify-between gap-2">
                                <span>{subSvc.subServiceName}</span>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                                    >
                                      <Trash2 className="h-3 w-3 text-red-500" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="sm:max-w-md">
                                    <DialogHeader>
                                      <DialogTitle>Remove Sub-Service</DialogTitle>
                                      <DialogDescription>
                                        Are you sure you want to remove <strong>{subSvc.subServiceName}</strong> from <strong>{svc.serviceName}</strong>? This will remove it from all days.
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="flex gap-2">
                                      <Button variant="outline" className="flex-1">Cancel</Button>
                                      <Button 
                                        variant="destructive" 
                                        className="flex-1"
                                        onClick={() => {
                                          DAYS.forEach((day) => {
                                            handleRemoveSubService(day, svc.serviceId, subSvc.subServiceId)
                                          })
                                        }}
                                      >
                                        Remove
                                      </Button>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </div>
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
                              const savedChoices = (currentSub?.choices && currentSub.choices[day]) || []

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
                                    day={day}
                                    serviceId={svc.serviceId}
                                    subServiceId={subSvc.subServiceId}
                                    onOpenChoiceModal={handleOpenChoiceModal}
                                    savedChoices={savedChoices}
                                    onDeleteChoice={(choiceId) => handleDeleteChoice(day, svc.serviceId, subSvc.subServiceId, choiceId)}
                                  />
                                </TableCell>
                              )
                            })}
                          </TableRow>
                        ))}
                      </Fragment>
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

      {/* --- FULL SCREEN VIEW ALL COMPANIES & BUILDINGS OVERVIEW --- */}
      <Dialog open={isViewAllModalOpen} onOpenChange={setIsViewAllModalOpen}>
        <DialogContent className="!max-w-none !w-[100vw] !h-[100vh] !max-h-[100vh] !rounded-none !border-none !m-0 !p-0 flex flex-col bg-white shadow-none focus-visible:outline-none gap-0 !top-0 !left-0 !translate-x-0 !translate-y-0">
          <DialogHeader className="p-4 border-b shrink-0 flex flex-row items-center justify-between space-y-0 bg-white">
            <div>
              <DialogTitle className="text-xl">All Companies & Buildings - Meal Plan Structure Overview</DialogTitle>
              <DialogDescription className="mt-1">
                Live overview of meal plan structures for all active companies and their buildings.
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsViewAllModalOpen(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>

          <div className="flex-1 overflow-hidden relative bg-gray-50/50">
            <ScrollArea className="h-full w-full">
              <div className="p-6 pb-20">
                {isLoadingAllData ? (
                  <div className="flex items-center justify-center py-24">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : allCompaniesWithBuildings.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">No companies or buildings found</div>
                ) : (
                  <div className="space-y-8">
                    {allCompaniesWithBuildings.map(({ company, buildings }) => (
                      <div key={company.id} className="border-2 rounded-lg p-6 bg-white shadow-sm">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
                          <Building2 className="h-6 w-6 text-blue-600" />
                          <h2 className="text-2xl font-bold text-gray-900">{company.name}</h2>
                          <span className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">
                            {buildings.length} {buildings.length === 1 ? "Building" : "Buildings"}
                          </span>
                        </div>

                        {buildings.length === 0 ? (
                          <div className="text-center py-8 text-gray-500 italic">No buildings assigned</div>
                        ) : (
                          <div className="space-y-6">
                            {buildings.map((building) => {
                              const buildingWeeklyStructure = allBuildingsWeeklyStructure[building.id] || {}
                              const hasAssignments = Object.values(buildingWeeklyStructure).some(
                                (dayServices) => dayServices && dayServices.length > 0
                              )

                              return (
                                <div
                                  key={building.id}
                                  className="border rounded-lg p-4 bg-gradient-to-br from-gray-50 to-white hover:shadow-md transition-shadow"
                                >
                                  <div className="mb-4">
                                    <h3 className="text-lg font-semibold text-gray-800">{building.name}</h3>
                                    {building.address && (
                                      <p className="text-sm text-gray-600">{building.address}</p>
                                    )}
                                  </div>

                                  {!hasAssignments ? (
                                    <div className="flex items-center justify-center py-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50/50">
                                      <div className="text-center">
                                        <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                        <p className="text-gray-500">Nothing assigned</p>
                                        <p className="text-xs text-gray-400 mt-1">Configure services and meal plans to get started</p>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col gap-3">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setEditingBuildingId(building.id)
                                          setEditingBuildingStructure(JSON.parse(JSON.stringify(buildingWeeklyStructure)))
                                        }}
                                        className="self-start"
                                      >
                                        View Details
                                      </Button>
                                      <div className="overflow-x-auto">
                                        <Table className="border-collapse text-sm">
                                          <TableHeader className="sticky top-0 z-20 bg-blue-50">
                                            <TableRow>
                                              <TableHead className="w-[200px] font-bold bg-blue-50 border-r border-b text-gray-900 text-left">
                                                Service / Sub-Service
                                              </TableHead>
                                              {DAYS.map((day) => (
                                                <TableHead
                                                  key={day}
                                                  className="min-w-[180px] text-center capitalize font-semibold bg-blue-50 border-r border-b text-gray-900 text-xs"
                                                >
                                                  {day}
                                                </TableHead>
                                              ))}
                                            </TableRow>
                                          </TableHeader>
                                          
                                          {/* --- UPDATED RENDERING LOGIC --- */}
                                          <TableBody>
                                          {(() => {
                                            const unifiedRows = getUnifiedRowsForBuilding(buildingWeeklyStructure);

                                            if (unifiedRows.length === 0) {
                                              return (
                                                <TableRow>
                                                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                                                    No services configured
                                                  </TableCell>
                                                </TableRow>
                                              );
                                            }

                                            return unifiedRows.map((svc) => (
                                              <Fragment key={`${building.id}-svc-${svc.serviceId}`}>
                                                <TableRow className="bg-blue-50/50 hover:bg-blue-50/80">
                                                  <TableCell className="font-semibold text-blue-900 py-2 border-r border-b text-left">
                                                    {svc.serviceName}
                                                  </TableCell>
                                                  {DAYS.map((day) => (
                                                    <TableCell key={day} className="border-r border-b text-center p-1 bg-gray-50/30">
                                                      {/* Visual filler for Service Row */}
                                                    </TableCell>
                                                  ))}
                                                </TableRow>

                                                {svc.subServices.map((subSvc) => (
                                                  <TableRow key={`${building.id}-subsvc-${subSvc.subServiceId}`} className="hover:bg-gray-50">
                                                    <TableCell className="text-gray-700 py-2 border-r border-b pl-8 text-left text-sm">
                                                      {subSvc.subServiceName}
                                                    </TableCell>
                                                    {DAYS.map((day) => {
                                                      const dayService = buildingWeeklyStructure[day]?.find(s => s.serviceId === svc.serviceId);
                                                      const daySubService = dayService?.subServices.find(ss => ss.subServiceId === subSvc.subServiceId);
                                                      const assignedPlans = daySubService?.mealPlans || [];
                                                      const existsOnDay = !!daySubService;

                                                      if (!existsOnDay) {
                                                        return (
                                                          <TableCell key={day} className="border-r border-b bg-gray-100/50 text-center">
                                                            <span className="text-gray-300 text-xs">-</span>
                                                          </TableCell>
                                                        );
                                                      }

                                                      return (
                                                        <TableCell key={day} className="border-r border-b text-left p-2 text-xs align-top bg-white">
                                                          <div className="space-y-1">
                                                            {assignedPlans.length > 0 ? (
                                                              assignedPlans.map((plan: any) => {
                                                                // DYNAMIC LOOKUP
                                                                const liveMpName = mealPlans.find(m => m.id === plan.mealPlanId)?.name || plan.mealPlanName;
                                                                return (
                                                                  <div key={plan.mealPlanId} className="flex flex-col bg-blue-50 p-1 rounded border border-blue-200">
                                                                    <span className="font-medium text-gray-800">
                                                                      {liveMpName}
                                                                    </span>
                                                                    {plan.subMealPlans && plan.subMealPlans.length > 0 && (
                                                                      <div className="ml-2 mt-1 space-y-0.5 border-l border-blue-300 pl-2">
                                                                        {plan.subMealPlans.map((subPlan: any) => {
                                                                          // DYNAMIC LOOKUP
                                                                          const liveSubName = subMealPlans.find(s => s.id === subPlan.subMealPlanId)?.name || subPlan.subMealPlanName;
                                                                          return (
                                                                            <div key={subPlan.subMealPlanId} className="text-gray-700 text-xs">
                                                                              • {liveSubName}
                                                                            </div>
                                                                          )
                                                                        })}
                                                                      </div>
                                                                    )}
                                                                  </div>
                                                                )
                                                              })
                                                            ) : (
                                                              <span className="text-gray-400 italic">—</span>
                                                            )}
                                                          </div>
                                                        </TableCell>
                                                      );
                                                    })}
                                                  </TableRow>
                                                ))}
                                              </Fragment>
                                            ));
                                          })()}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter className="p-4 border-t shrink-0 bg-white flex items-center justify-between">
            <p className="text-sm text-gray-600">Full overview of all company and building meal plan structures</p>
            <Button variant="outline" onClick={() => setIsViewAllModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- VIEW BUILDING STRUCTURE DETAILS MODAL (Read-Only) --- */}
      <Dialog 
        open={editingBuildingId !== null} 
        onOpenChange={(open) => {
          if (!open) {
            setEditingBuildingId(null)
            setEditingBuildingStructure({})
          }
        }}
      >
        <DialogContent className="!max-w-none !w-[100vw] !h-[100vh] !max-h-[100vh] !rounded-none !border-none !m-0 !p-0 flex flex-col bg-white shadow-none focus-visible:outline-none gap-0 !top-0 !left-0 !translate-x-0 !translate-y-0">
          <DialogHeader className="p-4 border-b shrink-0 flex flex-row items-center justify-between space-y-0 bg-white">
            <div>
              <DialogTitle className="text-xl">
                View Meal Plan Structure Details - {
                  allCompaniesWithBuildings.flatMap(c => c.buildings).find(b => b.id === editingBuildingId)?.name || "Building"
                }
              </DialogTitle>
              <DialogDescription className="mt-1">
                Read-only overview of assigned meal plans for this building.
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setEditingBuildingId(null)
                setEditingBuildingStructure({})
              }}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>

          <div className="flex-1 overflow-hidden relative bg-gray-50/50">
            <ScrollArea className="h-full w-full">
              <div className="min-w-[1400px] pb-20">
                <Table className="border-collapse">
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
                    {Object.values(editingBuildingStructure).flatMap((d) => d || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-gray-500">
                          No services configured for this building
                        </TableCell>
                      </TableRow>
                    ) : (
                      Object.values(editingBuildingStructure).find((d) => d && d.length > 0)?.map((svc: any) => (
                        <Fragment key={`edit-svc-${svc.serviceId}`}>
                          <TableRow className="bg-blue-50 hover:bg-blue-50/80">
                            <TableCell className="font-bold text-blue-900 py-3 border-b border-r sticky left-0 bg-blue-50 z-20">
                              {svc.serviceName}
                            </TableCell>
                            {DAYS.map((day) => (
                              <TableCell key={day} className="border-r border-b bg-blue-50/30"></TableCell>
                            ))}
                          </TableRow>

                          {svc.subServices?.map((subSvc: any) => (
                            <TableRow key={`edit-subsvc-${subSvc.subServiceId}`} className="hover:bg-gray-50">
                              <TableCell className="font-medium text-gray-600 border-r border-b pl-8 sticky left-0 bg-white z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                {subSvc.subServiceName}
                              </TableCell>
                              {DAYS.map((day) => (
                                <TableCell key={day} className="border-r border-b p-2 align-top bg-white">
                                  <div className="space-y-1 text-xs">
                                    {subSvc.mealPlans && subSvc.mealPlans.length > 0 ? (
                                      subSvc.mealPlans.map((plan: any) => {
                                        // DYNAMIC LOOKUP
                                        const liveMpName = mealPlans.find(m => m.id === plan.mealPlanId)?.name || plan.mealPlanName;
                                        return (
                                          <div key={plan.mealPlanId} className="flex flex-col bg-blue-50 p-2 rounded border border-blue-200">
                                            <span className="font-medium text-gray-800">
                                              {liveMpName}
                                            </span>
                                            {plan.subMealPlans && plan.subMealPlans.length > 0 && (
                                              <div className="ml-2 mt-1 space-y-0.5 border-l border-blue-300 pl-2">
                                                {plan.subMealPlans.map((subPlan: any) => {
                                                  // DYNAMIC LOOKUP
                                                  const liveSubName = subMealPlans.find(s => s.id === subPlan.subMealPlanId)?.name || subPlan.subMealPlanName;
                                                  return (
                                                    <div key={subPlan.subMealPlanId} className="text-gray-700">
                                                      • {liveSubName}
                                                    </div>
                                                  )
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        )
                                      })
                                    ) : (
                                      <span className="text-gray-400 italic">—</span>
                                    )}
                                  </div>
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </Fragment>
                      )) || null
                    )}
                  </TableBody>
                </Table>
              </div>
              <ScrollBar orientation="horizontal" />
              <ScrollBar orientation="vertical" />
            </ScrollArea>
          </div>

          <DialogFooter className="p-4 border-t bg-white shrink-0 sm:justify-between">
            <div className="hidden sm:block text-sm text-gray-500 self-center">Detailed read-only view.</div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setEditingBuildingId(null)
                  setEditingBuildingStructure({})
                }}
              >
                Close
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
  day?: string
  serviceId?: string
  subServiceId?: string
  onOpenChoiceModal?: (day: string, serviceId: string, subServiceId: string) => void
  savedChoices?: MealPlanChoice[]
  onDeleteChoice?: (choiceId: string) => void
}

function MealPlanSelector({
  availableMealPlans,
  availableSubMealPlans,
  assignedMealPlans,
  onUpdate,
  clipboardMode,
  onCopy,
  onPaste,
  day,
  serviceId,
  subServiceId,
  onOpenChoiceModal,
  savedChoices = [],
  onDeleteChoice,
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
      {/* Main Meal Plans Section */}
      <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) setSearchQuery(""); }}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className={`w-full justify-between text-left font-normal h-auto min-h-[40px] py-2 px-3 whitespace-normal ${hasSelection ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100" : "text-gray-500 hover:text-gray-700"}`}
          >
            <div className="flex flex-col gap-1 w-full overflow-hidden text-left">
              {hasSelection ? (
                assignedMealPlans.map((mp) => {
                  // DYNAMIC LOOKUP FOR DROPDOWN PREVIEW
                  const liveMpName = availableMealPlans.find((p) => p.id === mp.mealPlanId)?.name || mp.mealPlanName;
                  return (
                    <div key={mp.mealPlanId} className="flex flex-col text-xs font-medium border-b border-blue-100 last:border-0 pb-1 last:pb-0 mb-1 last:mb-0">
                      <span className="font-bold text-blue-900">{liveMpName}</span>
                      {mp.subMealPlans.length > 0 && (
                          <span className="text-[10px] text-blue-500 italic pl-2 text-left">
                             ↳ {mp.subMealPlans.map(s => {
                                 // DYNAMIC LOOKUP
                                 const liveSubName = availableSubMealPlans.find(sub => sub.id === s.subMealPlanId)?.name || s.subMealPlanName;
                                 return liveSubName;
                             }).join(", ")}
                          </span>
                      )}
                    </div>
                  )
                })
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
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                if (day && serviceId && subServiceId && onOpenChoiceModal) {
                  onOpenChoiceModal(day, serviceId, subServiceId)
                  setIsOpen(false)
                }
              }} 
              disabled={!hasSelection || !day || !serviceId || !subServiceId}
              className="flex-1"
            >
              <Plus className="h-3 w-3 mr-1" /> Create Choice
            </Button>
          </div>

          <DialogFooter>
            <Button onClick={() => setIsOpen(false)} className="w-full">Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Saved Choices Section */}
      {savedChoices && savedChoices.length > 0 && (
        <div className="mt-2 p-2 border border-amber-200 bg-amber-50/50 rounded space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 mb-1">
            <span className="text-amber-600">◆</span> Choices
          </div>
          {savedChoices.map((choice) => (
            <div key={choice.choiceId} className="flex items-start justify-between gap-1 p-1.5 bg-white rounded border border-amber-100 text-xs">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-amber-900">
                  {choice.quantity}x {choice.mealPlans.length > 0 ? `[${choice.mealPlans[0]?.mealPlanName}${choice.mealPlans.length > 1 ? `, +${choice.mealPlans.length - 1}` : ''}]` : "Choice"}
                </div>
                {choice.mealPlans.length > 0 && (
                  <div className="text-[10px] text-amber-700 italic mt-0.5 truncate">
                    {choice.mealPlans.map((mp) => `${mp.mealPlanName}${mp.subMealPlans.length > 0 ? ` (${mp.subMealPlans.length})` : ''}`).join(', ')}
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  if (onDeleteChoice) onDeleteChoice(choice.choiceId)
                }}
                className="flex-shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded"
                title="Delete choice"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
