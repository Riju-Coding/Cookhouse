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
  where
} from "firebase/firestore"

export type UserType = "super_admin" | "vendor_staff" | "company_user" | "employee"

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  userType: UserType;
  roleId: string;
  roleKey: string;
  vendorId: string;
  companyIds: string[];
  buildingIds: string[];  // NEW
  cafeteriaIds: string[]; // NEW
  officeLocation?: {
    address: string;
    latitude: number;
    longitude: number;
    radius: number;
  };
  assignedShifts?: {
    cafeteriaId: string;
    shiftId: string;
    workDays: string[];
    workType: 'Remote' | 'On-site' | 'Hybrid';
  }[];
  assignedBreaks?: {
    name: string;
    durationMinutes: number;
  }[];
  complianceDocuments?: {
    type: 'Police Verification' | 'Medical Certificate' | 'Other';
    url: string;
    issueDate?: any; // Firestore Timestamp
    expiryDate?: any; // Firestore Timestamp
    status: 'valid' | 'expired' | 'pending';
  }[];
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

  getByVendor: async (vendorId: string): Promise<User[]> => {
    const q = query(usersCollection, where("vendorId", "==", vendorId), orderBy("name"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as User));
  },

  getByCompany: async (companyId: string): Promise<User[]> => {
    const q = query(usersCollection, where("companyIds", "array-contains", companyId), orderBy("name"));
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