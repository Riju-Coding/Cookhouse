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
  Clock, CheckCircle2, Download, Loader2
} from "lucide-react"
import ExcelJS from "exceljs"
import { saveAs } from "file-saver"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

  // ─── Filtered Templates ───────────────────────────────────────
  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      const matchesSearch = !search || t.name.toLowerCase().includes(search.toLowerCase())
      const matchesType = filterType === 'all' || t.type === filterType
      const matchesVendor = filterVendor === 'all' || t.vendorId === filterVendor
      const matchesCompany = filterCompany === 'all' || t.companyId === filterCompany
      const matchesBuilding = filterBuilding === 'all' || t.buildingId === filterBuilding
      const matchesCafeteria = filterCafeteria === 'all' || t.cafetariaId === filterCafeteria
      return matchesSearch && matchesType && matchesVendor && matchesCompany && matchesBuilding && matchesCafeteria
    })
  }, [templates, search, filterType, filterVendor, filterCompany, filterBuilding, filterCafeteria])

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
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 bg-gray-50 p-4 rounded-lg border">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input placeholder="Search templates..." className="pl-9 bg-white" value={search} onChange={e => setSearch(e.target.value)} />
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
              <p className="text-gray-500 font-medium">No templates found.</p>
              <p className="text-gray-400 text-sm mt-1">Create your first compliance template to get started.</p>
              <Link href="/admin/compliances/new">
                <Button className="mt-4"><Plus className="mr-2 h-4 w-4" /> Create Template</Button>
              </Link>
            </div>
          ) : (
            <div className="rounded-md border bg-white shadow-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead>Template Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Assignments</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTemplates.map(template => {
                    const cfg = TEMPLATE_TYPE_CONFIG[template.type] || TEMPLATE_TYPE_CONFIG.general_checklist
                    const Icon = cfg.icon
                    return (
                      <TableRow key={template.id} className={template.status === 'inactive' ? 'opacity-60 bg-gray-50/50' : ''}>
                        <TableCell>
                          <div className="font-medium text-sm text-gray-900">{template.name}</div>
                          <div className="text-[10px] text-gray-500">{cfg.description}</div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] gap-1 ${cfg.bgColor} ${cfg.color} border ${cfg.borderColor}`}>
                            <Icon className="h-3 w-3" />
                            {cfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {template.vendorId && <Badge variant="outline" className="text-[10px] gap-1"><Building2 className="h-2.5 w-2.5" />{getName(vendors, template.vendorId)}</Badge>}
                            {template.companyId && <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700">{getName(companies, template.companyId)}</Badge>}
                            {template.buildingId && <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700">{getName(buildings, template.buildingId)}</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] capitalize bg-gray-50">{template.frequency.replace('_', ' ')}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={template.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                            {template.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
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
    </div>
  )
}