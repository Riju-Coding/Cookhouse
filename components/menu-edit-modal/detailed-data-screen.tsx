'use client'

import React, { useMemo, useState } from 'react'
import { AlertCircle, Building2, Utensils, X } from 'lucide-react'

interface DetailedDataScreenProps {
  companiesWithChoices: any[]
  services: any[]
  subServices: any        // Map<string, SubService[]> OR SubService[]
  mealPlans: any[]
  subMealPlans: any[]
  menuItems: any[]
  menuData?: any
  dateRange?: Array<{ date: string; day: string }>
  mealPlanAssignments?: any[]
  // Live selections from Choice Selection / Universal tabs
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
  companies: CompanyEntry[]
  totalCompanies: number
  choiceCompanies: number
  nonChoiceCompanies: number
}

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
      className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-slate-700 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-white font-semibold text-sm">{cellData.itemName}</p>
            <p className="text-slate-300 text-xs mt-0.5 capitalize">{day}</p>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white p-1 rounded">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-3">
          <div className="flex gap-2 mb-3 flex-wrap">
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {cellData.totalCompanies} total
            </span>
            {cellData.choiceCompanies > 0 && (
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                {cellData.choiceCompanies} from choice
              </span>
            )}
            {cellData.nonChoiceCompanies > 0 && (
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-50 text-gray-700 border border-gray-200">
                {cellData.nonChoiceCompanies} default
              </span>
            )}
          </div>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {cellData.companies.map((c, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
                  c.isFromChoice ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <Building2
                  className={`h-3.5 w-3.5 shrink-0 ${c.isFromChoice ? 'text-amber-600' : 'text-gray-500'}`}
                />
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{c.companyName}</p>
                  <p className="text-gray-500 truncate">{c.buildingName}</p>
                </div>
                {c.isFromChoice && (
                  <span className="ml-auto shrink-0 text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                    choice
                  </span>
                )}
              </div>
            ))}
            {cellData.companies.length === 0 && (
              <p className="text-xs text-gray-400 italic text-center py-4">No company data available</p>
            )}
          </div>
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

  // Flatten subServices regardless of Map or array
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

  // ─── Build structure groups ───────────────────────────────────────────────
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

  // Fallback: build from companiesWithChoices
  const choiceGroups = useMemo(() => {
    if (assignmentGroups.length > 0) return []
    if (!companiesWithChoices?.length) return []
    const pseudoAssignments: any[] = []
    const seen = new Set<string>()
    companiesWithChoices.forEach((company: any) => {
      company.choices?.forEach((choice: any) => {
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

  const activeGroups = assignmentGroups.length > 0 ? assignmentGroups : choiceGroups

  // ─── LIVE CHOICE COMPANY MAP ──────────────────────────────────────────────
  // This is the key: for each (date, serviceId, subServiceId, mealPlanId, subMealPlanId, itemId)
  // we compute which companies have selected that specific item via inlineChoiceSelections.
  //
  // inlineChoiceSelections keys: "companyId-buildingId-choiceId"
  // Each value: Array<{ mealPlanId, subMealPlanId, selectedItemId, selectedItemName, ... }>
  //
  // A company "chose" item X for a cell if:
  //   - They have a selection entry where selectedItemId === X
  //   - AND the choice's choiceDay matches the date's day
  //   - AND the choice's serviceId/subServiceId matches the cell's service/subservice
  //   - AND the selection's mealPlanId/subMealPlanId matches the cell's mealPlan/subMealPlan

  // Build a lookup: choiceId -> choice definition (day, serviceId, subServiceId)
  const choiceDefMap = useMemo(() => {
    const map = new Map<string, any>()
    companiesWithChoices?.forEach?.((company: any) => {
      company.choices?.forEach?.((choice: any) => {
        if (!map.has(choice.choiceId)) {
          map.set(choice.choiceId, choice)
        }
      })
    })
    return map
  }, [companiesWithChoices])

  // Build a lookup: companyId-buildingId -> { companyName, buildingName }
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

  // liveChoiceMap: "date|serviceId|subServiceId|mealPlanId|subMealPlanId|itemId" -> CompanyEntry[]
  // Companies that have THIS item selected live in the choice modal
  const liveChoiceMap = useMemo(() => {
    const map = new Map<string, CompanyEntry[]>()

    Object.entries(inlineChoiceSelections).forEach(([selKey, selItems]) => {
      if (!selItems?.length) return

      // selKey = "companyId-buildingId-choiceId"
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

  // For each cell item, which companies have a choice for that cell (regardless of what they picked)?
  // These companies are "choice-governed" — they won't appear as default for that cell
  // because their item is determined by their selection, not by the default menu.
  const choiceGoverned = useMemo(() => {
    // Map: "date|serviceId|subServiceId|mealPlanId|subMealPlanId" -> Set<"companyId-buildingId">
    const map = new Map<string, Set<string>>()

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

      // This company is governed by a choice for ALL mealPlan/subMealPlan combos in this choice
      choiceDef.mealPlans?.forEach((mp: any) => {
        mp.subMealPlans?.forEach((smp: any) => {
          const cellKey = `${date}|${serviceId}|${subServiceId}|${mp.mealPlanId}|${smp.subMealPlanId}`
          if (!map.has(cellKey)) map.set(cellKey, new Set())
          map.get(cellKey)!.add(`${companyId}-${buildingId}`)
        })
      })
    })

    return map
  }, [inlineChoiceSelections, choiceDefMap, dateRange])

  // Default company map from mealPlanAssignments
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

  // Fallback: build default companies from companiesWithChoices when no mealPlanAssignments
  const fallbackDefaultMap = useMemo(() => {
    if (mealPlanAssignments?.length > 0) return new Map<string, CompanyEntry[]>()
    const map = new Map<string, CompanyEntry[]>()

    companiesWithChoices?.forEach?.((company: any) => {
      company.choices?.forEach?.((choice: any) => {
        const serviceId = choice.serviceId || ''
        const subServiceId = choice.subServiceId || ''
        const choiceDay = choice.choiceDay?.toLowerCase() || ''
        const matchingDate = dateRange.find((d) => d.day.toLowerCase() === choiceDay)
        if (!matchingDate) return
        const date = matchingDate.date

        choice.mealPlans?.forEach((mp: any) => {
          mp.subMealPlans?.forEach((smp: any) => {
            const cell = menuData?.[date]?.[serviceId]?.[subServiceId]?.[mp.mealPlanId]?.[smp.subMealPlanId]
            const itemIds: string[] = cell?.menuItemIds || []
            itemIds.forEach((itemId) => {
              const key = `${date}|${serviceId}|${subServiceId}|${mp.mealPlanId}|${smp.subMealPlanId}|${itemId}`
              if (!map.has(key)) map.set(key, [])
              const list = map.get(key)!
              const exists = list.some(
                (c) => c.companyId === company.companyId && c.buildingId === company.buildingId
              )
              if (!exists) {
                list.push({
                  companyId: company.companyId,
                  companyName: company.companyName || 'Unknown',
                  buildingId: company.buildingId,
                  buildingName: company.buildingName || 'Unknown',
                  isFromChoice: false,
                })
              }
            })
          })
        })
      })
    })
    return map
  }, [mealPlanAssignments, companiesWithChoices, menuData, dateRange])

  // ─── CORE: compute cell data with LIVE choice awareness ───────────────────
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
    // Companies governed by a choice for this cell
    const governedCompanyKeys = choiceGoverned.get(cellKey) || new Set<string>()

    return itemIds.map((itemId) => {
      const item = menuItemMap.get(itemId)
      const itemName = item?.name || itemId
      const fullKey = `${cellKey}|${itemId}`

      // 1. Companies that LIVE-selected this specific item in the choice modal
      const liveChoiceComps = liveChoiceMap.get(fullKey) || []
      const liveChoiceKeys = new Set(liveChoiceComps.map((c) => `${c.companyId}-${c.buildingId}`))

      // 2. Default companies (from mealPlanAssignments or fallback)
      //    BUT exclude any company that is choice-governed for this cell
      //    (because their item is determined by their choice selection, not defaults)
      const allDefaults = defaultCompanyMap.get(fullKey) || fallbackDefaultMap.get(fullKey) || []
      const nonChoiceComps = allDefaults.filter((c) => {
        const cbKey = `${c.companyId}-${c.buildingId}`
        // Exclude if they are choice-governed (they'll only appear if they picked this item)
        return !governedCompanyKeys.has(cbKey)
      })
      // Also exclude any that are already in liveChoice (avoid duplicates)
      const filteredNonChoice = nonChoiceComps.filter((c) => !liveChoiceKeys.has(`${c.companyId}-${c.buildingId}`))

      const allCompanies = [...liveChoiceComps, ...filteredNonChoice]

      return {
        itemId,
        itemName,
        companies: allCompanies,
        totalCompanies: allCompanies.length,
        choiceCompanies: liveChoiceComps.length,
        nonChoiceCompanies: filteredNonChoice.length,
      }
    })
  }

  if (!activeGroups.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-gray-50">
        <AlertCircle className="h-12 w-12 text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-700 mb-1">No Structure Found</h3>
        <p className="text-sm text-center max-w-xs">
          Make sure <code className="bg-gray-100 px-1 rounded text-xs">mealPlanAssignments</code> and{' '}
          <code className="bg-gray-100 px-1 rounded text-xs">dateRange</code> are passed as props.
        </p>
        <p className="text-xs text-gray-400 mt-3">
          companies: {companiesWithChoices?.length ?? 0} · assignments: {mealPlanAssignments?.length ?? 0} · dates: {dateRange?.length ?? 0}
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
      {/* Header */}
      <div className="shrink-0 bg-blue-50 border-b border-blue-200 shadow-sm px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-blue-600" />
          <span className="font-semibold text-blue-800">Detailed Data Screen</span>
          <span className="text-xs text-blue-600 font-medium ml-2 bg-white px-2 py-0.5 rounded-full border border-blue-200">
            Live company-wise distribution
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
            <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
            from choice (live)
          </span>
          <span className="flex items-center gap-1.5 text-gray-600 bg-gray-50 px-2 py-1 rounded border border-gray-200">
            <span className="h-2 w-2 rounded-full bg-gray-400 inline-block" />
            default
          </span>
        </div>
      </div>

      {/* Scrollable grid */}
      <div className="flex-1 overflow-auto bg-gray-100 px-4 py-4 space-y-6">
        {activeGroups.map((service) =>
          service.subServices.map((subService) => (
            <div
              key={`${service.serviceId}|${subService.subServiceId}`}
              className="rounded-xl border border-gray-200 shadow-sm bg-white overflow-hidden"
              style={{ minWidth: 'max-content' }}
            >
              {/* Service / SubService header */}
              <div className="sticky top-0 z-[40] bg-gradient-to-r from-slate-700 to-slate-800 px-5 py-3 flex items-center gap-3 rounded-t-xl">
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

              {/* Grid table */}
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
                        className="border-b-2 border-r border-gray-300 px-4 py-3 text-center min-w-[220px] bg-gray-50"
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
                            {/* Left sticky label */}
                            <td
                              className={`sticky left-0 z-10 px-5 py-3 min-w-[260px] border-r-2 border-gray-300 ${!isLast ? 'border-b border-gray-200' : ''} ${isEven ? 'bg-white' : 'bg-gray-50'}`}
                            >
                              <div className="ml-2">
                                {rowInMp === 0 && (
                                  <div className="font-semibold text-gray-800 text-sm leading-tight">
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
                                  className={`relative px-3 py-2.5 align-top min-w-[220px] border-r border-gray-200 ${!isLast ? 'border-b border-gray-200' : ''}`}
                                >
                                  {cellItems.length === 0 ? (
                                    <div className="text-[10px] text-gray-300 text-center py-3">—</div>
                                  ) : (
                                    <div className="space-y-1.5">
                                      {cellItems.map((cellItem) => (
                                        <button
                                          key={cellItem.itemId}
                                          onClick={() => setModalData({ cell: cellItem, day: d.day })}
                                          className="w-full text-left"
                                        >
                                          <div
                                            className={`flex items-start justify-between gap-2 px-2.5 py-1.5 rounded-md border transition-colors ${
                                              cellItem.choiceCompanies > 0
                                                ? 'bg-amber-50/60 border-amber-200 hover:bg-amber-50 hover:border-amber-300'
                                                : 'bg-gray-50 border-gray-200 hover:bg-blue-50 hover:border-blue-200'
                                            }`}
                                          >
                                            <span className="text-[11px] text-gray-700 font-medium leading-tight truncate flex-1">
                                              {cellItem.itemName}
                                            </span>
                                            <div className="flex items-center gap-1 shrink-0 ml-1">
                                              {/* Choice companies — amber */}
                                              {cellItem.choiceCompanies > 0 && (
                                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                                                  <Building2 className="h-2.5 w-2.5" />
                                                  {cellItem.choiceCompanies}
                                                </span>
                                              )}
                                              {/* Default companies — gray */}
                                              {cellItem.nonChoiceCompanies > 0 && (
                                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                                                  <Building2 className="h-2.5 w-2.5" />
                                                  {cellItem.nonChoiceCompanies}
                                                </span>
                                              )}
                                              {/* Total if both */}
                                              {cellItem.choiceCompanies > 0 && cellItem.nonChoiceCompanies > 0 && (
                                                <span className="text-[9px] text-gray-400 font-medium">
                                                  /{cellItem.totalCompanies}
                                                </span>
                                              )}
                                              {/* Zero state — choice-governed but none selected this item */}
                                              {cellItem.totalCompanies === 0 && (
                                                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-400 border border-red-100">
                                                  <Building2 className="h-2.5 w-2.5" />
                                                  0
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </button>
                                      ))}
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