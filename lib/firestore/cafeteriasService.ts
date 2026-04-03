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

export interface Cafeteria {
  id: string;
  name: string;
  companyId: string;
  buildingId: string;
  vendorId: string;
  status: 'active' | 'inactive';
  createdAt?: any;
  updatedAt?: any;
}

const cafeteriasCollection = collection(db, 'cafetarias') // Spelled as requested

export const cafeteriasService = {
  getAll: async (): Promise<Cafeteria[]> => {
    // Ordering by name by default
    const q = query(cafeteriasCollection, orderBy("name"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Cafeteria));
  },

  add: async (data: Omit<Cafeteria, 'id' | 'createdAt' | 'updatedAt'>) => {
    const payload = {
      ...data,
      status: data.status || 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    return await addDoc(cafeteriasCollection, payload);
  },

  update: async (id: string, data: Partial<Omit<Cafeteria, 'id'>>) => {
    const docRef = doc(db, 'cafetarias', id);
    const payload = {
      ...data,
      updatedAt: serverTimestamp(),
    };
    return await updateDoc(docRef, payload);
  },

  delete: async (id: string) => {
    const docRef = doc(db, 'cafetarias', id);
    return await deleteDoc(docRef);
  },
}