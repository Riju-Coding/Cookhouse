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

import {
  Plus, Pencil, Trash2, Ban, CheckCircle, ClipboardList, ListChecks,
  Thermometer, Truck, UtensilsCrossed, FileCheck, Search, Filter,
  Calendar, Building2, Eye, ChevronRight, BarChart3, AlertTriangle,
  Clock, CheckCircle2
} from "lucide-react"

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
  const [roles, setRoles] = useState<any[]>([])
  
  // Filters
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [filterVendor, setFilterVendor] = useState<string>("all")

  // Record Modal
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const [recordModalOpen, setRecordModalOpen] = useState(false)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    try {
      setLoading(true)
      const [templatesRes, formsRes, recentRecords, vSnap, cSnap, bSnap, rSnap] = await Promise.all([
        complianceTemplatesService.getAll().catch(() => []),
        complianceFormsService.getAll().catch(() => []),
        complianceRecordsService.getRecent(50).catch(() => []),
        getDocs(collection(db, 'vendors')),
        getDocs(collection(db, 'companies')),
        getDocs(collection(db, 'buildings')),
        getDocs(collection(db, 'roles')),
      ])
      setTemplates(templatesRes)
      setLegacyForms(formsRes)
      setRecords(recentRecords)
      setVendors(vSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setCompanies(cSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setBuildings(bSnap.docs.map(d => ({ id: d.id, ...d.data() })))
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
      return matchesSearch && matchesType && matchesVendor
    })
  }, [templates, search, filterType, filterVendor])

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

  // ─── Legacy form handlers (same as before) ────────────────────
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
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input placeholder="Search templates..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(TEMPLATE_TYPE_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterVendor} onValueChange={setFilterVendor}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Vendors" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors</SelectItem>
                {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Template Cards by Type */}
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading templates...</div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <ListChecks className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No templates found.</p>
              <p className="text-gray-400 text-sm mt-1">Create your first compliance template to get started.</p>
              <Link href="/admin/compliances/new">
                <Button className="mt-4"><Plus className="mr-2 h-4 w-4" /> Create Template</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredTemplates.map(template => {
                const cfg = TEMPLATE_TYPE_CONFIG[template.type] || TEMPLATE_TYPE_CONFIG.general_checklist
                const Icon = cfg.icon
                return (
                  <Card key={template.id} className={`shadow-sm border-l-4 ${cfg.borderColor} transition-all hover:shadow-md ${template.status === 'inactive' ? 'opacity-60' : ''}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`h-8 w-8 rounded-lg ${cfg.bgColor} flex items-center justify-center`}>
                            <Icon className={`h-4 w-4 ${cfg.color}`} />
                          </div>
                          <div>
                            <CardTitle className="text-sm">{template.name}</CardTitle>
                            <CardDescription className="text-[10px]">{cfg.label}</CardDescription>
                          </div>
                        </div>
                        <Badge variant={template.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                          {template.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-3 space-y-2">
                      <div className="flex flex-wrap gap-1.5 text-[10px]">
                        <Badge variant="outline" className="gap-1">
                          <Building2 className="h-2.5 w-2.5" />
                          {getName(vendors, template.vendorId)}
                        </Badge>
                        {template.companyId && (
                          <Badge variant="outline" className="gap-1">
                            {getName(companies, template.companyId)}
                          </Badge>
                        )}
                        <Badge variant="outline" className="capitalize">{template.frequency.replace('_', ' ')}</Badge>
                      </div>
                      <div className="flex items-center justify-end gap-1 pt-1 border-t">
                        <Link href={`/admin/compliances/${template.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600 hover:text-blue-800">
                            <Pencil className="h-3 w-3 mr-1" /> Edit
                          </Button>
                        </Link>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleToggleTemplateStatus(template)}>
                          {template.status === 'active' ? <Ban className="h-3 w-3 mr-1 text-orange-500" /> : <CheckCircle className="h-3 w-3 mr-1 text-green-500" />}
                          {template.status === 'active' ? 'Disable' : 'Enable'}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-red-600" onClick={() => handleDeleteTemplate(template.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
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
                          {record.date ? new Date(record.date).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell className="text-sm">{record.templateName || '—'}</TableCell>
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