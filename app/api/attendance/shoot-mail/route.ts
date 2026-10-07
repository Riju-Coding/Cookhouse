import { NextRequest, NextResponse } from "next/server"
import nodemailer from "nodemailer"
import ExcelJS from "exceljs"
import { format } from "date-fns"
import { db } from "@/lib/firebase"
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  doc,
  getDoc,
  setDoc,
  addDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore"
import {
  SmtpConfig,
  DEFAULT_ATTENDANCE_SMTP_CONFIG,
  parseTimestamp,
  formatRecordDate,
  formatRecordTime,
  isSameDay,
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const {
      isTest = false,
      date: reqDate,
      smtpSettings: customSmtp,
      records: clientRecords,
      companies: clientCompanies,
      triggeredBy = "manual",
    } = body

    // 1. Resolve SMTP config
    const storedConfig = await loadSmtpConfig()
    const config: SmtpConfig = {
      host: customSmtp?.host || storedConfig.host,
      port: Number(customSmtp?.port) || storedConfig.port,
      secure: customSmtp?.secure !== undefined ? Boolean(customSmtp?.secure) : storedConfig.secure,
      user: customSmtp?.user || storedConfig.user,
      pass: customSmtp?.pass || storedConfig.pass,
      fromName: customSmtp?.fromName || storedConfig.fromName,
      fromEmail: customSmtp?.fromEmail || storedConfig.fromEmail,
      to: customSmtp?.to || storedConfig.to,
      cc: customSmtp?.cc || storedConfig.cc,
      autoShootEnabled: customSmtp?.autoShootEnabled !== undefined ? Boolean(customSmtp?.autoShootEnabled) : storedConfig.autoShootEnabled,
      autoShootTime: customSmtp?.autoShootTime || storedConfig.autoShootTime,
    }

    const toList = parseEmails(config.to)
    const ccList = parseEmails(config.cc)

    if (toList.length === 0) {
      return NextResponse.json(
        { error: "No valid recipient email address specified." },
        { status: 400 }
      )
    }

    // 2. Setup Nodemailer Transporter
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465 ? true : config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    })

    // Test mode: simply verify credentials and optionally send a test ping
    if (isTest) {
      try {
        await transporter.verify()
      } catch (authErr: any) {
        let msg = authErr.message || "Failed to authenticate with SMTP server."
        if (msg.includes("534") || msg.includes("Application-specific password") || msg.includes("InvalidSecondFactor")) {
          msg = "Google Workspace requires a 16-character App Password when 2-Step Verification is active. Generate one at https://myaccount.google.com/apppasswords and paste it in the SMTP Password field."
        }
        return NextResponse.json({ success: false, error: msg }, { status: 400 })
      }

      // Send test ping email
      const testResult = await transporter.sendMail({
        from: `"${config.fromName}" <${config.fromEmail || config.user}>`,
        to: toList,
        cc: ccList.length > 0 ? ccList : undefined,
        subject: `[Test] Cookhouse Attendance SMTP Verification - ${new Date().toLocaleDateString()}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #15803d; color: white; padding: 20px; text-align: center;">
              <h2 style="margin: 0; font-size: 20px;">Cookhouse Admin SMTP Test</h2>
              <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 13px;">Google Workspace Connection Verified</p>
            </div>
            <div style="padding: 24px; color: #334155; line-height: 1.6;">
              <p>Hello,</p>
              <p>This is a test notification confirming that your <strong>Google Workspace SMTP configuration</strong> is working properly for sending daily attendance reports.</p>
              <div style="background-color: #f8fafc; border-left: 4px solid #15803d; padding: 12px; margin: 16px 0; font-size: 13px;">
                <div><strong>SMTP Host:</strong> ${config.host}:${config.port}</div>
                <div><strong>Sender Account:</strong> ${config.user}</div>
                <div><strong>Primary Recipient:</strong> ${config.to}</div>
                <div><strong>CC Recipients:</strong> ${config.cc || "None"}</div>
                <div><strong>Auto-Shoot Schedule:</strong> ${config.autoShootEnabled ? `Enabled at ${config.autoShootTime} daily` : "Disabled"}</div>
              </div>
              <p style="font-size: 12px; color: #64748b;">Dispatched at: ${new Date().toLocaleString("en-IN")}</p>
            </div>
          </div>
        `,
      })

      return NextResponse.json({
        success: true,
        message: `SMTP connection verified and test email sent to ${toList.join(", ")}!`,
        messageId: testResult.messageId,
      })
    }

    // 3. Normal Mode: Generate Attendance Report & Excel File
    const targetDate = reqDate ? new Date(reqDate) : new Date()
    const dayName = format(targetDate, "EEEE")
    const dateStr = format(targetDate, "dd MMM yyyy")
    const isoDateStr = format(targetDate, "yyyy-MM-dd")

    // Subject requirement: "making subject the day name and date"
    const emailSubject = `${dayName}, ${dateStr} - Daily Attendance Report (All Companies)`

    // Filter provided client records strictly by the selected date (only this day's attendance)
    let attendanceRecords = (clientRecords || []).filter((r: any) => isSameDay(r.timestamp, isoDateStr))

    // If no client records matched or none provided, query Firestore strictly for this specific date
    if (attendanceRecords.length === 0) {
      try {
        const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0)
        const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999)

        const attRef = collection(db, "attendance")
        const q = query(
          attRef,
          where("timestamp", ">=", Timestamp.fromDate(startOfDay)),
          where("timestamp", "<=", Timestamp.fromDate(endOfDay)),
          orderBy("timestamp", "desc")
        )
        const snap = await getDocs(q)
        attendanceRecords = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((r: any) => isSameDay(r.timestamp, isoDateStr))
      } catch (fetchErr) {
        console.warn("Could not query by date timestamp, falling back to query with local filter:", fetchErr)
        const attRef = collection(db, "attendance")
        const q = query(attRef, orderBy("timestamp", "desc"), limit(500))
        const snap = await getDocs(q)
        attendanceRecords = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((r: any) => isSameDay(r.timestamp, isoDateStr))
      }
    }

    // Sort records chronologically so punch logs are in order
    attendanceRecords.sort((a: any, b: any) => {
      const ta = parseTimestamp(a.timestamp)?.getTime() || 0
      const tb = parseTimestamp(b.timestamp)?.getTime() || 0
      return ta - tb
    })

    // Fetch companies if not provided
    let companiesList = clientCompanies || []
    if (!companiesList || companiesList.length === 0) {
      try {
        const cSnap = await getDocs(collection(db, "companies"))
        companiesList = cSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      } catch (cErr) {
        console.warn("Could not fetch companies list:", cErr)
      }
    }

    const companyMap = new Map<string, string>()
    companiesList.forEach((c: any) => {
      if (c.id && c.name) companyMap.set(c.id, c.name)
    })

    // Compute Metrics & Company Summary
    const checkIns = attendanceRecords.filter((r: any) => r.status === "IN").length
    const checkOuts = attendanceRecords.filter((r: any) => r.status === "OUT").length
    const uniqueUserIds = new Set(attendanceRecords.map((r: any) => r.userId)).size
    const mockLocationCount = attendanceRecords.filter((r: any) => r.mockLocation).length

    // Group by company and record punch timings
    const companySummary: Record<string, {
      companyName: string
      totalRecords: number
      checkIns: number
      checkOuts: number
      uniqueEmployees: Set<string>
      sites: Set<string>
      mockFlags: number
      firstInTime?: string
      lastOutTime?: string
      firstPunch?: Date
      lastPunch?: Date
      records: any[]
    }> = {}

    attendanceRecords.forEach((r: any) => {
      const cId = r.companyId || "unassigned"
      const cName = companyMap.get(cId) || r.companyName || (cId === "unassigned" ? "General / Unassigned" : cId)
      if (!companySummary[cId]) {
        companySummary[cId] = {
          companyName: cName,
          totalRecords: 0,
          checkIns: 0,
          checkOuts: 0,
          uniqueEmployees: new Set(),
          sites: new Set(),
          mockFlags: 0,
          records: [],
        }
      }
      companySummary[cId].totalRecords += 1
      if (r.status === "IN") companySummary[cId].checkIns += 1
      if (r.status === "OUT") companySummary[cId].checkOuts += 1
      if (r.userId) companySummary[cId].uniqueEmployees.add(r.userId)
      if (r.siteName) companySummary[cId].sites.add(r.siteName)
      if (r.mockLocation) companySummary[cId].mockFlags += 1
      companySummary[cId].records.push(r)

      const parsedDate = parseTimestamp(r.timestamp)
      if (parsedDate) {
        if (!companySummary[cId].firstPunch || parsedDate < companySummary[cId].firstPunch!) {
          companySummary[cId].firstPunch = parsedDate
        }
        if (!companySummary[cId].lastPunch || parsedDate > companySummary[cId].lastPunch!) {
          companySummary[cId].lastPunch = parsedDate
        }
      }
    })

    // Compute formatted timing strings for each company
    Object.values(companySummary).forEach(cs => {
      if (cs.firstPunch) {
        cs.firstInTime = format(cs.firstPunch, "hh:mm a")
      }
      if (cs.lastPunch) {
        cs.lastOutTime = format(cs.lastPunch, "hh:mm a")
      }
    })

    const companySummaryList = Object.values(companySummary).sort((a, b) => b.totalRecords - a.totalRecords)

    // 4. Generate Multi-Sheet Excel via ExcelJS
    const workbook = new ExcelJS.Workbook()
    workbook.creator = "Cookhouse Admin"
    workbook.lastModifiedBy = "Cookhouse IT System"
    workbook.created = new Date()
    workbook.modified = new Date()

    // ── SHEET 1: Summary Sheet ──────────────────────────
    const summarySheet = workbook.addWorksheet("Daily Executive Summary", {
      views: [{ showGridLines: true }],
    })

    // Title Block
    summarySheet.mergeCells("A1:G1")
    const titleCell = summarySheet.getCell("A1")
    titleCell.value = `COOKHOUSE ATTENDANCE REPORT — ${dayName.toUpperCase()}, ${dateStr.toUpperCase()}`
    titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } }
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF15803D" } }
    titleCell.alignment = { horizontal: "center", vertical: "middle" }
    summarySheet.getRow(1).height = 36

    // Key Stats Cards Row
    summarySheet.addRow([])
    summarySheet.addRow(["Metric", "Count", "Notes"])
    summarySheet.getRow(3).font = { bold: true, color: { argb: "FFFFFFFF" } }
    summarySheet.getRow(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF166534" } }
    summarySheet.getRow(3).height = 24

    const statRows = [
      ["Report Date", `${dayName}, ${dateStr}`, "Selected Attendance Date"],
      ["Report Generated At", format(new Date(), "hh:mm a (dd-MMM-yyyy)"), "System dispatch timestamp"],
      ["Total Check-Ins", checkIns, "Employee arrivals logged"],
      ["Total Check-Outs", checkOuts, "Employee departures logged"],
      ["Unique Employees", uniqueUserIds, "Distinct individuals on duty"],
      ["Active Companies", companySummaryList.length, "Companies with attendance activity today"],
      ["Mock GPS Flags", mockLocationCount, mockLocationCount > 0 ? "⚠️ Location spoofing alerts detected" : "All clean"],
    ]

    statRows.forEach(([m, c, n]) => {
      const row = summarySheet.addRow([m, c, n])
      row.height = 20
      row.getCell(2).alignment = { horizontal: "center" }
    })

    summarySheet.addRow([])
    summarySheet.addRow(["Company Breakdown", "", "", "", "", "", ""])
    const compHeaderRowIdx = summarySheet.rowCount
    summarySheet.mergeCells(`A${compHeaderRowIdx}:G${compHeaderRowIdx}`)
    const compHeaderCell = summarySheet.getCell(`A${compHeaderRowIdx}`)
    compHeaderCell.value = "COMPANY-WISE ATTENDANCE BREAKDOWN"
    compHeaderCell.font = { bold: true, color: { argb: "FFFFFFFF" } }
    compHeaderCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } }
    compHeaderCell.alignment = { horizontal: "left", vertical: "middle" }
    summarySheet.getRow(compHeaderRowIdx).height = 24

    const compTableHeaders = ["Company Name", "Total Records", "Check-Ins", "Check-Outs", "Unique Staff", "Timing Window", "Active Sites"]
    const compSubHeaderRow = summarySheet.addRow(compTableHeaders)
    compSubHeaderRow.font = { bold: true, size: 10, color: { argb: "FF334155" } }
    compSubHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } }
    compSubHeaderRow.height = 22

    companySummaryList.forEach((cs) => {
      const timeWindow = cs.firstInTime && cs.lastOutTime
        ? `${cs.firstInTime} – ${cs.lastOutTime}`
        : (cs.firstInTime || cs.lastOutTime || "—")
      const row = summarySheet.addRow([
        cs.companyName,
        cs.totalRecords,
        cs.checkIns,
        cs.checkOuts,
        cs.uniqueEmployees.size,
        timeWindow,
        Array.from(cs.sites).join(", ") || "—",
      ])
      row.height = 20
      row.getCell(2).alignment = { horizontal: "center" }
      row.getCell(3).alignment = { horizontal: "center" }
      row.getCell(4).alignment = { horizontal: "center" }
      row.getCell(5).alignment = { horizontal: "center" }
      row.getCell(6).alignment = { horizontal: "center" }
    })

    summarySheet.columns = [
      { width: 28 },
      { width: 16 },
      { width: 14 },
      { width: 14 },
      { width: 16 },
      { width: 24 },
      { width: 32 },
    ]

    // ── SHEET 2: All Records ────────────────────────────
    const allRecordsSheet = workbook.addWorksheet("All Records", {
      views: [{ state: "frozen", ySplit: 1, showGridLines: true }],
    })

    allRecordsSheet.columns = [
      { header: "Date", key: "date", width: 14 },
      { header: "Time", key: "time", width: 12 },
      { header: "Employee Name", key: "employee", width: 22 },
      { header: "Company", key: "company", width: 24 },
      { header: "Cafeteria / Site", key: "site", width: 24 },
      { header: "Status", key: "status", width: 14 },
      { header: "Distance", key: "distance", width: 14 },
      { header: "GPS Accuracy", key: "accuracy", width: 14 },
      { header: "Device ID", key: "device", width: 16 },
      { header: "Mock GPS Flag", key: "mock", width: 16 },
      { header: "Battery", key: "battery", width: 12 },
      { header: "Latitude", key: "latitude", width: 14 },
      { header: "Longitude", key: "longitude", width: 14 },
    ]

    const allHeaderRow = allRecordsSheet.getRow(1)
    allHeaderRow.height = 28
    allHeaderRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 }
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF15803D" } }
      cell.alignment = { vertical: "middle", horizontal: "center" }
    })

    attendanceRecords.forEach((r: any) => {
      const cName = companyMap.get(r.companyId) || r.companyName || r.companyId || "N/A"
      const row = allRecordsSheet.addRow({
        date: formatRecordDate(r.timestamp, "dd-MMM-yyyy"),
        time: formatRecordTime(r.timestamp, "hh:mm a"),
        employee: r.employeeName || "N/A",
        company: cName,
        site: r.siteName || "N/A",
        status: r.status === "IN" ? "Check In" : r.status === "OUT" ? "Check Out" : r.status,
        distance: r.distance != null ? (r.distance >= 1000 ? `${(r.distance / 1000).toFixed(1)}km` : `${Math.round(r.distance)}m`) : "—",
        accuracy: r.accuracy != null ? `±${Math.round(r.accuracy)}m` : "—",
        device: r.deviceId ? String(r.deviceId).substring(0, 12) : "—",
        mock: r.mockLocation ? "YES (Flagged)" : "No",
        battery: r.batteryLevel != null ? `${Math.round(r.batteryLevel * 100)}%` : "—",
        latitude: r.latitude ?? "",
        longitude: r.longitude ?? "",
      })

      row.height = 20
      if (r.mockLocation) {
        row.getCell("mock").font = { bold: true, color: { argb: "FFDC2626" } }
        row.getCell("mock").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } }
      }
    })

    // ── SHEET 3+: Company Specific Sheets ───────────────
    companySummaryList.forEach((cs) => {
      const cleanSheetName = (cs.companyName || "Company").replace(/[:\\/?*\[\]]/g, " ").substring(0, 31).trim()
      const cSheet = workbook.addWorksheet(cleanSheetName, {
        views: [{ state: "frozen", ySplit: 1, showGridLines: true }],
      })

      cSheet.columns = [
        { header: "Date", key: "date", width: 14 },
        { header: "Time", key: "time", width: 12 },
        { header: "Employee Name", key: "employee", width: 22 },
        { header: "Cafeteria / Site", key: "site", width: 24 },
        { header: "Status", key: "status", width: 14 },
        { header: "Distance", key: "distance", width: 14 },
        { header: "GPS Accuracy", key: "accuracy", width: 14 },
        { header: "Mock GPS", key: "mock", width: 14 },
        { header: "Battery", key: "battery", width: 12 },
      ]

      const hRow = cSheet.getRow(1)
      hRow.height = 26
      hRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 }
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } } // Deep Blue
        cell.alignment = { vertical: "middle", horizontal: "center" }
      })

      cs.records.forEach((r: any) => {
        const row = cSheet.addRow({
          date: formatRecordDate(r.timestamp, "dd-MMM-yyyy"),
          time: formatRecordTime(r.timestamp, "hh:mm a"),
          employee: r.employeeName || "N/A",
          site: r.siteName || "N/A",
          status: r.status === "IN" ? "Check In" : r.status === "OUT" ? "Check Out" : r.status,
          distance: r.distance != null ? (r.distance >= 1000 ? `${(r.distance / 1000).toFixed(1)}km` : `${Math.round(r.distance)}m`) : "—",
          accuracy: r.accuracy != null ? `±${Math.round(r.accuracy)}m` : "—",
          mock: r.mockLocation ? "Flagged" : "Normal",
          battery: r.batteryLevel != null ? `${Math.round(r.batteryLevel * 100)}%` : "—",
        })
        row.height = 20
      })
    })

    // Write Excel buffer
    const excelBuffer = await workbook.xlsx.writeBuffer()
    const fileName = `Attendance_Report_${isoDateStr}.xlsx`

    // 5. Construct HTML Email Body
    const companyTableRowsHtml = companySummaryList.map(cs => {
      const timeWindow = cs.firstInTime && cs.lastOutTime
        ? `${cs.firstInTime} – ${cs.lastOutTime}`
        : (cs.firstInTime || cs.lastOutTime || "—")
      return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px; font-weight: 600; color: #1e293b;">${cs.companyName}</td>
          <td style="padding: 10px; text-align: center; color: #475569;">${cs.totalRecords}</td>
          <td style="padding: 10px; text-align: center; color: #15803d; font-weight: 600;">${cs.checkIns}</td>
          <td style="padding: 10px; text-align: center; color: #2563eb;">${cs.checkOuts}</td>
          <td style="padding: 10px; text-align: center; color: #6b21a8; font-weight: 600;">${cs.uniqueEmployees.size}</td>
          <td style="padding: 10px; text-align: center; color: #0369a1; font-weight: 600; font-size: 12px; white-space: nowrap;">${timeWindow}</td>
          <td style="padding: 10px; color: #64748b; font-size: 12px;">${Array.from(cs.sites).join(", ") || "—"}</td>
        </tr>
      `
    }).join("")

    // Up to 50 punch log entries directly visible in the email body
    const emailDisplayRecords = attendanceRecords.slice(0, 50)
    const punchLogsRowsHtml = emailDisplayRecords.map((r: any) => {
      const pDate = formatRecordDate(r.timestamp, "dd-MMM-yyyy")
      const pTime = formatRecordTime(r.timestamp, "hh:mm a")
      const compName = companyMap.get(r.companyId) || r.companyName || (r.companyId === "unassigned" ? "General" : r.companyId || "—")
      const isCheckIn = r.status === "IN"
      return `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 8px 10px; font-size: 12px; color: #475569; white-space: nowrap;">${pDate}</td>
          <td style="padding: 8px 10px; font-size: 12px; font-weight: 700; color: #0f172a; white-space: nowrap;">${pTime}</td>
          <td style="padding: 8px 10px; font-size: 12px; font-weight: 600; color: #1e293b;">${r.employeeName || "N/A"}</td>
          <td style="padding: 8px 10px; font-size: 12px; color: #475569;">${compName}</td>
          <td style="padding: 8px 10px; font-size: 12px; color: #64748b;">${r.siteName || "—"}</td>
          <td style="padding: 8px 10px; text-align: center; font-size: 11px;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 600; background-color: ${isCheckIn ? '#dcfce7' : '#dbeafe'}; color: ${isCheckIn ? '#15803d' : '#1d4ed8'};">
              ${isCheckIn ? "Check In" : r.status === "OUT" ? "Check Out" : r.status}
            </span>
          </td>
        </tr>
      `
    }).join("")

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f1f5f9; color: #334155; }
          .container { max-width: 720px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, #15803d 0%, #166534 100%); color: #ffffff; padding: 28px 24px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
          .header p { margin: 6px 0 0 0; opacity: 0.9; font-size: 14px; }
          .content { padding: 24px; }
          .kpi-grid { display: table; width: 100%; margin-bottom: 24px; }
          .kpi-row { display: table-row; }
          .kpi-card { display: table-cell; width: 25%; text-align: center; padding: 14px 8px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
          .kpi-value { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
          .kpi-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px; }
          .table-container { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
          .table-header { background-color: #f1f5f9; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
          .table-header th { padding: 10px; border-bottom: 2px solid #cbd5e1; text-align: left; }
          .alert-box { background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; color: #991b1b; }
          .footer { background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; font-size: 11px; color: #64748b; text-align: center; }
          .badge-file { display: inline-block; background-color: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 6px; margin-top: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Daily Attendance Report</h1>
            <p><strong>${dayName}</strong>, ${dateStr} &bull; Cookhouse Enterprise Catering</p>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #bbf7d0;">Generated &amp; Dispatched: ${format(new Date(), "hh:mm a (EEEE, dd MMM yyyy)")}</p>
          </div>

          <div class="content">
            <p style="font-size: 14px; margin-top: 0; line-height: 1.5;">
              Dear Team,<br/><br/>
              Please find the daily attendance tracking report for <strong>${dayName}, ${dateStr}</strong> covering all active client company sites.
            </p>

            ${mockLocationCount > 0 ? `
              <div class="alert-box">
                <strong>⚠️ Location Flag Notice:</strong> ${mockLocationCount} record(s) flagged with simulated or mock GPS locations. Please inspect the attached workbook for details.
              </div>
            ` : ""}

            <!-- KPI Row -->
            <table style="width: 100%; border-spacing: 8px; margin-bottom: 20px;">
              <tr>
                <td style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; text-align: center; width: 25%;">
                  <div style="font-size: 22px; font-weight: 700; color: #15803d;">${checkIns}</div>
                  <div style="font-size: 11px; font-weight: 600; color: #166534; text-transform: uppercase;">Check-Ins</div>
                </td>
                <td style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px; text-align: center; width: 25%;">
                  <div style="font-size: 22px; font-weight: 700; color: #2563eb;">${checkOuts}</div>
                  <div style="font-size: 11px; font-weight: 600; color: #1e40af; text-transform: uppercase;">Check-Outs</div>
                </td>
                <td style="background-color: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 12px; text-align: center; width: 25%;">
                  <div style="font-size: 22px; font-weight: 700; color: #7e22ce;">${uniqueUserIds}</div>
                  <div style="font-size: 11px; font-weight: 600; color: #6b21a8; text-transform: uppercase;">Unique Staff</div>
                </td>
                <td style="background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 12px; text-align: center; width: 25%;">
                  <div style="font-size: 22px; font-weight: 700; color: #c2410c;">${companySummaryList.length}</div>
                  <div style="font-size: 11px; font-weight: 600; color: #9a3412; text-transform: uppercase;">Companies</div>
                </td>
              </tr>
            </table>

            <!-- Company Table -->
            <h3 style="font-size: 14px; font-weight: 700; margin: 20px 0 8px 0; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
              🏢 Company-Wise Summary Breakdown
            </h3>
            <table class="table-container">
              <thead>
                <tr class="table-header">
                  <th>Company</th>
                  <th style="text-align: center;">Total</th>
                  <th style="text-align: center;">In</th>
                  <th style="text-align: center;">Out</th>
                  <th style="text-align: center;">Staff</th>
                  <th style="text-align: center;">Timing Window</th>
                  <th>Locations</th>
                </tr>
              </thead>
              <tbody>
                ${companyTableRowsHtml || `<tr><td colspan="7" style="padding: 16px; text-align: center; color: #94a3b8;">No attendance records found for today.</td></tr>`}
              </tbody>
            </table>

            <!-- Detailed Punch Logs Table -->
            <h3 style="font-size: 14px; font-weight: 700; margin: 24px 0 8px 0; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
              🕒 Daily Punch Logs (${attendanceRecords.length} Records for ${dateStr})
            </h3>
            <table class="table-container">
              <thead>
                <tr class="table-header">
                  <th>Date</th>
                  <th>Time</th>
                  <th>Employee</th>
                  <th>Company</th>
                  <th>Cafeteria / Site</th>
                  <th style="text-align: center;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${punchLogsRowsHtml || `<tr><td colspan="6" style="padding: 16px; text-align: center; color: #94a3b8;">No punch records logged for this date.</td></tr>`}
              </tbody>
            </table>
            ${attendanceRecords.length > 50 ? `
              <div style="padding: 8px 12px; background-color: #f8fafc; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; border-radius: 0 0 6px 6px;">
                Showing first 50 entries. All <strong>${attendanceRecords.length}</strong> punches with complete GPS coordinates are included in the attached Excel spreadsheet.
              </div>
            ` : ""}

            <div style="margin-top: 24px; text-align: center;">
              <div class="badge-file">
                📊 Attached: <strong>${fileName}</strong> (Multi-Sheet Workbook)
              </div>
              <p style="font-size: 12px; color: #64748b; margin-top: 6px;">
                Includes executive summary with timing windows, master log, and dedicated worksheets for each company.
              </p>
            </div>
          </div>

          <div class="footer">
            <p style="margin: 0 0 4px 0;">This email was automatically generated and sent via <strong>Cookhouse Attendance Management System</strong>.</p>
            <p style="margin: 0; opacity: 0.7;">Sender: ${config.fromName} (${config.fromEmail || config.user}) &bull; Generated: ${new Date().toLocaleString("en-IN")}</p>
          </div>
        </div>
      </body>
      </html>
    `

    // 6. Send Mail via Nodemailer
    let sendResult: any = null
    try {
      sendResult = await transporter.sendMail({
        from: `"${config.fromName}" <${config.fromEmail || config.user}>`,
        to: toList,
        cc: ccList.length > 0 ? ccList : undefined,
        subject: emailSubject,
        html: htmlContent,
        attachments: [
          {
            filename: fileName,
            content: Buffer.from(excelBuffer),
            contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          },
        ],
      })
    } catch (sendErr: any) {
      console.error("Nodemailer send error:", sendErr)
      let errMsg = sendErr.message || "Failed to shoot email via SMTP."
      if (errMsg.includes("534") || errMsg.includes("Application-specific password") || errMsg.includes("InvalidSecondFactor")) {
        errMsg = "Google Workspace rejected authentication: 2-Step Verification is active on this account, requiring an App Password. Please generate a 16-character App Password at https://myaccount.google.com/apppasswords and enter it in the SMTP settings."
      }

      // Log failure in Firestore
      try {
        await addDoc(collection(db, "attendanceEmailLogs"), {
          timestamp: serverTimestamp(),
          date: isoDateStr,
          dayName,
          to: toList.join(", "),
          cc: ccList.join(", "),
          subject: emailSubject,
          recordsCount: attendanceRecords.length,
          companiesCount: companySummaryList.length,
          status: "failed",
          error: errMsg,
          triggeredBy,
        })
      } catch (logErr) {
        console.warn("Failed to write failure log:", logErr)
      }

      return NextResponse.json({ success: false, error: errMsg }, { status: 500 })
    }

    // 7. Log Success in Firestore
    try {
      await addDoc(collection(db, "attendanceEmailLogs"), {
        timestamp: serverTimestamp(),
        date: isoDateStr,
        dayName,
        to: toList.join(", "),
        cc: ccList.join(", "),
        subject: emailSubject,
        recordsCount: attendanceRecords.length,
        companiesCount: companySummaryList.length,
        status: "success",
        messageId: sendResult?.messageId,
        triggeredBy,
      })

      // Update last shot info in settings
      await setDoc(
        doc(db, "settings", "attendance_email_settings"),
        {
          lastShotDate: isoDateStr,
          lastShotTimestamp: serverTimestamp(),
          lastShotStatus: "success",
          lastShotError: null,
        },
        { merge: true }
      )
    } catch (saveErr) {
      console.warn("Failed to update Firestore attendance_email_settings doc:", saveErr)
    }

    return NextResponse.json({
      success: true,
      message: `Daily Attendance Report successfully emailed to ${toList.join(", ")}${ccList.length > 0 ? ` (cc: ${ccList.join(", ")})` : ""} with Excel attachment!`,
      messageId: sendResult?.messageId,
      summary: {
        date: isoDateStr,
        dayName,
        recordsCount: attendanceRecords.length,
        companiesCount: companySummaryList.length,
        checkIns,
        checkOuts,
        uniqueStaff: uniqueUserIds,
        mockFlags: mockLocationCount,
      },
    })
  } catch (err: any) {
    console.error("Unhandled error in shoot-mail route:", err)
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred while shooting attendance email." },
      { status: 500 }
    )
  }
}
