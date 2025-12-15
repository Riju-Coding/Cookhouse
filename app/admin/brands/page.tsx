"use client"

import { useState, useEffect } from "react"
import { CrudTable } from "@/components/admin/crud-table"
import { brandsService, type Brand } from "@/lib/firestore"

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadBrands()
  }, [])

  const loadBrands = async () => {
    try {
      const data = await brandsService.getAll()
      setBrands(data)
    } catch (error) {
      console.error("Error loading brands:", error)
    }
  }

  const handleAdd = async (data: Omit<Brand, "id">) => {
    setLoading(true)
    try {
      await brandsService.add(data)
      await loadBrands()
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = async (id: string, data: Partial<Brand>) => {
    setLoading(true)
    try {
      await brandsService.update(id, data)
      await loadBrands()
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    setLoading(true)
    try {
      await brandsService.delete(id)
      await loadBrands()
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    { key: "name" as keyof Brand, label: "Name" },
    { key: "description" as keyof Brand, label: "Description" },
  ]

  const formFields = [
    { key: "name" as keyof Brand, label: "Name", type: "text" as const, required: true },
    { key: "description" as keyof Brand, label: "Description", type: "textarea" as const },
  ]

  return (
    <CrudTable
      title="Brands"
      description="Manage brand names for ingredients"
      data={brands}
      columns={columns}
      formFields={formFields}
      onAdd={handleAdd}
      onEdit={handleEdit}
      onDelete={handleDelete}
      loading={loading}
    />
  )
}
