import { collection, doc, setDoc, updateDoc, query, where, getDocs, Timestamp, orderBy, limit, addDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { UAParser } from 'ua-parser-js'

export interface LoginSession {
  id: string
  userId: string
  userName: string
  roleKey: string
  loginAt: Timestamp
  logoutAt: Timestamp | null
  status: 'active' | 'idle' | 'ended'
  totalActiveMinutes: number
  totalIdleMinutes: number
  browserInfo: {
    browser: string
    os: string
    device: string
  }
  lastHeartbeat: Timestamp
  
  // Anti-fraud / Activity metrics
  activityScore: number // 0-100
  mouseMovements: number
  keystrokes: number
  tabFocusChanges: number
  idlePeriods: { start: Timestamp; end: Timestamp | null }[]
  selfies: { url: string; timestamp: Timestamp; verified: boolean }[]
  permissionStatus: {
    notification: 'granted' | 'denied' | 'default' | 'unsupported'
    camera: 'granted' | 'denied' | 'prompt' | 'unsupported'
    microphone: 'granted' | 'denied' | 'prompt' | 'unsupported'
    location: 'granted' | 'denied' | 'prompt' | 'unsupported'
  }
  permissionDenials: { permission: string; deniedAt: Timestamp }[]
  activeOsApp?: { title: string; ownerName: string } | null

  // Breaks
  activeBreak?: { name: string; startedAt: Timestamp; durationMinutes: number } | null
  completedBreaks?: { name: string; durationMinutes: number; actualMinutes: number }[]
}

const COLLECTION_NAME = 'login_sessions'

export const loginSessionService = {
  /**
   * Start a new login session
   */
  async startSession(userId: string, userName: string, roleKey: string): Promise<string> {
    // 1. Check if a session already exists for today
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const existingQuery = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId),
      orderBy('loginAt', 'desc'),
      limit(5)
    )
    
    try {
      const existingSnap = await getDocs(existingQuery)
      const activeSessions = existingSnap.docs.filter(doc => {
        const data = doc.data();
        if (data.status === 'ended') return false;
        
        // Check if it's from today
        const loginDate = data.loginAt?.toDate() || new Date(0);
        return loginDate >= startOfDay;
      })
      
      if (activeSessions.length > 0) {
        // Resume the most recent active session for today
        return activeSessions[0].id
      }
    } catch (err) {
      console.warn("Failed to query existing sessions, might need index or network issue:", err);
      // Fallback: we'll just create a new one if it fails
    }

    // 2. No active session today, create a new one
    const parser = new UAParser(window.navigator.userAgent)
    const browserInfo = {
      browser: `${parser.getBrowser().name || 'Unknown'} ${parser.getBrowser().version || ''}`.trim(),
      os: `${parser.getOS().name || 'Unknown'} ${parser.getOS().version || ''}`.trim(),
      device: `${parser.getDevice().vendor || ''} ${parser.getDevice().model || 'Desktop'}`.trim()
    }

    const newSession: Omit<LoginSession, 'id'> = {
      userId,
      userName,
      roleKey,
      loginAt: Timestamp.now(),
      logoutAt: null,
      status: 'active',
      totalActiveMinutes: 0,
      totalIdleMinutes: 0,
      browserInfo,
      lastHeartbeat: Timestamp.now(),
      activityScore: 100, // Starts at perfect
      mouseMovements: 0,
      keystrokes: 0,
      tabFocusChanges: 0,
      idlePeriods: [],
      selfies: [],
      permissionStatus: {
        notification: 'default',
        camera: 'prompt',
        microphone: 'prompt',
        location: 'prompt'
      },
      permissionDenials: [],
      activeOsApp: null,
      activeBreak: null,
      completedBreaks: []
    }

    const docRef = await addDoc(collection(db, COLLECTION_NAME), newSession)
    return docRef.id
  },

  /**
   * End an active session
   */
  async endSession(sessionId: string, finalMetrics?: Partial<LoginSession>) {
    if (!sessionId) return
    const docRef = doc(db, COLLECTION_NAME, sessionId)
    
    // Calculate final times on the server side ideally, but for now we'll do it client side
    // Actually the heartbeat will maintain the totals, we just mark it ended
    
    await updateDoc(docRef, {
      ...finalMetrics,
      status: 'ended',
      logoutAt: Timestamp.now(),
      lastHeartbeat: Timestamp.now()
    })
  },

  /**
   * Send periodic heartbeat with activity metrics
   */
  async heartbeat(sessionId: string, metrics: {
    status: 'active' | 'idle'
    mouseMovements: number
    keystrokes: number
    tabFocusChanges: number
    totalActiveMinutes: number
    totalIdleMinutes: number
    activityScore: number
    idlePeriods: { start: Timestamp; end: Timestamp | null }[]
    activeOsApp?: { title: string; ownerName: string } | null
  }) {
    if (!sessionId) return
    const docRef = doc(db, COLLECTION_NAME, sessionId)
    
    const updateData: any = {
      status: metrics.status,
      mouseMovements: metrics.mouseMovements,
      keystrokes: metrics.keystrokes,
      tabFocusChanges: metrics.tabFocusChanges,
      totalActiveMinutes: metrics.totalActiveMinutes,
      totalIdleMinutes: metrics.totalIdleMinutes,
      activityScore: metrics.activityScore,
      idlePeriods: metrics.idlePeriods,
      lastHeartbeat: Timestamp.now()
    }
    
    if (metrics.activeOsApp !== undefined) {
      updateData.activeOsApp = metrics.activeOsApp
    }
    
    await updateDoc(docRef, updateData)
  },

  /**
   * Add a selfie to the session
   */
  async submitSelfie(sessionId: string, photoUrl: string) {
    if (!sessionId) return
    const docRef = doc(db, COLLECTION_NAME, sessionId)
    
    // We need to get current selfies and append, or we can use arrayUnion if we weren't tracking full objects,
    // but since we need timestamp, let's fetch and update.
    // Actually, Firestore arrayUnion supports objects!
    import('firebase/firestore').then(({ arrayUnion }) => {
      updateDoc(docRef, {
        selfies: arrayUnion({
          url: photoUrl,
          timestamp: Timestamp.now(),
          verified: true
        })
      })
    })
  },

  /**
   * Start a break for the current session
   */
  async startBreak(sessionId: string, breakName: string, durationMinutes: number) {
    if (!sessionId) return
    const docRef = doc(db, COLLECTION_NAME, sessionId)
    
    await updateDoc(docRef, {
      activeBreak: {
        name: breakName,
        startedAt: Timestamp.now(),
        durationMinutes
      }
    })
  },

  /**
   * End the current break
   */
  async endBreak(sessionId: string, breakData: { name: string; startedAt: Timestamp; durationMinutes: number }) {
    if (!sessionId) return
    const docRef = doc(db, COLLECTION_NAME, sessionId)
    
    const actualMinutes = Math.round((new Date().getTime() - breakData.startedAt.toDate().getTime()) / 60000)

    import('firebase/firestore').then(({ arrayUnion }) => {
      updateDoc(docRef, {
        activeBreak: null,
        completedBreaks: arrayUnion({
          name: breakData.name,
          durationMinutes: breakData.durationMinutes,
          actualMinutes
        })
      })
    })
  },

  /**
   * Get active sessions today
   */
  async getActiveSessionsToday(): Promise<LoginSession[]> {
    // Start of today
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    
    const q = query(
      collection(db, COLLECTION_NAME),
      where('loginAt', '>=', Timestamp.fromDate(startOfDay)),
      orderBy('loginAt', 'desc'),
      limit(100)
    )
    
    const snap = await getDocs(q)
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LoginSession))
  },
  
  /**
   * Get sessions by user
   */
  async getSessionsByUser(userId: string, limitCount = 30): Promise<LoginSession[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId),
      orderBy('loginAt', 'desc'),
      limit(limitCount)
    )
    
    const snap = await getDocs(q)
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LoginSession))
  },

  /**
   * Update browser permission status for a session
   */
  async updatePermissionStatus(sessionId: string, permissionStatus: LoginSession['permissionStatus'], denials: { permission: string; deniedAt: Timestamp }[]) {
    if (!sessionId) return
    const docRef = doc(db, COLLECTION_NAME, sessionId)
    await updateDoc(docRef, {
      permissionStatus,
      ...(denials.length > 0 ? { permissionDenials: denials } : {})
    })
  },

  /**
   * Record deep OS activity (Electron desktop agent)
   */
  async recordDeepActivity(sessionId: string, data: { keystrokes: number, mouseClicks: number, timestamp: string, appInfo?: any }) {
    if (!sessionId) return;
    const docRef = doc(db, COLLECTION_NAME, sessionId);
    
    // Save granular log to a subcollection
    await addDoc(collection(docRef, 'activity_logs'), {
      ...data,
      serverTime: Timestamp.now()
    });
  },

  /**
   * Save a compressed screenshot (Electron desktop agent)
   */
  async saveScreenshot(sessionId: string, base64Image: string, timestamp: string) {
    if (!sessionId) return;
    const docRef = doc(db, COLLECTION_NAME, sessionId);
    
    await addDoc(collection(docRef, 'screenshots'), {
      image: base64Image,
      timestamp,
      serverTime: Timestamp.now()
    });
  }
}
