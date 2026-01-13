"use client"

import { useState, useEffect } from "react"
import { CrudTable } from "@/components/admin/crud-table"
import { servicesService, type Service } from "@/lib/firestore"
import { toast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GripVertical, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [draggedItem, setDraggedItem] = useState<Service | null>(null)
  const [reorderingId, setReorderingId] = useState<string | null>(null)

  const loadServices = async () => {
    try {
      setLoading(true)
      const data = await servicesService.getAll()
      const sortedData = data.sort((a, b) => (a.order || 999) - (b.order || 999))
      setServices(sortedData)
    } catch (error) {
      console.error("Error loading services:", error)
      toast({ title: "Error", description: "Failed to load services", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadServices()
  }, [])

  // Reordering logic...
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
      toast({ title: "Error", description: "Failed to reorder.", variant: "destructive" })
      await loadServices()
    } finally {
      setReorderingId(null)
    }
  }

  const handleAdd = async (data: Omit<Service, "id" | "createdAt" | "updatedAt">) => {
    const existingService = services.find(
      (service) => service.name.toLowerCase().trim() === data.name.toLowerCase().trim()
    )

    if (existingService) {
      toast({ title: "Duplicate Service", description: "Name already exists.", variant: "destructive" })
      return
    }

    setIsAdding(true)
    try {
      // FIX: Ensure color has a fallback hex code if the form returns it empty
      const finalData = {
        ...data,
        color: data.color && data.color !== "" ? data.color : "#3b82f6",
      }
      
      await servicesService.add(finalData)
      await loadServices()
      toast({ title: "Success", description: "Service added successfully" })
    } catch (error) {
      console.error("Error adding service:", error)
      toast({ title: "Error", description: "Failed to add service", variant: "destructive" })
    } finally {
      setIsAdding(false)
    }
  }

  const handleEdit = async (id: string, data: Partial<Omit<Service, "id" | "createdAt">>) => {
    setIsEditing(true)
    try {
      // FIX: Ensure we aren't sending an empty color string to the database
      const finalUpdateData = { ...data }
      if (finalUpdateData.color === "") {
        delete finalUpdateData.color // Don't overwrite with blank, or set a default:
        // finalUpdateData.color = "#3b82f6" 
      }

      await servicesService.update(id, finalUpdateData)
      await loadServices()
      toast({ title: "Success", description: "Service updated successfully" })
    } catch (error) {
      console.error("Error updating service:", error)
      toast({ title: "Error", description: "Failed to update service", variant: "destructive" })
    } finally {
      setIsEditing(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingIds((prev) => new Set(prev).add(id))
    try {
      await servicesService.delete(id)
      await loadServices()
      toast({ title: "Success", description: "Service deleted successfully" })
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete service", variant: "destructive" })
    } finally {
      setDeletingIds((prev) => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }
  }

  const handleBulkDelete = async (ids: string[]) => {
    setDeletingIds((prev) => {
      const newSet = new Set(prev)
      ids.forEach((id) => newSet.add(id))
      return newSet
    })
    try {
      await Promise.all(ids.map((id) => servicesService.delete(id)))
      await loadServices()
      toast({ title: "Success", description: "Services deleted." })
    } catch (error) {
      toast({ title: "Error", description: "Failed to bulk delete.", variant: "destructive" })
    } finally {
      setDeletingIds(new Set())
    }
  }

  const columns = [
    { key: "order", label: "Order" },
    { key: "name", label: "Name" },
    { 
      key: "color", 
      label: "Color",
      render: (value: string) => (
        <div className="flex items-center gap-2">
          <div 
            className="w-4 h-4 rounded-full border border-gray-200" 
            style={{ backgroundColor: value || '#cbd5e1' }} 
          />
          <span className="text-xs font-mono">{value || '#cbd5e1'}</span>
        </div>
      )
    },
    { key: "description", label: "Description" },
    { key: "status", label: "Status" },
  ]

  const formFields = [
    { 
      name: "order", 
      label: "Display Order", 
      type: "number" as const, 
      required: true,
      placeholder: "e.g., 1"
    },
    {
      name: "name",
      label: "Name",
      type: "text" as const,
      required: true,
    },
    {
      name: "color",
      label: "Service Theme Color",
      type: "color" as const, // This triggers the color picker
      required: true,
      defaultValue: "#3b82f6" 
    },
    {
      name: "description",
      label: "Description",
      type: "textarea" as const,
    },
    {
      name: "status",
      label: "Status",
      type: "select" as const,
      required: true,
      options: [
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
      ],
    },
  ]

  if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto" /></div>

  return (
    <div className="p-6 space-y-6">
      {/* Drag & Drop Preview */}
      <Card>
        <CardHeader><CardTitle>Services Order</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {services.map((service) => (
              <div
                key={service.id}
                draggable={!reorderingId}
                onDragStart={(e) => handleDragStart(e, service)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, service)}
                className="flex items-center gap-3 p-4 bg-white border rounded-lg relative overflow-hidden"
              >
                <div 
                  className="absolute left-0 top-0 bottom-0 w-1.5" 
                  style={{ backgroundColor: service.color || '#cbd5e1' }}
                />
                <GripVertical className="h-5 w-5 text-gray-400" />
                <Badge variant="secondary">#{service.order}</Badge>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{service.name}</span>
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: service.color }} />
                  </div>
                </div>
                <Badge>{service.status}</Badge>
              </div>
            ))}
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
    </div>
  )
}