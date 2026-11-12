"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Plus,
  Edit,
  Trash2,
  Search,
  IndianRupee,
  Save,
  Calendar,
  History,
  TrendingUp,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  Tag,
  Layers,
  Scale
} from "lucide-react"
import { IngredientsForm } from "@/components/admin/ingredients-form"
import {
  ingredientsService,
  templatesService,
  brandsService,
  subBrandsService,
  typesService,
  defaultsService,
  gpService,
  subGpService,
  taxTemplatesService,
  suppliersService,
  getEffectiveIngredientPrice,
  type Ingredient,
  type IngredientPriceRecord,
  type Template,
  type Brand,
  type SubBrand,
  type Type,
  type Default,
  type GP,
  type SubGP,
  type TaxTemplate,
  type Supplier,
} from "@/lib/firestore"

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [subBrands, setSubBrands] = useState<SubBrand[]>([])
  const [types, setTypes] = useState<Type[]>([])
  const [defaults, setDefaults] = useState<Default[]>([])
  const [gps, setGps] = useState<GP[]>([])
  const [subGps, setSubGps] = useState<SubGP[]>([])
  const [taxTemplates, setTaxTemplates] = useState<TaxTemplate[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Ingredient | null>(null)

  // ─── Date-Wise Price Master Modal State ─────────────────────────────────
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false)
  const [selectedIngredientForPrice, setSelectedIngredientForPrice] = useState<Ingredient | null>(null)
  const [isSavingPrice, setIsSavingPrice] = useState(false)
  const [priceFormData, setPriceFormData] = useState<{
    effectiveDate: string
    price: string | number
    unit: string
    session: string
    notes: string
  }>({
    effectiveDate: new Date().toISOString().split("T")[0],
    price: "",
    unit: "Kg",
    session: "Regular",
    notes: ""
  })

  // Default Static Rate Quick-Edit Modal state
  const [isDefaultRateModalOpen, setIsDefaultRateModalOpen] = useState(false)
  const [selectedIngredientForDefaultRate, setSelectedIngredientForDefaultRate] = useState<Ingredient | null>(null)
  const [defaultRateInput, setDefaultRateInput] = useState<string | number>("")
  const [defaultUnitInput, setDefaultUnitInput] = useState<string>("Kg")
  const [isSavingDefaultRate, setIsSavingDefaultRate] = useState(false)

  // Date Simulation / Verification Inspector state
  const [simTestDate, setSimTestDate] = useState<string>(new Date().toISOString().split("T")[0])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [
        ingredientsData,
        templatesData,
        brandsData,
        subBrandsData,
        typesData,
        defaultsData,
        gpsData,
        subGpsData,
        taxTemplatesData,
        suppliersData,
      ] = await Promise.all([
        ingredientsService.getAll(),
        templatesService.getAll(),
        brandsService.getAll(),
        subBrandsService.getAll(),
        typesService.getAll(),
        defaultsService.getAll(),
        gpService.getAll(),
        subGpService.getAll(),
        taxTemplatesService.getAll(),
        suppliersService.getAll(),
      ])

      setIngredients(ingredientsData)
      setTemplates(templatesData)
      setBrands(brandsData)
      setSubBrands(subBrandsData)
      setTypes(typesData)
      setDefaults(defaultsData)
      setGps(gpsData)
      setSubGps(subGpsData)
      setTaxTemplates(taxTemplatesData)
      setSuppliers(suppliersData)
    } catch (error) {
      console.error("Error loading data:", error)
    }
  }

  const handleAdd = async (data: Omit<Ingredient, "id">) => {
    setLoading(true)
    try {
      await ingredientsService.add(data)
      await loadData()
      setIsFormOpen(false)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = async (data: Omit<Ingredient, "id">) => {
    if (!editingItem) return
    setLoading(true)
    try {
      await ingredientsService.update(editingItem.id, data)
      await loadData()
      setIsFormOpen(false)
      setEditingItem(null)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this ingredient?")) {
      setLoading(true)
      try {
        await ingredientsService.delete(id)
        await loadData()
      } finally {
        setLoading(false)
      }
    }
  }

  const openAddForm = () => {
    setEditingItem(null)
    setIsFormOpen(true)
  }

  const openEditForm = (item: Ingredient) => {
    setEditingItem(item)
    setIsFormOpen(true)
  }

  // ─── Open Quick Edit for Default Static Rate ────────────────────────────
  const openDefaultRateEdit = (ingredient: Ingredient) => {
    setSelectedIngredientForDefaultRate(ingredient)
    const eff = getEffectiveIngredientPrice(ingredient)
    setDefaultRateInput(eff.defaultPrice > 0 ? eff.defaultPrice : "")
    setDefaultUnitInput(ingredient.priceUnit || ingredient.u1 || "Kg")
    setIsDefaultRateModalOpen(true)
  }

  const handleSaveDefaultRate = async () => {
    if (!selectedIngredientForDefaultRate) return
    const numRate = parseFloat(String(defaultRateInput))
    if (isNaN(numRate) || numRate < 0) {
      alert("Please enter a valid numeric default rate (e.g. 40.00).")
      return
    }

    setIsSavingDefaultRate(true)
    try {
      const updatePayload: Partial<Ingredient> = {
        price: numRate,
        rate: numRate,
        cost: numRate,
        priceUnit: defaultUnitInput || selectedIngredientForDefaultRate.u1 || "Kg",
        u1: defaultUnitInput || selectedIngredientForDefaultRate.u1 || "Kg"
      }

      await ingredientsService.update(selectedIngredientForDefaultRate.id, updatePayload)

      const updatedIng = { ...selectedIngredientForDefaultRate, ...updatePayload }
      setIngredients(prev => prev.map(ing => (ing.id === updatedIng.id ? updatedIng : ing)))
      if (selectedIngredientForPrice?.id === updatedIng.id) {
        setSelectedIngredientForPrice(updatedIng)
      }
      setIsDefaultRateModalOpen(false)
    } catch (err) {
      console.error("Failed to update default rate:", err)
      alert("Error updating default rate.")
    } finally {
      setIsSavingDefaultRate(false)
    }
  }

  // ─── Open Date-Wise Price Master Modal ──────────────────────────────────
  const openPriceModal = (ingredient: Ingredient) => {
    setSelectedIngredientForPrice(ingredient)
    const eff = getEffectiveIngredientPrice(ingredient)
    setPriceFormData({
      effectiveDate: new Date().toISOString().split("T")[0],
      price: eff.price > 0 ? eff.price : "",
      unit: eff.unit || ingredient.priceUnit || ingredient.u1 || "Kg",
      session: "Regular",
      notes: ""
    })
    setSimTestDate(new Date().toISOString().split("T")[0])
    setIsPriceModalOpen(true)
  }

  // ─── Save New Price Revision ────────────────────────────────────────────
  const handleSavePriceRevision = async () => {
    if (!selectedIngredientForPrice) return
    const numericPrice = parseFloat(String(priceFormData.price))
    if (isNaN(numericPrice) || numericPrice < 0) {
      alert("Please enter a valid numeric price (e.g. 20, 40).")
      return
    }
    if (!priceFormData.effectiveDate) {
      alert("Please specify the effective date.")
      return
    }

    setIsSavingPrice(true)
    try {
      const newRecord: IngredientPriceRecord = {
        id: `pr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        effectiveDate: priceFormData.effectiveDate,
        price: numericPrice,
        unit: priceFormData.unit || selectedIngredientForPrice.u1 || "Kg",
        session: priceFormData.session?.trim() || "Regular",
        notes: priceFormData.notes?.trim() || "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const existingHistory = Array.isArray(selectedIngredientForPrice.priceHistory)
        ? [...selectedIngredientForPrice.priceHistory]
        : []

      // If record for same effectiveDate and same session already exists, update it, else append
      const existingIdx = existingHistory.findIndex(
        h => h.effectiveDate === newRecord.effectiveDate && (h.session || "Regular") === (newRecord.session || "Regular")
      )

      let updatedHistory: IngredientPriceRecord[]
      if (existingIdx >= 0) {
        updatedHistory = [...existingHistory]
        updatedHistory[existingIdx] = newRecord
      } else {
        updatedHistory = [...existingHistory, newRecord]
      }

      // Sort chronological ascending
      updatedHistory.sort((a, b) => (a.effectiveDate || "").localeCompare(b.effectiveDate || ""))

      const todayStr = new Date().toISOString().split("T")[0]
      const latestActive = getEffectiveIngredientPrice(
        { ...selectedIngredientForPrice, priceHistory: updatedHistory },
        todayStr
      )

      const updatePayload: Partial<Ingredient> = {
        price: latestActive.price,
        rate: latestActive.price,
        cost: latestActive.price,
        priceUnit: latestActive.unit,
        priceEffectiveDate: latestActive.effectiveDate,
        priceSession: latestActive.session || "Regular",
        priceHistory: updatedHistory
      }

      await ingredientsService.update(selectedIngredientForPrice.id, updatePayload)

      // Update state
      const updatedIng = { ...selectedIngredientForPrice, ...updatePayload }
      setSelectedIngredientForPrice(updatedIng)
      setIngredients(prev => prev.map(ing => (ing.id === updatedIng.id ? updatedIng : ing)))

      setPriceFormData(prev => ({
        ...prev,
        price: "",
        notes: "",
        session: "Regular"
      }))
    } catch (err) {
      console.error("Failed to save price revision:", err)
      alert("Error saving date-wise price record.")
    } finally {
      setIsSavingPrice(false)
    }
  }

  // ─── Delete Historical Price Revision ───────────────────────────────────
  const handleDeletePriceRevision = async (recordToDelete: IngredientPriceRecord) => {
    if (!selectedIngredientForPrice) return
    if (!confirm(`Delete rate revision for ${recordToDelete.effectiveDate} (₹${recordToDelete.price}/${recordToDelete.unit})?`)) return

    setIsSavingPrice(true)
    try {
      const existingHistory = Array.isArray(selectedIngredientForPrice.priceHistory)
        ? [...selectedIngredientForPrice.priceHistory]
        : []

      const updatedHistory = existingHistory.filter(
        h =>
          !(
            h.effectiveDate === recordToDelete.effectiveDate &&
            h.price === recordToDelete.price &&
            (h.session || "Regular") === (recordToDelete.session || "Regular")
          )
      )

      const todayStr = new Date().toISOString().split("T")[0]
      const latestActive = getEffectiveIngredientPrice(
        { ...selectedIngredientForPrice, priceHistory: updatedHistory },
        todayStr
      )

      const updatePayload: Partial<Ingredient> = {
        price: latestActive.price,
        rate: latestActive.price,
        cost: latestActive.price,
        priceUnit: latestActive.unit,
        priceEffectiveDate: latestActive.effectiveDate,
        priceSession: latestActive.session || "Regular",
        priceHistory: updatedHistory
      }

      await ingredientsService.update(selectedIngredientForPrice.id, updatePayload)

      const updatedIng = { ...selectedIngredientForPrice, ...updatePayload }
      setSelectedIngredientForPrice(updatedIng)
      setIngredients(prev => prev.map(ing => (ing.id === updatedIng.id ? updatedIng : ing)))
    } catch (err) {
      console.error("Failed to delete price revision:", err)
      alert("Error removing price record.")
    } finally {
      setIsSavingPrice(false)
    }
  }

  const getNameById = (id: string, collection: any[]) => {
    const item = collection.find((item) => item.id === id)
    return item?.name || "Unknown"
  }

  const filteredIngredients = ingredients.filter((ingredient) =>
    Object.values(ingredient).some((value) => String(value).toLowerCase().includes(searchTerm.toLowerCase()))
  )

  // Simulation test result for the currently inspected ingredient
  const simulatedPriceResult = useMemo(() => {
    if (!selectedIngredientForPrice) return null
    return getEffectiveIngredientPrice(selectedIngredientForPrice, simTestDate)
  }, [selectedIngredientForPrice, simTestDate])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <span>Ingredients Master</span>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  Date-Wise Price Master Active
                </Badge>
              </CardTitle>
              <CardDescription>
                Manage ingredients with full date-wise and session-wise historical price tracking for accurate day dispatch cost calculation.
              </CardDescription>
            </div>
            <Button onClick={openAddForm}>
              <Plus className="mr-2 h-4 w-4" />
              Add Ingredient
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <Search className="h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search ingredients by name, HSN, brand, type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>HSN</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="min-w-[200px]">Rate / Price (₹)</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Sub Brand</TableHead>
                  <TableHead>GP</TableHead>
                  <TableHead>Sub GP</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead>Packing</TableHead>
                  <TableHead>Default Supplier</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIngredients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center py-8">
                      No ingredients found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredIngredients.map((ingredient) => {
                    const effectivePrice = getEffectiveIngredientPrice(ingredient)
                    const historyCount = Array.isArray(ingredient.priceHistory) ? ingredient.priceHistory.length : 0

                    return (
                      <TableRow key={ingredient.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-mono text-xs">{ingredient.hsn}</TableCell>
                        <TableCell className="font-medium text-foreground">
                          <div>
                            <span>{ingredient.name}</span>
                            {ingredient.variantName && (
                              <span className="block text-xs text-muted-foreground">{ingredient.variantName}</span>
                            )}
                          </div>
                        </TableCell>

                        {/* Rate / Price Column: Bold Numeric Rate Display */}
                        <TableCell className="min-w-[200px]">
                          {(() => {
                            const eff = getEffectiveIngredientPrice(ingredient)
                            const defaultPrice = eff.defaultPrice || 0
                            const activePrice = eff.price || defaultPrice || 0
                            const unit = eff.unit || ingredient.priceUnit || ingredient.rateUnit || ingredient.u1 || "Kg"
                            const historyCount = Array.isArray(ingredient.priceHistory) ? ingredient.priceHistory.length : 0
                            const hasDynamic = eff.hasDynamicDateRate && historyCount > 0

                            return (
                              <div className="space-y-1.5 py-1">
                                {/* 1. Prominent Numeric Rate Badge / Pill (Clickable to Edit) */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => openDefaultRateEdit(ingredient)}
                                    className="group inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-300 hover:border-emerald-500 rounded-md px-2.5 py-1 transition-all cursor-pointer shadow-2xs"
                                    title="Click to change Rate"
                                  >
                                    <span className="text-base font-black text-emerald-800">
                                      ₹{activePrice.toFixed(2)}
                                    </span>
                                    <span className="text-xs font-bold text-emerald-950">
                                      / {unit}
                                    </span>
                                    <Edit className="h-3 w-3 text-emerald-600 group-hover:text-emerald-800 ml-0.5" />
                                  </button>

                                  {hasDynamic ? (
                                    <Badge className="text-[10px] px-1.5 py-0.5 bg-blue-600 hover:bg-blue-700 text-white font-bold">
                                      Dynamic Active
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-700 border-slate-300 font-semibold">
                                      Default Rate
                                    </Badge>
                                  )}
                                </div>

                                {/* 2. Clear Breakdown: Default vs Dynamic */}
                                <div className="text-[11px] text-slate-600 space-y-0.5">
                                  {hasDynamic ? (
                                    <>
                                      <div className="flex items-center gap-1">
                                        <span className="text-muted-foreground">Default Rate:</span>
                                        <button
                                          type="button"
                                          onClick={() => openDefaultRateEdit(ingredient)}
                                          className="font-bold text-slate-800 hover:text-emerald-700 underline cursor-pointer"
                                        >
                                          ₹{defaultPrice.toFixed(2)}
                                        </button>
                                      </div>
                                      <div className="flex items-center gap-1 text-blue-700 font-medium">
                                        <span>Date-Wise Rate:</span>
                                        <strong className="font-bold">₹{eff.price.toFixed(2)}</strong>
                                        <span className="text-[10px] text-slate-400">({eff.effectiveDate})</span>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                                      <span>Rate applied in dispatch calculations</span>
                                    </div>
                                  )}
                                </div>

                                {/* 3. Action Links */}
                                <div className="flex items-center gap-2 pt-0.5 text-[11px]">
                                  <button
                                    type="button"
                                    onClick={() => openDefaultRateEdit(ingredient)}
                                    className="text-emerald-700 hover:text-emerald-900 hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <Edit className="h-2.5 w-2.5" />
                                    Edit Rate
                                  </button>
                                  <span className="text-slate-300">&bull;</span>
                                  <button
                                    type="button"
                                    onClick={() => openPriceModal(ingredient)}
                                    className="text-blue-600 hover:text-blue-800 hover:underline font-medium flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <History className="h-2.5 w-2.5" />
                                    {hasDynamic ? `${historyCount} Date Revisions` : "+ Date Revision"}
                                  </button>
                                </div>
                              </div>
                            )
                          })()}
                        </TableCell>

                        <TableCell>{getNameById(ingredient.templateId, templates)}</TableCell>
                        <TableCell>{getNameById(ingredient.brandId, brands)}</TableCell>
                        <TableCell>{getNameById(ingredient.subBrandId, subBrands)}</TableCell>
                        <TableCell>{getNameById(ingredient.gpId, gps)}</TableCell>
                        <TableCell>{getNameById(ingredient.subGpId, subGps)}</TableCell>
                        <TableCell>{getNameById(ingredient.typeId, types)}</TableCell>
                        <TableCell>{getNameById(ingredient.defaultId, defaults)}</TableCell>
                        <TableCell>{ingredient.packing}</TableCell>
                        <TableCell>{getNameById(ingredient.supplier1Id, suppliers)}</TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              ingredient.frequency === "daily"
                                ? "bg-green-100 text-green-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {ingredient.frequency}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openPriceModal(ingredient)}
                              title="Manage Date-Wise Price History"
                              className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            >
                              <IndianRupee className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openEditForm(ingredient)} className="h-8 w-8 p-0">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(ingredient.id)} className="h-8 w-8 p-0 text-red-500 hover:text-red-700">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ─── Modal: Date-Wise Price Master & Session History ───────────────── */}
      <Dialog open={isPriceModalOpen} onOpenChange={setIsPriceModalOpen}>
        <DialogContent
          className="w-[94vw] sm:max-w-[760px] max-h-[90vh] flex flex-col p-6 overflow-hidden"
          style={{ maxWidth: "min(94vw, 760px)", width: "94vw" }}
        >
          <DialogHeader className="border-b pb-3 shrink-0">
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                  <IndianRupee className="h-5 w-5 text-emerald-600" />
                  Date-Wise Price Master: {selectedIngredientForPrice?.name}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  Record day-wise and seasonal pricing fluctuations (e.g. ₹20 in April vs ₹40 in November). The dispatch cost engine automatically applies the rate active on each specific date.
                </DialogDescription>
              </div>
            </div>

            {/* Quick Metrics Header */}
            {selectedIngredientForPrice && (() => {
              const effToday = getEffectiveIngredientPrice(selectedIngredientForPrice)
              const defaultRate = effToday.defaultPrice
              const unit = selectedIngredientForPrice.priceUnit || selectedIngredientForPrice.u1 || "Kg"

              return (
                <div className="grid grid-cols-3 gap-3 pt-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-700 tracking-wider block">Default Static Rate</span>
                      <button
                        type="button"
                        onClick={() => openDefaultRateEdit(selectedIngredientForPrice)}
                        className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5 font-medium"
                      >
                        <Edit className="h-2.5 w-2.5" /> Edit
                      </button>
                    </div>
                    <div className="text-lg font-bold text-slate-800 mt-0.5">
                      ₹{defaultRate.toFixed(2)}
                      <span className="text-xs font-normal text-muted-foreground ml-1">/ {unit}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">Baseline fallback</span>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                    <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">Active Rate Today</span>
                    <div className="text-lg font-bold text-emerald-700 mt-0.5">
                      ₹{effToday.price.toFixed(2)}
                      <span className="text-xs font-normal text-emerald-900 ml-1">/ {effToday.unit}</span>
                    </div>
                    <span className="text-[10px] font-medium text-emerald-700">
                      {effToday.rateType === "dynamic" ? `Dynamic (${effToday.effectiveDate})` : "Default rate active"}
                    </span>
                  </div>

                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-2.5">
                    <span className="text-[10px] uppercase font-bold text-purple-800 tracking-wider block">Date Revisions</span>
                    <div className="text-lg font-bold text-purple-900 mt-0.5">
                      {selectedIngredientForPrice.priceHistory?.length || 0} records
                    </div>
                    <span className="text-[10px] text-purple-700">Day-wise variations</span>
                  </div>
                </div>
              )
            })()}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-5 pr-1 py-2">
            {/* 1. Add / Record New Price Revision */}
            <div className="border border-slate-200 bg-slate-50/70 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="h-4 w-4 text-emerald-600" />
                Record New Date-Wise Price Revision
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {/* Effective Date */}
                <div className="space-y-1">
                  <Label htmlFor="effectiveDate" className="text-xs font-medium">
                    Effective Date *
                  </Label>
                  <Input
                    id="effectiveDate"
                    type="date"
                    value={priceFormData.effectiveDate}
                    onChange={(e) => setPriceFormData({ ...priceFormData, effectiveDate: e.target.value })}
                    className="h-9 text-xs bg-white"
                  />
                </div>

                {/* Price / Rate */}
                <div className="space-y-1">
                  <Label htmlFor="priceVal" className="text-xs font-medium">
                    Rate (₹) *
                  </Label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-xs font-semibold text-muted-foreground">₹</span>
                    <Input
                      id="priceVal"
                      type="number"
                      step="0.01"
                      placeholder="e.g. 20.00"
                      value={priceFormData.price}
                      onChange={(e) => setPriceFormData({ ...priceFormData, price: e.target.value })}
                      className="h-9 text-xs pl-6 bg-white font-bold"
                    />
                  </div>
                </div>

                {/* Unit */}
                <div className="space-y-1">
                  <Label htmlFor="priceUnit" className="text-xs font-medium">
                    Unit
                  </Label>
                  <select
                    id="priceUnit"
                    value={priceFormData.unit}
                    onChange={(e) => setPriceFormData({ ...priceFormData, unit: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-white px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="Kg">Kg</option>
                    <option value="Gm">Gm</option>
                    <option value="Ltr">Ltr</option>
                    <option value="Ml">Ml</option>
                    <option value="Pcs">Pcs</option>
                    <option value="Packet">Packet</option>
                    <option value="Box">Box</option>
                  </select>
                </div>

                {/* Session / Season Name */}
                <div className="space-y-1">
                  <Label htmlFor="sessionName" className="text-xs font-medium">
                    Session / Period
                  </Label>
                  <Input
                    id="sessionName"
                    placeholder="e.g. April Mandi, Summer, Winter"
                    value={priceFormData.session}
                    onChange={(e) => setPriceFormData({ ...priceFormData, session: e.target.value })}
                    className="h-9 text-xs bg-white"
                  />
                </div>
              </div>

              {/* Notes & Submit Row */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                <Input
                  placeholder="Optional remarks (e.g. Mandi rate increase, Vendor contract update)..."
                  value={priceFormData.notes}
                  onChange={(e) => setPriceFormData({ ...priceFormData, notes: e.target.value })}
                  className="h-9 text-xs bg-white flex-1"
                />
                <Button
                  size="sm"
                  onClick={handleSavePriceRevision}
                  disabled={isSavingPrice}
                  className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5 px-4 shrink-0 shadow-xs"
                >
                  {isSavingPrice ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  {isSavingPrice ? "Saving..." : "Save Rate Revision"}
                </Button>
              </div>
            </div>

            {/* 2. Historical Price Revisions Timeline */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="h-4 w-4 text-blue-600" />
                  Price Revision History Timeline
                </h4>
                <span className="text-[11px] text-muted-foreground">
                  Sorted chronologically (Newest first)
                </span>
              </div>

              {(!selectedIngredientForPrice?.priceHistory || selectedIngredientForPrice.priceHistory.length === 0) ? (
                <div className="text-center py-6 border border-dashed rounded-lg bg-slate-50/50 text-xs text-muted-foreground">
                  <Clock className="h-6 w-6 mx-auto mb-1 text-slate-400 opacity-60" />
                  No date-wise history recorded yet. Enter a rate above to begin tracking day-wise pricing.
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-100/70">
                      <TableRow className="text-[11px]">
                        <TableHead className="py-2">Effective Date</TableHead>
                        <TableHead className="py-2">Price / Rate</TableHead>
                        <TableHead className="py-2">Session / Period</TableHead>
                        <TableHead className="py-2">Notes</TableHead>
                        <TableHead className="py-2 text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...(selectedIngredientForPrice.priceHistory || [])]
                        .reverse()
                        .map((rec, rIdx) => {
                          const isTodayActive =
                            selectedIngredientForPrice.priceEffectiveDate === rec.effectiveDate &&
                            selectedIngredientForPrice.price === rec.price

                          return (
                            <TableRow key={rec.id || `rec_${rIdx}`} className={isTodayActive ? "bg-emerald-50/40" : ""}>
                              <TableCell className="font-mono text-xs font-medium py-2.5">
                                <div className="flex items-center gap-1.5">
                                  <span>{rec.effectiveDate}</span>
                                  {isTodayActive && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 bg-emerald-100 text-emerald-800 border-emerald-300">
                                      Active Today
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="py-2.5">
                                <strong className="text-emerald-700 font-bold text-xs">
                                  ₹{Number(rec.price).toFixed(2)}
                                </strong>
                                <span className="text-[11px] text-muted-foreground ml-1">/ {rec.unit}</span>
                              </TableCell>
                              <TableCell className="py-2.5 text-xs text-slate-700">
                                <span className="font-medium bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                                  {rec.session || "Regular"}
                                </span>
                              </TableCell>
                              <TableCell className="py-2.5 text-xs text-muted-foreground">
                                {rec.notes || "—"}
                              </TableCell>
                              <TableCell className="py-2.5 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeletePriceRevision(rec)}
                                  className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                  title="Delete this revision"
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
            </div>

            {/* 3. Historical Date Price Simulator / Inspector */}
            <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5 uppercase tracking-wider">
                  <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                  Date-Wise Rate Inspector (Dispatch Cost Simulation)
                </span>
                <span className="text-[11px] text-blue-700">
                  Verify how Dispatch extracts rates on any historical or future date
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="simDate" className="text-xs font-medium text-slate-700 whitespace-nowrap">
                    Test Date:
                  </Label>
                  <Input
                    id="simDate"
                    type="date"
                    value={simTestDate}
                    onChange={(e) => setSimTestDate(e.target.value)}
                    className="h-8 text-xs w-36 bg-white"
                  />
                </div>

                {simulatedPriceResult && (
                  <div className="flex-1 flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border border-blue-200 shadow-2xs flex-wrap">
                    <ArrowRight className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    <span className="text-xs text-slate-700">
                      Rate on <strong>{simTestDate}</strong>:
                    </span>
                    <strong className="text-sm font-bold text-emerald-700">
                      ₹{simulatedPriceResult.price.toFixed(2)} / {simulatedPriceResult.unit}
                    </strong>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${simulatedPriceResult.rateType === "dynamic" ? "bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold" : "bg-slate-100 text-slate-700 border-slate-300 font-normal"}`}>
                      {simulatedPriceResult.rateType === "dynamic" ? "Dynamic Date Rate Active" : "Default Rate Considered"}
                    </Badge>
                    {simulatedPriceResult.effectiveDate && (
                      <span className="text-[11px] text-muted-foreground ml-auto">
                        (Effective since: {simulatedPriceResult.effectiveDate} &bull; {simulatedPriceResult.session || "Regular"})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-3 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setIsPriceModalOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Modal: Quick Edit Default Static Rate ──────────────────────────── */}
      <Dialog open={isDefaultRateModalOpen} onOpenChange={setIsDefaultRateModalOpen}>
        <DialogContent className="max-w-[420px] p-5">
          <DialogHeader className="border-b pb-2.5">
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <IndianRupee className="h-4 w-4 text-emerald-600" />
              Edit Default Rate: {selectedIngredientForDefaultRate?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              This is the static baseline rate. If no dynamic date-wise revision exists for a day, dispatch calculations automatically consider this default rate.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label htmlFor="defaultRateInputVal" className="text-xs font-semibold">
                Default Rate (₹) *
              </Label>
              <div className="relative">
                <span className="absolute left-2.5 top-2 text-xs font-semibold text-muted-foreground">₹</span>
                <Input
                  id="defaultRateInputVal"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 40.00"
                  value={defaultRateInput}
                  onChange={(e) => setDefaultRateInput(e.target.value)}
                  className="h-9 text-xs pl-6 font-bold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="defaultUnitInputVal" className="text-xs font-semibold">
                Rate Unit
              </Label>
              <select
                id="defaultUnitInputVal"
                value={defaultUnitInput}
                onChange={(e) => setDefaultUnitInput(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="Kg">Kg</option>
                <option value="Gm">Gm</option>
                <option value="Ltr">Ltr</option>
                <option value="Ml">Ml</option>
                <option value="Pcs">Pcs</option>
                <option value="Packet">Packet</option>
                <option value="Box">Box</option>
              </select>
            </div>
          </div>

          <DialogFooter className="border-t pt-3 flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsDefaultRateModalOpen(false)
                if (selectedIngredientForDefaultRate) {
                  openPriceModal(selectedIngredientForDefaultRate)
                }
              }}
              className="text-xs text-blue-600 hover:text-blue-800 p-0 h-auto"
            >
              Manage Date Rates &rarr;
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsDefaultRateModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveDefaultRate}
                disabled={isSavingDefaultRate}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1 text-xs"
              >
                {isSavingDefaultRate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {isSavingDefaultRate ? "Saving..." : "Save Default Rate"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <IngredientsForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false)
          setEditingItem(null)
        }}
        onSubmit={editingItem ? handleEdit : handleAdd}
        editingItem={editingItem}
        loading={loading}
      />
    </div>
  )
}
