"use client"
import { useState, useEffect, useCallback, useMemo, memo, useRef } from "react"
import type React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar, Save, X, Maximize2, Search, Loader2, ArrowLeft, Plus, AlertCircle, ChevronDown } from "lucide-react"
import Link from "next/link"
import { toast } from "@/components/ui/use-toast"
import type { Service, MealPlan, SubMealPlan, MenuItem, SubService } from "@/lib/types"
import { 
  getDocs, 
  collection, 
  addDoc, 
  deleteDoc,
  doc,
  writeBatch,
  serverTimestamp, 
  query, 
  where, 
  orderBy 
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import {
  servicesService,
  mealPlansService,
  subMealPlansService,
  subServicesService,
  companiesService,
  buildingsService,
  structureAssignmentsService,
  mealPlanStructureAssignmentsService,
} from "@/lib/services"

// --- Types ---
interface MenuCell {
  menuItemIds: string[]
}

interface DayMenu {
  [serviceId: string]: {
    [subServiceId: string]: {
      [mealPlanId: string]: {
        [subMealPlanId: string]: MenuCell
      }
    }
  }
}

interface CombinedMenuData {
  [date: string]: DayMenu
}

// --- Services ---

const menuItemsService = {
  async getAll(): Promise<MenuItem[]> {
    const snapshot = await getDocs(collection(db, "menuItems"))
    return snapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        }) as MenuItem,
    )
  },
}

const repetitionLogsService = {
  async add(data: any) {
    const docRef = await addDoc(collection(db, "repetitionLogs"), {
      ...data,
      createdAt: serverTimestamp(),
    })
    return { id: docRef.id }
  },
  async getByDateRange(startDate: string, endDate: string, companyId: string) {
    const q = query(
      collection(db, "repetitionLogs"),
      where("menuStartDate", "==", startDate),
      where("menuEndDate", "==", endDate),
      where("companyId", "==", companyId),
      orderBy("createdAt", "desc")
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  },
  async deleteAll(logIds: string[]) {
    const batch = writeBatch(db)
    logIds.forEach(id => {
      const ref = doc(db, "repetitionLogs", id)
      batch.delete(ref)
    })
    await batch.commit()
  }
}

const combinedMenusService = {
  async add(data: any) {
    const docRef = await addDoc(collection(db, "combinedMenus"), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return { id: docRef.id }
  },
  async checkDuplicate(startDate: string, endDate: string): Promise<boolean> {
    const snapshot = await getDocs(collection(db, "combinedMenus"))
    const isDuplicate = snapshot.docs.some((doc) => {
      const data = doc.data()
      return data.startDate === startDate && data.endDate === endDate && data.status === "active"
    })
    return isDuplicate
  },
  async getDraft(startDate: string, endDate: string, companyId: string): Promise<any | null> {
    const q = query(
      collection(db, "combinedMenus"),
      where("startDate", "==", startDate),
      where("endDate", "==", endDate),
      where("status", "==", "draft"),
      where("companyId", "==", companyId),
    )
    const snapshot = await getDocs(q)
    if (snapshot.docs.length > 0) {
      const data = snapshot.docs[0].data()
      return data.menuData || data 
    }
    return null
  },
  async getDraftByDateRange(startDate: string, endDate: string, companyId: string): Promise<any | null> {
    const q = query(
      collection(db, "combinedMenus"),
      where("startDate", "==", startDate),
      where("endDate", "==", endDate),
      where("status", "==", "draft"),
      where("companyId", "==", companyId),
    )
    const snapshot = await getDocs(q)
    
    if (!snapshot.empty) {
      const sortedDocs = snapshot.docs.sort((a, b) => {
         const timeA = a.data().updatedAt?.toMillis?.() || 0;
         const timeB = b.data().updatedAt?.toMillis?.() || 0;
         return timeB - timeA; 
      });
      return { id: sortedDocs[0].id, ...sortedDocs[0].data() };
    }
    return null
  },
}

const companyMenusService = {
  async add(data: any) {
    await addDoc(collection(db, "companyMenus"), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  },
}

// --- Components ---

const CompanyAssignmentModal = memo(function CompanyAssignmentModal({
  isOpen,
  onClose,
  mealPlan,
  subMealPlan,
  service,
  selectedSubServiceId,
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
  selectedSubServiceId: string
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
      const subServiceInDay = serviceInDay.subServices?.find((ss: any) => ss.subServiceId === selectedSubServiceId)
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
  }, [mealPlan, subMealPlan, service, selectedSubServiceId, companies, buildings, structureAssignments, date, day])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-auto">
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

// ---------------------- MenuGridCell ----------------------
const MenuGridCell = memo(function MenuGridCell({
  date,
  service,
  mealPlan,
  subMealPlan,
  selectedMenuItemIds,
  allMenuItems,
  onAddItem,
  onRemoveItem,
  onCreateItem,
  onStartDrag,
  onHoverDrag,
  isDragActive,
  isDragHover,
  onCopy,
  onPaste,
  canPaste,
  prevItems,
  onCellMouseEnter,
  day,
  onViewCompanies,
}: {
  date: string
  service: Service
  mealPlan: MealPlan
  subMealPlan: SubMealPlan
  selectedMenuItemIds: string[]
  allMenuItems: MenuItem[]
  onAddItem: (menuItemId: string) => void
  onRemoveItem: (menuItemId: string) => void
  onCreateItem: (name: string, category: string) => Promise<{ id: string; name: string }>
  onStartDrag?: (date: string, items: string[]) => void
  onHoverDrag?: (date: string) => void
  isDragActive?: boolean
  isDragHover?: boolean
  onCopy?: () => void
  onPaste?: () => void
  canPaste?: boolean
  prevItems?: string[]
  onCellMouseEnter?: () => void
  day?: string
  onViewCompanies?: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [creating, setCreating] = useState(false)
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
    if (!search.trim()) return allMenuItems.slice(0, 50)
    const lower = search.toLowerCase()
    return allMenuItems
      .filter(
        (item) =>
          item.name.toLowerCase().includes(lower) || (item.category && item.category.toLowerCase().includes(lower)),
      )
      .slice(0, 50)
  }, [allMenuItems, search])

  const available = useMemo(
    () => filtered.filter((item) => !selectedMenuItemIds.includes(item.id)),
    [filtered, selectedMenuItemIds],
  )

  const handleCreate = async () => {
    if (!search.trim()) {
      toast({ title: "Error", description: "Please enter a menu item name", variant: "destructive" })
      return
    }
    const itemExists = allMenuItems.some((item) => item.name.toLowerCase().trim() === search.toLowerCase().trim())
    if (itemExists) {
      toast({ title: "Duplicate Item", description: `Menu item "${search}" already exists`, variant: "destructive" })
      return
    }
    setCreating(true)
    const createdName = search.trim()
    try {
      const createdItem = await onCreateItem(createdName, "")
      if (createdItem && createdItem.id) {
        onAddItem(createdItem.id)
        setSearch("")
        setIsOpen(false)
      }
    } catch (error) {
      console.error("Create error:", error)
    } finally {
      setCreating(false)
    }
  }

  const handleAdd = (itemId: string) => {
    if (selectedMenuItemIds.includes(itemId)) {
      toast({ title: "Duplicate Item", description: "This menu item is already added", variant: "destructive" })
      return
    }
    onAddItem(itemId)
    setSearch("")
    setIsOpen(false)
  }

  const onDragHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    onStartDrag?.(date, selectedMenuItemIds)
  }

  const onMouseEnterCell = () => {
    onCellMouseEnter?.()
    if (onHoverDrag) onHoverDrag(date)
  }

  return (
    <td
      onMouseEnter={onMouseEnterCell}
      className={`border p-3 align-top min-w-[260px] bg-white hover:shadow-md transition-shadow duration-150 ${isDragHover ? "ring-2 ring-blue-300" : ""}`}
    >
      <div className="space-y-2">
        {prevItems && prevItems.length > 0 && (
          <div className="text-xs text-gray-600 mb-1 italic flex items-center gap-2">
            <span className="font-medium text-sm">Prev wk:</span>
            <div className="flex flex-wrap gap-1">
              {prevItems.slice(0, 6).map((id) => {
                const name = allMenuItems.find((m) => m.id === id)?.name || id
                return (
                  <span
                    key={id}
                    className="font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded shadow-[0_0_10px_rgba(59,130,246,0.18)] text-xs"
                    title={name}
                  >
                    {name}
                  </span>
                )
              })}
              {prevItems.length > 6 && <span className="text-xs text-gray-500">+{prevItems.length - 6}</span>}
            </div>
          </div>
        )}
        <div className="min-h-[60px] space-y-2">
          {selectedMenuItemIds.length === 0 ? (
            <div className="text-sm text-gray-400">No items yet. Add or paste items.</div>
          ) : (
            selectedMenuItemIds.map((itemId) => {
              const item = allMenuItems.find((i) => i.id === itemId)
              if (!item) return null
              return (
                <div
                  key={itemId}
                  className="flex items-center justify-between bg-gradient-to-r from-green-50 to-white border border-green-100 p-2 rounded text-sm"
                >
                  <span className="flex-1 truncate font-medium">{item.name}</span>
                  <button
                    onClick={() => onRemoveItem(itemId)}
                    className="text-red-500 hover:text-red-700 ml-2 flex-shrink-0"
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )
            })
          )}
        </div>
        <div className="space-y-2">
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="w-full px-3 py-2 text-left border rounded hover:bg-gray-50 text-sm text-gray-700 transition-colors"
              type="button"
            >
              + Add menu item
            </button>
            {isOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border rounded shadow-lg z-50 max-h-[320px] flex flex-col">
                <div className="p-2 border-b sticky top-0 bg-white">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Search items or create new..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-sm"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto max-h-[260px]">
                  {available.length > 0 ? (
                    available.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleAdd(item.id)}
                        className="w-full px-3 py-2 text-left hover:bg-blue-50 text-sm border-b transition-colors"
                        type="button"
                      >
                        <div className="flex items-center justify-between">
                          <span>{item.name}</span>
                          {item.category && <span className="text-xs text-gray-500">({item.category})</span>}
                        </div>
                      </button>
                    ))
                  ) : search.trim() ? (
                    <div className="p-3 border-t bg-blue-50">
                      <button
                        onClick={handleCreate}
                        disabled={creating}
                        className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm rounded font-medium transition-colors flex items-center justify-center gap-2"
                        type="button"
                      >
                        {creating ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4" />
                            Create "{search}"
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 text-sm text-gray-500 text-center">
                      No items found. Type to search or create new.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              title="Copy cell items"
              onClick={() => onCopy?.()}
              className="px-2 py-1 border rounded text-sm bg-white hover:bg-gray-50 shadow-sm transition-colors"
              type="button"
            >
              Copy
            </button>
            <button
              title={canPaste ? "Paste copied items" : "No copied items"}
              onClick={() => onPaste?.()}
              disabled={!canPaste}
              className={`px-2 py-1 border rounded text-sm transition-colors ${canPaste ? "bg-white hover:bg-gray-50" : "bg-gray-100 text-gray-400 cursor-not-allowed"} shadow-sm`}
              type="button"
            >
              Paste
            </button>
            <button
              title="Drag this row across dates"
              onMouseDown={onDragHandleMouseDown}
              className={`px-2 py-1 rounded border text-sm transition-colors ${isDragActive ? "bg-blue-50 border-blue-300" : "bg-white hover:bg-gray-50"}`}
              type="button"
            >
              Drag
            </button>
          </div>
          <button
            onClick={() => onViewCompanies?.()}
            className="w-full px-3 py-2 border rounded text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors font-medium"
            type="button"
          >
            View Companies
          </button>
        </div>
      </div>
    </td>
  )
})

// ---------------------- ServiceTable ----------------------
const ServiceTable = memo(function ServiceTable({
  service,
  subServices,
  dateRange,
  mealPlanStructure,
  combinedMenu,
  allItems,
  onAddItem,
  onRemoveItem,
  onCreateItem,
  visibleDates,
  selectedSubServiceId,
  onSubServiceSelect,
  onApplyItemsToCell,
  prevWeekMap,
  addRepetitionLog,
  dateRangeSet,
  copyBuffer,
  handleCopyFromCell,
  handlePasteToCell,
  companies,
  buildings,
  structureAssignments,
  mealPlanStructureAssignments,
}: {
  service: Service
  subServices: SubService[]
  dateRange: Array<{ date: string; day: string }>
  mealPlanStructure: Array<{ mealPlan: MealPlan; subMealPlans: SubMealPlan[] }>
  combinedMenu: CombinedMenuData
  allItems: MenuItem[]
  onAddItem: (
    date: string,
    serviceId: string,
    subServiceId: string,
    mealPlanId: string,
    subMealPlanId: string,
    itemId: string,
  ) => void
  onRemoveItem: (
    date: string,
    serviceId: string,
    subServiceId: string,
    mealPlanId: string,
    subMealPlanId: string,
    itemId: string,
  ) => void
  onCreateItem: (name: string, category: string) => Promise<{ id: string; name: string }>
  visibleDates: number
  selectedSubServiceId: string | null
  onSubServiceSelect: (subServiceId: string) => void
  onApplyItemsToCell: (
    date: string,
    items: string[],
    serviceId: string,
    subServiceId: string,
    mealPlanId: string,
    subMealPlanId: string,
  ) => void
  prevWeekMap?: Record<string, any>
  addRepetitionLog?: (entry: any) => void
  dateRangeSet?: Set<string>
  copyBuffer: { items: string[]; meta?: any } | null
  handleCopyFromCell: (date: string, items: string[], meta: any) => void
  handlePasteToCell: (
    date: string,
    serviceId: string,
    subServiceId: string,
    mealPlanId: string,
    subMealPlanId: string,
  ) => void
  companies?: any[]
  buildings?: any[]
  structureAssignments?: any[]
  mealPlanStructureAssignments?: any[]
}) {
  const [isVisible, setIsVisible] = useState(false)
  const tableRef = useRef<HTMLDivElement>(null)
  const [showCompanyModal, setShowCompanyModal] = useState(false)
  const [selectedMealPlan, setSelectedMealPlan] = useState<MealPlan | null>(null)
  const [selectedSubMealPlan, setSelectedSubMealPlan] = useState<SubMealPlan | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>("")
  const [selectedDay, setSelectedDay] = useState<string>("")
  const [dragActive, setDragActive] = useState(false)
  const dragItemsRef = useRef<string[]>([])
  const [hoveredDate, setHoveredDate] = useState<string | null>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: "300px" },
    )
    if (tableRef.current) {
      observer.observe(tableRef.current)
    }
    return () => observer.disconnect()
  }, [])

  const displayDates = useMemo(() => dateRange.slice(0, visibleDates), [dateRange, visibleDates])

  useEffect(() => {
    const handleMouseUp = () => {
      setDragActive(false)
      dragItemsRef.current = []
      setHoveredDate(null)
    }
    document.addEventListener("mouseup", handleMouseUp)
    return () => document.removeEventListener("mouseup", handleMouseUp)
  }, [])

  const handleStartDrag = (date: string, items: string[]) => {
    if (!items || items.length === 0) {
      toast({ title: "Nothing to Drag", description: "This cell has no items to drag", variant: "destructive" })
      return
    }
    dragItemsRef.current = items.slice()
    setDragActive(true)
    setHoveredDate(date)
  }

  const handleHoverDrag = (date: string) => {
    if (!dragActive) return
    if (hoveredDate === date) return
    setHoveredDate(date)
  }

  if (!selectedSubServiceId) {
    return (
      <div ref={tableRef} className="mb-8">
        <h2 className="text-xl font-bold mb-4 bg-black text-white p-3 rounded">{service.name}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {subServices.map((subService) => (
            <button
              key={subService.id}
              onClick={() => onSubServiceSelect(subService.id)}
              className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 hover:bg-blue-50 transition-all text-left font-medium text-gray-700 hover:text-blue-700"
            >
              {subService.name}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div ref={tableRef} className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold bg-black text-white p-3 rounded flex-1">{service.name}</h2>
        <Button variant="outline" size="sm" onClick={() => onSubServiceSelect("")} className="ml-2">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Sub-Services
        </Button>
      </div>
      {!isVisible ? (
        <div className="h-48 flex items-center justify-center border rounded bg-gray-50">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="overflow-x-auto border rounded">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border bg-gray-100 p-2 sticky left-0 z-20 min-w-[200px]">Meal Plan / Sub Meal</th>
                {displayDates.map(({ date, day }) => (
                  <th key={date} className="border bg-gray-100 p-2 min-w-[250px]">
                    <div className="font-semibold">
                      {new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                    <div className="text-sm text-gray-600 font-normal">{day}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mealPlanStructure.map(({ mealPlan, subMealPlans }) =>
                subMealPlans.map((subMealPlan, idx) => (
                  <tr key={`${mealPlan.id}-${subMealPlan.id}`}>
                    <td className="border bg-gray-50 p-2 sticky left-0 z-10">
                      {idx === 0 && <div className="font-semibold text-blue-700">{mealPlan.name}</div>}
                      <div className="text-sm text-gray-700 ml-3">↳ {subMealPlan.name}</div>
                    </td>
                    {displayDates.map(({ date, day }) => {
                      const cell =
                        combinedMenu[date]?.[service.id]?.[selectedSubServiceId]?.[mealPlan.id]?.[subMealPlan.id]
                      const selectedItems = cell?.menuItemIds || []
                      const prevItems =
                        (prevWeekMap &&
                          prevWeekMap[date] &&
                          prevWeekMap[date][service.id] &&
                          prevWeekMap[date][service.id][selectedSubServiceId] &&
                          prevWeekMap[date][service.id][selectedSubServiceId][mealPlan.id] &&
                          prevWeekMap[date][service.id][selectedSubServiceId][mealPlan.id][subMealPlan.id]) ||
                        []

                      const addWithDetection = (itemId: string) => {
                        onAddItem(date, service.id, selectedSubServiceId!, mealPlan.id, subMealPlan.id, itemId)
                      }

                      const onHoverDragFromCell = (d: string) => {
                        if (!dragItemsRef.current || dragItemsRef.current.length === 0) return
                        onApplyItemsToCell(
                          d,
                          dragItemsRef.current.slice(),
                          service.id,
                          selectedSubServiceId!,
                          mealPlan.id,
                          subMealPlan.id,
                        )
                      }

                      return (
                        <MenuGridCell
                          key={`${date}-${service.id}-${selectedSubServiceId}-${mealPlan.id}-${subMealPlan.id}`}
                          date={date}
                          service={service}
                          mealPlan={mealPlan}
                          subMealPlan={subMealPlan}
                          selectedMenuItemIds={selectedItems}
                          allMenuItems={allItems}
                          onAddItem={(itemId) => addWithDetection(itemId)}
                          onRemoveItem={(itemId) =>
                            onRemoveItem(date, service.id, selectedSubServiceId!, mealPlan.id, subMealPlan.id, itemId)
                          }
                          onCreateItem={onCreateItem}
                          onStartDrag={(d, items) => {
                            dragItemsRef.current = items.slice()
                            setDragActive(true)
                            onApplyItemsToCell(
                              d,
                              items.slice(),
                              service.id,
                              selectedSubServiceId!,
                              mealPlan.id,
                              subMealPlan.id,
                            )
                          }}
                          onHoverDrag={(d) => {
                            if (!dragActive) return
                            onHoverDragFromCell(d)
                          }}
                          isDragActive={dragActive}
                          isDragHover={hoveredDate === date}
                          prevItems={prevItems}
                          onCopy={() =>
                            handleCopyFromCell(date, selectedItems, {
                              serviceId: service.id,
                              subServiceId: selectedSubServiceId,
                              mealPlanId: mealPlan.id,
                              subMealPlanId: subMealPlan.id,
                            })
                          }
                          onPaste={() =>
                            handlePasteToCell(date, service.id, selectedSubServiceId!, mealPlan.id, subMealPlan.id)
                          }
                          canPaste={!!copyBuffer?.items && copyBuffer.items.length > 0}
                          onCellMouseEnter={() => {
                            handleHoverDrag(date)
                          }}
                          day={day}
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
      )}
      {selectedMealPlan && selectedSubMealPlan && selectedDate && selectedDay && (
        <CompanyAssignmentModal
          isOpen={showCompanyModal}
          onClose={() => {
            setShowCompanyModal(false)
            setSelectedMealPlan(null)
            setSelectedSubMealPlan(null)
            setSelectedDate("")
            setSelectedDay("")
          }}
          mealPlan={selectedMealPlan}
          subMealPlan={selectedSubMealPlan}
          service={service}
          selectedSubServiceId={selectedSubServiceId || ""}
          companies={companies || []}
          buildings={buildings || []}
          structureAssignments={structureAssignments || []}
          date={selectedDate}
          day={selectedDay}
        />
      )}
    </div>
  )
})

// ---------------------- Parent Component ----------------------
export default function CombinedMenuCreationPage() {
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [services, setServices] = useState<Service[]>([])
  const [subServices, setSubServices] = useState<SubService[]>([])
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([])
  const [subMealPlans, setSubMealPlans] = useState<SubMealPlan[]>([])
  const [dateRange, setDateRange] = useState<Array<{ date: string; day: string }>>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [combinedMenu, setCombinedMenu] = useState<CombinedMenuData>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generatingGrid, setGeneratingGrid] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [menuItemsLoading, setMenuItemsLoading] = useState(false)
  const [selectedSubServiceIds, setSelectedSubServiceIds] = useState<{ [serviceId: string]: string }>({})
  const [prevWeekMap, setPrevWeekMap] = useState<Record<string, any>>({})
  const [repetitionLog, setRepetitionLog] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [buildings, setBuildings] = useState<any[]>([])
  const [mealPlanStructureAssignments, setMealPlanStructureAssignments] = useState<any[]>([])
  const [hasDraft, setHasDraft] = useState(false)
  const [draftLoading, setDraftLoading] = useState(false)
  const [userCompanyId, setUserCompanyId] = useState<string>("")
  const dateRangeSet = useRef<Set<string>>(new Set())
  const repetitionLogKeysRef = useRef<Set<string>>(new Set())
  const [copyBuffer, setCopyBuffer] = useState<{ items: string[]; meta?: any } | null>(null)
  const [showLogPanel, setShowLogPanel] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Mock userCompanyId for now.
  useEffect(() => {
    setUserCompanyId("company123") 
  }, [])

  useEffect(() => {
    loadData()
  }, [])

  const CHUNK_SIZE = 7
  const [visibleDates, setVisibleDates] = useState(0)

  useEffect(() => {
    if (showModal && visibleDates < dateRange.length) {
      const timer = setTimeout(() => {
        setVisibleDates((v) => Math.min(v + CHUNK_SIZE, dateRange.length))
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [showModal, visibleDates, dateRange.length])

  const loadData = async () => {
    try {
      setLoading(true)
      const [
        servicesData,
        subServicesData,
        mealPlansData,
        subMealPlansData,
        companiesData,
        buildingsData,
        mealPlanStructureAssignmentsData,
      ] = await Promise.all([
        servicesService.getAll(),
        subServicesService.getAll(),
        mealPlansService.getAll(),
        subMealPlansService.getAll(),
        companiesService.getAll(),
        buildingsService.getAll(),
        mealPlanStructureAssignmentsService.getAll(),
      ])

      const activeServices = servicesData
        .filter((s: any) => s.status === "active")
        .sort((a: any, b: any) => (a.order || 999) - (b.order || 999))
      const activeMealPlans = mealPlansData
        .filter((mp: any) => mp.status === "active")
        .sort((a: any, b: any) => (a.order || 999) - (b.order || 999))
      const activeSubMealPlans = subMealPlansData
        .filter((smp: any) => smp.status === "active")
        .sort((a: any, b: any) => (a.order || 999) - (b.order || 999))

      setServices(activeServices)
      setSubServices(
        subServicesData
          .filter((ss: any) => ss.status === "active")
          .sort((a: any, b: any) => (a.order || 999) - (b.order || 999)),
      )
      setMealPlans(activeMealPlans)
      setSubMealPlans(activeSubMealPlans)
      setCompanies(companiesData.filter((c: any) => c.status === "active"))
      setBuildings(buildingsData.filter((b: any) => b.status === "active"))
      setMealPlanStructureAssignments(mealPlanStructureAssignmentsData.filter((m: any) => m.status === "active"))
    } catch (error) {
      console.error("Error loading data:", error)
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const loadMenuItems = useCallback(async () => {
    if (menuItems.length > 0 || menuItemsLoading) return
    try {
      setMenuItemsLoading(true)
      const allItems = await menuItemsService.getAll()
      if (mountedRef.current) {
        setMenuItems(allItems)
      }
    } catch (error) {
      console.error("Error loading menu items:", error)
      toast({ title: "Error", description: "Failed to load menu items", variant: "destructive" })
    } finally {
      if (mountedRef.current) {
        setMenuItemsLoading(false)
      }
    }
  }, [menuItems.length, menuItemsLoading])

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

  const filterEmptyCells = (menuData: CombinedMenuData): CombinedMenuData => {
    const filtered: CombinedMenuData = {}

    Object.entries(menuData).forEach(([date, dayMenu]) => {
      const filteredDayMenu: DayMenu = {}

      Object.entries(dayMenu).forEach(([serviceId, serviceData]) => {
        const filteredService: any = {}

        Object.entries(serviceData).forEach(([subServiceId, subServiceData]) => {
          const filteredSubService: any = {}

          Object.entries(subServiceData).forEach(([mealPlanId, mealPlanData]) => {
            const filteredMealPlan: any = {}

            Object.entries(mealPlanData).forEach(([subMealPlanId, cell]) => {
              if (cell.menuItemIds && cell.menuItemIds.length > 0) {
                filteredMealPlan[subMealPlanId] = cell
              }
            })

            if (Object.keys(filteredMealPlan).length > 0) {
              filteredSubService[mealPlanId] = filteredMealPlan
            }
          })

          if (Object.keys(filteredSubService).length > 0) {
            filteredService[subServiceId] = filteredSubService
          }
        })

        if (Object.keys(filteredService).length > 0) {
          filteredDayMenu[serviceId] = filteredService
        }
      })

      if (Object.keys(filteredDayMenu).length > 0) {
        filtered[date] = filteredDayMenu
      }
    })

    return filtered
  }

  const handleSaveDraft = async () => {
    try {
      setSaving(true)
      const filteredMenuData = filterEmptyCells(combinedMenu)

      if (Object.keys(filteredMenuData).length === 0) {
        toast({ title: "Error", description: "Please add menu items before saving", variant: "destructive" })
        setSaving(false)
        return
      }

      const draftData = {
        startDate,
        endDate,
        menuData: filteredMenuData,
        status: "draft",
        companyId: userCompanyId,
      }

      await combinedMenusService.add(draftData)
      toast({ title: "Success", description: "Menu saved as draft successfully" })
      setHasDraft(true)
    } catch (error) {
      console.error("Error saving draft:", error)
      toast({ title: "Error", description: "Failed to save menu as draft", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const generateDateRange = async () => {
    if (!startDate || !endDate) {
      toast({
        title: "Validation Error",
        description: "Please select both start and end dates",
        variant: "destructive",
      })
      return
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (start > end) {
      toast({ title: "Validation Error", description: "Start date must be before end date", variant: "destructive" })
      return
    }

    setGeneratingGrid(true)

    try {
      const isDuplicate = await combinedMenusService.checkDuplicate(startDate, endDate)
      if (isDuplicate) {
        setGeneratingGrid(false)
        toast({
          title: "Menu Already Exists",
          description: `A combined menu for ${startDate} to ${endDate} already exists. Please select a different date range.`,
          variant: "destructive",
        })
        return
      }
    } catch (error) {
      console.error("Error checking duplicate menu:", error)
      setGeneratingGrid(false)
      toast({
        title: "Error",
        description: "Failed to check for existing menus",
        variant: "destructive",
      })
      return
    }

    if (menuItems.length === 0) {
      await loadMenuItems()
    }

    // Async block for generation and draft fetching
    setTimeout(async () => {
      const dates: Array<{ date: string; day: string }> = []
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
      const current = new Date(start)

      while (current <= end) {
        dates.push({ date: current.toISOString().split("T")[0], day: days[current.getDay()] })
        current.setDate(current.getDate() + 1)
      }

      // 1. Create Empty Skeleton
      const initialMenu: CombinedMenuData = {}
      dates.forEach(({ date }) => {
        initialMenu[date] = {}
        services.forEach((service) => {
          initialMenu[date][service.id] = {}
          subServices
            .filter((ss) => ss.serviceId === service.id)
            .forEach((subService) => {
              initialMenu[date][service.id][subService.id] = {}
              mealPlans.forEach((mealPlan) => {
                initialMenu[date][service.id][subService.id][mealPlan.id] = {}
                const relatedSubMealPlans = subMealPlans.filter((smp) => smp.mealPlanId === mealPlan.id)
                relatedSubMealPlans.forEach((subMealPlan) => {
                  initialMenu[date][service.id][subService.id][mealPlan.id][subMealPlan.id] = { menuItemIds: [] }
                })
              })
            })
        })
      })

      // 2. Fetch and Merge Draft if exists
      let draftFound = false;
      try {
        const draftData = await combinedMenusService.getDraftByDateRange(startDate, endDate, userCompanyId)
        if (draftData && draftData.menuData) {
            draftFound = true;
            setHasDraft(true);
            Object.entries(draftData.menuData).forEach(([dDate, dayData]: [string, any]) => {
                if (!initialMenu[dDate]) return;

                Object.entries(dayData).forEach(([svcId, svcData]: [string, any]) => {
                    if (!initialMenu[dDate][svcId]) return;

                    Object.entries(svcData).forEach(([subSvcId, subSvcData]: [string, any]) => {
                        if (!initialMenu[dDate][svcId][subSvcId]) return;

                        Object.entries(subSvcData).forEach(([mpId, mpData]: [string, any]) => {
                            if (!initialMenu[dDate][svcId][subSvcId][mpId]) return;

                            Object.entries(mpData).forEach(([smpId, cellData]: [string, any]) => {
                                if (initialMenu[dDate][svcId][subSvcId][mpId][smpId]) {
                                    initialMenu[dDate][svcId][subSvcId][mpId][smpId] = cellData;
                                }
                            });
                        });
                    });
                });
            });
            toast({ title: "Draft Restored", description: "Found an existing draft for these dates." });
        } else {
            setHasDraft(false);
        }
      } catch (e) {
        console.error("Error fetching draft during generation", e);
      }

      // 3. Fetch Repetition Logs & Enrich with Names
      try {
        const logs = await repetitionLogsService.getByDateRange(startDate, endDate, userCompanyId)
        if (logs.length > 0) {
            
            // Fix: Map over logs and inject names from local services state
            const enrichedLogs = logs.map((log: any) => {
                const sName = log.serviceName || services.find(s => s.id === log.serviceId)?.name || "Unknown Service";
                const ssName = log.subServiceName || subServices.find(ss => ss.id === log.subServiceId)?.name || "Unknown Sub-Service";
                return {
                    ...log,
                    serviceName: sName,
                    subServiceName: ssName
                };
            });

            setRepetitionLog(enrichedLogs);

            enrichedLogs.forEach((entry: any) => {
                const keyObj = {
                    type: entry.type,
                    itemId: entry.itemId ?? "",
                    attemptedDate: entry.attemptedDate ?? "",
                    serviceId: entry.serviceId ?? "",
                    subServiceId: entry.subServiceId ?? "",
                    mealPlanId: entry.mealPlanId ?? "",
                    subMealPlanId: entry.subMealPlanId ?? "",
                }
                repetitionLogKeysRef.current.add(JSON.stringify(keyObj));
            })
        }
      } catch(e) {
        console.error("Error fetching repetition logs", e);
      }

      if (mountedRef.current) {
        setDateRange(dates)
        const drSet = new Set(dates.map((d) => d.date))
        dateRangeSet.current = drSet
        await loadPrevWeekMap(dates.map((d) => d.date))
        setCombinedMenu(initialMenu)
        setGeneratingGrid(false)
        setShowModal(true)
        setVisibleDates(CHUNK_SIZE)
      }
    }, 100)
  }

  const addRepetitionLog = useCallback(async (entry: any) => {
    try {
      const keyObj = {
        type: entry.type,
        itemId: entry.itemId ?? JSON.stringify(entry.items ?? ""),
        attemptedDate: entry.attemptedDate ?? entry.appliedToDate ?? "",
        serviceId: entry.serviceId ?? "",
        subServiceId: entry.subServiceId ?? "",
        mealPlanId: entry.mealPlanId ?? "",
        subMealPlanId: entry.subMealPlanId ?? "",
      }
      const key = JSON.stringify(keyObj)
      if (repetitionLogKeysRef.current.has(key)) {
        return
      }
      repetitionLogKeysRef.current.add(key)

      const fullEntry = {
        ...entry,
        menuStartDate: startDate,
        menuEndDate: endDate,
        companyId: userCompanyId,
      }

      const result = await repetitionLogsService.add(fullEntry);
      
      setRepetitionLog((p) => [{ ...fullEntry, id: result.id, time: fullEntry.time || new Date().toISOString() }, ...p])
    } catch (err) {
      console.error("Error adding repetition log", err);
    }
  }, [startDate, endDate, userCompanyId])

  const clearRepetitionLog = useCallback(async () => {
    try {
        const ids = repetitionLog.map(l => l.id).filter(id => id);
        if (ids.length > 0) {
            await repetitionLogsService.deleteAll(ids);
        }
        setRepetitionLog([])
        repetitionLogKeysRef.current.clear()
        toast({ title: "Logs Cleared", description: "All detection logs have been removed." })
    } catch(e) {
        console.error("Error clearing logs", e);
        toast({ title: "Error", description: "Failed to clear logs from database", variant: "destructive" });
    }
  }, [repetitionLog])

  // --- NEW: Remove Single Log ---
  const removeRepetitionLog = useCallback(async (logId: string) => {
    try {
      // Optimistic update
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
      }

      await repetitionLogsService.deleteAll([logId]);
      toast({ title: "Log Removed", description: "Log entry removed." });
    } catch (error) {
      console.error("Error removing log:", error);
      toast({ title: "Error", description: "Failed to remove log", variant: "destructive" });
    }
  }, [repetitionLog]);

  const addMenuItemToCell = useCallback(
    async (
      date: string,
      serviceId: string,
      subServiceId: string,
      mealPlanId: string,
      subMealPlanId: string,
      menuItemId: string,
    ) => {
      const dates = dateRange.map((d) => d.date)
      const inWeek = dates.some((d) => {
        if (d === date) return false
        const cell = combinedMenu[d]?.[serviceId]?.[subServiceId]?.[mealPlanId]?.[subMealPlanId]
        return cell?.menuItemIds?.includes(menuItemId)
      })

      // Look up names for logging
      const serviceName = services.find(s => s.id === serviceId)?.name || "Unknown Service";
      const subServiceName = subServices.find(s => s.id === subServiceId)?.name || "Unknown Sub-Service";

      const currentSubMealPlan = subMealPlans.find(smp => smp.id === subMealPlanId);
      const isRepeatAllowed = currentSubMealPlan?.isRepeatPlan || false;

      if (inWeek) {
        if (!isRepeatAllowed) {
            const entry = {
            type: "In-week duplicate",
            itemId: menuItemId,
            itemName: menuItems.find((m) => m.id === menuItemId)?.name || menuItemId,
            serviceId,
            serviceName,
            subServiceId,
            subServiceName,
            mealPlanId,
            subMealPlanId,
            attemptedDate: date,
            time: new Date().toISOString(),
            }
            addRepetitionLog(entry)
            toast({
            title: "Duplicate in week",
            description: `${entry.itemName} already exists in the week for this row.`,
            variant: "destructive",
            })
        }
      }

      const prevHas =
        prevWeekMap &&
        prevWeekMap[date] &&
        prevWeekMap[date][serviceId] &&
        prevWeekMap[date][serviceId][subServiceId] &&
        prevWeekMap[date][serviceId][subServiceId][mealPlanId] &&
        prevWeekMap[date][serviceId][subServiceId][mealPlanId][subMealPlanId] &&
        prevWeekMap[date][serviceId][subServiceId][mealPlanId][subMealPlanId].includes(menuItemId)

      if (prevHas && !inWeek) {
         if (!isRepeatAllowed) {
            const entry = {
            type: "Prev-week repeat",
            itemId: menuItemId,
            itemName: menuItems.find((m) => m.id === menuItemId)?.name || menuItemId,
            serviceId,
            serviceName,
            subServiceId,
            subServiceName,
            mealPlanId,
            subMealPlanId,
            prevDate: (() => {
                const d = new Date(date)
                d.setDate(d.getDate() - 7)
                return d.toISOString().split("T")[0]
            })(),
            attemptedDate: date,
            time: new Date().toISOString(),
            }
            addRepetitionLog(entry)
            toast({
            title: "Repeat from previous week",
            description: `${entry.itemName} was used on ${entry.prevDate}.`,
            variant: "destructive",
            })
        }
      }

      setCombinedMenu((prev) => {
        const newMenu = { ...prev }
        if (!newMenu[date]) newMenu[date] = {}
        if (!newMenu[date][serviceId]) newMenu[date][serviceId] = {}
        if (!newMenu[date][serviceId][subServiceId]) newMenu[date][serviceId][subServiceId] = {}
        if (!newMenu[date][serviceId][subServiceId][mealPlanId]) newMenu[date][serviceId][subServiceId][mealPlanId] = {}
        if (!newMenu[date][serviceId][subServiceId][mealPlanId][subMealPlanId]) {
          newMenu[date][serviceId][subServiceId][mealPlanId][subMealPlanId] = { menuItemIds: [] }
        }
        const existingIds = newMenu[date][serviceId][subServiceId][mealPlanId][subMealPlanId].menuItemIds
        if (existingIds.includes(menuItemId)) {
          return prev
        }
        newMenu[date][serviceId][subServiceId][mealPlanId][subMealPlanId] = {
          menuItemIds: [...existingIds, menuItemId],
        }
        return newMenu
      })
    },
    [combinedMenu, dateRange, menuItems, prevWeekMap, addRepetitionLog, services, subServices, subMealPlans],
  )

  const removeMenuItemFromCell = useCallback(
    async (
      date: string,
      serviceId: string,
      subServiceId: string,
      mealPlanId: string,
      subMealPlanId: string,
      menuItemId: string,
    ) => {
      // 1. Remove from local menu state
      setCombinedMenu((prev) => {
        const newMenu = { ...prev }
        if (newMenu[date]?.[serviceId]?.[subServiceId]?.[mealPlanId]?.[subMealPlanId]) {
          newMenu[date][serviceId][subServiceId][mealPlanId][subMealPlanId] = {
            menuItemIds: newMenu[date][serviceId][subServiceId][mealPlanId][subMealPlanId].menuItemIds.filter(
              (id) => id !== menuItemId,
            ),
          }
        }
        return newMenu
      })

      // 2. Remove associated repetition logs
      // Check for any log entries that match the item being removed in this context
      const logsToRemove = repetitionLog.filter(log => 
          log.itemId === menuItemId &&
          log.attemptedDate === date &&
          log.serviceId === serviceId &&
          log.subServiceId === subServiceId &&
          log.mealPlanId === mealPlanId &&
          log.subMealPlanId === subMealPlanId
      );

      if (logsToRemove.length > 0) {
          const ids = logsToRemove.map(l => l.id).filter(id => id);
          
          // Allow re-logging by removing keys from tracking ref
          logsToRemove.forEach(log => {
               const keyObj = {
                  type: log.type,
                  itemId: log.itemId,
                  attemptedDate: log.attemptedDate,
                  serviceId: log.serviceId,
                  subServiceId: log.subServiceId,
                  mealPlanId: log.mealPlanId,
                  subMealPlanId: log.subMealPlanId,
               }
               repetitionLogKeysRef.current.delete(JSON.stringify(keyObj));
          });

          // Optimistically update UI state
          setRepetitionLog(prev => prev.filter(log => !ids.includes(log.id)));

          // Delete from DB
          if (ids.length > 0) {
              try {
                  await repetitionLogsService.deleteAll(ids);
                  toast({ title: "Log Removed", description: "Removed associated duplicate warning." });
              } catch (error) {
                  console.error("Failed to delete logs from DB", error);
              }
          }
      }
    },
    [repetitionLog],
  )

  const handleCreateItem = useCallback(async (name: string, category: string) => {
    try {
      const docRef = await addDoc(collection(db, "menuItems"), {
        name,
        category: category || null,
        status: "active",
        order: 999,
        createdAt: new Date(),
      })
      const newItem: MenuItem = { id: docRef.id, name, category: category || undefined, status: "active", order: 999 }
      setMenuItems((prev) => [...prev, newItem])
      toast({ title: "Success", description: `Menu item "${name}" created successfully` })
      return newItem
    } catch (error) {
      console.error("Create error:", error)
      toast({ title: "Error", description: "Failed to create menu item", variant: "destructive" })
      throw error
    }
  }, [])

  const handleSaveCombinedMenu = async () => {
    try {
      setSaving(true)
      const filteredMenuData = filterEmptyCells(combinedMenu)

      if (Object.keys(filteredMenuData).length === 0) {
        toast({ title: "Error", description: "Please add menu items before saving", variant: "destructive" })
        setSaving(false)
        return
      }

      const combinedMenuData = { startDate, endDate, menuData: filteredMenuData, status: "active" }
      const savedMenu = await combinedMenusService.add(combinedMenuData)
      await generateCompanyMenus(savedMenu.id, filteredMenuData)
      toast({ title: "Success", description: "Combined menu saved and company menus generated successfully" })
      setShowModal(false)
      setStartDate("")
      setEndDate("")
      setDateRange([])
      setCombinedMenu({})
      setVisibleDates(0)
      setPrevWeekMap({})
      setRepetitionLog([])
      repetitionLogKeysRef.current.clear()
      setCopyBuffer(null)
      setHasDraft(false) 
    } catch (error) {
      console.error("Error saving combined menu:", error)
      toast({ title: "Error", description: "Failed to save combined menu", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const generateCompanyMenus = async (combinedMenuId: string, filteredMenuData: CombinedMenuData) => {
    try {
      const [companies, buildings, structureAssignments, mealPlanStructureAssignments] = await Promise.all([
        companiesService.getAll(),
        buildingsService.getAll(),
        structureAssignmentsService.getAll(),
        mealPlanStructureAssignmentsService.getAll(),
      ])

      const activeCompanies = companies.filter((c: any) => c.status === "active")

      for (const company of activeCompanies) {
        const companyBuildings = buildings.filter((b: any) => b.companyId === company.id && b.status === "active")

        for (const building of companyBuildings) {
          const structureAssignment = structureAssignments.find(
            (sa: any) => sa.companyId === company.id && sa.buildingId === building.id && sa.status === "active",
          )
          const mealPlanStructureData = mealPlanStructureAssignments.find(
            (mpsa: any) => mpsa.companyId === company.id && mpsa.buildingId === building.id && mpsa.status === "active",
          )

          if (structureAssignment && mealPlanStructureData) {
            const companyMenu = buildCompanyMenu(
              company,
              building,
              structureAssignment,
              mealPlanStructureData,
              filteredMenuData,
              dateRange,
            )
            await companyMenusService.add({ ...companyMenu, combinedMenuId, status: "active" })
          }
        }
      }
    } catch (error) {
      console.error("Error generating company menus:", error)
      throw error
    }
  }

  const buildCompanyMenu = (
    company: any,
    building: any,
    structureAssignment: any,
    mealPlanStructureData: any,
    combinedMenu: CombinedMenuData,
    dateRange: Array<{ date: string; day: string }>,
  ) => {
    const companyMenuData: any = {}

    dateRange.forEach(({ date, day }) => {
      const dayKey = day.toLowerCase()
      const dayServices = structureAssignment.weekStructure[dayKey] || []
      const dayMealPlanStructure = mealPlanStructureData.weekStructure[dayKey] || []

      companyMenuData[date] = {}

      dayServices.forEach((service: any) => {
        const serviceId = service.serviceId
        const serviceMealPlanStructure = dayMealPlanStructure.find((s: any) => s.serviceId === serviceId)

        if (serviceMealPlanStructure && combinedMenu[date]?.[serviceId]) {
          companyMenuData[date][serviceId] = {}

          serviceMealPlanStructure.subServices.forEach((subService: any) => {
            if (!companyMenuData[date][serviceId][subService.subServiceId]) {
              companyMenuData[date][serviceId][subService.subServiceId] = {}
            }

            subService.mealPlans.forEach((mealPlan: any) => {
              const mealPlanId = mealPlan.mealPlanId

              if (combinedMenu[date][serviceId][subService.subServiceId]?.[mealPlanId]) {
                if (!companyMenuData[date][serviceId][subService.subServiceId][mealPlanId]) {
                  companyMenuData[date][serviceId][subService.subServiceId][mealPlanId] = {}
                }

                mealPlan.subMealPlans.forEach((subMealPlan: any) => {
                  const subMealPlanId = subMealPlan.subMealPlanId

                  if (combinedMenu[date][serviceId][subService.subServiceId][mealPlanId]?.[subMealPlanId]) {
                    companyMenuData[date][serviceId][subService.subServiceId][mealPlanId][subMealPlanId] = {
                      ...combinedMenu[date][serviceId][subService.subServiceId][mealPlanId][subMealPlanId],
                    }
                  }
                })
              }
            })
          })
        }
      })
    })

    return {
      companyId: company.id,
      buildingId: building.id,
      companyName: company.name,
      buildingName: building.name,
      startDate: dateRange[0].date,
      endDate: dateRange[dateRange.length - 1].date,
      menuData: companyMenuData,
    }
  }

  const mealPlanStructure = useMemo(
    () =>
      mealPlans.map((mealPlan) => ({
        mealPlan,
        subMealPlans: subMealPlans.filter((smp) => smp.mealPlanId === mealPlan.id),
      })),
    [mealPlans, subMealPlans],
  )

  const applyItemsToCell = useCallback(
    (
      date: string,
      items: string[],
      serviceId: string,
      subServiceId: string,
      mealPlanId: string,
      subMealPlanId: string,
    ) => {
      const dates = dateRange.map((d) => d.date)
      
      // Look up names for logging
      const serviceName = services.find(s => s.id === serviceId)?.name || "Unknown Service";
      const subServiceName = subServices.find(s => s.id === subServiceId)?.name || "Unknown Sub-Service";

      const currentSubMealPlan = subMealPlans.find(smp => smp.id === subMealPlanId);
      const isRepeatAllowed = currentSubMealPlan?.isRepeatPlan || false;

      items.forEach((menuItemId) => {
        const inWeek = dates.some((d) => {
          if (d === date) return false
          const cell = combinedMenu[d]?.[serviceId]?.[subServiceId]?.[mealPlanId]?.[subMealPlanId]
          return cell?.menuItemIds?.includes(menuItemId)
        })

        if (inWeek) {
          if (!isRepeatAllowed) {
            const entry = {
                type: "In-week duplicate",
                itemId: menuItemId,
                itemName: menuItems.find((m) => m.id === menuItemId)?.name || menuItemId,
                serviceId,
                serviceName,
                subServiceId,
                subServiceName,
                mealPlanId,
                subMealPlanId,
                attemptedDate: date,
                time: new Date().toISOString(),
            }
            addRepetitionLog(entry)
            toast({
                title: "Duplicate in week",
                description: `${entry.itemName} already exists in the week for this row.`,
                variant: "destructive",
            })
          }
          return
        }

        const prevHas =
          prevWeekMap &&
          prevWeekMap[date] &&
          prevWeekMap[date][serviceId] &&
          prevWeekMap[date][serviceId][subServiceId] &&
          prevWeekMap[date][serviceId][subServiceId][mealPlanId] &&
          prevWeekMap[date][serviceId][subServiceId][mealPlanId][subMealPlanId] &&
          prevWeekMap[date][serviceId][subServiceId][mealPlanId][subMealPlanId].includes(menuItemId)

        if (prevHas) {
          if (!isRepeatAllowed) {
            const entry = {
                type: "Prev-week repeat",
                itemId: menuItemId,
                itemName: menuItems.find((m) => m.id === menuItemId)?.name || menuItemId,
                serviceId,
                serviceName,
                subServiceId,
                subServiceName,
                mealPlanId,
                subMealPlanId,
                prevDate: (() => {
                const d = new Date(date)
                d.setDate(d.getDate() - 7)
                return d.toISOString().split("T")[0]
                })(),
                attemptedDate: date,
                time: new Date().toISOString(),
            }
            addRepetitionLog(entry)
            toast({
                title: "Repeat from previous week",
                description: `${entry.itemName} was used on ${entry.prevDate}.`,
                variant: "destructive",
            })
          }
        }
      })

      setCombinedMenu((prev) => {
        const newMenu = { ...prev }
        if (!newMenu[date]) newMenu[date] = {}
        if (!newMenu[date][serviceId]) newMenu[date][serviceId] = {}
        if (!newMenu[date][serviceId][subServiceId]) newMenu[date][serviceId][subServiceId] = {}
        if (!newMenu[date][serviceId][subServiceId][mealPlanId]) newMenu[date][serviceId][subServiceId][mealPlanId] = {}
        newMenu[date][serviceId][subServiceId][mealPlanId][subMealPlanId] = { menuItemIds: items.slice() }
        return newMenu
      })
    },
    [combinedMenu, dateRange, menuItems, prevWeekMap, addRepetitionLog, services, subServices, subMealPlans],
  )

  const handleCopyFromCell = useCallback((date: string, items: string[], meta: any) => {
    if (!items || items.length === 0) {
      toast({ title: "Nothing to copy", description: "This cell has no items", variant: "destructive" })
      return
    }
    setCopyBuffer({ items: items.slice(), meta })
    toast({ title: "Copied", description: `Copied ${items.length} item(s)` })
  }, [])

  const handlePasteToCell = useCallback(
    (date: string, serviceId: string, subServiceId: string, mealPlanId: string, subMealPlanId: string) => {
      if (!copyBuffer || !copyBuffer.items || copyBuffer.items.length === 0) {
        toast({ title: "Nothing to paste", description: "Copy some items first", variant: "destructive" })
        return
      }
      applyItemsToCell(date, copyBuffer.items.slice(), serviceId, subServiceId, mealPlanId, subMealPlanId)
      toast({ title: "Pasted", description: `Pasted ${copyBuffer.items.length} item(s) to ${date}` })
    },
    [copyBuffer, applyItemsToCell, menuItems],
  )

  const clearCopyBuffer = useCallback(() => {
    setCopyBuffer(null)
    toast({ title: "Copy cleared" })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <div className="text-lg font-medium">Loading data...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/combined-menus">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Combined Menu Creation</h1>
            <p className="text-gray-600">Create master menu that will generate company-specific menus</p>
          </div>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Select Date Range
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button onClick={generateDateRange} disabled={generatingGrid} className="w-full">
                {generatingGrid ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating Grid...
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-4 w-4 mr-2" />
                    Open Menu Grid
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {startDate && endDate && hasDraft && !showModal && (
        <Card className="mb-6 border-l-4 border-l-purple-500 bg-purple-50">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-sm text-gray-700">
                <span className="font-medium">Draft available.</span> It will be loaded automatically when you open the grid.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {showModal && (
        <>
          <div className="fixed inset-0 z-[9999] w-screen h-screen bg-black/50 flex items-center justify-center ">
            <div className="bg-white w-screen h-screen flex flex-col relative overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-white to-blue-50">
                <div>
                  <h2 className="text-xl font-bold">Combined Menu Grid</h2>
                  <p className="text-sm text-gray-600">
                    {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
                    {visibleDates < dateRange.length && (
                      <span className="ml-2 text-blue-600">
                        (Loading {visibleDates}/{dateRange.length} days...)
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2 items-center">
                  {menuItemsLoading && (
                    <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-3 py-2 rounded text-sm text-blue-700">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading items...</span>
                    </div>
                  )}
                  {copyBuffer ? (
                    <div className="flex items-center gap-2 px-3 py-2 border rounded bg-yellow-50 text-sm">
                      <div className="text-sm">Copied: {copyBuffer.items.length}</div>
                      <Button variant="ghost" size="sm" onClick={clearCopyBuffer}>
                        Clear
                      </Button>
                    </div>
                  ) : null}
                  <Button
                    onClick={handleSaveDraft}
                    disabled={saving || draftLoading || Object.keys(combinedMenu).length === 0}
                    variant="outline"
                    size="sm"
                    className="border-purple-300 text-purple-700 hover:bg-purple-100 bg-transparent"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save as Draft
                      </>
                    )}
                  </Button>
                  <Button onClick={handleSaveCombinedMenu} disabled={saving || menuItemsLoading}>
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save & Generate Company Menus
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setShowModal(false)} disabled={saving}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4">
                {services.map((service) => {
                  const serviceSubServices = subServices.filter((ss) => ss.serviceId === service.id)
                  return (
                    <ServiceTable
                      key={service.id}
                      service={service}
                      subServices={serviceSubServices}
                      dateRange={dateRange}
                      mealPlanStructure={mealPlanStructure}
                      combinedMenu={combinedMenu}
                      allItems={menuItems}
                      onAddItem={addMenuItemToCell}
                      onRemoveItem={removeMenuItemFromCell}
                      onCreateItem={handleCreateItem}
                      visibleDates={visibleDates}
                      selectedSubServiceId={selectedSubServiceIds[service.id] || null}
                      onSubServiceSelect={(subServiceId) =>
                        setSelectedSubServiceIds((prev) => ({ ...prev, [service.id]: subServiceId }))
                      }
                      onApplyItemsToCell={applyItemsToCell}
                      prevWeekMap={prevWeekMap}
                      addRepetitionLog={addRepetitionLog}
                      dateRangeSet={dateRangeSet.current}
                      copyBuffer={copyBuffer}
                      handleCopyFromCell={(date, items, meta) => handleCopyFromCell(date, items, meta)}
                      handlePasteToCell={(date, serviceId, subServiceId, mealPlanId, subMealPlanId) =>
                        handlePasteToCell(date, serviceId, subServiceId, mealPlanId, subMealPlanId)
                      }
                      mealPlanStructureAssignments={mealPlanStructureAssignments}
                      companies={companies}
                      buildings={buildings}
                      structureAssignments={mealPlanStructureAssignments}
                    />
                  )
                })}
              </div>

              {/* Floating Action Button for Logs */}
              <button
                onClick={() => setShowLogPanel(!showLogPanel)}
                className={`fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-[60] flex items-center justify-center transition-all duration-200 border-2 border-white ${
                  repetitionLog.length > 0 
                    ? "bg-red-500 hover:bg-red-600 text-white animate-in zoom-in" 
                    : "bg-gray-400 hover:bg-gray-500 text-white"
                }`}
                title="Toggle Repetition Logs"
              >
                 <div className="flex flex-col items-center">
                    {showLogPanel ? <ChevronDown className="h-6 w-6" /> : <AlertCircle className="h-5 w-5" />}
                    {!showLogPanel && <span className="text-[10px] font-bold">{repetitionLog.length}</span>}
                 </div>
              </button>

              {/* Log Panel */}
              {showLogPanel && (
                <div className="border-t bg-white p-4 animate-in slide-in-from-bottom-10 z-50 shadow-[0_-5px_20px_rgba(0,0,0,0.1)]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-semibold text-sm flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-500"/>
                        Repetition Log
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-gray-500">{repetitionLog.length} entries</div>
                      <Button variant="ghost" size="sm" onClick={clearRepetitionLog} className="text-red-600 hover:bg-red-50">
                        Clear All Logs
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {repetitionLog.length === 0 ? (
                      <div className="text-xs text-gray-500 italic p-2">No repetitions detected yet. Great job!</div>
                    ) : (
                      repetitionLog.map((entry, idx) => {
                        const isError = entry.type === "In-week duplicate" || entry.type === "Prev-week repeat"
                        const bgColor = isError ? "bg-red-50" : "bg-green-50"
                        const borderColor = isError ? "border-red-200" : "border-green-200"
                        const textColor = isError ? "text-red-700" : "text-green-700"

                        return (
                          <div
                            key={idx}
                            className={`flex-shrink-0 p-3 border rounded ${bgColor} ${borderColor} text-xs min-w-[300px] relative`}
                          >
                            <div className={`flex items-start justify-between gap-2 mb-1 ${textColor} font-semibold`}>
                              <div className="truncate flex-1" title={entry.itemName || entry.itemId}>
                                {entry.type} — {entry.itemName || entry.itemNames?.join(", ") || entry.itemId}
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-xs whitespace-nowrap opacity-75">
                                    {entry.createdAt?.toDate 
                                        ? entry.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
                                        : entry.time 
                                            ? new Date(entry.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
                                            : ""}
                                </div>
                                <button 
                                  onClick={() => removeRepetitionLog(entry.id)}
                                  className="text-gray-400 hover:text-red-600 transition-colors p-0.5 rounded-full hover:bg-red-100"
                                  title="Dismiss this log"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                            
                            <div className="mb-1 font-medium text-gray-700 border-b border-gray-200 pb-1">
                                {entry.serviceName || "Service"} <span className="text-gray-400">/</span> {entry.subServiceName || "Sub-Service"}
                            </div>

                            <div className={isError ? "text-red-600" : "text-gray-600"}>
                              {entry.type === "In-week duplicate" && (
                                <>
                                  Already on{" "}
                                  <span className="font-semibold">{entry.originalDate || entry.attemptedDate}</span>.
                                  Attempted: <span className="font-semibold"> {entry.attemptedDate}</span>
                                </>
                              )}
                              {entry.type === "Prev-week repeat" && (
                                <>
                                  Prev week: <span className="font-semibold">{entry.prevDate}</span>. Attempted:{" "}
                                  <span className="font-semibold">{entry.attemptedDate}</span>
                                </>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}