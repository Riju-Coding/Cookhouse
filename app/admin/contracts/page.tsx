"use client"

import React, { useState, useEffect, useMemo } from "react"
import { 
  vendorContractsService, 
  vendorsService, 
  companiesService, 
  buildingsService, 
  servicesService, 
  subServicesService,
  type VendorContract,
  type Vendor,
  type Company,
  type Building,
  type Service,
  type SubService
} from "@/lib/firestore"
import { toast } from "@/hooks/use-toast"

// Icons
import { 
  Plus, MoreHorizontal, Pencil, Trash2, ChevronDown, ChevronRight, 
  FileText, Calendar, Building2, IndianRupee, Info, CheckCircle2, XCircle
} from "lucide-react"

// UI Components
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const initialContractState: Omit<VendorContract, "id"> = {
  vendorId: "",
  vendorName: "",
  companyId: "",
  companyName: "",
  buildingIds: [],
  buildingNames: [],
  contractNumber: "",
  startDate: "",
  endDate: "",
  status: "active",
  servicesOffered: [],
  terms: {
    paymentTerms: "Net 30",
    minimumOrder: 0,
    cancellationPolicy: "",
    qualityStandards: "",
    penaltyClause: ""
  },
  autoRenewal: false
}

export default function VendorContractsPage() {
  const [contracts, setContracts] = useState<VendorContract[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [subServices, setSubServices] = useState<SubService[]>([])
  
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState(initialContractState)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    loadAllData()
  }, [])

  const loadAllData = async () => {
    setLoading(true)
    try {
      const [cont, vend, comp, build, serv, subServ] = await Promise.all([
        vendorContractsService.getAll(),
        vendorsService.getAll(),
        companiesService.getAll(),
        buildingsService.getAll(),
        servicesService.getAll(),
        subServicesService.getAll()
      ])
      setContracts(cont)
      setVendors(vend as any)
      setCompanies(comp)
      setBuildings(build)
      setServices(serv)
      setSubServices(subServ)
    } catch (e) {
      toast({ title: "Error", description: "Failed to load data" })
    } finally {
      setLoading(false)
    }
  }

  // --- FORM HELPERS ---
  const availableBuildings = useMemo(() => {
    return buildings.filter(b => b.companyId === formData.companyId)
  }, [buildings, formData.companyId])

  const addServiceToContract = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId)
    if (!service || formData.servicesOffered.find(s => s.serviceId === serviceId)) return
    
    setFormData({
      ...formData,
      servicesOffered: [...formData.servicesOffered, {
        serviceId,
        serviceName: service.name,
        subServices: []
      }]
    })
  }

  const addSubServiceToRateCard = (serviceIndex: number, subServiceId: string) => {
    const sub = subServices.find(s => s.id === subServiceId)
    if (!sub) return

    const newServices = [...formData.servicesOffered]
    if (newServices[serviceIndex].subServices.find(s => s.subServiceId === subServiceId)) return

    newServices[serviceIndex].subServices.push({
      subServiceId,
      subServiceName: sub.name,
      baseRate: 0
    })
    setFormData({ ...formData, servicesOffered: newServices })
  }

  const updateRate = (sIdx: number, subIdx: number, rate: number) => {
    const newServices = [...formData.servicesOffered]
    newServices[sIdx].subServices[subIdx].baseRate = rate
    setFormData({ ...formData, servicesOffered: newServices })
  }

  const handleSave = async () => {
    try {
      if (editingId) {
        await vendorContractsService.update(editingId, formData as any)
      } else {
        await vendorContractsService.add(formData as any)
      }
      setIsModalOpen(false)
      loadAllData()
      toast({ title: "Success", description: "Contract Saved" })
    } catch (e) {
      toast({ title: "Error", description: "Save failed" })
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Vendor Contracts</h1>
          <p className="text-gray-500">Manage pricing and service agreements between companies and vendors.</p>
        </div>
        <Button onClick={() => { setEditingId(null); setFormData(initialContractState); setIsModalOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> New Contract
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>Contract #</TableHead>
              <TableHead>Vendor / Company</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.map(contract => (
              <React.Fragment key={contract.id}>
                <TableRow className="cursor-pointer" onClick={() => setExpandedId(expandedId === contract.id ? null : contract.id)}>
                  <TableCell>{expandedId === contract.id ? <ChevronDown /> : <ChevronRight />}</TableCell>
                  <TableCell className="font-mono font-bold text-blue-600">{contract.contractNumber}</TableCell>
                  <TableCell>
                    <div className="font-medium">{contract.vendorName}</div>
                    <div className="text-xs text-gray-400">for {contract.companyName}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3" /> {contract.startDate} to {contract.endDate}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={contract.status === 'active' ? 'default' : 'secondary'}>{contract.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}><Button variant="ghost"><MoreHorizontal /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => { setEditingId(contract.id); setFormData(contract); setIsModalOpen(true); }}>Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => vendorContractsService.delete(contract.id).then(loadAllData)}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                {expandedId === contract.id && (
                  <TableRow className="bg-gray-50">
                    <TableCell colSpan={6} className="p-6">
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <h4 className="font-bold text-sm flex items-center gap-2"><IndianRupee className="h-4 w-4" /> Service Rate Card</h4>
                          {contract.servicesOffered.map(s => (
                            <div key={s.serviceId} className="bg-white p-3 rounded border shadow-sm">
                              <div className="font-bold text-xs text-blue-600 mb-2 uppercase tracking-wider">{s.serviceName}</div>
                              {s.subServices.map(sub => (
                                <div key={sub.subServiceId} className="flex justify-between text-sm py-1 border-b last:border-0 border-gray-100">
                                  <span>{sub.subServiceName}</span>
                                  <span className="font-bold">₹{sub.baseRate}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                        <div className="space-y-4">
                          <h4 className="font-bold text-sm flex items-center gap-2"><Building2 className="h-4 w-4" /> Assigned Buildings</h4>
                          <div className="flex flex-wrap gap-2">
                            {contract.buildingNames.map(name => <Badge key={name} variant="outline" className="bg-white">{name}</Badge>)}
                          </div>
                          <h4 className="font-bold text-sm flex items-center gap-2 pt-2"><Info className="h-4 w-4" /> Contract Terms</h4>
                          <div className="text-xs space-y-1 bg-white p-3 border rounded">
                            <p><strong>Payment:</strong> {contract.terms.paymentTerms}</p>
                            <p><strong>Min Order:</strong> {contract.terms.minimumOrder} units</p>
                            <p><strong>Renewal:</strong> {contract.autoRenewal ? 'Auto-renew enabled' : 'Manual renewal'}</p>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Edit Contract" : "New Vendor Contract"}</DialogTitle></DialogHeader>
          
          <Tabs defaultValue="basics">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basics">General Info</TabsTrigger>
              <TabsTrigger value="rates">Service Rates</TabsTrigger>
              <TabsTrigger value="terms">Terms & Renewals</TabsTrigger>
            </TabsList>

            <TabsContent value="basics" className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vendor</Label>
                  <Select onValueChange={(val) => setFormData({...formData, vendorId: val, vendorName: vendors.find(v => v.id === val)?.name || ""})} value={formData.vendorId}>
                    <SelectTrigger><SelectValue placeholder="Select Vendor" /></SelectTrigger>
                    <SelectContent>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Select onValueChange={(val) => setFormData({...formData, companyId: val, companyName: companies.find(c => c.id === val)?.name || "", buildingIds: [], buildingNames: []})} value={formData.companyId}>
                    <SelectTrigger><SelectValue placeholder="Select Company" /></SelectTrigger>
                    <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Applicable Buildings (Select multiple)</Label>
                  <div className="grid grid-cols-3 gap-2 border rounded-md p-3 bg-gray-50">
                    {availableBuildings.map(b => (
                      <div key={b.id} className="flex items-center space-x-2">
                        <Checkbox 
                          checked={formData.buildingIds.includes(b.id)} 
                          onCheckedChange={(checked) => {
                            const newIds = checked ? [...formData.buildingIds, b.id] : formData.buildingIds.filter(id => id !== b.id)
                            const newNames = buildings.filter(x => newIds.includes(x.id)).map(x => x.name)
                            setFormData({...formData, buildingIds: newIds, buildingNames: newNames})
                          }}
                        />
                        <span className="text-sm">{b.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Contract Number</Label>
                  <Input value={formData.contractNumber} onChange={e => setFormData({...formData, contractNumber: e.target.value})} placeholder="CONT-2025-001" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input type="date" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="rates" className="space-y-4 py-4">
               <div className="flex gap-2 mb-4">
                  <Select onValueChange={addServiceToContract}>
                    <SelectTrigger><SelectValue placeholder="Add Service Type to Contract..." /></SelectTrigger>
                    <SelectContent>{services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
               </div>

               <div className="space-y-6">
                {formData.servicesOffered.map((serv, sIdx) => (
                  <Card key={serv.serviceId}>
                    <CardHeader className="bg-blue-50 py-2 flex flex-row justify-between items-center">
                      <span className="font-bold text-sm text-blue-700">{serv.serviceName}</span>
                      <Button variant="ghost" size="sm" onClick={() => {
                        const newServs = formData.servicesOffered.filter((_, i) => i !== sIdx)
                        setFormData({...formData, servicesOffered: newServs})
                      }}><Trash2 className="h-3 w-3 text-red-500"/></Button>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex gap-2">
                        <Select onValueChange={(val) => addSubServiceToRateCard(sIdx, val)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Add Sub-Service..." /></SelectTrigger>
                          <SelectContent>
                            {subServices.filter(ss => ss.serviceId === serv.serviceId).map(ss => (
                              <SelectItem key={ss.id} value={ss.id}>{ss.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        {serv.subServices.map((sub, subIdx) => (
                          <div key={sub.subServiceId} className="flex items-center gap-4 bg-gray-50 p-2 rounded">
                            <span className="text-xs font-medium flex-1">{sub.subServiceName}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs">Base Rate (₹):</span>
                              <Input 
                                type="number" 
                                className="w-24 h-8 text-sm" 
                                value={sub.baseRate} 
                                onChange={(e) => updateRate(sIdx, subIdx, parseFloat(e.target.value))}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
               </div>
            </TabsContent>

            <TabsContent value="terms" className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Payment Terms</Label><Input value={formData.terms.paymentTerms} onChange={e => setFormData({...formData, terms: {...formData.terms, paymentTerms: e.target.value}})} /></div>
                <div className="space-y-2"><Label>Min Order Requirement</Label><Input type="number" value={formData.terms.minimumOrder} onChange={e => setFormData({...formData, terms: {...formData.terms, minimumOrder: parseInt(e.target.value)}})} /></div>
                <div className="col-span-2 space-y-2"><Label>Cancellation Policy</Label><Textarea value={formData.terms.cancellationPolicy} onChange={e => setFormData({...formData, terms: {...formData.terms, cancellationPolicy: e.target.value}})} /></div>
                <div className="flex items-center space-x-2 pt-4">
                  <Checkbox checked={formData.autoRenewal} onCheckedChange={(val) => setFormData({...formData, autoRenewal: !!val})} />
                  <Label>Enable Auto-Renewal</Label>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Contract</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}