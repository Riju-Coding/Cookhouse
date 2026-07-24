import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { TechCandidate } from "@/lib/types"

const COLLECTION_NAME = "techCandidates"

export const techCandidatesService = {
  getAll: async (): Promise<TechCandidate[]> => {
    const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TechCandidate))
  },

  getByEmail: async (email: string): Promise<TechCandidate | null> => {
    const q = query(collection(db, COLLECTION_NAME), where("email", "==", email), where("status", "==", "pending"))
    const snapshot = await getDocs(q)
    if (!snapshot.empty) {
      const docData = snapshot.docs[0]
      return { id: docData.id, ...docData.data() } as TechCandidate
    }
    return null
  },

  getById: async (id: string): Promise<TechCandidate | null> => {
    const docRef = doc(db, COLLECTION_NAME, id)
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as TechCandidate
    }
    return null
  },

  create: async (data: Omit<TechCandidate, "id">): Promise<TechCandidate> => {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), data)
    return { ...data, id: docRef.id }
  },

  update: async (id: string, data: Partial<TechCandidate>): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, id)
    await updateDoc(docRef, data)
  },

  delete: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, id)
    await deleteDoc(docRef)
  }
}
