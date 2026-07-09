import { collection, doc, setDoc, updateDoc, query, where, getDocs, Timestamp, orderBy, addDoc } from 'firebase/firestore'
import { db } from '../firebase'

export interface Reminder {
  id: string
  userId: string
  title: string
  description?: string
  dueDate: Timestamp
  completed: boolean
  createdAt: Timestamp
  targetCompanyId?: string
}

const COLLECTION_NAME = 'reminders'

export const reminderService = {
  async createReminder(data: Omit<Reminder, 'id' | 'createdAt' | 'completed'>): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...data,
      completed: false,
      createdAt: Timestamp.now()
    })
    return docRef.id
  },

  async getReminders(userId: string, includeCompleted = false): Promise<Reminder[]> {
    const constraints: any[] = [
      where('userId', '==', userId)
    ]
    if (!includeCompleted) {
      constraints.push(where('completed', '==', false))
    }
    
    // Note: Due to composite index requirements, we might just order client-side if we filter by completed,
    // or we can sort by dueDate if we create the composite index in Firebase.
    // For now we'll fetch and sort client side to avoid missing index errors.
    
    const q = query(collection(db, COLLECTION_NAME), ...constraints)
    const snap = await getDocs(q)
    const reminders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reminder))
    
    return reminders.sort((a, b) => a.dueDate.seconds - b.dueDate.seconds)
  },

  async markCompleted(reminderId: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, reminderId)
    await updateDoc(docRef, { completed: true })
  }
}
