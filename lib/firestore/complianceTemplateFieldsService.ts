import { db } from "@/lib/firebase"
import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  updateDoc, 
  setDoc,
  deleteDoc, 
  query,
  where,
  orderBy,
  serverTimestamp
} from "firebase/firestore"

// ─── Field Types ────────────────────────────────────────────────
export type TemplateFieldType = 
  | 'yes_no'           // Boolean toggle
  | 'text'             // Free text input
  | 'number'           // Numeric input
  | 'photo'            // Photo upload
  | 'temperature'      // Temperature reading (with unit + thresholds)
  | 'quantity'          // Quantity input (with unit)
  | 'vehicle_select'   // Vehicle picker dropdown
  | 'batch_number'     // Auto-generated batch number display
  | 'employee_select'  // Employee picker for "received by"
  | 'rating'           // 1-5 star rating
  | 'dropdown'         // Custom dropdown options

export type MeasurementUnit = '°C' | '°F' | 'kg' | 'g' | 'pcs' | 'litres' | 'ml' | 'plates' | 'portions'

// ─── Template Field Interface ───────────────────────────────────
export interface ComplianceTemplateField {
  id: string
  templateId: string          // Link to parent template
  question: string            // Field label / question text
  type: TemplateFieldType
  isRequired: boolean
  isPhotoRequired: boolean    // Require a photo alongside this field
  unit?: MeasurementUnit      // For temperature / quantity fields
  minValue?: number           // Validation: min threshold (e.g. min safe temp 60°C)
  maxValue?: number           // Validation: max threshold
  options?: string[]          // For dropdown type — list of options
  order: number               // Sort order
  servicePhase?: 'before_service' | 'during_service' | 'after_service' | 'none'
  createdAt?: any
}

const COLLECTION_NAME = 'complianceTemplateFields'
const templateFieldsCollection = collection(db, COLLECTION_NAME)

export const complianceTemplateFieldsService = {
  getByTemplateId: async (templateId: string): Promise<ComplianceTemplateField[]> => {
    const q = query(
      templateFieldsCollection, 
      where("templateId", "==", templateId)
    )
    const snapshot = await getDocs(q)
    const fields = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as ComplianceTemplateField))
    
    return fields.sort((a, b) => (a.order || 0) - (b.order || 0))
  },

  add: async (data: Omit<ComplianceTemplateField, 'id' | 'createdAt'>) => {
    const payload = {
      ...data,
      createdAt: serverTimestamp(),
    }
    return await addDoc(templateFieldsCollection, payload)
  },

  update: async (id: string, data: Partial<Omit<ComplianceTemplateField, 'id'>>) => {
    const docRef = doc(db, COLLECTION_NAME, id)
    return await setDoc(docRef, data, { merge: true })
  },

  delete: async (id: string) => {
    const docRef = doc(db, COLLECTION_NAME, id)
    return await deleteDoc(docRef)
  },

  // Bulk delete all fields for a template (used when deleting a template)
  deleteByTemplateId: async (templateId: string) => {
    const fields = await complianceTemplateFieldsService.getByTemplateId(templateId)
    await Promise.all(fields.map(f => complianceTemplateFieldsService.delete(f.id)))
  },
}
