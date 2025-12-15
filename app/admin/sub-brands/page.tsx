"use client"

import { useState, useEffect } from "react"
import { CrudTable } from "@/components/admin/crud-table"
import { subBrandsService, type SubBrand, brandsService, type Brand } from "@/lib/firestore"

export default function SubBrandsPage() {
  const [subBrands, setSubBrands] = useState<SubBrand[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [subBrandsData, brandsData] = await Promise.all([subBrandsService.getAll(), brandsService.getAll()])
      setSubBrands(subBrandsData)
      setBrands(brandsData)
    } catch (error) {
      console.error("Error loading data:", error)
    }
  }

  const handleAdd = async (data: Omit<SubBrand, "id">) => {
    setLoading(true)
    try {
      await subBrandsService.add(data)
      await loadData()
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = async (id: string, data: Partial<SubBrand>) => {
    setLoading(true)
    try {
      await subBrandsService.update(id, data)
      await loadData()
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    setLoading(true)
    try {
      await subBrandsService.delete(id)
      await loadData()
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    { key: "name" as keyof SubBrand, label: "Name" },
    {
      key: "brandId" as keyof SubBrand,
      label: "Brand",
      render: (brandId: string) => {
        const brand = brands.find((b) => b.id === brandId)
        return brand?.name || "Unknown Brand"
      },
    },
    { key: "description" as keyof SubBrand, label: "Description" },
  ]

  const formFields = [
    { key: "name" as keyof SubBrand, label: "Name", type: "text" as const, required: true },
    {
      key: "brandId" as keyof SubBrand,
      label: "Brand",
      type: "select" as const,
      required: true,
      options: brands.map((brand) => ({ value: brand.id, label: brand.name })),
    },
    { key: "description" as keyof SubBrand, label: "Description", type: "textarea" as const },
  ]

  return (
    <CrudTable
      title="Sub Brands"
      description="Manage sub-brand names for ingredients"
      data={subBrands}
      columns={columns}
      formFields={formFields}
      onAdd={handleAdd}
      onEdit={handleEdit}
      onDelete={handleDelete}
      loading={loading}
    />
  )
}
