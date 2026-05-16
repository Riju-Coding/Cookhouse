import { db } from "@/lib/firebase"
import { 
  collection, 
  getDocs, 
  getDoc,
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  query,
  where,
} from "firebase/firestore"

export type UserType = "super_admin" | "vendor_staff" | "company_user" | "employee"

export interface Role {
  id: string;
  name: string;
  key: string;
  userType: UserType;
  permissions: { [key: string]: boolean }; // e.g., { "VIEW_REPORTS": true }
  status: 'active' | 'inactive'; // Status field
  isSystem: boolean; // true for Super Admin — cannot be deleted
  entityId?: string | null; // companyId or vendorId
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
   * Fetches roles filtered by userType.
   */
  getByUserType: async (userType: UserType): Promise<Role[]> => {
    const q = query(rolesCollection, where("userType", "==", userType))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Role))
  },

  /**
   * Fetches roles filtered by entity.
   */
  getByEntity: async (entityId: string | null): Promise<Role[]> => {
    const q = query(rolesCollection, where("entityId", "==", entityId))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Role))
  },

  /**
   * Fetches roles for a specific userType AND entity.
   */
  getScopedRoles: async (userType: UserType, entityId: string | null): Promise<Role[]> => {
    const q = query(
      rolesCollection, 
      where("userType", "==", userType),
      where("entityId", "==", entityId)
    )
    const snapshot = await getDocs(q)
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
      userType: data.userType || 'super_admin',
      isSystem: data.isSystem || false,
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
   * System roles (isSystem: true) cannot be deleted.
   */
  delete: async (id: string) => {
    const docRef = doc(db, 'roles', id)
    // Check if system role before deleting
    const roleDoc = await getDoc(docRef)
    if (roleDoc.exists() && roleDoc.data()?.isSystem) {
      throw new Error("Cannot delete a system role.")
    }
    return await deleteDoc(docRef)
  },
}