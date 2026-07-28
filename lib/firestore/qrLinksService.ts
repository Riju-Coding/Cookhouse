import { collection, doc, addDoc, getDocs, deleteDoc, updateDoc, Timestamp, query, orderBy, getDoc } from 'firebase/firestore'
import { db } from '../firebase'

export interface QRLinkCustomization {
  headerText?: string;
  showCompanyName?: boolean;
  showBuildingName?: boolean;
  showTrackTicket?: boolean;
  issueCategories?: string[]; 
  submitButtonText?: string;
  feedbackFormHeaderText?: string;
  feedbackFormSubHeaderText?: string;
}

export interface QRLink {
  id: string
  companyId: string
  companyName: string
  buildingId: string
  buildingName: string
  cafeId: string
  cafeName: string
  createdAt: Timestamp
  createdBy: string
  createdByName: string
  requireName?: boolean
  requireEmail?: boolean
  requireEmployeeId?: boolean
  customization?: QRLinkCustomization
}

const QR_LINKS_COLLECTION = 'qr_links'

export const qrLinksService = {
  async create(data: Omit<QRLink, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, QR_LINKS_COLLECTION), {
      ...data,
      createdAt: Timestamp.now()
    })
    return docRef.id
  },

  async getAll(): Promise<QRLink[]> {
    const q = query(collection(db, QR_LINKS_COLLECTION), orderBy('createdAt', 'desc'))
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as QRLink))
  },

  async getById(id: string): Promise<QRLink | null> {
    const docRef = doc(db, QR_LINKS_COLLECTION, id)
    const snap = await getDoc(docRef)
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as QRLink
    }
    return null
  },

  async update(id: string, data: Partial<QRLink>): Promise<void> {
    await updateDoc(doc(db, QR_LINKS_COLLECTION, id), data)
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, QR_LINKS_COLLECTION, id))
  }
}
