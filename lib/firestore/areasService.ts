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
  orderBy,
  getDoc
} from "firebase/firestore"

export interface Area {
  id: string;
  name: string;
  description?: string;
  parentAreaId?: string; // For nested areas
  companyId?: string;
  buildingId?: string;
  cafeteriaId?: string;
  type: 'company' | 'building' | 'cafeteria' | 'sub-area'; // Type of entity this area belongs to
  status: 'active' | 'inactive';
  createdAt?: any;
  updatedAt?: any;
}

const areasCollection = collection(db, 'areas')

export const areasService = {
  getAll: async (): Promise<Area[]> => {
    const q = query(areasCollection, orderBy("name"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Area));
  },

  getById: async (id: string): Promise<Area | null> => {
    const docRef = doc(db, 'areas', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Area;
    }
    return null;
  },

  getByParentId: async (parentAreaId: string): Promise<Area[]> => {
    const q = query(
      areasCollection,
      where("parentAreaId", "==", parentAreaId),
      orderBy("name")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Area));
  },

  getByType: async (type: string): Promise<Area[]> => {
    const q = query(
      areasCollection,
      where("type", "==", type),
      orderBy("name")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Area));
  },

  getByCompanyId: async (companyId: string): Promise<Area[]> => {
    const q = query(
      areasCollection,
      where("companyId", "==", companyId),
      orderBy("name")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Area));
  },

  add: async (data: Omit<Area, 'id' | 'createdAt' | 'updatedAt'>) => {
    const payload = {
      ...data,
      status: data.status || 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    return await addDoc(areasCollection, payload);
  },

  update: async (id: string, data: Partial<Omit<Area, 'id'>>) => {
    const docRef = doc(db, 'areas', id);
    const payload = {
      ...data,
      updatedAt: serverTimestamp(),
    };
    return await updateDoc(docRef, payload);
  },

  delete: async (id: string) => {
    const docRef = doc(db, 'areas', id);
    return await deleteDoc(docRef);
  },
}
