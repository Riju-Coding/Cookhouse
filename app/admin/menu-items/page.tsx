"use client"

import React, { useState, useEffect, useRef, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Trash2, 
  Plus, 
  Search, 
  Utensils, 
  Upload, 
  Download, 
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  List,
  AlignJustify,
  UserPlus
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "@/hooks/use-toast"
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  query, 
  serverTimestamp,
  writeBatch
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { vendorsService, type Vendor } from "@/lib/firestore"

interface MenuItem {
  id: string
  name: string
  category?: string
  description?: string
  status: "active" | "inactive"
  vendorIds?: string[] // Added for vendor tracking
  createdAt: any
  updatedAt: any
}

// Firestore service for menu items
const menuItemsService = {
  async getAll(): Promise<MenuItem[]> {
    const q = query(collection(db, "menuItems"))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as MenuItem))
  },
  
  async add(data: Omit<MenuItem, "id">) {
    const docRef = await addDoc(collection(db, "menuItems"), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    return { id: docRef.id }
  },

  // Added bulk update for vendor assignment
  async bulkAssignVendors(itemIds: string[], vendorIds: string[]) {
    const batch = writeBatch(db)
    itemIds.forEach((id) => {
      const docRef = doc(db, "menuItems", id)
      batch.update(docRef, {
        vendorIds: vendorIds,
        updatedAt: serverTimestamp()
      })
    })
    await batch.commit()
  },
  
  async bulkAdd(items: Omit<MenuItem, "id">[]) {
    const chunkSize = 500
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize)
      const batch = writeBatch(db)
      const collectionRef = collection(db, "menuItems")
      
      chunk.forEach((item) => {
        const docRef = doc(collectionRef)
        batch.set(docRef, {
          ...item,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
      })
      await batch.commit()
    }
  },

  async bulkDelete(ids: string[]) {
    const chunkSize = 500
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize)
      const batch = writeBatch(db)
      
      chunk.forEach((id) => {
        const docRef = doc(db, "menuItems", id)
        batch.delete(docRef)
      })
      await batch.commit()
    }
  },
  
  async update(id: string, data: Partial<MenuItem>) {
    const docRef = doc(db, "menuItems", id)
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    })
  },
  
  async delete(id: string) {
    const docRef = doc(db, "menuItems", id)
    await deleteDoc(docRef)
  }
}

export default function MenuItemsPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  // Pagination & Selection State
  const [currentPage, setCurrentPage] = useState(1)
  const [showAll, setShowAll] = useState(false) 
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  
  // Vendor Assignment States
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([])
  const [isSavingAssignment, setIsSavingAssignment] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    name: "",
    category: "",
    description: "",
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, showAll])

  const loadData = async () => {
    try {
      setLoading(true)
      const [items, vendorsData] = await Promise.all([
        menuItemsService.getAll(),
        vendorsService.getAll()
      ])
      
      const sorted = items.sort((a, b) => 
        (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
      )
      setMenuItems(sorted)
      setVendors(vendorsData)
    } catch (error) {
      console.error("Error loading data:", error)
      toast({ title: "Error", description: "Failed to load menu items", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // --- Filtering & Pagination Logic ---
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [menuItems, searchTerm])

  const itemsPerPage = showAll ? (filteredMenuItems.length || 1) : 10
  const totalPages = Math.ceil(filteredMenuItems.length / itemsPerPage)
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentItems = filteredMenuItems.slice(indexOfFirstItem, indexOfLastItem)

  // --- Selection Logic ---
  const handleSelectAll = (checked: boolean) => {
    const newSelected = new Set(selectedIds)
    if (checked) {
      currentItems.forEach(item => newSelected.add(item.id))
    } else {
      currentItems.forEach(item => newSelected.delete(item.id))
    }
    setSelectedIds(newSelected)
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds)
    if (checked) newSelected.add(id)
    else newSelected.delete(id)
    setSelectedIds(newSelected)
  }

  const isAllCurrentPageSelected = currentItems.length > 0 && currentItems.every(item => selectedIds.has(item.id))

  // --- VENDOR ASSIGNMENT ---
  const handleOpenAssignVendor = () => {
    setSelectedVendorIds([])
    setIsAssignModalOpen(true)
  }

  const handleSaveVendorAssignment = async () => {
    if (selectedVendorIds.length === 0) {
      toast({ title: "Error", description: "Select at least one vendor", variant: "destructive" })
      return
    }

    try {
      setIsSavingAssignment(true)
      await menuItemsService.bulkAssignVendors(Array.from(selectedIds), selectedVendorIds)
      toast({ title: "Success", description: `Vendors assigned to ${selectedIds.size} items` })
      setIsAssignModalOpen(false)
      setSelectedIds(new Set())
      await loadData()
    } catch (error) {
      toast({ title: "Error", description: "Failed to assign vendors", variant: "destructive" })
    } finally {
      setIsSavingAssignment(false)
    }
  }

  // --- Bulk Actions ---
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} items?`)) return
    try {
      setLoading(true)
      await menuItemsService.bulkDelete(Array.from(selectedIds))
      toast({ title: "Success", description: "Items deleted successfully" })
      setSelectedIds(new Set())
      await loadData()
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete items", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // --- Excel Logic ---
  const downloadSampleExcel = () => {
    const sampleData = [{ "Menu Item Name": "Dhaba Dal", "Category": "Main Course", "Description": "Traditional lentil curry" }]
    const ws = XLSX.utils.json_to_sheet(sampleData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Menu Items")
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(new Blob([excelBuffer]), 'menu_items_sample.xlsx')
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const data = await file.arrayBuffer()
      const jsonData = XLSX.utils.sheet_to_json(XLSX.read(data).Sheets[XLSX.read(data).SheetNames[0]]) as any[]
      const menuItemsToAdd = jsonData.map(row => ({
        name: row["Menu Item Name"]?.toString().trim(),
        category: row["Category"]?.toString().trim() || "",
        description: row["Description"]?.toString().trim() || "",
        status: "active" as const,
        vendorIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      })).filter(i => i.name)

      if (menuItemsToAdd.length > 0) {
        await menuItemsService.bulkAdd(menuItemsToAdd)
        toast({ title: "Success", description: "Import successful" })
        await loadData()
      }
    } catch (error) { toast({ title: "Error", description: "Import failed", variant: "destructive" }) }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = "" }
  }

  const handleSubmit = async () => {
    if (!formData.name.trim()) return
    try {
      if (editingId) await menuItemsService.update(editingId, { ...formData })
      else await menuItemsService.add({ ...formData, status: "active", createdAt: new Date(), updatedAt: new Date() })
      setFormData({ name: "", category: "", description: "" })
      setIsAddingNew(false); setEditingId(null); await loadData()
      toast({ title: "Success", description: "Saved" })
    } catch (error) { toast({ title: "Error", description: "Failed to save", variant: "destructive" }) }
  }

  const handleEdit = (item: MenuItem) => {
    setFormData({ name: item.name, category: item.category || "", description: item.description || "" })
    setEditingId(item.id); setIsAddingNew(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return
    try {
      await menuItemsService.delete(id); await loadData()
      toast({ title: "Success", description: "Deleted" })
    } catch (error) { toast({ title: "Error", description: "Failed", variant: "destructive" }) }
  }

  if (loading && menuItems.length === 0) {
    return <div className="flex items-center justify-center h-64 font-medium">Loading catalog...</div>
  }

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Menu Items Catalog</h1>
          <p className="text-gray-600">Total items: {menuItems.length}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedIds.size > 0 && (
            <>
             <Button variant="outline" className="border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100" onClick={handleOpenAssignVendor}>
                <UserPlus className="h-4 w-4 mr-2" />
                Assign Vendor ({selectedIds.size})
             </Button>
             <Button variant="destructive" onClick={handleBulkDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected
             </Button>
            </>
          )}
          <Button variant="outline" onClick={downloadSampleExcel}><Download className="h-4 w-4 mr-2" />Template</Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload className="h-4 w-4 mr-2" />{uploading ? "Uploading..." : "Import Excel"}
          </Button>
          <Button onClick={() => setIsAddingNew(true)} disabled={isAddingNew}><Plus className="h-4 w-4 mr-2" />New Item</Button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />

      {/* Add/Edit Form */}
      {isAddingNew && (
        <Card className="animate-in fade-in-50 slide-in-from-top-5">
          <CardHeader><CardTitle>{editingId ? "Edit Item" : "Add Item"}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Item Name *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Category</Label><Input value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} /></div>
              <div className="space-y-2 md:col-span-2"><Label>Description</Label><Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => { setIsAddingNew(false); setEditingId(null); setFormData({ name: "", category: "", description: "" }) }}>Cancel</Button>
              <Button onClick={handleSubmit}>{editingId ? "Update" : "Save Item"}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search & Toggle */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input placeholder="Search catalog..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <Button variant={showAll ? "secondary" : "outline"} onClick={() => setShowAll(!showAll)}>
            {showAll ? <List className="h-4 w-4 mr-2"/> : <AlignJustify className="h-4 w-4 mr-2"/>}
            {showAll ? "Show Paged" : "Show All"}
        </Button>
      </div>

      {/* Table */}
      <Card>
        <div className="rounded-md border max-h-[70vh] overflow-y-auto relative">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 font-medium sticky top-0 z-10">
              <tr>
                <th className="p-4 w-10">
                  <Checkbox checked={isAllCurrentPageSelected} onCheckedChange={(checked) => handleSelectAll(!!checked)} />
                </th>
                <th className="p-4">Name</th>
                <th className="p-4">Assigned Vendors</th>
                <th className="p-4 hidden sm:table-cell">Category</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {currentItems.length === 0 ? (
                 <tr><td colSpan={5} className="p-8 text-center text-gray-500"><Utensils className="h-8 w-8 mx-auto mb-2 opacity-20" /><p>No items found</p></td></tr>
              ) : (
                currentItems.map((item) => {
                  const assignedVendors = vendors.filter(v => item.vendorIds?.includes(v.id))
                  return (
                    <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.has(item.id) ? 'bg-blue-50/50' : ''}`}>
                      <td className="p-4">
                        <Checkbox checked={selectedIds.has(item.id)} onCheckedChange={(checked) => handleSelectOne(item.id, !!checked)} />
                      </td>
                      <td className="p-4 font-medium text-gray-900">{item.name}</td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {assignedVendors.length > 0 ? (
                            assignedVendors.map(v => <Badge key={v.id} variant="secondary" className="text-[10px] bg-green-50 text-green-700 border-green-200">{v.name}</Badge>)
                          ) : <span className="text-[10px] text-gray-400 italic">Unassigned</span>}
                        </div>
                      </td>
                      <td className="p-4 hidden sm:table-cell">
                        {item.category && <Badge variant="outline" className="bg-gray-50">{item.category}</Badge>}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}><MoreHorizontal className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {!showAll && filteredMenuItems.length > 0 && (
          <div className="flex items-center justify-between p-4 border-t bg-white">
            <span className="text-sm text-gray-500">Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredMenuItems.length)} of {filteredMenuItems.length}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </Card>

      {/* Assign Vendor Modal */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Assign Vendors</DialogTitle>
            <DialogDescription>Link catering partners to {selectedIds.size} selected menu items.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <ScrollArea className="h-[250px] w-full rounded-md border p-4">
              {vendors.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-sm">No vendors found. Please create vendors first.</div>
              ) : (
                vendors.map((vendor) => (
                  <div key={vendor.id} className="flex items-center space-x-3 mb-4 last:mb-0">
                    <Checkbox 
                      id={`v-${vendor.id}`} 
                      checked={selectedVendorIds.includes(vendor.id)}
                      onCheckedChange={(checked) => {
                          if (checked) setSelectedVendorIds([...selectedVendorIds, vendor.id])
                          else setSelectedVendorIds(selectedVendorIds.filter(id => id !== vendor.id))
                      }}
                    />
                    <Label htmlFor={`v-${vendor.id}`} className="text-sm font-medium leading-none cursor-pointer">
                      {vendor.name}
                      <p className="text-[10px] text-gray-400 font-normal">{vendor.cuisineTypes?.join(", ")}</p>
                    </Label>
                  </div>
                ))
              )}
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveVendorAssignment} disabled={isSavingAssignment || vendors.length === 0}>
                {isSavingAssignment ? "Saving..." : "Save Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}