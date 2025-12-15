"use client"

import { useState, useEffect } from "react"
import { CrudTable } from "@/components/admin/crud-table"
import { templatesService, type Template } from "@/lib/firestore"

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      const data = await templatesService.getAll()
      setTemplates(data)
    } catch (error) {
      console.error("Error loading templates:", error)
    }
  }

  const handleAdd = async (data: Omit<Template, "id">) => {
    setLoading(true)
    try {
      await templatesService.add(data)
      await loadTemplates()
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = async (id: string, data: Partial<Template>) => {
    setLoading(true)
    try {
      await templatesService.update(id, data)
      await loadTemplates()
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    setLoading(true)
    try {
      await templatesService.delete(id)
      await loadTemplates()
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    { key: "name" as keyof Template, label: "Name" },
    { key: "description" as keyof Template, label: "Description" },
  ]

  const formFields = [
    { key: "name" as keyof Template, label: "Name", type: "text" as const, required: true },
    { key: "description" as keyof Template, label: "Description", type: "textarea" as const },
  ]

  return (
    <CrudTable
      title="Templates"
      description="Manage template names for ingredients"
      data={templates}
      columns={columns}
      formFields={formFields}
      onAdd={handleAdd}
      onEdit={handleEdit}
      onDelete={handleDelete}
      loading={loading}
    />
  )
}
