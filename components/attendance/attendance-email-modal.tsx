"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"
import {
  Mail,
  Send,
  Settings,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Loader2,
  RefreshCw,
  FileSpreadsheet,
  Eye,
  EyeOff,
  Building2,
  Calendar,
  Users,
  ExternalLink,
  History,
} from "lucide-react"
import { format } from "date-fns"
import { isSameDay, formatRecordDate, formatRecordTime } from "@/lib/attendance-email"

interface SmtpSettings {
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

const DEFAULT_SETTINGS: SmtpSettings = {
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

interface AttendanceEmailModalProps {
  open: boolean
  onClose: () => void
  records: any[]
  companies: any[]
  initialTab?: "shoot" | "settings" | "history"
  onMailSent?: () => void
}

export function AttendanceEmailModal({
  open,
  onClose,
  records,
  companies,
  initialTab = "shoot",
  onMailSent,
}: AttendanceEmailModalProps) {
  const [activeTab, setActiveTab] = useState<string>(initialTab)
  const [settings, setSettings] = useState<SmtpSettings>(DEFAULT_SETTINGS)
  const [showPassword, setShowPassword] = useState(false)
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [testingSmtp, setTestingSmtp] = useState(false)
  const [shootingMail, setShootingMail] = useState(false)
  const [lastShotInfo, setLastShotInfo] = useState<{
    date: string | null
    timestamp: string | null
    status: string | null
  }>({ date: null, timestamp: null, status: null })
  const [emailLogs, setEmailLogs] = useState<any[]>([])

  // Shoot form state overrides
  const [shootDate, setShootDate] = useState(() => format(new Date(), "yyyy-MM-dd"))
  const [shootTo, setShootTo] = useState(DEFAULT_SETTINGS.to)
  const [shootCc, setShootCc] = useState(DEFAULT_SETTINGS.cc)

  // Load saved settings & logs
  const loadSettings = useCallback(async () => {
    setLoadingSettings(true)
    try {
      const res = await fetch("/api/attendance/smtp-settings")
      const data = await res.json()
      if (data.settings) {
        const loadedPass = (!data.settings.pass || data.settings.pass === "ItCookhouse@!@#123")
          ? DEFAULT_SETTINGS.pass
          : data.settings.pass
        setSettings({ ...data.settings, pass: loadedPass })
        setShootTo(data.settings.to || DEFAULT_SETTINGS.to)
        setShootCc(data.settings.cc || DEFAULT_SETTINGS.cc)
      }
      setLastShotInfo({
        date: data.lastShotDate,
        timestamp: data.lastShotTimestamp,
        status: data.lastShotStatus,
      })
      if (data.logs) {
        setEmailLogs(data.logs)
      }
    } catch (err: any) {
      console.warn("Could not load settings:", err)
    } finally {
      setLoadingSettings(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab)
      loadSettings()
    }
  }, [open, initialTab, loadSettings])

  // Save Settings
  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      const res = await fetch("/api/attendance/smtp-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      const result = await res.json()
      if (!res.ok || result.error) {
        throw new Error(result.error || "Failed to save settings")
      }
      toast({
        title: "Settings Saved ✅",
        description: "Google Workspace SMTP and 3:00 PM auto-shoot settings updated.",
      })
      setShootTo(settings.to)
      setShootCc(settings.cc)
    } catch (err: any) {
      toast({
        title: "Save Failed",
        description: err.message,
        variant: "destructive",
      })
    } finally {
      setSavingSettings(false)
    }
  }

  // Test SMTP Connection
  const handleTestSmtp = async () => {
    setTestingSmtp(true)
    try {
      const res = await fetch("/api/attendance/shoot-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isTest: true,
          smtpSettings: settings,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "SMTP test failed")
      }
      toast({
        title: "SMTP Verified Successfully 🎉",
        description: data.message || "Test email dispatched to " + settings.to,
      })
    } catch (err: any) {
      toast({
        title: "SMTP Authentication Issue",
        description: err.message,
        variant: "destructive",
      })
    } finally {
      setTestingSmtp(false)
    }
  }

  // Shoot Daily Attendance Email Now
  const handleShootMailNow = async () => {
    setShootingMail(true)
    try {
      const res = await fetch("/api/attendance/shoot-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: shootDate,
          records: dayRecords,
          companies,
          smtpSettings: {
            ...settings,
            to: shootTo,
            cc: shootCc,
          },
          triggeredBy: "manual_modal",
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to shoot email")
      }
      toast({
        title: "Attendance Email Dispatched! ✉️",
        description: data.message,
      })
      loadSettings()
      if (onMailSent) onMailSent()
      onClose()
    } catch (err: any) {
      toast({
        title: "Failed to Shoot Email",
        description: err.message,
        variant: "destructive",
      })
    } finally {
      setShootingMail(false)
    }
  }

  // Date preview details
  const parsedTargetDate = new Date(shootDate)
  const dayName = isNaN(parsedTargetDate.getTime()) ? "" : format(parsedTargetDate, "EEEE")
  const dateFormatted = isNaN(parsedTargetDate.getTime()) ? "" : format(parsedTargetDate, "dd MMM yyyy")
  const subjectPreview = `${dayName}, ${dateFormatted} - Daily Attendance Report (All Companies)`

  // Filter records strictly for the selected shootDate
  const dayRecords = React.useMemo(() => {
    return (records || []).filter((r) => isSameDay(r.timestamp, shootDate))
  }, [records, shootDate])

  const activeCompaniesCount = React.useMemo(() => {
    return new Set(dayRecords.map((r) => r.companyId).filter(Boolean)).size
  }, [dayRecords])

  const totalEmployeesCount = React.useMemo(() => {
    return new Set(dayRecords.map((r) => r.userId).filter(Boolean)).size
  }, [dayRecords])

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white p-0">
        <DialogHeader className="p-5 bg-gradient-to-r from-green-800 to-emerald-900 text-white border-b border-green-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-white/10 rounded-lg backdrop-blur-xs">
                <Mail className="w-5 h-5 text-green-300" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  Daily Attendance Email Service
                </DialogTitle>
                <DialogDescription className="text-xs text-green-200 mt-0.5">
                  Google Workspace SMTP integration &amp; 3:00 PM auto-shoot dispatcher
                </DialogDescription>
              </div>
            </div>
            {settings.autoShootEnabled && (
              <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/40 text-[10px] font-semibold gap-1 px-2.5 py-1">
                <Clock className="w-3 h-3" /> Auto-Shoot: {settings.autoShootTime}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="p-5">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-3 mb-4 bg-slate-100">
              <TabsTrigger value="shoot" className="gap-1.5 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-green-800">
                <Send className="w-3.5 h-3.5 text-green-600" /> Shoot Mail Now
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-1.5 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-green-800">
                <Settings className="w-3.5 h-3.5 text-slate-600" /> SMTP &amp; 3 PM Schedule
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-green-800">
                <History className="w-3.5 h-3.5 text-purple-600" /> Dispatch Logs
              </TabsTrigger>
            </TabsList>

            {/* ══ TAB 1: SHOOT MAIL NOW ══ */}
            <TabsContent value="shoot" className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 bg-slate-50 border rounded-lg text-center">
                  <div className="text-xs text-slate-500 font-medium">Report Date</div>
                  <div className="text-sm font-bold text-slate-800 mt-0.5">{dayName || "Today"}</div>
                  <div className="text-[11px] text-slate-500">{dateFormatted}</div>
                </div>
                <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-lg text-center">
                  <div className="text-xs text-emerald-700 font-medium">Companies</div>
                  <div className="text-lg font-bold text-emerald-900 mt-0.5">{activeCompaniesCount} Available</div>
                  <div className="text-[11px] text-emerald-600">Company-wise sheets included</div>
                </div>
                <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-lg text-center">
                  <div className="text-xs text-indigo-700 font-medium">Staff &amp; Logs</div>
                  <div className="text-lg font-bold text-indigo-900 mt-0.5">{dayRecords.length} Records</div>
                  <div className="text-[11px] text-indigo-600">
                    {dayRecords.length > 0 ? `${totalEmployeesCount} unique staff logged` : "Selected day only"}
                  </div>
                </div>
              </div>

              {/* Form Controls */}
              <div className="space-y-3 bg-white p-3.5 border rounded-lg shadow-2xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">📅 Attendance Date</Label>
                    <Input
                      type="date"
                      value={shootDate}
                      onChange={(e) => setShootDate(e.target.value)}
                      className="h-8 text-xs bg-slate-50"
                    />
                    <div className="text-[10px]">
                      {dayRecords.length > 0 ? (
                        <span className="text-emerald-700 font-semibold">✓ {dayRecords.length} punches selected for this day only</span>
                      ) : (
                        <span className="text-amber-700">0 loaded punches (DB will be queried for this date)</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">📤 Sender Account</Label>
                    <Input
                      value={`${settings.fromName} <${settings.fromEmail || settings.user}>`}
                      disabled
                      className="h-8 text-xs bg-slate-100 text-slate-600 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">
                    👤 Send To (Primary Recipient) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={shootTo}
                    onChange={(e) => setShootTo(e.target.value)}
                    placeholder="sanjiv@cookhouse.in"
                    className="h-8 text-xs"
                  />
                  <p className="text-[10px] text-slate-400">Default: sanjiv@cookhouse.in (comma-separate multiple)</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">
                    👥 CC (Carbon Copy)
                  </Label>
                  <Input
                    value={shootCc}
                    onChange={(e) => setShootCc(e.target.value)}
                    placeholder="siddharth@cookhouse.in, bheem@cookhouse.in"
                    className="h-8 text-xs"
                  />
                  <p className="text-[10px] text-slate-400">Default: siddharth@cookhouse.in, bheem@cookhouse.in</p>
                </div>

                <div className="space-y-1 pt-1">
                  <Label className="text-xs font-semibold text-slate-700">📝 Generated Email Subject</Label>
                  <div className="p-2 bg-slate-50 border rounded text-xs font-medium text-slate-800 break-all select-all">
                    {subjectPreview}
                  </div>
                </div>

                <div className="p-2.5 bg-green-50 border border-green-200 rounded-md flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-green-700 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-green-900">
                        Attendance_Report_{shootDate}.xlsx
                      </div>
                      <div className="text-[10px] text-green-700">
                        Multi-sheet Excel workbook with Executive Summary, Master Records, &amp; Company Sheets
                      </div>
                    </div>
                  </div>
                  <Badge className="bg-green-700 text-white text-[10px] shrink-0 font-medium">Auto-Attached</Badge>
                </div>
              </div>

              {/* Status Note */}
              {lastShotInfo.date && (
                <div className="flex items-center gap-2 text-xs text-slate-500 px-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Last report sent: <strong>{lastShotInfo.date}</strong>{" "}
                    {lastShotInfo.timestamp ? `at ${new Date(lastShotInfo.timestamp).toLocaleTimeString()}` : ""}
                  </span>
                  {lastShotInfo.status === "success" && (
                    <Badge variant="outline" className="text-green-700 border-green-200 text-[10px] py-0">Delivered</Badge>
                  )}
                </div>
              )}

              <DialogFooter className="pt-2">
                <Button variant="outline" size="sm" onClick={onClose} disabled={shootingMail}>
                  Cancel
                </Button>
                <Button
                  onClick={handleShootMailNow}
                  disabled={shootingMail || !shootTo}
                  className="bg-green-700 hover:bg-green-800 text-white font-semibold text-xs gap-1.5 shadow-sm"
                >
                  {shootingMail ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating Excel &amp; Shooting...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" /> Shoot Daily Attendance Email
                    </>
                  )}
                </Button>
              </DialogFooter>
            </TabsContent>

            {/* ══ TAB 2: SMTP & 3 PM SCHEDULE SETTINGS ══ */}
            <TabsContent value="settings" className="space-y-4">
              {/* Google Workspace Notice */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-950">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  Google Workspace 2-Step Verification Guide
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  Google Workspace accounts with 2-Step Verification enabled require a <strong>16-character Google App Password</strong> instead of your regular account password for SMTP authentication.
                </p>
                <div className="pt-1">
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 hover:underline"
                  >
                    Generate App Password on Google Account <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* SMTP Credentials Form */}
              <div className="space-y-3 bg-slate-50/50 p-3.5 border rounded-lg">
                <div className="text-xs font-bold text-slate-800 flex items-center justify-between border-b pb-2">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-green-600" /> Google Workspace SMTP Server
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTestSmtp}
                    disabled={testingSmtp}
                    className="h-6 text-[11px] gap-1 border-slate-300 text-slate-700 hover:bg-slate-100"
                  >
                    {testingSmtp ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3 text-slate-500" />}
                    Test Connection
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-slate-600">SMTP Server Host</Label>
                    <Input
                      value={settings.host}
                      onChange={(e) => setSettings(prev => ({ ...prev, host: e.target.value }))}
                      className="h-8 text-xs bg-white"
                      placeholder="smtp.gmail.com"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-slate-600">Port</Label>
                      <Input
                        type="number"
                        value={settings.port}
                        onChange={(e) => setSettings(prev => ({ ...prev, port: Number(e.target.value) }))}
                        className="h-8 text-xs bg-white"
                        placeholder="465"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-slate-600">SSL/TLS</Label>
                      <div className="flex items-center h-8 gap-1.5">
                        <Switch
                          checked={settings.secure}
                          onCheckedChange={(checked) => setSettings(prev => ({ ...prev, secure: checked }))}
                        />
                        <span className="text-[11px] text-slate-600 font-medium">{settings.secure ? "SSL (465)" : "TLS (587)"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-slate-600">Email Address (User)</Label>
                    <Input
                      value={settings.user}
                      onChange={(e) => setSettings(prev => ({ ...prev, user: e.target.value, fromEmail: e.target.value }))}
                      className="h-8 text-xs bg-white font-mono"
                      placeholder="it-team@cookhouse.in"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-slate-600">Password / App Password</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={settings.pass}
                        onChange={(e) => setSettings(prev => ({ ...prev, pass: e.target.value }))}
                        className="h-8 text-xs bg-white pr-8 font-mono"
                        placeholder="ItCookhouse@!@#123"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                        title={showPassword ? "Hide" : "Show"}
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-slate-600">Default To Recipient</Label>
                    <Input
                      value={settings.to}
                      onChange={(e) => setSettings(prev => ({ ...prev, to: e.target.value }))}
                      className="h-8 text-xs bg-white"
                      placeholder="sanjiv@cookhouse.in"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-slate-600">Default CC Recipients</Label>
                    <Input
                      value={settings.cc}
                      onChange={(e) => setSettings(prev => ({ ...prev, cc: e.target.value }))}
                      className="h-8 text-xs bg-white"
                      placeholder="siddharth@cookhouse.in, bheem@cookhouse.in"
                    />
                  </div>
                </div>
              </div>

              {/* ⏰ 3:00 PM Auto-Shoot Schedule Configuration */}
              <div className="space-y-3 bg-emerald-50/40 p-3.5 border border-emerald-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-100 rounded-md">
                      <Clock className="w-4 h-4 text-emerald-800" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-emerald-950">Daily Automated Dispatch</div>
                      <div className="text-[11px] text-emerald-700">Shoot attendance report for every company at 3:00 PM</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="auto-switch" className="text-xs font-medium text-emerald-900 cursor-pointer">
                      {settings.autoShootEnabled ? "Active" : "Disabled"}
                    </Label>
                    <Switch
                      id="auto-switch"
                      checked={settings.autoShootEnabled}
                      onCheckedChange={(checked) => setSettings(prev => ({ ...prev, autoShootEnabled: checked }))}
                    />
                  </div>
                </div>

                {settings.autoShootEnabled && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-emerald-200/60">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-emerald-900">Scheduled Trigger Time (IST)</Label>
                      <Input
                        type="time"
                        value={settings.autoShootTime}
                        onChange={(e) => setSettings(prev => ({ ...prev, autoShootTime: e.target.value }))}
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                    <div className="flex flex-col justify-end text-[11px] text-emerald-800 pb-1">
                      <div>Targets: <strong>{settings.to}</strong></div>
                      <div>CC: <strong>{settings.cc || "None"}</strong></div>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="pt-2">
                <Button variant="outline" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="bg-green-700 hover:bg-green-800 text-white text-xs gap-1.5 font-semibold"
                >
                  {savingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Save SMTP &amp; Schedule Settings
                </Button>
              </DialogFooter>
            </TabsContent>

            {/* ══ TAB 3: DISPATCH HISTORY ══ */}
            <TabsContent value="history" className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-800">Recent Attendance Email Dispatches</div>
                <Button variant="ghost" size="sm" onClick={loadSettings} className="h-6 text-[10px] gap-1 text-slate-500">
                  <RefreshCw className="w-3 h-3" /> Refresh Logs
                </Button>
              </div>

              <div className="border rounded-md overflow-hidden max-h-[350px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-[11px] py-1.5">Date &amp; Time</TableHead>
                      <TableHead className="text-[11px] py-1.5">Recipient (To / CC)</TableHead>
                      <TableHead className="text-[11px] py-1.5 text-center">Records</TableHead>
                      <TableHead className="text-[11px] py-1.5 text-center">Type</TableHead>
                      <TableHead className="text-[11px] py-1.5 text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emailLogs.length > 0 ? (
                      emailLogs.map((log) => (
                        <TableRow key={log.id} className="text-xs">
                          <TableCell className="py-2">
                            <div className="font-semibold text-slate-800">{log.dayName || log.date}</div>
                            <div className="text-[10px] text-slate-400">
                              {log.timestamp ? format(new Date(log.timestamp), "MMM dd, yyyy HH:mm") : log.date}
                            </div>
                          </TableCell>
                          <TableCell className="py-2 max-w-[200px]">
                            <div className="truncate font-medium text-slate-800" title={log.to}>{log.to}</div>
                            {log.cc && <div className="truncate text-[10px] text-slate-500" title={log.cc}>cc: {log.cc}</div>}
                          </TableCell>
                          <TableCell className="py-2 text-center">
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {log.recordsCount ?? "—"} recs
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2 text-center">
                            <span className="text-[10px] text-slate-500 capitalize">
                              {log.triggeredBy === "cron_3pm" ? "⏰ 3 PM Auto" : log.triggeredBy || "Manual"}
                            </span>
                          </TableCell>
                          <TableCell className="py-2 text-right">
                            {log.status === "success" ? (
                              <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px] font-semibold">
                                ✓ Sent
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-[10px]" title={log.error}>
                                ✕ Failed
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-xs text-slate-400">
                          No email dispatch records found yet. Click &quot;Shoot Mail Now&quot; to send your first report!
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <DialogFooter className="pt-2">
                <Button variant="outline" size="sm" onClick={onClose}>
                  Close
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
