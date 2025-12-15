"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Eye, Search, Loader2, Download, ArrowLeft, Edit } from 'lucide-react'
import { toast } from "@/hooks/use-toast"
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import Link from "next/link"
import { useSearchParams } from 'next/navigation'
import { MenuViewModal } from "@/components/menu-view-modal"
import { MenuEditModal } from "@/components/menu-edit-modal"
import type { MenuItem } from "@/lib/types"
import { menuItemsService } from "@/lib/services"

interface CompanyMenu {
  id: string
  companyId: string
  companyName: string
  buildingId: string
  buildingName: string
  startDate: string
  endDate: string
  status: string
  combinedMenuId: string
}

export default function CompanyMenusPage() {
  const searchParams = useSearchParams()
  const combinedMenuId = searchParams.get("combinedMenuId")

  const [menus, setMenus] = useState<CompanyMenu[]>([])
  const [filteredMenus, setFilteredMenus] = useState<CompanyMenu[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCompany, setSelectedCompany] = useState("")
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedMenuId, setSelectedMenuId] = useState<string>("")
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [menuItemsLoading, setMenuItemsLoading] = useState(false)

  useEffect(() => {
    loadCompanyMenus()
  }, [combinedMenuId])

  useEffect(() => {
    preloadMenuItems()
  }, [])

  const preloadMenuItems = useCallback(async () => {
    if (menuItems.length > 0 || menuItemsLoading) return

    try {
      setMenuItemsLoading(true)
      const items = await menuItemsService.getAll()
      setMenuItems(items)
    } catch (error) {
      console.error("Error preloading menu items:", error)
    } finally {
      setMenuItemsLoading(false)
    }
  }, [menuItems.length, menuItemsLoading])

  const handleOpenEditModal = useCallback(
    (menuId: string) => {
      if (menuItems.length === 0 && !menuItemsLoading) {
        preloadMenuItems()
      }

      setSelectedMenuId(menuId)
      setEditModalOpen(true)
    },
    [menuItems.length, menuItemsLoading, preloadMenuItems],
  )

  const handleOpenViewModal = useCallback((menuId: string) => {
    setSelectedMenuId(menuId)
    setViewModalOpen(true)
  }, [])

  const loadCompanyMenus = async () => {
    try {
      setLoading(true)
      const { clearCacheKey } = await import("@/lib/services")
      clearCacheKey("companyMenus-")
      clearCacheKey("updations-")
      
      let q

      if (combinedMenuId) {
        q = query(collection(db, "companyMenus"), where("combinedMenuId", "==", combinedMenuId))
      } else {
        q = collection(db, "companyMenus")
      }

      const snapshot = await getDocs(q)
      const menusData = snapshot.docs
        .map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            }) as CompanyMenu,
        )
        .sort((a, b) => a.companyName.localeCompare(b.companyName))

      setMenus(menusData)
      setFilteredMenus(menusData)
    } catch (error) {
      console.error("Error loading company menus:", error)
      toast({
        title: "Error",
        description: "Failed to load company menus",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = (menu: CompanyMenu) => {
    const csvContent = [
      ["Company Menu Details"],
      ["Company", menu.companyName],
      ["Building", menu.buildingName],
      ["Start Date", menu.startDate],
      ["End Date", menu.endDate],
      ["Status", menu.status],
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${menu.companyName}-${menu.buildingName}-${menu.startDate}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)

    toast({
      title: "Success",
      description: "Menu downloaded successfully",
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const uniqueCompanies = Array.from(new Set(menus.map((m) => m.companyId))).map((companyId) => {
    const menu = menus.find((m) => m.companyId === companyId)
    return {
      id: companyId,
      name: menu?.companyName || "Unknown",
      count: menus.filter((m) => m.companyId === companyId).length,
    }
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <div className="text-lg font-medium">Loading company menus...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/combined-menus">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Company-wise Menus</h1>
            <p className="text-gray-600">View menus generated for each company and building</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          className={`cursor-pointer ${!selectedCompany ? "ring-2 ring-blue-600" : ""}`}
          onClick={() => setSelectedCompany("")}
        >
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{menus.length}</div>
              <div className="text-sm text-gray-600">Total Menus</div>
            </div>
          </CardContent>
        </Card>

        {uniqueCompanies.map((company) => (
          <Card
            key={company.id}
            className={`cursor-pointer transition-all ${selectedCompany === company.id ? "ring-2 ring-blue-600" : "hover:shadow-lg"}`}
            onClick={() => setSelectedCompany(company.id)}
          >
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 truncate">{company.count}</div>
                <div className="text-sm text-gray-600 truncate">{company.name}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search Menus</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by company or building name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {selectedCompany
              ? `Menus - ${uniqueCompanies.find((c) => c.id === selectedCompany)?.name}`
              : "All Company Menus"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredMenus.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">
                {menus.length === 0 ? "No company menus generated yet" : "No menus match your filters"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Building</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMenus
                    .filter((menu) => !selectedCompany || menu.companyId === selectedCompany)
                    .map((menu) => {
                      const startDate = new Date(menu.startDate)
                      const endDate = new Date(menu.endDate)
                      const duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

                      return (
                        <TableRow key={menu.id}>
                          <TableCell className="font-medium">{menu.companyName}</TableCell>
                          <TableCell>{menu.buildingName}</TableCell>
                          <TableCell>{formatDate(menu.startDate)}</TableCell>
                          <TableCell>{formatDate(menu.endDate)}</TableCell>
                          <TableCell>{duration} days</TableCell>
                          <TableCell>
                            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                              {menu.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenViewModal(menu.id)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEditModal(menu.id)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleDownload(menu)}>
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <MenuViewModal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        menuId={selectedMenuId}
        menuType="company"
        preloadedMenuItems={menuItems}
      />
      <MenuEditModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        menuId={selectedMenuId}
        menuType="company"
        onSave={loadCompanyMenus}
        preloadedMenuItems={menuItems}
      />
    </div>
  )
}
