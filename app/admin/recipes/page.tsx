"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
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
  BookOpen, 
  Search, 
  ChefHat, 
  Eye, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle, 
  Link as LinkIcon,
  RefreshCw,
  UtensilsCrossed,
  Filter,
  Sparkles,
  Pencil,
  Check,
  Package,
  Layers,
  ArrowRight,
  SlidersHorizontal
} from "lucide-react"
import { collection, getDocs, query, orderBy, doc, updateDoc, serverTimestamp, writeBatch } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { ingredientsService, templatesService, type Ingredient, type Template } from "@/lib/firestore"
import { toast } from "@/hooks/use-toast"

export interface RecipeIngredient {
  oldItemId: number
  oldItemName: string
  templateId: string | null
  templateName: string | null
  ingredientId: string | null
  ingredientName: string | null
  quantity: number
  unit: string
  confidence: "high" | "medium" | "unmapped" | "none"
}

export interface RecipeMasterItem {
  id: string
  oldRecipeId: number
  name: string
  menuItemId: string | null
  menuItemName: string | null
  category: string
  categoryId: number
  inGram: number
  isPiece: number
  status: string
  ingredientsCount: number
  ingredients: RecipeIngredient[]
  variations?: {
    standard?: {
      variationName: string
      rateTier: string
      season: string
    }
  }
}

interface MasterCatalogItem {
  id: string
  name: string
  templateId: string
  templateName: string
  unit: string
}

export default function RecipeMasterPage() {
  const [recipes, setRecipes] = useState<RecipeMasterItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL")
  const [linkFilter, setLinkFilter] = useState<string>("ALL")
  const [mappingFilter, setMappingFilter] = useState<string>("ALL")
  const [quickFilter, setQuickFilter] = useState<"ALL" | "UNLINKED" | "HAS_UNMAPPED" | "FULLY_MAPPED">("ALL")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeMasterItem | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Master ingredients & mapping modal state
  const [masterCatalog, setMasterCatalog] = useState<MasterCatalogItem[]>([])
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [isMapModalOpen, setIsMapModalOpen] = useState(false)
  const [editingIngredient, setEditingIngredient] = useState<RecipeIngredient | null>(null)
  const [editingIndex, setEditingIndex] = useState<number>(-1)
  const [catalogSearch, setCatalogSearch] = useState("")
  const [selectedMasterItem, setSelectedMasterItem] = useState<MasterCatalogItem | null>(null)
  const [applyToAll, setApplyToAll] = useState(true)
  const [isSavingMapping, setIsSavingMapping] = useState(false)

  // Link dish modal state
  const [menuItemsList, setMenuItemsList] = useState<{ id: string; name: string; category?: string }[]>([])
  const [loadingMenuItems, setLoadingMenuItems] = useState(false)
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false)
  const [recipeToLink, setRecipeToLink] = useState<RecipeMasterItem | null>(null)
  const [menuSearch, setMenuSearch] = useState("")
  const [selectedMenuItem, setSelectedMenuItem] = useState<{ id: string; name: string } | null>(null)
  const [isSavingLink, setIsSavingLink] = useState(false)

  const isIngredientUnmapped = (ing: RecipeIngredient) => {
    return !ing.templateName || ing.templateName === "None" || ing.confidence === "unmapped" || ing.confidence === "none"
  }

  const recipeHasUnmapped = (r: RecipeMasterItem) => {
    return r.ingredients && r.ingredients.some(isIngredientUnmapped)
  }

  useEffect(() => {
    loadRecipes()
    loadMasterCatalog()
  }, [])

  const loadRecipes = async () => {
    try {
      setLoading(true)
      const q = query(collection(db, "recipeMaster"), orderBy("name"))
      const snapshot = await getDocs(q)
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as RecipeMasterItem))
      setRecipes(data)
    } catch (err) {
      console.error("Error loading recipes:", err)
      toast({ title: "Error", description: "Failed to load recipes from database", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const loadMasterCatalog = async () => {
    try {
      setLoadingCatalog(true)
      const [ings, tmpls] = await Promise.all([
        ingredientsService.getAll(),
        templatesService.getAll()
      ])
      const tmplMap = new Map(tmpls.map(t => [t.id, t.name]))
      const catalog: MasterCatalogItem[] = ings.map(i => ({
        id: i.id,
        name: i.name,
        templateId: i.templateId,
        templateName: tmplMap.get(i.templateId) || "General Template",
        unit: i.u1 || "Kg"
      }))
      setMasterCatalog(catalog)
    } catch (err) {
      console.error("Failed to load master ingredients catalog:", err)
    } finally {
      setLoadingCatalog(false)
    }
  }

  // Extract unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>()
    recipes.forEach(r => {
      if (r.category) cats.add(r.category)
    })
    return Array.from(cats).sort()
  }, [recipes])

  // Filtered recipes
  const filteredRecipes = useMemo(() => {
    return recipes.filter(r => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const nameMatch = r.name?.toLowerCase().includes(term)
        const menuMatch = r.menuItemName?.toLowerCase().includes(term)
        const catMatch = r.category?.toLowerCase().includes(term)
        if (!nameMatch && !menuMatch && !catMatch) return false
      }

      if (selectedCategory !== "ALL" && r.category !== selectedCategory) {
        return false
      }

      // Quick filter
      if (quickFilter === "UNLINKED" && r.menuItemId) return false
      if (quickFilter === "HAS_UNMAPPED" && !recipeHasUnmapped(r)) return false
      if (quickFilter === "FULLY_MAPPED" && recipeHasUnmapped(r)) return false

      // Link filter dropdown
      if (linkFilter === "LINKED" && !r.menuItemId) return false
      if (linkFilter === "UNLINKED" && r.menuItemId) return false

      // Mapping filter dropdown
      if (mappingFilter === "HAS_UNMAPPED" && !recipeHasUnmapped(r)) return false
      if (mappingFilter === "FULLY_MAPPED" && recipeHasUnmapped(r)) return false

      return true
    })
  }, [recipes, searchTerm, selectedCategory, quickFilter, linkFilter, mappingFilter])

  // Pagination
  const totalPages = Math.ceil(filteredRecipes.length / pageSize) || 1
  const paginatedRecipes = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredRecipes.slice(start, start + pageSize)
  }, [filteredRecipes, currentPage, pageSize])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedCategory, quickFilter, linkFilter, mappingFilter, pageSize])

  const openRecipeDetails = (recipe: RecipeMasterItem) => {
    setSelectedRecipe(recipe)
    setIsModalOpen(true)
  }

  // Open mapping modal for an ingredient
  const handleOpenMap = (ing: RecipeIngredient, index: number) => {
    setEditingIngredient(ing)
    setEditingIndex(index)
    setCatalogSearch(ing.oldItemName || "")
    setSelectedMasterItem(null)
    setApplyToAll(true)
    setIsMapModalOpen(true)
  }

  // Filter catalog items
  const filteredCatalog = useMemo(() => {
    if (!catalogSearch.trim()) return masterCatalog.slice(0, 50)
    const term = catalogSearch.toLowerCase().trim()
    const tokens = term.split(/\s+/).filter(Boolean)
    return masterCatalog
      .filter(item => {
        const full = `${item.name} ${item.templateName}`.toLowerCase()
        return tokens.every(tok => full.includes(tok))
      })
      .slice(0, 50)
  }, [masterCatalog, catalogSearch])

  // Open Link Dish Modal
  const handleOpenLinkDish = async (recipe: RecipeMasterItem) => {
    setRecipeToLink(recipe)
    setMenuSearch(recipe.name || "")
    setSelectedMenuItem(null)
    setIsLinkModalOpen(true)
    if (menuItemsList.length === 0) {
      setLoadingMenuItems(true)
      try {
        const snap = await getDocs(collection(db, "menuItems"))
        const items = snap.docs.map(d => ({
          id: d.id,
          name: (d.data().name || "") as string,
          category: (d.data().category || "") as string,
        }))
        setMenuItemsList(items)
      } catch (e) {
        console.error("Error loading menuItems for linking:", e)
      } finally {
        setLoadingMenuItems(false)
      }
    }
  }

  // Filter Menu Items for Linking
  const filteredMenuItems = useMemo(() => {
    if (!menuSearch.trim()) return menuItemsList.slice(0, 50)
    const term = menuSearch.toLowerCase().trim()
    const tokens = term.split(/\s+/).filter(Boolean)
    return menuItemsList
      .filter(item => {
        const full = `${item.name} ${item.category}`.toLowerCase()
        return tokens.every(tok => full.includes(tok))
      })
      .slice(0, 50)
  }, [menuItemsList, menuSearch])

  // Save Dish Link to Firestore
  const handleSaveDishLink = async () => {
    if (!recipeToLink || !selectedMenuItem) return
    setIsSavingLink(true)
    try {
      const ref = doc(db, "recipeMaster", recipeToLink.id)
      await updateDoc(ref, {
        menuItemId: selectedMenuItem.id,
        menuItemName: selectedMenuItem.name,
        updatedAt: serverTimestamp(),
      })

      // Update in state
      setRecipes(prev =>
        prev.map(r =>
          r.id === recipeToLink.id
            ? { ...r, menuItemId: selectedMenuItem.id, menuItemName: selectedMenuItem.name }
            : r
        )
      )
      if (selectedRecipe && selectedRecipe.id === recipeToLink.id) {
        setSelectedRecipe(prev =>
          prev ? { ...prev, menuItemId: selectedMenuItem.id, menuItemName: selectedMenuItem.name } : null
        )
      }

      toast({
        title: "Recipe Linked!",
        description: `Linked "${recipeToLink.name}" to menu dish "${selectedMenuItem.name}".`,
      })
      setIsLinkModalOpen(false)
    } catch (err: any) {
      toast({ title: "Failed to Link", description: err.message || "Could not link recipe.", variant: "destructive" })
    } finally {
      setIsSavingLink(false)
    }
  }

  // Save the mapped ingredient
  const handleSaveMapping = async () => {
    if (!selectedRecipe || !editingIngredient || !selectedMasterItem || editingIndex === -1) return

    setIsSavingMapping(true)
    try {
      const targetOldItemId = editingIngredient.oldItemId

      // 1. Prepare updated ingredients array for the currently open recipe
      const updatedIngredients = selectedRecipe.ingredients.map((item, idx) => {
        if (idx === editingIndex) {
          return {
            ...item,
            templateId: selectedMasterItem.templateId,
            templateName: selectedMasterItem.templateName,
            ingredientId: selectedMasterItem.id,
            ingredientName: selectedMasterItem.name,
            unit: selectedMasterItem.unit || item.unit,
            confidence: "high" as const,
          }
        }
        return item
      })

      // 2. Update current recipe in Firestore
      const recipeRef = doc(db, "recipeMaster", selectedRecipe.id)
      await updateDoc(recipeRef, {
        ingredients: updatedIngredients,
        updatedAt: serverTimestamp(),
      })

      // 3. If applyToAll is checked, update all recipes in memory and Firestore that contain this oldItemId
      if (applyToAll && targetOldItemId) {
        const matchingRecipes = recipes.filter(
          r => r.id !== selectedRecipe.id && r.ingredients.some(ing => ing.oldItemId === targetOldItemId)
        )

        if (matchingRecipes.length > 0) {
          const batch = writeBatch(db)
          matchingRecipes.forEach(r => {
            const newIngs = r.ingredients.map(ing => {
              if (ing.oldItemId === targetOldItemId) {
                return {
                  ...ing,
                  templateId: selectedMasterItem.templateId,
                  templateName: selectedMasterItem.templateName,
                  ingredientId: selectedMasterItem.id,
                  ingredientName: selectedMasterItem.name,
                  unit: selectedMasterItem.unit || ing.unit,
                  confidence: "high" as const,
                }
              }
              return ing
            })
            const ref = doc(db, "recipeMaster", r.id)
            batch.update(ref, {
              ingredients: newIngs,
              updatedAt: serverTimestamp(),
            })
          })
          await batch.commit()

          // Update recipes in local state
          setRecipes(prev =>
            prev.map(r => {
              if (r.id === selectedRecipe.id) {
                return { ...r, ingredients: updatedIngredients }
              }
              if (r.ingredients.some(ing => ing.oldItemId === targetOldItemId)) {
                return {
                  ...r,
                  ingredients: r.ingredients.map(ing =>
                    ing.oldItemId === targetOldItemId
                      ? {
                          ...ing,
                          templateId: selectedMasterItem.templateId,
                          templateName: selectedMasterItem.templateName,
                          ingredientId: selectedMasterItem.id,
                          ingredientName: selectedMasterItem.name,
                          unit: selectedMasterItem.unit || ing.unit,
                          confidence: "high" as const,
                        }
                      : ing
                  ),
                }
              }
              return r
            })
          )
        } else {
          // Update only this recipe in local state
          setRecipes(prev =>
            prev.map(r => (r.id === selectedRecipe.id ? { ...r, ingredients: updatedIngredients } : r))
          )
        }
      } else {
        // Update only this recipe in local state
        setRecipes(prev =>
          prev.map(r => (r.id === selectedRecipe.id ? { ...r, ingredients: updatedIngredients } : r))
        )
      }

      // Update currently viewed recipe
      setSelectedRecipe(prev => prev ? { ...prev, ingredients: updatedIngredients } : null)

      toast({
        title: "Ingredient Mapped!",
        description: `Successfully mapped "${editingIngredient.oldItemName}" to "${selectedMasterItem.name}".`,
      })

      setIsMapModalOpen(false)
    } catch (err: any) {
      console.error("Error saving mapped ingredient:", err)
      toast({
        title: "Mapping Failed",
        description: err.message || "Could not save mapped ingredient.",
        variant: "destructive",
      })
    } finally {
      setIsSavingMapping(false)
    }
  }

  // Summary stats
  const totalCount = recipes.length
  const linkedCount = useMemo(() => recipes.filter(r => r.menuItemId).length, [recipes])
  const unlinkedCount = totalCount - linkedCount
  const unmappedRecipesCount = useMemo(() => recipes.filter(recipeHasUnmapped).length, [recipes])
  const fullyMappedRecipesCount = totalCount - unmappedRecipesCount

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ChefHat className="h-8 w-8 text-orange-500" />
            Recipe Master
          </h2>
          <p className="text-muted-foreground">
            Complete database of recipes, ingredient proportions, and live menu item connections.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadRecipes} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards with Interactive Filtering */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${quickFilter === "ALL" && linkFilter === "ALL" && mappingFilter === "ALL" ? "ring-2 ring-orange-500 bg-orange-50/20" : ""}`}
          onClick={() => { setQuickFilter("ALL"); setLinkFilter("ALL"); setMappingFilter("ALL"); }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Recipes</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : totalCount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Click to view all</p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${quickFilter === "UNLINKED" || linkFilter === "UNLINKED" ? "ring-2 ring-amber-500 bg-amber-50/40" : ""}`}
          onClick={() => {
            if (quickFilter === "UNLINKED" || linkFilter === "UNLINKED") {
              setQuickFilter("ALL")
              setLinkFilter("ALL")
            } else {
              setQuickFilter("UNLINKED")
              setLinkFilter("ALL")
            }
          }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-700">Not Linked to Dishes</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {loading ? "..." : `${unlinkedCount.toLocaleString()} (${((unlinkedCount / (totalCount || 1)) * 100).toFixed(1)}%)`}
            </div>
            <p className="text-xs text-amber-700 font-medium">Click to filter unlinked recipes</p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${quickFilter === "HAS_UNMAPPED" || mappingFilter === "HAS_UNMAPPED" ? "ring-2 ring-red-500 bg-red-50/30" : ""}`}
          onClick={() => {
            if (quickFilter === "HAS_UNMAPPED" || mappingFilter === "HAS_UNMAPPED") {
              setQuickFilter("ALL")
              setMappingFilter("ALL")
            } else {
              setQuickFilter("HAS_UNMAPPED")
              setMappingFilter("ALL")
            }
          }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700">Has Unmapped Items</CardTitle>
            <Sparkles className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {loading ? "..." : `${unmappedRecipesCount.toLocaleString()} (${((unmappedRecipesCount / (totalCount || 1)) * 100).toFixed(1)}%)`}
            </div>
            <p className="text-xs text-red-600 font-medium">Click to filter recipes needing mapping</p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${quickFilter === "FULLY_MAPPED" || mappingFilter === "FULLY_MAPPED" ? "ring-2 ring-emerald-500 bg-emerald-50/30" : ""}`}
          onClick={() => {
            if (quickFilter === "FULLY_MAPPED" || mappingFilter === "FULLY_MAPPED") {
              setQuickFilter("ALL")
              setMappingFilter("ALL")
            } else {
              setQuickFilter("FULLY_MAPPED")
              setMappingFilter("ALL")
            }
          }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-emerald-700">100% Fully Mapped</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {loading ? "..." : `${fullyMappedRecipesCount.toLocaleString()} (${((fullyMappedRecipesCount / (totalCount || 1)) * 100).toFixed(1)}%)`}
            </div>
            <p className="text-xs text-emerald-600 font-medium">Click to filter complete recipes</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search recipe, menu item, or category..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Category Select */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-[170px]">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    <SelectItem value="ALL">All Categories ({categories.length})</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Link Status Select */}
              <Select value={linkFilter} onValueChange={setLinkFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Link Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Link Status</SelectItem>
                  <SelectItem value="UNLINKED">⚠️ Not Linked ({unlinkedCount})</SelectItem>
                  <SelectItem value="LINKED">🔗 Linked ({linkedCount})</SelectItem>
                </SelectContent>
              </Select>

              {/* Mapping Status Select */}
              <Select value={mappingFilter} onValueChange={setMappingFilter}>
                <SelectTrigger className="w-[190px]">
                  <SelectValue placeholder="Mapping Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Mapping Status</SelectItem>
                  <SelectItem value="HAS_UNMAPPED">⚠️ Has Unmapped ({unmappedRecipesCount})</SelectItem>
                  <SelectItem value="FULLY_MAPPED">✓ 100% Mapped ({fullyMappedRecipesCount})</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quick Filter Action Bar */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t">
            <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Quick Filters:
            </span>
            <Button
              size="sm"
              variant={quickFilter === "ALL" && linkFilter === "ALL" && mappingFilter === "ALL" ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => { setQuickFilter("ALL"); setLinkFilter("ALL"); setMappingFilter("ALL"); }}
            >
              All Recipes ({totalCount})
            </Button>
            <Button
              size="sm"
              variant={quickFilter === "UNLINKED" || linkFilter === "UNLINKED" ? "default" : "outline"}
              className={`h-7 text-xs gap-1.5 ${
                quickFilter === "UNLINKED" || linkFilter === "UNLINKED" 
                  ? "bg-amber-600 hover:bg-amber-700 text-white" 
                  : "text-amber-800 border-amber-300 hover:bg-amber-50"
              }`}
              onClick={() => {
                if (quickFilter === "UNLINKED") {
                  setQuickFilter("ALL")
                  setLinkFilter("ALL")
                } else {
                  setQuickFilter("UNLINKED")
                  setLinkFilter("ALL")
                }
              }}
            >
              <AlertCircle className="h-3.5 w-3.5" />
              Not Linked Recipes ({unlinkedCount})
            </Button>
            <Button
              size="sm"
              variant={quickFilter === "HAS_UNMAPPED" || mappingFilter === "HAS_UNMAPPED" ? "default" : "outline"}
              className={`h-7 text-xs gap-1.5 ${
                quickFilter === "HAS_UNMAPPED" || mappingFilter === "HAS_UNMAPPED" 
                  ? "bg-red-600 hover:bg-red-700 text-white" 
                  : "text-red-800 border-red-300 hover:bg-red-50"
              }`}
              onClick={() => {
                if (quickFilter === "HAS_UNMAPPED") {
                  setQuickFilter("ALL")
                  setMappingFilter("ALL")
                } else {
                  setQuickFilter("HAS_UNMAPPED")
                  setMappingFilter("ALL")
                }
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Has Unmapped Items ({unmappedRecipesCount})
            </Button>
            <Button
              size="sm"
              variant={quickFilter === "FULLY_MAPPED" || mappingFilter === "FULLY_MAPPED" ? "default" : "outline"}
              className={`h-7 text-xs gap-1.5 ${
                quickFilter === "FULLY_MAPPED" || mappingFilter === "FULLY_MAPPED" 
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                  : "text-emerald-800 border-emerald-300 hover:bg-emerald-50"
              }`}
              onClick={() => {
                if (quickFilter === "FULLY_MAPPED") {
                  setQuickFilter("ALL")
                  setMappingFilter("ALL")
                } else {
                  setQuickFilter("FULLY_MAPPED")
                  setMappingFilter("ALL")
                }
              }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              100% Fully Mapped ({fullyMappedRecipesCount})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recipes Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recipes Directory</CardTitle>
              <CardDescription>
                Showing {filteredRecipes.length.toLocaleString()} of {totalCount.toLocaleString()} recipes
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Rows per page:</span>
              <Select value={pageSize.toString()} onValueChange={v => setPageSize(Number(v))}>
                <SelectTrigger className="w-18 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
              <p className="text-sm text-muted-foreground">Loading recipes from database...</p>
            </div>
          ) : paginatedRecipes.length === 0 ? (
            <div className="text-center py-12">
              <UtensilsCrossed className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-base font-semibold">No recipes found</p>
              <p className="text-sm text-muted-foreground">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[60px]">ID</TableHead>
                    <TableHead>Recipe Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Linked Menu Item</TableHead>
                    <TableHead className="text-center">Portion / Weight</TableHead>
                    <TableHead className="text-center">Ingredients</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRecipes.map((r) => (
                    <TableRow key={r.id} className="hover:bg-muted/40">
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        #{r.oldRecipeId}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-sm text-foreground">{r.name}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-normal">
                          {r.category || "Uncategorized"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {r.menuItemId ? (
                          <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 flex items-center gap-1 text-xs">
                              <CheckCircle2 className="h-3 w-3" />
                              {r.menuItemName || r.name}
                            </Badge>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[11px] text-amber-700 border-amber-300 bg-amber-50 font-normal">
                              Not Linked
                            </Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-[11px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-1.5 py-0 gap-1 font-medium"
                              onClick={() => handleOpenLinkDish(r)}
                            >
                              <LinkIcon className="h-3 w-3" />
                              Link
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {r.isPiece ? (
                          <Badge variant="outline" className="text-[11px] bg-blue-50 text-blue-700 border-blue-200">
                            {r.inGram > 0 ? `${r.inGram} Kg / pc` : "Piece-based"}
                          </Badge>
                        ) : (
                          <span className="font-mono">{r.inGram > 0 ? `${r.inGram} Kg` : "-"}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Badge variant="secondary" className="font-mono text-xs">
                            {r.ingredientsCount || r.ingredients?.length || 0} items
                          </Badge>
                          {(() => {
                            const unmapped = r.ingredients?.filter(isIngredientUnmapped).length || 0
                            if (unmapped > 0) {
                              return (
                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px] px-1.5 py-0 font-normal">
                                  ⚠️ {unmapped} unmapped
                                </Badge>
                              )
                            }
                            return (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0 font-normal">
                                ✓ 100% mapped
                              </Badge>
                            )
                          })()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-orange-600 hover:text-orange-700 hover:bg-orange-50 gap-1"
                          onClick={() => openRecipeDetails(r)}
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination Controls */}
          {!loading && filteredRecipes.length > 0 && (
            <div className="flex items-center justify-between pt-4">
              <div className="text-xs text-muted-foreground">
                Page {currentPage} of {totalPages} ({filteredRecipes.length.toLocaleString()} total)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <div className="text-xs font-semibold px-2">
                  {currentPage} / {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Extra-Wider Recipe Detail Modal ─────────────────────────────── */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent 
          className="w-[95vw] sm:max-w-[95vw] md:max-w-[1250px] max-h-[92vh] flex flex-col p-6 overflow-hidden" 
          style={{ maxWidth: "min(95vw, 1250px)", width: "95vw" }}
        >
          <DialogHeader className="border-b pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pr-6">
              <div>
                <DialogTitle className="text-2xl font-bold flex items-center gap-2.5 text-foreground">
                  <ChefHat className="h-6 w-6 text-orange-500" />
                  {selectedRecipe?.name}
                </DialogTitle>
                <DialogDescription className="text-xs mt-1.5 flex flex-wrap items-center gap-3">
                  <span>Category: <strong className="text-foreground">{selectedRecipe?.category || "General"}</strong></span>
                  <span>&bull;</span>
                  <span>Standard Portion: <strong className="text-foreground">{selectedRecipe?.inGram} Kg</strong></span>
                  <span>&bull;</span>
                  <span>Ingredients: <strong className="text-foreground">{selectedRecipe?.ingredients?.length || 0} items</strong></span>
                </DialogDescription>
              </div>
              {selectedRecipe?.menuItemId ? (
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-800 border-emerald-300 text-xs px-2.5 py-1 flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Linked Menu Dish: {selectedRecipe.menuItemName}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground text-xs px-2.5 py-1">
                  Unlinked to Menu Item
                </Badge>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden py-3">
            <div className="flex items-center justify-between pb-2 text-xs text-muted-foreground font-medium">
              <span>INGREDIENTS BREAKDOWN & CATALOG MAPPINGS</span>
              <span className="text-[11px] text-muted-foreground">Click &quot;Map Item&quot; on unmapped ingredients to link them to your inventory</span>
            </div>

            <div className="rounded-md border shadow-inner bg-slate-50/50 overflow-x-auto">
              <ScrollArea className="h-[58vh]">
                <Table className="min-w-[950px] w-full">
                <TableHeader>
                  <TableRow className="bg-muted/70 text-xs font-semibold">
                    <TableHead className="w-[40px] text-center">#</TableHead>
                    <TableHead className="w-[200px]">Original SQL Item</TableHead>
                    <TableHead className="w-[220px]">Mapped Template</TableHead>
                    <TableHead className="w-[260px]">Default Master Ingredient</TableHead>
                    <TableHead className="w-[120px] text-right">Quantity</TableHead>
                    <TableHead className="w-[100px] text-center">Status</TableHead>
                    <TableHead className="w-[130px] text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedRecipe?.ingredients?.map((ing, idx) => {
                    const isUnmapped = !ing.templateName || ing.templateName === "None" || ing.confidence === "unmapped" || ing.confidence === "none"

                    return (
                      <TableRow key={idx} className={`text-xs hover:bg-muted/30 transition-colors ${isUnmapped ? "bg-amber-50/40" : ""}`}>
                        <TableCell className="text-center text-muted-foreground font-mono">{idx + 1}</TableCell>
                        
                        {/* Original Item */}
                        <TableCell>
                          <div className="font-semibold text-foreground text-sm">{ing.oldItemName}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">ID #{ing.oldItemId}</div>
                        </TableCell>

                        {/* Mapped Template */}
                        <TableCell>
                          {ing.templateName && ing.templateName !== "None" ? (
                            <div className="flex items-center gap-1.5">
                              <Layers className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                              <span className="text-foreground font-medium">{ing.templateName}</span>
                            </div>
                          ) : (
                            <Badge variant="outline" className="border-dashed text-amber-700 bg-amber-50/80 text-[11px] font-normal">
                              No Template
                            </Badge>
                          )}
                        </TableCell>

                        {/* Master Ingredient */}
                        <TableCell>
                          {ing.ingredientName && ing.ingredientName !== "None" ? (
                            <div className="flex items-center gap-1.5">
                              <Package className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span className="text-foreground font-mono text-[11px]">{ing.ingredientName}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground italic text-xs">None</span>
                              <Button
                                size="sm"
                                className="h-6 text-[11px] bg-orange-600 hover:bg-orange-700 text-white font-medium px-2 py-0 gap-1 shadow-xs"
                                onClick={() => handleOpenMap(ing, idx)}
                              >
                                <Sparkles className="h-3 w-3" />
                                Map Now
                              </Button>
                            </div>
                          )}
                        </TableCell>

                        {/* Quantity */}
                        <TableCell className="text-right font-mono font-semibold text-sm">
                          {ing.quantity} <span className="text-xs font-normal text-muted-foreground">{ing.unit}</span>
                        </TableCell>

                        {/* Status */}
                        <TableCell className="text-center">
                          {ing.confidence === "high" ? (
                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-[10px] h-5 px-2 font-normal">
                              Verified
                            </Badge>
                          ) : ing.confidence === "medium" ? (
                            <Badge className="bg-amber-500 hover:bg-amber-600 text-[10px] h-5 px-2 font-normal">
                              Matched
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 text-[10px] h-5 px-1.5 font-normal">
                              Unmapped
                            </Badge>
                          )}
                        </TableCell>

                        {/* Action: Map Item button */}
                        <TableCell className="text-center">
                          {isUnmapped ? (
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-orange-600 hover:bg-orange-700 text-white font-medium px-2.5 gap-1.5 shadow-sm"
                              onClick={() => handleOpenMap(ing, idx)}
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                              Map Item
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-muted-foreground hover:text-orange-600 hover:bg-orange-50 px-2 gap-1"
                              onClick={() => handleOpenMap(ing, idx)}
                            >
                              <Pencil className="h-3 w-3" />
                              Change
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </div>

          <DialogFooter className="border-t pt-3 flex flex-row justify-between items-center text-xs text-muted-foreground">
            <div>
              <span>Source: SQL Migration &bull; Recipe ID #{selectedRecipe?.oldRecipeId}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Searchable Ingredient Mapping Dialog ─────────────────────────── */}
      <Dialog open={isMapModalOpen} onOpenChange={setIsMapModalOpen}>
        <DialogContent 
          className="w-[90vw] sm:max-w-[720px] max-h-[88vh] flex flex-col p-6" 
          style={{ maxWidth: "min(90vw, 720px)", width: "90vw" }}
        >
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
              <Sparkles className="h-5 w-5 text-orange-500" />
              Map to Master Ingredient
            </DialogTitle>
            <DialogDescription className="text-xs mt-1">
              Connect raw item <strong className="text-orange-600 text-sm font-semibold">&quot;{editingIngredient?.oldItemName}&quot;</strong> to an official ingredient in your catalog.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden space-y-4 py-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Type to search master ingredients or templates (e.g., Onion, Tomato, Ghee, Dal)..."
                value={catalogSearch}
                onChange={e => setCatalogSearch(e.target.value)}
                className="pl-9 pr-4"
                autoFocus
              />
            </div>

            {/* Selected Ingredient Highlight */}
            {selectedMasterItem ? (
              <div className="p-3 rounded-lg border-2 border-emerald-500 bg-emerald-50/60 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Selected Master Ingredient:
                  </div>
                  <div className="text-sm font-bold text-foreground mt-0.5">
                    {selectedMasterItem.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Template: <span className="font-semibold text-foreground">{selectedMasterItem.templateName}</span> &bull; Default Unit: <span className="font-semibold text-foreground">{selectedMasterItem.unit}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-muted-foreground hover:text-red-600"
                  onClick={() => setSelectedMasterItem(null)}
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground px-1">
                Select a matching ingredient from the list below:
              </div>
            )}

            {/* Catalog Items List */}
            <ScrollArea className="h-[36vh] rounded-md border p-1 bg-white">
              {loadingCatalog ? (
                <div className="flex items-center justify-center py-12 text-xs text-muted-foreground gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-orange-500" />
                  Loading Master Ingredients...
                </div>
              ) : filteredCatalog.length === 0 ? (
                <div className="text-center py-10 text-xs text-muted-foreground">
                  No matching master ingredients found for &quot;{catalogSearch}&quot;. Try a different keyword.
                </div>
              ) : (
                <div className="space-y-1 p-1">
                  {filteredCatalog.map(item => {
                    const isSelected = selectedMasterItem?.id === item.id

                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedMasterItem(item)}
                        className={`p-2.5 rounded-md cursor-pointer transition-colors flex items-center justify-between text-xs border ${
                          isSelected
                            ? "bg-emerald-50 border-emerald-500 text-emerald-950"
                            : "hover:bg-slate-100/80 border-transparent hover:border-slate-200"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="font-semibold text-foreground flex items-center gap-1.5">
                            <Package className="h-3.5 w-3.5 text-muted-foreground" />
                            {item.name}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <Badge variant="outline" className="text-[10px] font-normal py-0">
                              {item.templateName}
                            </Badge>
                            <span>Unit: {item.unit}</span>
                          </div>
                        </div>

                        {isSelected ? (
                          <div className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                            <Check className="h-3.5 w-3.5" />
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground">
                            Select
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </ScrollArea>

            {/* Checkbox: Apply to all recipes with this item */}
            <div className="flex items-start space-x-2 pt-2 bg-slate-50 p-2.5 rounded-md border">
              <Checkbox
                id="applyToAll"
                checked={applyToAll}
                onCheckedChange={checked => setApplyToAll(checked === true)}
              />
              <div className="grid gap-0.5 leading-none">
                <label
                  htmlFor="applyToAll"
                  className="text-xs font-semibold text-foreground cursor-pointer"
                >
                  Apply this mapping to all recipes containing &quot;{editingIngredient?.oldItemName}&quot;
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Recommended: Automatically updates other recipes that use this same raw ingredient.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-3 flex justify-between items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMapModalOpen(false)}
              disabled={isSavingMapping}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-orange-600 hover:bg-orange-700 text-white gap-1.5"
              disabled={!selectedMasterItem || isSavingMapping}
              onClick={handleSaveMapping}
            >
              {isSavingMapping ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Save &amp; Map Ingredient
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Searchable Menu Item Linking Dialog ─────────────────────────── */}
      <Dialog open={isLinkModalOpen} onOpenChange={setIsLinkModalOpen}>
        <DialogContent 
          className="w-[90vw] sm:max-w-[650px] max-h-[85vh] flex flex-col p-6" 
          style={{ maxWidth: "min(90vw, 650px)", width: "90vw" }}
        >
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
              <LinkIcon className="h-5 w-5 text-blue-500" />
              Link Recipe to Menu Dish
            </DialogTitle>
            <DialogDescription className="text-xs mt-1">
              Connect recipe <strong className="text-foreground text-sm font-semibold">&quot;{recipeToLink?.name}&quot;</strong> to a dish in your live Menu Items catalog.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden space-y-4 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search dish by name (e.g., Paneer, Dal, Chicken, Rice)..."
                value={menuSearch}
                onChange={e => setMenuSearch(e.target.value)}
                className="pl-9 pr-4"
                autoFocus
              />
            </div>

            {selectedMenuItem ? (
              <div className="p-3 rounded-lg border-2 border-emerald-500 bg-emerald-50/60 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Selected Menu Dish:
                  </div>
                  <div className="text-sm font-bold text-foreground mt-0.5">
                    {selectedMenuItem.name}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-muted-foreground hover:text-red-600"
                  onClick={() => setSelectedMenuItem(null)}
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground px-1">
                Select the matching menu item from the list below:
              </div>
            )}

            <ScrollArea className="h-[36vh] rounded-md border p-1 bg-white">
              {loadingMenuItems ? (
                <div className="flex items-center justify-center py-12 text-xs text-muted-foreground gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
                  Loading Menu Items...
                </div>
              ) : filteredMenuItems.length === 0 ? (
                <div className="text-center py-10 text-xs text-muted-foreground">
                  No menu items found for &quot;{menuSearch}&quot;. Try a different name.
                </div>
              ) : (
                <div className="space-y-1 p-1">
                  {filteredMenuItems.map(item => {
                    const isSelected = selectedMenuItem?.id === item.id
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedMenuItem(item)}
                        className={`p-2.5 rounded-md cursor-pointer transition-colors flex items-center justify-between text-xs border ${
                          isSelected
                            ? "bg-emerald-50 border-emerald-500 text-emerald-950"
                            : "hover:bg-slate-100/80 border-transparent hover:border-slate-200"
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold text-foreground">{item.name}</div>
                          {item.category && (
                            <span className="text-[10px] text-muted-foreground">Category: {item.category}</span>
                          )}
                        </div>
                        {isSelected ? (
                          <div className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                            <Check className="h-3.5 w-3.5" />
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground">
                            Select
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          <DialogFooter className="border-t pt-3 flex justify-between items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsLinkModalOpen(false)}
              disabled={isSavingLink}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              disabled={!selectedMenuItem || isSavingLink}
              onClick={handleSaveDishLink}
            >
              {isSavingLink ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Linking...
                </>
              ) : (
                <>
                  <LinkIcon className="h-3.5 w-3.5" />
                  Save Dish Link
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
