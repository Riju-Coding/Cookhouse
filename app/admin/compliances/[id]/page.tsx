"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { db } from "@/lib/firebase"
import { collection, getDocs } from "firebase/firestore"
import { complianceFormsService, type ComplianceForm } from "@/lib/firestore/complianceFormsService"
import { complianceSubFormsService, type ComplianceSubForm, type QuestionType } from "@/lib/firestore/complianceSubFormsService"
import { cafeteriasService } from "@/lib/firestore/cafeteriasService"
import { areasService } from "@/lib/firestore/areasService"
import { toast } from "@/hooks/use-toast"

// Icons - ADDED missing icons for save animation and question types
import { Plus, Trash2, Save, X, RotateCcw, ClipboardCheck, LayoutList, Check, Type, Camera, Info, Copy, Search, CheckCircle2, Badge } from "lucide-react"

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

const initialFormState: Omit<ComplianceForm, "id" | "createdAt" | "updatedAt"> = {
  name: "",
  vendorId: "",
  companyId: "",
  buildingId: "",
  cafetariaId: "",
  areaId: "",
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
  const [activeFormId, setActiveFormId] = useState<string | null>(formId)

  // Import Questions State
  const [allForms, setAllForms] = useState<ComplianceForm[]>([])
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [sourceFormId, setSourceFormId] = useState<string>("")
  const [sourceQuestions, setSourceQuestions] = useState<ComplianceSubForm[]>([])
  const [selectedImportIds, setSelectedImportIds] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState("")
  const [isFetchingQuestions, setIsFetchingQuestions] = useState(false)

  // Quick Add State
  const [isAddCafeteriaModalOpen, setIsAddCafeteriaModalOpen] = useState(false)
  const [isAddAreaModalOpen, setIsAddAreaModalOpen] = useState(false)
  const [newCafeteriaName, setNewCafeteriaName] = useState("")
  const [newAreaName, setNewAreaName] = useState("")
  const [isQuickAdding, setIsQuickAdding] = useState(false)

  // Relational data
  const [vendors, setVendors] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [buildings, setBuildings] = useState<any[]>([])
  const [cafeterias, setCafeterias] = useState<any[]>([])
  const [areas, setAreas] = useState<any[]>([])
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
      const [vSnap, cSnap, bSnap, cafSnap, areaSnap, rSnap, formsRes] = await Promise.all([
        getDocs(collection(db, 'vendors')),
        getDocs(collection(db, 'companies')),
        getDocs(collection(db, 'buildings')),
        getDocs(collection(db, 'cafetarias')),
        getDocs(collection(db, 'areas')),
        getDocs(collection(db, 'roles')),
        complianceFormsService.getAll()
      ])
      setVendors(vSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setCompanies(cSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setBuildings(bSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setCafeterias(cafSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setAreas(areaSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setRoles(rSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setAllForms(formsRes)
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
        setActiveFormId(id)
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

  // --- DYNAMIC FORM SWITCHING LOGIC ---
  useEffect(() => {
    // Only auto-switch if we have the minimum required fields selected
    if (!mainFormData.companyId || !mainFormData.buildingId || !mainFormData.cafetariaId || !mainFormData.vendorId) {
      return;
    }

    const findMatchingForm = () => {
      return allForms.find(f => 
        f.companyId === mainFormData.companyId &&
        f.buildingId === mainFormData.buildingId &&
        f.cafetariaId === mainFormData.cafetariaId &&
        f.vendorId === mainFormData.vendorId &&
        (f.areaId || "") === (mainFormData.areaId || "")
      );
    };

    const matchedForm = findMatchingForm();

    if (matchedForm) {
      // If found an existing form and it's not the one we are currently showing
      if (matchedForm.id !== activeFormId) {
        toast({ title: "Existing Form Found", description: `Loading existing form: ${matchedForm.name}` });
        fetchFormData(matchedForm.id);
      }
    } else {
      // If no form exists for this combination and we were showing an existing form
      if (activeFormId !== null) {
        toast({ title: "New Location", description: "No form found for this selection. Starting a new form." });
        setActiveFormId(null);
        setFormExists(false);
        setQuestions([]);
        // Keep location data but reset form name and other metadata?
        // Let's just reset questions for now as per "new form to set should come"
        setMainFormData(prev => ({ 
          ...prev, 
          name: `${getName(companies, prev.companyId)} - ${getName(cafeterias, prev.cafetariaId)} Compliance`,
          status: 'active' 
        }));
      }
    }
  }, [mainFormData.companyId, mainFormData.buildingId, mainFormData.cafetariaId, mainFormData.areaId, mainFormData.vendorId, allForms, activeFormId]);

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

  const filteredAreas = useMemo(() => {
    if (!mainFormData.cafetariaId) return [];
    return areas.filter(a => a.cafeteriaId === mainFormData.cafetariaId);
  }, [areas, mainFormData.cafetariaId]);

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
      areaId: "",
    }));
  };

  const handleCafeteriaChange = (cafetariaId: string) => {
    setMainFormData(prev => ({
      ...prev,
      cafetariaId,
      areaId: "",
    }));
  };

  // --- QUESTION MANAGEMENT LOGIC ---
  const addQuestion = () => {
    setQuestions(prev => [
      ...prev,
      { 
        ...initialQuestionState, 
        id: `temp-${Date.now()}-${prev.length}`,
        formId: activeFormId || "",
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

  // --- IMPORT LOGIC ---
  const handleSourceFormChange = async (val: string) => {
    setSourceFormId(val);
    if (!val) {
      setSourceQuestions([]);
      setSelectedImportIds(new Set());
      return;
    }

    try {
      setIsFetchingQuestions(true);
      const subforms = await complianceSubFormsService.getByFormId(val);
      setSourceQuestions(subforms);
      // Select all by default when picking a new form
      setSelectedImportIds(new Set(subforms.map(q => q.id)));
    } catch (error) {
      console.error("Error fetching source questions:", error);
      toast({ title: "Error", description: "Failed to load questions from source form.", variant: "destructive" });
    } finally {
      setIsFetchingQuestions(false);
    }
  };

  const toggleImportSelection = (id: string) => {
    setSelectedImportIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllImport = (checked: boolean) => {
    if (checked) {
      setSelectedImportIds(new Set(sourceQuestions.map(q => q.id)));
    } else {
      setSelectedImportIds(new Set());
    }
  };

  const executeImport = () => {
    const questionsToImport = sourceQuestions.filter(q => selectedImportIds.has(q.id));
    if (questionsToImport.length === 0) {
      toast({ title: "No Selection", description: "Please select at least one question to import." });
      return;
    }

    const newQuestions = questionsToImport.map((q, index) => ({
      ...q,
      id: `temp-import-${Date.now()}-${index}`,
      formId: activeFormId || "",
      order: questions.length + index + 1
    }));

    setQuestions(prev => [...prev, ...newQuestions]);
    setIsImportModalOpen(false);
    setSourceFormId("");
    setSourceQuestions([]);
    setSelectedImportIds(new Set());
    toast({ title: "Import Successful", description: `Added ${questionsToImport.length} questions.` });
  };

  const filteredSourceForms = useMemo(() => {
    if (!searchTerm) return allForms.filter(f => f.id !== formId);
    const lower = searchTerm.toLowerCase();
    return allForms.filter(f => 
      f.id !== formId && 
      (f.name.toLowerCase().includes(lower) || 
       getName(companies, f.companyId).toString().toLowerCase().includes(lower))
    );
  }, [allForms, searchTerm, formId, companies]);

  // Helper function for display (since it's defined later in the original component, I'll use it or redefine it)
  const getName = (arr: any[], id: string) => arr.find(item => item.id === id)?.name || "—";

  // --- QUICK ADD LOGIC ---
  const handleQuickAddCafeteria = async () => {
    if (!newCafeteriaName.trim()) return;
    try {
      setIsQuickAdding(true);
      const res = await cafeteriasService.add({
        name: newCafeteriaName.trim(),
        companyId: mainFormData.companyId,
        buildingId: mainFormData.buildingId,
        vendorId: mainFormData.vendorId,
        status: 'active'
      });
      const newCaf = { 
        id: res.id, 
        name: newCafeteriaName.trim(), 
        companyId: mainFormData.companyId, 
        buildingId: mainFormData.buildingId, 
        vendorId: mainFormData.vendorId, 
        status: 'active' 
      };
      setCafeterias(prev => [...prev, newCaf]);
      setMainFormData(prev => ({ ...prev, cafetariaId: res.id }));
      setNewCafeteriaName("");
      setIsAddCafeteriaModalOpen(false);
      toast({ title: "Success", description: "Cafeteria added successfully." });
    } catch (error) {
      console.error("Error adding cafeteria:", error);
      toast({ title: "Error", description: "Failed to add cafeteria.", variant: "destructive" });
    } finally {
      setIsQuickAdding(false);
    }
  };

  const handleQuickAddArea = async () => {
    if (!newAreaName.trim()) return;
    try {
      setIsQuickAdding(true);
      const res = await areasService.add({
        name: newAreaName.trim(),
        cafeteriaId: mainFormData.cafetariaId,
        companyId: mainFormData.companyId,
        buildingId: mainFormData.buildingId,
        type: 'cafeteria',
        status: 'active'
      });
      const newArea = { 
        id: res.id, 
        name: newAreaName.trim(), 
        cafeteriaId: mainFormData.cafetariaId, 
        companyId: mainFormData.companyId, 
        buildingId: mainFormData.buildingId, 
        type: 'cafeteria', 
        status: 'active' 
      };
      setAreas(prev => [...prev, newArea]);
      setMainFormData(prev => ({ ...prev, areaId: res.id }));
      setNewAreaName("");
      setIsAddAreaModalOpen(false);
      toast({ title: "Success", description: "Area added successfully." });
    } catch (error) {
      console.error("Error adding area:", error);
      toast({ title: "Error", description: "Failed to add area.", variant: "destructive" });
    } finally {
      setIsQuickAdding(false);
    }
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
      let savedFormId = activeFormId;

      if (activeFormId) {
        await complianceFormsService.update(activeFormId, mainFormData);
        toast({ title: "Success", description: "Compliance form updated." });
      } else {
        const docRef = await complianceFormsService.add(mainFormData);
        savedFormId = docRef.id;
        toast({ title: "Success", description: "Compliance form created." });
      }

      const existingQuestionIds = activeFormId ? (await complianceSubFormsService.getByFormId(activeFormId)).map(q => q.id) : [];
      const newQuestionIds: string[] = [];

      for (let i = 0; i < questions.length; i++) {
        const question = { ...questions[i], formId: savedFormId!, order: i + 1 };
        // SAFER CHECK: Only update if ID is not a temporary one AND it exists in the current form's questions
        if (question.id && !question.id.toString().startsWith('temp') && existingQuestionIds.includes(question.id)) {
          await complianceSubFormsService.update(question.id, question);
          newQuestionIds.push(question.id);
        } else {
          // It's a new question (either added manually or imported)
          const { id, ...questionData } = question; // Remove the temp ID before adding
          const qRef = await complianceSubFormsService.add(questionData as any);
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
          <LayoutList className="h-6 w-6 text-blue-600" /> {activeFormId ? "Edit Compliance Form" : "Create Compliance Form"}
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
            <div className="flex gap-2">
              <Select value={mainFormData.cafetariaId} onValueChange={handleCafeteriaChange} disabled={!mainFormData.buildingId || !mainFormData.vendorId}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Select Cafeteria" /></SelectTrigger>
                <SelectContent>
                  {filteredCafeterias.length === 0 ? <SelectItem value="none" disabled>No matching cafeterias</SelectItem> :
                    filteredCafeterias.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {mainFormData.buildingId && mainFormData.vendorId && (
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon" 
                  onClick={() => setIsAddCafeteriaModalOpen(true)}
                  title="Add New Cafeteria"
                  className="shrink-0 border-blue-200 text-blue-600 hover:bg-blue-50"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>
            {mainFormData.buildingId && mainFormData.vendorId && filteredCafeterias.length === 0 && (
              <p className="text-xs text-orange-600 flex items-center gap-1 mt-1">
                <Info className="h-3 w-3" /> No cafeterias found for this building/vendor. Add one to proceed.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="area">Area <span className="text-gray-400 font-normal">(optional)</span></Label>
            <div className="flex gap-2">
              <Select
                value={mainFormData.areaId || ""}
                onValueChange={val => setMainFormData({ ...mainFormData, areaId: val === "__none__" ? "" : val })}
                disabled={!mainFormData.cafetariaId}
              >
                <SelectTrigger className="flex-1"><SelectValue placeholder="Select Area" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— No specific area —</SelectItem>
                  {filteredAreas.length === 0
                    ? <SelectItem value="no-areas" disabled>No areas for this cafeteria</SelectItem>
                    : filteredAreas.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)
                  }
                </SelectContent>
              </Select>
              {mainFormData.cafetariaId && (
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon" 
                  onClick={() => setIsAddAreaModalOpen(true)}
                  title="Add New Area"
                  className="shrink-0 border-purple-200 text-purple-600 hover:bg-purple-50"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>
            {mainFormData.cafetariaId && filteredAreas.length === 0 && (
               <p className="text-xs text-gray-500 mt-1 italic">Optional: No areas defined for this cafeteria yet.</p>
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={addQuestion} className="flex-1">
              <Plus className="mr-2 h-4 w-4" /> Add Question
            </Button>
            <Button variant="outline" onClick={() => setIsImportModalOpen(true)} className="flex-1 border-blue-200 text-blue-600 hover:bg-blue-50">
              <Copy className="mr-2 h-4 w-4" /> Import from Existing
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Import Questions Modal */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5 text-blue-600" /> Import Questions
            </DialogTitle>
            <DialogDescription>
              Select an existing compliance form to copy questions from.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 flex-1 overflow-hidden flex flex-col">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input 
                  placeholder="Search forms by name or company..." 
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="w-1/2">
                <Select value={sourceFormId} onValueChange={handleSourceFormChange}>
                  <SelectTrigger><SelectValue placeholder="Select Source Form" /></SelectTrigger>
                  <SelectContent>
                    {filteredSourceForms.length === 0 ? (
                      <SelectItem value="none" disabled>No forms found</SelectItem>
                    ) : (
                      filteredSourceForms.map(f => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name} ({getName(companies, f.companyId)})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {sourceFormId && (
              <div className="border rounded-lg flex flex-col flex-1 overflow-hidden bg-gray-50/50">
                <div className="p-3 border-b bg-white flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="select-all-import" 
                      checked={sourceQuestions.length > 0 && selectedImportIds.size === sourceQuestions.length}
                      onCheckedChange={handleSelectAllImport}
                    />
                    <Label htmlFor="select-all-import" className="font-semibold cursor-pointer">
                      Select All Questions ({sourceQuestions.length})
                    </Label>
                  </div>
                  <Badge variant="outline" className="text-blue-600">
                    {selectedImportIds.size} Selected
                  </Badge>
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-3 space-y-2">
                    {isFetchingQuestions ? (
                      <div className="flex items-center justify-center py-8">
                        <RotateCcw className="h-6 w-6 animate-spin text-blue-600" />
                      </div>
                    ) : sourceQuestions.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 italic">No questions in this form.</div>
                    ) : (
                      sourceQuestions.map((q) => (
                        <div 
                          key={q.id} 
                          className={`flex items-start gap-3 p-3 rounded-md border transition-colors cursor-pointer ${
                            selectedImportIds.has(q.id) ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200 hover:border-blue-100'
                          }`}
                          onClick={() => toggleImportSelection(q.id)}
                        >
                          <Checkbox 
                            checked={selectedImportIds.has(q.id)} 
                            onCheckedChange={() => toggleImportSelection(q.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium leading-tight">{q.question}</p>
                            <div className="flex mt-2 gap-2">
                              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4 uppercase">{q.type.replace('_', ' ')}</Badge>
                              {q.isRequired && <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 border-red-200 text-red-600">REQUIRED</Badge>}
                              {q.isPhotoRequired && <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 border-orange-200 text-orange-600">PHOTO</Badge>}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setIsImportModalOpen(false)}>Cancel</Button>
            <Button 
              onClick={executeImport} 
              disabled={selectedImportIds.size === 0 || isFetchingQuestions}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" /> Import {selectedImportIds.size} Questions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Add Cafeteria Modal */}
      <Dialog open={isAddCafeteriaModalOpen} onOpenChange={setIsAddCafeteriaModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Cafeteria</DialogTitle>
            <DialogDescription>
              Create a new cafeteria for {getName(buildings, mainFormData.buildingId)} in {getName(companies, mainFormData.companyId)}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="caf-name">Cafeteria Name</Label>
              <Input 
                id="caf-name" 
                placeholder="e.g. Main Canteen, Executive Lounge" 
                value={newCafeteriaName}
                onChange={(e) => setNewCafeteriaName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddCafeteriaModalOpen(false)}>Cancel</Button>
            <Button onClick={handleQuickAddCafeteria} disabled={isQuickAdding || !newCafeteriaName.trim()}>
              {isQuickAdding ? <RotateCcw className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              {isQuickAdding ? "Adding..." : "Add Cafeteria"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Add Area Modal */}
      <Dialog open={isAddAreaModalOpen} onOpenChange={setIsAddAreaModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Area</DialogTitle>
            <DialogDescription>
              Create a new sub-area within {getName(cafeterias, mainFormData.cafetariaId)}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="area-name">Area Name</Label>
              <Input 
                id="area-name" 
                placeholder="e.g. Washing Area, Storage, Serving Counter" 
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddAreaModalOpen(false)}>Cancel</Button>
            <Button onClick={handleQuickAddArea} disabled={isQuickAdding || !newAreaName.trim()}>
              {isQuickAdding ? <RotateCcw className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              {isQuickAdding ? "Adding..." : "Add Area"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex justify-end gap-2 p-4 border-t">
        <Button variant="outline" onClick={() => router.push('/admin/compliances')} disabled={isSaving}>
          <X className="mr-2 h-4 w-4" /> Cancel
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <> <RotateCcw className="mr-2 h-4 w-4 animate-spin" /> Saving... </>
          ) : (
            <> <Save className="mr-2 h-4 w-4" /> {activeFormId ? "Update Form" : "Create Form"} </>
          )}
        </Button>
      </div>
    </div>
  )
}