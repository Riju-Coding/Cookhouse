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
  getDoc
} from "firebase/firestore"

export interface ComplianceForm {
  id: string;
  name: string;
  vendorId: string;
  companyId: string;
  buildingId: string;
  cafetariaId: string;
  areaId?: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom'; // Added more options for completeness
  assignedRole: string; // roleId here, assuming a user role exists
  status: 'active' | 'inactive';
  createdAt?: any;
  updatedAt?: any;
}

const complianceFormsCollection = collection(db, 'complianceForms')

export const complianceFormsService = {
  getAll: async (): Promise<ComplianceForm[]> => {
    const q = query(complianceFormsCollection, orderBy("name"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as ComplianceForm));
  },

  getById: async (id: string): Promise<ComplianceForm | null> => {
    const docRef = doc(db, 'complianceForms', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as ComplianceForm;
    }
    return null;
  },

  add: async (data: Omit<ComplianceForm, 'id' | 'createdAt' | 'updatedAt'>) => {
    const payload = {
      ...data,
      status: data.status || 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    return await addDoc(complianceFormsCollection, payload);
  },

  update: async (id: string, data: Partial<Omit<ComplianceForm, 'id'>>) => {
    const docRef = doc(db, 'complianceForms', id);
    const payload = {
      ...data,
      updatedAt: serverTimestamp(),
    };
    return await updateDoc(docRef, payload);
  },

  delete: async (id: string) => {
    const docRef = doc(db, 'complianceForms', id);
    return await deleteDoc(docRef);
  },
}