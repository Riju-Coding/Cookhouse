import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"
import { format } from "date-fns"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  try {
    const todayStr = format(new Date(), "yyyy-MM-dd")
    const docRef = doc(db, "settings", "attendance_email_settings")
    const snap = await getDoc(docRef)

    if (snap.exists()) {
      const data = snap.data()
      if (!data.autoShootEnabled) {
        return NextResponse.json({ message: "3:00 PM Auto-Shoot is currently disabled in settings." })
      }
      if (data.lastShotDate === todayStr && data.lastShotStatus === "success") {
        return NextResponse.json({ message: `Attendance email for ${todayStr} was already dispatched today.` })
      }
    }

    // Call internal shoot-mail POST endpoint
    const url = new URL("/api/attendance/shoot-mail", req.url)
    const shootRes = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: todayStr,
        triggeredBy: "cron_3pm",
      }),
    })

    const result = await shootRes.json()
    return NextResponse.json({
      cronExecution: "complete",
      result,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to execute 3:00 PM auto-shoot cron." },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
