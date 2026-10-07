import { format } from "date-fns"

export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  fromName: string
  fromEmail: string
  to: string
  cc: string
  autoShootEnabled: boolean
  autoShootTime: string
}

export const DEFAULT_ATTENDANCE_SMTP_CONFIG: SmtpConfig = {
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  user: "it-team@cookhouse.in",
  pass: "zbro qpdc plol gxzd",
  fromName: "Cookhouse IT Team",
  fromEmail: "it-team@cookhouse.in",
  to: "sanjiv@cookhouse.in",
  cc: "siddharth@cookhouse.in, bheem@cookhouse.in",
  autoShootEnabled: true,
  autoShootTime: "15:00",
}

export function parseTimestamp(ts: any): Date | null {
  if (!ts) return null
  if (ts instanceof Date) return isNaN(ts.getTime()) ? null : ts
  if (typeof ts.toDate === "function") {
    try {
      const d = ts.toDate()
      return isNaN(d.getTime()) ? null : d
    } catch {}
  }
  if (typeof ts.seconds === "number") {
    const d = new Date(ts.seconds * 1000)
    return isNaN(d.getTime()) ? null : d
  }
  if (typeof ts._seconds === "number") {
    const d = new Date(ts._seconds * 1000)
    return isNaN(d.getTime()) ? null : d
  }
  if (typeof ts === "string" || typeof ts === "number") {
    const d = new Date(ts)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

export function formatRecordDate(ts: any, pattern = "dd-MMM-yyyy"): string {
  const d = parseTimestamp(ts)
  if (!d) return "—"
  try {
    return format(d, pattern)
  } catch {
    return "—"
  }
}

export function formatRecordTime(ts: any, pattern = "hh:mm a"): string {
  const d = parseTimestamp(ts)
  if (!d) return "—"
  try {
    return format(d, pattern)
  } catch {
    return "—"
  }
}

export function isSameDay(ts: any, targetIsoDateStr: string): boolean {
  const d = parseTimestamp(ts)
  if (!d) return false
  try {
    return format(d, "yyyy-MM-dd") === targetIsoDateStr
  } catch {
    return false
  }
}
