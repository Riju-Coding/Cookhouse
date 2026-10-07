import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore"
import { DEFAULT_ATTENDANCE_SMTP_CONFIG } from "@/lib/attendance-email"

export const runtime = "nodejs"

export async function GET() {
  try {
    const docRef = doc(db, "settings", "attendance_email_settings")
    const snap = await getDoc(docRef)

    let settings = { ...DEFAULT_ATTENDANCE_SMTP_CONFIG }
    let lastShotDate = null
    let lastShotTimestamp = null
    let lastShotStatus = null

    if (snap.exists()) {
      const data = snap.data()
      settings = {
        host: data.smtpHost || DEFAULT_ATTENDANCE_SMTP_CONFIG.host,
        port: Number(data.smtpPort) || DEFAULT_ATTENDANCE_SMTP_CONFIG.port,
        secure: data.smtpSecure !== undefined ? Boolean(data.smtpSecure) : DEFAULT_ATTENDANCE_SMTP_CONFIG.secure,
        user: data.smtpUser || DEFAULT_ATTENDANCE_SMTP_CONFIG.user,
        pass: (data.smtpPass && data.smtpPass !== "ItCookhouse@!@#123") ? data.smtpPass : DEFAULT_ATTENDANCE_SMTP_CONFIG.pass,
        fromName: data.fromName || DEFAULT_ATTENDANCE_SMTP_CONFIG.fromName,
        fromEmail: data.fromEmail || DEFAULT_ATTENDANCE_SMTP_CONFIG.fromEmail,
        to: data.toEmails || DEFAULT_ATTENDANCE_SMTP_CONFIG.to,
        cc: data.ccEmails || DEFAULT_ATTENDANCE_SMTP_CONFIG.cc,
        autoShootEnabled: data.autoShootEnabled !== undefined ? Boolean(data.autoShootEnabled) : DEFAULT_ATTENDANCE_SMTP_CONFIG.autoShootEnabled,
        autoShootTime: data.autoShootTime || DEFAULT_ATTENDANCE_SMTP_CONFIG.autoShootTime,
      }
      lastShotDate = data.lastShotDate || null
      lastShotTimestamp = data.lastShotTimestamp || null
      lastShotStatus = data.lastShotStatus || null
    }

    // Fetch recent logs
    let logs: any[] = []
    try {
      const logsSnap = await getDocs(
        query(collection(db, "attendanceEmailLogs"), orderBy("timestamp", "desc"), limit(15))
      )
      logs = logsSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        timestamp: d.data().timestamp?.toDate ? d.data().timestamp.toDate().toISOString() : null,
      }))
    } catch (logErr) {
      console.warn("Could not query logs:", logErr)
    }

    return NextResponse.json({
      settings,
      lastShotDate,
      lastShotTimestamp,
      lastShotStatus,
      logs,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load SMTP settings" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      host,
      port,
      secure,
      user,
      pass,
      fromName,
      fromEmail,
      to,
      cc,
      autoShootEnabled,
      autoShootTime,
    } = body

    const docRef = doc(db, "settings", "attendance_email_settings")
    await setDoc(
      docRef,
      {
        smtpHost: host || DEFAULT_ATTENDANCE_SMTP_CONFIG.host,
        smtpPort: Number(port) || DEFAULT_ATTENDANCE_SMTP_CONFIG.port,
        smtpSecure: secure !== undefined ? Boolean(secure) : DEFAULT_ATTENDANCE_SMTP_CONFIG.secure,
        smtpUser: user || DEFAULT_ATTENDANCE_SMTP_CONFIG.user,
        smtpPass: pass || DEFAULT_ATTENDANCE_SMTP_CONFIG.pass,
        fromName: fromName || DEFAULT_ATTENDANCE_SMTP_CONFIG.fromName,
        fromEmail: fromEmail || DEFAULT_ATTENDANCE_SMTP_CONFIG.fromEmail,
        toEmails: to || DEFAULT_ATTENDANCE_SMTP_CONFIG.to,
        ccEmails: cc || DEFAULT_ATTENDANCE_SMTP_CONFIG.cc,
        autoShootEnabled: autoShootEnabled !== undefined ? Boolean(autoShootEnabled) : DEFAULT_ATTENDANCE_SMTP_CONFIG.autoShootEnabled,
        autoShootTime: autoShootTime || DEFAULT_ATTENDANCE_SMTP_CONFIG.autoShootTime,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    )

    return NextResponse.json({ success: true, message: "Settings saved successfully" })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to save SMTP settings" }, { status: 500 })
  }
}
