"use client"

import { useState, useMemo, useCallback } from "react"
import { ChoicesPanel } from "@/components/choices-panel"

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

interface CompanyChoice {
  companyId: string
  companyName: string
  buildingId: string
  buildingName: string
  choices: MealPlanChoice[]
}

type SelectionMap = Record<string, Array<{
  mealPlanId: string
  mealPlanName: string
  subMealPlanId: string
  subMealPlanName: string
  selectedItemId: string
  selectedItemName: string
}>>

interface MenuWithChoicesProps {
  // Choices props
  companies: CompanyChoice[]
  menuData?: Record<string, Record<string, Record<string, Record<string, Record<string, any>>>>>
  allMenuItems?: MenuItem[]
  dateRange?: Array<{ date: string; day: string }>
  onSelectionsChange?: (selections: SelectionMap) => void
  // Render prop for the menu content
  children: React.ReactNode
}

/**
 * MenuWithChoices wraps your menu content with an integrated Choices panel below it.
 * This component manages choice selections state and provides the ChoicesPanel UI
 */
export function MenuWithChoices({
  companies,
  menuData = {},
  allMenuItems = [],
  dateRange = [],
  onSelectionsChange,
  children,
}: MenuWithChoicesProps) {
  const [selections, setSelections] = useState<SelectionMap>({})

  const handleSelectionChange = useCallback((newSelections: SelectionMap) => {
    setSelections(newSelections)
    onSelectionsChange?.(newSelections)
  }, [onSelectionsChange])

  return (
    <div className="space-y-6">
      {/* Menu Content */}
      <div>{children}</div>

      {/* Integrated Choices Panel - Stacked Below Menu */}
      {companies.length > 0 && (
        <ChoicesPanel
          companies={companies}
          selections={selections}
          onSelectionChange={handleSelectionChange}
          menuData={menuData}
          allMenuItems={allMenuItems}
          dateRange={dateRange}
        />
      )}
    </div>
  )
}
