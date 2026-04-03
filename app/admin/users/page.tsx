"use client"

import React, { useState, useEffect, useMemo } from "react"
import { db } from "@/lib/firebase"
import { collection, getDocs } from "firebase/firestore"
import { usersService, type User } from "@/lib/firestore/usersService"
import { toast } from "@/hooks/use-toast"

// Icons
import { Plus, Pencil, Trash2, Ban, CheckCircle, Users, Building, Store } from "lucide-react"

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

const initialUserState: Omit<User, "id" | "createdAt" | "updatedAt"> = {
  name: "",
  email: "",
  phone: "",
  roleId: "",
  roleKey: "",
  vendorId: "",
  companyIds: [],
  buildingIds: [],
  cafeteriaIds: [],
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
      const [usersRes, rolesSnap, vendorsSnap, companiesSnap, buildingsSnap, cafeteriasSnap] = await Promise.all([
        usersService.getAll(),
        getDocs(collection(db, 'roles')),
        getDocs(collection(db, 'vendors')),
        getDocs(collection(db, 'companies')),
        getDocs(collection(db, 'buildings')),
        getDocs(collection(db, 'cafetarias')) // Ensure this matches your DB collection name
      ])

      setData(usersRes)
      setRoles(rolesSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setVendors(vendorsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setCompanies(companiesSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setBuildings(buildingsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setCafeterias(cafeteriasSnap.docs.map(d => ({ id: d.id, ...d.data() })))
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
          cafeteriaIds: (prev.cafeteriaIds || []).filter(id => !relatedCafeteriaIds.includes(id))
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
          cafeteriaIds: (prev.cafeteriaIds || []).filter(id => !relatedCafeteriaIds.includes(id))
        }
      }
    })
  }

  const toggleCafeteria = (cafeteriaId: string, checked: boolean) => {
    setFormData(prev => {
      if (checked) return { ...prev, cafeteriaIds: [...(prev.cafeteriaIds || []), cafeteriaId] }
      return { ...prev, cafeteriaIds: (prev.cafeteriaIds || []).filter(id => id !== cafeteriaId) }
    })
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
      roleId: user.roleId,
      roleKey: user.roleKey,
      vendorId: user.vendorId || "none",
      companyIds: user.companyIds || [],
      buildingIds: user.buildingIds || [],
      cafeteriaIds: user.cafeteriaIds || [],
      managerId: user.managerId || "none",
      status: user.status || 'active'
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

      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead>User Info</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Reporting To</TableHead>
              <TableHead>Assignments</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="h-24 text-center">Loading Users...</TableCell></TableRow>
            ) : data.map((user) => (
              <TableRow key={user.id} className={user.status === 'inactive' ? 'bg-gray-50 text-gray-500' : ''}>
                <TableCell>
                  <div className="font-semibold">{user.name}</div>
                  <div className="text-xs text-gray-500">{user.email}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    {user.roleKey}
                  </Badge>
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
                    {(!user.companyIds?.length && !user.buildingIds?.length && !user.cafeteriaIds?.length) && <span className="text-xs text-gray-400">—</span>}
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
              <Label>Role *</Label>
              <Select value={formData.roleId} onValueChange={handleRoleChange}>
                <SelectTrigger><SelectValue placeholder="Select a Role" /></SelectTrigger>
                <SelectContent>
                  {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* --- RELATIONS & HIERARCHY --- */}
            <div className="space-y-2">
              <Label>Vendor (Caterer)</Label>
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
            <div className="col-span-2 space-y-3 mt-4 border rounded-lg p-4 bg-gray-50/50">
              <div>
                <Label className="text-blue-700 font-semibold text-base">Location Assignments</Label>
                <p className="text-xs text-gray-500">Select a company to reveal its buildings. Leaving buildings empty implies access to the whole company.</p>
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
                                  <div className="ml-6 space-y-1">
                                    {buildingCafeterias.map(cafe => (
                                      <div key={cafe.id} className="flex items-center space-x-2 text-sm text-gray-600 bg-gray-50 p-1 rounded w-fit pr-3 border border-gray-100">
                                        <Checkbox 
                                          id={`cafe-${cafe.id}`} 
                                          checked={(formData.cafeteriaIds || []).includes(cafe.id)} 
                                          onCheckedChange={(c) => toggleCafeteria(cafe.id, !!c)} 
                                        />
                                        <Label htmlFor={`cafe-${cafe.id}`} className="cursor-pointer flex items-center gap-1">
                                          <Store className="h-3 w-3 text-orange-400" /> {cafe.name}
                                        </Label>
                                      </div>
                                    ))}
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