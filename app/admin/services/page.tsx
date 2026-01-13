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
      toast({
        title: "Error",
        description: "Failed to load services",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadServices()
  }, [])

  const handleDragStart = (e: React.DragEvent, service: Service) => {
    setDraggedItem(service)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

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
      toast({ title: "Success", description: "Service order updated successfully." })
    } catch (error) {
      console.error("Error reordering services:", error)
      toast({ title: "Error", description: "Failed to reorder services.", variant: "destructive" })
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
      toast({
        title: "Duplicate Service",
        description: `A service named "${data.name}" already exists.`,
        variant: "destructive",
      })
      return
    }

    setIsAdding(true)
    try {
      // data will now include the 'color' field from the form
      await servicesService.add(data)
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
    if (data.name) {
      const existingService = services.find(
        (service) => service.id !== id && service.name.toLowerCase().trim() === data.name?.toLowerCase().trim()
      )
      if (existingService) {
        toast({ title: "Duplicate Service", description: "Name already exists.", variant: "destructive" })
        return
      }
    }

    setIsEditing(true)
    try {
      await servicesService.update(id, data)
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
      toast({ title: "Success", description: `${ids.length} services deleted.` })
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete services.", variant: "destructive" })
    } finally {
      setDeletingIds((prev) => {
        const newSet = new Set(prev)
        ids.forEach((id) => newSet.delete(id))
        return newSet
      })
    }
  }

  const columns = [
    { key: "order", label: "Order" },
    { key: "name", label: "Name" },
    // Added Color Column to the table
    { 
      key: "color", 
      label: "Color",
      render: (value: string) => (
        <div className="flex items-center gap-2">
          <div 
            className="w-4 h-4 rounded-full border border-gray-200" 
            style={{ backgroundColor: value || '#e2e8f0' }} 
          />
          <span className="text-xs font-mono">{value || 'N/A'}</span>
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
      placeholder: "e.g., 1, 2, 3..."
    },
    {
      name: "name",
      label: "Name",
      type: "text" as const,
      required: true,
    },
    // ADDED COLOR PICKER FIELD HERE
    {
      name: "color",
      label: "Service Theme Color",
      type: "color" as const,
      required: false,
      defaultValue: "#3b82f6" // Default blue
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Tip:</strong> Drag and drop services to reorder. The <strong>Color</strong> field defines the visual theme for this service across the app.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Services Order (Drag to Reorder)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {services.map((service) => (
              <div
                key={service.id}
                draggable={!reorderingId}
                onDragStart={(e) => handleDragStart(e, service)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, service)}
                className={`
                  flex items-center gap-3 p-4 bg-white border rounded-lg
                  transition-all duration-200 relative overflow-hidden
                  ${!reorderingId ? 'cursor-move hover:shadow-md hover:border-blue-300' : 'cursor-not-allowed'}
                  ${draggedItem?.id === service.id ? 'opacity-50 scale-95' : ''}
                  ${reorderingId === service.id ? 'border-blue-500 bg-blue-50' : ''}
                `}
              >
                {/* Visual color indicator strip on the left */}
                <div 
                  className="absolute left-0 top-0 bottom-0 w-1.5" 
                  style={{ backgroundColor: service.color || '#cbd5e1' }}
                />

                {reorderingId === service.id ? (
                  <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                ) : (
                  <GripVertical className="h-5 w-5 text-gray-400" />
                )}
                
                <div className="flex items-center gap-3 flex-1">
                  <Badge variant="secondary" className="font-mono">
                    #{service.order}
                  </Badge>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{service.name}</h3>
                      {/* Circle indicator for color */}
                      <div 
                        className="w-3 h-3 rounded-full border border-gray-200" 
                        style={{ backgroundColor: service.color || '#cbd5e1' }}
                      />
                    </div>
                    {service.description && (
                      <p className="text-sm text-gray-600 line-clamp-1">{service.description}</p>
                    )}
                  </div>
                  
                  <Badge variant={service.status === 'active' ? 'default' : 'outline'}>
                    {service.status}
                  </Badge>
                </div>
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