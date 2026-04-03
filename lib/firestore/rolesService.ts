import { db } from "@/lib/firebase"
import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp 
} from "firebase/firestore"

export interface Role {
  id: string;
  name: string;
  key: string;
  permissions: { [key: string]: boolean }; // e.g., { "VIEW_REPORTS": true }
  status: 'active' | 'inactive'; // Status field
  createdAt: any;
  updatedAt: any;
}

const rolesCollection = collection(db, 'roles')

export const rolesService = {
  
  /**
   * Fetches all roles from the Firestore collection.
   */
  getAll: async (): Promise<Role[]> => {
    const snapshot = await getDocs(rolesCollection)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Role))
  },

  /**
   * Adds a new role to the Firestore collection.
   */
  add: async (data: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>) => {
    const payload = {
      ...data,
      status: data.status || 'active', // Default new roles to active
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    return await addDoc(rolesCollection, payload)
  },

  /**
   * Updates an existing role in the Firestore collection.
   */
  update: async (id: string, data: Partial<Omit<Role, 'id'>>) => {
    const docRef = doc(db, 'roles', id)
    const payload = {
      ...data,
      updatedAt: serverTimestamp(),
    }
    return await updateDoc(docRef, payload)
  },

  /**
   * Deletes a role from the Firestore collection.
   */
  delete: async (id: string) => {
    const docRef = doc(db, 'roles', id)
    return await deleteDoc(docRef)
  },
}