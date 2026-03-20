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
  Utensils,
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

interface ChoiceSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  companies: CompanyChoice[]
  onConfirm: (selections: SelectionMap) => void
  loading?: boolean
  menuData?: Record<string, any>
  allMenuItems?: MenuItem[]
  dateRange?: Array<{ date: string; day: string }>
  mealPlans?: MealPlan[]
  subMealPlans?: SubMealPlan[]
  mealPlanAssignments?: any[]
}

/* ═══════════════════════════════════════════════════════════
   ✦ NEW — Choice color palette
   Each choiceId gets a unique visual identity from this list.
   ═══════════════════════════════════════════════════════════ */
const CHOICE_PALETTE = [
  {
    cellBg:    "bg-sky-50/60",
    borderL:   "border-l-sky-500",
    idle:      "border-sky-300",
    idleHover: "hover:border-sky-500 hover:bg-sky-50",
    sel:       "bg-sky-600 border-sky-700",
    ring:      "ring-sky-400/40",
  },
  {
    cellBg:    "bg-violet-50/60",
    borderL:   "border-l-violet-500",
    idle:      "border-violet-300",
    idleHover: "hover:border-violet-500 hover:bg-violet-50",
    sel:       "bg-violet-600 border-violet-700",
    ring:      "ring-violet-400/40",
  },
  {
    cellBg:    "bg-emerald-50/60",
    borderL:   "border-l-emerald-500",
    idle:      "border-emerald-300",
    idleHover: "hover:border-emerald-500 hover:bg-emerald-50",
    sel:       "bg-emerald-600 border-emerald-700",
    ring:      "ring-emerald-400/40",
  },
  {
    cellBg:    "bg-rose-50/60",
    borderL:   "border-l-rose-500",
    idle:      "border-rose-300",
    idleHover: "hover:border-rose-500 hover:bg-rose-50",
    sel:       "bg-rose-600 border-rose-700",
    ring:      "ring-rose-400/40",
  },
  {
    cellBg:    "bg-amber-50/60",
    borderL:   "border-l-amber-500",
    idle:      "border-amber-300",
    idleHover: "hover:border-amber-500 hover:bg-amber-50",
    sel:       "bg-amber-600 border-amber-700",
    ring:      "ring-amber-400/40",
  },
  {
    cellBg:    "bg-indigo-50/60",
    borderL:   "border-l-indigo-500",
    idle:      "border-indigo-300",
    idleHover: "hover:border-indigo-500 hover:bg-indigo-50",
    sel:       "bg-indigo-600 border-indigo-700",
    ring:      "ring-indigo-400/40",
  },
  {
    cellBg:    "bg-teal-50/60",
    borderL:   "border-l-teal-500",
    idle:      "border-teal-300",
    idleHover: "hover:border-teal-500 hover:bg-teal-50",
    sel:       "bg-teal-600 border-teal-700",
    ring:      "ring-teal-400/40",
  },
  {
    cellBg:    "bg-fuchsia-50/60",
    borderL:   "border-l-fuchsia-500",
    idle:      "border-fuchsia-300",
    idleHover: "hover:border-fuchsia-500 hover:bg-fuchsia-50",
    sel:       "bg-fuchsia-600 border-fuchsia-700",
    ring:      "ring-fuchsia-400/40",
  },
]

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
}: ChoiceSelectionModalProps) {
  const [selections, setSelections] = useState<SelectionMap>({})
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

  const activeBuilding = companies[activeTabIndex] || companies[0]

  // Handler to save choices to company menus
  const handleSaveChoicesToMenus = async (
    selections: SelectionMap,
    building: CompanyChoice,
    buildingData: CompanyChoice
  ) => {
    try {
      // Group selections by choice ID
      const choiceMap: Record<string, any> = {}
      
      Object.entries(selections).forEach(([key, items]) => {
        items.forEach((item: SubMealSelection) => {
          // Extract choice ID from the key or item context
          const choice = building.choices.find(c => 
            c.mealPlans.some(mp =>
              mp.mealPlanId === item.mealPlanId &&
              mp.subMealPlans.some(smp => smp.subMealPlanId === item.subMealPlanId)
            )
          )
          
          if (choice) {
            if (!choiceMap[choice.choiceId]) {
              choiceMap[choice.choiceId] = {
                choiceId: choice.choiceId,
                quantity: choice.quantity,
                items: [],
                serviceId: choice.serviceId,
                subServiceId: choice.subServiceId,
                day: choice.choiceDay
              }
            }
            choiceMap[choice.choiceId].items.push({
              id: item.selectedItemId,
              name: item.selectedItemName,
              mealPlanId: item.mealPlanId,
              subMealPlanId: item.subMealPlanId
            })
          }
        })
      })

      // Save to company menus via API
      const response = await fetch('/api/company-menus/save-choices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: building.companyId,
          buildingId: building.buildingId,
          choices: Object.values(choiceMap),
          dateRange: dateRange
        })
      })

      if (!response.ok) {
        console.error('Failed to save choices to menus')
      }
    } catch (error) {
      console.error('Error saving choices to menus:', error)
    }
  }

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
                  const count = getTabSelectionCount(building)
                  return (
                    <button
                      key={`${building.companyId}-${building.buildingId}`}
                      onClick={() => setActiveTabIndex(idx)}
                      className={`
                        relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                        whitespace-nowrap transition-all duration-200 border
                        ${
                          isActive
                            ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200"
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                        }
                      `}
                    >
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
                      {count > 0 && (
                        <span
                          className={`
                            ml-1 text-[10px] font-bold rounded-full min-w-[18px] h-[18px]
                            flex items-center justify-center px-1
                            ${
                              isActive
                                ? "bg-white text-blue-600"
                                : "bg-green-100 text-green-700"
                            }
                          `}
                        >
                          {count}
                        </span>
                      )}
                      {isActive && (
                        <span className="absolute -bottom-[9px] left-3 right-3 h-[3px] bg-blue-600 rounded-t-full" />
                      )}
                    </button>
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
                // Save choices to company menus before confirming
                handleSaveChoicesToMenus(selections, activeBuilding, companies[activeTabIndex])
                onConfirm(selections)
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
    const map = new Map<string, (typeof CHOICE_PALETTE)[0]>()
    const ids = [...new Set(building.choices.map((c: any) => c.choiceId))]
    ids.forEach((id: string, i: number) => {
      map.set(id, CHOICE_PALETTE[i % CHOICE_PALETTE.length])
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

  const handleSelect = (choiceId: string, row: any, item: any) => {
    const key = `${building.companyId}-${building.buildingId}-${choiceId}`
    
    // Get the choice to check quantity limit
    const choice = building.choices.find((c: any) => c.choiceId === choiceId)
    if (!choice) return
    
    setSelections((prev: any) => {
      const current = prev[key] || []
      
      // Check if we're already at the quantity limit
      if (current.length >= choice.quantity && !current.some((s: any) => s.subMealPlanId === row.subMealPlanId)) {
        // Can't add more if at limit
        console.warn(`[v0] Choice quantity limit reached (${choice.quantity} items). Cannot add more.`)
        return prev
      }
      
      const filtered = current.filter(
        (s: any) => s.subMealPlanId !== row.subMealPlanId
      )
      return {
        ...prev,
        [key]: [
          ...filtered,
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
    })
  }

  const clearSelection = (choiceId: string, subMealPlanId: string) => {
    const key = `${building.companyId}-${building.buildingId}-${choiceId}`
    setSelections((prev: any) => ({
      ...prev,
      [key]: (prev[key] || []).filter(
        (s: any) => s.subMealPlanId !== subMealPlanId
      ),
    }))
  }

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
                      // Only show "CHOICE" badge if this specific service/sub-service has choices on this day
                      const hasChoice = building.choices.some(
                        (c: any) =>
                          c.choiceDay?.toLowerCase() === d.day.toLowerCase() &&
                          (c.serviceId === group.serviceId || !c.serviceId) &&
                          (c.subServiceId === group.subServiceId || !c.subServiceId)
                      )
                      return (
                        <th
                          key={d.date}
                          className={`
                            border-b-2 border-r border-gray-300 px-4 py-3 text-center min-w-[200px]
                            ${hasChoice ? "bg-amber-50" : "bg-gray-50"}
                          `}
                        >
                          <div className="text-xs font-bold text-gray-700 uppercase">
                            {d.day}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            {d.date}
                          </div>
                          {hasChoice && (
                            <div className="mt-1">
                              <span className="inline-block text-[9px] font-bold bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full">
                                CHOICE
                              </span>
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
                              {rowHasAnyChoice && (
                                <div className="flex-shrink-0">
                                  {/* Show choice ID badge for rows with choices */}
                                  {dateRange.map((d: any) => {
                                    const choice = getChoiceForCell(d.date, row.mealPlanId, row.subMealPlanId, group.serviceId, group.subServiceId)
                                    return choice ? (
                                      <div
                                        key={`${d.date}-${choice.choiceId}`}
                                        className="text-[9px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded-full inline-block"
                                        title={`Choice ID: ${choice.choiceId.substring(0, 8)}... (Qty: ${choice.quantity})`}
                                      >
                                        {choice.choiceId.substring(0, 8)}...
                                      </div>
                                    ) : null
                                  }).filter(Boolean)[0]}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-semibold text-gray-900 text-sm leading-tight">
                                  {row.mealPlanName}
                                </div>
                                <div className="text-xs text-gray-400 mt-0.5">
                                  ↳ {row.subMealPlanName}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* ═══════════════════════════════════════
                            ✦ MODIFIED — Date cells with choice colors
                            ═══════════════════════════════════════ */}
                        {dateRange.map((d: any) => {
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

                          return (
                            <td
                              key={d.date}
                              className={`
                                px-3 py-2.5 align-top min-w-[200px]
                                border-r border-gray-200
                                ${!isLast ? "border-b border-gray-200" : ""}
                                ${cc
                                  ? `${cc.cellBg} border-l-4 ${cc.borderL}`
                                  : ""
                                }
                              `}
                            >
                              {items.length > 0 ? (
                                <div className="space-y-1.5">
                                  {items.map((item: any) => {
                                    if (!isChoice) {
                                      // ── Plain menu item (unchanged) ──
                                      return (
                                        <div
                                          key={item.id}
                                          className="text-[11px] text-gray-600 bg-gray-100 border border-gray-200 px-2.5 py-1.5 rounded-md"
                                        >
                                          {item.name}
                                        </div>
                                      )
                                    }

                                    // ── Choice item ──
                                    const isSelected =
                                      selected?.selectedItemId === item.id

                                    return (
                                      <button
                                        key={item.id}
                                        onClick={() =>
                                          isSelected
                                            ? clearSelection(
                                                choice.choiceId,
                                                row.subMealPlanId
                                              )
                                            : handleSelect(
                                                choice.choiceId,
                                                row,
                                                item
                                              )
                                        }
                                        /* ✦ MODIFIED — choice-colored button states */
                                        className={`
                                          w-full text-left px-2.5 py-2 rounded-lg text-xs
                                          transition-all duration-150 border
                                          ${
                                            isSelected
                                              ? `${cc!.sel} text-white shadow-md font-bold ring-2 ${cc!.ring}`
                                              : selected
                                              ? "bg-white border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600 hover:bg-gray-50/50"
                                              : `bg-white ${cc!.idle} text-gray-700 ${cc!.idleHover} hover:text-gray-900 shadow-sm`
                                          }
                                        `}
                                      >
                                        <span className="flex items-center gap-1.5">
                                          {isSelected && (
                                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                          )}
                                          <span className="leading-tight">
                                            {item.name}
                                          </span>
                                        </span>
                                      </button>
                                    )
                                  })}
                                </div>
                              ) : (
                                <div className="text-[10px] text-gray-300 text-center py-3">
                                  —
                                </div>
                              )}
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
