'use client'

import React, { useMemo, useState } from 'react'
import { AlertCircle, Building2, Utensils, X, Clock, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react'

interface DetailedDataScreenProps {
  companiesWithChoices: any[]
  services: any[]
  subServices: any
  mealPlans: any[]
  subMealPlans: any[]
  menuItems: any[]
  menuData?: any
  dateRange?: Array<{ date: string; day: string }>
  mealPlanAssignments?: any[]
  inlineChoiceSelections?: Record<string, any[]>
}

interface CompanyEntry {
  companyName: string
  buildingName: string
  companyId: string
  buildingId: string
  isFromChoice: boolean
}

interface CellData {
  itemId: string
  itemName: string
  // Companies that will receive this item (default + choice-selected)
  companies: CompanyEntry[]
  totalCompanies: number
  choiceCompanies: number
  nonChoiceCompanies: number
  // Companies governed by a choice for this cell but whose choice set
  // is NOT yet fully filled (i.e. they still have pending slots)
  pendingChoiceCompanies: number
  pendingChoiceCompanyList: Array<{
    companyName: string
    buildingName: string
    companyId: string
    buildingId: string
    selectedSoFar: number
    totalSlots: number
  }>
}

// ─── Summary bar shown at the top of the screen ──────────────────────────────
function SummaryBar({
  totalItems,
  totalCompanyAssignments,
  choiceCompanyAssignments,
  defaultCompanyAssignments,
  pendingSlots,
}: {
  totalItems: number
  totalCompanyAssignments: number
  choiceCompanyAssignments: number
  defaultCompanyAssignments: number
  pendingSlots: number
}) {
  const stats = [
    {
      label: 'Total Items',
      value: totalItems,
      bg: 'bg-slate-100',
      text: 'text-slate-700',
      border: 'border-slate-200',
    },
    {
      label: 'Default Deliveries',
      value: defaultCompanyAssignments,
      bg: 'bg-gray-50',
      text: 'text-gray-700',
      border: 'border-gray-200',
      dot: 'bg-gray-400',
    },
    {
      label: 'Choice Selections',
      value: choiceCompanyAssignments,
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
      dot: 'bg-amber-400',
    },
    {
      label: 'Pending Choices',
      value: pendingSlots,
      bg: pendingSlots > 0 ? 'bg-orange-50' : 'bg-green-50',
      text: pendingSlots > 0 ? 'text-orange-700' : 'text-green-700',
      border: pendingSlots > 0 ? 'border-orange-200' : 'border-green-200',
      dot: pendingSlots > 0 ? 'bg-orange-400' : 'bg-green-400',
    },
  ]

  return (
    <div className="shrink-0 px-4 py-2.5 bg-white border-b border-gray-100 flex items-center gap-3 flex-wrap">
      {stats.map((s) => (
        <div
          key={s.label}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${s.bg} ${s.text} ${s.border}`}
        >
          {s.dot && (
            <span className={`h-2 w-2 rounded-full ${s.dot} shrink-0`} />
          )}
          <span className="font-bold text-sm">{s.value}</span>
          <span className="font-medium opacity-80">{s.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Modal showing company breakdown for a single item ────────────────────────
function CompanyDetailModal({
  cellData,
  day,
  onClose,
}: {
  cellData: CellData
  day: string
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4 flex items-start justify-between">
          <div>
            <p className="text-white font-bold text-base leading-tight">{cellData.itemName}</p>
            <p className="text-slate-300 text-xs mt-1 capitalize font-medium">{day}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stats row */}
        <div className="px-5 py-3 bg-slate-50 border-b border-gray-100 flex gap-2 flex-wrap">
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-200 text-slate-700">
            {cellData.totalCompanies} receiving
          </span>
          {cellData.choiceCompanies > 0 && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
              {cellData.choiceCompanies} via choice
            </span>
          )}
          {cellData.nonChoiceCompanies > 0 && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
              {cellData.nonChoiceCompanies} default
            </span>
          )}
          {cellData.pendingChoiceCompanies > 0 && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 border border-orange-200 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {cellData.pendingChoiceCompanies} pending
            </span>
          )}
        </div>

        {/* Receiving companies */}
        <div className="px-5 py-3">
          {cellData.companies.length > 0 && (
            <>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                Receiving this item
              </p>
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {cellData.companies.map((c, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs ${
                      c.isFromChoice
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <Building2
                      className={`h-3.5 w-3.5 shrink-0 ${
                        c.isFromChoice ? 'text-amber-500' : 'text-gray-400'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-gray-800 truncate">{c.companyName}</p>
                      <p className="text-gray-400 truncate text-[10px]">{c.buildingName}</p>
                    </div>
                    {c.isFromChoice && (
                      <span className="shrink-0 text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full border border-amber-200">
                        choice ✓
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Pending section */}
          {cellData.pendingChoiceCompanyList.length > 0 && (
            <div className="mt-3 pt-3 border-t border-dashed border-orange-200">
              <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                Still deciding — hasn't filled choice quota yet
              </p>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {cellData.pendingChoiceCompanyList.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-orange-200 bg-orange-50/80 text-xs"
                  >
                    <Clock className="h-3.5 w-3.5 shrink-0 text-orange-400" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-orange-800 truncate">{c.companyName}</p>
                      <p className="text-orange-400 truncate text-[10px]">{c.buildingName}</p>
                    </div>
                    <span className="shrink-0 text-[9px] font-bold text-orange-600 bg-white px-1.5 py-0.5 rounded-full border border-orange-300">
                      {c.selectedSoFar}/{c.totalSlots}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {cellData.companies.length === 0 && cellData.pendingChoiceCompanyList.length === 0 && (
            <p className="text-xs text-gray-300 italic text-center py-6">No company assignments found</p>
          )}
        </div>
      </div>
    </div>
  )
}

export function DetailedDataScreen({
  companiesWithChoices,
  services,
  subServices,
  mealPlans,
  subMealPlans,
  menuItems,
  menuData = {},
  dateRange = [],
  mealPlanAssignments = [],
  inlineChoiceSelections = {},
}: DetailedDataScreenProps) {
  const [modalData, setModalData] = useState<{ cell: CellData; day: string } | null>(null)

  // ─── Flatten helpers ───────────────────────────────────────────────────────
  const subServicesArray = useMemo(() => {
    if (!subServices) return []
    if (subServices instanceof Map) {
      const arr: any[] = []
      subServices.forEach((list: any[]) => { if (Array.isArray(list)) arr.push(...list) })
      return arr
    }
    return Array.isArray(subServices) ? subServices : []
  }, [subServices])

  const servicesArray = useMemo(() => {
    if (!services) return []
    if (services instanceof Map) {
      const arr: any[] = []
      services.forEach((v: any) => arr.push(v))
      return arr
    }
    return Array.isArray(services) ? services : []
  }, [services])

  const menuItemMap = useMemo(
    () => new Map((menuItems || []).map((item: any) => [item.id, item])),
    [menuItems]
  )

  // ─── Choice def lookups ────────────────────────────────────────────────────
  const choiceDefMap = useMemo(() => {
    const map = new Map<string, any>()
    companiesWithChoices?.forEach?.((company: any) => {
      company.choices?.forEach?.((choice: any) => {
        if (!map.has(choice.choiceId)) map.set(choice.choiceId, choice)
      })
    })
    return map
  }, [companiesWithChoices])

  const companyInfoMap = useMemo(() => {
    const map = new Map<string, { companyName: string; buildingName: string; companyId: string; buildingId: string }>()
    companiesWithChoices?.forEach?.((company: any) => {
      const key = `${company.companyId}-${company.buildingId}`
      if (!map.has(key)) {
        map.set(key, {
          companyId: company.companyId,
          companyName: company.companyName || 'Unknown',
          buildingId: company.buildingId,
          buildingName: company.buildingName || 'Unknown',
        })
      }
    })
    return map
  }, [companiesWithChoices])

  // ─── KEY LOGIC: Per-company, per-choice quota tracking ────────────────────
  // For each "companyId-buildingId-choiceId" key, how many slots are filled?
  const companyChoiceQuota = useMemo(() => {
    // map: "companyId-buildingId-choiceId" -> { selectedCount, totalSlots }
    const quotaMap = new Map<string, { selectedCount: number; totalSlots: number }>()

    // Populate total slots from choice definitions
    Object.entries(inlineChoiceSelections).forEach(([selKey]) => {
      const parts = selKey.split('-')
      const companyId = parts[0]
      const buildingId = parts[1]
      const choiceId = parts.slice(2).join('-')
      const choiceDef = choiceDefMap.get(choiceId)
      if (!choiceDef) return

      const qKey = selKey // "companyId-buildingId-choiceId"
      if (!quotaMap.has(qKey)) {
        quotaMap.set(qKey, { selectedCount: 0, totalSlots: choiceDef.quantity || 1 })
      }
    })

    // Fill selectedCount from actual selections
    Object.entries(inlineChoiceSelections).forEach(([selKey, selItems]) => {
      if (!selItems?.length) return
      const existing = quotaMap.get(selKey)
      if (existing) {
        existing.selectedCount = selItems.length
      }
    })

    return quotaMap
  }, [inlineChoiceSelections, choiceDefMap])

  // For each company/building, is their choice quota FULLY filled?
  // Key: "companyId-buildingId-choiceId" -> boolean
  const isQuotaFilled = useMemo(() => {
    const map = new Map<string, boolean>()
    companyChoiceQuota.forEach((v, k) => {
      map.set(k, v.selectedCount >= v.totalSlots)
    })
    return map
  }, [companyChoiceQuota])

  // ─── Live choice map: which companies selected THIS specific item ──────────
  // Key: "date|serviceId|subServiceId|mealPlanId|subMealPlanId|itemId" -> CompanyEntry[]
  const liveChoiceMap = useMemo(() => {
    const map = new Map<string, CompanyEntry[]>()

    Object.entries(inlineChoiceSelections).forEach(([selKey, selItems]) => {
      if (!selItems?.length) return

      const parts = selKey.split('-')
      const companyId = parts[0]
      const buildingId = parts[1]
      const choiceId = parts.slice(2).join('-')

      const choiceDef = choiceDefMap.get(choiceId)
      if (!choiceDef) return

      const choiceDay = choiceDef.choiceDay?.toLowerCase() || ''
      const serviceId = choiceDef.serviceId || ''
      const subServiceId = choiceDef.subServiceId || ''

      const matchingDate = dateRange.find((d) => d.day.toLowerCase() === choiceDay)
      if (!matchingDate) return
      const date = matchingDate.date

      const companyInfo = companyInfoMap.get(`${companyId}-${buildingId}`)
      if (!companyInfo) return

      selItems.forEach((sel: any) => {
        const itemId = sel.selectedItemId
        const mealPlanId = sel.mealPlanId
        const subMealPlanId = sel.subMealPlanId
        if (!itemId || !mealPlanId || !subMealPlanId) return

        const key = `${date}|${serviceId}|${subServiceId}|${mealPlanId}|${subMealPlanId}|${itemId}`
        if (!map.has(key)) map.set(key, [])
        const list = map.get(key)!
        const exists = list.some((c) => c.companyId === companyId && c.buildingId === buildingId)
        if (!exists) {
          list.push({
            companyId,
            companyName: companyInfo.companyName,
            buildingId,
            buildingName: companyInfo.buildingName,
            isFromChoice: true,
          })
        }
      })
    })

    return map
  }, [inlineChoiceSelections, choiceDefMap, companyInfoMap, dateRange])

  // ─── Choice-governed cells: which companies have a choice for this cell ───
  // Key: "date|serviceId|subServiceId|mealPlanId|subMealPlanId"
  //   -> Map<"companyId-buildingId", { companyInfo, choiceKey }>
  const choiceGovernedInfoMap = useMemo(() => {
    const map = new Map<string, Map<string, { companyName: string; buildingName: string; companyId: string; buildingId: string; choiceKey: string }>>()

    Object.entries(inlineChoiceSelections).forEach(([selKey]) => {
      const parts = selKey.split('-')
      const companyId = parts[0]
      const buildingId = parts[1]
      const choiceId = parts.slice(2).join('-')

      const choiceDef = choiceDefMap.get(choiceId)
      if (!choiceDef) return

      const choiceDay = choiceDef.choiceDay?.toLowerCase() || ''
      const serviceId = choiceDef.serviceId || ''
      const subServiceId = choiceDef.subServiceId || ''
      const matchingDate = dateRange.find((d) => d.day.toLowerCase() === choiceDay)
      if (!matchingDate) return
      const date = matchingDate.date

      const companyInfo = companyInfoMap.get(`${companyId}-${buildingId}`)
      if (!companyInfo) return

      choiceDef.mealPlans?.forEach((mp: any) => {
        mp.subMealPlans?.forEach((smp: any) => {
          const cellKey = `${date}|${serviceId}|${subServiceId}|${mp.mealPlanId}|${smp.subMealPlanId}`
          if (!map.has(cellKey)) map.set(cellKey, new Map())
          map.get(cellKey)!.set(`${companyId}-${buildingId}`, {
            ...companyInfo,
            choiceKey: selKey,
          })
        })
      })
    })

    return map
  }, [inlineChoiceSelections, choiceDefMap, companyInfoMap, dateRange])

  // ─── Default company map from mealPlanAssignments ─────────────────────────
  const defaultCompanyMap = useMemo(() => {
    const map = new Map<string, CompanyEntry[]>()
    if (!mealPlanAssignments?.length) return map

    dateRange.forEach(({ date, day }) => {
      const dayKey = day.toLowerCase()
      mealPlanAssignments.forEach((assignment: any) => {
        const dayStructure = assignment.weekStructure?.[dayKey] || []
        dayStructure.forEach((service: any) => {
          service.subServices?.forEach((ss: any) => {
            ss.mealPlans?.forEach((mp: any) => {
              mp.subMealPlans?.forEach((smp: any) => {
                const cell = menuData?.[date]?.[service.serviceId]?.[ss.subServiceId]?.[mp.mealPlanId]?.[smp.subMealPlanId]
                const itemIds: string[] = cell?.menuItemIds || []
                itemIds.forEach((itemId) => {
                  const key = `${date}|${service.serviceId}|${ss.subServiceId}|${mp.mealPlanId}|${smp.subMealPlanId}|${itemId}`
                  if (!map.has(key)) map.set(key, [])
                  const list = map.get(key)!
                  const exists = list.some(
                    (c) => c.companyId === assignment.companyId && c.buildingId === assignment.buildingId
                  )
                  if (!exists) {
                    list.push({
                      companyId: assignment.companyId,
                      companyName: assignment.companyName || 'Unknown',
                      buildingId: assignment.buildingId,
                      buildingName: assignment.buildingName || 'Unknown',
                      isFromChoice: false,
                    })
                  }
                })
              })
            })
          })
        })
      })
    })
    return map
  }, [mealPlanAssignments, menuData, dateRange])

  // ─── Build structure groups ────────────────────────────────────────────────
  const buildGroupsFromAssignments = (assignments: any[]) => {
    const groupMap = new Map<string, {
      serviceId: string; serviceName: string
      subServices: Map<string, {
        subServiceId: string; subServiceName: string
        rows: Map<string, { mealPlanId: string; mealPlanName: string; subMealPlanId: string; subMealPlanName: string; order: number }>
      }>
    }>()

    dateRange.forEach(({ day }) => {
      const dayKey = day.toLowerCase()
      assignments.forEach((assignment: any) => {
        const dayStructure = assignment.weekStructure?.[dayKey] || []
        dayStructure.forEach((service: any) => {
          const sId = service.serviceId
          const sName = servicesArray.find((s: any) => s.id === sId)?.name || service.serviceName || sId
          if (!groupMap.has(sId)) groupMap.set(sId, { serviceId: sId, serviceName: sName, subServices: new Map() })
          const sGroup = groupMap.get(sId)!

          service.subServices?.forEach((ss: any) => {
            const ssId = ss.subServiceId
            const ssName = subServicesArray.find((s: any) => s.id === ssId)?.name || ss.subServiceName || ssId
            if (!sGroup.subServices.has(ssId)) sGroup.subServices.set(ssId, { subServiceId: ssId, subServiceName: ssName, rows: new Map() })
            const ssGroup = sGroup.subServices.get(ssId)!

            ss.mealPlans?.forEach((mp: any) => {
              mp.subMealPlans?.forEach((smp: any) => {
                const rKey = `${mp.mealPlanId}|${smp.subMealPlanId}`
                if (!ssGroup.rows.has(rKey)) {
                  const mpInfo = mealPlans.find((m: any) => m.id === mp.mealPlanId)
                  const smpInfo = subMealPlans.find((s: any) => s.id === smp.subMealPlanId)
                  ssGroup.rows.set(rKey, {
                    mealPlanId: mp.mealPlanId,
                    mealPlanName: mpInfo?.name || mp.mealPlanName || 'Meal Plan',
                    subMealPlanId: smp.subMealPlanId,
                    subMealPlanName: smpInfo?.name || smp.subMealPlanName || 'Sub Meal Plan',
                    order: mpInfo?.order ?? 999,
                  })
                }
              })
            })
          })
        })
      })
    })

    return Array.from(groupMap.values()).map((sg) => ({
      ...sg,
      subServices: Array.from(sg.subServices.values()).map((ss) => ({
        ...ss,
        rows: Array.from(ss.rows.values()).sort((a, b) => a.order - b.order),
      })),
    }))
  }

  const assignmentGroups = useMemo(
    () => (mealPlanAssignments?.length && dateRange.length ? buildGroupsFromAssignments(mealPlanAssignments) : []),
    [mealPlanAssignments, dateRange, servicesArray, subServicesArray, mealPlans, subMealPlans]
  )

  const choiceGroupsFallback = useMemo(() => {
    if (assignmentGroups.length > 0) return []
    if (!companiesWithChoices?.length) return []
    const pseudoAssignments: any[] = []
    const seen = new Set<string>()
    companiesWithChoices.forEach((company: any) => {
      company.choices?.forEach?.((choice: any) => {
        const sId = choice.serviceId || 'unknown'
        const ssId = choice.subServiceId || 'unknown'
        const day = choice.choiceDay || 'monday'
        const key = `${sId}|${ssId}|${day}`
        if (seen.has(key)) return
        seen.add(key)
        pseudoAssignments.push({
          weekStructure: {
            [day.toLowerCase()]: [{
              serviceId: sId,
              serviceName: servicesArray.find((s: any) => s.id === sId)?.name || sId,
              subServices: [{
                subServiceId: ssId,
                subServiceName: subServicesArray.find((s: any) => s.id === ssId)?.name || ssId,
                mealPlans: choice.mealPlans || [],
              }],
            }],
          },
        })
      })
    })
    return buildGroupsFromAssignments(pseudoAssignments)
  }, [assignmentGroups.length, companiesWithChoices, servicesArray, subServicesArray, mealPlans, subMealPlans, dateRange])

  const activeGroups = assignmentGroups.length > 0 ? assignmentGroups : choiceGroupsFallback

  // ─── CORE: compute cell data ───────────────────────────────────────────────
  const getCellData = (
    date: string,
    serviceId: string,
    subServiceId: string,
    mealPlanId: string,
    subMealPlanId: string
  ): CellData[] => {
    const cell = menuData?.[date]?.[serviceId]?.[subServiceId]?.[mealPlanId]?.[subMealPlanId]
    const itemIds: string[] = cell?.menuItemIds || []
    if (itemIds.length === 0) return []

    const cellKey = `${date}|${serviceId}|${subServiceId}|${mealPlanId}|${subMealPlanId}`
    const governedInfoMap = choiceGovernedInfoMap.get(cellKey) || new Map<string, any>()

    return itemIds.map((itemId) => {
      const item = menuItemMap.get(itemId)
      const itemName = item?.name || itemId
      const fullKey = `${cellKey}|${itemId}`

      // 1. Companies that LIVE-chose this specific item
      const liveChoiceComps = liveChoiceMap.get(fullKey) || []
      const liveChoiceKeys = new Set(liveChoiceComps.map((c) => `${c.companyId}-${c.buildingId}`))

      // 2. Default companies — exclude those governed by a choice
      const allDefaults = defaultCompanyMap.get(fullKey) || []
      const nonChoiceComps = allDefaults.filter((c) => {
        const cbKey = `${c.companyId}-${c.buildingId}`
        return !governedInfoMap.has(cbKey) && !liveChoiceKeys.has(cbKey)
      })

      const allCompanies = [...liveChoiceComps, ...nonChoiceComps]

      // 3. Pending: governed companies whose quota is NOT yet fully filled
      //    Note: if a company's quota is filled (they chose OTHER items from the same
      //    set), this item is simply "not chosen" — not "pending". Pending means
      //    the company still has open choice slots they haven't filled yet.
      const pendingList: Array<{
        companyName: string
        buildingName: string
        companyId: string
        buildingId: string
        selectedSoFar: number
        totalSlots: number
      }> = []

      governedInfoMap.forEach((info, cbKey) => {
        // Skip if this company already selected this specific item
        if (liveChoiceKeys.has(cbKey)) return

        // Check if their choice quota is fully filled
        const choiceKey = info.choiceKey // "companyId-buildingId-choiceId"
        const quota = companyChoiceQuota.get(choiceKey)

        if (!quota) {
          // No quota info = no selections at all yet = pending
          pendingList.push({
            companyId: info.companyId,
            companyName: info.companyName,
            buildingId: info.buildingId,
            buildingName: info.buildingName,
            selectedSoFar: 0,
            totalSlots: 1,
          })
          return
        }

        // Quota not fully filled = still pending (they have open slots)
        if (quota.selectedCount < quota.totalSlots) {
          pendingList.push({
            companyId: info.companyId,
            companyName: info.companyName,
            buildingId: info.buildingId,
            buildingName: info.buildingName,
            selectedSoFar: quota.selectedCount,
            totalSlots: quota.totalSlots,
          })
        }
        // If quota IS filled, they chose OTHER items — this item is simply not theirs.
        // Do NOT add to pending.
      })

      return {
        itemId,
        itemName,
        companies: allCompanies,
        totalCompanies: allCompanies.length,
        choiceCompanies: liveChoiceComps.length,
        nonChoiceCompanies: nonChoiceComps.length,
        pendingChoiceCompanies: pendingList.length,
        pendingChoiceCompanyList: pendingList,
      }
    })
  }

  // ─── Global summary stats ─────────────────────────────────────────────────
  const globalStats = useMemo(() => {
    let totalItems = 0
    let choiceAssignments = 0
    let defaultAssignments = 0
    let pendingSlots = 0

    activeGroups.forEach((service) => {
      service.subServices.forEach((subService) => {
        subService.rows.forEach((row) => {
          dateRange.forEach(({ date }) => {
            const items = getCellData(date, service.serviceId, subService.subServiceId, row.mealPlanId, row.subMealPlanId)
            items.forEach((item) => {
              totalItems++
              choiceAssignments += item.choiceCompanies
              defaultAssignments += item.nonChoiceCompanies
              pendingSlots += item.pendingChoiceCompanies
            })
          })
        })
      })
    })

    return { totalItems, choiceAssignments, defaultAssignments, pendingSlots }
  }, [activeGroups, dateRange, getCellData])

  if (!activeGroups.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-gray-50">
        <AlertCircle className="h-12 w-12 text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-700 mb-1">No Structure Found</h3>
        <p className="text-sm text-center max-w-xs text-gray-400">
          Make sure <code className="bg-gray-100 px-1 rounded text-xs">mealPlanAssignments</code> and{' '}
          <code className="bg-gray-100 px-1 rounded text-xs">dateRange</code> are passed as props.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
      {/* ── Header ── */}
      <div className="shrink-0 bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">Detailed Data Screen</h3>
            <p className="text-slate-400 text-[10px] mt-0.5">Live company-wise distribution per item</p>
          </div>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-2 text-[10px]">
          <span className="flex items-center gap-1.5 text-amber-300 bg-amber-900/30 px-2 py-1 rounded border border-amber-700/40">
            <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
            from choice
          </span>
          <span className="flex items-center gap-1.5 text-slate-300 bg-white/10 px-2 py-1 rounded border border-white/10">
            <span className="h-2 w-2 rounded-full bg-slate-400 inline-block" />
            default
          </span>
          <span className="flex items-center gap-1.5 text-orange-300 bg-orange-900/30 px-2 py-1 rounded border border-orange-700/40">
            <Clock className="h-3 w-3" />
            pending
          </span>
        </div>
      </div>

      {/* ── Summary stats bar ── */}
      <SummaryBar
        totalItems={globalStats.totalItems}
        totalCompanyAssignments={globalStats.choiceAssignments + globalStats.defaultAssignments}
        choiceCompanyAssignments={globalStats.choiceAssignments}
        defaultCompanyAssignments={globalStats.defaultAssignments}
        pendingSlots={globalStats.pendingSlots}
      />

      {/* ── Scrollable grid ── */}
      <div className="flex-1 overflow-auto bg-gray-100 px-4 py-4 space-y-6">
        {activeGroups.map((service) =>
          service.subServices.map((subService) => (
            <div
              key={`${service.serviceId}|${subService.subServiceId}`}
              className="rounded-2xl border border-gray-200 shadow-sm bg-white overflow-hidden"
              style={{ minWidth: 'max-content' }}
            >
              {/* Service / SubService header */}
              <div className="sticky top-0 z-[40] bg-gradient-to-r from-slate-700 to-slate-800 px-5 py-3 flex items-center gap-3 rounded-t-2xl">
                <div className="h-8 w-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                  <Utensils className="h-4 w-4 text-white" />
                </div>
                <div className="text-white">
                  <h4 className="font-bold text-sm leading-tight">{service.serviceName}</h4>
                  <p className="text-[11px] text-slate-300">{subService.subServiceName}</p>
                </div>
                <div className="ml-auto">
                  <span className="text-[10px] bg-white/15 text-white px-2 py-1 rounded-md">
                    {subService.rows.length} meal plans
                  </span>
                </div>
              </div>

              {/* Table */}
              <table
                className="border-collapse bg-white"
                style={{ minWidth: 'max-content', width: '100%' }}
              >
                <thead className="sticky top-[56px] z-30 shadow-sm">
                  <tr className="bg-gray-50">
                    <th className="sticky left-0 z-[35] bg-gray-50 border-b-2 border-r-2 border-gray-300 px-5 py-3 text-left min-w-[260px]">
                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                        Meal Plan / Sub Meal Plan
                      </span>
                    </th>
                    {dateRange.map((d) => (
                      <th
                        key={d.date}
                        className="border-b-2 border-r border-gray-300 px-4 py-3 text-center min-w-[240px] bg-gray-50"
                      >
                        <div className="text-xs font-bold text-gray-700 uppercase">{d.day}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{d.date}</div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {(() => {
                    const mpGroups = new Map<string, typeof subService.rows>()
                    subService.rows.forEach((row) => {
                      if (!mpGroups.has(row.mealPlanId)) mpGroups.set(row.mealPlanId, [])
                      mpGroups.get(row.mealPlanId)!.push(row)
                    })

                    const rendered: React.ReactNode[] = []
                    let globalIdx = 0

                    mpGroups.forEach((rows) => {
                      rows.forEach((row, rowInMp) => {
                        const isEven = globalIdx % 2 === 0
                        const isLast = globalIdx === subService.rows.length - 1

                        rendered.push(
                          <tr
                            key={`${row.mealPlanId}-${row.subMealPlanId}`}
                            className={`transition-colors hover:bg-blue-50/30 ${isEven ? 'bg-white' : 'bg-gray-50/40'}`}
                          >
                            {/* Sticky label */}
                            <td
                              className={`sticky left-0 z-10 px-5 py-3 min-w-[260px] border-r-2 border-gray-300 ${!isLast ? 'border-b border-gray-200' : ''} ${isEven ? 'bg-white' : 'bg-gray-50'}`}
                            >
                              <div className="ml-2">
                                {rowInMp === 0 && (
                                  <div className="font-bold text-gray-800 text-sm leading-tight">
                                    {row.mealPlanName}
                                  </div>
                                )}
                                <div className={`text-xs font-medium text-gray-500 ${rowInMp === 0 ? 'mt-1' : ''}`}>
                                  {row.subMealPlanName}
                                </div>
                              </div>
                            </td>

                            {/* Day cells */}
                            {dateRange.map((d) => {
                              const cellItems = getCellData(
                                d.date,
                                service.serviceId,
                                subService.subServiceId,
                                row.mealPlanId,
                                row.subMealPlanId
                              )

                              return (
                                <td
                                  key={d.date}
                                  className={`relative px-3 py-2.5 align-top min-w-[240px] border-r border-gray-200 ${!isLast ? 'border-b border-gray-200' : ''}`}
                                >
                                  {cellItems.length === 0 ? (
                                    <div className="text-[10px] text-gray-300 text-center py-4">—</div>
                                  ) : (
                                    <div className="space-y-2">
                                      {cellItems.map((cellItem) => {
                                        // Total pending across all companies for this item
                                        const hasPending = cellItem.pendingChoiceCompanies > 0
                                        const hasChoice = cellItem.choiceCompanies > 0
                                        const hasDefault = cellItem.nonChoiceCompanies > 0

                                        return (
                                          <button
                                            key={cellItem.itemId}
                                            onClick={() => setModalData({ cell: cellItem, day: d.day })}
                                            className="w-full text-left group"
                                          >
                                            <div
                                              className={`rounded-xl border transition-all ${
                                                hasPending
                                                  ? 'border-orange-200 hover:border-orange-300 hover:shadow-sm'
                                                  : hasChoice
                                                  ? 'border-amber-200 hover:border-amber-300 hover:shadow-sm'
                                                  : 'border-gray-200 hover:border-blue-200 hover:shadow-sm'
                                              }`}
                                            >
                                              {/* Item name row */}
                                              <div
                                                className={`px-3 py-2 rounded-t-xl text-[11px] font-semibold text-gray-800 leading-tight ${
                                                  hasPending
                                                    ? 'bg-orange-50/60'
                                                    : hasChoice
                                                    ? 'bg-amber-50/60'
                                                    : 'bg-gray-50/80'
                                                }`}
                                              >
                                                {cellItem.itemName}
                                              </div>

                                              {/* Three-section breakdown */}
                                              <div className="flex divide-x divide-gray-100 rounded-b-xl overflow-hidden">
                                                {/* DEFAULT */}
                                                <div
                                                  className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 ${
                                                    hasDefault ? 'bg-white' : 'bg-gray-50/40'
                                                  }`}
                                                >
                                                  <span className={`text-base font-black leading-none ${hasDefault ? 'text-gray-700' : 'text-gray-300'}`}>
                                                    {cellItem.nonChoiceCompanies}
                                                  </span>
                                                  <span className="text-[8px] text-gray-400 font-medium mt-0.5 uppercase tracking-wide">
                                                    default
                                                  </span>
                                                </div>

                                                {/* CHOICE SELECTED */}
                                                <div
                                                  className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 ${
                                                    hasChoice ? 'bg-amber-50' : 'bg-gray-50/40'
                                                  }`}
                                                >
                                                  <span className={`text-base font-black leading-none ${hasChoice ? 'text-amber-600' : 'text-gray-300'}`}>
                                                    {cellItem.choiceCompanies}
                                                  </span>
                                                  <span className="text-[8px] text-amber-500 font-medium mt-0.5 uppercase tracking-wide">
                                                    {hasChoice ? 'chosen ✓' : 'chosen'}
                                                  </span>
                                                </div>

                                                {/* PENDING */}
                                                <div
                                                  className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 ${
                                                    hasPending ? 'bg-orange-50' : 'bg-gray-50/40'
                                                  }`}
                                                >
                                                  <span className={`text-base font-black leading-none ${hasPending ? 'text-orange-500' : 'text-gray-300'}`}>
                                                    {cellItem.pendingChoiceCompanies}
                                                  </span>
                                                  <span className={`text-[8px] font-medium mt-0.5 uppercase tracking-wide flex items-center gap-0.5 ${hasPending ? 'text-orange-400' : 'text-gray-300'}`}>
                                                    {hasPending && <Clock className="h-2 w-2" />}
                                                    pending
                                                  </span>
                                                </div>
                                              </div>
                                            </div>
                                          </button>
                                        )
                                      })}
                                    </div>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        )
                        globalIdx++
                      })
                    })

                    return rendered
                  })()}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>

      {/* Company detail modal */}
      {modalData && (
        <CompanyDetailModal
          cellData={modalData.cell}
          day={modalData.day}
          onClose={() => setModalData(null)}
        />
      )}
    </div>
  )
}