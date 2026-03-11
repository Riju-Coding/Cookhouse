"use client"

import { useState, useEffect } from "react"
import { subServicesService, servicesService, type SubService, type Service } from "@/lib/firestore"
import { toast } from "@/hooks/use-toast"
import { Switch } from "@/components/ui/switch"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Pencil, Trash2, Plus, Layers, FolderPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function SubServicesPage() {
  const [subServices, setSubServices] = useState<SubService[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)

  // --- SUB SERVICE Modal State ---
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    serviceId: "",
    description: "",
    status: "active",
    showConfirmation: false,
    order: 1,
  })

  // --- PARENT SERVICE Modal State ---
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false)
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)
  const [isSavingService, setIsSavingService] = useState(false)
  const [serviceFormData, setServiceFormData] = useState({
    name: "",
    description: "",
    status: "active",
    order: 1,
    color: "#3b82f6" // Default blue color
  })

  // --- DATA LOADING ---
  const loadData = async () => {
    try {
      setLoading(true)
      const [subServicesData, servicesData] = await Promise.all([
        subServicesService.getAll(),
        servicesService.getAll(),
      ])

      const serviceOrderMap = new Map<string, number>()
      servicesData.forEach((s) => {
        serviceOrderMap.set(s.id, s.order || 999)
      })

      const sortedServices = servicesData.sort(
        (a, b) => (a.order || 999) - (b.order || 999)
      )

      const subServicesWithNames = subServicesData
        .map((subService) => ({
          ...subService,
          serviceName:
            servicesData.find((service) => service.id === subService.serviceId)?.name || "Unknown",
        }))
        .sort((a, b) => {
          const parentOrderA = serviceOrderMap.get(a.serviceId) || 999
          const parentOrderB = serviceOrderMap.get(b.serviceId) || 999
          if (parentOrderA !== parentOrderB) return parentOrderA - parentOrderB
          return (a.order || 999) - (b.order || 999)
        })

      setSubServices(subServicesWithNames)
      setServices(sortedServices)
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])


  // ==========================================
  //         SUB SERVICE HANDLERS
  // ==========================================
  const openAddModal = () => {
    setEditingId(null)
    setFormData({
      name: "",
      serviceId: services.length > 0 ? services[0].id : "",
      description: "",
      status: "active",
      showConfirmation: false,
      order: 1,
    })
    setIsModalOpen(true)
  }

  const openEditModal = (item: SubService) => {
    setEditingId(item.id)
    setFormData({
      name: item.name,
      serviceId: item.serviceId,
      description: item.description || "",
      status: item.status as "active" | "inactive",
      showConfirmation: item.showConfirmation || false,
      order: item.order || 1,
    })
    setIsModalOpen(true)
  }

  const handleSaveForm = async () => {
    if (!formData.name || !formData.serviceId) {
      toast({ title: "Validation Error", description: "Name and Service are required.", variant: "destructive" })
      return
    }
    setIsSaving(true)
    try {
      if (editingId) {
        await subServicesService.update(editingId, formData)
        toast({ title: "Success", description: "Updated successfully" })
      } else {
        await subServicesService.add(formData)
        toast({ title: "Success", description: "Added successfully" })
      }
      setIsModalOpen(false)
      loadData()
    } catch (error) {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggle = async (id: string, checked: boolean) => {
    try {
      setSubServices((prev) => prev.map((item) => (item.id === id ? { ...item, showConfirmation: checked } : item)))
      await subServicesService.update(id, { showConfirmation: checked })
    } catch (error) {
      loadData() 
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this sub-service?")) return
    try {
      await subServicesService.delete(id)
      setSubServices((prev) => prev.filter(item => item.id !== id))
      toast({ title: "Success", description: "Deleted successfully" })
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" })
    }
  }


  // ==========================================
  //         PARENT SERVICE HANDLERS
  // ==========================================
  const openAddServiceModal = () => {
    setEditingServiceId(null)
    setServiceFormData({
      name: "",
      description: "",
      status: "active",
      order: services.length + 1,
      color: "#3b82f6"
    })
    setIsServiceModalOpen(true)
  }

  const openEditServiceModal = (service: Service) => {
    setEditingServiceId(service.id)
    setServiceFormData({
      name: service.name,
      description: service.description || "",
      status: service.status as "active" | "inactive",
      order: service.order || 1,
      color: service.color || "#3b82f6"
    })
    setIsServiceModalOpen(true)
  }

  const handleSaveService = async () => {
    if (!serviceFormData.name) {
      toast({ title: "Validation Error", description: "Service Name is required.", variant: "destructive" })
      return
    }
    setIsSavingService(true)
    try {
      if (editingServiceId) {
        await servicesService.update(editingServiceId, serviceFormData)
        toast({ title: "Success", description: "Service updated successfully" })
      } else {
        await servicesService.add(serviceFormData)
        toast({ title: "Success", description: "Service added successfully" })
      }
      setIsServiceModalOpen(false)
      loadData()
    } catch (error) {
      toast({ title: "Error", description: "Failed to save service", variant: "destructive" })
    } finally {
      setIsSavingService(false)
    }
  }

  const handleDeleteService = async (serviceId: string, subServicesCount: number) => {
    if (subServicesCount > 0) {
      toast({ 
        title: "Cannot Delete", 
        description: `Please delete all ${subServicesCount} sub-services inside this service first.`, 
        variant: "destructive" 
      })
      return
    }
    if (!confirm("Are you sure you want to delete this main Service?")) return
    
    try {
      await servicesService.delete(serviceId)
      setServices((prev) => prev.filter(item => item.id !== serviceId))
      toast({ title: "Success", description: "Service deleted successfully" })
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete service", variant: "destructive" })
    }
  }


  // --- RENDER ---
  if (loading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Loader2 className="animate-spin h-8 w-8 text-gray-400" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Services & Sub Services</h1>
          <p className="text-sm text-slate-500 mt-1">Manage all your main services and their nested items.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Add Service Button */}
          <Button onClick={openAddServiceModal} variant="outline" className="shadow-sm border-slate-300">
            <FolderPlus className="mr-2 h-4 w-4" /> Add Service
          </Button>
          {/* Add Sub Service Button (Blue removed, default style) */}
          <Button onClick={openAddModal} className="shadow-sm">
            <Plus className="mr-2 h-4 w-4" /> Add Sub Service
          </Button>
        </div>
      </div>

      {/* Render Each Service as a distinct Group/Card */}
      <div className="space-y-8">
        {services.map((service) => {
          const serviceSubServices = subServices.filter((s) => s.serviceId === service.id)

          return (
            <Card key={service.id} className="overflow-hidden border-slate-200 shadow-sm">
              
              {/* Group Header */}
              <div className="bg-slate-50 border-b px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                
                {/* Left Side: Icon & Title */}
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white rounded-md border shadow-sm relative overflow-hidden">
                    {/* Small color indicator strip based on service color */}
                    <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: service.color || '#cbd5e1' }} />
                    <Layers className="h-5 w-5 text-slate-500 ml-1" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800">{service.name}</h2>
                    <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                      <span>Order: {service.order}</span>
                      <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                      <span>{serviceSubServices.length} items</span>
                    </div>
                  </div>
                </div>

                {/* Right Side: Status & Actions */}
                <div className="flex items-center gap-4">
                  <Badge variant={service.status === "active" ? "default" : "secondary"} className="capitalize">
                    {service.status}
                  </Badge>
                  <div className="flex items-center gap-1 border-l pl-4 border-slate-200">
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                      title="Edit Service"
                      onClick={() => openEditServiceModal(service)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                      title="Delete Service"
                      onClick={() => handleDeleteService(service.id, serviceSubServices.length)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

              </div>

              {/* Group Table */}
              <div className="overflow-x-auto">
                {serviceSubServices.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    No sub-services found for {service.name}. Click "Add Sub Service" to create one.
                  </div>
                ) : (
                  <table className="w-full text-sm text-left">
                    <thead className="bg-white border-b border-slate-100 text-slate-500">
                      <tr>
                        <th className="px-6 py-4 font-medium w-16 text-center">Order</th>
                        <th className="px-6 py-4 font-medium w-[25%]">Name</th>
                        <th className="px-6 py-4 font-medium w-[30%]">Description</th>
                        <th className="px-6 py-4 font-medium w-24">Status</th>
                        <th className="px-6 py-4 font-medium text-center w-32">Confirmation</th>
                        <th className="px-6 py-4 font-medium text-right w-24">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {serviceSubServices.map((item) => (
                        <tr key={item.id} className="bg-white hover:bg-slate-50/60 transition-colors">
                          
                          {/* Order */}
                          <td className="px-6 py-3 text-center">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-xs font-medium text-slate-600">
                              {item.order}
                            </span>
                          </td>

                          {/* Name */}
                          <td className="px-6 py-3 font-medium text-slate-900">
                            {item.name}
                          </td>

                          {/* Description */}
                          <td className="px-6 py-3 text-slate-500">
                            <span className="line-clamp-1">{item.description || "-"}</span>
                          </td>

                          {/* Status */}
                          <td className="px-6 py-3">
                            <Badge variant={item.status === "active" ? "outline" : "secondary"} className="capitalize font-normal text-xs">
                              {item.status}
                            </Badge>
                          </td>

                          {/* Confirmation Toggle */}
                          <td className="px-6 py-3 text-center">
                            <div className="flex justify-center">
                              <Switch
                                checked={!!item.showConfirmation}
                                onCheckedChange={(checked) => handleToggle(item.id, checked)}
                              />
                            </div>
                          </td>

                          {/* Actions (Always visible now) */}
                          <td className="px-6 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600 text-slate-400"
                                onClick={() => openEditModal(item)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-8 w-8 hover:bg-red-50 hover:text-red-600 text-slate-400"
                                onClick={() => handleDelete(item.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>

                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {/* ========================================================= */}
      {/*                 ADD / EDIT SUB SERVICE DIALOG                 */}
      {/* ========================================================= */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Sub Service" : "Add Sub Service"}</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Breakfast Refreshments"
              />
            </div>

            <div className="grid gap-2">
              <Label>Parent Service</Label>
              <Select
                value={formData.serviceId}
                onValueChange={(val) => setFormData({ ...formData, serviceId: val })}
              >
                <SelectTrigger><SelectValue placeholder="Select a service" /></SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(val: "active" | "inactive") => setFormData({ ...formData, status: val })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Order</Label>
                <Input
                  type="number"
                  value={formData.order}
                  onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="flex flex-col gap-2 justify-center pt-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.showConfirmation}
                    onCheckedChange={(c) => setFormData({ ...formData, showConfirmation: c })}
                  />
                  <Label>Ask Confirmation</Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveForm} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Sub Service
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* ========================================================= */}
      {/*                 ADD / EDIT PARENT SERVICE DIALOG              */}
      {/* ========================================================= */}
      <Dialog open={isServiceModalOpen} onOpenChange={setIsServiceModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingServiceId ? "Edit Service" : "Add New Service"}</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Service Name</Label>
              <Input
                value={serviceFormData.name}
                onChange={(e) => setServiceFormData({ ...serviceFormData, name: e.target.value })}
                placeholder="e.g. Breakfast, Lunch, High Tea"
              />
            </div>

            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={serviceFormData.status}
                onValueChange={(val: "active" | "inactive") => setServiceFormData({ ...serviceFormData, status: val })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Display Order</Label>
                <Input
                  type="number"
                  value={serviceFormData.order}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, order: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="grid gap-2">
                <Label>Color Code</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    className="w-12 h-10 p-1 cursor-pointer"
                    value={serviceFormData.color}
                    onChange={(e) => setServiceFormData({ ...serviceFormData, color: e.target.value })}
                  />
                  <Input
                    type="text"
                    className="flex-1 uppercase"
                    value={serviceFormData.color}
                    onChange={(e) => setServiceFormData({ ...serviceFormData, color: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                value={serviceFormData.description}
                onChange={(e) => setServiceFormData({ ...serviceFormData, description: e.target.value })}
                placeholder="Optional description..."
              />
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsServiceModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveService} disabled={isSavingService}>
              {isSavingService && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Service
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}