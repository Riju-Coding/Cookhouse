"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  Eye, 
  Search, 
  Loader2, 
  Download, 
  ArrowLeft, 
  Edit, 
  Trash2, 
  ChevronRight,
  X 
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
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
import { toast } from "@/hooks/use-toast"
import { collection, getDocs, query, where, writeBatch, doc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import Link from "next/link"
import { useSearchParams } from 'next/navigation'
import { MenuViewModal } from "@/components/menu-view-modal"
import { MenuEditModal } from "@/components/menu-edit-modal"
import type { MenuItem } from "@/lib/types"
import { menuItemsService } from "@/lib/services"
import React from "react" 

// --- Types ---
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

interface MenuGroup {
  id: string 
  startDate: string
  endDate: string
  menus: CompanyMenu[]
}

export default function CompanyMenusPage() {
  const searchParams = useSearchParams()
  const combinedMenuIdParam = searchParams.get("combinedMenuId")

  // --- State ---
  const [menus, setMenus] = useState<CompanyMenu[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  
  // Modal Search State
  const [modalSearchTerm, setModalSearchTerm] = useState("")

  // Modals state
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  
  // Selection state
  const [selectedMenuId, setSelectedMenuId] = useState<string>("")
  const [selectedGroup, setSelectedGroup] = useState<MenuGroup | null>(null)
  
  // Deletion state
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false)
  const [groupToDelete, setGroupToDelete] = useState<MenuGroup | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Data state
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [menuItemsLoading, setMenuItemsLoading] = useState(false)

  // --- Effects ---
  useEffect(() => {
    loadCompanyMenus()
  }, [combinedMenuIdParam])

  useEffect(() => {
    preloadMenuItems()
  }, [])

  // --- Data Loading ---
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

  const loadCompanyMenus = async () => {
    try {
      setLoading(true)
      const { clearCacheKey } = await import("@/lib/services")
      clearCacheKey("companyMenus-")
      
      let q
      if (combinedMenuIdParam) {
        q = query(collection(db, "companyMenus"), where("combinedMenuId", "==", combinedMenuIdParam))
      } else {
        q = collection(db, "companyMenus")
      }

      const snapshot = await getDocs(q)
      const menusData = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }) as CompanyMenu)
        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())

      setMenus(menusData)
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

  // --- Main Page Grouping Logic ---
  const groupedMenus = useMemo(() => {
    const groups: { [key: string]: MenuGroup } = {}

    menus.forEach(menu => {
      const key = menu.combinedMenuId || `${menu.startDate}_${menu.endDate}`
      
      if (!groups[key]) {
        groups[key] = {
          id: key,
          startDate: menu.startDate,
          endDate: menu.endDate,
          menus: []
        }
      }
      groups[key].menus.push(menu)
    })

    let groupArray = Object.values(groups).sort((a, b) => 
      new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    )

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase()
      groupArray = groupArray.filter(group => 
        group.menus.some(m => 
          m.companyName.toLowerCase().includes(lowerSearch) || 
          m.buildingName.toLowerCase().includes(lowerSearch)
        )
      )
    }

    return groupArray
  }, [menus, searchTerm])

  const uniqueCompanies = useMemo(() => {
    const companies = new Set(menus.map((m) => m.companyId))
    return Array.from(companies).map((companyId) => {
      const menu = menus.find((m) => m.companyId === companyId)
      return {
        id: companyId,
        name: menu?.companyName || "Unknown",
        count: menus.filter((m) => m.companyId === companyId).length,
      }
    }).sort((a, b) => a.name.localeCompare(b.name))
  }, [menus])

  // --- Modal Grouping & Sorting Logic ---
  // 1. First, create the grouped structure from selected group
  const groupedModalData = useMemo(() => {
    if (!selectedGroup) return []

    const groups: { [key: string]: CompanyMenu[] } = {}

    // Group by companyName
    selectedGroup.menus.forEach(menu => {
        if (!groups[menu.companyName]) {
            groups[menu.companyName] = []
        }
        groups[menu.companyName].push(menu)
    })

    // Create array, sort companies alphabetically
    const sortedCompanies = Object.keys(groups).sort()

    // Map to final structure, sorting buildings alphabetically within each company
    return sortedCompanies.map(companyName => ({
        companyName,
        menus: groups[companyName].sort((a, b) => a.buildingName.localeCompare(b.buildingName))
    }))
  }, [selectedGroup])

  // 2. Then, filter that structure based on the search term
  // This MUST come after groupedModalData is defined
  const filteredModalData = useMemo(() => {
    if (!modalSearchTerm) return groupedModalData

    const lowerSearch = modalSearchTerm.toLowerCase()
    
    return groupedModalData.map(group => {
      // If company name matches, return the whole group
      if (group.companyName.toLowerCase().includes(lowerSearch)) {
        return group
      }
      // Otherwise, filter the buildings inside
      const matchingMenus = group.menus.filter(menu => 
        menu.buildingName.toLowerCase().includes(lowerSearch)
      )
      // Return group only if it has matching buildings
      return { ...group, menus: matchingMenus }
    }).filter(group => group.menus.length > 0)
  }, [groupedModalData, modalSearchTerm])


  // --- Actions ---

   const handleOpenGroupDetails = (group: MenuGroup) => {
    setSelectedGroup(group)
    setModalSearchTerm("") // Reset search
    setDetailsModalOpen(true)
  }

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

  const handleDeleteGroupClick = (group: MenuGroup, e: React.MouseEvent) => {
    e.stopPropagation()
    setGroupToDelete(group)
    setDeleteAlertOpen(true)
  }

  const confirmDeleteGroup = async () => {
    if (!groupToDelete) return
    setIsDeleting(true)

    try {
      const batch = writeBatch(db)

      groupToDelete.menus.forEach(menu => {
        const menuRef = doc(db, "companyMenus", menu.id)
        batch.delete(menuRef)
      })

      if (!groupToDelete.id.includes("_")) {
         const combinedRef = doc(db, "combinedMenus", groupToDelete.id)
         batch.delete(combinedRef)
      }

      await batch.commit()

      toast({
        title: "Success",
        description: `Deleted menu group and ${groupToDelete.menus.length} company menus.`,
      })

      loadCompanyMenus()
      setDeleteAlertOpen(false)
      setDetailsModalOpen(false) 

    } catch (error) {
      console.error("Error deleting group:", error)
      toast({
        title: "Error",
        description: "Failed to delete menus.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setGroupToDelete(null)
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
    a.download = `${menu.companyName}-${menu.startDate}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

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
      {/* Header */}
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
            <p className="text-gray-600">Manage generated menus grouped by date range</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <Card className="bg-slate-50 border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-500 uppercase">
            Menu Distribution by Company ({uniqueCompanies.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-40 overflow-y-auto pr-2 custom-scrollbar">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {uniqueCompanies.map((company) => (
                <div 
                  key={company.id} 
                  className="bg-white p-3 rounded-md border shadow-sm flex justify-between items-center"
                >
                  <span className="text-sm font-medium truncate w-3/4" title={company.name}>
                    {company.name}
                  </span>
                  <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">
                    {company.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Area */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Generated Menu Groups</CardTitle>
          <div className="relative w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search company or building..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {groupedMenus.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <p className="text-gray-500">No menus found matching your criteria</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Total Menus</TableHead>
                      <TableHead>Companies Included</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedMenus.map((group) => {
                      const duration = Math.ceil((new Date(group.endDate).getTime() - new Date(group.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
                      const previewNames = group.menus.slice(0, 3).map(m => m.companyName).join(", ")
                      const remainingCount = group.menus.length - 3

                      return (
                        <TableRow 
                          key={group.id} 
                          className="cursor-pointer hover:bg-blue-50/50 transition-colors"
                          onClick={() => handleOpenGroupDetails(group)}
                        >
                          <TableCell className="font-medium text-blue-600">
                            {formatDate(group.startDate)}
                          </TableCell>
                          <TableCell>{formatDate(group.endDate)}</TableCell>
                          <TableCell>{duration} days</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {group.menus.length} Menus
                            </span>
                          </TableCell>
                          <TableCell className="text-gray-500 text-sm max-w-md truncate">
                             {previewNames}{remainingCount > 0 && ` +${remainingCount} more`}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end items-center gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-gray-500 hover:text-blue-600"
                              >
                                View Details <ChevronRight className="ml-1 h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-400 hover:text-red-600 hover:bg-red-50"
                                onClick={(e) => handleDeleteGroupClick(group, e)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 
        MODAL: Full Screen Group Details 
      */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="fixed left-0 top-0 z-50 flex h-screen w-screen !max-w-none flex-col gap-0 border-none bg-white p-0 shadow-none sm:max-w-none translate-x-0 translate-y-0 data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0">
          
          {/* Header */}
          <div className="border-b px-6 py-4 flex items-center justify-between bg-white shadow-sm z-10 shrink-0">
            <div className="flex items-center gap-8">
              <div>
                <DialogTitle className="text-xl font-bold">Company Menus Detail</DialogTitle>
                <DialogDescription className="mt-1">
                  {selectedGroup && (
                    <span className="flex items-center gap-2 text-sm">
                      <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-medium">
                          {formatDate(selectedGroup.startDate)} - {formatDate(selectedGroup.endDate)}
                      </span>
                      <span className="text-gray-400">|</span>
                      <span>{groupedModalData.length} Companies</span>
                    </span>
                  )}
                </DialogDescription>
              </div>

              {/* SEARCH BOX */}
              <div className="relative w-80">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search company or building..."
                  value={modalSearchTerm}
                  onChange={(e) => setModalSearchTerm(e.target.value)}
                  className="pl-10 h-9 bg-gray-50 border-gray-300 focus:bg-white transition-colors"
                />
              </div>
            </div>

            <Button variant="ghost" size="icon" onClick={() => setDetailsModalOpen(false)}>
                <X className="h-6 w-6 text-gray-500" />
            </Button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-auto bg-gray-50/50 p-6">
             <div className="max-w-7xl mx-auto space-y-6">
                <Card className="border shadow-sm">
                    <Table>
                    <TableHeader className="bg-white sticky top-0 z-10">
                        <TableRow>
                        <TableHead className="w-[40%]">Building / Location</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date Generated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    
                    <TableBody>
                        {filteredModalData.length === 0 ? (
                           <TableRow>
                             <TableCell colSpan={4} className="h-24 text-center text-gray-500">
                               No results found for "{modalSearchTerm}"
                             </TableCell>
                           </TableRow>
                        ) : (
                          filteredModalData.map((company) => (
                          <React.Fragment key={company.companyName}>
                              {/* Company Header Row */}
                              <TableRow className="bg-gray-100 hover:bg-gray-100 border-b border-gray-200">
                                  <TableCell colSpan={4} className="py-3">
                                      <div className="flex items-center">
                                          <span className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                                              {company.companyName}
                                          </span>
                                          <span className="ml-2 px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full">
                                              {company.menus.length}
                                          </span>
                                      </div>
                                  </TableCell>
                              </TableRow>

                              {/* Building Rows */}
                              {company.menus.map((menu) => (
                                  <TableRow key={menu.id} className="hover:bg-blue-50/30 transition-colors">
                                      <TableCell className="pl-8 py-3">
                                          <div className="flex items-center gap-2">
                                              <div className="h-1.5 w-1.5 rounded-full bg-blue-300"></div>
                                              <span className="font-medium text-gray-700">{menu.buildingName}</span>
                                          </div>
                                      </TableCell>
                                      <TableCell>
                                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize ${
                                              menu.status === 'published' 
                                                  ? 'bg-green-100 text-green-800 border border-green-200' 
                                                  : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                                          }`}>
                                              {menu.status}
                                          </span>
                                      </TableCell>
                                      <TableCell className="text-gray-500 text-sm">
                                          {formatDate(menu.startDate)}
                                      </TableCell>
                                      <TableCell className="text-right">
                                          <div className="flex justify-end gap-1">
                                              <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-8 w-8 text-gray-500 hover:text-blue-600"
                                                  onClick={() => handleOpenViewModal(menu.id)}
                                                  title="View Menu"
                                              >
                                                  <Eye className="h-4 w-4" />
                                              </Button>
                                              <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-8 w-8 text-gray-500 hover:text-blue-600"
                                                  onClick={() => handleOpenEditModal(menu.id)}
                                                  title="Edit Menu"
                                              >
                                                  <Edit className="h-4 w-4" />
                                              </Button>
                                              <Button 
                                                  variant="ghost" 
                                                  size="icon"
                                                  className="h-8 w-8 text-gray-500 hover:text-green-600"
                                                  onClick={() => handleDownload(menu)}
                                                  title="Download CSV"
                                              >
                                                  <Download className="h-4 w-4" />
                                              </Button>
                                          </div>
                                      </TableCell>
                                  </TableRow>
                              ))}
                          </React.Fragment>
                          ))
                        )}
                    </TableBody>
                    </Table>
                </Card>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="border-t bg-white px-6 py-4 flex justify-between items-center z-10 shrink-0">
             <Button 
                variant="destructive" 
                onClick={(e) => selectedGroup && handleDeleteGroupClick(selectedGroup, e)}
                className="gap-2"
            >
               <Trash2 className="h-4 w-4" />
               Delete Entire Group
             </Button>
             <Button variant="outline" onClick={() => setDetailsModalOpen(false)}>
               Close
             </Button>
          </div>

        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the menu group for the period{" "}
              <span className="font-medium text-gray-900">
                {groupToDelete && `${formatDate(groupToDelete.startDate)} to ${formatDate(groupToDelete.endDate)}`}
              </span>
              . This action will remove <span className="font-bold">{groupToDelete?.menus.length}</span> individual company menus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteGroup}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Group"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Individual Menu Modals */}
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
        onSave={() => {
           loadCompanyMenus()
        }}
        preloadedMenuItems={menuItems}
      />
    </div>
  )
}