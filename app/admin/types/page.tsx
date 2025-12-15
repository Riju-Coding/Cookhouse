"use client"

import { useState, useEffect } from "react"
import { CrudTable } from "@/components/admin/crud-table"
import { typesService, type Type } from "@/lib/firestore"

const typesFormFields = [
  { name: "name", label: "Type Name", type: "text" as const, required: true },
  { name: "description", label: "Description", type: "text" as const, required: false },
  { name: "status", label: "Status", type: "select" as const, required: true, options: ["Active", "Inactive"] },
]

export default function TypesPage() {
  const [types, setTypes] = useState<Type[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTypes()
  }, [])

  const loadTypes = async () => {
    try {
      const data = await typesService.getAll()
      setTypes(data)
    } catch (error) {
      console.error("Error loading types:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async (data: any) => {
    try {
      await typesService.add(data)
      loadTypes() // Refresh the list
    } catch (error) {
      console.error("Error adding type:", error)
    }
  }

  const handleEdit = async (id: string, data: any) => {
    try {
      await typesService.update(id, data)
      loadTypes() // Refresh the list
    } catch (error) {
      console.error("Error updating type:", error)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await typesService.delete(id)
      loadTypes() // Refresh the list
    } catch (error) {
      console.error("Error deleting type:", error)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <CrudTable
      title="Types"
      data={types}
      columns={[
        { key: "name", label: "Type Name" },
        { key: "description", label: "Description" },
        { key: "status", label: "Status" },
      ]}
      formFields={typesFormFields}
      onAdd={handleAdd}
      onEdit={handleEdit}
      onDelete={handleDelete}
    />
  )
}
