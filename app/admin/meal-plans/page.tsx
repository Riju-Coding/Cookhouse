"use client"

import { useState, useEffect } from "react"
import { CrudTable } from "@/components/admin/crud-table"
import { mealPlansService, type MealPlan } from "@/lib/firestore"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { GripVertical, Edit, Trash2, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default function MealPlansPage() {
  const { toast } = useToast()
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [draggedItem, setDraggedItem] = useState<MealPlan | null>(null)
  const [reorderingId, setReorderingId] = useState<string | null>(null)

  const fetchMealPlans = async () => {
    try {
      setLoading(true)
      const data = await mealPlansService.getAll()
      // Sort by order
      const sortedData = data.sort((a, b) => (a.order || 999) - (b.order || 999))
      setMealPlans(sortedData)
    } catch (error) {
      console.error("Error fetching meal plans:", error)
      toast({
        title: "Error",
        description: "Failed to fetch meal plans. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMealPlans()
  }, [])

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

    // Show loader on the dragged item
    setReorderingId(draggedItem.id)

    const draggedIndex = mealPlans.findIndex(mp => mp.id === draggedItem.id)
    const targetIndex = mealPlans.findIndex(mp => mp.id === targetMealPlan.id)

    // Create new array with updated positions
    const newMealPlans = [...mealPlans]
    
    // Remove dragged item from its current position
    const [removed] = newMealPlans.splice(draggedIndex, 1)
    
    // Insert at new position
    newMealPlans.splice(targetIndex, 0, removed)

    // Assign new order values based on array position
    const reorderedPlans = newMealPlans.map((mp, index) => ({
      ...mp,
      order: index + 1
    }))

    // Update local state immediately for fast UI response
    setMealPlans(reorderedPlans)
    setDraggedItem(null)

    try {
      // Update all items with their new order in the database
      const updatePromises = reorderedPlans.map((mp) => 
        mealPlansService.update(mp.id, { order: mp.order })
      )

      await Promise.all(updatePromises)

      toast({
        title: "Success",
        description: "Meal plan order updated successfully.",
      })
    } catch (error) {
      console.error("Error reordering meal plans:", error)
      toast({
        title: "Error",
        description: "Failed to reorder meal plans. Reverting changes.",
        variant: "destructive",
      })
      // Revert to original state on error
      await fetchMealPlans()
    } finally {
      setReorderingId(null)
    }
  }

  const handleAdd = async (data: Omit<MealPlan, "id" | "createdAt" | "updatedAt">) => {
    // Check if meal plan with same name already exists
    const existingMealPlan = mealPlans.find(
      (plan) => plan.name.toLowerCase().trim() === data.name.toLowerCase().trim()
    )

    if (existingMealPlan) {
      toast({
        title: "Duplicate Meal Plan",
        description: `A meal plan named "${data.name}" already exists. Please use a different name.`,
        variant: "destructive",
      })
      return
    }

    // Check if order is already used
    if (data.order) {
      const existingOrder = mealPlans.find((plan) => plan.order === data.order)
      if (existingOrder) {
        toast({
          title: "Duplicate Order",
          description: `Order ${data.order} is already used by "${existingOrder.name}". Please choose a different order.`,
          variant: "destructive",
        })
        return
      }
    }

    setIsAdding(true)
    try {
      await mealPlansService.add(data)
      await fetchMealPlans()
      toast({
        title: "Success",
        description: "Meal plan added successfully.",
      })
    } catch (error) {
      console.error("Error adding meal plan:", error)
      toast({
        title: "Error",
        description: "Failed to add meal plan. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsAdding(false)
    }
  }

  const handleUpdate = async (id: string, data: Partial<Omit<MealPlan, "id" | "createdAt">>) => {
    // Check if updating name to an existing name (excluding current item)
    if (data.name) {
      const existingMealPlan = mealPlans.find(
        (plan) => 
          plan.id !== id && 
          plan.name.toLowerCase().trim() === data.name?.toLowerCase().trim()
      )

      if (existingMealPlan) {
        toast({
          title: "Duplicate Meal Plan",
          description: `A meal plan named "${data.name}" already exists. Please use a different name.`,
          variant: "destructive",
        })
        return
      }
    }

    // Check if order is already used (excluding current item)
    if (data.order !== undefined) {
      const existingOrder = mealPlans.find(
        (plan) => plan.id !== id && plan.order === data.order
      )
      if (existingOrder) {
        toast({
          title: "Duplicate Order",
          description: `Order ${data.order} is already used by "${existingOrder.name}". Please choose a different order.`,
          variant: "destructive",
        })
        return
      }
    }

    setIsEditing(true)
    try {
      await mealPlansService.update(id, data)
      await fetchMealPlans()
      toast({
        title: "Success",
        description: "Meal plan updated successfully.",
      })
    } catch (error) {
      console.error("Error updating meal plan:", error)
      toast({
        title: "Error",
        description: "Failed to update meal plan. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsEditing(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingIds((prev) => new Set(prev).add(id))
    try {
      await mealPlansService.delete(id)
      await fetchMealPlans()
      toast({
        title: "Success",
        description: "Meal plan deleted successfully.",
      })
    } catch (error) {
      console.error("Error deleting meal plan:", error)
      toast({
        title: "Error",
        description: "Failed to delete meal plan. Please try again.",
        variant: "destructive",
      })
    } finally {
      setDeletingIds((prev) => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }
  }

  const handleBulkDelete = async (ids: string[]) => {
    setDeletingIds((prev) => {
      const newSet = new Set(prev)
      ids.forEach((id) => newSet.add(id))
      return newSet
    })

    try {
      // Delete all selected meal plans
      await Promise.all(ids.map((id) => mealPlansService.delete(id)))
      await fetchMealPlans()
      toast({
        title: "Success",
        description: `${ids.length} meal plan${ids.length > 1 ? 's' : ''} deleted successfully.`,
      })
    } catch (error) {
      console.error("Error bulk deleting meal plans:", error)
      toast({
        title: "Error",
        description: "Failed to delete selected meal plans. Please try again.",
        variant: "destructive",
      })
    } finally {
      setDeletingIds((prev) => {
        const newSet = new Set(prev)
        ids.forEach((id) => newSet.delete(id))
        return newSet
      })
    }
  }

  const columns = [
    { key: "order", label: "Order" },
    { key: "name", label: "Name" },
    { key: "description", label: "Description" },
    { key: "status", label: "Status" },
  ]

  const formFields = [
    { 
      name: "order", 
      label: "Display Order", 
      type: "number" as const, 
      required: true,
      placeholder: "e.g., 1, 2, 3..."
    },
    { name: "name", label: "Name", type: "text" as const, required: true },
    { name: "description", label: "Description", type: "text" as const },
    {
      name: "status",
      label: "Status",
      type: "select" as const,
      required: true,
      options: [
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
      ],
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading meal plans...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Tip:</strong> Drag and drop meal plans using the grip icon to reorder them. 
          The order determines the display sequence in the combined menu.
        </p>
      </div>

      {/* Drag and Drop Visual Order */}
      <Card>
        <CardHeader>
          <CardTitle>Meal Plans Order (Drag to Reorder)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {mealPlans.map((mealPlan) => (
              <div
                key={mealPlan.id}
                draggable={!reorderingId}
                onDragStart={(e) => handleDragStart(e, mealPlan)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, mealPlan)}
                className={`
                  flex items-center gap-3 p-4 bg-white border rounded-lg
                  transition-all duration-200
                  ${!reorderingId ? 'cursor-move hover:shadow-md hover:border-blue-300' : 'cursor-not-allowed'}
                  ${draggedItem?.id === mealPlan.id ? 'opacity-50 scale-95' : ''}
                  ${reorderingId === mealPlan.id ? 'border-blue-500 bg-blue-50' : ''}
                `}
              >
                {reorderingId === mealPlan.id ? (
                  <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                ) : (
                  <GripVertical className="h-5 w-5 text-gray-400" />
                )}
                
                <div className="flex items-center gap-3 flex-1">
                  <Badge variant="secondary" className="font-mono">
                    #{mealPlan.order}
                  </Badge>
                  
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{mealPlan.name}</h3>
                    {mealPlan.description && (
                      <p className="text-sm text-gray-600">{mealPlan.description}</p>
                    )}
                  </div>
                  
                  <Badge variant={mealPlan.status === 'active' ? 'default' : 'outline'}>
                    {mealPlan.status}
                  </Badge>
                </div>

                {reorderingId === mealPlan.id && (
                  <span className="text-xs text-blue-600 font-medium">
                    Saving...
                  </span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Original CRUD Table */}
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
    </div>
  )
}