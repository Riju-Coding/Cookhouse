"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { doc, getDoc, getDocs, collection, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Service, MealPlan, SubMealPlan, MenuItem, MenuUpdation } from "@/lib/types"
import { servicesService, mealPlansService, subMealPlansService, menuItemsService } from "@/lib/services"
import { toast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation" 
import { Input } from "@/components/ui/input" 
import { Loader2, Download, X, History, Edit, Search } from 'lucide-react'

interface MenuViewModalProps {
  isOpen: boolean
  onClose: () => void
  menuId: string
  menuType: "combined" | "company"
  preloadedMenuItems?: MenuItem[]
}

interface MenuData {
  startDate: string
  endDate: string
  status: string
  menuData?: any
  companyName?: string
  buildingName?: string
  companyId?: string
  buildingId?: string
  [key: string]: any
}

export function MenuViewModal({ isOpen, onClose, menuId, menuType, preloadedMenuItems }: MenuViewModalProps) {
  const router = useRouter() 
  const [menu, setMenu] = useState<MenuData | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  
  const [services, setServices] = useState<Service[]>([])
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([])
  const [subMealPlans, setSubMealPlans] = useState<SubMealPlan[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>(preloadedMenuItems || [])
  const [dateRange, setDateRange] = useState<Array<{ date: string; day: string }>>([])
  const [menuItemsLoaded, setMenuItemsLoaded] = useState(!!preloadedMenuItems && preloadedMenuItems.length > 0)
  const [structureAssignment, setStructureAssignment] = useState<any | null>(null)
  const [foundMealPlanStructure, setFoundMealPlanStructure] = useState<any | null>(null)
  
  const [updations, setUpdations] = useState<MenuUpdation[]>([])
  const [selectedUpdation, setSelectedUpdation] = useState<MenuUpdation | null>(null)

  useEffect(() => {
    if (isOpen && menuId) {
      loadMenu()
      loadUpdations()
    } else {
      setMenu(null)
      setUpdations([])
      setSelectedUpdation(null)
      setSearchQuery("") // Reset search on close
    }
  }, [isOpen, menuId])

  const loadUpdations = async () => {
    try {
      setUpdations([])
      setSelectedUpdation(null)

      const q = query(collection(db, "updations"), where("menuId", "==", menuId))
      const snapshot = await getDocs(q)

      const data = snapshot.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as any),
          createdAt: (d.data() as any).createdAt?.toDate?.() || new Date((d.data() as any).createdAt),
        }))
        .filter((record: any) => {
          if (Array.isArray(record.changedCells) && record.changedCells.length > 0) return true
          if (typeof record.totalChanges === "number" && record.totalChanges > 0) return true
          if (record.changedCells && typeof record.changedCells === "object" && Object.keys(record.changedCells).length > 0) return true
          return false
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) as MenuUpdation[]

      setUpdations(data)

      if (data.length > 0) {
        setSelectedUpdation(data[0])
      } else {
        setSelectedUpdation(null)
      }
    } catch (error) {
      console.error("Error loading updations:", error)
      setUpdations([])
      setSelectedUpdation(null)
    }
  }

   const handleEdit = () => {
    onClose(); 
    if (menuType === "combined") {
      router.push(`/admin/menus/combined/${menuId}/edit`); 
    } else {
      router.push(`/admin/menus/company/${menuId}/edit`); 
    }
  }

  const loadMenu = async () => {
    try {
      setLoading(true)
      const collectionName = menuType === "combined" ? "combinedMenus" : "companyMenus"
      const docRef = doc(db, collectionName, menuId)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        const data = docSnap.data() as MenuData
        setMenu(data)

        const [servicesData, mealPlansData, subMealPlansData] = await Promise.all([
          servicesService.getAll(),
          mealPlansService.getAll(),
          subMealPlansService.getAll(),
        ])

        let filteredServices = servicesData
          .filter((s: any) => s.status === "active")
          .sort((a: any, b: any) => (a.order || 999) - (b.order || 999))
        let filteredMealPlans = mealPlansData
          .filter((mp: any) => mp.status === "active")
          .sort((a: any, b: any) => (a.order || 999) - (b.order || 999))
        let filteredSubMealPlans = subMealPlansData
          .filter((smp: any) => smp.status === "active")
          .sort((a: any, b: any) => (a.order || 999) - (b.order || 999))

        if (menuType === "company" && data.companyId && data.buildingId) {
          const { structureAssignmentsService, mealPlanStructureAssignmentsService } = await import("@/lib/services")

          const [structureAssignments, mealPlanStructureAssignments] = await Promise.all([
            structureAssignmentsService.getAll(),
            mealPlanStructureAssignmentsService.getAll(),
          ])

          const foundStructureAssignment = structureAssignments.find(
            (sa: any) => sa.companyId === data.companyId && sa.buildingId === data.buildingId && sa.status === "active",
          )

          const mealPlanStructure = mealPlanStructureAssignments.find(
            (mpsa: any) =>
              mpsa.companyId === data.companyId && mpsa.buildingId === data.buildingId && mpsa.status === "active",
          )

          setStructureAssignment(foundStructureAssignment)
          setFoundMealPlanStructure(mealPlanStructure)

          if (foundStructureAssignment) {
            const serviceIds = new Set<string>()
            Object.values(foundStructureAssignment.weekStructure || {}).forEach((dayServices: any) => {
              dayServices.forEach((service: any) => {
                serviceIds.add(service.serviceId)
              })
            })
            filteredServices = filteredServices.filter((s) => serviceIds.has(s.id))
          }
          
          // Initial filter for Meal Plans and Sub Meal Plans (Global)
          // Note: We still do refined filtering per Service inside the render loop
          if (mealPlanStructure) {
            const mealPlanIds = new Set<string>()
            const subMealPlanIds = new Set<string>()
            
            Object.values(mealPlanStructure.weekStructure || {}).forEach((dayServices: any) => {
              dayServices.forEach((service: any) => {
                service.subServices?.forEach((subService: any) => {
                  subService.mealPlans?.forEach((mealPlan: any) => {
                    mealPlanIds.add(mealPlan.mealPlanId)
                    mealPlan.subMealPlans?.forEach((subMealPlan: any) => {
                      subMealPlanIds.add(subMealPlan.subMealPlanId)
                    })
                  })
                })
              })
            })

            filteredMealPlans = filteredMealPlans.filter((mp) => mealPlanIds.has(mp.id))
            filteredSubMealPlans = filteredSubMealPlans.filter((smp) => subMealPlanIds.has(smp.id))
          }
        }

        setServices(filteredServices)
        setMealPlans(filteredMealPlans)
        setSubMealPlans(filteredSubMealPlans)

        const start = new Date(data.startDate)
        const end = new Date(data.endDate)
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
        setDateRange(dates)

        if (!menuItemsLoaded && !preloadedMenuItems) {
          setTimeout(() => loadMenuItemsLazy(), 100)
        }
      }
    } catch (error) {
      console.error("Error loading menu:", error)
      toast({
        title: "Error",
        description: "Failed to load menu",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const loadMenuItemsLazy = async () => {
    if (menuItemsLoaded) return
    try {
      if (!menuItems.length) {
        const items = await menuItemsService.getAll()
        setMenuItems(items)
      }
      setMenuItemsLoaded(true)
    } catch (error) {
      console.error("Error loading menu items:", error)
    }
  }

  const handleDownloadXLSX = async () => {
    if (!menu) return

    try {
      if (menuItems.length === 0 && !menuItemsLoaded) {
        toast({
          title: "Loading",
          description: "Loading menu items...",
        })
        await loadMenuItemsLazy()
      }

      const ExcelJS = (await import("exceljs")).default
      const workbook = new ExcelJS.Workbook()

      services.forEach((service) => {
        const worksheet = workbook.addWorksheet(service.name.substring(0, 31))
        let currentRow = 1
        worksheet.addRow([`Menu - ${service.name}`])
        currentRow++
        if (menu.companyName) {
          worksheet.addRow([`Company: ${menu.companyName}`, `Building: ${menu.buildingName}`])
          currentRow++
        }
        worksheet.addRow([`Period: ${menu.startDate} to ${menu.endDate}`])
        currentRow++
        worksheet.addRow([])
        currentRow++

        const headers = ["Meal Plan", "Sub Meal Plan", ...dateRange.map((d) => d.date)]
        worksheet.addRow(headers)
        currentRow++

        // Filter for export as well
        const validMealPlans = getFilteredStructureForService(service.id)

        validMealPlans.forEach(({ mealPlan, subMealPlans: relatedSubMealPlans }) => {
          relatedSubMealPlans.forEach((subMealPlan, idx) => {
            const row: any[] = []
            row.push(idx === 0 ? mealPlan.name : "")
            row.push(subMealPlan.name)

            dateRange.forEach(({ date, day }) => {
              let allMenuItemIds: string[] = []

              if (menuType === "combined") {
                const svcBlock = menu?.menuData?.[date]?.[service.id] || {}
                Object.keys(svcBlock).forEach((subServiceId) => {
                  const subServiceData = svcBlock[subServiceId]?.[mealPlan.id]?.[subMealPlan.id]
                  if (subServiceData?.menuItemIds) {
                    allMenuItemIds.push(...subServiceData.menuItemIds)
                  }
                })
              } else {
                const subServicesForDay = structureAssignment?.weekStructure?.[day.toLowerCase()]?.find(
                  (s: any) => s.serviceId === service.id
                )?.subServices || []

                subServicesForDay.forEach((subService: any) => {
                  const cell = menu?.menuData?.[date]?.[service.id]?.[subService.subServiceId]?.[mealPlan.id]?.[subMealPlan.id]
                  if (cell?.menuItemIds && Array.isArray(cell.menuItemIds)) {
                    allMenuItemIds.push(...cell.menuItemIds)
                  }
                })
              }

              const uniqueItemIds = Array.from(new Map(allMenuItemIds.map((id, idx) => [id, idx])).entries())
                .sort((a, b) => a[1] - b[1])
                .map(([id]) => id)

              const itemNames = uniqueItemIds
                .map((id: string) => menuItems.find((mi) => mi.id === id)?.name || id)
                .join(", ")
              row.push(itemNames || "")
            })

            worksheet.addRow(row)
            currentRow++
          })
        })

        worksheet.columns.forEach((col) => {
          col.width = 25
        })
        worksheet.getRow(1).font = { bold: true, size: 14 }
        worksheet.getRow(6).font = { bold: true }
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `menu-${menuType}-${new Date().toISOString().split("T")[0]}.xlsx`
      link.click()
      window.URL.revokeObjectURL(url)

      toast({
        title: "Success",
        description: "Menu grid downloaded as XLSX",
      })
    } catch (error) {
      console.error("Error downloading XLSX:", error)
      toast({
        title: "Error",
        description: "Failed to download menu",
        variant: "destructive",
      })
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  // Basic structure mapping
  const mealPlanStructure = useMemo(() => {
    return mealPlans.map((mealPlan) => ({
      mealPlan,
      subMealPlans: subMealPlans.filter((smp) => smp.mealPlanId === mealPlan.id),
    }))
  }, [mealPlans, subMealPlans])

  // Helper to filter sub meal plans based on Structure Assignment for a specific Service
  const getFilteredStructureForService = (serviceId: string) => {
    return mealPlanStructure.map(({ mealPlan, subMealPlans }) => {
        // If combined, show all
        if (menuType === "combined") {
            return { mealPlan, subMealPlans };
        }

        // If company, verify assignment for THIS service
        if (!foundMealPlanStructure?.weekStructure) return { mealPlan, subMealPlans: [] };

        const allowedSubMealPlanIds = new Set<string>();

        // Check every day of the week
        Object.values(foundMealPlanStructure.weekStructure).forEach((dayServices: any) => {
            const serviceData = dayServices.find((s: any) => s.serviceId === serviceId);
            if (serviceData && serviceData.subServices) {
                serviceData.subServices.forEach((ss: any) => {
                    if (ss.mealPlans) {
                        const mpData = ss.mealPlans.find((mp: any) => mp.mealPlanId === mealPlan.id);
                        if (mpData && mpData.subMealPlans) {
                            mpData.subMealPlans.forEach((smp: any) => {
                                allowedSubMealPlanIds.add(smp.subMealPlanId);
                            });
                        }
                    }
                });
            }
        });

        const filteredSub = subMealPlans.filter(smp => allowedSubMealPlanIds.has(smp.id));
        return { mealPlan, subMealPlans: filteredSub };
    }).filter(group => group.subMealPlans.length > 0);
  };

  useEffect(() => {
    if (menu && menuItems.length === 0 && !menuItemsLoaded) {
      setTimeout(() => loadMenuItemsLazy(), 100)
    }
  }, [menu, menuItems.length, menuItemsLoaded])

  const getSelectedUpdationChangesForCell = (
    date: string,
    serviceId: string,
    mealPlanId: string,
    subMealPlanId: string
  ) => {
    if (!selectedUpdation || !selectedUpdation.changedCells) return []
    const matches: any[] = []
    for (const cell of selectedUpdation.changedCells) {
      if (
        cell.date === date &&
        cell.serviceId === serviceId &&
        cell.mealPlanId === mealPlanId &&
        cell.subMealPlanId === subMealPlanId
      ) {
        ;(cell.changes || []).forEach((ch: any) => matches.push(ch))
      }
    }
    return matches
  }

  const getItemName = (change: any) => {
    if (change.itemName) return change.itemName
    if (change.replacedWithName) return change.replacedWithName
    if (change.itemId) {
      const found = menuItems.find((mi) => mi.id === change.itemId)
      if (found) return found.name
    }
    if (change.replacedWith) {
      const found = menuItems.find((mi) => mi.id === change.replacedWith)
      if (found) return found.name
    }
    return ""
  }

  // --- Search Filtering Logic ---
  const shouldShowRow = (serviceId: string, mealPlanId: string, subMealPlan: SubMealPlan) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();

    // 1. Check Sub Meal Plan Name
    if (subMealPlan.name.toLowerCase().includes(query)) return true;

    // 2. Check Items inside the row across all dates
    for (const { date, day } of dateRange) {
      let allMenuItemIds: string[] = []
      
      if (menuType === "combined") {
        const svcBlock = menu?.menuData?.[date]?.[serviceId] || {}
        Object.keys(svcBlock).forEach((subServiceId) => {
          const subServiceData = svcBlock[subServiceId]?.[mealPlanId]?.[subMealPlan.id]
          if (subServiceData?.menuItemIds) {
            allMenuItemIds.push(...subServiceData.menuItemIds)
          }
        })
      } else {
        const subServicesForDay = structureAssignment?.weekStructure?.[day.toLowerCase()]?.find(
          (s: any) => s.serviceId === serviceId
        )?.subServices || []

        subServicesForDay.forEach((subService: any) => {
          const cell = menu?.menuData?.[date]?.[serviceId]?.[subService.subServiceId]?.[mealPlanId]?.[subMealPlan.id]
          if (cell?.menuItemIds && Array.isArray(cell.menuItemIds)) {
            allMenuItemIds.push(...cell.menuItemIds)
          }
        })
      }

      const hasItemMatch = allMenuItemIds.some(id => {
        const item = menuItems.find(mi => mi.id === id);
        return item?.name.toLowerCase().includes(query);
      });

      if (hasItemMatch) return true;
    }

    return false;
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full h-full flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b bg-gray-50 flex-shrink-0">
              <div className="flex-1">
                <h2 className="text-xl font-bold">
                  {menuType === "combined" ? "Combined Menu Details" : "Company Menu Details"}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {formatDate(menu?.startDate || "")} - {formatDate(menu?.endDate || "")}
                </p>
              </div>
              
              <div className="flex gap-2 items-center">
                
                {/* Search Bar */}
                <div className="relative w-64 mr-2">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                  <Input 
                    placeholder="Search items..." 
                    className="pl-8 h-9" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {updations.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setSelectedUpdation(selectedUpdation ? null : updations[0])}>
                    <History className="h-4 w-4 mr-2" />
                    Updates ({updations.length})
                  </Button>
                )}
                <Button onClick={handleDownloadXLSX} disabled={loading}>
                  <Download className="h-4 w-4 mr-2" />
                  Download XLSX
                </Button>
                <Button 
                  onClick={handleEdit}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-sm transition-all"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Details
                </Button>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-200 rounded-md transition-colors"
                  aria-label="Close modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Updations list */}
            {updations.length > 0 && (
              <div className="p-4 bg-yellow-50 border-b border-yellow-200 overflow-x-auto">
                <div className="flex gap-3 items-start">
                  {updations.map((updation) => (
                    <div
                      key={updation.id}
                      onClick={() => setSelectedUpdation(updation)}
                      className={`min-w-[220px] flex-shrink-0 p-3 rounded cursor-pointer transition-all ${
                        selectedUpdation?.id === updation.id
                          ? "bg-yellow-200 border-2 border-yellow-600"
                          : "bg-white border border-yellow-200 hover:bg-yellow-100"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">
                            Update #{(updation as any).updationNumber ?? "-"}
                          </p>
                          <p className="text-xs text-gray-600">
                            {new Date((updation as any).createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-yellow-700">{(updation as any).totalChanges ?? 0}</p>
                          <p className="text-xs text-gray-600">changes</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Content */}
            {loading ? (
              <div className="flex items-center justify-center py-8 flex-1">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : menu ? (
              <div className="flex-1 overflow-auto w-full">
                <div className="w-full">
                  {menu.companyName && (
                    <div className="mb-4 p-4 bg-gray-50 rounded border mx-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-600">Company</p>
                          <p className="font-semibold">{menu.companyName}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Building</p>
                          <p className="font-semibold">{menu.buildingName}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {services.map((service) => {
                    const serviceSpecificStructure = getFilteredStructureForService(service.id);
                    if (serviceSpecificStructure.length === 0) return null; // Don't show service if no rows

                    return (
                    <div key={service.id} className="mb-8 p-4">
                      <h2 className="text-xl font-bold mb-4 bg-black text-white p-3 rounded">{service.name}</h2>

                      <div className="overflow-x-auto border rounded">
                        <table className="w-full border-collapse text-sm">
                          <thead>
                            <tr>
                              <th className="border bg-gray-100 p-2 sticky left-0 z-20 min-w-[200px]">Meal Plan</th>
                              <th className="border bg-gray-100 p-2 sticky left-0 z-20 min-w-[200px]">Sub Meal Plan</th>
                              {dateRange.map(({ date, day }) => (
                                <th key={date} className="border bg-gray-100 p-2 min-w-[250px]">
                                  <div className="font-semibold">
                                    {new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                  </div>
                                  <div className="text-xs text-gray-600">{day}</div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {serviceSpecificStructure.map(({ mealPlan, subMealPlans: relatedSubMealPlans }) => {
                              return relatedSubMealPlans
                                .filter(subMealPlan => shouldShowRow(service.id, mealPlan.id, subMealPlan)) 
                                .map((subMealPlan, idx) => (
                                <tr key={`${mealPlan.id}-${subMealPlan.id}`}>
                                  <td className="border bg-gray-50 p-2 sticky left-0 z-10">
                                    {idx === 0 && <div className="font-semibold text-blue-700">{mealPlan.name}</div>}
                                  </td>
                                  <td className="border bg-gray-50 p-2 sticky left-0 z-10">
                                    <div className="text-sm text-gray-700 ml-3">{subMealPlan.name}</div>
                                  </td>

                                  {dateRange.map(({ date, day }) => {
                                    const changesForThisCell = getSelectedUpdationChangesForCell(
                                      date,
                                      service.id,
                                      mealPlan.id,
                                      subMealPlan.id,
                                    )

                                    if (selectedUpdation && changesForThisCell.length > 0) {
                                      return (
                                        <td
                                          key={`${date}-${service.id}-${mealPlan.id}-${subMealPlan.id}-changes`}
                                          className="border p-2 bg-yellow-50"
                                        >
                                          <div className="space-y-2">
                                            {changesForThisCell.map((ch: any, i: number) => {
                                              if (ch.action === "removed") {
                                                const name = ch.itemName || menuItems.find((m) => m.id === ch.itemId)?.name || ch.itemId
                                                return (
                                                  <div key={`removed-${i}`} className="space-y-1">
                                                    <div className="p-2 rounded text-xs font-medium flex items-center justify-between bg-red-100 border border-red-400 line-through text-red-700">
                                                      <span>{name}</span>
                                                      <span className="ml-1 text-red-600 font-bold">✗</span>
                                                    </div>
                                                  </div>
                                                )
                                              }

                                              if (ch.action === "replaced") {
                                                const oldName = ch.itemName || menuItems.find((m) => m.id === ch.itemId)?.name || ch.itemId
                                                const newName = ch.replacedWithName || menuItems.find((m) => m.id === ch.replacedWith)?.name || ch.replacedWith
                                                return (
                                                  <div key={`replaced-${i}`} className="space-y-1">
                                                    <div className="p-2 rounded text-xs font-medium flex items-center justify-between bg-red-100 border border-red-400 line-through text-red-700">
                                                      <span>{oldName}</span>
                                                      <span className="ml-1 text-red-600 font-bold">✗</span>
                                                    </div>
                                                    <div className="p-2 rounded text-xs font-bold flex items-center justify-between bg-yellow-200 border-2 border-yellow-500 text-yellow-900">
                                                      <span>{newName}</span>
                                                      <span className="ml-1 text-yellow-700">→ NEW</span>
                                                    </div>
                                                  </div>
                                                )
                                              }

                                              if (ch.action === "added") {
                                                const name = ch.itemName || menuItems.find((m) => m.id === ch.itemId)?.name || ch.itemId
                                                return (
                                                  <div key={`added-${i}`} className="p-2 rounded text-xs font-medium flex items-center justify-between bg-green-100 border-2 border-green-500 text-green-900 font-bold">
                                                    <span>{name}</span>
                                                    <span className="ml-1 text-green-700">✓</span>
                                                  </div>
                                                )
                                              }

                                              return (
                                                <div key={`chg-${i}`} className="p-2 rounded text-xs font-medium bg-blue-50 border border-blue-200">
                                                  <span>{getItemName(ch) || ch.itemId || ch.replacedWith}</span>
                                                </div>
                                              )
                                            })}
                                          </div>
                                        </td>
                                      )
                                    }

                                    let allMenuItemIds: string[] = []
                                    if (menuType === "combined") {
                                      const svcBlock = menu?.menuData?.[date]?.[service.id] || {}
                                      Object.keys(svcBlock).forEach((subServiceId) => {
                                        const subServiceData = svcBlock[subServiceId]?.[mealPlan.id]?.[subMealPlan.id]
                                        if (subServiceData?.menuItemIds) {
                                          allMenuItemIds.push(...subServiceData.menuItemIds)
                                        }
                                      })
                                    } else {
                                      const subServicesForDay = structureAssignment?.weekStructure?.[day.toLowerCase()]?.find(
                                        (s: any) => s.serviceId === service.id
                                      )?.subServices || []

                                      subServicesForDay.forEach((subService: any) => {
                                        const cell = menu?.menuData?.[date]?.[service.id]?.[subService.subServiceId]?.[mealPlan.id]?.[subMealPlan.id]
                                        if (cell?.menuItemIds && Array.isArray(cell.menuItemIds)) {
                                          allMenuItemIds.push(...cell.menuItemIds)
                                        }
                                      })
                                    }

                                    const uniqueItemIds = Array.from(new Map(allMenuItemIds.map((id, idx) => [id, idx])).entries())
                                      .sort((a, b) => a[1] - b[1])
                                      .map(([id]) => id)

                                    return (
                                      <td key={`${date}-${service.id}-${mealPlan.id}-${subMealPlan.id}`} className="border p-2">
                                        <div className="space-y-1">
                                          {uniqueItemIds.length > 0 ? (
                                            uniqueItemIds.map((id) => {
                                              const mi = menuItems.find((m) => m.id === id)
                                              return (
                                                <div key={id} className="p-2 rounded text-xs font-medium bg-blue-50 border border-blue-200 text-gray-800">
                                                  <span>{mi?.name || id}</span>
                                                </div>
                                              )
                                            })
                                          ) : (
                                            <div className="text-xs text-gray-400 italic">No items</div>
                                          )}
                                        </div>
                                      </td>
                                    )
                                  })}
                                </tr>
                              ))
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )})}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">Select a service to begin editing</div>
            )}
          </div>
        </div>
      )}
    </>
  )
}