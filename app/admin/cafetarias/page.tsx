    "use client"

import React, { useState, useEffect, useMemo } from "react"
import { db } from "@/lib/firebase"
import { collection, getDocs } from "firebase/firestore"
import { cafeteriasService, type Cafeteria } from "@/lib/firestore/cafeteriasService"
import { toast } from "@/hooks/use-toast"

// Icons
import { Plus, Pencil, Trash2, Ban, CheckCircle, Store } from "lucide-react"

// UI Components
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const initialCafeteriaState: Omit<Cafeteria, "id" | "createdAt" | "updatedAt"> = {
  name: "",
  companyId: "",
  buildingId: "",
  vendorId: "",
  status: 'active',
}

export default function CafeteriaManagementPage() {
  // --- STATE ---
  const [data, setData] = useState<Cafeteria[]>([])
  
  // Relational Data State
  const [companies, setCompanies] = useState<any[]>([])
  const [buildings, setBuildings] = useState<any[]>([])
  const [vendors, setVendors] = useState<any[]>([])
  
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState(initialCafeteriaState)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // --- FETCH DATA ---
  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    try {
      setLoading(true)
      
      // Fetch Cafeterias and all related collections in parallel for performance
      const [cafeteriasRes, companiesSnap, buildingsSnap, vendorsSnap] = await Promise.all([
        cafeteriasService.getAll(),
        getDocs(collection(db, 'companies')),
        getDocs(collection(db, 'buildings')),
        getDocs(collection(db, 'vendors'))
      ])

      setData(cafeteriasRes)
      setCompanies(companiesSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setBuildings(buildingsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setVendors(vendorsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // --- SMART UX: Filter Buildings based on Selected Company ---
  const filteredBuildings = useMemo(() => {
    if (!formData.companyId) return [];
    return buildings.filter(b => b.companyId === formData.companyId);
  }, [buildings, formData.companyId]);

  // Handler for Company Selection
  const handleCompanyChange = (companyId: string) => {
    setFormData(prev => ({
      ...prev,
      companyId,
      buildingId: "", // Reset building when company changes!
    }))
  }

  // --- CRUD HANDLERS ---
  const handleOpenAdd = () => {
    setEditingId(null)
    setFormData(initialCafeteriaState)
    setIsModalOpen(true)
  }

  const handleEdit = (cafeteria: Cafeteria) => {
    setEditingId(cafeteria.id)
    setFormData({
      name: cafeteria.name,
      companyId: cafeteria.companyId,
      buildingId: cafeteria.buildingId,
      vendorId: cafeteria.vendorId,
      status: cafeteria.status || 'active'
    })
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    // Validation
    if (!formData.name || !formData.companyId || !formData.buildingId || !formData.vendorId) {
      toast({ title: "Validation Error", description: "All fields are required.", variant: "destructive" })
      return
    }

    try {
      setIsSaving(true)
      if (editingId) {
        await cafeteriasService.update(editingId, formData)
        toast({ title: "Success", description: "Cafeteria updated successfully" })
      } else {
        await cafeteriasService.add(formData)
        toast({ title: "Success", description: "Cafeteria created successfully" })
      }
      setIsModalOpen(false)
      
      // Refresh only cafeterias list
      const updatedCafeterias = await cafeteriasService.getAll()
      setData(updatedCafeterias)
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Operation failed", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleStatus = async (cafeteria: Cafeteria) => {
    const newStatus = cafeteria.status === 'active' ? 'inactive' : 'active';
    try {
      await cafeteriasService.update(cafeteria.id, { status: newStatus });
      toast({ title: "Success", description: `Cafeteria ${newStatus === 'active' ? 'enabled' : 'disabled'}` });
      const updatedCafeterias = await cafeteriasService.getAll();
      setData(updatedCafeterias);
    } catch (error) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this cafeteria?")) return
    try {
      await cafeteriasService.delete(id)
      toast({ title: "Success", description: "Cafeteria deleted" })
      setData(data.filter(item => item.id !== id))
    } catch (error) {
      toast({ title: "Error", description: "Delete failed", variant: "destructive" })
    }
  }

  // --- HELPERS FOR TABLE DISPLAY ---
  const getCompanyName = (id: string) => companies.find(c => c.id === id)?.name || <span className="text-red-400">Unknown</span>;
  const getBuildingName = (id: string) => buildings.find(b => b.id === id)?.name || <span className="text-red-400">Unknown</span>;
  const getVendorName = (id: string) => vendors.find(v => v.id === id)?.name || <span className="text-red-400">Unknown</span>;

  return (
    <div className="space-y-6 p-2">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Store className="h-6 w-6 text-blue-600" /> Cafeteria Management
          </h1>
          <p className="text-gray-600">Link cafeterias to companies, buildings, and vendors.</p>
        </div>
        <Button onClick={handleOpenAdd}>
          <Plus className="mr-2 h-4 w-4" /> Create Cafeteria
        </Button>
      </div>

      {/* TABLE */}
      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead>Cafeteria Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Building</TableHead>
              <TableHead>Vendor (Caterer)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center">Loading Data...</TableCell></TableRow>
            ) : data.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center text-gray-500">No cafeterias found.</TableCell></TableRow>
            ) : data.map((caf) => (
              <TableRow key={caf.id} className={caf.status === 'inactive' ? 'bg-gray-50 text-gray-500' : ''}>
                <TableCell className="font-semibold">{caf.name}</TableCell>
                <TableCell className="text-sm">{getCompanyName(caf.companyId)}</TableCell>
                <TableCell className="text-sm">{getBuildingName(caf.buildingId)}</TableCell>
                <TableCell className="text-sm">{getVendorName(caf.vendorId)}</TableCell>
                <TableCell>
                  <Badge variant={caf.status === 'active' ? 'default' : 'secondary'}>
                    {caf.status || 'active'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50" onClick={() => handleEdit(caf)} title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" className={`h-8 w-8 p-0 ${caf.status === 'active' ? 'text-orange-600 hover:text-orange-800 hover:bg-orange-50' : 'text-green-600 hover:text-green-800 hover:bg-green-50'}`} onClick={() => handleToggleStatus(caf)} title={caf.status === 'active' ? 'Disable' : 'Enable'}>
                      {caf.status === 'active' ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50" onClick={() => handleDelete(caf.id)} title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* MODAL / DIALOG */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Cafeteria" : "New Cafeteria Setup"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            
            {/* Cafeteria Name */}
            <div className="space-y-2">
              <Label>Cafeteria Name *</Label>
              <Input 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                placeholder="e.g., Main Cafeteria, Tower A Cafe" 
              />
            </div>

            {/* Company Selection */}
            <div className="space-y-2">
              <Label>Company *</Label>
              <Select value={formData.companyId} onValueChange={handleCompanyChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a Company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Building Selection (Filtered automatically) */}
            <div className="space-y-2">
              <Label>Building *</Label>
              <Select 
                value={formData.buildingId} 
                onValueChange={(val) => setFormData({...formData, buildingId: val})}
                disabled={!formData.companyId} // Disable if no company is selected
              >
                <SelectTrigger>
                  <SelectValue placeholder={!formData.companyId ? "Select a Company first" : "Select a Building"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredBuildings.length === 0 ? (
                     <SelectItem value="none" disabled>No buildings found for this company</SelectItem>
                  ) : (
                    filteredBuildings.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Vendor Selection */}
            <div className="space-y-2">
              <Label>Vendor (Caterer) *</Label>
              <Select value={formData.vendorId} onValueChange={(val) => setFormData({...formData, vendorId: val})}>
                <SelectTrigger>
                  <SelectValue placeholder="Assign a Vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Toggle */}
             <div className="flex items-center justify-between rounded-lg border p-3 mt-4 bg-gray-50/50">
              <div className="space-y-0.5">
                  <Label>Operational Status</Label>
                  <p className="text-xs text-gray-500">Temporarily close or open this cafeteria.</p>
              </div>
              <Switch
                checked={formData.status === 'active'}
                onCheckedChange={(checked) => setFormData({...formData, status: checked ? 'active' : 'inactive'})}
              />
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Cafeteria"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}