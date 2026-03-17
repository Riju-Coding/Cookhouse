"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, CheckCircle2, Circle } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { ScrollArea } from "@/components/ui/scroll-area"

interface MenuCell {
  menuItemIds: string[]
  selectedDescriptions?: Record<string, string>
  customAssignments?: Record<string, Array<{ companyId: string; buildingId: string }>>
}

interface MenuItem {
  id: string
  name: string
  selectedDescription?: string
}

interface MealPlanChoice {
  choiceId: string
  quantity: number
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

interface ChoiceSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  companies: CompanyChoice[]
  onConfirm: (selections: Record<string, string>) => void
  loading?: boolean
  menuData?: Record<string, any> // Full menu data structure
  allMenuItems?: MenuItem[] // List of all menu items for lookup
  dateRange?: Array<{ date: string; day: string }> // Date range for displaying full day menu
  mealPlanStructure?: Array<{ date: string; day: string; day_type: string; mealPlanId: string; mealPlanName: string; subMealPlans: Array<{ subMealPlanId: string; subMealPlanName: string }> }> // Meal plan structure
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
  mealPlanStructure = [],
}: ChoiceSelectionModalProps) {
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [activeCompanyIndex, setActiveCompanyIndex] = useState(0)
  const [expandedSubMeal, setExpandedSubMeal] = useState<Set<string>>(new Set())

  const currentCompany = companies[activeCompanyIndex]
  const selectedChoiceId = selections[currentCompany?.companyId]
  const selectedChoice = currentCompany?.choices.find((c) => c.choiceId === selectedChoiceId)

  // Lookup menu items by ID
  const menuItemMap = useMemo(() => {
    return new Map(allMenuItems.map(item => [item.id, item]))
  }, [allMenuItems])

  const handleSelectChoice = useCallback(
    (companyId: string, choiceId: string) => {
      setSelections((prev) => ({
        ...prev,
        [companyId]: choiceId,
      }))
      setExpandedSubMeal(new Set())
    },
    []
  )

  const toggleSubMeal = (key: string) => {
    const newExpanded = new Set(expandedSubMeal)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedSubMeal(newExpanded)
  }

  // Build full day menu preview with items from all subMealPlans for the choice
  const fullDayMenuPreview = useMemo(() => {
    if (!selectedChoice || dateRange.length === 0) return []

    return dateRange.map((dateObj) => {
      const dayItems: Array<{
        subMealPlanName: string
        items: MenuItem[]
      }> = []

      selectedChoice.mealPlans.forEach((mealPlan) => {
        mealPlan.subMealPlans.forEach((subMealPlan) => {
          const cellData = menuData?.[dateObj.date]?.[subMealPlan.subMealPlanId]
          if (cellData?.menuItemIds?.length > 0) {
            const items = cellData.menuItemIds
              .map((itemId: string) => menuItemMap.get(itemId))
              .filter((item): item is MenuItem => !!item)

            if (items.length > 0) {
              dayItems.push({
                subMealPlanName: subMealPlan.subMealPlanName || subMealPlan.subMealPlanId,
                items,
              })
            }
          }
        })
      })

      return {
        date: dateObj.date,
        day: dateObj.day,
        items: dayItems,
      }
    })
  }, [selectedChoice, menuData, dateRange, menuItemMap])

  const canConfirm = companies.length > 0 && Object.keys(selections).length === companies.length

  const navigateCompany = (direction: "prev" | "next") => {
    let newIndex = activeCompanyIndex + (direction === "next" ? 1 : -1)
    if (newIndex < 0) newIndex = companies.length - 1
    if (newIndex >= companies.length) newIndex = 0
    setActiveCompanyIndex(newIndex)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Meal Plan Choices for Companies</DialogTitle>
          <p className="text-xs text-gray-600 mt-1">
            Selections: {Object.keys(selections).length}/{companies.length}
          </p>
        </DialogHeader>

        {companies.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            No companies with choices
          </div>
        ) : (
          <div className="flex-1 flex gap-4 overflow-hidden">
            {/* Left: Company List / Navigation */}
            <div className="w-48 border-r flex flex-col">
              <div className="px-3 py-2 border-b bg-gray-50">
                <h3 className="text-xs font-semibold text-gray-600 uppercase">Companies</h3>
              </div>
              <ScrollArea className="flex-1">
                <div className="space-y-1 p-2">
                  {companies.map((company, index) => {
                    const isSelected = selections[company.companyId]
                    const isActive = activeCompanyIndex === index
                    return (
                      <button
                        key={`${company.companyId}-${company.buildingId}`}
                        onClick={() => setActiveCompanyIndex(index)}
                        className={`w-full text-left p-2 rounded text-xs transition-colors ${
                          isActive
                            ? "bg-blue-100 border border-blue-300"
                            : "hover:bg-gray-100 border border-transparent"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {isSelected ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <Circle className="h-4 w-4 text-gray-300 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-gray-900 truncate">
                              {company.companyName}
                            </div>
                            <div className="text-xs text-gray-600 truncate">
                              {company.buildingName}
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </ScrollArea>

              {/* Navigation Buttons */}
              <div className="border-t p-2 flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigateCompany("prev")}
                  className="flex-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigateCompany("next")}
                  className="flex-1"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Right: Company Details & Choices */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {currentCompany && (
                <>
                  {/* Company Header */}
                  <div className="px-4 py-3 border-b bg-gradient-to-r from-blue-50 to-white">
                    <h4 className="font-semibold text-gray-900">{currentCompany.companyName}</h4>
                    <p className="text-xs text-gray-600">{currentCompany.buildingName}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Available choices: {currentCompany.choices.length}
                    </p>
                  </div>

                  {/* Choices Selection Grid */}
                  <div className="px-4 py-3 border-b bg-gray-50">
                    <p className="text-xs font-semibold text-gray-700 mb-2">SELECT A CHOICE:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {currentCompany.choices.map((choice) => {
                        const isSelected = selectedChoiceId === choice.choiceId
                        return (
                          <button
                            key={choice.choiceId}
                            onClick={() =>
                              handleSelectChoice(currentCompany.companyId, choice.choiceId)
                            }
                            className={`p-2 rounded border-2 transition-all text-xs ${
                              isSelected
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-200 hover:border-gray-300 bg-white"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {isSelected && (
                                <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                              )}
                              <div className="text-left">
                                <div className="font-medium">Choice {choice.choiceId}</div>
                                <div className="text-gray-600">Qty: {choice.quantity}</div>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Menu Preview for Selected Choice - Full Day Menu */}
                  <div className="flex-1 overflow-hidden flex flex-col px-4 py-3">
                    <p className="text-xs font-semibold text-gray-700 mb-2">FINAL MENU PREVIEW (Complete Day Menu with Items):</p>
                    <ScrollArea className="flex-1 border rounded bg-white">
                      <div className="p-3 space-y-4">
                        {selectedChoice && fullDayMenuPreview.length > 0 ? (
                          fullDayMenuPreview.map((dayPreview, dayIdx) => (
                            <div
                              key={dayIdx}
                              className="border rounded-lg p-3 bg-gradient-to-r from-blue-50 to-white"
                            >
                              {/* Date Header */}
                              <div className="flex items-center justify-between mb-3 pb-2 border-b">
                                <div>
                                  <div className="text-xs font-bold text-blue-900">
                                    {new Date(dayPreview.date).toLocaleDateString('en-US', {
                                      weekday: 'long',
                                      month: 'short',
                                      day: 'numeric',
                                    })}
                                  </div>
                                  <div className="text-xs text-blue-700">
                                    {dayPreview.date}
                                  </div>
                                </div>
                                <Badge className="bg-blue-600">
                                  {dayPreview.items.reduce((sum, sm) => sum + sm.items.length, 0)} items
                                </Badge>
                              </div>

                              {/* Sub Meal Plans with Items */}
                              {dayPreview.items.length > 0 ? (
                                <div className="space-y-2">
                                  {dayPreview.items.map((subMealData, smIdx) => (
                                    <div key={smIdx} className="bg-white border rounded">
                                      {/* Sub Meal Header */}
                                      <div className="px-2 py-1.5 bg-amber-50 border-b">
                                        <div className="text-xs font-semibold text-amber-900">
                                          {subMealData.subMealPlanName}
                                        </div>
                                      </div>

                                      {/* Menu Items Grid */}
                                      <div className="p-2">
                                        <div className="grid grid-cols-2 gap-2">
                                          {subMealData.items.map((item, itemIdx) => (
                                            <div
                                              key={itemIdx}
                                              className="text-xs p-2 bg-green-50 border border-green-200 rounded hover:bg-green-100 transition-colors"
                                            >
                                              <div className="font-semibold text-green-900">
                                                {item.name}
                                              </div>
                                              {item.selectedDescription && (
                                                <div className="text-green-700 text-xs mt-0.5 truncate">
                                                  {item.selectedDescription}
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-gray-600 italic">No items assigned for this date</p>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-gray-600">
                            {selectedChoice
                              ? 'No menu data available. Please ensure menu items are populated in the menu edit.'
                              : 'Select a choice to preview the complete day menu'}
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="mt-4 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm(selections)
            }}
            disabled={!canConfirm || loading}
            className="gap-2"
          >
            {loading && <Spinner className="h-4 w-4" />}
            Apply Choices ({Object.keys(selections).length}/{companies.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
