import { db } from "@/lib/firebase"
import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  updateDoc, 
  setDoc,
  deleteDoc, 
  serverTimestamp,
  query,
  orderBy,
  where,
  getDoc
} from "firebase/firestore"

// ─── Template Types ─────────────────────────────────────────────
export type ComplianceTemplateType = 
  | 'kitchen_readiness'   // Batch-wise temp recording when food leaves kitchen
  | 'dispatch'            // Vehicle condition + qty + temp at dispatch
  | 'service_point'       // Temp recording when food service starts at company
  | 'general_checklist'   // Classic yes/no, text, photo questions

export type ComplianceFrequency = 
  | 'per_batch' 
  | 'per_dispatch' 
  | 'per_service' 
  | 'daily' 
  | 'weekly' 
  | 'monthly' 
  | 'custom'

// ─── Vehicle Condition Check (configurable per vendor) ──────────
export interface VehicleCheckField {
  id: string               // e.g. 'hygiene', 'fuel_level', 'tire_condition'
  label: string            // e.g. 'Vehicle Hygiene'
  type: 'yes_no' | 'rating' | 'text'  // How supervisor answers
  isRequired: boolean
}

// ─── Main Template Interface ────────────────────────────────────
export interface ComplianceTemplate {
  id: string
  name: string
  type: ComplianceTemplateType
  vendorId: string
  companyId?: string        // Optional for kitchen_readiness (applies to all companies)
  buildingId?: string
  cafetariaId?: string
  areaId?: string
  frequency: ComplianceFrequency
  assignedRole: string      // roleId
  menuSourceType?: 'combined' | 'company'   // Which menu to pull items from
  serviceId?: string                        // Filter menu items by service
  subServiceId?: string                     // Filter menu items by sub-service
  vehicleCheckFields?: VehicleCheckField[]  // For dispatch type only
  status: 'active' | 'inactive'
  createdAt?: any
  updatedAt?: any
}

const COLLECTION_NAME = 'complianceTemplates'
const complianceTemplatesCollection = collection(db, COLLECTION_NAME)

export const complianceTemplatesService = {
  getAll: async (): Promise<ComplianceTemplate[]> => {
    const q = query(complianceTemplatesCollection, orderBy("name"))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as ComplianceTemplate))
  },

  getById: async (id: string): Promise<ComplianceTemplate | null> => {
    const docRef = doc(db, COLLECTION_NAME, id)
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as ComplianceTemplate
    }
    return null
  },

  getByType: async (type: ComplianceTemplateType): Promise<ComplianceTemplate[]> => {
    const q = query(
      complianceTemplatesCollection, 
      where("type", "==", type),
      orderBy("name")
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as ComplianceTemplate))
  },

  getByVendor: async (vendorId: string): Promise<ComplianceTemplate[]> => {
    const q = query(
      complianceTemplatesCollection, 
      where("vendorId", "==", vendorId),
      orderBy("name")
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as ComplianceTemplate))
  },

  add: async (data: Omit<ComplianceTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
    const payload = {
      ...data,
      status: data.status || 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    return await addDoc(complianceTemplatesCollection, payload)
  },

  update: async (id: string, data: Partial<Omit<ComplianceTemplate, 'id'>>) => {
    const docRef = doc(db, COLLECTION_NAME, id)
    const payload = {
      ...data,
      updatedAt: serverTimestamp(),
    }
    return await setDoc(docRef, payload, { merge: true })
  },

  delete: async (id: string) => {
    const docRef = doc(db, COLLECTION_NAME, id)
    return await deleteDoc(docRef)
  },
}
