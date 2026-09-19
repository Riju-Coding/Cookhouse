"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/hooks/use-auth"
import * as XLSX from "xlsx"
import { Loader2, Upload, FileCheck, AlertCircle } from "lucide-react"
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
  suppliersService
} from "@/lib/firestore"

export default function ImportIngredientsPage() {
  const { isSuperAdmin } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isSuperAdmin) {
    return <div className="p-8 text-center text-red-500 font-medium">Access Denied. Super Admin only.</div>
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0])
      setStatus("")
      setProgress(0)
    }
  }

  const handleUpload = async () => {
    if (!file) return
    setLoading(true)
    setStatus("Reading Excel file...")

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      const rows = XLSX.utils.sheet_to_json<any>(worksheet)
      
      setStatus(`Found ${rows.length} rows. Fetching existing metadata...`)

      const [
        existingTemplates, existingBrands, existingSubBrands, existingTypes, existingDefaults,
        existingGps, existingSubGps, existingTaxes, existingSuppliers, existingIngredients
      ] = await Promise.all([
        templatesService.getAll(), brandsService.getAll(), subBrandsService.getAll(), typesService.getAll(), defaultsService.getAll(),
        gpService.getAll(), subGpService.getAll(), taxTemplatesService.getAll(), suppliersService.getAll(), ingredientsService.getAll()
      ])

      const mapByName = (arr: any[]) => {
        const m = new Map<string, string>()
        arr.forEach(i => { if (i.name) m.set(i.name.toString().trim().toLowerCase(), i.id) })
        return m
      }

      const maps = {
        template: mapByName(existingTemplates),
        brand: mapByName(existingBrands),
        subBrand: mapByName(existingSubBrands),
        type: mapByName(existingTypes),
        default: mapByName(existingDefaults),
        gp: mapByName(existingGps),
        subGp: mapByName(existingSubGps),
        tax: mapByName(existingTaxes),
        supplier: mapByName(existingSuppliers),
      }

      const getOrCreate = async (name: string, type: keyof typeof maps, service: any) => {
        if (!name || name.toString().trim() === '') return ""
        const cleanName = name.toString().trim()
        const lowerName = cleanName.toLowerCase()
        if (maps[type].has(lowerName)) return maps[type].get(lowerName)!
        
        setStatus(`Creating new ${type}: ${cleanName}`)
        const newId = await service.add({ name: cleanName, status: 'active' })
        maps[type].set(lowerName, newId)
        return newId
      }

      let processed = 0
      for (const row of rows) {
        processed++
        setProgress(Math.round((processed / rows.length) * 100))
        
        const variantName = row['Variant Name']?.toString().trim()
        if (!variantName) continue

        const exists = existingIngredients.find(i => i.name.toLowerCase() === variantName.toLowerCase())
        if (exists) {
            console.log(`Skipping existing ingredient: ${variantName}`)
            continue
        }

        const templateId = await getOrCreate(row['Template Name'], 'template', templatesService)
        const brandId = await getOrCreate(row['Brand'], 'brand', brandsService)
        const subBrandId = await getOrCreate(row['Sub Brand'], 'subBrand', subBrandsService)
        const typeId = await getOrCreate(row['Type'], 'type', typesService)
        const defaultId = await getOrCreate(row['Default'], 'default', defaultsService)
        const gpId = await getOrCreate(row['GP'], 'gp', gpService)
        const subGpId = await getOrCreate(row['Sub GP'], 'subGp', subGpService)
        const taxTemplateId = await getOrCreate(row['Item Tax Template (Taxes)'], 'tax', taxTemplatesService)
        const supplier1Id = await getOrCreate(row['Default Supplier (Item Defaults)'], 'supplier', suppliersService)
        const supplier2Id = await getOrCreate(row['Supplier 2'], 'supplier', suppliersService)
        const supplier3Id = await getOrCreate(row['Supplier 3'], 'supplier', suppliersService)

        const ingredientPayload = {
          name: variantName,
          templateId, brandId, subBrandId, typeId, defaultId, gpId, subGpId, taxTemplateId, supplier1Id, supplier2Id, supplier3Id,
          hsn: row['HSN']?.toString() || "",
          hsnLength: parseInt(row['HSN Length']) || 0,
          frequency: row['Daily / Weekly']?.toString().toLowerCase() === 'daily' ? 'daily' as any : 'weekly' as any,
          defaultQ1: parseFloat(row['Q1']) || 0,
          u1: row['U1']?.toString() || "",
          defaultQ2: parseFloat(row['Q2']) || 0,
          u2: row['U2']?.toString() || "",
          defaultQ3: parseFloat(row['Q3']) || 0,
          u3: row['U3']?.toString() || "",
          packing: row['Packing']?.toString() || "",
          hasBatchNo: row['Has Batch No'] == 1,
          hasExpiryDate: row['Has Expiry Date'] == 1,
          maintainStock: row['Maintain Stock'] == 1,
          status: 'active'
        }

        await ingredientsService.add(ingredientPayload)
      }

      setStatus(`Successfully processed ${rows.length} rows! Data imported.`)
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
    } catch (error: any) {
      console.error(error)
      setStatus(`Error during import: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Import Ingredients</CardTitle>
          <CardDescription>Upload an Excel file to bulk import GP, Sub GP, Brands, and Ingredients.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-10 flex flex-col items-center justify-center bg-gray-50">
            <input type="file" accept=".xlsx, .xls, .csv" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
            {file ? (
              <div className="flex items-center flex-col gap-2">
                <FileCheck className="w-10 h-10 text-green-500" />
                <span className="text-sm font-medium">{file.name}</span>
                <Button variant="outline" size="sm" onClick={() => { setFile(null); if(fileInputRef.current) fileInputRef.current.value = ""; }}>Remove</Button>
              </div>
            ) : (
              <div className="flex items-center flex-col gap-2 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-10 h-10 text-gray-400" />
                <span className="text-sm text-gray-500">Click to select Excel file</span>
              </div>
            )}
          </div>
          {status && (
            <div className={`p-4 rounded-md text-sm flex items-center gap-2 ${status.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertCircle className="w-4 h-4" />}
              {status} {loading && progress > 0 && `(${progress}%)`}
            </div>
          )}
          <Button className="w-full" disabled={!file || loading} onClick={handleUpload}>
            {loading ? "Importing..." : "Start Import"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
