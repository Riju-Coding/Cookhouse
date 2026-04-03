import { db } from "@/lib/firebase"
import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query,
  where,
  orderBy,
  serverTimestamp
} from "firebase/firestore"

export type QuestionType = 'yes_no' | 'text' | 'number' | 'photo'; // Added 'number' for future, changed 'photo' to actual type

export interface ComplianceSubForm {
  id: string;
  formId: string; // Link to parent form
  question: string;
  type: QuestionType;
  isRequired: boolean;
  isPhotoRequired: boolean;
  order: number; // For sorting questions
  createdAt?: any;
}

const complianceSubFormsCollection = collection(db, 'complianceSubForms')

export const complianceSubFormsService = {
  getByFormId: async (formId: string): Promise<ComplianceSubForm[]> => {
    const q = query(
      complianceSubFormsCollection, 
      where("formId", "==", formId),
      orderBy("order")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as ComplianceSubForm));
  },

  add: async (data: Omit<ComplianceSubForm, 'id' | 'createdAt'>) => {
    const payload = {
      ...data,
      createdAt: serverTimestamp(),
    };
    return await addDoc(complianceSubFormsCollection, payload);
  },

  update: async (id: string, data: Partial<Omit<ComplianceSubForm, 'id'>>) => {
    const docRef = doc(db, 'complianceSubForms', id);
    return await updateDoc(docRef, data);
  },

  delete: async (id: string) => {
    const docRef = doc(db, 'complianceSubForms', id);
    return await deleteDoc(docRef);
  },
}