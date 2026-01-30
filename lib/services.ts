import { getDocs, collection, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Service, MealPlan, SubMealPlan, MenuItem, MenuUpdation } from "@/lib/types"

export interface Company {
  id: string
  name: string
  status?: string
  order?: number
}

export interface Building {
  id: string
  companyId: string
  name: string
  status?: string
  order?: number
}

interface StructureAssignment {
  id: string
  companyId: string
  buildingId: string
  weekStructure: {
    [day: string]: Array<{
      subServices: any ;
      serviceId: string 
}>
  }
  status?: string
}

interface MealPlanStructureAssignment {
  id: string
  companyId: string
  buildingId: string
  weekStructure: {
    [day: string]: Array<{
      serviceId: string
      subServices: Array<{
        mealPlans: Array<{
          mealPlanId: string
          subMealPlans: Array<{ subMealPlanId: string }>
        }>
      }>
    }>
  }
  status?: string
}

interface SubService {
  id: string
  serviceId: string
  name: string
  status?: string
  order?: number
}

// In-memory cache with TTL
const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

function getCached<T>(key: string): T | null {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T
  }
  cache.delete(key)
  return null
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() })
}

// Batch fetching utility with better error handling
async function batchFetch<T>(collectionName: string, filters?: Array<{ field: string; value: any }>): Promise<T[]> {
  const cacheKey = `${collectionName}-${JSON.stringify(filters || {})}`
  const cached = getCached<T[]>(cacheKey)
  if (cached) return cached

  try {
    let q = collection(db, collectionName)

    if (filters && filters.length > 0) {
      const constraints = filters.map((f) => where(f.field, "==", f.value))
      q = query(q as any, ...constraints) as any
    }

    const snapshot = await getDocs(q as any)
    const data = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as T[]

    setCache(cacheKey, data)
    return data
  } catch (error) {
    console.error(`Error fetching ${collectionName}:`, error)
    throw error
  }
}

// Services Service
export const servicesService = {
  async getAll(): Promise<Service[]> {
    return batchFetch<Service>("services")
  },

  async getActive(): Promise<Service[]> {
    const all = await this.getAll()
    return all.filter((s) => s.status === "active").sort((a, b) => (a.order || 999) - (b.order || 999))
  },
}

// Meal Plans Service
export const mealPlansService = {
  async getAll(): Promise<MealPlan[]> {
    return batchFetch<MealPlan>("mealPlans")
  },

  async getActive(): Promise<MealPlan[]> {
    const all = await this.getAll()
    return all.filter((mp) => mp.status === "active").sort((a, b) => (a.order || 999) - (b.order || 999))
  },
}

// Sub Meal Plans Service
export const subMealPlansService = {
  async getAll(): Promise<SubMealPlan[]> {
    return batchFetch<SubMealPlan>("subMealPlans")
  },

  async getActive(): Promise<SubMealPlan[]> {
    const all = await this.getAll()
    return all.filter((smp) => smp.status === "active").sort((a, b) => (a.order || 999) - (b.order || 999))
  },

  async getByMealPlanId(mealPlanId: string): Promise<SubMealPlan[]> {
    const all = await this.getActive()
    return all.filter((smp) => smp.mealPlanId === mealPlanId)
  },
}

// Companies Service
export const companiesService = {
  async getAll(): Promise<Company[]> {
    return batchFetch<Company>("companies")
  },
}

// Buildings Service
export const buildingsService = {
  async getAll(): Promise<Building[]> {
    return batchFetch<Building>("buildings")
  },

  async getByCompanyId(companyId: string): Promise<Building[]> {
    const all = await this.getAll()
    return all.filter((b) => b.companyId === companyId)
  },
}

// Structure Assignments Service
export const structureAssignmentsService = {
  async getAll(): Promise<StructureAssignment[]> {
    return batchFetch<StructureAssignment>("structureAssignments")
  },

  async getByCompanyAndBuilding(companyId: string, buildingId: string): Promise<StructureAssignment | null> {
    const all = await this.getAll()
    return (
      all.find((sa) => sa.companyId === companyId && sa.buildingId === buildingId && sa.status === "active") || null
    )
  },
}

// Meal Plan Structure Assignments Service
export const mealPlanStructureAssignmentsService = {
  async getAll(): Promise<MealPlanStructureAssignment[]> {
    return batchFetch<MealPlanStructureAssignment>("mealPlanStructureAssignments")
  },

  async getByCompanyAndBuilding(companyId: string, buildingId: string): Promise<MealPlanStructureAssignment | null> {
    const all = await this.getAll()
    return (
      all.find((mpsa) => mpsa.companyId === companyId && mpsa.buildingId === buildingId && mpsa.status === "active") ||
      null
    )
  },
}

// SubServices Service
export const subServicesService = {
  async getAll(): Promise<SubService[]> {
    return batchFetch<SubService>("subServices")
  },

  async getActive(): Promise<SubService[]> {
    const all = await this.getAll()
    return all.filter((ss) => ss.status === "active").sort((a, b) => (a.order || 999) - (b.order || 999))
  },

  async getByServiceId(serviceId: string): Promise<SubService[]> {
    const all = await this.getActive()
    return all.filter((ss) => ss.serviceId === serviceId)
  },
}

// Menu Items Service
export const menuItemsService = {
  async getAll(): Promise<MenuItem[]> {
    return batchFetch<MenuItem>("menuItems")
  },

  async getActive(): Promise<MenuItem[]> {
    const all = await this.getAll()
    return all.filter((mi) => mi.status === "active").sort((a, b) => (a.order || 999) - (b.order || 999))
  },

  async search(searchTerm: string, limit = 50): Promise<MenuItem[]> {
    const all = await this.getActive()
    if (!searchTerm.trim()) return all.slice(0, limit)

    const lowerSearch = searchTerm.toLowerCase().trim()
    return all
      .filter(
        (item) =>
          item.name.toLowerCase().includes(lowerSearch) ||
          (item.category && item.category.toLowerCase().includes(lowerSearch)),
      )
      .slice(0, limit)
  },
}

// Utility to clear cache (useful when data updates)
export function clearServiceCache(): void {
  cache.clear()
}

// Utility to clear specific cache key
export function clearCacheKey(key: string): void {
  // If key ends with '-', clear all keys that start with that pattern
  if (key.endsWith('-')) {
    for (const k of cache.keys()) {
      if (k.startsWith(key)) {
        cache.delete(k)
      }
    }
  } else {
    cache.delete(key)
  }
}

// Preload critical data for better performance
export async function preloadCriticalData(): Promise<{
  services: Service[]
  mealPlans: MealPlan[]
  subMealPlans: SubMealPlan[]
  menuItems: MenuItem[]
}> {
  const [services, mealPlans, subMealPlans, menuItems] = await Promise.all([
    servicesService.getActive(),
    mealPlansService.getActive(),
    subMealPlansService.getActive(),
    menuItemsService.getActive(),
  ])

  return { services, mealPlans, subMealPlans, menuItems }
}

// Updation service for tracking menu changes
export const updationService = {
  async getAll(): Promise<MenuUpdation[]> {
    clearCacheKey("updations-")
    return batchFetch<MenuUpdation>("updations")
  },

  async getByMenuId(menuId: string): Promise<MenuUpdation[]> {
    clearCacheKey(`updations-${menuId}-`)
    const all = await this.getAll()
    return all
      .filter((u) => u.menuId === menuId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  },

  async getByCompanyId(companyId: string): Promise<MenuUpdation[]> {
    const all = await this.getAll()
    return all
      .filter((u) => u.companyId === companyId && u.menuType === "company")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  },

  async getLatestUpdationNumber(menuId: string): Promise<number> {
    const updations = await this.getByMenuId(menuId)
    if (updations.length === 0) return 0
    return Math.max(...updations.map((u) => u.updationNumber || 0))
  },
}
