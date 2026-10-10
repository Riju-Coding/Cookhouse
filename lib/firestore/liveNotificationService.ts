import { collection, addDoc, serverTimestamp, query, where, orderBy, limit, onSnapshot, Timestamp } from "firebase/firestore"
import { db } from "../firebase"

export interface LiveNotificationPayload {
  ticketId: string
  title: string
  description?: string
  companyId: string
  companyName: string
  buildingId?: string
  buildingName?: string
  cafeId?: string
  cafeName?: string
  category?: string
  priority?: string
  creatorName?: string
}

export interface LiveNotificationItem {
  id: string
  type: string
  ticketId: string
  title: string
  body: string
  companyId: string
  companyName: string
  buildingName?: string
  cafeId?: string
  cafeName?: string
  category?: string
  priority?: string
  creatorName?: string
  createdAt?: Timestamp
  targetUserIds?: string[]
}

export const liveNotificationService = {
  /**
   * Shoot a live notification across mobile devices (Expo Push) and realtime in-app listeners.
   */
  async shootTicketNotification(data: LiveNotificationPayload): Promise<{ success: boolean; notificationId?: string }> {
    try {
      // Trigger the server API route which dispatches Expo push notifications and saves live_notifications
      const res = await fetch("/api/notifications/shoot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        const json = await res.json()
        return { success: true, notificationId: json.notificationId }
      } else {
        console.warn("API route shoot failed, falling back to direct Firestore record:", await res.text())
      }
    } catch (apiErr) {
      console.warn("Network error reaching /api/notifications/shoot, saving to Firestore fallback:", apiErr)
    }

    // Direct Firestore fallback
    try {
      const notifDocRef = await addDoc(collection(db, "live_notifications"), {
        type: "feedback_ticket",
        ticketId: data.ticketId,
        title: `🎫 New Feedback: ${data.category || "General"}`,
        body: `${data.cafeName ? data.cafeName + " · " : ""}${data.companyName}: ${data.title || (data.description || "").substring(0, 100)}`,
        companyId: data.companyId,
        companyName: data.companyName,
        buildingId: data.buildingId || "",
        buildingName: data.buildingName || "",
        cafeId: data.cafeId || "",
        cafeName: data.cafeName || "",
        category: data.category || "General",
        priority: data.priority || "Medium",
        creatorName: data.creatorName || "Public Guest",
        createdAt: serverTimestamp(),
        readBy: [],
      })
      return { success: true, notificationId: notifDocRef.id }
    } catch (fallbackErr) {
      console.error("Direct fallback failed to save live notification:", fallbackErr)
      return { success: false }
    }
  },

  /**
   * Subscribe to recent live notifications in realtime.
   */
  subscribe(callback: (notifications: LiveNotificationItem[]) => void) {
    const q = query(
      collection(db, "live_notifications"),
      orderBy("createdAt", "desc"),
      limit(20)
    )

    return onSnapshot(q, (snapshot) => {
      const items: LiveNotificationItem[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }))
      callback(items)
    })
  },
}
