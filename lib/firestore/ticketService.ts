import { collection, doc, updateDoc, query, where, getDocs, Timestamp, orderBy, addDoc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'

export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Critical'
export type TicketStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed'

export interface Ticket {
  id: string
  title: string
  description: string
  creatorId: string
  creatorName: string
  companyId: string
  companyName: string
  priority: TicketPriority
  status: TicketStatus
  photos: string[]
  createdAt: Timestamp
  updatedAt: Timestamp
  assigneeId?: string
  assigneeName?: string
  slaBreachAt: Timestamp
}

export interface TicketComment {
  id: string
  ticketId: string
  userId: string
  userName: string
  text: string
  photos?: string[]
  timestamp: Timestamp
}

const TICKETS_COLLECTION = 'tickets'
const COMMENTS_COLLECTION = 'ticket_comments'

const SLA_HOURS: Record<TicketPriority, number> = {
  'Low': 72,
  'Medium': 48,
  'High': 24,
  'Critical': 4
}

export const ticketService = {
  async createTicket(data: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt' | 'slaBreachAt' | 'status'>): Promise<string> {
    const now = Timestamp.now()
    const slaMs = SLA_HOURS[data.priority] * 60 * 60 * 1000
    const slaBreachAt = Timestamp.fromMillis(now.toMillis() + slaMs)

    const docRef = await addDoc(collection(db, TICKETS_COLLECTION), {
      ...data,
      status: 'Open',
      createdAt: now,
      updatedAt: now,
      slaBreachAt
    })
    return docRef.id
  },

  async updateTicketStatus(ticketId: string, status: TicketStatus, assigneeId?: string, assigneeName?: string): Promise<void> {
    const docRef = doc(db, TICKETS_COLLECTION, ticketId)
    const updateData: any = {
      status,
      updatedAt: Timestamp.now()
    }
    if (assigneeId && assigneeName) {
      updateData.assigneeId = assigneeId
      updateData.assigneeName = assigneeName
    }
    await updateDoc(docRef, updateData)
  },

  async addTicketComment(ticketId: string, userId: string, userName: string, text: string, photos: string[] = []): Promise<string> {
    const now = Timestamp.now()
    
    // Add comment
    const docRef = await addDoc(collection(db, COMMENTS_COLLECTION), {
      ticketId,
      userId,
      userName,
      text,
      photos,
      timestamp: now
    })

    // Update ticket timestamp
    await updateDoc(doc(db, TICKETS_COLLECTION, ticketId), {
      updatedAt: now
    })

    return docRef.id
  },

  async getTickets(companyId?: string): Promise<Ticket[]> {
    const constraints: any[] = [orderBy('createdAt', 'desc')]
    if (companyId) {
      constraints.unshift(where('companyId', '==', companyId))
    }
    const q = query(collection(db, TICKETS_COLLECTION), ...constraints)
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Ticket))
  },

  async getAssignedTickets(assigneeId: string): Promise<Ticket[]> {
    const q = query(collection(db, TICKETS_COLLECTION), where('assigneeId', '==', assigneeId), orderBy('createdAt', 'desc'))
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Ticket))
  },

  async getTicketComments(ticketId: string): Promise<TicketComment[]> {
    const q = query(collection(db, COMMENTS_COLLECTION), where('ticketId', '==', ticketId), orderBy('timestamp', 'asc'))
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as TicketComment))
  },

  async getTicketById(ticketId: string): Promise<Ticket | null> {
    const docRef = doc(db, TICKETS_COLLECTION, ticketId)
    const snap = await getDoc(docRef)
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as Ticket
    }
    return null
  }
}
