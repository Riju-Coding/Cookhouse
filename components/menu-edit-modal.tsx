"use client"

import { useState, useEffect, useCallback, useMemo, memo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChevronLeft , Globe2  } from "lucide-react";
import { createPortal } from 'react-dom' // <--- ADD THIS IMPORT
import { useAuth } from "@/hooks/use-auth"
import { useMenuPresence } from "@/hooks/use-menu-presence"
import { useLiveMenuEdits } from "@/hooks/use-live-menu-edits"
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
  Minus,
  ArrowRightLeft,
  FileArchive,
  Zap
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
import { ChoiceSelectionModal, BuildingMenuGrid } from "@/components/choice-selection-modal"
import { UpdationRecordBadge as ImportedUpdationRecordBadge } from "@/components/menu-edit-modal/updation-record-badge"
import { RemovedItemsModal as ImportedRemovedItemsModal } from "@/components/menu-edit-modal/removed-items-modal"
import { TimelineEntry as ImportedTimelineEntry } from "@/components/menu-edit-modal/timeline-entry"
import { ServiceNavigationPanel as ImportedServiceNavigationPanel } from "@/components/menu-edit-modal/service-navigation-panel"
import { LoadingProgress as ImportedLoadingProgress } from "@/components/menu-edit-modal/loading-progress"
import { DetailedDataScreen as ImportedDetailedDataScreen } from "@/components/menu-edit-modal/detailed-data-screen"

// --- Local Services Definition ---
// --- Types ---

interface MealPlanChoice {
  choiceId: string
  quantity: number
  choiceDay?: string
  serviceId?: string
  subServiceId?: string
  mealPlans: Array<{
    mealPlanId: string
    mealPlanName?: string
    subMealPlans: Array<{ subMealPlanId: string; subMealPlanName?: string }>
  }>
  createdAt?: string | Date
}

interface CompanyChoice {
  companyId: string
  companyName: string
  buildingId: string
  buildingName: string
  choices: MealPlanChoice[]
}

interface MenuCell {
  menuItemIds: string[]
  selectedDescriptions?: Record<string, string>
  customAssignments?: Record<string, Array<{ companyId: string; buildingId: string }>>
}

interface UpdationRecord {
  id?: string
  menuId: string
  menuType: string
  menuName: string
  updationNumber: number
  changedCells: any[]
  totalChanges: number
  menuStartDate: string
  menuEndDate: string
  createdAt: any
  createdBy: string
  companyId?: string
  companyName?: string
  buildingId?: string
  buildingName?: string
  // Company-sourced fields
  isCompanyWiseChange?: boolean
  sourcedFromCompanyId?: string
  sourcedFromCompanyName?: string
  sourcedFromMenuId?: string
  sourcedFromCombinedMenuId?: string
  // Building-sourced fields
  sourcedFromBuildingId?: string
  sourcedFromBuildingName?: string
  appliedToAllBuildings?: boolean
  appliedBuildingIds?: string[]
  otherBuildingsCount?: number
}

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
              if (!item) {
                return null
              }
              const descriptions = itemDescriptions[itemId] || []
              const selectedDesc = selectedDescriptions[itemId] || ""

              return (
                <div key={itemId} className="border rounded-lg p-4 bg-gradient-to-r from-amber-50 to-white">
                  <Label className="text-sm font-semibold text-gray-800 mb-3 block">{item?.name || `Item ${itemId}`}</Label>
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

// Helper component to render updation record with company attribution badge
const UpdationRecordBadge = ImportedUpdationRecordBadge

interface ItemCompanyAssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  selectedMenuItemIds: string[]
  itemToFocus: string | null
  allMenuItems: MenuItem[]
  defaultAssignedStructures: Array<{ companyId: string; companyName: string; buildingId: string; buildingName: string }>
  allActiveStructures: Array<{ companyId: string; companyName: string; buildingId: string; buildingName: string }> // NEW PROP
  currentCustomAssignments: MenuCell['customAssignments']
  onSave: (newAssignments: MenuCell['customAssignments']) => void
}

const ItemCompanyAssignmentModal = memo(function ItemCompanyAssignmentModal({
  isOpen,
  onClose,
  selectedMenuItemIds,
  itemToFocus,
  allMenuItems,
  defaultAssignedStructures,
  allActiveStructures,
  currentCustomAssignments,
  onSave,
}: ItemCompanyAssignmentModalProps) {
  const [tempAssignments, setTempAssignments] = useState<Record<string, Set<string>>>({})
  const [loading, setLoading] = useState(true)

  const itemMap = useMemo(() => new Map(allMenuItems.map(item => [item.id, item])), [allMenuItems])

  // Split structures into Default (Assigned) and Others (Unassigned)
  const { defaultStructures, otherStructures, allStructureKeys } = useMemo(() => {
    const defaultSet = new Set(defaultAssignedStructures.map(s => `${s.companyId}-${s.buildingId}`));

    // Sort Default
    const defaults = [...defaultAssignedStructures].sort((a, b) =>
      a.companyName.localeCompare(b.companyName) || a.buildingName.localeCompare(b.buildingName)
    );

    // Filter and Sort Others
    const others = allActiveStructures
      .filter(s => !defaultSet.has(`${s.companyId}-${s.buildingId}`))
      .sort((a, b) => a.companyName.localeCompare(b.companyName) || a.buildingName.localeCompare(b.buildingName));

    // Combine all keys for "Select All" logic
    const allKeys = [
      ...defaults.map(s => `${s.companyId}-${s.buildingId}`),
      ...others.map(s => `${s.companyId}-${s.buildingId}`)
    ];

    return { defaultStructures: defaults, otherStructures: others, allStructureKeys: allKeys };
  }, [defaultAssignedStructures, allActiveStructures]);

  const itemsForModal = useMemo(() => {
    if (itemToFocus) {
      return selectedMenuItemIds.filter(id => id === itemToFocus);
    }
    return selectedMenuItemIds;
  }, [selectedMenuItemIds, itemToFocus]);

  useEffect(() => {
    if (isOpen) {
      setLoading(true)
      const initialAssignments: Record<string, Set<string>> = {}

      const defaultStructureKeys = new Set(defaultAssignedStructures.map(s => `${s.companyId}-${s.buildingId}`))

      itemsForModal.forEach(itemId => {
        let assignedStructures: string[] = []

        if (currentCustomAssignments && currentCustomAssignments[itemId] !== undefined) {
          assignedStructures = currentCustomAssignments[itemId].map(s => `${s.companyId}-${s.buildingId}`)
        } else {
          assignedStructures = Array.from(defaultStructureKeys)
        }
        initialAssignments[itemId] = new Set(assignedStructures)
      })

      setTempAssignments(initialAssignments)
      setLoading(false)
    }
  }, [isOpen, itemsForModal, defaultAssignedStructures, currentCustomAssignments])

  if (!isOpen) return null

  const handleToggleAssignment = (itemId: string, structureKey: string) => {
    setTempAssignments(prev => {
      const newAssignments = { ...prev }
      const currentSet = new Set(newAssignments[itemId] || [])

      if (currentSet.has(structureKey)) {
        currentSet.delete(structureKey)
      } else {
        currentSet.add(structureKey)
      }
      newAssignments[itemId] = currentSet
      return newAssignments
    })
  }

  // NEW: Handle Select/Deselect All for a specific Item Column
  const handleToggleColumnAll = (itemId: string) => {
    setTempAssignments(prev => {
      const currentSet = prev[itemId] || new Set();
      // Check if all are currently selected
      const areAllSelected = allStructureKeys.every(key => currentSet.has(key));

      let newSet: Set<string>;
      if (areAllSelected) {
        // Deselect All
        newSet = new Set();
      } else {
        // Select All
        newSet = new Set(allStructureKeys);
      }

      return { ...prev, [itemId]: newSet };
    });
  }

  const handleSaveAssignments = () => {
    const defaultStructureKeys = new Set(defaultAssignedStructures.map(s => `${s.companyId}-${s.buildingId}`))
    const defaultKeysArray = Array.from(defaultStructureKeys).sort()
    const defaultKeysString = defaultKeysArray.join(',')

    const finalAssignments: MenuCell['customAssignments'] = {}

    itemsForModal.forEach(itemId => {
      const assigned = tempAssignments[itemId] || new Set()
      const assignedKeysArray = Array.from(assigned).sort()
      const assignedKeysString = assignedKeysArray.join(',')

      // Optimization: Only save if different from default structure
      if (assignedKeysString === defaultKeysString) {
        return
      }

      finalAssignments[itemId] = assignedKeysArray.map(key => {
        const [companyId, buildingId] = key.split('-')
        return { companyId, buildingId }
      })
    })

    onSave(finalAssignments)
    onClose()
  }

  const items = itemsForModal.map(id => itemMap.get(id)).filter((i): i is MenuItem => !!i)
  const modalTitle = itemToFocus
    ? `Customize Assignments: ${items[0]?.name || 'Item'}`
    : `Customize Item Assignments (${items.length} Items)`;

  const renderRow = (struct: { companyId: string, companyName: string, buildingId: string, buildingName: string }) => {
    const key = `${struct.companyId}-${struct.buildingId}`;
    return (
      <tr key={key} className="hover:bg-blue-50 transition-colors">
        <td className="sticky left-0 bg-white px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 border-r z-10 hover:bg-blue-100">
          <div className="font-semibold text-xs">{struct.companyName}</div>
          <div className="text-[10px] text-gray-500">{struct.buildingName}</div>
        </td>
        {items.map((item) => {
          const isAssigned = tempAssignments[item.id]?.has(key) || false;
          return (
            <td key={item.id} className="px-4 py-2 text-center border-r border-gray-100">
              <input
                type="checkbox"
                checked={isAssigned}
                onChange={() => handleToggleAssignment(item.id, key)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
              />
            </td>
          )
        })}
      </tr>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] flex flex-col">
        <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-white border-b p-4 flex items-center justify-between">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            {modalTitle}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" type="button">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="p-4 overflow-y-auto flex-1">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600 italic">
                Use this grid to override the default company assignments for items.
              </p>
              <div className="flex gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-gray-200 border border-gray-400 rounded-sm"></div>
                  <span>Unchecked</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-blue-600 rounded-sm"></div>
                  <span>Checked (Assigned)</span>
                </div>
              </div>
            </div>

            {(defaultStructures.length === 0 && otherStructures.length === 0) ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-gray-500">No active companies found</p>
              </div>
            ) : (
              <div className="overflow-x-auto shadow-sm border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="sticky left-0 bg-gray-100 px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[200px] z-20 border-r border-b">
                        Company / Building
                      </th>
                      {items.map((item) => {
                        const currentSet = tempAssignments[item.id] || new Set();
                        const isAllSelected = allStructureKeys.length > 0 && allStructureKeys.every(k => currentSet.has(k));
                        const isSomeSelected = currentSet.size > 0 && !isAllSelected;

                        return (
                          <th
                            key={item.id}
                            className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-b min-w-[140px] bg-gray-50"
                          >
                            <div className="flex flex-col gap-2 items-center">
                              <span className="truncate w-full" title={item.name}>{item.name}</span>

                              <label className="flex items-center gap-1.5 cursor-pointer select-none bg-white px-2 py-1 rounded border hover:bg-gray-50 transition-colors shadow-sm">
                                <input
                                  type="checkbox"
                                  checked={isAllSelected}
                                  ref={input => {
                                    if (input) input.indeterminate = isSomeSelected;
                                  }}
                                  onChange={() => handleToggleColumnAll(item.id)}
                                  className="h-3.5 w-3.5 text-blue-600 cursor-pointer rounded-sm focus:ring-blue-500"
                                />
                                <span className="text-[10px] font-medium text-gray-600">Select All</span>
                              </label>
                            </div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {/* Default Section */}
                    {defaultStructures.length > 0 && (
                      <tr className="bg-blue-50/50">
                        <td colSpan={items.length + 1} className="px-4 py-2 text-[11px] font-bold text-blue-800 uppercase tracking-wider sticky left-0 z-10 border-b border-gray-200">
                          Assigned in Structure (Default)
                        </td>
                      </tr>
                    )}
                    {defaultStructures.map(renderRow)}

                    {/* Other Section */}
                    {otherStructures.length > 0 && (
                      <tr className="bg-orange-50/50 border-t-2 border-gray-300">
                        <td colSpan={items.length + 1} className="px-4 py-2 text-[11px] font-bold text-orange-800 uppercase tracking-wider sticky left-0 z-10 border-b border-gray-200">
                          Other Active Companies (Manual Override)
                        </td>
                      </tr>
                    )}
                    {otherStructures.map(renderRow)}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="border-t p-4 flex items-center justify-end gap-3 bg-gray-50">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveAssignments}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Set Custom Assignments
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
})

// --- Confirmation Modal Component (For showing subservice menus company-wise) ---
const SubServiceConfirmationModal = memo(function SubServiceConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  subService,
  menuData,
  dateRange,
  companies,
  buildings,
  allStructureAssignments,
  mealPlanAssignments,
  menuItems,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  subService: SubService | null
  menuData: any
  dateRange: Array<{ date: string; day: string }>
  companies: any[]
  buildings: any[]
  allStructureAssignments: any[]
  mealPlanAssignments: any[]
  menuItems: MenuItem[]
}) {
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [activeTabKey, setActiveTabKey] = useState<string | null>(null)

  const companyWiseMenus = useMemo(() => {
    if (!subService || !menuData || !allStructureAssignments || !mealPlanAssignments) {
      return []
    }

    const result: Array<{
      companyId: string
      companyName: string
      buildingId: string
      buildingName: string
      menuData: any
      itemCount: number
      menus: Array<{
        date: string
        day: string
        serviceId: string
        mealPlanItems: Array<{
          mealPlanName: string
          subMealPlanName: string
          items: Array<{ id: string; isCustom: boolean }>
        }>
      }>
    }> = []

    const processedKeys = new Set<string>()

    allStructureAssignments.forEach((assignment: any) => {
      const company = companies.find((c: any) => c.id === assignment.companyId)
      const building = buildings.find((b: any) => b.id === assignment.buildingId)

      const mpAssignment = mealPlanAssignments.find(
        (mpa: any) => mpa.companyId === assignment.companyId && mpa.buildingId === assignment.buildingId
      )

      if (!company || !building || !mpAssignment) {
        return
      }

      const key = `${assignment.companyId}-${assignment.buildingId}`
      if (processedKeys.has(key)) return
      processedKeys.add(key)

      const menus: typeof result[0]['menus'] = []
      let itemCount = 0
      let hasSubServiceAssignment = false

      dateRange.forEach(({ date, day }) => {
        const dayKey = day.toLowerCase()
        const dayStructure = assignment.weekStructure?.[dayKey] || []
        const dayMpStructure = mpAssignment.weekStructure?.[dayKey] || []

        const dayMenus: typeof menus[0]['mealPlanItems'] = []

        dayStructure.forEach((service: any) => {
          const serviceId = service.serviceId
          const subServices = service.subServices || []

          const matchingSubService = subServices.find((ss: any) => ss.subServiceId === subService.id)
          if (!matchingSubService) return

          const mpService = dayMpStructure.find((s: any) => s.serviceId === serviceId)
          if (!mpService) return

          const mpSubService = mpService.subServices?.find((ss: any) => ss.subServiceId === subService.id)
          if (!mpSubService) return

          hasSubServiceAssignment = true

          const mealPlans = mpSubService.mealPlans || []

          mealPlans.forEach((mealPlan: any) => {
            const mealPlanId = mealPlan.mealPlanId
            const mealPlanData = menuData[date]?.[serviceId]?.[subService.id]?.[mealPlanId]
            if (!mealPlanData) return

            const subMealPlans = mealPlan.subMealPlans || []
            subMealPlans.forEach((subMealPlan: any) => {
              const subMealPlanId = subMealPlan.subMealPlanId
              const cellData = mealPlanData[subMealPlanId]

              let itemsToAdd: Array<{ id: string; isCustom: boolean }> = []

              if (cellData && cellData.menuItemIds) {
                const cellItems = cellData.menuItemIds
                const customAssignments = cellData.customAssignments || {}

                cellItems.forEach((itemId: string) => {
                  const itemAssignments = customAssignments[itemId]

                  if (itemAssignments && Array.isArray(itemAssignments) && itemAssignments.length > 0) {
                    const isAssigned = itemAssignments.some((a: any) =>
                      a.companyId === assignment.companyId && a.buildingId === assignment.buildingId
                    )
                    if (isAssigned) itemsToAdd.push({ id: itemId, isCustom: true })
                  } else {
                    itemsToAdd.push({ id: itemId, isCustom: false })
                  }
                })
              }

              itemCount += itemsToAdd.length

              dayMenus.push({
                mealPlanName: mealPlan.mealPlanName || 'Meal Plan',
                subMealPlanName: subMealPlan.subMealPlanName || 'Sub Meal Plan',
                items: itemsToAdd
              })
            })
          })
        })

        if (dayMenus.length > 0) {
          menus.push({ date, day, serviceId: dayStructure[0]?.serviceId || '', mealPlanItems: dayMenus })
        }
      })

      if (hasSubServiceAssignment) {
        result.push({
          companyId: assignment.companyId,
          companyName: company.name,
          buildingId: assignment.buildingId,
          buildingName: building.name,
          menuData: {},
          itemCount,
          menus,
        })
      }
    })

    return result
  }, [subService, menuData, dateRange, companies, buildings, allStructureAssignments, mealPlanAssignments])

  // Set the first company as active initially
  useEffect(() => {
    if (companyWiseMenus.length > 0 && !activeTabKey) {
      setActiveTabKey(`${companyWiseMenus[0].companyId}-${companyWiseMenus[0].buildingId}`)
    } else if (companyWiseMenus.length === 0) {
      setActiveTabKey(null)
    }
  }, [companyWiseMenus, activeTabKey])

  const activeCompanyData = useMemo(() => {
    if (!activeTabKey) return null
    return companyWiseMenus.find(c => `${c.companyId}-${c.buildingId}` === activeTabKey) || companyWiseMenus[0]
  }, [companyWiseMenus, activeTabKey])

  // Extract unique meal plans & sub meal plans for the grid's Y-axis
  const gridRows = useMemo(() => {
    if (!activeCompanyData) return []
    const rowsMap = new Map<string, { mealPlanName: string; subMealPlanName: string }>()

    activeCompanyData.menus.forEach(menu => {
      menu.mealPlanItems.forEach(mpi => {
        const key = `${mpi.mealPlanName}|${mpi.subMealPlanName}`
        if (!rowsMap.has(key)) {
          rowsMap.set(key, { mealPlanName: mpi.mealPlanName, subMealPlanName: mpi.subMealPlanName })
        }
      })
    })

    // Convert to array and sort arbitrarily by meal plan name to keep order consistent
    return Array.from(rowsMap.values()).sort((a, b) =>
      a.mealPlanName.localeCompare(b.mealPlanName) || a.subMealPlanName.localeCompare(b.subMealPlanName)
    )
  }, [activeCompanyData])

  const handleConfirm = async () => {
    setConfirmLoading(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 500))
      onConfirm()
      onClose()
    } catch (error) {
      console.error("Error confirming:", error)
    } finally {
      setConfirmLoading(false)
    }
  }

  if (!isOpen || !subService) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-[250] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-[95vw] w-full h-[90vh] flex flex-col overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-50 to-white border-b p-4 flex-none flex items-center justify-between">
          <div>
            <h3 className="font-bold text-xl flex items-center gap-2 text-gray-900">
              <CheckCircle className="h-6 w-6 text-blue-600" />
              Confirm Company Distribution: {subService.name}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Review exactly which menu items are assigned to which company. (Purple items override default structure).
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors" type="button">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content Area */}
        {companyWiseMenus.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 bg-gray-50">
            <Building2 className="h-16 w-16 text-gray-300 mb-4" />
            <h4 className="text-lg font-medium text-gray-700">No Companies Found</h4>
            <p className="text-sm text-gray-500">No companies are currently assigned to this sub-service.</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 bg-gray-100">

            {/* Excel-like Grid Area */}
            <div className="flex-1 overflow-auto bg-white m-4 mb-0 rounded-t-lg border border-gray-200 shadow-sm relative">
              {gridRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <FileText className="h-12 w-12 mb-2 opacity-50" />
                  <p>No menu items configured for this company yet.</p>
                </div>
              ) : (
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 z-20 shadow-sm">
                    <tr>
                      <th className="border border-gray-200 bg-gray-50 p-3 text-left sticky left-0 z-30 min-w-[200px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        <div className="font-semibold text-gray-700 text-sm">Meal Plan Structure</div>
                      </th>
                      {dateRange.map(({ date, day }) => (
                        <th key={date} className="border border-gray-200 bg-white p-3 min-w-[250px] text-left">
                          <div className="font-semibold text-gray-900">
                            {new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </div>
                          <div className="text-xs text-gray-500 font-medium">{day}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gridRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                        <td className="border border-gray-200 bg-gray-50 p-3 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] align-top">
                          <div className="font-bold text-sm text-blue-800 mb-1">{row.mealPlanName}</div>
                          <div className="text-xs text-gray-600 font-medium ml-2">↳ {row.subMealPlanName}</div>
                        </td>
                        {dateRange.map(({ date }) => {
                          const dailyMenu = activeCompanyData?.menus.find(m => m.date === date)
                          const cellData = dailyMenu?.mealPlanItems.find(
                            mpi => mpi.mealPlanName === row.mealPlanName && mpi.subMealPlanName === row.subMealPlanName
                          )

                          return (
                            <td key={date} className="border border-gray-200 p-2 align-top bg-white min-h-[60px]">
                              {!cellData || cellData.items.length === 0 ? (
                                <div className="text-gray-300 text-xs italic text-center py-2">-</div>
                              ) : (
                                <div className="flex flex-col gap-1.5">
                                  {cellData.items.map((item, itemIdx) => {
                                    const menuItem = menuItems.find(mi => mi.id === item.id)
                                    return (
                                      <div
                                        key={itemIdx}
                                        className={`flex items-center justify-between px-2 py-1.5 rounded border text-xs font-medium ${item.isCustom
                                            ? 'bg-purple-50 text-purple-800 border-purple-200 shadow-sm'
                                            : 'bg-blue-50 text-blue-800 border-blue-100'
                                          }`}
                                        title={menuItem?.name}
                                      >
                                        <span className="truncate mr-2">{menuItem?.name || 'Unknown Item'}</span>
                                        {item.isCustom && <Building2 className="h-3 w-3 text-purple-500 flex-shrink-0" title="Custom Company Assignment" />}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Excel-style Tabs */}
            <div className="flex bg-gray-200 border-b border-gray-300 overflow-x-auto no-scrollbar mx-4 pt-1">
              {companyWiseMenus.map((companyMenu) => {
                const key = `${companyMenu.companyId}-${companyMenu.buildingId}`
                const isActive = activeTabKey === key
                return (
                  <button
                    key={key}
                    onClick={() => setActiveTabKey(key)}
                    className={`flex items-center gap-2 px-4 py-2 border-t border-r border-l rounded-t-lg text-sm font-medium transition-colors whitespace-nowrap min-w-max relative z-10 ${isActive
                        ? 'bg-white text-blue-700 border-gray-300 shadow-[0_-2px_4px_rgba(0,0,0,0.05)] border-b-white'
                        : 'bg-gray-100 text-gray-600 border-transparent border-b-gray-300 hover:bg-gray-50 hover:text-gray-800'
                      }`}
                    style={{ marginBottom: isActive ? '-1px' : '0' }}
                  >
                    <Building2 className={`h-4 w-4 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span>{companyMenu.companyName}</span>
                    <span className="text-xs font-normal text-gray-500 hidden sm:inline-block">- {companyMenu.buildingName}</span>

                    {companyMenu.itemCount > 0 && (
                      <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-600'
                        }`}>
                        {companyMenu.itemCount} items
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t p-4 flex-none flex items-center justify-between bg-white">
          <div className="text-sm text-gray-500">
            {activeCompanyData && (
              <span>Currently viewing: <strong className="text-gray-700">{activeCompanyData.companyName}</strong> ({activeCompanyData.buildingName})</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onClose} disabled={confirmLoading}>
              Go Back & Edit
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={confirmLoading || companyWiseMenus.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white min-w-[140px]"
            >
              {confirmLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm & Save
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
})

function ConflictDetailsDrawer({
  isOpen,
  onClose,
  analysisData,
  companies = [],
  buildings = [],
  structureAssignments = [],
  menuData = {},
  dateRange = []
}: {
  isOpen: boolean
  onClose: () => void
  analysisData: any[]
  companies?: any[]
  buildings?: any[]
  structureAssignments?: any[]
  menuData?: any
  dateRange?: Array<{ date: string; day: string }>
}) {
  const [currentSelectionDate, setCurrentSelectionDate] = useState<string | null>(null)
  const [companyPopupOpen, setCompanyPopupOpen] = useState(false)
  const [selectedCompanyData, setSelectedCompanyData] = useState<any>(null)
  const [companyDetails, setCompanyDetails] = useState<any[]>([])

  // Initialize current selection date when conflict drawer opens or data changes
  useEffect(() => {
    if (isOpen && analysisData && analysisData.length > 0) {
      // Find the current cell date first
      for (const itemAnalysis of analysisData) {
        for (const occ of itemAnalysis.occurrences) {
          if (occ.isCurrentCell) {
            setCurrentSelectionDate(occ.date)
            return
          }
        }
      }
      // Fallback to first occurrence date if no current cell found
      if (analysisData[0].occurrences && analysisData[0].occurrences.length > 0) {
        setCurrentSelectionDate(analysisData[0].occurrences[0].date)
      }
    }
  }, [isOpen, analysisData])

  const handleSelectCurrent = (date: string) => {
    setCurrentSelectionDate(date)
  }

  const calculateDaysDifference = (baseDate: string | null, compareDate: string): number => {
    if (!baseDate) return 0

    // Parse dates in YYYY-MM-DD format safely to avoid timezone issues
    const parseDate = (dateStr: string): Date => {
      const [year, month, day] = dateStr.split('-').map(Number)
      return new Date(year, month - 1, day)
    }

    const baseDateObj = parseDate(baseDate)
    const compareDateObj = parseDate(compareDate)

    const diffTime = compareDateObj.getTime() - baseDateObj.getTime()
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const handleCompanyIconClick = (occurrence: any) => {
    setSelectedCompanyData(occurrence)

    const companyDetailsArray: any[] = []
    const processedCompanies = new Set<string>()

    // Get the day key from occurrence.day directly
    const dayKey = occurrence.day.toLowerCase()

    // First, check for CUSTOM ASSIGNMENTS in the menu data (takes priority)
    const cellData = menuData?.[occurrence.date]?.[occurrence.serviceId]?.[occurrence.subServiceId]?.[occurrence.mealPlanId]?.[occurrence.subMealPlanId]
    const customAssignments = cellData?.customAssignments || {}

    if (Object.keys(customAssignments).length > 0) {
      // Process custom assignments first
      Object.entries(customAssignments).forEach(([itemId, assignments]: [string, any]) => {
        if (Array.isArray(assignments)) {
          assignments.forEach((assignment: any) => {
            const key = `${assignment.companyId}-${assignment.buildingId}`
            if (!processedCompanies.has(key)) {
              const company = companies.find(c => c.id === assignment.companyId)
              const building = buildings.find(b => b.id === assignment.buildingId)

              if (company && building) {
                companyDetailsArray.push({
                  companyId: assignment.companyId,
                  buildingId: assignment.buildingId,
                  companyName: company.name,
                  buildingName: building.name,
                  serviceName: occurrence.serviceName,
                  subServiceName: occurrence.subServiceName,
                  isCustom: true
                })
                processedCompanies.add(key)
              }
            }
          })
        }
      })
    }

    // FALLBACK: If no custom assignments, get MEAL PLAN STRUCTURE assignments
    if (companyDetailsArray.length === 0) {
      structureAssignments.forEach((assignment: any) => {
        const company = companies.find(c => c.id === assignment.companyId)
        const building = buildings.find(b => b.id === assignment.buildingId)

        if (!company || !building) return

        // Check if this structure applies to the current day/service/subservice
        const dayStructure = assignment.weekStructure?.[dayKey] || []

        const serviceInDay = dayStructure.find((s: any) => s.serviceId === occurrence.serviceId)
        if (!serviceInDay) return

        const subServiceInDay = serviceInDay.subServices?.find((ss: any) => ss.subServiceId === occurrence.subServiceId)
        if (!subServiceInDay) return

        const key = `${assignment.companyId}-${assignment.buildingId}`
        if (!processedCompanies.has(key)) {
          companyDetailsArray.push({
            companyId: assignment.companyId,
            buildingId: assignment.buildingId,
            companyName: company.name,
            buildingName: building.name,
            serviceName: occurrence.serviceName,
            subServiceName: occurrence.subServiceName,
            isCustom: false
          })
          processedCompanies.add(key)
        }
      })
    }

    // If still no assignments found, show empty state
    if (companyDetailsArray.length === 0) {
      companyDetailsArray.push({
        serviceName: occurrence.serviceName,
        subServiceName: occurrence.subServiceName,
        companyName: "No Company Assignment",
        buildingName: "N/A",
        isCustom: false
      })
    }

    setCompanyDetails(companyDetailsArray)
    setCompanyPopupOpen(true)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-3xl bg-white shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-300">

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

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-100 border-b">
                    <tr>
                      <th className="px-4 py-3">Date & Day</th>
                      <th className="px-4 py-3">Days</th>
                      <th className="px-4 py-3">Service</th>
                      <th className="px-4 py-3">Meal Plan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">

                    {itemAnalysis.occurrences.map((occ: any, oIdx: number) => (
                      <tr
                        key={oIdx}
                        className={`transition-colors ${occ.isCurrentCell
                            ? "bg-yellow-50 border-l-4 border-l-yellow-400"
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
                          <div className="text-gray-900 font-bold">{occ.subServiceName}</div>
                          <div className="text-xs text-gray-500">{occ.serviceName}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-gray-900 font-bold">{occ.subMealPlanName}</div>
                          <div className="text-xs text-gray-500">{occ.mealPlanName}</div>
                        </td>
                      </tr>
                    ))}

                    {itemAnalysis.occurrences.map((occ: any, oIdx: number) => {
                      // Determine the date we are comparing against (User's current selection)
                      const referenceDate = currentSelectionDate || (itemAnalysis.occurrences[0]?.date ?? null);

                      // Calculate the numerical distance between the dates
                      const daysOffset = calculateDaysDifference(referenceDate, occ.date);

                      // Logical styling based on the nature of the occurrence
                      const isSelected = currentSelectionDate === occ.date;
                      const isPreviousWeek = occ.isPrevWeek; // This flag comes from our updated handleAnalyzeConflicts

                      return (
                        <tr
                          key={oIdx}
                          className={`transition-colors border-b border-gray-100 ${occ.isCurrentCell
                              ? "bg-yellow-50/50 border-l-4 border-l-yellow-400"
                              : isSelected
                                ? "bg-blue-50/30"
                                : "hover:bg-gray-50"
                            }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleSelectCurrent(occ.date)}
                                className={`text-left group flex-1 transition-all ${isSelected ? "scale-[1.02]" : ""
                                  }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className={`font-bold ${isSelected ? "text-blue-700" : "text-gray-900"}`}>
                                    {new Date(occ.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </span>

                                  {/* Previous Week Label */}
                                  {isPreviousWeek && (
                                    <span className="inline-flex items-center bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-black uppercase border border-slate-300 tracking-tighter">
                                      Last Week
                                    </span>
                                  )}

                                  {/* Current Selection Indicator */}
                                  {isSelected && (
                                    <div className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
                                  )}
                                </div>
                                <div className={`text-xs ${isSelected ? "text-blue-500 font-medium" : "text-gray-500"}`}>
                                  {occ.day}
                                </div>
                              </button>

                              {/* Company Assignment Action */}
                              <button
                                onClick={() => handleCompanyIconClick(occ)}
                                className={`p-1.5 rounded-md transition-all ${isPreviousWeek
                                    ? "text-slate-400 hover:bg-slate-100"
                                    : "text-gray-500 hover:bg-gray-200 hover:text-blue-600"
                                  }`}
                                title="View Company Assignments"
                              >
                                <Building2 className="h-4 w-4" />
                              </button>
                            </div>

                            {occ.isCurrentCell && (
                              <span className="text-[10px] font-bold text-yellow-700 mt-1 flex items-center gap-1">
                                <span className="h-1 w-1 rounded-full bg-yellow-700" />
                                Active Grid Selection
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-center">
                            <div
                              className={`inline-block min-w-[32px] px-2 py-1 rounded text-xs font-black shadow-sm ${isPreviousWeek
                                  ? "bg-slate-100 text-slate-500 border border-slate-200" // Gray for last week
                                  : daysOffset === 0
                                    ? "bg-blue-600 text-white" // Blue for reference date
                                    : daysOffset > 0
                                      ? "bg-green-100 text-green-700 border border-green-200" // Green for future
                                      : "bg-orange-100 text-orange-700 border border-orange-200" // Orange for past
                                }`}
                            >
                              {daysOffset > 0 ? `+${daysOffset}` : daysOffset}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <div className={`font-bold text-sm ${isPreviousWeek ? "text-slate-500" : "text-gray-900"}`}>
                              {occ.serviceName}
                            </div>
                            <div className="text-[11px] text-gray-500 leading-tight">
                              {occ.subServiceName}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <div className={`font-bold text-sm ${isPreviousWeek ? "text-slate-500" : "text-gray-900"}`}>
                              {occ.mealPlanName || 'N/A'}
                            </div>
                            <div className="text-[11px] text-gray-500 italic">
                              {occ.subMealPlanName || 'N/A'}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Company Popup */}
      {companyPopupOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setCompanyPopupOpen(false)}
          />
          <div className="relative bg-white rounded-lg shadow-2xl p-6 max-w-md w-full mx-4 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-gray-700" />
                Companies & Buildings
              </h3>
              <button
                onClick={() => setCompanyPopupOpen(false)}
                className="p-1 hover:bg-gray-100 rounded text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {selectedCompanyData && (
              <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
                <p className="text-sm font-medium text-gray-700">
                  {new Date(selectedCompanyData.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {selectedCompanyData.day}
                </p>
                <p className="text-xs text-gray-600 mt-1">{selectedCompanyData.serviceName}</p>
              </div>
            )}

            {companyDetails && companyDetails.length > 0 ? (
              <div className="space-y-2">
                {companyDetails.map((cd: any, idx: number) => (
                  <div key={idx} className={`p-3 rounded border ${cd.isCustom ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="text-xs font-medium text-gray-600 mb-2">
                      {cd.isCustom ? 'CUSTOM ASSIGNMENT' : 'MEAL PLAN STRUCTURE'}
                    </div>
                    <div className="text-sm font-semibold text-gray-900">{cd.companyName}</div>
                    <div className="text-sm text-gray-700">{cd.buildingName}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500">
                <p>No assignment details available</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface MenuEditModalProps {
  isOpen: boolean
  onClose: () => void
  menuId: string
  menuType: "combined" | "company"
  onSave?: () => void
  preloadedMenuItems?: MenuItem[]
  /** 'create' mode generates an empty grid from dates; 'edit' mode loads from Firestore (default) */
  mode?: "create" | "edit"
  /** Start date for create mode (YYYY-MM-DD) */
  createStartDate?: string
  /** End date for create mode (YYYY-MM-DD) */
  createEndDate?: string
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

// --- Removed Items Modal Component ---
const RemovedItemsModal = ImportedRemovedItemsModal

// --- NEW: Timeline Entry Component ---
// --- NEW TIMELINE COMPONENT ---
const TimelineEntry = ImportedTimelineEntry

// --- Menu Cell Component ---
const MenuGridCell = memo(function MenuGridCell({
  date,
  day,
  service,
  subServiceId,
  mealPlan,
  menuCell,
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
  cellUpdations,
  onExcludeItem,
  onExcludeDate,
  onExcludeMealPlan,
  onUpdateCustomAssignments,  // <--- MAKE SURE THIS IS HERE!
  externalCompanyChangedItems, // <--- (Keep this if you added it earlier)
  liveChanges,
  originalMenuData,
  menuType = "combined",
  selectedChoiceItems = {},
  activeEditorNames = [] // <--- ADDED
}) {
  const [isOpen, setIsOpen] = useState(false)

  const [isCompanyOpen, setIsCompanyOpen] = useState(false)
  const [isLogOpen, setIsLogOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [creating, setCreating] = useState(false)
  const [showDescModal, setShowDescModal] = useState(false)
  const [showAssignmentModal, setShowAssignmentModal] = useState(false)
  const [itemToFocus, setItemToFocus] = useState<string | null>(null)
  const [excludedItems, setExcludedItems] = useState<Set<string>>(new Set())
  const [excludedMealPlans, setExcludedMealPlans] = useState<Set<string>>(new Set())
  const [showRemovedItemsModal, setShowRemovedItemsModal] = useState(false)
  const [removedItemData, setRemovedItemData] = useState<{ itemName: string; companies: Array<{ companyId: string; buildingId: string }> } | null>(null)
  // NOTE: liveChanges is now passed as a prop from parent - REMOVED local state to avoid shadowing the prop
  const dropdownRef = useRef<HTMLDivElement>(null)
  const cellRef = useRef<HTMLTableCellElement>(null); // Ref for the TD element

  const [dropdownDirection, setDropdownDirection] = useState<'up' | 'down'>('up');
  // State to control direction
  useEffect(() => {
    if (isActive && cellRef.current) {
      const rect = cellRef.current.getBoundingClientRect();
      // We increase the threshold to 450px to ensure top rows always open down.
      // Also, if you want it to ALWAYS open down (as you suggested), 
      // you can simply set: setDropdownDirection('down');
      if (rect.top < 450) {
        setDropdownDirection('down');
      } else {
        setDropdownDirection('up');
      }
    }
  }, [isActive]);
  const allActiveStructures = useMemo(() => {
    const result: { companyId: string; companyName: string; buildingId: string; buildingName: string }[] = [];
    if (!companies || !buildings) return result;

    companies.forEach((comp: any) => {
      if (comp.status !== 'active') return;
      const compBuildings = buildings.filter((b: any) => b.companyId === comp.id && b.status === 'active');
      compBuildings.forEach((b: any) => {
        result.push({
          companyId: comp.id,
          companyName: comp.name,
          buildingId: b.id,
          buildingName: b.name
        })
      })
    })
    return result;
  }, [companies, buildings]);

  // Calculate assigned companies from structure assignments, custom assignments, AND company-wise changes
  const assignedCompanies = useMemo(() => {
    const result: any[] = []
    const seenCompanies = new Set<string>()
    const cellKey = `${date}|${service.id}|${mealPlan.id}|${subMealPlan.id}`
    const cellChanges = liveChanges[cellKey] || []

    // Get all companies mentioned in any change for this cell
    const changedCompanyIds = new Set<string>()
    cellChanges.forEach((change: any) => {
      change.companyNames?.forEach((companyName: string) => {
        const company = companies.find((c: any) => c.name === companyName)
        if (company) {
          changedCompanyIds.add(company.id)
        }
      })
    })

    // 1. Add from structure assignments (meal plan structure)
    if (day && companies && structureAssignments) {
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

        const key = `${assignment.companyId}-${assignment.buildingId}`
        if (!seenCompanies.has(key)) {
          seenCompanies.add(key)
          result.push({
            companyId: assignment.companyId,
            companyName: company.name,
            buildingId: assignment.buildingId,
            buildingName: building.name,
          })
        }
      })
    }

    // 2. Add from custom assignments (company-wise changes that are currently active)
    if (menuCell?.customAssignments && selectedMenuItemIds && selectedMenuItemIds.length > 0) {
      selectedMenuItemIds.forEach((itemId: string) => {
        const customAssignmentsList = menuCell.customAssignments[itemId] || []
        customAssignmentsList.forEach((assignment: any) => {
          const company = companies.find((c: any) => c.id === assignment.companyId)
          if (!company) return

          const key = `${assignment.companyId}-${assignment.buildingId || 'default'}`
          if (!seenCompanies.has(key)) {
            seenCompanies.add(key)
            result.push({
              companyId: assignment.companyId,
              companyName: company.name,
              buildingId: assignment.buildingId || '',
              buildingName: assignment.buildingId ? (buildings.find((b: any) => b.id === assignment.buildingId)?.name || 'Unknown Building') : 'All Buildings',
            })
          }
        })
      })
    }

    // 3. Add from liveChanges - includes ALL items with company-wise changes (added, removed, replaced)
    // This ensures BOTH old and new items show Building icon
    changedCompanyIds.forEach((companyId: string) => {
      const company = companies.find((c: any) => c.id === companyId)
      if (company) {
        const key = `${companyId}-changed`
        if (!seenCompanies.has(key)) {
          seenCompanies.add(key)
          result.push({
            companyId: companyId,
            companyName: company.name,
            buildingId: 'company-wise-change',
            buildingName: 'Company-Wise Change',
          })
        }
      }
    })

    return result
  }, [day, companies, structureAssignments, service.id, subServiceId, mealPlan.id, subMealPlan.id])

  // Filter logs for this cell - show conflict on ANY cell containing a conflicting item

  const cellLogs = useMemo(() => {
    if (!repetitionLog || repetitionLog.length === 0 || selectedMenuItemIds.length === 0) return []
    return repetitionLog.filter(log => {
      // This cell must contain the conflicting item
      if (!selectedMenuItemIds.includes(log.itemId)) return false
      // Show if this is the cell where the conflict was logged
      const isAttemptedCell = log.attemptedDate === date &&
        log.serviceId === service.id &&
        log.subServiceId === subServiceId &&
        log.mealPlanId === mealPlan.id &&
        log.subMealPlanId === subMealPlan.id
      if (isAttemptedCell) return true
      // Also show on the FIRST occurrence cell
      if (log.originalDate === date &&
        log.originalServiceId === service.id &&
        log.originalSubServiceId === subServiceId &&
        log.originalMealPlanId === mealPlan.id &&
        log.originalSubMealPlanId === subMealPlan.id) return true
      return false
    })
  }, [repetitionLog, date, service.id, subServiceId, mealPlan.id, subMealPlan.id, selectedMenuItemIds])

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
    onAddItem(itemId)  // This now handles liveChanges in parent component
    setSearch("")
    setIsOpen(false)
  }

  const handleExcludeItem = (itemId: string) => {
    const newExcluded = new Set(excludedItems)
    if (newExcluded.has(itemId)) {
      newExcluded.delete(itemId)
    } else {
      newExcluded.add(itemId)
    }
    setExcludedItems(newExcluded)
    onExcludeItem?.(itemId, newExcluded.has(itemId))
  }

  const handleExcludeMealPlan = (mealPlanKey: string, isExcluded: boolean) => {
    const newExcluded = new Set(excludedMealPlans)
    if (isExcluded) {
      newExcluded.add(mealPlanKey)
    } else {
      newExcluded.delete(mealPlanKey)
    }
    setExcludedMealPlans(newExcluded)
    onExcludeMealPlan?.(mealPlanKey, isExcluded)
  }

  const onDragHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onStartDrag?.(date, selectedMenuItemIds)
  }

  // Build timeline data
  // --- REDESIGN: LIVE SESSION LOGIC ---
  const cellKey = `${date}|${service.id}|${mealPlan.id}|${subMealPlan.id}`;
  const currentLiveChanges = liveChanges?.[cellKey] || [];

  // 1. Logic to calculate which items to show (Current + Strikethrough)
  const itemsToRender = useMemo(() => {
    // Items currently saved in the menu data
    const activeIds = new Set(selectedMenuItemIds);

    // Items that were removed OR replaced during this live session (tracking which items were removed)
    const sessionRemovedIds = new Set(
      currentLiveChanges
        .filter(c => c.action === "removed" || (c.action === "replaced" && c.oldItemId))
        .map(c => c.oldItemId || c.itemId) // Get the ID of the item that was taken out
    );

    // Items that were ADDED in live session
    const sessionAddedIds = new Set(
      currentLiveChanges
        .filter(c => c.action === "added")
        .map(c => c.itemId)
    );

    // Items that were in the cell at the start of the session (OG) but are now gone
    const ogIds = originalMenuData?.[date]?.[service.id]?.[subServiceId]?.[mealPlan.id]?.[subMealPlan.id]?.menuItemIds || [];
    const ogRemovedIds = ogIds.filter((id: string) => !activeIds.has(id));

    // FIXED: Filter out items that were replaced in any U-record
    const replacedItemIds = new Set<string>();
    if (cellUpdations && cellUpdations.length > 0) {
      cellUpdations.forEach((upd: any) => {
        const relevantCell = upd.changedCells?.find((c: any) =>
          c.date === date &&
          c.serviceId === service.id &&
          c.mealPlanId === mealPlan.id &&
          c.subMealPlanId === subMealPlan.id
        );

        if (relevantCell && relevantCell.changes) {
          relevantCell.changes.forEach((ch: any) => {
            // If an item was replaced, add the OLD item to the replaced set
            if (ch.action === "replaced" && ch.itemId) {
              replacedItemIds.add(ch.itemId);
            }
          });
        }
      });
    }

    // Current items should be: [Items currently selected and NOT removed in session] + [Session added items] + [Session removed items]
    // EXCLUDE items that were replaced in U-records
    const filteredSelected = selectedMenuItemIds.filter(id => !replacedItemIds.has(id) && !sessionRemovedIds.has(id));
    // Also include items that were added in live session (even if not yet in selectedMenuItemIds due to state lag)
    // Also include items that were removed in live session (to show L-remove tag)
    const allToShow = [...new Set([...filteredSelected, ...Array.from(sessionAddedIds), ...Array.from(sessionRemovedIds)])];

    // Sort by most recent action (latest first)
    const sorted = allToShow.sort((a, b) => {
      const aChanges = currentLiveChanges.filter(c => c.itemId === a || c.oldItemId === a);
      const bChanges = currentLiveChanges.filter(c => c.itemId === b || c.oldItemId === b);

      const aLastIdx = aChanges.length > 0 ? currentLiveChanges.lastIndexOf(aChanges[aChanges.length - 1]) : -1;
      const bLastIdx = bChanges.length > 0 ? currentLiveChanges.lastIndexOf(bChanges[bChanges.length - 1]) : -1;

      return bLastIdx - aLastIdx; // Descending order (latest first)
    });

    return sorted;
  }, [selectedMenuItemIds, currentLiveChanges, originalMenuData, cellUpdations, date, service.id, subServiceId, mealPlan.id, subMealPlan.id]);

  // 2. Red State Logic: Cell turns red if it is currently EMPTY but has a session history
  const isRedState = selectedMenuItemIds.length === 0 && currentLiveChanges.length > 0;

  const hasUpdations = cellUpdations && cellUpdations.length > 0;
  const hasTimeline = currentLiveChanges.length > 0 || hasUpdations;



  return (
    <td
      ref={cellRef}
      onClick={() => onActivate()}
      onMouseEnter={() => {
        onCellMouseEnter?.()
        if (onHoverDrag) onHoverDrag(date)
      }}
      className={`border border-gray-300 p-2 align-top min-w-[200px] transition-all duration-150 relative 
            ${isActive ? "ring-2 ring-blue-500 bg-white z-[60]" : "bg-white hover:bg-gray-50"} 
            ${activeEditorNames.length > 0 ? "ring-2 ring-amber-500 ring-inset relative !z-[55]" : ""}
            ${isDragHover ? "ring-2 ring-blue-300 bg-blue-50" : ""}
            ${cellLogs.length > 0 && !isActive ? "bg-red-50" : ""} 
            ${isRedState ? "bg-red-50 !border-red-300 shadow-inner" : ""}
          `}
    >
      {activeEditorNames.length > 0 && (
        <div className="absolute -top-3 right-2 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm z-50 animate-pulse whitespace-nowrap">
          {activeEditorNames.join(", ")} editing...
        </div>
      )}
      {isRedState && (
        <div className="absolute inset-0 bg-red-500/5 pointer-events-none flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-red-100 opacity-50" />
        </div>
      )}
      {cellLogs.length > 0 && !isActive && (
        <div className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 z-10"></div>
      )}

      <div className="flex flex-col h-full min-h-[60px]">
        <div className="flex-1 space-y-1">
          {/* --- ADD THIS BLOCK: PREVIOUS WEEK MENU DISPLAY --- */}
          {prevItems && prevItems.length > 0 && (
            <div className="mb-2 pb-1 border-b border-dashed border-gray-200">
              {prevItems.map((pId) => {
                const pItem = allMenuItems.find((i) => i.id === pId);
                if (!pItem) return null;
                return (
                  <div key={`pw-${pId}`} className="flex items-center gap-1 text-[10px] text-yellow-800 italic bg-gray-50 px-1 rounded">
                    <FileArchive className="h-2.5 w-2.5 opacity-100" />
                    <span className="truncate">PW: {pItem.name}</span>
                  </div>
                );
              })}
            </div>
          )}
          {/* First show items that are currently active */}
          {itemsToRender.map((itemId) => {
            const isCurrentlyActive = selectedMenuItemIds.includes(itemId);
            const item = allMenuItems.find((i) => i.id === itemId);
            if (!item) return null;

            // Find the MOST RECENT action for this item (last action in the list)
            const itemChanges = currentLiveChanges.filter(c => c.itemId === itemId || c.oldItemId === itemId);
            const mostRecentAction = itemChanges.length > 0 ? itemChanges[itemChanges.length - 1] : null;

            // Get the actual action considering the most recent change
            let finalAction = null;
            if (mostRecentAction) {
              if (mostRecentAction.action === "added") {
                finalAction = "added";
              } else if (mostRecentAction.action === "removed") {
                finalAction = "removed";
              } else if (mostRecentAction.action === "replaced" && mostRecentAction.oldItemId === itemId) {
                finalAction = "removed"; // Old item in replacement is treated as removed
              }
            }

            // Determine visual state based on final action
            const isRemovedInSession = finalAction === "removed";
            const isAddedInSession = finalAction === "added";

            // If item is currently active, it's been re-added - so isCutState should be false
            const isCutState = isRemovedInSession && !isCurrentlyActive;

            // Get live action for display
            let liveAction = null;
            let liveActionBg = "";

            // Check if item is in a saved U-record
            let itemURecord = null;
            if (isCurrentlyActive && cellUpdations && cellUpdations.length > 0) {
              for (let i = cellUpdations.length - 1; i >= 0; i--) {
                const upd = cellUpdations[i];
                const relevantCell = upd.changedCells?.find((c: any) =>
                  c.date === date &&
                  c.serviceId === service.id &&
                  c.mealPlanId === mealPlan.id &&
                  c.subMealPlanId === subMealPlan.id
                );

                if (relevantCell) {
                  const itemInThisRecord = relevantCell.changes.some((ch: any) =>
                    ch.itemId === itemId || ch.replacedWith === itemId
                  );

                  if (itemInThisRecord) {
                    // FIXED: Use global updation number for continuous counting across all cells
                    itemURecord = upd.updationNumber || (i + 1);
                    break;
                  }
                }
              }
            }

            // Priority: If currently active with U-record, show U-label; otherwise show L+aded for live adds; L-remove for removals
            if (isRemovedInSession && !isCurrentlyActive) {
              // Item is removed and NOT currently active - show L-remove (check this FIRST)
              liveAction = "L-remove";
              liveActionBg = "bg-red-50 text-red-700 border-red-200";
            } else if (isCurrentlyActive && itemURecord !== null) {
              // Item is currently selected and came from a saved U-record
              liveAction = `U${itemURecord}+added`;
              liveActionBg = "bg-blue-50 text-blue-700 border-blue-200";
            } else if (isCurrentlyActive && (itemChanges.length > 0 || isAddedInSession)) {
              // Check if this item was removed and then re-added in live session
              const removeIdx = currentLiveChanges.findIndex(c => c.action === "removed" && c.oldItemId === itemId);
              const reAddIdx = currentLiveChanges.findIndex(c => c.action === "added" && c.itemId === itemId);

              if (removeIdx !== -1 && reAddIdx !== -1 && reAddIdx > removeIdx) {
                // Item was removed and then re-added (in that order) - show L+add
                liveAction = "L+add";
                liveActionBg = "bg-green-50 text-green-700 border-green-200";
              } else {
                // Check if ANY item was removed in the session
                const anyRemoveInSession = currentLiveChanges.some(c =>
                  c.action === "removed" || c.action === "replaced"
                );

                if (anyRemoveInSession) {
                  // Any item was removed in session - show L+add for this item
                  liveAction = "L+add";
                  liveActionBg = "bg-green-50 text-green-700 border-green-200";
                } else if (reAddIdx !== -1) {
                  // Item was added without any prior removes in session - show L+aded
                  liveAction = "L+aded";
                  liveActionBg = "bg-green-50 text-green-700 border-green-200";
                }
              }
            }

            // Get removed companies for removed items
            // Look for the "removed" action entry in itemChanges which should contain the companies at removal time
            const removedActionEntry = itemChanges.find(c => c.action === "removed" || (c.action === "replaced" && c.oldItemId === itemId));
            const removedCompanies = removedActionEntry?.removedCompanies || removedActionEntry?.removedFromCompanies || [];

            return (
              <div key={itemId} className="space-y-1">
                <div
                  className={`group relative flex items-center justify-between border px-1.5 py-0.5 rounded text-xs transition-colors
                    ${isCutState
                      ? "bg-red-50 border-red-200 text-red-400 line-through opacity-70"
                      : "bg-blue-50/50 border-transparent text-gray-700 hover:bg-blue-100"
                    }
                `}
                >
                  <div className="flex items-center gap-2 truncate">
                    {/* --- Live Action Label (Added or Removed in session) --- */}
                    {liveAction && (
                      <span className={`px-1 py-0 rounded-[2px] text-[8px] font-black uppercase flex-shrink-0 border ${liveActionBg}`}>
                        {liveAction}
                      </span>
                    )}
                    {/* --- Legacy Removed Tag --- */}
                    {isCutState && !liveAction && (
                      <span className="bg-red-500 text-white px-1 py-0 rounded-[2px] text-[8px] font-black uppercase flex-shrink-0">
                        Removed
                      </span>
                    )}
                    {/* --- From Choice Badge (only in company-wise menus) --- */}
                    {(() => {
                      if (menuType === "company") {
                        const cellPath = `${date}|${service.id}|${mealPlan.id}|${subMealPlan.id}`
                        if (itemId && menuCell?.itemChoiceMarks) {
                          console.log("[v0-LOAD] Cell path:", cellPath, "| ItemId:", itemId, "| Found in itemChoiceMarks:", !!menuCell.itemChoiceMarks[itemId])
                        }
                      }
                      return isCurrentlyActive && menuType === "company" && menuCell?.itemChoiceMarks?.[itemId] && (
                        <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-[2px] text-[8px] font-bold uppercase flex-shrink-0 border border-blue-300 whitespace-nowrap" title="This item came from a choice selection">
                          From Choice
                        </span>
                      );
                    })()}
                    <span className="truncate font-medium leading-tight">{item.name}</span>
                  </div>

                  <div className="flex items-center gap-0.5 ml-1">
                    {isCurrentlyActive && (
                      <>
                        {/* Building Icon for Custom Assignments (Active Items) */}
                        {!isCutState && menuCell?.customAssignments && menuCell.customAssignments[itemId] && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setItemToFocus(itemId);
                              setShowAssignmentModal(true);
                            }}
                            className="text-blue-500 hover:text-blue-700 flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 transition-colors"
                            title={`Custom assignments: ${menuCell.customAssignments[itemId].length} building(s)`}
                          >
                            <Building2 className="h-3 w-3" />
                            <span className="text-[10px] font-semibold">{menuCell.customAssignments[itemId].length}</span>
                          </button>
                        )}
                        {/* Building Icon for Removed Items */}
                        {isRemovedInSession && removedCompanies.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRemovedItemData({
                                itemName: item.name,
                                companies: removedCompanies
                              });
                              setShowRemovedItemsModal(true);
                            }}
                            className="text-red-500 hover:text-red-700 flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 hover:bg-red-100 transition-colors"
                            title={`Removed from: ${removedCompanies.length} building(s)`}
                          >
                            <Building2 className="h-3 w-3" />
                            <span className="text-[10px] font-semibold">{removedCompanies.length}</span>
                          </button>
                        )}
                        {/* Remove Item Button */}
                        {!isCutState && (
                          <button onClick={(e) => { e.stopPropagation(); onRemoveItem(itemId); }} className="group-hover:opacity-100 text-red-400 hover:text-red-600 opacity-0 transition-opacity">
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {/* Then show items that were removed in live session */}
          {currentLiveChanges
            .filter(c => c.action === "removed" && c.oldItemId)
            .map((change) => {
              const itemId = change.oldItemId;
              const item = allMenuItems.find((i) => i.id === itemId);
              if (!item) return null;

              // Check if this removed item was re-added later
              const wasReAdded = currentLiveChanges.some(c => c.action === "added" && c.itemId === itemId && currentLiveChanges.indexOf(c) > currentLiveChanges.indexOf(change));

              // Skip if it was re-added (already shown in active items)
              if (wasReAdded) return null;

              return (
                <div key={`removed-${itemId}`} className="space-y-1">
                  <div
                    className="group relative flex items-center justify-between border px-1.5 py-0.5 rounded text-xs transition-colors bg-red-50 border-red-200 text-red-400 line-through opacity-70"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="bg-red-600 text-white px-1 py-0 rounded-[2px] text-[8px] font-black uppercase flex-shrink-0 border">
                        L-remove
                      </span>
                      <span className="truncate font-medium leading-tight">{item.name}</span>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>

        {/* ===== ENHANCED UPDATE TIMELINE ===== */}
        {/* ===== REDESIGNED UPDATION TIMELINE (in chronological order: OG first, then U-records, then live changes) ===== */}
        {hasTimeline && (
          <div className="mt-4 space-y-2 border-t pt-3 ml-1">

            {/* === TIMELINE ENTRIES IN CHRONOLOGICAL ORDER (oldest to newest) === */}
            {(() => {
              const timelineEntries: any[] = [];

              const ogIds = originalMenuData?.[date]?.[service.id]?.[subServiceId]?.[mealPlan.id]?.[subMealPlan.id]?.menuItemIds || [];

              // Build a Set of items that were replaced/removed across ALL sources (U-records + live changes)
              const allReplacedInUpdations = new Set<string>();
              const allRemovedInLiveChanges = new Set<string>();

              if (cellUpdations && cellUpdations.length > 0) {
                cellUpdations.forEach((upd: any) => {
                  const relevantCell = upd.changedCells?.find((c: any) =>
                    c.date === date &&
                    c.serviceId === service.id &&
                    c.mealPlanId === mealPlan.id &&
                    c.subMealPlanId === subMealPlan.id
                  );
                  if (relevantCell) {
                    relevantCell.changes.forEach((ch: any) => {
                      if ((ch.action === "removed" || ch.action === "replaced") && ch.itemId) {
                        allReplacedInUpdations.add(ch.itemId);
                      }
                    });
                  }
                });
              }

              // Track live removals
              currentLiveChanges.forEach((ch: any) => {
                if (ch.action === "removed" && ch.oldItemId) {
                  allRemovedInLiveChanges.add(ch.oldItemId);
                }
              });


              // 1. Add U-Records (saved checkpoints) - in reverse chronological order (latest first)
              if (cellUpdations && cellUpdations.length > 0) {
                const finalStatePerItem = new Map<string, { upd: any, change: any, updationIndex: number, action: string }>();

                cellUpdations.forEach((upd: any, idx: number) => {
                  const relevantCell = upd.changedCells?.find((c: any) =>
                    c.date === date &&
                    c.serviceId === service.id &&
                    c.mealPlanId === mealPlan.id &&
                    c.subMealPlanId === subMealPlan.id
                  );

                  if (relevantCell) {
                    const updationIndex = upd.updationNumber || (idx + 1);
                    relevantCell.changes.forEach((ch: any) => {
                      const itemId = ch.action === "removed" || ch.action === "replaced" ? ch.itemId : (ch.replacedWith || ch.itemId);
                      if (itemId) {
                        finalStatePerItem.set(itemId, {
                          upd,
                          change: ch,
                          updationIndex,
                          action: ch.action
                        });
                      }
                    });
                  }
                });

                const itemsCurrentlyActive = new Set<string>();
                itemsToRender.forEach((itemId) => {
                  if (selectedMenuItemIds.includes(itemId)) {
                    itemsCurrentlyActive.add(itemId);
                  }
                });

                Array.from(finalStatePerItem.entries())
                  .filter(([itemId, { action }]) => {
                    if (action === "removed") return true;
                    if (action === "replaced") return !itemsCurrentlyActive.has(itemId);
                    return !itemsCurrentlyActive.has(itemId);
                  })
                  .forEach(([itemId, { upd, change, updationIndex, action }]) => {
                    const isCompanyWiseChange = upd.menuType === "company" || upd.isCompanyWiseChange;
                    const resolvedName = change.itemName || change.replacedWithName || allMenuItems.find(m => m.id === (change.replacedWith || change.itemId))?.name || change.itemId;

                    let displayAction = action;
                    if (action === "replaced" && itemsCurrentlyActive.has(itemId)) {
                      displayAction = "added";
                    }

                    timelineEntries.push(
                      <TimelineEntry
                        key={`u-${upd.id}-${itemId}`}
                        label={`U${updationIndex}`}
                        labelBg={isCompanyWiseChange ? "bg-purple-600" : "bg-blue-600"}
                        itemName={resolvedName}
                        action={displayAction}
                      />
                    );
                  });
              }

              // 2. Add OG items (if any remain)
              if (ogIds.length > 0) {
                ogIds
                  .filter((id: string) => !allReplacedInUpdations.has(id) && !allRemovedInLiveChanges.has(id))
                  .forEach((id: string) => {
                    timelineEntries.push(
                      <TimelineEntry
                        key={`og-${id}`}
                        label="OG"
                        labelBg="bg-gray-900"
                        itemName={allMenuItems.find(m => m.id === id)?.name || id}
                        action="og"
                      />
                    );
                  });
              }

              // 3. Add OG NULL if applicable (LAST - baseline state)
              const remainingOgItems = ogIds.filter((id: string) => !allReplacedInUpdations.has(id) && !allRemovedInLiveChanges.has(id));
              if (ogIds.length === 0 || remainingOgItems.length === 0) {
                timelineEntries.push(
                  <TimelineEntry
                    key="og-null-state"
                    label="OG NULL"
                    labelBg="bg-gray-900"
                    itemName=""
                    action="og-null"
                  />
                );
              }

              return timelineEntries;
            })()}



            {/* --- EMPTY CELL FALLBACK (Only if no current items and no history) --- */}
            {selectedMenuItemIds.length === 0 && !hasTimeline && (
              <div className="text-[10px] text-gray-400 italic text-center py-2">
                No history for this cell
              </div>
            )}
          </div>
        )}
        {/* ===== END ENHANCED TIMELINE ===== */}

        {isActive && (
          <div className="mt-2 p-1 border-t bg-gray-50 flex items-center justify-between gap-1 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center gap-1" ref={dropdownRef}>

              {/* --- RED ALERT BUTTON --- */}
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
                  <div className={`absolute left-0 w-[280px] bg-white border rounded-lg shadow-2xl z-[200] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100
      ${dropdownDirection === 'down' ? 'top-full mt-2' : 'bottom-full mb-2'}
  `}>
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
                  className={`p-1.5 rounded transition-colors flex items-center gap-1 ${isCompanyOpen ? "bg-purple-100 text-purple-700" : "hover:bg-purple-100 text-purple-600"}`}
                  title={`View Companies (${assignedCompanies.length} assigned)`}
                >
                  <Building2 className="h-4 w-4" />
                  <span className="text-[10px] font-bold leading-none">{assignedCompanies.length}</span>
                </button>
                {isCompanyOpen && (
                  <div className={`absolute left-0 w-[250px] bg-white border rounded-lg shadow-xl z-[100] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150
      ${dropdownDirection === 'down' ? 'top-full mt-1' : 'bottom-full mb-1'}
  `}>
                    <div className="p-2 border-b bg-purple-50">
                      <h4 className="font-semibold text-xs text-purple-800 flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Assigned Companies ({assignedCompanies.length})
                      </h4>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto p-1">
                      {assignedCompanies.length > 0 ? (
                        assignedCompanies.map((comp, idx) => (
                          <button
                            key={idx}
                            onClick={(e) => {
                              e.stopPropagation()
                              // setEditingCompanyId(comp.companyId)
                              // setIsCompanyWiseModalOpen(true)
                              setIsCompanyOpen(false)
                              console.log("Company selected:", comp.companyName)
                            }}
                            className="w-full p-2 hover:bg-purple-100 rounded border-b last:border-0 border-gray-100 text-left transition-colors active:bg-purple-200"
                          >
                            <div className="font-medium text-xs text-gray-800 flex items-center gap-1.5">
                              {comp.companyName}
                              <Building2 className="h-3.5 w-3.5 text-purple-600 flex-shrink-0" />
                            </div>
                            <div className="text-[10px] text-gray-500">{comp.buildingName}</div>
                          </button>
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
                  setShowAssignmentModal(true)
                }}
                disabled={selectedMenuItemIds.length === 0}
                className={`p-1.5 rounded transition-colors ${selectedMenuItemIds.length > 0 ? "hover:bg-green-100 text-green-600" : "text-gray-300"
                  }`}
                title="Assign to Companies"
              >
                <ClipboardCopy className="h-4 w-4" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  console.log("[v0] Description button clicked! selectedMenuItemIds:", selectedMenuItemIds, "cell date:", date)
                  setShowDescModal(true)
                }}
                disabled={selectedMenuItemIds.length === 0}
                className={`p-1.5 rounded transition-colors ${selectedMenuItemIds.length > 0 ? "hover:bg-amber-100 text-amber-600" : "text-gray-300"
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
          console.log("[v0] ItemDescriptionModal - onSaveDescription called with itemId:", itemId, "selectedMenuItemIds:", selectedMenuItemIds)
          await menuItemsService.addDescriptions(itemId, descriptions)
          await menuItemsService.setSelectedDescription(itemId, selectedDescription)
        }}
      />

      {showDescModal && console.log("[v0] ItemDescriptionModal opened with selectedMenuItemIds:", selectedMenuItemIds, "allMenuItems:", allMenuItems.length)}



      <ItemCompanyAssignmentModal
        isOpen={showAssignmentModal}
        onClose={() => {
          setShowAssignmentModal(false)
          setItemToFocus(null)
        }}
        selectedMenuItemIds={selectedMenuItemIds}
        itemToFocus={itemToFocus}
        allMenuItems={allMenuItems}
        defaultAssignedStructures={assignedCompanies.map(c => ({
          companyId: c.companyId || "",
          companyName: c.companyName || "",
          buildingId: c.buildingId || "",
          buildingName: c.buildingName || ""
        }))}
        allActiveStructures={allActiveStructures}
        // Filter customAssignments to remove any entries for items that are no longer in the cell
        // (This handles the case where items were removed due to choice conflicts)
        currentCustomAssignments={Object.fromEntries(
          Object.entries(menuCell?.customAssignments || {}).filter(([itemId]) =>
            selectedMenuItemIds.includes(itemId) || menuCell?.menuItemIds?.includes(itemId)
          )
        )}
        onSave={(assignments) => {
          console.log("[v0] Saving custom assignments via state update:", assignments)
          onUpdateCustomAssignments?.(assignments)
          setShowAssignmentModal(false)
          setItemToFocus(null)
        }}
      />

      <RemovedItemsModal
        isOpen={showRemovedItemsModal}
        onClose={() => setShowRemovedItemsModal(false)}
        itemName={removedItemData?.itemName || ""}
        companies={removedItemData?.companies || []}
        allCompanies={companies}
        allBuildings={buildings}
      />



    </td>
  )
})


// --- Navigation Panel ---
const ServiceNavigationPanel = ImportedServiceNavigationPanel

const LoadingProgress = ImportedLoadingProgress

// --- Choice Selection Modal Component ---
// const ChoiceSelectionModal = memo(function ChoiceSelectionModal({
//   isOpen,
//   onClose,
//   companies,
//   onConfirm,
//   loading = false,
// }: {
//   isOpen: boolean
//   onClose: () => void
//   companies: CompanyChoice[]
//   onConfirm: (selections: Record<string, string>) => Promise<void>
//   loading?: boolean
// }) {
//   const [selections, setSelections] = useState<Record<string, string>>({})
//   const [confirming, setConfirming] = useState(false)

//   useEffect(() => {
//     if (isOpen) {
//       setSelections({})
//       setConfirming(false)
//     }
//   }, [isOpen])

//   const handleSelectChoice = (companyId: string, choiceId: string) => {
//     setSelections((prev) => ({
//       ...prev,
//       [companyId]: choiceId,
//     }))
//   }

//   const handleConfirm = async () => {
//     const hasAllSelections = companies.every((c) => selections[c.companyId])
//     if (!hasAllSelections) {
//       toast({ title: "Error", description: "Please select a choice for each company", variant: "destructive" })
//       return
//     }

//     setConfirming(true)
//     try {
//       await onConfirm(selections)
//       onClose()
//     } finally {
//       setConfirming(false)
//     }
//   }

//   if (!isOpen) return null

//   return (
//     <div className="fixed inset-0 bg-black bg-opacity-50 z-[200] flex items-center justify-center p-4">
//       <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-auto">
//         <div className="sticky top-0 bg-gradient-to-r from-amber-50 to-white border-b p-4 flex items-center justify-between">
//           <div>
//             <h3 className="font-semibold text-lg flex items-center gap-2">
//               <Zap className="h-5 w-5 text-amber-600" />
//               Select Choices for Companies
//             </h3>
//             <p className="text-sm text-gray-600">
//               {companies.length} company{companies.length !== 1 ? "ies" : ""} have choices available
//             </p>
//           </div>
//           <button onClick={onClose} className="text-gray-500 hover:text-gray-700" type="button">
//             <X className="h-5 w-5" />
//           </button>
//         </div>

//         <div className="p-4 space-y-6">
//           {companies.map((company) => (
//             <div key={company.companyId} className="border rounded-lg p-4 bg-gradient-to-r from-amber-50 to-white">
//               <div className="mb-4">
//                 <h4 className="font-semibold text-gray-900 flex items-center gap-2">
//                   <Building2 className="h-4 w-4 text-amber-600" />
//                   {company.companyName}
//                 </h4>
//                 <p className="text-xs text-gray-500 pl-6">{company.buildingName}</p>
//               </div>

//               <div className="space-y-2 pl-6">
//                 {company.choices.map((choice) => (
//                   <label
//                     key={choice.choiceId}
//                     className="flex items-start gap-3 p-3 border border-amber-200 rounded hover:bg-amber-100 transition-colors cursor-pointer"
//                   >
//                     <input
//                       type="radio"
//                       name={`choice-${company.companyId}`}
//                       checked={selections[company.companyId] === choice.choiceId}
//                       onChange={() => handleSelectChoice(company.companyId, choice.choiceId)}
//                       className="mt-1 cursor-pointer"
//                     />
//                     <div className="flex-1 min-w-0">
//                       <div className="font-medium text-amber-900">
//                         {choice.quantity}x - {choice.mealPlans.length} meal plan{choice.mealPlans.length !== 1 ? "s" : ""}
//                       </div>
//                       <div className="text-xs text-amber-700 mt-1 space-y-1">
//                         {choice.mealPlans.map((mp) => (
//                           <div key={mp.mealPlanId} className="flex items-start gap-2">
//                             <span className="font-medium">{mp.mealPlanName}:</span>
//                             <span className="text-amber-600">
//                               {mp.subMealPlans.map((smp) => smp.subMealPlanName).join(", ")}
//                             </span>
//                           </div>
//                         ))}
//                       </div>
//                     </div>
//                   </label>
//                 ))}
//               </div>
//             </div>
//           ))}
//         </div>

//         <div className="border-t p-4 flex items-center justify-end gap-2 bg-gray-50">
//           <Button variant="outline" onClick={onClose} disabled={confirming || loading}>
//             Cancel
//           </Button>
//           <Button
//             onClick={handleConfirm}
//             disabled={confirming || loading || companies.some((c) => !selections[c.companyId])}
//             className="bg-amber-600 hover:bg-amber-700 text-white"
//           >
//             {confirming || loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
//             Confirm Selections
//           </Button>
//         </div>
//       </div>
//     </div>
//   )
// })

// --- Main Modal Component ---
export function MenuEditModal({ isOpen, onClose, menuId, menuType, onSave, preloadedMenuItems, mode = "edit", createStartDate, createEndDate }: MenuEditModalProps) {
  const isCreateMode = mode === "create";
  const { user } = useAuth();
  const userName = user?.email?.split('@')[0] || "Unknown User";

  // Collaborative Hooks
  const liveMenuId = isOpen && menuId && !isCreateMode ? menuId : "";
  const { activeEditors, updateActiveCell } = useMenuPresence(liveMenuId, user?.uid, userName);
  const { broadcastEdit, clearDrafts } = useLiveMenuEdits(liveMenuId, (remoteChanges) => {
    setRawMenuData((prev: any) => {
      // Merge remote changes at the deepest cell level to prevent overwriting other cells
      const nextData = { ...prev };
      Object.keys(remoteChanges).forEach(key => {
        const [date, serviceId, subServiceId, mealPlanId, subMealPlanId] = key.split('|');
        if (!nextData[date]) nextData[date] = {};
        if (!nextData[date][serviceId]) nextData[date][serviceId] = {};
        if (!nextData[date][serviceId][subServiceId]) nextData[date][serviceId][subServiceId] = {};
        if (!nextData[date][serviceId][subServiceId][mealPlanId]) nextData[date][serviceId][subServiceId][mealPlanId] = {};
        nextData[date][serviceId][subServiceId][mealPlanId][subMealPlanId] = remoteChanges[key];
      });
      return nextData;
    });
  });

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState("Loading...")
  const [zipLoading, setZipLoading] = useState(false) // <--- ADD THIS
  const [liveChanges, setLiveChanges] = useState<Record<string, any[]>>({});

  const [menu, setMenu] = useState<MenuData | null>(null)
  
  // To avoid circular hook rewriting on menuData changes, we proxy setMenuData
  const [rawMenuData, setRawMenuData] = useState<any>({})

  // Stale-closure prevention for setMenuData proxy
  const liveMenuIdRef = useRef(liveMenuId);
  const broadcastEditRef = useRef(broadcastEdit);
  useEffect(() => {
    liveMenuIdRef.current = liveMenuId;
    broadcastEditRef.current = broadcastEdit;
  }, [liveMenuId, broadcastEdit]);

  const setMenuData = useCallback((valOrFn: any) => {
    setRawMenuData((prev: any) => {
      const nextState = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
      
      // Calculate diff to broadcast using detectMenuChanges
      // detectMenuChanges relies on menuItemsMap to find names, but we can pass an empty map
      // because we only care about the bare structure changed.
      const diffs = detectMenuChanges(prev, nextState, new Map());
      if (diffs.length > 0 && liveMenuIdRef.current) {
        diffs.forEach(change => {
           const cellKey = `${change.date}|${change.serviceId}|${change.subServiceId}|${change.mealPlanId}|${change.subMealPlanId}`;
           const cellData = nextState[change.date]?.[change.serviceId]?.[change.subServiceId]?.[change.mealPlanId]?.[change.subMealPlanId];
           if (cellData !== undefined) {
             broadcastEditRef.current(cellKey, cellData);
           }
        });
      }
      
      return nextState;
    });
  }, []); // <--- Empty dependencies ensure it NEVER captures stale closures from child components
  
  // Remap rawMenuData to menuData for the rest of the file
  const menuData = rawMenuData;
  const [originalMenuData, setOriginalMenuData] = useState<any>({})
  // FIXED: Separate state for the TRUE original (OG) baseline that is locked forever
  // This is set ONCE on initial load and NEVER updated, ensuring OG items always remain the same
  const [ogMenuData, setOgMenuData] = useState<any>({})
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

  const [conflictDrawerOpen, setConflictDrawerOpen] = useState(false)

  const [conflictAnalysisData, setConflictAnalysisData] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [buildings, setBuildings] = useState<any[]>([])
  const [mealPlanAssignments, setMealPlanAssignments] = useState<any[]>([])
  const [allStructureAssignments, setAllStructureAssignments] = useState<any[]>([])

  const [internalActiveCell, setInternalActiveCell] = useState<string | null>(null)
  const activeCell = internalActiveCell;
  const setActiveCell = useCallback((cellId: string | null) => {
    setInternalActiveCell(cellId);
    updateActiveCell(cellId);
  }, [updateActiveCell]);

  const [visibleDates, setVisibleDates] = useState(0)
  const CHUNK_SIZE = 7

  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedSubService, setSelectedSubService] = useState<SubService | null>(null)

  // CONFIRMATION MODAL STATE
  const [showConfirmationModal, setShowConfirmationModal] = useState(false)
  const [pendingSaveAction, setPendingSaveAction] = useState<{ isDraft: boolean } | null>(null)

  // CHOICE SELECTION MODAL STATE
  const [showChoiceModal, setShowChoiceModal] = useState(false)
  const [companiesWithChoices, setCompaniesWithChoices] = useState<CompanyChoice[]>([])
  const [choiceSelections, setChoiceSelections] = useState<Record<string, any[]>>({})
  // Pre-filled selections when reopening the choice modal with previously saved choices
  const [initialChoiceSelections, setInitialChoiceSelections] = useState<Record<string, any[]>>({})
  // Maps itemId to array of choice keys - for marking items as coming from choices
  const [selectedChoiceItems, setSelectedChoiceItems] = useState<Record<string, string[]>>({})

  // TABBED INTERFACE STATE
  const [activeBottomTab, setActiveBottomTab] = useState<'menu' | 'choices' | 'universal' | 'detailed'>('menu')
  const [choiceTabIndex, setChoiceTabIndex] = useState(0)
  const [inlineChoiceSelections, setInlineChoiceSelections] = useState<Record<string, any[]>>({})

  // Universal aggregate
  const universalData = useMemo(() => {
    const uniqueChoices = new Map<string, any>()
    const buildingMap = new Map<string, Array<any>>()

    companiesWithChoices.forEach((company) => {
      company.choices.forEach((c: any) => {
        // Validation: A technically valid choice MUST contain >= 2 SMPs. 
        // 1-SMP choices are database corruption/glitches and force unintended row fracturing.
        const smpCount = c.mealPlans?.reduce((acc: number, mp: any) => acc + (mp.subMealPlans?.length || 0), 0) || 0;
        if (smpCount < 2) return;

        // Generate signature to group structurally identical choices together across companies
        const sortedMealPlans = [...(c.mealPlans || [])].sort((a: any, b: any) => a.mealPlanId.localeCompare(b.mealPlanId));
        const smpSignature = sortedMealPlans.map((mp: any) => {
          const sortedSmps = [...(mp.subMealPlans || [])].sort((a: any, b: any) => a.subMealPlanId.localeCompare(b.subMealPlanId));
          return `${mp.mealPlanId}:${sortedSmps.map((smp: any) => smp.subMealPlanId).join(',')}`
        }).join('|');
        
        const signature = `${c.serviceId || ''}-${c.subServiceId || ''}-${(c.choiceDay || '').toLowerCase()}-${Number(c.quantity) || 1}-${smpSignature}`;

        if (!uniqueChoices.has(signature)) {
          uniqueChoices.set(signature, { ...c, choiceId: signature })
        }
        if (!buildingMap.has(signature)) {
          buildingMap.set(signature, [])
        }
        buildingMap.get(signature)!.push({
          companyId: company.companyId,
          companyName: company.companyName,
          buildingId: company.buildingId,
          buildingName: company.buildingName,
          originalChoiceId: c.choiceId
        })
      })
    })

    return {
      building: {
         companyId: "universal",
         companyName: "Universal Choices",
         buildingId: "all",
         buildingName: "All Buildings",
         choices: Array.from(uniqueChoices.values())
      },
      associations: buildingMap
    }
  }, [companiesWithChoices])

  const [updations, setUpdations] = useState<UpdationRecord[]>([])

  const mountedRef = useRef(true)


  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const abortControllerRef = useRef<AbortController | null>(null)
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
    if (!isOpen || (!menuId && !isCreateMode)) {
      setLoading(true)
      setProgress(0)
      setVisibleDates(0)
      setMenu(null)
      setMenuData({})
      setOriginalMenuData({})
      setOgMenuData({})  // FIXED: Reset OG data on close
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

        let menuDoc: MenuData

        if (isCreateMode && createStartDate && createEndDate) {
          // CREATE MODE: Generate empty menu document (no Firestore load)
          menuDoc = {
            startDate: createStartDate,
            endDate: createEndDate,
            status: "draft",
            menuData: {},
          } as MenuData
        } else {
          // EDIT MODE: Load from Firestore
          const collectionName = menuType === "combined" ? "combinedMenus" : "companyMenus"
          const docRef = doc(db, collectionName, menuId)
          const docSnap = await getDoc(docRef)

          if (signal.aborted || !mountedRef.current) return

          if (!docSnap.exists()) {
            throw new Error("Menu not found")
          }

          menuDoc = { id: docSnap.id, ...(docSnap.data() as any) } as MenuData
        }

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
        setAllStructureAssignments(structureData)

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
        // Don't filter menu items by status - use all items so confirmation modal can display items in cells
        let filteredMenuItems = menuItemsData.sort((a, b) => (a.order || 999) - (b.order || 999))

        setProgress(90)
        setMessage("Finalizing...")

        const originalData = menuDoc.menuData || {}

        // --- AUTO-FILL DEFAULT ITEMS FOR EMPTY CELLS ---
        const defaultItemsMap = new Map<string, string[]>()
        filteredSubMealPlans.forEach(smp => {
          if (smp.defaultItemId) {
            // Handle both multi-item arrays and single string IDs safely
            if (Array.isArray(smp.defaultItemId) && smp.defaultItemId.length > 0) {
              defaultItemsMap.set(smp.id, smp.defaultItemId)
            } else if (typeof smp.defaultItemId === 'string' && smp.defaultItemId.trim() !== '') {
              defaultItemsMap.set(smp.id, [smp.defaultItemId])
            }
          }
        })

        if (defaultItemsMap.size > 0 && mealPlanStructureData) {
          dates.forEach(({ date, day }) => {
            const dayKey = day.toLowerCase()
            mealPlanStructureData.forEach((assignment: any) => {
              if (assignment.status !== 'active') return;
              
              // For company menus, strictly only apply to their own assignments
              if (menuType === 'company' && menuDoc.companyId && menuDoc.buildingId) {
                if (assignment.companyId !== menuDoc.companyId || assignment.buildingId !== menuDoc.buildingId) {
                  return;
                }
              }
              
              const dayStructure = assignment.weekStructure?.[dayKey] || []
              dayStructure.forEach((s: any) => {
                s.subServices?.forEach((ss: any) => {
                  ss.mealPlans?.forEach((mp: any) => {
                    mp.subMealPlans?.forEach((smp: any) => {
                      const defaultItems = defaultItemsMap.get(smp.subMealPlanId)
                      if (defaultItems) {
                        // Ensure nested object paths exist to prevent crashes
                        if (!originalData[date]) originalData[date] = {}
                        if (!originalData[date][s.serviceId]) originalData[date][s.serviceId] = {}
                        if (!originalData[date][s.serviceId][ss.subServiceId]) originalData[date][s.serviceId][ss.subServiceId] = {}
                        if (!originalData[date][s.serviceId][ss.subServiceId][mp.mealPlanId]) originalData[date][s.serviceId][ss.subServiceId][mp.mealPlanId] = {}

                        const cell = originalData[date][s.serviceId][ss.subServiceId][mp.mealPlanId][smp.subMealPlanId]

                        // If cell is completely empty or missing, inject the default items!
                        if (!cell || !cell.menuItemIds || cell.menuItemIds.length === 0) {
                          originalData[date][s.serviceId][ss.subServiceId][mp.mealPlanId][smp.subMealPlanId] = {
                            ...(cell || {}),
                            menuItemIds: [...defaultItems]
                          }
                        }
                      }
                    })
                  })
                })
              })
            })
          })
        }
        // --- END AUTO-FILL ---

        // Ensure menuItems includes any IDs referenced in menuData even when preloadedMenuItems is stale.
        // This fixes cases where a newly created menu-item is saved into a cell, but vanishes on reopen
        // until a full page reload refreshes the preloaded list.
        const collectMenuItemIdsFromMenuData = (data: any): string[] => {
          const ids = new Set<string>()
          if (!data || typeof data !== "object") return []

          for (const dateKey of Object.keys(data)) {
            const dayMenu = (data as any)[dateKey]
            if (!dayMenu || typeof dayMenu !== "object") continue

            for (const serviceId of Object.keys(dayMenu)) {
              const serviceObj = dayMenu[serviceId]
              if (!serviceObj || typeof serviceObj !== "object") continue

              for (const subServiceId of Object.keys(serviceObj)) {
                const subServiceObj = serviceObj[subServiceId]
                if (!subServiceObj || typeof subServiceObj !== "object") continue

                for (const mealPlanId of Object.keys(subServiceObj)) {
                  const mealPlanObj = subServiceObj[mealPlanId]
                  if (!mealPlanObj || typeof mealPlanObj !== "object") continue

                  for (const subMealPlanId of Object.keys(mealPlanObj)) {
                    const cell = mealPlanObj[subMealPlanId]
                    const cellItemIds = cell?.menuItemIds
                    if (Array.isArray(cellItemIds)) {
                      for (const id of cellItemIds) {
                        if (typeof id === "string" && id.trim() !== "") ids.add(id)
                      }
                    }
                  }
                }
              }
            }
          }

          return Array.from(ids)
        }

        const referencedItemIds = collectMenuItemIdsFromMenuData(originalData)
        if (referencedItemIds.length > 0) {
          const existingIds = new Set(filteredMenuItems.map((i) => i.id))
          const missingIds = referencedItemIds.filter((id) => !existingIds.has(id))

          if (missingIds.length > 0) {
            const fetched = await Promise.all(
              missingIds.map(async (id) => {
                try {
                  const snap = await getDoc(doc(db, "menuItems", id))
                  if (!snap.exists()) return null
                  return ({ id: snap.id, ...(snap.data() as any) } as MenuItem)
                } catch {
                  return null
                }
              }),
            )

            const missingItems = fetched.filter(Boolean) as MenuItem[]
            if (missingItems.length > 0) {
              const dedupedToAdd = missingItems.filter((i) => !existingIds.has(i.id))
              if (dedupedToAdd.length > 0) {
                filteredMenuItems = [...filteredMenuItems, ...dedupedToAdd].sort((a, b) => (a.order || 999) - (b.order || 999))
              }
            }
          }
        }

        setOriginalMenuData(JSON.parse(JSON.stringify(originalData)))
        

        // FIXED: Reconstruct the TRUE original (OG) baseline by reversing all updations
        // OG is the state BEFORE any U-records were created
        let ogData = JSON.parse(JSON.stringify(originalData))

        // In CREATE mode, skip OG reconstruction and updation loading since there's no existing data
        if (isCreateMode) {
          setOgMenuData({})
          setMenu(menuDoc)
          setMenuData({})
          setDateRange(dates)
          setServices(filteredServices)
          setSubServices(subServicesMap)
          setMealPlans(filteredMealPlans)
          setSubMealPlans(filteredSubMealPlans)
          setMenuItems(filteredMenuItems)

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
          return
        }

        // Load updations FIRST to reconstruct original
        try {
          const q = query(collection(db, "updations"), where("menuId", "in", [menuId, menuDoc.combinedMenuId || ""].filter(Boolean)))
          const snapshot = await getDocs(q)
          const updationsData = snapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data(),
              createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt),
            }))
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

          if (updationsData.length > 0) {
            // FIXED: If updations exist, reconstruct OG by reversing changes from the oldest updation
            // For each change in the first updation, reverse it to get back to OG state
            const firstUpdation = updationsData[0]
            ogData = JSON.parse(JSON.stringify(originalData))

            // Process ALL updations to reconstruct original state
            for (const upd of updationsData) {
              if (upd.changedCells && Array.isArray(upd.changedCells)) {
                for (const cell of upd.changedCells) {
                  const { date, serviceId, subServiceId, mealPlanId, subMealPlanId, changes } = cell

                  // Initialize the cell if it doesn't exist
                  if (!ogData[date]) ogData[date] = {}
                  if (!ogData[date][serviceId]) ogData[date][serviceId] = {}
                  if (!ogData[date][serviceId][subServiceId]) ogData[date][serviceId][subServiceId] = {}
                  if (!ogData[date][serviceId][subServiceId][mealPlanId]) ogData[date][serviceId][subServiceId][mealPlanId] = {}
                  if (!ogData[date][serviceId][subServiceId][mealPlanId][subMealPlanId]) {
                    ogData[date][serviceId][subServiceId][mealPlanId][subMealPlanId] = { menuItemIds: [] }
                  }

                  // Reverse each change to get back to OG
                  if (changes && Array.isArray(changes)) {
                    for (const change of changes) {
                      if (change.action === "added") {
                        // If it was added, remove it from OG
                        ogData[date][serviceId][subServiceId][mealPlanId][subMealPlanId].menuItemIds =
                          ogData[date][serviceId][subServiceId][mealPlanId][subMealPlanId].menuItemIds.filter((id: string) => id !== change.itemId)
                      } else if (change.action === "removed") {
                        // If it was removed, add it back to OG
                        const ids = ogData[date][serviceId][subServiceId][mealPlanId][subMealPlanId].menuItemIds
                        if (!ids.includes(change.itemId)) {
                          ids.push(change.itemId)
                        }
                      } else if (change.action === "replaced") {
                        // If it was replaced, restore the old item
                        const ids = ogData[date][serviceId][subServiceId][mealPlanId][subMealPlanId].menuItemIds
                        if (change.replacedWith) {
                          const idx = ids.indexOf(change.replacedWith)
                          if (idx !== -1) ids.splice(idx, 1)
                        }
                        if (change.itemId && !ids.includes(change.itemId)) {
                          ids.push(change.itemId)
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error("Error reconstructing OG state:", e)
          // If error, use current state as OG
          ogData = JSON.parse(JSON.stringify(originalData))
        }

        setOgMenuData(ogData)

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

            // --- VALIDATE logs against actual cell data ---
            // Remove stale logs where the item no longer exists in the cell
            const menuCellData = originalData // This is the actual saved menu data
            const staleLogIds: string[] = []
            const validLogs = enrichedLogs.filter((log: any) => {
              const itemId = log.itemId
              if (!itemId) return false

              // Check if the item exists in the ATTEMPTED cell
              const attemptedCell = menuCellData[log.attemptedDate]
                ?.[log.serviceId]?.[log.subServiceId]
                ?.[log.mealPlanId]?.[log.subMealPlanId]
              const inAttemptedCell = attemptedCell?.menuItemIds?.includes(itemId)

              // Log is valid only if the item still exists in the attempted cell
              const isValid = !!inAttemptedCell
              if (!isValid && log.id) {
                staleLogIds.push(log.id)
              }
              return isValid
            })

            // Clean up stale logs from Firestore in background
            if (staleLogIds.length > 0) {
              repetitionLogsService.deleteAll(staleLogIds).catch((e: any) =>
                console.error("Error cleaning stale logs", e)
              )
            }

            setRepetitionLog(validLogs)
            validLogs.forEach((entry: any) => {
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

        // Updations have been loaded for OG reconstruction above
        // Now set them with proper updation numbers for display
        try {
          const q = query(collection(db, "updations"), where("menuId", "in", [menuId, menuDoc.combinedMenuId || ""].filter(Boolean)))
          const snapshot = await getDocs(q)
          const updationsData = snapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data(),
              createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt),
            }))
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
            .map((upd, idx) => ({
              ...upd,
              // FIXED: Use updationNumber from DB if available (for global continuous counting), otherwise use idx + 1
              updationNumber: upd.updationNumber || (idx + 1),
            }))
          setUpdations(updationsData)
        } catch (e) {
          console.error("Error loading updations:", e)
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
  }, [isOpen, menuId, menuType, onClose, preloadedMenuItems, loadPrevWeekMap, isCreateMode, createStartDate, createEndDate])

  // --- Eagerly load companies with choices for the Choices tab ---
  useEffect(() => {
    if (!loading && isOpen && buildings.length > 0) {
      (async () => {
        try {
          const data = await detectCompaniesWithChoices()
          if (mountedRef.current && data.length > 0) {
            setCompaniesWithChoices(data)
            // Also load initial selections from existing saved choices
            let currentSelections: Record<string, any[]> = {}
            if (menuType === 'company' && menuData) {
              data.forEach(companyChoice => {
                for (const choice of companyChoice.choices) {
                  const choiceKey = `${companyChoice.companyId}-${companyChoice.buildingId}-${choice.choiceId}`
                  const selectedItems: any[] = []
                  for (const date in menuData) {
                    const dateData = menuData[date]
                    const serviceId = (choice as any).serviceId || ''
                    const subServiceId = (choice as any).subServiceId || ''
                    if (dateData?.[serviceId]?.[subServiceId]) {
                      for (const mp of choice.mealPlans) {
                        for (const smp of mp.subMealPlans) {
                          const cell = dateData[serviceId][subServiceId][mp.mealPlanId]?.[smp.subMealPlanId]
                          if (cell?.menuItemIds && cell.menuItemIds.length > 0) {
                            for (const itemId of cell.menuItemIds) {
                              const itemChoice = cell.itemChoiceMarks?.[itemId]
                              if (itemChoice === choice.choiceId) {
                                const item = menuItems.find(m => m.id === itemId)
                                if (item) {
                                  selectedItems.push({
                                    mealPlanId: mp.mealPlanId,
                                    mealPlanName: mp.mealPlanName || '',
                                    subMealPlanId: smp.subMealPlanId,
                                    subMealPlanName: smp.subMealPlanName || '',
                                    selectedItemId: itemId,
                                    selectedItemName: item.name
                                  })
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                  if (selectedItems.length > 0) {
                    currentSelections[choiceKey] = selectedItems
                  }
                }
              })
            } else if (menuType === 'combined' && menu && (menu as any).savedChoices) {
              currentSelections = (menu as any).savedChoices
            }
            setInitialChoiceSelections(currentSelections)
            setInlineChoiceSelections(currentSelections)
          }
        } catch (e) {
          console.error("Error eagerly loading choices:", e)
        }
      })()
    }
  }, [loading, isOpen, buildings.length])

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
    } catch (e) { console.error(e) }
  }, [repetitionLog, menuType])

  const clearRepetitionLog = useCallback(async () => {
    try {
      const ids = repetitionLog.map(l => l.id)
      if (ids.length > 0 && (menuType === "company" || menuType === "combined")) {
        await repetitionLogsService.deleteAll(ids)
      }
      setRepetitionLog([])
      repetitionLogKeysRef.current.clear()
    } catch (e) { console.error(e) }
  }, [repetitionLog, menuType])

  const handleAnalyzeConflicts = useCallback((cellLogs: any[], currentContext: any) => {
    const validLogs = cellLogs.filter(l => {
      const item = menuItems.find(i => i.id === l.itemId);
      return item?.name && item.name.trim().length > 0;
    });

    if (validLogs.length === 0) {
      setConflictAnalysisData([]);
      return;
    }

    const conflictItemIds = Array.from(new Set(validLogs.map(l => l.itemId)));

    const analysis = conflictItemIds.map(itemId => {
      const item = menuItems.find(i => i.id === itemId);
      if (!item) return null;

      const occurrences: any[] = [];

      // 1. ADD PREVIOUS WEEK OCCURRENCES FROM LOGS
      const prevWeekEntries = repetitionLog.filter(l =>
        l.itemId === itemId &&
        l.type === "Prev-week repeat" &&
        l.serviceId === currentContext.serviceId &&
        l.subServiceId === currentContext.subServiceId
      );

      prevWeekEntries.forEach(pwl => {
        occurrences.push({
          date: pwl.prevDate,
          day: new Date(pwl.prevDate).toLocaleDateString('en-US', { weekday: 'long' }),
          serviceName: pwl.serviceName,
          subServiceName: pwl.subServiceName,
          mealPlanName: pwl.mealPlanName,
          subMealPlanName: pwl.subMealPlanName,
          isPrevWeek: true, // Label it as previous week
          isCurrentCell: false
        });
      });

      // 2. ADD CURRENT WEEK OCCURRENCES (Existing scanning logic)
      dateRange.forEach(({ date, day }) => {
        const dayData = menuData[date];
        if (!dayData) return;
        const cell = dayData[currentContext.serviceId]?.[currentContext.subServiceId]?.[currentContext.mealPlanId]?.[currentContext.subMealPlanId];

        if (cell?.menuItemIds?.includes(itemId)) {
          occurrences.push({
            date,
            day,
            serviceName: services.find(s => s.id === currentContext.serviceId)?.name,
            subServiceName: subServices.get(currentContext.serviceId)?.find(ss => ss.id === currentContext.subServiceId)?.name,
            mealPlanName: mealPlans.find(m => m.id === currentContext.mealPlanId)?.name,
            subMealPlanName: subMealPlans.find(s => s.id === currentContext.subMealPlanId)?.name,
            isPrevWeek: false,
            isCurrentCell: date === currentContext.date
          });
        }
      });

      return {
        itemId,
        itemName: item.name,
        totalCount: occurrences.length,
        occurrences: occurrences.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      };
    }).filter(Boolean);

    setConflictAnalysisData(analysis);
    setConflictDrawerOpen(true);
  }, [menuData, dateRange, menuItems, services, subServices, repetitionLog]);


  const handleAddItem = useCallback(
    (date: string, serviceId: string, mealPlanId: string, subMealPlanId: string, itemId: string) => {

      const subServiceId = selectedSubService?.id
      if (!subServiceId) return

      const itemObj = menuItems.find(m => m.id === itemId);
      const itemName = itemObj?.name || "";
      const isValidItem = itemName && itemName.trim().length > 0;

      const serviceName = services.find(s => s.id === serviceId)?.name || "Service"
      const subServiceName = subServices.get(serviceId)?.find(ss => ss.id === subServiceId)?.name || "SubService"
      const currentSubMealPlan = subMealPlans.find(smp => smp.id === subMealPlanId)
      const isRepeatAllowed = currentSubMealPlan?.isRepeatPlan || false

      // --- 1. UPDATION LOGIC: Build the Live Session Trail ---
      const cellKey = `${date}|${serviceId}|${mealPlanId}|${subMealPlanId}`;
      setLiveChanges(prev => {
        const history = prev[cellKey] || [];
        const lastAction = history.length > 0 ? history[history.length - 1] : null;

        // IF the very last thing you did was "remove", this new add becomes a "replace"
        if (lastAction && lastAction.action === "removed") {
          const historyWithoutLastRemove = history.slice(0, -1); // Remove the old 'removed' log

          return {
            ...prev,
            [cellKey]: [
              ...historyWithoutLastRemove,
              {
                action: "replaced",
                itemId: itemId,
                oldItemId: lastAction.itemId,
                itemName: `${lastAction.itemName} ��� ${itemName}`, // Formats as: Old -> New
                time: Date.now()
              }
            ]
          };
        }

        // OTHERWISE, it is a normal "add"
        return {
          ...prev,
          [cellKey]: [...history, { action: "added", itemId, itemName, time: Date.now() }]
        };
      });

      // --- 2. REPETITION LOGIC: Rule: Check different date in same path ---
      const conflictingDateObj = isValidItem ? dateRange.find(d => {
        if (d.date === date) return false;
        const cell = menuData[d.date]?.[serviceId]?.[subServiceId]?.[mealPlanId]?.[subMealPlanId]
        return cell?.menuItemIds?.includes(itemId)
      }) : null;

      if (conflictingDateObj && !isRepeatAllowed) {
        const conflictDateFormatted = new Date(conflictingDateObj.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

        addRepetitionLog({
          type: "In-week duplicate",
          itemId,
          itemName,
          serviceId,
          serviceName,
          subServiceId,
          subServiceName,
          mealPlanId,
          subMealPlanId,
          attemptedDate: date,
          details: `Found on ${conflictDateFormatted}`
        })
      }

      const prevHas = isValidItem ? prevWeekMap[date]?.[serviceId]?.[subServiceId]?.[mealPlanId]?.[subMealPlanId]?.includes(itemId) : false;

      if (prevHas && !conflictingDateObj && !isRepeatAllowed) {
        const d = new Date(date); d.setDate(d.getDate() - 7)
        const prevDate = d.toISOString().split("T")[0]
        addRepetitionLog({
          type: "Prev-week repeat",
          itemId, itemName, serviceId, serviceName, subServiceId, subServiceName, mealPlanId, subMealPlanId, prevDate, attemptedDate: date
        })
      }

      // --- 3. DATA LOGIC: Update MenuData State ---
      setMenuData((prev: any) => {
        const updated = JSON.parse(JSON.stringify(prev))
        // Ensure path exists
        if (!updated[date]) updated[date] = {}
        if (!updated[date][serviceId]) updated[date][serviceId] = {}
        if (!updated[date][serviceId][subServiceId]) updated[date][serviceId][subServiceId] = {}
        if (!updated[date][serviceId][subServiceId][mealPlanId]) updated[date][serviceId][subServiceId][mealPlanId] = {}

        if (!updated[date][serviceId][subServiceId][mealPlanId][subMealPlanId]) {
          updated[date][serviceId][subServiceId][mealPlanId][subMealPlanId] = { menuItemIds: [], customAssignments: {} }
        } else {
          if (!updated[date][serviceId][subServiceId][mealPlanId][subMealPlanId].customAssignments) {
            updated[date][serviceId][subServiceId][mealPlanId][subMealPlanId].customAssignments = {}
          }
        }

        const cell = updated[date][serviceId][subServiceId][mealPlanId][subMealPlanId]
        if (!cell.menuItemIds.includes(itemId)) {
          cell.menuItemIds.push(itemId)
        }
        return updated
      })
    },
    [selectedSubService, menuData, dateRange, prevWeekMap, services, subServices, subMealPlans, menuItems, addRepetitionLog]
  )

  const handleRemoveItem = useCallback(
    async (date: string, serviceId: string, mealPlanId: string, subMealPlanId: string, itemId: string) => {
      if (!selectedSubService) return;
      const currentSubServiceId = selectedSubService.id;

      // --- 1. UPDATION LOGIC: Build the Live Session Trail ---
      const itemObj = menuItems.find(m => m.id === itemId);
      const itemName = itemObj?.name || "Unknown Item";
      const cellKey = `${date}|${serviceId}|${mealPlanId}|${subMealPlanId}`;

      // Capture the companies the item is assigned to at the moment of removal
      const cell = menuData[date]?.[serviceId]?.[currentSubServiceId]?.[mealPlanId]?.[subMealPlanId];
      const removedCompanies = cell?.customAssignments?.[itemId] || [];

      setLiveChanges(prev => {
        const history = prev[cellKey] || [];
        return {
          ...prev,
          [cellKey]: [...history, {
            action: "removed",
            itemId,
            itemName,
            time: Date.now(),
            removedCompanies: removedCompanies // Store which companies it was removed from
          }]
        };
      });
      // --- 2. DATA LOGIC: Update the Menu Data (Visual Removal) ---
      setMenuData((prev: any) => {
        const updated = JSON.parse(JSON.stringify(prev))
        const cell = updated[date]?.[serviceId]?.[currentSubServiceId]?.[mealPlanId]?.[subMealPlanId]
        const items = cell?.menuItemIds
        if (items) {
          const idx = items.indexOf(itemId)
          if (idx > -1) items.splice(idx, 1)
        }
        // Preserve customAssignments logic
        if (cell?.customAssignments && cell.customAssignments[itemId]) {
          delete cell.customAssignments[itemId]
        }
        return updated
      })

      // --- 3. INTELLIGENT LOG CLEANUP ---

      // Count how many times this item currently exists in the ENTIRE week for this specific path
      let totalCountInWeek = 0;

      dateRange.forEach((d) => {
        const cellItems = menuData[d.date]?.[serviceId]?.[currentSubServiceId]?.[mealPlanId]?.[subMealPlanId]?.menuItemIds || [];
        if (cellItems.includes(itemId)) {
          totalCountInWeek++;
        }
      });

      // We are about to remove 1, so the new count will be (totalCountInWeek - 1).
      const remainingCount = totalCountInWeek - 1;

      // Identify logs that need to be removed
      let logsIDsToDelete: string[] = [];
      let logsKeysToDelete: string[] = [];

      // A. Always remove the log for the cell we are clicking (The one being deleted)
      const specificCellLogs = repetitionLog.filter(l =>
        l.itemId === itemId &&
        l.attemptedDate === date &&
        l.serviceId === serviceId &&
        l.subServiceId === currentSubServiceId &&
        l.mealPlanId === mealPlanId &&
        l.subMealPlanId === subMealPlanId
      );

      specificCellLogs.forEach(l => {
        logsIDsToDelete.push(l.id);
        logsKeysToDelete.push(JSON.stringify({
          type: l.type,
          itemId: l.itemId,
          attemptedDate: l.attemptedDate,
          serviceId: l.serviceId,
          subServiceId: l.subServiceId,
          mealPlanId: l.mealPlanId,
          subMealPlanId: l.subMealPlanId
        }));
      });

      // B. ORPHAN CHECK: If remaining count is <= 1, it means the item is now Unique (or gone).
      if (remainingCount <= 1) {
        const allRelatedLogs = repetitionLog.filter(l =>
          l.itemId === itemId &&
          l.serviceId === serviceId &&
          l.subServiceId === currentSubServiceId &&
          l.mealPlanId === mealPlanId &&
          l.subMealPlanId === subMealPlanId
        );

        allRelatedLogs.forEach(l => {
          if (!logsIDsToDelete.includes(l.id)) {
            logsIDsToDelete.push(l.id);
            logsKeysToDelete.push(JSON.stringify({
              type: l.type,
              itemId: l.itemId,
              attemptedDate: l.attemptedDate,
              serviceId: l.serviceId,
              subServiceId: l.subServiceId,
              mealPlanId: l.mealPlanId,
              subMealPlanId: l.subMealPlanId
            }));
          }
        });
      }

      // --- 4. EXECUTE DELETION (State & Database) ---
      if (logsIDsToDelete.length > 0) {
        // Clear from Ref
        logsKeysToDelete.forEach(key => repetitionLogKeysRef.current.delete(key));

        // Clear from State
        setRepetitionLog(prev => prev.filter(l => !logsIDsToDelete.includes(l.id)));

        // Clear from DB
        if (menuType === "company" || menuType === "combined") {
          await repetitionLogsService.deleteAll(logsIDsToDelete)
        }
      }
    },
    [selectedSubService, repetitionLog, menuType, menuData, dateRange, menuItems]
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
    if (!items.length) { toast({ title: "Empty", description: "No items to copy", variant: "destructive" }); return; }
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
    if (!items.length) return
    dragItemsRef.current = [...items]
    setDragActive(true)
  }, [])

  const applyDragToCell = useCallback((date: string, mealPlanId: string, subMealPlanId: string) => {
    if (!dragActive || !dragItemsRef.current.length || !selectedService || !selectedSubService) return;
    dragItemsRef.current.forEach(itemId => {
      handleAddItem(date, selectedService.id, mealPlanId, subMealPlanId, itemId)
    })
  }, [dragActive, selectedService, selectedSubService, handleAddItem])

  // NEW: Handler to properly update menuData state with custom assignments
  // NEW: Track company-wise assignment changes with company names from combined menu edit
  const handleUpdateCustomAssignments = useCallback(
    (
      date: string,
      serviceId: string,
      subServiceId: string,
      mealPlanId: string,
      subMealPlanId: string,
      assignments: MenuCell['customAssignments']
    ) => {
      setMenuData((prev: any) => {
        const updated = JSON.parse(JSON.stringify(prev))

        // Ensure the path exists
        if (!updated[date]) updated[date] = {}
        if (!updated[date][serviceId]) updated[date][serviceId] = {}
        if (!updated[date][serviceId][subServiceId])
          updated[date][serviceId][subServiceId] = {}
        if (!updated[date][serviceId][subServiceId][mealPlanId])
          updated[date][serviceId][subServiceId][mealPlanId] = {}
        if (!updated[date][serviceId][subServiceId][mealPlanId][subMealPlanId])
          updated[date][serviceId][subServiceId][mealPlanId][subMealPlanId] = {
            menuItemIds: [],
          }

        // Set the custom assignments on the cell
        if (assignments && Object.keys(assignments).length > 0) {
          updated[date][serviceId][subServiceId][mealPlanId][
            subMealPlanId
          ].customAssignments = assignments
        } else {
          // If no custom assignments, remove the key entirely
          delete updated[date][serviceId][subServiceId][mealPlanId][
            subMealPlanId
          ].customAssignments
        }

        return updated
      })
    },
    []
  )

  // --- Company Menu Generation Logic ---
  const generateCompanyMenus = async (combinedMenuId: string, filteredMenuData: any) => {
    try {
      const q = query(collection(db, 'companyMenus'), where('combinedMenuId', '==', combinedMenuId));
      const querySnapshot = await getDocs(q);
      const existingCompanyMenus = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      const activeCompanies = companies.filter((c: any) => c.status === "active")
      let count = 0;

      for (const company of activeCompanies) {
        const companyBuildings = buildings.filter((b: any) => b.companyId === company.id && b.status === "active")

        for (const building of companyBuildings) {
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

            const existing = existingCompanyMenus.find((m: any) => m.companyId === company.id && m.buildingId === building.id);

            if (existing) {
              await companyMenusService.update(existing.id, { ...companyMenuData, combinedMenuId, status: "active" });
            } else {
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

  // FIXED: buildCompanyMenu now respects customAssignments when filtering items per company
  // --- FIXED: ITERATE DATA TO CAPTURE CUSTOM ASSIGNMENTS OUTSIDE STRUCTURE ---
  const buildCompanyMenu = (
    company: any,
    building: any,
    structureAssignment: any,
    mealPlanStructureData: any,
    combinedMenu: any,
    dateRange: Array<{ date: string; day: string }>,
  ) => {
    const companyMenuData: any = {}

    // Helper: Check if a path exists in the company's default structure
    const isInDefaultStructure = (date: string, sId: string, ssId: string, mpId: string, smpId: string) => {
      const dayName = dateRange.find(d => d.date === date)?.day.toLowerCase();
      if (!dayName) return false;

      // Check Meal Plan Structure
      const dayStruct = mealPlanStructureData.weekStructure?.[dayName] || [];
      const sNode = dayStruct.find((s: any) => s.serviceId === sId);
      const ssNode = sNode?.subServices?.find((ss: any) => ss.subServiceId === ssId);
      const mpNode = ssNode?.mealPlans?.find((mp: any) => mp.mealPlanId === mpId);
      const smpNode = mpNode?.subMealPlans?.find((smp: any) => smp.subMealPlanId === smpId);

      // Also check Service Structure to be safe (though usually mirrored)
      const sStruct = structureAssignment.weekStructure?.[dayName] || [];
      const sActive = sStruct.find((s: any) => s.serviceId === sId)?.subServices?.some((ss: any) => ss.subServiceId === ssId);

      return !!smpNode && !!sActive;
    };

    // Iterate over the COMBINED DATA to find assignments
    Object.keys(combinedMenu).forEach(date => {
      if (!companyMenuData[date]) companyMenuData[date] = {};

      Object.keys(combinedMenu[date]).forEach(sId => {
        if (!companyMenuData[date][sId]) companyMenuData[date][sId] = {};

        Object.keys(combinedMenu[date][sId]).forEach(ssId => {
          if (!companyMenuData[date][sId][ssId]) companyMenuData[date][sId][ssId] = {};

          Object.keys(combinedMenu[date][sId][ssId]).forEach(mpId => {
            if (!companyMenuData[date][sId][ssId][mpId]) companyMenuData[date][sId][ssId][mpId] = {};

            Object.keys(combinedMenu[date][sId][ssId][mpId]).forEach(smpId => {
              const sourceCell = combinedMenu[date][sId][ssId][mpId][smpId];

              if (sourceCell && sourceCell.menuItemIds && sourceCell.menuItemIds.length > 0) {
                const customAssignments = sourceCell.customAssignments || {};
                const isDefaultPath = isInDefaultStructure(date, sId, ssId, mpId, smpId);

                // Check if this cell has choice metadata for this company/building
                const choiceMeta = sourceCell.choiceMetadata || {};
                const cbChoiceKey = `${company.id}-${building.id}`;
                const cellHasChoiceForThisCompany = !!choiceMeta[cbChoiceKey];

                // Filter items for this company
                const itemsForThisCompany = sourceCell.menuItemIds.filter((itemId: string) => {
                  const itemCustom = customAssignments[itemId];

                  // CRITICAL: If this cell has a choice for this company, ONLY include items
                  // that have an explicit custom assignment with isFromChoice: true
                  if (cellHasChoiceForThisCompany) {
                    // Choice-governed: Only include if this company has explicit custom assignment with isFromChoice
                    return itemCustom && Array.isArray(itemCustom) && 
                           itemCustom.some((a: any) => 
                             a.companyId === company.id && 
                             a.buildingId === building.id &&
                             a.isFromChoice === true
                           );
                  }

                  // No choice governs this cell, use standard logic
                  
                  // Filter out 'isFromChoice' assignments to see if it's TRULY an exclusive item
                  const strictAssignments = (itemCustom || []).filter((a: any) => !a.isFromChoice);

                  if (strictAssignments.length > 0) {
                    // 1. Explicit Custom Assignment: Check if company matches
                    return strictAssignments.some((a: any) => a.companyId === company.id && a.buildingId === building.id);
                  } else {
                    // 2. No Custom Assignment: Include only if in Default Structure
                    return isDefaultPath;
                  }
                });

                if (itemsForThisCompany.length > 0) {
                  companyMenuData[date][sId][ssId][mpId][smpId] = {
                    menuItemIds: itemsForThisCompany,
                    selectedDescriptions: sourceCell.selectedDescriptions || {},
                  };
                  // CRITICAL: Preserve choiceMetadata so company menu knows it's from a choice
                  if (cellHasChoiceForThisCompany && choiceMeta) {
                    companyMenuData[date][sId][ssId][mpId][smpId].choiceMetadata = choiceMeta;
                  }
                  // CRITICAL: Carry over isFromChoice and itemChoiceMarks from the combined menu
                  // so the company menu UI can display the "From Choice" badge
                  if (cellHasChoiceForThisCompany || sourceCell.isFromChoice) {
                    companyMenuData[date][sId][ssId][mpId][smpId].isFromChoice = true;
                    // Build itemChoiceMarks for only the items that made it into this company's menu
                    const marks: Record<string, any> = {};
                    itemsForThisCompany.forEach((itemId: string) => {
                      if (sourceCell.itemChoiceMarks && sourceCell.itemChoiceMarks[itemId]) {
                        marks[itemId] = sourceCell.itemChoiceMarks[itemId];
                      } else if (cellHasChoiceForThisCompany) {
                        // If no specific mark exists but the cell is choice-governed, mark as true
                        marks[itemId] = true;
                      }
                    });
                    if (Object.keys(marks).length > 0) {
                      companyMenuData[date][sId][ssId][mpId][smpId].itemChoiceMarks = marks;
                    }
                  }
                }
              }
            });
          });
        });
      });
    });

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
  // Get companies that have modified a specific cell in the combined menu
  const getCompaniesModifyingCell = (
    date: string,
    serviceId: string,
    subServiceId: string,
    mealPlanId: string,
    subMealPlanId: string
  ): Array<{ companyId: string; companyName: string }> => {
    const modifyingCompanies = new Set<string>()
    const companyMap = new Map<string, string>()

    updations.forEach((upd: UpdationRecord) => {
      if (upd.isCompanyWiseChange && upd.sourcedFromCompanyId && upd.sourcedFromCompanyName) {
        const changesThisCell = upd.changedCells?.some(
          (cell: any) =>
            cell.date === date &&
            cell.serviceId === serviceId &&
            cell.subServiceId === subServiceId &&
            cell.mealPlanId === mealPlanId &&
            cell.subMealPlanId === subMealPlanId
        )

        if (changesThisCell) {
          modifyingCompanies.add(upd.sourcedFromCompanyId)
          companyMap.set(upd.sourcedFromCompanyId, upd.sourcedFromCompanyName)
        }
      }
    })

    return Array.from(modifyingCompanies).map(companyId => ({
      companyId,
      companyName: companyMap.get(companyId) || companyId
    }))
  }


  const checkForConfirmationNeeded = (): boolean => {
    // Check if selected subservice has showConfirmation = true and has at least one menu item
    if (!selectedSubService) {
      return false
    }

    const showConfirmation = (selectedSubService as any).showConfirmation === true

    if (!showConfirmation) {
      return false
    }

    // Check if any items exist for this subservice
    let hasItems = false

    for (const [date, dayData] of Object.entries(menuData)) {
      for (const [sId, sData] of Object.entries(dayData as any)) {
        if (sData && typeof sData === 'object') {
          for (const [ssId, ssData] of Object.entries(sData)) {
            if (ssId === selectedSubService.id && ssData && typeof ssData === 'object') {
              for (const [mpId, mpData] of Object.entries(ssData)) {
                if (mpData && typeof mpData === 'object') {
                  for (const [smpId, cell] of Object.entries(mpData)) {
                    if (cell && typeof cell === 'object' && (cell as any).menuItemIds?.length > 0) {
                      hasItems = true
                      break
                    }
                  }
                }
              }
            }
          }
        }
      }
      if (hasItems) break
    }

    return showConfirmation && hasItems
  }

  const detectCompaniesWithChoices = async (): Promise<CompanyChoice[]> => {
    try {
      const companiesWithChoicesData: CompanyChoice[] = []
      const processedChoices = new Set<string>()
      const buildingsMap = new Map(buildings.map((b) => [b.id, b]))

      let q: any
      if (menuType === 'company' && menu?.companyId && menu?.buildingId) {
        q = query(
          collection(db, 'mealPlanStructureAssignments'),
          where('companyId', '==', menu.companyId),
          where('buildingId', '==', menu.buildingId)
        )
      } else if (menuType === 'combined') {
        q = collection(db, 'mealPlanStructureAssignments')
      } else {
        return []
      }

      const structures = await getDocs(q)

      for (const structureDoc of structures.docs) {
        const structure = structureDoc.data() as any
        const weekStructure = structure.weekStructure || {}

        for (const [day, services] of Object.entries(weekStructure)) {
          if (!Array.isArray(services)) continue

          for (const service of services as any[]) {
            if (!service.subServices || !Array.isArray(service.subServices)) continue

            for (const subService of service.subServices) {
              if (!subService.choices || typeof subService.choices !== 'object') continue

              for (const [choiceDay, choicesArray] of Object.entries(subService.choices)) {
                if (!Array.isArray(choicesArray) || choicesArray.length === 0) continue

                for (const choice of choicesArray) {
                  // --- THIS IS THE FIX ---
                  // The key MUST include the buildingId to be unique
                  const choiceKey = `${structure.companyId}-${structure.buildingId}-${choice.choiceId}`
                  if (processedChoices.has(choiceKey)) continue
                  processedChoices.add(choiceKey)

                  const existing = companiesWithChoicesData.find(
                    (c) => c.companyId === structure.companyId && c.buildingId === structure.buildingId
                  )

                  const choiceWithDay = { ...choice, choiceDay, serviceId: service.serviceId, subServiceId: subService.subServiceId } as MealPlanChoice

                  if (!existing) {
                    companiesWithChoicesData.push({
                      companyId: structure.companyId,
                      companyName: structure.companyName,
                      buildingId: structure.buildingId,
                      buildingName: structure.buildingName,
                      choices: [choiceWithDay],
                    })
                  } else {
                    if (!existing.choices.find((c) => c.choiceId === choice.choiceId)) {
                      existing.choices.push(choiceWithDay)
                    }
                  }
                }
              }
            }
          }
        }
      }

      return companiesWithChoicesData
    } catch (error) {
      console.error("Error detecting companies with choices: ", error)
      return []
    }
  }

  const handleSave = async (isDraft = false) => {
    if (!menu && !isCreateMode) return
    console.log("[v0] handleSave called, isDraft:", isDraft)

    // For non-draft saves, check for companies with choices
    // TABBED APPROACH: Instead of opening a separate modal, use inline selections from the Choices tab
    if (!isDraft) {
      console.log("[v0] Checking for companies with choices...")
      const hasInlineSelections = Object.values(inlineChoiceSelections).some(items => items.length > 0)
      
      if (companiesWithChoices.length > 0 && hasInlineSelections) {
        console.log("[v0] Using inline choice selections from Choices tab")
        // Build choice items map from inline selections
        const selectedChoiceItemsMap: Record<string, string[]> = {}
        Object.entries(inlineChoiceSelections).forEach(([key, items]) => {
          const validItems = items.filter((item: any) => item && item.selectedItemId !== undefined && item.subMealPlanId !== undefined)
          validItems.forEach((item: any) => {
            const itemId = item.selectedItemId
            if (!selectedChoiceItemsMap[itemId]) selectedChoiceItemsMap[itemId] = []
            selectedChoiceItemsMap[itemId].push(key)
          })
        })
        setChoiceSelections(inlineChoiceSelections)
        setSelectedChoiceItems(selectedChoiceItemsMap)
        // Proceed directly to save with these selections
        await executeSave(false, inlineChoiceSelections)
        return
      } else if (companiesWithChoices.length > 0 && !hasInlineSelections) {
        // Choices exist but none selected - prompt user to go to Choices tab
        toast({
          title: "Choices Required",
          description: "Please set choice selections in the Choices tab before saving.",
          variant: "destructive"
        })
        setActiveBottomTab('choices')
        return
      } else {
        console.log("[v0] No companies with choices found, proceeding with regular save")
      }
    }


    // Check if confirmation is needed before proceeding
    const needsConfirmation = checkForConfirmationNeeded()

    if (needsConfirmation) {
      setPendingSaveAction({ isDraft: isDraft })
      setShowConfirmationModal(true)
      return
    }

    // Proceed with actual save
    await executeSave(isDraft)
  }

  const handleChoiceConfirm = async (data: any) => {
    // Handle both old format (array) and new format (object with selections and selectedChoiceItems)
    let selections = data.selections || data
    let selectedChoiceItems = data.selectedChoiceItems || {}
    
    // Store selections and choice item marks for marking in company-wise menu only
    setChoiceSelections(selections)
    setSelectedChoiceItems(selectedChoiceItems)
    setShowChoiceModal(false)

    // Proceed with actual save
    await executeSave(false, selections)
  }

  // Sanitize function to remove undefined values from nested objects before saving to Firebase
  const sanitizeMenuData = (data: any): any => {
    if (data === undefined || data === null) return data
    if (typeof data !== 'object') return data
    if (Array.isArray(data)) {
      return data.map(item => sanitizeMenuData(item)).filter(item => item !== undefined)
    }
    const cleaned: any = {}
    for (const [key, value] of Object.entries(data)) {
      // CRITICAL: Preserve itemChoiceMarks even if it's an empty object or contains undefined values
      // This metadata is essential for tracking which items came from choices
      if (key === 'itemChoiceMarks') {
        cleaned[key] = value
        continue
      }
      const cleanedValue = sanitizeMenuData(value)
      if (cleanedValue !== undefined) {
        cleaned[key] = cleanedValue
      }
    }
    return cleaned
  }

  const executeSave = async (isDraft = false, choiceSelectionsData: Record<string, any[]> = {}) => {
    if (!menu && !isCreateMode) return
    const isFirstTimeSave = !updations || updations.length === 0;
    try {
      setSaving(true)

      // ═══ CREATE MODE: Save new combined menu document ═══
      if (isCreateMode && menuType === "combined") {
        const sanitizedData = sanitizeMenuData(JSON.parse(JSON.stringify(menuData)))
        const newMenuDoc = {
          startDate: createStartDate,
          endDate: createEndDate,
          status: isDraft ? "draft" : "active",
          menuData: sanitizedData,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        const newDocRef = await addDoc(collection(db, "combinedMenus"), newMenuDoc)

        if (!isDraft) {
          // Generate company menus from the new combined menu
          toast({ title: "Creating company menus...", description: "Generating company-specific menus from combined menu." })

          // Filter out empty cells
          const filtered: any = {}
          Object.entries(sanitizedData).forEach(([date, dayMenu]: [string, any]) => {
            const filteredDay: any = {}
            Object.entries(dayMenu).forEach(([sId, sData]: [string, any]) => {
              const filteredS: any = {}
              Object.entries(sData).forEach(([ssId, ssData]: [string, any]) => {
                const filteredSS: any = {}
                Object.entries(ssData).forEach(([mpId, mpData]: [string, any]) => {
                  const filteredMP: any = {}
                  Object.entries(mpData).forEach(([smpId, cell]: [string, any]) => {
                    if (cell.menuItemIds?.length > 0) filteredMP[smpId] = cell
                  })
                  if (Object.keys(filteredMP).length > 0) filteredSS[mpId] = filteredMP
                })
                if (Object.keys(filteredSS).length > 0) filteredS[ssId] = filteredSS
              })
              if (Object.keys(filteredS).length > 0) filteredDay[sId] = filteredS
            })
            if (Object.keys(filteredDay).length > 0) filtered[date] = filteredDay
          })

          const count = await generateCompanyMenus(newDocRef.id, filtered)
          toast({ title: "Complete!", description: `Created combined menu and ${count} company menus.` })
        } else {
          toast({ title: "Draft Saved", description: "Combined menu saved as draft." })
        }

         // Only call onSave and onClose for a final save, not a draft.
        if (!isDraft) {
          onSave?.()
          onClose()
        }
        return
      }

      // ═══ EDIT MODE: Existing save logic ═══
      if (!menu) return
      const collectionName = menuType === "combined" ? "combinedMenus" : "companyMenus"
      const docRef = doc(db, collectionName, menuId)
      const statusToSave = isDraft ? "draft" : menu.status

      // Read the push-to-other-buildings checkbox state from DOM
      const pushToOtherBuildingsCheckbox = document.getElementById('pushToOtherBuildings') as HTMLInputElement
      const pushToOtherBuildings = pushToOtherBuildingsCheckbox?.checked || false

      const shouldSyncCompanyMenus = menuType === "combined" && !isDraft;

      const menuItemsMap = new Map(menuItems.map((item) => [item.id, item.name]))

      // The effective data to save — will be overwritten if choices are applied
      let menuDataToSave = menuData
      let menuDataForCompanyGeneration = menuData

      // ═══ Process choices: apply selections to menuData ═══
      if (!isDraft && Object.keys(choiceSelectionsData).length > 0) {
        const updatedMenuData = JSON.parse(JSON.stringify(menuData))

        // Group selections by companyId-buildingId
        // Keys in SelectionMap are "companyId-buildingId-choiceId"
        const companyBuildingMap: Record<string, { companyId: string; buildingId: string; selections: Array<{ choiceId: string; items: any[] }> }> = {}

        for (const [selKey, selItems] of Object.entries(choiceSelectionsData)) {
          if (!selItems || selItems.length === 0) continue
          const parts = selKey.split('-')
          // Key format: companyId-buildingId-choiceId
          const companyId = parts[0]
          const buildingId = parts[1]
          const choiceId = parts.slice(2).join('-') // choiceId could contain dashes
          const cbKey = `${companyId}-${buildingId}`

          if (!companyBuildingMap[cbKey]) {
            companyBuildingMap[cbKey] = { companyId, buildingId, selections: [] }
          }
          companyBuildingMap[cbKey].selections.push({ choiceId, items: selItems })
        }

        // For each company/building with choice selections
        for (const [cbKey, cbData] of Object.entries(companyBuildingMap)) {
          const companyChoiceEntry = companiesWithChoices.find(
            c => c.companyId === cbData.companyId && c.buildingId === cbData.buildingId
          )
          if (!companyChoiceEntry) continue

          for (const sel of cbData.selections) {
            // Find the choice definition
            const choiceDef = companyChoiceEntry.choices.find(c => c.choiceId === sel.choiceId)
            if (!choiceDef) continue

            const choiceDay = choiceDef.choiceDay?.toLowerCase() || ''
            const serviceId = (choiceDef as any).serviceId || ''
            const subServiceId = (choiceDef as any).subServiceId || ''

            // Find the matching date for this choiceDay
            const matchingDate = dateRange.find(d => d.day.toLowerCase() === choiceDay)
            if (!matchingDate) continue
            const dateStr = matchingDate.date

            // ═══ FOR COMBINED MENUS: Apply choice items to choice structure ═══
            if (menuType === 'combined') {
              for (const mp of choiceDef.mealPlans) {
                for (const smp of mp.subMealPlans) {
                  const selectedForSmp = sel.items.filter(
                    (it: any) => it.mealPlanId === mp.mealPlanId && it.subMealPlanId === smp.subMealPlanId
                  )
                  
                  const cellKey = `${dateStr}|${serviceId}|${subServiceId}|${mp.mealPlanId}|${smp.subMealPlanId}`
                  let cell = updatedMenuData[dateStr]?.[serviceId]?.[subServiceId]?.[mp.mealPlanId]?.[smp.subMealPlanId]
                  
                  if (!cell) {
                    console.log("[v0-WARN] No cell found for combined menu key:", cellKey)
                    continue
                  }
                  
                  if (selectedForSmp.length > 0) {
                    cell.menuItemIds = selectedForSmp.map((it: any) => it.selectedItemId)
                    if (!cell.itemChoiceMarks) cell.itemChoiceMarks = {}
                    selectedForSmp.forEach((it: any) => {
                      cell.itemChoiceMarks[it.selectedItemId] = sel.choiceId
                    })
                  } else {
                    cell.menuItemIds = []
                    cell.itemChoiceMarks = {}
                  }
                  cell.isFromChoice = true
                }
              }
            }
            
            // ═══ FOR COMPANY MENUS: Apply choice items to company's single cell ═══
            else if (menuType === 'company') {
              // Company has ONE cell per service/subservice (single mealplan/submealplan)
              // Get all items selected in the choice (from all choice mealplans)
              const allSelectedItems = sel.items
              
              // Find the company's actual cell structure
              const companyCell = updatedMenuData[dateStr]?.[serviceId]?.[subServiceId]
              if (!companyCell) {
                console.log("[v0-WARN] No cell found for company menu at", dateStr, serviceId, subServiceId)
                continue
              }
              
              // Company structure: one mealPlan, one subMealPlan
              const mealPlanIds = Object.keys(companyCell)
              if (mealPlanIds.length === 0) {
                console.log("[v0-WARN] No mealPlan in company cell")
                continue
              }
              
              const mealPlanId = mealPlanIds[0]
              const subMealPlanIds = Object.keys(companyCell[mealPlanId])
              if (subMealPlanIds.length === 0) {
                console.log("[v0-WARN] No subMealPlan in company cell")
                continue
              }
              
              const subMealPlanId = subMealPlanIds[0]
              const cell = companyCell[mealPlanId][subMealPlanId]
              
              if (!cell) {
                console.log("[v0-WARN] Cell is null/undefined")
                continue
              }
              
              // DEBUG: Log cell before modification
              console.log(`[v0-CELL-BEFORE] Cell at ${dateStr}|${serviceId}|${subServiceId}|${mealPlanId}|${subMealPlanId}:`, JSON.stringify(cell))
              
              // Apply selected items to company cell with marks
              if (allSelectedItems.length > 0) {
                cell.menuItemIds = allSelectedItems.map((it: any) => it.selectedItemId)
                if (!cell.itemChoiceMarks) cell.itemChoiceMarks = {}
                allSelectedItems.forEach((it: any) => {
                  cell.itemChoiceMarks[it.selectedItemId] = sel.choiceId
                })
                
                // DEBUG: Log cell after modification and verify it's in updatedMenuData
                console.log(`[v0-CELL-AFTER] Cell after modification:`, JSON.stringify(cell))
                const cellFromData = updatedMenuData[dateStr][serviceId][subServiceId][mealPlanId][subMealPlanId]
                console.log(`[v0-CELL-VERIFY] Cell in updatedMenuData:`, JSON.stringify(cellFromData))
                console.log(`[v0-CELL-VERIFY] Has itemChoiceMarks in updatedMenuData?`, 'itemChoiceMarks' in cellFromData)
                
                const itemNames = allSelectedItems.map((it: any) => it.selectedItemName).join(', ')
                console.log(`[v0-SAVE-COMPANY] Applied ${allSelectedItems.length} items to company cell: ${itemNames}`)
                console.log(`[v0-SAVE-COMPANY] itemChoiceMarks saved:`, JSON.stringify(cell.itemChoiceMarks))
              } else {
                // No items selected - clear the cell
                cell.menuItemIds = []
                cell.itemChoiceMarks = {}
                console.log(`[v0-SAVE-COMPANY] Cleared company cell (no items selected)`)
              }
            }
          }
        }

        if (menuType === 'company') {
          // Update menuData state with choice-applied data
          setMenuData(updatedMenuData)
          // Use the updated data for Firestore save (React state is async)
          menuDataToSave = updatedMenuData
          
          // FINAL VERIFICATION: Check if itemChoiceMarks is in updatedMenuData before Firebase save
          console.log("[v0-FINAL-CHECK] Checking menuDataToSave before Firebase save:")
          Object.entries(menuDataToSave).forEach(([date, dayData]: [string, any]) => {
            Object.entries(dayData).forEach(([serviceId, serviceData]: [string, any]) => {
              Object.entries(serviceData).forEach(([subServiceId, ssData]: [string, any]) => {
                Object.entries(ssData).forEach(([mpId, mpData]: [string, any]) => {
                  Object.entries(mpData).forEach(([smpId, cell]: [string, any]) => {
                    if (cell.menuItemIds && cell.menuItemIds.length > 0) {
                      console.log(`[v0-FINAL-CHECK] Cell ${date}|${serviceId}|${subServiceId}|${mpId}|${smpId}: menuItemIds=`, cell.menuItemIds, "| itemChoiceMarks=", cell.itemChoiceMarks)
                    }
                  })
                })
              })
            })
          })
          
          // Show toast notification for company menu choice applied
          const totalItems = Object.values(choiceSelectionsData).flat().length
          if (totalItems > 0) {
            toast({
              title: "Choice Saved",
              description: `Applied to company menu with ${totalItems} item${totalItems !== 1 ? 's' : ''}`
            })
          }
        } else if (menuType === 'combined') {
          // USER REQ: "dont change the combined menu a bit and remove that choice mark on combined"
          // We only apply the choice data to the generation step, keeping the combined menu pure
          menuDataForCompanyGeneration = updatedMenuData
        }
        console.log("[choice] Updated menuData with choice selections")
      }

      // Redesign Logic: Detect changes against the Original (OG) baseline
      const changedCells = detectMenuChanges(originalMenuData, menuDataToSave, menuItemsMap)

      // Attach live trail metadata to the changes so they are saved in the U# record
      const enrichedChangedCells = changedCells.map(cell => {
        const cellKey = `${cell.date}|${cell.serviceId}|${cell.mealPlanId}|${cell.subMealPlanId}`;
        return {
          ...cell,
          liveTrail: liveChanges[cellKey] || [] // This saves the "Pasta -> Pizza" breadcrumb into Firestore
        };
      });

      // Sanitize menuData before saving to remove any undefined values that Firebase rejects
      const deepCopy = JSON.parse(JSON.stringify(menuDataToSave))
      
      // DEBUG: Log exact cell structure BEFORE sanitization
      if (menuType === 'company') {
        const sampleDate = Object.keys(deepCopy)[0]
        const sampleService = Object.keys(deepCopy[sampleDate] || {})[0]
        const sampleSubService = Object.keys(deepCopy[sampleDate]?.[sampleService] || {})[0]
        const sampleMP = Object.keys(deepCopy[sampleDate]?.[sampleService]?.[sampleSubService] || {})[0]
        const sampleSMP = Object.keys(deepCopy[sampleDate]?.[sampleService]?.[sampleSubService]?.[sampleMP] || {})[0]
        
        if (sampleDate && sampleService && sampleSubService && sampleMP && sampleSMP) {
          const sampleCell = deepCopy[sampleDate][sampleService][sampleSubService][sampleMP][sampleSMP]
          console.log(`[v0-BEFORE-SANITIZE] Sample cell at ${sampleDate}|${sampleService}|${sampleSubService}|${sampleMP}|${sampleSMP}:`, JSON.stringify(sampleCell))
        }
      }
      
      const sanitizedMenuData = sanitizeMenuData(deepCopy)
      
      // DEBUG: Log exact cell structure AFTER sanitization
      if (menuType === 'company') {
        const sampleDate = Object.keys(sanitizedMenuData)[0]
        const sampleService = Object.keys(sanitizedMenuData[sampleDate] || {})[0]
        const sampleSubService = Object.keys(sanitizedMenuData[sampleDate]?.[sampleService] || {})[0]
        const sampleMP = Object.keys(sanitizedMenuData[sampleDate]?.[sampleService]?.[sampleSubService] || {})[0]
        const sampleSMP = Object.keys(sanitizedMenuData[sampleDate]?.[sampleService]?.[sampleSubService]?.[sampleMP] || {})[0]
        
        if (sampleDate && sampleService && sampleSubService && sampleMP && sampleSMP) {
          const sampleCell = sanitizedMenuData[sampleDate][sampleService][sampleSubService][sampleMP][sampleSMP]
          console.log(`[v0-AFTER-SANITIZE] Sample cell at ${sampleDate}|${sampleService}|${sampleSubService}|${sampleMP}|${sampleSMP}:`, JSON.stringify(sampleCell))
          console.log(`[v0-AFTER-SANITIZE] Has itemChoiceMarks?`, 'itemChoiceMarks' in sampleCell)
        }
      }
      
      // Also attach saved choices to combined menus so the modal pre-fills next time!
      const updatePayload: any = {
        menuData: sanitizedMenuData,
        status: shouldSyncCompanyMenus ? "active" : statusToSave,
        updatedAt: new Date(),
      }
      if (menuType === 'combined' && choiceSelectionsData && Object.keys(choiceSelectionsData).length > 0) {
        updatePayload.savedChoices = choiceSelectionsData;
      }

      await updateDoc(docRef, updatePayload)

      // ===== HARD COMMIT LOGIC =====
      // If NOT a draft (isDraft === false), commit changes and update baseline
      // FIXED: OG baseline is LOCKED from initial load and should NEVER change
      if (!isDraft && changedCells.length > 0) {
        // 1. DO NOT update originalMenuData - it's locked from the initial load (line 2921)
        // OG represents the baseline from the database, which should never change

        // 2. CLEAR the liveChanges state completely so LIVE tags disappear
        setLiveChanges({});
      }

      if (shouldSyncCompanyMenus) {
        toast({ title: "Syncing company menus...", description: "Updating existing menus and creating new ones." })

        const filtered: any = {}
        Object.entries(menuDataForCompanyGeneration).forEach(([date, dayMenu]: [string, any]) => {
          const filteredDay: any = {}
          Object.entries(dayMenu).forEach(([sId, sData]: [string, any]) => {
            const filteredS: any = {}
            Object.entries(sData).forEach(([ssId, ssData]: [string, any]) => {
              const filteredSS: any = {}

              // 3. Iterate over ssData to get MealPlans (mpData) 
              // (Yahan galti thi: aap mpData likh rahe the Object.entries mein, jabki ssData hona chahiye)
              Object.entries(ssData).forEach(([mpId, mpData]: [string, any]) => {
                const filteredMP: any = {}
                Object.entries(mpData).forEach(([smpId, cell]: [string, any]) => {
                  if (cell.menuItemIds?.length > 0) filteredMP[smpId] = cell
                })
                if (Object.keys(filteredMP).length > 0) filteredSS[mpId] = filteredMP
              })
              if (Object.keys(filteredSS).length > 0) filteredS[ssId] = filteredSS
            })
            if (Object.keys(filteredS).length > 0) filteredDay[sId] = filteredS
          })
          if (Object.keys(filteredDay).length > 0) filtered[date] = filteredDay
        })

        const count = await generateCompanyMenus(menuId, filtered)
        toast({ title: "Sync Complete", description: `Updated/Created ${count} company menus.` })
      }

      // 4. Record Updation if active and changed
      if (!isDraft && changedCells.length > 0) {
        // This is the missing variable that caused the crash!
        const changeSummary = createChangeSummary(changedCells)

        if (menuType === "company" && menu.combinedMenuId) {
          // FIXED: Get the actual latest number across BOTH combined and company menus for true global counting
          const combinedLatestNumber = await updationService.getLatestUpdationNumber(menu.combinedMenuId) || 0
          const companyLatestNumber = await updationService.getLatestUpdationNumber(menuId) || 0
          const globalLatestNumber = Math.max(combinedLatestNumber, companyLatestNumber)
          const nextGlobalNumber = globalLatestNumber + 1

          const appliedBuildingIds = [menu.buildingId]
          const appliedBuildingNames = [menu.buildingName]

          // 1. FETCH OTHER BUILDINGS EARLY
          let otherBuildingsMenus: any[] = []
          if (pushToOtherBuildings && menu.companyId) {
            try {
              const allBuildingsMenus = await getDocs(
                query(collection(db, "companyMenus"), where("companyId", "==", menu.companyId))
              )
              otherBuildingsMenus = allBuildingsMenus.docs.filter(
                (doc) => {
                  const docData = doc.data()
                  return (
                    docData.buildingId !== menu.buildingId &&
                    docData.startDate === menu.startDate &&
                    docData.endDate === menu.endDate
                  )
                }
              )
              otherBuildingsMenus.forEach(doc => {
                appliedBuildingIds.push(doc.data().buildingId)
                appliedBuildingNames.push(doc.data().buildingName)
              })
            } catch (error) {
              console.error("[v0] Error fetching other buildings:", error)
            }
          }

          // FIXED: Re-fetch the actual latest number just before saving (in case another save happened in parallel)
          const combinedLatestBeforeSave = await updationService.getLatestUpdationNumber(menu.combinedMenuId) || 0
          const companyLatestBeforeSave = await updationService.getLatestUpdationNumber(menuId) || 0
          const globalLatestBeforeSave = Math.max(combinedLatestBeforeSave, companyLatestBeforeSave)
          const finalGlobalNumber = globalLatestBeforeSave + 1

          // 2. Update combined menu document with company-specific change tracking
          try {
            const combinedMenuRef = doc(db, "combinedMenus", menu.combinedMenuId)

            const companyChangeData = {
              companyId: menu.companyId,
              companyName: menu.companyName,
              buildingId: menu.buildingId,
              buildingName: menu.buildingName,
              updationNumber: finalGlobalNumber,  // FIXED: Use global updation number
              changes: changedCells.map((cell: any) => ({
                date: cell.date,
                serviceId: cell.serviceId,
                subServiceId: cell.subServiceId,
                mealPlanId: cell.mealPlanId,
                subMealPlanId: cell.subMealPlanId,
                changes: cell.changes,
              })),
              changedAt: new Date(),
            }

            const updates: any = { lastCompanyChangeAt: new Date() }
            appliedBuildingIds.forEach((bId, idx) => {
              updates[`companyChanges.${menu.companyId}.${bId}`] = {
                ...companyChangeData,
                buildingId: bId,
                buildingName: appliedBuildingNames[idx]
              }
            })
            await updateDoc(combinedMenuRef, updates)

            // 3. SYNC changes to combined menu's menuData
            try {
              const combinedMenuSnap = await getDoc(combinedMenuRef)
              if (combinedMenuSnap.exists()) {
                const combinedMenuCurrentData = combinedMenuSnap.data()
                const combinedMenuData = JSON.parse(JSON.stringify(combinedMenuCurrentData.menuData || {}))

                const getDefaultCompaniesForCell = (dateStr: string, sId: string, ssId: string, mpId: string, smpId: string) => {
                  const d = new Date(dateStr)
                  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
                  const dayKey = days[d.getDay()]
                  const result: Array<{ companyId: string, buildingId: string }> = []
                  mealPlanAssignments.forEach((assignment: any) => {
                    const dayStructure = assignment.weekStructure?.[dayKey] || []
                    const serviceInDay = dayStructure.find((s: any) => s.serviceId === sId)
                    const subServiceInDay = serviceInDay?.subServices?.find((ss: any) => ss.subServiceId === ssId)
                    const mealPlanInDay = subServiceInDay?.mealPlans?.find((mp: any) => mp.mealPlanId === mpId)
                    const subMealPlanInDay = mealPlanInDay?.subMealPlans?.find((smp: any) => smp.subMealPlanId === smpId)
                    if (subMealPlanInDay) {
                      result.push({ companyId: assignment.companyId, buildingId: assignment.buildingId })
                    }
                  })
                  return result
                }

                changedCells.forEach((changedCell: any) => {
                  const { date, serviceId, subServiceId, mealPlanId, subMealPlanId, changes } = changedCell

                  if (!combinedMenuData[date]) combinedMenuData[date] = {}
                  if (!combinedMenuData[date][serviceId]) combinedMenuData[date][serviceId] = {}
                  if (!combinedMenuData[date][serviceId][subServiceId]) combinedMenuData[date][serviceId][subServiceId] = {}
                  if (!combinedMenuData[date][serviceId][subServiceId][mealPlanId]) combinedMenuData[date][serviceId][subServiceId][mealPlanId] = {}
                  if (!combinedMenuData[date][serviceId][subServiceId][mealPlanId][subMealPlanId]) {
                    combinedMenuData[date][serviceId][subServiceId][mealPlanId][subMealPlanId] = { menuItemIds: [], customAssignments: {} }
                  }

                  const combinedCell = combinedMenuData[date][serviceId][subServiceId][mealPlanId][subMealPlanId]
                  if (!combinedCell.menuItemIds) combinedCell.menuItemIds = []
                  if (!combinedCell.customAssignments) combinedCell.customAssignments = {}

                  changes?.forEach((change: any) => {
                    if (change.action === "added" && change.itemId) {
                      if (!combinedCell.menuItemIds.includes(change.itemId)) {
                        combinedCell.menuItemIds.push(change.itemId)
                      }
                      if (!combinedCell.customAssignments[change.itemId]) {
                        combinedCell.customAssignments[change.itemId] = []
                      }
                      appliedBuildingIds.forEach(bId => {
                        const alreadyAssigned = combinedCell.customAssignments[change.itemId].some(
                          (a: any) => a.companyId === menu.companyId && a.buildingId === bId
                        )
                        if (!alreadyAssigned) {
                          combinedCell.customAssignments[change.itemId].push({
                            companyId: menu.companyId,
                            buildingId: bId,
                          })
                        }
                      })
                    } else if (change.action === "removed" && change.itemId) {
                      if (!combinedCell.customAssignments[change.itemId]) {
                        combinedCell.customAssignments[change.itemId] = getDefaultCompaniesForCell(date, serviceId, subServiceId, mealPlanId, subMealPlanId)
                      }
                      appliedBuildingIds.forEach(bId => {
                        combinedCell.customAssignments[change.itemId] = combinedCell.customAssignments[change.itemId].filter(
                          (a: any) => !(a.companyId === menu.companyId && a.buildingId === bId)
                        )
                      })
                      if (combinedCell.customAssignments[change.itemId].length === 0) {
                        delete combinedCell.customAssignments[change.itemId]
                        combinedCell.menuItemIds = combinedCell.menuItemIds.filter((id: string) => id !== change.itemId)
                      }
                    } else if (change.action === "replaced" && change.itemId && change.replacedWith) {
                      if (!combinedCell.menuItemIds.includes(change.replacedWith)) {
                        combinedCell.menuItemIds.push(change.replacedWith)
                      }
                      if (!combinedCell.customAssignments[change.replacedWith]) {
                        combinedCell.customAssignments[change.replacedWith] = []
                      }
                      appliedBuildingIds.forEach(bId => {
                        const alreadyAssignedNew = combinedCell.customAssignments[change.replacedWith].some(
                          (a: any) => a.companyId === menu.companyId && a.buildingId === bId
                        )
                        if (!alreadyAssignedNew) {
                          combinedCell.customAssignments[change.replacedWith].push({
                            companyId: menu.companyId,
                            buildingId: bId,
                          })
                        }
                      })
                      if (!combinedCell.customAssignments[change.itemId]) {
                        combinedCell.customAssignments[change.itemId] = getDefaultCompaniesForCell(date, serviceId, subServiceId, mealPlanId, subMealPlanId)
                      }
                      appliedBuildingIds.forEach(bId => {
                        combinedCell.customAssignments[change.itemId] = combinedCell.customAssignments[change.itemId].filter(
                          (a: any) => !(a.companyId === menu.companyId && a.buildingId === bId)
                        )
                      })
                      if (combinedCell.customAssignments[change.itemId].length === 0) {
                        delete combinedCell.customAssignments[change.itemId]
                        combinedCell.menuItemIds = combinedCell.menuItemIds.filter((id: string) => id !== change.itemId)
                      }
                    }
                  })

                  if (Object.keys(combinedCell.customAssignments).length === 0) {
                    delete combinedCell.customAssignments
                  }
                })

                await updateDoc(combinedMenuRef, {
                  menuData: combinedMenuData,
                  updatedAt: new Date(),
                })
              }
            } catch (syncError) {
              console.error("[v0] Error syncing company changes to combined menu menuData:", syncError)
            }
          } catch (error) {
            console.error("[v0] Error updating combined menu with company changes:", error)
          }

          // 4. Update the actual company menu documents for the other buildings
          if (pushToOtherBuildings && otherBuildingsMenus.length > 0) {
            try {
              for (const otherMenuDoc of otherBuildingsMenus) {
                const otherMenu = otherMenuDoc.data()
                const otherMenuId = otherMenuDoc.id

                const updatedMenuData = JSON.parse(JSON.stringify(otherMenu.menuData || {}))

                changedCells.forEach((changedCell: any) => {
                  const { date, serviceId, subServiceId, mealPlanId, subMealPlanId, changes } = changedCell

                  if (!updatedMenuData[date]) updatedMenuData[date] = {}
                  if (!updatedMenuData[date][serviceId]) updatedMenuData[date][serviceId] = {}
                  if (!updatedMenuData[date][serviceId][subServiceId]) updatedMenuData[date][serviceId][subServiceId] = {}
                  if (!updatedMenuData[date][serviceId][subServiceId][mealPlanId]) updatedMenuData[date][serviceId][subServiceId][mealPlanId] = {}

                  const cell = updatedMenuData[date][serviceId][subServiceId][mealPlanId][subMealPlanId]

                  if (cell) {
                    changes?.forEach((change: any) => {
                      if (change.action === "added" && change.itemId) {
                        if (!cell.menuItemIds) cell.menuItemIds = []
                        if (!cell.menuItemIds.includes(change.itemId)) {
                          cell.menuItemIds.push(change.itemId)
                        }
                      } else if (change.action === "removed" && change.itemId) {
                        if (cell.menuItemIds) {
                          cell.menuItemIds = cell.menuItemIds.filter((id: string) => id !== change.itemId)
                        }
                      } else if (change.action === "replaced" && change.itemId && change.replacedWith) {
                        if (cell.menuItemIds) {
                          cell.menuItemIds = cell.menuItemIds.filter((id: string) => id !== change.itemId)
                        }
                        if (!cell.menuItemIds) cell.menuItemIds = []
                        if (!cell.menuItemIds.includes(change.replacedWith)) {
                          cell.menuItemIds.push(change.replacedWith)
                        }
                      }
                    })
                  } else {
                    updatedMenuData[date][serviceId][subServiceId][mealPlanId][subMealPlanId] = { menuItemIds: [] }
                    const newCell = updatedMenuData[date][serviceId][subServiceId][mealPlanId][subMealPlanId]
                    changes?.forEach((change: any) => {
                      if (change.action === "added" && change.itemId) {
                        newCell.menuItemIds.push(change.itemId)
                      } else if (change.action === "replaced" && change.replacedWith) {
                        newCell.menuItemIds.push(change.replacedWith)
                      }
                    })
                  }
                })

                await updateDoc(doc(db, "companyMenus", otherMenuId), {
                  menuData: updatedMenuData,
                  updatedAt: new Date(),
                })
              }
            } catch (error) {
              console.error("[v0] Error applying changes to other buildings:", error)
            }
          }

          // Create ONE consolidated entry in combined menu's log with ALL affected buildings
          const appliedBuildingInfo = appliedBuildingIds.map((bid, idx) => ({
            buildingId: bid,
            buildingName: appliedBuildingNames[idx] || bid
          }))

          const menuItemsMap = new Map(menuItems.map((item) => [item.id, item.name]))
          const enrichedChangedCells = changedCells.map((cell: any) => ({
            ...cell,
            changes: (cell.changes || []).map((ch: any) => ({
              ...ch,
              itemName: ch.itemId ? (menuItemsMap.get(ch.itemId) || ch.itemId) : undefined,
              replacedWithName: ch.replacedWith ? (menuItemsMap.get(ch.replacedWith) || ch.replacedWith) : undefined,
              companyId: menu.companyId,
              companyName: menu.companyName,
              buildingId: menu.buildingId,
              buildingName: menu.buildingName,
            }))
          }))

          // FIXED: Create COMBINED record only, company record will be synced separately
          const combinedUpdationRecord: any = {
            menuId: menu.combinedMenuId,
            menuType: "combined",
            menuName: "Combined Menu",
            updationNumber: finalGlobalNumber,  // FIXED: Use global updation number
            changedCells: enrichedChangedCells,
            totalChanges: changeSummary.totalChanges,
            menuStartDate: menu.startDate,
            menuEndDate: menu.endDate,
            createdAt: new Date(),
            createdBy: "user",
            isCompanyWiseChange: true,
            sourcedFromCompanyId: menu.companyId,
            sourcedFromCompanyName: menu.companyName,
            sourcedFromBuildingId: menu.buildingId,
            sourcedFromBuildingName: menu.buildingName,
            sourcedFromMenuId: menuId,
            sourcedFromCombinedMenuId: menu.combinedMenuId,
            appliedToAllBuildings: pushToOtherBuildings && appliedBuildingIds.length > 1,
            appliedBuildingIds: appliedBuildingIds,
            appliedBuildingInfo: appliedBuildingInfo,
            otherBuildingsCount: appliedBuildingIds.length - 1,
          }

          await addDoc(collection(db, "updations"), combinedUpdationRecord)

          // FIXED: Only create separate company record if it has relevant changes
          // This prevents duplicate u1 entries when the same item is added
          // Note: finalGlobalNumber already calculated above for global continuous counting

          // Deduplicate: Only save company record if it differs from combined record
          // (i.e., if there are checkbox-specific changes not in the combined record)
          const hasCompanySpecificChanges = true; // For now, trust the combined record is source of truth

          if (hasCompanySpecificChanges) {
            const companyUpdationRecord: any = {
              menuId: menuId,
              menuType: "company",
              menuName: menu.companyName ? `${menu.companyName} - ${menu.buildingName}` : "Company Menu",
              updationNumber: finalGlobalNumber,  // FIXED: Use global updation number
              changedCells: enrichedChangedCells,
              totalChanges: changeSummary.totalChanges,
              menuStartDate: menu.startDate,
              menuEndDate: menu.endDate,
              createdAt: new Date(),
              createdBy: "user",
              companyId: menu.companyId,
              companyName: menu.companyName,
              buildingId: menu.buildingId,
              buildingName: menu.buildingName,
              isCompanyWiseChange: true,
              appliedToAllBuildings: pushToOtherBuildings && appliedBuildingIds.length > 1,
              appliedBuildingIds: appliedBuildingIds,
              appliedBuildingInfo: appliedBuildingInfo,
              otherBuildingsCount: appliedBuildingIds.length - 1,
            }
            await addDoc(collection(db, "updations"), companyUpdationRecord)
          }

        } else if (menuType === "combined") {

          const companySpecificUpdates = new Map<string, any>()

          // 1. Helper to get Default Structure
          const getDefaultCompaniesForCell = (dateStr: string, sId: string, ssId: string, mpId: string, smpId: string) => {
            const d = new Date(dateStr)
            const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
            const dayKey = days[d.getDay()]
            const result: Array<{ companyId: string, buildingId: string }> = []

            if (!mealPlanAssignments) return []

            mealPlanAssignments.forEach((assignment: any) => {
              const dayStructure = assignment.weekStructure?.[dayKey] || []
              const serviceInDay = dayStructure.find((s: any) => s.serviceId === sId)
              const subServiceInDay = serviceInDay?.subServices?.find((ss: any) => ss.subServiceId === ssId)
              const mealPlanInDay = subServiceInDay?.mealPlans?.find((mp: any) => mp.mealPlanId === mpId)
              const subMealPlanInDay = mealPlanInDay?.subMealPlans?.find((smp: any) => smp.subMealPlanId === smpId)
              if (subMealPlanInDay) {
                result.push({ companyId: assignment.companyId, buildingId: assignment.buildingId })
              }
            })
            return result
          }

          // 2. Helper to get EFFECTIVE assignments
          const getEffectiveAssignments = (cell: any, itemId: string, date: string, sId: string, ssId: string, mpId: string, smpId: string) => {
            if (!cell.menuItemIds || !cell.menuItemIds.includes(itemId)) return [];

            const customs = cell.customAssignments || {};
            if (customs[itemId] && Array.isArray(customs[itemId])) {
              return customs[itemId];
            }

            const choiceMeta = cell.choiceMetadata || {};
            return getDefaultCompaniesForCell(date, sId, ssId, mpId, smpId).filter(comp => {
              const cbKey = `${comp.companyId}-${comp.buildingId}`;
              return !choiceMeta[cbKey];
            });
          }

          // --- MANUALLY DETECT CHECKBOX CHANGES (FIXED) ---
          Object.keys(menuData).forEach(date => {
            Object.keys(menuData[date] || {}).forEach(sId => {
              Object.keys(menuData[date][sId] || {}).forEach(ssId => {
                Object.keys(menuData[date][sId][ssId] || {}).forEach(mpId => {
                  Object.keys(menuData[date][sId][ssId][mpId] || {}).forEach(smpId => {
                    const oldCell = originalMenuData[date]?.[sId]?.[ssId]?.[mpId]?.[smpId] || {}
                    const newCell = menuData[date]?.[sId]?.[ssId]?.[mpId]?.[smpId] || {}

                    const oldItems = oldCell.menuItemIds || []
                    const newItems = newCell.menuItemIds || []

                    const allItems = new Set([...oldItems, ...newItems])
                    const cellCheckboxChanges: any[] = []

                    allItems.forEach(itemId => {
                      // Get Effective State (Normalized)
                      const oldEffective = getEffectiveAssignments(oldCell, itemId, date, sId, ssId, mpId, smpId);
                      const newEffective = getEffectiveAssignments(newCell, itemId, date, sId, ssId, mpId, smpId);

                      // Create Sets for comparison
                      const oldKeys = new Set(oldEffective.map((a: any) => `${a.companyId}|${a.buildingId}`));
                      const newKeys = new Set(newEffective.map((a: any) => `${a.companyId}|${a.buildingId}`));

                      const addedTo = newEffective.filter((a: any) => !oldKeys.has(`${a.companyId}|${a.buildingId}`));
                      const removedFrom = oldEffective.filter((a: any) => !newKeys.has(`${a.companyId}|${a.buildingId}`));

                      const itemName = menuItemsMap.get(itemId) || itemId

                      const recordCompanyTimeline = (compAssign: any, actionType: "added" | "removed") => {
                        const companyObj = companies.find((c: any) => c.id === compAssign.companyId)
                        const buildingObj = buildings.find((b: any) => b.id === compAssign.buildingId)

                        // Skip if item was just ADDED or REMOVED entirely (handled by standard change detection)
                        const isNewItem = !oldItems.includes(itemId) && newItems.includes(itemId)
                        const isRemovedItem = oldItems.includes(itemId) && !newItems.includes(itemId)

                        if (isNewItem) return;
                        if (isRemovedItem) return;

                        // 1. Add for Combined Timeline
                        cellCheckboxChanges.push({
                          action: actionType,
                          itemId,
                          itemName: `${itemName} (${actionType === "added" ? "Assigned to" : "Removed from"} ${companyObj?.name || 'Company'} via Checkbox)`,
                          companyId: compAssign.companyId,
                          companyName: companyObj?.name || "Company",
                          buildingId: compAssign.buildingId,
                          buildingName: buildingObj?.name || "Building"
                        })

                        // 2. Prepare data for Company Timeline
                        const key = `${compAssign.companyId}|${compAssign.buildingId}`
                        if (!companySpecificUpdates.has(key)) {
                          companySpecificUpdates.set(key, { companyId: compAssign.companyId, buildingId: compAssign.buildingId, changedCells: [] })
                        }
                        const compUpdate = companySpecificUpdates.get(key)
                        let targetCell = compUpdate.changedCells.find((c: any) => c.date === date && c.serviceId === sId && c.mealPlanId === mpId && c.subMealPlanId === smpId)
                        if (!targetCell) {
                          targetCell = { date, serviceId: sId, subServiceId: ssId, mealPlanId: mpId, subMealPlanId: smpId, changes: [] }
                          compUpdate.changedCells.push(targetCell)
                        }

                        targetCell.changes.push({
                          action: actionType,
                          itemId,
                          itemName: `${itemName} (via Checkbox)`,
                          companyId: compAssign.companyId,
                          companyName: companyObj?.name || "Company",
                          buildingId: compAssign.buildingId,
                          buildingName: buildingObj?.name || "Building"
                        })
                      }

                      addedTo.forEach((a: any) => recordCompanyTimeline(a, "added"))
                      removedFrom.forEach((a: any) => recordCompanyTimeline(a, "removed"))
                    })

                    if (cellCheckboxChanges.length > 0) {
                      let existingCell = changedCells.find((c: any) =>
                        c.date === date && c.serviceId === sId && c.subServiceId === ssId &&
                        c.mealPlanId === mpId && c.subMealPlanId === smpId
                      )
                      if (existingCell) {
                        // FIXED: Deduplicate - only add checkbox changes that aren't already tracked by standard detection
                        const existingItemIds = new Set(existingCell.changes.map((ch: any) => `${ch.itemId}|${ch.action}`));
                        const newCheckboxChanges = cellCheckboxChanges.filter((ch: any) =>
                          !existingItemIds.has(`${ch.itemId}|${ch.action}`)
                        );
                        if (newCheckboxChanges.length > 0) {
                          existingCell.changes.push(...newCheckboxChanges)
                        }
                      } else {
                        changedCells.push({
                          date, serviceId: sId, subServiceId: ssId, mealPlanId: mpId, subMealPlanId: smpId,
                          changes: cellCheckboxChanges
                        })
                      }
                    }
                  })
                })
              })
            })
          })

          // Now calculate the summary INCLUDING the new checkbox changes
          const changeSummary = createChangeSummary(changedCells)

          if (changedCells.length > 0) {
            // FIXED: Get global updation number for combined menu
            const combinedLatestBeforeSaveForCombined = await updationService.getLatestUpdationNumber(menuId) || 0
            const globalLatestBeforeSaveForCombined = combinedLatestBeforeSaveForCombined
            const finalGlobalNumberForCombined = globalLatestBeforeSaveForCombined + 1

            // 1. SAVE COMBINED MENU RECORD
            const updationRecord: any = {
              menuId,
              menuType,
              menuName: menu.name || `${menuType} Menu`,
              updationNumber: finalGlobalNumberForCombined,  // FIXED: Use global updation number
              changedCells,
              totalChanges: changeSummary.totalChanges,
              menuStartDate: menu.startDate,
              menuEndDate: menu.endDate,
              createdAt: new Date(),
              createdBy: "user",
            }
            await addDoc(collection(db, "updations"), updationRecord)

            // 2. SAVE INDIVIDUAL COMPANY RECORDS
            for (const updateData of Array.from(companySpecificUpdates.values())) {
              const companyObj = companies.find((c: any) => c.id === updateData.companyId)
              const buildingObj = buildings.find((b: any) => b.id === updateData.buildingId)

              if (companyObj && buildingObj) {
                const companyUpdationRecord: any = {
                  menuId: menuId,
                  menuType: "company",
                  menuName: `${companyObj.name} - ${buildingObj.name}`,
                  updationNumber: finalGlobalNumberForCombined,  // FIXED: Use global updation number
                  changedCells: updateData.changedCells,
                  totalChanges: updateData.changedCells.reduce((acc: number, c: any) => acc + c.changes.length, 0),
                  menuStartDate: menu.startDate,
                  menuEndDate: menu.endDate,
                  createdAt: new Date(),
                  createdBy: "user",
                  companyId: companyObj.id,
                  companyName: companyObj.name,
                  buildingId: buildingObj.id,
                  buildingName: buildingObj.name,
                  isCompanyWiseChange: true,
                  // FIX: Added the critical Sourced Fields so the UI groups it!
                  sourcedFromCompanyId: companyObj.id,
                  sourcedFromCompanyName: companyObj.name,
                  sourcedFromCombinedMenuId: menuId
                }
                await addDoc(collection(db, "updations"), companyUpdationRecord)
              }
            }
          }
        }
      }

      if (!isDraft) {
        /* 
           Scenario: "Save & Generate" (Generating a Version)
           The current 'Live' session is now finished. 
        */

        // FIXED: OG baseline is LOCKED from initial load and should NEVER change
        // Do not update originalMenuData - it represents the baseline from database

        // 2. Clear the Live Trail (Remove the Green labels from the UI)
        setLiveChanges({});

        toast({
          title: `Updation U${updations.length + 1} Generated`,
          description: "Live trails have been moved to the historical log.",
        });
      } else {
        /* 
           Scenario: "Save as Draft"
           We save the data but DO NOT reset the trail.
        */
        toast({
          title: "Draft Saved",
          description: "Your live editing trail is preserved.",
        });
      }


      setPendingSaveAction(null)
      // Only call onSave and onClose for a final save, not a draft.
      if (!isDraft) {
        clearDrafts()
        onSave?.()
        onClose()
      }
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
      subMealPlans: subMealPlans.filter((smp) => smp.mealPlanId === mp.id).sort((a, b) => (a.order || 999) - (b.order || 999)),
    }))
  }, [mealPlans, subMealPlans])
  const isSubMealPlanInStructure = useCallback((mealPlanId: string, subMealPlanId: string) => {
    // Safety checks
    if (!selectedService || !selectedSubService || !mealPlanAssignments.length) return false;

    // Determine which set of assignments to check against
    const relevantAssignments = menuType === "company" && menu?.companyId
      // For COMPANY menu: Use ONLY that company's assignments
      ? mealPlanAssignments.filter((assignment: any) => assignment.companyId === menu.companyId)
      // For COMBINED menu: Use ALL company assignments
      : mealPlanAssignments;

    // Check if this meal plan/sub meal plan exists in ANY day of the week
    // within the relevant assignments for the selected service/sub-service.
    return dateRange.some(({ day }) => {
      const dayKey = day.toLowerCase();
      return relevantAssignments.some(assignment => {
        const dayStructure = assignment.weekStructure?.[dayKey] || [];

        // Navigate the structure tree to find a match
        const sInDay = dayStructure.find((s: any) => s.serviceId === selectedService.id);
        const ssInDay = sInDay?.subServices?.find((ss: any) => ss.subServiceId === selectedSubService.id);
        const mpInDay = ssInDay?.mealPlans?.find((mp: any) => mp.mealPlanId === mealPlanId);

        return mpInDay?.subMealPlans?.some((smp: any) => smp.subMealPlanId === subMealPlanId);
      });
    });
  }, [mealPlanAssignments, menuType, menu?.companyId, dateRange, selectedService, selectedSubService]);

  // 2. Updated Memo to include rows that have DATA even if not in structure
  const filteredMealPlanStructure = useMemo(() => {
    if (!selectedService || !selectedSubService) return [];

    return mealPlanStructure.map(({ mealPlan, subMealPlans: subMPs }) => {
      const visibleSubMealPlans = subMPs.filter(subMealPlan => {
        // A. Is it part of the standard company structure?
        const inStructure = isSubMealPlanInStructure(mealPlan.id, subMealPlan.id);

        // B. Does it have data assigned (Custom Assignment/Forced)?
        // We scan all dates for this specific row to see if any items exist in menuData
        const hasData = dateRange.some(({ date }) => {
          // Safely access the deeply nested data
          const cell = menuData?.[date]?.[selectedService.id]?.[selectedSubService.id]?.[mealPlan.id]?.[subMealPlan.id];
          return cell?.menuItemIds && cell.menuItemIds.length > 0;
        });

        // SHOW ROW IF: It is in the structure OR it has data assigned
        return inStructure || hasData;
      });
      return { mealPlan, subMealPlans: visibleSubMealPlans };
    }).filter(group => group.subMealPlans.length > 0);
  }, [mealPlanStructure, isSubMealPlanInStructure, dateRange, menuData, selectedService, selectedSubService]);
  const handleDownloadZIP = async () => {
    if (menuType !== "combined" || !menuId) return;

    try {
      setZipLoading(true);
      toast({ title: "Preparing ZIP...", description: "Formatting master menu and company files..." });

      const ExcelJS = (await import("exceljs")).default;
      const JSZip = (await import("jszip")).default;
      const fileSaver = await import("file-saver");
      const saveAs = fileSaver.saveAs || fileSaver.default;

      const [companyMenusSnap] = await Promise.all([
        getDocs(query(collection(db, "companyMenus"), where("combinedMenuId", "==", menuId)))
      ]);

      const companyMenus = companyMenusSnap.docs.map(d => d.data() as MenuData);
      const zip = new JSZip();

      const getName = (id: string) => menuItems.find(i => i.id === id)?.name || id;

      // Helper: Get just the building name for the footer table
      const getOnlyBuildingName = (bId: string) => {
        const building = buildings.find((b: any) => b.id === bId);
        return building ? building.name : bId;
      };

      const formatDateForExcelHeader = (dateString: string) => {
        const date = new Date(dateString);
        const day = date.getUTCDate();
        const daySuffix = (day % 10 === 1 && day !== 11) ? 'st' : (day % 10 === 2 && day !== 12) ? 'nd' : (day % 10 === 3 && day !== 13) ? 'rd' : 'th';
        const month = date.toLocaleString('default', { month: 'short' });
        const weekday = date.toLocaleString('default', { weekday: 'short' });
        return `${day}${daySuffix} ${month}\n(${weekday})`;
      };

      const dateHeaders = dateRange.map(d => formatDateForExcelHeader(d.date));
      const totalColumns = dateHeaders.length + 2;

      // =========================================================
      // PART A: Generate Individual Company Files
      // =========================================================
      if (companyMenus.length > 0) {
        const groupedByCompany: Record<string, MenuData[]> = {};
        companyMenus.forEach(cm => {
          if (!cm.companyName) return;
          if (!groupedByCompany[cm.companyName]) groupedByCompany[cm.companyName] = [];
          groupedByCompany[cm.companyName].push(cm);
        });

        for (const [companyName, menus] of Object.entries(groupedByCompany)) {
          const workbook = new ExcelJS.Workbook();
          let hasSheets = false;

          for (const buildingMenu of menus) {
            const sheetName = (buildingMenu.buildingName || "Building").replace(/[\\/?*[\]]/g, "").substring(0, 31);
            const worksheet = workbook.addWorksheet(sheetName);
            hasSheets = true;

            // 1. Title Row
            const titleRow = worksheet.addRow([`MENU - ${companyName.toUpperCase()} (${buildingMenu.buildingName})`]);
            worksheet.mergeCells(titleRow.number, 1, titleRow.number, totalColumns);
            titleRow.getCell(1).font = { size: 16, bold: true, color: { argb: 'FF2F5496' } };
            titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
            titleRow.height = 35;

            // 2. Global Header Row
            const headerRow = worksheet.addRow(["Meal Plan", "Sub Meal Plan", ...dateHeaders]);
            headerRow.height = 40;
            headerRow.eachCell((cell) => {
              cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
              cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
              cell.border = { top: { style: 'medium' }, left: { style: 'medium' }, bottom: { style: 'medium' }, right: { style: 'medium' } };
            });

            // 3. Loop through Services
            services.sort((a, b) => (a.order || 999) - (b.order || 999)).forEach(service => {

              // First, find all sub-services for this service that actually have menu data for this specific building.
              const potentialSubServices = (subServices.get(service.id) || []).sort((a, b) => (a.order || 999) - (b.order || 999));

              const validSubServices = potentialSubServices.filter(subService => {
                // A sub-service is valid if, for any date, it has at least one menu item in any meal plan/sub-meal plan.
                return dateRange.some(d => {
                  const dayMenuForSubService = buildingMenu.menuData?.[d.date]?.[service.id]?.[subService.id];
                  if (!dayMenuForSubService) return false;

                  // Check deep inside for any array of menu items with length > 0
                  return Object.values(dayMenuForSubService).some((mealPlan: any) =>
                    Object.values(mealPlan).some((subMealPlan: any) => subMealPlan.menuItemIds?.length > 0)
                  );
                });
              });

              // If no sub-services under this service have any data, skip rendering this service entirely to avoid empty headers.
              if (validSubServices.length === 0) return;

              // Now that we know there's data, render the Service Header
              const sRow = worksheet.addRow([`SERVICE: ${service.name.toUpperCase()}`]);
              worksheet.mergeCells(sRow.number, 1, sRow.number, totalColumns);
              sRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 };
              sRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF305496' } };
              sRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
              sRow.height = 30;

              // Loop through ONLY the pre-validated sub-services
              for (const subService of validSubServices) {

                // PRE-CALCULATE ROWS: Find exactly which meal plans have data.
                // This is still needed for grouping and merging the Meal Plan column correctly.
                const validMealPlans: any[] = [];
                for (const mp of mealPlans) {
                  const relevantSmp = subMealPlans.filter(smp => smp.mealPlanId === mp.id);
                  const validSmp = relevantSmp.filter(smp =>
                    dateRange.some(d => buildingMenu.menuData?.[d.date]?.[service.id]?.[subService.id]?.[mp.id]?.[smp.id]?.menuItemIds?.length > 0)
                  );
                  if (validSmp.length > 0) validMealPlans.push({ mealPlan: mp, subMealPlans: validSmp });
                }

                // This check is now a safeguard; it should not be triggered due to the pre-filtering of validSubServices.
                if (validMealPlans.length === 0) continue;

                // Sub-Service Header (Light Blue)
                const ssRow = worksheet.addRow([subService.name]);
                worksheet.mergeCells(ssRow.number, 1, ssRow.number, totalColumns);
                ssRow.getCell(1).font = { bold: true, color: { argb: 'FF2E75B6' }, size: 12 };
                ssRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } };
                ssRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
                ssRow.height = 25;

                // Write Rows and Merge Meal Plan
                for (const { mealPlan, subMealPlans: smpList } of validMealPlans) {
                  let mpStartRowIdx = worksheet.rowCount + 1;
                  let mpRowsAdded = 0;

                  for (const smp of smpList) {
                    const rowValues = [mealPlan.name, smp.name];
                    dateRange.forEach(d => {
                      const items = buildingMenu.menuData?.[d.date]?.[service.id]?.[subService.id]?.[mealPlan.id]?.[smp.id]?.menuItemIds || [];
                      // NO Custom Assignment logic here, just names
                      rowValues.push(items.map((id: string) => getName(id)).join("\n"));
                    });

                    const newRow = worksheet.addRow(rowValues);
                    newRow.eachCell(cell => {
                      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    });
                    mpRowsAdded++;
                  }

                  if (mpRowsAdded > 1) {
                    worksheet.mergeCells(mpStartRowIdx, 1, mpStartRowIdx + mpRowsAdded - 1, 1);
                  }
                }
              }
            });

            worksheet.getColumn(1).width = 20;
            worksheet.getColumn(2).width = 25;
            for (let i = 3; i <= totalColumns; i++) worksheet.getColumn(i).width = 38;
          }

          if (hasSheets) {
            const buffer = await workbook.xlsx.writeBuffer();
            zip.file(`${companyName}.xlsx`, buffer);
          }
        }
      }

      // =========================================================
      // PART B: Generate Master Combined File
      // =========================================================
      const masterWorkbook = new ExcelJS.Workbook();

      for (const service of services) {
        const sheetName = service.name.substring(0, 31).replace(/[\\/?*[\]]/g, "");
        const worksheet = masterWorkbook.addWorksheet(sheetName);

        const assignmentFooterMap = new Map<number, Array<{ itemName: string, buildingIds: Set<string> }>>();

        // 1. Title
        const titleRow = worksheet.addRow([`MASTER COMBINED MENU - ${service.name.toUpperCase()}`]);
        worksheet.mergeCells(titleRow.number, 1, titleRow.number, totalColumns);
        titleRow.getCell(1).font = { size: 16, bold: true, color: { argb: 'FF2F5496' } };
        titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
        titleRow.height = 35;

        // 2. Header Row
        const headerRow = worksheet.addRow(["Meal Plan", "Sub Meal Plan", ...dateHeaders]);
        headerRow.height = 45;
        headerRow.eachCell((cell) => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          cell.border = { top: { style: 'medium' }, left: { style: 'medium' }, bottom: { style: 'medium' }, right: { style: 'medium' } };
        });

        const serviceSubServices = (subServices.get(service.id) || []).sort((a, b) => (a.order || 999) - (b.order || 999));

        for (const subService of serviceSubServices) {

          // PRE-CALCULATE ROWS: Find exactly which meal plans have data
          const validMealPlans: any[] = [];
          for (const mp of mealPlans) {
            const relevantSmp = subMealPlans.filter(smp => smp.mealPlanId === mp.id);
            const validSmp = relevantSmp.filter(smp =>
              dateRange.some(d => menuData?.[d.date]?.[service.id]?.[subService.id]?.[mp.id]?.[smp.id]?.menuItemIds?.length > 0)
            );
            if (validSmp.length > 0) validMealPlans.push({ mealPlan: mp, subMealPlans: validSmp });
          }

          // If this SubService has NO data anywhere, skip it.
          if (validMealPlans.length === 0) continue;

          // 3. Sub-Service Header
          const ssRow = worksheet.addRow([subService.name]);
          worksheet.mergeCells(ssRow.number, 1, ssRow.number, totalColumns);
          ssRow.getCell(1).font = { bold: true, color: { argb: 'FF2E75B6' }, size: 14 };
          ssRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } };
          ssRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
          ssRow.height = 28;

          // 4. Write Data Rows
          for (const { mealPlan, subMealPlans: smpList } of validMealPlans) {
            let mpStartRowIdx = worksheet.rowCount + 1;
            let mpRowsAdded = 0;

            for (const smp of smpList) {
              const rowValues = [mealPlan.name, smp.name];

              dateRange.forEach(({ date }, dateIdx) => {
                const cell = menuData?.[date]?.[service.id]?.[subService.id]?.[mealPlan.id]?.[smp.id];
                const items = cell?.menuItemIds || [];

                // FORMAT MAIN TABLE CELL: "Item Name (X C)"
                const formattedItems = items.map((id: string) => {
                  let name = getName(id);
                  const custom = cell?.customAssignments?.[id];
                  if (custom && Array.isArray(custom) && custom.length > 0) {
                    name = `${name} (${custom.length} C)`; // Main table bracket format

                    // Collect footer assignments
                    if (!assignmentFooterMap.has(dateIdx)) assignmentFooterMap.set(dateIdx, []);
                    const list = assignmentFooterMap.get(dateIdx)!;
                    let entry = list.find(e => e.itemName === getName(id));
                    if (!entry) { entry = { itemName: getName(id), buildingIds: new Set() }; list.push(entry); }
                    custom.forEach((c: any) => entry!.buildingIds.add(c.buildingId));
                  }
                  return name;
                });
                rowValues.push(formattedItems.join("\n"));
              });

              const newRow = worksheet.addRow(rowValues);
              newRow.eachCell(cell => {
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
              });
              mpRowsAdded++;
            }

            // Merge Meal Plan Column (Column A)
            if (mpRowsAdded > 1) {
              worksheet.mergeCells(mpStartRowIdx, 1, mpStartRowIdx + mpRowsAdded - 1, 1);
            }
          }
        }

        // =========================================================
        // FOOTER TABLE (Combined Menu Only)
        // =========================================================
        worksheet.addRow([]); worksheet.addRow([]); // Spacing

        const footerTitleRow = worksheet.addRow(["COMPANY-SPECIFIC ASSIGNMENT DETAILS (EXCEPTIONS)"]);
        worksheet.mergeCells(footerTitleRow.number, 1, footerTitleRow.number, totalColumns);
        footerTitleRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
        footerTitleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC00000' } };
        footerTitleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        footerTitleRow.height = 25;

        const fHeader = worksheet.addRow(["", "Assignment Key", ...dateHeaders]);
        fHeader.eachCell((cell, colNum) => {
          if (colNum > 1) {
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = { bottom: { style: 'medium' }, top: { style: 'thin' } };
          }
        });

        let maxF = 0;
        assignmentFooterMap.forEach(v => { if (v.length > maxF) maxF = v.length; });

        for (let i = 0; i < maxF; i++) {
          const fData = ["", ""];
          dateRange.forEach((_, dIdx) => {
            const list = assignmentFooterMap.get(dIdx) || [];
            if (list[i]) {
              const entry = list[i];
              const bldgIds = Array.from(entry.buildingIds);

              // Format Building Names with Serial Numbers: "1. Building A \n 2. Building B"
              const numberedBuildingsList = bldgIds.map((bId, index) => {
                return `${index + 1}. ${getOnlyBuildingName(bId)}`; // Serial numbers & building name
              }).join("\n");

              // Format Header: "ITEM NAME (X C)"
              const headerWithCount = `${entry.itemName} (${bldgIds.length} C)`;

              fData.push(`${headerWithCount}\n---\n${numberedBuildingsList}`);
            } else {
              fData.push("");
            }
          });
          const fRow = worksheet.addRow(fData);
          fRow.eachCell((cell, colNum) => {
            if (colNum > 2) {
              cell.font = { size: 9 };
              cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
              cell.border = { left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
              if (cell.value) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
            }
          });
        }

        worksheet.getColumn(1).width = 20;
        worksheet.getColumn(2).width = 25;
        for (let i = 3; i <= totalColumns; i++) worksheet.getColumn(i).width = 38;
      }

      const masterBuffer = await masterWorkbook.xlsx.writeBuffer();
      zip.file(`00_Master_Combined_Menu.xlsx`, masterBuffer);

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `Menu-Export-${menu?.startDate}.zip`);
      toast({ title: "Success", description: "Master and company menus generated." });

    } catch (error) {
      console.error("ZIP Generation Error", error);
      toast({ title: "Error", description: "Failed to generate zip.", variant: "destructive" });
    } finally {
      setZipLoading(false);
    }
  };
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center overflow-hidden">

      <div className="bg-white shadow-2xl w-full h-full flex flex-col relative overflow-hidden">

        {/* Header */}
        <div className="border-b p-4 flex-none flex items-center justify-between bg-white z-40">
          <div>
            <h2 className="text-2xl font-bold">
              {isCreateMode ? "Create" : "Edit"} {menuType === "combined" ? "Combined" : "Company"} Menu
            </h2>
            {(menu || isCreateMode) && (
              <p className="text-sm text-gray-600 mt-1">
                {new Date(menu?.startDate || createStartDate || '').toLocaleDateString()} to {new Date(menu?.endDate || createEndDate || '').toLocaleDateString()}
                {isCreateMode && <span className="ml-2 bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">New</span>}
                {!isCreateMode && menu?.status === 'draft' && (<span className="ml-2 bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">Draft</span>)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {copyBuffer && (
              <div className="flex items-center gap-2 px-3 py-1 border rounded bg-yellow-50 text-sm">
                <span className="text-xs">{copyBuffer.items.length} copied</span>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setCopyBuffer(null)}><X className="h-3 w-3" /></Button>
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
              {activeBottomTab === 'menu' && (
                <>
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
                  <div className="border rounded bg-white shadow-sm pb-12">
                    <table className="w-full border-collapse">
                      <thead className="bg-gray-100 sticky top-0 z-20 shadow-sm">
                        <tr>
                          <th className="border border-gray-300 p-2 sticky left-0 z-30 bg-gray-100 min-w-[200px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                            Meal Plan / Sub Meal
                          </th>
                          {dateRange.slice(0, visibleDates).map(({ date, day }) => (
                            <th key={date} className="border border-gray-300 p-2 min-w-[250px] text-left">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-semibold">
                                    {new Date(date).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                    })}
                                  </div>
                                  <div className="text-sm text-gray-600 font-normal">{day}</div>
                                </div>
                                <label className="flex items-center gap-1 cursor-pointer hover:bg-blue-100 p-1 rounded transition-colors whitespace-nowrap flex-shrink-0" title="Exclude this date from update tracking">
                                  <input
                                    type="checkbox"
                                    // onExcludeDate is not defined in MenuEditModal scope. 
                                    // If you need this logic, define `const onExcludeDate = ...` or remove the handler.
                                    onChange={(e) => {
                                      console.log("Exclude date toggled:", date, e.target.checked)
                                    }}
                                    className="h-3.5 w-3.5 text-blue-600 rounded cursor-pointer"
                                  />
                                  <span className="text-xs font-medium text-gray-600">Skip</span>
                                </label>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMealPlanStructure.map(({ mealPlan, subMealPlans: subMPs }) =>
                          subMPs.map((subMealPlan, idx) => {

                            // CALCULATE IF THIS IS AN EXTRA ROW
                            const inStructure = isSubMealPlanInStructure(mealPlan.id, subMealPlan.id);
                            const isExtraRow = !inStructure; // If not in structure, but visible, it's Extra/Custom

                            return (
                              <tr
                                key={`${mealPlan.id}-${subMealPlan.id}`}
                                className={`transition-colors border-b ${isExtraRow
                                    ? "bg-purple-50 border-l-[6px] border-l-purple-600 shadow-inner"
                                    : "hover:bg-gray-50/50"
                                  }`}
                              >
                                {/* ROW HEADER CELL */}
                                <td className={`border-r border-gray-300 p-2 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] align-top ${isExtraRow ? "bg-purple-100/90" : "bg-gray-200"
                                  }`}>
                                  {idx === 0 && <div className="font-bold text-blue-700 mb-1">{mealPlan.name}</div>}

                                  <div className="flex flex-col gap-1 mt-1">
                                    <div className="text-sm text-gray-700 ml-3 font-medium flex items-center gap-2">
                                      ↳ {subMealPlan.name}
                                    </div>

                                    {/* VISUAL BADGE FOR EXTRA ROW */}
                                    {isExtraRow && (
                                      <div className="ml-3 mt-1 flex items-center gap-1 p-1 bg-purple-600 text-white rounded text-[10px] font-bold w-fit shadow-sm animate-in fade-in">
                                        <AlertCircle className="h-3 w-3" />
                                        <span>Custom Added</span>
                                      </div>
                                    )}
                                  </div>
                                </td>

                                {/* DATE CELLS */}
                                {dateRange.slice(0, visibleDates).map(({ date, day }) => {
                                  const cellKey = `${date}-${selectedService.id}-${selectedSubService.id}-${mealPlan.id}-${subMealPlan.id}`
                                  const activeEditorNames = Object.values(activeEditors || {})
                                        .filter((e: any) => e.activeCell === cellKey && e.name !== userName)
                                        .map((e: any) => e.name);

                                  const menuCell = menuData[date]?.[selectedService.id]?.[selectedSubService.id]?.[mealPlan.id]?.[subMealPlan.id]
                                  const choiceMetadata = menuCell?.choiceMetadata || {}
                                  
                                  // CRITICAL: For company menus with choice metadata, filter items to only show those from the choice
                                  let selectedItems: string[] = menuCell?.menuItemIds || []
                                  if (menuType === 'company' && Object.keys(choiceMetadata).length > 0) {
                                    const customAssignments = menuCell?.customAssignments || {}
                                    selectedItems = selectedItems.filter((itemId: string) => {
                                      const itemAssignments = customAssignments[itemId]
                                      // Only show items that were selected by the choice (have isFromChoice: true)
                                      return itemAssignments && Array.isArray(itemAssignments) &&
                                        itemAssignments.some((a: any) => a.isFromChoice === true)
                                    })
                                  }
                                  
                                  const prevItems = prevWeekMap[date]?.[selectedService.id]?.[selectedSubService.id]?.[mealPlan.id]?.[subMealPlan.id] || []

                                  // Get updations relevant to this cell
                                  const cellUpdations = updations.filter(upd =>
                                    upd.changedCells?.some(cell =>
                                      cell.date === date &&
                                      cell.serviceId === selectedService.id &&
                                      cell.mealPlanId === mealPlan.id &&
                                      cell.subMealPlanId === subMealPlan.id
                                    )
                                  )

                                  return (
                                <MenuGridCell
                                      date={date}
                                      day={day}
                                      service={selectedService}
                                      subServiceId={selectedSubService.id}
                                      mealPlan={mealPlan}
                                      menuCell={menuCell}
                                      subMealPlan={subMealPlan}
                                      selectedMenuItemIds={selectedItems}
                                      allMenuItems={menuItems}
                                      liveChanges={liveChanges}
                                      // FIXED: Pass ogMenuData (locked OG baseline) instead of originalMenuData
                                      originalMenuData={ogMenuData}
                                      menuType={menuType}
                                      selectedChoiceItems={selectedChoiceItems}
                                      itemChoiceMarks={menuCell?.itemChoiceMarks || {}}
                                      onUpdateCustomAssignments={(assignments) =>
                                        handleUpdateCustomAssignments(
                                          date,
                                          selectedService.id,
                                          selectedSubService.id,
                                          mealPlan.id,
                                          subMealPlan.id,
                                          assignments
                                        )
                                      }
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
                                        if (dragActive) applyDragToCell(date, mealPlan.id, subMealPlan.id)
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
                                      cellUpdations={cellUpdations}
                                      onShowConflicts={handleAnalyzeConflicts}
                                      liveChanges={liveChanges}
                                      // FIXED: Pass ogMenuData (locked OG baseline) instead of originalMenuData
                                      originalMenuData={ogMenuData}
                                      activeEditorNames={activeEditorNames}
                                    />
                                  )
                                })}
                              </tr>
                            )
                          })
                        )}
                      </tbody>

                    </table>
                    {filteredMealPlanStructure.length === 0 && (
                      <div className="p-8 text-center text-gray-500 italic">No meal plans assigned for this selection.</div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center h-full">
                    <Search className="h-10 w-10 text-gray-300 mb-2" />
                    <p>Select a service from the top bar to begin editing</p>
                  </div>
                )}
              </div>
            </>
          )}

            {activeBottomTab === 'choices' && (
              <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
                {companiesWithChoices.length > 0 ? (
                  <div className="flex flex-col h-full">
                    {/* Building Tabs for Choices */}
                    <div className="shrink-0 bg-white border-b border-gray-200 shadow-sm">
                      <div className="flex items-center px-4 gap-1">
                        <button
                          onClick={() => setChoiceTabIndex((i) => Math.max(0, i - 1))}
                          disabled={choiceTabIndex === 0}
                          className="shrink-0 p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>

                        <div className="flex-1 overflow-x-auto scrollbar-hide">
                          <div className="flex gap-1 py-2">
                            {companiesWithChoices.map((building, idx) => {
                              const isActive = idx === choiceTabIndex
                              return (
                                <div
                                  key={`${building.companyId}-${building.buildingId}`}
                                  className={`
                                    flex flex-col rounded-lg text-sm font-medium
                                    whitespace-nowrap transition-all duration-200 border shrink-0
                                    ${isActive ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300"}
                                  `}
                                >
                                  <button
                                    onClick={() => setChoiceTabIndex(idx)}
                                    className="relative flex items-center justify-between gap-2 px-4 py-2.5 w-full text-left"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Building2 className="h-4 w-4 shrink-0" />
                                      <span className="truncate max-w-[140px]">{building.companyName}</span>
                                      <span className={`text-[10px] ${isActive ? "text-blue-100" : "text-gray-400"}`}>— {building.buildingName}</span>
                                    </div>
                                    {isActive && <span className="absolute -bottom-[1px] left-3 right-3 h-[3px] bg-blue-600 rounded-t-full" />}
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        <button
                          onClick={() => setChoiceTabIndex((i) => Math.min(companiesWithChoices.length - 1, i + 1))}
                          disabled={choiceTabIndex === companiesWithChoices.length - 1}
                          className="shrink-0 p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Active Grid */}
                    <div className="flex-1 overflow-auto bg-gray-100 relative">
                      {companiesWithChoices[choiceTabIndex] && (
                        <BuildingMenuGrid
                          key={`${companiesWithChoices[choiceTabIndex].companyId}-${companiesWithChoices[choiceTabIndex].buildingId}`}
                          building={companiesWithChoices[choiceTabIndex]}
                          dateRange={dateRange}
                          allMenuItems={menuItems}
                          menuData={menuData}
                          mealPlans={mealPlans}
                          subMealPlans={subMealPlans}
                          mealPlanAssignments={mealPlanAssignments}
                          selections={inlineChoiceSelections}
                          setSelections={setInlineChoiceSelections}
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-gray-50">
                    <AlertCircle className="h-12 w-12 text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-700 mb-1">No Choices Available</h3>
                    <p className="text-sm">There are no choices configured for the companies in this menu.</p>
                  </div>
                )}
              </div>
            )}

            {activeBottomTab === 'universal' && (
              <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
                {universalData.building.choices.length > 0 ? (
                  <div className="flex flex-col h-full">
                    <div className="shrink-0 bg-blue-50 border-b border-blue-200 shadow-sm px-4 py-3 flex items-center justify-between">
                       <div className="flex items-center gap-2">
                         <Globe2 className="h-5 w-5 text-blue-600" />
                         <span className="font-semibold text-blue-800">Universal Choices</span>
                         <span className="text-xs text-blue-600 font-medium ml-2 bg-white px-2 py-0.5 rounded-full border border-blue-200">
                           {universalData.building.choices.length} choices across {companiesWithChoices.length} companies
                         </span>
                       </div>
                       <div className="text-xs text-blue-500 font-medium italic flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5" />
                          Changes apply to all {companiesWithChoices.length} associated companies
                       </div>
                    </div>
                    {/* Active Grid */}
                    <div className="flex-1 overflow-auto bg-gray-100 relative">
                        <BuildingMenuGrid
                          key="universal-grid"
                          building={universalData.building}
                          dateRange={dateRange}
                          allMenuItems={menuItems}
                          menuData={menuData}
                          mealPlans={mealPlans}
                          subMealPlans={subMealPlans}
                          mealPlanAssignments={mealPlanAssignments}
                          selections={inlineChoiceSelections}
                          setSelections={setInlineChoiceSelections}
                          isUniversal={true}
                          universalAssociations={universalData.associations}
                        />
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-gray-50">
                    <AlertCircle className="h-12 w-12 text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-700 mb-1">No Choices Configured</h3>
                    <p className="text-sm">There are no choices available to display universally.</p>
                  </div>
                )}
              </div>
            )}
            {activeBottomTab === 'detailed' && (
              <ImportedDetailedDataScreen
  companiesWithChoices={companiesWithChoices}
  services={services}
  subServices={subServices}       // already passed
  mealPlans={mealPlans}
  subMealPlans={subMealPlans}
  menuItems={menuItems}
  menuData={menuData}             // ← add this
  dateRange={dateRange}           // ← add this
  mealPlanAssignments={mealPlanAssignments}  // ← add this
  inlineChoiceSelections={inlineChoiceSelections}  // ← this is the new one  
/>
            )}
            {/* --- BOTTOM TAB BAR --- */}
            
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex-none flex gap-2 justify-between items-center bg-white z-40">
          {/* --- NEW ZIP BUTTON (Only for Combined) --- */}
          {menuType === "combined" && (
            <Button
              variant="outline"
              onClick={handleDownloadZIP}
              disabled={zipLoading || loading}
              className="border-green-300 text-green-700 hover:bg-green-50"
            >
              {zipLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileArchive className="h-4 w-4 mr-2" />}
              ZIP Companies
            </Button>
          )}
          <div className="flex px-4 pt-2 gap-2 z-40  select-none shrink-0">
              <button 
                onClick={() => setActiveBottomTab('menu')}
                className={`px-5 py-2 rounded-t-lg font-semibold text-sm border border-b-0 transition-colors flex flex-col items-center justify-center ${activeBottomTab === 'menu' ? 'bg-white border-gray-300 text-blue-700 shadow-[0_-2px_6px_rgba(0,0,0,0.08)] relative z-10' : 'bg-gray-200/80 border-transparent text-gray-500 hover:bg-gray-200'}`}
                style={{ marginBottom: activeBottomTab === 'menu' ? '-1px' : '0' }}
              >
                Menu Edit
              </button>

 <button 
                onClick={() => setActiveBottomTab('universal')}
                className={`px-5 py-2 rounded-t-lg font-semibold text-sm border border-b-0 transition-colors flex flex-col items-center justify-center ${activeBottomTab === 'universal' ? 'bg-white border-gray-300 text-blue-700 shadow-[0_-2px_6px_rgba(0,0,0,0.08)] relative z-10' : 'bg-gray-200/80 border-transparent text-gray-500 hover:bg-gray-200'} ${companiesWithChoices.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                style={{ marginBottom: activeBottomTab === 'universal' ? '-1px' : '0' }}
                disabled={companiesWithChoices.length === 0}
              >
                 Universal Choices
              </button>
              <button 
                onClick={() => setActiveBottomTab('choices')}
                className={`px-5 py-2 rounded-t-lg font-semibold text-sm border border-b-0 transition-colors flex flex-col items-center justify-center ${activeBottomTab === 'choices' ? 'bg-white border-gray-300 text-blue-700 shadow-[0_-2px_6px_rgba(0,0,0,0.08)] relative z-10' : 'bg-gray-200/80 border-transparent text-gray-500 hover:bg-gray-200'} ${companiesWithChoices.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                style={{ marginBottom: activeBottomTab === 'choices' ? '-1px' : '0' }}
                disabled={companiesWithChoices.length === 0}
              >
                <div className="flex items-center gap-2">
                  Choice Selection
                  {companiesWithChoices.length > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeBottomTab === 'choices' ? 'bg-blue-100 text-blue-700' : 'bg-gray-300 text-gray-600'}`}>{companiesWithChoices.length}</span>
                  )}
                </div>
              </button>
             
              <button 
                onClick={() => setActiveBottomTab('detailed')}
                className={`px-5 py-2 rounded-t-lg font-semibold text-sm border border-b-0 transition-colors flex flex-col items-center justify-center ${activeBottomTab === 'detailed' ? 'bg-white border-gray-300 text-blue-700 shadow-[0_-2px_6px_rgba(0,0,0,0.08)] relative z-10' : 'bg-gray-200/80 border-transparent text-gray-500 hover:bg-gray-200'} ${companiesWithChoices.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                style={{ marginBottom: activeBottomTab === 'detailed' ? '-1px' : '0' }}
                disabled={companiesWithChoices.length === 0}
              >
                Detailed Data Screen
              </button>
            </div>
          {/* ------------------------------------------ */}
          {/* Push to Other Buildings Checkbox - Only show for company-wise menus */}
          {menuType === 'company' && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="pushToOtherBuildings"
                defaultChecked={false}
                onChange={(e) => {
                  // Store in a data attribute or closure - this is handled in executeSave
                  const checkbox = document.getElementById('pushToOtherBuildings') as HTMLInputElement
                  // The executeSave function will read this checkbox's state directly
                }}
                className="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
              />
              <label htmlFor="pushToOtherBuildings" className="text-sm font-medium text-gray-700 cursor-pointer flex items-center gap-2">
                <Building2 className="h-4 w-4 text-purple-600" />
                Apply changes to all {menu?.companyName} buildings
              </label>
            </div>
          )}

          <div className="flex gap-2">
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
                  {isCreateMode ? "Creating..." : "Saving..."}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {isCreateMode
                    ? "Save & Generate Company Menus"
                    : menuType === 'combined' && menu?.status === 'draft'
                      ? "Save & Activate"
                      : "Save Changes"
                  }
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Logs FAB */}
        <div className="absolute bottom-20 right-6 z-[80]">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowLogPanel(!showLogPanel);
            }}
            className="h-12 w-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 border-2 border-white bg-gray-600 hover:bg-gray-700 text-white"
            title="Toggle Repetition Logs"
          >
            <div className="flex flex-col items-center">
              {showLogPanel ? <ChevronDown className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
              {repetitionLog.length > 0 && !showLogPanel && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold">
                  {repetitionLog.length}
                </span>
              )}
            </div>
          </button>
        </div>

        {/* Log Panel */}
        {showLogPanel && (
          <div className="absolute bottom-36 right-4 w-[400px] max-h-[400px] bg-white border border-gray-200 rounded-lg shadow-2xl p-4 animate-in slide-in-from-bottom-5 z-[70] flex flex-col">
            <div className="flex items-center justify-between mb-3 border-b pb-2">
              <div className="font-semibold text-sm flex items-center gap-2 text-gray-800">
                <AlertCircle className="h-4 w-4 text-gray-500" />
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
                      <button onClick={() => removeRepetitionLog(entry.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-3.5 w-3.5" /></button>
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


        {/* NEW DRAWER COMPONENT - KEPT THIS ONE (IT HAS FULL PROPS) */}
        <ConflictDetailsDrawer
          isOpen={conflictDrawerOpen}
          onClose={() => setConflictDrawerOpen(false)}
          analysisData={conflictAnalysisData}
          companies={companies}
          buildings={buildings}
          structureAssignments={allStructureAssignments}
          menuData={menuData}
          dateRange={dateRange}
        />

        {/* CONFIRMATION MODAL COMPONENT */}
        <SubServiceConfirmationModal
          isOpen={showConfirmationModal}
          onClose={() => {
            setShowConfirmationModal(false)
            setPendingSaveAction(null)
          }}
          onConfirm={() => {
            if (pendingSaveAction) {
              executeSave(pendingSaveAction.isDraft)
            }
          }}
          subService={selectedSubService}
          menuData={menuData}
          dateRange={dateRange}
          companies={companies}
          buildings={buildings}
          allStructureAssignments={allStructureAssignments}
          mealPlanAssignments={mealPlanAssignments}
          menuItems={menuItems}
        />

        {/* Choice Selection Modal */}
        {/* Choice Selection Modal */}
        <ChoiceSelectionModal
          isOpen={showChoiceModal}
          onClose={() => {
            setShowChoiceModal(false)
            setPendingSaveAction(null)
            setCompaniesWithChoices([])
            setInitialChoiceSelections({})
          }}
          companies={companiesWithChoices}
          onConfirm={handleChoiceConfirm}
          loading={saving}
          menuData={menuData}
          allMenuItems={menuItems}
          dateRange={dateRange}
          mealPlans={mealPlans}
          subMealPlans={subMealPlans}
          // --- THIS IS THE NEW PROP ---
          mealPlanAssignments={mealPlanAssignments}
          // Pre-filled selections from previously saved choices
          initialSelections={initialChoiceSelections}
        />
      </div>
    </div>
  )
}
