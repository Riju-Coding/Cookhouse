"use client"

import { useState, useEffect } from "react"
import { CrudTable } from "@/components/admin/crud-table"
import { taxTemplatesService, type TaxTemplate } from "@/lib/firestore"

export default function TaxTemplatesPage() {
  const [taxTemplates, setTaxTemplates] = useState<TaxTemplate[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadTaxTemplates()
  }, [])

  const loadTaxTemplates = async () => {
    try {
      const data = await taxTemplatesService.getAll()
      setTaxTemplates(data)
    } catch (error) {
      console.error("Error loading tax templates:", error)
    }
  }

  const handleAdd = async (data: Omit<TaxTemplate, "id">) => {
    setLoading(true)
    try {
      await taxTemplatesService.add(data)
      await loadTaxTemplates()
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = async (id: string, data: Partial<TaxTemplate>) => {
    setLoading(true)
    try {
      await taxTemplatesService.update(id, data)
      await loadTaxTemplates()
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    setLoading(true)
    try {
      await taxTemplatesService.delete(id)
      await loadTaxTemplates()
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    { key: "name" as keyof TaxTemplate, label: "Name" },
    {
      key: "rate" as keyof TaxTemplate,
      label: "Rate (%)",
      render: (rate: number) => `${rate}%`,
    },
    { key: "description" as keyof TaxTemplate, label: "Description" },
  ]

  const formFields = [
    { name: "name" as keyof TaxTemplate, label: "Name", type: "text" as const, required: true },
    { name: "rate" as keyof TaxTemplate, label: "Rate (%)", type: "number" as const, required: true },
    { name: "description" as keyof TaxTemplate, label: "Description", type: "textarea" as const },
  ]

  return (
    <CrudTable
      title="Tax Templates"
      description="Manage tax templates with rates for ingredients"
      data={taxTemplates}
      columns={columns}
      formFields={formFields}
      onAdd={handleAdd}
      onEdit={handleEdit}
      onDelete={handleDelete}
      loading={loading}
    />
  )
}
