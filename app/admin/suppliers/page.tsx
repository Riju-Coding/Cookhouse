"use client"

import { useState, useEffect } from "react"
import { CrudTable } from "@/components/admin/crud-table"
import { suppliersService, type Supplier } from "@/lib/firestore"

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadSuppliers()
  }, [])

  const loadSuppliers = async () => {
    try {
      const data = await suppliersService.getAll()
      setSuppliers(data)
    } catch (error) {
      console.error("Error loading suppliers:", error)
    }
  }

  const handleAdd = async (data: Omit<Supplier, "id">) => {
    setLoading(true)
    try {
      await suppliersService.add(data)
      await loadSuppliers()
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = async (id: string, data: Partial<Supplier>) => {
    setLoading(true)
    try {
      await suppliersService.update(id, data)
      await loadSuppliers()
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    setLoading(true)
    try {
      await suppliersService.delete(id)
      await loadSuppliers()
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    { key: "name" as keyof Supplier, label: "Name" },
    { key: "email" as keyof Supplier, label: "Email" },
    { key: "phone" as keyof Supplier, label: "Phone" },
    { key: "contactPerson" as keyof Supplier, label: "Contact Person" },
  ]

  const formFields = [
    { name: "name" as keyof Supplier, label: "Name", type: "text" as const, required: true },
    { name: "email" as keyof Supplier, label: "Email", type: "text" as const },
    { name: "phone" as keyof Supplier, label: "Phone", type: "text" as const },
    { name: "contactPerson" as keyof Supplier, label: "Contact Person", type: "text" as const },
    { name: "address" as keyof Supplier, label: "Address", type: "textarea" as const },
  ]

  return (
    <CrudTable
      title="Suppliers"
      description="Manage supplier information for ingredients"
      data={suppliers}
      columns={columns}
      formFields={formFields}
      onAdd={handleAdd}
      onEdit={handleEdit}
      onDelete={handleDelete}
      loading={loading}
    />
  )
}
