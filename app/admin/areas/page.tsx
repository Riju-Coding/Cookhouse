"use client"

import React, { useState, useEffect } from "react"
import { db } from "@/lib/firebase"
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore"
import { toast } from "@/hooks/use-toast"

// Icons
import { Plus, Pencil, Trash2, Building, Store, Layers } from "lucide-react"

// UI Components
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

interface Area {
  id: string
  name: string
  description?: string
  companyId: string
  buildingId: string
  cafeteriaId: string
  status: 'active' | 'inactive'
  createdAt?: any
  updatedAt?: any
}

const initialAreaState: Omit<Area, "id" | "createdAt" | "updatedAt"> = {
  name: "",
  description: "",
  companyId: "",
  buildingId: "",
  cafeteriaId: "",
  status: 'active',
}

export default function AreasPage() {
  const [areas, setAreas] = useState<Area[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [buildings, setBuildings] = useState<any[]>([])
  const [cafeterias, setCafeterias] = useState<any[]>([])
  
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState(initialAreaState)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    try {
      setLoading(true)
      const [areasSnap, companiesSnap, buildingsSnap, cafeteriasSnap] = await Promise.all([
        getDocs(collection(db, 'areas')),
        getDocs(collection(db, 'companies')),
        getDocs(collection(db, 'buildings')),
        getDocs(collection(db, 'cafetarias'))
      ])

      setAreas(areasSnap.docs.map(d => ({ id: d.id, ...d.data() } as Area)))
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

  const handleEdit = (area: Area) => {
    setEditingId(area.id)
    setFormData({
      name: area.name,
      description: area.description || "",
      companyId: area.companyId,
      buildingId: area.buildingId,
      cafeteriaId: area.cafeteriaId,
      status: area.status
    })
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.cafeteriaId) {
      toast({ title: "Validation Error", description: "Area name and cafeteria are required.", variant: "destructive" })
      return
    }

    try {
      setIsSaving(true)
      
      if (editingId) {
        const docRef = doc(db, 'areas', editingId)
        await updateDoc(docRef, {
          ...formData,
          updatedAt: serverTimestamp(),
        })
        toast({ title: "Success", description: "Area updated successfully" })
      } else {
        await addDoc(collection(db, 'areas'), {
          ...formData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        toast({ title: "Success", description: "Area created successfully" })
      }
      setIsModalOpen(false)
      setFormData(initialAreaState)
      setEditingId(null)
      await fetchInitialData()
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Operation failed", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this area?")) return
    try {
      await deleteDoc(doc(db, 'areas', id))
      toast({ title: "Success", description: "Area deleted" })
      setAreas(areas.filter(item => item.id !== id))
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Delete failed", variant: "destructive" })
    }
  }

  const getHierarchyNames = (area: Area) => {
    const company = companies.find(c => c.id === area.companyId)
    const building = buildings.find(b => b.id === area.buildingId)
    const cafeteria = cafeterias.find(c => c.id === area.cafeteriaId)
    return { company, building, cafeteria }
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Areas Management</h1>
          <p className="text-gray-600 mt-1">Create sub-areas within companies, buildings, and cafeterias</p>
        </div>
        <Button onClick={() => {
          setFormData(initialAreaState)
          setEditingId(null)
          setIsModalOpen(true)
        }}>
          <Plus className="mr-2 h-4 w-4" /> Create Area
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Area Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Building</TableHead>
              <TableHead>Cafeteria</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">Loading areas...</TableCell>
              </TableRow>
            ) : areas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-gray-500">No areas found. Create one to get started.</TableCell>
              </TableRow>
            ) : (
              areas.map((area) => {
                const { company, building, cafeteria } = getHierarchyNames(area)
                return (
                  <TableRow key={area.id}>
                    <TableCell className="font-semibold">{area.name}</TableCell>
                    <TableCell className="text-sm">{company?.name || "—"}</TableCell>
                    <TableCell className="text-sm">{building?.name || "—"}</TableCell>
                    <TableCell className="text-sm">{cafeteria?.name || "—"}</TableCell>
                    <TableCell className="text-sm text-gray-600">{area.description || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={area.status === 'active' ? 'default' : 'secondary'}>
                        {area.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(area)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(area.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Area" : "Create New Area"}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* STEP 1: Select Company */}
            <div>
              <Label className="font-semibold">1. Select Company *</Label>
              <Select value={formData.companyId} onValueChange={(val) => setFormData({...formData, companyId: val, buildingId: "", cafeteriaId: ""})}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* STEP 2: Select Building (only if Company is selected) */}
            {formData.companyId && (
              <div>
                <Label className="font-semibold">2. Select Building *</Label>
                <Select value={formData.buildingId} onValueChange={(val) => setFormData({...formData, buildingId: val, cafeteriaId: ""})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a building" />
                  </SelectTrigger>
                  <SelectContent>
                    {buildings.filter(b => b.companyId === formData.companyId).map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* STEP 3: Select Cafeteria (only if Building is selected) */}
            {formData.buildingId && (
              <div>
                <Label className="font-semibold">3. Select Cafeteria *</Label>
                <Select value={formData.cafeteriaId} onValueChange={(val) => setFormData({...formData, cafeteriaId: val})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a cafeteria" />
                  </SelectTrigger>
                  <SelectContent>
                    {cafeterias.filter(c => c.buildingId === formData.buildingId).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* STEP 4: Area Name (only if Cafeteria is selected) */}
            {formData.cafeteriaId && (
              <>
                <div>
                  <Label className="font-semibold">4. Area Name *</Label>
                  <Input 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    placeholder="e.g., North Wing, Dining Area A" 
                  />
                </div>

                <div>
                  <Label className="font-semibold">Description</Label>
                  <Textarea 
                    value={formData.description || ""} 
                    onChange={e => setFormData({...formData, description: e.target.value})} 
                    placeholder="Optional description" 
                    rows={2}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={formData.status === 'active'}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, status: checked ? 'active' : 'inactive' })
                    }
                  />
                  <Label className="font-normal">Active</Label>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !formData.cafeteriaId}>
              {isSaving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
