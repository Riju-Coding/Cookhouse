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

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  roleId: string;
  roleKey: string;
  vendorId: string;
  companyIds: string[];
  buildingIds: string[];  // NEW
  cafeteriaIds: string[]; // NEW
  managerId: string;
  status: 'active' | 'inactive';
  createdAt?: any;
  updatedAt?: any;
}

const usersCollection = collection(db, 'users')

export const usersService = {
  getAll: async (): Promise<User[]> => {
    const q = query(usersCollection, orderBy("name"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as User));
  },

  add: async (data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>) => {
    const payload = {
      ...data,
      status: data.status || 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    return await addDoc(usersCollection, payload);
  },

  update: async (id: string, data: Partial<Omit<User, 'id'>>) => {
    const docRef = doc(db, 'users', id);
    const payload = {
      ...data,
      updatedAt: serverTimestamp(),
    };
    return await updateDoc(docRef, payload);
  },

  delete: async (id: string) => {
    const docRef = doc(db, 'users', id);
    return await deleteDoc(docRef);
  },
}