"use client"

import React, { useState, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Building2,
  Calendar,
  Check,
  CheckSquare,
  Square,
  Copy,
  ClipboardCopy,
  Loader2,
  AlertCircle,
  Info,
  ArrowRight,
  Sparkles,
  Search,
  Layers,
  Utensils,
  Repeat,
  X,
  ChevronRight,
  ShieldAlert
} from "lucide-react"
import { collection, query, where, getDocs, doc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { toast } from "@/hooks/use-toast"
import type { MenuData } from "./types"

export interface WeekInfo {
  weekIndex: number
  weekNumber: number
  label: string
  startDate: string
  endDate: string
  dates: Array<{ date: string; day: string }>
  dishCount: number
  servingDaysCount: number
}

export interface CopyWeekToBuildingsModalProps {
  isOpen: boolean
  onClose: () => void
  menu: MenuData | null
  menuData: any
  dateRange: Array<{ date: string; day: string }>
  buildings: any[]
  companies: any[]
  userName?: string
  onSuccess?: () => void
  onLocalUpdate?: (updater: (prevMenuData: any) => any) => void
}

/**
 * Deep merge or overwrite day menu data
 */
function copyDayMenuData(targetDayData: any, sourceDayData: any, isMerge: boolean) {
  if (!sourceDayData) return targetDayData || {}
  if (!isMerge || !targetDayData) {
    return JSON.parse(JSON.stringify(sourceDayData))
  }

  const merged = JSON.parse(JSON.stringify(targetDayData))
  Object.keys(sourceDayData).forEach(serviceId => {
    if (!merged[serviceId]) merged[serviceId] = {}
    Object.keys(sourceDayData[serviceId] || {}).forEach(subServiceId => {
      if (!merged[serviceId][subServiceId]) merged[serviceId][subServiceId] = {}
      Object.keys(sourceDayData[serviceId][subServiceId] || {}).forEach(mpId => {
        if (!merged[serviceId][subServiceId][mpId]) merged[serviceId][subServiceId][mpId] = {}
        Object.keys(sourceDayData[serviceId][subServiceId][mpId] || {}).forEach(smpId => {
          const srcCell = sourceDayData[serviceId][subServiceId][mpId][smpId] || {}
          const tgtCell = merged[serviceId][subServiceId][mpId][smpId] || { menuItemIds: [] }
          const mergedItemIds = Array.from(new Set([
            ...(tgtCell.menuItemIds || []),
            ...(srcCell.menuItemIds || [])
          ]))
          merged[serviceId][subServiceId][mpId][smpId] = {
            ...tgtCell,
            ...srcCell,
            menuItemIds: mergedItemIds
          }
        })
      })
    })
  })
  return merged
}

export function CopyWeekToBuildingsModal({
  isOpen,
  onClose,
  menu,
  menuData,
  dateRange,
  buildings,
  companies,
  userName = "Admin",
  onSuccess,
  onLocalUpdate,
}: CopyWeekToBuildingsModalProps) {
  // Target Company resolution
  const [selectedCompanyOverride, setSelectedCompanyOverride] = useState<string>("")
  const targetCompanyId = menu?.companyId || selectedCompanyOverride || (companies[0]?.id ?? "")
  const targetCompany = companies.find(c => c.id === targetCompanyId)
  const targetCompanyName = targetCompany?.name || menu?.companyName || "Current Company"

  // Source Building resolution
  const sourceBuildingId = menu?.buildingId || ""
  const sourceBuilding = buildings.find(b => b.id === sourceBuildingId)
  const sourceBuildingName = sourceBuilding?.name || menu?.buildingName || "Source Building"

  // Filter other buildings belonging strictly to the SAME company
  const availableTargetBuildings = useMemo(() => {
    if (!targetCompanyId) return []
    return buildings.filter(b => b.companyId === targetCompanyId && b.id !== sourceBuildingId)
  }, [buildings, targetCompanyId, sourceBuildingId])

  // Week breakdown of current date range
  const weeks: WeekInfo[] = useMemo(() => {
    if (!dateRange || dateRange.length === 0) return []
    const result: WeekInfo[] = []
    const chunkSize = 7
    for (let i = 0; i < dateRange.length; i += chunkSize) {
      const chunkDates = dateRange.slice(i, i + chunkSize)
      const weekNumber = Math.floor(i / chunkSize) + 1

      let dishCount = 0
      let servingDaysCount = 0

      chunkDates.forEach(({ date }) => {
        const dayData = menuData?.[date]
        if (!dayData) return
        let dayDishCount = 0
        Object.values(dayData).forEach((serviceObj: any) => {
          Object.values(serviceObj || {}).forEach((subServiceObj: any) => {
            Object.values(subServiceObj || {}).forEach((mpObj: any) => {
              Object.values(mpObj || {}).forEach((cell: any) => {
                if (Array.isArray(cell?.menuItemIds)) {
                  dayDishCount += cell.menuItemIds.length
                }
              })
            })
          })
        })
        if (dayDishCount > 0) {
          servingDaysCount++
          dishCount += dayDishCount
        }
      })

      const start = chunkDates[0]?.date || ""
      const end = chunkDates[chunkDates.length - 1]?.date || ""
      result.push({
        weekIndex: Math.floor(i / chunkSize),
        weekNumber,
        label: `Week ${weekNumber}`,
        startDate: start,
        endDate: end,
        dates: chunkDates,
        dishCount,
        servingDaysCount,
      })
    }
    return result
  }, [dateRange, menuData])

  // UI States
  const [selectedWeekIndices, setSelectedWeekIndices] = useState<number[]>([])
  const [selectedBuildingIds, setSelectedBuildingIds] = useState<string[]>([])
  const [buildingSearch, setBuildingSearch] = useState("")
  const [mappingMode, setMappingMode] = useState<"matching" | "custom_slot">("matching")
  const [customTargetWeekIndex, setCustomTargetWeekIndex] = useState<number>(0)
  const [mergeMode, setMergeMode] = useState<"overwrite" | "merge">("overwrite")
  const [isCopying, setIsCopying] = useState(false)
  const [copyProgress, setCopyProgress] = useState("")

  // Initialize selected weeks to all weeks when opened
  React.useEffect(() => {
    if (isOpen && weeks.length > 0) {
      // Default to selecting all weeks that have dishes (or week 0 if none)
      const withDishes = weeks.filter(w => w.dishCount > 0).map(w => w.weekIndex)
      setSelectedWeekIndices(withDishes.length > 0 ? withDishes : [0])
      setSelectedBuildingIds([])
      setBuildingSearch("")
      setMappingMode("matching")
      setCustomTargetWeekIndex(0)
      setMergeMode("overwrite")
    }
  }, [isOpen, weeks.length])

  // Filtered target buildings based on search query
  const filteredBuildings = useMemo(() => {
    if (!buildingSearch.trim()) return availableTargetBuildings
    const q = buildingSearch.toLowerCase().trim()
    return availableTargetBuildings.filter(b => (b.name || "").toLowerCase().includes(q))
  }, [availableTargetBuildings, buildingSearch])

  // Toggles for Week selection
  const handleToggleWeek = (weekIdx: number) => {
    setSelectedWeekIndices(prev =>
      prev.includes(weekIdx) ? prev.filter(i => i !== weekIdx) : [...prev, weekIdx].sort((a, b) => a - b)
    )
  }

  const handleSelectAllWeeks = () => {
    setSelectedWeekIndices(weeks.map(w => w.weekIndex))
  }

  const handleDeselectAllWeeks = () => {
    setSelectedWeekIndices([])
  }

  // Toggles for Building selection
  const handleToggleBuilding = (buildingId: string) => {
    setSelectedBuildingIds(prev =>
      prev.includes(buildingId) ? prev.filter(id => id !== buildingId) : [...prev, buildingId]
    )
  }

  const handleSelectAllBuildings = () => {
    setSelectedBuildingIds(filteredBuildings.map(b => b.id))
  }

  const handleDeselectAllBuildings = () => {
    setSelectedBuildingIds([])
  }

  // Calculate totals for preview badge
  const totalSelectedDishes = useMemo(() => {
    return selectedWeekIndices.reduce((acc, idx) => {
      const w = weeks.find(item => item.weekIndex === idx)
      return acc + (w?.dishCount || 0)
    }, 0)
  }, [selectedWeekIndices, weeks])

  // Execute Week-Wise Copy
  const handleExecuteCopy = async () => {
    if (selectedWeekIndices.length === 0) {
      toast({
        title: "No Weeks Selected",
        description: "Please select at least one week to copy.",
        variant: "destructive",
      })
      return
    }

    if (selectedBuildingIds.length === 0) {
      toast({
        title: "No Buildings Selected",
        description: "Please select at least one target building.",
        variant: "destructive",
      })
      return
    }

    setIsCopying(true)
    try {
      const targetBuildings = buildings.filter(b => selectedBuildingIds.includes(b.id))
      let totalUpdated = 0

      // Build date mapping pairs: { srcDate, tgtDate }
      const datePairs: Array<{ srcDate: string; tgtDate: string }> = []

      if (selectedWeekIndices.length === 1 && mappingMode === "custom_slot") {
        const srcWeek = weeks.find(w => w.weekIndex === selectedWeekIndices[0])
        const tgtWeek = weeks.find(w => w.weekIndex === customTargetWeekIndex) || weeks[0]
        if (srcWeek && tgtWeek) {
          srcWeek.dates.forEach((d, idx) => {
            const tgtD = tgtWeek.dates[idx]
            if (d && tgtD) {
              datePairs.push({ srcDate: d.date, tgtDate: tgtD.date })
            }
          })
        }
      } else {
        selectedWeekIndices.forEach(wIdx => {
          const w = weeks.find(item => item.weekIndex === wIdx)
          w?.dates.forEach(d => {
            datePairs.push({ srcDate: d.date, tgtDate: d.date })
          })
        })
      }

      for (let bIndex = 0; bIndex < targetBuildings.length; bIndex++) {
        const targetBld = targetBuildings[bIndex]
        setCopyProgress(`Copying to ${targetBld.name} (${bIndex + 1}/${targetBuildings.length})...`)

        // Query existing companyMenus for this company and target building
        const q = query(
          collection(db, "companyMenus"),
          where("companyId", "==", targetCompanyId),
          where("buildingId", "==", targetBld.id)
        )
        const snap = await getDocs(q)

        // Find document matching date range
        let targetMenuDoc = snap.docs.find(d => {
          const dData = d.data()
          return dData.startDate === menu?.startDate && dData.endDate === menu?.endDate
        })

        // Fallback: doc that encompasses target dates
        if (!targetMenuDoc) {
          targetMenuDoc = snap.docs.find(d => {
            const dData = d.data()
            return datePairs.some(p => p.tgtDate >= dData.startDate && p.tgtDate <= dData.endDate)
          })
        }

        if (targetMenuDoc) {
          // Update existing doc
          const existingData = targetMenuDoc.data()
          const updatedMenuData = JSON.parse(JSON.stringify(existingData.menuData || {}))

          datePairs.forEach(({ srcDate, tgtDate }) => {
            const srcData = menuData?.[srcDate]
            if (srcData) {
              updatedMenuData[tgtDate] = copyDayMenuData(
                updatedMenuData[tgtDate],
                srcData,
                mergeMode === "merge"
              )
            }
          })

          await updateDoc(doc(db, "companyMenus", targetMenuDoc.id), {
            menuData: updatedMenuData,
            updatedAt: serverTimestamp(),
          })

          // Updation record log
          try {
            await addDoc(collection(db, "updations"), {
              menuId: targetMenuDoc.id,
              menuType: "company",
              menuName: `${targetCompanyName} - ${targetBld.name}`,
              updationNumber: Date.now(),
              totalChanges: totalSelectedDishes,
              menuStartDate: existingData.startDate || menu?.startDate,
              menuEndDate: existingData.endDate || menu?.endDate,
              createdAt: serverTimestamp(),
              createdBy: userName || "User",
              companyId: targetCompanyId,
              companyName: targetCompanyName,
              buildingId: targetBld.id,
              buildingName: targetBld.name,
              isCompanyWiseChange: true,
              description: `Copied Week ${selectedWeekIndices.map(i => i + 1).join(", ")} from ${sourceBuildingName}`,
            })
          } catch (e) {
            console.warn("Audit log creation warning:", e)
          }
        } else {
          // Create new companyMenu doc
          const newMenuData: Record<string, any> = {}
          datePairs.forEach(({ srcDate, tgtDate }) => {
            const srcData = menuData?.[srcDate]
            if (srcData) {
              newMenuData[tgtDate] = JSON.parse(JSON.stringify(srcData))
            }
          })

          const newDocRef = await addDoc(collection(db, "companyMenus"), {
            companyId: targetCompanyId,
            companyName: targetCompanyName,
            buildingId: targetBld.id,
            buildingName: targetBld.name,
            startDate: menu?.startDate || dateRange[0]?.date || "",
            endDate: menu?.endDate || dateRange[dateRange.length - 1]?.date || "",
            status: menu?.status || "active",
            combinedMenuId: menu?.combinedMenuId || "",
            menuData: newMenuData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })

          try {
            await addDoc(collection(db, "updations"), {
              menuId: newDocRef.id,
              menuType: "company",
              menuName: `${targetCompanyName} - ${targetBld.name}`,
              updationNumber: 1,
              totalChanges: totalSelectedDishes,
              menuStartDate: menu?.startDate || dateRange[0]?.date || "",
              menuEndDate: menu?.endDate || dateRange[dateRange.length - 1]?.date || "",
              createdAt: serverTimestamp(),
              createdBy: userName || "User",
              companyId: targetCompanyId,
              companyName: targetCompanyName,
              buildingId: targetBld.id,
              buildingName: targetBld.name,
              isCompanyWiseChange: true,
              description: `Week-wise copy: created from ${sourceBuildingName} (Weeks ${selectedWeekIndices.map(i => i + 1).join(", ")})`,
            })
          } catch (e) {
            console.warn("Audit log creation warning:", e)
          }
        }

        totalUpdated++
      }

      toast({
        title: "Menu Weeks Copied Successfully!",
        description: `Copied ${selectedWeekIndices.length} week(s) (${totalSelectedDishes} dishes) to ${totalUpdated} building(s) of ${targetCompanyName}.`,
      })

      onSuccess?.()
      onClose()
    } catch (error: any) {
      console.error("Error executing week-wise copy:", error)
      toast({
        title: "Copy Failed",
        description: error?.message || "Failed to copy menu to other buildings.",
        variant: "destructive",
      })
    } finally {
      setIsCopying(false)
      setCopyProgress("")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open && !isCopying) onClose() }}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 overflow-hidden shadow-2xl rounded-2xl border-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-700 px-6 py-4 text-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-white/15 rounded-xl backdrop-blur-xs">
                <ClipboardCopy className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  Copy Menu Week-Wise to Other Buildings
                </DialogTitle>
                <DialogDescription className="text-xs text-indigo-100 font-medium mt-0.5">
                  Replicate weekly dish schedules across cafeteria locations for this company
                </DialogDescription>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isCopying}
              className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Context Badges Bar */}
          <div className="mt-3.5 pt-3 border-t border-white/20 flex flex-wrap items-center gap-2 text-xs">
            <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-xs px-2.5 py-1 rounded-full text-white font-medium">
              <Building2 className="h-3.5 w-3.5 text-indigo-200" />
              <span>Company:</span>
              <strong className="text-white">{targetCompanyName}</strong>
            </div>

            <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-xs px-2.5 py-1 rounded-full text-white font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Source Building:</span>
              <strong className="text-white">{sourceBuildingName}</strong>
            </div>

            {menu?.startDate && menu?.endDate && (
              <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-xs px-2.5 py-1 rounded-full text-white font-medium ml-auto">
                <Calendar className="h-3.5 w-3.5 text-indigo-200" />
                <span>{menu.startDate}</span>
                <span>→</span>
                <span>{menu.endDate}</span>
                <span className="opacity-75">({weeks.length} Weeks)</span>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/60 custom-scrollbar">
          {/* If company has no other buildings */}
          {availableTargetBuildings.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 flex items-start gap-3 shadow-xs">
              <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <h4 className="font-bold text-amber-900 text-sm">No Other Buildings Configured</h4>
                <p className="mt-1 leading-relaxed">
                  There are no other cafeteria locations registered under <strong>{targetCompanyName}</strong>. 
                  To copy weekly menus across buildings, please add cafeteria buildings under this company in the Buildings management section.
                </p>
              </div>
            </div>
          )}

          {/* 1. SELECT WEEKS */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <h3 className="font-bold text-slate-800 text-sm">Select Source Week(s) to Copy</h3>
                <Badge variant="secondary" className="text-[11px] font-semibold bg-indigo-50 text-indigo-700 border-indigo-200">
                  {selectedWeekIndices.length} of {weeks.length} Weeks Selected
                </Badge>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAllWeeks}
                  className="h-7 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                >
                  Select All
                </Button>
                <span className="text-slate-300">|</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDeselectAllWeeks}
                  className="h-7 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                >
                  Clear
                </Button>
              </div>
            </div>

            {/* Weeks Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {weeks.map(week => {
                const isSelected = selectedWeekIndices.includes(week.weekIndex)
                return (
                  <div
                    key={week.weekIndex}
                    onClick={() => handleToggleWeek(week.weekIndex)}
                    className={`cursor-pointer rounded-xl p-3.5 border transition-all text-left flex flex-col justify-between ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-50/70 shadow-sm ring-1 ring-indigo-500"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-indigo-600 shrink-0" />
                        ) : (
                          <Square className="h-4 w-4 text-slate-400 shrink-0" />
                        )}
                        <span className="font-bold text-slate-900 text-sm">{week.label}</span>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0.5 font-bold ${
                          week.dishCount > 0
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                      >
                        {week.dishCount > 0 ? `${week.dishCount} Dishes` : "Empty"}
                      </Badge>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
                      <div className="flex items-center gap-1 font-mono text-slate-700 font-medium">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        <span>{week.startDate}</span>
                        <span>→</span>
                        <span>{week.endDate}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>{week.dates.length} Days</span>
                        <span>{week.servingDaysCount} Serving Days</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 2. SELECT TARGET BUILDINGS */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <h3 className="font-bold text-slate-800 text-sm">
                  Select Target Buildings of {targetCompanyName}
                </h3>
                <Badge variant="secondary" className="text-[11px] font-semibold bg-purple-50 text-purple-700 border-purple-200">
                  {selectedBuildingIds.length} of {availableTargetBuildings.length} Buildings
                </Badge>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAllBuildings}
                  disabled={availableTargetBuildings.length === 0}
                  className="h-7 text-xs font-semibold text-purple-600 hover:bg-purple-50"
                >
                  Select All
                </Button>
                <span className="text-slate-300">|</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDeselectAllBuildings}
                  className="h-7 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                >
                  Clear
                </Button>
              </div>
            </div>

            {/* Building Search Filter */}
            {availableTargetBuildings.length > 3 && (
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-400" />
                <Input
                  placeholder="Filter target buildings..."
                  value={buildingSearch}
                  onChange={e => setBuildingSearch(e.target.value)}
                  className="pl-8 h-8 text-xs bg-slate-50 border-slate-200"
                />
              </div>
            )}

            {/* Buildings Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
              {filteredBuildings.map(bld => {
                const isSelected = selectedBuildingIds.includes(bld.id)
                return (
                  <div
                    key={bld.id}
                    onClick={() => handleToggleBuilding(bld.id)}
                    className={`cursor-pointer p-3 rounded-lg border transition-all flex items-center justify-between ${
                      isSelected
                        ? "border-purple-500 bg-purple-50/70 text-purple-900 shadow-xs ring-1 ring-purple-500"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4 text-purple-600 shrink-0" />
                      ) : (
                        <Square className="h-4 w-4 text-slate-400 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-xs truncate">{bld.name}</p>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {bld.address || "Cafeteria location"}
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0 font-medium bg-slate-50">
                      Target
                    </Badge>
                  </div>
                )
              })}

              {filteredBuildings.length === 0 && availableTargetBuildings.length > 0 && (
                <div className="col-span-full py-4 text-center text-xs text-slate-400">
                  No buildings match &quot;{buildingSearch}&quot;
                </div>
              )}
            </div>
          </div>

          {/* 3. MAPPING & OVERWRITE OPTIONS */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                3
              </div>
              <h3 className="font-bold text-slate-800 text-sm">Copy Strategy & Mode</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Mapping Strategy */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Repeat className="h-3.5 w-3.5 text-indigo-600" />
                  Week Alignment
                </Label>

                <div className="space-y-1.5">
                  <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="mappingMode"
                      value="matching"
                      checked={mappingMode === "matching"}
                      onChange={() => setMappingMode("matching")}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <strong className="text-slate-800 block">Corresponding Weeks (Exact Dates)</strong>
                      <span className="text-slate-500 text-[11px]">
                        Week 1 copies to Week 1, Week 2 to Week 2 on identical calendar dates.
                      </span>
                    </div>
                  </label>

                  {selectedWeekIndices.length === 1 && (
                    <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs">
                      <input
                        type="radio"
                        name="mappingMode"
                        value="custom_slot"
                        checked={mappingMode === "custom_slot"}
                        onChange={() => setMappingMode("custom_slot")}
                        className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1">
                        <strong className="text-slate-800 block">Rotate to Different Target Week Slot</strong>
                        <span className="text-slate-500 text-[11px] block mb-2">
                          Paste this single week into another week slot of the target building.
                        </span>
                        {mappingMode === "custom_slot" && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[11px] font-medium text-slate-600">Paste into:</span>
                            <select
                              value={customTargetWeekIndex}
                              onChange={e => setCustomTargetWeekIndex(Number(e.target.value))}
                              className="text-xs bg-white border border-slate-300 rounded px-2 py-1 font-semibold text-indigo-700"
                            >
                              {weeks.map(w => (
                                <option key={w.weekIndex} value={w.weekIndex}>
                                  {w.label} ({w.startDate} - {w.endDate})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </label>
                  )}
                </div>
              </div>

              {/* Merge vs Overwrite */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Utensils className="h-3.5 w-3.5 text-purple-600" />
                  Target Dish Handling
                </Label>

                <div className="space-y-1.5">
                  <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="mergeMode"
                      value="overwrite"
                      checked={mergeMode === "overwrite"}
                      onChange={() => setMergeMode("overwrite")}
                      className="mt-0.5 text-purple-600 focus:ring-purple-500"
                    />
                    <div>
                      <strong className="text-slate-800 block">Overwrite Target Dishes (Recommended)</strong>
                      <span className="text-slate-500 text-[11px]">
                        Replaces dishes in target buildings for selected weeks with the source week menu.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="mergeMode"
                      value="merge"
                      checked={mergeMode === "merge"}
                      onChange={() => setMergeMode("merge")}
                      className="mt-0.5 text-purple-600 focus:ring-purple-500"
                    />
                    <div>
                      <strong className="text-slate-800 block">Merge With Existing Dishes</strong>
                      <span className="text-slate-500 text-[11px]">
                        Preserves any existing dishes already scheduled in target buildings and appends source dishes.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-white px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-800 px-3 py-1 rounded-full font-bold">
              <ClipboardCopy className="h-3.5 w-3.5 text-indigo-600" />
              Ready: {selectedWeekIndices.length} Week(s) ({totalSelectedDishes} dishes) → {selectedBuildingIds.length} Building(s)
            </span>
            {isCopying && copyProgress && (
              <span className="text-indigo-600 font-medium flex items-center gap-1 animate-pulse">
                <Loader2 className="h-3 w-3 animate-spin" />
                {copyProgress}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isCopying}
              className="text-xs font-semibold text-slate-600"
            >
              Cancel
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleExecuteCopy}
              disabled={
                isCopying ||
                selectedWeekIndices.length === 0 ||
                selectedBuildingIds.length === 0 ||
                availableTargetBuildings.length === 0
              }
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs gap-1.5 shadow-sm px-4"
            >
              {isCopying ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Copying...
                </>
              ) : (
                <>
                  <ClipboardCopy className="h-3.5 w-3.5" />
                  Copy Week-Wise to {selectedBuildingIds.length} Building(s)
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
