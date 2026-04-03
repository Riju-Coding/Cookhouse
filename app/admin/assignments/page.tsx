"use client"

import React, { useState, useEffect, useMemo } from "react"
import { db } from "@/lib/firebase"
import { collection, getDocs } from "firebase/firestore"
import { assignmentsService, type Assignment } from "@/lib/firestore/assignmentsService"
import { toast } from "@/hooks/use-toast"

// Icons
import { Plus, Pencil, Trash2, Ban, CheckCircle, Network, UserCheck, MapPin } from "lucide-react"

// UI Components
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const initialAssignmentState: Omit<Assignment, "id" | "createdAt" | "updatedAt"> = {
  vendorId: "",
  companyId: "",
  buildingId: "",
  cafetariaId: "",
  kamId: "",
  supervisorIds: [],
  staffIds: [],
  status: 'active',
}

export default function AssignmentManagementPage() {
  const [data, setData] = useState<Assignment[]>([])
  
  // Master relational data
  const [vendors, setVendors] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [buildings, setBuildings] = useState<any[]>([])
  const [cafeterias, setCafeterias] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([]) // All users with their managerId and roleKey
  
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState(initialAssignmentState)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    try {
      setLoading(true)
      const [assnRes, vSnap, cSnap, bSnap, cafSnap, uSnap] = await Promise.all([
        assignmentsService.getAll(),
        getDocs(collection(db, 'vendors')),
        getDocs(collection(db, 'companies')),
        getDocs(collection(db, 'buildings')),
        getDocs(collection(db, 'cafetarias')),
        getDocs(collection(db, 'users'))
      ])

      setData(assnRes)
      setVendors(vSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setCompanies(cSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setBuildings(bSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setCafeterias(cafSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setUsers(uSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // --- SMART UX: CASCADING FILTERS ---
  const filteredBuildings = useMemo(() => {
    if (!formData.companyId) return [];
    return buildings.filter(b => b.companyId === formData.companyId);
  }, [buildings, formData.companyId]);

  const filteredCafeterias = useMemo(() => {
    if (!formData.buildingId || !formData.vendorId) return [];
    return cafeterias.filter(c => c.buildingId === formData.buildingId && c.vendorId === formData.vendorId);
  }, [cafeterias, formData.buildingId, formData.vendorId]);

  // Dynamic KAMs: Users of selected vendor, who don't have a manager (top-level)
  const availableKAMs = useMemo(() => {
    if (!formData.vendorId) return [];
    return users.filter(u => 
      u.vendorId === formData.vendorId && 
      (!u.managerId || u.managerId === "none") && // Top-level within vendor hierarchy
      u.status === 'active'
    );
  }, [users, formData.vendorId]);

  // Dynamic Supervisors: Users of selected vendor, who report to the selected KAM
  const availableSupervisors = useMemo(() => {
    if (!formData.vendorId || !formData.kamId) return [];
    return users.filter(u => 
      u.vendorId === formData.vendorId && 
      u.managerId === formData.kamId && 
      u.status === 'active'
    );
  }, [users, formData.vendorId, formData.kamId]);

  // Dynamic Staff: Users of selected vendor, who report to any of the selected Supervisors
  const availableStaff = useMemo(() => {
    if (!formData.vendorId || !formData.supervisorIds || formData.supervisorIds.length === 0) return [];
    return users.filter(u => 
      u.vendorId === formData.vendorId && 
      formData.supervisorIds.includes(u.managerId) && // Reports to one of the selected supervisors
      u.status === 'active'
    );
  }, [users, formData.vendorId, formData.supervisorIds]);


  // --- CASCADING RESET HANDLERS ---
  const handleVendorChange = (vendorId: string) => {
    setFormData(prev => ({
      ...initialAssignmentState, // Reset everything
      vendorId,
    }))
  }

  const handleCompanyChange = (companyId: string) => {
    setFormData(prev => ({
      ...prev,
      companyId,
      buildingId: "",
      cafetariaId: "",
    }))
  }

  const handleBuildingChange = (buildingId: string) => {
    setFormData(prev => ({
      ...prev,
      buildingId,
      cafetariaId: "",
    }))
  }

  const handleKamChange = (kamId: string) => {
    setFormData(prev => ({
      ...prev,
      kamId,
      supervisorIds: [], // Reset supervisors if KAM changes
      staffIds: [],      // Reset staff if KAM changes
    }))
  }

  const toggleUserArray = (field: 'supervisorIds' | 'staffIds', userId: string, checked: boolean) => {
    setFormData(prev => {
      const arr = prev[field] || [];
      if (checked) return { ...prev, [field]: [...arr, userId] };
      // If a supervisor is unchecked, remove any staff who reported ONLY to that supervisor
      if (field === 'supervisorIds' && !checked) {
          const removedSupervisorId = userId;
          const staffToKeep = (prev.staffIds || []).filter(staffId => {
              const staffUser = users.find(u => u.id === staffId);
              return staffUser && staffUser.managerId !== removedSupervisorId; // Keep if manager is NOT the removed supervisor
          });
          return { 
              ...prev, 
              [field]: arr.filter(id => id !== userId),
              staffIds: staffToKeep
          };
      }
      return { ...prev, [field]: arr.filter(id => id !== userId) };
    });
  }

  // --- CRUD HANDLERS ---
  const handleOpenAdd = () => {
    setEditingId(null)
    setFormData(initialAssignmentState)
    setIsModalOpen(true)
  }

  const handleEdit = (assignment: Assignment) => {
    setEditingId(assignment.id)
    setFormData({
      vendorId: assignment.vendorId,
      companyId: assignment.companyId,
      buildingId: assignment.buildingId,
      cafetariaId: assignment.cafetariaId,
      kamId: assignment.kamId,
      supervisorIds: assignment.supervisorIds || [],
      staffIds: assignment.staffIds || [],
      status: assignment.status || 'active'
    })
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    if (!formData.vendorId || !formData.cafetariaId || !formData.kamId) {
      toast({ title: "Validation Error", description: "Vendor, Cafeteria, and KAM are strictly required.", variant: "destructive" })
      return
    }

    try {
      setIsSaving(true)
      if (editingId) {
        await assignmentsService.update(editingId, formData)
        toast({ title: "Success", description: "Assignment updated successfully" })
      } else {
        await assignmentsService.add(formData)
        toast({ title: "Success", description: "Assignment created successfully" })
      }
      setIsModalOpen(false)
      const updatedData = await assignmentsService.getAll()
      setData(updatedData)
    } catch (error) {
      toast({ title: "Error", description: "Operation failed", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleStatus = async (assignment: Assignment) => {
    const newStatus = assignment.status === 'active' ? 'inactive' : 'active';
    try {
      await assignmentsService.update(assignment.id, { status: newStatus });
      toast({ title: "Success", description: `Assignment ${newStatus === 'active' ? 'enabled' : 'disabled'}` });
      const updatedData = await assignmentsService.getAll();
      setData(updatedData);
    } catch (error) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this assignment?")) return
    try {
      await assignmentsService.delete(id)
      toast({ title: "Success", description: "Assignment deleted" })
      setData(data.filter(item => item.id !== id))
    } catch (error) {
      toast({ title: "Error", description: "Delete failed", variant: "destructive" })
    }
  }

  // --- HELPERS FOR TABLE DISPLAY ---
  const getName = (arr: any[], id: string) => arr.find(item => item.id === id)?.name || <span className="text-gray-400">—</span>;
  const getUserNameAndRole = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return <span className="text-gray-400">—</span>;
    return `${user.name} (${user.roleKey})`;
  };

  return (
    <div className="space-y-6 p-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Network className="h-6 w-6 text-blue-600" /> Assignment Management
          </h1>
          <p className="text-gray-600">Assign KAMs, Supervisors, and Staff to specific Cafeterias based on reporting lines.</p>
        </div>
        <Button onClick={handleOpenAdd}>
          <Plus className="mr-2 h-4 w-4" /> Create Assignment
        </Button>
      </div>

      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead>Location Details</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Assigned KAM</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center">Loading Assignments...</TableCell></TableRow>
            ) : data.length === 0 ? (
               <TableRow><TableCell colSpan={6} className="h-24 text-center text-gray-500">No assignments found.</TableCell></TableRow>
            ) : data.map((assn) => (
              <TableRow key={assn.id} className={assn.status === 'inactive' ? 'bg-gray-50 text-gray-500' : ''}>
                <TableCell>
                  <div className="font-semibold text-blue-700">{getName(cafeterias, assn.cafetariaId)}</div>
                  <div className="text-xs text-gray-500">{getName(companies, assn.companyId)} • {getName(buildings, assn.buildingId)}</div>
                </TableCell>
                <TableCell className="text-sm font-medium">{getName(vendors, assn.vendorId)}</TableCell>
                <TableCell className="text-sm">{getUserNameAndRole(assn.kamId)}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                      {assn.supervisorIds?.length || 0} Sups
                    </Badge>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      {assn.staffIds?.length || 0} Staff
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={assn.status === 'active' ? 'default' : 'secondary'}>
                    {assn.status || 'active'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50" onClick={() => handleEdit(assn)} title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" className={`h-8 w-8 p-0 ${assn.status === 'active' ? 'text-orange-600 hover:text-orange-800 hover:bg-orange-50' : 'text-green-600 hover:text-green-800 hover:bg-green-50'}`} onClick={() => handleToggleStatus(assn)} title={assn.status === 'active' ? 'Disable' : 'Enable'}>
                      {assn.status === 'active' ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50" onClick={() => handleDelete(assn.id)} title="Delete">
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
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <div className="p-6 border-b bg-gray-50/50">
            <DialogTitle className="text-xl">{editingId ? "Edit Cafeteria Assignment" : "New Cafeteria Assignment"}</DialogTitle>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 overflow-y-auto">
            
            {/* --- STEP 1: LOCATION HIERARCHY --- */}
            <div className="space-y-5">
              <div className="flex items-center gap-2 border-b pb-2">
                <MapPin className="h-5 w-5 text-gray-500" />
                <h3 className="font-semibold text-lg">Step 1: Location Setup</h3>
              </div>

              <div className="space-y-2">
                <Label>1. Vendor (Caterer) *</Label>
                <Select value={formData.vendorId} onValueChange={handleVendorChange}>
                  <SelectTrigger><SelectValue placeholder="Select Vendor" /></SelectTrigger>
                  <SelectContent>
                    {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>2. Company</Label>
                <Select value={formData.companyId} onValueChange={handleCompanyChange} disabled={!formData.vendorId}>
                  <SelectTrigger><SelectValue placeholder="Select Company" /></SelectTrigger>
                  <SelectContent>
                    {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>3. Building</Label>
                <Select value={formData.buildingId} onValueChange={handleBuildingChange} disabled={!formData.companyId}>
                  <SelectTrigger><SelectValue placeholder="Select Building" /></SelectTrigger>
                  <SelectContent>
                    {filteredBuildings.length === 0 ? <SelectItem value="none" disabled>No buildings found</SelectItem> : 
                      filteredBuildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>4. Cafeteria (Target) *</Label>
                <Select value={formData.cafetariaId} onValueChange={(val) => setFormData({...formData, cafetariaId: val})} disabled={!formData.buildingId}>
                  <SelectTrigger><SelectValue placeholder="Select Cafeteria" /></SelectTrigger>
                  <SelectContent>
                    {filteredCafeterias.length === 0 ? <SelectItem value="none" disabled>No matching cafeterias found</SelectItem> : 
                      filteredCafeterias.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {formData.buildingId && filteredCafeterias.length === 0 && (
                  <p className="text-xs text-red-500">No cafeterias in this building are assigned to the selected vendor.</p>
                )}
              </div>
            </div>

            {/* --- STEP 2: STAFF ASSIGNMENT --- */}
            <div className="space-y-5">
              <div className="flex items-center gap-2 border-b pb-2">
                <UserCheck className="h-5 w-5 text-gray-500" />
                <h3 className="font-semibold text-lg">Step 2: Team Assignment</h3>
              </div>

              {!formData.vendorId ? (
                <div className="h-full flex items-center justify-center p-6 text-center border-2 border-dashed rounded-lg bg-gray-50 text-gray-400">
                  Select a Vendor first to assign personnel.
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className="text-blue-700">Key Account Manager (KAM) *</Label>
                    <Select value={formData.kamId} onValueChange={handleKamChange}>
                      <SelectTrigger><SelectValue placeholder="Select KAM" /></SelectTrigger>
                      <SelectContent>
                        {availableKAMs.length === 0 ? <SelectItem value="none" disabled>No top-level users found for this vendor</SelectItem> : 
                          availableKAMs.map(k => <SelectItem key={k.id} value={k.id}>{k.name} ({k.roleKey})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {formData.vendorId && availableKAMs.length === 0 && (
                      <p className="text-xs text-red-500">No active, top-level users found for this vendor.</p>
                    )}
                  </div>

                  <div className="space-y-2 border rounded-lg p-3 bg-purple-50/30">
                    <Label className="text-purple-700">Supervisors</Label>
                    <div className="max-h-24 overflow-y-auto space-y-2 pr-2">
                      {(!formData.kamId || availableSupervisors.length === 0) ? 
                        <p className="text-sm text-gray-500">Select a KAM to see available Supervisors.</p> : 
                        availableSupervisors.map(u => (
                          <div key={u.id} className="flex items-center space-x-2 bg-white p-1.5 rounded border">
                            <Checkbox 
                              id={`sup-${u.id}`} 
                              checked={(formData.supervisorIds || []).includes(u.id)} 
                              onCheckedChange={(c) => toggleUserArray('supervisorIds', u.id, !!c)} 
                            />
                            <Label htmlFor={`sup-${u.id}`} className="text-sm cursor-pointer">{u.name} ({u.roleKey})</Label>
                          </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 border rounded-lg p-3 bg-green-50/30">
                    <Label className="text-green-700">Staff Members</Label>
                    <div className="max-h-32 overflow-y-auto grid grid-cols-2 gap-2 pr-2">
                      {(!formData.supervisorIds || formData.supervisorIds.length === 0 || availableStaff.length === 0) ? 
                        <p className="text-sm text-gray-500 col-span-2">Select Supervisors to see available Staff.</p> : 
                        availableStaff.map(u => (
                          <div key={u.id} className="flex items-center space-x-2 bg-white p-1.5 rounded border truncate">
                            <Checkbox 
                              id={`staff-${u.id}`} 
                              checked={(formData.staffIds || []).includes(u.id)} 
                              onCheckedChange={(c) => toggleUserArray('staffIds', u.id, !!c)} 
                            />
                            <Label htmlFor={`staff-${u.id}`} className="text-sm cursor-pointer truncate">{u.name} ({u.roleKey})</Label>
                          </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

          </div>
          
          <div className="p-6 border-t bg-gray-50/50 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch checked={formData.status === 'active'} onCheckedChange={(c) => setFormData({...formData, status: c ? 'active' : 'inactive'})} />
              <Label className="text-sm font-medium">{formData.status === 'active' ? 'Assignment is Active' : 'Assignment is Disabled'}</Label>
            </div>
            <div className="space-x-2">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Assignment"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}