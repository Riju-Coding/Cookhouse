"use client"

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { 
  Calendar, Repeat, Copy, Check, Plus, Trash2, Search, ArrowRight, 
  Sparkles, Building2, AlertCircle, Info, ChevronRight, ChevronDown, CheckCircle2, 
  Loader2, X, Eye, FileText, Layers, Utensils, RefreshCw
} from "lucide-react"
import { db } from "@/lib/firebase"
import { collection, addDoc, doc, updateDoc, serverTimestamp, getDocs, query, where } from "firebase/firestore"
import { 
  companiesService, 
  buildingsService, 
  servicesService, 
  subServicesService, 
  mealPlansService, 
  subMealPlansService, 
  menuItemsService, 
  mealPlanStructureAssignmentsService 
} from "@/lib/services"
import type { Service, SubService, MealPlan, SubMealPlan, MenuItem } from "@/lib/types"

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
const DAY_LABELS: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday"
}

const MONTHS = [
  { value: "0", label: "January" },
  { value: "1", label: "February" },
  { value: "2", label: "March" },
  { value: "3", label: "April" },
  { value: "4", label: "May" },
  { value: "5", label: "June" },
  { value: "6", label: "July" },
  { value: "7", label: "August" },
  { value: "8", label: "September" },
  { value: "9", label: "October" },
  { value: "10", label: "November" },
  { value: "11", label: "December" }
]

interface SearchableDropdownProps {
  label: string
  placeholder: string
  searchPlaceholder?: string
  value: string
  onChange: (val: string) => void
  options: Array<{ id: string; name: string }>
  disabled?: boolean
  loading?: boolean
}

function SearchableDropdown({
  label,
  placeholder,
  searchPlaceholder = "Search...",
  value,
  onChange,
  options,
  disabled = false,
  loading = false,
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState("")
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const selectedItem = options.find(o => o.id === value)

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options
    const q = search.toLowerCase().trim()
    return options.filter(o => (o.name || "").toLowerCase().includes(q))
  }, [options, search])

  return (
    <div className="space-y-1 relative" ref={dropdownRef}>
      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</Label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen(prev => !prev)
            setSearch("")
          }
        }}
        className={`w-full h-9 px-3 text-xs font-semibold rounded-md border flex items-center justify-between text-left transition-all ${
          disabled 
            ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed" 
            : isOpen 
              ? "bg-white border-blue-500 ring-2 ring-blue-500/20 text-slate-800 shadow-sm" 
              : "bg-slate-50 hover:bg-white border-slate-200 text-slate-700"
        }`}
      >
        <span className="truncate">
          {loading ? (
            <span className="text-slate-400 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin text-blue-600" /> Loading...
            </span>
          ) : selectedItem ? (
            selectedItem.name
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 ml-1 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-full min-w-[240px] max-w-[340px] z-[100] bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 border-b border-slate-100 bg-slate-50/70">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto custom-scrollbar p-1">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                {options.length === 0 ? "No options available" : "No matches found"}
              </div>
            ) : (
              filteredOptions.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onChange(opt.id)
                    setIsOpen(false)
                  }}
                  className={`w-full px-2.5 py-2 text-left text-xs font-medium rounded-lg flex items-center justify-between transition-colors ${
                    opt.id === value 
                      ? "bg-blue-50 text-blue-700 font-bold" 
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span className="truncate pr-2">{opt.name}</span>
                  {opt.id === value && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface RecurringMonthlyMenuModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  editMenu?: any | null
  preloadedCompanies?: Array<{ id: string; name: string }>
}

export function RecurringMonthlyMenuModal({
  isOpen,
  onClose,
  onSuccess,
  editMenu,
  preloadedCompanies
}: RecurringMonthlyMenuModalProps) {
  // Selection State
  const now = new Date()
  const [selectedCompanyId, setSelectedCompanyId] = useState("")
  const [selectedBuildingId, setSelectedBuildingId] = useState("")
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth()))
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()))
  const [workDaysMode, setWorkDaysMode] = useState<"5days" | "7days">("5days")

  // Master Data State
  const [companies, setCompanies] = useState<any[]>([])
  const [buildings, setBuildings] = useState<any[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [subServices, setSubServices] = useState<SubService[]>([])
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([])
  const [subMealPlans, setSubMealPlans] = useState<SubMealPlan[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [structureAssignment, setStructureAssignment] = useState<any | null>(null)

  // Loading States
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [loadingStructure, setLoadingStructure] = useState(false)
  const [saving, setSaving] = useState(false)

  // Master Template State: { [dayKey: string]: { [serviceId]: { [subServiceId]: { [mealPlanId]: { [subMealPlanId]: { menuItemIds: string[] } } } } } }
  const [masterTemplate, setMasterTemplate] = useState<Record<string, any>>({})
  const [activeDay, setActiveDay] = useState("monday")
  const [itemSearchQuery, setItemSearchQuery] = useState("")
  const [activeCategoryFilter, setActiveCategoryFilter] = useState("All")

  // Clipboard for Day copy-paste
  const [copiedDayData, setCopiedDayData] = useState<{ dayName: string; data: any } | null>(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)

  // Load Initial Master Data
  useEffect(() => {
    if (!isOpen) return

    // Immediately show preloaded companies if provided
    if (preloadedCompanies && preloadedCompanies.length > 0) {
      setCompanies(preloadedCompanies)
    }

    async function loadData() {
      try {
        setLoadingInitial(true)

        // 1. Fetch companies and buildings FIRST for immediate responsiveness
        const [compsRes, bldgsRes] = await Promise.allSettled([
          companiesService.getAll().catch(async (e) => {
            console.warn("companiesService.getAll() failed, trying Firestore:", e)
            const snap = await getDocs(collection(db, "companies"))
            return snap.docs.map(d => ({ id: d.id, ...d.data() }))
          }),
          buildingsService.getAll().catch(async (e) => {
            console.warn("buildingsService.getAll() failed, trying Firestore:", e)
            const snap = await getDocs(collection(db, "buildings"))
            return snap.docs.map(d => ({ id: d.id, ...d.data() }))
          })
        ])

        const loadedComps = compsRes.status === "fulfilled" && Array.isArray(compsRes.value) ? compsRes.value : []
        const loadedBldgs = bldgsRes.status === "fulfilled" && Array.isArray(bldgsRes.value) ? bldgsRes.value : []

        // Merge with preloadedCompanies to ensure no duplicates
        const mergedCompsMap = new Map<string, any>()
        if (preloadedCompanies) {
          preloadedCompanies.forEach(c => {
            if (c && c.id) mergedCompsMap.set(c.id, c)
          })
        }
        loadedComps.forEach(c => {
          if (c && c.id) mergedCompsMap.set(c.id, c)
        })

        const finalComps = Array.from(mergedCompsMap.values())
          .filter(c => c && (c.name || c.id))
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
        
        setCompanies(finalComps)
        setBuildings(loadedBldgs)

        if (editMenu) {
          setSelectedCompanyId(editMenu.companyId || "")
          setSelectedBuildingId(editMenu.buildingId || "")
          if (editMenu.startDate) {
            const d = new Date(editMenu.startDate)
            setSelectedMonth(String(d.getMonth()))
            setSelectedYear(String(d.getFullYear()))
          }
          if (editMenu.masterTemplate) {
            setMasterTemplate(editMenu.masterTemplate)
          }
        }
      } catch (err) {
        console.error("Failed to load initial companies/buildings:", err)
      } finally {
        setLoadingInitial(false)
      }

      // 2. Fetch catalog items (services, menuItems, etc.) non-blockingly
      try {
        const [srvs, subs, mps, smps, items] = await Promise.all([
          servicesService.getAll().catch(() => []),
          subServicesService.getAll().catch(() => []),
          mealPlansService.getAll().catch(() => []),
          subMealPlansService.getAll().catch(() => []),
          menuItemsService.getAll().catch(() => [])
        ])
        setServices(srvs || [])
        setSubServices(subs || [])
        setMealPlans(mps || [])
        setSubMealPlans(smps || [])
        setMenuItems(items || [])
      } catch (err) {
        console.error("Failed to load catalog master data:", err)
      }
    }

    loadData()
  }, [isOpen, editMenu, preloadedCompanies])

  // Filtered Buildings for Selected Company
  const filteredBuildings = useMemo(() => {
    if (!selectedCompanyId) return []
    return buildings.filter(b => b.companyId === selectedCompanyId)
  }, [buildings, selectedCompanyId])

  // Fetch Structure Assignment when Company & Building change
  useEffect(() => {
    if (!selectedCompanyId || !selectedBuildingId) {
      setStructureAssignment(null)
      return
    }

    async function fetchStructure() {
      try {
        setLoadingStructure(true)
        const assignment = await mealPlanStructureAssignmentsService.getByCompanyAndBuilding(
          selectedCompanyId,
          selectedBuildingId
        )
        setStructureAssignment(assignment)

        if (!editMenu?.masterTemplate) {
          // Initialize empty days if not editing
          const initialTpl: Record<string, any> = {}
          DAYS.forEach(d => {
            initialTpl[d] = {}
          })
          setMasterTemplate(initialTpl)
        }
      } catch (err) {
        console.error("Failed to fetch structure assignment:", err)
      } finally {
        setLoadingStructure(false)
      }
    }

    fetchStructure()
  }, [selectedCompanyId, selectedBuildingId])

  // Active Days List
  const activeDaysList = useMemo(() => {
    return workDaysMode === "5days" 
      ? ["monday", "tuesday", "wednesday", "thursday", "friday"]
      : DAYS
  }, [workDaysMode])

  // Active Day Structure from assignment
  const currentDayStructure = useMemo(() => {
    if (!structureAssignment?.weekStructure) return []
    return structureAssignment.weekStructure[activeDay] || []
  }, [structureAssignment, activeDay])

  // Unique item categories for item picker
  const itemCategories = useMemo(() => {
    const cats = new Set<string>()
    menuItems.forEach(i => {
      if (i.category) cats.add(i.category)
    })
    return ["All", ...Array.from(cats).sort()]
  }, [menuItems])

  // Filtered Menu Items for search & category
  const filteredMenuItems = useMemo(() => {
    let list = menuItems.filter(i => i.status !== "inactive")
    if (activeCategoryFilter !== "All") {
      list = list.filter(i => i.category === activeCategoryFilter)
    }
    if (itemSearchQuery.trim()) {
      const q = itemSearchQuery.toLowerCase()
      list = list.filter(i => i.name.toLowerCase().includes(q))
    }
    return list.slice(0, 30) // limit for fast rendering
  }, [menuItems, activeCategoryFilter, itemSearchQuery])

  // Count items for each day
  const getItemCountForDay = useCallback((dayKey: string) => {
    const dayData = masterTemplate[dayKey]
    if (!dayData) return 0
    let count = 0
    Object.values(dayData).forEach((serviceData: any) => {
      Object.values(serviceData || {}).forEach((subServiceData: any) => {
        Object.values(subServiceData || {}).forEach((mpData: any) => {
          Object.values(mpData || {}).forEach((cell: any) => {
            count += (cell?.menuItemIds || []).length
          })
        })
      })
    })
    return count
  }, [masterTemplate])

  // Add Item to a Cell
  const handleAddItem = (
    serviceId: string,
    subServiceId: string,
    mealPlanId: string,
    subMealPlanId: string,
    itemId: string
  ) => {
    setMasterTemplate(prev => {
      const next = { ...prev }
      if (!next[activeDay]) next[activeDay] = {}
      if (!next[activeDay][serviceId]) next[activeDay][serviceId] = {}
      if (!next[activeDay][serviceId][subServiceId]) next[activeDay][serviceId][subServiceId] = {}
      if (!next[activeDay][serviceId][subServiceId][mealPlanId]) next[activeDay][serviceId][subServiceId][mealPlanId] = {}
      
      const currentCell = next[activeDay][serviceId][subServiceId][mealPlanId][subMealPlanId] || { menuItemIds: [] }
      const currentItems: string[] = currentCell.menuItemIds || []

      if (currentItems.includes(itemId)) {
        toast({ title: "Already added", description: "This dish is already in this slot." })
        return prev
      }

      next[activeDay][serviceId][subServiceId][mealPlanId][subMealPlanId] = {
        ...currentCell,
        menuItemIds: [...currentItems, itemId]
      }
      return next
    })
  }

  // Remove Item from a Cell
  const handleRemoveItem = (
    serviceId: string,
    subServiceId: string,
    mealPlanId: string,
    subMealPlanId: string,
    itemId: string
  ) => {
    setMasterTemplate(prev => {
      const next = { ...prev }
      const cell = next[activeDay]?.[serviceId]?.[subServiceId]?.[mealPlanId]?.[subMealPlanId]
      if (!cell) return prev

      const filtered = (cell.menuItemIds || []).filter((id: string) => id !== itemId)
      next[activeDay][serviceId][subServiceId][mealPlanId][subMealPlanId] = {
        ...cell,
        menuItemIds: filtered
      }
      return next
    })
  }

  // Copy Active Day
  const handleCopyDay = () => {
    const dayData = masterTemplate[activeDay] || {}
    setCopiedDayData({
      dayName: DAY_LABELS[activeDay] || activeDay,
      data: JSON.parse(JSON.stringify(dayData))
    })
    toast({ title: "Copied!", description: `Copied ${DAY_LABELS[activeDay]} menu template.` })
  }

  // Paste into Active Day
  const handlePasteDay = () => {
    if (!copiedDayData) {
      toast({ title: "Nothing copied", description: "Please copy a day's menu first.", variant: "destructive" })
      return
    }
    setMasterTemplate(prev => ({
      ...prev,
      [activeDay]: JSON.parse(JSON.stringify(copiedDayData.data))
    }))
    toast({ title: "Pasted!", description: `Pasted ${copiedDayData.dayName} menu into ${DAY_LABELS[activeDay]}.` })
  }

  // Fill All Remaining Days with Current Day
  const handleFillAllDays = () => {
    const dayData = masterTemplate[activeDay] || {}
    if (Object.keys(dayData).length === 0) {
      toast({ title: "Empty Day", description: "Current day has no dishes to copy.", variant: "destructive" })
      return
    }
    if (!confirm(`Apply ${DAY_LABELS[activeDay]}'s menu to all other days of the week?`)) return

    setMasterTemplate(prev => {
      const next = { ...prev }
      activeDaysList.forEach(d => {
        next[d] = JSON.parse(JSON.stringify(dayData))
      })
      return next
    })
    toast({ title: "Applied!", description: `Applied ${DAY_LABELS[activeDay]} across all days.` })
  }

  // Clear Active Day
  const handleClearDay = () => {
    if (!confirm(`Are you sure you want to clear all dishes for ${DAY_LABELS[activeDay]}?`)) return
    setMasterTemplate(prev => ({
      ...prev,
      [activeDay]: {}
    }))
    toast({ title: "Cleared", description: `Cleared ${DAY_LABELS[activeDay]} menu.` })
  }

  // Calculate Calendar Dates Projection
  const monthlyProjection = useMemo(() => {
    const year = parseInt(selectedYear)
    const month = parseInt(selectedMonth)
    const totalDays = new Date(year, month + 1, 0).getDate()

    const dates: Array<{
      dateStr: string
      dayNum: number
      dayName: string
      dayKey: string
      isServingDay: boolean
      itemCount: number
    }> = []

    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(year, month, day)
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      const dayKey = d.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase()
      const isServingDay = activeDaysList.includes(dayKey)
      const itemCount = isServingDay ? getItemCountForDay(dayKey) : 0

      dates.push({
        dateStr,
        dayNum: day,
        dayName: DAY_LABELS[dayKey] || dayKey,
        dayKey,
        isServingDay,
        itemCount
      })
    }

    // Group into weeks
    const weeks: Array<typeof dates> = []
    let currentWeek: typeof dates = []
    dates.forEach(d => {
      currentWeek.push(d)
      if (d.dayKey === "sunday") {
        weeks.push(currentWeek)
        currentWeek = []
      }
    })
    if (currentWeek.length > 0) {
      weeks.push(currentWeek)
    }

    return { totalDays, dates, weeks }
  }, [selectedYear, selectedMonth, activeDaysList, getItemCountForDay])

  // Handle Publish / Save
  const handlePublishMonthlyMenu = async () => {
    if (!selectedCompanyId || !selectedBuildingId) {
      toast({ title: "Missing details", description: "Please select Company and Building.", variant: "destructive" })
      return
    }

    // Verify at least one day has items
    const totalItemsCount = activeDaysList.reduce((acc, d) => acc + getItemCountForDay(d), 0)
    if (totalItemsCount === 0) {
      toast({ title: "Empty Menu", description: "Please add dishes to at least one day of the week.", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const selectedCompany = companies.find(c => c.id === selectedCompanyId)
      const selectedBuilding = buildings.find(b => b.id === selectedBuildingId)
      const year = parseInt(selectedYear)
      const month = parseInt(selectedMonth)
      const totalDays = new Date(year, month + 1, 0).getDate()

      const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`
      const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(totalDays).padStart(2, "0")}`

      // Expand master 7-day template to daily calendar dates
      const expandedMenuData: Record<string, any> = {}
      for (let day = 1; day <= totalDays; day++) {
        const d = new Date(year, month, day)
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
        const dayKey = d.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase()

        if (activeDaysList.includes(dayKey) && masterTemplate[dayKey]) {
          expandedMenuData[dateStr] = JSON.parse(JSON.stringify(masterTemplate[dayKey]))
        }
      }

      const companyMenuPayload = {
        companyId: selectedCompany.id,
        companyName: selectedCompany.name,
        buildingId: selectedBuilding.id,
        buildingName: selectedBuilding.name,
        startDate,
        endDate,
        status: "active",
        combinedMenuId: `standalone_${selectedCompany.id}_${year}_${month + 1}`,
        isStandaloneMonthly: true,
        menuType: "recurring_monthly",
        workDaysMode,
        masterTemplate,
        menuData: expandedMenuData,
        updatedAt: serverTimestamp()
      }

      if (editMenu?.id) {
        await updateDoc(doc(db, "companyMenus", editMenu.id), companyMenuPayload)
        toast({ title: "Menu Updated!", description: `Updated standalone 4-week menu for ${selectedCompany.name}.` })
      } else {
        await addDoc(collection(db, "companyMenus"), {
          ...companyMenuPayload,
          createdAt: serverTimestamp()
        })
        toast({ 
          title: "4-Week Menu Published!", 
          description: `Successfully published 4-week repeating menu for ${selectedCompany.name} (${MONTHS.find(m => m.value === selectedMonth)?.label} ${selectedYear}).` 
        })
      }

      onSuccess?.()
      onClose()
    } catch (err) {
      console.error("Error publishing monthly menu:", err)
      toast({ title: "Failed to save", description: "An error occurred while saving.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="fixed inset-0 z-[60] flex h-screen w-screen !max-w-none flex-col gap-0 border-none bg-slate-50 p-0 shadow-none translate-x-0 translate-y-0 overflow-hidden">
        
        {/* ─── Top Header Bar ────────────────────────────────────────── */}
        <div className="px-6 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20 text-white">
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-lg font-black text-slate-900 tracking-tight">
                  {editMenu ? "Edit 4-Week Recurring Menu" : "Create 4-Week Recurring Monthly Menu"}
                </DialogTitle>
                <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px] font-bold">
                  Standalone • No Combined Conflict
                </Badge>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Design a master 7-day cycle once. System automatically expands it 4 times across the entire month.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreviewModal(!showPreviewModal)}
              className="gap-1.5 text-xs font-bold border-slate-200"
            >
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              {showPreviewModal ? "Back to Editor" : "Preview 4-Week Calendar"}
            </Button>
            <Button
              onClick={handlePublishMonthlyMenu}
              disabled={saving || !selectedCompanyId || !selectedBuildingId || !structureAssignment}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {editMenu ? "Save & Re-Deploy Month" : "Publish 4-Week Menu"}
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-slate-100">
              <X className="w-5 h-5 text-slate-400" />
            </Button>
          </div>
        </div>

        {/* ─── Scope & Month Configuration Toolbar ────────────────────── */}
        <div className="px-6 py-3 bg-white border-b border-slate-200 grid grid-cols-1 md:grid-cols-5 gap-3 shrink-0 items-center">
          
          {/* Company */}
          <SearchableDropdown
            label="Company"
            placeholder="Select Company"
            searchPlaceholder="Search company..."
            value={selectedCompanyId}
            onChange={v => {
              setSelectedCompanyId(v)
              setSelectedBuildingId("")
            }}
            options={companies.map(c => ({ id: c.id, name: c.name || "Unnamed Company" }))}
            loading={loadingInitial && companies.length === 0}
          />

          {/* Building */}
          <SearchableDropdown
            label="Building / Cafeteria"
            placeholder={!selectedCompanyId ? "Select company first" : "Select Building"}
            searchPlaceholder="Search building..."
            value={selectedBuildingId}
            onChange={setSelectedBuildingId}
            options={filteredBuildings.map(b => ({ id: b.id, name: b.name || "Unnamed Building" }))}
            disabled={!selectedCompanyId}
            loading={loadingStructure}
          />

          {/* Month */}
          <div className="space-y-1">
            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Target Month</Label>
            <div className="relative">
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="h-9 w-full appearance-none rounded-md border border-slate-200 bg-slate-50 px-3 pr-8 text-xs font-semibold text-slate-700 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer transition-all"
              >
                {MONTHS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Year */}
          <div className="space-y-1">
            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Year</Label>
            <div className="relative">
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                className="h-9 w-full appearance-none rounded-md border border-slate-200 bg-slate-50 px-3 pr-8 text-xs font-semibold text-slate-700 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer transition-all"
              >
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Operating Days Mode */}
          <div className="space-y-1">
            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Operating Schedule</Label>
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setWorkDaysMode("5days")}
                className={`flex-1 py-1 text-[11px] font-bold rounded-md transition-all ${
                  workDaysMode === "5days" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Mon – Fri (5D)
              </button>
              <button
                type="button"
                onClick={() => setWorkDaysMode("7days")}
                className={`flex-1 py-1 text-[11px] font-bold rounded-md transition-all ${
                  workDaysMode === "7days" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Mon – Sun (7D)
              </button>
            </div>
          </div>
        </div>

        {/* ─── Main Working Body ────────────────────────────────────────── */}
        <div className="flex-1 flex overflow-hidden">
          
          {loadingInitial || loadingStructure ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
              <p className="text-sm font-semibold text-slate-600">
                {loadingStructure ? "Connecting meal plan structure..." : "Loading configuration..."}
              </p>
            </div>
          ) : !selectedCompanyId || !selectedBuildingId ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4 text-blue-600">
                <Building2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Select Company and Cafeteria</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Choose a company and location at the top toolbar to begin building the 4-week repeating menu cycle.
              </p>
            </div>
          ) : !structureAssignment ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-4 text-amber-600">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">No Meal Plan Structure Assigned</h3>
              <p className="text-xs text-slate-500 max-w-md mt-1">
                This cafeteria does not have an active meal plan structure assignment configured. Please assign services and meal plans under <strong>Structure Assignment</strong> first.
              </p>
            </div>
          ) : showPreviewModal ? (
            
            /* ─── 4-WEEK CALENDAR PROJECTION PREVIEW ──────────────────── */
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50">
              <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-blue-600" />
                      4-Week Monthly Projection for {MONTHS.find(m => m.value === selectedMonth)?.label} {selectedYear}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      How your 7-day master cycle repeats across all weeks of the month.
                    </p>
                  </div>
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold text-xs">
                    {monthlyProjection.dates.filter(d => d.isServingDay).length} Serving Days Mapped
                  </Badge>
                </div>

                <div className="space-y-4">
                  {monthlyProjection.weeks.map((week, wIdx) => (
                    <div key={wIdx} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Week {wIdx + 1}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">
                          {week[0]?.dateStr} to {week[week.length - 1]?.dateStr}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                        {week.map(d => (
                          <div
                            key={d.dateStr}
                            className={`p-3 rounded-xl border text-center transition-all ${
                              !d.isServingDay
                                ? "bg-slate-50 border-slate-100 opacity-40"
                                : d.itemCount > 0
                                ? "bg-blue-50/60 border-blue-200"
                                : "bg-white border-slate-200"
                            }`}
                          >
                            <p className="text-[10px] font-bold text-slate-400 uppercase">{d.dayName.slice(0, 3)}</p>
                            <p className="text-base font-black text-slate-800 my-0.5">{d.dayNum}</p>
                            {d.isServingDay ? (
                              <Badge className={`text-[9px] px-1.5 py-0 ${d.itemCount > 0 ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                                {d.itemCount} dishes
                              </Badge>
                            ) : (
                              <span className="text-[9px] text-slate-300 font-semibold">Off Day</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          ) : (

            /* ─── MASTER 7-DAY CYCLE EDITOR ──────────────────────────── */
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
              
              {/* Day Selector Pill Tabs & Action Buttons */}
              <div className="px-6 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {activeDaysList.map(d => {
                    const count = getItemCountForDay(d)
                    const isActive = activeDay === d

                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setActiveDay(d)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                          isActive
                            ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
                        }`}
                      >
                        <span>{DAY_LABELS[d]}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                          isActive ? "bg-white/20 text-white" : count > 0 ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-500"
                        }`}>
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Day Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyDay}
                    className="h-8 gap-1.5 text-xs font-semibold border-slate-200"
                  >
                    <Copy className="w-3.5 h-3.5 text-blue-600" />
                    Copy {DAY_LABELS[activeDay]}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handlePasteDay}
                    disabled={!copiedDayData}
                    className="h-8 gap-1.5 text-xs font-semibold border-slate-200"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Paste {copiedDayData ? `(${copiedDayData.dayName})` : ""}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleFillAllDays}
                    className="h-8 gap-1.5 text-xs font-semibold border-slate-200"
                  >
                    <Repeat className="w-3.5 h-3.5 text-purple-600" />
                    Fill All Days
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearDay}
                    className="h-8 gap-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear
                  </Button>
                </div>
              </div>

              {/* Day Editor Content Area */}
              <div className="flex-1 flex overflow-hidden">
                
                {/* Center Panel: Structure Slots for Selected Day */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                  {currentDayStructure.length === 0 ? (
                    <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400">
                      <p className="font-semibold text-sm">No services assigned for {DAY_LABELS[activeDay]}.</p>
                      <p className="text-xs mt-1">This day might be an off-day in the structure assignment.</p>
                    </div>
                  ) : (
                    currentDayStructure.map((serviceEntry: any) => {
                      const service = services.find(s => s.id === serviceEntry.serviceId)

                      return (
                        <div key={serviceEntry.serviceId} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                          
                          {/* Service Header */}
                          <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <Utensils className="w-4 h-4 text-blue-400" />
                              <h4 className="font-bold text-sm tracking-wide">
                                {service?.name || "Service"}
                              </h4>
                            </div>
                            <span className="text-[11px] font-semibold text-slate-300">
                              {serviceEntry.subServices?.length || 0} Sub-Services
                            </span>
                          </div>

                          {/* Sub-Services */}
                          <div className="p-5 space-y-6">
                            {(serviceEntry.subServices || []).map((subEntry: any) => {
                              const subService = subServices.find(ss => ss.id === subEntry.subServiceId)

                              return (
                                <div key={subEntry.subServiceId} className="space-y-4">
                                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                                    <h5 className="font-bold text-xs text-slate-700">
                                      {subService?.name || "Standard Sub-Service"}
                                    </h5>
                                  </div>

                                  {/* Meal Plans Grid */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {(subEntry.mealPlans || []).map((mpEntry: any) => {
                                      const mealPlan = mealPlans.find(mp => mp.id === mpEntry.mealPlanId)

                                      return (
                                        <div key={mpEntry.mealPlanId} className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-3">
                                          <div className="flex items-center justify-between">
                                            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                              {mealPlan?.name || "Meal Plan"}
                                            </span>
                                          </div>

                                          {/* Sub Meal Plan Slots */}
                                          <div className="space-y-3">
                                            {(mpEntry.subMealPlans || []).map((smpEntry: any) => {
                                              const subMealPlan = subMealPlans.find(smp => smp.id === smpEntry.subMealPlanId)
                                              const cell = masterTemplate[activeDay]?.[serviceEntry.serviceId]?.[subEntry.subServiceId]?.[mpEntry.mealPlanId]?.[smpEntry.subMealPlanId]
                                              const selectedIds: string[] = cell?.menuItemIds || []

                                              return (
                                                <div key={smpEntry.subMealPlanId} className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                                                  <div className="flex items-center justify-between">
                                                    <span className="text-[11px] font-bold text-slate-700">
                                                      {subMealPlan?.name || "Sub-Meal Plan"}
                                                    </span>
                                                    <span className="text-[10px] font-semibold text-blue-600">
                                                      {selectedIds.length} dishes
                                                    </span>
                                                  </div>

                                                  {/* Selected Dish Chips */}
                                                  <div className="flex flex-wrap gap-1.5 min-h-[32px] p-1.5 bg-slate-50 rounded-md border border-slate-100">
                                                    {selectedIds.length === 0 ? (
                                                      <span className="text-[10px] text-slate-400 italic">No dishes added yet</span>
                                                    ) : (
                                                      selectedIds.map(itemId => {
                                                        const item = menuItems.find(mi => mi.id === itemId)

                                                        return (
                                                          <span
                                                            key={itemId}
                                                            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200"
                                                          >
                                                            <span>{item?.name || itemId}</span>
                                                            <button
                                                              type="button"
                                                              onClick={() => handleRemoveItem(
                                                                serviceEntry.serviceId,
                                                                subEntry.subServiceId,
                                                                mpEntry.mealPlanId,
                                                                smpEntry.subMealPlanId,
                                                                itemId
                                                              )}
                                                              className="text-blue-400 hover:text-red-500 rounded-full"
                                                            >
                                                              <X className="w-3 h-3" />
                                                            </button>
                                                          </span>
                                                        )
                                                      })
                                                    )}
                                                  </div>

                                                  {/* Quick Item Picker for this Cell */}
                                                  <div className="pt-1">
                                                    <select
                                                      value=""
                                                      onChange={e => {
                                                        if (e.target.value) {
                                                          handleAddItem(
                                                            serviceEntry.serviceId,
                                                            subEntry.subServiceId,
                                                            mpEntry.mealPlanId,
                                                            smpEntry.subMealPlanId,
                                                            e.target.value
                                                          )
                                                        }
                                                      }}
                                                      className="h-7 w-full rounded border border-slate-200 bg-slate-50 px-2 text-[10px] font-semibold text-slate-700 hover:bg-slate-100 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                                                    >
                                                      <option value="">+ Add dish to slot...</option>
                                                      {menuItems.filter(mi => !selectedIds.includes(mi.id)).map(mi => (
                                                        <option key={mi.id} value={mi.id}>
                                                          {mi.name} {mi.category ? `(${mi.category})` : ""}
                                                        </option>
                                                      ))}
                                                    </select>
                                                  </div>
                                                </div>
                                              )
                                            })}
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Right Sidebar: Dish Bank / Menu Item Quick Search (320px) */}
                <div className="w-[320px] bg-white border-l border-slate-200 flex flex-col shrink-0">
                  <div className="p-3.5 border-b border-slate-100 space-y-2">
                    <p className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5 text-blue-600" />
                      Menu Item Bank
                    </p>
                    <Input
                      placeholder="Search dish name..."
                      value={itemSearchQuery}
                      onChange={e => setItemSearchQuery(e.target.value)}
                      className="h-8 text-xs bg-slate-50"
                    />
                    <div className="flex gap-1 overflow-x-auto pb-1">
                      {itemCategories.slice(0, 6).map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setActiveCategoryFilter(cat)}
                          className={`text-[10px] px-2 py-0.5 rounded-md font-bold whitespace-nowrap transition-all ${
                            activeCategoryFilter === cat ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 mb-1">
                      Quick Dishes ({filteredMenuItems.length})
                    </p>
                    {filteredMenuItems.map(mi => (
                      <div
                        key={mi.id}
                        className="p-2 rounded-lg border border-slate-100 hover:border-blue-200 bg-white hover:bg-blue-50/40 transition-all flex items-center justify-between text-xs group"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-semibold text-slate-800 truncate">{mi.name}</p>
                          <p className="text-[10px] text-slate-400">{mi.category || "General"}</p>
                        </div>
                        <Badge variant="outline" className="text-[9px] text-slate-400 group-hover:text-blue-600 shrink-0">
                          Use in slot
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>

      </DialogContent>
    </Dialog>
  )
}
