"use client";

import React, { useState, useEffect } from "react";
import {
  vendorComplianceTemplatesService,
  type VendorComplianceTemplate,
  type VendorCheckpoint,
  type VendorTemplateCategory,
  type VendorTemplateFrequency,
} from "@/lib/firestore/vendorComplianceTemplatesService";
import { vendorsService, type Vendor } from "@/lib/firestore";
import { toast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  ClipboardList,
  Thermometer,
  ShieldCheck,
  Droplets,
  Flame,
  CheckCircle2,
  Camera,
  ChevronDown,
  ChevronUp,
  Building2,
  Filter,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CATEGORY_MAP: Record<
  VendorTemplateCategory,
  { label: string; icon: React.ElementType; color: string }
> = {
  housekeeping: { label: "Housekeeping", icon: Sparkles, color: "bg-emerald-100 text-emerald-800" },
  equipment_ppm: { label: "Equipment & PPM", icon: ClipboardList, color: "bg-blue-100 text-blue-800" },
  cold_chain_temp: { label: "Cold Chain Temp", icon: Thermometer, color: "bg-cyan-100 text-cyan-800" },
  sanitization_chemicals: { label: "Sanitization", icon: Droplets, color: "bg-purple-100 text-purple-800" },
  storage_safety: { label: "Storage & Oil", icon: ShieldCheck, color: "bg-amber-100 text-amber-800" },
  utilities_etp: { label: "Utilities & Gas", icon: Flame, color: "bg-rose-100 text-rose-800" },
};

const DEFAULT_DEPARTMENTS = [
  "Main Kitchen",
  "Cutting Section",
  "Dry Stores",
  "Walk-in Chiller / Cold Room",
  "Deep Freeze Storage",
  "Pot Wash & Dishwashing",
  "Packaging & Dispatch",
  "Staff Changing / Locker Room",
  "Gas Bank (PNG / LPG)",
  "ETP & RO Plant",
];

export default function VendorHoTemplatesPage() {
  const [templates, setTemplates] = useState<VendorComplianceTemplate[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);

  // Template Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<VendorComplianceTemplate, "id" | "createdAt" | "updatedAt">>({
    name: "",
    docNo: "",
    sopCode: "",
    category: "housekeeping",
    frequency: "daily_morning",
    vendorId: "all",
    vendorLocationId: "all",
    assignedRole: "KEY_ACOUNT_MANAGER",
    status: "active",
    checkpoints: [],
  });

  // Checkpoint Builder State
  const [chkCheckpoint, setChkCheckpoint] = useState("");
  const [chkDepartment, setChkDepartment] = useState("Main Kitchen");
  const [chkType, setChkType] = useState<"yes_no" | "temperature" | "number" | "text">("yes_no");
  const [chkRange, setChkRange] = useState("");
  const [chkPhoto, setChkPhoto] = useState(false);

  // Seeding State
  const [isSeeding, setIsSeeding] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tplData, vendorData] = await Promise.all([
        vendorComplianceTemplatesService.getAll(),
        vendorsService.getAll(),
      ]);
      setTemplates(tplData);
      setVendors(vendorData);
    } catch (err) {
      console.error("Error loading vendor templates:", err);
      toast({
        title: "Error",
        description: "Failed to load vendor templates",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    try {
      setIsSeeding(true);
      const res = await vendorComplianceTemplatesService.seedStandardTemplates();
      toast({
        title: "SOP Templates Seeded",
        description: `Successfully loaded ${res.created} new standard Cookhouse templates (${res.existing} already up-to-date).`,
      });
      await fetchData();
    } catch (err) {
      console.error("Error seeding templates:", err);
      toast({
        title: "Seeding Failed",
        description: "Could not seed standard templates",
        variant: "destructive",
      });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingTemplateId(null);
    setFormData({
      name: "",
      docNo: "",
      sopCode: "",
      category: "housekeeping",
      frequency: "daily_morning",
      vendorId: "all",
      vendorLocationId: "all",
      assignedRole: "KEY_ACOUNT_MANAGER",
      status: "active",
      checkpoints: [],
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (t: VendorComplianceTemplate) => {
    setEditingTemplateId(t.id);
    setFormData({
      name: t.name,
      docNo: t.docNo,
      sopCode: t.sopCode,
      category: t.category,
      frequency: t.frequency,
      vendorId: t.vendorId,
      vendorLocationId: t.vendorLocationId || "all",
      assignedRole: t.assignedRole || "KEY_ACOUNT_MANAGER",
      status: t.status,
      checkpoints: t.checkpoints || [],
    });
    setIsModalOpen(true);
  };

  const handleAddCheckpoint = () => {
    if (!chkCheckpoint.trim()) {
      toast({ title: "Validation Error", description: "Checkpoint description is required", variant: "destructive" });
      return;
    }

    const newCheckpoint: VendorCheckpoint = {
      id: `chk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      checkpoint: chkCheckpoint.trim(),
      department: chkDepartment,
      type: chkType,
      acceptableRange: chkRange.trim() || undefined,
      isRequired: true,
      isPhotoRequired: chkPhoto,
      order: (formData.checkpoints?.length || 0) + 1,
    };

    setFormData({
      ...formData,
      checkpoints: [...(formData.checkpoints || []), newCheckpoint],
    });

    setChkCheckpoint("");
    setChkRange("");
    setChkPhoto(false);
  };

  const handleRemoveCheckpoint = (id: string) => {
    setFormData({
      ...formData,
      checkpoints: (formData.checkpoints || []).filter((c) => c.id !== id),
    });
  };

  const handleSaveTemplate = async () => {
    if (!formData.name.trim() || !formData.docNo.trim()) {
      toast({ title: "Validation Error", description: "Name and Document No are required", variant: "destructive" });
      return;
    }

    try {
      if (editingTemplateId) {
        await vendorComplianceTemplatesService.update(editingTemplateId, formData);
        toast({ title: "Success", description: "Template updated successfully" });
      } else {
        await vendorComplianceTemplatesService.add(formData);
        toast({ title: "Success", description: "Template created successfully" });
      }
      setIsModalOpen(false);
      await fetchData();
    } catch (err) {
      console.error("Error saving template:", err);
      toast({ title: "Error", description: "Failed to save template", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      await vendorComplianceTemplatesService.delete(id);
      toast({ title: "Deleted", description: "Template removed" });
      await fetchData();
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete template", variant: "destructive" });
    }
  };

  const handleToggleStatus = async (t: VendorComplianceTemplate) => {
    const nextStatus = t.status === "active" ? "inactive" : "active";
    try {
      await vendorComplianceTemplatesService.update(t.id, { status: nextStatus });
      setTemplates((prev) =>
        prev.map((item) => (item.id === t.id ? { ...item, status: nextStatus } : item))
      );
      toast({ title: "Status Updated", description: `Template is now ${nextStatus}` });
    } catch (err) {
      toast({ title: "Error", description: "Failed to toggle status", variant: "destructive" });
    }
  };

  const filteredTemplates = templates.filter((t) => {
    if (activeCategory === "all") return true;
    return t.category === activeCategory;
  });

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏢</span>
            <h1 className="text-2xl font-bold text-gray-900">
              Vendor Head Office & Central Kitchen SOPs
            </h1>
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">
              KAM Frontline Mode
            </Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Standard operating procedures, cleaning logs & safety checklists for Base Kitchens and HOs, assigned directly to Key Account Managers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleSeed}
            disabled={isSeeding}
            variant="outline"
            className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 gap-2"
          >
            {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-emerald-600" />}
            Seed Standard Cookhouse SOPs
          </Button>
          <Button onClick={handleOpenAdd} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
            <Plus className="w-4 h-4" />
            New SOP Template
          </Button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeCategory === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveCategory("all")}
          className={activeCategory === "all" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
        >
          All SOPs ({templates.length})
        </Button>
        {Object.entries(CATEGORY_MAP).map(([key, cfg]) => {
          const Icon = cfg.icon;
          const count = templates.filter((t) => t.category === key).length;
          return (
            <Button
              key={key}
              variant={activeCategory === key ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(key)}
              className={`gap-1.5 ${activeCategory === key ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {cfg.label} ({count})
            </Button>
          );
        })}
      </div>

      {/* Main Templates Table */}
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader className="py-4 px-6 border-b border-gray-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-gray-800">
              Active Vendor Compliance Templates
            </CardTitle>
            <CardDescription className="text-xs text-gray-500">
              Default templates automatically generate daily compliance tasks for Key Account Managers in the mobile app.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Strict Geofence Enforced On Frontline Submissions
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Loading templates...</div>
          ) : filteredTemplates.length === 0 ? (
            <div className="p-12 text-center">
              <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 font-medium">No templates found</p>
              <p className="text-xs text-gray-400 mt-1">Click &quot;Seed Standard Cookhouse SOPs&quot; above to import standard formats from PDF.</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-gray-50/50">
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead className="font-semibold text-gray-700">SOP & Doc No</TableHead>
                  <TableHead className="font-semibold text-gray-700">Template Title</TableHead>
                  <TableHead className="font-semibold text-gray-700">Category</TableHead>
                  <TableHead className="font-semibold text-gray-700">Frequency</TableHead>
                  <TableHead className="font-semibold text-gray-700">Vendor Assignment</TableHead>
                  <TableHead className="font-semibold text-gray-700">Checkpoints</TableHead>
                  <TableHead className="font-semibold text-gray-700">Status</TableHead>
                  <TableHead className="text-right font-semibold text-gray-700">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates.map((t) => {
                  const isExpanded = expandedTemplateId === t.id;
                  const catCfg = CATEGORY_MAP[t.category] || CATEGORY_MAP.housekeeping;
                  const CatIcon = catCfg.icon;
                  const targetVendorName =
                    t.vendorId === "all"
                      ? "All Vendors (Default)"
                      : vendors.find((v) => v.id === t.vendorId)?.name || t.vendorId;

                  return (
                    <React.Fragment key={t.id}>
                      <TableRow className="hover:bg-gray-50/80 transition-colors">
                        <TableCell>
                          <button
                            onClick={() => setExpandedTemplateId(isExpanded ? null : t.id)}
                            className="p-1 hover:bg-gray-200 rounded text-gray-500"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="font-mono text-xs bg-gray-50 border-gray-300">
                              {t.sopCode || "SOP"}
                            </Badge>
                            <span className="text-xs text-gray-500 font-mono">{t.docNo}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-gray-900">
                          {t.name}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${catCfg.color}`}>
                            <CatIcon className="w-3 h-3" />
                            {catCfg.label}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-gray-600 capitalize bg-gray-100 px-2 py-0.5 rounded">
                            {t.frequency.replace("_", " ")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs text-gray-700">
                            <Building2 className="w-3.5 h-3.5 text-gray-400" />
                            <span>{targetVendorName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs font-semibold">
                            {t.checkpoints?.length || 0} Checkpoints
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => handleToggleStatus(t)}
                            className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
                              t.status === "active"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                                : "bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200"
                            }`}
                          >
                            {t.status === "active" ? (
                              <>
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                                Active
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3 text-gray-400" />
                                Inactive
                              </>
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(t)}
                              className="h-8 w-8 p-0 text-gray-600 hover:text-blue-600"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(t.id)}
                              className="h-8 w-8 p-0 text-gray-600 hover:text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Expanded Checkpoints Drawer */}
                      {isExpanded && (
                        <TableRow className="bg-emerald-50/20 border-b border-gray-200">
                          <TableCell colSpan={9} className="p-4 pl-12">
                            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm space-y-3">
                              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                                  Configured Checkpoints & Verification Rules
                                </h4>
                                <span className="text-xs text-gray-500">
                                  Role Gate: <strong className="text-emerald-700">Key Account Manager (KAM)</strong>
                                </span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {(t.checkpoints || []).map((chk, idx) => (
                                  <div
                                    key={chk.id || idx}
                                    className="p-2.5 rounded-md border border-gray-100 bg-gray-50/60 flex items-start justify-between gap-2"
                                  >
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <Badge variant="outline" className="text-[10px] bg-white text-gray-600">
                                          {chk.department}
                                        </Badge>
                                        <span className="text-[10px] font-mono uppercase bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded">
                                          {chk.type}
                                        </span>
                                        {chk.acceptableRange && (
                                          <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-800 px-1.5 py-0.2 rounded border border-emerald-200">
                                            {chk.acceptableRange}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-gray-800 leading-snug font-medium">
                                        {chk.checkpoint}
                                      </p>
                                    </div>

                                    {chk.isPhotoRequired && (
                                      <Badge className="bg-amber-100 text-amber-800 text-[10px] hover:bg-amber-100 flex items-center gap-1 shrink-0">
                                        <Camera className="w-2.5 h-2.5" />
                                        Photo Req.
                                      </Badge>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Template Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplateId ? "Edit SOP Template" : "New Vendor HO SOP Template"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold">Template Name *</Label>
                <Input
                  placeholder="e.g. Daily Base Kitchen Cleaning"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Document No. *</Label>
                <Input
                  placeholder="e.g. CH/QC-HK/24"
                  value={formData.docNo}
                  onChange={(e) => setFormData({ ...formData, docNo: e.target.value })}
                  className="mt-1 font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">SOP Code *</Label>
                <Input
                  placeholder="e.g. SOP 24"
                  value={formData.sopCode}
                  onChange={(e) => setFormData({ ...formData, sopCode: e.target.value })}
                  className="mt-1 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(val: any) => setFormData({ ...formData, category: val })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_MAP).map(([k, cfg]) => (
                      <SelectItem key={k} value={k}>
                        {cfg.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Frequency</Label>
                <Select
                  value={formData.frequency}
                  onValueChange={(val: any) => setFormData({ ...formData, frequency: val })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily_morning">Daily Morning</SelectItem>
                    <SelectItem value="daily_evening">Daily Evening</SelectItem>
                    <SelectItem value="daily_per_shift">Daily Per Shift</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="per_batch">Per Batch</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Vendor Assignment</Label>
                <Select
                  value={formData.vendorId}
                  onValueChange={(val) => setFormData({ ...formData, vendorId: val })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Vendors (Default Standard)</SelectItem>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Checkpoint Builder Section */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center justify-between">
                <span>Checkpoints List ({formData.checkpoints?.length || 0})</span>
                <span className="text-[11px] text-gray-400 font-normal">
                  Add questions & inspection points below
                </span>
              </h4>

              {/* Add Checkpoint Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 bg-white p-3 rounded-md border border-gray-200">
                <div className="md:col-span-2">
                  <Input
                    placeholder="Checkpoint description (e.g. Chiller temperature reading)"
                    value={chkCheckpoint}
                    onChange={(e) => setChkCheckpoint(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div>
                  <Select value={chkDepartment} onValueChange={setChkDepartment}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEFAULT_DEPARTMENTS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Select value={chkType} onValueChange={(v: any) => setChkType(v)}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes_no">Yes / No</SelectItem>
                      <SelectItem value="temperature">Temperature (°C)</SelectItem>
                      <SelectItem value="number">Numeric / PPM / TPM</SelectItem>
                      <SelectItem value="text">Text Remark</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Input
                    placeholder="Acceptable Range (e.g. 0°C to 5°C, 150-200 PPM)"
                    value={chkRange}
                    onChange={(e) => setChkRange(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-700 flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={chkPhoto}
                      onChange={(e) => setChkPhoto(e.target.checked)}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Photo Required</span>
                  </label>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddCheckpoint}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs w-full"
                  >
                    + Add Checkpoint
                  </Button>
                </div>
              </div>

              {/* Checkpoints Preview */}
              <div className="max-h-52 overflow-y-auto space-y-1.5">
                {(formData.checkpoints || []).map((chk, i) => (
                  <div
                    key={chk.id || i}
                    className="flex items-center justify-between p-2 bg-white rounded border border-gray-200 text-xs"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">
                        {chk.department}
                      </Badge>
                      <span className="font-semibold">{chk.checkpoint}</span>
                      {chk.acceptableRange && (
                        <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] font-mono">
                          {chk.acceptableRange}
                        </span>
                      )}
                      {chk.isPhotoRequired && (
                        <Badge className="bg-amber-100 text-amber-800 text-[9px] hover:bg-amber-100">
                          Photo
                        </Badge>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveCheckpoint(chk.id)}
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
