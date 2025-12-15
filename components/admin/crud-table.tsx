"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Spinner } from "@/components/ui/spinner"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch" // <--- 1. IMPORT ADDED
import { Trash2, Edit, Plus, Search, X } from "lucide-react"

interface Column {
  key: string
  label: string
  // <--- 4. ADDED render prop to support formatting (e.g. Boolean -> "Yes"/"No")
  render?: (value: any, item: any) => React.ReactNode 
}

interface FormField {
  name: string
  label: string
  // <--- 2. UPDATED TYPE to include "switch"
  type: "text" | "select" | "textarea" | "switch" 
  required?: boolean
  options?: { value: string; label: string }[]
}

interface CrudTableProps {
  title: string
  data: any[]
  columns: Column[]
  formFields: FormField[]
  onAdd: (data: any) => Promise<void>
  onEdit: (id: string, data: any) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onBulkDelete?: (ids: string[]) => Promise<void>
  isAdding?: boolean
  isEditing?: boolean
  editingId?: string | null
  deletingIds?: Set<string>
}

export function CrudTable({
  title,
  data,
  columns,
  formFields,
  onAdd,
  onEdit,
  onDelete,
  onBulkDelete,
  isAdding = false,
  isEditing = false,
  editingId = null,
  deletingIds = new Set(),
}: CrudTableProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [localEditingId, setLocalEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data

    const query = searchQuery.toLowerCase()
    return data.filter((item) => columns.some((column) => String(item[column.key]).toLowerCase().includes(query)))
  }, [data, searchQuery, columns])

  const isAllSelected = filteredData.length > 0 && selectedIds.size === filteredData.length
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < filteredData.length

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredData.map((item) => item.id)))
    }
  }

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return

    setIsBulkDeleting(true)
    try {
      if (onBulkDelete) {
        await onBulkDelete(Array.from(selectedIds))
      } else {
        await Promise.all(Array.from(selectedIds).map((id) => onDelete(id)))
      }
      setSelectedIds(new Set())
    } catch (error) {
      console.error("Error bulk deleting:", error)
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const handleOpenDialog = (item?: any) => {
    if (item) {
      setLocalEditingId(item.id)
      const initialData: Record<string, any> = {}
      formFields.forEach((field) => {
        // Handle boolean vs string values differently
        initialData[field.name] = item[field.name] !== undefined ? item[field.name] : ""
      })
      setFormData(initialData)
    } else {
      setLocalEditingId(null)
      const initialData: Record<string, any> = {}
      formFields.forEach((field) => {
        // Default switch to false, others to empty string
        initialData[field.name] = field.type === "switch" ? false : ""
      })
      setFormData(initialData)
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setLocalEditingId(null)
    setFormData({})
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSubmit = async () => {
    try {
      if (localEditingId) {
        await onEdit(localEditingId, formData)
      } else {
        await onAdd(formData)
      }
      handleCloseDialog()
    } catch (error) {
      console.error("Error submitting form:", error)
    }
  }

  const renderFormField = (field: FormField) => {
    const value = formData[field.name]

    switch (field.type) {
      case "switch":
        // <--- 3. ADDED SWITCH RENDERING LOGIC
        return (
          <div key={field.name} className="flex items-center space-x-2 py-2">
             <Switch
              id={field.name}
              checked={!!value} // Force boolean
              onCheckedChange={(checked) => handleInputChange(field.name, checked)}
            />
            <Label htmlFor={field.name}>{field.label}</Label>
          </div>
        )

      case "select":
        return (
          <div key={field.name} className="grid gap-2">
            <Label htmlFor={field.name}>{field.label}</Label>
            <Select value={value || ""} onValueChange={(val) => handleInputChange(field.name, val)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )
      case "textarea":
        return (
          <div key={field.name} className="grid gap-2">
            <Label htmlFor={field.name}>{field.label}</Label>
            <textarea
              id={field.name}
              value={value || ""}
              onChange={(e) => handleInputChange(field.name, e.target.value)}
              required={field.required}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        )
      default:
        // Handles "text" and any others
        return (
          <div key={field.name} className="grid gap-2">
            <Label htmlFor={field.name}>{field.label}</Label>
            <Input
              id={field.name}
              type={field.type}
              value={value || ""}
              onChange={(e) => handleInputChange(field.name, e.target.value)}
              required={field.required}
            />
          </div>
        )
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{title}</h2>
        <Button onClick={() => handleOpenDialog()} disabled={isAdding} className="gap-2">
          {isAdding ? (
            <>
              <Spinner className="h-4 w-4" />
              Adding...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Add New
            </>
          )}
        </Button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {selectedIds.size > 0 && (
          <Button
            variant="destructive"
            onClick={handleBulkDelete}
            disabled={isBulkDeleting}
            className="gap-2"
          >
            {isBulkDeleting ? (
              <>
                <Spinner className="h-4 w-4" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Delete Selected ({selectedIds.size})
              </>
            )}
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                  className={isIndeterminate ? "data-[state=checked]:bg-primary" : ""}
                />
              </TableHead>
              {columns.map((column) => (
                <TableHead key={column.key}>{column.label}</TableHead>
              ))}
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(item.id)}
                    onCheckedChange={() => handleSelectOne(item.id)}
                    aria-label={`Select ${item.name || item.id}`}
                  />
                </TableCell>
                {columns.map((column) => (
                  <TableCell key={`${item.id}-${column.key}`}>
                    {/* <--- 4. UPDATED to use render function if it exists */}
                    {column.render 
                      ? column.render(item[column.key], item) 
                      : item[column.key]
                    }
                  </TableCell>
                ))}
                <TableCell className="space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenDialog(item)}
                    disabled={isEditing}
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete(item.id)}
                    disabled={deletingIds.has(item.id)}
                    className="h-8 w-8 p-0"
                  >
                    {deletingIds.has(item.id) ? <Spinner className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filteredData.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            {searchQuery ? "No results found." : "No data available."}
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {localEditingId ? "Edit" : "Add New"} {title.slice(0, -1)}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">{formFields.map((field) => renderFormField(field))}</div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleCloseDialog} disabled={isAdding || isEditing}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isAdding || isEditing} className="gap-2">
              {isAdding || isEditing ? (
                <>
                  <Spinner className="h-4 w-4" />
                  {localEditingId ? "Updating..." : "Adding..."}
                </>
              ) : localEditingId ? (
                "Update"
              ) : (
                "Add"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}