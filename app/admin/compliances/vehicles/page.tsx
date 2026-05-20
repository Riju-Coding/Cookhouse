"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { db } from "@/lib/firebase"
import { collection, getDocs } from "firebase/firestore"
import { vehiclesService, type Vehicle, type VehicleType, type VehicleStatus } from "@/lib/firestore/vehiclesService"
import { toast } from "@/hooks/use-toast"

import { Plus, Pencil, Trash2, Truck, Search, X, Save, RotateCcw, Filter, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [
  { value: 'van', label: 'Van' },
  { value: 'truck', label: 'Truck' },
  { value: 'tempo', label: 'Tempo' },
  { value: 'car', label: 'Car' },
  { value: 'bike', label: 'Bike' },
  { value: 'other', label: 'Other' },
]

const STATUS_OPTIONS: { value: VehicleStatus; label: string; color: string }[] = [
  { value: 'active', label: 'Active', color: 'bg-green-100 text-green-700' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'inactive', label: 'Inactive', color: 'bg-gray-100 text-gray-500' },
]

const initialVehicle: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'> = {
  vehicleNumber: '',
  vendorId: '',
  type: 'van',
  capacity: '',
  driverName: '',
  driverPhone: '',
  status: 'active',
  lastInspectionDate: '',
  notes: '',
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [vendors, setVendors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState(initialVehicle)
  const [search, setSearch] = useState("")
  const [filterVendor, setFilterVendor] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [vehicleData, vendorSnap] = await Promise.all([
        vehiclesService.getAll(),
        getDocs(collection(db, 'vendors'))
      ])
      setVehicles(vehicleData)
      setVendors(vendorSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Failed to load vehicles", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      const matchesSearch = !search || 
        v.vehicleNumber.toLowerCase().includes(search.toLowerCase()) ||
        v.driverName?.toLowerCase().includes(search.toLowerCase())
      const matchesVendor = filterVendor === 'all' || v.vendorId === filterVendor
      const matchesStatus = filterStatus === 'all' || v.status === filterStatus
      return matchesSearch && matchesVendor && matchesStatus
    })
  }, [vehicles, search, filterVendor, filterStatus])

  const openCreateModal = () => {
    setEditingId(null)
    setFormData(initialVehicle)
    setIsModalOpen(true)
  }

  const openEditModal = (vehicle: Vehicle) => {
    setEditingId(vehicle.id)
    setFormData({
      vehicleNumber: vehicle.vehicleNumber,
      vendorId: vehicle.vendorId,
      type: vehicle.type,
      capacity: vehicle.capacity || '',
      driverName: vehicle.driverName || '',
      driverPhone: vehicle.driverPhone || '',
      status: vehicle.status,
      lastInspectionDate: vehicle.lastInspectionDate || '',
      notes: vehicle.notes || '',
    })
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    if (!formData.vehicleNumber.trim() || !formData.vendorId) {
      toast({ title: "Validation Error", description: "Vehicle number and vendor are required.", variant: "destructive" })
      return
    }

    try {
      setIsSaving(true)
      if (editingId) {
        await vehiclesService.update(editingId, formData)
        toast({ title: "Updated", description: `Vehicle ${formData.vehicleNumber} updated.` })
      } else {
        await vehiclesService.add(formData)
        toast({ title: "Created", description: `Vehicle ${formData.vehicleNumber} added.` })
      }
      setIsModalOpen(false)
      fetchData()
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Failed to save vehicle.", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string, number: string) => {
    if (!confirm(`Delete vehicle ${number}? This action cannot be undone.`)) return
    try {
      await vehiclesService.delete(id)
      toast({ title: "Deleted", description: `Vehicle ${number} removed.` })
      fetchData()
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete vehicle.", variant: "destructive" })
    }
  }

  const getVendorName = (id: string) => vendors.find(v => v.id === id)?.name || '—'

  return (
    <div className="space-y-6 p-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Truck className="h-6 w-6 text-blue-600" /> Vehicle Fleet
          </h1>
          <p className="text-gray-600">Manage dispatch vehicles assigned to vendors.</p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="mr-2 h-4 w-4" /> Add Vehicle
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input 
            placeholder="Search by number or driver..." 
            className="pl-9" 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterVendor} onValueChange={setFilterVendor}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Vendors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Vendors</SelectItem>
            {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-gray-500">
          {filteredVehicles.length} vehicle{filteredVehicles.length !== 1 && 's'}
        </Badge>
      </div>

      {/* Table */}
      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead>Vehicle No.</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead>Last Inspection</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="h-24 text-center">Loading vehicles...</TableCell></TableRow>
            ) : filteredVehicles.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="h-24 text-center text-gray-500">No vehicles found.</TableCell></TableRow>
            ) : filteredVehicles.map(v => (
              <TableRow key={v.id} className={v.status === 'inactive' ? 'bg-gray-50/50 text-gray-400' : ''}>
                <TableCell className="font-bold font-mono tracking-wider">{v.vehicleNumber}</TableCell>
                <TableCell className="text-sm">{getVendorName(v.vendorId)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">{v.type}</Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {v.driverName ? (
                    <div>
                      <div className="font-medium">{v.driverName}</div>
                      {v.driverPhone && <div className="text-xs text-gray-400">{v.driverPhone}</div>}
                    </div>
                  ) : <span className="text-gray-300">—</span>}
                </TableCell>
                <TableCell className="text-sm">{v.capacity || '—'}</TableCell>
                <TableCell className="text-sm">
                  {v.lastInspectionDate ? new Date(v.lastInspectionDate).toLocaleDateString() : '—'}
                </TableCell>
                <TableCell>
                  <Badge className={STATUS_OPTIONS.find(s => s.value === v.status)?.color || ''}>
                    {v.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50" onClick={() => openEditModal(v)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50" onClick={() => handleDelete(v.id, v.vehicleNumber)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-600" />
              {editingId ? 'Edit Vehicle' : 'Add New Vehicle'}
            </DialogTitle>
            <DialogDescription>
              {editingId ? 'Update vehicle details.' : 'Add a new vehicle to the fleet.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Vehicle Number *</Label>
              <Input 
                placeholder="MH02AB1234" 
                value={formData.vehicleNumber}
                onChange={e => setFormData({...formData, vehicleNumber: e.target.value})}
                className="font-mono uppercase"
              />
            </div>
            <div className="space-y-2">
              <Label>Vendor *</Label>
              <Select value={formData.vendorId} onValueChange={val => setFormData({...formData, vendorId: val})}>
                <SelectTrigger><SelectValue placeholder="Select Vendor" /></SelectTrigger>
                <SelectContent>
                  {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Vehicle Type</Label>
              <Select value={formData.type} onValueChange={val => setFormData({...formData, type: val as VehicleType})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VEHICLE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Capacity</Label>
              <Input 
                placeholder="e.g. 500kg, 200 plates" 
                value={formData.capacity}
                onChange={e => setFormData({...formData, capacity: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Driver Name</Label>
              <Input 
                placeholder="Driver name" 
                value={formData.driverName}
                onChange={e => setFormData({...formData, driverName: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Driver Phone</Label>
              <Input 
                placeholder="Phone number" 
                value={formData.driverPhone}
                onChange={e => setFormData({...formData, driverPhone: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Last Inspection Date</Label>
              <Input 
                type="date"
                value={formData.lastInspectionDate}
                onChange={e => setFormData({...formData, lastInspectionDate: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={val => setFormData({...formData, status: val as VehicleStatus})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Notes</Label>
              <Input 
                placeholder="Any additional notes..." 
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <><RotateCcw className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
              ) : (
                <><Save className="mr-2 h-4 w-4" /> {editingId ? 'Update' : 'Add'} Vehicle</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
