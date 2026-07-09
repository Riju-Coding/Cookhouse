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

export interface GlobalShift {
  id: string;
  name: string;
  startTime: string; // e.g. "09:00"
  endTime: string;   // e.g. "18:00"
  createdAt?: any;
  updatedAt?: any;
}

const globalShiftsCollection = collection(db, 'global_shifts')

export const globalShiftsService = {
  getAll: async (): Promise<GlobalShift[]> => {
    const q = query(globalShiftsCollection, orderBy("name"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as GlobalShift));
  },

  add: async (data: Omit<GlobalShift, 'id' | 'createdAt' | 'updatedAt'>) => {
    const payload = {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    return await addDoc(globalShiftsCollection, payload);
  },

  update: async (id: string, data: Partial<Omit<GlobalShift, 'id'>>) => {
    const docRef = doc(db, 'global_shifts', id);
    const payload = {
      ...data,
      updatedAt: serverTimestamp(),
    };
    return await updateDoc(docRef, payload);
  },

  delete: async (id: string) => {
    const docRef = doc(db, 'global_shifts', id);
    return await deleteDoc(docRef);
  },
}
