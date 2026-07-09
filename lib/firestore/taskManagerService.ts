import { collection, doc, updateDoc, query, where, getDocs, Timestamp, orderBy, addDoc } from 'firebase/firestore'
import { db } from '../firebase'

export type DevTaskStatus = 'To Do' | 'In Progress' | 'Review' | 'Done'
export type DevTaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent'

export interface TaskTimelineEvent {
  id: string;
  type: 'status_change' | 'comment' | 'review';
  userId: string;
  userName: string;
  text?: string; // For comments/reviews
  oldStatus?: DevTaskStatus;
  newStatus?: DevTaskStatus;
  rating?: number; // 1-5 for reviews
  createdAt: Timestamp;
}

export interface SystemTask {
  id: string
  title: string
  description: string
  assigneeId: string
  assigneeName: string
  creatorId: string
  creatorName: string
  status: DevTaskStatus
  priority: DevTaskPriority
  timeline: TaskTimelineEvent[]
  dueDate?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}

const SYSTEM_TASKS_COLLECTION = 'system_tasks'

export const taskManagerService = {
  async createTask(data: Omit<SystemTask, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'timeline'>): Promise<string> {
    const now = Timestamp.now()
    const initialEvent: TaskTimelineEvent = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'status_change',
      userId: data.creatorId,
      userName: data.creatorName,
      newStatus: 'To Do',
      createdAt: now
    }
    const docRef = await addDoc(collection(db, SYSTEM_TASKS_COLLECTION), {
      ...data,
      status: 'To Do',
      timeline: [initialEvent],
      createdAt: now,
      updatedAt: now
    })
    return docRef.id
  },

  async updateTaskStatus(taskId: string, status: DevTaskStatus, oldStatus: DevTaskStatus, userId: string, userName: string): Promise<void> {
    const docRef = doc(db, SYSTEM_TASKS_COLLECTION, taskId)
    const now = Timestamp.now()
    
    // We use arrayUnion in a real scenario, but since we are replacing entire objects or using custom hooks,
    // let's fetch and update to ensure timeline ordering is easy, or just use arrayUnion
    import('firebase/firestore').then(({ arrayUnion }) => {
      updateDoc(docRef, {
        status,
        updatedAt: now,
        timeline: arrayUnion({
          id: Math.random().toString(36).substr(2, 9),
          type: 'status_change',
          userId,
          userName,
          oldStatus,
          newStatus: status,
          createdAt: now
        })
      })
    })
  },

  async addReviewOrComment(taskId: string, userId: string, userName: string, text: string, type: 'comment' | 'review', rating?: number): Promise<void> {
    const docRef = doc(db, SYSTEM_TASKS_COLLECTION, taskId)
    const now = Timestamp.now()
    
    import('firebase/firestore').then(({ arrayUnion }) => {
      const eventPayload: any = {
        id: Math.random().toString(36).substr(2, 9),
        type,
        userId,
        userName,
        text,
        createdAt: now
      };
      
      if (rating !== undefined) {
        eventPayload.rating = rating;
      }

      updateDoc(docRef, {
        updatedAt: now,
        timeline: arrayUnion(eventPayload)
      })
    })
  },

  async deleteTimelineEvent(taskId: string, eventId: string): Promise<void> {
    const docRef = doc(db, SYSTEM_TASKS_COLLECTION, taskId)
    const { getDoc } = await import('firebase/firestore')
    const snap = await getDoc(docRef)
    if (!snap.exists()) return

    const data = snap.data()
    const timeline = data.timeline || []
    const updatedTimeline = timeline.filter((e: any) => e.id !== eventId)

    await updateDoc(docRef, { timeline: updatedTimeline })
  },

  async getAllTasks(): Promise<SystemTask[]> {
    const q = query(collection(db, SYSTEM_TASKS_COLLECTION), orderBy('createdAt', 'desc'))
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as SystemTask))
  },

  async getTasksByAssignee(assigneeId: string): Promise<SystemTask[]> {
    const q = query(collection(db, SYSTEM_TASKS_COLLECTION), where('assigneeId', '==', assigneeId), orderBy('createdAt', 'desc'))
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as SystemTask))
  }
}
