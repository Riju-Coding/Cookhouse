"use client"

import React, { useState, useEffect, useMemo, useCallback, useRef, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { 
  Truck, 
  Calendar, 
  Building2, 
  Users, 
  Scale, 
  Utensils, 
  Plus, 
  Trash2, 
  Save, 
  Download, 
  Search, 
  Sparkles, 
  Calculator, 
  AlertCircle, 
  CheckCircle2, 
  Check,
  Printer, 
  RefreshCw, 
  FileSpreadsheet, 
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  IndianRupee,
  ChefHat,
  ArrowRight,
  Maximize2,
  Columns3,
  X,
  LayoutGrid,
  Loader2,
  UtensilsCrossed,
  Filter,
  Clock,
  Coffee
} from "lucide-react"
import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { toast } from "@/hooks/use-toast"
import { servicesService, subServicesService, menuItemsService } from "@/lib/services"
import type { Service, SubService, MenuItem } from "@/lib/types"
import {
  ingredientsService,
  getEffectiveIngredientPrice,
  calculateIngredientCost,
  type Ingredient,
  type IngredientPriceRecord
} from "@/lib/firestore"

export interface DispatchMenuItem {
  id: string
  menuItemId: string
  name: string
  category?: string
  serviceId?: string
  serviceName?: string
  subServiceId?: string
  subServiceName?: string
  quantity: number
  unit: string
  portionPerPax: number // in Kg (e.g. 0.15 Kg)
  recipeId?: string
  recipeName?: string
  estimatedCostPerUnit?: number // Cost per Kg
  notes?: string
}

export interface CompanyDispatch {
  companyId: string
  companyName: string
  buildingId?: string
  buildingName?: string
  mg: number // Minimum Guarantee (pax)
  actualPax?: number
  items: DispatchMenuItem[]
}

export interface DailyDispatchDocument {
  id: string
  date: string
  status: "draft" | "confirmed" | "dispatched"
  totalMG: number
  totalWeightKg: number
  companies: CompanyDispatch[]
  notes?: string
  updatedAt?: any
}

// ─── High-Performance Debounced Quantity Input with Industry Micro-Loaders ───
interface FastQuantityInputProps {
  value: number
  onChange: (val: number) => void
  step?: string
  min?: string | number
  placeholder?: string
  className?: string
  disabled?: boolean
}

const FastQuantityInput = React.memo(({
  value,
  onChange,
  step = "0.5",
  min = 0,
  placeholder = "0",
  className = "",
  disabled = false,
}: FastQuantityInputProps) => {
  const [localVal, setLocalVal] = useState<string>(value === 0 ? "" : String(value))
  const [isSaving, setIsSaving] = useState(false)
  const [showSavedCheck, setShowSavedCheck] = useState(false)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)
  const savedTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setLocalVal(value === 0 ? "" : String(value))
  }, [value])

  const commit = useCallback((newStr: string) => {
    const num = Math.max(0, parseFloat(newStr) || 0)
    if (num !== value) {
      setIsSaving(true)
      onChange(num)
      setTimeout(() => {
        setIsSaving(false)
        setShowSavedCheck(true)
        if (savedTimer.current) clearTimeout(savedTimer.current)
        savedTimer.current = setTimeout(() => setShowSavedCheck(false), 900)
      }, 140)
    }
  }, [value, onChange])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value
    setLocalVal(nextVal)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      commit(nextVal)
    }, 280)
  }

  const handleBlur = () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    commit(localVal)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      commit(localVal)
      e.currentTarget.blur()
    }
  }

  return (
    <div className="relative inline-flex items-center">
      <Input
        type="number"
        step={step}
        min={min}
        value={localVal}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />
      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
        {isSaving ? (
          <Loader2 className="h-3 w-3 animate-spin text-orange-400 shrink-0" />
        ) : showSavedCheck ? (
          <Check className="h-3 w-3 text-emerald-400 shrink-0" />
        ) : null}
      </div>
    </div>
  )
})
FastQuantityInput.displayName = "FastQuantityInput"

// ─── High-Performance Debounced MG (Headcount) Input ──────────────────────────
interface FastMGInputProps {
  value: number
  onChange: (val: number) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

const FastMGInput = React.memo(({
  value,
  onChange,
  placeholder = "e.g. 150",
  className = "",
  disabled = false,
}: FastMGInputProps) => {
  const [localVal, setLocalVal] = useState<string>(value === 0 ? "" : String(value))
  const [isSaving, setIsSaving] = useState(false)
  const [showSavedCheck, setShowSavedCheck] = useState(false)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)
  const savedTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setLocalVal(value === 0 ? "" : String(value))
  }, [value])

  const commit = useCallback((newStr: string) => {
    const num = Math.max(0, parseInt(newStr, 10) || 0)
    if (num !== value) {
      setIsSaving(true)
      onChange(num)
      setTimeout(() => {
        setIsSaving(false)
        setShowSavedCheck(true)
        if (savedTimer.current) clearTimeout(savedTimer.current)
        savedTimer.current = setTimeout(() => setShowSavedCheck(false), 900)
      }, 140)
    }
  }, [value, onChange])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value
    setLocalVal(nextVal)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      commit(nextVal)
    }, 280)
  }

  const handleBlur = () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    commit(localVal)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      commit(localVal)
      e.currentTarget.blur()
    }
  }

  return (
    <div className="relative inline-flex items-center">
      <Input
        type="number"
        min={0}
        value={localVal}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />
      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
        {isSaving ? (
          <Loader2 className="h-3 w-3 animate-spin text-amber-400 shrink-0" />
        ) : showSavedCheck ? (
          <Check className="h-3 w-3 text-emerald-400 shrink-0" />
        ) : null}
      </div>
    </div>
  )
})
FastMGInput.displayName = "FastMGInput"

// ─── Memoized Company Card for Multi-Column Workspace ─────────────────────────
interface ModalCompanyCardProps {
  company: CompanyDispatch
  compIdx: number
  modalServiceFilter: string
  modalSubServiceFilter: string
  expandAllRecipes: boolean
  expandedRecipeIds: Set<string>
  toggleRecipeExpand: (id: string) => void
  recipeMap: Map<string, any>
  isCalculating: boolean
  selectedDate: string
  getDishCostInfo: (recipe: any, targetDate: string) => any
  onUpdateMG: (compIdx: number, newMG: number) => void
  onAutoCalc: (compIdx: number) => void
  onUpdateItemQuantity: (compIdx: number, itemIdx: number, qty: number) => void
  onUpdateItemUnit: (compIdx: number, itemIdx: number, unit: string) => void
  onRemoveItem: (compIdx: number, itemIdx: number) => void
  onRemoveCompany: (compIdx: number) => void
  onOpenAddItem: (compIdx: number) => void
}

const ModalCompanyCard = React.memo(({
  company,
  compIdx,
  modalServiceFilter,
  modalSubServiceFilter,
  expandAllRecipes,
  expandedRecipeIds,
  toggleRecipeExpand,
  recipeMap,
  isCalculating,
  selectedDate,
  getDishCostInfo,
  onUpdateMG,
  onAutoCalc,
  onUpdateItemQuantity,
  onUpdateItemUnit,
  onRemoveItem,
  onRemoveCompany,
  onOpenAddItem,
}: ModalCompanyCardProps) => {
  // Group this company's items by Service & Sub-Service
  const { groups, compTotalKg } = useMemo(() => {
    const groupedMap: { [key: string]: { serviceName: string; subServiceName: string; items: { it: DispatchMenuItem; originalIndex: number }[] } } = {}

    company.items.forEach((it, originalIdx) => {
      // Check service filter
      if (modalServiceFilter !== "ALL") {
        const matchesService = 
          (it.serviceName && it.serviceName.toLowerCase() === modalServiceFilter.toLowerCase()) ||
          (it.serviceId && it.serviceId === modalServiceFilter)
        if (!matchesService) return
      }
      // Check sub-service filter
      if (modalSubServiceFilter !== "ALL") {
        const matchesSub = 
          (it.subServiceName && it.subServiceName.toLowerCase() === modalSubServiceFilter.toLowerCase()) ||
          (it.subServiceId && it.subServiceId === modalSubServiceFilter)
        if (!matchesSub) return
      }

      const sName = it.serviceName || "General Service"
      const ssName = it.subServiceName || ""
      const groupKey = `${sName}____${ssName}`

      if (!groupedMap[groupKey]) {
        groupedMap[groupKey] = {
          serviceName: sName,
          subServiceName: ssName,
          items: []
        }
      }
      groupedMap[groupKey].items.push({ it, originalIndex: originalIdx })
    })

    const compTotalKg = company.items
      .filter(i => i.unit === "Kg")
      .reduce((s, i) => s + (i.quantity || 0), 0)

    const compTotalCost = company.items.reduce((s, it) => {
      const linkedRecipe = (it.recipeId ? recipeMap.get(it.recipeId) : null) || 
        recipeMap.get(it.menuItemId) || 
        recipeMap.get(it.name.trim().toUpperCase())
      const costInfo = getDishCostInfo ? getDishCostInfo(linkedRecipe, selectedDate) : { unitCost: 0 }
      return s + ((it.quantity || 0) * (costInfo.unitCost || 0))
    }, 0)

    return { groups: Object.values(groupedMap), compTotalKg, compTotalCost }
  }, [company.items, modalServiceFilter, modalSubServiceFilter, recipeMap, getDishCostInfo, selectedDate])

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-xl flex flex-col shadow-lg overflow-hidden min-h-[460px] h-fit">
      {/* Column Header */}
      <div className="p-3 bg-slate-850 border-b border-slate-800 space-y-2 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="overflow-hidden">
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-bold text-sm text-white tracking-tight truncate">
                {company.companyName}
              </span>
              {company.buildingName && (
                <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-700 font-normal py-0 shrink-0">
                  {company.buildingName}
                </Badge>
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>{company.items.length} dishes</span>
              <span>&bull;</span>
              <strong className="text-emerald-400">{compTotalKg.toFixed(1)} Kg</strong>
              {compTotalCost > 0 && (
                <>
                  <span>&bull;</span>
                  <span className="text-amber-300 font-bold font-mono">₹{compTotalCost.toFixed(0)}</span>
                  {company.mg > 0 && (
                    <span className="text-[10px] text-slate-400 font-mono">(₹{(compTotalCost / company.mg).toFixed(1)}/pax)</span>
                  )}
                </>
              )}
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-slate-400 hover:text-red-400 shrink-0 -mt-1 -mr-1"
            onClick={() => onRemoveCompany(compIdx)}
            title="Remove Company"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* The MG Box in Column */}
        <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
          <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-amber-400" />
            MG (Headcount):
          </span>
          <div className="flex items-center gap-1">
            <FastMGInput
              value={company.mg || 0}
              onChange={newMG => onUpdateMG(compIdx, newMG)}
              className="h-7 w-20 bg-slate-950 border-amber-500/40 text-amber-300 font-bold text-center text-xs focus-visible:ring-amber-500 pr-5"
              placeholder="e.g. 150"
            />
            <span className="text-[11px] text-amber-300/80 font-medium">pax</span>
          </div>
        </div>

        {/* Quick Action row with Calc Loader */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[11px] text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 px-2 py-0 gap-1"
            onClick={() => onAutoCalc(compIdx)}
            disabled={isCalculating}
          >
            {isCalculating ? (
              <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
            ) : (
              <Calculator className="h-3 w-3" />
            )}
            {isCalculating ? "Calc..." : "Calc (MG × Port)"}
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[11px] text-slate-200 border-slate-700 bg-slate-800 hover:bg-slate-700 px-2 py-0 gap-1"
            onClick={() => onOpenAddItem(compIdx)}
          >
            <Plus className="h-3 w-3 text-orange-400" />
            Add Dish
          </Button>
        </div>
      </div>

      {/* Column Dishes List Grouped Service & Sub-Service Wise (Expanded to Last Item) */}
      <div className="p-2.5 space-y-3">
        {groups.length === 0 ? (
          <div className="text-center py-10 text-xs text-slate-500">
            {company.items.length === 0 ? (
              <>
                No dishes planned yet.<br />
                Click <strong>&quot;Add Dish&quot;</strong> above.
              </>
            ) : (
              <>
                No dishes under <strong>{modalServiceFilter}</strong>.<br />
                Select <strong>&quot;All Services&quot;</strong> to view other dishes.
              </>
            )}
          </div>
        ) : (
          groups.map((grp, grpIdx) => (
            <div key={grp.serviceName + grp.subServiceName + grpIdx} className="space-y-1.5">
              {/* Service & Sub-Service Sticky Group Header */}
              <div className="sticky top-0 z-10 bg-slate-850/95 backdrop-blur border border-slate-700/80 rounded px-2.5 py-1 flex items-center justify-between text-xs shadow-xs">
                <div className="flex items-center gap-1.5 truncate">
                  <UtensilsCrossed className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                  <span className="font-bold text-white tracking-wide truncate">
                    {grp.serviceName}
                  </span>
                  {grp.subServiceName && (
                    <span className="text-slate-400 font-medium text-[11px] truncate">
                      &bull; {grp.subServiceName}
                    </span>
                  )}
                </div>
                <Badge variant="outline" className="text-[10px] bg-slate-900 border-slate-700 text-slate-300 font-mono py-0 shrink-0">
                  {grp.items.length} {grp.items.length === 1 ? "dish" : "dishes"}
                </Badge>
              </div>

              {/* Dishes in this Service & Sub-Service */}
              <div className="space-y-2">
                {grp.items.map(({ it, originalIndex }) => {
                  const suggestedQty = parseFloat(((company.mg || 0) * (it.portionPerPax || 0.15)).toFixed(1))
                  const linkedRecipe = (it.recipeId ? recipeMap.get(it.recipeId) : null) || 
                    recipeMap.get(it.menuItemId) || 
                    recipeMap.get(it.name.trim().toUpperCase())
                  const isRecipeExpanded = expandAllRecipes || expandedRecipeIds.has(it.id)
                  const costInfo = getDishCostInfo ? getDishCostInfo(linkedRecipe, selectedDate) : { unitCost: 0, breakdown: [] }
                  const dishCost = (it.quantity || 0) * (costInfo.unitCost || 0)

                  return (
                    <div
                      key={"modal_it_" + it.id + originalIndex}
                      className="bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 rounded-lg p-2.5 space-y-2 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="overflow-hidden flex-1">
                          <div className="font-bold text-xs text-white flex items-center gap-1.5 truncate">
                            <Utensils className="h-3 w-3 text-orange-400 shrink-0" />
                            <span className="truncate">{it.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 flex-wrap">
                            <span className="text-slate-500">{it.category || "Dish"}</span>
                            <span>&bull;</span>
                            <span>Portion: {(it.portionPerPax * 1000).toFixed(0)}g</span>
                            {costInfo.unitCost > 0 && (
                              <>
                                <span>&bull;</span>
                                <span className="text-emerald-400 font-semibold font-mono">
                                  ₹{costInfo.unitCost.toFixed(1)}/{it.unit}
                                </span>
                                {it.quantity > 0 && (
                                  <>
                                    <span>&bull;</span>
                                    <span className="text-amber-300 font-bold font-mono">
                                      Total: ₹{dishCost.toFixed(0)}
                                    </span>
                                  </>
                                )}
                              </>
                            )}
                          </div>

                          {/* Recipe Preview Button & Expansion */}
                          {linkedRecipe && (
                            <div className="mt-1">
                              <button
                                type="button"
                                onClick={() => toggleRecipeExpand(it.id)}
                                className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium cursor-pointer"
                              >
                                <ChefHat className="h-3 w-3 text-emerald-400 shrink-0" />
                                <span className="truncate">Recipe: {linkedRecipe.name} {linkedRecipe.ingredients?.length ? `(${linkedRecipe.ingredients.length} ingr.)` : ""}</span>
                                <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${isRecipeExpanded ? "rotate-180" : ""}`} />
                              </button>

                              {/* Expanded Ingredients List */}
                              {isRecipeExpanded && linkedRecipe.ingredients && linkedRecipe.ingredients.length > 0 && (
                                <div className="mt-1.5 p-2 rounded bg-slate-900 border border-slate-800 text-[10px] space-y-1">
                                  <div className="text-[10px] text-amber-300 font-semibold flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <span>Ingredients & Rates ({selectedDate}):</span>
                                      {costInfo.unitCost > 0 && (
                                        <Badge variant="outline" className="text-[9px] px-1 py-0 bg-emerald-950 text-emerald-300 border-emerald-800 font-normal">
                                          ₹{costInfo.unitCost.toFixed(2)}/{it.unit}
                                        </Badge>
                                      )}
                                    </div>
                                    <span className="text-slate-400 font-mono">Portion: {(it.portionPerPax * 1000).toFixed(0)}g</span>
                                  </div>
                                  <div className="space-y-1 pt-0.5">
                                    {costInfo.breakdown && costInfo.breakdown.length > 0 ? (
                                      costInfo.breakdown.map((b: any, bIdx: number) => (
                                        <div key={bIdx} className="flex items-center justify-between bg-slate-950 px-2 py-1 rounded border border-slate-800/80 text-[10px]">
                                          <span className="text-slate-300 truncate max-w-[55%]">
                                            {b.name} <strong className="text-amber-400 font-mono">({b.quantity} {b.unit})</strong>
                                          </span>
                                          <div className="flex items-center gap-1 font-mono text-right shrink-0">
                                            <span className="text-slate-400 text-[9px]">
                                              @ ₹{b.effectivePrice}/{b.priceUnit}
                                              {b.effectiveDate && <span className="text-slate-500 ml-0.5">({b.effectiveDate})</span>}
                                            </span>
                                            <span className="text-emerald-400 font-bold ml-1">= ₹{b.lineCost.toFixed(2)}</span>
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="flex flex-wrap gap-1">
                                        {linkedRecipe.ingredients.map((ing: any, iIdx: number) => (
                                          <span key={iIdx} className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-slate-300 font-mono text-[10px]">
                                            {ing.ingredientName || ing.templateName || ing.oldItemName}: <strong className="text-amber-400">{ing.quantity} {ing.unit}</strong>
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-slate-500 hover:text-red-400 shrink-0 -mt-0.5 -mr-0.5"
                          onClick={() => onRemoveItem(compIdx, originalIndex)}
                          title="Remove dish"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Quantity & Unit Row with Fast Input */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
                        <div>
                          {suggestedQty > 0 && (
                            <button
                              type="button"
                              className="text-[10px] text-amber-400/90 hover:text-amber-300 font-mono underline cursor-pointer"
                              onClick={() => onUpdateItemQuantity(compIdx, originalIndex, suggestedQty)}
                              title="Click to apply suggested quantity"
                            >
                              Suggest: {suggestedQty} {it.unit} &rarr;
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <FastQuantityInput
                            value={it.quantity || 0}
                            onChange={val => onUpdateItemQuantity(compIdx, originalIndex, val)}
                            step="0.5"
                            min={0}
                            className="h-7 w-20 bg-slate-900 border-2 border-orange-500/80 text-orange-400 font-bold text-center text-xs focus-visible:ring-orange-500 pr-5"
                            placeholder="0"
                          />
                          <Select
                            value={it.unit || "Kg"}
                            onValueChange={v => onUpdateItemUnit(compIdx, originalIndex, v)}
                          >
                            <SelectTrigger className="h-7 w-16 text-[11px] bg-slate-900 border-slate-700 text-slate-300 px-1.5">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                              <SelectItem value="Kg">Kg</SelectItem>
                              <SelectItem value="Ltr">Ltr</SelectItem>
                              <SelectItem value="Pcs">Pcs</SelectItem>
                              <SelectItem value="Portion">Portion</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Column Footer */}
      <div className="p-2.5 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
        <span>Total Volume:</span>
        <span className="font-bold text-emerald-400 font-mono text-xs">{compTotalKg.toFixed(1)} Kg</span>
      </div>
    </div>
  )
})
ModalCompanyCard.displayName = "ModalCompanyCard"

export default function DispatchManagementPage() {
  // Current selected date (YYYY-MM-DD)
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], [])
  const [selectedDate, setSelectedDate] = useState<string>(todayStr)
  const [inputDate, setInputDate] = useState<string>(todayStr)

  const [loading, setLoading] = useState(true)
  const [isApplyingDate, setIsApplyingDate] = useState(false)
  const [isCalculating, setIsCalculating] = useState(false)
  const [calculatingCompanyIdx, setCalculatingCompanyIdx] = useState<number | null>(null)
  const [isModalLoading, setIsModalLoading] = useState(false)
  const [isOpeningModal, setIsOpeningModal] = useState(false)
  const [isClosingModal, setIsClosingModal] = useState(false)
  const [visibleBatchLimit, setVisibleBatchLimit] = useState<number>(8)
  const [isSaving, setIsSaving] = useState(false)
  const [isAutoLoading, setIsAutoLoading] = useState(false)

  // Master lists
  const [allCompanies, setAllCompanies] = useState<{ id: string; name: string }[]>([])
  const [allMenuItems, setAllMenuItems] = useState<MenuItem[]>([])
  const [allServices, setAllServices] = useState<Service[]>([])
  const [allSubServices, setAllSubServices] = useState<SubService[]>([])
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([])
  const [isCostModalOpen, setIsCostModalOpen] = useState(false)
  const [recipeMap, setRecipeMap] = useState<Map<string, any>>(new Map()) // menuItemId -> recipe

  // Active day dispatch state
  const [companiesDispatch, setCompaniesDispatch] = useState<CompanyDispatch[]>([])
  const [dispatchStatus, setDispatchStatus] = useState<"draft" | "confirmed" | "dispatched">("draft")

  // Modal Service & Sub-Service Filter state with smooth switching & tactile button loader
  const [modalServiceFilter, setModalServiceFilter] = useState<string>("ALL")
  const [modalSubServiceFilter, setModalSubServiceFilter] = useState<string>("ALL")
  const [isServiceSwitching, setIsServiceSwitching] = useState<boolean>(false)
  const [switchingServiceName, setSwitchingServiceName] = useState<string | null>(null)

  const handleSelectServiceFilter = useCallback((sName: string) => {
    if (modalServiceFilter === sName) return
    setIsServiceSwitching(true)
    setSwitchingServiceName(sName)
    setTimeout(() => {
      React.startTransition(() => {
        setModalServiceFilter(sName)
        setModalSubServiceFilter("ALL")
        setIsServiceSwitching(false)
        setSwitchingServiceName(null)
      })
    }, 35)
  }, [modalServiceFilter])

  // Recipe ingredients expansion states
  const [expandedRecipeIds, setExpandedRecipeIds] = useState<Set<string>>(new Set())
  const [expandAllRecipes, setExpandAllRecipes] = useState<boolean>(false)

  const toggleRecipeExpand = useCallback((itemId: string) => {
    setExpandedRecipeIds(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }, [])

  // Add Item to Company Modal state
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false)
  const [activeCompanyIndex, setActiveCompanyIndex] = useState<number>(-1)
  const [itemSearch, setItemSearch] = useState("")
  const [addDishService, setAddDishService] = useState<string>("Lunch")
  const [addDishSubService, setAddDishSubService] = useState<string>("")

  // Add Company to Grid Modal state
  const [isAddCompanyModalOpen, setIsAddCompanyModalOpen] = useState(false)
  const [companySearch, setCompanySearch] = useState("")

  // Fullscreen Side-by-Side Grid Modal state
  const [isFullModalOpen, setIsFullModalOpen] = useState(false)

  // Open Full Modal with instant click feedback and non-blocking mount
  const handleOpenFullModal = useCallback(() => {
    setIsOpeningModal(true)
    setTimeout(() => {
      setIsModalLoading(true)
      setIsFullModalOpen(true)
      setIsOpeningModal(false)
      setTimeout(() => {
        setIsModalLoading(false)
        setVisibleBatchLimit(9999)
      }, 70)
    }, 25)
  }, [])

  // Close Full Modal with smooth feedback
  const handleCloseFullModal = useCallback(() => {
    setIsClosingModal(true)
    setTimeout(() => {
      setIsFullModalOpen(false)
      setIsClosingModal(false)
    }, 25)
  }, [])

  // Fast Lookup Maps
  const menuItemsMap = useMemo(() => {
    const map = new Map<string, MenuItem>()
    allMenuItems.forEach(m => map.set(m.id, m))
    return map
  }, [allMenuItems])

  const servicesMap = useMemo(() => {
    const map = new Map<string, Service>()
    allServices.forEach(s => map.set(s.id, s))
    return map
  }, [allServices])

  const subServicesMap = useMemo(() => {
    const map = new Map<string, SubService>()
    allSubServices.forEach(ss => map.set(ss.id, ss))
    return map
  }, [allSubServices])

  const ingredientsMap = useMemo(() => {
    const map = new Map<string, Ingredient>()
    allIngredients.forEach(ing => {
      map.set(ing.id, ing)
      if (ing.name) {
        map.set(ing.name.trim().toLowerCase(), ing)
        map.set(ing.name.trim().toUpperCase(), ing)
      }
    })
    return map
  }, [allIngredients])

  // Memoized date-aware dish recipe cost resolver based on target selectedDate
  const getDishCostInfo = useCallback((recipe: any, targetDate: string) => {
    if (!recipe || !recipe.ingredients || recipe.ingredients.length === 0) {
      return { unitCost: 0, totalIngCost: 0, totalRawWeightKg: 0, breakdown: [] }
    }

    let totalIngCost = 0
    let totalRawWeightKg = 0
    const breakdown: {
      name: string
      quantity: number
      unit: string
      effectivePrice: number
      priceUnit: string
      effectiveDate: string
      session?: string
      lineCost: number
    }[] = []

    recipe.ingredients.forEach((ing: any) => {
      const matchedIng = (ing.ingredientId ? ingredientsMap.get(ing.ingredientId) : null) ||
        (ing.ingredientName ? (ingredientsMap.get(ing.ingredientName.trim().toLowerCase()) || ingredientsMap.get(ing.ingredientName.trim().toUpperCase())) : null) ||
        (ing.oldItemName ? (ingredientsMap.get(ing.oldItemName.trim().toLowerCase()) || ingredientsMap.get(ing.oldItemName.trim().toUpperCase())) : null)

      const eff = getEffectiveIngredientPrice(matchedIng, targetDate)
      const lineCost = calculateIngredientCost(ing.quantity || 0, ing.unit || "Kg", eff.price, eff.unit)
      totalIngCost += lineCost

      const qUnit = (ing.unit || "").toLowerCase().trim()
      let weightInKg = 0
      if (qUnit === "kg" || qUnit === "kgs") weightInKg = ing.quantity || 0
      else if (qUnit === "g" || qUnit === "gm" || qUnit === "grams") weightInKg = (ing.quantity || 0) / 1000
      else if (qUnit === "ltr" || qUnit === "l") weightInKg = ing.quantity || 0
      else if (qUnit === "ml") weightInKg = (ing.quantity || 0) / 1000
      totalRawWeightKg += weightInKg

      breakdown.push({
        name: matchedIng?.name || ing.ingredientName || ing.templateName || ing.oldItemName || "Ingredient",
        quantity: ing.quantity || 0,
        unit: ing.unit || "Kg",
        effectivePrice: eff.price,
        priceUnit: eff.unit,
        effectiveDate: eff.effectiveDate,
        session: eff.session,
        lineCost,
        rateType: eff.rateType || (eff.hasDynamicDateRate ? "dynamic" : "default")
      })
    })

    let costPerUnit = 0
    if (recipe.isPiece) {
      costPerUnit = totalIngCost
    } else if (totalRawWeightKg > 0.01) {
      costPerUnit = totalIngCost / totalRawWeightKg
    } else if (recipe.inGram && recipe.inGram > 0) {
      costPerUnit = totalIngCost / recipe.inGram
    } else {
      costPerUnit = totalIngCost
    }

    return {
      unitCost: costPerUnit,
      totalIngCost,
      totalRawWeightKg,
      breakdown
    }
  }, [ingredientsMap])

  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    try {
      setLoading(true)
      // Load companies, services, subServices, menuItems, recipeMaster in parallel
      const [compSnap, srvs, subs, items, recipeSnap, ings] = await Promise.all([
        getDocs(collection(db, "companies")),
        servicesService.getAll().catch(() => []),
        subServicesService.getAll().catch(() => []),
        menuItemsService.getAll().catch(() => []),
        getDocs(collection(db, "recipeMaster")).catch(() => ({ docs: [] } as any)),
        ingredientsService.getAll().catch(() => [])
      ])

      const comps = compSnap.docs.map(d => ({ id: d.id, name: (d.data().name || "Unnamed") as string }))
      setAllCompanies(comps)
      setAllServices(srvs || [])
      setAllSubServices(subs || [])
      setAllMenuItems(items || [])
      setAllIngredients(ings || [])

      const rMap = new Map<string, any>()
      recipeSnap.docs.forEach((d: any) => {
        const data = d.data()
        if (data.menuItemId) rMap.set(data.menuItemId, { id: d.id, ...data })
        if (data.name) rMap.set(data.name.trim().toUpperCase(), { id: d.id, ...data })
      })
      setRecipeMap(rMap)

      // Build instant lookup maps for immediate dispatch population
      const itemMap = new Map<string, MenuItem>()
      items.forEach(m => itemMap.set(m.id, m))
      const sMap = new Map<string, Service>()
      srvs.forEach(s => sMap.set(s.id, s))
      const ssMap = new Map<string, SubService>()
      subs.forEach(ss => ssMap.set(ss.id, ss))

      // Load today's dispatch with all master data ready
      await loadDispatchForDate(todayStr, itemMap, sMap, ssMap, rMap, comps)
    } catch (err) {
      console.error("Error loading master data:", err)
      toast({ title: "Error", description: "Failed to load master data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // Helper to extract dishes with their Service and Sub-Service hierarchy from companyMenus
  const extractHierarchicalDishes = (
    dayData: any,
    sMap: Map<string, Service>,
    ssMap: Map<string, SubService>
  ): Array<{ itemId: string; serviceId?: string; serviceName?: string; subServiceId?: string; subServiceName?: string }> => {
    if (!dayData || typeof dayData !== "object") return []

    const results: Array<{ itemId: string; serviceId?: string; serviceName?: string; subServiceId?: string; subServiceName?: string }> = []
    const seen = new Set<string>()

    const walk = (
      curr: any,
      curSvcId?: string,
      curSvcName?: string,
      curSubId?: string,
      curSubName?: string
    ) => {
      if (!curr || typeof curr !== "object") return

      // If this node contains menuItemIds array
      if (Array.isArray(curr.menuItemIds)) {
        curr.menuItemIds.forEach((itemId: string) => {
          if (!itemId) return
          const dedupeKey = `${itemId}__${curSvcId || ''}__${curSubId || ''}`
          if (!seen.has(dedupeKey)) {
            seen.add(dedupeKey)
            results.push({
              itemId,
              serviceId: curSvcId,
              serviceName: curSvcName || (curSvcId ? sMap.get(curSvcId)?.name : undefined),
              subServiceId: curSubId,
              subServiceName: curSubName || (curSubId ? ssMap.get(curSubId)?.name : undefined)
            })
          }
        })
      }

      // Check keys for Service or Sub-Service IDs
      for (const key of Object.keys(curr)) {
        const val = curr[key]
        if (!val || typeof val !== "object") continue

        let nextSvcId = curSvcId
        let nextSvcName = curSvcName
        let nextSubId = curSubId
        let nextSubName = curSubName

        if (sMap.has(key)) {
          nextSvcId = key
          nextSvcName = sMap.get(key)?.name || "Service"
        } else if (ssMap.has(key)) {
          nextSubId = key
          nextSubName = ssMap.get(key)?.name || "Sub-Service"
          const parentSvcId = ssMap.get(key)?.serviceId
          if (parentSvcId && sMap.has(parentSvcId)) {
            nextSvcId = parentSvcId
            nextSvcName = sMap.get(parentSvcId)?.name || "Service"
          }
        }

        walk(val, nextSvcId, nextSvcName, nextSubId, nextSubName)
      }
    }

    walk(dayData)
    return results
  }

  // Load dispatch document for a specific date
  const loadDispatchForDate = async (
    dateStr: string,
    passedItemMap?: Map<string, MenuItem>,
    passedSMap?: Map<string, Service>,
    passedSSMap?: Map<string, SubService>,
    passedRMap?: Map<string, any>,
    passedComps?: { id: string; name: string }[]
  ) => {
    try {
      setLoading(true)
      const docId = `dispatch_${dateStr}`
      const docSnap = await getDoc(doc(db, "dailyDispatch", docId))

      const curItemMap = passedItemMap || menuItemsMap
      const curSMap = passedSMap || servicesMap
      const curSSMap = passedSSMap || subServicesMap
      const curRMap = passedRMap || recipeMap
      const curComps = passedComps || allCompanies

      if (docSnap.exists()) {
        const data = docSnap.data() as DailyDispatchDocument
        // Repair dish names & service metadata in case any were saved as "Dish #..."
        const repairedCompanies = (data.companies || []).map(comp => ({
          ...comp,
          items: comp.items.map(it => {
            let realName = it.name
            if (it.menuItemId && curItemMap.has(it.menuItemId)) {
              realName = curItemMap.get(it.menuItemId)!.name
            } else if ((!realName || realName.startsWith("Dish #")) && it.recipeName) {
              realName = it.recipeName
            }
            return {
              ...it,
              name: realName || `Dish #${it.menuItemId?.slice(0, 6) || "item"}`
            }
          })
        }))
        setCompaniesDispatch(repairedCompanies)
        setDispatchStatus(data.status || "draft")
      } else {
        // No saved dispatch yet: auto-populate from companyMenus with service & subService hierarchy
        await autoPopulateFromMenus(dateStr, false, curItemMap, curSMap, curSSMap, curRMap, curComps)
      }
    } catch (err) {
      console.error("Error loading daily dispatch:", err)
    } finally {
      setLoading(false)
    }
  }

  // Auto-populate from companyMenus collection for the selected date
  const autoPopulateFromMenus = async (
    dateStr: string,
    showToast = true,
    passedItemMap?: Map<string, MenuItem>,
    passedSMap?: Map<string, Service>,
    passedSSMap?: Map<string, SubService>,
    passedRMap?: Map<string, any>,
    passedComps?: { id: string; name: string }[]
  ) => {
    try {
      setIsAutoLoading(true)
      const curItemMap = passedItemMap || menuItemsMap
      const curSMap = passedSMap || servicesMap
      const curSSMap = passedSSMap || subServicesMap
      const curRMap = passedRMap || recipeMap
      const curComps = passedComps || allCompanies

      // Query companyMenus that cover this date
      const q = query(
        collection(db, "companyMenus"),
        where("startDate", "<=", dateStr)
      )
      const snap = await getDocs(q)
      
      const newCompanyDispatches: CompanyDispatch[] = []

      snap.docs.forEach(docSnap => {
        const data = docSnap.data()
        // Check if date is within range
        if (data.endDate && data.endDate >= dateStr && data.menuData && data.menuData[dateStr]) {
          const extractedDishes = extractHierarchicalDishes(data.menuData[dateStr], curSMap, curSSMap)
          
          if (extractedDishes.length > 0) {
            const items: DispatchMenuItem[] = extractedDishes.map((dish, idx) => {
              const menuItem = curItemMap.get(dish.itemId)
              const dishName = menuItem?.name || `Dish #${dish.itemId.slice(0, 6)}`
              
              // Find matching recipe for portion weight and estimated cost
              const recipe = curRMap.get(dish.itemId) || curRMap.get(dishName.trim().toUpperCase())
              const portionWeight = recipe?.inGram ? recipe.inGram : 0.15 // default 150g

              return {
                id: `item_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
                menuItemId: dish.itemId,
                name: dishName,
                category: menuItem?.category || recipe?.category || "General",
                serviceId: dish.serviceId || "",
                serviceName: dish.serviceName || "General",
                subServiceId: dish.subServiceId || "",
                subServiceName: dish.subServiceName || "",
                quantity: 0,
                unit: recipe?.isPiece ? "Pcs" : "Kg",
                portionPerPax: portionWeight,
                recipeId: recipe?.id,
                recipeName: recipe?.name
              }
            })

            newCompanyDispatches.push({
              companyId: data.companyId || docSnap.id,
              companyName: data.companyName || "Unknown Company",
              buildingId: data.buildingId || "",
              buildingName: data.buildingName || "",
              mg: 100, // default MG
              items: items
            })
          }
        }
      })

      // If no companyMenus found, create default empty cards for top companies (e.g. Amdocs, Amway)
      if (newCompanyDispatches.length === 0 && curComps.length > 0) {
        const sampleComps = curComps.slice(0, 3)
        sampleComps.forEach(c => {
          newCompanyDispatches.push({
            companyId: c.id,
            companyName: c.name,
            mg: 100,
            items: []
          })
        })
      }

      setCompaniesDispatch(newCompanyDispatches)
      if (showToast) {
        toast({
          title: "Menus Loaded",
          description: `Loaded scheduled menus with services & sub-services for ${newCompanyDispatches.length} companies on ${dateStr}.`
        })
      }
    } catch (err) {
      console.error("Error auto-populating from menus:", err)
      if (showToast) {
        toast({ title: "Failed", description: "Could not auto-populate menus", variant: "destructive" })
      }
    } finally {
      setIsAutoLoading(false)
    }
  }

  // Update MG (Minimum Guarantee) for a company
  const handleUpdateMG = useCallback((companyIdx: number, newMG: number) => {
    setCompaniesDispatch(prev => {
      const copy = [...prev]
      copy[companyIdx] = {
        ...copy[companyIdx],
        mg: Math.max(0, newMG)
      }
      return copy
    })
  }, [])

  // Auto-calculate suggested quantities for a company based on MG × Portion
  const handleAutoCalcQuantities = useCallback((companyIdx: number) => {
    setCalculatingCompanyIdx(companyIdx)
    setTimeout(() => {
      setCompaniesDispatch(prev => {
        const copy = [...prev]
        const comp = copy[companyIdx]
        if (!comp) return prev
        const mg = comp.mg || 0

        const updatedItems = comp.items.map(it => {
          // Suggest quantity = MG * portion (rounded to 1 decimal place)
          const calcQty = parseFloat((mg * (it.portionPerPax || 0.15)).toFixed(1))
          return {
            ...it,
            quantity: calcQty > 0 ? calcQty : 1
          }
        })

        copy[companyIdx] = {
          ...comp,
          items: updatedItems
        }
        return copy
      })

      setCalculatingCompanyIdx(null)
      toast({
        title: "Quantities Calculated",
        description: `Auto-filled recommended quantities based on MG.`
      })
    }, 60)
  }, [])

  // Auto-calculate suggested quantities for ALL companies
  const handleAutoCalcAll = () => {
    setIsCalculating(true)
    setTimeout(() => {
      setCompaniesDispatch(prev => {
        return prev.map(comp => {
          const mg = comp.mg || 0
          const updatedItems = comp.items.map(it => {
            const calcQty = parseFloat((mg * (it.portionPerPax || 0.15)).toFixed(1))
            return {
              ...it,
              quantity: calcQty > 0 ? calcQty : 1
            }
          })
          return {
            ...comp,
            items: updatedItems
          }
        })
      })

      setIsCalculating(false)
      toast({
        title: "All Quantities Calculated!",
        description: "Populated recommended dispatch quantities for all companies based on MG."
      })
    }, 100)
  }

  // Update quantity for an item
  const handleUpdateItemQuantity = useCallback((companyIdx: number, itemIdx: number, qty: number) => {
    setCompaniesDispatch(prev => {
      const copy = [...prev]
      const comp = { ...copy[companyIdx] }
      const items = [...comp.items]
      items[itemIdx] = {
        ...items[itemIdx],
        quantity: Math.max(0, qty)
      }
      comp.items = items
      copy[companyIdx] = comp
      return copy
    })
  }, [])

  // Update unit for an item
  const handleUpdateItemUnit = useCallback((companyIdx: number, itemIdx: number, unit: string) => {
    setCompaniesDispatch(prev => {
      const copy = [...prev]
      const comp = { ...copy[companyIdx] }
      const items = [...comp.items]
      items[itemIdx] = {
        ...items[itemIdx],
        unit: unit
      }
      comp.items = items
      copy[companyIdx] = comp
      return copy
    })
  }, [])

  // Remove an item from a company
  const handleRemoveItem = useCallback((companyIdx: number, itemIdx: number) => {
    setCompaniesDispatch(prev => {
      const copy = [...prev]
      const comp = { ...copy[companyIdx] }
      comp.items = comp.items.filter((_, idx) => idx !== itemIdx)
      copy[companyIdx] = comp
      return copy
    })
  }, [])

  // Remove an entire company from today's grid
  const handleRemoveCompany = useCallback((companyIdx: number) => {
    setCompaniesDispatch(prev => prev.filter((_, idx) => idx !== companyIdx))
  }, [])

  // Open Add Item modal
  const handleOpenAddItem = useCallback((companyIdx: number) => {
    setActiveCompanyIndex(companyIdx)
    setItemSearch("")
    setIsAddItemModalOpen(true)
  }, [])

  // Add Item to company
  const handleAddItemToCompany = (menuItem: { id: string; name: string; category?: string }) => {
    if (activeCompanyIndex === -1) return

    const recipe = recipeMap.get(menuItem.id) || recipeMap.get(menuItem.name.trim().toUpperCase())
    const portionWeight = recipe?.inGram || 0.15

    const newItem: DispatchMenuItem = {
      id: `item_${Date.now()}_${Math.random()}`,
      menuItemId: menuItem.id,
      name: menuItem.name,
      category: menuItem.category || recipe?.category || "General",
      serviceName: addDishService || "Lunch",
      subServiceName: addDishSubService || "",
      quantity: 0,
      unit: recipe?.isPiece ? "Pcs" : "Kg",
      portionPerPax: portionWeight,
      recipeId: recipe?.id,
      recipeName: recipe?.name
    }

    setCompaniesDispatch(prev => {
      const copy = [...prev]
      const comp = { ...copy[activeCompanyIndex] }
      comp.items = [...comp.items, newItem]
      copy[activeCompanyIndex] = comp
      return copy
    })

    setIsAddItemModalOpen(false)
    toast({
      title: "Dish Added",
      description: `Added "${menuItem.name}" to ${companiesDispatch[activeCompanyIndex].companyName}.`
    })
  }

  // Add Company to Grid
  const handleAddCompanyToGrid = (company: { id: string; name: string }) => {
    if (companiesDispatch.some(c => c.companyId === company.id)) {
      toast({ title: "Already in Grid", description: `${company.name} is already in the dispatch grid.` })
      return
    }

    const newComp: CompanyDispatch = {
      companyId: company.id,
      companyName: company.name,
      mg: 100,
      items: []
    }

    setCompaniesDispatch(prev => [...prev, newComp])
    setIsAddCompanyModalOpen(false)
    toast({
      title: "Company Added",
      description: `Added ${company.name} to today's dispatch grid.`
    })
  }

  // Save full dispatch to Firestore
  const handleSaveDispatch = async () => {
    setIsSaving(true)
    try {
      const docId = `dispatch_${selectedDate}`
      const totalMG = companiesDispatch.reduce((acc, c) => acc + (c.mg || 0), 0)
      const totalWeight = companiesDispatch.reduce(
        (acc, c) => acc + c.items.reduce((s, it) => s + (it.unit === "Kg" ? it.quantity || 0 : 0), 0),
        0
      )

      const payload: DailyDispatchDocument = {
        id: docId,
        date: selectedDate,
        status: dispatchStatus,
        totalMG: totalMG,
        totalWeightKg: totalWeight,
        companies: companiesDispatch,
        updatedAt: serverTimestamp()
      }

      await setDoc(doc(db, "dailyDispatch", docId), payload, { merge: true })

      toast({
        title: "Dispatch Saved!",
        description: `Successfully saved daily dispatch for ${selectedDate}.`
      })
    } catch (err: any) {
      console.error("Error saving dispatch:", err)
      toast({ title: "Save Failed", description: err.message, variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  // Apply Date helper with loading state
  const handleApplyDate = async (newDate?: string) => {
    const targetDate = newDate || inputDate
    if (!targetDate) return
    setIsApplyingDate(true)
    try {
      setSelectedDate(targetDate)
      await loadDispatchForDate(targetDate)
      toast({
        title: "Date Applied",
        description: `Loaded dispatch records for ${targetDate}.`
      })
    } catch (err) {
      console.error("Failed to apply date:", err)
      toast({ title: "Error", description: "Failed to load dispatch data for date", variant: "destructive" })
    } finally {
      setIsApplyingDate(false)
    }
  }

  // Date step helper
  const stepDate = (days: number) => {
    const d = new Date(inputDate)
    d.setDate(d.getDate() + days)
    const nextDate = d.toISOString().split("T")[0]
    setInputDate(nextDate)
    handleApplyDate(nextDate)
  }

  // Calculate day metrics
  const totalMGAll = useMemo(() => {
    return companiesDispatch.reduce((acc, c) => acc + (c.mg || 0), 0)
  }, [companiesDispatch])

  const totalDispatchedKg = useMemo(() => {
    return companiesDispatch.reduce((acc, c) => {
      return acc + c.items.reduce((s, it) => s + (it.unit === "Kg" ? it.quantity || 0 : 0), 0)
    }, 0)
  }, [companiesDispatch])

  const totalDispatchedPcs = useMemo(() => {
    return companiesDispatch.reduce((acc, c) => {
      return acc + c.items.reduce((s, it) => s + (it.unit === "Pcs" ? it.quantity || 0 : 0), 0)
    }, 0)
  }, [companiesDispatch])

  const totalDishesCount = useMemo(() => {
    return companiesDispatch.reduce((acc, c) => acc + c.items.length, 0)
  }, [companiesDispatch])

  // Total Day Food Cost based on target selectedDate
  const totalDayFoodCost = useMemo(() => {
    return companiesDispatch.reduce((acc, comp) => {
      const compCost = comp.items.reduce((cAcc, it) => {
        const linkedRecipe = (it.recipeId ? recipeMap.get(it.recipeId) : null) || 
          recipeMap.get(it.menuItemId) || 
          recipeMap.get(it.name.trim().toUpperCase())
        const costInfo = getDishCostInfo(linkedRecipe, selectedDate)
        return cAcc + ((it.quantity || 0) * (costInfo.unitCost || 0))
      }, 0)
      return acc + compCost
    }, 0)
  }, [companiesDispatch, recipeMap, selectedDate, getDishCostInfo])

  // Consolidated Ingredients Procurement List for the day (Nirbhay Sir's Operations)
  const consolidatedProcurement = useMemo(() => {
    const ingMap = new Map<string, {
      name: string
      totalQty: number
      unit: string
      effectivePrice: number
      priceUnit: string
      effectiveDate: string
      session?: string
      rateType?: "default" | "dynamic"
      totalCost: number
      usedInDishes: Set<string>
    }>()

    companiesDispatch.forEach(comp => {
      comp.items.forEach(it => {
        const qty = it.quantity || 0
        if (qty <= 0) return

        const linkedRecipe = (it.recipeId ? recipeMap.get(it.recipeId) : null) || 
          recipeMap.get(it.menuItemId) || 
          recipeMap.get(it.name.trim().toUpperCase())

        if (!linkedRecipe || !linkedRecipe.ingredients || linkedRecipe.ingredients.length === 0) return

        const costInfo = getDishCostInfo(linkedRecipe, selectedDate)
        const scale = costInfo.totalRawWeightKg > 0.01 ? (qty / costInfo.totalRawWeightKg) : (qty)

        linkedRecipe.ingredients.forEach((ing: any) => {
          const key = (ing.ingredientId || ing.ingredientName || ing.oldItemName || "").trim().toLowerCase()
          if (!key) return

          const matchedIng = (ing.ingredientId ? ingredientsMap.get(ing.ingredientId) : null) ||
            (ing.ingredientName ? (ingredientsMap.get(ing.ingredientName.trim().toLowerCase()) || ingredientsMap.get(ing.ingredientName.trim().toUpperCase())) : null)

          const eff = getEffectiveIngredientPrice(matchedIng, selectedDate)
          const scaledQty = (ing.quantity || 0) * scale
          const lineCost = calculateIngredientCost(scaledQty, ing.unit || "Kg", eff.price, eff.unit)

          const existing = ingMap.get(key)
          if (existing) {
            existing.totalQty += scaledQty
            existing.totalCost += lineCost
            existing.usedInDishes.add(it.name)
          } else {
            ingMap.set(key, {
              name: matchedIng?.name || ing.ingredientName || ing.templateName || ing.oldItemName || "Ingredient",
              totalQty: scaledQty,
              unit: ing.unit || "Kg",
              effectivePrice: eff.price,
              priceUnit: eff.unit,
              effectiveDate: eff.effectiveDate,
              session: eff.session,
              rateType: eff.rateType || (eff.hasDynamicDateRate ? "dynamic" : "default"),
              totalCost: lineCost,
              usedInDishes: new Set([it.name])
            })
          }
        })
      })
    })

    return Array.from(ingMap.values()).sort((a, b) => b.totalCost - a.totalCost)
  }, [companiesDispatch, recipeMap, selectedDate, ingredientsMap, getDishCostInfo])

  // Filtered menu items for Add Modal
  const filteredModalMenuItems = useMemo(() => {
    if (!itemSearch.trim()) return allMenuItems.slice(0, 40)
    const term = itemSearch.toLowerCase().trim()
    return allMenuItems
      .filter(m => m.name.toLowerCase().includes(term) || m.category?.toLowerCase().includes(term))
      .slice(0, 40)
  }, [allMenuItems, itemSearch])

  // Filtered companies for Add Company Modal
  const filteredModalCompanies = useMemo(() => {
    if (!companySearch.trim()) return allCompanies
    const term = companySearch.toLowerCase().trim()
    return allCompanies.filter(c => c.name.toLowerCase().includes(term))
  }, [allCompanies, companySearch])

  // Consolidated Production Kitchen Batch Summary
  const consolidatedDishes = useMemo(() => {
    const summaryMap = new Map<string, { name: string; category?: string; totalQty: number; unit: string; companies: string[] }>()
    companiesDispatch.forEach(comp => {
      comp.items.forEach(it => {
        const key = `${it.name.trim().toUpperCase()}_${it.unit}`
        if (!summaryMap.has(key)) {
          summaryMap.set(key, {
            name: it.name,
            category: it.category,
            totalQty: 0,
            unit: it.unit,
            companies: []
          })
        }
        const entry = summaryMap.get(key)!
        entry.totalQty += it.quantity || 0
        if (!entry.companies.includes(comp.companyName)) {
          entry.companies.push(comp.companyName)
        }
      })
    })
    return Array.from(summaryMap.values()).sort((a, b) => b.totalQty - a.totalQty)
  }, [companiesDispatch])

  // Pre-computed distinct services and sub-services for high-speed filter switching
  const availableServicesForModal = useMemo(() => {
    const serviceSet = new Set<string>()
    allServices.forEach(s => serviceSet.add(s.name))
    companiesDispatch.forEach(c => c.items.forEach(it => { if (it.serviceName) serviceSet.add(it.serviceName) }))
    return Array.from(serviceSet)
  }, [allServices, companiesDispatch])

  const availableSubServicesForModal = useMemo(() => {
    if (modalServiceFilter === "ALL") return []
    const subSet = new Set<string>()
    allSubServices
      .filter(ss => {
        const parent = allServices.find(s => s.name === modalServiceFilter || s.id === modalServiceFilter)
        return !parent || ss.serviceId === parent.id
      })
      .forEach(ss => subSet.add(ss.name))
    companiesDispatch.forEach(c => c.items.forEach(it => {
      if (it.serviceName === modalServiceFilter && it.subServiceName) {
        subSet.add(it.subServiceName)
      }
    }))
    return Array.from(subSet)
  }, [allSubServices, allServices, modalServiceFilter, companiesDispatch])

  return (
    <div className="flex-1 space-y-5 p-4 md:p-8 pt-6">
      {/* Header & Date Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2.5">
            <Truck className="h-8 w-8 text-orange-500" />
            Daily Food Dispatch &amp; MG Manager
          </h2>
          <p className="text-muted-foreground text-sm">
            Manage company-wise planned menu dishes, dispatched quantities, and Minimum Guarantee (MG) headcount.
          </p>
        </div>

        {/* Date Selector & Primary Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Step Controls */}
          <div className="flex items-center rounded-lg border bg-card p-1 shadow-xs">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => stepDate(-1)} disabled={isApplyingDate}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1.5 px-2">
              <Calendar className="h-4 w-4 text-orange-500" />
              <Input
                type="date"
                value={inputDate}
                onChange={e => setInputDate(e.target.value)}
                className="h-8 w-36 border-0 text-xs font-semibold focus-visible:ring-0"
              />
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => stepDate(1)} disabled={isApplyingDate}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="h-8 text-xs px-2"
              onClick={() => {
                setInputDate(todayStr)
                handleApplyDate(todayStr)
              }}
              disabled={isApplyingDate}
            >
              Today
            </Button>
          </div>

          {/* Apply Date Button with Loader */}
          <Button
            size="sm"
            onClick={() => handleApplyDate(inputDate)}
            disabled={isApplyingDate}
            className="h-10 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs gap-1.5 px-3.5 shadow-xs"
          >
            {isApplyingDate ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-400" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 text-orange-400" />
            )}
            {isApplyingDate ? "Applying..." : "Apply Date"}
          </Button>

          {/* Open in Full Modal (Side-by-Side Grid) */}
          <Button
            size="sm"
            onClick={handleOpenFullModal}
            disabled={isOpeningModal}
            className="h-10 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-bold gap-2 px-4 shadow-sm transition-all"
          >
            {isOpeningModal ? (
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
            {isOpeningModal ? "Opening Workspace..." : "Open in Full Modal (4-Card Grid)"}
          </Button>

          {/* Day Food Cost & Procurement Report Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsCostModalOpen(true)}
            className="h-10 border-emerald-500/50 text-emerald-700 bg-emerald-50/60 hover:bg-emerald-100 font-bold gap-1.5 px-3.5 shadow-2xs"
          >
            <IndianRupee className="h-4 w-4 text-emerald-600" />
            Day Cost & Procurement
          </Button>

          {/* Auto Populate Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => autoPopulateFromMenus(selectedDate, true)}
            disabled={isAutoLoading}
            className="h-10 text-xs gap-1.5"
          >
            <Sparkles className={`h-4 w-4 text-amber-500 ${isAutoLoading ? "animate-spin" : ""}`} />
            Auto-Fill Scheduled Menus
          </Button>

          {/* Add Company Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddCompanyModalOpen(true)}
            className="h-10 text-xs gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Add Company
          </Button>

          {/* Save Button */}
          <Button
            size="sm"
            onClick={handleSaveDispatch}
            disabled={isSaving}
            className="h-10 bg-orange-600 hover:bg-orange-700 text-white gap-1.5 px-4 shadow-sm"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save Dispatch Plan"}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        <Card className="bg-gradient-to-br from-white to-slate-50 border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Companies in Grid
            </CardTitle>
            <Building2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{companiesDispatch.length}</div>
            <p className="text-xs text-muted-foreground">Active delivery locations</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50/50 to-orange-50/40 border-amber-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-amber-900 uppercase tracking-wider">
              Total Minimum Guarantee
            </CardTitle>
            <Users className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">{totalMGAll.toLocaleString()} pax</div>
            <p className="text-xs text-amber-700 font-medium">Consolidated MG headcount</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50/50 to-teal-50/40 border-emerald-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-emerald-900 uppercase tracking-wider">
              Total Dispatched Volume
            </CardTitle>
            <Scale className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">
              {totalDispatchedKg.toFixed(1)} Kg
              {totalDispatchedPcs > 0 && <span className="text-sm font-normal text-muted-foreground ml-1.5">+ {totalDispatchedPcs} pcs</span>}
            </div>
            <p className="text-xs text-emerald-700 font-medium">Consolidated food weight</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-white to-slate-50 border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Planned Dishes
            </CardTitle>
            <Utensils className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDishesCount} items</div>
            <p className="text-xs text-muted-foreground">{consolidatedDishes.length} unique dishes prepared</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 via-teal-50/60 to-cyan-50/40 border-emerald-300 shadow-xs cursor-pointer hover:border-emerald-400 transition-colors col-span-2 md:col-span-1" onClick={() => setIsCostModalOpen(true)}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1">
              <span>Day Food Costing</span>
            </CardTitle>
            <IndianRupee className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-emerald-700">
              ₹{totalDayFoodCost.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </div>
            <div className="flex items-center justify-between text-xs text-emerald-800 font-medium mt-0.5">
              <span>{totalMGAll > 0 ? `₹${(totalDayFoodCost / totalMGAll).toFixed(1)}/pax` : `Rate: ${selectedDate}`}</span>
              <span className="text-blue-600 hover:underline flex items-center gap-0.5 text-[11px]">
                Report &rarr;
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content: Company-Wise Whole Day Dispatch Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-3">
          <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
          <p className="text-sm text-muted-foreground">Loading day dispatch grid...</p>
        </div>
      ) : companiesDispatch.length === 0 ? (
        <Card className="text-center py-16 border-dashed">
          <CardContent className="space-y-4">
            <Truck className="h-12 w-12 text-muted-foreground mx-auto opacity-40" />
            <div>
              <h3 className="text-lg font-semibold">No Dispatch Plan for {selectedDate}</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
                You can auto-fill dishes from scheduled menus or add companies manually to start planning food dispatch.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                size="sm"
                className="bg-orange-600 hover:bg-orange-700 text-white gap-1.5"
                onClick={() => autoPopulateFromMenus(selectedDate, true)}
              >
                <Sparkles className="h-4 w-4" />
                Auto-Fill Scheduled Menus
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddCompanyModalOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add Company Manually
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {companiesDispatch.map((company, compIdx) => {
            const compTotalKg = company.items
              .filter(i => i.unit === "Kg")
              .reduce((s, i) => s + (i.quantity || 0), 0)

            const compTotalCost = company.items.reduce((s, it) => {
              const linkedRecipe = (it.recipeId ? recipeMap.get(it.recipeId) : null) || 
                recipeMap.get(it.menuItemId) || 
                recipeMap.get(it.name.trim().toUpperCase())
              const costInfo = getDishCostInfo(linkedRecipe, selectedDate)
              return s + ((it.quantity || 0) * (costInfo.unitCost || 0))
            }, 0)

            return (
              <Card key={company.companyId + compIdx} className="border-2 border-slate-200/90 shadow-sm overflow-hidden">
                {/* Company Header with MG Box */}
                <CardHeader className="bg-slate-50/80 border-b py-3 px-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    {/* Company Identity */}
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-lg shadow-xs shrink-0">
                        {company.companyName.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-foreground">
                            {company.companyName}
                          </h3>
                          {company.buildingName && (
                            <Badge variant="outline" className="text-xs bg-white text-muted-foreground font-normal">
                              {company.buildingName}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                          <span>{company.items.length} dishes planned</span>
                          <span>&bull;</span>
                          <span>Volume: <strong className="text-foreground">{compTotalKg.toFixed(1)} Kg</strong></span>
                          {compTotalCost > 0 && (
                            <>
                              <span>&bull;</span>
                              <span>Food Cost: <strong className="text-emerald-700 font-bold">₹{compTotalCost.toFixed(0)}</strong></span>
                              {company.mg > 0 && (
                                <span className="text-[11px] text-muted-foreground font-mono">(₹{(compTotalCost / company.mg).toFixed(1)}/pax)</span>
                              )}
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Right: The MG Box & Actions */}
                    <div className="flex flex-wrap items-center gap-3">
                      {/* The MG Box (Minimum Guarantee) */}
                      <div className="flex items-center gap-2 bg-amber-50 border-2 border-amber-300 rounded-lg px-3 py-1.5 shadow-xs">
                        <Users className="h-4 w-4 text-amber-700 shrink-0" />
                        <span className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                          MG (Min Guarantee):
                        </span>
                        <FastMGInput
                          value={company.mg || 0}
                          onChange={newMG => handleUpdateMG(compIdx, newMG)}
                          className="h-8 w-24 bg-white font-bold text-amber-950 text-center text-sm border-amber-300 focus-visible:ring-amber-500 pr-5"
                          placeholder="e.g. 150"
                        />
                        <span className="text-xs font-semibold text-amber-800">pax</span>
                      </div>

                      {/* Auto Calc from MG Button with Loader */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 text-xs text-amber-800 border-amber-300 bg-amber-50/50 hover:bg-amber-100 gap-1.5"
                        onClick={() => handleAutoCalcQuantities(compIdx)}
                        disabled={calculatingCompanyIdx === compIdx}
                        title="Auto-fill recommended quantities based on MG × Portion"
                      >
                        {calculatingCompanyIdx === compIdx ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
                        ) : (
                          <Calculator className="h-3.5 w-3.5 text-amber-600" />
                        )}
                        {calculatingCompanyIdx === compIdx ? "Calculating..." : "Auto-Calc (MG × Portion)"}
                      </Button>

                      {/* Add Menu Item Button */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 text-xs gap-1 border-slate-300 bg-white hover:bg-slate-50"
                        onClick={() => handleOpenAddItem(compIdx)}
                      >
                        <Plus className="h-3.5 w-3.5 text-orange-500" />
                        Add Dish
                      </Button>

                      {/* Remove Company Button */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-9 w-9 text-muted-foreground hover:text-red-600 hover:bg-red-50 p-0"
                        onClick={() => handleRemoveCompany(compIdx)}
                        title="Remove company from today's grid"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {/* Company Menu Items Table */}
                <CardContent className="p-0">
                  {company.items.length === 0 ? (
                    <div className="text-center py-8 text-xs text-muted-foreground">
                      No menu items added for {company.companyName} yet. Click <strong>&quot;Add Dish&quot;</strong> above to add dishes.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-100/50 text-xs">
                            <TableHead className="w-[40px] text-center">#</TableHead>
                            <TableHead className="min-w-[200px]">Menu Item / Dish</TableHead>
                            <TableHead className="w-[150px]">Service / Sub-Service</TableHead>
                            <TableHead className="w-[120px]">Category</TableHead>
                            <TableHead className="w-[130px] text-center">Portion / Pax</TableHead>
                            <TableHead className="w-[150px] text-center">Suggested (MG × Portion)</TableHead>
                            <TableHead className="w-[180px] text-center bg-orange-50/40">
                              Dispatched Quantity Box
                            </TableHead>
                            <TableHead className="w-[100px] text-center">Unit</TableHead>
                            <TableHead className="w-[130px] text-center bg-emerald-50/50">Rate / Total Cost</TableHead>
                            <TableHead className="w-[50px] text-center"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {company.items.map((it, itemIdx) => {
                            const suggestedQty = parseFloat(((company.mg || 0) * (it.portionPerPax || 0.15)).toFixed(1))

                            return (
                              <TableRow key={it.id || itemIdx} className="text-xs hover:bg-slate-50/60">
                                <TableCell className="text-center text-muted-foreground font-mono">{itemIdx + 1}</TableCell>

                                {/* Dish Name */}
                                <TableCell>
                                  <div className="font-bold text-sm text-foreground flex items-center gap-1.5">
                                    <Utensils className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                                    {it.name}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    {it.recipeName && (
                                      <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                                        <ChefHat className="h-3 w-3 text-emerald-600" />
                                        Recipe: {it.recipeName}
                                      </div>
                                    )}
                                    {(() => {
                                      const linkedRecipe = (it.recipeId ? recipeMap.get(it.recipeId) : null) || 
                                        recipeMap.get(it.menuItemId) || 
                                        recipeMap.get(it.name.trim().toUpperCase())
                                      const costInfo = getDishCostInfo(linkedRecipe, selectedDate)
                                      if (costInfo.unitCost > 0) {
                                        return (
                                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-800 border-emerald-200 font-mono">
                                            ₹{costInfo.unitCost.toFixed(1)}/{it.unit} &bull; Total: ₹{(it.quantity * costInfo.unitCost).toFixed(0)}
                                          </Badge>
                                        )
                                      }
                                      return null
                                    })()}
                                  </div>
                                </TableCell>

                                {/* Service & Sub-Service */}
                                <TableCell>
                                  <div className="flex flex-col gap-0.5">
                                    <Badge variant="outline" className="text-[11px] bg-orange-50 text-orange-800 border-orange-200 w-fit font-medium">
                                      🍽️ {it.serviceName || "General"}
                                    </Badge>
                                    {it.subServiceName && (
                                      <span className="text-[10px] text-muted-foreground font-medium pl-0.5">
                                        &bull; {it.subServiceName}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>

                                {/* Category */}
                                <TableCell>
                                  <Badge variant="outline" className="text-[11px] font-normal">
                                    {it.category || "General"}
                                  </Badge>
                                </TableCell>

                                {/* Portion / Pax */}
                                <TableCell className="text-center font-mono">
                                  {it.portionPerPax > 0 ? `${(it.portionPerPax * 1000).toFixed(0)}g / pax` : "-"}
                                </TableCell>

                                {/* Suggested Quantity */}
                                <TableCell className="text-center">
                                  {suggestedQty > 0 ? (
                                    <button
                                      type="button"
                                      className="font-mono text-xs text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded cursor-pointer transition-colors"
                                      onClick={() => handleUpdateItemQuantity(compIdx, itemIdx, suggestedQty)}
                                      title="Click to apply suggested quantity"
                                    >
                                      {suggestedQty} {it.unit} &rarr;
                                    </button>
                                  ) : (
                                    <span className="text-muted-foreground italic">-</span>
                                  )}
                                </TableCell>

                                {/* Dispatched Quantity Box */}
                                <TableCell className="text-center bg-orange-50/30">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <FastQuantityInput
                                      value={it.quantity || 0}
                                      onChange={val => handleUpdateItemQuantity(compIdx, itemIdx, val)}
                                      step="0.5"
                                      min={0}
                                      className="h-9 w-28 text-center font-bold text-sm bg-white border-2 border-orange-300 focus-visible:ring-orange-500 shadow-xs pr-6"
                                      placeholder="0"
                                    />
                                    <span className="font-semibold text-xs text-muted-foreground w-8 text-left">
                                      {it.unit}
                                    </span>
                                  </div>
                                </TableCell>

                                {/* Unit Selector */}
                                <TableCell className="text-center">
                                  <Select
                                    value={it.unit || "Kg"}
                                    onValueChange={v => handleUpdateItemUnit(compIdx, itemIdx, v)}
                                  >
                                    <SelectTrigger className="h-8 w-20 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Kg">Kg</SelectItem>
                                      <SelectItem value="Ltr">Ltr</SelectItem>
                                      <SelectItem value="Pcs">Pcs</SelectItem>
                                      <SelectItem value="Portion">Portion</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </TableCell>

                                {/* Dish Rate & Total Food Cost Column */}
                                <TableCell className="text-center font-mono bg-emerald-50/20">
                                  {(() => {
                                    const linkedRecipe = (it.recipeId ? recipeMap.get(it.recipeId) : null) || 
                                      recipeMap.get(it.menuItemId) || 
                                      recipeMap.get(it.name.trim().toUpperCase())
                                    const costInfo = getDishCostInfo(linkedRecipe, selectedDate)
                                    const lineCost = (it.quantity || 0) * (costInfo.unitCost || 0)

                                    return (
                                      <div className="flex flex-col items-center">
                                        <span className="font-extrabold text-xs text-emerald-800">
                                          ₹{costInfo.unitCost > 0 ? costInfo.unitCost.toFixed(1) : "0.0"}/{it.unit}
                                        </span>
                                        {lineCost > 0 ? (
                                          <span className="text-[10px] text-emerald-700 font-bold">
                                            ₹{lineCost.toFixed(0)}
                                          </span>
                                        ) : (
                                          <span className="text-[10px] text-slate-400">
                                            ₹0.0
                                          </span>
                                        )}
                                      </div>
                                    )
                                  })()}
                                </TableCell>

                                {/* Remove Action */}
                                <TableCell className="text-center">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-red-600"
                                    onClick={() => handleRemoveItem(compIdx, itemIdx)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}

          {/* Consolidated Kitchen Batch Production Summary */}
          <Card className="border-slate-300 bg-slate-900 text-white shadow-md">
            <CardHeader className="pb-3 border-b border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <ChefHat className="h-5 w-5 text-orange-400" />
                    Kitchen Production &amp; Consolidated Dispatch Summary
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-xs mt-0.5">
                    Total bulk quantity to cook in the main kitchen for all companies combined on {selectedDate}.
                  </CardDescription>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">Total Bulk Volume:</span>
                  <div className="text-xl font-bold text-orange-400">{totalDispatchedKg.toFixed(1)} Kg</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {consolidatedDishes.map((dish, idx) => (
                  <div key={idx} className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/80 flex flex-col justify-between">
                    <div>
                      <div className="font-bold text-sm text-white">{dish.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        For: {dish.companies.join(", ")}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-700">
                      <span className="text-xs text-slate-400">Total Batch:</span>
                      <span className="text-base font-black text-emerald-400 font-mono">
                        {dish.totalQty} {dish.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Modal: Add Menu Item / Dish to Company ──────────────────────── */}
      <Dialog open={isAddItemModalOpen} onOpenChange={setIsAddItemModalOpen}>
        <DialogContent className="w-[90vw] sm:max-w-[650px] max-h-[85vh] flex flex-col p-6" style={{ maxWidth: "min(90vw, 650px)", width: "90vw" }}>
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Plus className="h-5 w-5 text-orange-500" />
              Add Dish to {activeCompanyIndex !== -1 ? companiesDispatch[activeCompanyIndex]?.companyName : "Company"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Search dishes from your master menu catalog to add to this company&apos;s dispatch.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 flex-1 overflow-hidden">
            {/* Target Service & Sub-Service Selection */}
            <div className="grid grid-cols-2 gap-3 bg-muted/40 p-2.5 rounded-lg border text-xs">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Assign to Service:
                </label>
                <Select value={addDishService} onValueChange={setAddDishService}>
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allServices.length === 0 ? (
                      <>
                        <SelectItem value="Lunch">Lunch</SelectItem>
                        <SelectItem value="Dinner">Dinner</SelectItem>
                        <SelectItem value="Breakfast">Breakfast</SelectItem>
                        <SelectItem value="Snacks">Snacks</SelectItem>
                      </>
                    ) : (
                      allServices.map(s => (
                        <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Sub-Service (Optional):
                </label>
                <Input
                  placeholder="e.g. Regular, Executive"
                  value={addDishSubService}
                  onChange={e => setAddDishSubService(e.target.value)}
                  className="h-8 text-xs bg-white"
                />
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search dish name or category (e.g., Dal, Paneer, Salad, Roti)..."
                value={itemSearch}
                onChange={e => setItemSearch(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>

            <ScrollArea className="h-[45vh] rounded-md border p-1 bg-white">
              {filteredModalMenuItems.length === 0 ? (
                <div className="text-center py-10 text-xs text-muted-foreground">
                  No dishes found matching &quot;{itemSearch}&quot;.
                </div>
              ) : (
                <div className="space-y-1 p-1">
                  {filteredModalMenuItems.map(m => (
                    <div
                      key={m.id}
                      onClick={() => handleAddItemToCompany(m)}
                      className="p-2.5 rounded-md cursor-pointer transition-colors hover:bg-orange-50 border border-transparent hover:border-orange-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-foreground text-sm">{m.name}</div>
                        {m.category && (
                          <div className="text-[11px] text-muted-foreground mt-0.5">Category: {m.category}</div>
                        )}
                      </div>
                      <Button size="sm" variant="outline" className="h-7 text-xs text-orange-600 border-orange-200 hover:bg-orange-100">
                        Add Dish
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <DialogFooter className="border-t pt-3">
            <Button variant="outline" size="sm" onClick={() => setIsAddItemModalOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Modal: Add Company to Grid ──────────────────────────────────── */}
      <Dialog open={isAddCompanyModalOpen} onOpenChange={setIsAddCompanyModalOpen}>
        <DialogContent className="w-[90vw] sm:max-w-[550px] max-h-[80vh] flex flex-col p-6" style={{ maxWidth: "min(90vw, 550px)", width: "90vw" }}>
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-500" />
              Add Company to Dispatch Grid
            </DialogTitle>
            <DialogDescription className="text-xs">
              Select an active company location to manage for {selectedDate}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 flex-1 overflow-hidden">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search company name..."
                value={companySearch}
                onChange={e => setCompanySearch(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>

            <ScrollArea className="h-[40vh] rounded-md border p-1 bg-white">
              <div className="space-y-1 p-1">
                {filteredModalCompanies.map(c => {
                  const isAlreadyIn = companiesDispatch.some(cd => cd.companyId === c.id)

                  return (
                    <div
                      key={c.id}
                      onClick={() => !isAlreadyIn && handleAddCompanyToGrid(c)}
                      className={`p-2.5 rounded-md flex items-center justify-between text-xs border ${
                        isAlreadyIn
                          ? "opacity-50 cursor-not-allowed bg-slate-50 border-slate-200"
                          : "cursor-pointer hover:bg-blue-50 border-transparent hover:border-blue-200"
                      }`}
                    >
                      <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {c.name}
                      </div>
                      {isAlreadyIn ? (
                        <Badge variant="outline" className="text-[10px]">Already in Grid</Badge>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-100">
                          Add
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter className="border-t pt-3">
            <Button variant="outline" size="sm" onClick={() => setIsAddCompanyModalOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Fullscreen Modal: Side-by-Side Company Grid Workspace ─────── */}
      <Dialog open={isFullModalOpen} onOpenChange={setIsFullModalOpen}>
        <DialogContent 
          className="w-[98vw] sm:max-w-[98vw] md:max-w-[98vw] lg:max-w-[98vw] xl:max-w-[98vw] h-[95vh] max-h-[95vh] p-0 flex flex-col overflow-hidden bg-slate-950 border-slate-800 text-white shadow-2xl" 
          style={{ maxWidth: "98vw", width: "98vw", height: "95vh" }}
          showCloseButton={false}
        >
          {/* Header Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-800 shrink-0 gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold">
                <Columns3 className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Dispatch Workspace &bull; Side-by-Side Companies
                  </h3>
                  <Badge variant="outline" className="border-orange-500/50 text-orange-400 bg-orange-500/10 text-xs">
                    {selectedDate}
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-400">
                  Optimal multi-column layout. Set MG and quantities per company side-by-side.
                </p>
              </div>
            </div>

            {/* Quick KPI Stats in Header */}
            <div className="hidden lg:flex items-center gap-3">
              <div className="px-3 py-1 rounded-md bg-slate-800 border border-slate-700 text-xs flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-blue-400" />
                <span className="text-slate-400">Companies:</span>
                <span className="font-bold text-white">{companiesDispatch.length}</span>
              </div>
              <div className="px-3 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-amber-300">Total MG:</span>
                <span className="font-bold text-amber-300">{totalMGAll.toLocaleString()} pax</span>
              </div>
              <div className="px-3 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-xs flex items-center gap-1.5">
                <Scale className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-300">Total Volume:</span>
                <span className="font-bold text-emerald-300">{totalDispatchedKg.toFixed(1)} Kg</span>
              </div>
            </div>

            {/* Actions in Header */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-amber-500/40 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 gap-1.5"
                onClick={handleAutoCalcAll}
                disabled={isCalculating}
              >
                {isCalculating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
                ) : (
                  <Calculator className="h-3.5 w-3.5" />
                )}
                {isCalculating ? "Calculating All..." : "Auto-Calc All (MG × Port)"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-slate-700 text-slate-200 bg-slate-800 hover:bg-slate-700 gap-1.5"
                onClick={() => setIsAddCompanyModalOpen(true)}
              >
                <Plus className="h-3.5 w-3.5 text-orange-400" />
                Add Company
              </Button>
              <Button
                size="sm"
                className="h-8 bg-orange-600 hover:bg-orange-700 text-white gap-1.5 text-xs font-semibold px-3"
                onClick={handleSaveDispatch}
                disabled={isSaving}
              >
                <Save className="h-3.5 w-3.5" />
                {isSaving ? "Saving..." : "Save Plan"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-emerald-500/40 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 gap-1.5 font-semibold"
                onClick={() => setIsCostModalOpen(true)}
              >
                <IndianRupee className="h-3.5 w-3.5 text-emerald-400" />
                Cost & Procurement
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-slate-700 text-slate-300 bg-slate-800 hover:bg-slate-700 gap-1.5"
                onClick={handleCloseFullModal}
                disabled={isClosingModal}
              >
                {isClosingModal ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
                {isClosingModal ? "Closing..." : "Close"}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
                onClick={handleCloseFullModal}
                disabled={isClosingModal}
              >
                {isClosingModal ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Service & Sub-Service Filter Bar in Modal with Fast Switching */}
          <div className="flex flex-wrap items-center justify-between px-6 py-2.5 bg-slate-900/90 border-b border-slate-800 text-xs shrink-0 gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Filter className="h-3.5 w-3.5 text-orange-400" />
                Filter by Service:
              </span>
              <Button
                size="sm"
                variant={modalServiceFilter === "ALL" ? "default" : "outline"}
                disabled={switchingServiceName !== null}
                className={`h-7 text-xs px-3 py-0 gap-1.5 transition-all ${
                  modalServiceFilter === "ALL"
                    ? "bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-xs"
                    : "border-slate-700 text-slate-300 bg-slate-800 hover:bg-slate-700"
                }`}
                onClick={() => handleSelectServiceFilter("ALL")}
              >
                {switchingServiceName === "ALL" ? (
                  <Loader2 className="h-3 w-3 animate-spin text-white" />
                ) : null}
                {switchingServiceName === "ALL" ? "Loading..." : "All Services"}
              </Button>
              {availableServicesForModal.map(sName => {
                const isSelected = modalServiceFilter === sName
                const isSwitchingThis = switchingServiceName === sName
                return (
                  <Button
                    key={sName}
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    disabled={switchingServiceName !== null}
                    className={`h-7 text-xs px-3 py-0 gap-1.5 transition-all ${
                      isSelected
                        ? "bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-xs"
                        : "border-slate-700 text-slate-300 bg-slate-800 hover:bg-slate-700"
                    }`}
                    onClick={() => handleSelectServiceFilter(sName)}
                  >
                    {isSwitchingThis ? (
                      <Loader2 className="h-3 w-3 animate-spin text-orange-300" />
                    ) : (
                      <UtensilsCrossed className="h-3 w-3 text-orange-400" />
                    )}
                    {sName}
                  </Button>
                )
              })}
              {isServiceSwitching && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/30 text-orange-400 text-[11px] animate-pulse">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Loading {switchingServiceName === "ALL" ? "all services" : switchingServiceName}...</span>
                </div>
              )}
            </div>

            {/* Sub-Service Selector & Expand All Recipes Toggle */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className={`h-7 text-xs px-2.5 py-0 gap-1.5 border-slate-700 ${expandAllRecipes ? "bg-emerald-600 hover:bg-emerald-700 text-white font-bold" : "text-emerald-400 bg-slate-800 hover:bg-slate-700"}`}
                onClick={() => setExpandAllRecipes(!expandAllRecipes)}
              >
                <ChefHat className="h-3.5 w-3.5" />
                {expandAllRecipes ? "Collapse Recipes View" : "Expand All Recipes View"}
              </Button>

              {modalServiceFilter !== "ALL" && availableSubServicesForModal.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">Sub-Service:</span>
                  <Select
                    value={modalSubServiceFilter}
                    onValueChange={(val) => {
                      if (val === modalSubServiceFilter) return
                      setIsServiceSwitching(true)
                      setTimeout(() => {
                        React.startTransition(() => {
                          setModalSubServiceFilter(val)
                          setIsServiceSwitching(false)
                        })
                      }, 30)
                    }}
                  >
                    <SelectTrigger className="h-7 w-40 text-xs bg-slate-800 border-slate-700 text-slate-200">
                      <SelectValue placeholder="All Sub-Services" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                      <SelectItem value="ALL">All Sub-Services</SelectItem>
                      {availableSubServicesForModal.map(ssName => (
                        <SelectItem key={ssName} value={ssName}>{ssName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* 4-Card Responsive Grid Workspace (Natural Vertical Scroll) */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-950">
            {isModalLoading ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center py-6 text-sm text-orange-400 gap-2.5 bg-slate-900/50 border border-slate-800 rounded-xl">
                  <Loader2 className="h-5 w-5 animate-spin text-orange-400" />
                  <span className="font-semibold tracking-wide">Loading Company Dispatch Workspace...</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                    <div key={n} className="h-[460px] rounded-xl bg-slate-900/60 border border-slate-800 p-4 space-y-3 animate-pulse">
                      <div className="h-5 w-3/4 bg-slate-800 rounded" />
                      <div className="h-8 bg-slate-800/80 rounded" />
                      <div className="space-y-2 pt-3">
                        <div className="h-16 bg-slate-850 rounded border border-slate-800/60" />
                        <div className="h-16 bg-slate-850 rounded border border-slate-800/60" />
                        <div className="h-16 bg-slate-850 rounded border border-slate-800/60" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : companiesDispatch.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-slate-400 py-24 space-y-3">
                <Truck className="h-12 w-12 text-slate-600" />
                <p className="text-base font-semibold text-slate-300">No companies in grid for {selectedDate}</p>
                <Button
                  size="sm"
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                  onClick={() => autoPopulateFromMenus(selectedDate, true)}
                >
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  Auto-Fill Scheduled Menus
                </Button>
              </div>
            ) : (
              <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start pb-16 transition-opacity duration-150 ${isServiceSwitching ? "opacity-40 pointer-events-none" : "opacity-100"}`}>
                {companiesDispatch.slice(0, visibleBatchLimit).map((company, compIdx) => (
                  <ModalCompanyCard
                    key={company.companyId || `modal_comp_${compIdx}`}
                    company={company}
                    compIdx={compIdx}
                    modalServiceFilter={modalServiceFilter}
                    modalSubServiceFilter={modalSubServiceFilter}
                    expandAllRecipes={expandAllRecipes}
                    expandedRecipeIds={expandedRecipeIds}
                    toggleRecipeExpand={toggleRecipeExpand}
                    recipeMap={recipeMap}
                    isCalculating={calculatingCompanyIdx === compIdx}
                    selectedDate={selectedDate}
                    getDishCostInfo={getDishCostInfo}
                    onUpdateMG={handleUpdateMG}
                    onAutoCalc={handleAutoCalcQuantities}
                    onUpdateItemQuantity={handleUpdateItemQuantity}
                    onUpdateItemUnit={handleUpdateItemUnit}
                    onRemoveItem={handleRemoveItem}
                    onRemoveCompany={handleRemoveCompany}
                    onOpenAddItem={handleOpenAddItem}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Modal: Day Food Cost & Procurement Analysis Report ────────────── */}
      <Dialog open={isCostModalOpen} onOpenChange={setIsCostModalOpen}>
        <DialogContent
          className="w-[96vw] sm:max-w-[950px] max-h-[92vh] flex flex-col p-6 overflow-hidden"
          style={{ maxWidth: "min(96vw, 950px)", width: "96vw" }}
        >
          <DialogHeader className="border-b pb-3 shrink-0">
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                  <IndianRupee className="h-5 w-5 text-emerald-600" />
                  Day Food Cost & Ingredient Procurement Report
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  Cost analysis based on ingredient rates active on <strong className="text-foreground">{selectedDate}</strong>. Dynamic date-wise rates are considered whenever recorded for this date; otherwise the baseline default static rate is applied.
                </DialogDescription>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">Total Food Cost</span>
                <div className="text-xl font-extrabold text-emerald-700">
                  ₹{totalDayFoodCost.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </div>
                <span className="text-[10px] text-emerald-800">Across {companiesDispatch.length} companies</span>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider block">Total MG Headcount</span>
                <div className="text-xl font-bold text-amber-700">
                  {totalMGAll.toLocaleString()} pax
                </div>
                <span className="text-[10px] text-amber-800">Guaranteed covers</span>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
                <span className="text-[10px] uppercase font-bold text-blue-800 tracking-wider block">Avg Cost Per Pax</span>
                <div className="text-xl font-bold text-blue-700">
                  ₹{totalMGAll > 0 ? (totalDayFoodCost / totalMGAll).toFixed(2) : "0.00"}
                </div>
                <span className="text-[10px] text-blue-800">Per guaranteed plate</span>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-2.5">
                <span className="text-[10px] uppercase font-bold text-purple-800 tracking-wider block">Total Dispatched Weight</span>
                <div className="text-xl font-bold text-purple-700">
                  {totalDispatchedKg.toFixed(1)} Kg
                </div>
                <span className="text-[10px] text-purple-800">Prepared food volume</span>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 pr-1 py-3">
            {/* 1. Consolidated Procurement List for Nirbhay Sir */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Truck className="h-4 w-4 text-orange-600" />
                    Consolidated Ingredient Procurement List (Purchases Required)
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Total raw material requirement for the whole day aggregated from all planned menus with {selectedDate} date-effective prices.
                  </p>
                </div>
                <Badge variant="outline" className="text-xs bg-slate-100 text-slate-800 font-medium">
                  {consolidatedProcurement.length} unique ingredients
                </Badge>
              </div>

              {consolidatedProcurement.length === 0 ? (
                <div className="text-center py-8 border border-dashed rounded-lg bg-slate-50 text-xs text-muted-foreground">
                  No ingredients calculated. Please ensure recipes are linked and quantities are entered for the day.
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-100">
                      <TableRow className="text-xs">
                        <TableHead>Ingredient</TableHead>
                        <TableHead className="text-right">Total Quantity Needed</TableHead>
                        <TableHead>Applied Rate (Date: {selectedDate})</TableHead>
                        <TableHead className="text-right">Estimated Cost</TableHead>
                        <TableHead>Used in Planned Dishes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {consolidatedProcurement.map((ing, idx) => (
                        <TableRow key={idx} className="hover:bg-slate-50/80">
                          <TableCell className="font-semibold text-xs text-foreground">
                            {ing.name}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-xs text-slate-800">
                            {ing.totalQty >= 1 ? ing.totalQty.toFixed(2) : ing.totalQty.toFixed(3)} {ing.unit}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <strong className="text-emerald-700 font-bold">₹{ing.effectivePrice.toFixed(2)}</strong>
                              <span className="text-muted-foreground text-[11px]">/ {ing.priceUnit}</span>
                              {ing.rateType === "dynamic" ? (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold">
                                  Dynamic {ing.effectiveDate ? `(${ing.effectiveDate})` : ""}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 bg-slate-100 text-slate-700 border-slate-300 font-normal">
                                  Default Rate
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-xs text-emerald-700">
                            ₹{ing.totalCost.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-[11px] text-muted-foreground max-w-[200px] truncate" title={Array.from(ing.usedInDishes).join(", ")}>
                            {Array.from(ing.usedInDishes).join(", ")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* 2. Company-Wise Cost Summary */}
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-blue-600" />
                Company-Wise Food Cost & Portion Economics
              </h4>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-100">
                    <TableRow className="text-xs">
                      <TableHead>Company</TableHead>
                      <TableHead className="text-center">MG Pax</TableHead>
                      <TableHead className="text-right">Volume (Kg)</TableHead>
                      <TableHead className="text-center">Dishes</TableHead>
                      <TableHead className="text-right">Total Food Cost</TableHead>
                      <TableHead className="text-right">Cost / Pax</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companiesDispatch.map((comp, cIdx) => {
                      const compVolume = comp.items
                        .filter(i => i.unit === "Kg")
                        .reduce((s, i) => s + (i.quantity || 0), 0)
                      const compCost = comp.items.reduce((s, it) => {
                        const linkedRecipe = (it.recipeId ? recipeMap.get(it.recipeId) : null) || 
                          recipeMap.get(it.menuItemId) || 
                          recipeMap.get(it.name.trim().toUpperCase())
                        const costInfo = getDishCostInfo(linkedRecipe, selectedDate)
                        return s + ((it.quantity || 0) * (costInfo.unitCost || 0))
                      }, 0)

                      return (
                        <TableRow key={cIdx}>
                          <TableCell className="font-semibold text-xs">
                            {comp.companyName}
                            {comp.buildingName && <span className="text-[11px] text-muted-foreground block">{comp.buildingName}</span>}
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs font-bold text-amber-800">
                            {comp.mg || 0} pax
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {compVolume.toFixed(1)} Kg
                          </TableCell>
                          <TableCell className="text-center text-xs">
                            {comp.items.length}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-xs text-emerald-700">
                            ₹{compCost.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold text-blue-700">
                            ₹{comp.mg > 0 ? (compCost / comp.mg).toFixed(2) : "0.00"}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-3 shrink-0 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Grand Total Food Cost for {selectedDate}: <strong className="text-emerald-700 font-bold">₹{totalDayFoodCost.toFixed(2)}</strong>
            </span>
            <Button variant="outline" size="sm" onClick={() => setIsCostModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Archived Legacy Card ───
function _ArchivedLegacyCard({ company, compIdx, handleRemoveCompany, handleUpdateMG, handleAutoCalcQuantities, calculatingCompanyIdx, handleOpenAddItem, groups, modalServiceFilter, recipeMap, expandAllRecipes, expandedRecipeIds, toggleRecipeExpand, handleRemoveItem, handleUpdateItemQuantity, handleUpdateItemUnit, compTotalKg }: any) {
  return (
                    <div
                      key={"modal_comp_" + company.companyId + compIdx}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl flex flex-col shadow-lg overflow-hidden min-h-[460px] h-fit"
                    >
                      {/* Column Header */}
                      <div className="p-3 bg-slate-850 border-b border-slate-800 space-y-2 shrink-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="overflow-hidden">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-bold text-sm text-white tracking-tight truncate">
                                {company.companyName}
                              </span>
                              {company.buildingName && (
                                <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-700 font-normal py-0 shrink-0">
                                  {company.buildingName}
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {company.items.length} total dishes &bull; <strong className="text-emerald-400">{compTotalKg.toFixed(1)} Kg</strong>
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-slate-400 hover:text-red-400 shrink-0 -mt-1 -mr-1"
                            onClick={() => handleRemoveCompany(compIdx)}
                            title="Remove Company"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        {/* The MG Box in Column */}
                        <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
                          <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-amber-400" />
                            MG (Headcount):
                          </span>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min="0"
                              value={company.mg || ""}
                              onChange={e => handleUpdateMG(compIdx, parseFloat(e.target.value) || 0)}
                              className="h-7 w-20 bg-slate-950 border-amber-500/40 text-amber-300 font-bold text-center text-xs focus-visible:ring-amber-500"
                              placeholder="e.g. 150"
                            />
                            <span className="text-[11px] text-amber-300/80 font-medium">pax</span>
                          </div>
                        </div>

                        {/* Quick Action row with Calc Loader */}
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[11px] text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 px-2 py-0 gap-1"
                            onClick={() => handleAutoCalcQuantities(compIdx)}
                            disabled={calculatingCompanyIdx === compIdx}
                          >
                            {calculatingCompanyIdx === compIdx ? (
                              <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
                            ) : (
                              <Calculator className="h-3 w-3" />
                            )}
                            {calculatingCompanyIdx === compIdx ? "Calc..." : "Calc (MG × Port)"}
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[11px] text-slate-200 border-slate-700 bg-slate-800 hover:bg-slate-700 px-2 py-0 gap-1"
                            onClick={() => handleOpenAddItem(compIdx)}
                          >
                            <Plus className="h-3 w-3 text-orange-400" />
                            Add Dish
                          </Button>
                        </div>
                      </div>

                      {/* Column Dishes List Grouped Service & Sub-Service Wise (Expanded to Last Item) */}
                      <div className="p-2.5 space-y-3">
                        {groups.length === 0 ? (
                          <div className="text-center py-10 text-xs text-slate-500">
                            {company.items.length === 0 ? (
                              <>
                                No dishes planned yet.<br />
                                Click <strong>&quot;Add Dish&quot;</strong> above.
                              </>
                            ) : (
                              <>
                                No dishes under <strong>{modalServiceFilter}</strong>.<br />
                                Select <strong>&quot;All Services&quot;</strong> to view other dishes.
                              </>
                            )}
                          </div>
                        ) : (
                          groups.map((grp, grpIdx) => (
                            <div key={grp.serviceName + grp.subServiceName + grpIdx} className="space-y-1.5">
                              {/* Service & Sub-Service Sticky Group Header */}
                              <div className="sticky top-0 z-10 bg-slate-850/95 backdrop-blur border border-slate-700/80 rounded px-2.5 py-1 flex items-center justify-between text-xs shadow-xs">
                                <div className="flex items-center gap-1.5 truncate">
                                  <UtensilsCrossed className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                                  <span className="font-bold text-white tracking-wide truncate">
                                    {grp.serviceName}
                                  </span>
                                  {grp.subServiceName && (
                                    <span className="text-slate-400 font-medium text-[11px] truncate">
                                      &bull; {grp.subServiceName}
                                    </span>
                                  )}
                                </div>
                                <Badge variant="outline" className="text-[10px] bg-slate-900 border-slate-700 text-slate-300 font-mono py-0 shrink-0">
                                  {grp.items.length} {grp.items.length === 1 ? "dish" : "dishes"}
                                </Badge>
                              </div>

                              {/* Dishes in this Service & Sub-Service */}
                              <div className="space-y-2">
                                {grp.items.map(({ it, originalIndex }) => {
                                  const suggestedQty = parseFloat(((company.mg || 0) * (it.portionPerPax || 0.15)).toFixed(1))
                                  const linkedRecipe = (it.recipeId ? recipeMap.get(it.recipeId) : null) || 
                                    recipeMap.get(it.menuItemId) || 
                                    recipeMap.get(it.name.trim().toUpperCase())
                                  const isRecipeExpanded = expandAllRecipes || expandedRecipeIds.has(it.id)
                  const costInfo = getDishCostInfo ? getDishCostInfo(linkedRecipe, selectedDate) : { unitCost: 0, breakdown: [] }
                  const dishCost = (it.quantity || 0) * (costInfo.unitCost || 0)

                                  return (
                                    <div
                                      key={"modal_it_" + it.id + originalIndex}
                                      className="bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 rounded-lg p-2.5 space-y-2 transition-colors"
                                    >
                                      <div className="flex items-start justify-between gap-1.5">
                                        <div className="overflow-hidden flex-1">
                                          <div className="font-bold text-xs text-white flex items-center gap-1.5 truncate">
                                            <Utensils className="h-3 w-3 text-orange-400 shrink-0" />
                                            <span className="truncate">{it.name}</span>
                                          </div>
                                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 flex-wrap">
                                            <span className="text-slate-500">{it.category || "Dish"}</span>
                                            <span>&bull;</span>
                                            <span>Portion: {(it.portionPerPax * 1000).toFixed(0)}g</span>
                            {costInfo.unitCost > 0 && (
                              <>
                                <span>&bull;</span>
                                <span className="text-emerald-400 font-semibold font-mono">
                                  ₹{costInfo.unitCost.toFixed(1)}/{it.unit}
                                </span>
                                {it.quantity > 0 && (
                                  <>
                                    <span>&bull;</span>
                                    <span className="text-amber-300 font-bold font-mono">
                                      Total: ₹{dishCost.toFixed(0)}
                                    </span>
                                  </>
                                )}
                              </>
                            )}
                                          </div>

                                          {/* Recipe Preview Button & Expansion */}
                                          {linkedRecipe && (
                                            <div className="mt-1">
                                              <button
                                                type="button"
                                                onClick={() => toggleRecipeExpand(it.id)}
                                                className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium cursor-pointer"
                                              >
                                                <ChefHat className="h-3 w-3 text-emerald-400 shrink-0" />
                                                <span className="truncate">Recipe: {linkedRecipe.name} {linkedRecipe.ingredients?.length ? `(${linkedRecipe.ingredients.length} ingr.)` : ""}</span>
                                                <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${isRecipeExpanded ? "rotate-180" : ""}`} />
                                              </button>

                                              {/* Expanded Ingredients List */}
                                              {isRecipeExpanded && linkedRecipe.ingredients && linkedRecipe.ingredients.length > 0 && (
                                                <div className="mt-1.5 p-2 rounded bg-slate-900 border border-slate-800 text-[10px] space-y-1">
                                                  <div className="text-[10px] text-amber-300 font-semibold flex items-center justify-between">
                                                    <span>Ingredients Breakdown:</span>
                                                    <span className="text-slate-400 font-mono">Portion: {(it.portionPerPax * 1000).toFixed(0)}g</span>
                                                  </div>
                                                  <div className="flex flex-wrap gap-1 pt-0.5">
                                                    {linkedRecipe.ingredients.map((ing: any, iIdx: number) => (
                                                      <span key={iIdx} className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-slate-300 font-mono text-[10px]">
                                                        {ing.ingredientName || ing.templateName || ing.oldItemName}: <strong className="text-amber-400">{ing.quantity} {ing.unit}</strong>
                                                      </span>
                                                    ))}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-5 w-5 text-slate-500 hover:text-red-400 p-0 shrink-0 ml-1"
                                          onClick={() => handleRemoveItem(compIdx, originalIndex)}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>

                                      {/* Quantity Box Row */}
                                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                                        <div>
                                          {suggestedQty > 0 && (
                                            <button
                                              type="button"
                                              className="text-[10px] text-amber-400/90 hover:text-amber-300 font-mono underline cursor-pointer"
                                              onClick={() => handleUpdateItemQuantity(compIdx, originalIndex, suggestedQty)}
                                              title="Click to apply suggested quantity"
                                            >
                                              Suggest: {suggestedQty} {it.unit} &rarr;
                                            </button>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-1">
                                          <Input
                                            type="number"
                                            step="0.5"
                                            min="0"
                                            value={it.quantity === 0 ? "" : it.quantity}
                                            onChange={e => handleUpdateItemQuantity(compIdx, originalIndex, parseFloat(e.target.value) || 0)}
                                            className="h-7 w-20 bg-slate-900 border-2 border-orange-500/80 text-orange-400 font-bold text-center text-xs focus-visible:ring-orange-500"
                                            placeholder="0"
                                          />
                                          <Select
                                            value={it.unit || "Kg"}
                                            onValueChange={v => handleUpdateItemUnit(compIdx, originalIndex, v)}
                                          >
                                            <SelectTrigger className="h-7 w-16 text-[11px] bg-slate-900 border-slate-700 text-slate-300 px-1.5">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                                              <SelectItem value="Kg">Kg</SelectItem>
                                              <SelectItem value="Ltr">Ltr</SelectItem>
                                              <SelectItem value="Pcs">Pcs</SelectItem>
                                              <SelectItem value="Portion">Portion</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Column Footer */}
                      <div className="p-2.5 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
                        <span>Total Volume:</span>
                        <span className="font-bold text-emerald-400 font-mono text-xs">{compTotalKg.toFixed(1)} Kg</span>
                      </div>
                    </div>
  )
}
