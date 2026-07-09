import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy, Timestamp, where } from "firebase/firestore"
import { db } from "./firebase"
import { requireAuth } from "./auth-guard"

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
    requireAuth() // Security: ensure user is authenticated before write
    const docRef = await addDoc(collection(db, this.collectionName), {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    return docRef.id
  }

  async update(id: string, data: Partial<Omit<T, "id" | "createdAt">>): Promise<void> {
    requireAuth() // Security: ensure user is authenticated before write
    const docRef = doc(db, this.collectionName, id)
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    })
  }

  async delete(id: string): Promise<void> {
    requireAuth() // Security: ensure user is authenticated before write
    const docRef = doc(db, this.collectionName, id)
    await deleteDoc(docRef)
  }

  async getWhere(field: string, operator: any, value: any): Promise<T[]> {
    const q = query(
      collection(db, this.collectionName), 
      where(field, operator, value),
      orderBy("createdAt", "desc")
    )
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        }) as T,
    )
  }

  async getMany(filters: { field: string; operator: any; value: any }[]): Promise<T[]> {
    let q = query(collection(db, this.collectionName))
    filters.forEach(f => {
      q = query(q, where(f.field, f.operator, f.value))
    })
    q = query(q, orderBy("createdAt", "desc"))
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        }) as T,
    )
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
  attendanceSettings?: {
    checkFrequencyMinutes: number
    alertThresholdMinutes: number
  }
  breaks?: {
    name: string
    startTime: string
    endTime: string
  }[]
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
  vendorId?: string
}

export interface SubMealPlan extends BaseEntity {
  name: string
  mealPlanId: string
  mealPlanName?: string
  description?: string
  status: string
  vendorId?: string
}

export const mealPlansService = new FirestoreService<MealPlan>("mealPlans")
export const subMealPlansService = new FirestoreService<SubMealPlan>("subMealPlans")

export interface Service extends BaseEntity {
  name: string
  description?: string
  status: string
  vendorId?: string
}

export interface SubService extends BaseEntity {
  name: string
  serviceId: string
  serviceName?: string
  description?: string
  status: string
  showConfirmation?: boolean
  vendorId?: string
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
// Add this interface to firestore.ts
export interface Vendor extends BaseEntity {
  name: string
  email: string
  phone: string
  contactPerson: string
  address: string
  logo?: string
  description?: string
  status: string
  serviceAreas: string[]
  cuisineTypes: string[]
  rating: number
  totalOrders: number
  registrationNumber: string
  gstNumber: string
  bankDetails: {
    accountName: string
    accountNumber: string
    ifscCode: string
    bankName: string
  }
  createdBy?: string
  
  // HQ Geo-fence fields for attendance
  hqLatitude?: number
  hqLongitude?: number
  hqRadius?: number // meters
  hqAddress?: string
  hqGeoSetAt?: Timestamp
  hqGeoSetBy?: string
}

export interface VendorContract extends BaseEntity {
  vendorId: string
  vendorName: string
  companyId: string
  companyName: string
  buildingIds: string[]
  buildingNames: string[]
  contractNumber: string
  startDate: string
  endDate: string
  status: "active" | "expired" | "terminated"
  servicesOffered: {
    serviceId: string
    serviceName: string
    subServices: {
      subServiceId: string
      subServiceName: string
      baseRate: number
    }[]
  }[]
  terms: {
    paymentTerms: string
    minimumOrder: number
    cancellationPolicy: string
    qualityStandards: string
    penaltyClause: string
  }
  autoRenewal: boolean
}
export interface Employee extends BaseEntity {
  employeeId: string
  name: string
  email: string
  phone: string
  companyId: string
  companyName: string
  buildingId: string
  buildingName: string
  department: string
  designation: string
  role: "employee" | "company_admin"
  profileImage?: string
  status: "active" | "inactive"
  preferences: {
    dietaryRestrictions: string[]
    allergies: string[]
    spiceLevel: string
  }
  activeSubscriptions: {
    serviceId: string
    serviceName: string
    subServiceId: string
    subServiceName: string
    daysOfWeek: string[]
    startDate: string
    endDate: string
  }[]
  shiftSettings?: {
    startTime: string
    endTime: string
  }
  firebaseUid?: string
}

export const employeesService = new FirestoreService<Employee>("employees")

export const vendorContractsService = new FirestoreService<VendorContract>("vendorContracts")

// Add this service instance at the bottom of firestore.ts
export const vendorsService = new FirestoreService<Vendor>("vendors")

export const categoriesService = new FirestoreService<Category>("categories")

// --- State-Based Attendance Engine Types ---

export type EmployeeState =
  | "SHIFT_NOT_STARTED"
  | "WORKING_AT_SITE"
  | "WORKING_AT_VENDOR_HQ"
  | "TRAVELLING"
  | "ON_BREAK"
  | "OUTSIDE_ASSIGNED"
  | "SHIFT_COMPLETED"

export type LocationType = "CLIENT_SITE" | "VENDOR_HQ"

export type TimelineEventType =
  | "SHIFT_STARTED"
  | "SITE_ENTERED"
  | "SITE_EXITED"
  | "VENDOR_HQ_ENTERED"
  | "VENDOR_HQ_EXITED"
  | "TRAVEL_STARTED"
  | "TRAVEL_ENDED"
  | "BREAK_STARTED"
  | "BREAK_ENDED"
  | "SHIFT_ENDED"

export interface TimelineEvent {
  type: TimelineEventType
  timestamp: Timestamp
  siteId?: string
  siteName?: string
  locationType?: LocationType
  latitude: number
  longitude: number
  accuracy: number
  note?: string
}

export interface RouteCheckpoint {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: Timestamp
  speed?: number
  batteryLevel?: number
}

export interface SiteVisitSummary {
  siteId: string
  siteName: string
  locationType: LocationType
  enteredAt: Timestamp
  exitedAt?: Timestamp
  duration: number // minutes
}

export interface ShiftSummary {
  totalShiftDuration: number // minutes
  productiveTime: number // minutes
  totalTravelTime: number // minutes
  totalBreakTime: number // minutes
  sitesVisited: SiteVisitSummary[]
  vendorHQTime: number // minutes
  firstCheckIn: Timestamp
  lastCheckOut: Timestamp
  siteCount: number
  lateArrival: boolean
  lateArrivalMinutes: number
  earlyExit: boolean
  earlyExitMinutes: number
  overtime: number // minutes
  routeComplianceScore: number // 0-100
}

export interface AttendanceSession extends BaseEntity {
  userId: string
  employeeName: string
  companyId: string
  vendorId?: string
  date: string // "YYYY-MM-DD"
  
  shiftStartedAt: Timestamp
  shiftEndedAt?: Timestamp
  shiftStartMethod: "AUTO_GEOFENCE" | "MANUAL" | "ADMIN"
  autoShiftStartSiteId?: string
  
  currentState: EmployeeState
  currentSiteId?: string
  currentSiteName?: string
  currentLocationType?: LocationType
  stateChangedAt: Timestamp
  
  timeline: TimelineEvent[]
  routeCheckpoints: RouteCheckpoint[]
  summary?: ShiftSummary
  
  lastLatitude?: number
  lastLongitude?: number
  lastLocationAt?: Timestamp
  
  status: "active" | "completed" | "error"
}

export interface AttendancePolicy extends BaseEntity {
  companyId: string
  autoShiftStart: boolean
  autoShiftStartWindowMins: number
  autoShiftEnd: boolean
  vendorHQEnabled: boolean
  multiSiteEnabled: boolean
  routeVerificationEnabled: boolean
  travelCheckpointIntervalMins: number
  travelGracePeriodMins: number
  breakGracePeriodMins: number
  geofenceRadiusDefault: number
  gpsAccuracyThreshold: number
  batterySaverMode: boolean
  locationSamplingStrategy: "BALANCED" | "HIGH_ACCURACY" | "LOW_POWER"
}

export const attendanceSessionsService = new FirestoreService<AttendanceSession>("attendance_sessions")
export const attendancePoliciesService = new FirestoreService<AttendancePolicy>("attendance_policies")
