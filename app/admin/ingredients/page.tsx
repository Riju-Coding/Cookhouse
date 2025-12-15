"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Edit, Trash2, Search } from "lucide-react"
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
  type Ingredient,
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

  const getNameById = (id: string, collection: any[]) => {
    const item = collection.find((item) => item.id === id)
    return item?.name || "Unknown"
  }

  const filteredIngredients = ingredients.filter((ingredient) =>
    Object.values(ingredient).some((value) => String(value).toLowerCase().includes(searchTerm.toLowerCase())),
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Ingredients</CardTitle>
              <CardDescription>Manage all ingredients with their detailed specifications</CardDescription>
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
              placeholder="Search ingredients..."
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
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIngredients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-8">
                      No ingredients found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredIngredients.map((ingredient) => (
                    <TableRow key={ingredient.id}>
                      <TableCell className="font-mono">{ingredient.hsn}</TableCell>
                      <TableCell className="font-medium">{ingredient.name}</TableCell>
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
                        <div className="flex items-center space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditForm(ingredient)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(ingredient.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
