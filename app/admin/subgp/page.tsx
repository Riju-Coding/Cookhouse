"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { CrudTable } from "@/components/admin/crud-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus } from "lucide-react"
import { toast } from "sonner"

interface GP {
  id: string
  name: string
  code: string
}

interface SubGP {
  id: string
  name: string
  code: string
  gpId: string
  gpName: string
  description?: string
  createdAt: Date
}

export default function SubGPPage() {
  const [subgps, setSubGPs] = useState<SubGP[]>([])
  const [gps, setGPs] = useState<GP[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingSubGP, setEditingSubGP] = useState<SubGP | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    gpId: "",
    description: "",
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // Fetch GPs
      const gpsSnapshot = await getDocs(collection(db, "gps"))
      const gpsData = gpsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as GP[]
      setGPs(gpsData)

      // Fetch SubGPs
      const subgpsSnapshot = await getDocs(collection(db, "subgps"))
      const subgpsData = subgpsSnapshot.docs.map((doc) => {
        const data = doc.data()
        const gp = gpsData.find((g) => g.id === data.gpId)
        return {
          id: doc.id,
          ...data,
          gpName: gp?.name || "Unknown GP",
          createdAt: data.createdAt?.toDate() || new Date(),
        }
      }) as SubGP[]
      setSubGPs(subgpsData)
    } catch (error) {
      console.error("Error fetching data:", error)
      toast.error("Failed to fetch data")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim() || !formData.code.trim() || !formData.gpId) {
      toast.error("Name, code, and GP are required")
      return
    }

    try {
      if (editingSubGP) {
        await updateDoc(doc(db, "subgps", editingSubGP.id), {
          ...formData,
          updatedAt: new Date(),
        })
        toast.success("SubGP updated successfully")
      } else {
        await addDoc(collection(db, "subgps"), {
          ...formData,
          createdAt: new Date(),
        })
        toast.success("SubGP created successfully")
      }

      setFormData({ name: "", code: "", gpId: "", description: "" })
      setShowForm(false)
      setEditingSubGP(null)
      fetchData()
    } catch (error) {
      console.error("Error saving SubGP:", error)
      toast.error("Failed to save SubGP")
    }
  }

  const handleEdit = (subgp: SubGP) => {
    setEditingSubGP(subgp)
    setFormData({
      name: subgp.name,
      code: subgp.code,
      gpId: subgp.gpId,
      description: subgp.description || "",
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "subgps", id))
      toast.success("SubGP deleted successfully")
      fetchData()
    } catch (error) {
      console.error("Error deleting SubGP:", error)
      toast.error("Failed to delete SubGP")
    }
  }

  const columns = [
    { key: "code", label: "Code" },
    { key: "name", label: "Name" },
    { key: "gpName", label: "GP" },
    { key: "description", label: "Description" },
    { key: "createdAt", label: "Created At", render: (value: Date) => value.toLocaleDateString() },
  ]

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">SubGP Management</h1>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add SubGP
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingSubGP ? "Edit SubGP" : "Add New SubGP"}</CardTitle>
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
                    placeholder="Enter SubGP code"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter SubGP name"
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="gpId">GP *</Label>
                <Select value={formData.gpId} onValueChange={(value) => setFormData({ ...formData, gpId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select GP" />
                  </SelectTrigger>
                  <SelectContent>
                    {gps.map((gp) => (
                      <SelectItem key={gp.id} value={gp.id}>
                        {gp.code} - {gp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Button type="submit">{editingSubGP ? "Update" : "Create"} SubGP</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false)
                    setEditingSubGP(null)
                    setFormData({ name: "", code: "", gpId: "", description: "" })
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <CrudTable
        title="SubGPs"
        description="Manage sub-group categories"
        data={subgps}
        columns={columns}
        formFields={[
          { key: "code", label: "Code", type: "text", required: true },
          { key: "name", label: "Name", type: "text", required: true },
          {
            key: "gpId",
            label: "GP",
            type: "select",
            required: true,
            options: gps.map((gp) => ({ value: gp.id, label: `${gp.code} - ${gp.name}` })),
          },
          { key: "description", label: "Description", type: "text" },
        ]}
        onAdd={async (item) => {
          await addDoc(collection(db, "subgps"), {
            ...item,
            createdAt: new Date(),
          })
          fetchData()
          toast.success("SubGP created successfully")
        }}
        onEdit={async (id, item) => {
          await updateDoc(doc(db, "subgps", id), {
            ...item,
            updatedAt: new Date(),
          })
          fetchData()
          toast.success("SubGP updated successfully")
        }}
        onDelete={handleDelete}
        loading={loading}
      />
    </div>
  )
}
