"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { SimpleTable } from "@/components/admin/simple-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus } from "lucide-react"
import { toast } from "sonner"

interface GP {
  id: string
  name: string
  code: string
  description?: string
  createdAt: Date
}

export default function GPPage() {
  const [gps, setGPs] = useState<GP[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingGP, setEditingGP] = useState<GP | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
  })

  useEffect(() => {
    fetchGPs()
  }, [])

  const fetchGPs = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "gps"))
      const gpsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as GP[]
      setGPs(gpsData)
    } catch (error) {
      console.error("Error fetching GPs:", error)
      toast.error("Failed to fetch GPs")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim() || !formData.code.trim()) {
      toast.error("Name and code are required")
      return
    }

    try {
      if (editingGP) {
        await updateDoc(doc(db, "gps", editingGP.id), {
          ...formData,
          updatedAt: new Date(),
        })
        toast.success("GP updated successfully")
      } else {
        await addDoc(collection(db, "gps"), {
          ...formData,
          createdAt: new Date(),
        })
        toast.success("GP created successfully")
      }

      setFormData({ name: "", code: "", description: "" })
      setShowForm(false)
      setEditingGP(null)
      fetchGPs()
    } catch (error) {
      console.error("Error saving GP:", error)
      toast.error("Failed to save GP")
    }
  }

  const handleEdit = (gp: GP) => {
    setEditingGP(gp)
    setFormData({
      name: gp.name,
      code: gp.code,
      description: gp.description || "",
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "gps", id))
      toast.success("GP deleted successfully")
      fetchGPs()
    } catch (error) {
      console.error("Error deleting GP:", error)
      toast.error("Failed to delete GP")
    }
  }

  const columns = [
    { key: "code" as keyof GP, label: "Code" },
    { key: "name" as keyof GP, label: "Name" },
    { key: "description" as keyof GP, label: "Description" },
    {
      key: "createdAt" as keyof GP,
      label: "Created At",
      render: (value: Date) => value.toLocaleDateString(),
    },
  ]

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">GP Management</h1>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add GP
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingGP ? "Edit GP" : "Add New GP"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="code">Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="Enter GP code"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter GP name"
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter description (optional)"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit">{editingGP ? "Update" : "Create"} GP</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false)
                    setEditingGP(null)
                    setFormData({ name: "", code: "", description: "" })
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <SimpleTable data={gps} columns={columns} onEdit={handleEdit} onDelete={handleDelete} />
    </div>
  )
}
