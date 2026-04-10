"use client"

import React, { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Building2, Utensils, ChevronDown } from "lucide-react"

interface ServiceSubService {
  serviceId: string
  serviceName: string
  subServiceId: string
  subServiceName: string
}

interface MealPlanInfo {
  mealPlanId: string
  mealPlanName: string
  subMealPlanId: string
  subMealPlanName: string
}

interface Choice {
  choiceId: string
  quantity: number
  serviceId?: string
  subServiceId?: string
  mealPlans: Array<{
    mealPlanId: string
    mealPlanName?: string
    subMealPlans: Array<{ subMealPlanId: string; subMealPlanName?: string }>
  }>
}

interface CompanyChoice {
  companyId: string
  companyName: string
  buildingId: string
  buildingName: string
  choices: Choice[]
}

interface UniversalChoiceGridProps {
  companiesWithChoices: CompanyChoice[]
  selections: Record<string, any[]>
  setSelections: (selections: Record<string, any[]>) => void
  subMealPlans: any[]
  allMenuItems: any[]
}

export function UniversalChoiceGrid({
  companiesWithChoices,
  selections,
  setSelections,
  subMealPlans = [],
  allMenuItems = [],
}: UniversalChoiceGridProps) {
  // Extract unique service/sub-service combinations across all companies
  const serviceColumns: ServiceSubService[] = useMemo(() => {
    const map = new Map<string, ServiceSubService>()
    
    companiesWithChoices.forEach((company) => {
      company.choices.forEach((choice) => {
        const key = `${choice.serviceId || 'unknown'}|${choice.subServiceId || 'unknown'}`
        if (!map.has(key)) {
          map.set(key, {
            serviceId: choice.serviceId || 'unknown',
            serviceName: choice.serviceId ? 'Service' : 'Unknown Service',
            subServiceId: choice.subServiceId || 'unknown',
            subServiceName: choice.subServiceId ? 'Sub-Service' : 'Unknown Sub-Service',
          })
        }
      })
    })
    
    return Array.from(map.values())
  }, [companiesWithChoices])

  // Get distinct company/building combinations (rows)
  const companyRows = useMemo(() => {
    const seen = new Set<string>()
    const result: CompanyChoice[] = []
    
    companiesWithChoices.forEach((company) => {
      const key = `${company.companyId}-${company.buildingId}`
      if (!seen.has(key)) {
        seen.add(key)
        result.push(company)
      }
    })
    
    return result
  }, [companiesWithChoices])

  // Get choices for a specific company and service/sub-service combination
  const getChoicesForCell = (
    companyId: string,
    buildingId: string,
    serviceId: string,
    subServiceId: string
  ): Choice[] => {
    const company = companiesWithChoices.find(
      (c) => c.companyId === companyId && c.buildingId === buildingId
    )
    
    if (!company) return []
    
    return company.choices.filter(
      (c) =>
        (c.serviceId === serviceId || serviceId === 'unknown') &&
        (c.subServiceId === subServiceId || subServiceId === 'unknown')
    )
  }

  // Get all meal plans for choices in a cell
  const getMealPlansForCell = (
    companyId: string,
    buildingId: string,
    serviceId: string,
    subServiceId: string
  ): MealPlanInfo[] => {
    const choices = getChoicesForCell(companyId, buildingId, serviceId, subServiceId)
    const mealPlanMap = new Map<string, MealPlanInfo>()
    
    choices.forEach((choice) => {
      choice.mealPlans?.forEach((mp) => {
        mp.subMealPlans?.forEach((smp) => {
          const key = `${mp.mealPlanId}|${smp.subMealPlanId}`
          if (!mealPlanMap.has(key)) {
            mealPlanMap.set(key, {
              mealPlanId: mp.mealPlanId,
              mealPlanName: mp.mealPlanName || 'MP',
              subMealPlanId: smp.subMealPlanId,
              subMealPlanName: smp.subMealPlanName || 'SMP',
            })
          }
        })
      })
    })
    
    return Array.from(mealPlanMap.values())
  }

  // Get selection count for a cell
  const getSelectionCount = (
    companyId: string,
    buildingId: string,
    serviceId: string,
    subServiceId: string
  ): number => {
    const prefix = `${companyId}-${buildingId}-`
    return Object.entries(selections)
      .filter(([key]) => key.startsWith(prefix))
      .reduce((sum, [, arr]) => sum + (Array.isArray(arr) ? arr.length : 0), 0)
  }

  // Get total choices for a cell
  const getTotalChoices = (
    companyId: string,
    buildingId: string,
    serviceId: string,
    subServiceId: string
  ): number => {
    const choices = getChoicesForCell(companyId, buildingId, serviceId, subServiceId)
    return choices.reduce((sum, c) => sum + (c.quantity || 0), 0)
  }

  if (serviceColumns.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <p className="text-sm text-gray-400">No service/sub-service combinations found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header info */}
      <div className="shrink-0 bg-blue-50 border-b border-blue-200 px-4 py-3">
        <p className="text-sm text-blue-700 font-medium">
          Universal View — {companyRows.length} companies/buildings × {serviceColumns.length} service groups
        </p>
      </div>

      {/* Scrollable table */}
      <div className="flex-1 overflow-auto">
        <table className="border-collapse w-full bg-white">
          <thead className="sticky top-0 z-20">
            <tr className="bg-gray-50">
              {/* First column header - Company/Building */}
              <th className="sticky left-0 z-30 bg-gray-50 border border-gray-300 px-4 py-3 text-left min-w-[200px]">
                <span className="text-xs font-bold text-gray-600 uppercase">Company / Building</span>
              </th>
              
              {/* Service/Sub-Service column headers */}
              {serviceColumns.map((col) => (
                <th
                  key={`${col.serviceId}|${col.subServiceId}`}
                  className="border border-gray-300 px-4 py-3 text-left min-w-[250px] bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    <Utensils className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{col.serviceName}</p>
                      <p className="text-xs text-gray-500">{col.subServiceName}</p>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {companyRows.map((company, rowIdx) => (
              <tr key={`${company.companyId}-${company.buildingId}`} className={rowIdx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                {/* Company/Building cell */}
                <td className="sticky left-0 z-10 border border-gray-300 px-4 py-4 min-w-[200px] font-medium text-gray-900 bg-inherit">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{company.companyName}</p>
                      <p className="text-xs text-gray-500">{company.buildingName}</p>
                    </div>
                  </div>
                </td>

                {/* Service/Sub-Service cells */}
                {serviceColumns.map((col) => {
                  const mealPlans = getMealPlansForCell(
                    company.companyId,
                    company.buildingId,
                    col.serviceId,
                    col.subServiceId
                  )
                  const selectionCount = getSelectionCount(
                    company.companyId,
                    company.buildingId,
                    col.serviceId,
                    col.subServiceId
                  )
                  const totalChoices = getTotalChoices(
                    company.companyId,
                    company.buildingId,
                    col.serviceId,
                    col.subServiceId
                  )
                  const hasChoices = totalChoices > 0

                  return (
                    <td
                      key={`${company.companyId}-${company.buildingId}-${col.serviceId}|${col.subServiceId}`}
                      className="border border-gray-300 px-4 py-4 min-w-[250px] align-top bg-inherit"
                    >
                      {hasChoices ? (
                        <div className="space-y-2">
                          {/* Meal plans */}
                          <div className="space-y-2">
                            {mealPlans.map((mp) => (
                              <div
                                key={`${mp.mealPlanId}|${mp.subMealPlanId}`}
                                className="rounded border border-gray-200 bg-gray-50 p-2"
                              >
                                <p className="font-semibold text-xs text-gray-900">{mp.mealPlanName}</p>
                                <p className="text-xs text-gray-600 mt-0.5">{mp.subMealPlanName}</p>
                              </div>
                            ))}
                          </div>

                          {/* Selection counter */}
                          {totalChoices > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <Badge
                                variant={selectionCount >= totalChoices ? "default" : "secondary"}
                                className={`text-xs ${
                                  selectionCount >= totalChoices
                                    ? "bg-green-100 text-green-700 border-green-200"
                                    : "bg-amber-100 text-amber-700 border-amber-200"
                                }`}
                              >
                                {selectionCount}/{totalChoices} selected
                              </Badge>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-300 text-center py-4">—</div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
