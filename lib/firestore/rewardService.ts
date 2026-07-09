import { collection, addDoc, query, where, getDocs, Timestamp, orderBy, limit, doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore'
import { db } from '../firebase'

export type BadgeType = 'Gold Star' | 'Fast Solver' | 'Client Favorite' | 'Team Player'

export interface RewardTransaction {
  id: string
  kamId: string
  kamName: string
  managerId: string
  managerName: string
  ticketId?: string
  points: number
  badgeType?: BadgeType
  message: string
  timestamp: Timestamp
}

export interface UserStats {
  kamId: string
  kamName: string
  totalPoints: number
  badges: Record<string, number>
}

const REWARDS_COLLECTION = 'rewards'
const USER_STATS_COLLECTION = 'user_reward_stats'

export const rewardService = {
  async grantReward(data: Omit<RewardTransaction, 'id' | 'timestamp'>): Promise<string> {
    const now = Timestamp.now()
    
    // 1. Add transaction
    const docRef = await addDoc(collection(db, REWARDS_COLLECTION), {
      ...data,
      timestamp: now
    })

    // 2. Update user stats
    const statsRef = doc(db, USER_STATS_COLLECTION, data.kamId)
    const statsDoc = await getDoc(statsRef)
    
    if (statsDoc.exists()) {
      const updates: any = {
        totalPoints: increment(data.points)
      }
      if (data.badgeType) {
        updates[`badges.${data.badgeType}`] = increment(1)
      }
      await updateDoc(statsRef, updates)
    } else {
      const initialBadges: Record<string, number> = {}
      if (data.badgeType) {
        initialBadges[data.badgeType] = 1
      }
      await setDoc(statsRef, {
        kamId: data.kamId,
        kamName: data.kamName,
        totalPoints: data.points,
        badges: initialBadges
      })
    }

    return docRef.id
  },

  async getLeaderboard(limitCount = 10): Promise<UserStats[]> {
    const q = query(
      collection(db, USER_STATS_COLLECTION),
      orderBy('totalPoints', 'desc'),
      limit(limitCount)
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => d.data() as UserStats)
  },

  async getKamRewards(kamId: string): Promise<RewardTransaction[]> {
    const q = query(
      collection(db, REWARDS_COLLECTION),
      where('kamId', '==', kamId),
      orderBy('timestamp', 'desc')
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as RewardTransaction))
  }
}
