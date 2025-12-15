"use client"

import { useState, useEffect, useCallback, useMemo, memo, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Save, X, Maximize2, Search, Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { collection, addDoc, getDocs, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import {
  servicesService,
  mealPlansService,
  subMealPlansService,
  companiesService,
  buildingsService,
  structureAssignmentsService,
  mealPlanStructureAssignmentsService,
  type Service,
  type MealPlan,
  type SubMealPlan,
} from "@/lib/firestore"

interface MenuItem {
  id: string
  name: string
  category?: string
  order?: number
}

interface MenuCell {
  menuItemIds: string[]
}

interface DayMenu {
  [serviceId: string]: {
    [mealPlanId: string]: {
      [subMealPlanId: string]: MenuCell
    }
  }
}

interface CombinedMenuData {
  [date: string]: DayMenu
}

const menuItemsService = {
  async getAll(): Promise<MenuItem[]> {
    const snapshot = await getDocs(collection(db, "menuItems"))
    return snapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        }) as MenuItem,
    )
  },
}

const combinedMenusService = {
  async add(data: any) {
    const docRef = await addDoc(collection(db, "combinedMenus"), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return { id: docRef.id }
  },
}

const companyMenusService = {
  async add(data: any) {
    await addDoc(collection(db, "companyMenus"), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  },
}

const MenuGridCell = memo(
  function MenuGridCell({
    date,
    service,
    mealPlan,
    subMealPlan,
    selectedMenuItemIds,
    allMenuItems,
    searchTerm,
    onAddItem,
    onRemoveItem,
    onSearchChange,
    onSearchClear,
  }: {
    date: string
    service: Service
    mealPlan: MealPlan
    subMealPlan: SubMealPlan
    selectedMenuItemIds: string[]
    allMenuItems: MenuItem[]
    searchTerm: string
    onAddItem: (menuItemId: string) => void
    onRemoveItem: (menuItemId: string) => void
    onSearchChange: (value: string) => void
    onSearchClear: () => void
  }) {
    const availableItems = useMemo(() => {
      let filtered = allMenuItems.filter((item) => !selectedMenuItemIds.includes(item.id))

      if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase()
        filtered = filtered.filter(
          (item) => item.name.toLowerCase().includes(lowerSearch) || item.category?.toLowerCase().includes(lowerSearch),
        )
      }

      return filtered
    }, [allMenuItems, selectedMenuItemIds, searchTerm])

    return (
      <td className="border p-2 align-top">
        <div className="space-y-2">
          {/* Selected Items */}
          <div className="space-y-1 min-h-[60px]">
            {selectedMenuItemIds.map((menuItemId) => {
              const menuItem = allMenuItems.find((mi) => mi.id === menuItemId)
              return menuItem ? (
                <div
                  key={menuItemId}
                  className="flex items-center justify-between bg-green-50 border border-green-200 p-2 rounded text-sm"
                >
                  <span className="flex-1">{menuItem.name}</span>
                  <button onClick={() => onRemoveItem(menuItemId)} className="text-red-500 hover:text-red-700 ml-2">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null
            })}
          </div>

          {/* Add Item Dropdown with Search */}
          <Select
            onValueChange={(value) => {
              onAddItem(value)
              onSearchClear()
            }}
            value=""
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="+ Add menu item" />
            </SelectTrigger>
            <SelectContent className="max-h-[400px]">
              {/* Search Input Inside Dropdown */}
              <div className="sticky top-0 bg-white p-2 border-b z-50">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search menu items..."
                    value={searchTerm}
                    onChange={(e) => {
                      e.stopPropagation()
                      onSearchChange(e.target.value)
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="pl-8 text-sm"
                  />
                </div>
              </div>

              {/* Menu Items List */}
              <div className="max-h-[300px] overflow-y-auto">
                {availableItems.length > 0 ? (
                  availableItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{item.name}</span>
                        {item.category && <span className="text-xs text-gray-500 ml-2">({item.category})</span>}
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <div className="p-4 text-sm text-gray-500 text-center">
                    {searchTerm ? "No items match your search" : "No items available"}
                  </div>
                )}
              </div>
            </SelectContent>
          </Select>
        </div>
      </td>
    )
  },
  (prevProps, nextProps) => {
    return (
      prevProps.selectedMenuItemIds === nextProps.selectedMenuItemIds &&
      prevProps.searchTerm === nextProps.searchTerm &&
      prevProps.date === nextProps.date &&
      prevProps.service.id === nextProps.service.id &&
      prevProps.mealPlan.id === nextProps.mealPlan.id &&
      prevProps.subMealPlan.id === nextProps.subMealPlan.id
    )
  },
)

export default function CombinedMenuCreationPage() {
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [dateRange, setDateRange] = useState<Array<{ date: string; day: string }>>([])

  const [services, setServices] = useState<Service[]>([])
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([])
  const [subMealPlans, setSubMealPlans] = useState<SubMealPlan[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])

  const [combinedMenu, setCombinedMenu] = useState<CombinedMenuData>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generatingGrid, setGeneratingGrid] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [searchTerms, setSearchTerms] = useState<{ [key: string]: string }>({})
  const [, startTransition] = useTransition()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [servicesData, mealPlansData, subMealPlansData, menuItemsData] = await Promise.all([
        servicesService.getAll(),
        mealPlansService.getAll(),
        subMealPlansService.getAll(),
        menuItemsService.getAll(),
      ])

      const activeServices = servicesData
        .filter((s: any) => s.status === "active")
        .sort((a: any, b: any) => (a.order || 999) - (b.order || 999))

      const activeMealPlans = mealPlansData
        .filter((mp: any) => mp.status === "active")
        .sort((a: any, b: any) => (a.order || 999) - (b.order || 999))

      const activeSubMealPlans = subMealPlansData
        .filter((smp: any) => smp.status === "active")
        .sort((a: any, b: any) => (a.order || 999) - (b.order || 999))

      const activeMenuItems = menuItemsData
        .filter((mi: any) => mi.status === "active")
        .sort((a: any, b: any) => (a.order || 999) - (b.order || 999))

      setServices(activeServices)
      setMealPlans(activeMealPlans)
      setSubMealPlans(activeSubMealPlans)
      setMenuItems(activeMenuItems)
    } catch (error) {
      console.error("Error loading data:", error)
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const generateDateRange = () => {
    if (!startDate || !endDate) {
      toast({
        title: "Validation Error",
        description: "Please select both start and end dates",
        variant: "destructive",
      })
      return
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (start > end) {
      toast({
        title: "Validation Error",
        description: "Start date must be before end date",
        variant: "destructive",
      })
      return
    }

    setGeneratingGrid(true)

    const idleCallbackId = requestIdleCallback(
      () => {
        const dates: Array<{ date: string; day: string }> = []
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

        const current = new Date(start)
        while (current <= end) {
          dates.push({
            date: current.toISOString().split("T")[0],
            day: days[current.getDay()],
          })
          current.setDate(current.getDate() + 1)
        }

        const initialMenu: CombinedMenuData = {}
        dates.forEach(({ date }) => {
          initialMenu[date] = {}
          services.forEach((service) => {
            initialMenu[date][service.id] = {}
            mealPlans.forEach((mealPlan) => {
              initialMenu[date][service.id][mealPlan.id] = {}
              const relatedSubMealPlans = subMealPlans.filter((smp) => smp.mealPlanId === mealPlan.id)
              relatedSubMealPlans.forEach((subMealPlan) => {
                initialMenu[date][service.id][mealPlan.id][subMealPlan.id] = {
                  menuItemIds: [],
                }
              })
            })
          })
        })

        setDateRange(dates)
        setCombinedMenu(initialMenu)
        setGeneratingGrid(false)
        setShowModal(true)
      },
      { timeout: 2000 },
    )

    return () => cancelIdleCallback(idleCallbackId)
  }

  const addMenuItemToCell = useCallback(
    (date: string, serviceId: string, mealPlanId: string, subMealPlanId: string, menuItemId: string) => {
      setCombinedMenu((prev) => {
        const newMenu = { ...prev }
        if (!newMenu[date]) newMenu[date] = {}
        if (!newMenu[date][serviceId]) newMenu[date][serviceId] = {}
        if (!newMenu[date][serviceId][mealPlanId]) newMenu[date][serviceId][mealPlanId] = {}
        if (!newMenu[date][serviceId][mealPlanId][subMealPlanId]) {
          newMenu[date][serviceId][mealPlanId][subMealPlanId] = { menuItemIds: [] }
        }

        const existingIds = newMenu[date][serviceId][mealPlanId][subMealPlanId].menuItemIds
        if (existingIds.includes(menuItemId)) {
          return prev
        }

        newMenu[date][serviceId][mealPlanId][subMealPlanId] = {
          menuItemIds: [...existingIds, menuItemId],
        }

        return newMenu
      })
    },
    [],
  )

  const removeMenuItemFromCell = useCallback(
    (date: string, serviceId: string, mealPlanId: string, subMealPlanId: string, menuItemId: string) => {
      setCombinedMenu((prev) => {
        const newMenu = { ...prev }
        if (newMenu[date]?.[serviceId]?.[mealPlanId]?.[subMealPlanId]) {
          newMenu[date][serviceId][mealPlanId][subMealPlanId] = {
            menuItemIds: newMenu[date][serviceId][mealPlanId][subMealPlanId].menuItemIds.filter(
              (id) => id !== menuItemId,
            ),
          }
        }
        return newMenu
      })
    },
    [],
  )

  const handleSaveCombinedMenu = async () => {
    try {
      setSaving(true)

      const combinedMenuData = {
        startDate,
        endDate,
        menuData: combinedMenu,
        status: "active",
      }

      const savedMenu = await combinedMenusService.add(combinedMenuData)
      await generateCompanyMenus(savedMenu.id)

      toast({
        title: "Success",
        description: "Combined menu saved and company menus generated successfully",
      })

      setShowModal(false)
      setStartDate("")
      setEndDate("")
      setDateRange([])
      setCombinedMenu({})
      setSearchTerms({})
    } catch (error) {
      console.error("Error saving combined menu:", error)
      toast({
        title: "Error",
        description: "Failed to save combined menu",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const generateCompanyMenus = async (combinedMenuId: string) => {
    try {
      const [companies, buildings, structureAssignments, mealPlanStructureAssignments] = await Promise.all([
        companiesService.getAll(),
        buildingsService.getAll(),
        structureAssignmentsService.getAll(),
        mealPlanStructureAssignmentsService.getAll(),
      ])

      const activeCompanies = companies.filter((c: any) => c.status === "active")

      for (const company of activeCompanies) {
        const companyBuildings = buildings.filter((b: any) => b.companyId === company.id && b.status === "active")

        for (const building of companyBuildings) {
          const structureAssignment = structureAssignments.find(
            (sa: any) => sa.companyId === company.id && sa.buildingId === building.id && sa.status === "active",
          )

          const mealPlanStructure = mealPlanStructureAssignments.find(
            (mpsa: any) => mpsa.companyId === company.id && mpsa.buildingId === building.id && mpsa.status === "active",
          )

          if (structureAssignment && mealPlanStructure) {
            const companyMenu = buildCompanyMenu(
              company,
              building,
              structureAssignment,
              mealPlanStructure,
              combinedMenu,
              dateRange,
            )

            await companyMenusService.add({
              ...companyMenu,
              combinedMenuId,
              status: "active",
            })
          }
        }
      }
    } catch (error) {
      console.error("Error generating company menus:", error)
      throw error
    }
  }

  const buildCompanyMenu = (
    company: any,
    building: any,
    structureAssignment: any,
    mealPlanStructure: any,
    combinedMenu: CombinedMenuData,
    dateRange: Array<{ date: string; day: string }>,
  ) => {
    const companyMenuData: any = {}

    dateRange.forEach(({ date, day }) => {
      const dayKey = day.toLowerCase()

      const dayServices = structureAssignment.weekStructure[dayKey] || []
      const dayMealPlanStructure = mealPlanStructure.weekStructure[dayKey] || []

      companyMenuData[date] = {}

      dayServices.forEach((service: any) => {
        const serviceId = service.serviceId

        const serviceMealPlanStructure = dayMealPlanStructure.find((s: any) => s.serviceId === serviceId)

        if (serviceMealPlanStructure && combinedMenu[date]?.[serviceId]) {
          companyMenuData[date][serviceId] = {}

          serviceMealPlanStructure.subServices.forEach((subService: any) => {
            subService.mealPlans.forEach((mealPlan: any) => {
              const mealPlanId = mealPlan.mealPlanId

              if (combinedMenu[date][serviceId][mealPlanId]) {
                companyMenuData[date][serviceId][mealPlanId] = {}

                mealPlan.subMealPlans.forEach((subMealPlan: any) => {
                  const subMealPlanId = subMealPlan.subMealPlanId

                  if (combinedMenu[date][serviceId][mealPlanId][subMealPlanId]) {
                    companyMenuData[date][serviceId][mealPlanId][subMealPlanId] = {
                      ...combinedMenu[date][serviceId][mealPlanId][subMealPlanId],
                    }
                  }
                })
              }
            })
          })
        }
      })
    })

    return {
      companyId: company.id,
      buildingId: building.id,
      companyName: company.name,
      buildingName: building.name,
      startDate: dateRange[0].date,
      endDate: dateRange[dateRange.length - 1].date,
      menuData: companyMenuData,
    }
  }

  const setSearchTerm = useCallback(
    (date: string, serviceId: string, mealPlanId: string, subMealPlanId: string, value: string) => {
      const cellKey = `${date}-${serviceId}-${mealPlanId}-${subMealPlanId}`
      setSearchTerms((prev) => ({
        ...prev,
        [cellKey]: value,
      }))
    },
    [],
  )

  const clearSearchTerm = useCallback((date: string, serviceId: string, mealPlanId: string, subMealPlanId: string) => {
    const cellKey = `${date}-${serviceId}-${mealPlanId}-${subMealPlanId}`
    setSearchTerms((prev) => {
      const newTerms = { ...prev }
      delete newTerms[cellKey]
      return newTerms
    })
  }, [])

  const mealPlanStructure = useMemo(() => {
    return mealPlans.map((mealPlan) => ({
      mealPlan,
      subMealPlans: subMealPlans.filter((smp) => smp.mealPlanId === mealPlan.id),
    }))
  }, [mealPlans, subMealPlans])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <div className="text-lg font-medium">Loading data...</div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Combined Menu Creation</h1>
            <p className="text-gray-600">Create master menu that will generate company-specific menus</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Select Date Range
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>

              <div className="flex items-end">
                <Button onClick={generateDateRange} disabled={generatingGrid} className="w-full">
                  {generatingGrid ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating Grid...
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-4 w-4 mr-2" />
                      Open Menu Grid
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Full Screen Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full h-full flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b bg-gray-50">
              <div>
                <h2 className="text-xl font-bold">Combined Menu Grid</h2>
                <p className="text-sm text-gray-600">
                  {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveCombinedMenu} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save & Generate Company Menus
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setShowModal(false)} disabled={saving}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto p-4">
              {services.map((service) => (
                <div key={service.id} className="mb-8">
                  <h2 className="text-xl font-bold mb-4 bg-black text-white p-3 rounded">{service.name}</h2>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className="border bg-gray-100 p-2 sticky left-0 z-20 min-w-[200px]">
                            Meal Plan / Sub Meal
                          </th>
                          {dateRange.map(({ date, day }) => (
                            <th key={date} className="border bg-gray-100 p-2 min-w-[250px]">
                              <div className="font-semibold">
                                {new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </div>
                              <div className="text-sm text-gray-600 font-normal">{day}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {mealPlanStructure.map(({ mealPlan, subMealPlans: relatedSubMealPlans }) => {
                          return relatedSubMealPlans.map((subMealPlan, idx) => (
                            <tr key={`${mealPlan.id}-${subMealPlan.id}`}>
                              <td className="border bg-gray-50 p-2 sticky left-0 z-10">
                                {idx === 0 && <div className="font-semibold text-blue-700">{mealPlan.name}</div>}
                                <div className="text-sm text-gray-700 ml-3">↳ {subMealPlan.name}</div>
                              </td>

                              {dateRange.map(({ date }) => {
                                const cell = combinedMenu[date]?.[service.id]?.[mealPlan.id]?.[subMealPlan.id]
                                const selectedMenuItemIds = cell?.menuItemIds || []
                                const searchTerm =
                                  searchTerms[`${date}-${service.id}-${mealPlan.id}-${subMealPlan.id}`] || ""

                                return (
                                  <MenuGridCell
                                    key={`${date}-${service.id}-${mealPlan.id}-${subMealPlan.id}`}
                                    date={date}
                                    service={service}
                                    mealPlan={mealPlan}
                                    subMealPlan={subMealPlan}
                                    selectedMenuItemIds={selectedMenuItemIds}
                                    allMenuItems={menuItems}
                                    searchTerm={searchTerm}
                                    onAddItem={(menuItemId) =>
                                      addMenuItemToCell(date, service.id, mealPlan.id, subMealPlan.id, menuItemId)
                                    }
                                    onRemoveItem={(menuItemId) =>
                                      removeMenuItemFromCell(date, service.id, mealPlan.id, subMealPlan.id, menuItemId)
                                    }
                                    onSearchChange={(value) =>
                                      setSearchTerm(date, service.id, mealPlan.id, subMealPlan.id, value)
                                    }
                                    onSearchClear={() => clearSearchTerm(date, service.id, mealPlan.id, subMealPlan.id)}
                                  />
                                )
                              })}
                            </tr>
                          ))
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
