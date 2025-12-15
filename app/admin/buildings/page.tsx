"use client"

import { useState, useEffect } from "react"
import { CrudTable } from "@/components/admin/crud-table"
import { buildingsService, companiesService, type Building, type Company } from "@/lib/firestore"
import { toast } from "@/hooks/use-toast"

export default function BuildingsPage() {
  const [buildings, setBuildings] = useState<Building[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)

  const columns = [
    { key: "name", label: "Building Name" },
    { key: "code", label: "Code" },
    { key: "companyName", label: "Company" },
    { key: "address", label: "Address" },
    { key: "floor", label: "Floor" },
    { key: "capacity", label: "Capacity" },
    { key: "status", label: "Status" },
  ]

  const formFields = [
    { name: "name", label: "Building Name", type: "text" as const, required: true },
    { name: "code", label: "Code", type: "text" as const, required: true },
    {
      name: "companyId",
      label: "Company",
      type: "select" as const,
      required: true,
      options: companies.map((company) => ({ value: company.id, label: company.name })),
    },
    { name: "address", label: "Address", type: "textarea" as const },
    { name: "floor", label: "Floor", type: "text" as const },
    { name: "capacity", label: "Capacity", type: "number" as const },
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

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [buildingsData, companiesData] = await Promise.all([buildingsService.getAll(), companiesService.getAll()])

      // Add company names to buildings
      const buildingsWithCompanyNames = buildingsData.map((building) => ({
        ...building,
        companyName: companiesData.find((company) => company.id === building.companyId)?.name || "Unknown",
      }))

      setBuildings(buildingsWithCompanyNames)
      setCompanies(companiesData)
    } catch (error) {
      console.error("Error fetching data:", error)
      toast({
        title: "Error",
        description: "Failed to fetch buildings",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async (data: Omit<Building, "id" | "createdAt" | "updatedAt">) => {
    try {
      await buildingsService.add(data)
      await fetchData()
      toast({
        title: "Success",
        description: "Building added successfully",
      })
    } catch (error) {
      console.error("Error adding building:", error)
      toast({
        title: "Error",
        description: "Failed to add building",
        variant: "destructive",
      })
    }
  }

  const handleEdit = async (id: string, data: Partial<Building>) => {
    try {
      await buildingsService.update(id, data)
      await fetchData()
      toast({
        title: "Success",
        description: "Building updated successfully",
      })
    } catch (error) {
      console.error("Error updating building:", error)
      toast({
        title: "Error",
        description: "Failed to update building",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await buildingsService.delete(id)
      await fetchData()
      toast({
        title: "Success",
        description: "Building deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting building:", error)
      toast({
        title: "Error",
        description: "Failed to delete building",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Buildings</h1>
        <p className="text-gray-600">Manage building information and company associations</p>
      </div>

      <CrudTable
        title="Buildings"
        data={buildings}
        columns={columns}
        formFields={formFields}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        loading={loading}
      />
    </div>
  )
}
