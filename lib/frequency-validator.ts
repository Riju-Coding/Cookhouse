/**
 * Frequency Validator Utility
 * 
 * Validates and calculates sub-meal plan frequency limits.
 * Ensures sub-meal plans don't exceed their configured maximum frequency
 * (e.g., can't appear more than 2 times per week).
 */

interface SubMealPlanWithFrequency {
  id: string
  name: string
  mealPlanId: string
  maxFrequency?: number
  order?: number
}

interface SubMealSelection {
  mealPlanId: string
  mealPlanName: string
  subMealPlanId: string
  subMealPlanName: string
  selectedItemId: string
  selectedItemName: string
}

export interface FrequencyViolation {
  subMealPlanId: string
  subMealPlanName: string
  current: number
  max: number
  excessAmount: number
}

export interface FrequencyStatus {
  violations: FrequencyViolation[]
  hasViolations: boolean
  totalExceeded: number
}

/**
 * Calculates frequency for all sub-meal plans in selections
 * Returns violations if any sub-meal plan exceeds its max frequency
 */
export function calculateFrequencyViolations(
  selections: Record<string, SubMealSelection[]>,
  subMealPlans: SubMealPlanWithFrequency[]
): FrequencyStatus {
  const violations: FrequencyViolation[] = []
  const frequencyMap = new Map<string, number>()

  // Count occurrences of each sub-meal plan across all selections
  Object.entries(selections).forEach(([_key, items]) => {
    items.forEach((item) => {
      const currentCount = frequencyMap.get(item.subMealPlanId) || 0
      frequencyMap.set(item.subMealPlanId, currentCount + 1)
    })
  })

  // Check violations against max frequency
  frequencyMap.forEach((current, subMealPlanId) => {
    const smpInfo = subMealPlans.find((s) => s.id === subMealPlanId)
    if (!smpInfo) return

    const max = smpInfo.maxFrequency ?? 7 // Default: unlimited (7 days per week)
    if (max && current > max) {
      violations.push({
        subMealPlanId,
        subMealPlanName: smpInfo.name,
        current,
        max,
        excessAmount: current - max,
      })
    }
  })

  // Sort violations by excess amount (highest first)
  violations.sort((a, b) => b.excessAmount - a.excessAmount)

  return {
    violations,
    hasViolations: violations.length > 0,
    totalExceeded: violations.reduce((sum, v) => sum + v.excessAmount, 0),
  }
}

/**
 * Checks if a specific sub-meal plan would exceed its frequency limit
 * if a new selection is added
 */
export function wouldExceedFrequency(
  subMealPlanId: string,
  currentCount: number,
  subMealPlans: SubMealPlanWithFrequency[]
): boolean {
  const smpInfo = subMealPlans.find((s) => s.id === subMealPlanId)
  if (!smpInfo) return false

  const max = smpInfo.maxFrequency ?? 7
  return max && currentCount >= max
}

/**
 * Get frequency info for a specific sub-meal plan
 */
export function getSubMealPlanFrequencyInfo(
  subMealPlanId: string,
  currentCount: number,
  subMealPlans: SubMealPlanWithFrequency[]
): { current: number; max: number; exceeded: boolean; excessAmount: number } {
  const smpInfo = subMealPlans.find((s) => s.id === subMealPlanId)
  const max = smpInfo?.maxFrequency ?? 7

  return {
    current: currentCount,
    max,
    exceeded: currentCount > max,
    excessAmount: Math.max(0, currentCount - max),
  }
}
