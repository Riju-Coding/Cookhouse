"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader } from "lucide-react"

interface MenuEditFormProps {
  menuId?: string
}

interface Company {
  id: string
  name: string
}

interface CombinedMenu {
  id: string
  name: string
}

export default function CompanyMenuEditForm({ menuId }: MenuEditFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialCompanyId = searchParams.get("companyId") || ""

  const [loading, setLoading] = useState(!!menuId)
  const [saving, setSaving] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [combinedMenus, setCombinedMenus] = useState<CombinedMenu[]>([])
  const [formData, setFormData] = useState({
    companyId: initialCompanyId,
    menuId: "",
    status: "active",
  })

  useEffect(() => {
    loadSelectData()
    if (menuId && menuId !== "new") {
      loadMenu()
    } else {
      setLoading(false)
    }
  }, [menuId])

  const loadSelectData = async () => {
    try {
      const companiesSnap = await getDocs(collection(db, "companies"))
      const companiesData = companiesSnap.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
      })) as Company[]
      setCompanies(companiesData)

      const menusSnap = await getDocs(collection(db, "combinedMenus"))
      const menusData = menusSnap.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
      })) as CombinedMenu[]
      setCombinedMenus(menusData)
    } catch (error) {
      console.error("Error loading select data:", error)
    }
  }

  const loadMenu = async () => {
    if (!menuId) return
    try {
      setLoading(true)
      const docSnap = await getDoc(doc(db, "companyMenus", menuId))
      if (docSnap.exists()) {
        const data = docSnap.data()
        setFormData({
          companyId: data.companyId || "",
          menuId: data.menuId || "",
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
    if (!formData.companyId || !formData.menuId) {
      alert("Please select both company and menu")
      return
    }

    try {
      setSaving(true)

      const selectedCompany = companies.find((c) => c.id === formData.companyId)
      const selectedMenu = combinedMenus.find((m) => m.id === formData.menuId)

      const menuData = {
        companyId: formData.companyId,
        companyName: selectedCompany?.name || "",
        menuId: formData.menuId,
        menuName: selectedMenu?.name || "",
        status: formData.status,
        updatedAt: new Date().toISOString(),
      }

      if (menuId && menuId !== "new") {
        await updateDoc(doc(db, "companyMenus", menuId), menuData)
      } else {
        const newDocRef = doc(collection(db, "companyMenus"))
        await setDoc(newDocRef, {
          ...menuData,
          createdAt: new Date().toISOString(),
        })
      }

      router.push("/company-menus")
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
        <CardTitle>{menuId && menuId !== "new" ? "Edit Company Menu" : "Assign Menu to Company"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Company *</label>
            <Select
              value={formData.companyId}
              onValueChange={(value) => setFormData({ ...formData, companyId: value })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a company" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Combined Menu *</label>
            <Select value={formData.menuId} onValueChange={(value) => setFormData({ ...formData, menuId: value })}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a menu" />
              </SelectTrigger>
              <SelectContent>
                {combinedMenus.map((menu) => (
                  <SelectItem key={menu.id} value={menu.id}>
                    {menu.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              {saving ? "Saving..." : "Save Assignment"}
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
