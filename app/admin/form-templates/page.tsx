"use client"

import React, { useState, useEffect } from "react"
import { db } from "@/lib/firebase"
import { collection, getDocs } from "firebase/firestore"
import { complianceFormsService, type ComplianceForm } from "@/lib/firestore/complianceFormsService"
import { complianceSubFormsService, type ComplianceSubForm } from "@/lib/firestore/complianceSubFormsService"
import { toast } from "@/hooks/use-toast"

// Icons
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, Loader2 } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"

// UI Components
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const initialFormState = {
  name: "",
  vendorId: "",
  companyId: "",
  buildingId: "",
  cafetariaId: "",
  areaId: "",
  frequency: "monthly" as const,
  status: "active" as const,
}

const initialSubFormState = {
  formId: "",
  question: "",
  type: "yes_no" as const,
  isRequired: false,
  isPhotoRequired: false,
  order: 0,
}

export default function FormTemplatesPage() {
  const [forms, setForms] = useState<ComplianceForm[]>([])
  const [subForms, setSubForms] = useState<ComplianceSubForm[]>([])
  const [expandedFormId, setExpandedFormId] = useState<string | null>(null)
  
  const [companies, setCompanies] = useState<any[]>([])
  const [buildings, setBuildings] = useState<any[]>([])
  const [cafeterias, setCafeterias] = useState<any[]>([])
  const [areas, setAreas] = useState<any[]>([])
  const [vendors, setVendors] = useState<any[]>([])
  const [isFetching, setIsFetching] = useState(false)
  
  const [loading, setLoading] = useState(true)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [isSubFormModalOpen, setIsSubFormModalOpen] = useState(false)
  const [formData, setFormData] = useState(initialFormState)
  const [subFormData, setSubFormData] = useState(initialSubFormState)
  const [editingFormId, setEditingFormId] = useState<string | null>(null)
  const [editingSubFormId, setEditingSubFormId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    try {
      setLoading(true)
      const [
        formsRes,
        companiesSnap,
        buildingsSnap,
        cafeteriasSnap,
        areasSnap,
        vendorsSnap
      ] = await Promise.all([
        complianceFormsService.getAll(),
        getDocs(collection(db, 'companies')),
        getDocs(collection(db, 'buildings')),
        getDocs(collection(db, 'cafetarias')),
        getDocs(collection(db, 'areas')),
        getDocs(collection(db, 'vendors')),
      ])

      setForms(formsRes)
      setCompanies(companiesSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setBuildings(buildingsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setCafeterias(cafeteriasSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setAreas(areasSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setVendors(vendorsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const fetchSubForms = async (formId: string) => {
    try {
      setIsFetching(true)
      const subFormsRes = await complianceSubFormsService.getByFormId(formId)
      setSubForms(subFormsRes)
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Failed to load questions", variant: "destructive" })
    } finally {
      setIsFetching(false)
    }
  }

  const toggleFormExpand = async (formId: string) => {
    if (expandedFormId === formId) {
      setExpandedFormId(null)
    } else {
      setExpandedFormId(formId)
      await fetchSubForms(formId)
    }
  }

  const handleSaveForm = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Form name is required", variant: "destructive" })
      return
    }

    setIsSaving(true)
    try {
      if (editingFormId) {
        await complianceFormsService.update(editingFormId, formData)
        toast({ title: "Success", description: "Form updated successfully" })
      } else {
        await complianceFormsService.add(formData)
        toast({ title: "Success", description: "Form created successfully" })
      }
      setIsFormModalOpen(false)
      setFormData(initialFormState)
      setEditingFormId(null)
      await fetchInitialData()
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Failed to save form", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteForm = async (id: string) => {
    if (confirm("Are you sure you want to delete this form?")) {
      try {
        await complianceFormsService.delete(id)
        toast({ title: "Success", description: "Form deleted successfully" })
        await fetchInitialData()
      } catch (error) {
        console.error(error)
        toast({ title: "Error", description: "Failed to delete form", variant: "destructive" })
      }
    }
  }

  const handleEditForm = (form: ComplianceForm) => {
    setFormData({
      name: form.name,
      vendorId: form.vendorId,
      companyId: form.companyId,
      buildingId: form.buildingId,
      cafetariaId: form.cafetariaId,
      areaId: form.areaId || "",
      frequency: form.frequency,
      status: form.status,
    })
    setEditingFormId(form.id)
    setIsFormModalOpen(true)
  }

  const handleSaveSubForm = async () => {
    if (!subFormData.question.trim()) {
      toast({ title: "Error", description: "Question is required", variant: "destructive" })
      return
    }

    setIsSaving(true)
    try {
      if (editingSubFormId) {
        await complianceSubFormsService.update(editingSubFormId, subFormData)
        toast({ title: "Success", description: "Question updated successfully" })
      } else {
        await complianceSubFormsService.add({
          ...subFormData,
          formId: expandedFormId || "",
        })
        toast({ title: "Success", description: "Question added successfully" })
      }
      setIsSubFormModalOpen(false)
      setSubFormData(initialSubFormState)
      setEditingSubFormId(null)
      if (expandedFormId) await fetchSubForms(expandedFormId)
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Failed to save question", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteSubForm = async (id: string) => {
    if (confirm("Are you sure you want to delete this question?")) {
      try {
        await complianceSubFormsService.delete(id)
        toast({ title: "Success", description: "Question deleted successfully" })
        if (expandedFormId) await fetchSubForms(expandedFormId)
      } catch (error) {
        console.error(error)
        toast({ title: "Error", description: "Failed to delete question", variant: "destructive" })
      }
    }
  }

  const handleEditSubForm = (subForm: ComplianceSubForm) => {
    setSubFormData({
      formId: subForm.formId,
      question: subForm.question,
      type: subForm.type,
      isRequired: subForm.isRequired,
      isPhotoRequired: subForm.isPhotoRequired,
      order: subForm.order,
    })
    setEditingSubFormId(subForm.id)
    setIsSubFormModalOpen(true)
  }

  const getCompanyName = (id: string) => companies.find(c => c.id === id)?.name || id
  const getBuildingName = (id: string) => buildings.find(b => b.id === id)?.name || id
  const getCafeteriaName = (id: string) => cafeterias.find(c => c.id === id)?.name || id

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="h-8 w-8" />
          <p className="text-gray-600">Loading form templates...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Form Templates</h1>
          <p className="text-gray-600 text-sm mt-1">Create and manage compliance form templates with questions</p>
        </div>
        <Button onClick={() => {
          setFormData(initialFormState)
          setEditingFormId(null)
          setIsFormModalOpen(true)
        }} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          New Form
        </Button>
      </div>

      <div className="space-y-3">
        {forms.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border">
            <p className="text-gray-500 text-sm">No forms found. Create one to get started.</p>
          </div>
        ) : (
          forms.map(form => (
            <Card key={form.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">{form.name}</CardTitle>
                      <Badge variant={form.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                        {form.status === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600 mt-3 space-y-2">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <span className="text-gray-500">Frequency:</span>
                          <span className="font-medium ml-2 capitalize">{form.frequency}</span>
                        </div>
                        {form.vendorId && (
                          <div>
                            <span className="text-gray-500">Vendor:</span>
                            <span className="font-medium ml-2">{vendors.find(v => v.id === form.vendorId)?.name || 'Unknown'}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-4 flex-wrap">
                        {form.companyId && (
                          <div className="bg-blue-50 px-3 py-1 rounded text-xs">
                            <span className="text-gray-600">Company:</span>
                            <span className="font-medium ml-1">{getCompanyName(form.companyId)}</span>
                          </div>
                        )}
                        {form.buildingId && (
                          <div className="bg-green-50 px-3 py-1 rounded text-xs">
                            <span className="text-gray-600">Building:</span>
                            <span className="font-medium ml-1">{getBuildingName(form.buildingId)}</span>
                          </div>
                        )}
                        {form.cafetariaId && (
                          <div className="bg-orange-50 px-3 py-1 rounded text-xs">
                            <span className="text-gray-600">Cafeteria:</span>
                            <span className="font-medium ml-1">{getCafeteriaName(form.cafetariaId)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-blue-600 hover:bg-blue-50"
                      onClick={() => handleEditForm(form)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => handleDeleteForm(form.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleFormExpand(form.id)}
                  className="w-full justify-between bg-gray-50 hover:bg-gray-100"
                >
                  <span className="font-medium">
                    Questions ({subForms.filter(s => s.formId === form.id).length})
                  </span>
                  {expandedFormId === form.id ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </Button>

                {expandedFormId === form.id && (
                  <div className="mt-4 space-y-3 border-t pt-4">
                    {isFetching ? (
                      <div className="flex items-center justify-center py-4">
                        <Spinner className="h-5 w-5 mr-2" />
                        <span className="text-sm text-gray-600">Loading questions...</span>
                      </div>
                    ) : subForms.filter(s => s.formId === form.id).length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">No questions added yet</p>
                    ) : (
                      <div className="space-y-2">
                        {subForms.filter(s => s.formId === form.id).map((subForm, index) => (
                          <div key={subForm.id} className="flex justify-between items-start p-3 bg-gray-50 rounded-lg border hover:border-gray-300 transition-colors">
                            <div className="flex-1">
                              <div className="flex items-start gap-2">
                                <span className="text-xs font-semibold text-gray-400 bg-gray-200 rounded-full w-5 h-5 flex items-center justify-center mt-0.5">
                                  {index + 1}
                                </span>
                                <p className="text-sm font-medium text-gray-900">{subForm.question}</p>
                              </div>
                              <div className="flex gap-2 mt-2 ml-7 flex-wrap">
                                <Badge variant="outline" className="text-xs capitalize bg-white">
                                  {subForm.type.replace('_', ' ')}
                                </Badge>
                                {subForm.isRequired && (
                                  <Badge className="text-xs bg-red-100 text-red-700 border-red-200">
                                    Required
                                  </Badge>
                                )}
                                {subForm.isPhotoRequired && (
                                  <Badge className="text-xs bg-purple-100 text-purple-700 border-purple-200">
                                    Photo Required
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-1 ml-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-blue-600 hover:bg-blue-50"
                                onClick={() => handleEditSubForm(subForm)}
                              >
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:bg-red-50"
                                onClick={() => handleDeleteSubForm(subForm.id)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <Button
                      size="sm"
                      className="w-full bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200"
                      variant="outline"
                      onClick={() => {
                        setSubFormData({
                          ...initialSubFormState,
                          formId: form.id,
                          order: subForms.filter(s => s.formId === form.id).length,
                        })
                        setEditingSubFormId(null)
                        setIsSubFormModalOpen(true)
                      }}
                    >
                      <Plus className="w-3 h-3 mr-2" />
                      Add Question
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Form Modal */}
      <Dialog open={isFormModalOpen} onOpenChange={setIsFormModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">{editingFormId ? 'Edit Form' : 'Create New Form'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
              <Label className="font-semibold text-gray-700">Form Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Daily Checklist"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="font-semibold text-gray-700">Vendor</Label>
              <Select value={formData.vendorId || "unselected"} onValueChange={(v) => setFormData({ ...formData, vendorId: v === "unselected" ? "" : v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select vendor (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map(vendor => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="font-semibold text-gray-700">Company</Label>
              <Select value={formData.companyId || "unselected"} onValueChange={(v) => setFormData({ ...formData, companyId: v === "unselected" ? "" : v, buildingId: "", cafetariaId: "" })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select company (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map(company => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.companyId && (
              <div>
                <Label className="font-semibold text-gray-700">Building</Label>
                <Select value={formData.buildingId || "unselected"} onValueChange={(v) => setFormData({ ...formData, buildingId: v === "unselected" ? "" : v, cafetariaId: "" })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select building (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {buildings.filter(b => b.companyId === formData.companyId).map(building => (
                      <SelectItem key={building.id} value={building.id}>
                        {building.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.buildingId && (
              <div>
                <Label className="font-semibold text-gray-700">Cafeteria</Label>
                <Select value={formData.cafetariaId || "unselected"} onValueChange={(v) => setFormData({ ...formData, cafetariaId: v === "unselected" ? "" : v, areaId: "" })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select cafeteria (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {cafeterias.filter(c => c.buildingId === formData.buildingId).map(cafeteria => (
                      <SelectItem key={cafeteria.id} value={cafeteria.id}>
                        {cafeteria.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.cafetariaId && (
              <div>
                <Label className="font-semibold text-gray-700">Area</Label>
                <Select value={formData.areaId || "unselected"} onValueChange={(v) => setFormData({ ...formData, areaId: v === "unselected" ? "" : v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select area (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {areas.filter(a => a.cafeteriaId === formData.cafetariaId).map(area => (
                      <SelectItem key={area.id} value={area.id}>
                        {area.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="font-semibold text-gray-700">Frequency</Label>
              <Select value={formData.frequency} onValueChange={(v: any) => setFormData({ ...formData, frequency: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 bg-blue-50 p-3 rounded-lg border border-blue-200">
              <Checkbox
                checked={formData.status === 'active'}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, status: checked ? 'active' : 'inactive' })
                }
              />
              <Label className="font-normal cursor-pointer">
                {formData.status === 'active' ? 'Active - Form is visible and usable' : 'Inactive - Form is hidden'}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveForm} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingFormId ? "Update Form" : "Create Form"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SubForm Modal */}
      <Dialog open={isSubFormModalOpen} onOpenChange={setIsSubFormModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">{editingSubFormId ? 'Edit Question' : 'Add Question'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="font-semibold text-gray-700">Question *</Label>
              <Textarea
                value={subFormData.question}
                onChange={(e) => setSubFormData({ ...subFormData, question: e.target.value })}
                placeholder="Enter your question"
                rows={3}
                className="mt-1 resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">{subFormData.question.length}/500 characters</p>
            </div>

            <div>
              <Label className="font-semibold text-gray-700">Question Type</Label>
              <Select value={subFormData.type} onValueChange={(v: any) => setSubFormData({ ...subFormData, type: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes_no">Yes/No</SelectItem>
                  <SelectItem value="text">Text Response</SelectItem>
                  <SelectItem value="number">Numeric</SelectItem>
                  <SelectItem value="photo">Photo Upload</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 bg-gray-50 p-4 rounded-lg border">
              <Label className="font-semibold text-gray-700 block">Options</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={subFormData.isRequired}
                    onCheckedChange={(checked) =>
                      setSubFormData({ ...subFormData, isRequired: !!checked })
                    }
                    className="border-gray-300"
                  />
                  <Label className="font-normal text-gray-700 cursor-pointer">
                    Mark as required
                  </Label>
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={subFormData.isPhotoRequired}
                    onCheckedChange={(checked) =>
                      setSubFormData({ ...subFormData, isPhotoRequired: !!checked })
                    }
                    className="border-gray-300"
                  />
                  <Label className="font-normal text-gray-700 cursor-pointer">
                    Photo evidence required
                  </Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSubFormModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSubForm} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingSubFormId ? "Update Question" : "Add Question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
