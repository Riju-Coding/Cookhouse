"use client"

import React, { useState, useEffect } from "react"
import { mealPlansService, subMealPlansService, vendorsService, type MealPlan, type Vendor } from "@/lib/firestore"
import { useToast } from "@/hooks/use-toast"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
// NEW: Search icon import kiya
import { GripVertical, Edit, Trash2, Loader2, UserPlus, Plus, FolderPlus, UtensilsCrossed, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function MealPlansPage() {
  const { toast } = useToast()
  
  // --- DATA STATES ---
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([])
  const [subMealPlans, setSubMealPlans] = useState<any[]>([]) 
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)

  // NEW: Search State
  const [searchQuery, setSearchQuery] = useState("")

  // --- VENDOR ASSIGNMENT STATES ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([])
  const [isAssigning, setIsAssigning] = useState(false)

  // --- DRAG AND DROP (FOR SUB MEAL PLANS) ---
  const [draggedSubId, setDraggedSubId] = useState<string | null>(null)
  const [isUpdatingOrder, setIsUpdatingOrder] = useState(false)

  // --- MODAL STATES (MEAL PLAN) ---
  const [isMpModalOpen, setIsMpModalOpen] = useState(false)
  const [editingMpId, setEditingMpId] = useState<string | null>(null)
  const [isSavingMp, setIsSavingMp] = useState(false)
  const [mpFormData, setMpFormData] = useState({
    name: "", description: "", status: "active", order: 1
  })

  // --- MODAL STATES (SUB MEAL PLAN) ---
  const [isSubModalOpen, setIsSubModalOpen] = useState(false)
  const [editingSubId, setEditingSubId] = useState<string | null>(null)
  const [isSavingSub, setIsSavingSub] = useState(false)
  const [subFormData, setSubFormData] = useState({
    name: "", mealPlanId: "", description: "", status: "active", order: 1
  })

  // ==========================================
  //               DATA FETCHING
  // ==========================================
  const fetchData = async () => {
    try {
      setLoading(true)
      const [mpData, subMpData, vData] = await Promise.all([
        mealPlansService.getAll(),
        subMealPlansService.getAll(),
        vendorsService.getAll()
      ])
      
      const sortedMp = mpData.sort((a, b) => (a.order || 999) - (b.order || 999))
      
      const mpOrderMap = new Map<string, number>()
      sortedMp.forEach((m) => mpOrderMap.set(m.id, m.order || 999))
      
      const sortedSubMp = subMpData.sort((a: any, b: any) => {
        const parentOrderA = mpOrderMap.get(a.mealPlanId) || 999
        const parentOrderB = mpOrderMap.get(b.mealPlanId) || 999
        
        if (parentOrderA !== parentOrderB) return parentOrderA - parentOrderB
        
        const orderDiff = (a.order || 999) - (b.order || 999)
        if (orderDiff !== 0) return orderDiff
        
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      })

      setMealPlans(sortedMp)
      setSubMealPlans(sortedSubMp)
      setVendors(vData)
    } catch (error) {
      console.error("Error fetching data:", error)
      toast({ title: "Error", description: "Failed to fetch data.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])


  // ==========================================
  //           VENDOR ASSIGNMENT LOGIC
  // ==========================================
  const toggleSelectId = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedIds(newSet)
  }

  const handleOpenAssignVendors = () => {
    if (selectedIds.size === 0) return
    setSelectedVendorIds([])
    setIsAssignModalOpen(true)
  }

  const handleSaveVendorAssignment = async () => {
    if (selectedVendorIds.length === 0) {
      toast({ title: "Error", description: "Select at least one vendor", variant: "destructive" })
      return
    }
    try {
      setIsAssigning(true)
      const updatePromises = Array.from(selectedIds).map(id => 
        mealPlansService.update(id, { vendorIds: selectedVendorIds } as any)
      )
      await Promise.all(updatePromises)
      toast({ title: "Success", description: `Assigned vendors to ${selectedIds.size} meal plans.` })
      setIsAssignModalOpen(false)
      setSelectedIds(new Set())
      fetchData()
    } catch (error) {
      toast({ title: "Error", description: "Failed to assign vendors", variant: "destructive" })
    } finally {
      setIsAssigning(false)
    }
  }

  // ==========================================
  //    DRAG AND DROP LOGIC (SUB MEAL PLANS)
  // ==========================================
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedSubId(id)
    e.dataTransfer.effectAllowed = "move"
  }
  const handleDragOver = (e: React.DragEvent) => e.preventDefault()
  
  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggedSubId || draggedSubId === targetId) return

    const draggedItem = subMealPlans.find((i) => i.id === draggedSubId)
    const targetItem = subMealPlans.find((i) => i.id === targetId)
    if (!draggedItem || !targetItem) return

    setIsUpdatingOrder(true)
    try {
      const updatedParentId = targetItem.mealPlanId
      const itemsInTargetGroup = subMealPlans
        .filter((i) => i.mealPlanId === updatedParentId && i.id !== draggedItem.id)
        .sort((a, b) => (a.order || 999) - (b.order || 999))

      const targetIndex = itemsInTargetGroup.findIndex((i) => i.id === targetId)

      const reordered = [
        ...itemsInTargetGroup.slice(0, targetIndex),
        { ...draggedItem, mealPlanId: updatedParentId },
        ...itemsInTargetGroup.slice(targetIndex),
      ]

      const newSubMealPlans = subMealPlans.map((s) => {
        const reorderedItem = reordered.find((r) => r.id === s.id)
        if (reorderedItem) {
          const newOrder = reordered.findIndex((r) => r.id === s.id) + 1
          return { ...s, mealPlanId: updatedParentId, order: newOrder }
        }
        return s
      })
      setSubMealPlans(newSubMealPlans)
      setDraggedSubId(null)

      const batchUpdates = reordered.map((item, index) =>
        subMealPlansService.update(item.id, {
          order: index + 1,
          mealPlanId: item.mealPlanId,
        })
      )
      await Promise.all(batchUpdates)
      toast({ title: "Success", description: "Order updated" })
    } catch (error) {
      toast({ title: "Error", description: "Failed to move item", variant: "destructive" })
      fetchData()
    } finally {
      setIsUpdatingOrder(false)
      setDraggedSubId(null)
    }
  }

  // ==========================================
  //        CRUD: PARENT MEAL PLANS
  // ==========================================
  const openAddMpModal = () => {
    setEditingMpId(null)
    setMpFormData({ name: "", description: "", status: "active", order: mealPlans.length + 1 })
    setIsMpModalOpen(true)
  }
  const openEditMpModal = (mp: MealPlan) => {
    setEditingMpId(mp.id)
    setMpFormData({ name: mp.name, description: mp.description || "", status: mp.status as any, order: mp.order || 1 })
    setIsMpModalOpen(true)
  }
  const handleSaveMp = async () => {
    if (!mpFormData.name) return toast({ title: "Error", description: "Name required", variant: "destructive" })
    setIsSavingMp(true)
    try {
      if (editingMpId) await mealPlansService.update(editingMpId, mpFormData)
      else await mealPlansService.add(mpFormData)
      toast({ title: "Success", description: "Meal Plan saved" })
      setIsMpModalOpen(false)
      fetchData()
    } catch (e) { toast({ title: "Error", variant: "destructive" }) }
    finally { setIsSavingMp(false) }
  }
  const handleDeleteMp = async (id: string, subCount: number) => {
    if (subCount > 0) return toast({ title: "Cannot Delete", description: `Delete ${subCount} nested items first.`, variant: "destructive" })
    if (!confirm("Delete this Meal Plan?")) return
    await mealPlansService.delete(id)
    setMealPlans(prev => prev.filter(m => m.id !== id))
    toast({ title: "Deleted" })
  }

  // ==========================================
  //        CRUD: SUB MEAL PLANS
  // ==========================================
  const openAddSubModal = () => {
    setEditingSubId(null)
    setSubFormData({ name: "", mealPlanId: mealPlans.length > 0 ? mealPlans[0].id : "", description: "", status: "active", order: 1 })
    setIsSubModalOpen(true)
  }
  const openEditSubModal = (sub: any) => {
    setEditingSubId(sub.id)
    setSubFormData({ name: sub.name, mealPlanId: sub.mealPlanId, description: sub.description || "", status: sub.status, order: sub.order || 1 })
    setIsSubModalOpen(true)
  }
  const handleSaveSub = async () => {
    if (!subFormData.name || !subFormData.mealPlanId) return toast({ title: "Error", description: "Name & Parent required", variant: "destructive" })
    setIsSavingSub(true)
    try {
      if (editingSubId) await subMealPlansService.update(editingSubId, subFormData)
      else await subMealPlansService.add(subFormData)
      toast({ title: "Success", description: "Nested item saved" })
      setIsSubModalOpen(false)
      fetchData()
    } catch (e) { toast({ title: "Error", variant: "destructive" }) }
    finally { setIsSavingSub(false) }
  }
  const handleDeleteSub = async (id: string) => {
    if (!confirm("Delete this nested item?")) return
    await subMealPlansService.delete(id)
    setSubMealPlans(prev => prev.filter(s => s.id !== id))
    toast({ title: "Deleted" })
  }

  // ==========================================
  //         NEW: SEARCH & FILTER LOGIC
  // ==========================================
  const filteredMealPlans = mealPlans.filter((mp) => {
    if (!searchQuery.trim()) return true
    
    const query = searchQuery.toLowerCase().trim()
    const matchesParent = mp.name?.toLowerCase().includes(query)
    
    // Check if any nested item inside this parent matches the query
    const hasMatchingChild = subMealPlans.some(
      (sub) => sub.mealPlanId === mp.id && sub.name?.toLowerCase().includes(query)
    )
    
    return matchesParent || hasMatchingChild
  })

  // ==========================================
  //                 RENDER
  // ==========================================
  if (loading) return <div className="flex justify-center items-center h-[50vh]"><Loader2 className="animate-spin h-8 w-8 text-gray-400" /></div>

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      
      {/* HEADER & ACTION BAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Meal Plans & Nested Items</h1>
          <p className="text-sm text-slate-500 mt-1">Manage main categories (Breads, Salads) and drag-and-drop their nested items.</p>
        </div>
        
        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && (
            <Button onClick={handleOpenAssignVendors} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                <UserPlus className="mr-2 h-4 w-4" /> Assign Vendor ({selectedIds.size})
            </Button>
          )}
          <Button onClick={openAddMpModal} variant="outline" className="shadow-sm border-slate-300">
            <FolderPlus className="mr-2 h-4 w-4" /> Add Meal Plan
          </Button>
          <Button onClick={openAddSubModal} className="shadow-sm">
            <Plus className="mr-2 h-4 w-4" /> Add Nested Item
          </Button>
        </div>
      </div>

      {/* NEW: SEARCH BAR COMPONENT */}
      <div className="relative max-w-md w-full mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by meal plan or nested item..."
          className="pl-9 bg-white shadow-sm border-slate-200"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* RENDER GROUPED CARDS */}
      <div className="space-y-8">
        {filteredMealPlans.length === 0 ? (
          <div className="text-center py-12 text-slate-500 bg-white rounded-lg border border-dashed">
            No results found for "{searchQuery}"
          </div>
        ) : (
          filteredMealPlans.map((mp) => {
            // Updated filtering logic for nested items
            const query = searchQuery.toLowerCase().trim()
            const parentMatches = mp.name?.toLowerCase().includes(query)

            let groupSubItems = subMealPlans.filter((s) => s.mealPlanId === mp.id)

            // Agar user ne kuch search kiya h aur parent ka naam match nahi kar raha (yani child search kiya h), 
            // toh sirf wahi child dikhao jo search se match karte hain.
            if (query && !parentMatches) {
              groupSubItems = groupSubItems.filter(s => s.name?.toLowerCase().includes(query))
            }

            const assignedVendors = vendors.filter(v => (mp as any).vendorIds?.includes(v.id))

            return (
              <Card key={mp.id} className={`overflow-hidden border-slate-200 shadow-sm transition-all ${selectedIds.has(mp.id) ? 'ring-2 ring-blue-500' : ''}`}>
                
                {/* Card Header (Parent Meal Plan) */}
                <div className="bg-slate-50 border-b px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    
                    <Checkbox 
                      checked={selectedIds.has(mp.id)} 
                      onCheckedChange={() => toggleSelectId(mp.id)}
                      className="w-5 h-5"
                    />
                    
                    <div className="p-2 bg-white rounded-md border shadow-sm">
                      <UtensilsCrossed className="h-5 w-5 text-slate-500" />
                    </div>
                    
                    <div>
                      <h2 className="text-lg font-semibold text-slate-800">{mp.name}</h2>
                      <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                        <span>Order: {mp.order}</span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                        <span>{groupSubItems.length} nested items</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="hidden md:flex gap-1">
                      {assignedVendors.map(v => (
                          <Badge key={v.id} variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                              {v.name}
                          </Badge>
                      ))}
                    </div>

                    <Badge variant={mp.status === "active" ? "default" : "secondary"} className="capitalize">
                      {mp.status}
                    </Badge>

                    <div className="flex items-center gap-1 border-l pl-4 border-slate-200">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => openEditMpModal(mp)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => handleDeleteMp(mp.id, groupSubItems.length)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Nested Items Table (Sub Meal Plans) */}
                <div className="overflow-x-auto">
                  {groupSubItems.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">
                      No nested items found.
                    </div>
                  ) : (
                    <table className="w-full text-sm text-left">
                      <thead className="bg-white border-b border-slate-100 text-slate-500">
                        <tr>
                          <th className="px-6 py-3 font-medium w-16 text-center">Drag</th>
                          <th className="px-6 py-3 font-medium w-16 text-center">Order</th>
                          <th className="px-6 py-3 font-medium w-[30%]">Name</th>
                          <th className="px-6 py-3 font-medium w-[30%]">Description</th>
                          <th className="px-6 py-3 font-medium w-24">Status</th>
                          <th className="px-6 py-3 font-medium text-right w-24">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {groupSubItems.map((item) => (
                          <tr 
                              key={item.id} 
                              draggable={!isUpdatingOrder && !searchQuery} // Disable drag while searching to avoid bugs
                              onDragStart={(e) => handleDragStart(e, item.id)}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(e, item.id)}
                              className={`bg-white transition-colors ${draggedSubId === item.id ? 'bg-blue-50/50 opacity-50' : 'hover:bg-slate-50'}`}
                          >
                            <td className="px-6 py-3 text-center">
                              <GripVertical className={`h-4 w-4 mx-auto ${searchQuery ? 'text-slate-200 cursor-not-allowed' : 'text-slate-300 hover:text-slate-600 cursor-grab'}`} />
                            </td>

                            <td className="px-6 py-3 text-center">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-xs font-medium text-slate-600">
                                {item.order}
                              </span>
                            </td>

                            <td className="px-6 py-3 font-medium text-slate-900">{item.name}</td>
                            <td className="px-6 py-3 text-slate-500"><span className="line-clamp-1">{item.description || "-"}</span></td>
                            
                            <td className="px-6 py-3">
                              <Badge variant={item.status === "active" ? "outline" : "secondary"} className="capitalize font-normal text-xs">
                                {item.status}
                              </Badge>
                            </td>

                            <td className="px-6 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600 text-slate-400" onClick={() => openEditSubModal(item)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-red-50 hover:text-red-600 text-slate-400" onClick={() => handleDeleteSub(item.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </Card>
            )
          })
        )}
      </div>

      {/* ========================================================= */}
      {/*                    MODALS BELLOW HERE                       */}
      {/* ========================================================= */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Assign Vendors</DialogTitle>
            <DialogDescription>Assign catering partners to {selectedIds.size} selected meal plans.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <ScrollArea className="h-[250px] w-full rounded-md border p-4">
              {vendors.map((vendor) => (
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
                  </Label>
                </div>
              ))}
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveVendorAssignment} disabled={isAssigning} className="bg-blue-600 hover:bg-blue-700 text-white">
                {isAssigning ? "Saving..." : "Save Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isMpModalOpen} onOpenChange={setIsMpModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingMpId ? "Edit Meal Plan" : "Add Meal Plan"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Name</Label><Input value={mpFormData.name} onChange={(e) => setMpFormData({...mpFormData, name: e.target.value})} /></div>
            <div className="grid gap-2"><Label>Description</Label><Textarea value={mpFormData.description} onChange={(e) => setMpFormData({...mpFormData, description: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Order</Label><Input type="number" value={mpFormData.order} onChange={(e) => setMpFormData({...mpFormData, order: parseInt(e.target.value)||0})} /></div>
                <div className="grid gap-2"><Label>Status</Label>
                    <Select value={mpFormData.status} onValueChange={(val:any) => setMpFormData({...mpFormData, status: val})}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
                    </Select>
                </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMpModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveMp} disabled={isSavingMp}>{isSavingMp ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSubModalOpen} onOpenChange={setIsSubModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingSubId ? "Edit Nested Item" : "Add Nested Item"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Name (e.g. Bread 1)</Label><Input value={subFormData.name} onChange={(e) => setSubFormData({...subFormData, name: e.target.value})} /></div>
            <div className="grid gap-2"><Label>Parent Category</Label>
                <Select value={subFormData.mealPlanId} onValueChange={(val) => setSubFormData({...subFormData, mealPlanId: val})}>
                    <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
                    <SelectContent>
                        {mealPlans.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="grid gap-2"><Label>Description</Label><Textarea value={subFormData.description} onChange={(e) => setSubFormData({...subFormData, description: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Order</Label><Input type="number" value={subFormData.order} onChange={(e) => setSubFormData({...subFormData, order: parseInt(e.target.value)||0})} /></div>
                <div className="grid gap-2"><Label>Status</Label>
                    <Select value={subFormData.status} onValueChange={(val:any) => setSubFormData({...subFormData, status: val})}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
                    </Select>
                </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSubModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSub} disabled={isSavingSub}>{isSavingSub ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}