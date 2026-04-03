"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  Eye, Search, Loader2, ArrowLeft, Edit, Trash2, ChevronRight, X, Building2, MousePointer2 
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { collection, getDocs, query, where, writeBatch, doc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import Link from "next/link"
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { MenuViewModal } from "@/components/menu-view-modal"
import { MenuEditModal } from "@/components/menu-edit-modal"
import type { MenuItem } from "@/lib/types"
import { menuItemsService } from "@/lib/services"
import React from "react" 

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
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  
  // URL se states nikalna (TL ki back navigation requirement ke liye)
  const combinedMenuIdParam = searchParams.get("combinedMenuId")
  const selectedMenuId = searchParams.get("mid") || ""
  const rightView = (searchParams.get("v") as 'preview' | 'view' | 'edit') || 'preview'

  const [menus, setMenus] = useState<CompanyMenu[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [modalSearchTerm, setModalSearchTerm] = useState("")

  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<MenuGroup | null>(null)
  
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false)
  const [groupToDelete, setGroupToDelete] = useState<MenuGroup | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [menuItemsLoading, setMenuItemsLoading] = useState(false)

  useEffect(() => { loadCompanyMenus() }, [combinedMenuIdParam])
  useEffect(() => { preloadMenuItems() }, [])

  // Navigation update function (Browser history stack maintain karne ke liye)
  const navigateTo = (view: 'preview' | 'view' | 'edit', mid?: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("v", view)
    if (mid) params.set("mid", mid)
    router.push(`${pathname}?${params.toString()}`)
  }

  const preloadMenuItems = useCallback(async () => {
    if (menuItems.length > 0 || menuItemsLoading) return
    try {
      setMenuItemsLoading(true)
      const items = await menuItemsService.getAll()
      setMenuItems(items)
    } catch (error) { console.error(error) } finally { setMenuItemsLoading(false) }
  }, [menuItems.length, menuItemsLoading])

  const loadCompanyMenus = async () => {
    try {
      setLoading(true)
      const { clearCacheKey } = await import("@/lib/services")
      clearCacheKey("companyMenus-")
      let q = combinedMenuIdParam ? query(collection(db, "companyMenus"), where("combinedMenuId", "==", combinedMenuIdParam)) : collection(db, "companyMenus")
      const snapshot = await getDocs(q)
      const menusData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as CompanyMenu)
        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
      setMenus(menusData)
    } finally { setLoading(false) }
  }

  const groupedMenus = useMemo(() => {
    const groups: { [key: string]: MenuGroup } = {}
    menus.forEach(menu => {
      const key = menu.combinedMenuId || `${menu.startDate}_${menu.endDate}`
      if (!groups[key]) groups[key] = { id: key, startDate: menu.startDate, endDate: menu.endDate, menus: [] }
      groups[key].menus.push(menu)
    })
    let groupArray = Object.values(groups).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase()
      groupArray = groupArray.filter(g => g.menus.some(m => m.companyName.toLowerCase().includes(lowerSearch) || m.buildingName.toLowerCase().includes(lowerSearch)))
    }
    return groupArray
  }, [menus, searchTerm])

  const uniqueCompanies = useMemo(() => {
    const companies = new Set(menus.map((m) => m.companyId))
    return Array.from(companies).map((companyId) => {
      const menu = menus.find((m) => m.companyId === companyId)
      return { id: companyId, name: menu?.companyName || "Unknown", count: menus.filter((m) => m.companyId === companyId).length }
    }).sort((a, b) => a.name.localeCompare(b.name))
  }, [menus])

  const filteredModalData = useMemo(() => {
    if (!selectedGroup) return []
    const groups: { [key: string]: CompanyMenu[] } = {}
    selectedGroup.menus.forEach(m => {
        if (!groups[m.companyName]) groups[m.companyName] = []
        groups[m.companyName].push(m)
    })
    const lowerSearch = modalSearchTerm.toLowerCase()
    return Object.keys(groups).sort().map(name => ({
        companyName: name,
        menus: groups[name].filter(m => !modalSearchTerm || m.buildingName.toLowerCase().includes(lowerSearch) || m.companyName.toLowerCase().includes(lowerSearch))
          .sort((a, b) => a.buildingName.localeCompare(b.buildingName))
    })).filter(g => g.menus.length > 0)
  }, [selectedGroup, modalSearchTerm])

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>

  return (
    <div className="space-y-6 p-6">
      {/* --- PAGE UI --- */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/combined-menus"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
          <h1 className="text-2xl font-bold text-gray-900">Company-wise Menus</h1>
        </div>
      </div>

      <Card className="bg-slate-50 border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold text-slate-500 uppercase">
            MENU DISTRIBUTION BY COMPANY ({uniqueCompanies.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-44 overflow-y-auto pr-2 custom-scrollbar">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {uniqueCompanies.map((company) => (
                <div key={company.id} className="bg-white p-3 rounded-xl border shadow-sm flex justify-between items-center">
                  <span className="text-sm font-semibold truncate text-gray-700">{company.name}</span>
                  <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{company.count}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base font-bold">Generated Menu Groups</CardTitle>
          <div className="relative w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input placeholder="Search company or building..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-9" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="pl-6">Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Total Menus</TableHead>
                <TableHead>Companies Included</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedMenus.map((group) => (
                <TableRow key={group.id} className="cursor-pointer hover:bg-slate-50" onClick={() => { setSelectedGroup(group); navigateTo('preview', ""); setDetailsModalOpen(true); }}>
                  <TableCell className="pl-6 font-medium text-blue-600">{formatDate(group.startDate)}</TableCell>
                  <TableCell>{formatDate(group.endDate)}</TableCell>
                  <TableCell>7 days</TableCell>
                  <TableCell><span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">{group.menus.length} Menus</span></TableCell>
                  <TableCell className="text-gray-500 text-sm">{group.menus.slice(0, 3).map(m => m.companyName).join(", ")} +{group.menus.length - 3} more</TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex justify-end items-center gap-4">
                      <Button variant="ghost" size="sm" className="text-gray-400 hover:text-blue-600">View Details <ChevronRight className="ml-1 h-4 w-4" /></Button>
                      <Trash2 className="h-4 w-4 text-red-300 hover:text-red-500" onClick={(e) => { e.stopPropagation(); setGroupToDelete(group); setDeleteAlertOpen(true); }} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* --- SPLIT-SCREEN MAIN UI --- */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="fixed inset-0 z-[60] flex h-screen w-screen !max-w-none flex-col gap-0 border-none bg-white p-0 shadow-none translate-x-0 translate-y-0 overflow-hidden">
          
          {/* Top Header */}
          <div className="px-8 py-4 flex items-center justify-between border-b bg-white shrink-0 z-10">
            <div className="flex items-center gap-8">
              <div onClick={() => navigateTo('preview')} className="cursor-pointer">
                <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">Company Menus Detail</DialogTitle>
                {selectedGroup && (
                  <p className="text-blue-600 font-bold text-[10px] uppercase tracking-widest mt-0.5">
                    {formatDate(selectedGroup.startDate)} — {formatDate(selectedGroup.endDate)}
                  </p>
                )}
              </div>
              
              <div className="relative w-[320px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Filter buildings..." 
                  value={modalSearchTerm} 
                  onChange={(e) => setModalSearchTerm(e.target.value)} 
                  className="pl-9 h-9 text-sm rounded-lg bg-slate-100 border-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-all" 
                />
              </div>
            </div>
            
            <Button variant="ghost" size="icon" onClick={() => setDetailsModalOpen(false)} className="rounded-full h-10 w-10 hover:bg-slate-100">
              <X className="h-5 w-5 text-slate-400" />
            </Button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            
            {/* LEFT SIDEBAR: (320px) */}
            <div className="w-[320px] border-r bg-slate-50/50 overflow-y-auto custom-scrollbar shrink-0">
              <div className="p-4 space-y-6">
                {filteredModalData.map((group) => (
                  <div key={group.companyName} className="space-y-2">
                    <div className="flex items-center gap-2 px-1 py-1">
                      <Building2 className="h-3 w-3 text-slate-400" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{group.companyName}</span>
                    </div>
                    
                    {group.menus.map((menu) => (
                      <div 
                        key={menu.id} 
                        className={`group relative flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer 
                          ${selectedMenuId === menu.id 
                            ? 'bg-white border-blue-600 shadow-md ring-[0.5px] ring-blue-600' 
                            : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm'}`}
                        onClick={() => navigateTo('preview', menu.id)}
                      >
                        {selectedMenuId === menu.id && (
                          <div className="absolute left-0 top-3 bottom-3 w-1 bg-blue-600 rounded-r-full" />
                        )}

                        <div className="flex flex-col gap-0.5 pl-1 overflow-hidden">
                          <span className={`text-sm font-bold truncate ${selectedMenuId === menu.id ? 'text-blue-700' : 'text-slate-700'}`}>
                            {menu.buildingName}
                          </span>
                          <span className="text-[9px] text-slate-400 font-medium">Click to manage items</span>
                        </div>
                        
                        <div className={`flex items-center gap-0.5 shrink-0 transition-opacity ${selectedMenuId === menu.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                           <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:bg-blue-50 rounded-md" onClick={(e) => { e.stopPropagation(); navigateTo('view', menu.id); }}>
                             <Eye className="h-3.5 w-3.5" />
                           </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:bg-slate-50 rounded-md" onClick={(e) => { e.stopPropagation(); navigateTo('edit', menu.id); }}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT SIDE: CONTENT AREA */}
            <div className="flex-1 overflow-hidden flex flex-col bg-white">
               {!selectedMenuId ? (
                 <div className="flex-1 flex flex-col items-center justify-center p-12">
                    <div className="h-20 w-20 bg-slate-50 rounded-[1.5rem] flex items-center justify-center mx-auto rotate-12">
                       <MousePointer2 className="h-8 w-8 text-slate-200" />
                    </div>
                    <div className="space-y-1 text-center mt-5">
                      <h3 className="text-lg font-bold text-slate-400">Preview Dashboard</h3>
                      <p className="text-xs text-slate-300 font-medium max-w-[240px]">
                        Select a building from the sidebar to view or edit the specific menu.
                      </p>
                    </div>
                 </div>
               ) : (
                 <div className="flex-1 flex flex-col h-full overflow-hidden">
                    {/* Switchable Views using URL State */}
                    {rightView === 'preview' && (
                      <div className="flex-1 flex flex-col items-center justify-center p-12 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="w-full max-w-2xl space-y-8">
                          <div className="space-y-3 border-b border-slate-100 pb-8 text-center">
                            <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[9px] font-black uppercase tracking-widest">
                              Live Menu Preview
                            </div>
                            <h2 className="text-5xl font-black text-slate-900 tracking-tight">
                              {menus.find(m => m.id === selectedMenuId)?.buildingName}
                            </h2>
                            <p className="text-slate-400 text-base font-medium">
                              You are currently managing the generated menu for this location.
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-6">
                            <button onClick={() => navigateTo('view')} className="group flex flex-col items-center justify-center p-10 bg-white border-2 border-slate-100 rounded-[2rem] hover:border-blue-600 hover:shadow-lg transition-all">
                                <div className="h-16 w-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
                                  <Eye className="h-8 w-8 text-blue-600 group-hover:text-white transition-colors" />
                                </div>
                                <span className="text-xl font-bold text-slate-800">View Menu</span>
                                <span className="text-slate-400 text-[10px] mt-1">Verify items</span>
                            </button>

                            <button onClick={() => navigateTo('edit')} className="group flex flex-col items-center justify-center p-10 bg-white border-2 border-slate-100 rounded-[2rem] hover:border-blue-600 hover:shadow-lg transition-all">
                                <div className="h-16 w-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
                                  <Edit className="h-8 w-8 text-slate-600 group-hover:text-white transition-colors" />
                                </div>
                                <span className="text-xl font-bold text-slate-800">Edit Menu</span>
                                <span className="text-slate-400 text-[10px] mt-1">Update prices</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {rightView === 'view' && (
                      <div className="flex-1 overflow-auto p-8 animate-in fade-in zoom-in-95 duration-200">
                         <div className="mb-4">
                            {/* Browser history back manual fallback */}
                            <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-slate-500 text-xs font-bold hover:text-blue-600">
                               <ArrowLeft className="h-3.5 w-3.5 mr-2" /> Back
                            </Button>
                         </div>
                         <MenuViewModal isOpen={true} onClose={() => router.back()} menuId={selectedMenuId} menuType="company" preloadedMenuItems={menuItems} />
                      </div>
                    )}

                    {rightView === 'edit' && (
                      <div className="flex-1 overflow-auto p-8 animate-in fade-in zoom-in-95 duration-200">
                         <div className="mb-4">
                            <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-slate-500 text-xs font-bold hover:text-blue-600">
                               <ArrowLeft className="h-3.5 w-3.5 mr-2" /> Back
                            </Button>
                         </div>
                         <MenuEditModal isOpen={true} onClose={() => router.back()} menuId={selectedMenuId} menuType="company" onSave={loadCompanyMenus} preloadedMenuItems={menuItems} />
                      </div>
                    )}
                 </div>
               )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-8 py-3 border-t bg-white flex justify-between items-center shrink-0 z-10">
             <Button variant="ghost" size="sm" className="text-red-500 font-bold hover:bg-red-50 rounded-lg" onClick={() => { setGroupToDelete(selectedGroup); setDeleteAlertOpen(true); }}>
               <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Entire Group
             </Button>
             <Button variant="outline" onClick={() => setDetailsModalOpen(false)} className="px-10 h-10 text-sm font-bold border-2 rounded-lg">
               Close
             </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (!groupToDelete) return; setIsDeleting(true);
              const batch = writeBatch(db);
              groupToDelete.menus.forEach(m => batch.delete(doc(db, "companyMenus", m.id)));
              if (!groupToDelete.id.includes("_")) batch.delete(doc(db, "combinedMenus", groupToDelete.id));
              await batch.commit(); loadCompanyMenus(); setDeleteAlertOpen(false); setDetailsModalOpen(false); setIsDeleting(false);
            }} className="bg-red-600">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}