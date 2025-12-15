import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy, Timestamp } from "firebase/firestore"
import { db } from "./firebase"

export interface BaseEntity {
  id: string
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export interface Template extends BaseEntity {
  name: string
  description?: string
}

export interface Brand extends BaseEntity {
  name: string
  description?: string
}

export interface SubBrand extends BaseEntity {
  name: string
  brandId: string
  description?: string
}

export interface TypeDefault extends BaseEntity {
  name: string
  description?: string
}

export interface TaxTemplate extends BaseEntity {
  name: string
  rate: number
  description?: string
}

export interface Supplier extends BaseEntity {
  name: string
  email?: string
  phone?: string
  address?: string
  contactPerson?: string
}

export interface Ingredient extends BaseEntity {
  hsn: string
  templateId: string
  name: string
  brandId: string
  subBrandId: string
  typeId: string
  defaultId: string
  gpId: string
  subGpId: string
  defaultQ1: number
  u1: string
  defaultQ2: number
  u2: string
  defaultQ3: number
  u3: string
  packing: string
  hasBatchNo: boolean
  hasExpiryDate: boolean
  maintainStock: boolean
  taxTemplateId: string
  supplier1Id: string
  supplier2Id?: string
  supplier3Id?: string
  frequency: "daily" | "weekly"
  hsnLength: number
  verifyUnits: boolean
  variantName?: string
}

// Generic CRUD operations
export class FirestoreService<T extends BaseEntity> {
  constructor(private collectionName: string) {}

  async getAll(): Promise<T[]> {
    const q = query(collection(db, this.collectionName), orderBy("createdAt", "desc"))
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        }) as T,
    )
  }

  async add(data: Omit<T, "id" | "createdAt" | "updatedAt">): Promise<string> {
    const docRef = await addDoc(collection(db, this.collectionName), {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    return docRef.id
  }

  async update(id: string, data: Partial<Omit<T, "id" | "createdAt">>): Promise<void> {
    const docRef = doc(db, this.collectionName, id)
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    })
  }

  async delete(id: string): Promise<void> {
    const docRef = doc(db, this.collectionName, id)
    await deleteDoc(docRef)
  }
}

// Service instances
export const templatesService = new FirestoreService<Template>("templates")
export const brandsService = new FirestoreService<Brand>("brands")
export const subBrandsService = new FirestoreService<SubBrand>("subBrands")
export const typeDefaultsService = new FirestoreService<TypeDefault>("typeDefaults")
export const taxTemplatesService = new FirestoreService<TaxTemplate>("taxTemplates")
export const suppliersService = new FirestoreService<Supplier>("suppliers")
export const ingredientsService = new FirestoreService<Ingredient>("ingredients")

export interface Type extends BaseEntity {
  name: string
  description?: string
  status: string
}

export interface Default extends BaseEntity {
  name: string
  value: string
  status: string
}

export interface GP extends BaseEntity {
  name: string
  code: string
  description?: string
}

export interface SubGP extends BaseEntity {
  name: string
  code: string
  gpId: string
  gpName?: string
  description?: string
}

export interface Company extends BaseEntity {
  name: string
  code: string
  address?: string
  phone?: string
  email?: string
  contactPerson?: string
  status: string
}

export interface Building extends BaseEntity {
  name: string
  code: string
  companyId: string
  companyName?: string
  address?: string
  floor?: string
  capacity?: number
  status: string
}

export const typesService = new FirestoreService<Type>("types")
export const defaultsService = new FirestoreService<Default>("defaults")
export const gpService = new FirestoreService<GP>("gps")
export const subGpService = new FirestoreService<SubGP>("subgps")
export const companiesService = new FirestoreService<Company>("companies")
export const buildingsService = new FirestoreService<Building>("buildings")

export interface Holiday extends BaseEntity {
  date: string // YYYY-MM-DD format
  name: string
  description?: string
  companyId: string
  buildingId: string
  companyName?: string
  buildingName?: string
  type: "national" | "company" | "building"
}

export const holidaysService = new FirestoreService<Holiday>("holidays")

export interface MealPlan extends BaseEntity {
  name: string
  description?: string
  status: string
}

export interface SubMealPlan extends BaseEntity {
  name: string
  mealPlanId: string
  mealPlanName?: string
  description?: string
  status: string
}

export const mealPlansService = new FirestoreService<MealPlan>("mealPlans")
export const subMealPlansService = new FirestoreService<SubMealPlan>("subMealPlans")

export interface Service extends BaseEntity {
  name: string
  description?: string
  status: string
}

export interface SubService extends BaseEntity {
  name: string
  serviceId: string
  serviceName?: string
  description?: string
  status: string
}

export const servicesService = new FirestoreService<Service>("services")
export const subServicesService = new FirestoreService<SubService>("subServices")

export interface StructureAssignment extends BaseEntity {
  companyId: string
  buildingId: string
  companyName?: string
  buildingName?: string
  weekStructure: {
    [dayKey: string]: {
      serviceId: string
      serviceName?: string
      subServices: {
        subServiceId: string
        subServiceName?: string
        rate: number
      }[]
    }[]
  }
  status: string
}

export const structureAssignmentsService = new FirestoreService<StructureAssignment>("structureAssignments")

export const structureAssignmentService = structureAssignmentsService

export interface MealPlanStructureAssignment extends BaseEntity {
  companyId: string
  buildingId: string
  companyName?: string
  buildingName?: string
  weekStructure: {
    [dayKey: string]: {
      serviceId: string
      serviceName?: string
      subServices: {
        subServiceId: string
        subServiceName?: string
        mealPlans: {
          mealPlanId: string
          mealPlanName?: string
          subMealPlans: {
            subMealPlanId: string
            subMealPlanName?: string
          }[]
        }[]
      }[]
    }[]
  }
  status: string
}

export const mealPlanStructureAssignmentsService = new FirestoreService<MealPlanStructureAssignment>(
  "mealPlanStructureAssignments",
)

export interface MenuItem extends BaseEntity {
  name: string
  description?: string
  category: string
  price: number
  preparationTime?: number // in minutes
  ingredients?: string[]
  allergens?: string[]
  nutritionalInfo?: {
    calories?: number
    protein?: number
    carbs?: number
    fat?: number
  }
  imageUrl?: string
  isVegetarian: boolean
  isVegan: boolean
  isGlutenFree: boolean
  spiceLevel: "mild" | "medium" | "hot" | "extra-hot"
  availability: "always" | "seasonal" | "limited"
  status: string
}

export const menuItemsService = new FirestoreService<MenuItem>("menuItems")

export interface Category extends BaseEntity {
  name: string
  description?: string
  type: "menu-item" | "ingredient" | "service" | "general"
  status: string
}

export const categoriesService = new FirestoreService<Category>("categories")
