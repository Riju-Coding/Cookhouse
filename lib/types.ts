export interface MenuItem {
  id: string
  name: string
  category?: string
  order?: number
  status?: string
}

export interface Service {
  id: string
  name: string
  status?: string
  order?: number
}

export interface SubService {
  id: string
  serviceId: string
  name: string
  status?: string
  order?: number
}

export interface MealPlan {
  id: string
  name: string
  status?: string
  order?: number
}

export interface SubMealPlan {
  id: string
  name: string
  mealPlanId: string
  status?: string
  order?: number
  isRepeatPlan?: boolean; 
}

export interface MenuItemChange {
  itemId: string
  itemName: string
  action: "added" | "removed" | "replaced" // added/removed/replaced with
  replacedWith?: string // ID of item it was replaced with
  replacedWithName?: string
}

export interface CellChange {
  date: string
  serviceId: string
  subServiceId?: string
  mealPlanId: string
  subMealPlanId: string
  changes: MenuItemChange[]
}

export interface MenuUpdation {
  id: string
  menuId: string
  menuType: "combined" | "company"
  menuName?: string
  companyId?: string
  companyName?: string
  buildingId?: string
  buildingName?: string
  updationNumber: number // 1st update, 2nd update, etc.
  changedCells: CellChange[]
  totalChanges: number
  menuStartDate: string
  menuEndDate: string
  createdAt: Date
  createdBy?: string
  notes?: string
}
