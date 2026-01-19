"use client"
import { useState, useEffect, useCallback, useMemo, memo, useRef, useLayoutEffect } from "react"
import type React from "react"
import { createPortal } from "react-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Calendar,
  Save,
  X,
  Maximize2,
  Loader2,
  ArrowLeft,
  Plus,
  AlertCircle,
  ChevronDown,
  Building2,
  FileText,
  GripHorizontal,
  ClipboardCopy,
  ClipboardPaste,
  Search,
  CheckCircle,
  ExternalLink,
} from "lucide-react"
import Link from "next/link"
import { toast } from "@/components/ui/use-toast"
import type { Service, MealPlan, SubMealPlan, MenuItem, SubService } from "@/lib/types"
import {
  getDocs,
  collection,
  addDoc,
  doc,
  writeBatch,
  serverTimestamp,
  query,
  where,
  orderBy,
  updateDoc,
  getDoc,
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
// Import the Edit Modal to handle opening duplicates
import { MenuEditModal } from "@/components/menu-edit-modal"

// --- Types ---
interface MenuCell {
  menuItemIds: string[]
  selectedDescriptions?: Record<string, string> // Maps itemId to selected description
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
  async addDescriptions(itemId: string, descriptions: string[]) {
    const itemRef = doc(db, "menuItems", itemId)
    await updateDoc(itemRef, { descriptions: descriptions || [] })
  },
  async getDescriptions(itemId: string): Promise<string[]> {
    const docSnap = await getDoc(doc(db, "menuItems", itemId))
    return docSnap.data()?.descriptions || []
  },
  async setSelectedDescription(itemId: string, selectedDescription: string) {
    const itemRef = doc(db, "menuItems", itemId)
    await updateDoc(itemRef, { selectedDescription })
  },
  async getSelectedDescription(itemId: string): Promise<string> {
    const docSnap = await getDoc(doc(db, "menuItems", itemId))
    return docSnap.data()?.selectedDescription || ""
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
      orderBy("createdAt", "desc"),
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
  },
  async deleteAll(logIds: string[]) {
    const batch = writeBatch(db)
    logIds.forEach((id) => {
      const ref = doc(db, "repetitionLogs", id)
      batch.delete(ref)
    })
    await batch.commit()
  },
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
  async checkDuplicate(startDate: string, endDate: string): Promise<string | null> {
    const snapshot = await getDocs(collection(db, "combinedMenus"))
    const duplicate = snapshot.docs.find((doc) => {
      const data = doc.data()
      // Check for exact date match and exclude archived menus
      return data.startDate === startDate && data.endDate === endDate && data.status !== "archived"
    })
    return duplicate ? duplicate.id : null
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
        const timeA = a.data().updatedAt?.toMillis?.() || 0
        const timeB = b.data().updatedAt?.toMillis?.() || 0
        return timeB - timeA
      })
      return { id: sortedDocs[0].id, ...sortedDocs[0].data() }
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

                  {/* Existing Descriptions List */}
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

                  {/* Add New Description */}
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

// ---------------------- MenuGridCell (FINAL FIX) ----------------------
const MenuGridCell = function MenuGridCell({
  date,
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
  onCellMouseEnter,
  day,
  isActive,
  onActivate,
  companies,
  buildings,
  structureAssignments,
}: {
  date: string
  service: Service
  subServiceId: string
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
  isActive: boolean
  onActivate: () => void
  companies: any[]
  buildings: any[]
  structureAssignments: any[]
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isCompanyOpen, setIsCompanyOpen] = useState(false) // State for Company Dropdown
  const [search, setSearch] = useState("")
  const [creating, setCreating] = useState(false)
  const [showDescModal, setShowDescModal] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Calculate assigned companies for this specific cell
  const assignedCompanies = useMemo(() => {
    if (!day || !companies || !structureAssignments) return []
    const result: any[] = []
    
    structureAssignments.forEach((assignment: any) => {
      const company = companies.find((c: any) => c.id === assignment.companyId)
      const building = buildings.find((b: any) => b.id === assignment.buildingId)
      
      if (!company || !building) return
      
      const dayKey = day.toLowerCase()
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
        companyId: company.id,
        companyName: company.name,
        buildingId: building.id,
        buildingName: building.name,
      })
    })
    return result
  }, [mealPlan, subMealPlan, service, subServiceId, companies, buildings, structureAssignments, day])


  // Close dropdowns if clicking outside
  useEffect(() => {
    if (!isOpen && !isCompanyOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setIsCompanyOpen(false)
        setSearch("")
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen, isCompanyOpen])

  const filtered = useMemo(() => {
    if (!search.trim()) return allMenuItems.slice(0, 50)
    const lower = search.toLowerCase()
    return allMenuItems
      .filter((item) => item.name.toLowerCase().includes(lower) || (item.category && item.category.toLowerCase().includes(lower)))
      .slice(0, 50)
  }, [allMenuItems, search])

  const available = useMemo(() => filtered.filter((item) => !selectedMenuItemIds.includes(item.id)), [filtered, selectedMenuItemIds])

  const handleCreate = async () => {
    if (!search.trim()) return
    setCreating(true)
    try {
      const createdItem = await onCreateItem(search.trim(), "")
      if (createdItem && createdItem.id) {
        onAddItem(createdItem.id)
        setSearch("")
      }
    } catch (error) { console.error(error) } finally { setCreating(false) }
  }

  const handleAdd = (itemId: string) => {
    if (selectedMenuItemIds.includes(itemId)) return
    onAddItem(itemId)
    // Removed clearing search and closing dropdown to allow multiple selections
  }

  const onDragHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onStartDrag?.(date, selectedMenuItemIds)
  }

  return (
    <>
      <td
      onClick={() => onActivate()}
      onMouseEnter={() => { onCellMouseEnter?.(); if (onHoverDrag) onHoverDrag(date) }}
       className={`border border-gray-300 align-top min-w-[200px] transition-all duration-150 relative 
          ${isActive ? "ring-2 ring-blue-500 bg-white !z-[60]" : "bg-white hover:bg-gray-50 z-0"} 
          ${isDragHover ? "ring-2 ring-blue-300 bg-blue-50" : ""}
        `}
    >
        <div className="flex flex-col h-full min-h-[60px]">

          {/* Selected Items List */}
          <div className="flex-1 p-1 space-y-1">
            {selectedMenuItemIds.map((itemId) => {
              const item = allMenuItems.find((i) => i.id === itemId)
              if (!item) return null
              return (
                <div
                  key={itemId}
                  className="group relative flex items-center justify-between bg-blue-50/50 hover:bg-blue-100 border border-transparent hover:border-blue-200 px-1.5 py-0.5 rounded text-xs transition-colors"
                >
                  <span className="truncate font-medium text-gray-700 leading-tight">{item.name}</span>
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

          {/* Toolbar - Only visible when Active */}
          {isActive && (
            <div className="p-1 border-t bg-gray-50 flex items-center justify-between gap-1 animate-in fade-in zoom-in-95 duration-100">
              {/* Left Group: Add & Companies */}
              <div className="flex items-center gap-1" ref={dropdownRef}>
                {/* ADD BUTTON WITH ENHANCED DROPDOWN */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsOpen(!isOpen)
                      setIsCompanyOpen(false) // Close other dropdown
                    }}
                    className="p-1.5 rounded hover:bg-blue-100 text-blue-600 transition-colors"
                    title="Add Item"
                  >
                    <Plus className="h-4 w-4" />
                  </button>

                  {/* Dropdown with Search */}
                  {isOpen && (
                    <div className="absolute bottom-full left-0 mb-1 w-[270px] bg-white border rounded-lg shadow-xl z-[100] flex flex-col overflow-hidden">
                      {/* Search Header */}
                      <div className="p-3 border-b bg-gradient-to-r from-blue-50 to-white">
                        <div className="relative">
                          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                          <Input
                            type="text"
                            placeholder="Search menu items..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="h-8 text-xs pl-7 focus:ring-blue-500"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>

                      {/* Items List */}
                      <div className="max-h-[240px] overflow-y-auto">
                        {available.length > 0 ? (
                          available.map((item) => (
                            <button
                              key={item.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleAdd(item.id)
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-blue-50 text-xs border-b last:border-0 truncate transition-colors flex items-center justify-between group"
                            >
                              <span className="font-medium text-gray-700">{item.name}</span>
                              <CheckCircle className="h-3 w-3 opacity-0 group-hover:opacity-100 text-green-600" />
                            </button>
                          ))
                        ) : search.trim() ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCreate()
                            }}
                            className="w-full p-3 text-center text-xs text-blue-600 font-semibold hover:bg-blue-50 border-b transition-colors flex items-center justify-center gap-2"
                          >
                            {creating ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Creating...
                              </>
                            ) : (
                              <>
                                <Plus className="h-3 w-3" />
                                Create "{search}"
                              </>
                            )}
                          </button>
                        ) : (
                          <div className="p-3 text-xs text-gray-400 text-center">Start typing to search</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* COMPANIES BUTTON WITH DROPDOWN */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsCompanyOpen(!isCompanyOpen)
                      setIsOpen(false) // Close other dropdown
                    }}
                    className={`p-1.5 rounded transition-colors ${
                        isCompanyOpen ? "bg-purple-100 text-purple-700" : "hover:bg-purple-100 text-purple-600"
                    }`}
                    title="View Assigned Companies"
                  >
                    <Building2 className="h-4 w-4" />
                  </button>

                   {/* Companies Dropdown */}
                   {isCompanyOpen && (
                    <div className="absolute bottom-full left-0 mb-1 w-[250px] bg-white border rounded-lg shadow-xl z-[100] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
                        <div className="p-2 border-b bg-purple-50">
                            <h4 className="font-semibold text-xs text-purple-800 flex items-center gap-2">
                                <Building2 className="h-3 w-3" />
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
                                <div className="p-4 text-center text-xs text-gray-400 italic">
                                    No companies assigned to this plan on {day}.
                                </div>
                            )}
                        </div>
                    </div>
                   )}
                </div>

                {/* DOC BUTTON - Only active when items are selected */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowDescModal(true)
                  }}
                  disabled={selectedMenuItemIds.length === 0}
                  className={`p-1.5 rounded transition-colors ${
                    selectedMenuItemIds.length > 0
                      ? "hover:bg-amber-100 text-amber-600"
                      : "text-gray-300 cursor-not-allowed"
                  }`}
                  title={selectedMenuItemIds.length > 0 ? "Edit Item Descriptions" : "Select items first"}
                >
                  <FileText className="h-4 w-4" />
                </button>
              </div>

              <div className="w-px h-4 bg-gray-300 mx-0.5"></div>

              {/* Right Group: Actions */}
              <div className="flex items-center gap-0.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onCopy?.()
                  }}
                  className="p-1.5 rounded hover:bg-gray-200 text-gray-600 transition-colors"
                  title="Copy"
                >
                  <ClipboardCopy className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onPaste?.()
                  }}
                  disabled={!canPaste}
                  className={`p-1.5 rounded transition-colors ${canPaste ? "hover:bg-gray-200 text-gray-600" : "text-gray-300"}`}
                  title="Paste"
                >
                  <ClipboardPaste className="h-3.5 w-3.5" />
                </button>
                <button
                  onMouseDown={onDragHandleMouseDown}
                  className={`p-1.5 rounded cursor-grab active:cursor-grabbing transition-colors ${isDragActive ? "bg-blue-100 text-blue-600" : "hover:bg-gray-200 text-gray-600"}`}
                  title="Drag to fill"
                >
                  <GripHorizontal className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </td>

      {/* Description Modal */}
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
    </>
  )
}

// ---------------------- ServiceTable (No Major Changes needed, just keeping context) ----------------------
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
  
  const [dragActive, setDragActive] = useState(false)
  const dragItemsRef = useRef<string[]>([])
  const [hoveredDate, setHoveredDate] = useState<string | null>(null)

  // Track active cell for single-cell interaction
  const [activeCell, setActiveCell] = useState<string | null>(null)

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

  // Clear active cell when clicking outside table
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tableRef.current && !tableRef.current.contains(e.target as Node)) {
        setActiveCell(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // -----------------------------------------------------------------------------------
  // UPDATED: Filter Sub Meal Plan Rows based on Company Assignments for the whole row
  // -----------------------------------------------------------------------------------
  const filteredMealPlanStructure = useMemo(() => {
    if (!selectedSubServiceId || !structureAssignments) return []

    return mealPlanStructure.map(({ mealPlan, subMealPlans }) => {
      const visibleSubMealPlans = subMealPlans.filter(subMealPlan => {
        // Check if ANY day in the week has this specific row (mealPlan + subMealPlan) 
        // assigned to ANY company for the current Service and Sub-Service.
        return dateRange.some(({ day }) => {
          const dayKey = day.toLowerCase()
          return structureAssignments.some(assignment => {
            const dayStructure = assignment.weekStructure?.[dayKey] || []
            const serviceInDay = dayStructure.find((s: any) => s.serviceId === service.id)
            if (!serviceInDay) return false
            
            const subServiceInDay = serviceInDay.subServices?.find((ss: any) => ss.subServiceId === selectedSubServiceId)
            if (!subServiceInDay) return false
            
            const mealPlanInDay = subServiceInDay.mealPlans?.find((mp: any) => mp.mealPlanId === mealPlan.id)
            if (!mealPlanInDay) return false
            
            return mealPlanInDay.subMealPlans?.some((smp: any) => smp.subMealPlanId === subMealPlan.id)
          })
        })
      })
      
      return { mealPlan, subMealPlans: visibleSubMealPlans }
    }).filter(group => group.subMealPlans.length > 0) // Hide Meal Plan header if all its children are hidden
  }, [mealPlanStructure, dateRange, structureAssignments, service.id, selectedSubServiceId])

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
        <div className="overflow-x-visible border border-gray-300 rounded pb-12">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border border-gray-300 bg-gray-100 p-2 sticky left-0 z-20 w-[130px] min-w-[130px] shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                  Meal Plan / Sub Meal
                </th>
                {displayDates.map(({ date, day }) => (
                  <th key={date} className="border border-gray-300 bg-gray-100 p-2 min-w-[150px] w-[150px]">
                    <div className="font-semibold text-sm">
                      {new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                    <div className="text-xs text-gray-500 font-normal">{day.substring(0, 3)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredMealPlanStructure.map(({ mealPlan, subMealPlans }) =>
                subMealPlans.map((subMealPlan, idx) => (
                  <tr key={`${mealPlan.id}-${subMealPlan.id}`}>
                    <td className="border border-gray-300 bg-gray-50 p-2 sticky left-0 z-10 w-[130px] min-w-[130px] text-xs shadow-[2px_0_5px_rgba(0,0,0,0.05)] whitespace-normal break-words align-top">
                      <div
                        className="absolute left-0 top-0 bottom-0 w-1"
                        style={{ backgroundColor: service.color || "#cbd5e1" }}
                      />
                      <div className="pl-2">
                        {idx === 0 && <div className="font-bold text-blue-700 mb-1 leading-tight">{mealPlan.name}</div>}
                        <div className="text-gray-600 leading-tight">{subMealPlan.name}</div>
                      </div>
                    </td>
                    {displayDates.map(({ date, day }) => {
                      const cellKey = `${date}-${service.id}-${selectedSubServiceId}-${mealPlan.id}-${subMealPlan.id}`
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

                      function handleHoverDrag(date: string) {
                        if (!dragActive) return
                        setHoveredDate(date)
                        onHoverDragFromCell(date)
                      }

                      return (
                        <MenuGridCell
                          key={cellKey}
                          date={date}
                          service={service}
                          subServiceId={selectedSubServiceId!}
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
                          isActive={activeCell === cellKey}
                          onActivate={() => setActiveCell(cellKey)}
                          companies={companies || []}
                          buildings={buildings || []}
                          structureAssignments={structureAssignments || []}
                        />
                      )
                    })}
                  </tr>
                )),
              )}
            </tbody>
          </table>
          {filteredMealPlanStructure.length === 0 && (
            <div className="p-8 text-center text-gray-500 italic border-t bg-gray-50">
              No meal plans assigned to this sub-service for any company during this week.
            </div>
          )}
        </div>
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
  const [userCompanyId, setUserCompanyId] = useState<string>("")
  const dateRangeSet = useRef<Set<string>>(new Set())
  const repetitionLogKeysRef = useRef<Set<string>>(new Set())
  const [copyBuffer, setCopyBuffer] = useState<{ items: string[]; meta?: any } | null>(null)
  const [showLogPanel, setShowLogPanel] = useState(false)
  const mountedRef = useRef(true)

  // New State for duplicate handling
  const [duplicateMenuId, setDuplicateMenuId] = useState<string | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

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

  // --- NEW: Date Selection Logic (Monday Only) ---
  const handleWeekSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) {
      setStartDate("")
      setEndDate("")
      setDuplicateMenuId(null)
      return
    }

    const selectedDate = new Date(e.target.value)
    if (isNaN(selectedDate.getTime())) return

    // Calculate Monday
    const day = selectedDate.getDay()
    const diff = selectedDate.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
    const monday = new Date(selectedDate.setDate(diff))
    const mondayString = monday.toISOString().split("T")[0]

    // Calculate Sunday (End Date)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const sundayString = sunday.toISOString().split("T")[0]

    setStartDate(mondayString)
    setEndDate(sundayString)
    setDuplicateMenuId(null) // Reset duplicate check

    // Check for duplicate immediately
    try {
      const existingId = await combinedMenusService.checkDuplicate(mondayString, sundayString)
      if (existingId) {
        setDuplicateMenuId(existingId)
        toast({
          title: "Menu Exists",
          description: "A menu for this week already exists.",
          variant: "default",
        })
      }
    } catch (error) {
      console.error("Error checking duplicate:", error)
    }
  }

  // Open Edit Modal Logic
  const handleOpenEdit = () => {
    if (duplicateMenuId) {
      setShowEditModal(true)
    }
  }

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

  const handleSaveDraft = async () => {
    try {
      setSaving(true)
      const filteredMenuData = combinedMenu

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
    if (!startDate || !endDate) return
    
    // Logic for duplicate handling
    if (duplicateMenuId) {
        handleOpenEdit()
        return
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (start > end) {
      toast({ title: "Validation Error", description: "Start date must be before end date", variant: "destructive" })
      return
    }

    setGeneratingGrid(true)

    // Re-check duplicate just in case
    try {
      const isDuplicateId = await combinedMenusService.checkDuplicate(startDate, endDate)
      if (isDuplicateId) {
        setGeneratingGrid(false)
        setDuplicateMenuId(isDuplicateId)
        toast({
          title: "Menu Already Exists",
          description: `A combined menu for ${startDate} to ${endDate} already exists.`,
          variant: "default",
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

    setTimeout(async () => {
      const dates: Array<{ date: string; day: string }> = []
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
      const current = new Date(start)

      while (current <= end) {
        dates.push({ date: current.toISOString().split("T")[0], day: days[current.getDay()] })
        current.setDate(current.getDate() + 1)
      }

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
      let draftFound = false
      try {
        const draftData = await combinedMenusService.getDraftByDateRange(startDate, endDate, userCompanyId)
        if (draftData && draftData.menuData) {
          draftFound = true
          setHasDraft(true)
          Object.entries(draftData.menuData).forEach(([dDate, dayData]: [string, any]) => {
            if (!initialMenu[dDate]) return

            Object.entries(dayData).forEach(([svcId, svcData]: [string, any]) => {
              if (!initialMenu[dDate][svcId]) return

              Object.entries(svcData).forEach(([subSvcId, subSvcData]: [string, any]) => {
                if (!initialMenu[dDate][svcId][subSvcId]) return

                Object.entries(subSvcData).forEach(([mpId, mpData]: [string, any]) => {
                  if (!initialMenu[dDate][svcId][subSvcId][mpId]) return

                  Object.entries(mpData).forEach(([smpId, cellData]: [string, any]) => {
                    if (initialMenu[dDate][svcId][subSvcId][mpId][smpId]) {
                      initialMenu[dDate][svcId][subSvcId][mpId][smpId] = cellData
                    }
                  })
                })
              })
            })
          })
          toast({ title: "Draft Restored", description: "Found an existing draft for these dates." })
        } else {
          setHasDraft(false)
        }
      } catch (e) {
        console.error("Error fetching draft during generation", e)
      }

      try {
        const logs = await repetitionLogsService.getByDateRange(startDate, endDate, userCompanyId)
        if (logs.length > 0) {
          // Map over logs and inject names from local services state
          const enrichedLogs = logs.map((log: any) => {
            const sName = log.serviceName || services.find((s) => s.id === log.serviceId)?.name || "Unknown Service"
            const ssName =
              log.subServiceName || subServices.find((ss) => ss.id === log.subServiceId)?.name || "Unknown Sub-Service"
            return {
              ...log,
              serviceName: sName,
              subServiceName: ssName,
            }
          })

          setRepetitionLog(enrichedLogs)

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
            repetitionLogKeysRef.current.add(JSON.stringify(keyObj))
          })
        }
      } catch (e) {
        console.error("Error fetching repetition logs", e)
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

  const addRepetitionLog = useCallback(
    async (entry: any) => {
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

        const result = await repetitionLogsService.add(fullEntry)

        setRepetitionLog((p) => [
          { ...fullEntry, id: result.id, time: fullEntry.time || new Date().toISOString() },
          ...p,
        ])
      } catch (err) {
        console.error("Error adding repetition log", err)
      }
    },
    [startDate, endDate, userCompanyId],
  )

  const clearRepetitionLog = useCallback(async () => {
    try {
      const ids = repetitionLog.map((l) => l.id).filter((id) => id)
      if (ids.length > 0) {
        await repetitionLogsService.deleteAll(ids)
      }
      setRepetitionLog([])
      repetitionLogKeysRef.current.clear()
      toast({ title: "Logs Cleared", description: "All detection logs have been removed." })
    } catch (e) {
      console.error("Error clearing logs", e)
      toast({ title: "Error", description: "Failed to clear logs from database", variant: "destructive" })
    }
  }, [repetitionLog])

  // --- Remove Single Log ---
  const removeRepetitionLog = useCallback(
    async (logId: string) => {
      try {
        // Optimistic update
        const logToRemove = repetitionLog.find((l) => l.id === logId)
        setRepetitionLog((prev) => prev.filter((l) => l.id !== logId))

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
          repetitionLogKeysRef.current.delete(JSON.stringify(keyObj))
        }

        await repetitionLogsService.deleteAll([logId])
        toast({ title: "Log Removed", description: "Log entry removed." })
      } catch (error) {
        console.error("Error removing log:", error)
        toast({ title: "Error", description: "Failed to remove log", variant: "destructive" })
      }
    },
    [repetitionLog],
  )

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
      const serviceName = services.find((s) => s.id === serviceId)?.name || "Unknown Service"
      const subServiceName = subServices.find((s) => s.id === subServiceId)?.name || "Unknown Sub-Service"

      const currentSubMealPlan = subMealPlans.find((smp) => smp.id === subMealPlanId)
      const isRepeatAllowed = currentSubMealPlan?.isRepeatPlan || false

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

      // --- FIXED STATE UPDATE LOGIC FOR MULTI SELECT SAFETY ---
      setCombinedMenu((prev) => {
        const newMenu = { ...prev }
        // Safely create path copies to trigger re-renders
        if (!newMenu[date]) newMenu[date] = {}
        newMenu[date] = { ...newMenu[date] }

        if (!newMenu[date][serviceId]) newMenu[date][serviceId] = {}
        newMenu[date][serviceId] = { ...newMenu[date][serviceId] }

        if (!newMenu[date][serviceId][subServiceId]) newMenu[date][serviceId][subServiceId] = {}
        newMenu[date][serviceId][subServiceId] = { ...newMenu[date][serviceId][subServiceId] }

        if (!newMenu[date][serviceId][subServiceId][mealPlanId]) newMenu[date][serviceId][subServiceId][mealPlanId] = {}
        newMenu[date][serviceId][subServiceId][mealPlanId] = { ...newMenu[date][serviceId][subServiceId][mealPlanId] }

        const currentCell = newMenu[date][serviceId][subServiceId][mealPlanId][subMealPlanId] || { menuItemIds: [] }
        const existingIds = currentCell.menuItemIds || []

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
      const logsToRemove = repetitionLog.filter(
        (log) =>
          log.itemId === menuItemId &&
          log.attemptedDate === date &&
          log.serviceId === serviceId &&
          log.subServiceId === subServiceId &&
          log.mealPlanId === mealPlanId &&
          log.subMealPlanId === subMealPlanId,
      )

      if (logsToRemove.length > 0) {
        const ids = logsToRemove.map((l) => l.id).filter((id) => id)

        logsToRemove.forEach((log) => {
          const keyObj = {
            type: log.type,
            itemId: log.itemId,
            attemptedDate: log.attemptedDate,
            serviceId: log.serviceId,
            subServiceId: log.subServiceId,
            mealPlanId: log.mealPlanId,
            subMealPlanId: log.subMealPlanId,
          }
          repetitionLogKeysRef.current.delete(JSON.stringify(keyObj))
        })

        setRepetitionLog((prev) => prev.filter((log) => !ids.includes(log.id)))

        if (ids.length > 0) {
          try {
            await repetitionLogsService.deleteAll(ids)
            toast({ title: "Log Removed", description: "Removed associated duplicate warning." })
          } catch (error) {
            console.error("Failed to delete logs from DB", error)
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
      
      const filtered: CombinedMenuData = {}
      Object.entries(combinedMenu).forEach(([date, dayMenu]) => {
         const filteredDay: any = {}
         Object.entries(dayMenu).forEach(([sId, sData]) => {
             const filteredS: any = {}
             Object.entries(sData).forEach(([ssId, ssData]) => {
                 const filteredSS: any = {}
                 Object.entries(ssData).forEach(([mpId, mpData]) => {
                     const filteredMP: any = {}
                     Object.entries(mpData).forEach(([smpId, cell]) => {
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

      if (Object.keys(filtered).length === 0) {
        toast({ title: "Error", description: "Please add menu items before saving", variant: "destructive" })
        setSaving(false)
        return
      }

      const combinedMenuData = { startDate, endDate, menuData: filtered, status: "active" }
      const savedMenu = await combinedMenusService.add(combinedMenuData)
      await generateCompanyMenus(savedMenu.id, filtered)
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

      const serviceName = services.find((s) => s.id === serviceId)?.name || "Unknown Service"
      const subServiceName = subServices.find((s) => s.id === subServiceId)?.name || "Unknown Sub-Service"

      const currentSubMealPlan = subMealPlans.find((smp) => smp.id === subMealPlanId)
      const isRepeatAllowed = currentSubMealPlan?.isRepeatPlan || false

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
    [copyBuffer, applyItemsToCell],
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

      <Card className="mb-6 max-w-xl mx-auto shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Select Menu Week
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="weekPicker">Select Week (Any date, snaps to Monday)</Label>
            <Input 
                id="weekPicker"
                type="date" 
                value={startDate} 
                onChange={handleWeekSelect}
                className="w-full" 
            />
            {startDate && endDate && (
                <div className={`mt-2 p-3 rounded text-sm flex items-center justify-between ${duplicateMenuId ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-blue-50 text-blue-800 border border-blue-200'}`}>
                    <span>
                        <strong>Week:</strong> {new Date(startDate).toLocaleDateString()} — {new Date(endDate).toLocaleDateString()}
                    </span>
                    {duplicateMenuId && (
                        <div className="flex items-center gap-1 font-bold animate-pulse">
                            <AlertCircle className="h-4 w-4" />
                            <span>Menu Exists</span>
                        </div>
                    )}
                </div>
            )}
          </div>

          <div className="flex flex-col gap-2 mt-4">
            {duplicateMenuId ? (
                <Button 
                    onClick={handleOpenEdit} 
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Existing Menu
                </Button>
            ) : (
                <Button onClick={generateDateRange} disabled={generatingGrid || !startDate} className="w-full">
                    {generatingGrid ? (
                    <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating Grid...
                    </>
                    ) : (
                    <>
                        <Maximize2 className="h-4 w-4 mr-2" />
                        Create New Grid
                    </>
                    )}
                </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {startDate && endDate && hasDraft && !showModal && !duplicateMenuId && (
        <Card className="mb-6 border-l-4 border-l-purple-500 bg-purple-50">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-sm text-gray-700">
                <span className="font-medium">Draft available.</span> It will be loaded automatically when you open the
                grid.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {showModal && (
        <>
          <div className="fixed inset-0  bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg w-full h-full flex flex-col  absolute">
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
                    disabled={saving || Object.keys(combinedMenu).length === 0}
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
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      Repetition Log
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-gray-500">{repetitionLog.length} entries</div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearRepetitionLog}
                        className="text-red-600 hover:bg-red-50"
                      >
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
                                    ? entry.createdAt
                                        .toDate()
                                        .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                    : entry.time
                                      ? new Date(entry.time).toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })
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
                              {entry.serviceName || "Service"} <span className="text-gray-400">/</span>{" "}
                              {entry.subServiceName || "Sub-Service"}
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

      {/* Edit Modal (Triggered on Duplicate) */}
      <MenuEditModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        menuId={duplicateMenuId || ""}
        menuType="combined"
        preloadedMenuItems={menuItems}
      />
    </div>
  )
}