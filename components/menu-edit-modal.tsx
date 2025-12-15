"use client"

import { useState, useEffect, useCallback, useMemo, memo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Loader2, 
  Save, 
  X, 
  Search, 
  ChevronRight, 
  AlertCircle, 
  ChevronDown 
} from 'lucide-react'
import { toast } from "@/hooks/use-toast"
import type { Service, MealPlan, SubMealPlan, MenuItem, SubService } from "@/lib/types"
import {
  servicesService,
  subServicesService,
  mealPlansService,
  subMealPlansService,
  structureAssignmentsService,
  mealPlanStructureAssignmentsService,
  menuItemsService,
  updationService,
  repetitionLogsService,
  companiesService,
  buildingsService,
  clearCacheKey,
} from "@/lib/services"
import { collection, getDocs, doc, getDoc, updateDoc, addDoc, query, where, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { detectMenuChanges, createChangeSummary } from "@/lib/change-detector"

// --- Helper Components ---

const CompanyAssignmentModal = memo(function CompanyAssignmentModal({
  isOpen,
  onClose,
  mealPlan,
  subMealPlan,
  service,
  selectedSubService,
  companies,
  buildings,
  structureAssignments,
  date,
  day,
}: {
  isOpen: boolean
  onClose: () => void
  mealPlan: MealPlan
  subMealPlan: SubMealPlan
  service: Service
  selectedSubService: SubService
  companies: any[]
  buildings: any[]
  structureAssignments: any[]
  date: string
  day: string
}) {
  const assignedCompanies = useMemo(() => {
    const result: any[] = []
    structureAssignments.forEach((assignment: any) => {
      const company = companies.find((c: any) => c.id === assignment.companyId)
      const building = buildings.find((b: any) => b.id === assignment.buildingId)
      if (!company || !building) return
      const dayKey = day.toLowerCase()
      const dayStructure = assignment.weekStructure?.[dayKey] || []
      const serviceInDay = dayStructure.find((s: any) => s.serviceId === service.id)
      if (!serviceInDay) return
      const subServiceInDay = serviceInDay.subServices?.find((ss: any) => ss.subServiceId === selectedSubService.id)
      if (!subServiceInDay) return
      const mealPlanInDay = subServiceInDay.mealPlans?.find((mp: any) => mp.mealPlanId === mealPlan.id)
      if (!mealPlanInDay) return
      const subMealPlanInDay = mealPlanInDay.subMealPlans?.find((smp: any) => smp.subMealPlanId === subMealPlan.id)
      if (!subMealPlanInDay) return
      result.push({
        companyId: company.id,
        companyName: company.name,
        buildingId: building.id,
        buildingName: building.name,
        day,
      })
    })
    return result
  }, [mealPlan, subMealPlan, service, selectedSubService, companies, buildings, structureAssignments, date, day])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-auto shadow-2xl">
        <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-white border-b p-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">
              {service.name} → {subMealPlan.name}
            </h3>
            <p className="text-sm text-gray-600">
              {new Date(date).toLocaleDateString()} ({day})
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" type="button">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4">
          {assignedCompanies.length === 0 ? (
            <p className="text-sm text-gray-500">No companies assigned for this combination on {day}</p>
          ) : (
            <div className="space-y-2">
              {assignedCompanies.map((comp, idx) => (
                <div key={idx} className="p-3 border rounded bg-blue-50">
                  <div className="font-medium text-sm">{comp.companyName}</div>
                  <div className="text-xs text-gray-600">{comp.buildingName}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

interface MenuEditModalProps {
  isOpen: boolean
  onClose: () => void
  menuId: string
  menuType: "combined" | "company"
  onSave?: () => void
  preloadedMenuItems?: MenuItem[]
}

interface MenuData {
  startDate: string
  endDate: string
  status: string
  menuData?: any
  companyId?: string
  buildingId?: string
  [key: string]: any
}

// --- Menu Cell Component ---
const MenuCell = memo(function MenuCell({
  cellKey,
  selectedItems,
  allItems,
  onAdd,
  onRemove,
  onCreateItem,
  date,
  prevItems,
  onCopy,
  onPaste,
  canPaste,
  onStartDrag,
  onHoverDrag,
  isDragActive,
  isDragHover,
  onViewCompanies,
}: {
  cellKey: string
  selectedItems: string[]
  allItems: MenuItem[]
  onAdd: (itemId: string) => void
  onRemove: (itemId: string) => void
  onCreateItem: (name: string, category: string) => Promise<void>
  date: string
  prevItems?: string[]
  onCopy?: () => void
  onPaste?: () => void
  canPaste?: boolean
  onStartDrag?: (items: string[]) => void
  onHoverDrag?: () => void
  isDragActive?: boolean
  isDragHover?: boolean
  onViewCompanies?: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [newCategory, setNewCategory] = useState("")
  const [lastAddedItemId, setLastAddedItemId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSearch("")
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  const filtered = useMemo(() => {
    if (!search.trim()) return allItems.slice(0, 50)
    const lower = search.toLowerCase()
    return allItems
      .filter(
        (item) =>
          item.name.toLowerCase().includes(lower) || (item.category && item.category.toLowerCase().includes(lower)),
      )
      .slice(0, 50)
  }, [allItems, search])

  const available = useMemo(
    () => filtered.filter((item) => !selectedItems.includes(item.id)),
    [filtered, selectedItems],
  )

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast({ title: "Error", description: "Please enter a menu item name", variant: "destructive" })
      return
    }
    const itemExists = allItems.some((item) => item.name.toLowerCase().trim() === newName.toLowerCase().trim())
    if (itemExists) {
      toast({ title: "Duplicate Item", description: `Menu item "${newName}" already exists`, variant: "destructive" })
      return
    }
    setCreating(true)
    try {
      await onCreateItem(newName.trim(), newCategory.trim())
      setNewName("")
      setNewCategory("")
      setSearch("")
    } finally {
      setCreating(false)
    }
  }

  const handleAddItem = (itemId: string) => {
    if (selectedItems.includes(itemId)) {
      toast({ title: "Duplicate Item", description: "This menu item is already added", variant: "destructive" })
      return
    }
    setLastAddedItemId(itemId)
    onAdd(itemId)
    setSearch("")
    setIsOpen(false)
    setTimeout(() => setLastAddedItemId(null), 2000)
  }

  const onDragHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    onStartDrag?.(selectedItems)
  }

  const onMouseEnterCell = () => {
    if (onHoverDrag) onHoverDrag()
  }

  return (
    <td 
      onMouseEnter={onMouseEnterCell}
      className={`border p-2 align-top min-w-[250px] transition-all duration-150 ${isDragHover ? "ring-2 ring-blue-300 bg-blue-50" : ""}`}
    >
      <div className="space-y-2">
        {/* Previous Week Indicator */}
        {prevItems && prevItems.length > 0 && (
          <div className="text-xs text-gray-600 mb-1 italic flex items-center gap-2">
            <span className="font-medium text-xs">Prev wk:</span>
            <div className="flex flex-wrap gap-1">
              {prevItems.slice(0, 6).map((id) => {
                const name = allItems.find((m) => m.id === id)?.name || id
                return (
                  <span
                    key={id}
                    className="font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded shadow-[0_0_10px_rgba(59,130,246,0.18)] text-[10px]"
                    title={name}
                  >
                    {name}
                  </span>
                )
              })}
              {prevItems.length > 6 && <span className="text-[10px] text-gray-500">+{prevItems.length - 6}</span>}
            </div>
          </div>
        )}

        {/* Selected items */}
        <div className="min-h-[60px] space-y-1">
          {selectedItems.length === 0 ? (
            <div className="text-xs text-gray-400 py-2">No items.</div>
          ) : (
            selectedItems.map((itemId) => {
              const item = allItems.find((i) => i.id === itemId)
              if (!item) return null
              const isNewlyAdded = lastAddedItemId === itemId
              return (
                <div
                  key={itemId}
                  className={`flex items-center justify-between border p-2 rounded text-sm transition-all ${
                    isNewlyAdded
                      ? "bg-green-100 border-2 border-green-500 font-bold shadow-md"
                      : "bg-white border-gray-200"
                  }`}
                >
                  <span className="flex-1 truncate text-xs">{item.name}</span>
                  <button
                    onClick={() => onRemove(itemId)}
                    className="text-red-500 hover:text-red-700 ml-2 flex-shrink-0"
                    type="button"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )
            })
          )}
        </div>

        {/* Add button with dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full px-2 py-1.5 text-left border rounded hover:bg-gray-50 text-xs text-gray-600 transition-colors"
            type="button"
          >
            + Add item
          </button>
          {isOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded shadow-lg z-50 max-h-[300px] flex flex-col w-[280px]">
              <div className="p-2 border-b sticky top-0 bg-white">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-3 w-3 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-7 pr-2 py-1 h-8 text-xs"
                    autoFocus
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto max-h-[200px]">
                {available.length > 0 ? (
                  available.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleAddItem(item.id)}
                      className="w-full px-3 py-2 text-left hover:bg-blue-50 text-xs border-b transition-colors"
                      type="button"
                    >
                      <div className="flex items-center justify-between">
                        <span>{item.name}</span>
                        {item.category && <span className="text-xs text-gray-500">({item.category})</span>}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-xs text-gray-500 text-center">No items found</div>
                )}
              </div>
              <div className="p-2 border-t bg-gray-50 space-y-2">
                <Input
                  type="text"
                  placeholder="New Item Name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full text-xs h-8"
                />
                <Button onClick={handleCreate} disabled={creating || !newName.trim()} className="w-full h-8 text-xs" size="sm">
                  {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Create"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-1 mt-2">
          <button
            title="Copy"
            onClick={onCopy}
            className="px-1.5 py-1 border rounded text-[10px] bg-white hover:bg-gray-50 shadow-sm"
            type="button"
          >
            Copy
          </button>
          <button
            title="Paste"
            onClick={onPaste}
            disabled={!canPaste}
            className={`px-1.5 py-1 border rounded text-[10px] ${canPaste ? "bg-white hover:bg-gray-50" : "bg-gray-100 text-gray-400"} shadow-sm`}
            type="button"
          >
            Paste
          </button>
          <button
            title="Drag"
            onMouseDown={onDragHandleMouseDown}
            className={`px-1.5 py-1 rounded border text-[10px] ${isDragActive ? "bg-blue-50 border-blue-300" : "bg-white hover:bg-gray-50"}`}
            type="button"
          >
            Drag
          </button>
        </div>
        <button
          onClick={onViewCompanies}
          className="w-full px-2 py-1 mt-1 border rounded text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium"
          type="button"
        >
          View Companies
        </button>
      </div>
    </td>
  )
})

// --- Navigation Panel ---
const ServiceNavigationPanel = memo(function ServiceNavigationPanel({
  services,
  subServices,
  selectedService,
  selectedSubService,
  onSelectService,
  onSelectSubService,
}: {
  services: Service[]
  subServices: Map<string, SubService[]>
  selectedService: Service | null
  selectedSubService: SubService | null
  onSelectService: (service: Service) => void
  onSelectSubService: (subService: SubService) => void
}) {
  return (
    <div className="w-full bg-gray-50 border-b flex gap-2 p-3 overflow-x-auto">
      <div className="flex gap-2">
        {services.map((service) => (
          <div key={service.id}>
            <button
              onClick={() => onSelectService(service)}
              className={`px-4 py-2 rounded font-medium text-sm transition-colors ${
                selectedService?.id === service.id
                  ? "bg-blue-600 text-white"
                  : "bg-white border text-gray-700 hover:bg-gray-100"
              }`}
              type="button"
            >
              {service.name}
            </button>
          </div>
        ))}
      </div>

      {selectedService && (
        <>
          <div className="flex items-center text-gray-400 px-2">
            <ChevronRight className="h-4 w-4" />
          </div>
          <div className="flex gap-2">
            {(subServices.get(selectedService.id) || []).map((subService) => (
              <button
                key={subService.id}
                onClick={() => onSelectSubService(subService)}
                className={`px-4 py-2 rounded font-medium text-sm transition-colors ${
                  selectedSubService?.id === subService.id
                    ? "bg-green-600 text-white"
                    : "bg-white border text-gray-700 hover:bg-gray-100"
                }`}
                type="button"
              >
                {subService.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
})

const LoadingProgress = ({ progress, message }: { progress: number; message: string }) => (
  <div className="w-full">
    <div className="flex items-center justify-between mb-2">
      <span className="text-sm font-medium text-gray-700">{message}</span>
      <span className="text-sm font-medium text-blue-600">{progress}%</span>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
      <div
        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  </div>
)

// --- Main Modal Component ---
export function MenuEditModal({ isOpen, onClose, menuId, menuType, onSave, preloadedMenuItems }: MenuEditModalProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState("Loading...")

  const [menu, setMenu] = useState<MenuData | null>(null)
  const [menuData, setMenuData] = useState<any>({})
  const [originalMenuData, setOriginalMenuData] = useState<any>({})
  const [dateRange, setDateRange] = useState<Array<{ date: string; day: string }>>([])
  const [services, setServices] = useState<Service[]>([])
  const [subServices, setSubServices] = useState<Map<string, SubService[]>>(new Map())
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([])
  const [subMealPlans, setSubMealPlans] = useState<SubMealPlan[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  
  const [prevWeekMap, setPrevWeekMap] = useState<Record<string, any>>({})
  const [repetitionLog, setRepetitionLog] = useState<any[]>([])
  const repetitionLogKeysRef = useRef<Set<string>>(new Set())
  const [copyBuffer, setCopyBuffer] = useState<{ items: string[] } | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const dragItemsRef = useRef<string[]>([])
  const [hoveredDate, setHoveredDate] = useState<string | null>(null)
  const [showLogPanel, setShowLogPanel] = useState(false)

  const [showCompanyModal, setShowCompanyModal] = useState(false)
  const [selectedMealPlan, setSelectedMealPlan] = useState<MealPlan | null>(null)
  const [selectedSubMealPlan, setSelectedSubMealPlan] = useState<SubMealPlan | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>("")
  const [selectedDay, setSelectedDay] = useState<string>("")
  const [companies, setCompanies] = useState<any[]>([])
  const [buildings, setBuildings] = useState<any[]>([])
  const [structureAssignments, setStructureAssignments] = useState<any[]>([])

  const [visibleDates, setVisibleDates] = useState(0)
  const CHUNK_SIZE = 7

  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedSubService, setSelectedSubService] = useState<SubService | null>(null)

  const mountedRef = useRef(true)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!loading && visibleDates < dateRange.length) {
      const timer = setTimeout(() => {
        setVisibleDates((v) => Math.min(v + CHUNK_SIZE, dateRange.length))
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [loading, visibleDates, dateRange.length])

  useEffect(() => {
    const handleMouseUp = () => {
      setDragActive(false)
      dragItemsRef.current = []
      setHoveredDate(null)
    }
    document.addEventListener("mouseup", handleMouseUp)
    return () => document.removeEventListener("mouseup", handleMouseUp)
  }, [])

  // Load Previous Week Map
  const loadPrevWeekMap = useCallback(async (currentDates: string[]) => {
    const map: Record<string, any> = {}
    currentDates.forEach((cd) => (map[cd] = {}))
    try {
      const snapshot = await getDocs(collection(db, "companyMenus"))
      const docs = snapshot.docs.map((s) => ({ id: s.id, ...s.data() }))
      
      for (const docData of docs) {
        const menuData = (docData as any).menuData || {}
        for (const currentDate of currentDates) {
          const d = new Date(currentDate)
          d.setDate(d.getDate() - 7)
          const prevDate = d.toISOString().split("T")[0]
          
          const dayData = menuData[prevDate]
          if (!dayData) continue
          map[currentDate] = map[currentDate] || {}
          
          Object.keys(dayData).forEach((serviceId) => {
            map[currentDate][serviceId] = map[currentDate][serviceId] || {}
            const serviceObj = dayData[serviceId]
            Object.keys(serviceObj).forEach((subServiceId) => {
              map[currentDate][serviceId][subServiceId] = map[currentDate][serviceId][subServiceId] || {}
              const subServiceObj = serviceObj[subServiceId]
              Object.keys(subServiceObj).forEach((mealPlanId) => {
                map[currentDate][serviceId][subServiceId][mealPlanId] =
                  map[currentDate][serviceId][subServiceId][mealPlanId] || {}
                const mealPlanObj = subServiceObj[mealPlanId]
                Object.keys(mealPlanObj).forEach((subMealPlanId) => {
                  const cell = mealPlanObj[subMealPlanId]
                  if (cell?.menuItemIds && Array.isArray(cell.menuItemIds)) {
                    map[currentDate][serviceId][subServiceId][mealPlanId][subMealPlanId] =
                      map[currentDate][serviceId][subServiceId][mealPlanId][subMealPlanId] || []
                    const existing = map[currentDate][serviceId][subServiceId][mealPlanId][subMealPlanId]
                    for (const it of cell.menuItemIds) {
                      if (!existing.includes(it)) existing.push(it)
                    }
                  }
                })
              })
            })
          })
        }
      }
      setPrevWeekMap(map)
    } catch (error) {
      console.error("Error loading previous week menus:", error)
    }
  }, [])

  // Main Data Loading Effect
  useEffect(() => {
    if (!isOpen || !menuId) {
      setLoading(true)
      setProgress(0)
      setVisibleDates(0)
      setMenu(null)
      setMenuData({})
      setOriginalMenuData({})
      setSelectedService(null)
      setSelectedSubService(null)
      setRepetitionLog([])
      repetitionLogKeysRef.current.clear()
      return
    }

    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    const loadData = async () => {
      try {
        setProgress(10)
        setMessage("Loading menu...")

        const collectionName = menuType === "combined" ? "combinedMenus" : "companyMenus"
        const docRef = doc(db, collectionName, menuId)
        const docSnap = await getDoc(docRef)

        if (signal.aborted || !mountedRef.current) return

        if (!docSnap.exists()) {
          throw new Error("Menu not found")
        }

        const menuDoc = { id: docSnap.id, ...docSnap.data() } as MenuData

        setProgress(30)
        setMessage("Calculating dates...")

        const start = new Date(menuDoc.startDate)
        const end = new Date(menuDoc.endDate)
        const dates: Array<{ date: string; day: string }> = []
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        const current = new Date(start)

        while (current <= end) {
          dates.push({
            date: current.toISOString().split("T")[0],
            day: days[current.getDay()],
          })
          current.setDate(current.getDate() + 1)
        }

        await loadPrevWeekMap(dates.map(d => d.date))

        if (signal.aborted || !mountedRef.current) return

        setProgress(50)
        setMessage("Loading structure...")

        const [servicesData, subServicesData, mealPlansData, subMealPlansData, menuItemsData, companiesData, buildingsData, structureData] = await Promise.all([
          servicesService.getAll(),
          subServicesService.getAll(),
          mealPlansService.getAll(),
          subMealPlansService.getAll(),
          preloadedMenuItems && preloadedMenuItems.length > 0
            ? Promise.resolve(preloadedMenuItems)
            : menuItemsService.getAll(),
          companiesService.getAll(),
          buildingsService.getAll(),
          structureAssignmentsService.getAll()
        ])

        if (signal.aborted || !mountedRef.current) return

        setCompanies(companiesData)
        setBuildings(buildingsData)
        setStructureAssignments(structureData)

        setProgress(70)
        setMessage("Filtering data...")

        let filteredServices = servicesData.filter((s) => s.status === "active").sort((a, b) => (a.order || 999) - (b.order || 999))
        let filteredSubServices = subServicesData.filter((ss) => ss.status === "active").sort((a, b) => (a.order || 999) - (b.order || 999))

        // --- FILTER FOR COMPANY MENU TYPE ---
        if (menuType === "company" && menuDoc.companyId && menuDoc.buildingId) {
            const assignment = structureData.find((s: any) => 
               s.companyId === menuDoc.companyId && 
               s.buildingId === menuDoc.buildingId && 
               s.status === "active"
            );

            if (assignment && assignment.weekStructure) {
               const allowedServiceIds = new Set<string>();
               const allowedSubServiceIds = new Set<string>();

               Object.values(assignment.weekStructure).forEach((dayServices: any) => {
                   if (Array.isArray(dayServices)) {
                       dayServices.forEach((s: any) => {
                           allowedServiceIds.add(s.serviceId);
                           if (Array.isArray(s.subServices)) {
                               s.subServices.forEach((ss: any) => {
                                   allowedSubServiceIds.add(ss.subServiceId);
                               });
                           }
                       });
                   }
               });

               filteredServices = filteredServices.filter(s => allowedServiceIds.has(s.id));
               filteredSubServices = filteredSubServices.filter(ss => allowedSubServiceIds.has(ss.id));
            }
        }
        // -------------------------------------

        const subServicesMap = new Map<string, SubService[]>()
        filteredSubServices.forEach((ss) => {
          if (!subServicesMap.has(ss.serviceId)) {
            subServicesMap.set(ss.serviceId, [])
          }
          subServicesMap.get(ss.serviceId)!.push(ss)
        })

        let filteredMealPlans = mealPlansData.filter((mp) => mp.status === "active").sort((a, b) => (a.order || 999) - (b.order || 999))
        let filteredSubMealPlans = subMealPlansData.filter((smp) => smp.status === "active").sort((a, b) => (a.order || 999) - (b.order || 999))
        const filteredMenuItems = menuItemsData.filter((mi) => mi.status === "active").sort((a, b) => (a.order || 999) - (b.order || 999))

        setProgress(90)
        setMessage("Finalizing...")

        const originalData = menuDoc.menuData || {}
        setOriginalMenuData(JSON.parse(JSON.stringify(originalData)))

        setMenu(menuDoc)
        setMenuData(originalData)
        setDateRange(dates)
        setServices(filteredServices)
        setSubServices(subServicesMap)
        setMealPlans(filteredMealPlans)
        setSubMealPlans(filteredSubMealPlans)
        setMenuItems(filteredMenuItems)

        if (menuDoc.companyId) {
            try {
                const existingLogs = await repetitionLogsService.getByDateRange(menuDoc.startDate, menuDoc.endDate, menuDoc.companyId)
                const enrichedLogs = existingLogs.map((log: any) => ({
                    ...log,
                    serviceName: filteredServices.find(s => s.id === log.serviceId)?.name || "Service",
                    subServiceName: filteredSubServices.find(ss => ss.id === log.subServiceId)?.name || "SubService"
                }))
                setRepetitionLog(enrichedLogs)
                enrichedLogs.forEach((entry: any) => {
                    const keyObj = {
                        type: entry.type,
                        itemId: entry.itemId,
                        attemptedDate: entry.attemptedDate,
                        serviceId: entry.serviceId,
                        subServiceId: entry.subServiceId,
                        mealPlanId: entry.mealPlanId,
                        subMealPlanId: entry.subMealPlanId,
                    }
                    repetitionLogKeysRef.current.add(JSON.stringify(keyObj));
                })
            } catch (e) { console.error("Error loading logs", e) }
        }

        if (filteredServices.length > 0) {
          setSelectedService(filteredServices[0])
          const firstSubServices = subServicesMap.get(filteredServices[0].id)
          if (firstSubServices && firstSubServices.length > 0) {
            setSelectedSubService(firstSubServices[0])
          }
        }

        setProgress(100)
        setMessage("Ready!")

        setTimeout(() => {
          if (mountedRef.current) {
            setLoading(false)
            setVisibleDates(CHUNK_SIZE)
          }
        }, 300)
      } catch (error) {
        if (!signal.aborted && mountedRef.current) {
          console.error("Load error:", error)
          toast({ title: "Error", description: "Failed to load menu", variant: "destructive" })
          onClose()
        }
      }
    }

    loadData()

    return () => {
      abortControllerRef.current?.abort()
    }
  }, [isOpen, menuId, menuType, onClose, preloadedMenuItems, loadPrevWeekMap])

  // --- Logic Functions ---

  const addRepetitionLog = useCallback(async (entry: any) => {
    try {
      const keyObj = {
        type: entry.type,
        itemId: entry.itemId,
        attemptedDate: entry.attemptedDate,
        serviceId: entry.serviceId,
        subServiceId: entry.subServiceId,
        mealPlanId: entry.mealPlanId,
        subMealPlanId: entry.subMealPlanId,
      }
      const key = JSON.stringify(keyObj)
      if (repetitionLogKeysRef.current.has(key)) return
      repetitionLogKeysRef.current.add(key)

      const fullEntry = {
        ...entry,
        menuStartDate: menu?.startDate,
        menuEndDate: menu?.endDate,
        companyId: menu?.companyId || "combined-view",
      }

      if (menuType === "company" || menuType === "combined") {
         const result = await repetitionLogsService.add(fullEntry);
         setRepetitionLog((p) => [{ ...fullEntry, id: result.id, time: new Date().toISOString() }, ...p])
      } else {
         setRepetitionLog((p) => [{ ...fullEntry, id: Math.random().toString(), time: new Date().toISOString() }, ...p])
      }
      
    } catch (err) {
      console.error("Error adding log", err)
    }
  }, [menu, menuType])

  const removeRepetitionLog = useCallback(async (logId: string) => {
    try {
        const logToRemove = repetitionLog.find(l => l.id === logId);
        setRepetitionLog(prev => prev.filter(l => l.id !== logId));

        if (logToRemove) {
            const keyObj = {
                type: logToRemove.type,
                itemId: logToRemove.itemId,
                attemptedDate: logToRemove.attemptedDate,
                serviceId: logToRemove.serviceId,
                subServiceId: logToRemove.subServiceId,
                mealPlanId: logToRemove.mealPlanId,
                subMealPlanId: logToRemove.subMealPlanId,
            }
            repetitionLogKeysRef.current.delete(JSON.stringify(keyObj));
            if (menuType === "company" || menuType === "combined") {
                await repetitionLogsService.deleteAll([logId]);
            }
        }
    } catch(e) { console.error(e) }
  }, [repetitionLog, menuType])

  const clearRepetitionLog = useCallback(async () => {
     try {
         const ids = repetitionLog.map(l => l.id)
         if (ids.length > 0 && (menuType === "company" || menuType === "combined")) {
             await repetitionLogsService.deleteAll(ids)
         }
         setRepetitionLog([])
         repetitionLogKeysRef.current.clear()
     } catch(e) { console.error(e) }
  }, [repetitionLog, menuType])

  const handleAddItem = useCallback(
    (date: string, serviceId: string, mealPlanId: string, subMealPlanId: string, itemId: string) => {
      
      const subServiceId = selectedSubService?.id
      if (!subServiceId) return

      const serviceName = services.find(s => s.id === serviceId)?.name || "Service"
      const subServiceName = subServices.get(serviceId)?.find(ss => ss.id === subServiceId)?.name || "SubService"
      const currentSubMealPlan = subMealPlans.find(smp => smp.id === subMealPlanId)
      const isRepeatAllowed = currentSubMealPlan?.isRepeatPlan || false

      const inWeek = dateRange.some(d => {
         const cell = menuData[d.date]?.[serviceId]?.[subServiceId]?.[mealPlanId]?.[subMealPlanId]
         return cell?.menuItemIds?.includes(itemId)
      })

      if (inWeek && !isRepeatAllowed) {
         const itemName = menuItems.find(m => m.id === itemId)?.name || "Item"
         addRepetitionLog({
             type: "In-week duplicate",
             itemId, itemName, serviceId, serviceName, subServiceId, subServiceName, mealPlanId, subMealPlanId, attemptedDate: date
         })
         toast({ title: "Duplicate in week", description: `${itemName} exists in this week`, variant: "destructive" })
      }

      const prevHas = prevWeekMap[date]?.[serviceId]?.[subServiceId]?.[mealPlanId]?.[subMealPlanId]?.includes(itemId)
      if (prevHas && !inWeek && !isRepeatAllowed) {
         const itemName = menuItems.find(m => m.id === itemId)?.name || "Item"
         const d = new Date(date); d.setDate(d.getDate() - 7)
         const prevDate = d.toISOString().split("T")[0]
         addRepetitionLog({
             type: "Prev-week repeat",
             itemId, itemName, serviceId, serviceName, subServiceId, subServiceName, mealPlanId, subMealPlanId, prevDate, attemptedDate: date
         })
         toast({ title: "Prev-week repeat", description: `${itemName} used last week`, variant: "destructive" })
      }

      setMenuData((prev: any) => {
        const updated = JSON.parse(JSON.stringify(prev))
        if (!updated[date]) updated[date] = {}
        if (!updated[date][serviceId]) updated[date][serviceId] = {}
        if (!updated[date][serviceId][subServiceId]) updated[date][serviceId][subServiceId] = {}
        if (!updated[date][serviceId][subServiceId][mealPlanId]) updated[date][serviceId][subServiceId][mealPlanId] = {}
        if (!updated[date][serviceId][subServiceId][mealPlanId][subMealPlanId]) {
          updated[date][serviceId][subServiceId][mealPlanId][subMealPlanId] = { menuItemIds: [] }
        }

        const items = updated[date][serviceId][subServiceId][mealPlanId][subMealPlanId].menuItemIds
        if (!items.includes(itemId)) {
          items.push(itemId)
        }
        return updated
      })
    },
    [selectedSubService?.id, menuData, dateRange, prevWeekMap, services, subServices, subMealPlans, menuItems, addRepetitionLog],
  )

  const handleRemoveItem = useCallback(
    async (date: string, serviceId: string, mealPlanId: string, subMealPlanId: string, itemId: string) => {
      setMenuData((prev: any) => {
        const updated = JSON.parse(JSON.stringify(prev))
        const items = updated[date]?.[serviceId]?.[selectedSubService?.id]?.[mealPlanId]?.[subMealPlanId]?.menuItemIds
        if (items) {
          const idx = items.indexOf(itemId)
          if (idx > -1) items.splice(idx, 1)
        }
        return updated
      })

      const logsToRemove = repetitionLog.filter(log => 
          log.itemId === itemId &&
          log.attemptedDate === date &&
          log.serviceId === serviceId &&
          log.subServiceId === selectedSubService?.id &&
          log.mealPlanId === mealPlanId &&
          log.subMealPlanId === subMealPlanId
      );

      if (logsToRemove.length > 0) {
         logsToRemove.forEach(l => {
             const keyObj = { type: l.type, itemId: l.itemId, attemptedDate: l.attemptedDate, serviceId: l.serviceId, subServiceId: l.subServiceId, mealPlanId: l.mealPlanId, subMealPlanId: l.subMealPlanId }
             repetitionLogKeysRef.current.delete(JSON.stringify(keyObj))
         })
         const ids = logsToRemove.map(l => l.id)
         setRepetitionLog(prev => prev.filter(l => !ids.includes(l.id)))
         if (menuType === "company" || menuType === "combined") {
             await repetitionLogsService.deleteAll(ids)
         }
      }
    },
    [selectedSubService?.id, repetitionLog, menuType],
  )

  const handleCreateItem = useCallback(async (name: string, category: string) => {
    try {
      const newItemRef = await addDoc(collection(db, "menuItems"), {
        name, category, status: "active", order: 999, createdAt: new Date(),
      })
      const newItem: MenuItem = { id: newItemRef.id, name, category, status: "active", order: 999 }
      setMenuItems((prev) => [...prev, newItem])
      toast({ title: "Success", description: `Menu item "${name}" created successfully` })
    } catch (error) {
      console.error("Error creating menu item:", error)
      toast({ title: "Error", description: "Failed to create menu item", variant: "destructive" })
    }
  }, [])

  const handleCopy = useCallback((items: string[]) => {
     if(!items.length) { toast({ title: "Empty", description: "No items to copy", variant: "destructive"}); return; }
     setCopyBuffer({ items: [...items] })
     toast({ title: "Copied", description: `${items.length} items copied` })
  }, [])

  const handlePaste = useCallback((date: string, mealPlanId: string, subMealPlanId: string) => {
      if (!copyBuffer?.items.length || !selectedService || !selectedSubService) return;
      copyBuffer.items.forEach(itemId => {
          handleAddItem(date, selectedService.id, mealPlanId, subMealPlanId, itemId)
      })
      toast({ title: "Pasted", description: `${copyBuffer.items.length} items pasted` })
  }, [copyBuffer, selectedService, selectedSubService, handleAddItem])

  const handleStartDrag = useCallback((items: string[]) => {
      if(!items.length) return
      dragItemsRef.current = [...items]
      setDragActive(true)
  }, [])

  const applyDragToCell = useCallback((date: string, mealPlanId: string, subMealPlanId: string) => {
      if (!dragActive || !dragItemsRef.current.length || !selectedService || !selectedSubService) return;
      dragItemsRef.current.forEach(itemId => {
          handleAddItem(date, selectedService.id, mealPlanId, subMealPlanId, itemId)
      })
  }, [dragActive, selectedService, selectedSubService, handleAddItem])


  const handleSave = async (isDraft = false) => {
    if (!menu) return

    try {
      setSaving(true)
      const collectionName = menuType === "combined" ? "combinedMenus" : "companyMenus"
      const docRef = doc(db, collectionName, menuId)
      const statusToSave = isDraft ? "draft" : menu.status

      const menuItemsMap = new Map(menuItems.map((item) => [item.id, item.name]))
      const changedCells = detectMenuChanges(originalMenuData, menuData, menuItemsMap)

      // 1. Update the Main Menu
      await updateDoc(docRef, {
        menuData: JSON.parse(JSON.stringify(menuData)),
        status: statusToSave,
        updatedAt: new Date(),
      })

      // 2. Create Updation Record for Main Menu
      if (!isDraft && changedCells.length > 0) {
        const changeSummary = createChangeSummary(changedCells)
        const latestNumber = await updationService.getLatestUpdationNumber(menuId) || 0

        const updationRecord: any = {
          menuId,
          menuType,
          menuName: menu.name || `${menuType} Menu`,
          updationNumber: latestNumber + 1,
          changedCells,
          totalChanges: changeSummary.totalChanges,
          menuStartDate: menu.startDate,
          menuEndDate: menu.endDate,
          createdAt: new Date(),
          createdBy: "user",
        }
        if (menu.companyId) updationRecord.companyId = menu.companyId
        if (menu.companyName) updationRecord.companyName = menu.companyName
        if (menu.buildingId) updationRecord.buildingId = menu.buildingId
        if (menu.buildingName) updationRecord.buildingName = menu.buildingName

        await addDoc(collection(db, "updations"), updationRecord)
      }

      // 3. Sync to Company Menus
      if (menuType === "combined" && !isDraft && changedCells.length > 0) {
        try {
          console.log("[Sync] Starting sync process...");
          
          // Fetch All Necessary Data
          const [companyMenusSnapshot, allStructures, allMealPlanStructures] = await Promise.all([
             getDocs(collection(db, "companyMenus")),
             structureAssignmentsService.getAll(),
             mealPlanStructureAssignmentsService.getAll()
          ])
          
          // Filter specific company menus
          const matchingCompanyMenus = companyMenusSnapshot.docs.filter((doc) => {
            const cm = doc.data()
            const matchesId = cm.combinedMenuId === menuId;
            const matchesDate = cm.startDate === menu.startDate && cm.endDate === menu.endDate;
            
            // If matchesId is true, great. If not, fallback to date matching but ensure it's active
            return (matchesId || matchesDate) && cm.status !== "archived";
          })

          console.log(`[Sync] Found ${matchingCompanyMenus.length} company menus candidates.`);

          for (const companyMenuDoc of matchingCompanyMenus) {
            const companyMenu = companyMenuDoc.data()
            const logPrefix = `[Sync ${companyMenu.companyName}]:`;

            // Validate Structure exists
            const structureAssignment = allStructures.find((s: any) => 
               s.companyId === companyMenu.companyId && 
               s.buildingId === companyMenu.buildingId && 
               s.status === "active"
            )
            
            if (!structureAssignment) {
                console.log(`${logPrefix} Skipped - No active Service structure assignment found.`);
                continue;
            }

            // Validate Meal Plan Structure exists
            const mealPlanStructure = allMealPlanStructures.find((s: any) => 
               s.companyId === companyMenu.companyId && 
               s.buildingId === companyMenu.buildingId && 
               s.status === "active"
            )

            // Deep clone
            const updatedCompanyMenuData = JSON.parse(JSON.stringify(companyMenu.menuData || {}))
            const appliedChangesForCompany: any[] = []

            for (const changedCell of changedCells) {
              const { date, serviceId, subServiceId, mealPlanId, subMealPlanId, changes } = changedCell
              
              // Robust Day Name
              const [y, m, d] = date.split('-').map(Number);
              const dateObj = new Date(y, m - 1, d);
              const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
              const dayName = days[dateObj.getDay()];

              // Case insensitive check for structure keys
              const weekStructure = structureAssignment.weekStructure || {};
              const structureDayKey = Object.keys(weekStructure).find(k => k.toLowerCase() === dayName);
              const dayServices = structureDayKey ? weekStructure[structureDayKey] : [];
              
              const matchedService = dayServices.find((s: any) => s.serviceId === serviceId)
              if (!matchedService) continue;

              const matchedSubService = (matchedService.subServices || []).find((ss: any) => ss.subServiceId === subServiceId)
              if (!matchedSubService) continue;

              // Meal Plan Structure Check
              if (mealPlanStructure && mealPlanStructure.weekStructure) {
                const mpWeekStructure = mealPlanStructure.weekStructure || {};
                const mpStructureDayKey = Object.keys(mpWeekStructure).find(k => k.toLowerCase() === dayName);
                const mpDayServices = mpStructureDayKey ? mpWeekStructure[mpStructureDayKey] : [];
                
                const mpMatchedService = mpDayServices.find((s: any) => s.serviceId === serviceId)
                
                if (!mpMatchedService) continue;

                let mealPlanMatchFound = false
                for (const mpSubService of (mpMatchedService.subServices || [])) {
                  if (mpSubService.subServiceId !== subServiceId) continue; 
                  
                  const mpFound = (mpSubService.mealPlans || []).find((mp: any) => 
                    mp.mealPlanId === mealPlanId && 
                    (mp.subMealPlans || []).some((smp: any) => smp.subMealPlanId === subMealPlanId)
                  )
                  
                  if (mpFound) {
                    mealPlanMatchFound = true
                    break
                  }
                }
                
                if (!mealPlanMatchFound) continue;
              }

              // Apply Changes to Local Object
              if (!updatedCompanyMenuData[date]) updatedCompanyMenuData[date] = {}
              if (!updatedCompanyMenuData[date][serviceId]) updatedCompanyMenuData[date][serviceId] = {}
              if (!updatedCompanyMenuData[date][serviceId][subServiceId]) updatedCompanyMenuData[date][serviceId][subServiceId] = {}
              if (!updatedCompanyMenuData[date][serviceId][subServiceId][mealPlanId]) updatedCompanyMenuData[date][serviceId][subServiceId][mealPlanId] = {}
              if (!updatedCompanyMenuData[date][serviceId][subServiceId][mealPlanId][subMealPlanId]) {
                updatedCompanyMenuData[date][serviceId][subServiceId][mealPlanId][subMealPlanId] = { menuItemIds: [] }
              }

              const cellData = updatedCompanyMenuData[date][serviceId][subServiceId][mealPlanId][subMealPlanId]
              const currentItemIds = [...(cellData.menuItemIds || [])]
              let thisCellApplied = false

              for (const change of changes) {
                if (change.action === "added") {
                  if (!currentItemIds.includes(change.itemId)) {
                    currentItemIds.push(change.itemId)
                    thisCellApplied = true
                  }
                } else if (change.action === "removed") {
                  const idx = currentItemIds.indexOf(change.itemId)
                  if (idx > -1) {
                    currentItemIds.splice(idx, 1)
                    thisCellApplied = true
                  }
                } else if (change.action === "replaced") {
                  const idx = currentItemIds.indexOf(change.itemId)
                  if (idx > -1) {
                    currentItemIds.splice(idx, 1)
                    thisCellApplied = true
                  }
                  if (change.replacedWith && !currentItemIds.includes(change.replacedWith)) {
                    currentItemIds.push(change.replacedWith)
                    thisCellApplied = true
                  }
                }
              }

              if (thisCellApplied) {
                cellData.menuItemIds = currentItemIds
                appliedChangesForCompany.push(changedCell)
              }
            }

            if (appliedChangesForCompany.length > 0) {
              await updateDoc(companyMenuDoc.ref, {
                menuData: updatedCompanyMenuData,
                updatedAt: new Date(),
              })

              const latestCompanyNumber = await updationService.getLatestUpdationNumber(companyMenuDoc.id) || 0
              
              await addDoc(collection(db, "updations"), {
                menuId: companyMenuDoc.id,
                menuType: "company",
                menuName: `${companyMenu.companyName} - ${companyMenu.buildingName} Menu`,
                updationNumber: latestCompanyNumber + 1,
                changedCells: appliedChangesForCompany,
                totalChanges: appliedChangesForCompany.length,
                menuStartDate: menu.startDate,
                menuEndDate: menu.endDate,
                companyId: companyMenu.companyId,
                companyName: companyMenu.companyName,
                buildingId: companyMenu.buildingId,
                buildingName: companyMenu.buildingName,
                linkedToCombinedMenuId: menuId,
                linkedToCombinedMenuUpdate: true,
                createdAt: new Date(),
                createdBy: "user",
              })
              console.log(`[Sync] Successfully updated ${companyMenu.companyName} with ${appliedChangesForCompany.length} changes.`)
            }
          }
          
          clearCacheKey("companyMenus-")
          clearCacheKey("updations-")
        } catch (error) {
          console.error("Error syncing company menus:", error)
          toast({
             title: "Sync Warning",
             description: "Menu saved, but company updates encountered an error. Check console.",
             variant: "destructive"
          })
        }
      }

      toast({
        title: "Success",
        description: isDraft ? "Saved as Draft" : "Menu updated successfully",
      })

      onSave?.()
      onClose()
    } catch (error) {
      console.error("Error saving menu:", error)
      toast({ title: "Error", description: "Failed to save menu", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const mealPlanStructure = useMemo(() => {
    return mealPlans.map((mp) => ({
      mealPlan: mp,
      subMealPlans: subMealPlans.filter((smp) => smp.mealPlanId === mp.id),
    }))
  }, [mealPlans, subMealPlans])


  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      
      {/* Modal Container */}
      <div className="bg-white rounded-xl shadow-2xl w-full h-full max-w-[98vw] max-h-[95vh] flex flex-col relative overflow-hidden">
          
          {/* Header */}
          <div className="border-b p-4 flex-none flex items-center justify-between bg-white z-40">
            <div>
              <h2 className="text-2xl font-bold">
                Edit {menuType === "combined" ? "Combined" : "Company"} Menu
              </h2>
              {menu && (
                <p className="text-sm text-gray-600 mt-1">
                  {new Date(menu.startDate).toLocaleDateString()} to {new Date(menu.endDate).toLocaleDateString()}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
               {copyBuffer && (
                   <div className="flex items-center gap-2 px-3 py-1 border rounded bg-yellow-50 text-sm">
                      <span className="text-xs">{copyBuffer.items.length} copied</span>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setCopyBuffer(null)}><X className="h-3 w-3"/></Button>
                   </div>
               )}
               <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                <X className="h-6 w-6" />
               </button>
            </div>
          </div>

          {/* Content - Scrollable Area */}
          <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50/50">
            {loading ? (
              <div className="p-8 space-y-4 flex flex-col items-center justify-center h-full">
                <LoadingProgress progress={progress} message={message} />
              </div>
            ) : (
              <div className="flex flex-col h-full">
                {/* Service Nav - Sticky */}
                <div className="bg-white sticky top-0 z-30 shadow-sm">
                  <ServiceNavigationPanel
                    services={services}
                    subServices={subServices}
                    selectedService={selectedService}
                    selectedSubService={selectedSubService}
                    onSelectService={setSelectedService}
                    onSelectSubService={setSelectedSubService}
                  />
                </div>

                <div className="p-4 flex-1">
                  {selectedService && selectedSubService ? (
                    <div className="overflow-x-auto border rounded bg-white shadow-sm">
                      <table className="w-full border-collapse">
                        <thead className="bg-gray-100 sticky top-0 z-20 shadow-sm">
                          <tr>
                            <th className="border p-2 sticky left-0 z-30 bg-gray-100 min-w-[200px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                              Meal Plan / Sub Meal
                            </th>
                            {dateRange.slice(0, visibleDates).map(({ date, day }) => (
                              <th key={date} className="border p-2 min-w-[250px] text-left">
                                <div className="font-semibold">
                                  {new Date(date).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </div>
                                <div className="text-sm text-gray-600 font-normal">{day}</div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {mealPlanStructure.map(({ mealPlan, subMealPlans: subMPs }) =>
                            subMPs.map((subMealPlan, idx) => (
                              <tr key={`${mealPlan.id}-${subMealPlan.id}`} className="hover:bg-gray-50/50">
                                <td className="border bg-gray-50 p-2 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                  {idx === 0 && <div className="font-semibold text-blue-700">{mealPlan.name}</div>}
                                  <div className="text-sm text-gray-700 ml-3">↳ {subMealPlan.name}</div>
                                </td>
                                {dateRange.slice(0, visibleDates).map(({ date, day }) => {
                                  const selectedItems: string[] =
                                    menuData[date]?.[selectedService.id]?.[selectedSubService.id]?.[mealPlan.id]?.[
                                      subMealPlan.id
                                    ]?.menuItemIds || []
                                  
                                  const prevItems = prevWeekMap[date]?.[selectedService.id]?.[selectedSubService.id]?.[mealPlan.id]?.[subMealPlan.id] || []

                                  return (
                                    <MenuCell
                                      key={`${date}-${mealPlan.id}-${subMealPlan.id}`}
                                      cellKey={`${date}-${mealPlan.id}-${subMealPlan.id}`}
                                      selectedItems={selectedItems}
                                      allItems={menuItems}
                                      onAdd={(itemId) =>
                                        handleAddItem(date, selectedService.id, mealPlan.id, subMealPlan.id, itemId)
                                      }
                                      onRemove={(itemId) =>
                                        handleRemoveItem(date, selectedService.id, mealPlan.id, subMealPlan.id, itemId)
                                      }
                                      onCreateItem={handleCreateItem}
                                      date={date}
                                      prevItems={prevItems}
                                      onCopy={() => handleCopy(selectedItems)}
                                      onPaste={() => handlePaste(date, mealPlan.id, subMealPlan.id)}
                                      canPaste={!!copyBuffer?.items.length}
                                      onStartDrag={(items) => handleStartDrag(items)}
                                      isDragActive={dragActive}
                                      isDragHover={hoveredDate === date}
                                      onHoverDrag={() => {
                                          setHoveredDate(date)
                                          if(dragActive) applyDragToCell(date, mealPlan.id, subMealPlan.id)
                                      }}
                                      onViewCompanies={() => {
                                          setSelectedMealPlan(mealPlan)
                                          setSelectedSubMealPlan(subMealPlan)
                                          setSelectedDate(date)
                                          setSelectedDay(day)
                                          setShowCompanyModal(true)
                                      }}
                                    />
                                  )
                                })}
                              </tr>
                            )),

                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center h-full">
                      <Search className="h-10 w-10 text-gray-300 mb-2"/>
                      <p>Select a service from the top bar to begin editing</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t p-4 flex-none flex gap-2 justify-end bg-white z-40">
            <Button variant="outline" onClick={() => handleSave(true)} disabled={saving || loading} className="border-purple-300 text-purple-700 hover:bg-purple-50">
               {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
               Save as Draft
            </Button>
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => handleSave(false)} disabled={saving || loading}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>

          {/* Logs FAB */}
          <div className="absolute bottom-20 right-6 z-[60]">
              <button
                onClick={() => setShowLogPanel(!showLogPanel)}
                className={`h-12 w-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 border-2 border-white ${
                  repetitionLog.length > 0 
                    ? "bg-red-500 hover:bg-red-600 text-white animate-in zoom-in" 
                    : "bg-gray-400 hover:bg-gray-500 text-white"
                }`}
                title="Toggle Repetition Logs"
              >
                 <div className="flex flex-col items-center">
                    {showLogPanel ? <ChevronDown className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                    {!showLogPanel && <span className="text-[10px] font-bold">{repetitionLog.length}</span>}
                 </div>
              </button>
          </div>

          {/* Log Panel */}
          {showLogPanel && (
              <div className="absolute bottom-16 right-4 w-[400px] max-h-[400px] bg-white border rounded-lg shadow-2xl p-4 animate-in slide-in-from-bottom-5 z-[70] flex flex-col">
                  <div className="flex items-center justify-between mb-3 border-b pb-2">
                    <div className="font-semibold text-sm flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-500"/>
                        Repetition Log ({repetitionLog.length})
                    </div>
                    <Button variant="ghost" size="sm" onClick={clearRepetitionLog} className="text-red-600 hover:bg-red-50 h-6 text-xs">Clear All</Button>
                  </div>
                  <div className="overflow-y-auto flex-1 space-y-2 pr-1">
                    {repetitionLog.length === 0 ? <span className="text-sm text-gray-500 italic">No issues detected.</span> : 
                        repetitionLog.map((entry, idx) => (
                           <div key={idx} className="p-3 border rounded bg-red-50 border-red-100 text-xs relative group">
                               <div className="flex justify-between font-bold text-red-700 mb-1">
                                   <span>{entry.type}</span>
                                   <button onClick={() => removeRepetitionLog(entry.id)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-3.5 w-3.5"/></button>
                               </div>
                               <div className="mb-1">Item: <span className="font-semibold text-gray-800">{entry.itemName}</span></div>
                               <div className="text-gray-500 flex justify-between">
                                  <span>{entry.attemptedDate}</span>
                                  <span>{entry.serviceName}</span>
                               </div>
                           </div>
                        ))
                    }
                  </div>
              </div>
          )}

          {/* Company Modal */}
          {selectedMealPlan && selectedSubMealPlan && selectedService && selectedSubService && (
            <CompanyAssignmentModal
                isOpen={showCompanyModal}
                onClose={() => setShowCompanyModal(false)}
                mealPlan={selectedMealPlan}
                subMealPlan={selectedSubMealPlan}
                service={selectedService}
                selectedSubService={selectedSubService}
                companies={companies}
                buildings={buildings}
                structureAssignments={structureAssignments}
                date={selectedDate}
                day={selectedDay}
            />
          )}

      </div>
    </div>
  )
}