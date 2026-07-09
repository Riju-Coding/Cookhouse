"use client"

import React, { useState, useEffect, useMemo } from "react"
import { db } from "@/lib/firebase"
import { collection, getDocs } from "firebase/firestore"
import { usersService, type User } from "@/lib/firestore/usersService"
import { globalShiftsService, type GlobalShift } from "@/lib/firestore/globalShiftsService"
import { toast } from "@/hooks/use-toast"
import dynamic from "next/dynamic"

// Icons
import { UserPlus, Users, Pencil, Trash2, Search, Filter, Mail, Phone, MapPin, Building, Lock, CheckCircle, Clock, Plus, Ban, FileText, Store } from "lucide-react"

// UI Components
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { OrganizationHierarchyView } from "@/components/users/OrganizationHierarchyView"

// ── Dynamic imports for Google Maps (avoid SSR) ──────────────────────────────
const GoogleMapPicker = dynamic(() => import("@/components/google-map-picker"), {
  ssr: false,
  loading: () => <div className="h-64 w-full bg-gray-100 animate-pulse rounded-md flex items-center justify-center text-gray-400">Loading Map...</div>
})

const initialUserState: Omit<User, "id" | "createdAt" | "updatedAt"> = {
  name: "",
  email: "",
  phone: "",
  userType: 'super_admin',
  roleId: "",
  roleKey: "",
  vendorId: "",
  companyIds: [],
  buildingIds: [],
  cafeteriaIds: [],
  assignedShifts: [],
  managerId: "",
  status: 'active',
}

export default function UserManagementPage() {
  const [data, setData] = useState<User[]>([])
  
  const [roles, setRoles] = useState<any[]>([])
  const [vendors, setVendors] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [buildings, setBuildings] = useState<any[]>([])
  const [cafeterias, setCafeterias] = useState<any[]>([])
  const [globalShifts, setGlobalShifts] = useState<GlobalShift[]>([])
  const [filterTab, setFilterTab] = useState("all")
  
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState(initialUserState)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    try {
      setLoading(true)
      const [usersRes, rolesSnap, vendorsSnap, companiesSnap, buildingsSnap, cafeteriasSnap, globalShiftsRes] = await Promise.all([
        usersService.getAll(),
        getDocs(collection(db, 'roles')),
        getDocs(collection(db, 'vendors')),
        getDocs(collection(db, 'companies')),
        getDocs(collection(db, 'buildings')),
        getDocs(collection(db, 'cafetarias')), // Ensure this matches your DB collection name
        globalShiftsService.getAll()
      ])

      setData(usersRes)
      setRoles(rolesSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setVendors(vendorsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setCompanies(companiesSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setBuildings(buildingsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setCafeterias(cafeteriasSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setGlobalShifts(globalShiftsRes)
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const availableManagers = useMemo(() => {
    return data.filter(u => u.id !== editingId);
  }, [data, editingId]);

  const filteredData = useMemo(() => {
    if (filterTab === "all") return data;
    return data.filter(u => u.userType === filterTab);
  }, [data, filterTab]);

  const handleRoleChange = (roleId: string) => {
    const selectedRole = roles.find(r => r.id === roleId);
    setFormData(prev => ({
      ...prev,
      roleId,
      roleKey: selectedRole?.key || "",
    }))
  }

  // --- HIERARCHICAL TOGGLE LOGIC ---
  const toggleCompany = (companyId: string, checked: boolean) => {
    setFormData(prev => {
      if (checked) {
        return { ...prev, companyIds: [...(prev.companyIds || []), companyId] }
      } else {
        // If unchecking a company, we MUST uncheck all its buildings and cafeterias to prevent orphaned data
        const relatedBuildingIds = buildings.filter(b => b.companyId === companyId).map(b => b.id);
        const relatedCafeteriaIds = cafeterias.filter(c => relatedBuildingIds.includes(c.buildingId)).map(c => c.id);
        
        return { 
          ...prev, 
          companyIds: (prev.companyIds || []).filter(id => id !== companyId),
          buildingIds: (prev.buildingIds || []).filter(id => !relatedBuildingIds.includes(id)),
          cafeteriaIds: (prev.cafeteriaIds || []).filter(id => !relatedCafeteriaIds.includes(id)),
          assignedShifts: (prev.assignedShifts || []).filter(s => !relatedCafeteriaIds.includes(s.cafeteriaId))
        }
      }
    })
  }

  const toggleBuilding = (buildingId: string, checked: boolean) => {
    setFormData(prev => {
      if (checked) {
        return { ...prev, buildingIds: [...(prev.buildingIds || []), buildingId] }
      } else {
        // If unchecking a building, we MUST uncheck all its cafeterias
        const relatedCafeteriaIds = cafeterias.filter(c => c.buildingId === buildingId).map(c => c.id);
        return { 
          ...prev, 
          buildingIds: (prev.buildingIds || []).filter(id => id !== buildingId),
          cafeteriaIds: (prev.cafeteriaIds || []).filter(id => !relatedCafeteriaIds.includes(id)),
          assignedShifts: (prev.assignedShifts || []).filter(s => !relatedCafeteriaIds.includes(s.cafeteriaId))
        }
      }
    })
  }

  const toggleCafeteria = (cafeteriaId: string, checked: boolean) => {
    setFormData(prev => {
      if (checked) return { ...prev, cafeteriaIds: [...(prev.cafeteriaIds || []), cafeteriaId] }
      return { 
        ...prev, 
        cafeteriaIds: (prev.cafeteriaIds || []).filter(id => id !== cafeteriaId),
        assignedShifts: (prev.assignedShifts || []).filter(s => s.cafeteriaId !== cafeteriaId)
      }
    })
  }

  const handleCreateGlobalShift = async () => {
    const shiftName = prompt("Enter Shift Name (e.g. Standard 9-5):");
    if (!shiftName) return;
    const startTime = prompt("Enter Start Time (HH:MM):", "09:00");
    if (!startTime) return;
    const endTime = prompt("Enter End Time (HH:MM):", "18:00");
    if (!endTime) return;

    try {
      const docRef = await globalShiftsService.add({
        name: shiftName,
        startTime,
        endTime
      });
      const newShift = { id: docRef.id, name: shiftName, startTime, endTime };
      setGlobalShifts(prev => [...prev, newShift]);
      toast({ title: "Success", description: "Global shift created successfully" });
    } catch (err) {
      toast({ title: "Error", description: "Failed to create global shift", variant: "destructive" });
    }
  }

  const toggleShift = (cafeteriaId: string, shiftId: string, checked: boolean) => {
    setFormData(prev => {
      const current = prev.assignedShifts || [];
      if (checked) {
        return { 
          ...prev, 
          assignedShifts: [...current, { 
            cafeteriaId, 
            shiftId,
            workDays: ["Mon", "Tue", "Wed", "Thu", "Fri"], // Default to weekdays
            workType: "On-site"
          }] 
        }
      } else {
        return { ...prev, assignedShifts: current.filter(s => !(s.cafeteriaId === cafeteriaId && s.shiftId === shiftId)) }
      }
    })
  }

  const updateShiftDetails = (cafeteriaId: string, shiftId: string, updates: Partial<typeof formData.assignedShifts[0]>) => {
    setFormData(prev => {
      const current = prev.assignedShifts || [];
      return {
        ...prev,
        assignedShifts: current.map(s => {
          if (s.cafeteriaId === cafeteriaId && s.shiftId === shiftId) {
            return { ...s, ...updates };
          }
          return s;
        })
      };
    });
  }
  // --------------------------------

  const handleOpenAdd = () => {
    setEditingId(null)
    setFormData(initialUserState)
    setIsModalOpen(true)
  }

  const handleEdit = (user: User) => {
    setEditingId(user.id)
    setFormData({
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      userType: user.userType || 'super_admin',
      roleId: user.roleId,
      roleKey: user.roleKey,
      vendorId: user.vendorId || "none",
      companyIds: user.companyIds || [],
      buildingIds: user.buildingIds || [],
      cafeteriaIds: user.cafeteriaIds || [],
      officeLocation: user.officeLocation || undefined,
      assignedShifts: user.assignedShifts || [],
      managerId: user.managerId || "none",
      status: user.status || 'active',
    })
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name || !formData.email || !formData.roleId) {
      toast({ title: "Validation Error", description: "Name, Email, and Role are required.", variant: "destructive" })
      return
    }

    try {
      setIsSaving(true)
      
      const payloadToSave = {
        ...formData,
        vendorId: formData.vendorId === "none" ? "" : formData.vendorId,
        managerId: formData.managerId === "none" ? "" : formData.managerId,
      }

      if (editingId) {
        await usersService.update(editingId, payloadToSave)
        toast({ title: "Success", description: "User updated successfully" })
      } else {
        await usersService.add(payloadToSave)
        toast({ title: "Success", description: "User created successfully" })
      }
      setIsModalOpen(false)
      const updatedUsers = await usersService.getAll()
      setData(updatedUsers)
    } catch (error) {
      toast({ title: "Error", description: "Operation failed", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleStatus = async (user: User) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      await usersService.update(user.id, { status: newStatus });
      toast({ title: "Success", description: `User ${newStatus === 'active' ? 'enabled' : 'disabled'}` });
      const updatedUsers = await usersService.getAll();
      setData(updatedUsers);
    } catch (error) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return
    try {
      await usersService.delete(id)
      toast({ title: "Success", description: "User deleted" })
      setData(data.filter(item => item.id !== id))
    } catch (error) {
      toast({ title: "Error", description: "Delete failed", variant: "destructive" })
    }
  }

  const getVendorName = (id: string) => vendors.find(v => v.id === id)?.name || <span className="text-gray-400">—</span>;
  const getManagerName = (id: string) => data.find(u => u.id === id)?.name || <span className="text-gray-400">—</span>;

  return (
    <div className="space-y-6 p-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-600" /> User Management
          </h1>
          <p className="text-gray-600">Manage system users, assign roles, and assign locations.</p>
        </div>
        <Button onClick={handleOpenAdd}>
          <Plus className="mr-2 h-4 w-4" /> Create User
        </Button>
      </div>

      <Tabs defaultValue="list" className="w-full">
        <div className="mb-4">
          <TabsList>
            <TabsTrigger value="list">Users List</TabsTrigger>
            <TabsTrigger value="hierarchy">Organization Overview</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="list" className="mt-0">
          <div className="rounded-md border bg-white shadow-sm overflow-hidden flex flex-col h-full">
            <div className="border-b p-2">
              <Tabs defaultValue="all" onValueChange={(v) => setFilterTab(v)}>
                <TabsList>
                  <TabsTrigger value="all">All Users</TabsTrigger>
                  <TabsTrigger value="employee">Employees</TabsTrigger>
                  <TabsTrigger value="company_user">Company Users</TabsTrigger>
                  <TabsTrigger value="vendor_staff">Vendor Staff</TabsTrigger>
                  <TabsTrigger value="super_admin">Super Admins</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead>User Info</TableHead>
              <TableHead>Role & Type</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Reporting To</TableHead>
              <TableHead>Assignments & Shifts</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="h-24 text-center">Loading Users...</TableCell></TableRow>
            ) : filteredData.map((user) => (
              <TableRow key={user.id} className={user.status === 'inactive' ? 'bg-gray-50 text-gray-500' : ''}>
                <TableCell>
                  <div className="font-semibold">{user.name}</div>
                  <div className="text-xs text-gray-500">{user.email}</div>
                  {user.phone && <div className="text-[10px] text-gray-400 mt-0.5">{user.phone}</div>}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 uppercase text-[10px]">
                      {user.roleKey}
                    </Badge>
                    <span className="text-[10px] text-gray-500 uppercase">{user.userType?.replace('_', ' ')}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{getVendorName(user.vendorId)}</TableCell>
                <TableCell className="text-sm font-medium text-gray-600">
                  {user.managerId ? getManagerName(user.managerId) : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {user.companyIds?.length > 0 && <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded w-fit">{user.companyIds.length} Companies</span>}
                    {user.buildingIds?.length > 0 && <span className="text-[10px] font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded w-fit">{user.buildingIds.length} Buildings</span>}
                    {user.cafeteriaIds?.length > 0 && <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded w-fit">{user.cafeteriaIds.length} Cafeterias</span>}
                    {user.assignedShifts?.length > 0 && <span className="text-[10px] font-semibold text-teal-600 bg-teal-50 px-2 py-0.5 rounded w-fit">{user.assignedShifts.length} Shifts</span>}
                    {(!user.companyIds?.length && !user.buildingIds?.length && !user.cafeteriaIds?.length && !user.assignedShifts?.length) && <span className="text-xs text-gray-400">—</span>}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                    {user.status || 'active'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50" onClick={() => handleEdit(user)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" className={`h-8 w-8 p-0 ${user.status === 'active' ? 'text-orange-600 hover:text-orange-800 hover:bg-orange-50' : 'text-green-600 hover:text-green-800 hover:bg-green-50'}`} onClick={() => handleToggleStatus(user)}>
                      {user.status === 'active' ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50" onClick={() => handleDelete(user.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            </TableBody>
          </Table>
        </div>
        </TabsContent>

        <TabsContent value="hierarchy" className="mt-0">
          <OrganizationHierarchyView 
            users={data} 
            companies={companies} 
            cafeterias={cafeterias} 
            vendors={vendors} 
          />
        </TabsContent>
      </Tabs>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit User" : "Create New User"}</DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 overflow-y-auto pr-2">
            
            {/* --- BASIC INFO --- */}
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Rahul Sharma" />
            </div>
            <div className="space-y-2">
              <Label>Email Address *</Label>
              <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="rahul@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="9876543210" />
            </div>
            <div className="space-y-2">
              <Label>User Type *</Label>
              <Select value={formData.userType || 'super_admin'} onValueChange={(val: any) => setFormData({...formData, userType: val})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="vendor_staff">Vendor Staff</SelectItem>
                  <SelectItem value="company_user">Company User</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={formData.roleId} onValueChange={handleRoleChange}>
                <SelectTrigger><SelectValue placeholder="Select a Role" /></SelectTrigger>
                <SelectContent>
                  {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* --- COMPANY ASSIGNMENT (For Company Admin / User) --- */}
            {formData.userType === 'company_user' && (
              <div className="space-y-2">
                <Label>Assigned Company *</Label>
                <Select 
                  value={formData.companyIds?.[0] || "none"} 
                  onValueChange={(val) => {
                    if (val === "none") setFormData({...formData, companyIds: []})
                    else setFormData({...formData, companyIds: [val]})
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select Company" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-gray-400">Select a Company</SelectItem>
                    {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* --- VENDOR ASSIGNMENT --- */}
            <div className="space-y-2">
              <Label>
                {formData.userType === 'company_user' 
                  ? "Assigned Vendor (Optional, restricts view to this vendor)" 
                  : "Vendor (Employer) *"}
              </Label>
              <Select value={formData.vendorId} onValueChange={(val) => setFormData({...formData, vendorId: val})}>
                <SelectTrigger><SelectValue placeholder="Select Vendor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-gray-400">No Vendor</SelectItem>
                  {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Reports To (Manager)</Label>
              <Select value={formData.managerId} onValueChange={(val) => setFormData({...formData, managerId: val})}>
                <SelectTrigger><SelectValue placeholder="Select Manager" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-gray-400">No Manager</SelectItem>
                  {availableManagers.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name} ({m.roleKey})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* --- NESTED LOCATIONS ASSIGNMENT --- */}
            {formData.userType !== 'employee' && formData.userType !== 'company_user' ? (
            <div className="col-span-2 space-y-3 mt-4 border rounded-lg p-4 bg-gray-50/50">
              <div>
                <Label className="text-blue-700 font-semibold text-base">Location & Shift Assignments</Label>
                <p className="text-xs text-gray-500">Select a company, building, and cafeteria to assign working shifts to this user.</p>
              </div>
              
              <div className="space-y-3 border border-gray-200 bg-white rounded-md p-3 max-h-64 overflow-y-auto">
                {companies.length === 0 && <p className="text-sm text-gray-500">No companies found.</p>}
                
                {companies.map(company => {
                  const isCompanyChecked = (formData.companyIds || []).includes(company.id);
                  const companyBuildings = buildings.filter(b => b.companyId === company.id);

                  return (
                    <div key={company.id} className="space-y-2">
                      {/* COMPANY LEVEL */}
                      <div className="flex items-center space-x-2 font-medium">
                        <Checkbox 
                          id={`comp-${company.id}`} 
                          checked={isCompanyChecked} 
                          onCheckedChange={(c) => toggleCompany(company.id, !!c)} 
                        />
                        <Label htmlFor={`comp-${company.id}`} className="cursor-pointer">{company.name}</Label>
                      </div>

                      {/* BUILDINGS LEVEL (Only show if Company is checked) */}
                      {isCompanyChecked && companyBuildings.length > 0 && (
                        <div className="ml-6 space-y-2 border-l-2 border-gray-100 pl-3">
                          {companyBuildings.map(building => {
                            const isBuildingChecked = (formData.buildingIds || []).includes(building.id);
                            const buildingCafeterias = cafeterias.filter(c => c.buildingId === building.id);

                            return (
                              <div key={building.id} className="space-y-2">
                                <div className="flex items-center space-x-2 text-sm text-gray-700">
                                  <Checkbox 
                                    id={`build-${building.id}`} 
                                    checked={isBuildingChecked} 
                                    onCheckedChange={(c) => toggleBuilding(building.id, !!c)} 
                                  />
                                  <Label htmlFor={`build-${building.id}`} className="cursor-pointer flex items-center gap-1">
                                    <Building className="h-3 w-3 text-purple-400" /> {building.name}
                                  </Label>
                                </div>

                                {/* CAFETERIAS LEVEL (Only show if Building is checked) */}
                                {isBuildingChecked && buildingCafeterias.length > 0 && (
                                  <div className="ml-6 space-y-2">
                                    {buildingCafeterias.map(cafe => {
                                      const isCafeChecked = (formData.cafeteriaIds || []).includes(cafe.id);
                                      return (
                                      <div key={cafe.id} className="space-y-1">
                                        <div className="flex items-center space-x-2 text-sm text-gray-600 bg-gray-50 p-1 rounded w-fit pr-3 border border-gray-100">
                                          <Checkbox 
                                            id={`cafe-${cafe.id}`} 
                                            checked={isCafeChecked} 
                                            onCheckedChange={(c) => toggleCafeteria(cafe.id, !!c)} 
                                          />
                                          <Label htmlFor={`cafe-${cafe.id}`} className="cursor-pointer flex items-center gap-1">
                                            <Store className="h-3 w-3 text-orange-400" /> {cafe.name}
                                          </Label>
                                        </div>
                                        
                                        {/* SHIFTS LEVEL */}
                                        {isCafeChecked && cafe.shifts && cafe.shifts.length > 0 && (
                                          <div className="ml-6 space-y-2 py-2">
                                            {cafe.shifts.map((shift: any) => {
                                              const assignment = (formData.assignedShifts || []).find(s => s.cafeteriaId === cafe.id && s.shiftId === shift.id);
                                              const isShiftChecked = !!assignment;
                                              
                                              return (
                                                <div key={shift.id} className="p-2 border rounded-md bg-white space-y-2">
                                                  <div className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                                                    <Checkbox 
                                                      id={`shift-${cafe.id}-${shift.id}`} 
                                                      checked={isShiftChecked}
                                                      onCheckedChange={(c) => toggleShift(cafe.id, shift.id, !!c)}
                                                    />
                                                    <Label htmlFor={`shift-${cafe.id}-${shift.id}`} className="cursor-pointer">
                                                      {shift.name} ({shift.startTime}-{shift.endTime})
                                                    </Label>
                                                  </div>
                                                  
                                                  {isShiftChecked && assignment && (
                                                    <div className="ml-6 pl-4 border-l-2 border-indigo-100 space-y-3 pt-1 pb-1">
                                                      <div className="space-y-1.5">
                                                        <Label className="text-xs text-gray-500">Work Days</Label>
                                                        <div className="flex flex-wrap gap-1.5">
                                                          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
                                                            <Badge 
                                                              key={day}
                                                              variant={assignment.workDays?.includes(day) ? "default" : "outline"}
                                                              className={`cursor-pointer text-[10px] ${assignment.workDays?.includes(day) ? 'bg-indigo-600' : 'text-gray-400'}`}
                                                              onClick={() => {
                                                                const currentDays = assignment.workDays || [];
                                                                const newDays = currentDays.includes(day) 
                                                                  ? currentDays.filter(d => d !== day)
                                                                  : [...currentDays, day];
                                                                updateShiftDetails(cafe.id, shift.id, { workDays: newDays });
                                                              }}
                                                            >
                                                              {day}
                                                            </Badge>
                                                          ))}
                                                        </div>
                                                      </div>
                                                      
                                                      <div className="space-y-1.5">
                                                        <Label className="text-xs text-gray-500">Work Structure</Label>
                                                        <select 
                                                          className="w-full text-xs border rounded p-1.5 bg-gray-50 text-gray-700 outline-none"
                                                          value={assignment.workType || "On-site"}
                                                          onChange={(e) => updateShiftDetails(cafe.id, shift.id, { workType: e.target.value as any })}
                                                        >
                                                          <option value="On-site">On-site</option>
                                                          <option value="Hybrid">Hybrid</option>
                                                          <option value="Remote">Remote</option>
                                                        </select>
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              )
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    )})}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            ) : (
            <div className="col-span-2 space-y-6 mt-4 border rounded-lg p-4 bg-gray-50/50">
              <div>
                <Label className="text-blue-700 font-semibold text-base">Office Location</Label>
                <p className="text-xs text-gray-500 mb-2">Search and pin the specific office location for this employee.</p>
                <div className="h-64 w-full rounded overflow-hidden border">
                  <GoogleMapPicker 
                    onLocationChange={(loc) => {
                      setFormData(prev => ({
                        ...prev,
                        officeLocation: {
                          address: loc.address,
                          latitude: loc.lat,
                          longitude: loc.lng,
                          radius: prev.officeLocation?.radius || 100
                        }
                      }))
                    }}
                    onRadiusChange={(radius) => {
                      setFormData(prev => ({
                        ...prev,
                        officeLocation: {
                          address: prev.officeLocation?.address || "",
                          latitude: prev.officeLocation?.latitude || 0,
                          longitude: prev.officeLocation?.longitude || 0,
                          radius
                        }
                      }))
                    }}
                    radius={formData.officeLocation?.radius || 100}
                    initialLat={formData.officeLocation?.latitude}
                    initialLng={formData.officeLocation?.longitude}
                    initialAddress={formData.officeLocation?.address}
                  />
                </div>
                {formData.officeLocation && (
                  <div className="mt-2 text-xs text-gray-600 bg-white p-2 border rounded">
                    <strong>Saved Location:</strong> {formData.officeLocation.address}
                  </div>
                )}
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <Label className="text-blue-700 font-semibold text-base">Global Shift Assignments</Label>
                    <p className="text-xs text-gray-500">Assign standard shifts that apply to this employee regardless of specific cafeterias.</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={handleCreateGlobalShift} className="h-7 text-xs">
                    <Plus className="h-3 w-3 mr-1" /> Create Shift
                  </Button>
                </div>
                
                <div className="space-y-3 border border-gray-200 bg-white rounded-md p-3 max-h-64 overflow-y-auto">
                  {globalShifts.length === 0 && <p className="text-sm text-gray-500">No global shifts created yet.</p>}
                  
                  <div className="space-y-2 py-2">
                    {globalShifts.map((shift: any) => {
                      const assignment = (formData.assignedShifts || []).find(s => s.cafeteriaId === 'global' && s.shiftId === shift.id);
                      const isShiftChecked = !!assignment;
                      
                      return (
                        <div key={shift.id} className="p-2 border rounded-md bg-white space-y-2">
                          <div className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                            <Checkbox 
                              id={`global-shift-${shift.id}`} 
                              checked={isShiftChecked}
                              onCheckedChange={(c) => toggleShift('global', shift.id, !!c)}
                            />
                            <Label htmlFor={`global-shift-${shift.id}`} className="cursor-pointer">
                              {shift.name} ({shift.startTime}-{shift.endTime})
                            </Label>
                          </div>
                          
                          {isShiftChecked && assignment && (
                            <div className="ml-6 pl-4 border-l-2 border-indigo-100 space-y-3 pt-1 pb-1">
                              <div className="space-y-1.5">
                                <Label className="text-xs text-gray-500">Work Days</Label>
                                <div className="flex flex-wrap gap-1.5">
                                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
                                    <Badge 
                                      key={day}
                                      variant={assignment.workDays?.includes(day) ? "default" : "outline"}
                                      className={`cursor-pointer text-[10px] ${assignment.workDays?.includes(day) ? 'bg-indigo-600' : 'text-gray-400'}`}
                                      onClick={() => {
                                        const currentDays = assignment.workDays || [];
                                        const newDays = currentDays.includes(day) 
                                          ? currentDays.filter(d => d !== day)
                                          : [...currentDays, day];
                                        updateShiftDetails('global', shift.id, { workDays: newDays });
                                      }}
                                    >
                                      {day}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              
                              <div className="space-y-1.5">
                                <Label className="text-xs text-gray-500">Work Structure</Label>
                                <select 
                                  className="w-full text-xs border rounded p-1.5 bg-gray-50 text-gray-700 outline-none"
                                  value={assignment.workType || "On-site"}
                                  onChange={(e) => updateShiftDetails('global', shift.id, { workType: e.target.value as any })}
                                >
                                  <option value="On-site">On-site</option>
                                  <option value="Hybrid">Hybrid</option>
                                  <option value="Remote">Remote</option>
                                </select>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-blue-700 font-semibold text-base mb-2 block">Assigned Breaks</Label>
                <p className="text-xs text-gray-500 mb-3">Assign standard daily breaks for this employee.</p>
                <div className="space-y-2 border border-gray-200 bg-white rounded-md p-3">
                  {[
                    { name: 'Lunch Break', durationMinutes: 60 },
                    { name: 'Tea Break', durationMinutes: 15 },
                    { name: 'Short Break', durationMinutes: 10 }
                  ].map((presetBreak) => {
                    const isChecked = formData.assignedBreaks?.some(b => b.name === presetBreak.name);
                    return (
                      <div key={presetBreak.name} className="flex items-center space-x-2 p-1">
                        <Checkbox 
                          id={`break-${presetBreak.name}`}
                          checked={isChecked}
                          onCheckedChange={(c) => {
                            setFormData(prev => {
                              const currentBreaks = prev.assignedBreaks || [];
                              if (c) {
                                return { ...prev, assignedBreaks: [...currentBreaks, presetBreak] };
                              } else {
                                return { ...prev, assignedBreaks: currentBreaks.filter(b => b.name !== presetBreak.name) };
                              }
                            });
                          }}
                        />
                        <Label htmlFor={`break-${presetBreak.name}`} className="cursor-pointer text-sm font-medium">
                          {presetBreak.name} <span className="text-gray-500 font-normal">({presetBreak.durationMinutes} mins)</span>
                        </Label>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            )}

            {formData.userType === 'vendor_staff' && (
              <div className="col-span-2 space-y-4 mt-4 border rounded-lg p-4 bg-orange-50/30 border-orange-100">
                <div>
                  <Label className="text-orange-700 font-semibold text-base block mb-1">Compliance Documents</Label>
                  <p className="text-xs text-gray-500 mb-4">Track Police Verification and Medical Certificates. Expiry warnings will show on the Company dashboard.</p>
                  
                  <div className="space-y-4">
                    {(formData.complianceDocuments || []).map((doc, idx) => (
                      <div key={idx} className="p-3 border bg-white rounded-md space-y-3 relative">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 absolute top-2 right-2 text-red-500 hover:bg-red-50"
                          onClick={() => {
                            const newDocs = [...(formData.complianceDocuments || [])];
                            newDocs.splice(idx, 1);
                            setFormData({ ...formData, complianceDocuments: newDocs });
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                        
                        <div className="grid grid-cols-2 gap-4 pr-6">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Document Type</Label>
                            <select 
                              className="w-full text-sm border rounded p-2 bg-gray-50 outline-none"
                              value={doc.type}
                              onChange={(e) => {
                                const newDocs = [...(formData.complianceDocuments || [])];
                                newDocs[idx].type = e.target.value as any;
                                setFormData({ ...formData, complianceDocuments: newDocs });
                              }}
                            >
                              <option value="Police Verification">Police Verification</option>
                              <option value="Medical Certificate">Medical Certificate</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Status</Label>
                            <select 
                              className="w-full text-sm border rounded p-2 bg-gray-50 outline-none"
                              value={doc.status}
                              onChange={(e) => {
                                const newDocs = [...(formData.complianceDocuments || [])];
                                newDocs[idx].status = e.target.value as any;
                                setFormData({ ...formData, complianceDocuments: newDocs });
                              }}
                            >
                              <option value="valid">Valid</option>
                              <option value="pending">Pending Verification</option>
                              <option value="expired">Expired</option>
                            </select>
                          </div>
                          
                          <div className="space-y-1.5">
                            <Label className="text-xs">Issue Date</Label>
                            <Input 
                              type="date"
                              className="text-sm"
                              value={doc.issueDate ? new Date(doc.issueDate.seconds ? doc.issueDate.toDate() : doc.issueDate).toISOString().split('T')[0] : ''}
                              onChange={(e) => {
                                const newDocs = [...(formData.complianceDocuments || [])];
                                newDocs[idx].issueDate = new Date(e.target.value);
                                setFormData({ ...formData, complianceDocuments: newDocs });
                              }}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Expiry Date</Label>
                            <Input 
                              type="date"
                              className="text-sm"
                              value={doc.expiryDate ? new Date(doc.expiryDate.seconds ? doc.expiryDate.toDate() : doc.expiryDate).toISOString().split('T')[0] : ''}
                              onChange={(e) => {
                                const newDocs = [...(formData.complianceDocuments || [])];
                                newDocs[idx].expiryDate = new Date(e.target.value);
                                setFormData({ ...formData, complianceDocuments: newDocs });
                              }}
                            />
                          </div>
                          
                          <div className="col-span-2 space-y-1.5">
                            <Label className="text-xs">Document URL (Mock Upload)</Label>
                            <Input 
                              placeholder="https://..."
                              className="text-sm"
                              value={doc.url}
                              onChange={(e) => {
                                const newDocs = [...(formData.complianceDocuments || [])];
                                newDocs[idx].url = e.target.value;
                                setFormData({ ...formData, complianceDocuments: newDocs });
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="mt-3 text-xs border-orange-200 text-orange-700 hover:bg-orange-50"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        complianceDocuments: [
                          ...(formData.complianceDocuments || []),
                          { type: 'Police Verification', url: '', status: 'pending' }
                        ]
                      })
                    }}
                  >
                    + Add Document
                  </Button>
                </div>
              </div>
            )}

            <div className="col-span-2 flex items-center justify-between rounded-lg border p-3 mt-2">
              <div className="space-y-0.5">
                  <Label>User Status</Label>
                  <p className="text-xs text-gray-500">Inactive users cannot log into the system.</p>
              </div>
              <Switch
                checked={formData.status === 'active'}
                onCheckedChange={(checked) => setFormData({...formData, status: checked ? 'active' : 'inactive'})}
              />
            </div>

          </div>
          
          <DialogFooter className="mt-4 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}