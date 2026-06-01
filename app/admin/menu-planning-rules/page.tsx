"use client"

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Settings, Save, Loader2, Info, ChevronRight, X, Check, ChevronsUpDown, Plus, Sparkles } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import {
  servicesService,
  subServicesService,
  mealPlansService,
  subMealPlansService,
  companiesService,
  menuPlanningRulesService,
  menuItemsService,
  mealPlanStructureAssignmentsService,
} from "@/lib/services"
import type { Service, SubService, MealPlan, SubMealPlan, Company, MenuPlanningRule } from "@/lib/types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]



export default function MenuPlanningRulesPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Master Data
  const [services, setServices] = useState<Service[]>([])
  const [subServices, setSubServices] = useState<SubService[]>([])
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([])
  const [subMealPlans, setSubMealPlans] = useState<SubMealPlan[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [mealPlanAssignments, setMealPlanAssignments] = useState<any[]>([])

  // Selection State
  const [selectedServiceId, setSelectedServiceId] = useState<string>("")
  const [selectedSubServiceId, setSelectedSubServiceId] = useState<string>("")
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("base") // "base" means Global Base Rule

  // Rules State
  const [currentRule, setCurrentRule] = useState<MenuPlanningRule>({
    serviceId: "",
    subServiceId: "",
    dayRules: {},
  })

  // Modal State
  const [editingCell, setEditingCell] = useState<{ day: string; cellKey: string; subMealPlanName: string } | null>(null)
  const [cellForm, setCellForm] = useState<{
    allowedColors: string[]
    allowedCuisines: string[]
    allowedIngredients: string[]
    allowedFlavorProfiles: string[]
    heavyLight: string
  }>({
    allowedColors: [],
    allowedCuisines: [],
    allowedIngredients: [],
    allowedFlavorProfiles: [],
    heavyLight: "",
  })

  const [tagOptions, setTagOptions] = useState({
    colors: [] as string[],
    cuisines: [] as string[],
    ingredients: [] as string[],
    flavors: [] as string[]
  })

  // Initial Load
  useEffect(() => {
    async function loadData() {
      try {
        const [svcs, ssvcs, mps, smps, comps, items, assignments] = await Promise.all([
          servicesService.getActive(),
          subServicesService.getActive(),
          mealPlansService.getActive(),
          subMealPlansService.getActive(),
          companiesService.getAll(),
          menuItemsService.getActive(),
          mealPlanStructureAssignmentsService.getAll(),
        ])
        setServices(svcs.sort((a, b) => (a.order || 0) - (b.order || 0)))
        setSubServices(ssvcs.sort((a, b) => (a.order || 0) - (b.order || 0)))
        setMealPlans(mps.sort((a, b) => (a.order || 0) - (b.order || 0)))
        setSubMealPlans(smps.sort((a, b) => (a.order || 0) - (b.order || 0)))
        setCompanies(comps)
        setMealPlanAssignments(assignments)

        const colors = new Set<string>()
        const cuisines = new Set<string>()
        const ingredients = new Set<string>()
        const flavors = new Set<string>()

        items.forEach(item => {
          if (item.aiTags?.color) colors.add(item.aiTags.color)
          if (item.aiTags?.cuisine) cuisines.add(item.aiTags.cuisine)
          if (item.aiTags?.primaryIngredient) ingredients.add(item.aiTags.primaryIngredient)
          if (item.aiTags?.flavorProfile) flavors.add(item.aiTags.flavorProfile)
        })

        setTagOptions({
          colors: Array.from(colors).filter(Boolean).sort(),
          cuisines: Array.from(cuisines).filter(Boolean).sort(),
          ingredients: Array.from(ingredients).filter(Boolean).sort(),
          flavors: Array.from(flavors).filter(Boolean).sort()
        })

        if (svcs.length > 0) {
          setSelectedServiceId(svcs[0].id)
          const firstSub = ssvcs.find(s => s.serviceId === svcs[0].id)
          if (firstSub) setSelectedSubServiceId(firstSub.id)
        }
      } catch (error) {
        console.error(error)
        toast({ title: "Error loading data", variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const loadRule = useCallback(async () => {
    if (!selectedServiceId || !selectedSubServiceId) return

    setLoading(true)
    try {
      let rule: MenuPlanningRule | null
      if (selectedCompanyId === "base") {
        rule = await menuPlanningRulesService.getBaseRule(selectedServiceId, selectedSubServiceId)
      } else {
        rule = await menuPlanningRulesService.getCompanyRule(selectedServiceId, selectedSubServiceId, selectedCompanyId)
      }
      
      setCurrentRule(rule || {
        serviceId: selectedServiceId,
        subServiceId: selectedSubServiceId,
        companyId: selectedCompanyId === "base" ? undefined : selectedCompanyId,
        dayRules: {}
      })
    } catch (error) {
      console.error(error)
      toast({ title: "Error loading rules", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [selectedServiceId, selectedSubServiceId, selectedCompanyId])

  // Load Rule when selection changes
  useEffect(() => {
    loadRule()
  }, [loadRule])


  // Get MealPlans that have SubMealPlans assigned in the structure
  const structureData = useMemo(() => {
    if (!selectedServiceId || !selectedSubServiceId) return []

    const relevantAssignments = selectedCompanyId !== "base"
      ? mealPlanAssignments.filter((a: any) => a.companyId === selectedCompanyId)
      : mealPlanAssignments

    return mealPlans.map(mp => {
      const smps = subMealPlans.filter(smp => {
        if (smp.mealPlanId !== mp.id) return false
        
        // Check if this sub meal plan is in ANY assignment for the selected service/subservice
        return relevantAssignments.some((assignment: any) => {
          return DAYS.some(day => {
            const dayStructure = assignment.weekStructure?.[day] || []
            const sInDay = dayStructure.find((s: any) => s.serviceId === selectedServiceId)
            const ssInDay = sInDay?.subServices?.find((ss: any) => ss.subServiceId === selectedSubServiceId)
            const mpInDay = ssInDay?.mealPlans?.find((m: any) => m.mealPlanId === mp.id)
            return mpInDay?.subMealPlans?.some((s: any) => s.subMealPlanId === smp.id)
          })
        })
      })
      return { ...mp, subMealPlans: smps }
    }).filter(mp => mp.subMealPlans.length > 0)
  }, [mealPlans, subMealPlans, mealPlanAssignments, selectedServiceId, selectedSubServiceId, selectedCompanyId])

  const handleSaveAll = async () => {
    try {
      setSaving(true)
      await menuPlanningRulesService.saveRule({
        ...currentRule,
        serviceId: selectedServiceId,
        subServiceId: selectedSubServiceId,
        companyId: selectedCompanyId === "base" ? undefined : selectedCompanyId,
      })
      toast({ title: "Success", description: "Rules saved successfully." })
      await loadRule()
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Failed to save rules", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleAutoGenerateRules = async () => {
    if (!selectedServiceId || !selectedSubServiceId) return
    setGenerating(true)
    toast({ title: "Generating...", description: "AI is analyzing past menus. This may take up to 30 seconds." })
    try {
      const res = await fetch("/api/ai/infer-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: selectedServiceId, subServiceId: selectedSubServiceId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to generate rules")

      const newRules = data.rules
      
      setCurrentRule(prev => ({
        ...prev,
        grandRules: newRules.grandRules || prev.grandRules || [],
        dayRules: newRules.dayRules || prev.dayRules || {}
      }))
      
      toast({ title: "Success", description: "AI generated rules from past menus. Please review and save." })
    } catch (error: any) {
      console.error(error)
      toast({ title: "AI Error", description: error.message, variant: "destructive" })
    } finally {
      setGenerating(false)
    }
  }

  const updateGlobalDayRule = (day: string, value: string) => {
    setCurrentRule(prev => ({
      ...prev,
      dayRules: {
        ...prev.dayRules,
        [day]: {
          ...(prev.dayRules?.[day] || { cellRules: {} }),
          globalDayRule: value
        }
      }
    }))
  }

  const [newGrandRule, setNewGrandRule] = useState("")

  const addGrandRule = () => {
    if (!newGrandRule.trim()) return
    setCurrentRule(prev => ({
      ...prev,
      grandRules: [...(prev.grandRules || []), newGrandRule.trim()]
    }))
    setNewGrandRule("")
  }

  const removeGrandRule = (index: number) => {
    setCurrentRule(prev => ({
      ...prev,
      grandRules: (prev.grandRules || []).filter((_, i) => i !== index)
    }))
  }

  const openCellEditor = (day: string, mpId: string, smpId: string, smpName: string) => {
    const cellKey = `${mpId}|${smpId}`
    const existing = currentRule.dayRules?.[day]?.cellRules?.[cellKey] || {}
    
    setCellForm({
      allowedColors: existing.allowedColors || [],
      allowedCuisines: existing.allowedCuisines || [],
      allowedIngredients: existing.allowedIngredients || [],
      allowedFlavorProfiles: existing.allowedFlavorProfiles || [],
      heavyLight: existing.heavyLight || "",
    })
    setEditingCell({ day, cellKey, subMealPlanName: smpName })
  }

  const saveCellEdit = () => {
    if (!editingCell) return
    const { day, cellKey } = editingCell
    
    setCurrentRule(prev => {
      const dayData = prev.dayRules?.[day] || { cellRules: {} }
      const newCellRules = { ...dayData.cellRules }
      
      newCellRules[cellKey] = {
        allowedColors: cellForm.allowedColors,
        allowedCuisines: cellForm.allowedCuisines,
        allowedIngredients: cellForm.allowedIngredients,
        allowedFlavorProfiles: cellForm.allowedFlavorProfiles,
        heavyLight: cellForm.heavyLight
      }

      // Cleanup empty arrays to save space
      const cell = newCellRules[cellKey]
      if (!cell.allowedColors?.length) delete cell.allowedColors
      if (!cell.allowedCuisines?.length) delete cell.allowedCuisines
      if (!cell.allowedIngredients?.length) delete cell.allowedIngredients
      if (!cell.allowedFlavorProfiles?.length) delete cell.allowedFlavorProfiles
      if (!cell.heavyLight) delete cell.heavyLight
      
      // If cell has no rules, delete it completely
      if (Object.keys(cell).length === 0) {
        delete newCellRules[cellKey]
      }

      return {
        ...prev,
        dayRules: {
          ...prev.dayRules,
          [day]: {
            ...dayData,
            cellRules: newCellRules
          }
        }
      }
    })
    
    setEditingCell(null)
  }

  const toggleArrayItem = (key: keyof typeof cellForm, value: string) => {
    setCellForm(prev => {
      const arr = prev[key] as string[]
      if (arr.includes(value)) {
        return { ...prev, [key]: arr.filter(i => i !== value) }
      } else {
        return { ...prev, [key]: [...arr, value] }
      }
    })
  }

  if (loading && services.length === 0) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-gray-50">
      
      {/* HORIZONTAL SERVICE NAVIGATION PANEL (Like Menu Edit Modal) */}
      <div className="w-full bg-gray-50 border-b flex items-center justify-between p-3 flex-wrap gap-4 z-10">
        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex gap-2">
            {services.map((service) => (
              <button
                key={service.id}
                onClick={() => {
                  setSelectedServiceId(service.id)
                  const firstSub = subServices.find(ss => ss.serviceId === service.id)
                  if (firstSub) setSelectedSubServiceId(firstSub.id)
                }}
                className={`px-4 py-2 rounded font-medium text-sm transition-colors ${
                  selectedServiceId === service.id ? "bg-blue-600 text-white" : "bg-white border text-gray-700 hover:bg-gray-100"
                }`}
              >
                {service.name}
              </button>
            ))}
          </div>
          
          {selectedServiceId && (
            <>
              <div className="flex items-center text-gray-400 px-2">
                <ChevronRight className="h-4 w-4" />
              </div>
              <div className="flex gap-2">
                {subServices.filter(ss => ss.serviceId === selectedServiceId).map((subService) => (
                  <button
                    key={subService.id}
                    onClick={() => setSelectedSubServiceId(subService.id)}
                    className={`px-4 py-2 rounded font-medium text-sm transition-colors ${
                      selectedSubServiceId === subService.id ? "bg-green-600 text-white" : "bg-white border text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {subService.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Rule Scope:</span>
            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
              <SelectTrigger className="w-[240px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="base">
                  <span className="font-semibold text-blue-600">Global Base Rule</span> (Applies to all)
                </SelectItem>
                {companies.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    Company: {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSaveAll} disabled={saving} className="bg-blue-600 hover:bg-blue-700 h-9">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Rules
          </Button>
        </div>
      </div>

      {/* Info Banner for Override */}
      {selectedCompanyId !== "base" && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-amber-700 text-sm">
          <Info className="h-4 w-4" />
          <span>You are editing a <strong>Company Override</strong>. These rules will supersede the Global Base Rule for this specific company.</span>
        </div>
      )}

      {/* RIGHT PANEL / GRID */}
      <div className="flex-1 overflow-auto relative p-4 flex flex-col gap-4">
        {loading && (
          <div className="absolute inset-0 z-50 bg-white/50 backdrop-blur-sm flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        )}

        {/* Grand Rules Section */}
        {selectedServiceId && (
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  Grand Rules (Service Level)
                </h3>
                <p className="text-xs text-gray-500">Cross-meal constraints (e.g. "Do not repeat main ingredients across meals in the same day")</p>
              </div>
              <Button 
                variant="outline" 
                className="text-purple-600 border-purple-200 hover:bg-purple-50"
                onClick={handleAutoGenerateRules}
                disabled={generating}
              >
                {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {generating ? "Generating..." : "Auto-Generate AI Rules"}
              </Button>
            </div>
            
            <div className="flex gap-2 mb-3">
              <Input 
                placeholder="Type a new grand rule..." 
                value={newGrandRule}
                onChange={e => setNewGrandRule(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addGrandRule()}
                className="max-w-md h-9"
              />
              <Button onClick={addGrandRule} className="h-9 w-9 p-0" variant="secondary">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              {currentRule.grandRules && currentRule.grandRules.length > 0 ? (
                currentRule.grandRules.map((gr, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded border text-sm text-gray-700 max-w-2xl">
                    <span>{gr}</span>
                    <button onClick={() => removeGrandRule(idx)} className="text-gray-400 hover:text-red-500">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-xs text-gray-400 italic">No grand rules defined yet.</div>
              )}
            </div>
          </div>
        )}
        
        <div className="inline-block min-w-full bg-white rounded-lg shadow-sm border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 border-collapse">
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-20 bg-gray-100 border-b border-r px-4 py-3 text-left w-[250px] shadow-[1px_1px_0_0_#e5e7eb]">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Sub Meals</span>
                </th>
                {DAYS.map(day => (
                  <th key={day} className="sticky top-0 z-10 bg-gray-100 border-b border-r px-4 py-3 text-center min-w-[200px] shadow-[0_1px_0_0_#e5e7eb]">
                    <div className="font-bold text-gray-800 capitalize mb-3">{day}</div>
                    <Input 
                      placeholder="Global day rule (e.g. No repeats)" 
                      className="text-xs h-8 bg-white"
                      value={currentRule.dayRules?.[day]?.globalDayRule || ""}
                      onChange={e => updateGlobalDayRule(day, e.target.value)}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {structureData.map(mp => (
                <React.Fragment key={mp.id}>
                  {/* Meal Plan Header */}
                  <tr className="bg-gray-50">
                    <td colSpan={8} className="sticky left-0 px-4 py-2 border-b font-bold text-gray-700 text-sm uppercase">
                      {mp.name}
                    </td>
                  </tr>
                  {/* Sub Meal Plans */}
                  {mp.subMealPlans.map(smp => (
                    <tr key={smp.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="sticky left-0 bg-white group-hover:bg-blue-50/30 border-b border-r px-4 py-3 text-sm font-medium text-gray-900 shadow-[1px_0_0_0_#e5e7eb]">
                        {smp.name}
                      </td>
                      {DAYS.map(day => {
                        const cellKey = `${mp.id}|${smp.id}`
                        const cellRules = currentRule.dayRules?.[day]?.cellRules?.[cellKey]
                        const hasRules = cellRules && Object.keys(cellRules).length > 0
                        
                        return (
                          <td 
                            key={`${day}-${smp.id}`} 
                            className="border-b border-r p-2 cursor-pointer hover:bg-blue-100 transition-colors text-center align-top relative min-h-[60px]"
                            onClick={() => openCellEditor(day, mp.id, smp.id, smp.name)}
                          >
                            {!hasRules ? (
                              <div className="text-gray-300 text-xs italic flex items-center justify-center h-full min-h-[40px]">
                                + Add Rule
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1 text-[10px] text-left">
                                {cellRules.allowedColors?.length ? <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded truncate border border-amber-200">🎨 {cellRules.allowedColors.join(", ")}</span> : null}
                                {cellRules.allowedCuisines?.length ? <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded truncate border border-emerald-200">🌍 {cellRules.allowedCuisines.join(", ")}</span> : null}
                                {cellRules.allowedIngredients?.length ? <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded truncate border border-blue-200">🥦 {cellRules.allowedIngredients.join(", ")}</span> : null}
                                {cellRules.allowedFlavorProfiles?.length ? <span className="bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded truncate border border-rose-200">🌶️ {cellRules.allowedFlavorProfiles.join(", ")}</span> : null}
                                {cellRules.heavyLight ? <span className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded truncate font-medium border border-slate-300">⚖️ {cellRules.heavyLight}</span> : null}
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cell Editor Modal */}
      <Dialog open={!!editingCell} onOpenChange={(open) => !open && setEditingCell(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="capitalize text-xl">{editingCell?.day} - {editingCell?.subMealPlanName}</DialogTitle>
            <DialogDescription>
              Select tags to constrain AI suggestions. Selecting nothing means no restriction.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2 py-4 space-y-6">
            
            {/* Colors */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-gray-700">🎨 Allowed Colors</Label>
              <MultiSelect
                options={tagOptions.colors}
                selected={cellForm.allowedColors}
                onChange={(val) => setCellForm(prev => ({ ...prev, allowedColors: val }))}
                placeholder="Search and select colors..."
              />
            </div>

            {/* Cuisines */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-gray-700">🌍 Allowed Cuisines</Label>
              <MultiSelect
                options={tagOptions.cuisines}
                selected={cellForm.allowedCuisines}
                onChange={(val) => setCellForm(prev => ({ ...prev, allowedCuisines: val }))}
                placeholder="Search and select cuisines..."
              />
            </div>

            {/* Ingredients */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-gray-700">🥦 Primary Ingredients</Label>
              <MultiSelect
                options={tagOptions.ingredients}
                selected={cellForm.allowedIngredients}
                onChange={(val) => setCellForm(prev => ({ ...prev, allowedIngredients: val }))}
                placeholder="Search and select ingredients..."
              />
            </div>

            {/* Flavors */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-gray-700">🌶️ Flavor Profiles</Label>
              <MultiSelect
                options={tagOptions.flavors}
                selected={cellForm.allowedFlavorProfiles}
                onChange={(val) => setCellForm(prev => ({ ...prev, allowedFlavorProfiles: val }))}
                placeholder="Search and select flavor profiles..."
              />
            </div>

            {/* Heavy / Light */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-gray-700">⚖️ Heavy / Light</Label>
              <Select value={cellForm.heavyLight} onValueChange={(val) => setCellForm(prev => ({ ...prev, heavyLight: val === "none" ? "" : val }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No restriction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No restriction</SelectItem>
                  <SelectItem value="Heavy">Heavy</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Light">Light</SelectItem>
                </SelectContent>
              </Select>
            </div>

          </div>
          <DialogFooter className="mt-4 pt-4 border-t">
            <Button variant="outline" onClick={() => setEditingCell(null)}>Cancel</Button>
            <Button onClick={saveCellEdit} className="bg-blue-600 hover:bg-blue-700">Save Rules</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Label({ children, className, htmlFor }: { children: React.ReactNode, className?: string, htmlFor?: string }) {
  return <label htmlFor={htmlFor} className={`text-sm font-medium leading-none ${className || ''}`}>{children}</label>
}

function MultiSelect({ 
  options, 
  selected, 
  onChange, 
  placeholder = "Select..." 
}: { 
  options: string[], 
  selected: string[], 
  onChange: (val: string[]) => void, 
  placeholder?: string 
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleUnselect = (item: string) => {
    onChange(selected.filter((i) => i !== item))
  }

  const filteredOptions = options.filter(o => o.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Trigger */}
      <div 
        onClick={() => setOpen(!open)}
        className="flex min-h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background cursor-pointer hover:bg-gray-50 transition-colors"
      >
        <div className="flex flex-wrap gap-1 flex-1 items-center">
          {selected.length === 0 && <span className="text-gray-500">{placeholder}</span>}
          {selected.map((item) => (
            <Badge variant="secondary" key={item} className="flex items-center gap-1">
              {item}
              <div
                className="rounded-full outline-none hover:bg-gray-300 p-0.5 cursor-pointer"
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleUnselect(item)
                }}
              >
                <X className="h-3 w-3" />
              </div>
            </Badge>
          ))}
        </div>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
      </div>

      {/* Dropdown Content */}
      {open && (
        <div className="absolute top-full left-0 z-[200] mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-white shadow-lg flex flex-col">
          <div className="sticky top-0 bg-white p-2 border-b z-10">
            <Input 
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="h-8 text-sm bg-gray-50"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="p-1 flex flex-col gap-0.5">
            {filteredOptions.length === 0 ? (
              <div className="p-2 text-sm text-center text-gray-500">No options found.</div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (selected.includes(option)) {
                      onChange(selected.filter(i => i !== option))
                    } else {
                      onChange([...selected, option])
                    }
                  }}
                  className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-hidden hover:bg-gray-100 text-gray-800"
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    {selected.includes(option) && <Check className="h-4 w-4 text-blue-600 font-bold" />}
                  </span>
                  {option}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
