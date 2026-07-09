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
    {
      name: "attendanceSettings",
      label: "Attendance Settings",
      type: "custom" as const,
      renderCustom: (value: any, onChange: (val: any) => void) => {
        const checkFreq = value?.checkFrequencyMinutes ?? 15
        const alertThresh = value?.alertThresholdMinutes ?? 45
        return (
          <div className="flex gap-4 p-4 border rounded bg-gray-50/50">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Check Frequency (mins)</label>
              <input
                type="number"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={checkFreq}
                onChange={(e) => onChange({ ...value, checkFrequencyMinutes: Number(e.target.value) })}
              />
            </div>
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Alert Threshold (mins)</label>
              <input
                type="number"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={alertThresh}
                onChange={(e) => onChange({ ...value, alertThresholdMinutes: Number(e.target.value) })}
              />
            </div>
          </div>
        )
      }
    },
    {
      name: "breaks",
      label: "Breaks",
      type: "custom" as const,
      renderCustom: (value: any[], onChange: (val: any[]) => void) => {
        const breaksList = Array.isArray(value) ? value : []
        return (
          <div className="space-y-2 p-4 border rounded bg-gray-50/50">
            {breaksList.map((b, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Break Name"
                  className="flex h-8 w-1/3 rounded-md border border-input bg-background px-2 py-1 text-sm"
                  value={b.name}
                  onChange={(e) => {
                    const newB = [...breaksList]
                    newB[i].name = e.target.value
                    onChange(newB)
                  }}
                />
                <input
                  type="time"
                  className="flex h-8 w-1/4 rounded-md border border-input bg-background px-2 py-1 text-sm"
                  value={b.startTime}
                  onChange={(e) => {
                    const newB = [...breaksList]
                    newB[i].startTime = e.target.value
                    onChange(newB)
                  }}
                />
                <input
                  type="time"
                  className="flex h-8 w-1/4 rounded-md border border-input bg-background px-2 py-1 text-sm"
                  value={b.endTime}
                  onChange={(e) => {
                    const newB = [...breaksList]
                    newB[i].endTime = e.target.value
                    onChange(newB)
                  }}
                />
                <button
                  type="button"
                  onClick={() => onChange(breaksList.filter((_, idx) => idx !== i))}
                  className="text-red-500 hover:text-red-700 font-bold"
                >
                  X
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-sm text-blue-600 hover:underline mt-2"
              onClick={() => onChange([...breaksList, { name: "", startTime: "13:00", endTime: "14:00" }])}
            >
              + Add Break
            </button>
          </div>
        )
      }
    }
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
