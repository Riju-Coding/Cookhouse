"use client"

import { useState, useEffect, useMemo, useCallback, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Trash2, Eye, Search, Loader2, Download, Edit } from 'lucide-react'
import { toast } from "@/hooks/use-toast"
import { collection, getDocs, deleteDoc, doc, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import Link from "next/link"
import { MenuViewModal } from "@/components/menu-view-modal"
import { MenuEditModal } from "@/components/menu-edit-modal"
import type { MenuItem } from "@/lib/types"
import { menuItemsService } from "@/lib/services"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface CombinedMenu {
  id: string
  startDate: string
  endDate: string
  status: string
  createdAt?: any
}

export default function CombinedMenusPage() {
  const [menus, setMenus] = useState<CombinedMenu[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedMenuId, setSelectedMenuId] = useState<string>("")
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [menuItemsLoading, setMenuItemsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteConfirmMenuId, setDeleteConfirmMenuId] = useState<string | null>(null)
  const [linkedCompanyMenuCount, setLinkedCompanyMenuCount] = useState(0)

  const filteredMenus = useMemo(() => {
    if (!searchTerm.trim()) return menus

    const lowerSearch = searchTerm.toLowerCase().trim()
    return menus.filter((menu) => {
      const startDate = menu.startDate.toLowerCase()
      const endDate = menu.endDate.toLowerCase()
      const status = menu.status.toLowerCase()

      return startDate.includes(lowerSearch) || endDate.includes(lowerSearch) || status.includes(lowerSearch)
    })
  }, [menus, searchTerm])

  useEffect(() => {
    loadCombinedMenus()
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

  const loadCombinedMenus = useCallback(async () => {
    try {
      setLoading(true)
      const snapshot = await getDocs(collection(db, "combinedMenus"))
      const menusData = snapshot.docs
        .map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            }) as CombinedMenu,
        )
        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())

      setMenus(menusData)
    } catch (error) {
      console.error("Error loading combined menus:", error)
      toast({
        title: "Error",
        description: "Failed to load combined menus",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [])

  const handleDelete = useCallback(
    async (menuId: string) => {
      try {
        setDeletingId(menuId)

        const companyMenusSnapshot = await getDocs(
          query(collection(db, "companyMenus"), where("combinedMenuId", "==", menuId)),
        )

        const deletePromises = companyMenusSnapshot.docs.map((doc) => deleteDoc(doc.ref))
        await Promise.all(deletePromises)

        await deleteDoc(doc(db, "combinedMenus", menuId))

        setMenus((prev) => prev.filter((m) => m.id !== menuId))

        toast({
          title: "Success",
          description: `Combined menu and ${companyMenusSnapshot.docs.length} linked company menu(s) deleted successfully`,
        })

        setDeleteConfirmOpen(false)
      } catch (error) {
        console.error("Error deleting combined menu:", error)
        toast({
          title: "Error",
          description: "Failed to delete combined menu",
          variant: "destructive",
        })
        loadCombinedMenus()
      } finally {
        setDeletingId(null)
      }
    },
    [loadCombinedMenus],
  )

  const handleDeleteClick = useCallback(async (menuId: string) => {
    try {
      const companyMenusSnapshot = await getDocs(
        query(collection(db, "companyMenus"), where("combinedMenuId", "==", menuId)),
      )
      setDeleteConfirmMenuId(menuId)
      setLinkedCompanyMenuCount(companyMenusSnapshot.docs.length)
      setDeleteConfirmOpen(true)
    } catch (error) {
      console.error("Error fetching linked menus:", error)
      toast({
        title: "Error",
        description: "Failed to fetch linked company menus",
        variant: "destructive",
      })
    }
  }, [])

  const handleDownload = useCallback((menu: CombinedMenu) => {
    const csvContent = [
      ["Combined Menu Details"],
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
    a.download = `combined-menu-${menu.startDate}-to-${menu.endDate}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)

    toast({
      title: "Success",
      description: "Menu downloaded successfully",
    })
  }, [])

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }, [])

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

  const handleRowHover = useCallback(() => {
    if (menuItems.length === 0 && !menuItemsLoading) {
      preloadMenuItems()
    }
  }, [menuItems.length, menuItemsLoading, preloadMenuItems])

  const handleSearchChange = useCallback((value: string) => {
    startTransition(() => {
      setSearchTerm(value)
    })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <div className="text-lg font-medium">Loading menus...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Combined Menus Management</h1>
          <p className="text-gray-600">View, manage, and organize all combined menus</p>
        </div>
        <Link href="/combined-menu-creation">
          <Button>Create New Menu</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search Menus</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by date or status..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
            {isPending && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-gray-400" />}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Combined Menus ({filteredMenus.length})</CardTitle>
            {menuItemsLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Preparing editor...</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredMenus.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">
                {menus.length === 0 ? "No combined menus created yet" : "No menus match your search"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMenus.map((menu) => {
                    const startDate = new Date(menu.startDate)
                    const endDate = new Date(menu.endDate)
                    const duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

                    return (
                      <TableRow key={menu.id} onMouseEnter={handleRowHover}>
                        <TableCell className="font-medium">{formatDate(menu.startDate)}</TableCell>
                        <TableCell>{formatDate(menu.endDate)}</TableCell>
                        <TableCell>{duration} days</TableCell>
                        <TableCell>
                          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                            {menu.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {menu.createdAt
                            ? new Date(menu.createdAt.toDate?.() || menu.createdAt).toLocaleDateString()
                            : "N/A"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleOpenViewModal(menu.id)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleOpenEditModal(menu.id)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleDownload(menu)}>
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </Button>
                            <Link href={`/company-menus?combinedMenuId=${menu.id}`}>
                              <Button variant="outline" size="sm">
                                <Eye className="h-4 w-4 mr-2" />
                                View Companies
                              </Button>
                            </Link>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteClick(menu.id)}
                              disabled={deletingId === menu.id}
                            >
                              {deletingId === menu.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
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

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Combined Menu</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 mt-4">
              <p>Are you sure you want to delete this combined menu? This action cannot be undone.</p>
              {linkedCompanyMenuCount > 0 && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-red-800 text-sm">
                  <p className="font-semibold mb-2">Warning: The following will also be deleted:</p>
                  <p className="font-medium">{linkedCompanyMenuCount} linked company menu(s)</p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmMenuId && handleDelete(deleteConfirmMenuId)}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MenuViewModal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        menuId={selectedMenuId}
        menuType="combined"
        preloadedMenuItems={menuItems}
      />
      <MenuEditModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        menuId={selectedMenuId}
        menuType="combined"
        onSave={loadCombinedMenus}
        preloadedMenuItems={menuItems}
      />
    </div>
  )
}
