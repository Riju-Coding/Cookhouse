"use client"

import React, { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Badge } from "@/components/ui/badge"
import { ArrowDown } from "lucide-react"
import {
  CheckCircle2,
  X,
  AlertCircle,
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Utensils,
  ArrowRightLeft,
  Link2,
  Globe2,
} from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { calculateFrequencyViolations } from "@/lib/frequency-validator"
import { FrequencyViolationsAlert } from "@/components/frequency-violations-alert"

// --- Interfaces ---
interface MenuItem {
  id: string
  name: string
}

interface MealPlan {
  id: string
  name: string
  order?: number
}

interface SubMealPlan {
  id: string
  name: string
  mealPlanId: string
  order?: number
  maxFrequency?: number
}

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
}

interface SubMealSelection {
  mealPlanId: string
  mealPlanName: string
  subMealPlanId: string
  subMealPlanName: string
  selectedItemId: string
  selectedItemName: string
}

interface CompanyChoice {
  companyId: string
  companyName: string
  buildingId: string
  buildingName: string
  choices: MealPlanChoice[]
}

type SelectionMap = Record<string, SubMealSelection[]>

export interface ChoiceConfirmData {
  selections: SelectionMap
  selectedChoiceItems: Record<string, string[]> // Maps itemId -> array of choice keys (e.g., "companyId-buildingId-choiceId")
}

interface ChoiceSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  companies: CompanyChoice[]
  onConfirm: (data: ChoiceConfirmData) => void
  loading?: boolean
  menuData?: Record<string, any>
  allMenuItems?: MenuItem[]
  dateRange?: Array<{ date: string; day: string }>
  mealPlans?: MealPlan[]
  subMealPlans?: SubMealPlan[]
  mealPlanAssignments?: any[]
  initialSelections?: SelectionMap // Pre-filled selections from saved choices
}

export function ChoiceSelectionModal({
  isOpen,
  onClose,
  companies,
  onConfirm,
  loading = false,
  menuData = {},
  allMenuItems = [],
  dateRange = [],
  mealPlans = [],
  subMealPlans = [],
  mealPlanAssignments = [],
  initialSelections = {},
}: ChoiceSelectionModalProps) {
  // CRITICAL: Deep clone initialSelections to prevent state sharing with parent
  const [selections, setSelections] = useState<SelectionMap>(() => 
    JSON.parse(JSON.stringify(initialSelections))
  )
  const [activeTabIndex, setActiveTabIndex] = useState(0)
  // Track selection count per choice to enforce quantity limits
  const [choiceSelectionCounts, setChoiceSelectionCounts] = useState<Record<string, number>>({})

  const hasAnySelection = useMemo(
    () => Object.values(selections).some((items) => items.length > 0),
    [selections]
  )

  const totalSelections = useMemo(
    () => Object.values(selections).flat().length,
    [selections]
  )

  // Calculate frequency violations
  const frequencyStatus = useMemo(() => {
    return calculateFrequencyViolations(selections, subMealPlans as any)
  }, [selections, subMealPlans])

  const getTabSelectionCount = (building: CompanyChoice) =>
    Object.entries(selections)
      .filter(([key]) =>
        key.startsWith(`${building.companyId}-${building.buildingId}-`)
      )
      .reduce((sum, [, arr]) => sum + arr.length, 0)

  // Per-building, per-day choice completion stats
  const getBuildingChoiceProgress = (building: CompanyChoice) => {
    // Group choices by day
    const dayMap = new Map<string, { total: number; completed: number }>()
    building.choices.forEach((c: any) => {
      const day = c.choiceDay?.toLowerCase() || ''
      if (!dayMap.has(day)) dayMap.set(day, { total: 0, completed: 0 })
      const entry = dayMap.get(day)!
      entry.total++
      // Check if this choice is fully completed
      const key = `${building.companyId}-${building.buildingId}-${c.choiceId}`
      const selected = (selections[key] || []).length
      if (selected >= c.quantity) entry.completed++
    })
    return dayMap
  }

  const activeBuilding = companies[activeTabIndex] || companies[0]

  // When modal opens/reopens, if there are initial selections, deep clone them
  React.useEffect(() => {
    if (isOpen && Object.keys(initialSelections).length > 0) {
      setSelections(JSON.parse(JSON.stringify(initialSelections)))
    }
  }, [isOpen, initialSelections])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="!max-w-none !w-screen !h-screen max-h-screen flex flex-col gap-0 p-0 rounded-none m-0 translate-x-0 translate-y-0 left-0 top-0 fixed">
        {/* ─── Header ─── */}
        <DialogHeader className="px-6 py-4 border-b border-gray-200 bg-white shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold text-gray-900">
                Weekly Menu — Choice Selection
              </DialogTitle>
              <p className="text-sm text-gray-500 mt-1">
                Full menu view. Highlighted cells require a choice — click an
                item to select.
              </p>
            </div>
            <Badge
              variant="secondary"
              className="text-sm px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200"
            >
              {totalSelections} selected
            </Badge>
          </div>
        </DialogHeader>

        {/* ─── Frequency Violations Warning ─── */}
        {frequencyStatus.hasViolations && (
          <FrequencyViolationsAlert violations={frequencyStatus.violations} />
        )}

        {/* ─── Building Tabs ─── */}
        <div className="shrink-0 bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center px-4 gap-1">
            <button
              onClick={() => setActiveTabIndex((i) => Math.max(0, i - 1))}
              disabled={activeTabIndex === 0}
              className="shrink-0 p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex-1 overflow-x-auto scrollbar-hide">
              <div className="flex gap-1 py-2">
                {companies.map((building, idx) => {
                  const isActive = idx === activeTabIndex
                  const choiceProgress = getBuildingChoiceProgress(building)
                  const totalAllChoices = building.choices.length
                  const completedAllChoices = Array.from(choiceProgress.values()).reduce((s, d) => s + d.completed, 0)
                  const hasAnyChoices = totalAllChoices > 0
                  // Build day summary string
                  const daySummaryParts = Array.from(choiceProgress.entries())
                    .map(([day, stats]) => ({
                      label: day ? (day.charAt(0).toUpperCase() + day.slice(1, 3)) : '?',
                      completed: stats.completed,
                      total: stats.total,
                      isDone: stats.completed === stats.total,
                    }))
                  return (
                    <div
                      key={`${building.companyId}-${building.buildingId}`}
                      className={`
                        flex flex-col rounded-lg text-sm font-medium
                        whitespace-nowrap transition-all duration-200 border shrink-0
                        ${
                          isActive
                            ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200"
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                        }
                      `}
                    >
                      <button
                        onClick={() => setActiveTabIndex(idx)}
                        className="relative flex items-center justify-between gap-2 px-4 py-2.5 w-full text-left"
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 shrink-0" />
                          <span className="truncate max-w-[140px]">
                            {building.companyName}
                          </span>
                          <span
                            className={`text-[10px] ${
                              isActive ? "text-blue-100" : "text-gray-400"
                            }`}
                          >
                            — {building.buildingName}
                          </span>
                          {hasAnyChoices && (
                            <span
                              className={`
                                ml-1 text-[10px] font-bold rounded-full min-w-[18px] h-[18px]
                                flex items-center justify-center px-1.5
                                ${
                                  completedAllChoices === totalAllChoices
                                    ? isActive ? "bg-green-400 text-white" : "bg-green-100 text-green-700"
                                    : isActive
                                      ? "bg-white/90 text-blue-600"
                                      : "bg-amber-100 text-amber-700"
                                }
                              `}
                            >
                              {completedAllChoices}/{totalAllChoices}
                            </span>
                          )}
                        </div>
                        {isActive && (
                          <span className="absolute -bottom-[1px] left-3 right-3 h-[3px] bg-blue-600 rounded-t-full" />
                        )}
                      </button>

                      {/* Sub-header for Day-by-day stats in building card (Horizontal alignment) */}
                      {hasAnyChoices && daySummaryParts.length > 0 && (
                        <div className={`px-4 pb-2 pt-1.5 flex flex-wrap items-center gap-1 text-[10px] border-t ${
                          isActive ? 'bg-blue-700/20 border-white/10' : 'bg-gray-50 border-gray-100'
                        }`}>
                          {(() => {
                            // Sort correctly based on Mon-Sun order
                            const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
                            const sortedParts = [...daySummaryParts].sort((a, b) => {
                              const idA = DAY_ORDER.indexOf(a.label.toLowerCase())
                              const idB = DAY_ORDER.indexOf(b.label.toLowerCase())
                              return (idA === -1 ? 99 : idA) - (idB === -1 ? 99 : idB)
                            })
                            
                            return sortedParts.map((dp, i) => (
                              <span key={i} className="flex items-center">
                                <span className="font-medium" style={{ color: isActive ? 'hsl(210, 100%, 90%)' : 'hsl(210, 10%, 30%)' }}>
                                  {dp.label}
                                  <span className="font-medium ml-0.5" style={{ color: dp.isDone ? 'hsl(120, 60%, 40%)' : isActive ? 'hsl(210, 100%, 80%)' : 'hsl(210, 10%, 50%)' }}>
                                    ({dp.completed}/{dp.total})
                                  </span>
                                </span>
                                {i < sortedParts.length - 1 && (
                                  <span className="font-light mx-1.5" style={{ color: isActive ? 'hsla(210, 100%, 80%, 0.4)' : 'hsl(210, 10%, 70%)' }}>|</span>
                                )}
                              </span>
                            ))
                          })()}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <button
              onClick={() =>
                setActiveTabIndex((i) =>
                  Math.min(companies.length - 1, i + 1)
                )
              }
              disabled={activeTabIndex === companies.length - 1}
              className="shrink-0 p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ─── Active Grid ─── */}
        <div className="flex-1 overflow-hidden bg-gray-100">
          {activeBuilding && (
            <BuildingMenuGrid
              key={`${activeBuilding.companyId}-${activeBuilding.buildingId}`}
              building={activeBuilding}
              dateRange={dateRange}
              allMenuItems={allMenuItems}
              menuData={menuData}
              mealPlans={mealPlans}
              subMealPlans={subMealPlans}
              mealPlanAssignments={mealPlanAssignments}
              selections={selections}
              setSelections={setSelections}
            />
          )}
        </div>

        {/* ─── Footer ─── */}
        <DialogFooter className="px-6 py-4 border-t border-gray-200 bg-white shrink-0 flex items-center justify-between sm:justify-between">
          <div className="text-xs text-gray-400">
            Building {activeTabIndex + 1} of {companies.length}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                // Clean up selections: Remove any entries with undefined values
                const cleanedSelections: SelectionMap = {}
                Object.entries(selections).forEach(([key, items]) => {
                  const validItems = items.filter(item => 
                    item && 
                    item.selectedItemId !== undefined && 
                    item.subMealPlanId !== undefined
                  )
                  if (validItems.length > 0) {
                    cleanedSelections[key] = validItems
                  }
                })
                
                // Build choice items map for marking in company-wise menu
                const selectedChoiceItems: Record<string, string[]> = {}
                Object.entries(cleanedSelections).forEach(([key, items]) => {
                  items.forEach((item) => {
                    const itemId = item.selectedItemId
                    if (!selectedChoiceItems[itemId]) {
                      selectedChoiceItems[itemId] = []
                    }
                    selectedChoiceItems[itemId].push(key) // Store the choice key
                  })
                })
                
                // Pass both selections and choice items info
                const result: ChoiceConfirmData = {
                  selections: cleanedSelections,
                  selectedChoiceItems: selectedChoiceItems
                }
                onConfirm(result)
              }}
              disabled={!hasAnySelection || loading}
            >
              {loading && <Spinner className="mr-2 h-4 w-4" />}
              Confirm ({totalSelections} Selections)
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Building Menu Grid — grouped by Service → Sub-Service
   ═══════════════════════════════════════════════════════════════ */

interface ServiceGroup {
  serviceId: string
  serviceName: string
  subServiceId: string
  subServiceName: string
  rows: Array<{
    mealPlanId: string
    mealPlanName: string
    subMealPlanId: string
    subMealPlanName: string
    order: number
  }>
}





export function BuildingMenuGrid({
  building,
  dateRange,
  allMenuItems,
  menuData,
  mealPlans,
  subMealPlans,
  mealPlanAssignments,
  selections,
  setSelections,
  isUniversal = false,
  universalAssociations = null,
}: any) {
  const menuItemMap = useMemo(
    () => new Map(allMenuItems.map((item: any) => [item.id, item])),
    [allMenuItems]
  )

  /* ═══════════════════════════════════════════════════
     ✦ NEW — Map each choiceId to a palette entry
     ═══════════════════════════════════════════════════ */
  const choiceColorMap = useMemo(() => {
    const map = new Map<string, any>()
    const ids = [...new Set(building.choices.map((c: any) => c.choiceId))]
    const total = ids.length
    
    ids.forEach((id: string, i: number) => {
      // distribute hue 0-360 evenly
      const hue = Math.round((360 / Math.max(1, total)) * i)
      
      map.set(id, {
        primary: `hsl(${hue}, 85%, 45%)`,
        lightBg: `hsla(${hue}, 85%, 50%, 0.1)`,
        selectedBg: `hsla(${hue}, 85%, 50%, 0.15)`,
        text: `hsl(${hue}, 90%, 30%)`
      })
    })
    return map
  }, [building.choices])

    const serviceGroups: ServiceGroup[] = useMemo(() => {
    // If Universal, we don't strict match assignments against the building, just pool them directly or rely on the fact that building.choices is already aggregated
    const assignment = isUniversal ? null : mealPlanAssignments?.find(
      (a: any) =>
        a.companyId === building.companyId &&
        a.buildingId === building.buildingId
    )
    if (!assignment?.weekStructure && !isUniversal) return []

    const groupMap = new Map<string, ServiceGroup>()
    const rowSeen = new Map<string, Set<string>>()

    // For universal, build structure directly from the aggregated choices since no single assignment covers everything
    if (isUniversal) {
       building.choices.forEach((c: any) => {
          const serviceId = c.serviceId || 'unknown'
          const subServiceId = c.subServiceId || 'unknown'
          const gKey = `${serviceId}|${subServiceId}`
          
          if (!groupMap.has(gKey)) {
             let sName = "Unified Service"
             let ssName = "Unified Sub-Service"
             
             // Extract true names from assignments cross-reference
             if (mealPlanAssignments) {
               for (const a of mealPlanAssignments) {
                 if (a.weekStructure) {
                   for (const dayArr of Object.values(a.weekStructure)) {
                     for (const s of (dayArr as any[])) {
                       if (s.serviceId === serviceId) {
                         sName = s.serviceName || sName
                         for (const ss of (s.subServices || [])) {
                           if (ss.subServiceId === subServiceId) {
                             ssName = ss.subServiceName || ssName
                             break
                           }
                         }
                         break
                       }
                     }
                   }
                 }
               }
             }

             groupMap.set(gKey, {
                 serviceId,
                 serviceName: sName,
                 subServiceId,
                 subServiceName: ssName,
                 rows: []
             })
             rowSeen.set(gKey, new Set())
          }
          const group = groupMap.get(gKey)!
          const seen = rowSeen.get(gKey)!

          c.mealPlans.forEach((mp: any) => {
             mp.subMealPlans.forEach((smp: any) => {
                const rKey = `${mp.mealPlanId}|${smp.subMealPlanId}`
                if (!seen.has(rKey)) {
                   seen.add(rKey)
                   const mpInfo = mealPlans.find((m: any) => m.id === mp.mealPlanId)
                   const smpInfo = subMealPlans.find((s: any) => s.id === smp.subMealPlanId)
                   group.rows.push({
                      mealPlanId: mp.mealPlanId,
                      mealPlanName: mpInfo?.name || mp.mealPlanName || "Unknown MP",
                      subMealPlanId: smp.subMealPlanId,
                      subMealPlanName: smpInfo?.name || smp.subMealPlanName || "Unknown SMP",
                      order: mpInfo?.order ?? 999
                   })
                }
             })
          })
       })
       for (const g of groupMap.values()) {
         g.rows.sort((a, b) => a.order - b.order)
       }
       return Array.from(groupMap.values())
    }

    // NORMAL BUILDING LOGIC
    dateRange.forEach(({ day }: any) => {
      const dayKey = day.toLowerCase()
      const services = assignment.weekStructure[dayKey] || []

      services.forEach((service: any) => {
        service.subServices?.forEach((subService: any) => {
          const gKey = `${service.serviceId}|${subService.subServiceId}`

          if (!groupMap.has(gKey)) {
            groupMap.set(gKey, {
              serviceId: service.serviceId,
              serviceName: service.serviceName || "Service",
              subServiceId: subService.subServiceId,
              subServiceName: subService.subServiceName || "Sub-Service",
              rows: [],
            })
            rowSeen.set(gKey, new Set())
          }

          const group = groupMap.get(gKey)!
          const seen = rowSeen.get(gKey)!

          subService.mealPlans?.forEach((mp: any) => {
            mp.subMealPlans?.forEach((smp: any) => {
              const rKey = `${mp.mealPlanId}|${smp.subMealPlanId}`
              if (!seen.has(rKey)) {
                seen.add(rKey)
                const mpInfo = mealPlans.find(
                  (m: any) => m.id === mp.mealPlanId
                )
                const smpInfo = subMealPlans.find(
                  (s: any) => s.id === smp.subMealPlanId
                )
                group.rows.push({
                  mealPlanId: mp.mealPlanId,
                  mealPlanName:
                    mpInfo?.name || mp.mealPlanName || "Unknown MP",
                  subMealPlanId: smp.subMealPlanId,
                  subMealPlanName:
                    smpInfo?.name || smp.subMealPlanName || "Unknown SMP",
                  order: mpInfo?.order ?? 999,
                })
              } 
            })
          })
        })
      })
    })

    for (const g of groupMap.values()) {
      g.rows.sort((a, b) => a.order - b.order)
    }

    // ✦ FIXED — Filter groups based on actual choice assignments for this specific service/sub-service
    return Array.from(groupMap.values()).filter((group) => {
      // Only show service groups that have choices specifically assigned to this service/sub-service
      return building.choices.some((c: any) =>
        (c.serviceId === group.serviceId || !c.serviceId) && // Match service or legacy choices
        (c.subServiceId === group.subServiceId || !c.subServiceId) && // Match sub-service or legacy choices
        c.mealPlans.some((mp: any) =>
          mp.subMealPlans.some((smp: any) =>
            group.rows.some(
              (row: any) =>
                mp.mealPlanId === row.mealPlanId &&
                smp.subMealPlanId === row.subMealPlanId
            )
          )
        )
      )
    })
  }, [building, dateRange, mealPlanAssignments, mealPlans, subMealPlans, isUniversal])

  /* ── helpers ── */
  const getCellItems = (
    date: string,
    serviceId: string,
    subServiceId: string,
    mealPlanId: string,
    subMealPlanId: string
  ) => {
    const cell =
      menuData?.[date]?.[serviceId]?.[subServiceId]?.[mealPlanId]?.[
        subMealPlanId
      ]
    if (!cell?.menuItemIds) return []
    return cell.menuItemIds
      .map((id: string) => menuItemMap.get(id))
      .filter(Boolean)
  }

  /* ═══════════════════════════════════════════════════
     ✦ NEW — Pool ALL items across ALL sub-meals in a choice
     ═══════════════════════════════════════════════════ */
  const getAllItemsForChoice = (
    date: string,
    choice: any,
    group: ServiceGroup
  ) => {
    const allItems = new Map<string, any>()
    choice.mealPlans.forEach((mp: any) => {
      mp.subMealPlans.forEach((smp: any) => {
        const items = getCellItems(
          date,
          group.serviceId,
          group.subServiceId,
          mp.mealPlanId,
          smp.subMealPlanId
        )
        items.forEach((item: any) => allItems.set(item.id, item))
      })
    })
    return Array.from(allItems.values())
  }

  const getChoicesForCell = (
    date: string,
    mealPlanId: string,
    subMealPlanId: string,
    serviceId?: string,
    subServiceId?: string
  ) => {
    const day = dateRange.find((d: any) => d.date === date)?.day
    return building.choices.filter(
      (c: any) =>
        c.choiceDay?.toLowerCase() === day?.toLowerCase() &&
        (serviceId ? c.serviceId === serviceId : true) && 
        (subServiceId ? c.subServiceId === subServiceId : true) && 
        c.mealPlans.some(
          (mp: any) =>
            mp.mealPlanId === mealPlanId &&
            mp.subMealPlans.some(
              (smp: any) => smp.subMealPlanId === subMealPlanId
            )
        )
    )
  }

  const toggleSelection = (choiceId: string, row: any, item: any) => {
    const choice = building.choices.find((c: any) => c.choiceId === choiceId)
    if (!choice) return

    if (isUniversal && universalAssociations) {
      const associatedBuildings = universalAssociations.get(choiceId) || [];
      if (associatedBuildings.length === 0) return;

      setSelections((prev: any) => {
        const nextState = { ...prev };
        
        // Define key for the first building to check its state
        const firstBuilding = associatedBuildings[0];
        const firstChoiceId = firstBuilding.originalChoiceId || choiceId;
        const firstKey = `${firstBuilding.companyId}-${firstBuilding.buildingId}-${firstChoiceId}`;
        const currentFirst = prev[firstKey] || [];
        
        const existingIdx = currentFirst.findIndex(
          (s: any) => s.subMealPlanId === row.subMealPlanId && s.selectedItemId === item.id
        );
        const isTogglingOff = existingIdx >= 0;

        associatedBuildings.forEach((b: any) => {
          const actualChoiceId = b.originalChoiceId || choiceId;
          const bKey = `${b.companyId}-${b.buildingId}-${actualChoiceId}`;
          const current = nextState[bKey] || [];

          if (isTogglingOff) {
             const bExistingIdx = current.findIndex((s: any) => s.subMealPlanId === row.subMealPlanId && s.selectedItemId === item.id);
             if (bExistingIdx >= 0) {
                 const next = [...current];
                 next.splice(bExistingIdx, 1);
                 nextState[bKey] = next;
             }
          } else {
             if (current.length < choice.quantity) {
               const selectedElsewhere = current.some((s: any) => s.selectedItemId === item.id);
               if (!selectedElsewhere) {
                 nextState[bKey] = [
                   ...current,
                   {
                     mealPlanId: row.mealPlanId,
                     mealPlanName: row.mealPlanName,
                     subMealPlanId: row.subMealPlanId,
                     subMealPlanName: row.subMealPlanName,
                     selectedItemId: item.id,
                     selectedItemName: item.name,
                   }
                 ]
               }
             }
          }
        });
        return nextState;
      });
      return;
    }

    const key = `${building.companyId}-${building.buildingId}-${choiceId}`
    
    setSelections((prev: any) => {
      const current = prev[key] || []
      
      // Check if this item is already selected in THIS cell
      const existingIdx = current.findIndex(
        (s: any) => s.subMealPlanId === row.subMealPlanId && s.selectedItemId === item.id
      )
      
      if (existingIdx >= 0) {
        // Remove it (toggle off)
        const next = [...current]
        next.splice(existingIdx, 1)
        return { ...prev, [key]: next }
      } else {
        // Add it (toggle on)
        // Check if we reached the choice limit
        if (current.length >= choice.quantity) {
          console.warn(`[v0] Choice limit reached`)
          return prev
        }
        
        // Prevent adding if it's already selected in ANOTHER cell of this choice
        const selectedElsewhere = current.some((s: any) => s.selectedItemId === item.id)
        if (selectedElsewhere) {
          return prev
        }

        return {
          ...prev,
          [key]: [
            ...current,
            {
              mealPlanId: row.mealPlanId,
              mealPlanName: row.mealPlanName,
              subMealPlanId: row.subMealPlanId,
              subMealPlanName: row.subMealPlanName,
              selectedItemId: item.id,
              selectedItemName: item.name,
            },
          ],
        }
      }
    })
  }

  /* ── Per-choice selection status (selected count vs limit) ── */
  const choiceSelectionStatus = useMemo(() => {
    const status: Record<string, { selected: number; limit: number; isAtLimit: boolean }> = {}
    building.choices.forEach((c: any) => {
      const key = `${building.companyId}-${building.buildingId}-${c.choiceId}`
      const selected = (selections[key] || []).length
      status[c.choiceId] = {
        selected,
        limit: c.quantity,
        isAtLimit: selected >= c.quantity,
      }
    })
    return status
  }, [building, selections])

  /* ── Count choices in this building ── */
  const choiceDayCount = useMemo(() => {
    const days = new Set(
      building.choices.map((c: any) => c.choiceDay?.toLowerCase())
    )
    return days.size
  }, [building.choices])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Building info bar — always visible at top */}
      <div className="shrink-0 px-6 pt-5 pb-3 bg-gray-100">
        {/* Building info bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center shadow">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {building.companyName}
              </h3>
              <p className="text-xs text-gray-500">{building.buildingName}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge
              variant="outline"
              className="border-amber-300 text-amber-700 bg-amber-50"
            >
              {choiceDayCount} Choice Day{choiceDayCount !== 1 && "s"}
            </Badge>
            <Badge
              variant="outline"
              className="border-gray-300 text-gray-600 bg-white"
            >
              {serviceGroups.length} Service Group
              {serviceGroups.length !== 1 && "s"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Service group tables — each gets its own scroll container */}
      <div className="flex-1 overflow-auto bg-gray-100 px-6 pb-6 space-y-6">
        {serviceGroups.length > 0 ? (
          serviceGroups.map((group) => (
            <div
              key={`${group.serviceId}-${group.subServiceId}`}
              className="rounded-xl border border-gray-200 shadow-sm flex flex-col bg-white"
              style={{ isolation: 'isolate', minWidth: 'max-content' }}
            >
              {/* ── Service / Sub-Service header — sticky at top of this group's scroll area ── */}
              <div className="sticky top-0 z-[40] bg-gradient-to-r from-slate-700 to-slate-800 px-5 py-3 flex items-center gap-3 shrink-0 rounded-t-xl">
                <div className="h-8 w-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                  <Utensils className="h-4 w-4 text-white" />
                </div>
                <div className="text-white">
                  <h4 className="font-bold text-sm leading-tight">
                    {group.serviceName}
                  </h4>
                  <p className="text-[11px] text-slate-300">
                    {group.subServiceName}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <Badge className="bg-white/15 text-white border-none text-[10px]">
                    {group.rows.length} meal plans
                  </Badge>
                  {group.rows.some((row: any) =>
                    dateRange.some((d: any) =>
                      getChoicesForCell(d.date, row.mealPlanId, row.subMealPlanId, group.serviceId, group.subServiceId).length > 0
                    )
                  ) && (
                    <div className="text-[10px] text-white bg-white/20 px-2 py-1 rounded-md">
                      <span className="font-semibold">
                        {Object.entries(selections)
                          .filter(([key]) => key.includes(building.buildingId))
                          .reduce((sum, [, arr]) => sum + arr.length, 0)}/{" "}
                        {group.rows.length}
                      </span>{" "}
                      selected
                    </div>
                  )}
                </div>
              </div>

              {/* ── Scrollable table area — scrolls horizontally AND vertically ── */}
              <table
                className="border-collapse bg-white"
                style={{ minWidth: "max-content", width: "100%" }}
              >
                <thead className="sticky top-[56px] z-30 shadow-sm">
                  <tr className="bg-gray-50">
                    <th className="sticky left-0 z-[35] bg-gray-50 border-b-2 border-r-2 border-gray-300 px-5 py-3 text-left min-w-[240px]">
                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                        Meal Plan / Sub Meal Plan
                      </span>
                    </th>
                    {dateRange.map((d: any) => {
                      // Gather all choices for this day + service/sub-service
                      const dayChoices = building.choices.filter(
                        (c: any) =>
                          c.choiceDay?.toLowerCase() === d.day.toLowerCase() &&
                          (c.serviceId === group.serviceId || !c.serviceId) &&
                          (c.subServiceId === group.subServiceId || !c.subServiceId)
                      )
                      const hasChoice = dayChoices.length > 0

                      // Compute live counter: completed choices / total choices
                      const completedChoices = dayChoices.filter((c: any) => {
                        const status = choiceSelectionStatus[c.choiceId]
                        return status && status.selected >= status.limit
                      }).length
                      const totalChoices = dayChoices.length

                      return (
                        <th
                          key={d.date}
                          className={`
                            border-b-2 border-r border-gray-300 px-4 py-3 text-center min-w-[240px]
                            ${hasChoice ? "bg-amber-50" : "bg-gray-50"}
                          `}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="text-xs font-bold text-gray-700 uppercase">
                              {d.day}
                            </span>
                            {hasChoice && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                completedChoices === totalChoices
                                  ? 'bg-green-200 text-green-800'
                                  : 'bg-amber-200 text-amber-800'
                              }`}>
                                ({completedChoices}/{totalChoices})
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            {d.date}
                          </div>
                          {/* Choice summary horizontal slider */}
                          {hasChoice && (
                            <div className="mt-2 w-full max-w-[220px] mx-auto overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                              <div className="flex gap-2 w-max px-1 pt-1">
                                {dayChoices.map((c: any, ci: number) => {
                                  const status = choiceSelectionStatus[c.choiceId]
                                  // Resolve SMP names from subMealPlans collection (not stale choice data)
                                  const smpNames = c.mealPlans
                                    .flatMap((mp: any) => mp.subMealPlans.map((s: any) => {
                                      const freshSmp = subMealPlans.find((smp: any) => smp.id === s.subMealPlanId)
                                      return freshSmp?.name || s.subMealPlanName || 'SMP'
                                    }))
                                    .join(', ')
                                  const cc = choiceColorMap.get(c.choiceId)
                                  return (
                                    <div
                                      key={c.choiceId}
                                      className="text-[10px] w-[140px] shrink-0 p-1.5 rounded border-l-4 shadow-sm text-left bg-white"
                                      style={cc ? { backgroundColor: cc.lightBg, borderLeftColor: cc.primary } : { borderLeftColor: '#e5e7eb' }}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-bold" style={{ color: cc?.text || '#374151' }}>C{ci + 1}</span>
                                        <span className={`font-bold px-1 rounded text-[9px] ${
                                          status && status.selected >= status.limit
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-gray-100 text-gray-600'
                                        }`}>
                                          ({status?.selected || 0}/{status?.limit || 0})
                                        </span>
                                      </div>
                                      <div className="text-gray-500 mt-1 truncate font-medium" title={smpNames}>
                                        {smpNames}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </th>
                      )
                    })}
                  </tr>
                </thead>

                <tbody>
                  {(() => {
                    // ═══════════════════════════════════════════════════════════
                    // ✦ MERGED ROWS — Group rows that share the same choice
                    // ═══════════════════════════════════════════════════════════
                    type MergedRow = {
                      type: 'choice' | 'plain'
                      rows: typeof group.rows
                      choiceIds?: string[]
                    }

                    // Helper: resolve fresh SMP name from subMealPlans collection
                    const resolveSmpName = (subMealPlanId: string, fallback: string) => {
                      const freshSmp = subMealPlans.find((s: any) => s.id === subMealPlanId)
                      return freshSmp?.name || fallback
                    }

                    const mergedRows: MergedRow[] = []

                    // Step 1: Compute choice connections (Edges between rows)
                    const rowAdj = new Map<number, Set<number>>()
                    group.rows.forEach((row, rIdx) => {
                      if (!rowAdj.has(rIdx)) rowAdj.set(rIdx, new Set())
                    })

                    dateRange.forEach((d: any) => {
                      const choiceMap = new Map<string, number[]>()
                      group.rows.forEach((row, rIdx) => {
                        const chs = getChoicesForCell(d.date, row.mealPlanId, row.subMealPlanId, group.serviceId, group.subServiceId)
                        chs.forEach((ch: any) => {
                          if (!choiceMap.has(ch.choiceId)) choiceMap.set(ch.choiceId, [])
                          choiceMap.get(ch.choiceId)!.push(rIdx)
                        })
                      })
                      choiceMap.forEach(rIdxs => {
                        for (let i = 0; i < rIdxs.length; i++) {
                          for (let j = i + 1; j < rIdxs.length; j++) {
                            rowAdj.get(rIdxs[i])!.add(rIdxs[j])
                            rowAdj.get(rIdxs[j])!.add(rIdxs[i])
                          }
                        }
                      })
                    })

                    // Step 2: Extract Connected Components
                    const visited = new Set<number>()
                    const components: number[][] = []

                    group.rows.forEach((row, rIdx) => {
                      if (visited.has(rIdx)) return

                      const comp: number[] = []
                      const q = [rIdx]
                      visited.add(rIdx)

                      while (q.length > 0) {
                        const curr = q.shift()!
                        comp.push(curr)
                        rowAdj.get(curr)!.forEach(neighbor => {
                          if (!visited.has(neighbor)) {
                            visited.add(neighbor)
                            q.push(neighbor)
                          }
                        })
                      }
                      
                      comp.sort((a,b) => a - b)
                      components.push(comp)
                    })

                    // Step 3: Build merged rows
                    const mergedRowIndices = new Set<number>()
                    components.forEach(comp => {
                      let componentHasAnyChoice = false;
                      comp.forEach(rIdx => {
                         if (rowAdj.get(rIdx)!.size > 0 || dateRange.some((d: any) => getChoicesForCell(d.date, group.rows[rIdx].mealPlanId, group.rows[rIdx].subMealPlanId, group.serviceId, group.subServiceId).length > 0)) {
                            componentHasAnyChoice = true;
                         }
                      })

                      if (comp.length > 1 || componentHasAnyChoice) {
                         const choiceRows = comp.map(i => group.rows[i])
                         
                         const allChoiceIds = new Set<string>()
                         comp.forEach(rIdx => {
                           dateRange.forEach((d: any) => {
                             const chs = getChoicesForCell(d.date, group.rows[rIdx].mealPlanId, group.rows[rIdx].subMealPlanId, group.serviceId, group.subServiceId)
                             chs.forEach(ch => allChoiceIds.add(ch.choiceId))
                           })
                         })

                         mergedRows.push({ type: 'choice', rows: choiceRows, choiceIds: Array.from(allChoiceIds) })
                         comp.forEach(rIdx => mergedRowIndices.add(rIdx))
                      }
                    })

                    // Plain rows
                    group.rows.forEach((row, rIdx) => {
                      if (!mergedRowIndices.has(rIdx)) {
                        mergedRows.push({ type: 'plain', rows: [row] })
                      }
                    })

                    return mergedRows.map((merged, mIdx) => {
                      const isEven = mIdx % 2 === 0
                      const isLast = mIdx === mergedRows.length - 1
                      const primaryRow = merged.rows[0]

                      if (merged.type === 'plain') {
                        // ── Plain row (non-choice) — render exactly as before ──
                        const row = primaryRow
                        return (
                          <tr
                            key={`plain-${row.mealPlanId}-${row.subMealPlanId}`}
                            className={`
                              transition-colors hover:bg-blue-50/30
                              ${isEven ? "bg-white" : "bg-gray-50/40"}
                            `}
                          >
                            <td
                              className={`
                                sticky left-0 z-10 px-5 py-3 min-w-[240px]
                                border-r-2 border-gray-300
                                ${!isLast ? "border-b border-gray-200" : ""}
                                ${isEven ? "bg-white" : "bg-gray-50"}
                              `}
                            >
                              <div className="flex items-center gap-2 ml-2">
                                <div className="min-w-0">
                                  <div className="font-semibold text-gray-800 text-sm leading-tight">
                                    {row.mealPlanName}
                                  </div>
                                  <div className="text-xs font-medium text-gray-500 mt-1">
                                    {resolveSmpName(row.subMealPlanId, row.subMealPlanName)}
                                  </div>
                                </div>
                              </div>
                            </td>
                            {dateRange.map((d: any) => {
                              const items = getCellItems(
                                d.date, group.serviceId, group.subServiceId,
                                row.mealPlanId, row.subMealPlanId
                              )
                              return (
                                <td
                                  key={d.date}
                                  className={`
                                    relative px-3 py-2.5 align-top min-w-[200px]
                                    border-r border-gray-200
                                    ${!isLast ? "border-b border-gray-200" : ""}
                                  `}
                                >
                                  {items.length === 0 ? (
                                    <div className="text-[10px] text-gray-300 text-center py-3">—</div>
                                  ) : (
                                    <div className="space-y-1.5">
                                      {items.map((item: any) => (
                                        <div
                                          key={item.id}
                                          className="text-[11px] text-gray-600 bg-gray-100 border border-gray-200 px-2.5 py-1.5 rounded-md"
                                        >
                                          {item.name}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      }

                      // ═══════════════════════════════════════════════════════════
                      // ✦ MERGED CHOICE ROW — multiple SMPs grouped into one row
                      // ═══════════════════════════════════════════════════════════
                      if (!merged.choiceIds || merged.choiceIds.length === 0) return null
                      const cc = choiceColorMap.get(merged.choiceIds[0])
                      const choiceStatusObjs = merged.choiceIds.map(id => choiceSelectionStatus[id])
                      const totalSelected = choiceStatusObjs.reduce((s, o) => s + (o?.selected || 0), 0)
                      const totalLimit = choiceStatusObjs.reduce((s, o) => s + (o?.limit || 0), 0)
                      const isAtLimit = totalLimit > 0 && totalSelected >= totalLimit

                      const mealPlanName = primaryRow.mealPlanName

                      // Compute frequency info for all SMPs in this merged row
                      const frequencyInfos = merged.rows.map(row => {
                        const assignment = mealPlanAssignments?.find(
                          (a: any) => a.companyId === building.companyId && a.buildingId === building.buildingId
                        )
                        let maxFrequency = 7
                        if (assignment?.weekStructure) {
                          Object.values(assignment.weekStructure).forEach((dayServices: any) => {
                            dayServices?.forEach((service: any) => {
                              service.subServices?.forEach((subService: any) => {
                                subService.mealPlans?.forEach((mp: any) => {
                                  mp.subMealPlans?.forEach((smp: any) => {
                                    if (smp.subMealPlanId === row.subMealPlanId && smp.maxFrequency) {
                                      maxFrequency = smp.maxFrequency
                                    }
                                  })
                                })
                              })
                            })
                          })
                        }

                        let selectedCount = 0
                        Object.entries(selections).forEach(([key, items]: [string, any]) => {
                          if (key.startsWith(`${building.companyId}-${building.buildingId}-`)) {
                            items.forEach((item: any) => {
                              if (item.subMealPlanId === row.subMealPlanId) {
                                selectedCount++
                              }
                            })
                          }
                        })

                        return { smpName: resolveSmpName(row.subMealPlanId, row.subMealPlanName), selectedCount, maxFrequency }
                      })

                      // Overall frequency: sum across all SMPs
                      const totalFreqSelected = frequencyInfos.reduce((s, f) => s + f.selectedCount, 0)
                      const totalFreqMax = frequencyInfos.reduce((s, f) => s + f.maxFrequency, 0)

                      let freqBgColor = 'bg-yellow-100'
                      let freqTextColor = 'text-yellow-700'
                      if (totalFreqSelected === totalFreqMax) {
                        freqBgColor = 'bg-green-100'
                        freqTextColor = 'text-green-700'
                      } else if (totalFreqSelected > totalFreqMax) {
                        freqBgColor = 'bg-red-100'
                        freqTextColor = 'text-red-700'
                      }

                      return (
                        <tr
                          key={`choice-${merged.choiceIds!.join('-')}`}
                          className={`
                            transition-colors hover:bg-blue-50/30
                            ${isEven ? "bg-white" : "bg-gray-50/40"}
                          `}
                        >
                          {/* ── Merged Row Label ── */}
                          <td
                            className={`
                              sticky left-0 z-10 px-5 py-3 min-w-[240px]
                              border-r-2 border-gray-300
                              ${!isLast ? "border-b border-gray-200" : ""}
                              ${isEven ? "bg-white" : "bg-gray-50"}
                            `}
                          >
                            <div className="flex flex-col gap-2">
                              {/* SMP names joined with / */}
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-1 self-stretch rounded-full shrink-0"
                                  style={{ backgroundColor: cc?.primary || '#6366f1' }}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-gray-800 text-sm leading-tight">
                                    {mealPlanName}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1 mt-1">
                                    {merged.rows.map((r, i) => (
                                      <React.Fragment key={r.subMealPlanId}>
                                        <span
                                          className="text-xs font-semibold px-1.5 py-0.5 rounded"
                                          style={{
                                            backgroundColor: cc?.lightBg || 'hsla(240, 80%, 50%, 0.08)',
                                            color: cc?.text || '#4338ca'
                                          }}
                                        >
                                          {resolveSmpName(r.subMealPlanId, r.subMealPlanName)}
                                        </span>
                                        {i < merged.rows.length - 1 && (
                                          <span className="text-gray-400 text-xs font-bold">/</span>
                                        )}
                                      </React.Fragment>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* Choice count + Frequency badges row */}
                              <div className="flex items-center gap-2 flex-wrap ml-3">
                                {/* Choice selection count */}
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                                    isAtLimit
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-amber-100 text-amber-700'
                                  }`}
                                >
                                  {totalSelected}/{totalLimit} chosen
                                </span>

                                {/* Frequency count */}
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${freqBgColor} ${freqTextColor} whitespace-nowrap`}>
                                  {totalFreqSelected}/{totalFreqMax}× freq
                                </span>

                                {/* Per-SMP frequency breakdown (if multiple SMPs) */}
                                {merged.rows.length > 1 && frequencyInfos.map((fi, idx) => {
                                  let fiBg = 'bg-gray-100'
                                  let fiText = 'text-gray-500'
                                  if (fi.selectedCount === fi.maxFrequency) {
                                    fiBg = 'bg-green-50'; fiText = 'text-green-600'
                                  } else if (fi.selectedCount > fi.maxFrequency) {
                                    fiBg = 'bg-red-50'; fiText = 'text-red-600'
                                  }
                                  return (
                                    <span key={idx} className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${fiBg} ${fiText} whitespace-nowrap`}>
                                      {fi.smpName}: {fi.selectedCount}/{fi.maxFrequency}×
                                    </span>
                                  )
                                })}
                              </div>

                              {isUniversal && merged.rows.length === 1 && (
                                <div className="mt-3 p-2 bg-red-50 text-red-800 text-[10px] rounded border border-red-200">
                                  <strong className="block mb-1 font-bold text-red-900 border-b border-red-200/50 pb-0.5">⚠️ Isolated SMP Diagnostic</strong>
                                  <span className="text-red-700 block mb-1">This SMP is entirely isolated. It does NOT share a single Choice ID on ANY day natively with any other SMP in this sub-service.</span>
                                  <div className="bg-white/50 p-1.5 rounded border border-red-100 mb-1.5 max-h-[150px] overflow-y-auto">
                                    <span className="font-semibold text-gray-700 block mb-0.5">Isolated SMP: {resolveSmpName(merged.rows[0].subMealPlanId, merged.rows[0].subMealPlanName)}</span>
                                    <span className="font-mono text-[9px] break-all text-gray-600 block mb-2">
                                      Choices: {JSON.stringify(merged.choiceIds)}
                                    </span>
                                    <span className="font-semibold text-gray-700 block mb-0.5">Other SMPs in {group.serviceName}:</span>
                                    {group.rows.map((r, i) => {
                                       if (r.subMealPlanId === merged.rows[0].subMealPlanId) return null;
                                       const cIds = new Set<string>()
                                       dateRange.forEach((d: any) => {
                                         const chs = getChoicesForCell(d.date, r.mealPlanId, r.subMealPlanId, group.serviceId, group.subServiceId)
                                         chs.forEach(ch => cIds.add(ch.choiceId))
                                       })
                                       return (
                                          <div key={i} className={`font-mono text-[9px] break-words mb-1 text-gray-500`}>
                                              <span className="font-semibold">{r.subMealPlanName}</span> ➜ {JSON.stringify(Array.from(cIds))}
                                          </div>
                                       )
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* ── Date cells for merged choice ── */}
                          {dateRange.map((d: any, dIdx: number) => {
                            const dayChoices = new Map<string, any>()
                            const smpAssignmentMap = new Map<string, any>()

                            merged.rows.forEach(r => {
                               const chs = getChoicesForCell(d.date, r.mealPlanId, r.subMealPlanId, group.serviceId, group.subServiceId)
                               chs.forEach(ch => {
                                  dayChoices.set(ch.choiceId, ch)
                                  smpAssignmentMap.set(r.subMealPlanId, ch)
                               })
                            })

                            if (dayChoices.size === 0) {
                              // Non-choice day — show items from all merged SMPs
                              const allDayItems: any[] = []
                              merged.rows.forEach(r => {
                                const items = getCellItems(d.date, group.serviceId, group.subServiceId, r.mealPlanId, r.subMealPlanId)
                                items.forEach((item: any) => {
                                  if (!allDayItems.find((x: any) => x.id === item.id)) allDayItems.push(item)
                                })
                              })

                              return (
                                <td
                                  key={d.date}
                                  className={`
                                    relative px-3 py-2.5 align-top min-w-[200px]
                                    border-r border-gray-200
                                    ${!isLast ? "border-b border-gray-200" : ""}
                                  `}
                                >
                                  {allDayItems.length === 0 ? (
                                    <div className="text-[10px] text-gray-300 text-center py-3">—</div>
                                  ) : (
                                    <div className="space-y-1.5">
                                      {allDayItems.map((item: any) => (
                                        <div key={item.id} className="text-[11px] text-gray-600 bg-gray-100 border border-gray-200 px-2.5 py-1.5 rounded-md">
                                          {item.name}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </td>
                              )
                            }

                            // ── Choice day cell (Supports Heterogeneous Multi-Choice Cells) ──
                            return (
                              <td
                                key={d.date}
                                className={`
                                  relative hover:z-[100] px-3 py-2.5 align-top min-w-[200px]
                                  border-r border-gray-200 bg-amber-50/10
                                  ${!isLast ? "border-b border-gray-200" : ""}
                                `}
                              >
                                <div className="space-y-2 relative text-left w-full h-full">
                                  {Array.from(dayChoices.values()).map(choice => {
                                      const displayItems = getAllItemsForChoice(d.date, choice, group)
                                      const currentChoiceStatus = choiceSelectionStatus[choice.choiceId]
                                      const isChoiceAtLimit = currentChoiceStatus?.isAtLimit ?? false
                                      const choiceKey = `${building.companyId}-${building.buildingId}-${choice.choiceId}`
                                      let selectedItemsForChoice = selections[choiceKey] || []
          
                                      if (isUniversal && universalAssociations) {
                                        const associatedBuildings = universalAssociations.get(choice.choiceId) || [];
                                        if (associatedBuildings.length > 0) {
                                          const firstB = associatedBuildings[0];
                                          const firstChoiceId = firstB.originalChoiceId || choice.choiceId;
                                          const firstKey = `${firstB.companyId}-${firstB.buildingId}-${firstChoiceId}`;
                                          selectedItemsForChoice = selections[firstKey] || [];
                                        }
                                      }
          
                                      const dayChoicesAll = building.choices.filter((c: any) => c.choiceDay?.toLowerCase() === d.day.toLowerCase())
                                      const choiceIndex = dayChoicesAll.findIndex((c: any) => c.choiceId === choice.choiceId)
                                      const cLabel = `C${choiceIndex >= 0 ? choiceIndex + 1 : '?'}`
                                      
                                      // Extract SMP names to help user identify which choice pair this is
                                      const smpNames = choice.mealPlans
                                        .flatMap((mp: any) => mp.subMealPlans.map((s: any) => {
                                          const freshSmp = subMealPlans.find((smp: any) => smp.id === s.subMealPlanId)
                                          return freshSmp?.name || s.subMealPlanName || 'SMP'
                                        }))
                                        .join(', ')

                                      const choiceLabel = (
                                        <div className="flex items-center gap-1 min-w-0">
                                          <span className="shrink-0">{cLabel} ({currentChoiceStatus?.selected || 0}/{choice.quantity})</span>
                                          <span className="font-normal opacity-80 text-[9px] truncate mt-[1px]" title={smpNames}>
                                            {smpNames}
                                          </span>
                                        </div>
                                      )
                                      const cc = choiceColorMap.get(choice.choiceId)

                                      return (
                                        <div key={choice.choiceId} className={`rounded shadow-sm overflow-hidden p-1.5 ${cc ? `border-l-4` : 'border border-gray-200'}`} style={cc ? { backgroundColor: cc.lightBg, borderLeftColor: cc.primary } : {}}>
                                          {/* Choice header */}
                                          <div className="text-[10px] font-bold tracking-wide mb-1 flex items-center justify-between" style={{ color: cc?.text || '#374151' }}>
                                            <span>{choiceLabel}</span>
                                            {isUniversal && universalAssociations && (
                                              <HoverCard openDelay={200}>
                                                <HoverCardTrigger asChild>
                                                  <div className="bg-white/50 hover:bg-white rounded p-0.5 border border-transparent hover:border-blue-200 transition-colors cursor-help pointer-events-auto">
                                                    <Globe2 className="h-3.5 w-3.5" style={{ color: cc?.primary || '#3b82f6' }} />
                                                  </div>
                                                </HoverCardTrigger>
                                                <HoverCardContent 
                                                  side="bottom" 
                                                  align="end" 
                                                  className="w-[220px] p-2 bg-gray-800 border-none shadow-2xl z-[9999]"
                                                >
                                                  <div className="font-semibold text-white mb-1 border-b border-gray-600/50 pb-0.5">Assigned to {universalAssociations.get(choice.choiceId)?.length || 0} Companies:</div>
                                                  <ul className="space-y-0.5 max-h-[250px] overflow-y-auto pr-1">
                                                    {(universalAssociations.get(choice.choiceId) || []).map((b: any, bIdx: number) => (
                                                      <li key={bIdx} className="truncate text-gray-200 text-[10px]">• {b.companyName} <span className="text-gray-400">({b.buildingName})</span></li>
                                                    ))}
                                                  </ul>
                                                </HoverCardContent>
                                              </HoverCard>
                                            )}
                                          </div>
      
                                          {/* Items list with checkboxes */}
                                          <div className="flex flex-col gap-1.5 mt-2">
                                            {[...displayItems].sort((a: any, b: any) => {
                                              const aSel = selectedItemsForChoice.some((s:any) => s.selectedItemId === a.id)
                                              const bSel = selectedItemsForChoice.some((s:any) => s.selectedItemId === b.id)
                                              if (aSel && !bSel) return -1
                                              if (!aSel && bSel) return 1
                                              return 0
                                            }).map((item: any) => {
                                              // Find which SMP this item belongs to (for toggling)
                                              let itemRow = merged.rows.find(r => smpAssignmentMap.get(r.subMealPlanId)?.choiceId === choice.choiceId) || merged.rows[0]
                                              for (const r of merged.rows) {
                                                const cellItems = getCellItems(d.date, group.serviceId, group.subServiceId, r.mealPlanId, r.subMealPlanId)
                                                if (cellItems.some((ci: any) => ci.id === item.id)) {
                                                  itemRow = r
                                                  break
                                                }
                                              }
      
                                              const isSelectedHere = selectedItemsForChoice.some((s:any) => s.selectedItemId === item.id)
                                              const isDisabled = !isSelectedHere && isChoiceAtLimit
      
                                              return (
                                                <div key={item.id} className="flex items-start gap-1">
                                                  {isSelectedHere && <span className="text-gray-400 font-normal mt-1.5 text-[10px] ml-1">|-</span>}
                                                  <label
                                                    className={`
                                                      flex-1 flex items-start gap-2 px-2 py-1.5 rounded text-[11px] transition-all border
                                                      ${isDisabled
                                                        ? 'opacity-60 cursor-not-allowed bg-gray-200 border-gray-300'
                                                        : isSelectedHere
                                                          ? 'shadow-sm border-transparent'
                                                          : 'bg-white border-gray-200 cursor-pointer hover:border-gray-300 hover:bg-gray-50'}
                                                    `}
                                                    style={isSelectedHere && cc ? { backgroundColor: cc.selectedBg } : {}}
                                                  >
                                                    <input
                                                      type="checkbox"
                                                      className="mt-0.5 rounded border-gray-300 w-3 h-3 cursor-pointer disabled:cursor-not-allowed shrink-0"
                                                      checked={isSelectedHere}
                                                      disabled={isDisabled}
                                                      onChange={() => {
                                                        if (!isDisabled) {
                                                          toggleSelection(choice.choiceId, itemRow, item)
                                                        }
                                                      }}
                                                      style={cc && isSelectedHere ? { accentColor: cc.primary } : {}}
                                                    />
                                                    <div className="flex flex-col leading-tight pt-[1px] w-full">
                                                      <span className={`${isSelectedHere ? 'font-bold' : 'font-medium'} ${isDisabled ? 'text-gray-500' : 'text-gray-700'}`}>
                                                        {item.name}
                                                      </span>
                                                    </div>
                                                  </label>
                                                </div>
                                              )
                                            })}
                                          </div>
                                        </div>
                                      )
                                  })}

                                  {/* Render warnings for SMPs that aren't mapped to ANY choice today */}
                                  {isUniversal && merged.rows.map(r => {
                                    const choices = getChoicesForCell(d.date, r.mealPlanId, r.subMealPlanId, group.serviceId, group.subServiceId);
                                    if (choices.length === 0) {
                                      return (
                                        <div key={`warn-${r.subMealPlanId}`} className="text-[9px] bg-red-50 text-red-600 border border-red-200 p-1.5 rounded shadow-sm font-medium mt-2">
                                          <strong className="block mb-0.5 text-red-700 font-bold">⚠️ Excluded from Set</strong>
                                          <span className="opacity-90 leading-tight block">{resolveSmpName(r.subMealPlanId, r.subMealPlanName)} is not assigned globally on this day.</span>
                                        </div>
                                      )
                                    }
                                    return null
                                  })}
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })
                  })()}
                </tbody>
              </table>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <AlertCircle className="h-12 w-12 opacity-20 mb-3" />
            <p className="text-sm font-medium">
              No meal plan structures found for this building.
            </p>
            <p className="text-xs text-gray-300 mt-1">
              Check that week structures are configured.
            </p>
          </div>
        )}
      </div>{/* end service groups scroll area */}
    </div>
  )
}
