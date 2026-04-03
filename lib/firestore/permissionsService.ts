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

export interface Permission {
  id: string;
  name: string;
  key: string;
  description: string;
  pageName: string;
  status: 'active' | 'inactive'; // Status field
  createdAt: any;
  updatedAt: any;
}

const permissionsCollection = collection(db, 'permissions')

export const permissionsService = {
  
  /**
   * Fetches all permissions, ordered by pageName for grouping.
   */
  getAll: async (): Promise<Permission[]> => {
    const q = query(permissionsCollection, orderBy("pageName"), orderBy("name"));
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Permission))
  },

  /**
   * Adds a new permission to Firestore.
   */
  add: async (data: Omit<Permission, 'id' | 'createdAt' | 'updatedAt'>) => {
    const payload = {
      ...data,
      status: data.status || 'active', // Default new permissions to active
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    return await addDoc(permissionsCollection, payload)
  },

  /**
   * Updates an existing permission.
   */
  update: async (id: string, data: Partial<Omit<Permission, 'id'>>) => {
    const docRef = doc(db, 'permissions', id)
    const payload = {
      ...data,
      updatedAt: serverTimestamp(),
    }
    return await updateDoc(docRef, payload)
  },

  /**
   * Deletes a permission from Firestore.
   */
  delete: async (id: string) => {
    const docRef = doc(db, 'permissions', id)
    return await deleteDoc(docRef)
  },
}