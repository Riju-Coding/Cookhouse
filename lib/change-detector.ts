import type { CellChange, MenuItemChange, MenuUpdation } from "@/lib/types"

/**
 * Detects changes between original and updated menu data
 * Returns only the cells that have changed
 */
export function detectMenuChanges(
  originalData: any,
  updatedData: any,
  menuItemsMap: Map<string, string>,
): CellChange[] {
  const changedCells: CellChange[] = []

  // Get all possible dates from both versions
  const allDates = new Set([...Object.keys(originalData || {}), ...Object.keys(updatedData || {})])

  for (const date of allDates) {
    const originalDateData = originalData?.[date] || {}
    const updatedDateData = updatedData?.[date] || {}

    // Get all services
    const allServices = new Set([...Object.keys(originalDateData), ...Object.keys(updatedDateData)])

    for (const serviceId of allServices) {
      const originalServiceData = originalDateData[serviceId] || {}
      const updatedServiceData = updatedDateData[serviceId] || {}

      // Get all subservices
      const allSubServices = new Set([...Object.keys(originalServiceData), ...Object.keys(updatedServiceData)])

      for (const subServiceId of allSubServices) {
        const originalSubServiceData = originalServiceData[subServiceId] || {}
        const updatedSubServiceData = updatedServiceData[subServiceId] || {}

        // Get all meal plans
        const allMealPlans = new Set([...Object.keys(originalSubServiceData), ...Object.keys(updatedSubServiceData)])

        for (const mealPlanId of allMealPlans) {
          const originalMealPlanData = originalSubServiceData[mealPlanId] || {}
          const updatedMealPlanData = updatedSubServiceData[mealPlanId] || {}

          // Get all sub meal plans
          const allSubMealPlans = new Set([
            ...Object.keys(originalMealPlanData),
            ...Object.keys(updatedMealPlanData),
          ])

          for (const subMealPlanId of allSubMealPlans) {
            const originalItems =
              originalMealPlanData[subMealPlanId]?.menuItemIds || []
            const updatedItems = updatedMealPlanData[subMealPlanId]?.menuItemIds || []

            // Check if this cell has changes
            if (JSON.stringify(originalItems) !== JSON.stringify(updatedItems)) {
              const changes = detectItemChanges(originalItems, updatedItems, menuItemsMap)

              if (changes.length > 0) {
                changedCells.push({
                  date,
                  serviceId,
                  subServiceId,
                  mealPlanId,
                  subMealPlanId,
                  changes,
                })
              }
            }
          }
        }
      }
    }
  }

  return changedCells
}

/**
 * Detects changes in menu items for a single cell
 * Enhanced to detect item replacements (old item removed, new item added)
 */
function detectItemChanges(
  originalItems: string[],
  updatedItems: string[],
  menuItemsMap: Map<string, string>,
): MenuItemChange[] {
  const changes: MenuItemChange[] = []
  const originalSet = new Set(originalItems)
  const updatedSet = new Set(updatedItems)

  // First, identify removed and added items
  const removedItems = Array.from(originalSet).filter((id) => !updatedSet.has(id))
  const addedItems = Array.from(updatedSet).filter((id) => !originalSet.has(id))

  // Try to pair removed items with added items as replacements
  const replacementPairs: Array<[string, string]> = []
  const remainingRemoved = new Set(removedItems)
  const remainingAdded = new Set(addedItems)

  // For now, if there's exactly one removed and one added, mark it as a replacement
  if (removedItems.length === 1 && addedItems.length === 1) {
    const removedId = removedItems[0]
    const addedId = addedItems[0]
    replacementPairs.push([removedId, addedId])
    remainingRemoved.delete(removedId)
    remainingAdded.delete(addedId)
  }

  // Add replacement changes
  for (const [oldItemId, newItemId] of replacementPairs) {
    changes.push({
      itemId: oldItemId,
      itemName: menuItemsMap.get(oldItemId) || "Unknown Item",
      action: "replaced",
      replacedWith: newItemId,
      replacedWithName: menuItemsMap.get(newItemId) || "Unknown Item",
    })
  }

  // Add remaining removed items
  for (const itemId of remainingRemoved) {
    changes.push({
      itemId,
      itemName: menuItemsMap.get(itemId) || "Unknown Item",
      action: "removed",
    })
  }

  // Add remaining added items
  for (const itemId of remainingAdded) {
    changes.push({
      itemId,
      itemName: menuItemsMap.get(itemId) || "Unknown Item",
      action: "added",
    })
  }

  return changes
}

/**
 * Creates a summary of changes for display
 */
export function createChangeSummary(changedCells: CellChange[]): {
  totalChanges: number
  addedCount: number
  removedCount: number
  replacedCount: number
  cellsChanged: number
} {
  let addedCount = 0
  let removedCount = 0
  let replacedCount = 0

  for (const cell of changedCells) {
    for (const change of cell.changes) {
      if (change.action === "added") addedCount++
      else if (change.action === "removed") removedCount++
      else if (change.action === "replaced") replacedCount++
    }
  }

  return {
    totalChanges: changedCells.reduce((sum, cell) => sum + cell.changes.length, 0),
    addedCount,
    removedCount,
    replacedCount,
    cellsChanged: changedCells.length,
  }
}
