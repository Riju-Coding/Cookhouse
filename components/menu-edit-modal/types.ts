import type { MenuItem } from "@/lib/types"

export interface MealPlanChoice {
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
  createdAt?: string | Date
}

export interface CompanyChoice {
  companyId: string
  companyName: string
  buildingId: string
  buildingName: string
  choices: MealPlanChoice[]
}

export interface MenuCell {
  menuItemIds: string[]
  selectedDescriptions?: Record<string, string>
  customAssignments?: Record<string, Array<{ companyId: string; buildingId: string }>>
}

export interface UpdationRecord {
  id?: string
  menuId: string
  menuType: string
  menuName: string
  updationNumber: number
  changedCells: any[]
  totalChanges: number
  menuStartDate: string
  menuEndDate: string
  createdAt: any
  createdBy: string
  companyId?: string
  companyName?: string
  buildingId?: string
  buildingName?: string
  isCompanyWiseChange?: boolean
  sourcedFromCompanyId?: string
  sourcedFromCompanyName?: string
  sourcedFromMenuId?: string
  sourcedFromCombinedMenuId?: string
  sourcedFromBuildingId?: string
  sourcedFromBuildingName?: string
  appliedToAllBuildings?: boolean
  appliedBuildingIds?: string[]
  otherBuildingsCount?: number
}

export interface MenuEditModalProps {
  isOpen: boolean
  onClose: () => void
  menuId: string
  menuType: "combined" | "company"
  onSave?: () => void
  preloadedMenuItems?: MenuItem[]
}

export interface MenuData {
  startDate: string
  endDate: string
  status: string
  menuData?: any
  companyId?: string
  buildingId?: string
  [key: string]: any
}
