"use client"

import React, { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { db } from "@/lib/firebase"
import { collection, getDocs } from "firebase/firestore"
import { complianceTemplatesService, type ComplianceTemplate, type ComplianceTemplateType } from "@/lib/firestore/complianceTemplatesService"
import { complianceTemplateFieldsService } from "@/lib/firestore/complianceTemplateFieldsService"
import { complianceRecordsService, type ComplianceRecord } from "@/lib/firestore/complianceRecordsService"
import { toast } from "@/hooks/use-toast"

// Also keep backward compat with old forms
import { complianceFormsService, type ComplianceForm } from "@/lib/firestore/complianceFormsService"
import { useAuth } from "@/hooks/use-auth"

import {
  Plus, Pencil, Trash2, Ban, CheckCircle, ClipboardList, ListChecks,
  Thermometer, Truck, UtensilsCrossed, FileCheck, Search, Filter,
  Calendar, Building2, Eye, ChevronRight, BarChart3, AlertTriangle,
  Clock, CheckCircle2, Download, Loader2, BookOpen, ShieldCheck, Camera,
  Sparkles, CheckSquare, Layers, HelpCircle, X
} from "lucide-react"
import ExcelJS from "exceljs"
import { saveAs } from "file-saver"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ComplianceRecordModal } from "@/components/compliance-record-modal"

// ─── Template Type Config ───────────────────────────────────────
const TEMPLATE_TYPE_CONFIG: Record<ComplianceTemplateType, {
  label: string
  icon: React.ElementType
  color: string
  bgColor: string
  borderColor: string
  description: string
}> = {
  kitchen_readiness: {
    label: 'Kitchen Readiness',
    icon: Thermometer,
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    description: 'Batch-wise temperature recording when food leaves the kitchen'
  },
  dispatch: {
    label: 'Dispatch',
    icon: Truck,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    description: 'Vehicle condition + quantity + temp at dispatch time'
  },
  service_point: {
    label: 'Service Point',
    icon: UtensilsCrossed,
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    description: 'Temperature recording when food service starts at company'
  },
  general_checklist: {
    label: 'General Checklist',
    icon: FileCheck,
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    description: 'Standard yes/no, text, photo compliance questions'
  },
}

const TABS = [
  { id: 'templates', label: 'Templates', icon: ListChecks },
  { id: 'records', label: 'Records', icon: ClipboardList },
  { id: 'legacy', label: 'Legacy Forms', icon: FileCheck },
] as const
type TabId = typeof TABS[number]['id']

export default function ComplianceDashboardPage() {
  const { userProfile, userType } = useAuth()
  const [activeTab, setActiveTab] = useState<TabId>('templates')
  
  // Templates
  const [templates, setTemplates] = useState<ComplianceTemplate[]>([])
  const [legacyForms, setLegacyForms] = useState<ComplianceForm[]>([])
  const [records, setRecords] = useState<ComplianceRecord[]>([])
  const [loading, setLoading] = useState(true)
  
  // Lookup data
  const [vendors, setVendors] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [buildings, setBuildings] = useState<any[]>([])
  const [cafeterias, setCafeterias] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  
  // Filters
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [filterVendor, setFilterVendor] = useState<string>("all")
  const [filterCompany, setFilterCompany] = useState<string>("all")
  const [filterBuilding, setFilterBuilding] = useState<string>("all")
  const [filterCafeteria, setFilterCafeteria] = useState<string>("all")
  const [filterFacilityQuick, setFilterFacilityQuick] = useState<'all' | 'OB' | 'MPT'>('all')
  const [filterCategoryQuick, setFilterCategoryQuick] = useState<string>('all')

  // Checkpoints Inspection Modal
  const [selectedTemplateForQuestions, setSelectedTemplateForQuestions] = useState<ComplianceTemplate | null>(null)
  const [templateQuestions, setTemplateQuestions] = useState<any[]>([])
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [questionModalOpen, setQuestionModalOpen] = useState(false)

  // Sodexo FM Operational Plan Modal
  const [sodexoPlanModalOpen, setSodexoPlanModalOpen] = useState(false)

  // Record Modal
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const [recordModalOpen, setRecordModalOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    try {
      setLoading(true)
      let [
        templatesRes,
        formsRes,
        recentRecords,
        pendingRecords,
        vSnap,
        cSnap,
        bSnap,
        cafeSnap,
        rSnap
      ] = await Promise.all([
        complianceTemplatesService.getAll().catch(() => []),
        complianceFormsService.getAll().catch(() => []),
        complianceRecordsService.getRecent(50).catch(() => []),
        complianceRecordsService.getPending().catch(() => []),
        getDocs(collection(db, 'vendors')),
        getDocs(collection(db, 'companies')),
        getDocs(collection(db, 'buildings')),
        getDocs(collection(db, 'cafetarias')),
        getDocs(collection(db, 'roles')),
      ])
      setTemplates(templatesRes)
      setLegacyForms(formsRes)
      
      // Merge recent and pending records, keeping unique by id
      const allRecordsMap = new Map()
      pendingRecords.forEach(r => allRecordsMap.set(r.id, r))
      recentRecords.forEach(r => allRecordsMap.set(r.id, r))
      let mergedRecords = Array.from(allRecordsMap.values()).sort((a, b) => {
        const timeA = a.date ? new Date(a.date).getTime() : (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0);
        const timeB = b.date ? new Date(b.date).getTime() : (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0);
        return timeB - timeA;
      })

      let allCompanies = cSnap.docs.map(d => ({ id: d.id, ...d.data() }))

      // --- DATA ISOLATION ---
      // 1. Filter by Company IDs if assigned
      if (userProfile?.companyIds?.length) {
        allCompanies = allCompanies.filter(c => userProfile.companyIds.includes(c.id))
        mergedRecords = mergedRecords.filter(r => 
          (r.companyId && userProfile.companyIds.includes(r.companyId)) ||
          (r.cafeteriaId && userProfile.cafeteriaIds?.includes(r.cafeteriaId))
        )
      }

      // 2. Filter by Vendor ID if assigned
      if (userProfile?.vendorId) {
        allCompanies = allCompanies.filter(c => (c as any).vendorIds?.includes(userProfile.vendorId))
        mergedRecords = mergedRecords.filter(r => r.vendorId === userProfile.vendorId)
        templatesRes = templatesRes.filter(t => t.vendorId === userProfile.vendorId)
      }

      // 3. Operational compliance permissions filtering
      if (userType !== 'super_admin') {
        const canTemp = !!userProfile?.canAccessTemperature
        const canVendorSop = !!userProfile?.canAccessVendorSOP
        const canFefo = !!userProfile?.canAccessFefo

        templatesRes = templatesRes.filter(t => {
          const type = t.type || ''
          const isTemp = type === 'kitchen_readiness' || type === 'dispatch' || type === 'service_point' || t.name.toLowerCase().includes('temp')
          const isVendorSop = type.includes('vendor') || type.includes('sop') || t.name.toLowerCase().includes('sop')
          const isFefo = t.name.toLowerCase().includes('fefo') || t.name.toLowerCase().includes('fifo')

          if (isTemp && !canTemp) return false
          if (isVendorSop && !canVendorSop) return false
          if (isFefo && !canFefo) return false
          return true
        })

        mergedRecords = mergedRecords.filter(r => {
          const name = ((r as any).templateName || (r as any).formName || '').toLowerCase()
          const isTemp = name.includes('temp') || name.includes('kitchen readiness') || name.includes('dispatch') || name.includes('service point')
          const isVendorSop = name.includes('vendor') || name.includes('sop')
          const isFefo = name.includes('fefo') || name.includes('fifo') || name.includes('expiry') || name.includes('stock')

          if (isTemp && !canTemp) return false
          if (isVendorSop && !canVendorSop) return false
          if (isFefo && !canFefo) return false
          return true
        })
      }
      
      setRecords(mergedRecords)
      setVendors(vSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setCompanies(allCompanies)
      setBuildings(bSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setCafeterias(cafeSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setRoles(rSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Failed to load compliance data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const getName = (arr: any[], id: string) => arr.find(item => item.id === id)?.name || '—'

  // ─── View Checkpoints Handler ────────────────────────────────
  const handleViewQuestions = async (template: ComplianceTemplate) => {
    setSelectedTemplateForQuestions(template)
    setQuestionModalOpen(true)
    setLoadingQuestions(true)
    try {
      const fields = await complianceTemplateFieldsService.getByTemplateId(template.id)
      setTemplateQuestions(fields)
    } catch (error) {
      console.error("Failed to load questions:", error)
      toast({ title: "Error", description: "Failed to load checkpoints for this template.", variant: "destructive" })
    } finally {
      setLoadingQuestions(false)
    }
  }

  // ─── Filtered Templates ───────────────────────────────────────
  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      const s = search.toLowerCase()
      const matchesSearch = !search || 
        t.name.toLowerCase().includes(s) ||
        (t.department && t.department.toLowerCase().includes(s)) ||
        (t.category && t.category.toLowerCase().includes(s))
      const matchesType = filterType === 'all' || t.type === filterType
      const matchesVendor = filterVendor === 'all' || t.vendorId === filterVendor
      const matchesCompany = filterCompany === 'all' || t.companyId === filterCompany
      const matchesBuilding = filterBuilding === 'all' || t.buildingId === filterBuilding
      const matchesCafeteria = filterCafeteria === 'all' || t.cafetariaId === filterCafeteria

      // Facility Quick Filter (All / Cairn OB / Cairn MPT)
      let matchesFacilityQuick = true
      if (filterFacilityQuick === 'OB') {
        matchesFacilityQuick = t.buildingId === 'XlXuTwn8gDkSqAxIZ8cQ' || t.name.includes('[Cairn - OB]')
      } else if (filterFacilityQuick === 'MPT') {
        matchesFacilityQuick = t.buildingId === 'HudpWZCFsUSp5UChILqJ' || t.name.includes('[Cairn - MPT]')
      }

      // Category Quick Filter
      let matchesCategoryQuick = true
      if (filterCategoryQuick !== 'all') {
        const cat = (t.category || '').toLowerCase()
        const dept = (t.department || '').toLowerCase()
        matchesCategoryQuick = cat.includes(filterCategoryQuick.toLowerCase()) || dept.includes(filterCategoryQuick.toLowerCase())
      }

      return matchesSearch && matchesType && matchesVendor && matchesCompany && matchesBuilding && matchesCafeteria && matchesFacilityQuick && matchesCategoryQuick
    })
  }, [templates, search, filterType, filterVendor, filterCompany, filterBuilding, filterCafeteria, filterFacilityQuick, filterCategoryQuick])

  // ─── Stats ────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    totalTemplates: templates.length,
    activeTemplates: templates.filter(t => t.status === 'active').length,
    totalRecords: records.length,
    pendingRecords: records.filter(r => r.status === 'submitted').length,
    flaggedRecords: records.filter(r => r.status === 'flagged').length,
    approvedRecords: records.filter(r => r.status === 'approved').length,
  }), [templates, records])

  // ─── Delete Template ──────────────────────────────────────────
  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Delete this template and all its fields?")) return
    try {
      await complianceTemplateFieldsService.deleteByTemplateId(id)
      await complianceTemplatesService.delete(id)
      toast({ title: "Deleted", description: "Template removed." })
      fetchAll()
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete template.", variant: "destructive" })
    }
  }

  const handleToggleTemplateStatus = async (template: ComplianceTemplate) => {
    const newStatus = template.status === 'active' ? 'inactive' : 'active'
    try {
      await complianceTemplatesService.update(template.id, { status: newStatus })
      toast({ title: "Updated", description: `Template ${newStatus === 'active' ? 'enabled' : 'disabled'}.` })
      fetchAll()
    } catch (error) {
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" })
    }
  }

  const handleDeleteLegacy = async (id: string) => {
    if (!confirm("Delete this legacy form?")) return
    try {
      await complianceFormsService.delete(id)
      toast({ title: "Deleted", description: "Legacy form removed." })
      fetchAll()
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete.", variant: "destructive" })
    }
  }

  const handleDeleteRecord = async (id: string) => {
    if (!confirm("Are you sure you want to delete this draft record? This action cannot be undone.")) return
    try {
      await complianceRecordsService.delete(id)
      toast({ title: "Deleted", description: "Draft record deleted successfully." })
      fetchAll()
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete draft record.", variant: "destructive" })
    }
  }

  const handleExportExcel = async () => {
    setIsExporting(true);
    toast({ title: "Exporting...", description: "Please wait while we prepare the file and fetch images.", duration: 5000 });
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Compliance_Records");

      // Columns
      worksheet.columns = [
        { header: 'Form Name (Template)', key: 'formName', width: 25 },
        { header: 'Type', key: 'type', width: 15 },
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Vendor', key: 'vendor', width: 20 },
        { header: 'Company', key: 'company', width: 20 },
        { header: 'Submitted By', key: 'submittedBy', width: 20 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Item/Question', key: 'item', width: 30 },
        { header: 'Value/Observation', key: 'value', width: 25 },
        { header: 'Notes', key: 'notes', width: 30 },
        { header: 'Photo', key: 'photo', width: 30 }
      ];

      // Make header row bold
      worksheet.getRow(1).font = { bold: true };
      
      const fetchImageBase64 = async (url: string) => {
        try {
          // Use our Next.js backend proxy to completely bypass browser CORS restrictions
          const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
          const res = await fetch(proxyUrl);
          
          if (!res.ok) throw new Error("Failed to fetch image via proxy");
          
          const blob = await res.blob();
          return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          console.error("Image fetch error:", e);
          return null;
        }
      };

      for (const record of records) {
        const typeCfg = TEMPLATE_TYPE_CONFIG[record.templateType] || TEMPLATE_TYPE_CONFIG.general_checklist;
        const dateStr = record.date ? new Date(record.date).toLocaleDateString() : (record.createdAt?.toMillis ? new Date(record.createdAt.toMillis()).toLocaleDateString() : '—');
        
        // Main Record Row
        worksheet.addRow({
          formName: record.templateName || record.formName || '—',
          type: typeCfg.label,
          date: dateStr,
          vendor: record.vendorName || getName(vendors, record.vendorId),
          company: record.companyName || getName(companies, record.companyId || ''),
          submittedBy: record.submittedByName || '—',
          status: record.status,
          item: "",
          value: "",
          notes: "",
          photo: ""
        });

        // Child Rows for Items
        if (record.items && record.items.length > 0) {
          for (let index = 0; index < record.items.length; index++) {
            const item = record.items[index];
            let val = "";
            if (item.temperature) val += `${item.temperature}${item.temperatureUnit || '°C'} `;
            if (item.quantity) val += `| Qty: ${item.quantity} ${item.quantityUnit || ''}`;
            
            const row = worksheet.addRow({
              item: `   ↳ ${item.menuItemName || 'Item ' + (index + 1)}`,
              value: val.trim(),
              notes: item.notes || ""
            });

            if (item.photoUrl) {
              const base64 = await fetchImageBase64(item.photoUrl);
              if (base64) {
                const rawBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
                const extension = item.photoUrl.toLowerCase().includes('.jpg') || item.photoUrl.toLowerCase().includes('.jpeg') ? 'jpeg' : 'png';
                try {
                  const imageId = workbook.addImage({ base64: rawBase64, extension });
                  row.height = 100; 
                  worksheet.addImage(imageId, {
                    tl: { col: 10, row: row.number - 1 },
                    ext: { width: 100, height: 100 },
                    editAs: 'oneCell'
                  });
                } catch (imgErr) {
                  console.error("Failed to add image to workbook", imgErr);
                  row.getCell('photo').value = item.photoUrl;
                }
              } else {
                row.getCell('photo').value = item.photoUrl; // fallback to text link
              }
            }
          }
        }
        
        // Child Rows for Answers
        if (record.answers && record.answers.length > 0) {
          for (let index = 0; index < record.answers.length; index++) {
            const ans = record.answers[index] as any;
            const displayValue = String(ans.answer ?? ans.value ?? "—");
            
            const row = worksheet.addRow({
              item: `   ↳ ${ans.question || `Question (ID: ${ans.fieldId})`}`,
              value: displayValue,
              notes: ""
            });

            if (ans.photoUrl) {
              const base64 = await fetchImageBase64(ans.photoUrl);
              if (base64) {
                // exceljs prefers raw base64 without data URI prefix
                const rawBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
                const extension = ans.photoUrl.toLowerCase().includes('.jpg') || ans.photoUrl.toLowerCase().includes('.jpeg') ? 'jpeg' : 'png';
                
                try {
                  const imageId = workbook.addImage({ base64: rawBase64, extension });
                  row.height = 100; // make row tall enough for image
                  worksheet.addImage(imageId, {
                    tl: { col: 10, row: row.number - 1 },
                    ext: { width: 100, height: 100 },
                    editAs: 'oneCell'
                  });
                } catch (imgErr) {
                  console.error("Failed to add image to workbook", imgErr);
                  row.getCell('photo').value = ans.photoUrl;
                }
              } else {
                row.getCell('photo').value = ans.photoUrl; // fallback to text link
              }
            }
          }
        }
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(blob, `Compliance_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast({ title: "Success", description: "Export completed successfully!" });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "An error occurred while exporting", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="space-y-6 p-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-blue-600" /> Compliance Management
          </h1>
          <p className="text-gray-600">Create templates, manage vehicles, and review compliance records.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setSodexoPlanModalOpen(true)}
            className="border-indigo-200 text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100 hover:text-indigo-800 shadow-sm"
          >
            <BookOpen className="mr-2 h-4 w-4 text-indigo-600" /> Sodexo FM Plan
          </Button>
          <Link href="/admin/compliances/vehicles">
            <Button variant="outline">
              <Truck className="mr-2 h-4 w-4" /> Vehicles
            </Button>
          </Link>
          <Link href="/admin/compliances/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Create Template
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalTemplates}</p>
                <p className="text-xs text-gray-500">Total Templates</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <ListChecks className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalRecords}</p>
                <p className="text-xs text-gray-500">Total Records</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-amber-600">{stats.pendingRecords}</p>
                <p className="text-xs text-gray-500">Pending Review</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-red-600">{stats.flaggedRecords}</p>
                <p className="text-xs text-gray-500">Flagged</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b bg-white rounded-t-lg shadow-sm">
        <div className="flex gap-1 p-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.id === 'templates' && templates.length > 0 && (
                <Badge className={`text-[10px] px-1.5 py-0 h-5 ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'}`}>
                  {templates.length}
                </Badge>
              )}
              {tab.id === 'records' && records.length > 0 && (
                <Badge className={`text-[10px] px-1.5 py-0 h-5 ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'}`}>
                  {records.length}
                </Badge>
              )}
              {tab.id === 'legacy' && legacyForms.length > 0 && (
                <Badge className={`text-[10px] px-1.5 py-0 h-5 ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-600'}`}>
                  {legacyForms.length}
                </Badge>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════ TEMPLATES TAB ═══════════════ */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          {/* Quick Facility Segment Selector & Category Pills */}
          <div className="space-y-2.5 bg-gradient-to-r from-slate-50 via-blue-50/20 to-slate-50 p-3.5 rounded-lg border border-slate-200 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-blue-600" /> Plant Site:
                </span>
                <div className="flex bg-white p-0.5 rounded-lg border shadow-xs">
                  <button
                    type="button"
                    onClick={() => setFilterFacilityQuick('all')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                      filterFacilityQuick === 'all'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    All Facilities ({templates.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterFacilityQuick('OB')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                      filterFacilityQuick === 'OB'
                        ? 'bg-sky-700 text-white shadow-xs'
                        : 'text-slate-600 hover:text-sky-700 hover:bg-sky-50/50'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                    Cairn • OB (Operational Base)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterFacilityQuick('MPT')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                      filterFacilityQuick === 'MPT'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/50'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    Cairn • MPT (Terminal)
                  </button>
                </div>
              </div>

              {/* Category Quick Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
                  Area:
                </span>
                {[
                  { id: 'all', label: 'All Operations' },
                  { id: 'Accommodation', label: '🛏️ Living & Bunks' },
                  { id: 'Infrastructure', label: '⚙️ Technical / STP' },
                  { id: 'Food', label: '☕ F&B / Pantries' },
                  { id: 'Health', label: '🩺 HSE & Hygiene' },
                  { id: 'Security', label: '🛡️ Security / Admin' },
                ].map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setFilterCategoryQuick(cat.id)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-all border ${
                      filterCategoryQuick === cat.id
                        ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Standard Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 bg-gray-50 p-4 rounded-lg border">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input placeholder="Search templates, SOPs, checkpoints..." className="pl-9 bg-white" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(TEMPLATE_TYPE_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterVendor} onValueChange={setFilterVendor}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="All Vendors" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors</SelectItem>
                {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterCompany} onValueChange={(v) => { setFilterCompany(v); setFilterBuilding("all"); setFilterCafeteria("all"); }}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="All Companies" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterBuilding} onValueChange={(v) => { setFilterBuilding(v); setFilterCafeteria("all"); }} disabled={filterCompany === "all"}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="All Buildings" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Buildings</SelectItem>
                {buildings.filter(b => b.companyId === filterCompany).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Templates Table */}
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading templates...</div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg bg-white">
              <ListChecks className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No templates match the current filter.</p>
              <p className="text-gray-400 text-sm mt-1">Try switching plant site tabs or clearing your search criteria.</p>
              <Button variant="outline" className="mt-4" onClick={() => { setSearch(''); setFilterFacilityQuick('all'); setFilterCategoryQuick('all'); setFilterType('all'); }}>
                Reset Filters
              </Button>
            </div>
          ) : (
            <div className="rounded-md border bg-white shadow-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="w-[380px]">Checklist Name & Operational SOP</TableHead>
                    <TableHead>Scope & Type</TableHead>
                    <TableHead>Plant Assignments</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTemplates.map(template => {
                    const cfg = TEMPLATE_TYPE_CONFIG[template.type] || TEMPLATE_TYPE_CONFIG.general_checklist
                    const Icon = cfg.icon
                    const isCairnOB = template.name.includes('[Cairn - OB]')
                    const isCairnMPT = template.name.includes('[Cairn - MPT]')
                    return (
                      <TableRow key={template.id} className={template.status === 'inactive' ? 'opacity-60 bg-gray-50/50' : 'hover:bg-slate-50/60'}>
                        <TableCell>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isCairnOB && (
                              <Badge className="bg-sky-100 text-sky-800 border-sky-300 text-[10px] font-semibold py-0 h-4.5">
                                Cairn • OB
                              </Badge>
                            )}
                            {isCairnMPT && (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-semibold py-0 h-4.5">
                                Cairn • MPT
                              </Badge>
                            )}
                            <span className="font-semibold text-sm text-gray-900">
                              {template.name.replace(/\[Cairn - (OB|MPT)\]\s*/, '')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {template.department && (
                              <span className="text-[11px] text-slate-500 font-medium">
                                {template.department}
                              </span>
                            )}
                            {template.category && (
                              <>
                                <span className="text-[10px] text-slate-300">•</span>
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                  {template.category}
                                </span>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] gap-1 ${cfg.bgColor} ${cfg.color} border ${cfg.borderColor}`}>
                            <Icon className="h-3 w-3" />
                            {cfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {template.companyId && (
                              <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700">
                                {getName(companies, template.companyId)}
                              </Badge>
                            )}
                            {template.buildingId && (
                              <Badge variant="outline" className={`text-[10px] ${
                                isCairnOB ? 'bg-sky-50 text-sky-700 border-sky-200' :
                                isCairnMPT ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                'bg-green-50 text-green-700'
                              }`}>
                                {getName(buildings, template.buildingId)}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] capitalize bg-gray-50 font-medium">
                            {template.frequency.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={template.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                            {template.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2"
                              onClick={() => handleViewQuestions(template)}
                              title="View all checkpoints & Sodexo verification points"
                            >
                              <Eye className="h-3.5 w-3.5 mr-1 text-indigo-600" /> Checkpoints
                            </Button>
                            <Link href={`/admin/compliances/${template.id}`}>
                              <Button variant="ghost" size="sm" className="h-8 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2">
                                <Pencil className="h-3 w-3 mr-1" /> Edit
                              </Button>
                            </Link>
                            <Button variant="ghost" size="sm" className="h-8 text-xs px-2" onClick={() => handleToggleTemplateStatus(template)}>
                              {template.status === 'active' ? <Ban className="h-3 w-3 mr-1 text-orange-500" /> : <CheckCircle className="h-3 w-3 mr-1 text-green-500" />}
                              {template.status === 'active' ? 'Disable' : 'Enable'}
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 text-xs text-red-600 hover:bg-red-50 px-2" onClick={() => handleDeleteTemplate(template.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ RECORDS TAB ═══════════════ */}
      {activeTab === 'records' && (
        <div className="space-y-4">
          {records.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <ClipboardList className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No compliance records yet.</p>
              <p className="text-gray-400 text-sm mt-1">Records will appear here once supervisors submit them from the mobile app.</p>
            </div>
          ) : (
            <>
              <div className="flex justify-end mb-4">
                <Button variant="outline" disabled={isExporting} onClick={handleExportExcel} className="gap-2 text-green-700 hover:text-green-800 hover:bg-green-50 border-green-200">
                  {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} 
                  {isExporting ? "Exporting..." : "Export to Excel"}
                </Button>
              </div>
              <div className="rounded-md border bg-white shadow-sm overflow-hidden">
                <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Submitted By</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map(record => {
                    const typeCfg = TEMPLATE_TYPE_CONFIG[record.templateType] || TEMPLATE_TYPE_CONFIG.general_checklist
                    const TypeIcon = typeCfg.icon
                    return (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium text-sm">
                          {record.date ? new Date(record.date).toLocaleDateString() : (record.createdAt?.toMillis ? new Date(record.createdAt.toMillis()).toLocaleDateString() : '—')}
                        </TableCell>
                        <TableCell className="text-sm">{record.templateName || record.formName || '—'}</TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] gap-1 ${typeCfg.bgColor} ${typeCfg.color} border ${typeCfg.borderColor}`}>
                            <TypeIcon className="h-3 w-3" />
                            {typeCfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{record.vendorName || getName(vendors, record.vendorId)}</TableCell>
                        <TableCell className="text-sm">{record.companyName || getName(companies, record.companyId || '')}</TableCell>
                        <TableCell className="text-sm">{record.submittedByName || '—'}</TableCell>
                        <TableCell className="text-sm">{record.items?.length || 0}</TableCell>
                        <TableCell>
                          <Badge variant={
                            record.status === 'approved' ? 'default' : 
                            record.status === 'flagged' ? 'destructive' : 
                            'secondary'
                          } className="text-[10px]">
                            {record.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 text-xs text-blue-600 hover:bg-blue-50"
                              onClick={() => {
                                setSelectedRecordId(record.id)
                                setRecordModalOpen(true)
                              }}
                            >
                              <Eye className="h-3 w-3 mr-1" /> View
                            </Button>
                            {record.status === 'draft' && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 text-xs text-red-600 hover:bg-red-50 px-2"
                                onClick={() => handleDeleteRecord(record.id)}
                                title="Delete Draft"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════ LEGACY FORMS TAB ═══════════════ */}
      {activeTab === 'legacy' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold">Legacy Forms</p>
              <p className="text-xs text-amber-600 mt-0.5">These are forms created with the old system. They will continue to work but we recommend migrating to the new template system.</p>
            </div>
          </div>

          <div className="rounded-md border bg-white shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead>Form Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center">Loading...</TableCell></TableRow>
                ) : legacyForms.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center text-gray-500">No legacy forms.</TableCell></TableRow>
                ) : legacyForms.map(form => (
                  <TableRow key={form.id} className={form.status === 'inactive' ? 'bg-gray-50 text-gray-500' : ''}>
                    <TableCell className="font-semibold">{form.name}</TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-col">
                        <span>{getName(companies, form.companyId)}</span>
                        <span className="text-xs text-gray-400">{getName(buildings, form.buildingId)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{getName(vendors, form.vendorId)}</TableCell>
                    <TableCell><Badge variant="outline">{form.frequency}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={form.status === 'active' ? 'default' : 'secondary'}>{form.status || 'active'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/admin/compliances/${form.id}`}>
                          <Button variant="ghost" className="h-8 w-8 p-0 text-blue-600"><Pencil className="h-4 w-4" /></Button>
                        </Link>
                        <Button variant="ghost" className="h-8 w-8 p-0 text-red-600" onClick={() => handleDeleteLegacy(form.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      
      <ComplianceRecordModal 
        isOpen={recordModalOpen} 
        onClose={() => {
          setRecordModalOpen(false)
          setTimeout(() => setSelectedRecordId(null), 300)
        }} 
        recordId={selectedRecordId} 
        onStatusChange={() => fetchAll()}
      />

      {/* ─── Checkpoint Questions Inspection Modal ─── */}
      <Dialog open={questionModalOpen} onOpenChange={setQuestionModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b bg-slate-50/70">
            <div className="flex items-center gap-2">
              {selectedTemplateForQuestions?.name.includes('[Cairn - OB]') && (
                <Badge className="bg-sky-100 text-sky-800 border-sky-300">Cairn • OB</Badge>
              )}
              {selectedTemplateForQuestions?.name.includes('[Cairn - MPT]') && (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">Cairn • MPT</Badge>
              )}
              <Badge variant="outline" className="capitalize text-slate-600">
                {selectedTemplateForQuestions?.frequency.replace('_', ' ')}
              </Badge>
              {selectedTemplateForQuestions?.department && (
                <Badge variant="secondary" className="text-xs">
                  {selectedTemplateForQuestions.department}
                </Badge>
              )}
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900 mt-1">
              {selectedTemplateForQuestions?.name.replace(/\[Cairn - (OB|MPT)\]\s*/, '')}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {selectedTemplateForQuestions?.description || "Industrial inspection checkpoints and Sodexo verification criteria."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {loadingQuestions ? (
              <div className="py-12 text-center text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                Loading checklist checkpoints...
              </div>
            ) : templateQuestions.length === 0 ? (
              <div className="py-10 text-center text-slate-400">
                No checkpoints found for this template.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b">
                  <span className="font-semibold text-slate-700">
                    Checkpoints & Inspection Items ({templateQuestions.length})
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-purple-700 font-medium">
                      <Camera className="h-3.5 w-3.5" />
                      {templateQuestions.filter(q => q.isPhotoRequired).length} Photos Mandatory
                    </span>
                    <span className="flex items-center gap-1 text-emerald-700 font-medium">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Dual Sign-off Enabled
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {templateQuestions.map((q, idx) => (
                    <div 
                      key={q.id || idx}
                      className="p-3 rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:shadow-2xs transition-all flex items-start justify-between gap-4"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {q.question}
                          </p>
                          {q.options && q.options.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {q.options.map((opt: string, optIdx: number) => (
                                <span key={optIdx} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                  {opt}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {q.isPhotoRequired && (
                          <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] gap-1 font-medium">
                            <Camera className="h-3 w-3" /> Photo
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] uppercase font-mono text-slate-600">
                          {q.type?.replace('_', ' ') || 'yes/no'}
                          {q.unit ? ` (${q.unit})` : ''}
                        </Badge>
                        {q.isRequired && (
                          <span className="text-[10px] text-amber-600 font-semibold px-1">
                            Req
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="p-4 border-t bg-slate-50 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              Assignee: <span className="font-semibold text-slate-700">Supervisor / Housekeeper</span> • Verification: <span className="font-semibold text-slate-700">Mandatory</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setQuestionModalOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Sodexo Enterprise Facility Management Plan Modal ─── */}
      <Dialog open={sodexoPlanModalOpen} onOpenChange={setSodexoPlanModalOpen}>
        <DialogContent className="max-w-4xl max-h-[88vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
            <div className="flex items-center gap-2">
              <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-400/30 text-xs">
                Sodexo Global Standards
              </Badge>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-xs">
                Cairn Oil & Gas Compliance
              </Badge>
            </div>
            <DialogTitle className="text-2xl font-bold text-white mt-1">
              Industrial Plant Checklist Management Framework
            </DialogTitle>
            <DialogDescription className="text-indigo-200 text-xs">
              Operational rhythm, dual sign-off protocol, photographic auditing, and SLA governance across Cairn OB & MPT buildings.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
            {/* Pillar 1: Shift Rhythm */}
            <div className="space-y-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 border-b pb-1.5">
                <Clock className="h-5 w-5 text-indigo-600" />
                1. Operational Shift Rhythm & Daily Inspection Cadence
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-lg border bg-slate-50/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 text-xs">Morning Shift (06:00 - 14:00)</span>
                    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700">Daily Lineup</Badge>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    • 06:15 - Grooming & PPE Check Card audit.<br/>
                    • 07:00 - Guest quarters & bunk turnover.<br/>
                    • 08:30 - Washrooms first deep sanitation & refill.<br/>
                    • 09:00 - Pantry & breakfast cafe clearing.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg border bg-slate-50/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 text-xs">General Shift (09:00 - 18:00)</span>
                    <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700">Admin & Plant</Badge>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    • 09:30 - Admin building & executive cabins.<br/>
                    • 11:00 - Critical rooms (Radio, Telecom, CEC).<br/>
                    • 12:00 - STP perimeter & safety eyewash checks.<br/>
                    • 14:00 - Water dispenser weekly Sumatab cycle.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg border bg-slate-50/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 text-xs">Evening Shift (14:00 - 22:00)</span>
                    <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700">Night Handover</Badge>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    • 15:00 - Recreation, Gym & Badminton court.<br/>
                    • 17:30 - Front office P.O.B. & attendance report.<br/>
                    • 19:30 - Evening dining cafe cleanup & bin clear.<br/>
                    • 21:30 - Shift supervisor dual-signature closure.
                  </p>
                </div>
              </div>
            </div>

            {/* Pillar 2: Dual Authentication */}
            <div className="space-y-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 border-b pb-1.5">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                2. Dual-Verification & Sign-off Hierarchy
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border bg-emerald-50/30 border-emerald-200/60 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-emerald-900">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Tier 1: Housekeeper Shift Execution
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Each area has an assigned cleaner/housekeeper who inspects every checkpoint on their mobile device. Checkpoint answers cannot be batched in 1-click; each mandatory checkpoint requires explicit Pass/Fail confirmation with photo capture where flagged.
                  </p>
                </div>
                <div className="p-4 rounded-lg border bg-blue-50/30 border-blue-200/60 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-blue-900">
                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                    Tier 2: Shift Supervisor Validation
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    The supervisor conducts random spot-audits (min 30% sample size) across completed rooms and plant zones. The supervisor must digitally sign off in the app or admin console before the checklist record transitions to "Approved".
                  </p>
                </div>
              </div>
            </div>

            {/* Pillar 3: Photo Evidence SOP */}
            <div className="space-y-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 border-b pb-1.5">
                <Camera className="h-5 w-5 text-purple-600" />
                3. Anti-Tamper Photographic Evidence SOP
              </h3>
              <div className="p-4 rounded-lg border bg-purple-50/30 border-purple-200/60 text-xs text-slate-700 space-y-2">
                <p>
                  High-risk and statutory compliance nodes strictly require real-time photo capture with embedded GPS/timestamp metadata:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  <div className="bg-white p-2.5 rounded border border-purple-100">
                    <span className="font-semibold text-purple-900 block">Restrooms & Sanitary Nodes:</span>
                    Mirror streak-free check, WC bowl disinfection, sanitary pad refill dispenser count.
                  </div>
                  <div className="bg-white p-2.5 rounded border border-purple-100">
                    <span className="font-semibold text-purple-900 block">Hazardous & Technical Plant:</span>
                    STP bar screen clearance, safety eye-wash bottle fill level and seal integrity.
                  </div>
                  <div className="bg-white p-2.5 rounded border border-purple-100">
                    <span className="font-semibold text-purple-900 block">Drinking Water SOP:</span>
                    Step 5 of Water Dispenser cleaning (Sumatab 150ppm solution with 15-minute dwell).
                  </div>
                  <div className="bg-white p-2.5 rounded border border-purple-100">
                    <span className="font-semibold text-purple-900 block">Personal Grooming:</span>
                    Full-length uniform, clean nails, shaven appearance, and color-coded duster carry.
                  </div>
                </div>
              </div>
            </div>

            {/* Pillar 4: Color-coded Hygiene Standards */}
            <div className="space-y-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 border-b pb-1.5">
                <Sparkles className="h-5 w-5 text-amber-600" />
                4. Chemical Protocols & 4-Color Duster Segregation
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 rounded-md border border-red-200 bg-red-50/50">
                  <span className="font-bold text-red-800 block mb-1">🔴 Red Microfibre</span>
                  <span className="text-slate-600">Strictly for toilet bowls, urinals, and high-bioburden bathroom zones.</span>
                </div>
                <div className="p-2.5 rounded-md border border-amber-200 bg-amber-50/50">
                  <span className="font-bold text-amber-800 block mb-1">🟡 Yellow Microfibre</span>
                  <span className="text-slate-600">For washbasins, tiles, bathroom mirrors, and restroom fittings.</span>
                </div>
                <div className="p-2.5 rounded-md border border-blue-200 bg-blue-50/50">
                  <span className="font-bold text-blue-800 block mb-1">🔵 Blue Microfibre</span>
                  <span className="text-slate-600">For general surfaces, office desks, living bunk furniture, and glass.</span>
                </div>
                <div className="p-2.5 rounded-md border border-green-200 bg-green-50/50">
                  <span className="font-bold text-green-800 block mb-1">🟢 Green Microfibre</span>
                  <span className="text-slate-600">Exclusively for pantry food-contact counters, dining tables, and cafeterias.</span>
                </div>
              </div>
            </div>

            {/* Pillar 5: SLA Escalation */}
            <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-100 text-xs text-slate-600 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800 block">SLA Escalation Matrix:</span>
                Any daily checklist not submitted within 2 hours of shift completion automatically triggers an Amber Alert to the Facility Manager. If unresolved at 4 hours, it escalates to Red Alert on the Executive Dashboard.
              </div>
            </div>
          </div>

          <div className="p-4 border-t bg-slate-50 flex items-center justify-end">
            <Button onClick={() => setSodexoPlanModalOpen(false)}>
              Understood & Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}