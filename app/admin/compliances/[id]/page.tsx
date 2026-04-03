"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { db } from "@/lib/firebase"
import { collection, getDocs } from "firebase/firestore"
import { complianceFormsService, type ComplianceForm } from "@/lib/firestore/complianceFormsService"
import { complianceSubFormsService, type ComplianceSubForm, type QuestionType } from "@/lib/firestore/complianceSubFormsService"
import { toast } from "@/hooks/use-toast"

// Icons - ADDED missing icons for save animation and question types
import { Plus, Trash2, Save, X, RotateCcw, ClipboardCheck, LayoutList, Check, Type, Camera, Info } from "lucide-react"

// UI Components
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const initialFormState: Omit<ComplianceForm, "id" | "createdAt" | "updatedAt"> = {
  name: "",
  vendorId: "",
  companyId: "",
  buildingId: "",
  cafetariaId: "",
  frequency: 'daily',
  assignedRole: "",
  status: 'active',
}

const initialQuestionState: Omit<ComplianceSubForm, "id" | "formId" | "createdAt"> = {
  question: "",
  type: 'yes_no',
  isRequired: true,
  isPhotoRequired: false,
  order: 0, // Will be set dynamically
}

const QUESTION_TYPES: { value: QuestionType; label: string; icon: React.ElementType }[] = [
  { value: 'yes_no', label: 'Yes/No', icon: Check },
  { value: 'text', label: 'Text Input', icon: Type },
  { value: 'number', label: 'Number Input', icon: Info },
  { value: 'photo', label: 'Photo Upload', icon: Camera },
];

export default function CreateEditCompliancePage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const formId = params.id === 'new' ? null : params.id

  const [mainFormData, setMainFormData] = useState<Omit<ComplianceForm, "id" | "createdAt" | "updatedAt">>(initialFormState)
  const [questions, setQuestions] = useState<ComplianceSubForm[]>([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [formExists, setFormExists] = useState(false)

  // Relational data
  const [vendors, setVendors] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [buildings, setBuildings] = useState<any[]>([])
  const [cafeterias, setCafeterias] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])

  useEffect(() => {
    fetchRelatedData()
    if (formId) {
      fetchFormData(formId)
    } else {
      setLoading(false)
      setFormExists(false)
    }
  }, [formId])

  const fetchRelatedData = async () => {
    try {
      const [vSnap, cSnap, bSnap, cafSnap, rSnap] = await Promise.all([
        getDocs(collection(db, 'vendors')),
        getDocs(collection(db, 'companies')),
        getDocs(collection(db, 'buildings')),
        getDocs(collection(db, 'cafetarias')),
        getDocs(collection(db, 'roles'))
      ])
      setVendors(vSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setCompanies(cSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setBuildings(bSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setCafeterias(cafSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setRoles(rSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (error) {
      console.error("Error fetching related data:", error)
      toast({ title: "Error", description: "Failed to load lookup data.", variant: "destructive" })
    }
  }

  const fetchFormData = async (id: string) => {
    try {
      setLoading(true)
      const form = await complianceFormsService.getById(id)
      if (form) {
        setMainFormData(form)
        const subforms = await complianceSubFormsService.getByFormId(id)
        setQuestions(subforms)
        setFormExists(true)
      } else {
        toast({ title: "Not Found", description: "Compliance form not found.", variant: "destructive" })
        router.push('/admin/compliances')
      }
    } catch (error) {
      console.error("Error fetching form data:", error)
      toast({ title: "Error", description: "Failed to load form details.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // --- LOCATION FILTERING LOGIC ---
  const filteredCompanies = useMemo(() => {
    return companies;
  }, [companies]);

  const filteredBuildings = useMemo(() => {
    if (!mainFormData.companyId) return [];
    return buildings.filter(b => b.companyId === mainFormData.companyId);
  }, [buildings, mainFormData.companyId]);

  const filteredCafeterias = useMemo(() => {
    if (!mainFormData.buildingId || !mainFormData.vendorId) return [];
    return cafeterias.filter(c => c.buildingId === mainFormData.buildingId && c.vendorId === mainFormData.vendorId);
  }, [cafeterias, mainFormData.buildingId, mainFormData.vendorId]);

  // --- CASCADING RESET HANDLERS FOR MAIN FORM ---
  const handleVendorChange = (vendorId: string) => {
    setMainFormData(prev => ({
      ...prev,
      vendorId,
      cafetariaId: ""
    }));
  };

  const handleCompanyChange = (companyId: string) => {
    setMainFormData(prev => ({
      ...prev,
      companyId,
      buildingId: "",
      cafetariaId: "",
    }));
  };

  const handleBuildingChange = (buildingId: string) => {
    setMainFormData(prev => ({
      ...prev,
      buildingId,
      cafetariaId: "",
    }));
  };

  // --- QUESTION MANAGEMENT LOGIC ---
  const addQuestion = () => {
    setQuestions(prev => [
      ...prev,
      { 
        ...initialQuestionState, 
        id: `temp-${Date.now()}-${prev.length}`,
        formId: formId || "",
        order: prev.length + 1 
      } as ComplianceSubForm
    ]);
  };

  const updateQuestion = (index: number, field: keyof ComplianceSubForm, value: any) => {
    setQuestions(prev => prev.map((q, i) => (i === index ? { ...q, [field]: value } : q)));
  };

  const removeQuestion = (index: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== index).map((q, i) => ({ ...q, order: i + 1 })));
  };

  // --- SAVE FORM AND QUESTIONS ---
  const handleSave = async () => {
    if (!mainFormData.name || !mainFormData.vendorId || !mainFormData.companyId || !mainFormData.buildingId || !mainFormData.cafetariaId || !mainFormData.assignedRole) {
      toast({ title: "Validation Error", description: "All main form fields are required.", variant: "destructive" });
      return;
    }
    if (questions.some(q => !q.question.trim())) {
      toast({ title: "Validation Error", description: "All questions must have text.", variant: "destructive" });
      return;
    }

    try {
      setIsSaving(true);
      let savedFormId = formId;

      if (formId) {
        await complianceFormsService.update(formId, mainFormData);
        toast({ title: "Success", description: "Compliance form updated." });
      } else {
        const docRef = await complianceFormsService.add(mainFormData);
        savedFormId = docRef.id;
        toast({ title: "Success", description: "Compliance form created." });
      }

      const existingQuestionIds = formId ? (await complianceSubFormsService.getByFormId(formId)).map(q => q.id) : [];
      const newQuestionIds: string[] = [];

      for (let i = 0; i < questions.length; i++) {
        const question = { ...questions[i], formId: savedFormId!, order: i + 1 };
        if (question.id && existingQuestionIds.includes(question.id)) {
          await complianceSubFormsService.update(question.id, question);
          newQuestionIds.push(question.id);
        } else {
          const qRef = await complianceSubFormsService.add(question);
          newQuestionIds.push(qRef.id);
        }
      }

      const questionsToDelete = existingQuestionIds.filter(id => !newQuestionIds.includes(id));
      await Promise.all(questionsToDelete.map(id => complianceSubFormsService.delete(id)));

      toast({ title: "Success", description: "Questions synced." });
      router.push('/admin/compliances');
    } catch (error) {
      console.error("Save error:", error);
      toast({ title: "Error", description: "Failed to save compliance form and questions.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading form...</div>;

  return (
    <div className="space-y-6 p-2">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <LayoutList className="h-6 w-6 text-blue-600" /> {formId ? "Edit Compliance Form" : "Create Compliance Form"}
        </h1>
        <Button variant="outline" onClick={() => router.push('/admin/compliances')} disabled={isSaving}>
          <X className="mr-2 h-4 w-4" /> Cancel
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Main Form Details</CardTitle>
          <CardDescription>Define the basic information for this compliance form.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="form-name">Form Name *</Label>
            <Input id="form-name" value={mainFormData.name} onChange={e => setMainFormData({...mainFormData, name: e.target.value})} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor">Vendor *</Label>
            <Select value={mainFormData.vendorId} onValueChange={handleVendorChange}>
              <SelectTrigger><SelectValue placeholder="Select Vendor" /></SelectTrigger>
              <SelectContent>
                {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Company *</Label>
            <Select value={mainFormData.companyId} onValueChange={handleCompanyChange}>
              <SelectTrigger><SelectValue placeholder="Select Company" /></SelectTrigger>
              <SelectContent>
                {filteredCompanies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="building">Building *</Label>
            <Select value={mainFormData.buildingId} onValueChange={handleBuildingChange} disabled={!mainFormData.companyId}>
              <SelectTrigger><SelectValue placeholder="Select Building" /></SelectTrigger>
              <SelectContent>
                {filteredBuildings.length === 0 ? <SelectItem value="none" disabled>No buildings for this company</SelectItem> :
                  filteredBuildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cafeteria">Cafeteria *</Label>
            <Select value={mainFormData.cafetariaId} onValueChange={val => setMainFormData({...mainFormData, cafetariaId: val})} disabled={!mainFormData.buildingId || !mainFormData.vendorId}>
              <SelectTrigger><SelectValue placeholder="Select Cafeteria" /></SelectTrigger>
              <SelectContent>
                {filteredCafeterias.length === 0 ? <SelectItem value="none" disabled>No matching cafeterias</SelectItem> :
                  filteredCafeterias.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {mainFormData.buildingId && mainFormData.vendorId && filteredCafeterias.length === 0 && (
              <p className="text-xs text-red-500">No cafeterias in this building assigned to selected vendor.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="frequency">Frequency *</Label>
            <Select value={mainFormData.frequency} onValueChange={val => setMainFormData({...mainFormData, frequency: val as any})}>
              <SelectTrigger><SelectValue placeholder="Select Frequency" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assigned-role">Assigned Role *</Label>
            <Select value={mainFormData.assignedRole} onValueChange={val => setMainFormData({...mainFormData, assignedRole: val})}>
              <SelectTrigger><SelectValue placeholder="Select Role" /></SelectTrigger>
              <SelectContent>
                {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3 bg-gray-50/50 md:col-span-2">
            <div className="space-y-0.5">
                <Label>Form Status</Label>
                <p className="text-xs text-gray-500">Inactive forms cannot be filled out.</p>
            </div>
            <Switch
              checked={mainFormData.status === 'active'}
              onCheckedChange={(checked) => setMainFormData({...mainFormData, status: checked ? 'active' : 'inactive'})}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Questions</CardTitle>
          <CardDescription>Define the questions for this compliance form. Drag to reorder (feature not implemented in code).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {questions.length === 0 && (
            <div className="text-center text-gray-500 py-8 border border-dashed rounded-lg">
              No questions added yet. Click "Add Question" to start.
            </div>
          )}
          {questions.map((q, index) => (
            <div key={q.id} className="relative p-4 border rounded-md shadow-sm bg-gray-50">
              <span className="absolute -top-3 left-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                Question {index + 1}
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
                <div className="md:col-span-2 lg:col-span-2 space-y-2">
                  <Label>Question Text *</Label>
                  <Textarea value={q.question} onChange={e => updateQuestion(index, 'question', e.target.value)} placeholder="e.g., Is the kitchen area clean and free of debris?" />
                </div>
                
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={q.type} onValueChange={val => updateQuestion(index, 'type', val as QuestionType)}>
                    <SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger>
                    <SelectContent>
                      {QUESTION_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <type.icon className="h-4 w-4" /> {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col justify-center space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id={`req-${index}`} checked={q.isRequired} onCheckedChange={checked => updateQuestion(index, 'isRequired', !!checked)} />
                    <Label htmlFor={`req-${index}`}>Required</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id={`photo-req-${index}`} checked={q.isPhotoRequired} onCheckedChange={checked => updateQuestion(index, 'isPhotoRequired', !!checked)} />
                    <Label htmlFor={`photo-req-${index}`}>Photo Required</Label>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="absolute top-2 right-2 text-red-500 hover:text-red-700" onClick={() => removeQuestion(index)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" onClick={addQuestion} className="w-full">
            <Plus className="mr-2 h-4 w-4" /> Add Question
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2 p-4 border-t">
        <Button variant="outline" onClick={() => router.push('/admin/compliances')} disabled={isSaving}>
          <X className="mr-2 h-4 w-4" /> Cancel
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <> <RotateCcw className="mr-2 h-4 w-4 animate-spin" /> Saving... </>
          ) : (
            <> <Save className="mr-2 h-4 w-4" /> {formId ? "Update Form" : "Create Form"} </>
          )}
        </Button>
      </div>
    </div>
  )
}