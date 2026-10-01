"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Loader2, Upload, BrainCircuit, FileSpreadsheet, CheckCircle2, ChevronRight, ChevronLeft, SlidersHorizontal, Eye, Building2, AlertTriangle, MousePointerClick, Sparkles, Calendar, Layers, Pencil, Trash2, RotateCcw, Search, Filter, Plus } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { servicesService, subServicesService, mealPlansService, subMealPlansService, companiesService, type Company } from "@/lib/services"
import type { Service, SubService, MealPlan, SubMealPlan } from "@/lib/types"
import * as XLSX from "xlsx"
import { doc, getDoc, setDoc, deleteDoc, updateDoc, collection, query, orderBy, getDocs, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { format } from "date-fns"

function formatExcelDate(val: any): string {
  if (!val) return ""
  if (typeof val === "number" && val > 30000 && val < 60000) {
    const jsDate = new Date(Math.round((val - 25569) * 86400 * 1000))
    if (!isNaN(jsDate.getTime())) {
      return format(jsDate, "yyyy-MM-dd (EEE)")
    }
  }
  return String(val).replace(/\n/g, " ").trim()
}

function getColLetter(idx: number): string {
  let letter = ""
  let temp = idx
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter
    temp = Math.floor(temp / 26) - 1
  }
  return letter
}

export default function AITrainingPage() {
  const [loading, setLoading] = useState(true)
  const [training, setTraining] = useState(false)

  // Master Data
  const [services, setServices] = useState<Service[]>([])
  const [subServices, setSubServices] = useState<SubService[]>([])
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([])
  const [subMealPlans, setSubMealPlans] = useState<SubMealPlan[]>([])
  const [companies, setCompanies] = useState<Company[]>([])

  // Wizard State
  const [currentStep, setCurrentStep] = useState(1)

  // Step 1: Configuration
  const [isGlobal, setIsGlobal] = useState(false)
  const [selectedServiceId, setSelectedServiceId] = useState<string>("")
  const [selectedSubServiceId, setSelectedSubServiceId] = useState<string>("")
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>(["universal"])

  // Step 2: Source Selection
  const [trainingSource, setTrainingSource] = useState<'excel' | 'db'>('excel')

  // Step 3: Excel Upload & Visual Interactive Mapping State
  const [file, setFile] = useState<File | null>(null)
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null)
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState<string>("")
  const [rawSheetRows, setRawSheetRows] = useState<any[][]>([])

  // Row & Column Mapping Settings
  const [headerRowIdx, setHeaderRowIdx] = useState<number>(0)
  const [dateRowIdx, setDateRowIdx] = useState<number>(0) // Row containing the dates/days across columns
  const [dataStartRowIdx, setDataStartRowIdx] = useState<number>(1) // Row where dishes/data start

  const [mealPlanColIdx, setMealPlanColIdx] = useState<number>(0)
  const [subMealPlanColIdx, setSubMealPlanColIdx] = useState<number>(-1) // -1 = None in Excel
  const [layoutMode, setLayoutMode] = useState<'horizontal' | 'vertical'>('horizontal')
  const [itemColIdx, setItemColIdx] = useState<number>(1) // For vertical mode
  const [dateColIdx, setDateColIdx] = useState<number>(-1) // For vertical mode
  const [companyColIdx, setCompanyColIdx] = useState<number>(-1) // -1 = None / Use Global Selector
  const [selectedDayColIndices, setSelectedDayColIndices] = useState<number[]>([]) // For horizontal mode
  
  // Interactive selection state
  const [selectedCellCol, setSelectedCellCol] = useState<number | null>(null)
  const [selectedRowIdx, setSelectedRowIdx] = useState<number | null>(null)

  // Database Mapping for Excel Categories (MealPlan -> SubMealPlan)
  const [mealPlanMapping, setMealPlanMapping] = useState<Record<string, { mealPlanId: string; subMealPlanIds?: string[] }>>({})

  // Specific Day Record Customization & Overrides
  const [recordOverrides, setRecordOverrides] = useState<Record<string, {
    mealPlanId?: string
    mealPlanName?: string
    subMealPlanId?: string
    subMealPlanName?: string
    items?: string
    date?: string
    company?: string
    isDeleted?: boolean
  }>>({})

  const [editingRecord, setEditingRecord] = useState<any | null>(null)
  const [editMpId, setEditMpId] = useState<string>("")
  const [editSmpId, setEditSmpId] = useState<string>("")
  const [editCustomSmpName, setEditCustomSmpName] = useState<string>("")
  const [editItems, setEditItems] = useState<string>("")
  const [editDate, setEditDate] = useState<string>("")
  const [editCustomDate, setEditCustomDate] = useState<string>("")
  const [editCompany, setEditCompany] = useState<string>("Universal")
  const [applyToMatchingDishes, setApplyToMatchingDishes] = useState<boolean>(false)

  // Live Output Preview Filtering
  const [previewDayFilter, setPreviewDayFilter] = useState<string>("all")
  const [previewSearch, setPreviewSearch] = useState<string>("")
  
  // New Table States
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [sortColumn, setSortColumn] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [previewCompanyFilter, setPreviewCompanyFilter] = useState<string>('all')
  const [previewMealPlanFilter, setPreviewMealPlanFilter] = useState<string>('all')
  const [previewServiceFilter, setPreviewServiceFilter] = useState<string>('all')

  // Extra Database Categories & Custom Dishes
  const [extraMealPlanCategories, setExtraMealPlanCategories] = useState<string[]>([])
  const [customRecords, setCustomRecords] = useState<any[]>([])
  const [extraMpToAdd, setExtraMpToAdd] = useState<string>("none")

  // Add Dish Dialog state
  const [isAddDishOpen, setIsAddDishOpen] = useState(false)
  const [newDishDate, setNewDishDate] = useState<string>("all")
  const [newDishCustomDate, setNewDishCustomDate] = useState<string>("")
  const [newDishCompany, setNewDishCompany] = useState<string>("Universal")
  const [newDishMpId, setNewDishMpId] = useState<string>("")
  const [newDishSmpIds, setNewDishSmpIds] = useState<string[]>([])
  const [newDishCustomSmp, setNewDishCustomSmp] = useState<string>("")
  const [newDishItems, setNewDishItems] = useState<string>("")

  // Step 4: Review
  const [includeDbMenus, setIncludeDbMenus] = useState(false)
  const [aiModel, setAiModel] = useState("gemini")

  // Profile & Logs
  const [existingProfile, setExistingProfile] = useState<string | null>(null)
  const [lastFeedback, setLastFeedback] = useState<string | null>(null)
  const [lastAdvisory, setLastAdvisory] = useState<string | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [trainingLogs, setTrainingLogs] = useState<any[]>([])
  const [viewLog, setViewLog] = useState<any | null>(null)

  // Profile & Log Editing state
  const [editingProfileOpen, setEditingProfileOpen] = useState(false)
  const [editProfileText, setEditProfileText] = useState("")
  const [editFeedbackText, setEditFeedbackText] = useState("")
  const [editAdvisoryText, setEditAdvisoryText] = useState("")
  const [editingLogId, setEditingLogId] = useState<string | null>(null) // null = active profile
  const [savingProfileEdit, setSavingProfileEdit] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        const [svcs, ssvcs, mps, smps, comps] = await Promise.all([
          servicesService.getActive(),
          subServicesService.getActive(),
          mealPlansService.getActive(),
          subMealPlansService.getActive(),
          companiesService.getAll(),
        ])
        setServices(svcs.sort((a, b) => (a.order || 0) - (b.order || 0)))
        setSubServices(ssvcs.sort((a, b) => (a.order || 0) - (b.order || 0)))
        setMealPlans(mps.sort((a, b) => (a.order || 0) - (b.order || 0)))
        setSubMealPlans(smps.sort((a, b) => (a.order || 0) - (b.order || 0)))
        setCompanies(comps.filter((c: any) => c.status === "active"))
      } catch (error) {
        console.error(error)
        toast({ title: "Error loading master data", variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Fetch Profile independently
  useEffect(() => {
    async function fetchProfile() {
      if (!isGlobal && (!selectedServiceId || !selectedSubServiceId)) {
        setExistingProfile(null)
        setLastFeedback(null)
        setLastAdvisory(null)
        return
      }
      setLoadingProfile(true)
      const docId = isGlobal ? "GLOBAL_GLOBAL" : `${selectedServiceId}_${selectedSubServiceId}`
      try {
        const snap = await getDoc(doc(db, "aiTrainingProfiles", docId))
        if (snap.exists()) {
          const data = snap.data()
          setExistingProfile(data.profileText)
          setLastFeedback(data.lastFeedback || null)
          setLastAdvisory(data.lastAdvisory || null)
        } else {
          setExistingProfile(null)
          setLastFeedback(null)
          setLastAdvisory(null)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoadingProfile(false)
      }
    }
    fetchProfile()
  }, [selectedServiceId, selectedSubServiceId, isGlobal])

  const fetchLogs = async () => {
    try {
      const q = query(collection(db, "aiTrainingLogs"), orderBy("timestamp", "desc"))
      const logsSnap = await getDocs(q)
      setTrainingLogs(logsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  // File Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const uploadedFile = e.target.files[0]
    setFile(uploadedFile)

    try {
      const data = await uploadedFile.arrayBuffer()
      const wb = XLSX.read(data, { type: "array" })
      setWorkbook(wb)
      setSheetNames(wb.SheetNames)
      const firstSheet = wb.SheetNames[0]
      setSelectedSheet(firstSheet)

      loadSheetData(wb, firstSheet)
      toast({ title: "File Loaded", description: `Loaded sheet: ${firstSheet}. You can select rows and columns below.` })
    } catch (err) {
      console.error(err)
      toast({ title: "Parse Error", description: "Failed to read the Excel file.", variant: "destructive" })
    }
  }

  // Load raw sheet rows and run auto-detection
  const loadSheetData = (wb: XLSX.WorkBook, sheetName: string) => {
    const ws = wb.Sheets[sheetName]
    if (!ws) return
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" })
    setRawSheetRows(rows)
    setRecordOverrides({})
    setPreviewDayFilter("all")
    setPreviewSearch("")
    setExtraMealPlanCategories([])
    setCustomRecords([])

    if (rows.length === 0) return

    // 1. Find Header Row (most text columns in first 12 rows)
    let bestHeaderIdx = 0
    let maxNonEmpty = 0
    for (let i = 0; i < Math.min(12, rows.length); i++) {
      const nonEmpties = (rows[i] || []).filter(c => String(c).trim().length > 0).length
      if (nonEmpties > maxNonEmpty) {
        maxNonEmpty = nonEmpties
        bestHeaderIdx = i
      }
    }

    // 2. Find Date Row (row with most date-like cells or day names)
    let bestDateIdx = bestHeaderIdx
    let maxDateMatches = 0
    for (let i = 0; i < Math.min(12, rows.length); i++) {
      let dateMatches = 0
      ;(rows[i] || []).forEach(cell => {
        const str = String(cell || "").toLowerCase().trim()
        const isDay = /^(mon|tue|wed|thu|fri|sat|sun)/i.test(str)
        const hasDateNum = /\b\d{1,2}(st|nd|rd|th)?\b/i.test(str) || (/^\d+$/.test(str) && Number(str) > 40000)
        if (isDay || hasDateNum) dateMatches++
      })
      if (dateMatches > maxDateMatches) {
        maxDateMatches = dateMatches
        bestDateIdx = i
      }
    }

    setHeaderRowIdx(bestHeaderIdx)
    setDateRowIdx(bestDateIdx)
    setDataStartRowIdx(Math.max(bestHeaderIdx, bestDateIdx) + 1)

    const headers = (rows[bestHeaderIdx] || []).map(h => String(h || "").trim())
    const dateRowCells = (rows[bestDateIdx] || []).map(d => String(d || "").trim())

    let mpCol = 0
    let smpCol = -1
    let companyCol = -1
    let detectedDateCols: number[] = []
    let detectedItemCol = 1
    let detectedDateCol = -1

    headers.forEach((h, idx) => {
      const hLower = h.toLowerCase()
      if (hLower.includes("sub meal plan") || hLower.includes("submealplan") || hLower === "sub meal") {
        smpCol = idx
      } else if (hLower.includes("meal plan") || hLower.includes("mealplan") || hLower.includes("category")) {
        mpCol = idx
      } else if (hLower.includes("company") || hLower.includes("client")) {
        companyCol = idx
      } else if (hLower.includes("recipe") || hLower.includes("dish") || hLower.includes("item name")) {
        detectedItemCol = idx
      } else if (hLower === "date" || hLower.includes("menu date")) {
        detectedDateCol = idx
      }

      // Check if this column has a date or day in headers OR in dateRow
      const dateCellVal = (dateRowCells[idx] || "").toLowerCase()
      const isDay = /^(mon|tue|wed|thu|fri|sat|sun)/i.test(hLower) || /^(mon|tue|wed|thu|fri|sat|sun)/i.test(dateCellVal)
      const hasDateNum = /\b\d{1,2}(st|nd|rd|th)?\b/i.test(hLower) || (/^\d+$/.test(h) && Number(h) > 40000) ||
                         /\b\d{1,2}(st|nd|rd|th)?\b/i.test(dateCellVal) || (/^\d+$/.test(dateCellVal) && Number(dateCellVal) > 40000)

      if (isDay || hasDateNum) {
        detectedDateCols.push(idx)
      }
    })

    setMealPlanColIdx(mpCol)
    setSubMealPlanColIdx(smpCol)
    setCompanyColIdx(companyCol)

    if (detectedDateCols.length >= 2) {
      setLayoutMode("horizontal")
      setSelectedDayColIndices(detectedDateCols)
    } else {
      setLayoutMode("vertical")
      setItemColIdx(detectedItemCol)
      setDateColIdx(detectedDateCol)
    }
  }

  const handleSheetChange = (sheetName: string) => {
    setSelectedSheet(sheetName)
    if (workbook) {
      loadSheetData(workbook, sheetName)
    }
  }

  // Detected Headers for current headerRowIdx
  const detectedHeaders = useMemo(() => {
    if (!rawSheetRows || rawSheetRows.length <= headerRowIdx) return []
    const row = rawSheetRows[headerRowIdx] || []
    const maxCols = Math.max(...rawSheetRows.slice(0, 15).map(r => r.length), row.length)
    const result: { index: number; label: string; raw: string }[] = []
    for (let i = 0; i < maxCols; i++) {
      const rawVal = row[i] !== undefined ? String(row[i]).trim() : ""
      result.push({
        index: i,
        raw: rawVal,
        label: `Col ${getColLetter(i)}: ${rawVal ? rawVal.replace(/\n/g, " ") : "[Empty]"}`,
      })
    }
    return result
  }, [rawSheetRows, headerRowIdx])

  // Derive parsed records and distinct Excel categories purely with useMemo (NO INFINITE LOOP)
  const { allRecords, detectedExcelMealPlans } = useMemo<{ allRecords: any[]; detectedExcelMealPlans: string[] }>(() => {
    if (!rawSheetRows || rawSheetRows.length <= headerRowIdx + 1) {
      return { allRecords: [], detectedExcelMealPlans: [] }
    }

    const records: any[] = []
    const uniqueMps = new Set<string>()
    let lastMealPlan = ""
    let lastSubMealPlan = ""

    const headers = (rawSheetRows[headerRowIdx] || []).map(h => String(h || "").trim())
    const dateRowValues = (dateRowIdx >= 0 && rawSheetRows[dateRowIdx]) ? rawSheetRows[dateRowIdx] : headers

    // Determine row to start reading data
    const startRow = Math.max(dataStartRowIdx, Math.max(headerRowIdx, dateRowIdx) + 1)

    for (let r = startRow; r < rawSheetRows.length; r++) {
      const row = rawSheetRows[r]
      if (!row || row.length === 0) continue

      const nonEmptyCells = row.filter(c => String(c).trim().length > 0)
      if (nonEmptyCells.length === 1 && String(nonEmptyCells[0]).length > 25) {
        continue
      }

      // Meal Plan (carry forward for merged cells)
      let rawMp = mealPlanColIdx >= 0 && row[mealPlanColIdx] !== undefined ? String(row[mealPlanColIdx]).trim() : ""
      if (rawMp) {
        lastMealPlan = rawMp
      } else {
        rawMp = lastMealPlan
      }

      // Sub Meal Plan from Excel
      let rawSmp = subMealPlanColIdx >= 0 && row[subMealPlanColIdx] !== undefined ? String(row[subMealPlanColIdx]).trim() : ""
      if (rawSmp) {
        lastSubMealPlan = rawSmp
      } else {
        rawSmp = lastSubMealPlan
      }

      if (!rawMp && !rawSmp && nonEmptyCells.length === 0) continue
      if (rawMp) uniqueMps.add(rawMp)

      // Get DB Mapping
      const curMapping = mealPlanMapping[rawMp]
      const mappedMpId = typeof curMapping === "object" ? curMapping?.mealPlanId : curMapping
      const mappedSmpIds = typeof curMapping === "object" ? (curMapping?.subMealPlanIds || []) : []

      const dbMp = mealPlans.find(m => m.id === mappedMpId)
      const dbSmps = subMealPlans.filter(s => mappedSmpIds.includes(s.id))

      const finalSubMealPlanName = rawSmp || (dbSmps.length > 0 ? dbSmps.map(s => s.name).join(", ") : "")
      const isSubMealPlanFromDb = !rawSmp && mappedSmpIds.length > 0

      // Company resolution
      let rowCompany = ""
      if (companyColIdx >= 0 && row[companyColIdx]) {
        rowCompany = String(row[companyColIdx]).trim()
      } else if (selectedCompanyIds.length > 0 && !selectedCompanyIds.includes("universal")) {
        const found = companies.filter(c => selectedCompanyIds.includes(c.id))
        rowCompany = found.length > 0 ? found.map(c => c.name).join(", ") : "Company"
      } else {
        const match = rawMp.match(/\(([^)]+)\)/)
        if (match) {
          rowCompany = match[1].trim()
        } else {
          rowCompany = "Universal"
        }
      }

      if (layoutMode === "horizontal") {
        const colsToUse = selectedDayColIndices.length > 0 
          ? selectedDayColIndices 
          : detectedHeaders.filter(h => h.index > Math.max(mealPlanColIdx, subMealPlanColIdx)).map(h => h.index)

        colsToUse.forEach(colIdx => {
          const itemVal = row[colIdx]
          if (itemVal !== undefined && String(itemVal).trim().length > 0) {
            // Read date from dateRowValues (the selected Date Row)
            const dateCellRaw = dateRowValues[colIdx] !== undefined ? dateRowValues[colIdx] : headers[colIdx]
            let formattedDate = formatExcelDate(dateCellRaw)

            // If dateRow is different from headerRow, and headerRow has day name like "Mon" or "Monday"
            if (dateRowIdx !== headerRowIdx && headers[colIdx]) {
              const headerText = String(headers[colIdx]).trim()
              if (headerText && !formattedDate.toLowerCase().includes(headerText.toLowerCase())) {
                formattedDate = `${formattedDate} (${headerText})`
              }
            }
            if (!formattedDate) formattedDate = `Day ${getColLetter(colIdx)}`

            const recordKey = `r${r}_c${colIdx}`
            const override = recordOverrides[recordKey]

            // If user excluded this record, skip it
            if (override?.isDeleted) return

            const activeMpId = override?.mealPlanId !== undefined ? override.mealPlanId : (mappedMpId || "")
            const activeDbMp = mealPlans.find(m => m.id === activeMpId)
            const activeMpName = override?.mealPlanName || activeDbMp?.name || dbMp?.name || rawMp

            const activeSmpIds = override?.subMealPlanId !== undefined ? [override.subMealPlanId] : mappedSmpIds
            const activeDbSmps = subMealPlans.filter(s => activeSmpIds.includes(s.id))
            const activeSmpName = override?.subMealPlanName !== undefined ? override.subMealPlanName : (rawSmp || (activeDbSmps.length > 0 ? activeDbSmps.map(s => s.name).join(", ") : (dbSmps.length > 0 ? dbSmps.map(s => s.name).join(", ") : "")))

            records.push({
              key: recordKey,
              rowIdx: r,
              colIdx,
              mealPlan: rawMp,
              mappedMealPlanId: activeMpId,
              mappedMealPlanName: activeMpName,
              subMealPlan: activeSmpName,
              mappedSubMealPlanId: activeSmpIds[0] || "",
              mappedSubMealPlanIds: activeSmpIds,
              isSubMealPlanFromDb: activeSmpIds.length > 0,
              isOverridden: Boolean(override && !override.isDeleted),
              date: override?.date !== undefined ? override.date : formattedDate,
              items: override?.items !== undefined ? override.items : String(itemVal).trim(),
              company: override?.company !== undefined ? override.company : rowCompany,
            })
          }
        })
      } else {
        const itemVal = itemColIdx >= 0 ? row[itemColIdx] : ""
        if (itemVal && String(itemVal).trim().length > 0) {
          const dateVal = dateColIdx >= 0 ? row[dateColIdx] : ""
          const formattedDate = formatExcelDate(dateVal) || "General"
          const recordKey = `r${r}_i${itemColIdx}`
          const override = recordOverrides[recordKey]

          // If user excluded this record, skip it
          if (override?.isDeleted) continue

          const activeMpId = override?.mealPlanId !== undefined ? override.mealPlanId : (mappedMpId || "")
          const activeDbMp = mealPlans.find(m => m.id === activeMpId)
          const activeMpName = override?.mealPlanName || activeDbMp?.name || dbMp?.name || rawMp

          const activeSmpIds = override?.subMealPlanId !== undefined ? [override.subMealPlanId] : mappedSmpIds
          const activeDbSmps = subMealPlans.filter(s => activeSmpIds.includes(s.id))
          const activeSmpName = override?.subMealPlanName !== undefined ? override.subMealPlanName : (rawSmp || (activeDbSmps.length > 0 ? activeDbSmps.map(s => s.name).join(", ") : (dbSmps.length > 0 ? dbSmps.map(s => s.name).join(", ") : "")))

          records.push({
            key: recordKey,
            rowIdx: r,
            colIdx: itemColIdx,
            mealPlan: rawMp,
            mappedMealPlanId: activeMpId,
            mappedMealPlanName: activeMpName,
            subMealPlan: activeSmpName,
            mappedSubMealPlanId: activeSmpIds[0] || "",
            mappedSubMealPlanIds: activeSmpIds,
            isSubMealPlanFromDb: activeSmpIds.length > 0,
            isOverridden: Boolean(override && !override.isDeleted),
            date: override?.date !== undefined ? override.date : formattedDate,
            items: override?.items !== undefined ? override.items : String(itemVal).trim(),
            company: override?.company !== undefined ? override.company : rowCompany,
          })
        }
      }
    }

    // Merge custom added records
    customRecords.forEach(cr => {
      const override = recordOverrides[cr.key]
      if (override?.isDeleted) return

      const activeMpId = override?.mealPlanId !== undefined ? override.mealPlanId : cr.mappedMealPlanId
      const activeDbMp = mealPlans.find(m => m.id === activeMpId)
      const activeMpName = override?.mealPlanName || activeDbMp?.name || cr.mappedMealPlanName

      const activeSmpIds = override?.subMealPlanId !== undefined ? [override.subMealPlanId] : cr.mappedSubMealPlanIds
      const activeDbSmps = subMealPlans.filter(s => activeSmpIds.includes(s.id))
      const activeSmpName = override?.subMealPlanName !== undefined ? override.subMealPlanName : (cr.subMealPlan || (activeDbSmps.length > 0 ? activeDbSmps.map(s => s.name).join(", ") : ""))

      const finalItems = override?.items !== undefined ? override.items : cr.items
      const finalDate = override?.date !== undefined ? override.date : cr.date
      const finalCompany = override?.company !== undefined ? override.company : cr.company

      records.push({
        ...cr,
        mappedMealPlanId: activeMpId,
        mappedMealPlanName: activeMpName,
        subMealPlan: activeSmpName,
        mappedSubMealPlanId: activeSmpIds[0] || "",
        mappedSubMealPlanIds: activeSmpIds,
        isOverridden: Boolean(override && !override.isDeleted),
        date: finalDate,
        items: finalItems,
        company: finalCompany,
      })
    })

    return { allRecords: records, detectedExcelMealPlans: Array.from(uniqueMps) }
  }, [
    rawSheetRows,
    headerRowIdx,
    dateRowIdx,
    dataStartRowIdx,
    mealPlanColIdx,
    subMealPlanColIdx,
    layoutMode,
    selectedDayColIndices,
    itemColIdx,
    dateColIdx,
    companyColIdx,
    selectedCompanyIds,
    mealPlanMapping,
    mealPlans,
    subMealPlans,
    companies,
    detectedHeaders,
    recordOverrides,
    customRecords,
  ])

  // Unique dates in extracted records for filtering
  const uniqueDates = useMemo(() => {
    const dates = new Set<string>()
    allRecords.forEach((r: any) => {
      if (r.date) dates.add(r.date)
    })
    return Array.from(dates)
  }, [allRecords])

  // Filtered records for the Live Output Preview
  const filteredRecords = useMemo(() => {
    let records = allRecords.filter((r: any) => {
      const matchDay = previewDayFilter === "all" || r.date === previewDayFilter
      const matchSearch = !previewSearch || 
        r.items.toLowerCase().includes(previewSearch.toLowerCase()) || 
        r.mealPlan.toLowerCase().includes(previewSearch.toLowerCase()) ||
        r.subMealPlan.toLowerCase().includes(previewSearch.toLowerCase()) ||
        r.mappedMealPlanName.toLowerCase().includes(previewSearch.toLowerCase())
      
      const matchCompany = previewCompanyFilter === "all" || r.company === previewCompanyFilter
      const matchMealPlan = previewMealPlanFilter === "all" || r.mappedMealPlanName === previewMealPlanFilter || r.mealPlan === previewMealPlanFilter

      return matchDay && matchSearch && matchCompany && matchMealPlan
    })

    if (sortColumn) {
      records = [...records].sort((a, b) => {
        let valA = a[sortColumn]
        let valB = b[sortColumn]
        
        if (sortColumn === 'trainingDate') {
          valA = new Date().getTime()
          valB = new Date().getTime()
        } else if (sortColumn === 'menuDate') {
          valA = a.date
          valB = b.date
        } else if (sortColumn === 'service') {
          valA = services.find(s => s.id === selectedServiceId)?.name || ''
          valB = valA
        } else if (sortColumn === 'company') {
          valA = a.company
          valB = b.company
        } else if (sortColumn === 'mappedMealPlanName') {
          valA = a.mappedMealPlanName || a.mealPlan
          valB = b.mappedMealPlanName || b.mealPlan
        } else if (sortColumn === 'subMealPlan') {
          valA = a.subMealPlan
          valB = b.subMealPlan
        } else if (sortColumn === 'items') {
          valA = a.items
          valB = b.items
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1
        return 0
      })
    }

    return records
  }, [allRecords, previewDayFilter, previewSearch, previewCompanyFilter, previewMealPlanFilter, previewServiceFilter, sortColumn, sortDirection, selectedServiceId, services])

  useEffect(() => {
    setCurrentPage(1)
  }, [previewDayFilter, previewSearch, previewCompanyFilter, previewMealPlanFilter, previewServiceFilter])

  const overrideCount = useMemo(() => {
    return Object.keys(recordOverrides).filter(k => !recordOverrides[k].isDeleted).length
  }, [recordOverrides])

  const excludedCount = useMemo(() => {
    return Object.keys(recordOverrides).filter(k => recordOverrides[k].isDeleted).length
  }, [recordOverrides])

  // Specific Day Record Edit Handlers
  const handleOpenEditRecord = (record: any) => {
    setEditingRecord(record)
    const validMp = mealPlans.find(m => m.id === record.mappedMealPlanId)
    setEditMpId(validMp ? record.mappedMealPlanId : "unmapped")
    const validSmp = subMealPlans.find(s => s.id === record.mappedSubMealPlanId)
    if (validSmp) {
      setEditSmpId(record.mappedSubMealPlanId)
      setEditCustomSmpName(validSmp.name)
    } else if (record.subMealPlan && record.subMealPlan !== "Auto (AI)" && !record.subMealPlan.includes("Auto")) {
      setEditSmpId("custom")
      setEditCustomSmpName(record.subMealPlan)
    } else {
      setEditSmpId("auto")
      setEditCustomSmpName("")
    }
    setEditItems(record.items || "")
    setEditDate(record.date || "")
    setEditCustomDate("")
    setEditCompany(record.company || "Universal")
    setApplyToMatchingDishes(false)
  }

  const handleSaveRecordEdit = () => {
    if (!editingRecord) return
    const isUnmapped = editMpId === "unmapped" || !editMpId
    const chosenMp = isUnmapped ? null : mealPlans.find(m => m.id === editMpId)
    const finalMpName = chosenMp ? chosenMp.name : editingRecord.mappedMealPlanName

    let finalSmpId = ""
    let finalSmpName = ""

    if (editSmpId === "custom") {
      finalSmpName = editCustomSmpName.trim()
    } else if (editSmpId !== "auto" && editSmpId) {
      const chosenSmp = subMealPlans.find(s => s.id === editSmpId)
      finalSmpId = editSmpId
      finalSmpName = chosenSmp ? chosenSmp.name : ""
    }

    const finalItems = editItems.trim() || editingRecord.items
    const finalDate = editDate === "custom" 
      ? (editCustomDate.trim() || editingRecord.date) 
      : (editDate || editingRecord.date)
    const finalCompany = editCompany || editingRecord.company

    const overrideObj = {
      mealPlanId: isUnmapped ? "" : editMpId,
      mealPlanName: finalMpName,
      subMealPlanId: finalSmpId,
      subMealPlanName: finalSmpName,
      items: finalItems,
      date: finalDate,
      company: finalCompany,
    }

    if (editingRecord.key.startsWith("custom_")) {
      setCustomRecords(prev => prev.map(r => r.key === editingRecord.key ? {
        ...r,
        mealPlan: finalMpName,
        mappedMealPlanId: isUnmapped ? "" : editMpId,
        mappedMealPlanName: finalMpName,
        subMealPlan: finalSmpName || "Auto (AI)",
        mappedSubMealPlanId: finalSmpId,
        items: finalItems,
        date: finalDate,
        company: finalCompany,
      } : r))
    }

    setRecordOverrides(prev => {
      const next = { ...prev }
      next[editingRecord.key] = overrideObj

      if (applyToMatchingDishes) {
        allRecords.forEach((rec: any) => {
          if (rec.date === editingRecord.date && rec.mealPlan === editingRecord.mealPlan) {
            next[rec.key] = overrideObj
          }
        })
      }
      return next
    })

    toast({
      title: "Record Updated",
      description: applyToMatchingDishes 
        ? `Updated all matching dishes for ${editingRecord.mealPlan}.`
        : `Updated dish entry for ${finalDate}.`
    })
    setEditingRecord(null)
    setApplyToMatchingDishes(false)
  }

  const handleResetRecordEdit = (recordKey: string) => {
    setRecordOverrides(prev => {
      const next = { ...prev }
      delete next[recordKey]
      return next
    })
    toast({ title: "Reverted to Original", description: "Record restored to Excel defaults." })
    if (editingRecord?.key === recordKey) {
      setEditingRecord(null)
    }
  }

  const handleDeleteRecord = (recordKey: string) => {
    if (recordKey.startsWith("custom_")) {
      setCustomRecords(prev => prev.filter(r => r.key !== recordKey))
      toast({ title: "Custom Dish Removed", description: "This custom dish entry has been deleted." })
    } else {
      setRecordOverrides(prev => ({
        ...prev,
        [recordKey]: { isDeleted: true }
      }))
      toast({ title: "Record Excluded", description: "This dish entry will not be sent to AI training." })
    }
    if (editingRecord?.key === recordKey) {
      setEditingRecord(null)
    }
  }

  // Combined Excel categories + extra Meal Plans added from DB
  const allCategories = useMemo(() => {
    const list = [...detectedExcelMealPlans]
    extraMealPlanCategories.forEach(cat => {
      if (!list.includes(cat)) {
        list.push(cat)
      }
    })
    return list
  }, [detectedExcelMealPlans, extraMealPlanCategories])

  const handleAddExtraMealPlan = (mpId: string) => {
    if (!mpId || mpId === "none") return
    const mp = mealPlans.find(m => m.id === mpId)
    if (!mp) return

    let catName = mp.name
    if (detectedExcelMealPlans.includes(catName) || extraMealPlanCategories.includes(catName)) {
      catName = `${mp.name} (Extra)`
    }

    if (extraMealPlanCategories.includes(catName)) {
      toast({ title: "Already Added", description: `Category '${catName}' is already in your customization list.` })
      return
    }

    setExtraMealPlanCategories(prev => [...prev, catName])
    setMealPlanMapping(prev => ({
      ...prev,
      [catName]: {
        mealPlanId: mp.id,
        subMealPlanIds: [],
      }
    }))

    toast({
      title: "Added Database Meal Plan",
      description: `Added '${catName}'. You can now select its Sub Meal Plans and add dishes below.`,
    })
  }

  const handleRemoveExtraCategory = (catName: string) => {
    setExtraMealPlanCategories(prev => prev.filter(c => c !== catName))
    setMealPlanMapping(prev => {
      const copy = { ...prev }
      delete copy[catName]
      return copy
    })
    setCustomRecords(prev => prev.filter(r => r.mealPlan !== catName))
    toast({ title: "Category Removed", description: `Removed '${catName}' and its custom dishes.` })
  }

  const handleOpenAddDishForCategory = (catName: string) => {
    const mapping = mealPlanMapping[catName]
    const mpId = mapping?.mealPlanId || ""
    setNewDishMpId(mpId)
    setNewDishSmpIds(mapping?.subMealPlanIds || [])
    setNewDishCustomSmp("")
    setNewDishItems("")
    if (previewDayFilter !== "all") {
      setNewDishDate(previewDayFilter)
    } else if (uniqueDates.length > 0) {
      setNewDishDate(uniqueDates[0])
    } else {
      setNewDishDate("Day 1")
    }
    setNewDishCustomDate("")
    setNewDishCompany(selectedCompanyIds.length > 0 && !selectedCompanyIds.includes("universal") 
      ? companies.find(c => selectedCompanyIds.includes(c.id))?.name || "Universal" 
      : "Universal")
    setIsAddDishOpen(true)
  }

  const handleOpenAddDish = () => {
    if (mealPlans.length > 0) {
      const firstMp = mealPlans[0]
      setNewDishMpId(firstMp.id)
      setNewDishSmpIds([])
    }
    setNewDishCustomSmp("")
    setNewDishItems("")
    if (previewDayFilter !== "all") {
      setNewDishDate(previewDayFilter)
    } else if (uniqueDates.length > 0) {
      setNewDishDate(uniqueDates[0])
    } else {
      setNewDishDate("Day 1")
    }
    setNewDishCustomDate("")
    setNewDishCompany(selectedCompanyIds.length > 0 && !selectedCompanyIds.includes("universal") 
      ? companies.find(c => selectedCompanyIds.includes(c.id))?.name || "Universal" 
      : "Universal")
    setIsAddDishOpen(true)
  }

  const handleSaveNewDish = () => {
    if (!newDishItems.trim()) {
      toast({ title: "Dish Items Required", description: "Please enter at least one dish name.", variant: "destructive" })
      return
    }

    const chosenMp = mealPlans.find(m => m.id === newDishMpId)
    const mpName = chosenMp ? chosenMp.name : "Custom Meal Plan"
    const chosenSmps = subMealPlans.filter(s => newDishSmpIds.includes(s.id))
    let smpDisplay = chosenSmps.map(s => s.name).join(", ")
    if (newDishCustomSmp.trim()) {
      smpDisplay = smpDisplay ? `${smpDisplay}, ${newDishCustomSmp.trim()}` : newDishCustomSmp.trim()
    }

    const finalDate = newDishDate === "custom" 
      ? (newDishCustomDate.trim() || "Day 1") 
      : (newDishDate === "all" ? (uniqueDates[0] || "Day 1") : newDishDate)

    const newRecord = {
      key: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      rowIdx: -1,
      colIdx: -1,
      mealPlan: mpName,
      mappedMealPlanId: chosenMp?.id || "",
      mappedMealPlanName: mpName,
      subMealPlan: smpDisplay || "Auto (AI)",
      mappedSubMealPlanId: newDishSmpIds[0] || "",
      mappedSubMealPlanIds: newDishSmpIds,
      isSubMealPlanFromDb: newDishSmpIds.length > 0,
      isOverridden: false,
      isCustomAdded: true,
      date: finalDate,
      items: newDishItems.trim(),
      company: newDishCompany || "Universal",
    }

    setCustomRecords(prev => [...prev, newRecord])

    // Ensure category is in extraMealPlanCategories if not in Excel
    if (!detectedExcelMealPlans.includes(mpName) && !extraMealPlanCategories.includes(mpName)) {
      setExtraMealPlanCategories(prev => [...prev, mpName])
      setMealPlanMapping(prev => ({
        ...prev,
        [mpName]: {
          mealPlanId: chosenMp?.id || "",
          subMealPlanIds: newDishSmpIds,
        }
      }))
    }

    toast({ title: "Dish Added to Output", description: `Added "${newDishItems.trim()}" to ${finalDate}.` })
    setIsAddDishOpen(false)
    setNewDishItems("")
    setNewDishCustomSmp("")
  }

  // Profile & Training Log Actions
  const handleOpenEditActiveProfile = () => {
    setEditingLogId(null)
    setEditProfileText(existingProfile || "")
    setEditFeedbackText(lastFeedback || "")
    setEditAdvisoryText(lastAdvisory || "")
    setEditingProfileOpen(true)
  }

  const handleDeleteActiveProfile = async () => {
    if (!confirm("Are you sure you want to remove this active AI training profile? The AI will revert to its baseline behavior for this service.")) {
      return
    }
    const docId = isGlobal ? "GLOBAL_GLOBAL" : `${selectedServiceId}_${selectedSubServiceId}`
    try {
      await deleteDoc(doc(db, "aiTrainingProfiles", docId))
      setExistingProfile(null)
      setLastFeedback(null)
      setLastAdvisory(null)
      toast({ title: "Training Profile Removed", description: "Active training has been reset." })
    } catch (err: any) {
      toast({ title: "Failed to Remove Profile", description: err.message, variant: "destructive" })
    }
  }

  const handleOpenEditLog = (log: any) => {
    setEditingLogId(log.id)
    setEditProfileText(log.profileText || "")
    setEditFeedbackText(log.feedback || "")
    setEditAdvisoryText(log.advisory || "")
    setEditingProfileOpen(true)
  }

  const handleDeleteLog = async (logId: string) => {
    if (!confirm("Are you sure you want to delete this training history record?")) return
    try {
      await deleteDoc(doc(db, "aiTrainingLogs", logId))
      setTrainingLogs(prev => prev.filter(l => l.id !== logId))
      if (viewLog?.id === logId) setViewLog(null)
      toast({ title: "Log Deleted", description: "Training log record has been removed." })
    } catch (err: any) {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" })
    }
  }

  const handleSaveProfileEdit = async () => {
    setSavingProfileEdit(true)
    try {
      if (editingLogId) {
        await updateDoc(doc(db, "aiTrainingLogs", editingLogId), {
          profileText: editProfileText,
          feedback: editFeedbackText,
          advisory: editAdvisoryText,
          updatedAt: serverTimestamp(),
        })
        setTrainingLogs(prev => prev.map(l => l.id === editingLogId ? {
          ...l,
          profileText: editProfileText,
          feedback: editFeedbackText,
          advisory: editAdvisoryText,
        } : l))
        if (viewLog?.id === editingLogId) {
          setViewLog((prev: any) => ({
            ...prev,
            profileText: editProfileText,
            feedback: editFeedbackText,
            advisory: editAdvisoryText,
          }))
        }
        toast({ title: "Training Log Updated", description: "Changes saved successfully." })
      } else {
        const docId = isGlobal ? "GLOBAL_GLOBAL" : `${selectedServiceId}_${selectedSubServiceId}`
        await setDoc(doc(db, "aiTrainingProfiles", docId), {
          profileText: editProfileText,
          lastFeedback: editFeedbackText,
          lastAdvisory: editAdvisoryText,
          updatedAt: serverTimestamp(),
        }, { merge: true })
        setExistingProfile(editProfileText)
        setLastFeedback(editFeedbackText)
        setLastAdvisory(editAdvisoryText)
        toast({ title: "Active Profile Updated", description: "AI fine-tuning rules updated successfully." })
      }
      setEditingProfileOpen(false)
    } catch (err: any) {
      console.error(err)
      toast({ title: "Save Failed", description: err.message, variant: "destructive" })
    } finally {
      setSavingProfileEdit(false)
    }
  }

  // Synchronize auto-matching of newly detected meal plans safely without infinite loops
  useEffect(() => {
    if (detectedExcelMealPlans.length === 0) return
    setMealPlanMapping(prev => {
      let changed = false
      const updated = { ...prev }
      detectedExcelMealPlans.forEach((emp: string) => {
        if (!updated[emp]) {
          changed = true
          const empClean = emp.toLowerCase().replace(/\([^)]*\)/g, "").trim()
          const match = mealPlans.find(mp => {
            const mpName = mp.name.toLowerCase()
            return mpName.includes(empClean) || empClean.includes(mpName)
          })
          updated[emp] = {
            mealPlanId: match ? match.id : "",
            subMealPlanIds: [],
          }
        }
      })
      return changed ? updated : prev
    })
  }, [detectedExcelMealPlans, mealPlans])

  // Training submission
  const handleTrainAI = async () => {
    if (!isGlobal && (!selectedServiceId || !selectedSubServiceId)) {
      toast({ title: "Select Service", description: "Please select a service and sub-service first.", variant: "destructive" })
      return
    }

    setTraining(true)
    try {
      const payloadData = [{
        fileName: file ? file.name : "upload.xlsx",
        sheetName: selectedSheet,
        totalRecords: allRecords.length,
        data: allRecords,
      }]

      const res = await fetch("/api/ai/extract-okf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: isGlobal ? "GLOBAL" : selectedServiceId,
          subServiceId: isGlobal ? "GLOBAL" : selectedSubServiceId,
          trainingData: trainingSource === "excel" ? payloadData : [],
          includeDbMenus: trainingSource === "db" ? true : includeDbMenus,
          aiModel,
          mealPlanMapping: trainingSource === "excel" ? mealPlanMapping : undefined,
          targetCompanyIds: !selectedCompanyIds.includes("universal") ? selectedCompanyIds : undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Training failed")

      if (data.status === "success") {
        toast({ title: "Training Complete!", description: "The AI successfully learned from your menus." })
        setExistingProfile(data.profileText)
        setLastFeedback(data.feedback)
        setLastAdvisory(data.advisory)
        setFile(null)
        setWorkbook(null)
        setCurrentStep(1)
        fetchLogs()
      } else {
        toast({ title: "Training Issue", description: data.feedback, variant: "destructive" })
        setLastFeedback(data.feedback)
        fetchLogs()
      }
    } catch (error: any) {
      console.error(error)
      toast({ title: "Training Error", description: error.message, variant: "destructive" })
    } finally {
      setTraining(false)
    }
  }

  const validSubServices = subServices.filter(ss => ss.serviceId === selectedServiceId)

  const parseBoldText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-bold text-indigo-950">{part.slice(2, -2)}</strong>
      }
      return <span key={i}>{part}</span>
    })
  }

  const formatProfileText = (text: string) => {
    return text.split("\n").map((line, i) => {
      if (line.startsWith("### ")) return <h3 key={i} className="text-lg font-bold text-indigo-900 mt-4 mb-2">{parseBoldText(line.replace("### ", ""))}</h3>
      if (line.startsWith("## ")) return <h2 key={i} className="text-xl font-extrabold text-indigo-950 mt-5 mb-2 border-b border-indigo-100 pb-1">{parseBoldText(line.replace("## ", ""))}</h2>
      if (line.startsWith("# ")) return <h1 key={i} className="text-2xl font-black text-indigo-950 mt-6 mb-3">{parseBoldText(line.replace("# ", ""))}</h1>
      if (line.startsWith("- ") || line.startsWith("* ")) return <li key={i} className="ml-6 mb-1 list-disc marker:text-indigo-400 text-gray-700">{parseBoldText(line.substring(2))}</li>
      if (!line.trim()) return <div key={i} className="h-2"></div>
      return <p key={i} className="mb-2 leading-relaxed text-gray-700">{parseBoldText(line)}</p>
    })
  }

  if (loading) {
    return <div className="flex items-center justify-center h-[calc(100vh-64px)]"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
  }

  const isStep1Valid = isGlobal || (selectedServiceId && selectedSubServiceId)
  const isStep3Valid = file !== null && allRecords.length > 0

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <BrainCircuit className="h-6 w-6 text-indigo-600" />
            AI Fine-Tuning & OKF Reverse Engineering
          </h1>
          <p className="text-sm text-gray-500 mt-1">Train the AI on your exact historical menus, dish structures, and client preferences.</p>
        </div>
      </div>

      {/* Wizard Progress Bar */}
      <div className="flex items-center justify-between mb-8 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-200 -z-10"></div>
        {[1, 2, 3, 4].map((step) => {
          const isSkipped = step === 3 && trainingSource === "db"
          if (isSkipped) return null

          const isActive = currentStep === step
          const isCompleted = currentStep > step

          return (
            <div key={step} className="flex flex-col items-center gap-2 bg-white px-3 z-10">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all ${
                isActive ? "border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-200" :
                isCompleted ? "border-indigo-600 bg-indigo-100 text-indigo-600" :
                "border-gray-300 bg-gray-50 text-gray-400"
              }`}>
                {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : step}
              </div>
              <span className={`text-xs font-semibold ${isActive ? "text-indigo-600" : "text-gray-500"}`}>
                {step === 1 ? "1. Target Service" : step === 2 ? "2. Data Source" : step === 3 ? "3. Excel & Mapping" : "4. Review & Train"}
              </span>
            </div>
          )
        })}
      </div>

      {/* STEP 1: TARGET CONFIGURATION */}
      {currentStep === 1 && (
        <Card className="border-indigo-100 shadow-sm">
          <CardHeader>
            <CardTitle>1. Select Target Service & Client Scope</CardTitle>
            <CardDescription>Specify which meal window and service type you are training. Optionally tag a client company.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2 pb-2">
              <Checkbox id="global" checked={isGlobal} onCheckedChange={(checked) => setIsGlobal(checked as boolean)} />
              <Label htmlFor="global" className="font-semibold cursor-pointer">Global Profile (Applies as baseline across all Services)</Label>
            </div>

            {!isGlobal && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-700 font-medium">Service (Meal Window)</Label>
                  <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="e.g. Breakfast, Lunch, Dinner..." /></SelectTrigger>
                    <SelectContent>
                      {services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-700 font-medium">Sub-Service (Service Type)</Label>
                  <Select value={selectedSubServiceId} onValueChange={setSelectedSubServiceId} disabled={!selectedServiceId}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="e.g. Buffet, Salad Bar..." /></SelectTrigger>
                    <SelectContent>
                      {validSubServices.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-gray-100">
              <div className="space-y-2">
                <Label className="text-gray-700 font-medium flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-500" />
                  Target Company / Client (Optional)
                </Label>
                <div className="flex flex-col gap-2 max-w-md max-h-[200px] overflow-y-auto border p-2 rounded-md bg-white">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="company-universal"
                      checked={selectedCompanyIds.includes("universal")}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedCompanyIds(["universal"])
                        } else {
                          setSelectedCompanyIds([])
                        }
                      }}
                    />
                    <Label htmlFor="company-universal" className="text-sm">🌟 Universal / Master Kitchen Menu (Applies to all clients)</Label>
                  </div>
                  {companies.map(c => (
                    <div key={c.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`company-${c.id}`}
                        checked={selectedCompanyIds.includes(c.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedCompanyIds(prev => [...prev.filter(id => id !== "universal"), c.id])
                          } else {
                            setSelectedCompanyIds(prev => prev.filter(id => id !== c.id))
                          }
                        }}
                      />
                      <Label htmlFor={`company-${c.id}`} className="text-sm">🏢 {c.name}</Label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500">
                  Select a company if you are uploading client-specific menus (e.g. Uber, Google). If training master kitchen menus, leave as Universal.
                </p>
              </div>
            </div>

            {existingProfile && (
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between gap-3 flex-wrap">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-indigo-950">Active Training Profile Found for this Service</span>
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">Active</Badge>
                  </div>
                  <p className="text-[11px] text-indigo-800 line-clamp-1">{lastFeedback || existingProfile.slice(0, 120) + "..."}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleOpenEditActiveProfile}
                    className="h-7 text-xs bg-white text-indigo-700 border-indigo-300 hover:bg-indigo-100 gap-1 font-medium"
                  >
                    <Pencil className="w-3 h-3" /> Edit Training
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteActiveProfile}
                    className="h-7 text-xs bg-white text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 gap-1 font-medium"
                  >
                    <Trash2 className="w-3 h-3" /> Remove Training
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-end">
            <Button onClick={() => setCurrentStep(2)} disabled={!isStep1Valid} className="bg-indigo-600 hover:bg-indigo-700">
              Next Step <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* STEP 2: SOURCE SELECTION */}
      {currentStep === 2 && (
        <Card className="border-indigo-100 shadow-sm">
          <CardHeader>
            <CardTitle>2. Choose Training Source</CardTitle>
            <CardDescription>How would you like to provide the training data for the AI brain?</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={trainingSource} onValueChange={(v: "excel" | "db") => setTrainingSource(v)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <RadioGroupItem value="excel" id="excel" className="peer sr-only" />
                <Label htmlFor="excel" className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-transparent p-6 hover:bg-slate-50 peer-data-[state=checked]:border-indigo-600 peer-data-[state=checked]:bg-indigo-50/50 cursor-pointer transition-all">
                  <FileSpreadsheet className="mb-3 h-10 w-10 text-indigo-600" />
                  <span className="font-semibold text-gray-900 text-base">Upload Historical Excel</span>
                  <span className="text-xs text-center mt-2 text-gray-500">
                    Upload your past catering spreadsheets. You will be able to visually preview and map rows & columns.
                  </span>
                </Label>
              </div>
              <div>
                <RadioGroupItem value="db" id="db" className="peer sr-only" />
                <Label htmlFor="db" className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-transparent p-6 hover:bg-slate-50 peer-data-[state=checked]:border-indigo-600 peer-data-[state=checked]:bg-indigo-50/50 cursor-pointer transition-all">
                  <BrainCircuit className="mb-3 h-10 w-10 text-indigo-600" />
                  <span className="font-semibold text-gray-900 text-base">Train From Database Menus</span>
                  <span className="text-xs text-center mt-2 text-gray-500">
                    Auto-extract all currently active Combined & Company menus from Firestore and learn structure assignments.
                  </span>
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(1)}>
              <ChevronLeft className="w-4 h-4 mr-2" /> Back
            </Button>
            <Button onClick={() => setCurrentStep(trainingSource === "excel" ? 3 : 4)} className="bg-indigo-600 hover:bg-indigo-700">
              Next Step <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* STEP 3: EXCEL UPLOAD & VISUAL ROW/COLUMN MAPPER */}
      {currentStep === 3 && trainingSource === "excel" && (
        <div className="space-y-6">
          <Card className="border-indigo-100 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl">3. Upload & Visually Map Excel Spreadsheet</CardTitle>
              <CardDescription>
                Click on any <span className="font-semibold text-indigo-700">Row</span> to set Header/Date rows, or any <span className="font-semibold text-indigo-700">Column</span> to map categories & dishes!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!file ? (
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-44 border-2 border-dashed border-indigo-200 rounded-lg cursor-pointer bg-indigo-50/20 hover:bg-indigo-50/50 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-10 h-10 mb-3 text-indigo-500" />
                      <p className="mb-2 text-sm text-gray-700 font-semibold">Click to upload or drag & drop</p>
                      <p className="text-xs text-gray-500">Excel files (.xlsx, .xls, .csv) — Single file upload</p>
                    </div>
                    <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
                  </label>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Uploaded File Bar */}
                  <div className="flex flex-wrap items-center justify-between bg-indigo-50/60 border border-indigo-100 p-4 rounded-lg gap-3">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-6 w-6 text-indigo-600" />
                      <div>
                        <div className="font-semibold text-indigo-950 text-sm">{file.name}</div>
                        <div className="text-xs text-indigo-600">
                          {(file.size / 1024).toFixed(1)} KB • {rawSheetRows.length} rows loaded
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {sheetNames.length > 1 && (
                        <div className="flex items-center gap-2">
                          <Label className="text-xs font-semibold text-indigo-900">Sheet:</Label>
                          <Select value={selectedSheet} onValueChange={handleSheetChange}>
                            <SelectTrigger className="h-8 bg-white text-xs w-[140px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {sheetNames.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <Button variant="outline" size="sm" onClick={() => { setFile(null); setWorkbook(null); setRawSheetRows([]) }}>
                        Replace File
                      </Button>
                    </div>
                  </div>

                  {/* VISUAL RAW SPREADSHEET INSPECTOR (CLICKABLE ROWS & COLUMNS) */}
                  <Card className="border-slate-200">
                    <CardHeader className="py-3 px-4 bg-slate-50 flex flex-row items-center justify-between border-b">
                      <div>
                        <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                          <MousePointerClick className="w-4 h-4 text-indigo-600" />
                          Interactive Spreadsheet Preview
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Click any <strong className="text-indigo-600">Row #</strong> to set Date/Header rows, or click any <strong className="text-indigo-600">Column header/cell</strong> to assign its role.
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className="bg-indigo-600 text-xs">📌 Row {headerRowIdx + 1}: Header</Badge>
                        <Badge className="bg-blue-600 text-xs">📅 Row {dateRowIdx + 1}: Dates</Badge>
                        <Badge variant="outline" className="text-emerald-700 border-emerald-300 text-xs">▶️ Row {dataStartRowIdx + 1}: Data</Badge>
                      </div>
                    </CardHeader>

                    {/* Table View */}
                    <CardContent className="p-0 max-h-[280px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-100 hover:bg-slate-100">
                            <TableHead className="w-24 text-center text-xs font-bold text-slate-600">Row Controls</TableHead>
                            {detectedHeaders.map((h, cIdx) => (
                              <TableHead 
                                key={cIdx} 
                                className={`text-xs whitespace-nowrap p-2 font-bold cursor-pointer transition-colors ${
                                  selectedCellCol === cIdx ? "bg-indigo-100/70 border-x-2 border-indigo-400" : "hover:bg-slate-200/60"
                                }`}
                                onClick={() => {
                                  setSelectedCellCol(cIdx)
                                  setSelectedRowIdx(null)
                                }}
                              >
                                <div className="flex flex-col gap-1 items-start w-full">
                                  <div className="flex items-center justify-between w-full gap-1.5">
                                    <span className="font-mono text-slate-500 text-[11px]">Col {getColLetter(cIdx)}</span>
                                    {cIdx === mealPlanColIdx ? (
                                      <Badge className="bg-purple-600 text-[10px] py-0 px-1">🍽️ Meal Plan</Badge>
                                    ) : cIdx === subMealPlanColIdx ? (
                                      <Badge className="bg-emerald-600 text-[10px] py-0 px-1">🥗 Sub-Plan</Badge>
                                    ) : selectedDayColIndices.includes(cIdx) ? (
                                      <Badge className="bg-blue-600 text-[10px] py-0 px-1">📅 Date</Badge>
                                    ) : (layoutMode === "vertical" && cIdx === itemColIdx) ? (
                                      <Badge className="bg-amber-600 text-[10px] py-0 px-1">🍲 Dish</Badge>
                                    ) : (layoutMode === "vertical" && cIdx === dateColIdx) ? (
                                      <Badge className="bg-sky-600 text-[10px] py-0 px-1">📆 Date</Badge>
                                    ) : cIdx === companyColIdx ? (
                                      <Badge className="bg-cyan-600 text-[10px] py-0 px-1">🏢 Client</Badge>
                                    ) : (
                                      <span className="text-[10px] text-slate-400 font-normal">Click to assign</span>
                                    )}
                                  </div>
                                  <span className="text-[11px] font-normal text-slate-600 truncate max-w-[130px]">
                                    {h.raw || "(Empty)"}
                                  </span>
                                </div>
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rawSheetRows.slice(0, 10).map((row, rIdx) => {
                            const isHeader = rIdx === headerRowIdx
                            const isDateRow = rIdx === dateRowIdx
                            const isDataStart = rIdx === dataStartRowIdx
                            const isRowSelected = selectedRowIdx === rIdx

                            return (
                              <TableRow 
                                key={rIdx} 
                                className={`transition-colors ${
                                  isRowSelected ? "bg-amber-50/80 border-y-2 border-amber-400" :
                                  isHeader && isDateRow ? "bg-purple-50/60 font-semibold border-y border-purple-200" :
                                  isHeader ? "bg-indigo-50/60 font-semibold border-y border-indigo-200" :
                                  isDateRow ? "bg-blue-50/60 font-semibold border-y border-blue-200" :
                                  isDataStart ? "bg-emerald-50/30" : ""
                                }`}
                              >
                                {/* Interactive Row Selection Cell */}
                                <TableCell 
                                  className="text-center text-xs font-mono cursor-pointer transition-colors p-1.5 hover:bg-slate-200/70 border-r"
                                  onClick={() => {
                                    setSelectedRowIdx(rIdx)
                                    setSelectedCellCol(null)
                                  }}
                                >
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span className="font-bold text-slate-700">Row {rIdx + 1}</span>
                                    {isHeader && <Badge className="bg-indigo-600 text-[9px] py-0 px-1 leading-tight">📌 Header</Badge>}
                                    {isDateRow && !isHeader && <Badge className="bg-blue-600 text-[9px] py-0 px-1 leading-tight">📅 Dates</Badge>}
                                    {isHeader && isDateRow && <Badge className="bg-purple-600 text-[9px] py-0 px-1 leading-tight">📌+📅 Both</Badge>}
                                    {isDataStart && <Badge variant="outline" className="text-emerald-700 border-emerald-300 text-[9px] py-0 px-1 leading-tight">▶️ Data Starts</Badge>}
                                  </div>
                                </TableCell>

                                {/* Column Data Cells */}
                                {detectedHeaders.map((_, cIdx) => (
                                  <TableCell 
                                    key={cIdx} 
                                    className={`text-xs max-w-[180px] truncate cursor-pointer transition-colors ${
                                      selectedCellCol === cIdx ? "bg-indigo-50/70 border-x-2 border-indigo-300 font-medium" : 
                                      isHeader ? "text-indigo-950 font-bold" :
                                      isDateRow ? "text-blue-950 font-semibold" :
                                      "text-slate-600 hover:bg-slate-50"
                                    }`}
                                    onClick={() => {
                                      setSelectedCellCol(cIdx)
                                      setSelectedRowIdx(null)
                                    }}
                                  >
                                    {row[cIdx] !== undefined ? String(row[cIdx]).replace(/\n/g, " ") : ""}
                                  </TableCell>
                                ))}
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>

                    {/* Interactive ROW Action Toolbar */}
                    {selectedRowIdx !== null && (
                      <div className="flex flex-wrap items-center justify-between bg-amber-50/90 border-t border-amber-200 px-4 py-2 text-xs">
                        <div className="flex items-center gap-2 text-amber-950 font-semibold">
                          <span>Selected <strong>Row {selectedRowIdx + 1}</strong> (Sample: {(rawSheetRows[selectedRowIdx] || []).filter(c => String(c).trim()).slice(0, 3).map(c => String(c).replace(/\n/g, " ")).join(" | ") || "Empty"})</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 text-xs bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                            onClick={() => {
                              setHeaderRowIdx(selectedRowIdx)
                              if (dataStartRowIdx <= selectedRowIdx) setDataStartRowIdx(selectedRowIdx + 1)
                              toast({ title: `Row ${selectedRowIdx + 1} set as Header Row` })
                            }}
                          >
                            📌 Set as Header Row
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 text-xs bg-white text-blue-700 border-blue-200 hover:bg-blue-50"
                            onClick={() => {
                              setDateRowIdx(selectedRowIdx)
                              if (dataStartRowIdx <= selectedRowIdx) setDataStartRowIdx(selectedRowIdx + 1)
                              toast({ title: `Row ${selectedRowIdx + 1} set as Date Row` })
                            }}
                          >
                            📅 Set as Date Row
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 text-xs bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                            onClick={() => {
                              setDataStartRowIdx(selectedRowIdx)
                              toast({ title: `Data will start reading from Row ${selectedRowIdx + 1}` })
                            }}
                          >
                            ▶️ Data Starts Here
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-500" onClick={() => setSelectedRowIdx(null)}>
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Interactive COLUMN Action Toolbar */}
                    {selectedCellCol !== null && (
                      <div className="flex flex-wrap items-center justify-between bg-indigo-50 border-t border-indigo-200 px-4 py-2 text-xs">
                        <div className="flex items-center gap-2 text-indigo-950 font-semibold">
                          <span>Selected <strong>Col {getColLetter(selectedCellCol)}</strong> ({detectedHeaders[selectedCellCol]?.raw || "Empty"})</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button size="sm" variant="outline" className="h-7 text-xs bg-white text-purple-700 border-purple-200 hover:bg-purple-50" onClick={() => setMealPlanColIdx(selectedCellCol)}>
                            🍽️ Set Meal Plan
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={() => setSubMealPlanColIdx(selectedCellCol)}>
                            🥗 Set Sub-Plan
                          </Button>
                          {layoutMode === "horizontal" ? (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-7 text-xs bg-white text-blue-700 border-blue-200 hover:bg-blue-50"
                              onClick={() => {
                                if (selectedDayColIndices.includes(selectedCellCol)) {
                                  setSelectedDayColIndices(selectedDayColIndices.filter(i => i !== selectedCellCol))
                                } else {
                                  setSelectedDayColIndices([...selectedDayColIndices, selectedCellCol])
                                }
                              }}
                            >
                              📅 {selectedDayColIndices.includes(selectedCellCol) ? "Unmark as Date" : "Mark as Date"}
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" className="h-7 text-xs bg-white text-amber-700 border-amber-200 hover:bg-amber-50" onClick={() => setItemColIdx(selectedCellCol)}>
                              🍲 Set as Dish
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="h-7 text-xs bg-white text-cyan-700 border-cyan-200 hover:bg-cyan-50" onClick={() => setCompanyColIdx(selectedCellCol)}>
                            🏢 Set as Client
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-500" onClick={() => setSelectedCellCol(null)}>
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>

                  {/* MAPPING SETTINGS CARD */}
                  <Card className="border-indigo-100 bg-indigo-50/20">
                    <CardHeader className="py-3 px-4 border-b border-indigo-100">
                      <CardTitle className="text-sm font-semibold text-indigo-950 flex items-center gap-2">
                        <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                        Configure Row & Column Mapping
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      {/* Row Mapping Row */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-3 border-b border-indigo-100">
                        {/* Header Row Selector */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-gray-800 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-indigo-600" />
                            Header Row (Column Labels)
                          </Label>
                          <Select value={String(headerRowIdx)} onValueChange={(val) => {
                            const idx = Number(val)
                            setHeaderRowIdx(idx)
                            if (dataStartRowIdx <= idx) setDataStartRowIdx(idx + 1)
                          }}>
                            <SelectTrigger className="bg-white h-9 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {rawSheetRows.slice(0, 10).map((r, i) => (
                                <SelectItem key={i} value={String(i)}>
                                  Row {i + 1}: {r.filter((c: any) => String(c).trim()).slice(0, 3).join(", ") || "(Empty)"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[11px] text-gray-500">Row containing column names like Category, Sub-Plan, etc.</p>
                        </div>

                        {/* Date Row Selector */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-gray-800 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-blue-600" />
                            Date Row (Where Dates Are Located)
                          </Label>
                          <Select value={String(dateRowIdx)} onValueChange={(val) => {
                            const idx = Number(val)
                            setDateRowIdx(idx)
                            if (dataStartRowIdx <= idx) setDataStartRowIdx(idx + 1)
                          }}>
                            <SelectTrigger className="bg-white h-9 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {rawSheetRows.slice(0, 10).map((r, i) => (
                                <SelectItem key={i} value={String(i)}>
                                  Row {i + 1}: {r.filter((c: any) => String(c).trim()).slice(0, 4).map((c: any) => formatExcelDate(c)).join(", ") || "(Empty)"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[11px] text-gray-500">Row containing Monday, Tuesday, or dates like 1st Oct.</p>
                        </div>

                        {/* Data Start Row Selector */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-gray-800 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                            Menu Data Starts At Row
                          </Label>
                          <Select value={String(dataStartRowIdx)} onValueChange={(val) => setDataStartRowIdx(Number(val))}>
                            <SelectTrigger className="bg-white h-9 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {rawSheetRows.slice(0, 12).map((r, i) => (
                                <SelectItem key={i} value={String(i)}>
                                  Row {i + 1}: {r.filter((c: any) => String(c).trim()).slice(0, 2).join(", ") || "(Empty)"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[11px] text-gray-500">First row that contains actual menu dishes.</p>
                        </div>
                      </div>

                      {/* Column Mapping Row */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Meal Plan Column */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-gray-800">
                            Meal Plan / Category Column <span className="text-red-500">*</span>
                          </Label>
                          <Select value={String(mealPlanColIdx)} onValueChange={(val) => setMealPlanColIdx(Number(val))}>
                            <SelectTrigger className="bg-white h-9 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {detectedHeaders.map(h => (
                                <SelectItem key={h.index} value={String(h.index)}>{h.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[11px] text-gray-500">e.g. Breads, Dal, Veg Gravy, Category...</p>
                        </div>

                        {/* Sub Meal Plan Column */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-gray-800">Sub Meal Plan Column (Optional)</Label>
                          <Select value={String(subMealPlanColIdx)} onValueChange={(val) => setSubMealPlanColIdx(Number(val))}>
                            <SelectTrigger className="bg-white h-9 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="-1">-- None (Not in Excel) --</SelectItem>
                              {detectedHeaders.map(h => (
                                <SelectItem key={h.index} value={String(h.index)}>{h.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[11px] text-gray-500">If your Excel doesn't have this, map it from DB on the right!</p>
                        </div>

                        {/* Layout Format */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-gray-800">Layout Format</Label>
                          <Select value={layoutMode} onValueChange={(val: "horizontal" | "vertical") => setLayoutMode(val)}>
                            <SelectTrigger className="bg-white h-9 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="horizontal">📅 Horizontal (Days/Dates are Columns)</SelectItem>
                              <SelectItem value="vertical">📋 Vertical (Items & Dates in Rows)</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-[11px] text-gray-500">Most catering menus have days across columns.</p>
                        </div>
                      </div>

                      {/* Layout-Specific Controls */}
                      {layoutMode === "vertical" ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-indigo-100">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-gray-800">Dish / Recipe Name Column <span className="text-red-500">*</span></Label>
                            <Select value={String(itemColIdx)} onValueChange={(val) => setItemColIdx(Number(val))}>
                              <SelectTrigger className="bg-white h-9 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {detectedHeaders.map(h => (
                                  <SelectItem key={h.index} value={String(h.index)}>{h.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-gray-800">Date Column (Optional)</Label>
                            <Select value={String(dateColIdx)} onValueChange={(val) => setDateColIdx(Number(val))}>
                              <SelectTrigger className="bg-white h-9 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="-1">-- None / General Menu --</SelectItem>
                                {detectedHeaders.map(h => (
                                  <SelectItem key={h.index} value={String(h.index)}>{h.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 pt-2 border-t border-indigo-100">
                          <Label className="text-xs font-semibold text-gray-800">
                            Active Day / Date Columns (Click to toggle)
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {detectedHeaders.filter(h => h.index !== mealPlanColIdx && h.index !== subMealPlanColIdx).map(h => {
                              const isChecked = selectedDayColIndices.includes(h.index)
                              return (
                                <button
                                  key={h.index}
                                  type="button"
                                  onClick={() => {
                                    if (isChecked) {
                                      setSelectedDayColIndices(selectedDayColIndices.filter(i => i !== h.index))
                                    } else {
                                      setSelectedDayColIndices([...selectedDayColIndices, h.index])
                                    }
                                  }}
                                  className={`px-2.5 py-1 rounded text-xs border font-medium transition-all ${
                                    isChecked 
                                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" 
                                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                                  }`}
                                >
                                  {h.raw || `Col ${getColLetter(h.index)}`}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* LIVE PREVIEW & MEAL PLAN DATABASE CUSTOMIZATION */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left: Parsed Data Preview & Per-Day Record Customization */}
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            Live Output Preview ({allRecords.length})
                          </h3>
                          {overrideCount > 0 && (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-medium">
                              ✏️ {overrideCount} customized
                            </Badge>
                          )}
                          {excludedCount > 0 && (
                            <Badge variant="outline" className="text-red-600 border-red-200 text-[10px]">
                              🚫 {excludedCount} excluded
                            </Badge>
                          )}
                        </div>

                        {/* Search and Day Filter Toolbar */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Select value={previewDayFilter} onValueChange={setPreviewDayFilter}>
                            <SelectTrigger className="h-7 text-xs w-[130px] bg-white">
                              <SelectValue placeholder="All Days" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">📅 All Days ({allRecords.length})</SelectItem>
                              {uniqueDates.map(d => (
                                <SelectItem key={d} value={d}>
                                  {d} ({allRecords.filter((r: any) => r.date === d).length})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <div className="relative w-[110px]">
                            <Search className="w-3 h-3 absolute left-2 top-2 text-gray-400" />
                            <Input
                              placeholder="Search..."
                              value={previewSearch}
                              onChange={(e) => setPreviewSearch(e.target.value)}
                              className="h-7 text-xs pl-6 bg-white"
                            />
                          </div>

                          <Button
                            size="sm"
                            onClick={handleOpenAddDish}
                            className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1 px-2.5 shadow-2xs font-medium"
                            title="Add extra dish record to preview"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Dish
                          </Button>

                          {(overrideCount > 0 || excludedCount > 0) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setRecordOverrides({})}
                              className="h-7 text-[11px] text-slate-500 hover:text-slate-800 px-2"
                              title="Reset all manual overrides"
                            >
                              Reset
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="border rounded-md max-h-[500px] overflow-auto bg-white shadow-2xs">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                              <TableHead className="text-xs py-2 w-[40px]">#</TableHead>
                              <TableHead className="text-xs py-2 cursor-pointer hover:bg-slate-100" onClick={() => { setSortColumn('trainingDate'); setSortDirection(prev => sortColumn === 'trainingDate' && prev === 'asc' ? 'desc' : 'asc') }}>
                                Training Date {sortColumn === 'trainingDate' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                              </TableHead>
                              <TableHead className="text-xs py-2 cursor-pointer hover:bg-slate-100" onClick={() => { setSortColumn('menuDate'); setSortDirection(prev => sortColumn === 'menuDate' && prev === 'asc' ? 'desc' : 'asc') }}>
                                Menu Date {sortColumn === 'menuDate' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                              </TableHead>
                              <TableHead className="text-xs py-2 cursor-pointer hover:bg-slate-100" onClick={() => { setSortColumn('service'); setSortDirection(prev => sortColumn === 'service' && prev === 'asc' ? 'desc' : 'asc') }}>
                                Service / Meal Time {sortColumn === 'service' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                              </TableHead>
                              <TableHead className="text-xs py-2 cursor-pointer hover:bg-slate-100" onClick={() => { setSortColumn('company'); setSortDirection(prev => sortColumn === 'company' && prev === 'asc' ? 'desc' : 'asc') }}>
                                Company {sortColumn === 'company' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                              </TableHead>
                              <TableHead className="text-xs py-2 cursor-pointer hover:bg-slate-100" onClick={() => { setSortColumn('mappedMealPlanName'); setSortDirection(prev => sortColumn === 'mappedMealPlanName' && prev === 'asc' ? 'desc' : 'asc') }}>
                                Meal Plan {sortColumn === 'mappedMealPlanName' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                              </TableHead>
                              <TableHead className="text-xs py-2 cursor-pointer hover:bg-slate-100" onClick={() => { setSortColumn('subMealPlan'); setSortDirection(prev => sortColumn === 'subMealPlan' && prev === 'asc' ? 'desc' : 'asc') }}>
                                Sub Meal Plan {sortColumn === 'subMealPlan' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                              </TableHead>
                              <TableHead className="text-xs py-2 cursor-pointer hover:bg-slate-100" onClick={() => { setSortColumn('items'); setSortDirection(prev => sortColumn === 'items' && prev === 'asc' ? 'desc' : 'asc') }}>
                                Item(s) {sortColumn === 'items' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                              </TableHead>
                              <TableHead className="text-xs py-2 w-[80px] text-right">Action</TableHead>
                            </TableRow>
                            <TableRow className="bg-slate-50 border-b shadow-sm sticky top-[36px] z-10">
                              <TableHead></TableHead>
                              <TableHead></TableHead>
                              <TableHead></TableHead>
                              <TableHead>
                                <Select value={previewServiceFilter} onValueChange={setPreviewServiceFilter}>
                                  <SelectTrigger className="h-7 text-[10px] bg-white"><SelectValue placeholder="All" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">All Services</SelectItem>
                                    <SelectItem value={services.find(s => s.id === selectedServiceId)?.name || "auto"}>{services.find(s => s.id === selectedServiceId)?.name || "Current"}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableHead>
                              <TableHead>
                                <Select value={previewCompanyFilter} onValueChange={setPreviewCompanyFilter}>
                                  <SelectTrigger className="h-7 text-[10px] bg-white"><SelectValue placeholder="All" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">All Companies</SelectItem>
                                    {Array.from(new Set(allRecords.map((r: any) => r.company))).map((c: any) => (
                                      <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableHead>
                              <TableHead>
                                <Select value={previewMealPlanFilter} onValueChange={setPreviewMealPlanFilter}>
                                  <SelectTrigger className="h-7 text-[10px] bg-white"><SelectValue placeholder="All" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">All Meal Plans</SelectItem>
                                    {Array.from(new Set(allRecords.map((r: any) => r.mappedMealPlanName || r.mealPlan))).map((mp: any) => (
                                      <SelectItem key={mp} value={mp}>{mp}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableHead>
                              <TableHead></TableHead>
                              <TableHead></TableHead>
                              <TableHead></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize).length > 0 ? filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((row, i) => (
                              <TableRow 
                                key={row.key || i}
                                className={`hover:bg-indigo-50/50 transition-colors ${row.isOverridden ? "bg-amber-50/40 border-l-2 border-l-amber-500" : ""}`}
                              >
                                <TableCell className="text-xs text-gray-500">{(currentPage - 1) * pageSize + i + 1}</TableCell>
                                <TableCell className="text-xs text-gray-500 whitespace-nowrap">{format(new Date(), "yyyy-MM-dd")}</TableCell>
                                <TableCell 
                                  className="text-xs whitespace-nowrap py-1.5 text-gray-600 font-medium cursor-pointer hover:text-indigo-600 hover:underline"
                                  onClick={() => handleOpenEditRecord(row)}
                                  title="Click to edit date/day"
                                >
                                  {row.date}
                                </TableCell>
                                <TableCell className="text-xs text-gray-500">{services.find(s => s.id === selectedServiceId)?.name || 'N/A'}</TableCell>
                                <TableCell 
                                  className="text-xs text-gray-600 cursor-pointer hover:text-indigo-600 hover:underline"
                                  onClick={() => handleOpenEditRecord(row)}
                                  title="Click to edit company"
                                >
                                  {row.company}
                                </TableCell>
                                <TableCell 
                                  className="text-xs font-medium py-1.5 max-w-[130px] truncate cursor-pointer group"
                                  onClick={() => handleOpenEditRecord(row)}
                                  title="Click to change Meal Plan for this dish"
                                >
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span className="group-hover:text-indigo-600 transition-colors">{row.mappedMealPlanName || row.mealPlan}</span>
                                    {row.isCustomAdded && <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 text-[9px] px-1 py-0 font-medium">Extra</Badge>}
                                    {row.isOverridden && <span className="text-[10px] text-amber-600 font-bold" title="Manually customized">✏️</span>}
                                  </div>
                                  {row.mappedMealPlanName !== row.mealPlan && (
                                    <span className="text-[10px] text-slate-400 block truncate">({row.mealPlan})</span>
                                  )}
                                </TableCell>
                                <TableCell 
                                  className="text-xs py-1.5 cursor-pointer"
                                  onClick={() => handleOpenEditRecord(row)}
                                  title="Click to change Sub Meal Plan for this dish"
                                >
                                  {row.isOverridden ? (
                                    <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-medium py-0">
                                      ✏️ {row.subMealPlan || "Auto (AI)"}
                                    </Badge>
                                  ) : row.isSubMealPlanFromDb ? (
                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] font-medium py-0">
                                      🏷️ {row.subMealPlan} (DB)
                                    </Badge>
                                  ) : row.subMealPlan ? (
                                    <span className="text-slate-700">{row.subMealPlan}</span>
                                  ) : (
                                    <span className="text-slate-400 italic text-[11px]">✨ Auto (AI)</span>
                                  )}
                                </TableCell>
                                <TableCell 
                                  className="text-xs py-1.5 max-w-[150px] truncate text-indigo-950 font-medium cursor-pointer hover:text-indigo-600 hover:underline"
                                  onClick={() => handleOpenEditRecord(row)}
                                  title="Click to edit dishes"
                                >
                                  {row.items}
                                </TableCell>
                                <TableCell className="text-xs py-1.5 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-800"
                                      title="Change Meal Plan or Sub Meal Plan for this day"
                                      onClick={() => handleOpenEditRecord(row)}
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                    {row.isOverridden && (
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6 text-slate-400 hover:text-slate-700"
                                        title="Reset to Excel default"
                                        onClick={() => handleResetRecordEdit(row.key)}
                                      >
                                        <RotateCcw className="w-3 h-3" />
                                      </Button>
                                    )}
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                      title="Exclude this dish from training"
                                      onClick={() => handleDeleteRecord(row.key)}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )) : (
                              <TableRow>
                                <TableCell colSpan={9} className="text-center text-xs text-amber-700 bg-amber-50 py-6">
                                  <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-amber-500" />
                                  {allRecords.length === 0 
                                    ? "No records detected with current mapping. Click on a column header or row above to adjust!"
                                    : "No records match your search or day filter."}
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                      
                      {/* Pagination Controls */}
                      <div className="flex justify-between items-center text-xs text-gray-500 mt-2">
                        <div>
                          Showing {filteredRecords.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}-{Math.min(currentPage * pageSize, filteredRecords.length)} of {filteredRecords.length} records (filtered from {allRecords.length} total)
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <span>Per page:</span>
                            <Select value={String(pageSize)} onValueChange={(val) => { setPageSize(Number(val)); setCurrentPage(1); }}>
                              <SelectTrigger className="h-7 w-[60px] text-xs bg-white"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="25">25</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                                <SelectItem value="100">100</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>Prev</Button>
                            <span className="px-1 text-xs">Page {currentPage} of {Math.max(1, Math.ceil(filteredRecords.length / pageSize))}</span>
                            <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredRecords.length / pageSize)))} disabled={currentPage === Math.max(1, Math.ceil(filteredRecords.length / pageSize)) || filteredRecords.length === 0}>Next</Button>
                          </div>
                        </div>
                      </div>

                      <p className="text-[11px] text-gray-500 italic mt-1">
                        💡 Tip: Click any row or the <Pencil className="w-3 h-3 inline mx-0.5 text-indigo-600" /> icon to override the Meal Plan or Sub Meal Plan for that specific day.
                      </p>
                    </div>

                    {/* Right: Meal Plan & Sub Meal Plan Database Customization */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-indigo-600" />
                          Database Customization ({allCategories.length} categories)
                        </h3>
                        {/* Add Extra Meal Plan from DB */}
                        <Select value={extraMpToAdd} onValueChange={(val) => { handleAddExtraMealPlan(val); setExtraMpToAdd("none"); }}>
                          <SelectTrigger className="h-7 text-xs w-[185px] bg-white border-indigo-200 text-indigo-700 font-medium hover:bg-indigo-50/50">
                            <Plus className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                            <SelectValue placeholder="Add Meal Plan from DB" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none" disabled>➕ Add DB Meal Plan...</SelectItem>
                            {mealPlans.map(mp => (
                              <SelectItem key={mp.id} value={mp.id}>
                                {mp.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-xs text-gray-500">
                        Map Excel categories to database Meal Plans, pick their Sub Meal Plans, or add extra categories from your database:
                      </p>

                      <div className="space-y-3 max-h-[380px] overflow-auto pr-1">
                        {allCategories.map((emp: string) => {
                          const isExtra = extraMealPlanCategories.includes(emp)
                          const curMapping = mealPlanMapping[emp] || { mealPlanId: "", subMealPlanIds: [] }
                          const selectedMpId = curMapping.mealPlanId
                          const selectedSmpIds = curMapping.subMealPlanIds || []
                          const matchingSubPlans = subMealPlans.filter(smp => smp.mealPlanId === selectedMpId)

                          return (
                            <div key={emp} className={`p-3 rounded-lg border shadow-2xs space-y-2.5 ${isExtra ? "bg-indigo-50/30 border-indigo-200" : "bg-white border-slate-200"}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <Label className="text-indigo-950 font-bold text-xs truncate max-w-[190px]">{emp}</Label>
                                  {isExtra && (
                                    <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 text-[9px] font-semibold py-0">Extra DB</Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {selectedMpId ? (
                                    <Badge className="bg-green-100 text-green-800 text-[10px] hover:bg-green-100">
                                      {selectedSmpIds.length > 0 ? "Fully Mapped" : "Category Mapped"}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-amber-700 border-amber-300 text-[10px]">Unmapped</Badge>
                                  )}
                                  {isExtra && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                      onClick={() => handleRemoveExtraCategory(emp)}
                                      title="Remove extra category"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </div>

                              {/* 1. Meal Plan Selector */}
                              <div className="space-y-1">
                                <Label className="text-[11px] text-slate-500 font-medium">1. Map to Database Meal Plan:</Label>
                                <Select 
                                  value={selectedMpId || "none"} 
                                  onValueChange={(mpId) => setMealPlanMapping(prev => ({
                                    ...prev,
                                    [emp]: { mealPlanId: mpId === "none" ? "" : mpId, subMealPlanIds: [] }
                                  }))}
                                >
                                  <SelectTrigger className="bg-slate-50 h-8 text-xs"><SelectValue placeholder="Select Database Meal Plan..." /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none" disabled>Select Database Meal Plan...</SelectItem>
                                    {mealPlans.map(mp => (
                                      <SelectItem key={mp.id} value={mp.id}>{mp.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* 2. Sub Meal Plan Selector */}
                              {selectedMpId && (
                                <div className="space-y-1 pt-1 border-t border-slate-100">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-[11px] text-slate-600 font-medium">2. Select Database Sub Meal Plan (Course):</Label>
                                    {selectedSmpIds.length > 0 && (
                                      <span 
                                        className="text-[10px] text-indigo-600 font-semibold cursor-pointer hover:underline" 
                                        onClick={() => setMealPlanMapping(prev => ({
                                          ...prev,
                                          [emp]: { ...prev[emp], subMealPlanIds: [] }
                                        }))}
                                      >
                                        Reset to Auto
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto border p-2 rounded-md bg-white">
                                    {matchingSubPlans.length > 0 ? (
                                      matchingSubPlans.map(s => (
                                        <div key={s.id} className="flex items-center gap-2">
                                          <Checkbox
                                            id={`smp-${emp}-${s.id}`}
                                            checked={selectedSmpIds.includes(s.id)}
                                            onCheckedChange={(checked) => {
                                              const updated = checked 
                                                ? [...selectedSmpIds, s.id] 
                                                : selectedSmpIds.filter(id => id !== s.id);
                                              setMealPlanMapping(prev => ({
                                                ...prev,
                                                [emp]: {
                                                  ...prev[emp],
                                                  subMealPlanIds: updated
                                                }
                                              }))
                                            }}
                                          />
                                          <Label htmlFor={`smp-${emp}-${s.id}`} className="text-xs">🏷️ {s.name}</Label>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="text-xs text-gray-500 italic p-1">No sub-plans defined for this meal plan</div>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-400">
                                    {selectedSmpIds.length > 0
                                      ? `Items will be assigned to these sub-meal plans.` 
                                      : `AI will automatically categorize items into: ${matchingSubPlans.map(s => s.name).join(", ") || "default"}.`}
                                  </p>
                                </div>
                              )}

                              {/* Inline Add Dish Row Button */}
                              <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenAddDishForCategory(emp)}
                                  className="h-6 text-[10px] text-indigo-700 hover:bg-indigo-50 hover:text-indigo-900 gap-1 px-2 font-medium"
                                >
                                  <Plus className="w-3 h-3 text-indigo-600" /> Add Dish Row
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setCurrentStep(2)}>
                <ChevronLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button onClick={() => setCurrentStep(4)} disabled={!isStep3Valid} className="bg-indigo-600 hover:bg-indigo-700">
                Next Step <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* STEP 4: REVIEW & TRAIN */}
      {currentStep === 4 && (
        <Card className="border-indigo-100 shadow-sm">
          <CardHeader>
            <CardTitle>4. Review & Start AI Training</CardTitle>
            <CardDescription>Verify your training payload and choose the AI provider to fine-tune your OKF profile.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
                <h4 className="font-semibold text-slate-800 text-sm">Target Scope</h4>
                <div className="text-xs text-slate-600 space-y-1">
                  <div><strong>Scope:</strong> {isGlobal ? "Global Base Profile" : "Specific Service"}</div>
                  {!isGlobal && (
                    <>
                      <div><strong>Service:</strong> {services.find(s => s.id === selectedServiceId)?.name || selectedServiceId}</div>
                      <div><strong>Sub-Service:</strong> {subServices.find(s => s.id === selectedSubServiceId)?.name || selectedSubServiceId}</div>
                    </>
                  )}
                  <div><strong>Client Scope:</strong> {selectedCompanyIds.includes("universal") ? "🌟 Universal (Master Kitchen)" : `🏢 ${companies.filter(c => selectedCompanyIds.includes(c.id)).map(c => c.name).join(", ")}`}</div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
                <h4 className="font-semibold text-slate-800 text-sm">Training Data Payload</h4>
                <div className="text-xs text-slate-600 space-y-1">
                  <div><strong>Source:</strong> {trainingSource === "excel" ? "Excel Spreadsheet" : "Database Menus"}</div>
                  {trainingSource === "excel" && (
                    <>
                      <div><strong>File:</strong> {file?.name}</div>
                      <div><strong>Extracted Dishes:</strong> {allRecords.length} records ready</div>
                      <div><strong>Categories Mapped:</strong> {Object.keys(mealPlanMapping).filter(k => !!mealPlanMapping[k]?.mealPlanId).length} / {detectedExcelMealPlans.length}</div>
                      {overrideCount > 0 && (
                        <div className="text-amber-800 font-medium"><strong>Custom Overrides:</strong> ✏️ {overrideCount} dishes customized for specific days</div>
                      )}
                      {excludedCount > 0 && (
                        <div className="text-red-700"><strong>Excluded Dishes:</strong> 🚫 {excludedCount} rows excluded</div>
                      )}
                    </>
                  )}
                  {trainingSource === "db" && (
                    <div><strong>Action:</strong> Training on all active company & combined menus in system</div>
                  )}
                </div>
              </div>
            </div>

            {/* AI Model Selector */}
            <div className="bg-indigo-50/50 p-4 rounded-lg border border-indigo-100 space-y-2">
              <Label className="font-semibold text-indigo-950 text-sm">AI Engine Provider</Label>
              <Select value={aiModel} onValueChange={setAiModel}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini">Google Gemini (Flash Engine - High Quota & Fast)</SelectItem>
                  <SelectItem value="ollama">Local Hardware (Ollama / Llama 3.1 - Offline Backup)</SelectItem>
                  <SelectItem value="nara">Nara Cloud (Claude Sonnet 5 - Deep Reasoning)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-indigo-700">
                Google Gemini connects directly with multi-tier quota-safe fallback. Local hardware runs offline on Ollama.
              </p>
            </div>

            {/* Existing Profile Accordion / View */}
            {existingProfile && (
              <div className="border border-indigo-100 rounded-lg p-4 bg-indigo-50/20 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-slate-800">Current Active Profile Preview</h4>
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-semibold">Active in AI Brain</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleOpenEditActiveProfile}
                      className="h-7 text-xs gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50 bg-white"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit Training
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleDeleteActiveProfile}
                      className="h-7 text-xs gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 bg-white"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove Training
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-slate-600 line-clamp-3 bg-white p-2.5 rounded border border-slate-200 font-mono text-[11px]">
                  {existingProfile}
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-between pt-4 border-t">
            <Button variant="outline" onClick={() => setCurrentStep(trainingSource === "excel" ? 3 : 2)}>
              <ChevronLeft className="w-4 h-4 mr-2" /> Back
            </Button>
            <Button onClick={handleTrainAI} disabled={training} className="bg-indigo-600 hover:bg-indigo-700">
              {training ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BrainCircuit className="w-4 h-4 mr-2" />}
              {training ? "Fine-Tuning AI Brain..." : "Start AI Training"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* TRAINING PROGRESS OVERLAY */}
      {training && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 flex flex-col items-center justify-center space-y-4 shadow-inner">
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
            <BrainCircuit className="h-12 w-12 text-indigo-600 animate-pulse relative z-10" />
          </div>
          <div className="text-center max-w-md">
            <h3 className="text-lg font-semibold text-indigo-900">Reverse-Engineering OKF Knowledge</h3>
            <p className="text-xs text-indigo-700 mt-1">
              Analyzing dish combinations, day-of-week frequencies, dietary balances, and synthesizing into machine-readable rules...
            </p>
          </div>
        </div>
      )}

      {/* TRAINING HISTORY TABLE */}
      {trainingLogs.length > 0 && !training && (
        <Card className="border-gray-200 bg-white shadow-sm overflow-hidden mt-6">
          <CardHeader className="bg-gray-50 border-b border-gray-200 pb-3">
            <CardTitle className="text-lg text-gray-800">Training History & Profile Logs</CardTitle>
            <CardDescription className="text-xs">Audit trail of past fine-tuning sessions and what rules the AI adopted.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date & Time</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Model</TableHead>
                  <TableHead className="text-xs">Analysis Summary</TableHead>
                  <TableHead className="text-right text-xs">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trainingLogs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium text-xs whitespace-nowrap">
                      {log.timestamp ? format(log.timestamp.toDate(), "MMM d, yyyy HH:mm") : "Just now"}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        log.status === "success" ? "bg-green-100 text-green-800" :
                        log.status === "duplicate_data" ? "bg-yellow-100 text-yellow-800" :
                        "bg-red-100 text-red-800"
                      }`}>
                        {log.status === "success" ? "Success" : log.status === "duplicate_data" ? "Duplicate" : "Issue"}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-gray-500 font-mono">
                      {log.aiModel || "gemini"}
                    </TableCell>
                    <TableCell className="max-w-[320px] truncate text-xs text-gray-600">
                      {log.feedback}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setViewLog(log)}>View Details</Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs text-indigo-700 hover:bg-indigo-50 border-indigo-200 px-2"
                          onClick={() => handleOpenEditLog(log)}
                          title="Edit profile & advisory for this log"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200 px-2"
                          onClick={() => handleDeleteLog(log.id)}
                          title="Delete this training log"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* VIEW LOG MODAL */}
      <Dialog open={!!viewLog} onOpenChange={(open) => !open && setViewLog(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Training Session Audit</DialogTitle>
            <DialogDescription>
              {viewLog?.timestamp ? format(viewLog.timestamp.toDate(), "MMMM d, yyyy 'at' h:mm a") : ""}
            </DialogDescription>
          </DialogHeader>
          {viewLog && (
            <div className="space-y-6 mt-4">
              <div className={`p-4 rounded-md border-l-4 ${
                viewLog.status === "success" ? "bg-green-50 border-green-500" : 
                viewLog.status === "duplicate_data" ? "bg-yellow-50 border-yellow-500" : 
                "bg-red-50 border-red-500"
              }`}>
                <h3 className="font-semibold text-gray-900 mb-1 text-sm">Feedback</h3>
                <p className="text-gray-700 text-xs">{viewLog.feedback}</p>
              </div>

              {viewLog.advisory && (
                <div className="p-4 rounded-md bg-amber-50 border-l-4 border-amber-500">
                  <h3 className="font-semibold text-amber-900 mb-1 text-sm">Strategic Advisory</h3>
                  <p className="text-amber-800 text-xs whitespace-pre-wrap">{viewLog.advisory}</p>
                </div>
              )}

              {viewLog.profileText && (
                <div className="mt-4 border-t pt-4">
                  <h3 className="font-semibold text-gray-900 mb-3 text-base">Synthesized OKF Profile</h3>
                  <div className="max-w-none text-xs text-gray-800 bg-slate-50 p-4 rounded-md border border-slate-200">
                    {formatProfileText(viewLog.profileText)}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t mt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteLog(viewLog.id)}
                  className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200 h-8 gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Log
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEditLog(viewLog)}
                    className="text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50 h-8 gap-1.5"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit Profile Text
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewLog(null)}
                    className="text-xs h-8"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* DIALOG: EDIT SPECIFIC DAY RECORD */}
      <Dialog open={!!editingRecord} onOpenChange={(open) => { if (!open) setEditingRecord(null) }}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Pencil className="w-4 h-4 text-indigo-600" />
              Edit Specific Day Record
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Customize the Meal Plan and Sub Meal Plan for this specific day entry before training the AI.
            </DialogDescription>
          </DialogHeader>

          {editingRecord && (
            <div className="space-y-3.5 py-2">
              {/* 1. Dish Item(s) Editable Textarea */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-800">
                  🍲 Dish Item(s) <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  rows={2}
                  value={editItems}
                  onChange={(e) => setEditItems(e.target.value)}
                  placeholder="e.g. Paneer Butter Masala, Butter Naan"
                  className="text-xs bg-white border-slate-300 font-medium"
                />
                <p className="text-[10px] text-gray-400">
                  Edit dish names, fix spelling, or separate multiple dishes with commas.
                </p>
              </div>

              {/* 2. Menu Date / Day & Client Company */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-800">
                    📅 Date / Day
                  </Label>
                  <Select value={editDate} onValueChange={setEditDate}>
                    <SelectTrigger className="bg-white h-9 text-xs">
                      <SelectValue placeholder="Date/Day..." />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueDates.map(d => (
                        <SelectItem key={d} value={d}>📅 {d}</SelectItem>
                      ))}
                      <SelectItem value="custom">✏️ Custom...</SelectItem>
                    </SelectContent>
                  </Select>
                  {editDate === "custom" && (
                    <Input
                      placeholder="e.g. Monday"
                      value={editCustomDate}
                      onChange={(e) => setEditCustomDate(e.target.value)}
                      className="h-8 text-xs bg-white mt-1"
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-800">
                    🏢 Client Company
                  </Label>
                  <Select value={editCompany} onValueChange={setEditCompany}>
                    <SelectTrigger className="bg-white h-9 text-xs">
                      <SelectValue placeholder="Company..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Universal">🌟 Universal</SelectItem>
                      {companies.map(c => (
                        <SelectItem key={c.id} value={c.name}>🏢 {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Meal Plan Select */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-800">
                  Meal Plan (Food Category) <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={editMpId || "unmapped"}
                  onValueChange={(val) => {
                    setEditMpId(val)
                    setEditSmpId("auto")
                    setEditCustomSmpName("")
                  }}
                >
                  <SelectTrigger className="bg-white h-9 text-xs">
                    <SelectValue placeholder="Select Database Meal Plan..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unmapped">
                      -- Keep Original ({editingRecord.mealPlan}) --
                    </SelectItem>
                    {mealPlans.filter(mp => Boolean(mp.id)).map(mp => (
                      <SelectItem key={mp.id} value={mp.id}>
                        {mp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sub Meal Plan Select */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-800">
                  Sub Meal Plan (Course Slot)
                </Label>
                <Select
                  value={editSmpId || "auto"}
                  onValueChange={(val) => {
                    setEditSmpId(val)
                    if (val !== "custom" && val !== "auto") {
                      const smp = subMealPlans.find(s => s.id === val)
                      if (smp) setEditCustomSmpName(smp.name)
                    }
                  }}
                >
                  <SelectTrigger className="bg-white h-9 text-xs">
                    <SelectValue placeholder="Select Sub Meal Plan..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">✨ Auto-classify (Let AI assign)</SelectItem>
                    {subMealPlans
                      .filter(smp => Boolean(smp.id) && (!editMpId || editMpId === "unmapped" || smp.mealPlanId === editMpId))
                      .map(smp => (
                        <SelectItem key={smp.id} value={smp.id}>
                          🏷️ {smp.name}
                        </SelectItem>
                      ))}
                    <SelectItem value="custom">✏️ Custom Sub Meal Plan Name...</SelectItem>
                  </SelectContent>
                </Select>

                {editSmpId === "custom" && (
                  <div className="pt-1.5">
                    <Input
                      placeholder="Enter custom sub-meal plan name (e.g. Garlic Naan)..."
                      value={editCustomSmpName}
                      onChange={(e) => setEditCustomSmpName(e.target.value)}
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                )}
              </div>

              {/* Bulk Apply Checkbox */}
              <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
                <Checkbox
                  id="applyMatching"
                  checked={applyToMatchingDishes}
                  onCheckedChange={(c) => setApplyToMatchingDishes(!!c)}
                />
                <label
                  htmlFor="applyMatching"
                  className="text-xs text-slate-700 cursor-pointer select-none leading-tight"
                >
                  Also apply this to all other dishes under <strong>&quot;{editingRecord.mealPlan}&quot;</strong> on <strong>{editingRecord.date}</strong>
                </label>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t">
            <div className="flex items-center gap-1.5">
              {editingRecord?.isOverridden && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleResetRecordEdit(editingRecord.key)}
                  className="text-xs text-slate-600 h-8"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> Revert
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleDeleteRecord(editingRecord.key)}
                className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200 h-8"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Exclude
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditingRecord(null)}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveRecordEdit}
                className="bg-indigo-600 hover:bg-indigo-700 text-xs h-8"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG: ADD DISH / RECORD TO LIVE OUTPUT */}
      <Dialog open={isAddDishOpen} onOpenChange={setIsAddDishOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-600" />
              Add Dish Record to Output
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Inject an extra dish record under any database Meal Plan and Sub Meal Plan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 1. Date / Day */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-800">
                Menu Date / Day <span className="text-red-500">*</span>
              </Label>
              <Select
                value={newDishDate}
                onValueChange={(val) => setNewDishDate(val)}
              >
                <SelectTrigger className="bg-white h-9 text-xs">
                  <SelectValue placeholder="Select Date or Day..." />
                </SelectTrigger>
                <SelectContent>
                  {uniqueDates.map(d => (
                    <SelectItem key={d} value={d}>📅 {d}</SelectItem>
                  ))}
                  <SelectItem value="custom">✏️ Custom Date / Day...</SelectItem>
                </SelectContent>
              </Select>
              {newDishDate === "custom" && (
                <div className="pt-1">
                  <Input
                    placeholder="e.g. 2026-10-05 (Mon) or Day 1"
                    value={newDishCustomDate}
                    onChange={(e) => setNewDishCustomDate(e.target.value)}
                    className="h-8 text-xs bg-white"
                  />
                </div>
              )}
            </div>

            {/* 2. Client Company */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-800">
                Client Company
              </Label>
              <Select
                value={newDishCompany}
                onValueChange={setNewDishCompany}
              >
                <SelectTrigger className="bg-white h-9 text-xs">
                  <SelectValue placeholder="Select Company..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Universal">🌟 Universal / Master Kitchen</SelectItem>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={c.name}>🏢 {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 3. Meal Plan (from DB) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-800">
                Meal Plan (Food Category) <span className="text-red-500">*</span>
              </Label>
              <Select
                value={newDishMpId || "none"}
                onValueChange={(val) => {
                  setNewDishMpId(val === "none" ? "" : val)
                  setNewDishSmpIds([])
                }}
              >
                <SelectTrigger className="bg-white h-9 text-xs">
                  <SelectValue placeholder="Select Database Meal Plan..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>Select Meal Plan...</SelectItem>
                  {mealPlans.map(mp => (
                    <SelectItem key={mp.id} value={mp.id}>
                      {mp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 4. Sub Meal Plan(s) (from DB) */}
            {newDishMpId && (
              <div className="space-y-1.5 pt-1 border-t border-slate-100">
                <Label className="text-xs font-semibold text-gray-800">
                  Sub Meal Plan(s) (Course Slot)
                </Label>
                <div className="flex flex-col gap-1.5 max-h-[130px] overflow-y-auto border p-2 rounded-md bg-white">
                  {subMealPlans.filter(s => s.mealPlanId === newDishMpId).length > 0 ? (
                    subMealPlans.filter(s => s.mealPlanId === newDishMpId).map(s => (
                      <div key={s.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`newdish-smp-${s.id}`}
                          checked={newDishSmpIds.includes(s.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setNewDishSmpIds(prev => [...prev, s.id])
                            } else {
                              setNewDishSmpIds(prev => prev.filter(id => id !== s.id))
                            }
                          }}
                        />
                        <Label htmlFor={`newdish-smp-${s.id}`} className="text-xs">🏷️ {s.name}</Label>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-gray-500 italic p-1">No sub-plans defined for this meal plan in DB.</div>
                  )}
                </div>
                <div className="pt-1">
                  <Input
                    placeholder="Optional custom sub-meal plan name (e.g. Garlic Naan)..."
                    value={newDishCustomSmp}
                    onChange={(e) => setNewDishCustomSmp(e.target.value)}
                    className="h-8 text-xs bg-white"
                  />
                </div>
              </div>
            )}

            {/* 5. Dish Items */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-800">
                Dish Item(s) <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="e.g. Paneer Lababdar, Butter Naan, Steamed Rice"
                value={newDishItems}
                onChange={(e) => setNewDishItems(e.target.value)}
                className="h-9 text-xs bg-white"
              />
              <p className="text-[10px] text-gray-400">Separate multiple items with commas if needed.</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsAddDishOpen(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveNewDish}
              className="bg-indigo-600 hover:bg-indigo-700 text-xs h-8"
            >
              Add to Output
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG: EDIT TRAINING PROFILE */}
      <Dialog open={editingProfileOpen} onOpenChange={setEditingProfileOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Pencil className="w-4 h-4 text-indigo-600" />
              {editingLogId ? "Edit Training Log & Profile" : "Edit Active AI Training Profile"}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Directly edit the AI rules, guidelines, and dietary knowledge for this service.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-800">
                Synthesized OKF Profile (Markdown Rules)
              </Label>
              <Textarea
                rows={16}
                value={editProfileText}
                onChange={(e) => setEditProfileText(e.target.value)}
                placeholder="Markdown formatted OKF training profile and catering rules..."
                className="font-mono text-xs leading-relaxed bg-slate-50 border-slate-200"
              />
              <p className="text-[10px] text-gray-400">
                Use markdown (# Headings, - Bullet points, **bold**) to define food structure rules.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-800">
                Strategic Advisory (Optional)
              </Label>
              <Textarea
                rows={3}
                value={editAdvisoryText}
                onChange={(e) => setEditAdvisoryText(e.target.value)}
                placeholder="Operational advice, cost suggestions, variety notes..."
                className="text-xs bg-slate-50 border-slate-200"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-800">
                Analysis Summary / Feedback (Optional)
              </Label>
              <Input
                value={editFeedbackText}
                onChange={(e) => setEditFeedbackText(e.target.value)}
                placeholder="Brief summary of what was trained..."
                className="h-8 text-xs bg-slate-50 border-slate-200"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t">
            {!editingLogId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingProfileOpen(false)
                  handleDeleteActiveProfile()
                }}
                className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200 h-8"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove Training
              </Button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditingProfileOpen(false)}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={savingProfileEdit}
                onClick={handleSaveProfileEdit}
                className="bg-indigo-600 hover:bg-indigo-700 text-xs h-8"
              >
                {savingProfileEdit ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
