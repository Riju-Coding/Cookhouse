"use client"

import { useState, useEffect } from "react"
import { CrudTable } from "@/components/admin/crud-table"
import { subServicesService, servicesService, type SubService, type Service } from "@/lib/firestore"
import { toast } from "@/hooks/use-toast"
import { Switch } from "@/components/ui/switch"

export default function SubServicesPage() {
  const [subServices, setSubServices] = useState<SubService[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      setLoading(true)
      const [subServicesData, servicesData] = await Promise.all([subServicesService.getAll(), servicesService.getAll()])

      // Add service names to sub services
      const subServicesWithNames = subServicesData.map((subService) => ({
        ...subService,
        serviceName: servicesData.find((service) => service.id === subService.serviceId)?.name || "Unknown",
      }))

      setSubServices(subServicesWithNames)
      setServices(servicesData)
    } catch (error) {
      console.error("Error loading data:", error)
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])


  const handleAdd = async (data: Omit<SubService, "id" | "createdAt" | "updatedAt">) => {
    try {
      await subServicesService.add(data)
      await loadData()
      toast({
        title: "Success",
        description: "Sub service added successfully",
      })
    } catch (error) {
      console.error("Error adding sub service:", error)
      toast({
        title: "Error",
        description: "Failed to add sub service",
        variant: "destructive",
      })
    }
  }

  const handleEdit = async (id: string, data: Partial<Omit<SubService, "id" | "createdAt">>) => {
    try {
      await subServicesService.update(id, data)
      await loadData()
      toast({
        title: "Success",
        description: "Sub service updated successfully",
      })
    } catch (error) {
      console.error("Error updating sub service:", error)
      toast({
        title: "Error",
        description: "Failed to update sub service",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await subServicesService.delete(id)
      await loadData()
      toast({
        title: "Success",
        description: "Sub service deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting sub service:", error)
      toast({
        title: "Error",
        description: "Failed to delete sub service",
        variant: "destructive",
      })
    }
  }

  const columns = [
    { key: "name", label: "Name" },
    { key: "serviceName", label: "Service" },
    { key: "description", label: "Description" },
    // --- Existing Status Column ---
    {
      key: "status",
      label: "Status",
      render: (value: any, item: SubService) => (
        <div className="flex items-center gap-3">
          <span className="capitalize w-16">{value}</span>
          
        </div>
      ),
    },
    // --- NEW COLUMN: Show Confirmation ---
    {
      key: "showConfirmation", // This must match the field name in your Firestore document
      label: "Show Confirmation",
      render: (value: boolean, item: SubService) => (
        <div className="flex items-center pl-4">
          <Switch
            checked={!!value} // ensures it is boolean (false if undefined)
            onCheckedChange={(checked) => {
              handleEdit(item.id, { showConfirmation: checked })
            }}
          />
        </div>
      ),
    },

  ]

  const formFields = [
    {
      name: "name",
      label: "Name",
      type: "text" as const,
      required: true,
    },
    {
      name: "serviceId",
      label: "Service",
      type: "select" as const,
      required: true,
      options: services.map((service) => ({
        value: service.id,
        label: service.name,
      })),
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
    // --- NEW FIELD: Show Confirmation (For the Add/Edit Modal) ---
    {
      name: "showConfirmation",
      label: "Show Confirmation",
      type: "switch" as const, // This uses the switch logic we saw in your CrudTable code
    },
  ]

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  return (
    <div className="p-6">
      <CrudTable
        title="Sub Services"
        data={subServices}
        columns={columns}
        formFields={formFields}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  )
}