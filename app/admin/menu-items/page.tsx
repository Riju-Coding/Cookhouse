"use client"

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  UserPlus,
  Sparkles,
  FileSpreadsheet,
  Pencil,
  Check,
  X,
  Loader2,
  Tags,
  ChevronsLeft,
  ChevronsRight
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

// ─── Types ───────────────────────────────────────────────────────
interface AiTags {
  color?: string
  cuisine?: string
  primaryIngredient?: string
  flavorProfile?: string
  submealCategory?: string
  heavyLight?: "Heavy" | "Light" | "Medium"
  updatedAt?: any
}

interface MenuItem {
  id: string
  name: string
  category?: string
  description?: string
  status: "active" | "inactive"
  vendorIds?: string[]
  aiTags?: AiTags
  createdAt: any
  updatedAt: any
}

// ─── Tag Config ──────────────────────────────────────────────────
const TAG_KEYS = [
  { key: "color", label: "Color", colorClass: "bg-amber-50 text-amber-800 border-amber-200" },
  { key: "cuisine", label: "Cuisine", colorClass: "bg-blue-50 text-blue-800 border-blue-200" },
  { key: "primaryIngredient", label: "Ingredient", colorClass: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  { key: "flavorProfile", label: "Flavor", colorClass: "bg-rose-50 text-rose-800 border-rose-200" },
  { key: "submealCategory", label: "Sub-Category", colorClass: "bg-violet-50 text-violet-800 border-violet-200" },
  { key: "heavyLight", label: "Heavy/Light", colorClass: "bg-slate-50 text-slate-800 border-slate-200" },
] as const

type TagKey = typeof TAG_KEYS[number]["key"]

// ─── Firestore Service ──────────────────────────────────────────
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
  },

  async updateAiTag(id: string, tagKey: string, value: string) {
    const docRef = doc(db, "menuItems", id)
    await updateDoc(docRef, {
      [`aiTags.${tagKey}`]: value,
      [`aiTags.updatedAt`]: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
  }
}

// ─── Inline Tag Editor Component ─────────────────────────────────
function InlineTagEditor({ 
  value, 
  tagKey, 
  itemId, 
  colorClass,
  onSave 
}: { 
  value: string
  tagKey: string
  itemId: string
  colorClass: string
  onSave: (itemId: string, tagKey: string, newVal: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleSave = () => {
    if (editValue.trim() && editValue.trim() !== value) {
      onSave(itemId, tagKey, editValue.trim())
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditValue(value)
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input 
          ref={inputRef}
          value={editValue} 
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave()
            if (e.key === "Escape") handleCancel()
          }}
          className="h-6 text-[11px] w-24 px-1"
        />
        <button onClick={handleSave} className="text-green-600 hover:text-green-700">
          <Check className="h-3 w-3" />
        </button>
        <button onClick={handleCancel} className="text-red-500 hover:text-red-600">
          <X className="h-3 w-3" />
        </button>
      </div>
    )
  }

  if (!value || value === "Unknown") {
    return (
      <span 
        className="text-[10px] text-gray-300 italic cursor-pointer hover:text-gray-500 transition-colors"
        onClick={() => { setEditValue(value || ""); setIsEditing(true) }}
      >
        —
      </span>
    )
  }

  return (
    <Badge 
      variant="outline" 
      className={`${colorClass} text-[10px] cursor-pointer hover:opacity-80 transition-opacity group relative pr-5`}
      onClick={() => { setEditValue(value); setIsEditing(true) }}
    >
      {value}
      <Pencil className="h-2.5 w-2.5 absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-60 transition-opacity" />
    </Badge>
  )
}

// ─── Main Page Component ─────────────────────────────────────────
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
  const [pageSize, setPageSize] = useState(25)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  
  // Vendor Assignment States
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([])
  const [isSavingAssignment, setIsSavingAssignment] = useState(false)

  // AI Categorization States
  const [isCategorizing, setIsCategorizing] = useState(false)
  const [categorizeProgress, setCategorizeProgress] = useState(0)
  const [categorizeMessage, setCategorizeMessage] = useState("")

  // Column Filter State (Like Excel)
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})

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
  }, [searchTerm, pageSize, columnFilters])

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
    let items = menuItems.filter((item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    // Apply column filters
    Object.entries(columnFilters).forEach(([colKey, val]) => {
      if (colKey === "category") {
         items = items.filter(i => (i.category || "Uncategorized").toLowerCase() === val.toLowerCase())
      } else if (colKey === "vendor") {
         items = items.filter(i => {
           const assignedVendors = vendors.filter(v => i.vendorIds?.includes(v.id)).map(v => v.name)
           if (assignedVendors.length === 0) return val === "Unassigned"
           return assignedVendors.includes(val)
         })
      } else {
         items = items.filter(i => {
           const tagValue = (i.aiTags as any)?.[colKey]
           return tagValue?.toLowerCase() === val.toLowerCase()
         })
      }
    })

    return items
  }, [menuItems, searchTerm, columnFilters, vendors])

  const totalPages = Math.max(1, Math.ceil(filteredMenuItems.length / pageSize))
  const indexOfLastItem = currentPage * pageSize
  const indexOfFirstItem = indexOfLastItem - pageSize
  const currentItems = filteredMenuItems.slice(indexOfFirstItem, indexOfLastItem)

  // Compute unique tag values for filtering
  const tagValueOptions = useMemo(() => {
    const options: Record<string, Set<string>> = {}
    TAG_KEYS.forEach((t) => { options[t.key] = new Set() })
    menuItems.forEach((item) => {
      if (!item.aiTags) return
      TAG_KEYS.forEach((t) => {
        const val = (item.aiTags as any)?.[t.key]
        if (val && val !== "Unknown") options[t.key].add(val)
      })
    })
    return options
  }, [menuItems])

  const categoryOptions = useMemo(() => {
    const opts = new Set<string>()
    menuItems.forEach(i => opts.add(i.category || "Uncategorized"))
    return Array.from(opts).sort()
  }, [menuItems])

  const vendorOptions = useMemo(() => {
    const opts = new Set<string>()
    menuItems.forEach(i => {
      const assigned = vendors.filter(v => i.vendorIds?.includes(v.id)).map(v => v.name)
      if (assigned.length === 0) opts.add("Unassigned")
      assigned.forEach(v => opts.add(v))
    })
    return Array.from(opts).sort()
  }, [menuItems, vendors])

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

  // --- AI CATEGORIZATION ---
  const handleAiCategorize = async () => {
    let targetItems: { id: string; name: string }[] = []

    if (selectedIds.size > 0) {
      targetItems = menuItems
        .filter((i) => selectedIds.has(i.id) && i.name)
        .map((i) => ({ id: i.id, name: i.name }))
    } else {
      targetItems = menuItems
        .filter((i) => !i.aiTags && i.name)
        .map((i) => ({ id: i.id, name: i.name }))
    }

    if (targetItems.length === 0) {
      toast({ title: "Nothing to categorize", description: "All items already have AI tags. Select specific items to re-categorize." })
      return
    }

    setIsCategorizing(true)
    setCategorizeProgress(0)
    setCategorizeMessage(`Preparing ${targetItems.length} items...`)

    // Helper to chunk the items
    const chunk = <T,>(arr: T[], size: number): T[][] => {
      const out: T[][] = []
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
      return out
    }

    const BATCH_SIZE = 30 // Process 30 items at a time
    const batches = chunk(targetItems, BATCH_SIZE)
    let totalProcessed = 0
    let totalSuccessful = 0
    let hasError = false

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      setCategorizeMessage(`Categorizing batch ${i + 1} of ${batches.length} (${totalProcessed} of ${targetItems.length} done)...`)
      
      try {
        const response = await fetch("/api/ai/menu-categorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: batch }),
        })

        const data = await response.json()
        if (!data.ok) {
          throw new Error(data.error || "Batch categorization failed")
        }

        totalSuccessful += data.processed || 0
      } catch (error: any) {
        console.error(`Error processing batch ${i + 1}:`, error)
        hasError = true
        // We continue with the next batch even if one fails
      }

      totalProcessed += batch.length
      setCategorizeProgress(Math.round((totalProcessed / targetItems.length) * 100))
    }

    setCategorizeMessage(`Finished! Reloading tags...`)
    
    // Reload data to show new tags
    await loadData()
    
    setCategorizeProgress(100)

    if (hasError) {
      toast({
        title: "Categorization Partially Complete",
        description: `Categorized ${totalSuccessful} items. Some batches failed.`,
        variant: "destructive",
      })
    } else {
      toast({
        title: "AI Categorization Complete",
        description: `Successfully categorized ${totalSuccessful} menu items.`,
      })
    }

    setTimeout(() => {
      setIsCategorizing(false)
      setCategorizeProgress(0)
      setCategorizeMessage("")
    }, 2000)
  }

  // --- INLINE TAG EDIT ---
  const handleTagSave = useCallback(async (itemId: string, tagKey: string, newValue: string) => {
    try {
      await menuItemsService.updateAiTag(itemId, tagKey, newValue)
      // Update local state immediately
      setMenuItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, aiTags: { ...(item.aiTags || {}), [tagKey]: newValue } as AiTags }
            : item
        )
      )
      toast({ title: "Tag Updated", description: `${tagKey} updated to "${newValue}"` })
    } catch {
      toast({ title: "Error", description: "Failed to update tag", variant: "destructive" })
    }
  }, [])

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

  // --- XLSX EXPORT (Full data with AI tags) ---
  const handleExportXlsx = () => {
    const exportData = filteredMenuItems.map((item) => {
      const assignedVendors = vendors.filter(v => item.vendorIds?.includes(v.id))
      return {
        "Menu Item Name": item.name,
        "Category": item.category || "",
        "Description": item.description || "",
        "Color": item.aiTags?.color || "",
        "Cuisine": item.aiTags?.cuisine || "",
        "Primary Ingredient": item.aiTags?.primaryIngredient || "",
        "Flavor Profile": item.aiTags?.flavorProfile || "",
        "Sub-Category": item.aiTags?.submealCategory || "",
        "Heavy/Light": item.aiTags?.heavyLight || "",
        "Assigned Vendors": assignedVendors.map(v => v.name).join(", "),
        "Status": item.status || "active",
      }
    })

    const ws = XLSX.utils.json_to_sheet(exportData)
    
    // Auto-width columns
    const colWidths = Object.keys(exportData[0] || {}).map((key) => ({
      wch: Math.max(key.length, 15)
    }))
    ws["!cols"] = colWidths

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Menu Items")
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const dateStr = new Date().toISOString().split('T')[0]
    saveAs(new Blob([excelBuffer]), `menu_items_${dateStr}.xlsx`)
    
    toast({ title: "Exported", description: `${exportData.length} items exported to Excel` })
  }

  // --- Excel Import ---
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

  // --- Stats ---
  const taggedCount = menuItems.filter(i => i.aiTags).length
  const untaggedCount = menuItems.length - taggedCount

  if (loading && menuItems.length === 0) {
    return <div className="flex items-center justify-center h-64 font-medium">Loading catalog...</div>
  }

  return (
    <div className="space-y-4 p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Menu Items Catalog</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-gray-500">{menuItems.length} items</span>
            <span className="text-[10px] text-gray-300">•</span>
            <span className="text-sm text-emerald-600 flex items-center gap-1">
              <Tags className="h-3.5 w-3.5" />{taggedCount} tagged
            </span>
            {untaggedCount > 0 && (
              <>
                <span className="text-[10px] text-gray-300">•</span>
                <span className="text-sm text-amber-600">{untaggedCount} untagged</span>
              </>
            )}
          </div>
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
                Delete ({selectedIds.size})
             </Button>
            </>
          )}
          <Button
            variant="outline"
            className="border-violet-200 text-violet-700 bg-violet-50 hover:bg-violet-100"
            onClick={handleAiCategorize}
            disabled={isCategorizing}
          >
            {isCategorizing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {isCategorizing
              ? "Categorizing..."
              : selectedIds.size > 0
              ? `AI Categorize (${selectedIds.size})`
              : `AI Categorize${untaggedCount > 0 ? ` (${untaggedCount} untagged)` : ""}`}
          </Button>
          <Button variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100" onClick={handleExportXlsx}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />Export XLSX
          </Button>
          <Button variant="outline" onClick={downloadSampleExcel}><Download className="h-4 w-4 mr-2" />Template</Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload className="h-4 w-4 mr-2" />{uploading ? "Uploading..." : "Import"}
          </Button>
          <Button onClick={() => setIsAddingNew(true)} disabled={isAddingNew}><Plus className="h-4 w-4 mr-2" />New Item</Button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />

      {/* AI Progress Bar */}
      {isCategorizing && (
        <Card className="border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50 animate-in fade-in-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="h-5 w-5 text-violet-600 animate-pulse" />
              <span className="text-sm font-medium text-violet-800">{categorizeMessage}</span>
            </div>
            <Progress value={categorizeProgress} className="h-2" />
          </CardContent>
        </Card>
      )}

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

      {/* Search + Tag Filters + Page Size */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input placeholder="Search by name or category..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>

        {/* Tag filter chips */}
        {Object.keys(columnFilters).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(columnFilters).map(([key, val]) => {
              const label = key === "category" ? "Category" : key === "vendor" ? "Vendor" : TAG_KEYS.find(t => t.key === key)?.label || key
              return (
                <Badge
                  key={key}
                  variant="secondary"
                  className="bg-violet-100 text-violet-700 hover:bg-violet-200 cursor-pointer text-xs"
                  onClick={() => {
                    const newF = { ...columnFilters }
                    delete newF[key]
                    setColumnFilters(newF)
                  }}
                >
                  {label}: {val}
                  <X className="h-3 w-3 ml-1" />
                </Badge>
              )
            })}
            <Badge
              variant="outline"
              className="cursor-pointer text-xs hover:bg-gray-100"
              onClick={() => setColumnFilters({})}
            >
              Clear All Filters
            </Badge>
          </div>
        )}

        <Select value={String(pageSize)} onValueChange={(val) => setPageSize(Number(val))}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10 / page</SelectItem>
            <SelectItem value="25">25 / page</SelectItem>
            <SelectItem value="50">50 / page</SelectItem>
            <SelectItem value="100">100 / page</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <div className="rounded-md border overflow-x-auto">
          <div className="max-h-[65vh] overflow-y-auto relative">
            <table className="w-full text-sm text-left min-w-[1200px]">
              <thead className="bg-gray-50 font-medium sticky top-0 z-10">
                <tr>
                  <th className="p-3 w-10">
                    <Checkbox checked={isAllCurrentPageSelected} onCheckedChange={(checked) => handleSelectAll(!!checked)} />
                  </th>
                  <th className="p-3 min-w-[180px]">Name</th>
                  <th className="p-3 min-w-[120px]">
                    <ColumnFilter
                      title="Vendors"
                      options={vendorOptions}
                      value={columnFilters["vendor"]}
                      onChange={(val) => setColumnFilters({ ...columnFilters, vendor: val })}
                      onClear={() => { const f = {...columnFilters}; delete f["vendor"]; setColumnFilters(f) }}
                    />
                  </th>
                  <th className="p-3 min-w-[90px]">
                    <ColumnFilter
                      title="Category"
                      options={categoryOptions}
                      value={columnFilters["category"]}
                      onChange={(val) => setColumnFilters({ ...columnFilters, category: val })}
                      onClear={() => { const f = {...columnFilters}; delete f["category"]; setColumnFilters(f) }}
                    />
                  </th>
                  {TAG_KEYS.map((tag) => (
                    <th key={tag.key} className="p-3 min-w-[100px]">
                      <ColumnFilter
                        title={tag.label}
                        options={Array.from(tagValueOptions[tag.key] || []).sort()}
                        value={columnFilters[tag.key]}
                        onChange={(val) => setColumnFilters({ ...columnFilters, [tag.key]: val })}
                        onClear={() => { const f = {...columnFilters}; delete f[tag.key]; setColumnFilters(f) }}
                      />
                    </th>
                  ))}
                  <th className="p-3 text-right w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentItems.length === 0 ? (
                   <tr><td colSpan={4 + TAG_KEYS.length + 1} className="p-8 text-center text-gray-500"><Utensils className="h-8 w-8 mx-auto mb-2 opacity-20" /><p>No items found</p></td></tr>
                ) : (
                  currentItems.map((item) => {
                    const assignedVendors = vendors.filter(v => item.vendorIds?.includes(v.id))
                    return (
                      <tr key={item.id} className={`hover:bg-gray-50/50 transition-colors ${selectedIds.has(item.id) ? 'bg-blue-50/30' : ''}`}>
                        <td className="p-3">
                          <Checkbox checked={selectedIds.has(item.id)} onCheckedChange={(checked) => handleSelectOne(item.id, !!checked)} />
                        </td>
                        <td className="p-3 font-medium text-gray-900">{item.name}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {assignedVendors.length > 0 ? (
                              assignedVendors.map(v => <Badge key={v.id} variant="secondary" className="text-[10px] bg-green-50 text-green-700 border-green-200">{v.name}</Badge>)
                            ) : <span className="text-[10px] text-gray-400 italic">Unassigned</span>}
                          </div>
                        </td>
                        <td className="p-3">
                          {item.category && <Badge variant="outline" className="bg-gray-50 text-[10px]">{item.category}</Badge>}
                        </td>
                        {TAG_KEYS.map((tag) => (
                          <td key={tag.key} className="p-3">
                            <InlineTagEditor
                              value={(item.aiTags as any)?.[tag.key] || ""}
                              tagKey={tag.key}
                              itemId={item.id}
                              colorClass={tag.colorClass}
                              onSave={handleTagSave}
                            />
                          </td>
                        ))}
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(item)}><MoreHorizontal className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination Controls */}
        {filteredMenuItems.length > 0 && (
          <div className="flex items-center justify-between p-4 border-t bg-white">
            <span className="text-sm text-gray-500">
              Showing {indexOfFirstItem + 1}–{Math.min(indexOfLastItem, filteredMenuItems.length)} of {filteredMenuItems.length}
              {selectedIds.size > 0 && (
                <span className="ml-2 text-blue-600 font-medium">({selectedIds.size} selected)</span>
              )}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-gray-600 px-2 min-w-[80px] text-center">
                Page {currentPage} of {totalPages}
              </span>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>
                <ChevronsRight className="h-4 w-4" />
              </Button>
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

// ─── Column Filter Component ─────────────────────────────────────
function ColumnFilter({ 
  title, 
  options, 
  value, 
  onChange, 
  onClear 
}: { 
  title: string, 
  options: string[], 
  value?: string, 
  onChange: (val: string) => void, 
  onClear: () => void 
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const filteredOptions = options.filter(o => o.toLowerCase().includes(search.toLowerCase()))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={`flex items-center gap-1 transition-colors text-xs font-semibold uppercase tracking-wide ${value ? "text-violet-700" : "hover:text-violet-700"}`}>
          {title}
          {options.length > 0 && <span className="text-[9px] text-gray-400 font-normal">▼</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0 shadow-lg" align="start">
        <div className="p-2 border-b">
          <Input 
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${title}...`}
            className="h-8 text-sm"
          />
        </div>
        <div className="max-h-[200px] overflow-y-auto">
          <div className="p-1 flex flex-col gap-0.5">
            <button
              className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-gray-100 text-gray-500"
              onClick={() => { onClear(); setOpen(false); setSearch("") }}
            >
              Show All
            </button>
            {filteredOptions.length === 0 ? (
              <div className="p-2 text-xs text-center text-gray-500">No options found.</div>
            ) : (
              filteredOptions.map((val) => (
                <button
                  key={val}
                  className={`relative flex w-full items-center rounded-sm px-2 py-1.5 text-xs outline-hidden hover:bg-violet-50 text-left ${
                    value === val ? "bg-violet-100 text-violet-800 font-medium" : ""
                  }`}
                  onClick={() => { onChange(val); setOpen(false); setSearch("") }}
                >
                  {value === val && <Check className="absolute left-2 h-3 w-3 text-violet-600" />}
                  <span className={value === val ? "pl-5" : "pl-1"}>{val}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}