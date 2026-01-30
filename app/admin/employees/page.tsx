"use client"

import React, { useState, useEffect, useMemo } from "react"
import { 
  employeesService, 
  companiesService, 
  buildingsService, 
  servicesService, 
  subServicesService,
  type Employee,
  type Company,
  type Building,
  type Service,
  type SubService
} from "@/lib/firestore"
import { toast } from "@/hooks/use-toast"

// Icons
import { 
  Plus, MoreHorizontal, Pencil, Trash2, ChevronDown, ChevronRight, 
  User, Building2, Utensils, Shield, Mail, Phone, Search, X
} from "lucide-react"

// UI Components
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const initialEmployeeState: Omit<Employee, "id"> = {
  employeeId: "",
  name: "",
  email: "",
  phone: "",
  companyId: "",
  companyName: "",
  buildingId: "",
  buildingName: "",
  department: "",
  designation: "",
  role: "employee",
  status: "active",
  preferences: {
    dietaryRestrictions: [],
    allergies: [],
    spiceLevel: "medium"
  },
  activeSubscriptions: []
}

export default function EmployeesPage() {
  const [data, setData] = useState<Employee[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [subServices, setSubServices] = useState<SubService[]>([])
  
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState(initialEmployeeState)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Input states for arrays
  const [dietInput, setDietInput] = useState("")
  const [allergyInput, setAllergyInput] = useState("")

  useEffect(() => {
    loadAllData()
  }, [])

  const loadAllData = async () => {
    try {
      setLoading(true)
      const [emp, comp, build, serv, subServ] = await Promise.all([
        employeesService.getAll(),
        companiesService.getAll(),
        buildingsService.getAll(),
        servicesService.getAll(),
        subServicesService.getAll()
      ])
      setData(emp)
      setCompanies(comp)
      setBuildings(build)
      setServices(serv)
      setSubServices(subServ)
    } catch (e) {
      toast({ title: "Error", description: "Failed to load employees" })
    } finally {
      setLoading(false)
    }
  }

  const filteredEmployees = useMemo(() => {
    return data.filter(e => 
        e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        e.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.companyName.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [data, searchTerm])

  const availableBuildings = useMemo(() => {
    return buildings.filter(b => b.companyId === formData.companyId)
  }, [buildings, formData.companyId])

  // --- SUBSCRIPTION HANDLERS ---
  const addSubscription = () => {
    setFormData({
      ...formData,
      activeSubscriptions: [
        ...formData.activeSubscriptions,
        {
          serviceId: "",
          serviceName: "",
          subServiceId: "",
          subServiceName: "",
          daysOfWeek: ["monday", "tuesday", "wednesday", "thursday", "friday"],
          startDate: new Date().toISOString().split('T')[0],
          endDate: ""
        }
      ]
    })
  }

  const removeSubscription = (index: number) => {
    const subs = [...formData.activeSubscriptions]
    subs.splice(index, 1)
    setFormData({ ...formData, activeSubscriptions: subs })
  }

  const handleSave = async () => {
    try {
      const payload = {
        ...formData,
        preferences: {
          ...formData.preferences,
          dietaryRestrictions: dietInput.split(",").map(s => s.trim()).filter(s => s),
          allergies: allergyInput.split(",").map(s => s.trim()).filter(s => s)
        }
      }
      if (editingId) await employeesService.update(editingId, payload as any)
      else await employeesService.add(payload as any)
      
      setIsModalOpen(false)
      loadAllData()
      toast({ title: "Success", description: "Employee record saved" })
    } catch (e) {
      toast({ title: "Error", description: "Save failed" })
    }
  }

  const handleEdit = (emp: Employee) => {
    setEditingId(emp.id)
    setFormData(emp)
    setDietInput(emp.preferences.dietaryRestrictions.join(", "))
    setAllergyInput(emp.preferences.allergies.join(", "))
    setIsModalOpen(true)
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Employee Directory</h1>
          <p className="text-gray-500 text-sm">Manage staff profiles, dietary preferences, and meal subscriptions.</p>
        </div>
        <Button onClick={() => { setEditingId(null); setFormData(initialEmployeeState); setDietInput(""); setAllergyInput(""); setIsModalOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Add Employee
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input 
          placeholder="Search by name, ID or company..." 
          className="pl-10 max-w-md" 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Card className="overflow-hidden border-none shadow-sm">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Company & Building</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEmployees.map(emp => (
              <React.Fragment key={emp.id}>
                <TableRow className="cursor-pointer hover:bg-gray-50" onClick={() => setExpandedId(expandedId === emp.id ? null : emp.id)}>
                  <TableCell>{expandedId === emp.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs uppercase">
                            {emp.name.substring(0,2)}
                        </div>
                        <div>
                            <div className="font-bold text-sm">{emp.name}</div>
                            <div className="text-[10px] text-gray-400 font-mono tracking-tighter">{emp.employeeId}</div>
                        </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-medium">{emp.companyName}</div>
                    <div className="text-[10px] text-gray-400 flex items-center gap-1"><Building2 className="h-3 w-3" /> {emp.buildingName}</div>
                  </TableCell>
                  <TableCell className="text-xs">{emp.department}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={emp.role === 'company_admin' ? "bg-purple-50 text-purple-700 border-purple-200" : ""}>
                        {emp.role.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell><Badge variant={emp.status === 'active' ? 'default' : 'secondary'}>{emp.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}><Button variant="ghost" size="sm"><MoreHorizontal /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(emp)}><Pencil className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => employeesService.delete(emp.id).then(loadAllData)}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                {expandedId === emp.id && (
                  <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                    <TableCell colSpan={7} className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Preferences */}
                        <Card className="shadow-none border-gray-200">
                          <CardHeader className="py-3 bg-gray-50 border-b"><CardTitle className="text-xs font-bold uppercase text-gray-500">Preferences</CardTitle></CardHeader>
                          <CardContent className="pt-4 space-y-3">
                            <div>
                                <Label className="text-[10px] text-gray-400 uppercase">Spice Level</Label>
                                <div className="text-sm font-medium capitalize">{emp.preferences.spiceLevel}</div>
                            </div>
                            <div>
                                <Label className="text-[10px] text-gray-400 uppercase">Dietary</Label>
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {emp.preferences.dietaryRestrictions.map(d => <Badge key={d} variant="secondary" className="text-[10px]">{d}</Badge>)}
                                    {emp.preferences.dietaryRestrictions.length === 0 && <span className="text-xs text-gray-400 italic">None</span>}
                                </div>
                            </div>
                            <div>
                                <Label className="text-[10px] text-gray-400 uppercase">Allergies</Label>
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {emp.preferences.allergies.map(a => <Badge key={a} variant="destructive" className="text-[10px]">{a}</Badge>)}
                                    {emp.preferences.allergies.length === 0 && <span className="text-xs text-gray-400 italic">None</span>}
                                </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Active Subscriptions */}
                        <Card className="shadow-none border-blue-100 col-span-2">
                          <CardHeader className="py-3 bg-blue-50 border-b"><CardTitle className="text-xs font-bold uppercase text-blue-600">Active Meal Subscriptions</CardTitle></CardHeader>
                          <CardContent className="pt-0 px-0">
                            <Table>
                                <TableHeader><TableRow className="border-none hover:bg-transparent"><TableHead className="text-[10px] h-8">Service</TableHead><TableHead className="text-[10px] h-8">Type</TableHead><TableHead className="text-[10px] h-8">Schedule</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {emp.activeSubscriptions.map((sub, i) => (
                                        <TableRow key={i} className="border-gray-100">
                                            <TableCell className="py-2 text-xs font-bold">{sub.serviceName}</TableCell>
                                            <TableCell className="py-2 text-xs">{sub.subServiceName}</TableCell>
                                            <TableCell className="py-2 text-xs">
                                                <div className="flex flex-wrap gap-1">
                                                    {sub.daysOfWeek.map(d => <span key={d} className="text-[9px] px-1 bg-gray-100 rounded uppercase">{d.substring(0,3)}</span>)}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {emp.activeSubscriptions.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-xs text-gray-400 py-4 italic">No active subscriptions</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                          </CardContent>
                        </Card>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* --- EMPLOYEE MODAL --- */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Edit Employee Profile" : "Register New Employee"}</DialogTitle></DialogHeader>
          
          <Tabs defaultValue="basics">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basics">Basic Info</TabsTrigger>
              <TabsTrigger value="pref">Preferences</TabsTrigger>
              <TabsTrigger value="subs">Subscriptions</TabsTrigger>
            </TabsList>

            <TabsContent value="basics" className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Full Name *</Label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                <div className="space-y-2"><Label>Employee ID *</Label><Input value={formData.employeeId} onChange={e => setFormData({...formData, employeeId: e.target.value})} placeholder="EMP-001" /></div>
                <div className="space-y-2"><Label>Email</Label><Input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
                
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Select onValueChange={(val) => setFormData({...formData, companyId: val, companyName: companies.find(c => c.id === val)?.name || "", buildingId: "", buildingName: ""})} value={formData.companyId}>
                    <SelectTrigger><SelectValue placeholder="Select Company" /></SelectTrigger>
                    <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Building</Label>
                  <Select onValueChange={(val) => setFormData({...formData, buildingId: val, buildingName: buildings.find(b => b.id === val)?.name || ""})} value={formData.buildingId} disabled={!formData.companyId}>
                    <SelectTrigger><SelectValue placeholder="Select Building" /></SelectTrigger>
                    <SelectContent>{availableBuildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="space-y-2"><Label>Department</Label><Input value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} /></div>
                <div className="space-y-2">
                    <Label>Role</Label>
                    <Select onValueChange={(val: any) => setFormData({...formData, role: val})} value={formData.role}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="employee">Employee</SelectItem>
                            <SelectItem value="company_admin">Company Admin</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="pref" className="space-y-4 py-4">
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                    <Label>Dietary Restrictions (comma separated)</Label>
                    <Input value={dietInput} onChange={e => setDietInput(e.target.value)} placeholder="Vegetarian, Eggless, etc." />
                </div>
                <div className="space-y-2">
                    <Label>Allergies (comma separated)</Label>
                    <Input value={allergyInput} onChange={e => setAllergyInput(e.target.value)} placeholder="Nuts, Dairy, etc." />
                </div>
                <div className="space-y-2">
                    <Label>Spice Preference</Label>
                    <Select onValueChange={(val) => setFormData({...formData, preferences: {...formData.preferences, spiceLevel: val}})} value={formData.preferences.spiceLevel}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="low">Low (Mild)</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="spicy">Spicy (Hot)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="subs" className="space-y-4 py-4">
                <div className="flex justify-between items-center mb-4">
                    <Label className="text-gray-500">Active Meal Subscriptions</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addSubscription}><Plus className="h-4 w-4 mr-1"/> Add Service</Button>
                </div>
                
                {formData.activeSubscriptions.map((sub, idx) => (
                    <Card key={idx} className="relative p-4 border-blue-100 bg-blue-50/20">
                        <Button variant="ghost" size="sm" className="absolute top-2 right-2 text-red-500" onClick={() => removeSubscription(idx)}><X className="h-4 w-4"/></Button>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs text-blue-600 font-bold uppercase">Service</Label>
                                <Select onValueChange={(val) => {
                                    const s = services.find(x => x.id === val);
                                    const newSubs = [...formData.activeSubscriptions];
                                    newSubs[idx] = { ...newSubs[idx], serviceId: val, serviceName: s?.name || "", subServiceId: "", subServiceName: "" };
                                    setFormData({...formData, activeSubscriptions: newSubs});
                                }} value={sub.serviceId}>
                                    <SelectTrigger className="bg-white"><SelectValue placeholder="Select Service" /></SelectTrigger>
                                    <SelectContent>{services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs text-blue-600 font-bold uppercase">Meal Type</Label>
                                <Select onValueChange={(val) => {
                                    const s = subServices.find(x => x.id === val);
                                    const newSubs = [...formData.activeSubscriptions];
                                    newSubs[idx] = { ...newSubs[idx], subServiceId: val, subServiceName: s?.name || "" };
                                    setFormData({...formData, activeSubscriptions: newSubs});
                                }} value={sub.subServiceId} disabled={!sub.serviceId}>
                                    <SelectTrigger className="bg-white"><SelectValue placeholder="Select Type" /></SelectTrigger>
                                    <SelectContent>
                                        {subServices.filter(x => x.serviceId === sub.serviceId).map(ss => <SelectItem key={ss.id} value={ss.id}>{ss.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="col-span-2">
                                <Label className="text-xs text-blue-600 font-bold uppercase mb-2 block">Days Active</Label>
                                <div className="flex flex-wrap gap-4 bg-white p-3 rounded border">
                                    {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map(day => (
                                        <div key={day} className="flex items-center space-x-2">
                                            <Checkbox 
                                                checked={sub.daysOfWeek.includes(day)}
                                                onCheckedChange={(checked) => {
                                                    const newSubs = [...formData.activeSubscriptions]
                                                    const days = checked ? [...sub.daysOfWeek, day] : sub.daysOfWeek.filter(d => d !== day)
                                                    newSubs[idx] = { ...newSubs[idx], daysOfWeek: days }
                                                    setFormData({...formData, activeSubscriptions: newSubs})
                                                }}
                                            />
                                            <span className="text-[10px] uppercase font-bold text-gray-500">{day.substring(0,3)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </Card>
                ))}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Profile</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}