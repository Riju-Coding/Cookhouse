"use client"

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { 
  Calendar, Repeat, Copy, Check, Plus, Trash2, Search, ArrowRight, 
  Sparkles, Building2, AlertCircle, Info, ChevronRight, ChevronDown, CheckCircle2, 
  Loader2, X, Eye, FileText, Layers, Utensils, RefreshCw, ClipboardPaste, 
  ClipboardCopy, GripHorizontal
} from "lucide-react"
import { db } from "@/lib/firebase"
import { collection, addDoc, doc, updateDoc, serverTimestamp, getDocs } from "firebase/firestore"
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
import { ServiceNavigationPanel } from "@/components/menu-edit-modal/service-navigation-panel"

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

// ─────────────────────────────────────────────────────────────────────────────
// Searchable Dropdown for Company & Cafeteria Selection
// ─────────────────────────────────────────────────────────────────────────────
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
      <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</Label>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-9 px-3 text-left rounded-md border text-xs font-semibold flex items-center justify-between transition-all ${
          disabled 
            ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" 
            : isOpen
            ? "bg-white border-blue-500 ring-2 ring-blue-500/20 text-gray-900 shadow-xs"
            : "bg-white border-gray-300 text-gray-800 hover:border-gray-400"
        }`}
      >
        <span className="truncate pr-2">
          {loading ? "Loading..." : selectedItem ? selectedItem.name : placeholder}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      </button>

      {isOpen && !disabled && (
        <div className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 border-b bg-gray-50">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                autoFocus
                placeholder={searchPlaceholder}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-7 pl-8 pr-2 text-xs bg-white"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto p-1 divide-y divide-gray-50">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-gray-400">
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
                  className={`w-full px-2.5 py-1.5 text-left text-xs font-medium rounded-md flex items-center justify-between transition-colors ${
                    opt.id === value 
                      ? "bg-blue-50 text-blue-700 font-bold" 
                      : "text-gray-700 hover:bg-gray-100"
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

// ─────────────────────────────────────────────────────────────────────────────
// Spreadsheet Grid Cell matching MenuEditModal style
// ─────────────────────────────────────────────────────────────────────────────
interface RecurringGridCellProps {
  dayKey: string
  serviceId: string
  subServiceId: string
  mealPlanId: string
  subMealPlanId: string
  selectedMenuItemIds: string[]
  allMenuItems: MenuItem[]
  onAddItem: (itemId: string) => void
  onCreateItem: (name: string, category: string) => Promise<{ id: string; name: string } | null>
  onRemoveItem: (itemId: string) => void
  onCopyCell: () => void
  onPasteCell: () => void
  onClearCell: () => void
  canPaste: boolean
}

function RecurringGridCell({
  dayKey,
  selectedMenuItemIds,
  allMenuItems,
  onAddItem,
  onCreateItem,
  onRemoveItem,
  onCopyCell,
  onPasteCell,
  onClearCell,
  canPaste,
}: RecurringGridCellProps) {
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [creating, setCreating] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState("All")
  const dropdownRef = useRef<HTMLDivElement>(null)

  const handleCreate = async () => {
    if (!search.trim() || creating) return
    setCreating(true)
    try {
      const categoryToUse = selectedCategory !== "All" ? selectedCategory : ""
      const createdItem = await onCreateItem(search.trim(), categoryToUse)
      if (createdItem && createdItem.id) {
        onAddItem(createdItem.id)
        setSearch("")
        setIsAddOpen(false)
      }
    } finally {
      setCreating(false)
    }
  }

  // Categories for fast filtering
  const categories = useMemo(() => {
    const cats = new Set<string>()
    allMenuItems.forEach(i => {
      if (i.category) cats.add(i.category)
    })
    return ["All", ...Array.from(cats).sort()]
  }, [allMenuItems])

  // Filtered dishes for popup
  const filteredDishes = useMemo(() => {
    let list = allMenuItems.filter(i => i.status !== "inactive" && !selectedMenuItemIds.includes(i.id))
    if (selectedCategory !== "All") {
      list = list.filter(i => i.category === selectedCategory)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(i => (i.name || "").toLowerCase().includes(q))
    }
    return list.slice(0, 35)
  }, [allMenuItems, selectedMenuItemIds, selectedCategory, search])

  // Click outside to close add popup
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsAddOpen(false)
      }
    }
    if (isAddOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isAddOpen])

  return (
    <td className="border border-gray-300 p-2 align-top min-w-[220px] max-w-[280px] bg-white hover:bg-gray-50/70 transition-colors">
      <div className="flex flex-col h-full min-h-[64px] justify-between">
        
        {/* Selected Dishes Chips */}
        <div className="space-y-1">
          {selectedMenuItemIds.map(itemId => {
            const item = allMenuItems.find(i => i.id === itemId)
            return (
              <div
                key={itemId}
                className="group relative flex items-center justify-between border px-2 py-1 rounded text-xs bg-blue-50/60 border-blue-200/80 text-gray-800 hover:bg-blue-100 transition-colors"
              >
                <span className="truncate font-medium leading-tight mr-1">
                  {item?.name || itemId}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemoveItem(itemId)
                  }}
                  className="text-gray-400 hover:text-red-600 transition-colors opacity-70 group-hover:opacity-100 shrink-0"
                  title="Remove dish"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )
          })}
          {selectedMenuItemIds.length === 0 && (
            <div className="text-[11px] text-gray-400 italic py-1 text-center">
              Empty slot
            </div>
          )}
        </div>

        {/* Cell Action Bar at Bottom */}
        <div className="mt-2 pt-1 border-t border-gray-100 flex items-center justify-between gap-1">
          {/* Add Item Popover Button */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsAddOpen(!isAddOpen)}
              className="p-1 rounded hover:bg-blue-100 text-blue-600 transition-colors flex items-center gap-1 text-[11px] font-semibold"
              title="Add dish to slot"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add</span>
            </button>

            {isAddOpen && (
              <div className="absolute left-0 top-full mt-1 w-[260px] bg-white border border-gray-200 rounded-lg shadow-2xl z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                <div className="p-2 border-b bg-gray-50 space-y-1.5">
                  <Input
                    type="text"
                    placeholder="Search dishes..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="h-7 text-xs bg-white"
                    autoFocus
                  />
                  {categories.length > 1 && (
                    <div className="flex gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                      {categories.slice(0, 5).map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedCategory(cat)}
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap transition-all ${
                            selectedCategory === cat ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="max-h-[200px] overflow-y-auto divide-y divide-gray-100">
                  {filteredDishes.length === 0 && !search.trim() ? (
                    <div className="p-3 text-center text-xs text-gray-400">
                      No available dishes found
                    </div>
                  ) : (
                    filteredDishes.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onAddItem(item.id)
                          setIsAddOpen(false)
                          setSearch("")
                        }}
                        className="w-full px-2.5 py-1.5 text-left hover:bg-blue-50 text-xs flex items-center justify-between group transition-colors"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-semibold text-gray-800 truncate">{item.name}</p>
                          <p className="text-[10px] text-gray-400">{item.category || "General"}</p>
                        </div>
                        <Plus className="h-3 w-3 text-blue-600 opacity-0 group-hover:opacity-100 shrink-0" />
                      </button>
                    ))
                  )}
                </div>

                {/* Create item if not found / search is typed */}
                {search.trim() && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCreate()
                    }}
                    disabled={creating}
                    className="w-full p-2.5 text-center text-xs text-blue-600 font-semibold hover:bg-blue-50 border-t border-gray-100 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Creating...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        <span>Create &quot;{search.trim()}&quot;</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Quick Copy / Paste / Clear Cell Controls */}
          <div className="flex items-center gap-0.5 text-gray-500">
            <button
              type="button"
              onClick={onCopyCell}
              disabled={selectedMenuItemIds.length === 0}
              className={`p-1 rounded transition-colors ${selectedMenuItemIds.length > 0 ? "hover:bg-gray-200 text-gray-600" : "text-gray-300"}`}
              title="Copy cell dishes"
            >
              <Copy className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={onPasteCell}
              disabled={!canPaste}
              className={`p-1 rounded transition-colors ${canPaste ? "hover:bg-blue-100 text-blue-600" : "text-gray-300"}`}
              title="Paste dishes into cell"
            >
              <ClipboardPaste className="h-3 w-3" />
            </button>
            {selectedMenuItemIds.length > 0 && (
              <button
                type="button"
                onClick={onClearCell}
                className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                title="Clear slot"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

      </div>
    </td>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Recurring Monthly Menu Modal Component
// ─────────────────────────────────────────────────────────────────────────────
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

  // Service Navigation State (Identical to MenuEditModal)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedSubService, setSelectedSubService] = useState<SubService | null>(null)

  // Loading States
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [loadingStructure, setLoadingStructure] = useState(false)
  const [saving, setSaving] = useState(false)

  // Master Template State: { [dayKey: string]: { [serviceId]: { [subServiceId]: { [mealPlanId]: { [subMealPlanId]: { menuItemIds: string[] } } } } } }
  const [masterTemplate, setMasterTemplate] = useState<Record<string, any>>({})

  // Clipboard Buffers
  const [copiedDayData, setCopiedDayData] = useState<{ dayName: string; data: any } | null>(null)
  const [copiedCellBuffer, setCopiedCellBuffer] = useState<string[] | null>(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)

  // Load Initial Master Data
  useEffect(() => {
    if (!isOpen) return

    if (preloadedCompanies && preloadedCompanies.length > 0) {
      setCompanies(preloadedCompanies)
    }

    async function loadData() {
      try {
        setLoadingInitial(true)

        const [compsRes, bldgsRes] = await Promise.allSettled([
          companiesService.getAll().catch(async () => {
            const snap = await getDocs(collection(db, "companies"))
            return snap.docs.map(d => ({ id: d.id, ...d.data() }))
          }),
          buildingsService.getAll().catch(async () => {
            const snap = await getDocs(collection(db, "buildings"))
            return snap.docs.map(d => ({ id: d.id, ...d.data() }))
          })
        ])

        const loadedComps = compsRes.status === "fulfilled" && Array.isArray(compsRes.value) ? compsRes.value : []
        const loadedBldgs = bldgsRes.status === "fulfilled" && Array.isArray(bldgsRes.value) ? bldgsRes.value : []

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
          if (editMenu.workDaysMode) {
            setWorkDaysMode(editMenu.workDaysMode)
          }
          if (editMenu.masterTemplate) {
            setMasterTemplate(editMenu.masterTemplate)
          } else if (editMenu.menuData) {
            // Reconstruct template if only expanded menuData exists
            const reconstructed: Record<string, any> = {}
            Object.keys(editMenu.menuData).forEach(dateStr => {
              const d = new Date(dateStr)
              const dayKey = d.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase()
              if (!reconstructed[dayKey]) {
                reconstructed[dayKey] = JSON.parse(JSON.stringify(editMenu.menuData[dateStr]))
              }
            })
            setMasterTemplate(reconstructed)
          }
        }
      } catch (err) {
        console.error("Failed to load initial companies/buildings:", err)
      } finally {
        setLoadingInitial(false)
      }

      // Catalog Data
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

        if (!editMenu?.masterTemplate && Object.keys(masterTemplate).length === 0) {
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
  }, [selectedCompanyId, selectedBuildingId, editMenu])

  // Active Days List based on 5-Day vs 7-Day schedule
  const activeDaysList = useMemo(() => {
    return workDaysMode === "5days" 
      ? ["monday", "tuesday", "wednesday", "thursday", "friday"]
      : DAYS
  }, [workDaysMode])

  // Compute Available Services for the cafeteria
  const availableServices = useMemo(() => {
    let list = services.filter(s => s.status === "active").sort((a, b) => (a.order || 999) - (b.order || 999))
    if (structureAssignment?.weekStructure) {
      const allowedServiceIds = new Set<string>()
      Object.values(structureAssignment.weekStructure).forEach((daySvcs: any) => {
        if (Array.isArray(daySvcs)) {
          daySvcs.forEach((s: any) => allowedServiceIds.add(s.serviceId))
        }
      })
      if (allowedServiceIds.size > 0) {
        const filtered = list.filter(s => allowedServiceIds.has(s.id))
        if (filtered.length > 0) list = filtered
      }
    }
    return list
  }, [services, structureAssignment])

  // Compute SubServices Map for each Service
  const subServicesMap = useMemo(() => {
    const map = new Map<string, SubService[]>()
    services.forEach(s => {
      let sSubs = subServices.filter(ss => ss.serviceId === s.id && ss.status === "active")
        .sort((a, b) => (a.order || 999) - (b.order || 999))

      if (structureAssignment?.weekStructure) {
        const allowedSubIds = new Set<string>()
        Object.values(structureAssignment.weekStructure).forEach((daySvcs: any) => {
          if (Array.isArray(daySvcs)) {
            daySvcs.forEach((srv: any) => {
              if (srv.serviceId === s.id && Array.isArray(srv.subServices)) {
                srv.subServices.forEach((ss: any) => allowedSubIds.add(ss.subServiceId))
              }
            })
          }
        })
        if (allowedSubIds.size > 0) {
          const filtered = sSubs.filter(ss => allowedSubIds.has(ss.id))
          if (filtered.length > 0) sSubs = filtered
        }
      }

      map.set(s.id, sSubs)
    })
    return map
  }, [services, subServices, structureAssignment])

  // Synchronize Selected Service & SubService
  useEffect(() => {
    if (availableServices.length > 0) {
      if (!selectedService || !availableServices.some(s => s.id === selectedService.id)) {
        const defaultService = availableServices[0]
        setSelectedService(defaultService)
        const subs = subServicesMap.get(defaultService.id) || []
        setSelectedSubService(subs[0] || null)
      }
    } else {
      setSelectedService(null)
      setSelectedSubService(null)
    }
  }, [availableServices, subServicesMap, selectedService])

  const handleSelectService = (service: Service) => {
    setSelectedService(service)
    const subs = subServicesMap.get(service.id) || []
    setSelectedSubService(subs[0] || null)
  }

  const handleSelectSubService = (subService: SubService) => {
    setSelectedSubService(subService)
  }

  // Compute Filtered Meal Plan Structure Rows (Exactly matching MenuEditModal)
  const filteredMealPlanStructure = useMemo(() => {
    if (!selectedService || !selectedSubService) return []

    // Collect all (mealPlanId, subMealPlanId) defined in structureAssignment for this service/subservice
    const assignedPairs = new Set<string>()
    let hasAnyAssignmentsInStructure = false

    if (structureAssignment?.weekStructure) {
      Object.values(structureAssignment.weekStructure).forEach((dayServices: any) => {
        if (Array.isArray(dayServices)) {
          dayServices.forEach((s: any) => {
            if (s.serviceId === selectedService.id && Array.isArray(s.subServices)) {
              s.subServices.forEach((ss: any) => {
                if (ss.subServiceId === selectedSubService.id && Array.isArray(ss.mealPlans)) {
                  hasAnyAssignmentsInStructure = true
                  ss.mealPlans.forEach((mp: any) => {
                    if (Array.isArray(mp.subMealPlans)) {
                      mp.subMealPlans.forEach((smp: any) => {
                        assignedPairs.add(`${mp.mealPlanId}-${smp.subMealPlanId}`)
                      })
                    }
                  })
                }
              })
            }
          })
        }
      })
    }

    // Also include any meal plan / sub meal plan that has dishes in masterTemplate
    Object.values(masterTemplate).forEach((dayData: any) => {
      const sData = dayData?.[selectedService.id]?.[selectedSubService.id]
      if (sData) {
        Object.keys(sData).forEach(mpId => {
          Object.keys(sData[mpId] || {}).forEach(smpId => {
            if ((sData[mpId][smpId]?.menuItemIds || []).length > 0) {
              assignedPairs.add(`${mpId}-${smpId}`)
            }
          })
        })
      }
    })

    return mealPlans.map((mp) => {
      const relevantSubMPs = subMealPlans.filter((smp) => {
        if (smp.mealPlanId !== mp.id) return false
        // If cafeteria has no specific assignments in structure, show all so user can build menu
        if (!hasAnyAssignmentsInStructure) return true
        return assignedPairs.has(`${mp.id}-${smp.id}`)
      }).sort((a, b) => (a.order || 999) - (b.order || 999))

      return {
        mealPlan: mp,
        subMealPlans: relevantSubMPs
      }
    }).filter(group => group.subMealPlans.length > 0)
  }, [selectedService, selectedSubService, structureAssignment, masterTemplate, mealPlans, subMealPlans])

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

  // Count items for a day under current selected Service and SubService
  const getItemCountForDayAndService = useCallback((dayKey: string, serviceId?: string, subServiceId?: string) => {
    if (!serviceId || !subServiceId) return 0
    const subData = masterTemplate[dayKey]?.[serviceId]?.[subServiceId]
    if (!subData) return 0
    let count = 0
    Object.values(subData).forEach((mpData: any) => {
      Object.values(mpData || {}).forEach((cell: any) => {
        count += (cell?.menuItemIds || []).length
      })
    })
    return count
  }, [masterTemplate])

  // Create New Item when not found in search
  const handleCreateItem = useCallback(async (name: string, category: string) => {
    try {
      const newItemRef = await addDoc(collection(db, "menuItems"), {
        name,
        category: category || "",
        status: "active",
        order: 999,
        createdAt: serverTimestamp()
      })
      const newItem: MenuItem = { 
        id: newItemRef.id, 
        name, 
        category: category || "", 
        status: "active", 
        order: 999 
      }
      setMenuItems((prev) => [...prev, newItem])
      toast({ title: "Success", description: `Menu item "${name}" created successfully` })
      return { id: newItem.id, name: newItem.name }
    } catch (error) {
      console.error("Error creating menu item:", error)
      toast({ title: "Error", description: "Failed to create menu item", variant: "destructive" })
      return null
    }
  }, [])

  // Add Item to a Cell
  const handleAddItem = (
    dayKey: string,
    serviceId: string,
    subServiceId: string,
    mealPlanId: string,
    subMealPlanId: string,
    itemId: string
  ) => {
    setMasterTemplate(prev => {
      const next = { ...prev }
      if (!next[dayKey]) next[dayKey] = {}
      if (!next[dayKey][serviceId]) next[dayKey][serviceId] = {}
      if (!next[dayKey][serviceId][subServiceId]) next[dayKey][serviceId][subServiceId] = {}
      if (!next[dayKey][serviceId][subServiceId][mealPlanId]) next[dayKey][serviceId][subServiceId][mealPlanId] = {}
      
      const currentCell = next[dayKey][serviceId][subServiceId][mealPlanId][subMealPlanId] || { menuItemIds: [] }
      const currentItems: string[] = currentCell.menuItemIds || []

      if (currentItems.includes(itemId)) {
        toast({ title: "Already added", description: "This dish is already in this slot." })
        return prev
      }

      next[dayKey][serviceId][subServiceId][mealPlanId][subMealPlanId] = {
        ...currentCell,
        menuItemIds: [...currentItems, itemId]
      }
      return next
    })
  }

  // Remove Item from a Cell
  const handleRemoveItem = (
    dayKey: string,
    serviceId: string,
    subServiceId: string,
    mealPlanId: string,
    subMealPlanId: string,
    itemId: string
  ) => {
    setMasterTemplate(prev => {
      const next = { ...prev }
      const cell = next[dayKey]?.[serviceId]?.[subServiceId]?.[mealPlanId]?.[subMealPlanId]
      if (!cell) return prev

      const filtered = (cell.menuItemIds || []).filter((id: string) => id !== itemId)
      next[dayKey][serviceId][subServiceId][mealPlanId][subMealPlanId] = {
        ...cell,
        menuItemIds: filtered
      }
      return next
    })
  }

  // Cell Copy / Paste / Clear Handlers
  const handleCopyCell = (itemIds: string[]) => {
    if (!itemIds || itemIds.length === 0) return
    setCopiedCellBuffer([...itemIds])
    toast({ title: "Dishes Copied", description: `${itemIds.length} dishes copied to clipboard.` })
  }

  const handlePasteCell = (
    dayKey: string,
    serviceId: string,
    subServiceId: string,
    mealPlanId: string,
    subMealPlanId: string
  ) => {
    if (!copiedCellBuffer || copiedCellBuffer.length === 0) return
    setMasterTemplate(prev => {
      const next = { ...prev }
      if (!next[dayKey]) next[dayKey] = {}
      if (!next[dayKey][serviceId]) next[dayKey][serviceId] = {}
      if (!next[dayKey][serviceId][subServiceId]) next[dayKey][serviceId][subServiceId] = {}
      if (!next[dayKey][serviceId][subServiceId][mealPlanId]) next[dayKey][serviceId][subServiceId][mealPlanId] = {}

      const currentCell = next[dayKey][serviceId][subServiceId][mealPlanId][subMealPlanId] || { menuItemIds: [] }
      const merged = Array.from(new Set([...(currentCell.menuItemIds || []), ...copiedCellBuffer]))

      next[dayKey][serviceId][subServiceId][mealPlanId][subMealPlanId] = {
        ...currentCell,
        menuItemIds: merged
      }
      return next
    })
    toast({ title: "Dishes Pasted", description: `${copiedCellBuffer.length} dishes pasted.` })
  }

  const handleClearCell = (
    dayKey: string,
    serviceId: string,
    subServiceId: string,
    mealPlanId: string,
    subMealPlanId: string
  ) => {
    setMasterTemplate(prev => {
      const next = { ...prev }
      if (next[dayKey]?.[serviceId]?.[subServiceId]?.[mealPlanId]?.[subMealPlanId]) {
        next[dayKey][serviceId][subServiceId][mealPlanId][subMealPlanId] = {
          ...next[dayKey][serviceId][subServiceId][mealPlanId][subMealPlanId],
          menuItemIds: []
        }
      }
      return next
    })
  }

  // Day Copy / Paste / Fill / Clear Handlers
  const handleCopyDay = (dayKey: string) => {
    const dayData = masterTemplate[dayKey] || {}
    setCopiedDayData({
      dayName: DAY_LABELS[dayKey] || dayKey,
      data: JSON.parse(JSON.stringify(dayData))
    })
    toast({ title: "Day Copied", description: `Copied all dishes from ${DAY_LABELS[dayKey]}.` })
  }

  const handlePasteDay = (targetDayKey: string) => {
    if (!copiedDayData) {
      toast({ title: "Nothing copied", description: "Please copy a day first.", variant: "destructive" })
      return
    }
    setMasterTemplate(prev => ({
      ...prev,
      [targetDayKey]: JSON.parse(JSON.stringify(copiedDayData.data))
    }))
    toast({ title: "Day Pasted", description: `Pasted ${copiedDayData.dayName} into ${DAY_LABELS[targetDayKey]}.` })
  }

  const handleFillAllFromDay = (sourceDayKey: string) => {
    const dayData = masterTemplate[sourceDayKey] || {}
    if (Object.keys(dayData).length === 0) {
      toast({ title: "Empty Day", description: `${DAY_LABELS[sourceDayKey]} has no dishes to copy.`, variant: "destructive" })
      return
    }
    if (!confirm(`Apply ${DAY_LABELS[sourceDayKey]}'s menu to all days of the week?`)) return

    setMasterTemplate(prev => {
      const next = { ...prev }
      activeDaysList.forEach(d => {
        next[d] = JSON.parse(JSON.stringify(dayData))
      })
      return next
    })
    toast({ title: "All Days Filled", description: `Applied ${DAY_LABELS[sourceDayKey]} across all active days.` })
  }

  const handleClearDay = (dayKey: string) => {
    if (!confirm(`Are you sure you want to clear all dishes for ${DAY_LABELS[dayKey]}?`)) return
    setMasterTemplate(prev => ({
      ...prev,
      [dayKey]: {}
    }))
    toast({ title: "Day Cleared", description: `Cleared ${DAY_LABELS[dayKey]}.` })
  }

  // Calendar Dates Projection for 4-Week Preview
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

  // Publish / Save 4-Week Recurring Menu
  const handlePublishMonthlyMenu = async () => {
    if (!selectedCompanyId || !selectedBuildingId) {
      toast({ title: "Missing details", description: "Please select Company and Cafeteria.", variant: "destructive" })
      return
    }

    const totalItemsCount = activeDaysList.reduce((acc, d) => acc + getItemCountForDay(d), 0)
    if (totalItemsCount === 0) {
      toast({ title: "Empty Menu", description: "Please add dishes to at least one day in the cycle.", variant: "destructive" })
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

      // Expand master template across all calendar dates of the month
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
        toast({ title: "Menu Updated!", description: `Updated 4-week recurring menu for ${selectedCompany.name}.` })
      } else {
        await addDoc(collection(db, "companyMenus"), {
          ...companyMenuPayload,
          createdAt: serverTimestamp()
        })
        toast({ 
          title: "4-Week Menu Published!", 
          description: `Successfully published 4-week recurring menu for ${selectedCompany.name} (${MONTHS.find(m => m.value === selectedMonth)?.label} ${selectedYear}).` 
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

  if (!isOpen) return null

  const selectedCompany = companies.find(c => c.id === selectedCompanyId)
  const selectedBuilding = buildings.find(b => b.id === selectedBuildingId)

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center overflow-hidden">
      <div className="bg-white shadow-2xl w-full h-full flex flex-col relative overflow-hidden">
        
        {/* ─── Top Header (Exact MenuEditModal Design) ───────────────── */}
        <div className="border-b p-4 flex-none flex items-center justify-between bg-white z-40">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-2xl font-bold">
                  {editMenu ? "Edit" : "Create"} 4-Week Recurring Menu
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
                  <Repeat className="h-3.5 w-3.5 text-blue-700" />
                  4-Week Recurring
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300">
                  Standalone Company Menu
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {selectedCompany ? selectedCompany.name : "Select Company"} • {selectedBuilding ? selectedBuilding.name : "Select Cafeteria"} • {MONTHS.find(m => m.value === selectedMonth)?.label} {selectedYear} ({workDaysMode === "5days" ? "5-Day Mon–Fri" : "7-Day Mon–Sun"})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Clipboard Buffers Badges */}
            {copiedDayData && (
              <div className="flex items-center gap-2 px-3 py-1 border border-yellow-300 rounded bg-yellow-50 text-xs font-semibold text-yellow-800">
                <span>Day Copied: {copiedDayData.dayName}</span>
                <button 
                  type="button" 
                  onClick={() => setCopiedDayData(null)} 
                  className="text-yellow-600 hover:text-yellow-900"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {copiedCellBuffer && (
              <div className="flex items-center gap-2 px-3 py-1 border border-blue-300 rounded bg-blue-50 text-xs font-semibold text-blue-800">
                <span>{copiedCellBuffer.length} Dishes Copied</span>
                <button 
                  type="button" 
                  onClick={() => setCopiedCellBuffer(null)} 
                  className="text-blue-600 hover:text-blue-900"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPreviewModal(!showPreviewModal)}
              className="h-9 px-3 gap-2 text-xs font-medium border-gray-300 hover:bg-gray-50"
            >
              <Calendar className="h-4 w-4 text-blue-600" />
              <span>{showPreviewModal ? "Back to Grid Editor" : "Preview 4-Week Calendar"}</span>
            </Button>

            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 p-1" title="Close">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* ─── Scope & Schedule Configuration Toolbar ────────────────── */}
        <div className="border-b px-4 py-2.5 bg-gray-50/70 flex flex-wrap items-center gap-4 shrink-0">
          {/* Company */}
          <div className="w-60">
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
          </div>

          {/* Building / Cafeteria */}
          <div className="w-60">
            <SearchableDropdown
              label="Cafeteria / Location"
              placeholder={!selectedCompanyId ? "Select company first" : "Select Cafeteria"}
              searchPlaceholder="Search building..."
              value={selectedBuildingId}
              onChange={setSelectedBuildingId}
              options={filteredBuildings.map(b => ({ id: b.id, name: b.name || "Unnamed Location" }))}
              disabled={!selectedCompanyId}
              loading={loadingStructure}
            />
          </div>

          {/* Target Month */}
          <div className="w-36 space-y-1">
            <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Target Month</Label>
            <div className="relative">
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="h-9 w-full appearance-none rounded-md border border-gray-300 bg-white px-3 pr-8 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {MONTHS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Target Year */}
          <div className="w-28 space-y-1">
            <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Year</Label>
            <div className="relative">
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                className="h-9 w-full appearance-none rounded-md border border-gray-300 bg-white px-3 pr-8 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Operating Schedule */}
          <div className="w-56 space-y-1">
            <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Operating Schedule</Label>
            <div className="flex bg-gray-200 p-0.5 rounded-lg border border-gray-300">
              <button
                type="button"
                onClick={() => setWorkDaysMode("5days")}
                className={`flex-1 py-1 text-[11px] font-bold rounded-md transition-all ${
                  workDaysMode === "5days" ? "bg-white text-blue-600 shadow-xs" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Mon – Fri (5D)
              </button>
              <button
                type="button"
                onClick={() => setWorkDaysMode("7days")}
                className={`flex-1 py-1 text-[11px] font-bold rounded-md transition-all ${
                  workDaysMode === "7days" ? "bg-white text-blue-600 shadow-xs" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Mon – Sun (7D)
              </button>
            </div>
          </div>
        </div>

        {/* ─── Service Navigation Panel (Exact MenuEditModal Bar) ────── */}
        {selectedCompanyId && selectedBuildingId && (
          <div className="bg-white sticky top-0 z-30 shadow-xs">
            <ServiceNavigationPanel
              services={availableServices}
              subServices={subServicesMap}
              selectedService={selectedService}
              selectedSubService={selectedSubService}
              onSelectService={handleSelectService}
              onSelectSubService={handleSelectSubService}
            />
          </div>
        )}

        {/* ─── Main Content Area ─────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50/50">
          
          {loadingInitial || loadingStructure ? (
            <div className="p-12 space-y-4 flex flex-col items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
              <p className="text-sm font-semibold text-gray-600">
                {loadingStructure ? "Connecting cafeteria meal plan structure..." : "Loading configuration..."}
              </p>
            </div>
          ) : !selectedCompanyId || !selectedBuildingId ? (
            <div className="p-16 flex flex-col items-center justify-center text-center h-full">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4 text-blue-600">
                <Building2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-gray-800">Select Company and Cafeteria</h3>
              <p className="text-xs text-gray-400 max-w-sm mt-1">
                Choose a company and cafeteria location above to build the 4-week repeating cycle matrix.
              </p>
            </div>
          ) : showPreviewModal ? (
            
            /* ─── 4-WEEK CALENDAR PROJECTION PREVIEW ──────────────────── */
            <div className="p-6 overflow-y-auto max-w-6xl mx-auto space-y-6">
              <div className="flex items-center justify-between bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
                <div>
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    4-Week Monthly Projection for {MONTHS.find(m => m.value === selectedMonth)?.label} {selectedYear}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    How your recurring cycle repeats across all weeks of the target month.
                  </p>
                </div>
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold text-xs">
                  {monthlyProjection.dates.filter(d => d.isServingDay).length} Serving Days Mapped
                </Badge>
              </div>

              <div className="space-y-4">
                {monthlyProjection.weeks.map((week, wIdx) => (
                  <div key={wIdx} className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
                      <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Week {wIdx + 1}
                      </span>
                      <span className="text-[11px] text-gray-400 font-medium">
                        {week[0]?.dateStr} to {week[week.length - 1]?.dateStr}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                      {week.map(d => (
                        <div
                          key={d.dateStr}
                          className={`p-3 rounded-lg border text-center transition-all ${
                            !d.isServingDay
                              ? "bg-gray-50 border-gray-100 opacity-40"
                              : d.itemCount > 0
                              ? "bg-blue-50/60 border-blue-200"
                              : "bg-white border-gray-200"
                          }`}
                        >
                          <p className="text-[10px] font-bold text-gray-400 uppercase">{d.dayName.slice(0, 3)}</p>
                          <p className="text-base font-black text-gray-800 my-0.5">{d.dayNum}</p>
                          {d.isServingDay ? (
                            <Badge className={`text-[9px] px-1.5 py-0 ${d.itemCount > 0 ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"}`}>
                              {d.itemCount} dishes
                            </Badge>
                          ) : (
                            <span className="text-[9px] text-gray-300 font-semibold">Off Day</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          ) : selectedService && selectedSubService ? (

            /* ─── SPREADSHEET MATRIX TABLE GRID (Exact MenuEditModal Grid) ─ */
            <div className="p-4 flex-1">
              <div className="border rounded bg-white shadow-xs pb-12">
                <table className="w-full border-collapse">
                  
                  {/* Table Header: Days of the Cycle */}
                  <thead className="bg-gray-100 sticky top-0 z-20 shadow-xs">
                    <tr>
                      <th className="border border-gray-300 p-2 sticky left-0 z-30 bg-gray-100 min-w-[200px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-left font-bold text-sm text-gray-800">
                        Meal Plan / Sub Meal
                      </th>
                      {activeDaysList.map(dayKey => {
                        const dayItemCount = getItemCountForDayAndService(dayKey, selectedService?.id, selectedSubService?.id)

                        return (
                          <th key={dayKey} className="border border-gray-300 p-2 min-w-[240px] text-left bg-gray-100">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <div className="font-semibold text-gray-900 text-sm">
                                  {DAY_LABELS[dayKey]}
                                </div>
                                <div className="text-xs text-gray-500 font-normal">
                                  {dayItemCount} dishes in {selectedService.name}
                                </div>
                              </div>
                              
                              {/* Day-Level Quick Actions */}
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleCopyDay(dayKey)}
                                  className="p-1 rounded hover:bg-gray-200 text-gray-600 transition-colors"
                                  title={`Copy all dishes from ${DAY_LABELS[dayKey]}`}
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePasteDay(dayKey)}
                                  disabled={!copiedDayData}
                                  className={`p-1 rounded transition-colors ${copiedDayData ? "hover:bg-blue-100 text-blue-600" : "text-gray-300 cursor-not-allowed"}`}
                                  title={`Paste into ${DAY_LABELS[dayKey]}`}
                                >
                                  <ClipboardPaste className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleFillAllFromDay(dayKey)}
                                  className="p-1 rounded hover:bg-purple-100 text-purple-600 transition-colors"
                                  title={`Fill all days of week with ${DAY_LABELS[dayKey]}`}
                                >
                                  <Repeat className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleClearDay(dayKey)}
                                  className="p-1 rounded hover:bg-red-100 text-red-500 transition-colors"
                                  title={`Clear ${DAY_LABELS[dayKey]}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>

                  {/* Table Body: Meal Plan & Sub Meal Plan Rows */}
                  <tbody>
                    {filteredMealPlanStructure.length === 0 ? (
                      <tr>
                        <td 
                          colSpan={activeDaysList.length + 1} 
                          className="p-12 text-center text-gray-400 text-sm italic"
                        >
                          No meal plan slots assigned for {selectedService.name} - {selectedSubService.name}.
                        </td>
                      </tr>
                    ) : (
                      filteredMealPlanStructure.map(({ mealPlan, subMealPlans: subMPs }) =>
                        subMPs.map((subMealPlan, idx) => {
                          return (
                            <tr
                              key={`${mealPlan.id}-${subMealPlan.id}`}
                              className="transition-colors border-b hover:bg-gray-50/50"
                            >
                              {/* Sticky Left Row Header */}
                              <td className="border-r border-gray-300 p-2 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] align-top bg-gray-200">
                                {idx === 0 && (
                                  <div className="font-bold text-blue-700 mb-1">
                                    {mealPlan.name}
                                  </div>
                                )}
                                <div className="text-sm text-gray-700 ml-3 font-medium flex items-center gap-2">
                                  ↳ {subMealPlan.name}
                                </div>
                              </td>

                              {/* Matrix Day Cells */}
                              {activeDaysList.map(dayKey => {
                                const cell = masterTemplate[dayKey]?.[selectedService.id]?.[selectedSubService.id]?.[mealPlan.id]?.[subMealPlan.id]
                                const selectedMenuItemIds = cell?.menuItemIds || []

                                return (
                                  <RecurringGridCell
                                    key={dayKey}
                                    dayKey={dayKey}
                                    serviceId={selectedService.id}
                                    subServiceId={selectedSubService.id}
                                    mealPlanId={mealPlan.id}
                                    subMealPlanId={subMealPlan.id}
                                    selectedMenuItemIds={selectedMenuItemIds}
                                    allMenuItems={menuItems}
                                    onAddItem={(itemId) => handleAddItem(dayKey, selectedService.id, selectedSubService.id, mealPlan.id, subMealPlan.id, itemId)}
                                    onCreateItem={handleCreateItem}
                                    onRemoveItem={(itemId) => handleRemoveItem(dayKey, selectedService.id, selectedSubService.id, mealPlan.id, subMealPlan.id, itemId)}
                                    onCopyCell={() => handleCopyCell(selectedMenuItemIds)}
                                    onPasteCell={() => handlePasteCell(dayKey, selectedService.id, selectedSubService.id, mealPlan.id, subMealPlan.id)}
                                    onClearCell={() => handleClearCell(dayKey, selectedService.id, selectedSubService.id, mealPlan.id, subMealPlan.id)}
                                    canPaste={Boolean(copiedCellBuffer && copiedCellBuffer.length > 0)}
                                  />
                                )
                              })}
                            </tr>
                          )
                        })
                      )
                    )}
                  </tbody>

                </table>
              </div>
            </div>

          ) : (
            <div className="p-16 flex flex-col items-center justify-center text-center h-full">
              <p className="text-gray-400 text-sm">Please select a service above.</p>
            </div>
          )}

        </div>

        {/* ─── Bottom Footer Bar (Exact MenuEditModal Style) ─────────── */}
        <div className="border-t p-4 flex-none flex items-center justify-between bg-white z-40">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600 font-medium">
              4-Week Cycle will be published for <strong>{MONTHS.find(m => m.value === selectedMonth)?.label} {selectedYear}</strong> ({monthlyProjection.dates.filter(d => d.isServingDay).length} serving days total across all weeks)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPreviewModal(!showPreviewModal)}
              className="border-blue-300 text-blue-700 hover:bg-blue-50 text-xs font-semibold"
            >
              <Calendar className="h-4 w-4 mr-1.5" />
              {showPreviewModal ? "Back to Grid Editor" : "Preview 4-Week Calendar"}
            </Button>
            <Button variant="outline" onClick={onClose} disabled={saving} className="text-xs font-semibold">
              Cancel
            </Button>
            <Button
              onClick={handlePublishMonthlyMenu}
              disabled={saving || !selectedCompanyId || !selectedBuildingId}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-xs text-xs font-bold gap-1.5"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  {editMenu ? "Saving..." : "Publishing..."}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-1" />
                  {editMenu ? "Save & Re-Deploy Month" : "Publish 4-Week Menu"}
                </>
              )}
            </Button>
          </div>
        </div>

      </div>
    </div>
  )
}
