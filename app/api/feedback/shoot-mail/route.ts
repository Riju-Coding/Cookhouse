import { NextRequest, NextResponse } from "next/server"
import nodemailer from "nodemailer"
import { db } from "@/lib/firebase"
import {
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore"
import {
  SmtpConfig,
  DEFAULT_ATTENDANCE_SMTP_CONFIG,
} from "@/lib/attendance-email"

export const runtime = "nodejs"

async function loadSmtpConfig(): Promise<SmtpConfig> {
  try {
    const docRef = doc(db, "settings", "attendance_email_settings")
    const snap = await getDoc(docRef)
    if (snap.exists()) {
      const data = snap.data()
      return {
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
    }
  } catch (err) {
    console.warn("Could not load stored SMTP config, using defaults:", err)
  }
  return DEFAULT_ATTENDANCE_SMTP_CONFIG
}

function parseEmails(str: string): string[] {
  if (!str) return []
  return str
    .split(/[,;\n]/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && s.includes("@"))
}

interface FeedbackMailPayload {
  ticketId: string
  title?: string
  description?: string
  category: string // The department name
  companyId: string
  companyName: string
  buildingName?: string
  cafeName?: string
  priority?: string
  creatorName?: string
  creatorEmail?: string
  photos?: string[]
}

export async function POST(req: NextRequest) {
  try {
    const body: FeedbackMailPayload = await req.json()
    const {
      ticketId,
      title,
      description = "",
      category = "General Feedback",
      companyId,
      companyName,
      buildingName = "",
      cafeName = "",
      priority = "Medium",
      creatorName = "Anonymous Diner",
      photos = [],
    } = body

    if (!ticketId || !companyId) {
      return NextResponse.json({ error: "Missing required ticketId or companyId" }, { status: 400 })
    }

    // 1. Load SMTP configuration
    const smtpConfig = await loadSmtpConfig()

    // 2. Fetch Users and find Department Recipients
    const usersSnap = await getDocs(collection(db, "users"))
    const recipientEmails = new Set<string>()
    const matchedUsers: { id: string; name: string; email: string; departments: string[] }[] = []

    usersSnap.docs.forEach((docSnap) => {
      const u = docSnap.data()
      if (u.status === "inactive") return
      if (!u.email || !u.email.includes("@")) return

      const userDepartments: string[] = Array.isArray(u.departments) ? u.departments : []
      const receiveEmails = u.receiveFeedbackEmails === true

      // Super Admins who enabled emails or without department lock
      const isSuperAdmin = u.userType === "super_admin"

      // Check Company Scope
      const userCompanyIds: string[] = Array.isArray(u.companyIds)
        ? u.companyIds
        : u.companyId
        ? [u.companyId]
        : []
      const companyMatches = isSuperAdmin || userCompanyIds.length === 0 || userCompanyIds.includes(companyId)

      if (!companyMatches) return

      // Department Match
      // Case-insensitive comparison between feedback category and user assigned departments
      const deptMatches = userDepartments.some(
        dept => dept.trim().toLowerCase() === category.trim().toLowerCase()
      )

      // If user has receiveFeedbackEmails enabled AND their department matches
      if (receiveEmails && deptMatches) {
        recipientEmails.add(u.email.trim())
        matchedUsers.push({
          id: docSnap.id,
          name: u.name || "Manager",
          email: u.email.trim(),
          departments: userDepartments,
        })
      }
    })

    // If no specific department users matched, fallback to system administrators configured in SMTP settings
    let usedFallback = false
    if (recipientEmails.size === 0) {
      const fallbackList = parseEmails(smtpConfig.to)
      fallbackList.forEach(email => recipientEmails.add(email))
      usedFallback = true
    }

    if (recipientEmails.size === 0) {
      console.warn(`[Feedback Mail] No department recipients or fallback email found for department: "${category}"`)
      return NextResponse.json({
        success: false,
        message: `No recipients configured for department: "${category}"`,
      })
    }

    // 3. Setup Nodemailer Transporter
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.port === 465 ? true : smtpConfig.secure,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    })

    // Priority Colors
    const priorityColors: Record<string, { bg: string; text: string; border: string }> = {
      Critical: { bg: "#FEF2F2", text: "#DC2626", border: "#FCA5A5" },
      High: { bg: "#FFF7ED", text: "#EA580C", border: "#FDBA74" },
      Medium: { bg: "#EFF6FF", text: "#2563EB", border: "#BFDBFE" },
      Low: { bg: "#ECFDF5", text: "#059669", border: "#A7F3D0" },
    }
    const prioColor = priorityColors[priority] || priorityColors.Medium

    const emailSubject = `[Cookhouse Alert • ${category}] New Feedback Ticket #${ticketId.slice(0, 8)} - ${companyName}`

    // Render HTML Email
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Feedback Escalation</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <div style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    
    <!-- Top Branded Banner -->
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 28px 24px; text-align: left; border-bottom: 3px solid #10b981;">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div>
          <span style="display: inline-block; padding: 4px 10px; background-color: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #34d399; font-size: 11px; font-weight: 700; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">
            Department Escalation Notice
          </span>
          <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; line-height: 1.3;">
            ${category} Feedback
          </h1>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8;">
            Ticket #${ticketId} • Logged via Dining Portal
          </p>
        </div>
      </div>
    </div>

    <!-- Facility & Department Summary Box -->
    <div style="padding: 24px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 6px 0; font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; width: 35%;">Assigned Department:</td>
          <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: 700;">
            <span style="display: inline-block; padding: 2px 8px; background-color: #ede9fe; color: #6d28d9; border-radius: 6px; font-size: 12px; font-weight: 700;">
              🏷️ ${category}
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase;">Facility / Company:</td>
          <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: 600;">
            🏢 ${companyName}
          </td>
        </tr>
        ${buildingName ? `
        <tr>
          <td style="padding: 6px 0; font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase;">Building Wing:</td>
          <td style="padding: 6px 0; font-size: 14px; color: #0f172a;">
            📍 ${buildingName}
          </td>
        </tr>
        ` : ""}
        ${cafeName ? `
        <tr>
          <td style="padding: 6px 0; font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase;">Cafeteria / Outlet:</td>
          <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: 600;">
            🍽️ ${cafeName}
          </td>
        </tr>
        ` : ""}
        <tr>
          <td style="padding: 6px 0; font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase;">Priority / SLA:</td>
          <td style="padding: 6px 0;">
            <span style="display: inline-block; padding: 3px 10px; background-color: ${prioColor.bg}; color: ${prioColor.text}; border: 1px solid ${prioColor.border}; border-radius: 6px; font-size: 12px; font-weight: 700;">
              ● ${priority} Priority
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase;">Reporter:</td>
          <td style="padding: 6px 0; font-size: 13px; color: #334155;">
            👤 ${creatorName}
          </td>
        </tr>
      </table>
    </div>

    <!-- Feedback Body -->
    <div style="padding: 24px;">
      <h3 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.03em;">
        Complaint & Feedback Details
      </h3>
      
      <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #334155; white-space: pre-wrap;">
${description || title || "No additional written description."}
        </p>
      </div>

      ${photos && photos.length > 0 ? `
      <div style="margin-bottom: 24px;">
        <h4 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #475569; text-transform: uppercase;">
          Attached Photos (${photos.length})
        </h4>
        <div style="display: flex; flex-wrap: wrap; gap: 10px;">
          ${photos.map((p, i) => `
            <a href="${p}" target="_blank" style="display: inline-block; text-decoration: none;">
              <img src="${p}" alt="Photo ${i + 1}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px; border: 2px solid #e2e8f0;" />
            </a>
          `).join("")}
        </div>
      </div>
      ` : ""}

      <!-- Action Box -->
      <div style="background-color: #f1f5f9; border-radius: 12px; padding: 16px; text-align: center; border: 1px solid #e2e8f0;">
        <p style="margin: 0 0 12px 0; font-size: 13px; color: #475569;">
          You are receiving this notification because you are assigned to the <strong>${category}</strong> department.
        </p>
        <div>
          <a href="https://app.cookhouse.in/admin/ticketing" style="display: inline-block; padding: 10px 20px; background-color: #059669; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 13px; border-radius: 8px; margin-right: 8px;">
            Open in Cookhouse Admin
          </a>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; font-size: 11px; color: #94a3b8;">
      <p style="margin: 0;">Cookhouse Automated Department Notification Service</p>
      <p style="margin: 4px 0 0 0;">This email was securely delivered using the Cookhouse operational SMTP gateway.</p>
    </div>

  </div>
</body>
</html>
    `.trim()

    const toAddresses = Array.from(recipientEmails)

    // Send Mail
    const sendResult = await transporter.sendMail({
      from: `"${smtpConfig.fromName}" <${smtpConfig.fromEmail || smtpConfig.user}>`,
      to: toAddresses,
      subject: emailSubject,
      html: htmlContent,
    })

    // Log to Firestore
    try {
      await addDoc(collection(db, "feedbackEmailLogs"), {
        ticketId,
        category,
        companyId,
        companyName,
        recipients: toAddresses,
        usedFallback,
        matchedUsersCount: matchedUsers.length,
        messageId: sendResult.messageId,
        timestamp: serverTimestamp(),
        status: "success",
      })
    } catch (logErr) {
      console.warn("Could not record feedbackEmailLogs:", logErr)
    }

    return NextResponse.json({
      success: true,
      recipients: toAddresses,
      matchedUsersCount: matchedUsers.length,
      usedFallback,
      messageId: sendResult.messageId,
    })
  } catch (error: any) {
    console.error("Feedback email shooting error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to shoot feedback email" },
      { status: 500 }
    )
  }
}
