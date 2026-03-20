"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, ChevronDown, ChevronUp, X } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

interface MenuItem {
  id: string
  name: string
  selectedDescription?: string
}

interface MealPlanChoice {
  choiceId: string
  quantity: number
  choiceDay?: string
  mealPlans: Array<{
    mealPlanId: string
    mealPlanName?: string
    subMealPlans: Array<{ subMealPlanId: string; subMealPlanName?: string }>
  }>
  createdAt?: string | Date
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

// Selection structure: "companyId-buildingId-choiceId" => SubMealSelections[]
type SelectionMap = Record<string, SubMealSelection[]>

interface ChoicesPanelProps {
  companies: CompanyChoice[]
  selections: SelectionMap
  onSelectionChange: (selections: SelectionMap) => void
  menuData?: Record<string, Record<string, Record<string, Record<string, Record<string, any>>>>>
  allMenuItems?: MenuItem[]
  dateRange?: Array<{ date: string; day: string }>
}

export function ChoicesPanel({
  companies,
  selections,
  onSelectionChange,
  menuData = {},
  allMenuItems = [],
  dateRange = [],
}: ChoicesPanelProps) {
  const [expandedBuildings, setExpandedBuildings] = useState<Set<string>>(new Set())

  // Lookup menu items by ID
  const menuItemMap = useMemo(() => {
    return new Map(allMenuItems.map((item) => [item.id, item]))
  }, [allMenuItems])

  // Get available menu items for a specific submeal plan
  const getMenuItemsForSubMeal = (
    choice: MealPlanChoice,
    mealPlanId: string,
    subMealPlanId: string
  ): MenuItem[] => {
    if (!choice.choiceDay) return []

    const choiceDateObj = dateRange.find(
      (d) => d.day?.toLowerCase() === choice.choiceDay?.toLowerCase()
    )
    if (!choiceDateObj) return []

    const dateData = menuData[choiceDateObj.date]
    if (!dateData) return []

    const items = new Map<string, MenuItem>()

    // Iterate through all services and subservices to find items for this specific submeal
    Object.values(dateData).forEach((serviceData: any) => {
      Object.values(serviceData || {}).forEach((subServiceData: any) => {
        const cellData = subServiceData?.[mealPlanId]?.[subMealPlanId]

        if (cellData?.menuItemIds?.length > 0) {
          cellData.menuItemIds.forEach((itemId: string) => {
            const item = menuItemMap.get(itemId)
            if (item && !items.has(itemId)) {
              items.set(itemId, item)
            }
          })
        }
      })
    })

    return Array.from(items.values())
  }

  // Handle submeal item selection
  const selectItemForSubMeal = (
    companyId: string,
    buildingId: string,
    choiceId: string,
    mealPlanId: string,
    mealPlanName: string,
    subMealPlanId: string,
    subMealPlanName: string,
    itemId: string,
    itemName: string
  ) => {
    const key = `${companyId}-${buildingId}-${choiceId}`
    const currentSelection = selections[key] || []

    // Remove any existing selection for this submeal
    const updatedSelection = currentSelection.filter(
      (sel) =>
        !(
          sel.mealPlanId === mealPlanId &&
          sel.subMealPlanId === subMealPlanId
        )
    )

    // Add the new selection
    updatedSelection.push({
      mealPlanId,
      mealPlanName,
      subMealPlanId,
      subMealPlanName,
      selectedItemId: itemId,
      selectedItemName: itemName,
    })

    onSelectionChange({
      ...selections,
      [key]: updatedSelection,
    })
  }

  // Remove submeal selection
  const removeSubMealSelection = (
    companyId: string,
    buildingId: string,
    choiceId: string,
    mealPlanId: string,
    subMealPlanId: string
  ) => {
    const key = `${companyId}-${buildingId}-${choiceId}`
    const currentSelection = selections[key] || []

    const updatedSelection = currentSelection.filter(
      (sel) =>
        !(
          sel.mealPlanId === mealPlanId &&
          sel.subMealPlanId === subMealPlanId
        )
    )

    onSelectionChange({
      ...selections,
      [key]: updatedSelection,
    })
  }

  // Toggle building expansion
  const toggleBuildingExpanded = (key: string) => {
    const newSet = new Set(expandedBuildings)
    if (newSet.has(key)) {
      newSet.delete(key)
    } else {
      newSet.add(key)
    }
    setExpandedBuildings(newSet)
  }

  if (companies.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
        No choices configured for this menu
      </div>
    )
  }

  // Group by company
  const groupedCompanies = useMemo(() => {
    const groups = new Map<string, CompanyChoice[]>()
    companies.forEach((c) => {
      const key = c.companyId
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)?.push(c)
    })
    return Array.from(groups.entries()).map(([companyId, buildings]) => ({
      companyId,
      companyName: buildings[0].companyName,
      buildings,
    }))
  }, [companies])

  return (
    <div className="space-y-4">
      <div className="border-t pt-4 mt-4">
        <h3 className="text-lg font-bold text-gray-900 mb-4">🎯 Choices</h3>
        <p className="text-sm text-gray-600 mb-4">
          Configure item selections for each choice by company and building
        </p>

        <ScrollArea className="w-full border rounded-lg">
          <div className="space-y-3 p-4">
            {groupedCompanies.map((group) =>
              group.buildings.map((building) => {
                const buildingKey = `${building.companyId}-${building.buildingId}`
                const isExpanded = expandedBuildings.has(buildingKey)
                const completionCount = building.choices.filter((choice) => {
                  const key = `${building.companyId}-${building.buildingId}-${choice.choiceId}`
                  return (selections[key] || []).length > 0
                }).length

                return (
                  <div
                    key={buildingKey}
                    className="border rounded-lg overflow-hidden bg-white hover:shadow-sm transition-shadow"
                  >
                    {/* Building Header - Collapsible */}
                    <button
                      onClick={() => toggleBuildingExpanded(buildingKey)}
                      className="w-full px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b hover:from-blue-100 hover:to-indigo-100 transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 flex-1 text-left">
                        <div>
                          <p className="font-semibold text-gray-900">{building.companyName}</p>
                          <p className="text-xs text-gray-600">{building.buildingName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {completionCount === building.choices.length && building.choices.length > 0 && (
                          <Badge className="bg-green-600 text-white">
                            {completionCount}/{building.choices.length} Complete
                          </Badge>
                        )}
                        {completionCount > 0 && completionCount < building.choices.length && (
                          <Badge className="bg-amber-600 text-white">
                            {completionCount}/{building.choices.length} Choices
                          </Badge>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-gray-600" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-600" />
                        )}
                      </div>
                    </button>

                    {/* Building Choices - Expandable */}
                    {isExpanded && (
                      <div className="p-4 space-y-4 bg-gray-50 border-t">
                        {building.choices.map((choice) => {
                          const selectionKey = `${building.companyId}-${building.buildingId}-${choice.choiceId}`
                          const selectedSubMeals = selections[selectionKey] || []
                          const choiceDateObj = dateRange.find(
                            (d) => d.day?.toLowerCase() === choice.choiceDay?.toLowerCase()
                          )

                          return (
                            <div key={choice.choiceId} className="bg-white border rounded-lg overflow-hidden">
                              {/* Choice Header */}
                              <div className="px-4 py-3 bg-blue-50 border-b">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-semibold text-gray-900">
                                      {choice.mealPlans.map((mp) => mp.mealPlanName).join(" + ")}
                                    </p>
                                    <p className="text-xs text-gray-600 mt-1">
                                      Day: <span className="font-semibold">{choice.choiceDay}</span>
                                      {choiceDateObj && ` (${choiceDateObj.date})`}
                                    </p>
                                  </div>
                                  {selectedSubMeals.length > 0 && (
                                    <Badge className="bg-green-600">
                                      {selectedSubMeals.length}/{choice.mealPlans.reduce((sum, mp) => sum + mp.subMealPlans.length, 0)}
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {/* Choice Content */}
                              <div className="p-4 space-y-4">
                                {choice.mealPlans.map((mealPlan) => (
                                  <div key={mealPlan.mealPlanId} className="space-y-3">
                                    {/* Meal Plan Title */}
                                    <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                                      {mealPlan.mealPlanName}
                                    </p>

                                    {/* SubMeal Items Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      {mealPlan.subMealPlans.map((subMealPlan) => {
                                        const selectedForSubMeal = selectedSubMeals.find(
                                          (sel) =>
                                            sel.mealPlanId === mealPlan.mealPlanId &&
                                            sel.subMealPlanId === subMealPlan.subMealPlanId
                                        )

                                        const subMealItems = getMenuItemsForSubMeal(
                                          choice,
                                          mealPlan.mealPlanId,
                                          subMealPlan.subMealPlanId
                                        )

                                        return (
                                          <div
                                            key={subMealPlan.subMealPlanId}
                                            className={`border rounded-lg p-3 transition-all ${
                                              selectedForSubMeal
                                                ? "border-green-400 bg-green-50"
                                                : "border-gray-200 bg-white hover:border-blue-300"
                                            }`}
                                          >
                                            {/* SubMeal Title with Clear Button */}
                                            <div className="flex items-center justify-between mb-2">
                                              <p className="text-xs font-semibold text-gray-700">
                                                {subMealPlan.subMealPlanName}
                                              </p>
                                              {selectedForSubMeal && (
                                                <button
                                                  onClick={() =>
                                                    removeSubMealSelection(
                                                      building.companyId,
                                                      building.buildingId,
                                                      choice.choiceId,
                                                      mealPlan.mealPlanId,
                                                      subMealPlan.subMealPlanId
                                                    )
                                                  }
                                                  className="text-red-500 hover:text-red-700 transition-colors"
                                                  title="Clear selection"
                                                >
                                                  <X className="h-3.5 w-3.5" />
                                                </button>
                                              )}
                                            </div>

                                            {/* Selected Item Display */}
                                            {selectedForSubMeal && (
                                              <div className="mb-2 p-2 bg-green-100 rounded border border-green-300">
                                                <div className="flex items-center gap-2">
                                                  <CheckCircle2 className="h-3.5 w-3.5 text-green-700 flex-shrink-0" />
                                                  <p className="text-xs font-medium text-green-900">
                                                    {selectedForSubMeal.selectedItemName}
                                                  </p>
                                                </div>
                                              </div>
                                            )}

                                            {/* Available Items */}
                                            {!selectedForSubMeal && subMealItems.length > 0 && (
                                              <div className="space-y-1.5">
                                                {subMealItems.map((item) => (
                                                  <button
                                                    key={item.id}
                                                    onClick={() =>
                                                      selectItemForSubMeal(
                                                        building.companyId,
                                                        building.buildingId,
                                                        choice.choiceId,
                                                        mealPlan.mealPlanId,
                                                        mealPlan.mealPlanName || "",
                                                        subMealPlan.subMealPlanId,
                                                        subMealPlan.subMealPlanName || "",
                                                        item.id,
                                                        item.name
                                                      )
                                                    }
                                                    className="w-full text-left px-2 py-1.5 rounded text-xs font-medium bg-gray-100 text-gray-900 hover:bg-blue-100 hover:text-blue-900 transition-colors border border-gray-200 hover:border-blue-300"
                                                  >
                                                    {item.name}
                                                  </button>
                                                ))}
                                              </div>
                                            )}

                                            {!selectedForSubMeal && subMealItems.length === 0 && (
                                              <p className="text-xs text-gray-500 text-center py-2">
                                                No items
                                              </p>
                                            )}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
