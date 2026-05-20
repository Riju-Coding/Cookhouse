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
  getDoc,
  limit as firestoreLimit
} from "firebase/firestore"
import type { ComplianceTemplateType } from "./complianceTemplatesService"

// ─── Record Item (Menu item with readings) ──────────────────────
export interface ComplianceRecordItem {
  menuItemId: string
  menuItemName: string
  mealPlanId?: string
  mealPlanName?: string
  subMealPlanId?: string
  subMealPlanName?: string
  temperature?: number
  temperatureUnit?: '°C' | '°F'
  quantity?: number
  quantityUnit?: string
  receivingQty?: number       // Qty received at destination (for dispatch)
  receivingTemp?: number      // Temp at receiving end (for dispatch)
  receivedBy?: string         // Employee name who received
  receivedByEmployeeId?: string
  photoUrl?: string
  notes?: string
}

// ─── Vehicle Condition Snapshot ─────────────────────────────────
export interface VehicleConditionSnapshot {
  hygiene: 'hygienic' | 'unhygienic'
  fuelSufficient: boolean
  checks: Record<string, boolean | string | number>  // Dynamic checks from vendor config
  notes?: string
  photoUrls?: string[]
}

// ─── Answer for general checklist ───────────────────────────────
export interface ComplianceAnswer {
  fieldId: string
  value: string | number | boolean
  photoUrl?: string
}

// ─── Record Status ──────────────────────────────────────────────
export type ComplianceRecordStatus = 'draft' | 'submitted' | 'approved' | 'flagged' | 'rejected'

// ─── Main Record Interface ──────────────────────────────────────
export interface ComplianceRecord {
  id: string
  templateId: string
  templateName?: string       // Denormalized for easy display
  templateType: ComplianceTemplateType
  vendorId: string
  vendorName?: string
  companyId?: string
  companyName?: string
  buildingId?: string
  buildingName?: string
  cafetariaId?: string
  areaId?: string
  date: string                // ISO date string: '2026-05-20'
  shift?: 'morning' | 'afternoon' | 'evening'
  batchNumber?: string        // Auto-generated: CompanyName-BuildingShort-MealPlan-SMP-Random
  vehicleId?: string          // For dispatch records
  vehicleNumber?: string      // Denormalized
  vehicleCondition?: VehicleConditionSnapshot
  items: ComplianceRecordItem[]
  answers: ComplianceAnswer[]  // For general_checklist questions
  status: ComplianceRecordStatus
  submittedBy?: string        // userId
  submittedByName?: string
  approvedBy?: string
  approvedByName?: string
  approvalNotes?: string
  geoLocation?: { lat: number; lng: number }
  createdAt?: any
  updatedAt?: any
}

const COLLECTION_NAME = 'complianceRecords'
const recordsCollection = collection(db, COLLECTION_NAME)

export const complianceRecordsService = {
  getAll: async (): Promise<ComplianceRecord[]> => {
    const q = query(recordsCollection, orderBy("date", "desc"))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as ComplianceRecord))
  },

  getById: async (id: string): Promise<ComplianceRecord | null> => {
    const docRef = doc(db, COLLECTION_NAME, id)
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as ComplianceRecord
    }
    return null
  },

  getByDateRange: async (
    vendorId: string, 
    startDate: string, 
    endDate: string
  ): Promise<ComplianceRecord[]> => {
    const q = query(
      recordsCollection,
      where("vendorId", "==", vendorId),
      where("date", ">=", startDate),
      where("date", "<=", endDate),
      orderBy("date", "desc")
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as ComplianceRecord))
  },

  getByCompanyBuilding: async (
    companyId: string, 
    buildingId: string, 
    date?: string
  ): Promise<ComplianceRecord[]> => {
    let q
    if (date) {
      q = query(
        recordsCollection,
        where("companyId", "==", companyId),
        where("buildingId", "==", buildingId),
        where("date", "==", date),
        orderBy("date", "desc")
      )
    } else {
      q = query(
        recordsCollection,
        where("companyId", "==", companyId),
        where("buildingId", "==", buildingId),
        orderBy("date", "desc"),
        firestoreLimit(50)
      )
    }
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as ComplianceRecord))
  },

  getByTemplate: async (templateId: string): Promise<ComplianceRecord[]> => {
    const q = query(
      recordsCollection,
      where("templateId", "==", templateId),
      orderBy("date", "desc"),
      firestoreLimit(100)
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as ComplianceRecord))
  },

  getRecent: async (count: number = 50): Promise<ComplianceRecord[]> => {
    const q = query(
      recordsCollection,
      orderBy("date", "desc"),
      firestoreLimit(count)
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as ComplianceRecord))
  },

  // Admin can update status (approve/flag/reject)
  updateStatus: async (
    id: string, 
    status: ComplianceRecordStatus, 
    approvedBy?: string, 
    approvedByName?: string,
    approvalNotes?: string
  ) => {
    const docRef = doc(db, COLLECTION_NAME, id)
    return await updateDoc(docRef, {
      status,
      ...(approvedBy ? { approvedBy } : {}),
      ...(approvedByName ? { approvedByName } : {}),
      ...(approvalNotes ? { approvalNotes } : {}),
      updatedAt: serverTimestamp(),
    })
  },

  // Mobile app creates records
  add: async (data: Omit<ComplianceRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
    const payload = {
      ...data,
      status: data.status || 'submitted',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    return await addDoc(recordsCollection, payload)
  },

  update: async (id: string, data: Partial<Omit<ComplianceRecord, 'id'>>) => {
    const docRef = doc(db, COLLECTION_NAME, id)
    const payload = {
      ...data,
      updatedAt: serverTimestamp(),
    }
    return await updateDoc(docRef, payload)
  },

  delete: async (id: string) => {
    const docRef = doc(db, COLLECTION_NAME, id)
    return await deleteDoc(docRef)
  },
}

// ─── Batch Number Generator ─────────────────────────────────────
// Format: {CompanyShort}-{BuildingShort}-{MealPlan}-{SubMealPlan}-{RandomSuffix}
export function generateBatchNumber(
  companyName: string,
  buildingName: string,
  mealPlanName: string,
  subMealPlanName: string
): string {
  const shortCompany = companyName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase()
  const shortBuilding = buildingName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase()
  const shortMP = mealPlanName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase()
  const shortSMP = subMealPlanName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '')
  
  return `${shortCompany}-${shortBuilding}-${shortMP}-${shortSMP}-${dateStr}-${random}`
}
