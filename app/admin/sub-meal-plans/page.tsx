"use client"

import { useState, useEffect } from "react"
import { CrudTable } from "@/components/admin/crud-table"
import { subMealPlansService, mealPlansService, type SubMealPlan, type MealPlan } from "@/lib/firestore"
import { toast } from "@/hooks/use-toast"

export default function SubMealPlansPage() {
  const [subMealPlans, setSubMealPlans] = useState<SubMealPlan[]>([])
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    try {
      const [subMealPlansData, mealPlansData] = await Promise.all([
        subMealPlansService.getAll(),
        mealPlansService.getAll(),
      ])

      // Add meal plan names and ensure boolean flags exist
      const enrichedSubMealPlans = subMealPlansData.map((subMealPlan) => ({
        ...subMealPlan,
        mealPlanName: mealPlansData.find((mp) => mp.id === subMealPlan.mealPlanId)?.name || "Unknown",
        // Force boolean for the toggle to work correctly
        isRepeatPlan: subMealPlan.isRepeatPlan ?? false, 
      }))

      setSubMealPlans(enrichedSubMealPlans)
      setMealPlans(mealPlansData)
    } catch (error) {
      console.error("Error fetching data:", error)
      toast({
        title: "Error",
        description: "Failed to fetch data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleAdd = async (data: any) => {
    try {
      // Ensure the toggle value is saved as a boolean
      const payload = {
        ...data,
        isRepeatPlan: !!data.isRepeatPlan // Convert to true/false
      }

      await subMealPlansService.add(payload)
      await fetchData()
      toast({
        title: "Success",
        description: "Sub meal plan added successfully",
      })
    } catch (error) {
      console.error("Error adding sub meal plan:", error)
      toast({
        title: "Error",
        description: "Failed to add sub meal plan",
        variant: "destructive",
      })
    }
  }

  const handleUpdate = async (id: string, data: any) => {
    try {
      await subMealPlansService.update(id, data)
      await fetchData()
      toast({
        title: "Success",
        description: "Sub meal plan updated successfully",
      })
    } catch (error) {
      console.error("Error updating sub meal plan:", error)
      toast({
        title: "Error",
        description: "Failed to update sub meal plan",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await subMealPlansService.delete(id)
      await fetchData()
      toast({
        title: "Success",
        description: "Sub meal plan deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting sub meal plan:", error)
      toast({
        title: "Error",
        description: "Failed to delete sub meal plan",
        variant: "destructive",
      })
    }
  }

  // Define Columns
  const columns = [
    { key: "name", label: "Name" },
    { key: "mealPlanName", label: "Meal Plan" },
    { key: "description", label: "Description" },
    { 
      key: "isRepeatPlan", 
      label: "Repeat Plan",
      // Render "Yes" or "No" in the table list
    render: (value: boolean) => (value ? "Yes" : "No") // <--- Change to "render"
    },
    { key: "status", label: "Status" },
  ]

  // Define Form Fields
  const formFields = [
    { name: "name", label: "Name", type: "text" as const, required: true },
    {
      name: "mealPlanId",
      label: "Meal Plan",
      type: "select" as const,
      required: true,
      options: mealPlans.map((mp) => ({ value: mp.id, label: mp.name })),
    },
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
    // The Toggle Field
    {
      name: "isRepeatPlan",
      label: "Mark as a repeat plan",
      type: "switch" as const, // Requires the update in CrudTable.tsx
      required: false,
    },
  ]

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  return (
    <div className="p-6">
      <CrudTable
        title="Sub Meal Plans"
        data={subMealPlans}
        columns={columns}
        formFields={formFields}
        onAdd={handleAdd}
        onEdit={handleUpdate} 
        onDelete={handleDelete}
      />
    </div>
  )
}