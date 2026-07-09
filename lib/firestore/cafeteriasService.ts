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
  expectedManpower?: number;
  // Geo-fence fields for attendance
  latitude?: number;
  longitude?: number;
  radius?: number;           // metres (default 100)
  address?: string;          // reverse-geocoded or manually entered
  geoSetAt?: any;            // timestamp when location was set
  geoSetBy?: string;         // userId of who set it (admin or KAM)
  shifts?: {
    id: string;
    name: string;
    startTime: string; // e.g. "09:00"
    endTime: string;   // e.g. "18:00"
    breaks: {
      name: string;
      maxMinutes: number;
    }[];
  }[];
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