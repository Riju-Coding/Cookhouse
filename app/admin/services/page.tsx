"use client"

import React, { useState, useEffect } from "react"
import { CrudTable } from "@/components/admin/crud-table"
import { servicesService, vendorsService, type Service, type Vendor } from "@/lib/firestore"
import { toast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { GripVertical, Loader2, UserPlus, CheckCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [draggedItem, setDraggedItem] = useState<Service | null>(null)
  const [reorderingId, setReorderingId] = useState<string | null>(null)

  // Selection & Vendor Assignment State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([])
  const [isAssigning, setIsAssigning] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      const [servicesData, vendorsData] = await Promise.all([
        servicesService.getAll(),
        vendorsService.getAll()
      ])
      
      const sortedData = servicesData.sort((a, b) => (a.order || 999) - (b.order || 999))
      setServices(sortedData)
      setVendors(vendorsData)
    } catch (error) {
      console.error("Error loading data:", error)
      toast({ title: "Error", description: "Failed to load services", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // --- SELECTION LOGIC ---
  const toggleSelectAll = () => {
    if (selectedIds.size === services.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(services.map(s => s.id)))
    }
  }

  const toggleSelectId = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedIds(newSet)
  }

  // --- VENDOR ASSIGNMENT LOGIC ---
  const handleOpenAssignVendors = () => {
    if (selectedIds.size === 0) {
      toast({ title: "Selection Required", description: "Please select at least one service." })
      return
    }
    setSelectedVendorIds([])
    setIsAssignModalOpen(true)
  }

  const handleSaveVendorAssignment = async () => {
    if (selectedVendorIds.length === 0) {
      toast({ title: "Error", description: "Select at least one vendor", variant: "destructive" })
      return
    }

    try {
      setIsAssigning(true)
      const updatePromises = Array.from(selectedIds).map(id => 
        servicesService.update(id, { vendorIds: selectedVendorIds } as any)
      )

      await Promise.all(updatePromises)
      toast({ title: "Success", description: `Assigned vendors to ${selectedIds.size} services.` })
      setIsAssignModalOpen(false)
      setSelectedIds(new Set())
      fetchData()
    } catch (error) {
      toast({ title: "Error", description: "Failed to assign vendors", variant: "destructive" })
    } finally {
      setIsAssigning(false)
    }
  }

  // --- DRAG AND DROP LOGIC ---
  const handleDragStart = (e: React.DragEvent, service: Service) => {
    setDraggedItem(service)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault() }

  const handleDrop = async (e: React.DragEvent, targetService: Service) => {
    e.preventDefault()
    if (!draggedItem || draggedItem.id === targetService.id) {
      setDraggedItem(null)
      return
    }

    setReorderingId(draggedItem.id)
    const draggedIndex = services.findIndex(s => s.id === draggedItem.id)
    const targetIndex = services.findIndex(s => s.id === targetService.id)
    const newServices = [...services]
    const [removed] = newServices.splice(draggedIndex, 1)
    newServices.splice(targetIndex, 0, removed)

    const reorderedServices = newServices.map((s, index) => ({
      ...s,
      order: index + 1
    }))

    setServices(reorderedServices)
    setDraggedItem(null)

    try {
      const updatePromises = reorderedServices.map((s) => 
        servicesService.update(s.id, { order: s.order })
      )
      await Promise.all(updatePromises)
      toast({ title: "Success", description: "Order updated." })
    } catch (error) {
      fetchData()
    } finally {
      setReorderingId(null)
    }
  }

  // --- CRUD HANDLERS ---
  const handleAdd = async (data: any) => {
    setIsAdding(true)
    try {
      const finalData = { ...data, color: data.color || "#3b82f6" }
      await servicesService.add(finalData)
      await fetchData()
      toast({ title: "Success", description: "Service added" })
    } catch (error) { toast({ title: "Error", variant: "destructive" }) }
    finally { setIsAdding(false) }
  }

  const handleEdit = async (id: string, data: any) => {
    setIsEditing(true)
    try {
      await servicesService.update(id, data)
      await fetchData()
      toast({ title: "Success", description: "Service updated" })
    } catch (error) { toast({ title: "Error", variant: "destructive" }) }
    finally { setIsEditing(false) }
  }

  const handleDelete = async (id: string) => {
    setDeletingIds((prev) => new Set(prev).add(id))
    try {
      await servicesService.delete(id)
      await fetchData()
      toast({ title: "Success", description: "Deleted" })
    } catch (error) { toast({ title: "Error", variant: "destructive" }) }
    finally {
      setDeletingIds((prev) => { const n = new Set(prev); n.delete(id); return n })
    }
  }

  const handleBulkDelete = async (ids: string[]) => {
    try {
      await Promise.all(ids.map(id => servicesService.delete(id)))
      await fetchData()
      toast({ title: "Success", description: "Deleted selected services" })
    } catch (error) { toast({ title: "Error", variant: "destructive" }) }
  }

  const columns = [
    { key: "order", label: "Order" },
    { key: "name", label: "Name" },
    { 
      key: "color", 
      label: "Color",
      render: (value: string) => (
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: value || '#cbd5e1' }} />
          <span className="text-xs font-mono">{value || '#cbd5e1'}</span>
        </div>
      )
    },
    { key: "description", label: "Description" },
    { key: "status", label: "Status" },
  ]

  const formFields = [
    { name: "order", label: "Display Order", type: "number" as const, required: true },
    { name: "name", label: "Name", type: "text" as const, required: true },
    { name: "color", label: "Service Theme Color", type: "color" as const, required: true, defaultValue: "#3b82f6" },
    { name: "description", label: "Description", type: "textarea" as const },
    { name: "status", label: "Status", type: "select" as const, required: true, options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }] },
  ]

  if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" /></div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex-1 mr-4">
            <p className="text-sm text-blue-800">
                <strong>Management:</strong> Drag items to reorder. Select items to assign catering vendors.
            </p>
        </div>
        {selectedIds.size > 0 && (
            <Button onClick={handleOpenAssignVendors} className="bg-blue-600 hover:bg-blue-700">
                <UserPlus className="mr-2 h-4 w-4" /> Assign Vendor ({selectedIds.size})
            </Button>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-bold">Services Visual Order</CardTitle>
          <div className="flex items-center space-x-2">
            <Checkbox 
                id="select-all" 
                checked={selectedIds.size === services.length && services.length > 0}
                onCheckedChange={toggleSelectAll}
            />
            <Label htmlFor="select-all" className="text-sm font-medium">Select All</Label>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {services.map((service) => {
              const assignedVendors = vendors.filter(v => (service as any).vendorIds?.includes(v.id))
              return (
                <div
                  key={service.id}
                  draggable={!reorderingId}
                  onDragStart={(e) => handleDragStart(e, service)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, service)}
                  className={`
                    flex items-center gap-3 p-4 bg-white border rounded-lg relative overflow-hidden
                    transition-all duration-200
                    ${!reorderingId ? 'hover:shadow-md hover:border-blue-300' : 'opacity-50'}
                    ${selectedIds.has(service.id) ? 'border-blue-500 bg-blue-50/30' : ''}
                  `}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: service.color || '#cbd5e1' }} />
                  
                  <Checkbox 
                    checked={selectedIds.has(service.id)} 
                    onCheckedChange={() => toggleSelectId(service.id)}
                    className="ml-2"
                  />

                  {reorderingId === service.id ? (
                    <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                  ) : (
                    <GripVertical className="h-5 w-5 text-gray-400 cursor-move" />
                  )}
                  
                  <Badge variant="secondary">#{service.order}</Badge>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{service.name}</span>
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: service.color }} />
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                        {assignedVendors.map(v => (
                            <Badge key={v.id} variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                                {v.name}
                            </Badge>
                        ))}
                    </div>
                  </div>
                  <Badge variant={service.status === 'active' ? 'default' : 'outline'}>{service.status}</Badge>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
      
      <CrudTable
        title="Manage Services"
        data={services}
        columns={columns}
        formFields={formFields}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onBulkDelete={handleBulkDelete}
        isAdding={isAdding}
        isEditing={isEditing}
        deletingIds={deletingIds}
      />

      {/* --- ASSIGN VENDOR MODAL --- */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Assign Vendors to Services</DialogTitle>
            <DialogDescription>Link selected services to specific catering partners.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <ScrollArea className="h-[250px] w-full rounded-md border p-4">
              {vendors.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-sm">No vendors registered.</div>
              ) : (
                vendors.map((vendor) => (
                  <div key={vendor.id} className="flex items-center space-x-3 mb-4 last:mb-0">
                    <Checkbox 
                      id={`v-${vendor.id}`} 
                      checked={selectedVendorIds.includes(vendor.id)}
                      onCheckedChange={(checked) => {
                          if (checked) setSelectedVendorIds([...selectedVendorIds, vendor.id])
                          else setSelectedVendorIds(selectedVendorIds.filter(id => id !== vendor.id))
                      }}
                    />
                    <Label htmlFor={`v-${vendor.id}`} className="text-sm font-medium leading-none cursor-pointer">
                      {vendor.name}
                      <p className="text-[10px] text-gray-400 font-normal">{vendor.cuisineTypes?.join(", ")}</p>
                    </Label>
                  </div>
                ))
              )}
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveVendorAssignment} disabled={isAssigning || vendors.length === 0} className="bg-blue-600 hover:bg-blue-700">
                {isAssigning ? "Saving..." : "Save Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}