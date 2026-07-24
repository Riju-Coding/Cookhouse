import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { TechRound } from "@/lib/types"

const COLLECTION_NAME = "techRounds"

export const techRoundsService = {
  getAll: async (): Promise<TechRound[]> => {
    const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TechRound))
  },

  getById: async (id: string): Promise<TechRound | null> => {
    const docRef = doc(db, COLLECTION_NAME, id)
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as TechRound
    }
    return null
  },

  create: async (data: Omit<TechRound, "id">): Promise<TechRound> => {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), data)
    return { ...data, id: docRef.id }
  },

  update: async (id: string, data: Partial<TechRound>): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, id)
    await updateDoc(docRef, data)
  },

  delete: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, id)
    await deleteDoc(docRef)
  }
}
