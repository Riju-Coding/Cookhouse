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
  setDoc,
} from "firebase/firestore";

export type VendorTemplateCategory =
  | "housekeeping"
  | "equipment_ppm"
  | "cold_chain_temp"
  | "sanitization_chemicals"
  | "storage_safety"
  | "utilities_etp";

export type VendorTemplateFrequency =
  | "daily_morning"
  | "daily_evening"
  | "daily_per_shift"
  | "weekly"
  | "monthly"
  | "per_batch";

export interface VendorCheckpoint {
  id: string;
  checkpoint: string;
  department: string;
  type: "yes_no" | "temperature" | "number" | "text" | "rating";
  acceptableRange?: string;
  minVal?: number;
  maxVal?: number;
  isRequired: boolean;
  isPhotoRequired: boolean;
  order: number;
}

export interface VendorComplianceTemplate {
  id: string;
  name: string;
  docNo: string;
  sopCode: string;
  category: VendorTemplateCategory;
  frequency: VendorTemplateFrequency;
  vendorId: string; // 'all' or specific vendor ID
  vendorLocationId?: string; // 'all' or specific location ID
  assignedRole: string; // 'KEY_ACOUNT_MANAGER'
  checkpoints: VendorCheckpoint[];
  status: "active" | "inactive";
  createdAt?: any;
  updatedAt?: any;
}

const COLLECTION_NAME = "vendorComplianceTemplates";
const templatesCollection = collection(db, COLLECTION_NAME);

// ─── STANDARD COOKHOUSE SOP TEMPLATES (Derived from PDF) ─────────────────
export const STANDARD_COOKHOUSE_TEMPLATES: Omit<VendorComplianceTemplate, "id" | "createdAt" | "updatedAt">[] = [
  {
    name: "Daily Base Kitchen Cleaning & Sanitation Schedule",
    docNo: "CH/QC-HK/24",
    sopCode: "SOP 24",
    category: "housekeeping",
    frequency: "daily_morning",
    vendorId: "all",
    vendorLocationId: "all",
    assignedRole: "KEY_ACOUNT_MANAGER",
    status: "active",
    checkpoints: [
      {
        id: "chk_hk_1",
        checkpoint: "Main Kitchen floor sweeping, scrubbing and sanitized mopping completed",
        department: "Main Kitchen",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: true,
        order: 1,
      },
      {
        id: "chk_hk_2",
        checkpoint: "Vegetables cutting section floor and preparation tables washed & sanitized",
        department: "Cutting Section",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: false,
        order: 2,
      },
      {
        id: "chk_hk_3",
        checkpoint: "Dry stores floor swept, storage pellets clean, and racks free from dust/spillage",
        department: "Dry Stores",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: true,
        order: 3,
      },
      {
        id: "chk_hk_4",
        checkpoint: "Packaging & Dispatch area floor, sorting counters, and trays sanitized",
        department: "Packaging & Dispatch",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: false,
        order: 4,
      },
      {
        id: "chk_hk_5",
        checkpoint: "Pot wash & dishwashing area floor free from stagnant water, grease traps clean",
        department: "Pot Wash & Dishwashing",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: false,
        order: 5,
      },
      {
        id: "chk_hk_6",
        checkpoint: "Staff changing room and lockers clean, dry, waste bins emptied & sanitized",
        department: "Staff Changing / Locker Room",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: false,
        order: 6,
      },
      {
        id: "chk_hk_7",
        checkpoint: "All kitchen waste bins covered, color-coded, lined with polythene bags",
        department: "Main Kitchen",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: true,
        order: 7,
      },
    ],
  },
  {
    name: "Cooking Equipment & Utensils Hygiene",
    docNo: "CH/HK-DISW/01",
    sopCode: "SOP 01",
    category: "equipment_ppm",
    frequency: "daily_per_shift",
    vendorId: "all",
    vendorLocationId: "all",
    assignedRole: "KEY_ACOUNT_MANAGER",
    status: "active",
    checkpoints: [
      {
        id: "chk_eq_1",
        checkpoint: "Big Steam Jacket Kettles (M & N) inside & outlet nozzle rubbed & descaled",
        department: "Main Kitchen",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: true,
        order: 1,
      },
      {
        id: "chk_eq_2",
        checkpoint: "Mid Kettles (Dry/Snacks) inner chamber and outer stainless body clean",
        department: "Main Kitchen",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: false,
        order: 2,
      },
      {
        id: "chk_eq_3",
        checkpoint: "Commercial Gravy Machine and Pulverizer dismantled, washed & sanitized",
        department: "Main Kitchen",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: true,
        order: 3,
      },
      {
        id: "chk_eq_4",
        checkpoint: "Potato & Onion peeler drum blades rinsed and free from vegetable residues",
        department: "Cutting Section",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: false,
        order: 4,
      },
      {
        id: "chk_eq_5",
        checkpoint: "Dough Kneader & Planetary Mixer bowl & hooks cleaned with food-grade wash",
        department: "Main Kitchen",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: false,
        order: 5,
      },
      {
        id: "chk_eq_6",
        checkpoint: "Stainless Steel cutting knives & color-coded chopping boards sanitized",
        department: "Cutting Section",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: false,
        order: 6,
      },
    ],
  },
  {
    name: "Walk-in Chiller & Deep Freezer Temperature Log",
    docNo: "CH/QC/Pro/04",
    sopCode: "SOP 04",
    category: "cold_chain_temp",
    frequency: "daily_morning",
    vendorId: "all",
    vendorLocationId: "all",
    assignedRole: "KEY_ACOUNT_MANAGER",
    status: "active",
    checkpoints: [
      {
        id: "chk_cl_1",
        checkpoint: "Walk-in Chiller / Cold Room Display Temp reading (°C)",
        department: "Walk-in Chiller / Cold Room",
        type: "temperature",
        acceptableRange: "0°C to 5°C",
        minVal: 0,
        maxVal: 5,
        isRequired: true,
        isPhotoRequired: true,
        order: 1,
      },
      {
        id: "chk_cl_2",
        checkpoint: "Deep Freezer Unit Display Temp reading (°C)",
        department: "Deep Freeze Storage",
        type: "temperature",
        acceptableRange: "≤ -18°C",
        minVal: -25,
        maxVal: -18,
        isRequired: true,
        isPhotoRequired: true,
        order: 2,
      },
      {
        id: "chk_cl_3",
        checkpoint: "Chiller & Freezer door rubber gaskets intact and sealing airtight",
        department: "Walk-in Chiller / Cold Room",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: false,
        order: 3,
      },
      {
        id: "chk_cl_4",
        checkpoint: "All stored food items covered, raised on plastic pallets, with date labels (FEFO)",
        department: "Walk-in Chiller / Cold Room",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: true,
        order: 4,
      },
      {
        id: "chk_cl_5",
        checkpoint: "No ice buildup / frost accumulation on evaporator coils or fans",
        department: "Deep Freeze Storage",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: false,
        order: 5,
      },
    ],
  },
  {
    name: "Raw Vegetables & Fruit Sanitization Log",
    docNo: "CH/QC/Str/06",
    sopCode: "SOP 06",
    category: "sanitization_chemicals",
    frequency: "daily_per_shift",
    vendorId: "all",
    vendorLocationId: "all",
    assignedRole: "KEY_ACOUNT_MANAGER",
    status: "active",
    checkpoints: [
      {
        id: "chk_vg_1",
        checkpoint: "Sanitizing chemical used (Suma Bac D10 / Suma Tab Chlorine solution)",
        department: "Cutting Section",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: false,
        order: 1,
      },
      {
        id: "chk_vg_2",
        checkpoint: "Sanitizer solution concentration PPM reading (150-200 PPM test strip)",
        department: "Cutting Section",
        type: "number",
        acceptableRange: "150 - 200 PPM",
        minVal: 150,
        maxVal: 200,
        isRequired: true,
        isPhotoRequired: true,
        order: 2,
      },
      {
        id: "chk_vg_3",
        checkpoint: "Vegetables immersed for mandatory 5 minutes contact time",
        department: "Cutting Section",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: false,
        order: 3,
      },
      {
        id: "chk_vg_4",
        checkpoint: "Secondary rinse with clean potable RO water before cutting/peeling",
        department: "Cutting Section",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: false,
        order: 4,
      },
      {
        id: "chk_vg_5",
        checkpoint: "Rotten, damaged or infested vegetables segregated and recorded as wastage",
        department: "Cutting Section",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: false,
        order: 5,
      },
    ],
  },
  {
    name: "Used Cooking Oil & TPM Quality Log",
    docNo: "CH/QC-Pro/08",
    sopCode: "SOP 08",
    category: "storage_safety",
    frequency: "daily_evening",
    vendorId: "all",
    vendorLocationId: "all",
    assignedRole: "KEY_ACOUNT_MANAGER",
    status: "active",
    checkpoints: [
      {
        id: "chk_oil_1",
        checkpoint: "Total Polar Materials (TPM) value measured via digital tester (%)",
        department: "Main Kitchen",
        type: "number",
        acceptableRange: "≤ 25% TPM (FSSAI Limit)",
        minVal: 0,
        maxVal: 25,
        isRequired: true,
        isPhotoRequired: true,
        order: 1,
      },
      {
        id: "chk_oil_2",
        checkpoint: "Oil appearance normal (no dark black discoloration, foaming or pungent smell)",
        department: "Main Kitchen",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: false,
        order: 2,
      },
      {
        id: "chk_oil_3",
        checkpoint: "FSSAI compliance: Oil discarded if TPM > 25% into designated RUCO drum",
        department: "Main Kitchen",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: false,
        order: 3,
      },
      {
        id: "chk_oil_4",
        checkpoint: "Deep fryers filtered, scraped and cleaned before refilling fresh oil",
        department: "Main Kitchen",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: true,
        order: 4,
      },
    ],
  },
  {
    name: "Staff Personal Hygiene & Grooming Verification",
    docNo: "CH/QC-ADM/18",
    sopCode: "SOP 18",
    category: "housekeeping",
    frequency: "daily_morning",
    vendorId: "all",
    vendorLocationId: "all",
    assignedRole: "KEY_ACOUNT_MANAGER",
    status: "active",
    checkpoints: [
      {
        id: "chk_hy_1",
        checkpoint: "All kitchen staff wearing clean Cookhouse uniform, apron and safety shoes",
        department: "Staff Changing / Locker Room",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: true,
        order: 1,
      },
      {
        id: "chk_hy_2",
        checkpoint: "Hairnets and beard nets properly worn covering all loose hair",
        department: "Main Kitchen",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: false,
        order: 2,
      },
      {
        id: "chk_hy_3",
        checkpoint: "Finger nails trimmed short, clean, no nail polish or fake nails",
        department: "Main Kitchen",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: false,
        order: 3,
      },
      {
        id: "chk_hy_4",
        checkpoint: "No wrist watches, rings, bracelets or loose jewellery in production areas",
        department: "Main Kitchen",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: false,
        order: 4,
      },
      {
        id: "chk_hy_5",
        checkpoint: "Staff with cough, fever, vomiting, or open wounds excused / bandaged with blue plaster",
        department: "Staff Changing / Locker Room",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: false,
        order: 5,
      },
      {
        id: "chk_hy_6",
        checkpoint: "Handwashing practiced with antibacterial soap for 20s before entering kitchen",
        department: "Main Kitchen",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: false,
        order: 6,
      },
    ],
  },
  {
    name: "Daily Preventive Maintenance (PPM) Checklist",
    docNo: "CH/Main/QC/32",
    sopCode: "SOP 31",
    category: "equipment_ppm",
    frequency: "daily_morning",
    vendorId: "all",
    vendorLocationId: "all",
    assignedRole: "KEY_ACOUNT_MANAGER",
    status: "active",
    checkpoints: [
      {
        id: "chk_ppm_1",
        checkpoint: "Entrance Air Curtain operational with strong downward air velocity",
        department: "Main Kitchen",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: false,
        order: 1,
      },
      {
        id: "chk_ppm_2",
        checkpoint: "Electronic Fly Catchers UV tubes glowing and glue pads checked / replaced",
        department: "Main Kitchen",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: true,
        order: 2,
      },
      {
        id: "chk_ppm_3",
        checkpoint: "Exhaust hood suction fans and fresh air supply duct working effectively",
        department: "Main Kitchen",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: false,
        order: 3,
      },
      {
        id: "chk_ppm_4",
        checkpoint: "CCTV security cameras in production, dispatch and storage operational",
        department: "Packaging & Dispatch",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: false,
        order: 4,
      },
      {
        id: "chk_ppm_5",
        checkpoint: "Receiving & Dispatch electronic weighing scales calibrated (zero verified)",
        department: "Dry Stores",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: true,
        order: 5,
      },
      {
        id: "chk_ppm_6",
        checkpoint: "Basement / Kitchen Sump Pumps tested and drainage flowing freely",
        department: "Pot Wash & Dishwashing",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: false,
        order: 6,
      },
    ],
  },
  {
    name: "Gas Bank (PNG / LPG) & Fire Safety Inspection",
    docNo: "CH/Admin-Main/35",
    sopCode: "SOP 35",
    category: "utilities_etp",
    frequency: "daily_morning",
    vendorId: "all",
    vendorLocationId: "all",
    assignedRole: "KEY_ACOUNT_MANAGER",
    status: "active",
    checkpoints: [
      {
        id: "chk_gas_1",
        checkpoint: "Gas manifold pressure gauge reading within safe operating range (Bar/PSI)",
        department: "Gas Bank (PNG / LPG)",
        type: "number",
        acceptableRange: "Safe Operating Range",
        isRequired: true,
        isPhotoRequired: true,
        order: 1,
      },
      {
        id: "chk_gas_2",
        checkpoint: "No gas leakage smell detected around cylinders, pipeline joints or burner valves",
        department: "Gas Bank (PNG / LPG)",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: false,
        order: 2,
      },
      {
        id: "chk_gas_3",
        checkpoint: "Main emergency gas shut-off valve accessible and unobstructed",
        department: "Gas Bank (PNG / LPG)",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: false,
        order: 3,
      },
      {
        id: "chk_gas_4",
        checkpoint: "Fire hose reels functional with clear access and unobstructed nozzle",
        department: "Main Kitchen",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: false,
        order: 4,
      },
      {
        id: "chk_gas_5",
        checkpoint: "Kitchen ABC & CO2 Fire Extinguishers pressure gauge in green zone with intact seal",
        department: "Main Kitchen",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: true,
        order: 5,
      },
    ],
  },
  {
    name: "Location-wise Glass & Brittle Plastic Monitoring",
    docNo: "CH/Main-QC/55",
    sopCode: "SOP 55",
    category: "storage_safety",
    frequency: "weekly",
    vendorId: "all",
    vendorLocationId: "all",
    assignedRole: "KEY_ACOUNT_MANAGER",
    status: "active",
    checkpoints: [
      {
        id: "chk_gl_1",
        checkpoint: "Main kitchen overhead light fixtures have protective diffuser covers intact",
        department: "Main Kitchen",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: true,
        order: 1,
      },
      {
        id: "chk_gl_2",
        checkpoint: "Cutting, Preparation and Storage sections free from broken glass or cracked plastics",
        department: "Cutting Section",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: false,
        order: 2,
      },
      {
        id: "chk_gl_3",
        checkpoint: "All wall clocks, temperature dial gauges and inspection windows unbroken",
        department: "Packaging & Dispatch",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: false,
        order: 3,
      },
      {
        id: "chk_gl_4",
        checkpoint: "Glass breakage incident register updated with zero open incidents",
        department: "Main Kitchen",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: false,
        order: 4,
      },
    ],
  },
  {
    name: "Effluent Treatment (ETP) & RO Water System Log",
    docNo: "CH/Main/QC/71",
    sopCode: "SOP 71",
    category: "utilities_etp",
    frequency: "daily_evening",
    vendorId: "all",
    vendorLocationId: "all",
    assignedRole: "KEY_ACOUNT_MANAGER",
    status: "active",
    checkpoints: [
      {
        id: "chk_etp_1",
        checkpoint: "ETP wastewater treatment discharge pH level (Standard: 6.5 to 8.5)",
        department: "ETP & RO Plant",
        type: "number",
        acceptableRange: "6.5 to 8.5 pH",
        minVal: 6.5,
        maxVal: 8.5,
        isRequired: true,
        isPhotoRequired: true,
        order: 1,
      },
      {
        id: "chk_etp_2",
        checkpoint: "RO Plant drinking/cooking water TDS level reading (PPM)",
        department: "ETP & RO Plant",
        type: "number",
        acceptableRange: "50 to 150 PPM",
        minVal: 40,
        maxVal: 200,
        isRequired: true,
        isPhotoRequired: true,
        order: 2,
      },
      {
        id: "chk_etp_3",
        checkpoint: "Blowers, agitators and sludge pump running smoothly without abnormal vibration",
        department: "ETP & RO Plant",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: false,
        order: 3,
      },
      {
        id: "chk_etp_4",
        checkpoint: "Chemical dosage (coagulant / flocculant) replenished for next cycle",
        department: "ETP & RO Plant",
        type: "yes_no",
        isRequired: true,
        isPhotoRequired: false,
        order: 4,
      },
    ],
  },
];

export const vendorComplianceTemplatesService = {
  getAll: async (): Promise<VendorComplianceTemplate[]> => {
    const q = query(templatesCollection, orderBy("sopCode"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as VendorComplianceTemplate[];
  },

  getActiveForVendor: async (vendorId: string): Promise<VendorComplianceTemplate[]> => {
    // Return all active templates that apply to 'all' vendors OR to this specific vendorId
    const snapshot = await getDocs(
      query(templatesCollection, where("status", "==", "active"))
    );
    const list = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as VendorComplianceTemplate[];

    return list.filter(
      (t) => t.vendorId === "all" || t.vendorId === vendorId
    );
  },

  getById: async (id: string): Promise<VendorComplianceTemplate | null> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as VendorComplianceTemplate;
    }
    return null;
  },

  add: async (data: Omit<VendorComplianceTemplate, "id" | "createdAt" | "updatedAt">) => {
    const payload = {
      ...data,
      assignedRole: data.assignedRole || "KEY_ACOUNT_MANAGER",
      status: data.status || "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const res = await addDoc(templatesCollection, payload);
    return res.id;
  },

  update: async (id: string, data: Partial<Omit<VendorComplianceTemplate, "id">>) => {
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
   * One-click seed function: Initializes the standard Cookhouse Head Office / Base Kitchen
   * SOP templates parsed from "Cook House Upadated formats current.pdf".
   */
  seedStandardTemplates: async (): Promise<{ created: number; existing: number }> => {
    let created = 0;
    let existing = 0;

    for (const tpl of STANDARD_COOKHOUSE_TEMPLATES) {
      // Use deterministic doc ID for clean idempotency
      const docId = `tpl_${tpl.docNo.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      const docRef = doc(db, COLLECTION_NAME, docId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        await setDoc(docRef, {
          ...tpl,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        created++;
      } else {
        existing++;
      }
    }

    return { created, existing };
  },
};
