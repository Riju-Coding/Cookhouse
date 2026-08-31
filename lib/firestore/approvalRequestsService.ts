import { db } from "@/lib/firebase"
import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  updateDoc, 
  getDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
  Timestamp
} from "firebase/firestore"
import { CellChange } from "@/lib/types"

export type ApprovalTargetType = 
  | "MEAL_PLAN_STRUCTURE" 
  | "STRUCTURAL_ASSIGNMENT" 
  | "MENU_UPDATION"

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"

export interface ApprovalRequest {
  id?: string;
  targetType: ApprovalTargetType;
  targetId: string; // ID of the specific entity being modified
  
  // Routing & Ownership
  companyId: string;
  buildingId?: string; 
  vendorId?: string; 
  
  // Request Metadata
  requestedByUserId: string;
  requestedByUserName: string;
  requestedAt: any; // Firestore Timestamp
  
  // Workflow Status
  status: ApprovalStatus;
  vendorRemarks?: string;
  resolvedByUserId?: string;
  resolvedAt?: any; // Firestore Timestamp

  // -------------------------------------------------------------------
  // POLYMORPHIC PAYLOADS: Only ONE of these will be populated per request
  // -------------------------------------------------------------------
  
  mealPlanStructurePayload?: {
    originalAssignmentId: string | null; 
    proposedWeekStructure: any; 
  };

  structuralAssignmentPayload?: {
    originalAssignmentId: string | null;
    proposedWeekStructure: any; 
  };

  menuUpdationPayload?: {
    menuId: string;
    menuStartDate: string;
    menuEndDate: string;
    changedCells: CellChange[];
  };
}

const approvalsCollection = collection(db, 'approval_requests')

export const approvalRequestsService = {
  /**
   * Submit a new approval request
   */
  add: async (data: Omit<ApprovalRequest, 'id' | 'requestedAt' | 'status'>) => {
    const payload = {
      ...data,
      status: 'PENDING' as ApprovalStatus,
      requestedAt: serverTimestamp(),
    }
    return await addDoc(approvalsCollection, payload)
  },

  /**
   * Update the status of a request (Approve/Reject)
   */
  updateStatus: async (id: string, status: ApprovalStatus, resolvedByUserId: string, vendorRemarks?: string) => {
    const docRef = doc(db, 'approval_requests', id)
    
    // FETCH FULL REQUEST TO PERFORM MERGE
    const snapshot = await getDoc(docRef)
    if (!snapshot.exists()) throw new Error("Request not found")
    const req = { id: snapshot.id, ...snapshot.data() } as ApprovalRequest
    
    // MERGE LOGIC FOR APPROVAL
    if (status === 'APPROVED') {
      if (req.targetType === 'MEAL_PLAN_STRUCTURE' && req.mealPlanStructurePayload) {
        const { originalAssignmentId, proposedWeekStructure } = req.mealPlanStructurePayload
        if (originalAssignmentId) {
          await updateDoc(doc(db, "mealPlanStructureAssignments", originalAssignmentId), {
            weekStructure: proposedWeekStructure,
            updatedAt: serverTimestamp()
          })
        } else {
          // fetch names
          const compSnap = await getDoc(doc(db, "companies", req.companyId))
          const buildSnap = req.buildingId ? await getDoc(doc(db, "buildings", req.buildingId)) : null
          await addDoc(collection(db, "mealPlanStructureAssignments"), {
            companyId: req.companyId,
            buildingId: req.buildingId,
            companyName: compSnap.exists() ? compSnap.data().name : '',
            buildingName: buildSnap?.exists() ? buildSnap.data().name : '',
            weekStructure: proposedWeekStructure,
            status: "active",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          })
        }
      } else if (req.targetType === 'STRUCTURAL_ASSIGNMENT' && req.structuralAssignmentPayload) {
        const { originalAssignmentId, proposedWeekStructure } = req.structuralAssignmentPayload
        if (originalAssignmentId) {
          await updateDoc(doc(db, "structureAssignments", originalAssignmentId), {
            weekStructure: proposedWeekStructure,
            updatedAt: serverTimestamp()
          })
        } else {
          const compSnap = await getDoc(doc(db, "companies", req.companyId))
          const buildSnap = req.buildingId ? await getDoc(doc(db, "buildings", req.buildingId)) : null
          await addDoc(collection(db, "structureAssignments"), {
            companyId: req.companyId,
            buildingId: req.buildingId,
            companyName: compSnap.exists() ? compSnap.data().name : '',
            buildingName: buildSnap?.exists() ? buildSnap.data().name : '',
            weekStructure: proposedWeekStructure,
            status: "active",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          })
        }
      }
      // Note: MENU_UPDATION is merged separately by the frontend before calling updateStatus
    }
    
    const payload: any = {
      status,
      resolvedByUserId,
      resolvedAt: serverTimestamp(),
    }
    if (vendorRemarks) {
      payload.vendorRemarks = vendorRemarks
    }
    return await updateDoc(docRef, payload)
  },

  /**
   * Fetch a single request by ID
   */
  getById: async (id: string): Promise<ApprovalRequest | null> => {
    const docRef = doc(db, 'approval_requests', id)
    const snapshot = await getDoc(docRef)
    if (snapshot.exists()) {
      return { id: snapshot.id, ...snapshot.data() } as ApprovalRequest
    }
    return null
  },

  /**
   * Fetch all pending requests for a specific vendor (optionally filtered by companyIds they are assigned to)
   */
  getPendingForVendor: async (vendorId: string, assignedCompanyIds?: string[]): Promise<ApprovalRequest[]> => {
    // If the vendor has assigned companies, we can fetch all pending requests for those companies
    let results: ApprovalRequest[] = [];
    
    if (assignedCompanyIds && assignedCompanyIds.length > 0) {
      // Because 'in' queries are limited to 10 elements in Firestore, we should chunk if needed
      // For simplicity here, we assume <= 10 companies assigned per vendor, or we fetch all and filter in memory
      const q = query(
        approvalsCollection,
        where("companyId", "in", assignedCompanyIds),
        where("status", "==", "PENDING")
      )
      const snapshot = await getDocs(q)
      results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ApprovalRequest))
    } else {
      // Fallback to strict vendorId check
      const q = query(
        approvalsCollection, 
        where("vendorId", "==", vendorId),
        where("status", "==", "PENDING")
      )
      const snapshot = await getDocs(q)
      results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ApprovalRequest))
    }
    
    // Sort descending by date locally
    results.sort((a, b) => {
      const timeA = a.requestedAt?.toMillis ? a.requestedAt.toMillis() : 0;
      const timeB = b.requestedAt?.toMillis ? b.requestedAt.toMillis() : 0;
      return timeB - timeA;
    });

    return results
  },

  getAllPending: async (): Promise<ApprovalRequest[]> => {
    const q = query(
      approvalsCollection,
      where("status", "==", "PENDING"),
      orderBy("requestedAt", "desc")
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ApprovalRequest))
  },

  /**
   * Fetch all pending requests made by a specific company
   */
  getPendingForCompany: async (companyId: string, targetType?: ApprovalTargetType): Promise<ApprovalRequest[]> => {
    let q = query(
      approvalsCollection, 
      where("companyId", "==", companyId),
      where("status", "==", "PENDING"),
      orderBy("requestedAt", "desc")
    )
    
    const snapshot = await getDocs(q)
    let results = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as ApprovalRequest))

    if (targetType) {
      results = results.filter(req => req.targetType === targetType)
    }

    return results
  },
  
  /**
   * Check if a specific entity has pending changes
   */
  hasPendingChanges: async (targetId: string, targetType: ApprovalTargetType): Promise<boolean> => {
    const q = query(
      approvalsCollection,
      where("targetId", "==", targetId),
      where("targetType", "==", targetType),
      where("status", "==", "PENDING")
    )
    const snapshot = await getDocs(q)
    return !snapshot.empty
  }
}
