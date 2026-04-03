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
import { Badge } from "@/components/ui/badge"
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
} from "lucide-react"
import { Spinner } from "@/components/ui/spinner"

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

function BuildingMenuGrid({
  building,
  dateRange,
  allMenuItems,
  menuData,
  mealPlans,
  subMealPlans,
  mealPlanAssignments,
  selections,
  setSelections,
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
    const assignment = mealPlanAssignments?.find(
      (a: any) =>
        a.companyId === building.companyId &&
        a.buildingId === building.buildingId
    )
    if (!assignment?.weekStructure) return []

    const groupMap = new Map<string, ServiceGroup>()
    const rowSeen = new Map<string, Set<string>>()

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
  }, [building, dateRange, mealPlanAssignments, mealPlans, subMealPlans])

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

  const getChoiceForCell = (
    date: string,
    mealPlanId: string,
    subMealPlanId: string,
    serviceId?: string,
    subServiceId?: string
  ) => {
    const day = dateRange.find((d: any) => d.date === date)?.day
    return building.choices.find(
      (c: any) =>
        c.choiceDay?.toLowerCase() === day?.toLowerCase() &&
        (serviceId ? c.serviceId === serviceId : true) && // Match service if checking
        (subServiceId ? c.subServiceId === subServiceId : true) && // Match sub-service if checking
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
    const key = `${building.companyId}-${building.buildingId}-${choiceId}`
    const choice = building.choices.find((c: any) => c.choiceId === choiceId)
    if (!choice) return

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
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-8" style={{ minWidth: "max-content" }}>
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

        {/* Service group tables */}
        {serviceGroups.length > 0 ? (
          serviceGroups.map((group) => (
            <div
              key={`${group.serviceId}-${group.subServiceId}`}
              className="rounded-xl overflow-hidden shadow-sm border border-gray-200"
            >
              {/* Service / Sub-Service header */}
              <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-5 py-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-white/15 flex items-center justify-center">
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
                  {/* Show selection counter for each choice in this group */}
                  {group.rows.some((row: any) =>
                    dateRange.some((d: any) =>
                      getChoiceForCell(d.date, row.mealPlanId, row.subMealPlanId, group.serviceId, group.subServiceId)
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

              {/* Table */}
              <table
                className="border-collapse w-full bg-white"
                style={{ minWidth: "max-content" }}
              >
                <thead>
                  <tr className="bg-gray-50">
                    <th className="sticky left-0 z-20 bg-gray-50 border-b-2 border-r-2 border-gray-300 px-5 py-3 text-left min-w-[240px]">
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
                                  const smpNames = c.mealPlans
                                    .flatMap((mp: any) => mp.subMealPlans.map((s: any) => s.subMealPlanName || 'SMP'))
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
                  {group.rows.map((row, rIdx) => {
                    const isEven = rIdx % 2 === 0
                    const isLast = rIdx === group.rows.length - 1
                    const rowKey = `${row.mealPlanId}|${row.subMealPlanId}`

                    const rowHasAnyChoice = dateRange.some((d: any) =>
                      !!getChoiceForCell(d.date, row.mealPlanId, row.subMealPlanId, group.serviceId, group.subServiceId)
                    )

                    const nextRow = group.rows[rIdx + 1]
                    const nextRowHasAnyChoice = !!nextRow && dateRange.some((d: any) =>
                      !!getChoiceForCell(d.date, nextRow.mealPlanId, nextRow.subMealPlanId, group.serviceId, group.subServiceId)
                    )

                    return (
                      <tr
                        key={`${row.mealPlanId}-${row.subMealPlanId}`}
                        className={`
                          transition-colors hover:bg-blue-50/30
                          ${isEven ? "bg-white" : "bg-gray-50/40"}
                        `}
                      >
                        {/* Row label */}
                        <td
                          className={`
                            sticky left-0 z-10 px-5 py-3 min-w-[240px]
                            border-r-2 border-gray-300
                            ${!isLast ? "border-b border-gray-200" : ""}
                            ${isEven ? "bg-white" : "bg-gray-50"}
                          `}
                        >
                          <div className="relative">
                            <div
                              className={`absolute left-5 top-0 bottom-0 w-px transition-opacity duration-150 ${
                                (rowHasAnyChoice || nextRowHasAnyChoice) ? "bg-gray-300 opacity-100" : "bg-transparent opacity-0"
                              }`}
                            />
                            <div className="flex items-center gap-2 ml-6">
                              {/* Removed blue choice ID badge for a cleaner look */}
                              <div className="min-w-0">
                                <div className="font-semibold text-gray-800 text-sm leading-tight">
                                  {row.mealPlanName}
                                </div>
                                <div className="text-xs font-medium text-gray-500 mt-1">
                                  {row.subMealPlanName}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* ═══════════════════════════════════════
                            ✦ MODIFIED — Date cells with choice colors
                            ═══════════════════════════════════════ */}
                        {dateRange.map((d: any, dIdx: number) => {
                          const items = getCellItems(
                            d.date,
                            group.serviceId,
                            group.subServiceId,
                            row.mealPlanId,
                            row.subMealPlanId
                          )
                          const choice = getChoiceForCell(
                            d.date,
                            row.mealPlanId,
                            row.subMealPlanId,
                            group.serviceId,
                            group.subServiceId
                          )
                          const selKey = choice
                            ? `${building.companyId}-${building.buildingId}-${choice.choiceId}`
                            : null
                          const selected = selKey
                            ? (selections[selKey] || []).find(
                                (s: any) =>
                                  s.subMealPlanId === row.subMealPlanId
                              )
                            : null

                          const isChoice = !!choice

                          /* ✦ NEW — resolve the color for this choice */
                          const cc = choice
                            ? choiceColorMap.get(choice.choiceId)
                            : null

                          /* ✦ NEW — check if this choice is at its selection limit */
                          const choiceStatus = choice
                            ? choiceSelectionStatus[choice.choiceId]
                            : null
                          const isChoiceAtLimit = choiceStatus?.isAtLimit ?? false
                          const isThisRowSelectedForChoice = selected != null

                          // Check if the next cell in this row has the same choice to draw a connector
                          const nextDay = dateRange[dIdx + 1]
                          const nextChoice = nextDay
                            ? getChoiceForCell(
                                nextDay.date,
                                row.mealPlanId,
                                row.subMealPlanId,
                                group.serviceId,
                                group.subServiceId
                              )
                            : null
                          const hasNextSameChoice =
                            choice && nextChoice && choice.choiceId === nextChoice.choiceId

                          // Check if the previous cell in this row has the same choice
                          const prevDay = dateRange[dIdx - 1]
                          const prevChoice = prevDay
                            ? getChoiceForCell(
                                prevDay.date,
                                row.mealPlanId,
                                row.subMealPlanId,
                                group.serviceId,
                                group.subServiceId
                              )
                            : null
                          const hasPrevSameChoice =
                            choice && prevChoice && choice.choiceId === prevChoice.choiceId

                          return (
                            <td
                              key={d.date}
                              className={`
                                relative px-3 py-2.5 align-top min-w-[200px]
                                border-r border-gray-200
                                ${!isLast ? "border-b border-gray-200" : ""}
                                ${cc
                                  ? `${cc.cellBg} border-l-4 ${cc.borderL}`
                                  : ""
                                }
                              `}
                            >
                              {/* Visual Arrow Connector (Stitch Style: Nodes and Lines) */}
                              
                              {/* Left Node AND Left-spanning SVG line (if connected to a previous choice) */}
                              {hasPrevSameChoice && cc && (
                                <>
                                  <div className={`absolute w-[10px] h-[10px] rounded-full border-2 border-white -left-[5px] top-1/2 -translate-y-1/2 z-30 ${cc.borderL.replace("border-l-", "bg-")}`}></div>
                                  <svg className="absolute top-1/2 left-0 w-full h-[4px] -translate-y-1/2 pointer-events-none z-[5] overflow-visible" preserveAspectRatio="none">
                                    <line stroke={cc.hex} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="6,4" x1="-100%" x2="0%" y1="50%" y2="50%" fill="none"></line>
                                  </svg>
                                </>
                              )}

                              {/* Right Node + Right-spanning SVG line (if connected to a next choice) */}
                              {hasNextSameChoice && cc && (
                                <>
                                  <div className={`absolute w-[10px] h-[10px] rounded-full border-2 border-white -right-[5px] top-1/2 -translate-y-1/2 z-30 ${cc.borderL.replace("border-l-", "bg-")}`}></div>
                                  <svg className="absolute top-1/2 left-0 w-full h-[4px] -translate-y-1/2 pointer-events-none z-[5] overflow-visible" preserveAspectRatio="none">
                                    <line stroke={cc.hex} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="6,4" x1="100%" x2="200%" y1="50%" y2="50%" fill="none"></line>
                                  </svg>
                                </>
                              )}
                              {(() => {
                                // For choice cells, pool ALL items across the choice
                                const displayItems = isChoice && choice
                                  ? getAllItemsForChoice(d.date, choice, group)
                                  : items

                                if (displayItems.length === 0) {
                                  return (
                                    <div className="text-[10px] text-gray-300 text-center py-3">
                                      —
                                    </div>
                                  )
                                }

                                if (!isChoice) {
                                  // ── Plain menu items (non-choice) ──
                                  return (
                                    <div className="space-y-1.5">
                                      {displayItems.map((item: any) => (
                                        <div
                                          key={item.id}
                                          className="text-[11px] text-gray-600 bg-gray-100 border border-gray-200 px-2.5 py-1.5 rounded-md"
                                        >
                                          {item.name}
                                        </div>
                                      ))}
                                    </div>
                                  )
                                }

                                // ── Choice cell with inline selection list ──
                                const choiceStatusObj = choiceSelectionStatus[choice.choiceId]
                                const isChoiceAtLimit = choiceStatusObj?.isAtLimit ?? false

                                // Find all items selected for this choice
                                const choiceKey = `${building.companyId}-${building.buildingId}-${choice.choiceId}`
                                const selectedItemsForChoice = selections[choiceKey] || []
                                
                                // Items selected specifically in this cell
                                const selectedInThisCell = selectedItemsForChoice.filter(
                                  (s: any) => s.subMealPlanId === row.subMealPlanId
                                )
                                
                                // Choice sorting index (to get C1, C2, etc.)
                                // Group by day to find its index within this day
                                const dayChoices = building.choices.filter((c: any) => c.choiceDay?.toLowerCase() === d.day.toLowerCase())
                                const choiceIndex = dayChoices.findIndex((c: any) => c.choiceId === choice.choiceId)
                                const cLabel = `C${choiceIndex >= 0 ? choiceIndex + 1 : '?'}`
                                
                                const choiceLabel = `${cLabel}(${choiceStatusObj?.selected || 0}/${choice.quantity})`

                                return (
                                  <div className="space-y-2 relative text-left w-full">
                                    {/* Choice dynamic header - Simplified since checkboxes render the checked items below  */}
                                    <div className="text-[10px] font-bold tracking-wide mb-1" style={{ color: cc?.text || '#374151' }}>
                                      <span>{choiceLabel}</span>
                                    </div>

                                    {/* Items List (Inline checkboxes instead of dropdown) */}
                                    <div className="flex flex-col gap-1.5 mt-2">
                                      {[...displayItems].sort((a: any, b: any) => {
                                        const aSel = selectedInThisCell.some((s:any) => s.selectedItemId === a.id)
                                        const bSel = selectedInThisCell.some((s:any) => s.selectedItemId === b.id)
                                        if (aSel && !bSel) return -1
                                        if (!aSel && bSel) return 1
                                        return 0
                                      }).map((item: any) => {
                                        const isSelectedHere = selectedInThisCell.some((s:any) => s.selectedItemId === item.id)
                                        const selectedElsewhere = !isSelectedHere ? selectedItemsForChoice.find((s:any) => s.selectedItemId === item.id) : null
                                        const isDisabled = !!selectedElsewhere || (!isSelectedHere && isChoiceAtLimit)
                                        
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
                                                    toggleSelection(choice.choiceId, row, item)
                                                  }
                                                }}
                                                style={cc && isSelectedHere ? { accentColor: cc.primary } : {}}
                                              />
                                              <div className="flex flex-col leading-tight pt-[1px] w-full">
                                                <span className={`${isSelectedHere ? 'font-bold' : 'font-medium'} ${isDisabled && !selectedElsewhere ? 'text-gray-500' : 'text-gray-700'}`}>
                                                  {item.name}
                                                </span>
                                                {selectedElsewhere && (
                                                  <span className="text-[9px] text-amber-600 font-semibold mt-0.5" title="You must uncheck it in the other cell first.">
                                                    Choice already made in {selectedElsewhere.subMealPlanName}
                                                  </span>
                                                )}
                                              </div>
                                            </label>
                                          </div>
                                        )
                                      })}
                                      {displayItems.length === 0 && (
                                        <div className="px-3 py-2 text-[11px] text-gray-500 italic text-center border rounded bg-gray-50">No items available</div>
                                      )}
                                    </div>
                                  </div>
                                )
                              })()}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
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
      </div>
    </div>
  )
}
