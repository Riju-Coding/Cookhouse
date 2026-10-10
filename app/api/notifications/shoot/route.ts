import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore"

export const runtime = "nodejs"

interface ShootRequestBody {
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

export async function POST(req: NextRequest) {
  try {
    const body: ShootRequestBody = await req.json()
    const {
      ticketId,
      title,
      description = "",
      companyId,
      companyName,
      buildingId = "",
      buildingName = "",
      cafeId = "",
      cafeName = "",
      category = "General",
      priority = "Medium",
      creatorName = "Public Guest",
    } = body

    if (!ticketId || !companyId) {
      return NextResponse.json({ error: "Missing required ticketId or companyId" }, { status: 400 })
    }

    // 1. Fetch active users to find who should receive this notification
    const usersSnap = await getDocs(collection(db, "users"))
    const eligibleUserIds: string[] = []
    const tokensSet = new Set<string>()

    usersSnap.docs.forEach((docSnap) => {
      const u = docSnap.data()
      if (u.status === "inactive") return

      // Permission check: if canViewTickets is explicitly false, skip
      if (u.canViewTickets === false) return

      let isEligible = false

      // Super Admins receive all notifications
      if (u.userType === "super_admin") {
        isEligible = true
      } else {
        // Check company match
        const userCompanyIds: string[] = Array.isArray(u.companyIds)
          ? u.companyIds
          : u.companyId
          ? [u.companyId]
          : []

        if (userCompanyIds.includes(companyId)) {
          // If user is restricted to specific cafeterias, check if cafeId matches
          if (Array.isArray(u.cafeteriaIds) && u.cafeteriaIds.length > 0) {
            if (!cafeId || u.cafeteriaIds.includes(cafeId)) {
              isEligible = true
            }
          } else {
            isEligible = true
          }
        }
      }

      if (isEligible) {
        eligibleUserIds.push(docSnap.id)

        // Collect push tokens
        if (u.devices && typeof u.devices === "object") {
          Object.values(u.devices).forEach((device: any) => {
            if (device?.pushToken && typeof device.pushToken === "string" && device.pushToken.trim()) {
              tokensSet.add(device.pushToken.trim())
            }
          })
        }
        if (u.fcmToken && typeof u.fcmToken === "string" && u.fcmToken.trim()) {
          tokensSet.add(u.fcmToken.trim())
        }
      }
    })

    const pushTokens = Array.from(tokensSet).filter((t) =>
      t.startsWith("ExponentPushToken") || t.startsWith("ExpoPushToken")
    )

    // 2. Write to Firestore `live_notifications` collection for instant realtime app delivery
    const notifTitle = `🎫 New Feedback: ${category}`
    const notifBody = `${cafeName ? cafeName + " · " : ""}${companyName}: ${title || description.substring(0, 100)}`

    const notifDocRef = await addDoc(collection(db, "live_notifications"), {
      type: "feedback_ticket",
      ticketId,
      title: notifTitle,
      body: notifBody,
      companyId,
      companyName,
      buildingId,
      buildingName,
      cafeId,
      cafeName,
      category,
      priority,
      creatorName,
      targetUserIds: eligibleUserIds,
      tokensCount: pushTokens.length,
      createdAt: serverTimestamp(),
      readBy: [],
    })

    // 3. Dispatch Push Notifications via Expo HTTP Push API
    let pushReceiptsCount = 0
    if (pushTokens.length > 0) {
      // Chunk push notifications into batches of 100
      const chunkSize = 100
      const messages = pushTokens.map((token) => ({
        to: token,
        sound: "default",
        title: notifTitle,
        body: notifBody,
        data: {
          type: "feedback_ticket",
          ticketId,
          companyId,
          cafeName,
          category,
          priority,
        },
        channelId: "default",
        priority: "high",
      }))

      for (let i = 0; i < messages.length; i += chunkSize) {
        const chunk = messages.slice(i, i + chunkSize)
        try {
          const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
              "Accept": "application/json",
              "Accept-Encoding": "gzip, deflate",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(chunk),
          })
          if (expoRes.ok) {
            pushReceiptsCount += chunk.length
          } else {
            const errText = await expoRes.text()
            console.error("Expo push notification send error:", errText)
          }
        } catch (pushErr) {
          console.error("Error dispatching chunk to Expo push API:", pushErr)
        }
      }
    }

    return NextResponse.json({
      success: true,
      notificationId: notifDocRef.id,
      recipientsCount: eligibleUserIds.length,
      tokensTargeted: pushTokens.length,
      tokensSent: pushReceiptsCount,
    })
  } catch (error: any) {
    console.error("Error in live notification shoot:", error)
    return NextResponse.json({ error: error.message || "Failed to shoot notification" }, { status: 500 })
  }
}
