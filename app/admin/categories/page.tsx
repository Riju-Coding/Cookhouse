"use client"

import { useState, useEffect } from "react"
import { CrudTable } from "@/components/admin/crud-table"
import { categoriesService, type Category } from "@/lib/firestore"
import { toast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const loadCategories = async () => {
    try {
      setLoading(true)
      const data = await categoriesService.getAll()
      setCategories(data)
    } catch (error) {
      console.error("Error loading categories:", error)
      toast({
        title: "Error",
        description: "Failed to load categories",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  const handleAdd = async (data: Omit<Category, "id" | "createdAt" | "updatedAt">) => {
    try {
      await categoriesService.add(data)
      await loadCategories()
      toast({
        title: "Success",
        description: "Category added successfully",
      })
    } catch (error) {
      console.error("Error adding category:", error)
      toast({
        title: "Error",
        description: "Failed to add category",
        variant: "destructive",
      })
    }
  }

  const handleEdit = async (id: string, data: Partial<Omit<Category, "id" | "createdAt">>) => {
    try {
      await categoriesService.update(id, data)
      await loadCategories()
      toast({
        title: "Success",
        description: "Category updated successfully",
      })
    } catch (error) {
      console.error("Error updating category:", error)
      toast({
        title: "Error",
        description: "Failed to update category",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await categoriesService.delete(id)
      await loadCategories()
      toast({
        title: "Success",
        description: "Category deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting category:", error)
      toast({
        title: "Error",
        description: "Failed to delete category",
        variant: "destructive",
      })
    }
  }

  const columns = [
    { key: "name", label: "Name" },
    { key: "description", label: "Description" },
    {
      key: "type",
      label: "Type",
      render: (value: string) => (
        <Badge variant="outline" className="capitalize">
          {value.replace("-", " ")}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (value: string) => <Badge variant={value === "active" ? "default" : "secondary"}>{value}</Badge>,
    },
  ]

  const formFields = [
    {
      name: "name",
      label: "Category Name",
      type: "text" as const,
      required: true,
    },
    {
      name: "description",
      label: "Description",
      type: "textarea" as const,
    },
    {
      name: "type",
      label: "Category Type",
      type: "select" as const,
      required: true,
      options: [
        { value: "menu-item", label: "Menu Item" },
        { value: "ingredient", label: "Ingredient" },
        { value: "service", label: "Service" },
        { value: "general", label: "General" },
      ],
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
  ]

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  return (
    <div className="p-6">
      <CrudTable
        title="Categories"
        description="Manage categories for menu items, ingredients, services and more"
        data={categories}
        columns={columns}
        formFields={formFields}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  )
}
