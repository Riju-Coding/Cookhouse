"use client"

import React, { useState, useEffect } from "react"
import { CrudTable } from "@/components/admin/crud-table"
import { mealPlansService, vendorsService, type MealPlan, type Vendor } from "@/lib/firestore"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { GripVertical, Edit, Trash2, Loader2, UserPlus, CheckCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"

export default function MealPlansPage() {
  const { toast } = useToast()
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [draggedItem, setDraggedItem] = useState<MealPlan | null>(null)
  const [reorderingId, setReorderingId] = useState<string | null>(null)

  // Selection & Vendor Assignment State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([])
  const [isAssigning, setIsAssigning] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      const [mealPlansData, vendorsData] = await Promise.all([
        mealPlansService.getAll(),
        vendorsService.getAll()
      ])
      
      const sortedData = mealPlansData.sort((a, b) => (a.order || 999) - (b.order || 999))
      setMealPlans(sortedData)
      setVendors(vendorsData)
    } catch (error) {
      console.error("Error fetching data:", error)
      toast({
        title: "Error",
        description: "Failed to fetch data.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // --- SELECTION LOGIC ---
  const toggleSelectAll = () => {
    if (selectedIds.size === mealPlans.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(mealPlans.map(mp => mp.id)))
    }
  }

  const toggleSelectId = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedIds(newSet)
  }

  // --- VENDOR ASSIGNMENT LOGIC ---
  const handleOpenAssignVendors = () => {
    if (selectedIds.size === 0) {
      toast({ title: "Selection Required", description: "Please select at least one meal plan." })
      return
    }
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

  // --- DRAG AND DROP LOGIC ---
  const handleDragStart = (e: React.DragEvent, mealPlan: MealPlan) => {
    setDraggedItem(mealPlan)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleDrop = async (e: React.DragEvent, targetMealPlan: MealPlan) => {
    e.preventDefault()
    if (!draggedItem || draggedItem.id === targetMealPlan.id) {
      setDraggedItem(null)
      return
    }

    setReorderingId(draggedItem.id)
    const draggedIndex = mealPlans.findIndex(mp => mp.id === draggedItem.id)
    const targetIndex = mealPlans.findIndex(mp => mp.id === targetMealPlan.id)

    const newMealPlans = [...mealPlans]
    const [removed] = newMealPlans.splice(draggedIndex, 1)
    newMealPlans.splice(targetIndex, 0, removed)

    const reorderedPlans = newMealPlans.map((mp, index) => ({
      ...mp,
      order: index + 1
    }))

    setMealPlans(reorderedPlans)
    setDraggedItem(null)

    try {
      const updatePromises = reorderedPlans.map((mp) => 
        mealPlansService.update(mp.id, { order: mp.order })
      )
      await Promise.all(updatePromises)
      toast({ title: "Success", description: "Order updated." })
    } catch (error) {
      fetchData()
    } finally {
      setReorderingId(null)
    }
  }

  // --- CRUD HANDLERS ---
  const handleAdd = async (data: any) => {
    setIsAdding(true)
    try {
      await mealPlansService.add(data)
      await fetchData()
      toast({ title: "Success", description: "Meal plan added." })
    } catch (error) {
      toast({ title: "Error", variant: "destructive" })
    } finally { setIsAdding(false) }
  }

  const handleUpdate = async (id: string, data: any) => {
    setIsEditing(true)
    try {
      await mealPlansService.update(id, data)
      await fetchData()
      toast({ title: "Success", description: "Meal plan updated." })
    } catch (error) {
      toast({ title: "Error", variant: "destructive" })
    } finally { setIsEditing(false) }
  }

  const handleDelete = async (id: string) => {
    setDeletingIds((prev) => new Set(prev).add(id))
    try {
      await mealPlansService.delete(id)
      await fetchData()
      toast({ title: "Success", description: "Deleted." })
    } catch (error) {
      toast({ title: "Error", variant: "destructive" })
    } finally {
      setDeletingIds((prev) => {
        const n = new Set(prev); n.delete(id); return n
      })
    }
  }

  const handleBulkDelete = async (ids: string[]) => {
    try {
      await Promise.all(ids.map(id => mealPlansService.delete(id)))
      await fetchData()
      toast({ title: "Success", description: "Bulk delete successful." })
    } catch (error) { toast({ title: "Error", variant: "destructive" }) }
  }

  const columns = [
    { key: "order", label: "Order" },
    { key: "name", label: "Name" },
    { key: "description", label: "Description" },
    { key: "status", label: "Status" },
  ]

  const formFields = [
    { name: "order", label: "Display Order", type: "number" as const, required: true },
    { name: "name", label: "Name", type: "text" as const, required: true },
    { name: "description", label: "Description", type: "text" as const },
    {
      name: "status",
      label: "Status",
      type: "select" as const,
      required: true,
      options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }],
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex-1 mr-4">
            <p className="text-sm text-blue-800">
            <strong>Tip:</strong> Drag to reorder. Use checkboxes to assign multiple meal plans to vendors.
            </p>
        </div>
        {selectedIds.size > 0 && (
            <Button onClick={handleOpenAssignVendors} className="bg-blue-600 hover:bg-blue-700">
                <UserPlus className="mr-2 h-4 w-4" /> Assign Vendor ({selectedIds.size})
            </Button>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-bold">Meal Plans Order</CardTitle>
          <div className="flex items-center space-x-2">
            <Checkbox 
                id="select-all" 
                checked={selectedIds.size === mealPlans.length && mealPlans.length > 0}
                onCheckedChange={toggleSelectAll}
            />
            <Label htmlFor="select-all" className="text-sm font-medium">Select All</Label>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {mealPlans.map((mealPlan) => {
              const assignedVendors = vendors.filter(v => (mealPlan as any).vendorIds?.includes(v.id))
              return (
                <div
                  key={mealPlan.id}
                  draggable={!reorderingId}
                  onDragStart={(e) => handleDragStart(e, mealPlan)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, mealPlan)}
                  className={`
                    flex items-center gap-3 p-4 bg-white border rounded-lg
                    transition-all duration-200
                    ${!reorderingId ? 'hover:shadow-md hover:border-blue-300' : 'opacity-50'}
                    ${selectedIds.has(mealPlan.id) ? 'border-blue-500 bg-blue-50/30' : ''}
                  `}
                >
                  <Checkbox 
                    checked={selectedIds.has(mealPlan.id)} 
                    onCheckedChange={() => toggleSelectId(mealPlan.id)}
                  />
                  
                  {reorderingId === mealPlan.id ? (
                    <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                  ) : (
                    <GripVertical className="h-5 w-5 text-gray-400 cursor-move" />
                  )}
                  
                  <div className="flex items-center gap-3 flex-1">
                    <Badge variant="secondary" className="font-mono">#{mealPlan.order}</Badge>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{mealPlan.name}</h3>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {assignedVendors.map(v => (
                            <Badge key={v.id} variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                                {v.name}
                            </Badge>
                        ))}
                      </div>
                    </div>
                    <Badge variant={mealPlan.status === 'active' ? 'default' : 'outline'}>{mealPlan.status}</Badge>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
      
      <CrudTable
        title="Manage Meal Plans"
        data={mealPlans}
        columns={columns}
        formFields={formFields}
        onAdd={handleAdd}
        onEdit={handleUpdate}
        onDelete={handleDelete}
        onBulkDelete={handleBulkDelete}
        isAdding={isAdding}
        isEditing={isEditing}
        deletingIds={deletingIds}
      />

      {/* --- ASSIGN VENDOR MODAL --- */}
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
                    <p className="text-[10px] text-gray-400 font-normal">{vendor.cuisineTypes?.join(", ")}</p>
                  </Label>
                </div>
              ))}
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveVendorAssignment} disabled={isAssigning} className="bg-blue-600 hover:bg-blue-700">
                {isAssigning ? "Saving..." : "Save Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}