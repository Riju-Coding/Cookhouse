"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { doc, getDoc, setDoc, updateDoc, collection } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader } from "lucide-react"

interface MenuEditFormProps {
  menuId?: string
}

export default function CombinedMenuEditForm({ menuId }: MenuEditFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(!!menuId)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "active",
  })

  useEffect(() => {
    if (menuId && menuId !== "new") {
      loadMenu()
    } else {
      setLoading(false)
    }
  }, [menuId])

  const loadMenu = async () => {
    if (!menuId) return
    try {
      setLoading(true)
      const docSnap = await getDoc(doc(db, "combinedMenus", menuId))
      if (docSnap.exists()) {
        const data = docSnap.data()
        setFormData({
          name: data.name || "",
          description: data.description || "",
          status: data.status || "active",
        })
      }
    } catch (error) {
      console.error("Error loading menu:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)

      const menuData = {
        ...formData,
        updatedAt: new Date().toISOString(),
      }

      if (menuId && menuId !== "new") {
        await updateDoc(doc(db, "combinedMenus", menuId), menuData)
      } else {
        const newDocRef = doc(collection(db, "combinedMenus"))
        await setDoc(newDocRef, {
          ...menuData,
          createdAt: new Date().toISOString(),
        })
      }

      router.push("/combined-menus")
    } catch (error) {
      console.error("Error saving menu:", error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{menuId && menuId !== "new" ? "Edit Combined Menu" : "Create New Menu"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Menu Name *</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter menu name"
              required
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Description</label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter menu description"
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Status *</label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={saving} className="gap-2">
              {saving && <Loader className="h-4 w-4 animate-spin" />}
              {saving ? "Saving..." : "Save Menu"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
