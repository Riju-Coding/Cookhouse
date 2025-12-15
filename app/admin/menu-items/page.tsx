"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
  AlignJustify
} from "lucide-react"
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

interface MenuItem {
  id: string
  name: string
  category?: string
  description?: string
  status: "active" | "inactive"
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
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  // Pagination & Selection State
  const [currentPage, setCurrentPage] = useState(1)
  const [showAll, setShowAll] = useState(false) // New State for "Show All"
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    name: "",
    category: "",
    description: "",
  })

  useEffect(() => {
    loadMenuItems()
  }, [])

  // Reset pagination when search or view mode changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, showAll])

  const loadMenuItems = async () => {
    try {
      setLoading(true)
      const data = await menuItemsService.getAll()
      const sorted = data.sort((a, b) => 
        (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
      )
      setMenuItems(sorted)
    } catch (error) {
      console.error("Error loading menu items:", error)
      toast({
        title: "Error",
        description: "Failed to load menu items",
        variant: "destructive",
      })
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

  // If showAll is true, itemsPerPage is the total length, otherwise 10
  const itemsPerPage = showAll ? (filteredMenuItems.length || 1) : 10
  
  const totalPages = Math.ceil(filteredMenuItems.length / itemsPerPage)
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentItems = filteredMenuItems.slice(indexOfFirstItem, indexOfLastItem)

  // --- Selection Logic ---

  const handleSelectAll = (checked: boolean) => {
    const newSelected = new Set(selectedIds)
    if (checked) {
      // Select currently visible items (which is ALL items if showAll is true)
      currentItems.forEach(item => newSelected.add(item.id))
    } else {
      currentItems.forEach(item => newSelected.delete(item.id))
    }
    setSelectedIds(newSelected)
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds)
    if (checked) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
    }
    setSelectedIds(newSelected)
  }

  const isAllCurrentPageSelected = currentItems.length > 0 && currentItems.every(item => selectedIds.has(item.id))

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    
    // Warning for large deletions
    const warning = selectedIds.size > 50 
      ? `WARNING: You are about to delete ${selectedIds.size} items. This cannot be undone.` 
      : `Are you sure you want to delete ${selectedIds.size} items?`

    if (!confirm(warning)) return

    try {
      setLoading(true)
      await menuItemsService.bulkDelete(Array.from(selectedIds))
      toast({
        title: "Success",
        description: `${selectedIds.size} items deleted successfully`,
      })
      setSelectedIds(new Set())
      await loadMenuItems()
    } catch (error) {
      console.error("Error deleting items:", error)
      toast({
        title: "Error",
        description: "Failed to delete items",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // --- Form & Excel Logic ---

  const downloadSampleExcel = () => {
    const sampleData = [
      { "Menu Item Name": "Dhaba Dal", "Category": "Main Course", "Description": "Traditional lentil curry" },
      { "Menu Item Name": "Plain Rice", "Category": "Main Course", "Description": "Steamed basmati rice" }
    ]
    const ws = XLSX.utils.json_to_sheet(sampleData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Menu Items")
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    saveAs(data, 'menu_items_sample.xlsx')
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[]

      const menuItemsToAdd: Omit<MenuItem, "id">[] = []
      
      jsonData.forEach((row) => {
        const name = row["Menu Item Name"]?.toString().trim()
        if (name) {
          menuItemsToAdd.push({
            name,
            category: row["Category"]?.toString().trim() || "",
            description: row["Description"]?.toString().trim() || "",
            status: "active",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        }
      })

      if (menuItemsToAdd.length > 0) {
        await menuItemsService.bulkAdd(menuItemsToAdd)
        toast({ title: "Success", description: `${menuItemsToAdd.length} items added successfully` })
        await loadMenuItems()
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to process file", variant: "destructive" })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleSubmit = async () => {
    if (!formData.name.trim()) return
    try {
      if (editingId) {
        await menuItemsService.update(editingId, { ...formData })
      } else {
        await menuItemsService.add({
          ...formData,
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }
      setFormData({ name: "", category: "", description: "" })
      setIsAddingNew(false)
      setEditingId(null)
      await loadMenuItems()
      toast({ title: "Success", description: "Saved successfully" })
    } catch (error) {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" })
    }
  }

  const handleEdit = (item: MenuItem) => {
    setFormData({
      name: item.name,
      category: item.category || "",
      description: item.description || "",
    })
    setEditingId(item.id)
    setIsAddingNew(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return
    try {
      await menuItemsService.delete(id)
      await loadMenuItems()
      toast({ title: "Success", description: "Deleted successfully" })
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" })
    }
  }

  if (loading && menuItems.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-2">
           <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
           <span className="text-gray-500">Loading catalog...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Menu Items</h1>
          <p className="text-gray-600">Manage your menu items catalog ({menuItems.length} total)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedIds.size > 0 && (
             <Button variant="destructive" onClick={handleBulkDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected ({selectedIds.size})
             </Button>
          )}
          <Button variant="outline" onClick={downloadSampleExcel}>
            <Download className="h-4 w-4 mr-2" />
            Template
          </Button>
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? "Uploading..." : "Import Excel"}
          </Button>
          <Button onClick={() => setIsAddingNew(true)} disabled={isAddingNew}>
            <Plus className="h-4 w-4 mr-2" />
            New Item
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Add/Edit Form */}
      {isAddingNew && (
        <Card className="animate-in fade-in-50 slide-in-from-top-5">
          <CardHeader>
            <CardTitle>{editingId ? "Edit Menu Item" : "Add New Menu Item"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Item Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Butter Chicken"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g., Main Course"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => {
                setIsAddingNew(false)
                setEditingId(null)
                setFormData({ name: "", category: "", description: "" })
              }}>Cancel</Button>
              <Button onClick={handleSubmit}>{editingId ? "Update" : "Save Item"}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search & Toggle Row */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search by name or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button 
            variant={showAll ? "secondary" : "outline"} 
            onClick={() => setShowAll(!showAll)}
            className="whitespace-nowrap min-w-[100px]"
        >
            {showAll ? (
                <>
                    <List className="h-4 w-4 mr-2"/>
                    Show Paged
                </>
            ) : (
                <>
                    <AlignJustify className="h-4 w-4 mr-2"/>
                    Show All
                </>
            )}
        </Button>
      </div>

      {/* Table Data */}
      <Card>
        <div className="rounded-md border max-h-[70vh] overflow-y-auto relative">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-700 font-medium sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="p-4 w-10 bg-gray-50">
                  <input 
                    type="checkbox" 
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    checked={isAllCurrentPageSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    title={showAll ? "Select all items" : "Select current page"}
                  />
                </th>
                <th className="p-4 bg-gray-50">Name</th>
                <th className="p-4 hidden sm:table-cell bg-gray-50">Category</th>
                <th className="p-4 hidden md:table-cell bg-gray-50">Description</th>
                <th className="p-4 text-right bg-gray-50">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {currentItems.length === 0 ? (
                 <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500">
                       <Utensils className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                       <p>No items found</p>
                    </td>
                 </tr>
              ) : (
                currentItems.map((item) => (
                  <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.has(item.id) ? 'bg-blue-50/50' : ''}`}>
                    <td className="p-4">
                      <input 
                        type="checkbox" 
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        checked={selectedIds.has(item.id)}
                        onChange={(e) => handleSelectOne(item.id, e.target.checked)}
                      />
                    </td>
                    <td className="p-4 font-medium text-gray-900">{item.name}</td>
                    <td className="p-4 hidden sm:table-cell">
                      {item.category && <Badge variant="secondary">{item.category}</Badge>}
                    </td>
                    <td className="p-4 hidden md:table-cell text-gray-500 max-w-xs truncate">
                      {item.description}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(item)}
                          title="Edit"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(item.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls - Hide if Show All is active */}
        {!showAll && filteredMenuItems.length > 0 && (
          <div className="flex items-center justify-between p-4 border-t bg-white">
            <div className="text-sm text-gray-500">
              Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredMenuItems.length)} of {filteredMenuItems.length}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        
        {/* Footer info when showing all */}
        {showAll && filteredMenuItems.length > 0 && (
           <div className="p-2 text-center text-xs text-gray-400 border-t">
              Showing all {filteredMenuItems.length} items
           </div>
        )}
      </Card>
    </div>
  )
}