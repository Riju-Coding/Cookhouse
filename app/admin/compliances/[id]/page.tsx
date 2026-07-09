"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { db } from "@/lib/firebase"
import { collection, getDocs } from "firebase/firestore"
import { complianceTemplatesService, type ComplianceTemplate, type ComplianceTemplateType, type ComplianceFrequency, type VehicleCheckField } from "@/lib/firestore/complianceTemplatesService"
import { complianceTemplateFieldsService, type ComplianceTemplateField, type TemplateFieldType } from "@/lib/firestore/complianceTemplateFieldsService"
import { toast } from "@/hooks/use-toast"

import { 
  ArrowLeft, ArrowRight, Save, Trash2, Plus, 
  Thermometer, Truck, UtensilsCrossed, FileCheck, 
  Settings2, Building2, MapPin, CheckSquare, List, Copy
} from "lucide-react"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"

const TEMPLATE_TYPES: { type: ComplianceTemplateType; label: string; icon: any; desc: string }[] = [
  { type: 'kitchen_readiness', label: 'Kitchen Readiness', icon: Thermometer, desc: 'Batch-wise temperature tracking at the kitchen.' },
  { type: 'dispatch', label: 'Dispatch Checklist', icon: Truck, desc: 'Vehicle condition, dispatch qty & temperature.' },
  { type: 'service_point', label: 'Service Point', icon: UtensilsCrossed, desc: 'Temperature & qty recording at food service.' },
  { type: 'general_checklist', label: 'General Form', icon: FileCheck, desc: 'Standard custom questionnaire.' }
]

const FREQUENCIES: { value: ComplianceFrequency; label: string }[] = [
  { value: 'per_batch', label: 'Per Batch' },
  { value: 'per_dispatch', label: 'Per Dispatch' },
  { value: 'per_service', label: 'Per Service' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

export default function TemplateBuilderPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const isNew = params.id === "new"

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)

  // ── Form State ──────────────────────────────────────────────────
  const [templateType, setTemplateType] = useState<ComplianceTemplateType>('kitchen_readiness')
  const [name, setName] = useState("")
  const [vendorId, setVendorId] = useState("")
  const [frequency, setFrequency] = useState<ComplianceFrequency>('daily')
  const [assignedRole, setAssignedRole] = useState("")
  
  // Locations
  const [companyId, setCompanyId] = useState("")
  const [buildingId, setBuildingId] = useState("")
  const [cafetariaId, setCafetariaId] = useState("")
  const [areaId, setAreaId] = useState("")

  // Menu Settings (for food templates)
  const [menuSource, setMenuSource] = useState<'combined' | 'company'>('company')
  const [serviceId, setServiceId] = useState("")
  const [subServiceId, setSubServiceId] = useState("")

  // Dynamic Fields
  const [vehicleChecks, setVehicleChecks] = useState<VehicleCheckField[]>([
    { id: 'hygiene', label: 'Vehicle Hygiene', type: 'yes_no', isRequired: true },
    { id: 'fuel', label: 'Sufficient Fuel', type: 'yes_no', isRequired: true },
  ])
  const [customFields, setCustomFields] = useState<Omit<ComplianceTemplateField, 'id'|'templateId'|'createdAt'>[]>([])

  // Lookups
  const [vendors, setVendors] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [buildings, setBuildings] = useState<any[]>([])
  const [cafeterias, setCafeterias] = useState<any[]>([])
  const [areas, setAreas] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [subServices, setSubServices] = useState<any[]>([])

  // Copy form state
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false)
  const [copyTemplates, setCopyTemplates] = useState<ComplianceTemplate[]>([])
  const [selectedCopyTemplateId, setSelectedCopyTemplateId] = useState<string>("")
  const [copyTemplateFields, setCopyTemplateFields] = useState<ComplianceTemplateField[]>([])
  const [selectedFieldIdsToCopy, setSelectedFieldIdsToCopy] = useState<string[]>([])

  useEffect(() => {
    fetchLookups()
    if (!isNew) fetchExistingTemplate()
  }, [])

  const fetchLookups = async () => {
    try {
      const [v, c, b, caf, a, r, s, ss] = await Promise.all([
        getDocs(collection(db, 'vendors')),
        getDocs(collection(db, 'companies')),
        getDocs(collection(db, 'buildings')),
        getDocs(collection(db, 'cafeterias')),
        getDocs(collection(db, 'areas')),
        getDocs(collection(db, 'roles')),
        getDocs(collection(db, 'services')),
        getDocs(collection(db, 'subServices'))
      ])
      setVendors(v.docs.map(d => ({ id: d.id, ...d.data() })))
      setCompanies(c.docs.map(d => ({ id: d.id, ...d.data() })))
      setBuildings(b.docs.map(d => ({ id: d.id, ...d.data() })))
      setCafeterias(caf.docs.map(d => ({ id: d.id, ...d.data() })))
      setAreas(a.docs.map(d => ({ id: d.id, ...d.data() })))
      setRoles(r.docs.map(d => ({ id: d.id, ...d.data() })))
      setServices(s.docs.map(d => ({ id: d.id, ...d.data() })))
      setSubServices(ss.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (e) {
      console.error(e)
    }
  }

  const fetchExistingTemplate = async () => {
    try {
      const t = await complianceTemplatesService.getById(params.id)
      if (t) {
        setTemplateType(t.type)
        setName(t.name)
        setVendorId(t.vendorId)
        setFrequency(t.frequency)
        setAssignedRole(t.assignedRole)
        setCompanyId(t.companyId || "")
        setBuildingId(t.buildingId || "")
        setCafetariaId(t.cafetariaId || "")
        setAreaId(t.areaId || "")
        setMenuSource(t.menuSourceType || 'company')
        setServiceId(t.serviceId || "")
        setSubServiceId(t.subServiceId || "")
        if (t.vehicleCheckFields) setVehicleChecks(t.vehicleCheckFields)

        const fields = await complianceTemplateFieldsService.getByTemplateId(t.id)
        setCustomFields(fields)
      }
    } catch (e) {
      console.error(e)
      toast({ title: "Error", description: "Failed to load template", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenCopyModal = async () => {
    setIsCopyModalOpen(true)
    if (copyTemplates.length === 0) {
      try {
        const templates = await complianceTemplatesService.getByType('general_checklist')
        setCopyTemplates(templates.filter(t => t.id !== params.id))
      } catch (e) {
        toast({ title: "Error", description: "Failed to load templates", variant: "destructive" })
      }
    }
  }

  const handleSelectCopyTemplate = async (id: string) => {
    setSelectedCopyTemplateId(id)
    setCopyTemplateFields([])
    setSelectedFieldIdsToCopy([])
    if (id && id !== "none") {
      try {
        const fields = await complianceTemplateFieldsService.getByTemplateId(id)
        setCopyTemplateFields(fields)
        setSelectedFieldIdsToCopy(fields.map(f => f.id))
      } catch (e) {
        toast({ title: "Error", description: "Failed to load template fields", variant: "destructive" })
      }
    }
  }

  const handleCopyFields = () => {
    const fieldsToAdd = copyTemplateFields.filter(f => selectedFieldIdsToCopy.includes(f.id))
    const newFields = fieldsToAdd.map((f, i) => ({
      question: f.question,
      type: f.type,
      isRequired: f.isRequired,
      isPhotoRequired: f.isPhotoRequired,
      options: f.options,
      order: customFields.length + i,
    }))
    setCustomFields([...customFields, ...newFields])
    setIsCopyModalOpen(false)
    toast({ title: "Fields Copied", description: `Copied ${newFields.length} fields.` })
  }

  const handleSave = async () => {
    if (!name || !vendorId || !assignedRole) {
      toast({ title: "Missing Fields", description: "Name, Vendor, and Assigned Role are required.", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const payload: any = {
        name,
        type: templateType,
        vendorId,
        frequency,
        assignedRole,
        status: 'active',
      }

      if (companyId && companyId !== 'none') payload.companyId = companyId
      if (buildingId && buildingId !== 'none') payload.buildingId = buildingId
      if (cafetariaId && cafetariaId !== 'none') payload.cafetariaId = cafetariaId
      if (areaId && areaId !== 'none') payload.areaId = areaId
      
      if (['kitchen_readiness', 'dispatch', 'service_point'].includes(templateType)) {
        payload.menuSourceType = menuSource
        if (serviceId && serviceId !== 'none') payload.serviceId = serviceId
        if (subServiceId && subServiceId !== 'none') payload.subServiceId = subServiceId
      }

      if (templateType === 'dispatch') {
        payload.vehicleCheckFields = vehicleChecks
      }

      let templateId = params.id
      if (isNew) {
        const docRef = await complianceTemplatesService.add(payload)
        templateId = docRef.id
      } else {
        await complianceTemplatesService.update(templateId, payload)
        // Clear existing fields
        await complianceTemplateFieldsService.deleteByTemplateId(templateId)
      }

      // Add custom fields if applicable
      if (templateType === 'general_checklist' && customFields.length > 0) {
        await Promise.all(customFields.map((f, i) => {
          const fieldPayload: any = {
            templateId,
            question: f.question,
            type: f.type,
            isRequired: f.isRequired,
            isPhotoRequired: f.isPhotoRequired,
            order: i,
          }
          if (f.options !== undefined) {
            fieldPayload.options = f.options
          }
          return complianceTemplateFieldsService.add(fieldPayload)
        }))
      }

      toast({ title: "Success", description: "Template saved successfully." })
      router.push("/admin/compliances")
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Failed to save template.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const filteredBuildings = buildings.filter(b => b.companyId === companyId)
  const filteredCafeterias = cafeterias.filter(c => c.buildingId === buildingId)
  const filteredAreas = areas.filter(a => a.cafeteriaId === cafetariaId)
  const filteredSubServices = subServices.filter(s => s.serviceId === serviceId)

  if (loading) return <div className="p-12 text-center text-gray-500">Loading template...</div>

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isNew ? 'Create Template' : 'Edit Template'}</h1>
          <p className="text-gray-500 text-sm">Configure data tracking requirements for compliance apps.</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex flex-col items-center flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm z-10 transition-colors
              ${step === s ? 'bg-blue-600 text-white' : step > s ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
              {s}
            </div>
            <div className="text-xs font-medium mt-2 text-gray-600">
              {s === 1 ? 'Template Type' : s === 2 ? 'Configuration' : 'Workflow Setup'}
            </div>
          </div>
        ))}
        {/* Lines */}
        <div className="absolute left-[20%] right-[20%] h-1 bg-gray-200 -z-10 top-[138px]" />
        <div className={`absolute left-[20%] h-1 bg-blue-600 -z-10 top-[138px] transition-all`} style={{ width: step === 1 ? '0%' : step === 2 ? '30%' : '60%' }} />
      </div>

      <Card className="shadow-sm border-gray-200">
        <CardContent className="p-6">
          
          {/* STEP 1: TYPE SELECTION */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="text-center mb-6">
                <h2 className="text-lg font-bold">Select Template Type</h2>
                <p className="text-gray-500 text-sm">What kind of compliance workflow does this represent?</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {TEMPLATE_TYPES.map(t => {
                  const Icon = t.icon
                  const active = templateType === t.type
                  return (
                    <div 
                      key={t.type}
                      onClick={() => setTemplateType(t.type)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex gap-4 items-start
                        ${active ? 'border-blue-600 bg-blue-50/50' : 'border-gray-200 hover:border-blue-300'}`}
                    >
                      <div className={`p-3 rounded-lg ${active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className={`font-bold ${active ? 'text-blue-900' : 'text-gray-900'}`}>{t.label}</h3>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{t.desc}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* STEP 2: CONFIGURATION */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <h2 className="text-lg font-bold border-b pb-2 mb-4">Basic Configuration</h2>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Template Name <span className="text-red-500">*</span></Label>
                  <Input placeholder="e.g. Morning Dispatch Checklist" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Assigned Vendor <span className="text-red-500">*</span></Label>
                  <Select value={vendorId} onValueChange={setVendorId}>
                    <SelectTrigger><SelectValue placeholder="Select Vendor" /></SelectTrigger>
                    <SelectContent>
                      {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Assigned Role <span className="text-red-500">*</span></Label>
                  <Select value={assignedRole} onValueChange={setAssignedRole}>
                    <SelectTrigger><SelectValue placeholder="Who fills this form?" /></SelectTrigger>
                    <SelectContent>
                      {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Frequency <span className="text-red-500">*</span></Label>
                  <Select value={frequency} onValueChange={(val: any) => setFrequency(val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <h2 className="text-lg font-bold border-b pb-2 mt-8 mb-4">Location Targeting</h2>
              <div className="grid grid-cols-2 gap-6 bg-gray-50 p-4 rounded-lg border">
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Select value={companyId} onValueChange={val => { setCompanyId(val); setBuildingId(''); setCafetariaId(''); setAreaId(''); }}>
                    <SelectTrigger><SelectValue placeholder="Any Company" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Any Company</SelectItem>
                      {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Building</Label>
                  <Select value={buildingId} onValueChange={val => { setBuildingId(val); setCafetariaId(''); setAreaId(''); }} disabled={!companyId || companyId === 'none'}>
                    <SelectTrigger><SelectValue placeholder="Any Building" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Any Building</SelectItem>
                      {filteredBuildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cafeteria</Label>
                  <Select value={cafetariaId} onValueChange={val => { setCafetariaId(val); setAreaId(''); }} disabled={!buildingId || buildingId === 'none'}>
                    <SelectTrigger><SelectValue placeholder="Any Cafeteria" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Any Cafeteria</SelectItem>
                      {filteredCafeterias.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Area / Floor</Label>
                  <Select value={areaId} onValueChange={setAreaId} disabled={!cafetariaId || cafetariaId === 'none'}>
                    <SelectTrigger><SelectValue placeholder="Any Area" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Any Area</SelectItem>
                      {filteredAreas.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: WORKFLOW SETUP */}
          {step === 3 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
              
              {/* Menu Setup (For food-related templates) */}
              {['kitchen_readiness', 'dispatch', 'service_point'].includes(templateType) && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <UtensilsCrossed className="h-5 w-5 text-blue-600" />
                    <h2 className="text-lg font-bold">Menu Integration</h2>
                  </div>
                  <p className="text-sm text-gray-500">This template will automatically fetch menu items for the day. Configure which menu to fetch from.</p>
                  
                  <div className="grid grid-cols-2 gap-6 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                    <div className="space-y-2">
                      <Label>Menu Source Type</Label>
                      <Select value={menuSource} onValueChange={(v: any) => setMenuSource(v)}>
                        <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="combined">Combined Menu (Global)</SelectItem>
                          <SelectItem value="company">Company Specific Menu</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Filter by Service (Optional)</Label>
                      <Select value={serviceId} onValueChange={val => { setServiceId(val); setSubServiceId(''); }}>
                        <SelectTrigger className="bg-white"><SelectValue placeholder="All Services" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">All Services</SelectItem>
                          {services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Filter by Sub-Service (Optional)</Label>
                      <Select value={subServiceId} onValueChange={setSubServiceId} disabled={!serviceId || serviceId === 'none'}>
                        <SelectTrigger className="bg-white"><SelectValue placeholder="All Sub-Services" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">All Sub-Services</SelectItem>
                          {filteredSubServices.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* Vehicle Setup (For Dispatch) */}
              {templateType === 'dispatch' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <Truck className="h-5 w-5 text-blue-600" />
                    <h2 className="text-lg font-bold">Vehicle Checklist</h2>
                  </div>
                  <p className="text-sm text-gray-500">Configure the checks performed on the delivery vehicle before dispatch.</p>
                  
                  <div className="space-y-3">
                    {vehicleChecks.map((check, index) => (
                      <div key={index} className="flex items-center gap-4 bg-gray-50 p-3 rounded-lg border">
                        <Input 
                          value={check.label} 
                          onChange={e => {
                            const newChecks = [...vehicleChecks];
                            newChecks[index].label = e.target.value;
                            newChecks[index].id = e.target.value.toLowerCase().replace(/\s+/g, '_');
                            setVehicleChecks(newChecks);
                          }} 
                          placeholder="Check label (e.g. Tire Pressure)" 
                          className="flex-1 bg-white"
                        />
                        <div className="flex items-center gap-2 w-32">
                          <Switch 
                            checked={check.isRequired} 
                            onCheckedChange={val => {
                              const newChecks = [...vehicleChecks];
                              newChecks[index].isRequired = val;
                              setVehicleChecks(newChecks);
                            }} 
                          />
                          <Label className="text-xs">Required</Label>
                        </div>
                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => setVehicleChecks(vehicleChecks.filter((_, i) => i !== index))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" className="w-full border-dashed" onClick={() => setVehicleChecks([...vehicleChecks, { id: `check_${Date.now()}`, label: '', type: 'yes_no', isRequired: true }])}>
                      <Plus className="mr-2 h-4 w-4" /> Add Vehicle Check
                    </Button>
                  </div>
                </div>
              )}

              {/* Custom Questions (For General Checklist) */}
              {templateType === 'general_checklist' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <List className="h-5 w-5 text-purple-600" />
                    <h2 className="text-lg font-bold">Custom Form Questions</h2>
                  </div>
                  
                  <div className="space-y-3">
                    {customFields.map((field, index) => (
                      <div key={index} className="flex flex-col gap-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="flex items-start gap-4">
                          <div className="bg-purple-100 text-purple-700 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-1">
                            {index + 1}
                          </div>
                          <Input 
                            value={field.question} 
                            onChange={e => {
                              const nf = [...customFields]; nf[index].question = e.target.value; setCustomFields(nf);
                            }} 
                            placeholder="Question text" 
                            className="flex-1 bg-white"
                          />
                          <Select 
                            value={field.type} 
                            onValueChange={(val: any) => {
                              const nf = [...customFields]; nf[index].type = val; setCustomFields(nf);
                            }}
                          >
                            <SelectTrigger className="w-40 bg-white"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="yes_no">Yes / No</SelectItem>
                              <SelectItem value="text">Text Input</SelectItem>
                              <SelectItem value="number">Number</SelectItem>
                              <SelectItem value="photo">Photo Upload</SelectItem>
                              <SelectItem value="temperature">Temperature</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => setCustomFields(customFields.filter((_, i) => i !== index))}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-6 ml-10">
                          <div className="flex items-center gap-2">
                            <Checkbox 
                              checked={field.isRequired} 
                              onCheckedChange={val => {
                                const nf = [...customFields]; nf[index].isRequired = !!val; setCustomFields(nf);
                              }} 
                            />
                            <Label className="text-xs text-gray-600 font-medium">Answer Required</Label>
                          </div>
                          {field.type !== 'photo' && (
                            <div className="flex items-center gap-2">
                              <Checkbox 
                                checked={field.isPhotoRequired} 
                                onCheckedChange={val => {
                                  const nf = [...customFields]; nf[index].isPhotoRequired = !!val; setCustomFields(nf);
                                }} 
                              />
                              <Label className="text-xs text-gray-600 font-medium">Photo Proof Required</Label>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-4">
                      <Button variant="outline" className="flex-1 border-dashed py-6" onClick={() => setCustomFields([...customFields, { question: '', type: 'yes_no', isRequired: true, isPhotoRequired: false, order: customFields.length }])}>
                        <Plus className="mr-2 h-4 w-4" /> Add Question
                      </Button>
                      <Button variant="outline" className="flex-1 border-dashed py-6 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:text-purple-800" onClick={handleOpenCopyModal}>
                        <Copy className="mr-2 h-4 w-4" /> Copy from existing form
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </CardContent>
      </Card>

      {/* Footer Navigation */}
      <div className="flex justify-between pt-4">
        {step > 1 ? (
          <Button variant="outline" onClick={() => setStep(step - 1)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
        ) : (
          <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        )}

        {step < 3 ? (
          <Button onClick={() => setStep(step + 1)}>
            Next Step <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700">
            {saving ? "Saving..." : <><Save className="mr-2 h-4 w-4" /> Save Template</>}
          </Button>
        )}
      </div>

      <Dialog open={isCopyModalOpen} onOpenChange={setIsCopyModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Copy fields from existing form</DialogTitle>
            <DialogDescription>Select an existing general form template and pick the questions you want to copy.</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Select Template</Label>
              <Select value={selectedCopyTemplateId} onValueChange={handleSelectCopyTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Choose a template...</SelectItem>
                  {copyTemplates.map(t => {
                    const comp = companies.find(c => c.id === t.companyId)?.name
                    const bldg = buildings.find(b => b.id === t.buildingId)?.name
                    let labelStr = t.name
                    if (comp) labelStr += ` (${comp}`
                    if (bldg) labelStr += ` - ${bldg}`
                    if (comp) labelStr += `)`
                    return (
                      <SelectItem key={t.id} value={t.id}>{labelStr}</SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {selectedCopyTemplateId && selectedCopyTemplateId !== "none" && copyTemplateFields.length > 0 && (
              <div className="space-y-3 border rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto">
                <div className="flex items-center justify-between border-b pb-2 mb-2">
                  <span className="font-medium text-sm">Questions found ({copyTemplateFields.length})</span>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      checked={selectedFieldIdsToCopy.length === copyTemplateFields.length}
                      onCheckedChange={(val) => {
                        if (val) setSelectedFieldIdsToCopy(copyTemplateFields.map(f => f.id))
                        else setSelectedFieldIdsToCopy([])
                      }}
                    />
                    <Label className="text-sm cursor-pointer">Select All</Label>
                  </div>
                </div>
                {copyTemplateFields.map((field) => (
                  <div key={field.id} className="flex items-start gap-3 bg-white p-3 rounded border">
                    <Checkbox 
                      className="mt-1"
                      checked={selectedFieldIdsToCopy.includes(field.id)}
                      onCheckedChange={(val) => {
                        if (val) setSelectedFieldIdsToCopy([...selectedFieldIdsToCopy, field.id])
                        else setSelectedFieldIdsToCopy(selectedFieldIdsToCopy.filter(id => id !== field.id))
                      }}
                    />
                    <div>
                      <p className="text-sm font-medium">{field.question}</p>
                      <p className="text-xs text-gray-500">Type: {field.type.replace('_', ' ')} • {field.isRequired ? 'Required' : 'Optional'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {selectedCopyTemplateId && selectedCopyTemplateId !== "none" && copyTemplateFields.length === 0 && (
              <p className="text-sm text-gray-500 italic text-center py-4">No custom fields found in this template.</p>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCopyModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCopyFields} disabled={selectedFieldIdsToCopy.length === 0}>
              Copy Selected ({selectedFieldIdsToCopy.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}