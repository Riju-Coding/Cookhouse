import { db } from "@/lib/firebase"
import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  query,
  orderBy,
  where,
  getDoc
} from "firebase/firestore"

// ─── Vehicle Types ──────────────────────────────────────────────
export type VehicleType = 'van' | 'truck' | 'bike' | 'car' | 'tempo' | 'other'
export type VehicleStatus = 'active' | 'maintenance' | 'inactive'

export interface Vehicle {
  id: string
  vehicleNumber: string       // e.g. "MH02AB1234"
  vendorId: string
  type: VehicleType
  capacity?: string           // e.g. "500kg", "200 plates"
  driverName?: string
  driverPhone?: string
  status: VehicleStatus
  lastInspectionDate?: string // ISO date string
  notes?: string
  createdAt?: any
  updatedAt?: any
}

const COLLECTION_NAME = 'vehicles'
const vehiclesCollection = collection(db, COLLECTION_NAME)

export const vehiclesService = {
  getAll: async (): Promise<Vehicle[]> => {
    const q = query(vehiclesCollection, orderBy("vehicleNumber"))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Vehicle))
  },

  getById: async (id: string): Promise<Vehicle | null> => {
    const docRef = doc(db, COLLECTION_NAME, id)
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Vehicle
    }
    return null
  },

  getByVendor: async (vendorId: string): Promise<Vehicle[]> => {
    const q = query(
      vehiclesCollection, 
      where("vendorId", "==", vendorId),
      orderBy("vehicleNumber")
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Vehicle))
  },

  getActive: async (): Promise<Vehicle[]> => {
    const all = await vehiclesService.getAll()
    return all.filter(v => v.status === 'active')
  },

  getActiveByVendor: async (vendorId: string): Promise<Vehicle[]> => {
    const all = await vehiclesService.getByVendor(vendorId)
    return all.filter(v => v.status === 'active')
  },

  add: async (data: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>) => {
    const payload = {
      ...data,
      vehicleNumber: data.vehicleNumber.toUpperCase().replace(/\s/g, ''),
      status: data.status || 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    return await addDoc(vehiclesCollection, payload)
  },

  update: async (id: string, data: Partial<Omit<Vehicle, 'id'>>) => {
    const docRef = doc(db, COLLECTION_NAME, id)
    const payload = {
      ...data,
      ...(data.vehicleNumber ? { vehicleNumber: data.vehicleNumber.toUpperCase().replace(/\s/g, '') } : {}),
      updatedAt: serverTimestamp(),
    }
    return await updateDoc(docRef, payload)
  },

  delete: async (id: string) => {
    const docRef = doc(db, COLLECTION_NAME, id)
    return await deleteDoc(docRef)
  },
}
