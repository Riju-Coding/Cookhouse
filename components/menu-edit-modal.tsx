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
  Minus,
  ArrowRightLeft,
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

// --- Local Services Definition ---
// --- Types ---
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
const UpdationRecordBadge = ({ updation }: { updation: UpdationRecord }) => {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-gray-700">
        #{updation.updationNumber}
      </span>
      {updation.isCompanyWiseChange && updation.sourcedFromCompanyName ? (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
          <Building2 className="h-3 w-3" />
          {updation.sourcedFromCompanyName}
        </span>
      ) : null}
    </div>
  )
}

interface ItemCompanyAssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  selectedMenuItemIds: string[]
  itemToFocus: string | null
  allMenuItems: MenuItem[]
  defaultAssignedStructures: Array<{ companyId: string; companyName: string; buildingId: string; buildingName: string }>
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
  currentCustomAssignments,
  onSave,
}: ItemCompanyAssignmentModalProps) {
  const [tempAssignments, setTempAssignments] = useState<Record<string, Set<string>>>({})
  const [loading, setLoading] = useState(true)

  const itemMap = useMemo(() => new Map(allMenuItems.map(item => [item.id, item])), [allMenuItems])

  const allStructures = useMemo(() => {
    const uniqueStructures = new Map<string, { companyName: string; buildingName: string }>()
    defaultAssignedStructures.forEach(s => {
      uniqueStructures.set(`${s.companyId}-${s.buildingId}`, { companyName: s.companyName, buildingName: s.buildingName })
    })
    return Array.from(uniqueStructures.entries())
      .map(([key, names]) => ({ key, ...names }))
      .sort((a, b) => a.companyName.localeCompare(b.companyName) || a.buildingName.localeCompare(b.buildingName))
  }, [defaultAssignedStructures])
  
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
  
  const handleSaveAssignments = () => {
    const defaultStructureKeys = new Set(defaultAssignedStructures.map(s => `${s.companyId}-${s.buildingId}`))
    const defaultKeysArray = Array.from(defaultStructureKeys).sort()
    const defaultKeysString = defaultKeysArray.join(',')

    const finalAssignments: MenuCell['customAssignments'] = {}
    
    itemsForModal.forEach(itemId => {
      const assigned = tempAssignments[itemId] || new Set()
      const assignedKeysArray = Array.from(assigned).sort()
      const assignedKeysString = assignedKeysArray.join(',')

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
            <p className="text-sm text-gray-600 mb-4 italic">
              Use this grid to override the default company assignments for items. Items MUST be checked for a structure to receive them.
            </p>
            
            {allStructures.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-gray-500">No companies are assigned to this cell</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="sticky left-0 bg-gray-100 px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider min-w-[180px] z-10 border-r">
                        Company / Building
                      </th>
                      {items.map((item) => (
                        <th
                          key={item.id}
                          className="px-4 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border-r min-w-[120px]"
                        >
                          {item.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {allStructures.map((struct) => (
                      <tr key={struct.key} className="hover:bg-blue-50 transition-colors">
                        <td className="sticky left-0 bg-white px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 border-r z-10 hover:bg-blue-100">
                          <div className="font-semibold text-xs">{struct.companyName}</div>
                          <div className="text-[10px] text-gray-500">{struct.buildingName}</div>
                        </td>
                        {items.map((item) => {
                          const isAssigned = tempAssignments[item.id]?.has(struct.key) || false;

                          return (
                            <td key={item.id} className="px-4 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={isAssigned}
                                onChange={() => handleToggleAssignment(item.id, struct.key)}
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                              />
                            </td>
                          )
                        })}
                      </tr>
                    ))}
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
            disabled={loading || allStructures.length === 0} 
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
                                        className={`flex items-center justify-between px-2 py-1.5 rounded border text-xs font-medium ${
                                          item.isCustom 
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
                    className={`flex items-center gap-2 px-4 py-2 border-t border-r border-l rounded-t-lg text-sm font-medium transition-colors whitespace-nowrap min-w-max relative z-10 ${
                      isActive 
                        ? 'bg-white text-blue-700 border-gray-300 shadow-[0_-2px_4px_rgba(0,0,0,0.05)] border-b-white' 
                        : 'bg-gray-100 text-gray-600 border-transparent border-b-gray-300 hover:bg-gray-50 hover:text-gray-800'
                    }`}
                    style={{ marginBottom: isActive ? '-1px' : '0' }}
                  >
                    <Building2 className={`h-4 w-4 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span>{companyMenu.companyName}</span>
                    <span className="text-xs font-normal text-gray-500 hidden sm:inline-block">- {companyMenu.buildingName}</span>
                    
                    {companyMenu.itemCount > 0 && (
                      <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] ${
                        isActive ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-600'
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
                        className={`transition-colors ${
                          occ.isCurrentCell 
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
                      const referenceDate = currentSelectionDate || (itemAnalysis.occurrences[0]?.date ?? null)
                      const daysOffset = calculateDaysDifference(referenceDate, occ.date)
                      return (
                        <tr 
                          key={oIdx} 
                          className={`transition-colors ${
                            occ.isCurrentCell 
                              ? "bg-yellow-50 border-l-4 border-l-yellow-400"
                              : "hover:bg-gray-50"
                          }`}
                        >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSelectCurrent(occ.date)}
                        className={`cursor-pointer hover:underline font-medium flex-1 ${currentSelectionDate === occ.date ? "text-blue-700" : "text-gray-900"}`}
                      >
                        <div className="font-medium text-gray-900">
                          {new Date(occ.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                        <div className="text-xs text-gray-500">{occ.day}</div>
                      </button>
                      <button
                        onClick={() => handleCompanyIconClick(occ)}
                        className="p-1 hover:bg-gray-200 rounded text-gray-600 hover:text-gray-900"
                        title="View companies"
                      >
                        <Building2 className="h-4 w-4" />
                      </button>
                    </div>
                    {occ.isCurrentCell && (
                      <span className="text-[10px] font-bold text-yellow-700 mt-1 block">
                        (Current Cell)
                      </span>
                    )}
                  </td>
                          <td className="px-4 py-3">
                            <div className={`font-bold text-center ${daysOffset === 0 ? "text-blue-700 bg-blue-100 rounded px-2 py-1" : daysOffset > 0 ? "text-green-700" : "text-orange-700"}`}>
                              {daysOffset > 0 ? "+" : ""}{daysOffset}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-gray-900 font-medium">{occ.serviceName}</div>
                            <div className="text-xs text-gray-500">{occ.subServiceName}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-gray-900 font-medium">{occ.mealPlanName || 'N/A'}</div>
                            <div className="text-xs text-gray-500">{occ.subMealPlanName || 'N/A'}</div>
                          </td>
                        </tr>
                      )
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

// --- NEW: Timeline Entry Component ---
const TimelineEntry = memo(function TimelineEntry({
  label,
  labelColor,
  labelBg,
  itemName,
  action,
  dateStr,
  hasCustomAssignment,
  companyNames,
}: {
  label: string
  labelColor: string
  labelBg: string
  itemName: string
  action: "added" | "removed" | "replaced" | "live-added" | "live-removed"
  dateStr?: string
  hasCustomAssignment?: boolean
  companyNames?: string[]
}) {
  const actionConfig = {
    "added": { icon: <Plus className="h-2.5 w-2.5" />, color: "text-green-700", bg: "bg-green-50", borderColor: "border-green-200", actionLabel: "Added", dotColor: "bg-green-500" },
    "removed": { icon: <Minus className="h-2.5 w-2.5" />, color: "text-red-700", bg: "bg-red-50", borderColor: "border-red-200", actionLabel: "Removed", dotColor: "bg-yellow-400" },
    "replaced": { icon: <ArrowRightLeft className="h-2.5 w-2.5" />, color: "text-orange-700", bg: "bg-orange-50", borderColor: "border-orange-200", actionLabel: "Replaced", dotColor: "bg-orange-500" },
    "live-added": { icon: <Plus className="h-2.5 w-2.5" />, color: "text-green-700", bg: "bg-green-50", borderColor: "border-green-200", actionLabel: "Added", dotColor: "bg-green-500" },
    "live-removed": { icon: <Minus className="h-2.5 w-2.5" />, color: "text-red-700", bg: "bg-red-50", borderColor: "border-red-200", actionLabel: "Removed", dotColor: "bg-yellow-400" },
  }
  
  const config = actionConfig[action] || actionConfig["added"]

  return (
    <div className="mb-1.5 relative">
      <div className={`absolute left-[-11px] top-1.5 w-1.5 h-1.5 ${config.dotColor} rounded-full border ${config.dotColor === "bg-yellow-400" ? "border-yellow-300" : config.dotColor === "bg-green-500" ? "border-green-400" : "border-orange-400"}`}></div>
      <div className="flex flex-wrap items-center gap-1">
        {/* Updation label - only show if not empty */}
        {label && <span className={`inline-block ${labelBg} ${labelColor} px-1 py-0 rounded text-[8px] font-black`}>{label}</span>}
        
        {/* Action badge - ALWAYS VISIBLE */}
        <span className={`inline-flex items-center gap-0.5 ${config.bg} ${config.color} px-1 py-0 rounded text-[8px] font-bold border ${config.borderColor} whitespace-nowrap`}>
          {config.icon}
          {config.actionLabel}
        </span>
        
        {/* Company-wise tag - ALWAYS VISIBLE IF HAS CUSTOM ASSIGNMENT */}
        {(hasCustomAssignment || (companyNames && companyNames.length > 0)) && (
          <span className="inline-flex items-center gap-0.5 bg-purple-100 text-purple-700 px-1 py-0 rounded text-[8px] font-bold border border-purple-200 whitespace-nowrap">
            <Building2 className="h-2 w-2" />
            Multi-Building
          </span>
        )}
      </div>
      
      {/* Item name - special handling for replaced items showing "old → new" */}
      {action === "replaced" && itemName.includes("→") ? (
        <div className="text-xs font-semibold mt-0.5 break-words">
          <span className="text-gray-400 line-through">{itemName.split("→")[0].trim()}</span>
          <span className="text-gray-500 mx-1">→</span>
          <span className="text-green-700">{itemName.split("→")[1].trim()}</span>
        </div>
      ) : (
        <div className={`text-xs font-semibold mt-0.5 break-words ${action === "removed" || action === "live-removed" ? "text-gray-500 line-through" : "text-gray-800"}`}>
          {itemName}
        </div>
      )}
      
      {/* Company/Building names - DISPLAY ALL AFFECTED BUILDINGS */}
      {companyNames && companyNames.length > 0 && (
        <div className="flex flex-wrap gap-0.5 mt-0.5">
          {companyNames.map((name, i) => (
            <span key={i} className="inline-flex items-center gap-0.5 bg-purple-50 text-purple-600 px-1 py-0 rounded text-[7px] font-medium border border-purple-100">
              <Building2 className="h-1.5 w-1.5" />
              {name}
            </span>
          ))}
        </div>
      )}
      
      {/* Date */}
      {dateStr && <div className="text-[10px] text-gray-400 mt-0.5 whitespace-nowrap">{dateStr}</div>}
    </div>
  )
})

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
    externalCompanyChangedItems // <--- (Keep this if you added it earlier)
  }: {
    
    date: string
    day: string
    service: Service
    subServiceId: string
    mealPlan: MealPlan
    menuCell?: MenuCell
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
    cellUpdations?: any[]
    onExcludeItem?: (itemId: string, exclude: boolean) => void
    onExcludeDate?: (date: string, exclude: boolean) => void
    onExcludeMealPlan?: (mealPlanKey: string, exclude: boolean) => void
    onUpdateCustomAssignments?: (assignments: MenuCell['customAssignments']) => void // <--- AND MAKE SURE IT IS HERE IN THE TYPES!
    externalCompanyChangedItems?: Set<string>
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
    const [liveChanges, setLiveChanges] = useState<Record<string, any[]>>({})
    const dropdownRef = useRef<HTMLDivElement>(null)
    

    

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
      onAddItem(itemId)
      
      // Track live change
      const cellKey = `${date}|${service.id}|${mealPlan.id}|${subMealPlan.id}`
      const itemName = allMenuItems.find(m => m.id === itemId)?.name || itemId
      setLiveChanges(prev => ({
        ...prev,
        [cellKey]: [...(prev[cellKey] || []), { action: "added", itemName, itemId }]
      }))
      
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
    const cellKey = `${date}|${service.id}|${mealPlan.id}|${subMealPlan.id}`
    const currentLiveChanges = liveChanges[cellKey] || []
    const hasLiveChanges = currentLiveChanges.length > 0
    const hasUpdations = cellUpdations && cellUpdations.length > 0
    const hasTimeline = hasLiveChanges || hasUpdations
    
    // NEW: Get removed items from company-wise changes to display them
    const removedCompanyWiseItems = currentLiveChanges
      .filter(c => c.action === "removed" && c.editedInCompanyWise && !selectedMenuItemIds.includes(c.itemId))
      .map(c => c.itemId)
      
    const itemsToRender = Array.from(new Set([...selectedMenuItemIds, ...removedCompanyWiseItems]))
  
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
          {cellLogs.length > 0 && !isActive && (
             <div className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 z-10"></div>
          )}

          <div className="flex flex-col h-full min-h-[60px]">
            <div className="flex-1 space-y-1">
              {itemsToRender.map((itemId) => {
                const isRemoved = !selectedMenuItemIds.includes(itemId)
                const item = allMenuItems.find((i) => i.id === itemId)
                const hasError = cellLogs.some(log => log.itemId === itemId)
                // Check if this item has custom company assignments (current state)
                const hasCustomAssignment = menuCell?.customAssignments && menuCell.customAssignments[itemId]
                const isItemExcluded = excludedItems.has(itemId)

                // Debug: Log when item is not found
                if (!item) {
                  return null
                }
                return (
                  <div key={itemId} className="space-y-1">
                    <div
                      className={`group relative flex items-center justify-between border px-1.5 py-0.5 rounded text-xs transition-colors
                          ${isItemExcluded
                              ? "bg-yellow-50 border-yellow-200 text-yellow-800 opacity-75"
                              : hasError 
                              ? "bg-red-100 border-red-200 text-red-800" 
                              : "bg-blue-50/50 hover:bg-blue-100 border-transparent hover:border-blue-200 text-gray-700"
                          }
                      `}
                    >
                      <span className="truncate font-medium leading-tight" title={item?.name || `Item: ${itemId}`}>{item?.name || `Item (${itemId.slice(0, 8)})`}</span>
                      <div className="flex items-center gap-0.5 ml-1">
                        {hasCustomAssignment && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setItemToFocus(itemId)
                              setShowAssignmentModal(true)
                            }}
                            className="p-0.5 rounded hover:bg-purple-100 transition-colors flex-shrink-0"
                            title="View custom company assignment"
                          >
                            <Building2 className="h-3 w-3 text-purple-600" />
                          </button>
                        )}
                        {isActive && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleExcludeItem(itemId)
                              }}
                              className={`p-0.5 rounded transition-colors flex-shrink-0 ${
                                isItemExcluded 
                                  ? "bg-yellow-200 text-yellow-700" 
                                  : "opacity-0 group-hover:opacity-100 hover:bg-yellow-100 text-yellow-600"
                              }`}
                              title="Exclude from update tracking"
                            >
                              <X className="h-3 w-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                onRemoveItem(itemId)
                                
                                // Don't track removals in live changes - only additions are tracked
                              }}
                              className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 flex-shrink-0"
                              title="Remove item"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ===== ENHANCED UPDATE TIMELINE ===== */}
            {hasTimeline && (
              <div className="mt-2 ml-2 border-l-2 border-yellow-300 pl-3 py-1">
                
                {/* Live Changes - Show ADDED items currently in cell, and REMOVED items that were removed */}
                {currentLiveChanges.length > 0 && (
                  <>
                    {(() => {
                      // Deduplicate: if an item was added then removed in same session, only show the remove
                      const itemStates = new Map<string, { action: string; change: any }>()
                      
                      currentLiveChanges.forEach(change => {
                        const existing = itemStates.get(change.itemId)
                        if (!existing) {
                          itemStates.set(change.itemId, { action: change.action, change })
                        } else if (existing.action === "added" && change.action === "removed") {
                          // Item was added then removed - show as removed only
                          itemStates.set(change.itemId, { action: "removed", change })
                        } else if (existing.action === "removed" && change.action === "added") {
                          // Item was removed then re-added - show as added
                          itemStates.set(change.itemId, { action: "added", change })
                        }
                      })
                      
                      // Filter and render the final state
                      return Array.from(itemStates.values())
                        .filter(({ action, change }) => {
                          // For "added" items, SHOW if item IS currently in cell (user just added it and hasn't saved yet)
                          if (action === "added") return selectedMenuItemIds.includes(change.itemId)
                          // For "removed" items, SHOW only if item is NOT in cell (user removed it)
                          if (action === "removed") return !selectedMenuItemIds.includes(change.itemId)
                          return false
                        })
                        .map(({ change, action }, idx) => {
                          const hasCustom = change.hasCustomAssignment || false
                          const cNames = change.companyNames || []
                          
                          // Check if item still has custom assignments even when removed
                          const itemStillHasCustom = menuCell?.customAssignments && menuCell.customAssignments[change.itemId]
                          const finalHasCustom = action === "removed" ? itemStillHasCustom : hasCustom
                          
                          // Determine label based on final action in this session
                          const labelText = action === "removed" ? "REMOVED (This Session)" : "ADDED (This Session)"
                          const labelBgColor = action === "removed" ? "bg-red-500" : "bg-green-500"
                          
                          return (
                            <TimelineEntry
                              key={`live-${change.itemId}-${idx}`}
                              label={labelText}
                              labelColor="text-white"
                              labelBg={labelBgColor}
                              itemName={change.itemName}
                              action={change.action === "removed" ? "live-removed" : "live-added"}
                              hasCustomAssignment={finalHasCustom}
                              companyNames={cNames}
                            />
                          )
                        })
                    })()}
                  </>
                )}

                {/* Saved Updations - Latest First, show ALL change types */}
                {cellUpdations && [...cellUpdations].reverse().map((upd, revIdx) => {
                  const totalUpdations = cellUpdations.length
                  const updIdx = totalUpdations - revIdx - 1

                  const relevantCellChange = upd.changedCells
                    ?.find((cell: any) => cell.date === date && cell.serviceId === service.id && cell.mealPlanId === mealPlan.id && cell.subMealPlanId === subMealPlan.id)

                  const relevantChanges = relevantCellChange?.changes || []
                  if (relevantChanges.length === 0) return null

                  const updDate = new Date(upd.createdAt)
                  const dateStr = updDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
                  
                  // Check if this updation was sourced from a company-wise menu
                  const isFromCompanyWise = upd.isCompanyWiseChange && upd.sourcedFromCompanyName
                  const sourcedCompanyName = upd.sourcedFromCompanyName || null
                  const sourcedBuildingName = upd.sourcedFromBuildingName || null
                  const appliedBuildingInfo = upd.appliedBuildingInfo || []
                  const appliedMultipleBuildings = upd.appliedToAllBuildings && upd.otherBuildingsCount > 0

                  // Generate a single label for all buildings in this update
                  let updationLabel = `U${updIdx + 1}`
                  if (isFromCompanyWise && sourcedCompanyName) {
                    if (appliedMultipleBuildings && appliedBuildingInfo.length > 0) {
                      // Show all affected buildings: "U1 - Company (Bldg1, Bldg2, Bldg3)"
                      const buildingNames = appliedBuildingInfo.map(b => b.buildingName).join(', ')
                      updationLabel = `U${updIdx + 1} - ${sourcedCompanyName} (${buildingNames})`
                    } else {
                      // Show single building: "U1 - Company (Building)"
                      updationLabel = `U${updIdx + 1} - ${sourcedCompanyName}${sourcedBuildingName ? ` (${sourcedBuildingName})` : ''}`
                    }
                  }

                  // Build array of valid changes to render (filter out nulls first)
                  const validChanges: any[] = []
                  
                  relevantChanges.forEach((ch: any, chIdx: number) => {
                    let action: "added" | "removed" | "replaced" = ch.action || "added"
                    let itemName = ""
                    let itemId = ""
                    let hasCustom = false
                    let cNames: string[] = []

                    // If this updation is from a company-wise change, add all affected company buildings to the display
                    // Use enriched data from the change itself first, fallback to updation-level data
                    if (ch.companyName && ch.buildingName) {
                      cNames = [`${ch.companyName} - ${ch.buildingName}`]
                    } else if (isFromCompanyWise && appliedBuildingInfo.length > 0) {
                      cNames = appliedBuildingInfo.map(b => `${sourcedCompanyName} - ${b.buildingName}`)
                    }

                    if (action === "replaced") {
                      const oldItemId = ch.itemId
                      const newItemId = ch.replacedWith
                      const oldName = ch.itemName || allMenuItems.find(m => m.id === oldItemId)?.name || oldItemId
                      const newName = ch.replacedWithName || allMenuItems.find(m => m.id === newItemId)?.name || newItemId
                      itemName = `${oldName} → ${newName}`
                      itemId = oldItemId
                      
                      const oldCustom = ch.oldCustomAssignments || ch.customAssignments
                      const newCustom = ch.newCustomAssignments
                      hasCustom = !!(oldCustom || newCustom)
                      
                      if (oldCustom && Array.isArray(oldCustom) && !isFromCompanyWise) {
                        cNames = oldCustom.map((a: any) => {
                          const c = companies.find(co => co.id === a.companyId)
                          return c?.name || a.companyId
                        })
                      }

                      if (selectedMenuItemIds.includes(newItemId || oldItemId)) return
                    } else if (action === "added") {
                      itemId = ch.replacedWith || ch.itemId
                      const resolvedName = ch.itemName || ch.replacedWithName || allMenuItems.find(m => m.id === itemId)?.name || itemId
                      const isCompanyWiseChange = ch.itemName && (ch.itemName.includes('Added to') || ch.itemName.includes('Company'))
                      itemName = isCompanyWiseChange ? ch.itemName : resolvedName
                      
                      const addedCustom = ch.customAssignments || ch.newCustomAssignments
                      hasCustom = !!(addedCustom && Array.isArray(addedCustom) && addedCustom.length > 0)
                      if (hasCustom && !isFromCompanyWise) {
                        cNames = addedCustom.map((a: any) => {
                          const c = companies.find(co => co.id === a.companyId)
                          return c?.name || a.companyId
                        })
                      }
                    } else if (action === "removed") {
                      itemId = ch.itemId
                      const resolvedName = ch.itemName || allMenuItems.find(m => m.id === itemId)?.name || itemId
                      const isCompanyWiseChange = ch.itemName && (ch.itemName.includes('Removed from') || ch.itemName.includes('Company'))
                      itemName = isCompanyWiseChange ? ch.itemName : resolvedName
                      
                      const removedCustom = ch.customAssignments || ch.oldCustomAssignments
                      hasCustom = !!(removedCustom && Array.isArray(removedCustom) && removedCustom.length > 0)
                      if (hasCustom && !isFromCompanyWise) {
                        cNames = removedCustom.map((a: any) => {
                          const c = companies.find(co => co.id === a.companyId)
                          return c?.name || a.companyId
                        })
                      }

                      if (!isCompanyWiseChange && selectedMenuItemIds.includes(itemId)) return
                    }

                    if (!itemName) return

                    validChanges.push({
                      action,
                      itemName,
                      itemId,
                      hasCustom,
                      cNames,
                      chIdx
                    })
                  })

                  // Now render: show label only once per update, then all changes
                  if (validChanges.length === 0) return null
                  
                  return validChanges.map((changeData: any, renderIdx: number) => (
                    <TimelineEntry
                      key={`upd-${upd.id}-${changeData.chIdx}`}
                      label={renderIdx === 0 ? updationLabel : ""}
                      labelColor={isFromCompanyWise ? "text-white" : "text-white"}
                      labelBg={isFromCompanyWise ? (appliedMultipleBuildings ? "bg-purple-600" : "bg-blue-500") : "bg-yellow-500"}
                      itemName={changeData.itemName}
                      action={changeData.action}
                      dateStr={renderIdx === 0 ? dateStr : undefined}
                      hasCustomAssignment={changeData.hasCustom}
                      companyNames={changeData.cNames}
                    />
                  ))
                })}

                {/* Original Item (OG) - From first updation, show what was originally there */}
                {cellUpdations && cellUpdations.length > 0 && (() => {
                  const firstUpd = cellUpdations[0]
                  const firstCellChange = firstUpd.changedCells
                    ?.find((cell: any) => cell.date === date && cell.serviceId === service.id && cell.mealPlanId === mealPlan.id && cell.subMealPlanId === subMealPlan.id)
                  
                  const firstChanges = firstCellChange?.changes || []
                  
                  // Get original items (items that were replaced or removed in the first update)
                  const ogEntries = firstChanges
                    .filter((ch: any) => (ch.action === "replaced" || ch.action === "removed"))
                    .map((ch: any) => {
                      const ogItemId = ch.itemId
                      const ogItemName = allMenuItems.find(m => m.id === ogItemId)?.name || ogItemId
                      
                      // Skip if this item is still in the cell
                      if (selectedMenuItemIds.includes(ogItemId)) return null
                      
                      // Check if original item had custom assignments
                      const ogCustom = ch.oldCustomAssignments || ch.customAssignments
                      const hasCustom = !!(ogCustom && Array.isArray(ogCustom) && ogCustom.length > 0)
                      const cNames = hasCustom
                        ? ogCustom.map((a: any) => {
                            const c = companies.find(co => co.id === a.companyId)
                            return c?.name || a.companyId
                          })
                        : []
                      
                      return { ogItemName, hasCustom, cNames }
                    })
                    .filter(Boolean)

                  if (ogEntries.length === 0) return null

                  const ogDate = new Date(firstUpd.createdAt)
                  const ogDateStr = ogDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })

                  return ogEntries.map((entry: any, idx: number) => (
                    <TimelineEntry
                      key={`og-${idx}`}
                      label="OG"
                      labelColor="text-yellow-900"
                      labelBg="bg-yellow-300"
                      itemName={entry.ogItemName}
                      action="removed"
                      dateStr={ogDateStr}
                      hasCustomAssignment={entry.hasCustom}
                      companyNames={entry.cNames}
                    />
                  ))
                })()}
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
                                            setEditingCompanyId(comp.companyId)
                                            setIsCompanyWiseModalOpen(true)
                                            setIsCompanyOpen(false)
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
                    className={`p-1.5 rounded transition-colors ${
                      selectedMenuItemIds.length > 0 ? "hover:bg-green-100 text-green-600" : "text-gray-300"
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
              console.log("[v0] ItemDescriptionModal - onSaveDescription called with itemId:", itemId, "selectedMenuItemIds:", selectedMenuItemIds)
              await menuItemsService.addDescriptions(itemId, descriptions)
              await menuItemsService.setSelectedDescription(itemId, selectedDescription)
            }}
          />

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
            currentCustomAssignments={menuCell?.customAssignments || {}}
            onSave={(assignments) => {
              console.log("[v0] Saving custom assignments via state update:", assignments)
              onUpdateCustomAssignments?.(assignments)
              setShowAssignmentModal(false)
              setItemToFocus(null)
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

  // CONFIRMATION MODAL STATE
  const [showConfirmationModal, setShowConfirmationModal] = useState(false)
  const [pendingSaveAction, setPendingSaveAction] = useState<{ isDraft: boolean } | null>(null)

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
        const filteredMenuItems = menuItemsData.sort((a, b) => (a.order || 999) - (b.order || 999))

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

        // Load updations for showing history
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
              updationNumber: idx + 1,
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
    // 1. Filter out logs associated with blank/empty item names immediately
    const validLogs = cellLogs.filter(l => {
        const item = menuItems.find(i => i.id === l.itemId);
        return item?.name && item.name.trim().length > 0;
    });

    if (validLogs.length === 0) {
        setConflictAnalysisData([]);
        return; 
    }

    // 2. Identify unique items from valid logs
    const conflictItemIds = Array.from(new Set(validLogs.map(l => l.itemId)));
    
    // 3. Scan the menu for strict repetitions
    const analysis = conflictItemIds.map(itemId => {
        const item = menuItems.find(i => i.id === itemId);
        if (!item || !item.name || item.name.trim() === "") return null;

        const occurrences: any[] = [];

        // Scan ALL dates to find where this item appears
        dateRange.forEach(({ date, day }) => {
            const dayData = menuData[date];
            if (!dayData) return;

            // Strict Path Matching
            const sId = currentContext.serviceId;
            const ssId = currentContext.subServiceId;
            const mpId = currentContext.mealPlanId;
            const smpId = currentContext.subMealPlanId;

            const cell = dayData[sId]?.[ssId]?.[mpId]?.[smpId];

            if (cell?.menuItemIds?.includes(itemId)) {
                // Found an occurrence
                const serviceName = services.find(s => s.id === sId)?.name;
                const subServiceName = subServices.get(sId)?.find(ss => ss.id === ssId)?.name;
                const mealPlanName = mealPlans.find(m => m.id === mpId)?.name;
                const subMealPlanName = subMealPlans.find(s => s.id === smpId)?.name;

                // Get company assignments for the table/popup
                const dayKey = day.toLowerCase();
                const companyAssignments: any[] = [];
                
                allStructureAssignments?.forEach((assignment: any) => {
                    const company = companies?.find((c: any) => c.id === assignment.companyId);
                    const building = buildings?.find((b: any) => b.id === assignment.buildingId);
                    if (!company || !building) return;
                    
                    const dayStructure = assignment.weekStructure?.[dayKey] || [];
                    const serviceInDay = dayStructure.find((s: any) => s.serviceId === sId);
                    if (!serviceInDay) return;
                    
                    const subServiceInDay = serviceInDay.subServices?.find((ss: any) => ss.subServiceId === ssId);
                    if (!subServiceInDay) return;
                    
                    const mealPlanInDay = subServiceInDay.mealPlans?.find((mp: any) => mp.mealPlanId === mpId);
                    if (!mealPlanInDay) return;
                    
                    const subMealPlanInDay = mealPlanInDay.subMealPlans?.find((smp: any) => smp.subMealPlanId === smpId);
                    if (!subMealPlanInDay) return;
                    
                    companyAssignments.push({
                        companyId: assignment.companyId,
                        companyName: company.name,
                        buildingId: assignment.buildingId,
                        buildingName: building.name
                    });
                });

                occurrences.push({
                    date,
                    day,
                    serviceName,
                    subServiceName,
                    mealPlanName,
                    subMealPlanName,
                    companyAssignments, // Important for the table
                    isCurrentCell: date === currentContext.date
                });
            }
        });

        // Always return data so drawer opens (even if count is 1 temporarily)
        return {
            itemId,
            itemName: item.name,
            totalCount: occurrences.length,
            occurrences
        };
    }).filter(Boolean); 

    setConflictAnalysisData(analysis);
    setConflictDrawerOpen(true);
  }, [menuData, dateRange, menuItems, services, subServices, allStructureAssignments, companies, buildings]);
  

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

      // Rule: Check different date in same path
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
    [selectedSubService, menuData, dateRange, prevWeekMap, services, subServices, subMealPlans, menuItems, addRepetitionLog],
  )

  const handleRemoveItem = useCallback(
    async (date: string, serviceId: string, mealPlanId: string, subMealPlanId: string, itemId: string) => {
       if (!selectedSubService) return;
       const currentSubServiceId = selectedSubService.id;

      // 1. Update the Menu Data (Visual Removal)
      setMenuData((prev: any) => {
        const updated = JSON.parse(JSON.stringify(prev))
        const cell = updated[date]?.[serviceId]?.[currentSubServiceId]?.[mealPlanId]?.[subMealPlanId]
        const items = cell?.menuItemIds
        if (items) {
          const idx = items.indexOf(itemId)
          if (idx > -1) items.splice(idx, 1)
        }
        // Preserve customAssignments when removing item
        if (cell?.customAssignments && cell.customAssignments[itemId]) {
          delete cell.customAssignments[itemId]
        }
        return updated
      })

      // 2. INTELLIGENT LOG CLEANUP
      
      // Count how many times this item currently exists in the ENTIRE week for this specific path
      let totalCountInWeek = 0;
      
      // --- FIX: Loop properly closed here ---
      dateRange.forEach((d) => {
         const cellItems = menuData[d.date]?.[serviceId]?.[currentSubServiceId]?.[mealPlanId]?.[subMealPlanId]?.menuItemIds || [];
         if (cellItems.includes(itemId)) {
             totalCountInWeek++;
         }
      });
      // --------------------------------------

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
          logsKeysToDelete.push(JSON.stringify({ type: l.type, itemId: l.itemId, attemptedDate: l.attemptedDate, serviceId: l.serviceId, subServiceId: l.subServiceId, mealPlanId: l.mealPlanId, subMealPlanId: l.subMealPlanId }));
      });

      // B. ORPHAN CHECK: If remaining count is <= 1, it means the item is now Unique (or gone).
      // So, we must delete ALL logs for this item in this Service/MealPlan, because they are no longer conflicts.
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
                  logsKeysToDelete.push(JSON.stringify({ type: l.type, itemId: l.itemId, attemptedDate: l.attemptedDate, serviceId: l.serviceId, subServiceId: l.subServiceId, mealPlanId: l.mealPlanId, subMealPlanId: l.subMealPlanId }));
              }
          });
      }

      // 3. Execute Deletion
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
    [selectedSubService, repetitionLog, menuType, menuData, dateRange],
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
                  const sourceCell = combinedMenu[date][serviceId][subService.subServiceId][mealPlanId]?.[subMealPlanId]

                  if (sourceCell) {
                    const allItemIds = sourceCell.menuItemIds || []
                    const customAssignments = sourceCell.customAssignments || {}

                    // Filter items based on custom assignments
                    const filteredItemIds = allItemIds.filter((itemId: string) => {
                      const itemCustom = customAssignments[itemId]

                      if (itemCustom && Array.isArray(itemCustom) && itemCustom.length > 0) {
                        // This item has custom assignments -
                        // only include if THIS company+building is in the list
                        return itemCustom.some(
                          (assignment: any) =>
                            assignment.companyId === company.id &&
                            assignment.buildingId === building.id
                        )
                      }

                      // No custom assignment = default behavior (include for all assigned companies)
                      return true
                    })

                    // Only create the cell if there are items for this company
                    if (filteredItemIds.length > 0) {
                      companyMenuData[date][serviceId][subService.subServiceId][mealPlanId][subMealPlanId] = {
                        menuItemIds: filteredItemIds,
                        // Preserve selectedDescriptions if they exist
                        ...(sourceCell.selectedDescriptions
                          ? { selectedDescriptions: sourceCell.selectedDescriptions }
                          : {}),
                        // Don't copy customAssignments to company menus - they're only relevant at combined level
                      }
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

  const handleSave = async (isDraft = false) => {
    if (!menu) return
    
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

  const executeSave = async (isDraft = false) => {
    if (!menu) return

    try {
      setSaving(true)
      const collectionName = menuType === "combined" ? "combinedMenus" : "companyMenus"
      const docRef = doc(db, collectionName, menuId)
      const statusToSave = isDraft ? "draft" : menu.status
      
      // Read the push-to-other-buildings checkbox state from DOM
      const pushToOtherBuildingsCheckbox = document.getElementById('pushToOtherBuildings') as HTMLInputElement
      const pushToOtherBuildings = pushToOtherBuildingsCheckbox?.checked || false

      const shouldSyncCompanyMenus = menuType === "combined" && !isDraft;

      const menuItemsMap = new Map(menuItems.map((item) => [item.id, item.name]))
      const changedCells = detectMenuChanges(originalMenuData, menuData, menuItemsMap)

      await updateDoc(docRef, {
        menuData: JSON.parse(JSON.stringify(menuData)),
        status: shouldSyncCompanyMenus ? "active" : statusToSave, 
        updatedAt: new Date(),
      })

      if (shouldSyncCompanyMenus) {
        toast({ title: "Syncing company menus...", description: "Updating existing menus and creating new ones." })
        
        const filtered: any = {}
        Object.entries(menuData).forEach(([date, dayMenu]: [string, any]) => {
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

        const count = await generateCompanyMenus(menuId, filtered)
        toast({ title: "Sync Complete", description: `Updated/Created ${count} company menus.` })
      }

      // 4. Record Updation if active and changed
      if (!isDraft && changedCells.length > 0) {
        // This is the missing variable that caused the crash!
        const changeSummary = createChangeSummary(changedCells)
        
        if (menuType === "company" && menu.combinedMenuId) {
          const combinedLatestNumber = await updationService.getLatestUpdationNumber(menu.combinedMenuId) || 0
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

          // 2. Update combined menu document with company-specific change tracking
          try {
            const combinedMenuRef = doc(db, "combinedMenus", menu.combinedMenuId)
            
            const companyChangeData = {
              companyId: menu.companyId,
              companyName: menu.companyName,
              buildingId: menu.buildingId, 
              buildingName: menu.buildingName,
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
                  const result: Array<{companyId: string, buildingId: string}> = []
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

          const combinedUpdationRecord: any = {
            menuId: menu.combinedMenuId,
            menuType: "combined",
            menuName: "Combined Menu",
            updationNumber: combinedLatestNumber + 1,
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

          const companyLatestNumber = await updationService.getLatestUpdationNumber(menuId) || 0
          const companyUpdationRecord: any = {
            menuId: menuId,
            menuType: "company",
            menuName: menu.companyName ? `${menu.companyName} - ${menu.buildingName}` : "Company Menu",
            updationNumber: companyLatestNumber + 1,
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
          
        } else if (menuType === "combined") {
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

          await addDoc(collection(db, "updations"), updationRecord)
        }
      } else if (menuType === "combined") {
          // Explicitly define changeSummary here for the combined menu
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

          await addDoc(collection(db, "updations"), updationRecord)
        }
      

      toast({
        title: "Success",
        description: isDraft ? "Saved as Draft" : "Menu updated successfully.",
      })

      setPendingSaveAction(null)
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

    // For company-wise menus, filter assignments to only the current company
    const relevantAssignments = menuType === "company" && menu?.companyId 
      ? mealPlanAssignments.filter((assignment: any) => assignment.companyId === menu.companyId)
      : mealPlanAssignments

    return mealPlanStructure.map(({ mealPlan, subMealPlans: subMPs }) => {
      const visibleSubMealPlans = subMPs.filter(subMealPlan => {
        return dateRange.some(({ day }) => {
          const dayKey = day.toLowerCase()
          return relevantAssignments.some(assignment => {
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
  }, [mealPlanStructure, dateRange, mealPlanAssignments, selectedService, selectedSubService, menuType, menu?.companyId])

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
                                      onChange={(e) => {
                                        const mealPlanKey = `${date}`
                                        onExcludeDate?.(mealPlanKey, e.target.checked)
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
                            subMPs.map((subMealPlan, idx) => (
                              <tr key={`${mealPlan.id}-${subMealPlan.id}`} className="hover:bg-gray-50/50">
                                <td className="border border-gray-300 bg-gray-200 p-2 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] align-top">
                                  {idx === 0 && <div className="font-bold text-blue-700 mb-1">{mealPlan.name}</div>}
                                  <div className="text-sm text-gray-700 ml-3">↳ {subMealPlan.name}</div>
                                </td>
                                {dateRange.slice(0, visibleDates).map(({ date, day }) => {
                                  const cellKey = `${date}-${selectedService.id}-${selectedSubService.id}-${mealPlan.id}-${subMealPlan.id}`
                                  const menuCell = menuData[date]?.[selectedService.id]?.[selectedSubService.id]?.[mealPlan.id]?.[subMealPlan.id]
                                  const selectedItems: string[] = menuCell?.menuItemIds || []
                                  
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
      key={cellKey}
      
      date={date}
      day={day}
      service={selectedService}
      subServiceId={selectedSubService.id}
      mealPlan={mealPlan}
      menuCell={menuCell}
      subMealPlan={subMealPlan}
      selectedMenuItemIds={selectedItems}
      allMenuItems={menuItems}
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
                                      cellUpdations={cellUpdations}
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
          <div className="border-t p-4 flex-none flex gap-2 justify-between items-center bg-white z-40">
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

      </div>
    </div>
  )
}