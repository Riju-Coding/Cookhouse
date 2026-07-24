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
  where,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore"

export type UserType = "super_admin" | "vendor_staff" | "company_user" | "employee"

export interface AccessPath {
  id: string
  userType: UserType
  roleId?: string
  entityId?: string       // companyId or vendorId
  entityName?: string     // For display
  allowedRoutes: string[]
  deniedRoutes: string[]
  label: string
  status: "active" | "inactive"
  updatedAt: any
  updatedBy: string
  createdAt: any
}

const accessPathsCollection = collection(db, "access_paths")

export const accessPathsService = {
  /**
   * Fetches all access path documents.
   */
  getAll: async (): Promise<AccessPath[]> => {
    const snapshot = await getDocs(accessPathsCollection)
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as AccessPath[]
  },

  /**
   * Get access paths by user type.
   */
  getByUserType: async (userType: UserType): Promise<AccessPath[]> => {
    const q = query(accessPathsCollection, where("userType", "==", userType), where("status", "==", "active"))
    const snapshot = await getDocs(q)
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as AccessPath[]
  },

  /**
   * Get access paths for a specific entity (company or vendor).
   */
  getByEntity: async (userType: UserType, entityId: string): Promise<AccessPath[]> => {
    const q = query(
      accessPathsCollection,
      where("userType", "==", userType),
      where("entityId", "==", entityId),
      where("status", "==", "active")
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as AccessPath[]
  },

  /**
   * Real-time subscription for a specific entity's access paths.
   * Used in auth context for instant access changes.
   */
  subscribe: (
    userType: UserType,
    entityId: string,
    callback: (paths: AccessPath[]) => void
  ): Unsubscribe => {
    const q = query(
      accessPathsCollection,
      where("userType", "==", userType),
      where("entityId", "==", entityId),
      where("status", "==", "active")
    )
    return onSnapshot(q, (snapshot) => {
      const paths = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as AccessPath[]
      callback(paths)
    })
  },

  /**
   * Real-time subscription by userType only (for users without entityId, like super_admin).
   */
  subscribeByUserType: (
    userType: UserType,
    callback: (paths: AccessPath[]) => void
  ): Unsubscribe => {
    const q = query(
      accessPathsCollection,
      where("userType", "==", userType),
      where("status", "==", "active")
    )
    return onSnapshot(q, (snapshot) => {
      const paths = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as AccessPath[]
      callback(paths)
    })
  },

  /**
   * Real-time subscription for a specific role.
   */
  subscribeByRole: (
    roleId: string,
    callback: (paths: AccessPath[]) => void
  ): Unsubscribe => {
    const q = query(
      accessPathsCollection,
      where("roleId", "==", roleId),
      where("status", "==", "active")
    )
    return onSnapshot(q, (snapshot) => {
      const paths = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as AccessPath[]
      callback(paths)
    })
  },

  /**
   * Adds a new access path document.
   */
  add: async (data: Omit<AccessPath, "id" | "createdAt" | "updatedAt">) => {
    const payload = {
      ...data,
      status: data.status || "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    return await addDoc(accessPathsCollection, payload)
  },

  /**
   * Updates an existing access path document.
   */
  update: async (id: string, data: Partial<Omit<AccessPath, "id">>) => {
    const docRef = doc(db, "access_paths", id)
    const payload = {
      ...data,
      updatedAt: serverTimestamp(),
    }
    return await updateDoc(docRef, payload)
  },

  /**
   * Deletes an access path document.
   */
  delete: async (id: string) => {
    const docRef = doc(db, "access_paths", id)
    return await deleteDoc(docRef)
  },
}
