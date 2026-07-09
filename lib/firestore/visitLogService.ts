import { collection, doc, setDoc, updateDoc, query, where, getDocs, Timestamp, orderBy, addDoc } from 'firebase/firestore'
import { db } from '../firebase'

export interface VisitLog {
  id: string
  kamId: string
  kamName: string
  companyId: string
  companyName: string
  notes: string
  photos: string[]
  timestamp: Timestamp
  location?: { lat: number, lng: number }
}

const COLLECTION_NAME = 'visit_logs'

export const visitLogService = {
  async logVisit(data: Omit<VisitLog, 'id' | 'timestamp'>): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...data,
      timestamp: Timestamp.now()
    })
    return docRef.id
  },

  async getVisitLogsByKAM(kamId: string): Promise<VisitLog[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('kamId', '==', kamId),
      orderBy('timestamp', 'desc')
    )
    const snap = await getDocs(q)
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as VisitLog))
  },

  async getAllVisitLogs(): Promise<VisitLog[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('timestamp', 'desc')
    )
    const snap = await getDocs(q)
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as VisitLog))
  }
}
