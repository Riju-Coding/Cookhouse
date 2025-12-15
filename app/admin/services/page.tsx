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
      // Sort by order
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

    // Show loader on the dragged item
    setReorderingId(draggedItem.id)

    const draggedIndex = services.findIndex(s => s.id === draggedItem.id)
    const targetIndex = services.findIndex(s => s.id === targetService.id)

    // Create new array with updated positions
    const newServices = [...services]
    
    // Remove dragged item from its current position
    const [removed] = newServices.splice(draggedIndex, 1)
    
    // Insert at new position
    newServices.splice(targetIndex, 0, removed)

    // Assign new order values based on array position
    const reorderedServices = newServices.map((s, index) => ({
      ...s,
      order: index + 1
    }))

    // Update local state immediately for fast UI response
    setServices(reorderedServices)
    setDraggedItem(null)

    try {
      // Update all items with their new order in the database
      const updatePromises = reorderedServices.map((s) => 
        servicesService.update(s.id, { order: s.order })
      )

      await Promise.all(updatePromises)

      toast({
        title: "Success",
        description: "Service order updated successfully.",
      })
    } catch (error) {
      console.error("Error reordering services:", error)
      toast({
        title: "Error",
        description: "Failed to reorder services. Reverting changes.",
        variant: "destructive",
      })
      // Revert to original state on error
      await loadServices()
    } finally {
      setReorderingId(null)
    }
  }

  const handleAdd = async (data: Omit<Service, "id" | "createdAt" | "updatedAt">) => {
    // Check if service with same name already exists
    const existingService = services.find(
      (service) => service.name.toLowerCase().trim() === data.name.toLowerCase().trim()
    )

    if (existingService) {
      toast({
        title: "Duplicate Service",
        description: `A service named "${data.name}" already exists. Please use a different name.`,
        variant: "destructive",
      })
      return
    }

    // Check if order is already used
    if (data.order) {
      const existingOrder = services.find((service) => service.order === data.order)
      if (existingOrder) {
        toast({
          title: "Duplicate Order",
          description: `Order ${data.order} is already used by "${existingOrder.name}". Please choose a different order.`,
          variant: "destructive",
        })
        return
      }
    }

    setIsAdding(true)
    try {
      await servicesService.add(data)
      await loadServices()
      toast({
        title: "Success",
        description: "Service added successfully",
      })
    } catch (error) {
      console.error("Error adding service:", error)
      toast({
        title: "Error",
        description: "Failed to add service",
        variant: "destructive",
      })
    } finally {
      setIsAdding(false)
    }
  }

  const handleEdit = async (id: string, data: Partial<Omit<Service, "id" | "createdAt">>) => {
    // Check if updating name to an existing name (excluding current item)
    if (data.name) {
      const existingService = services.find(
        (service) => 
          service.id !== id && 
          service.name.toLowerCase().trim() === data.name?.toLowerCase().trim()
      )

      if (existingService) {
        toast({
          title: "Duplicate Service",
          description: `A service named "${data.name}" already exists. Please use a different name.`,
          variant: "destructive",
        })
        return
      }
    }

    // Check if order is already used (excluding current item)
    if (data.order !== undefined) {
      const existingOrder = services.find(
        (service) => service.id !== id && service.order === data.order
      )
      if (existingOrder) {
        toast({
          title: "Duplicate Order",
          description: `Order ${data.order} is already used by "${existingOrder.name}". Please choose a different order.`,
          variant: "destructive",
        })
        return
      }
    }

    setIsEditing(true)
    try {
      await servicesService.update(id, data)
      await loadServices()
      toast({
        title: "Success",
        description: "Service updated successfully",
      })
    } catch (error) {
      console.error("Error updating service:", error)
      toast({
        title: "Error",
        description: "Failed to update service",
        variant: "destructive",
      })
    } finally {
      setIsEditing(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingIds((prev) => new Set(prev).add(id))
    try {
      await servicesService.delete(id)
      await loadServices()
      toast({
        title: "Success",
        description: "Service deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting service:", error)
      toast({
        title: "Error",
        description: "Failed to delete service",
        variant: "destructive",
      })
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
      // Delete all selected services
      await Promise.all(ids.map((id) => servicesService.delete(id)))
      await loadServices()
      toast({
        title: "Success",
        description: `${ids.length} service${ids.length > 1 ? 's' : ''} deleted successfully.`,
      })
    } catch (error) {
      console.error("Error bulk deleting services:", error)
      toast({
        title: "Error",
        description: "Failed to delete selected services. Please try again.",
        variant: "destructive",
      })
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
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading services...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Tip:</strong> Drag and drop services using the grip icon to reorder them. 
          The order determines the display sequence in the application.
        </p>
      </div>

      {/* Drag and Drop Visual Order */}
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
                  transition-all duration-200
                  ${!reorderingId ? 'cursor-move hover:shadow-md hover:border-blue-300' : 'cursor-not-allowed'}
                  ${draggedItem?.id === service.id ? 'opacity-50 scale-95' : ''}
                  ${reorderingId === service.id ? 'border-blue-500 bg-blue-50' : ''}
                `}
              >
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
                    <h3 className="font-semibold text-gray-900">{service.name}</h3>
                    {service.description && (
                      <p className="text-sm text-gray-600 line-clamp-1">{service.description}</p>
                    )}
                  </div>
                  
                  <Badge variant={service.status === 'active' ? 'default' : 'outline'}>
                    {service.status}
                  </Badge>
                </div>

                {reorderingId === service.id && (
                  <span className="text-xs text-blue-600 font-medium">
                    Saving...
                  </span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Original CRUD Table */}
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