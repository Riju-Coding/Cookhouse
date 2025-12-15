"use client"

import { useState, useEffect } from "react"
import { CrudTable } from "@/components/admin/crud-table"
import { defaultsService, type Default } from "@/lib/firestore"

const defaultsFormFields = [
  { name: "name", label: "Default Name", type: "text" as const, required: true },
  { name: "value", label: "Default Value", type: "text" as const, required: true },
  {
    name: "status",
    label: "Status",
    type: "select" as const,
    required: true,
    options: [
      { value: "Active", label: "Active" },
      { value: "Not Active", label: "Not Active" },
    ],
  },
]

export default function DefaultsPage() {
  const [defaults, setDefaults] = useState<Default[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDefaults()
  }, [])

  const loadDefaults = async () => {
    try {
      const data = await defaultsService.getAll()
      setDefaults(data)
    } catch (error) {
      console.error("Error loading defaults:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async (data: any) => {
    try {
      await defaultsService.add(data)
      loadDefaults() // Refresh the list
    } catch (error) {
      console.error("Error adding default:", error)
    }
  }

  const handleEdit = async (id: string, data: any) => {
    try {
      await defaultsService.update(id, data)
      loadDefaults() // Refresh the list
    } catch (error) {
      console.error("Error updating default:", error)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await defaultsService.delete(id)
      loadDefaults() // Refresh the list
    } catch (error) {
      console.error("Error deleting default:", error)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <CrudTable
      title="Defaults"
      data={defaults}
      columns={[
        { key: "name", label: "Default Name" },
        { key: "value", label: "Value" },
        { key: "status", label: "Status" },
      ]}
      formFields={defaultsFormFields}
      onAdd={handleAdd}
      onEdit={handleEdit}
      onDelete={handleDelete}
    />
  )
}
