import { db } from "@/lib/firebase";
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
  getDoc,
} from "firebase/firestore";

export type VendorLocationType =
  | "base_kitchen"
  | "head_office"
  | "commissary"
  | "warehouse"
  | "bakery_unit";

export interface VendorLocation {
  id: string;
  vendorId: string;
  vendorName: string;
  name: string;
  locationType: VendorLocationType;
  address: string;
  latitude: number;
  longitude: number;
  radius: number; // in meters (for geofence verification)
  fssaiLicenseNumber?: string;
  departments: string[];
  contactPerson?: string;
  contactPhone?: string;
  isPrimaryHq: boolean;
  status: "active" | "inactive";
  createdAt?: any;
  updatedAt?: any;
}

const COLLECTION_NAME = "vendorLocations";
const vendorLocationsCollection = collection(db, COLLECTION_NAME);

export const DEFAULT_DEPARTMENTS = [
  "Main Kitchen",
  "Cutting Section",
  "Dry Stores",
  "Walk-in Chiller / Cold Room",
  "Deep Freeze Storage",
  "Pot Wash & Dishwashing",
  "Packaging & Dispatch",
  "Staff Changing / Locker Room",
  "Gas Bank (PNG / LPG)",
  "ETP & RO Plant",
];

export const vendorLocationsService = {
  getAll: async (): Promise<VendorLocation[]> => {
    const q = query(vendorLocationsCollection, orderBy("name"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as VendorLocation[];
  },

  getByVendorId: async (vendorId: string): Promise<VendorLocation[]> => {
    const q = query(vendorLocationsCollection, where("vendorId", "==", vendorId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as VendorLocation[];
  },

  getById: async (id: string): Promise<VendorLocation | null> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as VendorLocation;
    }
    return null;
  },

  add: async (data: Omit<VendorLocation, "id" | "createdAt" | "updatedAt">) => {
    const payload = {
      ...data,
      radius: Number(data.radius) || 150,
      departments: data.departments?.length ? data.departments : DEFAULT_DEPARTMENTS,
      status: data.status || "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const res = await addDoc(vendorLocationsCollection, payload);
    return res.id;
  },

  update: async (id: string, data: Partial<Omit<VendorLocation, "id">>) => {
    const docRef = doc(db, COLLECTION_NAME, id);
    const payload = {
      ...data,
      updatedAt: serverTimestamp(),
    };
    return await updateDoc(docRef, payload);
  },

  delete: async (id: string) => {
    const docRef = doc(db, COLLECTION_NAME, id);
    return await deleteDoc(docRef);
  },

  /**
   * Automatically ensures at least one primary location exists for a vendor
   * based on the vendor's primary HQ fields.
   */
  ensurePrimaryLocationForVendor: async (
    vendorId: string,
    vendorData: {
      name: string;
      address?: string;
      hqAddress?: string;
      hqLatitude?: number | null;
      hqLongitude?: number | null;
      hqRadius?: number;
      phone?: string;
      contactPerson?: string;
    }
  ): Promise<VendorLocation | null> => {
    const existing = await vendorLocationsService.getByVendorId(vendorId);
    if (existing.length > 0) {
      return existing[0];
    }

    const lat = vendorData.hqLatitude || 28.4986; // Default to Gurgaon if unset
    const lng = vendorData.hqLongitude || 77.0878;
    const addr =
      vendorData.hqAddress ||
      vendorData.address ||
      "Plot No 30, Sector 18 HSIIDC, Udyog Vihar, Gurugram, Haryana 122008";

    const newLocPayload: Omit<VendorLocation, "id" | "createdAt" | "updatedAt"> = {
      vendorId,
      vendorName: vendorData.name,
      name: `${vendorData.name} - Central Base Kitchen & HO`,
      locationType: "base_kitchen",
      address: addr,
      latitude: lat,
      longitude: lng,
      radius: vendorData.hqRadius || 150,
      departments: DEFAULT_DEPARTMENTS,
      contactPerson: vendorData.contactPerson || "",
      contactPhone: vendorData.phone || "",
      isPrimaryHq: true,
      status: "active",
    };

    const newId = await vendorLocationsService.add(newLocPayload);
    return { id: newId, ...newLocPayload };
  },
};
