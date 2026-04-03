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
  orderBy
} from "firebase/firestore"

export interface Assignment {
  id: string;
  vendorId: string;
  companyId: string;
  buildingId: string;
  cafetariaId: string;
  kamId: string;
  supervisorIds: string[];
  staffIds: string[];
  status: 'active' | 'inactive';
  createdAt?: any;
  updatedAt?: any;
}

const assignmentsCollection = collection(db, 'assignments')

export const assignmentsService = {
  getAll: async (): Promise<Assignment[]> => {
    // Ordering by createdAt or similar is usually best here. We'll fetch all.
    const snapshot = await getDocs(assignmentsCollection);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Assignment));
  },

  add: async (data: Omit<Assignment, 'id' | 'createdAt' | 'updatedAt'>) => {
    const payload = {
      ...data,
      status: data.status || 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    return await addDoc(assignmentsCollection, payload);
  },

  update: async (id: string, data: Partial<Omit<Assignment, 'id'>>) => {
    const docRef = doc(db, 'assignments', id);
    const payload = {
      ...data,
      updatedAt: serverTimestamp(),
    };
    return await updateDoc(docRef, payload);
  },

  delete: async (id: string) => {
    const docRef = doc(db, 'assignments', id);
    return await deleteDoc(docRef);
  },
}