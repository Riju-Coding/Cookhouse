"use client"

import { useState, useEffect, useCallback, useMemo, memo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Loader2, 
  Save, 
  X, 
  Search, 
  ChevronRight, 
  AlertCircle, 
  ChevronDown,
  Plus,
  Building2,
  FileText,
  ClipboardCopy,
  ClipboardPaste,
  GripHorizontal,
  CheckCircle,
  Calendar,
  Utensils
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
  companiesService,
  buildingsService,
} from "@/lib/services"
import { collection, getDocs, doc, getDoc, updateDoc, addDoc, query, where, writeBatch, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { detectMenuChanges, createChangeSummary } from "@/lib/change-detector"

// --- Local Services Definition (To prevent import errors) ---

const menuItemsService = {
  async getAll(): Promise<MenuItem[]> {
    const snapshot = await getDocs(collection(db, "menuItems"))
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as MenuItem)
  },
  async getDescriptions(itemId: string): Promise<string[]> {
    const docSnap = await getDoc(doc(db, "menuItems", itemId))
    return docSnap.data()?.descriptions || []
  },
  async addDescriptions(itemId: string, descriptions: string[]) {
    await updateDoc(doc(db, "menuItems", itemId), { descriptions })
  },
  async getSelectedDescription(itemId: string): Promise<string> {
    const docSnap = await getDoc(doc(db, "menuItems", itemId))
    return docSnap.data()?.selectedDescription || ""
  },
  async setSelectedDescription(itemId: string, selectedDescription: string) {
    await updateDoc(doc(db, "menuItems", itemId), { selectedDescription })
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
      where("companyId", "==", companyId)
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
  },
  async deleteAll(ids: string[]) {
    const batch = writeBatch(db)
    ids.forEach((id) => {
      const ref = doc(db, "repetitionLogs", id)
      batch.delete(ref)
    })
    await batch.commit()
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
  async update(id: string, data: any) {
    await updateDoc(doc(db, "companyMenus", id), {
      ...data,
      updatedAt: serverTimestamp(),
    })
  }
}

const updationService = {
  async getLatestUpdationNumber(menuId: string): Promise<number> {
    const q = query(collection(db, "updations"), where("menuId", "==", menuId))
    const snapshot = await getDocs(q)
    let max = 0
    snapshot.forEach((doc) => {
      const data = doc.data()
      if (data.updationNumber && data.updationNumber > max) {
        max = data.updationNumber
      }
    })
    return max
  }
}

// --- Helper Components ---

const ItemDescriptionModal = memo(function ItemDescriptionModal({
  isOpen,
  onClose,
  selectedItems,
  allMenuItems,
  onSaveDescription,
}: {
  isOpen: boolean
  onClose: () => void
  selectedItems: string[]
  allMenuItems: MenuItem[]
  onSaveDescription: (itemId: string, descriptions: string[], selectedDescription: string) => Promise<void>
}) {
  const [itemDescriptions, setItemDescriptions] = useState<Record<string, string[]>>({})
  const [selectedDescriptions, setSelectedDescriptions] = useState<Record<string, string>>({})
  const [newDescriptionInputs, setNewDescriptionInputs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && selectedItems.length > 0) {
      loadDescriptions()
    }
  }, [isOpen, selectedItems])

  const loadDescriptions = async () => {
    setLoading(true)
    try {
      const newDescriptions: Record<string, string[]> = {}
      const newSelected: Record<string, string> = {}
      for (const itemId of selectedItems) {
        const descs = await menuItemsService.getDescriptions(itemId)
        const selected = await menuItemsService.getSelectedDescription(itemId)
        newDescriptions[itemId] = descs
        newSelected[itemId] = selected || (descs.length > 0 ? descs[0] : "")
      }
      setItemDescriptions(newDescriptions)
      setSelectedDescriptions(newSelected)
    } catch (error) {
      console.error("Error loading descriptions:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddDescription = (itemId: string) => {
    const newDesc = newDescriptionInputs[itemId]?.trim()
    if (!newDesc) return

    setItemDescriptions((prev) => ({
      ...prev,
      [itemId]: [...(prev[itemId] || []), newDesc],
    }))
    setNewDescriptionInputs((prev) => ({
      ...prev,
      [itemId]: "",
    }))
  }

  const handleRemoveDescription = (itemId: string, index: number) => {
    setItemDescriptions((prev) => ({
      ...prev,
      [itemId]: prev[itemId].filter((_, i) => i !== index),
    }))
  }

  const handleSelectDescription = (itemId: string, description: string) => {
    setSelectedDescriptions((prev) => ({
      ...prev,
      [itemId]: description,
    }))
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      for (const itemId of selectedItems) {
        const descriptions = itemDescriptions[itemId] || []
        const selectedDesc = selectedDescriptions[itemId] || ""
        if (descriptions.length > 0) {
          await onSaveDescription(itemId, descriptions, selectedDesc)
        }
      }
      toast({ title: "Descriptions saved successfully!" })
      onClose()
    } catch (error) {
      console.error("Error saving descriptions:", error)
      toast({ title: "Error saving descriptions", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[150] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-auto">
        <div className="sticky top-0 bg-gradient-to-r from-amber-50 to-white border-b p-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-600" />
              Menu Item Descriptions
            </h3>
            <p className="text-sm text-gray-600">
              {selectedItems.length} item{selectedItems.length !== 1 ? "s" : ""} selected
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" type="button">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
            </div>
          ) : (
            selectedItems.map((itemId) => {
              const item = allMenuItems.find((i) => i.id === itemId)
              if (!item) return null
              const descriptions = itemDescriptions[itemId] || []
              const selectedDesc = selectedDescriptions[itemId] || ""

              return (
                <div key={itemId} className="border rounded-lg p-4 bg-gradient-to-r from-amber-50 to-white">
                  <Label className="text-sm font-semibold text-gray-800 mb-3 block">{item.name}</Label>
                  {descriptions.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-gray-600 mb-2">Select Description:</p>
                      <div className="space-y-2">
                        {descriptions.map((desc, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-3 p-2 border border-amber-200 rounded hover:bg-amber-100 transition-colors cursor-pointer"
                            onClick={() => handleSelectDescription(itemId, desc)}
                          >
                            <input
                              type="radio"
                              name={`desc-${itemId}`}
                              checked={selectedDesc === desc}
                              onChange={() => handleSelectDescription(itemId, desc)}
                              className="mt-1 cursor-pointer"
                            />
                            <div className="flex-1">
                              <p className="text-sm text-gray-700 break-words">{desc}</p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRemoveDescription(itemId, idx)
                              }}
                              className="text-red-400 hover:text-red-600 ml-2"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="border-t pt-3">
                    <p className="text-xs font-medium text-gray-600 mb-2">Add New Description:</p>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="Enter new description..."
                        value={newDescriptionInputs[itemId] || ""}
                        onChange={(e) =>
                          setNewDescriptionInputs((prev) => ({
                            ...prev,
                            [itemId]: e.target.value,
                          }))
                        }
                        className="text-sm flex-1"
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            handleAddDescription(itemId)
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        onClick={() => handleAddDescription(itemId)}
                        className="bg-amber-600 hover:bg-amber-700 text-white"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
        <div className="border-t p-4 flex items-center justify-end gap-2 bg-gray-50">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading} className="bg-amber-600 hover:bg-amber-700 text-white">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save All Descriptions
          </Button>
        </div>
      </div>
    </div>
  )
})

const ConflictDetailsDrawer = memo(function ConflictDetailsDrawer({
  isOpen,
  onClose,
  analysisData
}: {
  isOpen: boolean
  onClose: () => void
  analysisData: any[] // Contains full summary and occurrences
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      <div 
        className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-2xl bg-white shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="p-5 border-b bg-red-50 flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-red-900 flex items-center gap-2">
              <AlertCircle className="h-6 w-6 text-red-600" />
              Conflict Analysis
            </h3>
            <p className="text-sm text-red-700 mt-1">
              Found {analysisData.length} item{analysisData.length !== 1 ? "s" : ""} with repetition issues.
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-red-100 rounded-full text-red-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-gray-50/50">
          {analysisData.map((itemAnalysis, idx) => (
            <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              
              {/* 1️⃣ Repetition Summary (Top of Panel) */}
              <div className="p-5 border-b bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-lg font-bold text-gray-900">{itemAnalysis.itemName}</h4>
                  <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border border-red-200">
                     Repeated {itemAnalysis.totalCount} Times
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  This item appears in <strong>{itemAnalysis.totalCount} places</strong> this week. 
                  Below is the complete list of occurrences.
                </p>
              </div>

              {/* 2️⃣ Repetition Details Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-100 border-b">
                    <tr>
                      <th className="px-4 py-3">Date & Day</th>
                      <th className="px-4 py-3">Service</th>
                      <th className="px-4 py-3">Meal Plan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {itemAnalysis.occurrences.map((occ: any, oIdx: number) => (
                      <tr 
                        key={oIdx} 
                        className={`transition-colors ${
                          occ.isCurrentCell 
                            ? "bg-yellow-50 border-l-4 border-l-yellow-400" // 👉 Highlight Current Cell
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">
                            {new Date(occ.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                          <div className="text-xs text-gray-500">{occ.day}</div>
                          {occ.isCurrentCell && (
                            <span className="text-[10px] font-bold text-yellow-700 mt-1 block">
                              (Current Selection)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-gray-900 font-medium">{occ.serviceName}</div>
                          <div className="text-xs text-gray-500">{occ.subServiceName}</div>
                        </td>
                        <td className="px-4 py-3">
                           <div className="text-gray-900">{occ.mealPlanName}</div>
                           <div className="text-xs text-gray-500">{occ.subMealPlanName}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
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
const MenuGridCell = memo(function MenuGridCell({
    date,
    day,
    service,
    subServiceId,
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
    isActive,
    onActivate,
    companies,
    buildings,
    structureAssignments,
    repetitionLog,
    onShowConflicts,
  }: {
    
    date: string
    day: string
    service: Service
    subServiceId: string
    mealPlan: MealPlan
    subMealPlan: SubMealPlan
    selectedMenuItemIds: string[]
    allMenuItems: MenuItem[]
    onAddItem: (menuItemId: string) => void
    onRemoveItem: (menuItemId: string) => void
    onCreateItem: (name: string, category: string) => Promise<{ id: string; name: string } | null>
    onStartDrag?: (date: string, items: string[]) => void
    onHoverDrag?: (date: string) => void
    isDragActive?: boolean
    isDragHover?: boolean
    onCopy?: () => void
    onPaste?: () => void
    canPaste?: boolean
    prevItems?: string[]
    onCellMouseEnter?: () => void
    isActive: boolean
    onActivate: () => void
    companies: any[]
    buildings: any[]
    structureAssignments: any[]
    repetitionLog: any[] 
    onShowConflicts: (logs: any[], context: any) => void
  }) {
    const [isOpen, setIsOpen] = useState(false)
    const [isCompanyOpen, setIsCompanyOpen] = useState(false)
    const [isLogOpen, setIsLogOpen] = useState(false) 
    const [search, setSearch] = useState("")
    const [creating, setCreating] = useState(false)
    const [showDescModal, setShowDescModal] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Calculate assigned companies
    const assignedCompanies = useMemo(() => {
        if (!day || !companies || !structureAssignments) return []
        const result: any[] = []
        const dayKey = day.toLowerCase()
        
        structureAssignments.forEach((assignment: any) => {
            const company = companies.find((c: any) => c.id === assignment.companyId)
            const building = buildings.find((b: any) => b.id === assignment.buildingId)
            
            if (!company || !building) return
            
            const dayStructure = assignment.weekStructure?.[dayKey] || []
            const serviceInDay = dayStructure.find((s: any) => s.serviceId === service.id)
            if (!serviceInDay) return
            
            const subServiceInDay = serviceInDay.subServices?.find((ss: any) => ss.subServiceId === subServiceId)
            if (!subServiceInDay) return
            
            const mealPlanInDay = subServiceInDay.mealPlans?.find((mp: any) => mp.mealPlanId === mealPlan.id)
            if (!mealPlanInDay) return
            
            const subMealPlanInDay = mealPlanInDay.subMealPlans?.find((smp: any) => smp.subMealPlanId === subMealPlan.id)
            if (!subMealPlanInDay) return
            
            result.push({
                companyName: company.name,
                buildingName: building.name,
            })
        })
        return result
    }, [day, companies, structureAssignments, service.id, subServiceId, mealPlan.id, subMealPlan.id])

    // NEW LOGIC: Filter logs specifically for this cell
    const cellLogs = useMemo(() => {
        if (!repetitionLog || repetitionLog.length === 0) return []
        return repetitionLog.filter(log => 
            log.attemptedDate === date &&
            log.serviceId === service.id &&
            log.subServiceId === subServiceId &&
            log.mealPlanId === mealPlan.id &&
            log.subMealPlanId === subMealPlan.id
        )
    }, [repetitionLog, date, service.id, subServiceId, mealPlan.id, subMealPlan.id])
  
    useEffect(() => {
      if (!isOpen && !isCompanyOpen && !isLogOpen) return
      const handleClickOutside = (e: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
          setIsOpen(false)
          setIsCompanyOpen(false)
          setIsLogOpen(false) // Close log dropdown
          setSearch("")
        }
      }
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [isOpen, isCompanyOpen, isLogOpen])
  
    // ... existing filtering logic ...
    const filtered = useMemo(() => {
      if (!search.trim()) return allMenuItems.slice(0, 50)
      const lower = search.toLowerCase()
      return allMenuItems
        .filter((item) => item.name.toLowerCase().includes(lower))
        .slice(0, 50)
    }, [allMenuItems, search])
  
    const available = useMemo(
      () => filtered.filter((item) => !selectedMenuItemIds.includes(item.id)),
      [filtered, selectedMenuItemIds],
    )
  
    const handleCreate = async () => {
      if (!search.trim()) return
      setCreating(true)
      try {
        const createdItem = await onCreateItem(search.trim(), "")
        if (createdItem && createdItem.id) {
          onAddItem(createdItem.id)
          setSearch("")
          setIsOpen(false)
        }
      } finally {
        setCreating(false)
      }
    }
  
    const handleAdd = (itemId: string) => {
      onAddItem(itemId)
      setSearch("")
      setIsOpen(false)
    }

    const onDragHandleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        onStartDrag?.(date, selectedMenuItemIds)
    }
  
    return (
      <td
          onClick={() => onActivate()}
          onMouseEnter={() => {
            onCellMouseEnter?.()
            if (onHoverDrag) onHoverDrag(date)
          }}
          className={`border border-gray-300 p-2 align-top min-w-[200px] transition-all duration-150 relative 
            ${isActive ? "ring-2 ring-blue-500 bg-white z-[60]" : "bg-white hover:bg-gray-50"} 
            ${isDragHover ? "ring-2 ring-blue-300 bg-blue-50" : ""}
            ${cellLogs.length > 0 && !isActive ? "bg-red-50" : ""} 
          `}
        >
          {/* Indicator Dot when not active but has errors */}
          {cellLogs.length > 0 && !isActive && (
             <div className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 z-10"></div>
          )}

          <div className="flex flex-col h-full min-h-[60px]">
            <div className="flex-1 space-y-1">
              {selectedMenuItemIds.map((itemId) => {
                const item = allMenuItems.find((i) => i.id === itemId)
                // Check if this specific item has an error in this cell
                const hasError = cellLogs.some(log => log.itemId === itemId)

                if (!item) return null
                return (
                  <div
                    key={itemId}
                    className={`group relative flex items-center justify-between border px-1.5 py-0.5 rounded text-xs transition-colors
                        ${hasError 
                            ? "bg-red-100 border-red-200 text-red-800" 
                            : "bg-blue-50/50 hover:bg-blue-100 border-transparent hover:border-blue-200 text-gray-700"
                        }
                    `}
                  >
                    <span className="truncate font-medium leading-tight">{item.name}</span>
                    {isActive && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onRemoveItem(itemId)
                        }}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 ml-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
  
            {isActive && (
              <div className="mt-2 p-1 border-t bg-gray-50 flex items-center justify-between gap-1 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center gap-1" ref={dropdownRef}>
                  
             {cellLogs.length > 0 && (
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setIsOpen(false)
                            setIsCompanyOpen(false)
                            setIsLogOpen(false) 
                            
                            // 👇 Updated: Passing Context (Date, Service, etc.)
                            onShowConflicts(cellLogs, {
                                date,
                                serviceId: service.id,
                                subServiceId,
                                mealPlanId: mealPlan.id,
                                subMealPlanId: subMealPlan.id
                            })
                          }}
                          className={`p-1.5 rounded transition-colors bg-red-100 text-red-600 hover:bg-red-200 hover:scale-105 active:scale-95 duration-150`}
                          title="Click to view conflict details"
                        >
                          <AlertCircle className="h-4 w-4" />
                        </button>
                      </div>
                  )}
                  {/* --- END NEW ALERT BUTTON --- */}

                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setIsOpen(!isOpen)
                        setIsCompanyOpen(false)
                        setIsLogOpen(false)
                      }}
                      className="p-1.5 rounded hover:bg-blue-100 text-blue-600 transition-colors"
                      title="Add Item"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    {isOpen && (
                      <div className="absolute bottom-full left-0 mb-1 w-[270px] bg-white border rounded-lg shadow-xl z-[100] flex flex-col overflow-hidden">
                        <div className="p-3 border-b bg-gradient-to-r from-blue-50 to-white">
                            <Input
                              type="text"
                              placeholder="Search..."
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                              className="h-8 text-xs focus:ring-blue-500"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                        <div className="max-h-[240px] overflow-y-auto">
                          {available.map((item) => (
                              <button
                                key={item.id}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleAdd(item.id)
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-blue-50 text-xs border-b last:border-0 truncate flex items-center justify-between group"
                              >
                                <span className="font-medium text-gray-700">{item.name}</span>
                                <CheckCircle className="h-3 w-3 opacity-0 group-hover:opacity-100 text-green-600" />
                              </button>
                            ))}
                            {search.trim() && (
                                <button onClick={(e) => { e.stopPropagation(); handleCreate() }} className="w-full p-3 text-center text-xs text-blue-600 font-semibold hover:bg-blue-50">
                                    {creating ? "Creating..." : `Create "${search}"`}
                                </button>
                            )}
                        </div>
                      </div>
                    )}
                  </div>
  
                  <div className="relative">
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            setIsCompanyOpen(!isCompanyOpen)
                            setIsOpen(false)
                            setIsLogOpen(false)
                        }}
                        className={`p-1.5 rounded transition-colors ${isCompanyOpen ? "bg-purple-100 text-purple-700" : "hover:bg-purple-100 text-purple-600"}`}
                        title="View Companies"
                    >
                        <Building2 className="h-4 w-4" />
                    </button>
                    {isCompanyOpen && (
                        <div className="absolute bottom-full left-0 mb-1 w-[250px] bg-white border rounded-lg shadow-xl z-[100] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
                            <div className="p-2 border-b bg-purple-50">
                                <h4 className="font-semibold text-xs text-purple-800 flex items-center gap-2">
                                    Assigned Companies ({assignedCompanies.length})
                                </h4>
                            </div>
                            <div className="max-h-[200px] overflow-y-auto p-1">
                                {assignedCompanies.length > 0 ? (
                                    assignedCompanies.map((comp, idx) => (
                                        <div key={idx} className="p-2 hover:bg-purple-50 rounded border-b last:border-0 border-gray-100">
                                            <div className="font-medium text-xs text-gray-800">{comp.companyName}</div>
                                            <div className="text-[10px] text-gray-500">{comp.buildingName}</div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-4 text-center text-xs text-gray-400 italic">No companies assigned.</div>
                                )}
                            </div>
                        </div>
                    )}
                  </div>
  
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowDescModal(true)
                    }}
                    disabled={selectedMenuItemIds.length === 0}
                    className={`p-1.5 rounded transition-colors ${
                      selectedMenuItemIds.length > 0 ? "hover:bg-amber-100 text-amber-600" : "text-gray-300"
                    }`}
                    title="Edit Item Descriptions"
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                </div>
  
                <div className="flex items-center gap-0.5">
                  <button onClick={(e) => { e.stopPropagation(); onCopy?.() }} className="p-1.5 rounded hover:bg-gray-200 text-gray-600"><ClipboardCopy className="h-3.5 w-3.5" /></button>
                  <button onClick={(e) => { e.stopPropagation(); onPaste?.() }} disabled={!canPaste} className={`p-1.5 rounded ${canPaste ? "hover:bg-gray-200 text-gray-600" : "text-gray-300"}`}><ClipboardPaste className="h-3.5 w-3.5" /></button>
                  <button onMouseDown={onDragHandleMouseDown} className={`p-1.5 rounded cursor-grab active:cursor-grabbing transition-colors ${isDragActive ? "bg-blue-100 text-blue-600" : "hover:bg-gray-200 text-gray-600"}`}><GripHorizontal className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            )}
          </div>
  
          <ItemDescriptionModal
            isOpen={showDescModal}
            onClose={() => setShowDescModal(false)}
            selectedItems={selectedMenuItemIds}
            allMenuItems={allMenuItems}
            onSaveDescription={async (itemId, descriptions, selectedDescription) => {
              await menuItemsService.addDescriptions(itemId, descriptions)
              await menuItemsService.setSelectedDescription(itemId, selectedDescription)
            }}
          />
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
  
  // NEW STATE FOR DRAWER
  const [conflictDrawerOpen, setConflictDrawerOpen] = useState(false)
 
  const [conflictAnalysisData, setConflictAnalysisData] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [buildings, setBuildings] = useState<any[]>([])
  const [mealPlanAssignments, setMealPlanAssignments] = useState<any[]>([])
  const [allStructureAssignments, setAllStructureAssignments] = useState<any[]>([])
  
  const [activeCell, setActiveCell] = useState<string | null>(null)

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
    const handleMouseUp = () => {
      setDragActive(false)
      dragItemsRef.current = []
      setHoveredDate(null)
    }
    document.addEventListener("mouseup", handleMouseUp)
    return () => document.removeEventListener("mouseup", handleMouseUp)
  }, [])

  useEffect(() => {
    if (!loading && visibleDates < dateRange.length) {
      const timer = setTimeout(() => {
        setVisibleDates((v) => Math.min(v + CHUNK_SIZE, dateRange.length))
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [loading, visibleDates, dateRange.length])


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
      setActiveCell(null)
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

        
const menuDoc = { id: docSnap.id, ...(docSnap.data() as any) } as MenuData
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

        const [servicesData, subServicesData, mealPlansData, subMealPlansData, menuItemsData, companiesData, buildingsData, structureData, mealPlanStructureData] = await Promise.all([
          servicesService.getAll(),
          subServicesService.getAll(),
          mealPlansService.getAll(),
          subMealPlansService.getAll(),
          preloadedMenuItems && preloadedMenuItems.length > 0
            ? Promise.resolve(preloadedMenuItems)
            : menuItemsService.getAll(),
          companiesService.getAll(),
          buildingsService.getAll(),
          structureAssignmentsService.getAll(),
          mealPlanStructureAssignmentsService.getAll()
        ])

        if (signal.aborted || !mountedRef.current) return

        setCompanies(companiesData)
        setBuildings(buildingsData)
        setMealPlanAssignments(mealPlanStructureData)
        setAllStructureAssignments(structureData) // Store structure data for later generation

        setProgress(70)
        setMessage("Filtering data...")

        let filteredServices = servicesData.filter((s) => s.status === "active").sort((a, b) => (a.order || 999) - (b.order || 999))
        let filteredSubServices = subServicesData.filter((ss) => ss.status === "active").sort((a, b) => (a.order || 999) - (b.order || 999))

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


const handleAnalyzeConflicts = useCallback((cellLogs: any[], currentContext: any) => {
    // 1. Identify which Items are problematic in this cell
    const conflictItemIds = Array.from(new Set(cellLogs.map(l => l.itemId)));
    
    // 2. For each problematic item, scan the WHOLE menu to find occurrences
    const analysis = conflictItemIds.map(itemId => {
        const item = menuItems.find(i => i.id === itemId);
        const itemName = item?.name || "Unknown Item";
        const occurrences: any[] = [];

        // Scan logic
        dateRange.forEach(({ date, day }) => {
            const dayData = menuData[date];
            if (!dayData) return;

            Object.keys(dayData).forEach(sId => {
                const sData = dayData[sId];
                Object.keys(sData).forEach(ssId => {
                    const ssData = sData[ssId];
                    Object.keys(ssData).forEach(mpId => {
                        const mpData = ssData[mpId];
                        Object.keys(mpData).forEach(smpId => {
                           const cell = mpData[smpId];
                           if (cell?.menuItemIds?.includes(itemId)) {
                               // Found an occurrence!
                               const serviceName = services.find(s => s.id === sId)?.name;
                               const subServiceName = subServices.get(sId)?.find(ss => ss.id === ssId)?.name;
                               const mealPlanName = mealPlans.find(m => m.id === mpId)?.name;
                               const subMealPlanName = subMealPlans.find(s => s.id === smpId)?.name;

                               occurrences.push({
                                   date,
                                   day,
                                   serviceName,
                                   subServiceName,
                                   mealPlanName,
                                   subMealPlanName,
                                   // Check if this is the cell user clicked
                                   isCurrentCell: 
                                      date === currentContext.date &&
                                      sId === currentContext.serviceId &&
                                      ssId === currentContext.subServiceId &&
                                      mpId === currentContext.mealPlanId &&
                                      smpId === currentContext.subMealPlanId
                               });
                           }
                        });
                    });
                });
            });
        });

        return {
            itemId,
            itemName,
            totalCount: occurrences.length,
            occurrences
        };
    });

    setConflictAnalysisData(analysis);
    setConflictDrawerOpen(true);
  }, [menuData, dateRange, menuItems, services, subServices, mealPlans, subMealPlans]);
  

const handleAddItem = useCallback(
    (date: string, serviceId: string, mealPlanId: string, subMealPlanId: string, itemId: string) => {
      
      // 1. Pehle subServiceId nikalo aur check karo
      const subServiceId = selectedSubService?.id
      if (!subServiceId) return

      const serviceName = services.find(s => s.id === serviceId)?.name || "Service"
      const subServiceName = subServices.get(serviceId)?.find(ss => ss.id === subServiceId)?.name || "SubService"
      const currentSubMealPlan = subMealPlans.find(smp => smp.id === subMealPlanId)
      const isRepeatAllowed = currentSubMealPlan?.isRepeatPlan || false

      // 2. Conflict Check Logic
      const inWeek = dateRange.some(d => {
         if (d.date === date) return false; // Skip current date
         const cell = menuData[d.date]?.[serviceId]?.[subServiceId]?.[mealPlanId]?.[subMealPlanId]
         return cell?.menuItemIds?.includes(itemId)
      })

      if (inWeek && !isRepeatAllowed) {
         const itemName = menuItems.find(m => m.id === itemId)?.name || "Item"
         addRepetitionLog({
             type: "In-week duplicate",
             itemId, itemName, serviceId, serviceName, subServiceId, subServiceName, mealPlanId, subMealPlanId, attemptedDate: date
         })
      }

      // 3. Prev Week Check (Notice: prevWeekMap spelling correct)
      const prevHas = prevWeekMap[date]?.[serviceId]?.[subServiceId]?.[mealPlanId]?.[subMealPlanId]?.includes(itemId)
      if (prevHas && !inWeek && !isRepeatAllowed) {
         const itemName = menuItems.find(m => m.id === itemId)?.name || "Item"
         const d = new Date(date); d.setDate(d.getDate() - 7)
         const prevDate = d.toISOString().split("T")[0]
         addRepetitionLog({
             type: "Prev-week repeat",
             itemId, itemName, serviceId, serviceName, subServiceId, subServiceName, mealPlanId, subMealPlanId, prevDate, attemptedDate: date
         })
      }

      // 4. Update State
      setMenuData((prev: any) => {
        const updated = JSON.parse(JSON.stringify(prev))
        // Safe access ensure karo
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
    // 👇 DEPENDENCY ARRAY FIXED (prevWeekMap spelling corrected)
    [selectedSubService, menuData, dateRange, prevWeekMap, services, subServices, subMealPlans, menuItems, addRepetitionLog],
  )

  const handleRemoveItem = useCallback(
    async (date: string, serviceId: string, mealPlanId: string, subMealPlanId: string, itemId: string) => {
       if (!selectedSubService) return;
         const currentSubServiceId = selectedSubService.id;
      setMenuData((prev: any) => {
        const updated = JSON.parse(JSON.stringify(prev))
        const items = updated[date]?.[serviceId]?.[currentSubServiceId]?.[mealPlanId]?.[subMealPlanId]?.menuItemIds
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
        
               log.subServiceId === currentSubServiceId &&
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
    [selectedSubService, repetitionLog, menuType],
  )

  const handleCreateItem = useCallback(async (name: string, category: string) => {
    try {
      const newItemRef = await addDoc(collection(db, "menuItems"), {
        name, category, status: "active", order: 999, createdAt: new Date(),
      })
      const newItem: MenuItem = { id: newItemRef.id, name, category, status: "active", order: 999 }
      setMenuItems((prev) => [...prev, newItem])
      toast({ title: "Success", description: `Menu item "${name}" created successfully` })
      return { id: newItem.id, name: newItem.name }
    } catch (error) {
      console.error("Error creating menu item:", error)
      toast({ title: "Error", description: "Failed to create menu item", variant: "destructive" })
      return null
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

  const handleStartDrag = useCallback((date: string, items: string[]) => {
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

  // --- Company Menu Generation Logic (Sync with Update instead of Delete) ---
  const generateCompanyMenus = async (combinedMenuId: string, filteredMenuData: any) => {
    try {
      // 1. Get existing company menus for this combined ID
      const q = query(collection(db, 'companyMenus'), where('combinedMenuId', '==', combinedMenuId));
      const querySnapshot = await getDocs(q);
      const existingCompanyMenus = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      const activeCompanies = companies.filter((c: any) => c.status === "active")
      let count = 0;

      for (const company of activeCompanies) {
        const companyBuildings = buildings.filter((b: any) => b.companyId === company.id && b.status === "active")

        for (const building of companyBuildings) {
          // Use stored assignments
          const structureAssignment = allStructureAssignments.find(
            (sa: any) => sa.companyId === company.id && sa.buildingId === building.id && sa.status === "active",
          )
          const mealPlanStructureData = mealPlanAssignments.find(
            (mpsa: any) => mpsa.companyId === company.id && mpsa.buildingId === building.id && mpsa.status === "active",
          )

          if (structureAssignment && mealPlanStructureData) {
            const companyMenuData = buildCompanyMenu(
              company,
              building,
              structureAssignment,
              mealPlanStructureData,
              filteredMenuData,
              dateRange,
            )

            // Check if this specific company menu already exists
            const existing = existingCompanyMenus.find((m: any) => m.companyId === company.id && m.buildingId === building.id);
            
            if (existing) {
                // Update existing document (Preserve ID)
                await companyMenusService.update(existing.id, { ...companyMenuData, combinedMenuId, status: "active" });
            } else {
                // Create new document
                await companyMenusService.add({ ...companyMenuData, combinedMenuId, status: "active" });
            }
            count++;
          }
        }
      }
      return count;
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
    combinedMenu: any,
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


  const handleSave = async (isDraft = false) => {
    if (!menu) return

    try {
      setSaving(true)
      const collectionName = menuType === "combined" ? "combinedMenus" : "companyMenus"
      const docRef = doc(db, collectionName, menuId)
      const statusToSave = isDraft ? "draft" : menu.status

      // Detect if this is an activation or update of an active combined menu
      const shouldSyncCompanyMenus = menuType === "combined" && !isDraft;

      // 1. Calculate Diff (Tracking) - Before any DB Operations
      const menuItemsMap = new Map(menuItems.map((item) => [item.id, item.name]))
      const changedCells = detectMenuChanges(originalMenuData, menuData, menuItemsMap)

      // 2. Update the menu document (Master)
      await updateDoc(docRef, {
        menuData: JSON.parse(JSON.stringify(menuData)),
        status: shouldSyncCompanyMenus ? "active" : statusToSave, 
        updatedAt: new Date(),
      })

      // 3. Sync Company Menus (Update/Create without deleting existing)
      if (shouldSyncCompanyMenus) {
        toast({ title: "Syncing company menus...", description: "Updating existing menus and creating new ones." })
        
        // Filter empty structure before generating
          const filtered: any = {}
        Object.entries(menuData).forEach(([date, dayMenu]: [string, any]) => {
            const filteredDay: any = {}
            
            // 1. Iterate over Services (sData)
            Object.entries(dayMenu).forEach(([sId, sData]: [string, any]) => {
                const filteredS: any = {}

                // 2. Iterate over sData to get SubServices (ssData)
                Object.entries(sData).forEach(([ssId, ssData]: [string, any]) => {
                    const filteredSS: any = {}

                    // 3. Iterate over ssData to get MealPlans (mpData) 
                    // (Yahan galti thi: aap mpData likh rahe the Object.entries mein, jabki ssData hona chahiye)
                    Object.entries(ssData).forEach(([mpId, mpData]: [string, any]) => {
                        const filteredMP: any = {}

                        // 4. Iterate over mpData to get SubMealPlans (cell)
                        Object.entries(mpData).forEach(([smpId, cell]: [string, any]) => {
                            if(cell.menuItemIds?.length > 0) filteredMP[smpId] = cell
                        })
                        
                        if(Object.keys(filteredMP).length > 0) filteredSS[mpId] = filteredMP
                    })
                    
                    if(Object.keys(filteredSS).length > 0) filteredS[ssId] = filteredSS
                })
                
                if(Object.keys(filteredS).length > 0) filteredDay[sId] = filteredS
            })
            
            if(Object.keys(filteredDay).length > 0) filtered[date] = filteredDay
        })

        // This function now Updates existing menus instead of Deleting + Creating
        const count = await generateCompanyMenus(menuId, filtered)
        toast({ title: "Sync Complete", description: `Updated/Created ${count} company menus.` })
      }

      // 4. Record Updation if active and changed
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

      toast({
        title: "Success",
        description: isDraft ? "Saved as Draft" : "Menu updated successfully.",
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

  const filteredMealPlanStructure = useMemo(() => {
    if (!selectedService || !selectedSubService || !mealPlanAssignments.length) return []

    return mealPlanStructure.map(({ mealPlan, subMealPlans: subMPs }) => {
      const visibleSubMealPlans = subMPs.filter(subMealPlan => {
        return dateRange.some(({ day }) => {
          const dayKey = day.toLowerCase()
          return mealPlanAssignments.some(assignment => {
            const dayStructure = assignment.weekStructure?.[dayKey] || []
            const sInDay = dayStructure.find((s: any) => s.serviceId === selectedService.id)
            const ssInDay = sInDay?.subServices?.find((ss: any) => ss.subServiceId === selectedSubService.id)
            const mpInDay = ssInDay?.mealPlans?.find((mp: any) => mp.mealPlanId === mealPlan.id)
            return mpInDay?.subMealPlans?.some((smp: any) => smp.subMealPlanId === subMealPlan.id)
          })
        })
      })
      return { mealPlan, subMealPlans: visibleSubMealPlans }
    }).filter(group => group.subMealPlans.length > 0)
  }, [mealPlanStructure, dateRange, mealPlanAssignments, selectedService, selectedSubService])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center overflow-hidden">
      
      <div className="bg-white shadow-2xl w-full h-full flex flex-col relative overflow-hidden">
          
          {/* Header */}
          <div className="border-b p-4 flex-none flex items-center justify-between bg-white z-40">
            <div>
              <h2 className="text-2xl font-bold">
                Edit {menuType === "combined" ? "Combined" : "Company"} Menu
              </h2>
              {menu && (
                <p className="text-sm text-gray-600 mt-1">
                  {new Date(menu.startDate).toLocaleDateString()} to {new Date(menu.endDate).toLocaleDateString()}
                  {menu.status === 'draft' && <span className="ml-2 bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">Draft</span>}
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

          {/* Content */}
          <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50/50">
            {loading ? (
              <div className="p-8 space-y-4 flex flex-col items-center justify-center h-full">
                <LoadingProgress progress={progress} message={message} />
              </div>
            ) : (
              <div className="flex flex-col h-full">
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
                    <div className="overflow-x-auto border rounded bg-white shadow-sm pb-12">
                      <table className="w-full border-collapse">
                        <thead className="bg-gray-100 sticky top-0 z-20 shadow-sm">
                          <tr>
                            <th className="border border-gray-300 p-2 sticky left-0 z-30 bg-gray-100 min-w-[200px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                              Meal Plan / Sub Meal
                            </th>
                            {dateRange.slice(0, visibleDates).map(({ date, day }) => (
                              <th key={date} className="border border-gray-300 p-2 min-w-[250px] text-left">
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
                          {filteredMealPlanStructure.map(({ mealPlan, subMealPlans: subMPs }) =>
                            subMPs.map((subMealPlan, idx) => (
                              <tr key={`${mealPlan.id}-${subMealPlan.id}`} className="hover:bg-gray-50/50">
                                <td className="border border-gray-300 bg-gray-200 p-2 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] align-top">
                                  {idx === 0 && <div className="font-bold text-blue-700 mb-1">{mealPlan.name}</div>}
                                  <div className="text-sm text-gray-700 ml-3">↳ {subMealPlan.name}</div>
                                </td>
                                {dateRange.slice(0, visibleDates).map(({ date, day }) => {
                                  const cellKey = `${date}-${selectedService.id}-${selectedSubService.id}-${mealPlan.id}-${subMealPlan.id}`
                                  const selectedItems: string[] =
                                    menuData[date]?.[selectedService.id]?.[selectedSubService.id]?.[mealPlan.id]?.[
                                      subMealPlan.id
                                    ]?.menuItemIds || []
                                  
                                  const prevItems = prevWeekMap[date]?.[selectedService.id]?.[selectedSubService.id]?.[mealPlan.id]?.[subMealPlan.id] || []

                                  return (
                                    <MenuGridCell
                                      key={cellKey}
                                      date={date}
                                      day={day}
                                      service={selectedService}
                                      subServiceId={selectedSubService.id}
                                      mealPlan={mealPlan}
                                    
                                      subMealPlan={subMealPlan}
                                      selectedMenuItemIds={selectedItems}
                                      allMenuItems={menuItems}
                                      onAddItem={(itemId) =>
                                        handleAddItem(date, selectedService.id, mealPlan.id, subMealPlan.id, itemId)
                                      }
                                      onRemoveItem={(itemId) =>
                                        handleRemoveItem(date, selectedService.id, mealPlan.id, subMealPlan.id, itemId)
                                      }
                                      onCreateItem={handleCreateItem}
                                      onStartDrag={(d, items) => handleStartDrag(d, items)}
                                      isDragActive={dragActive}
                                      isDragHover={hoveredDate === date}
                                      onHoverDrag={() => {
                                          setHoveredDate(date)
                                          if(dragActive) applyDragToCell(date, mealPlan.id, subMealPlan.id)
                                      }}
                                      onCopy={() => handleCopy(selectedItems)}
                                      onPaste={() => handlePaste(date, mealPlan.id, subMealPlan.id)}
                                      canPaste={!!copyBuffer?.items.length}
                                      prevItems={prevItems}
                                      isActive={activeCell === cellKey}
                                      onActivate={() => setActiveCell(cellKey)}
                                      onCellMouseEnter={() => {
                                        setHoveredDate(date)
                                        if (dragActive) applyDragToCell(date, mealPlan.id, subMealPlan.id)
                                      }}
                                      companies={companies}
                                      buildings={buildings}
                                      structureAssignments={mealPlanAssignments}
                                      repetitionLog={repetitionLog}
                                    
                                       onShowConflicts={handleAnalyzeConflicts}
                                    />
                                  )
                                })}
                              </tr>
                            )),

                          )}
                        </tbody>
                      </table>
                      {filteredMealPlanStructure.length === 0 && (
                        <div className="p-8 text-center text-gray-500 italic">No meal plans assigned for this selection.</div>
                      )}
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
                  {menuType === 'combined' && menu?.status === 'draft' ? "Save & Activate" : "Save Changes"}
                </>
              )}
            </Button>
          </div>

          {/* Logs FAB - Fixed: Z-Index 80 (Sabse upar) & Position */}
          <div className="absolute bottom-20 right-6 z-[80]">
              <button
                onClick={(e) => {
                    e.stopPropagation(); // Safety: Click pass na ho
                    setShowLogPanel(!showLogPanel);
                }}
                className="h-12 w-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 border-2 border-white bg-gray-600 hover:bg-gray-700 text-white"
                title="Toggle Repetition Logs"
              >
                 <div className="flex flex-col items-center">
                    {showLogPanel ? <ChevronDown className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                    {/* Count badge */}
                    {repetitionLog.length > 0 && !showLogPanel && (
                      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold">
                        {repetitionLog.length}
                      </span>
                    )}
                 </div>
              </button>
          </div>

          {/* Log Panel - Fixed: Bottom-36 (Button ke upar) & Z-Index 70 */}
          {showLogPanel && (
              <div className="absolute bottom-36 right-4 w-[400px] max-h-[400px] bg-white border border-gray-200 rounded-lg shadow-2xl p-4 animate-in slide-in-from-bottom-5 z-[70] flex flex-col">
                  <div className="flex items-center justify-between mb-3 border-b pb-2">
                    <div className="font-semibold text-sm flex items-center gap-2 text-gray-800">
                        <AlertCircle className="h-4 w-4 text-gray-500"/>
                        Repetition Log ({repetitionLog.length})
                    </div>
                    <Button variant="ghost" size="sm" onClick={clearRepetitionLog} className="text-gray-500 hover:bg-gray-100 h-6 text-xs">Clear All</Button>
                  </div>
                  <div className="overflow-y-auto flex-1 space-y-2 pr-1">
                    {repetitionLog.length === 0 ? <span className="text-sm text-gray-500 italic">No issues detected.</span> : 
                        repetitionLog.map((entry, idx) => (
                           <div key={idx} className="p-3 border rounded bg-gray-50 border-gray-200 text-xs relative group hover:bg-white hover:shadow-sm transition-all">
                               <div className="flex justify-between font-bold text-gray-700 mb-1">
                                   <span>{entry.type}</span>
                                   <button onClick={() => removeRepetitionLog(entry.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-3.5 w-3.5"/></button>
                               </div>
                               <div className="mb-1">Item: <span className="font-semibold text-gray-900">{entry.itemName}</span></div>
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

          {/* NEW DRAWER COMPONENT */}
        <ConflictDetailsDrawer 
  isOpen={conflictDrawerOpen}
  onClose={() => setConflictDrawerOpen(false)}
  analysisData={conflictAnalysisData} // Pass the processed data
/>
      </div>
    </div>
  )
}