"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  type Ingredient,
  type Template,
  type Brand,
  type SubBrand,
  type TaxTemplate,
  type Supplier,
  type Type,
  type Default,
  type GP,
  type SubGP,
  templatesService,
  brandsService,
  subBrandsService,
  taxTemplatesService,
  suppliersService,
  typesService,
  defaultsService,
  gpService,
  subGpService,
} from "@/lib/firestore"

interface IngredientsFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: Omit<Ingredient, "id">) => Promise<void>
  editingItem?: Ingredient | null
  loading?: boolean
}

export function IngredientsForm({ isOpen, onClose, onSubmit, editingItem, loading = false }: IngredientsFormProps) {
  const [formData, setFormData] = useState<Partial<Ingredient>>({
    hsn: "",
    templateId: "",
    name: "",
    brandId: "",
    subBrandId: "",
    typeId: "",
    defaultId: "",
    gpId: "",
    subGpId: "",
    defaultQ1: 0,
    u1: "",
    defaultQ2: 0,
    u2: "",
    defaultQ3: 0,
    u3: "",
    packing: "",
    hasBatchNo: false,
    hasExpiryDate: false,
    maintainStock: false,
    taxTemplateId: "",
    supplier1Id: "",
    supplier2Id: "",
    supplier3Id: "",
    frequency: "daily",
    hsnLength: 8,
    verifyUnits: false,
    variantName: "",
  })

  const [templates, setTemplates] = useState<Template[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [subBrands, setSubBrands] = useState<SubBrand[]>([])
  const [types, setTypes] = useState<Type[]>([])
  const [defaults, setDefaults] = useState<Default[]>([])
  const [gps, setGps] = useState<GP[]>([])
  const [subGps, setSubGps] = useState<SubGP[]>([])
  const [taxTemplates, setTaxTemplates] = useState<TaxTemplate[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [filteredSubBrands, setFilteredSubBrands] = useState<SubBrand[]>([])
  const [filteredSubGps, setFilteredSubGps] = useState<SubGP[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    if (isOpen) {
      loadForeignData()
      if (editingItem) {
        setFormData(editingItem)
      } else {
        resetForm()
      }
    }
  }, [isOpen, editingItem])

  useEffect(() => {
    // Filter sub-brands based on selected brand
    if (formData.brandId) {
      const filtered = subBrands.filter((sb) => sb.brandId === formData.brandId)
      setFilteredSubBrands(filtered)
    } else {
      setFilteredSubBrands([])
    }
  }, [formData.brandId, subBrands])

  useEffect(() => {
    if (formData.gpId) {
      const filtered = subGps.filter((sgp) => sgp.gpId === formData.gpId)
      setFilteredSubGps(filtered)
    } else {
      setFilteredSubGps([])
    }
  }, [formData.gpId, subGps])

  const loadForeignData = async () => {
    try {
      const [
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
      console.error("Error loading foreign data:", error)
      setError("Failed to load form data. Please try again.")
    }
  }

  const resetForm = () => {
    setFormData({
      hsn: "",
      templateId: "",
      name: "",
      brandId: "",
      subBrandId: "",
      typeId: "",
      defaultId: "",
      gpId: "",
      subGpId: "",
      defaultQ1: 0,
      u1: "",
      defaultQ2: 0,
      u2: "",
      defaultQ3: 0,
      u3: "",
      packing: "",
      hasBatchNo: false,
      hasExpiryDate: false,
      maintainStock: false,
      taxTemplateId: "",
      supplier1Id: "",
      supplier2Id: "",
      supplier3Id: "",
      frequency: "daily",
      hsnLength: 8,
      verifyUnits: false,
      variantName: "",
    })
    setError("")
  }

  const handleSubmit = async () => {
    try {
      setError("")
      await onSubmit(formData as Omit<Ingredient, "id">)
      onClose()
    } catch (error) {
      setError("Failed to save ingredient. Please try again.")
    }
  }

  const updateFormData = (key: keyof Ingredient, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingItem ? "Edit Ingredient" : "Add New Ingredient"}</DialogTitle>
          <DialogDescription>
            Fill in all the details for the ingredient. Fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Basic Information</h3>

            <div className="space-y-2">
              <Label htmlFor="hsn">HSN Code *</Label>
              <Input
                id="hsn"
                value={formData.hsn || ""}
                onChange={(e) => updateFormData("hsn", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gpId">GP *</Label>
              <select
                id="gpId"
                value={formData.gpId || ""}
                onChange={(e) => {
                  updateFormData("gpId", e.target.value)
                  updateFormData("subGpId", "") // Reset sub-GP when GP changes
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select GP</option>
                {gps.map((gp) => (
                  <option key={gp.id} value={gp.id}>
                    {gp.code} - {gp.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subGpId">Sub GP *</Label>
              <select
                id="subGpId"
                value={formData.subGpId || ""}
                onChange={(e) => updateFormData("subGpId", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={!formData.gpId}
              >
                <option value="">Select Sub GP</option>
                {filteredSubGps.map((subGp) => (
                  <option key={subGp.id} value={subGp.id}>
                    {subGp.code} - {subGp.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="templateId">Template *</Label>
              <select
                id="templateId"
                value={formData.templateId || ""}
                onChange={(e) => updateFormData("templateId", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name || ""}
                onChange={(e) => updateFormData("name", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="variantName">Variant Name</Label>
              <Input
                id="variantName"
                value={formData.variantName || ""}
                onChange={(e) => updateFormData("variantName", e.target.value)}
              />
            </div>
          </div>

          {/* Brand Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Brand Information</h3>

            <div className="space-y-2">
              <Label htmlFor="brandId">Brand *</Label>
              <select
                id="brandId"
                value={formData.brandId || ""}
                onChange={(e) => {
                  updateFormData("brandId", e.target.value)
                  updateFormData("subBrandId", "") // Reset sub-brand when brand changes
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Brand</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subBrandId">Sub Brand *</Label>
              <select
                id="subBrandId"
                value={formData.subBrandId || ""}
                onChange={(e) => updateFormData("subBrandId", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={!formData.brandId}
              >
                <option value="">Select Sub Brand</option>
                {filteredSubBrands.map((subBrand) => (
                  <option key={subBrand.id} value={subBrand.id}>
                    {subBrand.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="typeId">Type *</Label>
              <select
                id="typeId"
                value={formData.typeId || ""}
                onChange={(e) => updateFormData("typeId", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Type</option>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultId">Default *</Label>
              <select
                id="defaultId"
                value={formData.defaultId || ""}
                onChange={(e) => updateFormData("defaultId", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Default</option>
                {defaults.map((defaultItem) => (
                  <option key={defaultItem.id} value={defaultItem.id}>
                    {defaultItem.name} - {defaultItem.value}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="packing">Packing *</Label>
              <Input
                id="packing"
                value={formData.packing || ""}
                onChange={(e) => updateFormData("packing", e.target.value)}
                required
              />
            </div>
          </div>

          {/* Quantity and Units */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Quantity & Units</h3>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="defaultQ1">Default Q1 *</Label>
                <Input
                  id="defaultQ1"
                  type="number"
                  value={formData.defaultQ1 || 0}
                  onChange={(e) => updateFormData("defaultQ1", Number(e.target.value))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="u1">U1 *</Label>
                <Input
                  id="u1"
                  value={formData.u1 || ""}
                  onChange={(e) => updateFormData("u1", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="defaultQ2">Default Q2</Label>
                <Input
                  id="defaultQ2"
                  type="number"
                  value={formData.defaultQ2 || 0}
                  onChange={(e) => updateFormData("defaultQ2", Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="u2">U2</Label>
                <Input id="u2" value={formData.u2 || ""} onChange={(e) => updateFormData("u2", e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="defaultQ3">Default Q3</Label>
                <Input
                  id="defaultQ3"
                  type="number"
                  value={formData.defaultQ3 || 0}
                  onChange={(e) => updateFormData("defaultQ3", Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="u3">U3</Label>
                <Input id="u3" value={formData.u3 || ""} onChange={(e) => updateFormData("u3", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Settings and Options */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Settings & Options</h3>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasBatchNo"
                  checked={formData.hasBatchNo || false}
                  onCheckedChange={(checked) => updateFormData("hasBatchNo", checked)}
                />
                <Label htmlFor="hasBatchNo">Has Batch No</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasExpiryDate"
                  checked={formData.hasExpiryDate || false}
                  onCheckedChange={(checked) => updateFormData("hasExpiryDate", checked)}
                />
                <Label htmlFor="hasExpiryDate">Has Expiry Date</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="maintainStock"
                  checked={formData.maintainStock || false}
                  onCheckedChange={(checked) => updateFormData("maintainStock", checked)}
                />
                <Label htmlFor="maintainStock">Maintain Stock</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="verifyUnits"
                  checked={formData.verifyUnits || false}
                  onCheckedChange={(checked) => updateFormData("verifyUnits", checked)}
                />
                <Label htmlFor="verifyUnits">Verify Units</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency *</Label>
              <select
                id="frequency"
                value={formData.frequency || "daily"}
                onChange={(e) => updateFormData("frequency", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hsnLength">HSN Length *</Label>
              <Input
                id="hsnLength"
                type="number"
                value={formData.hsnLength || 8}
                onChange={(e) => updateFormData("hsnLength", Number(e.target.value))}
                required
              />
            </div>
          </div>

          {/* Tax and Suppliers */}
          <div className="space-y-4 md:col-span-2">
            <h3 className="text-lg font-semibold">Tax & Suppliers</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="taxTemplateId">Tax Template *</Label>
                <select
                  id="taxTemplateId"
                  value={formData.taxTemplateId || ""}
                  onChange={(e) => updateFormData("taxTemplateId", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Tax Template</option>
                  {taxTemplates.map((taxTemplate) => (
                    <option key={taxTemplate.id} value={taxTemplate.id}>
                      {taxTemplate.name} ({taxTemplate.rate}%)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supplier1Id">Default Supplier *</Label>
                <select
                  id="supplier1Id"
                  value={formData.supplier1Id || ""}
                  onChange={(e) => updateFormData("supplier1Id", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplier2Id">Supplier 2</Label>
                <select
                  id="supplier2Id"
                  value={formData.supplier2Id || ""}
                  onChange={(e) => updateFormData("supplier2Id", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplier3Id">Supplier 3</Label>
                <select
                  id="supplier3Id"
                  value={formData.supplier3Id || ""}
                  onChange={(e) => updateFormData("supplier3Id", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (editingItem ? "Updating..." : "Adding...") : editingItem ? "Update" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
