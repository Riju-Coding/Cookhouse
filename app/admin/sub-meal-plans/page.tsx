"use client"

import { useState, useEffect, useMemo } from "react"
import { CrudTable } from "@/components/admin/crud-table"
import { 
  subMealPlansService, 
  mealPlansService, 
  menuItemsService, 
  type SubMealPlan, 
  type MealPlan,
  type MenuItem     
} from "@/lib/firestore"
import { toast } from "@/hooks/use-toast"

export default function SubMealPlansPage() {
  const [subMealPlans, setSubMealPlans] = useState<SubMealPlan[]>([])
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([])
  const [loading, setLoading] = useState(true)

  const [allMenuItems, setAllMenuItems] = useState<MenuItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)
  const CHUNK_SIZE = 15

  const fetchData = async () => {
    try {
      const [subMealPlansData, mealPlansData, menuItemsData] = await Promise.all([
        subMealPlansService.getAll(),
        mealPlansService.getAll(),
        menuItemsService.getAll(), 
      ])

      setAllMenuItems(menuItemsData)

      const enrichedSubMealPlans = subMealPlansData.map((subMealPlan) => {
        let defaultItemName = "None"
        
        // Handles showing multiple selected items in the main table list
        if (Array.isArray(subMealPlan.defaultItemId)) {
          defaultItemName = subMealPlan.defaultItemId
            .map((id: string) => menuItemsData.find(m => m.id === id)?.name || "Unknown")
            .join(", ")
        } else if (subMealPlan.defaultItemId) {
          defaultItemName = menuItemsData.find(m => m.id === subMealPlan.defaultItemId)?.name || "Unknown"
        }

        return {
          ...subMealPlan,
          mealPlanName: mealPlansData.find((mp) => mp.id === subMealPlan.mealPlanId)?.name || "Unknown",
          isRepeatPlan: subMealPlan.isRepeatPlan ?? false, 
          defaultItemName
        }
      })

      setSubMealPlans(enrichedSubMealPlans)
      setMealPlans(mealPlansData)
    } catch (error) {
      console.error("Error fetching data:", error)
      toast({ title: "Error", description: "Failed to fetch data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const filteredMenu = useMemo(() => {
    if (!searchQuery) return allMenuItems;
    return allMenuItems.filter(item => 
      item.name?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [allMenuItems, searchQuery])

  const paginatedMenu = useMemo(() => {
    return filteredMenu.slice(0, page * CHUNK_SIZE)
  }, [filteredMenu, page])

  const hasMore = page * CHUNK_SIZE < filteredMenu.length

  const handleMenuSearch = (query: string) => {
    setSearchQuery(query)
    setPage(1)
  }

  const handleMenuLoadMore = () => {
    setPage(prev => prev + 1)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleAdd = async (data: any) => {
    try {
      const payload = { ...data, isRepeatPlan: !!data.isRepeatPlan }
      if (!payload.isRepeatPlan) delete payload.defaultItemId

      await subMealPlansService.add(payload)
      await fetchData()
      toast({ title: "Success", description: "Sub meal plan added successfully" })
    } catch (error) {
      console.error("Error adding sub meal plan:", error)
      toast({ title: "Error", description: "Failed to add sub meal plan", variant: "destructive" })
    }
  }

  const handleUpdate = async (id: string, data: any) => {
    try {
      const payload = { ...data, isRepeatPlan: !!data.isRepeatPlan }
      if (!payload.isRepeatPlan) payload.defaultItemId = null

      await subMealPlansService.update(id, payload)
      await fetchData()
      toast({ title: "Success", description: "Sub meal plan updated successfully" })
    } catch (error) {
      console.error("Error updating sub meal plan:", error)
      toast({ title: "Error", description: "Failed to update sub meal plan", variant: "destructive" })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await subMealPlansService.delete(id)
      await fetchData()
      toast({ title: "Success", description: "Sub meal plan deleted successfully" })
    } catch (error) {
      console.error("Error deleting sub meal plan:", error)
      toast({ title: "Error", description: "Failed to delete sub meal plan", variant: "destructive" })
    }
  }

  const columns = [
    { key: "name", label: "Name" },
    { key: "mealPlanName", label: "Meal Plan" },
    { key: "description", label: "Description" },
    { key: "isRepeatPlan", label: "Repeat Plan", render: (value: boolean) => (value ? "Yes" : "No") },
    { key: "defaultItemName", label: "Default Item(s)" },
    { key: "status", label: "Status" },
  ]

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
    {
      name: "isRepeatPlan",
      label: "Mark as a repeat plan",
      type: "switch" as const,
      required: false,
    },
    {
      name: "defaultItemId",
      label: "Default Menu Item",
      type: "searchable-select" as const, 
      required: false,
      
      isMulti: true, // <--- ENABLED MULTI SELECT

      options: paginatedMenu.map((item) => ({ value: item.id, label: item.name })),
      
      // Updates to return an array of objects for the Chips (Tags) in multi-select mode
      getSelectedLabel: (val: any) => {
        if (!val) return []
        if (Array.isArray(val)) {
          return val.map(v => ({
            value: v,
            label: allMenuItems.find(m => m.id === v)?.name || v
          }))
        }
        return allMenuItems.find(m => m.id === val)?.name || "Select an option..."
      },

      onSearch: handleMenuSearch,
      onLoadMore: handleMenuLoadMore,
      hasMore: hasMore,
      showIf: (values: any) => values.isRepeatPlan === true
    },
  ]

  if (loading) return <div className="p-6">Loading...</div>

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