"use client"
import { useState, useEffect } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, Plus, Link as LinkIcon, Trash2, Building2, QrCode, Settings2, User, Mail, IdCard, CheckCircle, XCircle, Loader2, Eye, Pencil, Check, X, RotateCcw, Tag, FolderPlus, FileText, Printer, Sparkles } from "lucide-react"
import { qrLinksService, QRLink, QRLinkCustomization } from "@/lib/firestore/qrLinksService"
import { companiesService, buildingsService, Company, Building } from "@/lib/firestore"
import { cafeteriasService, Cafeteria } from "@/lib/firestore/cafeteriasService"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import ReportPreview from "./ReportPreview"
import { downloadStandeePdf } from "@/lib/standeePdfClient"


// --- Customization Form Helper ---
function CustomizationFields({ data, onChange }: { data: any, onChange: (d: any) => void }) {
  const [newCategoryName, setNewCategoryName] = useState("")
  const [editingCategory, setEditingCategory] = useState<{ original: string; current: string } | null>(null)

  // Combined unique list of categories (all known categories + defaults)
  const allCategories: string[] = Array.from(new Set([
    ...(data.allCategories || []),
    ...(data.issueCategories || []),
    ...COMPLAINT_CATEGORIES
  ]))

  const activeCategories: string[] = data.issueCategories || COMPLAINT_CATEGORIES

  const toggleCategory = (cat: string) => {
    if (activeCategories.includes(cat)) {
      onChange({ ...data, issueCategories: activeCategories.filter((c: string) => c !== cat) })
    } else {
      onChange({ ...data, issueCategories: [...activeCategories, cat] })
    }
  }

  const handleAddCategory = () => {
    const trimmed = newCategoryName.trim()
    if (!trimmed) {
      toast({ title: "Category name required", description: "Please enter a category name.", variant: "destructive" })
      return
    }
    if (allCategories.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      toast({ title: "Duplicate category", description: "A category with this name already exists.", variant: "destructive" })
      return
    }

    const updatedAll = [...allCategories, trimmed]
    const updatedActive = [...activeCategories, trimmed]
    onChange({
      ...data,
      allCategories: updatedAll,
      issueCategories: updatedActive
    })
    setNewCategoryName("")
    toast({ title: "Category Added", description: `Added "${trimmed}" to available feedback categories.` })
  }

  const handleDeleteCategory = (catToDelete: string) => {
    const updatedAll = allCategories.filter(c => c !== catToDelete)
    const updatedActive = activeCategories.filter(c => c !== catToDelete)
    onChange({
      ...data,
      allCategories: updatedAll,
      issueCategories: updatedActive
    })
    toast({ title: "Category Removed", description: `Removed "${catToDelete}".` })
  }

  const handleStartEdit = (cat: string) => {
    setEditingCategory({ original: cat, current: cat })
  }

  const handleSaveEdit = () => {
    if (!editingCategory) return
    const trimmed = editingCategory.current.trim()
    if (!trimmed) {
      toast({ title: "Invalid Name", description: "Category name cannot be empty.", variant: "destructive" })
      return
    }
    if (trimmed !== editingCategory.original && allCategories.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      toast({ title: "Duplicate Name", description: "Another category already has this name.", variant: "destructive" })
      return
    }

    const updatedAll = allCategories.map(c => c === editingCategory.original ? trimmed : c)
    const updatedActive = activeCategories.map(c => c === editingCategory.original ? trimmed : c)
    onChange({
      ...data,
      allCategories: updatedAll,
      issueCategories: updatedActive
    })
    setEditingCategory(null)
    toast({ title: "Category Updated", description: `Renamed to "${trimmed}".` })
  }

  const handleSelectAll = () => {
    onChange({ ...data, issueCategories: [...allCategories] })
  }

  const handleDeselectAll = () => {
    onChange({ ...data, issueCategories: [] })
  }

  const handleResetDefaults = () => {
    onChange({
      ...data,
      allCategories: [...COMPLAINT_CATEGORIES],
      issueCategories: [...COMPLAINT_CATEGORIES]
    })
    toast({ title: "Reset", description: "Restored default feedback categories." })
  }

  return (
    <div className="pt-4 border-t space-y-5">
      {/* ── Category Management Section ────────────────────────────────────────── */}
      <div className="space-y-4 bg-slate-50/70 p-4 rounded-2xl border border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Tag className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">Feedback Categories (Location Specific)</h4>
              <p className="text-[11px] text-slate-500">Assigned for this company, building & cafe.</p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
            {activeCategories.length} Active / {allCategories.length} Total
          </span>
        </div>

        {/* Reports Page UI: Issue Category Section Controls */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3">
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Settings2 className="w-3.5 h-3.5 text-slate-500" />
            Reports Page UI - Category Options
          </p>

          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <span className="text-xs font-semibold text-slate-700">Show Category Field on Form</span>
              <p className="text-[10px] text-slate-400">Enable issue category dropdown on the report submission page</p>
            </div>
            <ToggleSwitch enabled={data.showIssueCategory !== false} onChange={v => onChange({...data, showIssueCategory: v})} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-600">Category Section Title / Label</Label>
              <Input
                value={data.issueCategoryLabel ?? "Issue Category"}
                onChange={e => onChange({...data, issueCategoryLabel: e.target.value})}
                placeholder="e.g. Issue Category, Feedback Type"
                className="h-8 text-xs bg-slate-50/50"
                disabled={data.showIssueCategory === false}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-600">Dropdown Placeholder Text</Label>
              <Input
                value={data.issueCategoryPlaceholder ?? "Select the type of issue"}
                onChange={e => onChange({...data, issueCategoryPlaceholder: e.target.value})}
                placeholder="e.g. Select the type of issue"
                className="h-8 text-xs bg-slate-50/50"
                disabled={data.showIssueCategory === false}
              />
            </div>
          </div>
        </div>

        {/* Create New Feedback Category */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
          <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <FolderPlus className="w-3.5 h-3.5 text-blue-600" />
            Create Feedback Category
          </Label>
          <div className="flex gap-2">
            <Input
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); } }}
              placeholder="e.g. Hygiene, Ambience, Food Temperature, Billing, Cutlery..."
              className="h-9 text-xs"
            />
            <Button
              type="button"
              onClick={handleAddCategory}
              size="sm"
              className="h-9 gap-1.5 bg-blue-600 hover:bg-blue-700 shrink-0 text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Category
            </Button>
          </div>
        </div>

        {/* Categories List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Assigned Categories</Label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
              >
                Select All
              </button>
              <span className="text-slate-300">•</span>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="text-[11px] text-slate-500 hover:text-slate-700 font-semibold cursor-pointer"
              >
                Deselect All
              </button>
              <span className="text-slate-300">•</span>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="text-[11px] text-amber-600 hover:text-amber-700 font-semibold flex items-center gap-1 cursor-pointer"
                title="Restore default categories"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
            {allCategories.map(cat => {
              const isChecked = activeCategories.includes(cat)
              const isEditing = editingCategory?.original === cat
              const isDefault = COMPLAINT_CATEGORIES.includes(cat)

              return (
                <div
                  key={cat}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                    isChecked
                      ? "bg-white border-blue-200 shadow-sm"
                      : "bg-slate-100/70 border-slate-200 opacity-60"
                  }`}
                >
                  {isEditing ? (
                    <div className="flex items-center gap-1.5 w-full">
                      <Input
                        value={editingCategory.current}
                        onChange={e => setEditingCategory({ ...editingCategory, current: e.target.value })}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); handleSaveEdit(); }
                          if (e.key === 'Escape') { setEditingCategory(null); }
                        }}
                        autoFocus
                        className="h-7 text-xs py-0"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={handleSaveEdit}
                        className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 shrink-0"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditingCategory(null)}
                        className="h-7 w-7 text-slate-400 hover:bg-slate-100 shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center space-x-2 min-w-0 pr-1">
                        <Checkbox
                          id={`cat-${cat}`}
                          checked={isChecked}
                          onCheckedChange={() => toggleCategory(cat)}
                        />
                        <label
                          htmlFor={`cat-${cat}`}
                          className={`text-xs font-semibold cursor-pointer truncate ${
                            isChecked ? "text-slate-800" : "text-slate-500"
                          }`}
                        >
                          {cat}
                        </label>
                        {isDefault ? (
                          <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium shrink-0">
                            Default
                          </span>
                        ) : (
                          <span className="text-[9px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-semibold border border-purple-100 shrink-0">
                            Custom
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleStartEdit(cat)}
                          className="h-6 w-6 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Rename Category"
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteCategory(cat)}
                          className="h-6 w-6 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Delete Category"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <h4 className="text-sm font-semibold">General UI Customization</h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-gray-500">Main Header Text</Label>
            <ToggleSwitch enabled={data.showHeader !== false} onChange={v => onChange({...data, showHeader: v})} />
          </div>
          <Input value={data.headerText} onChange={e => onChange({...data, headerText: e.target.value})} disabled={data.showHeader === false} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-gray-500">"Reporting issue at" Text</Label>
            <ToggleSwitch enabled={data.showReportingIssueAt !== false} onChange={v => onChange({...data, showReportingIssueAt: v})} />
          </div>
          <Input value={data.reportingIssueAtText || "Reporting issue at"} onChange={e => onChange({...data, reportingIssueAtText: e.target.value})} disabled={data.showReportingIssueAt === false} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-gray-500">Submit Button Text</Label>
          </div>
          <Input value={data.submitButtonText} onChange={e => onChange({...data, submitButtonText: e.target.value})} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-gray-500">Food Feedback Header</Label>
            <ToggleSwitch enabled={data.showFeedbackFormHeader !== false} onChange={v => onChange({...data, showFeedbackFormHeader: v})} />
          </div>
          <Input value={data.feedbackFormHeaderText} onChange={e => onChange({...data, feedbackFormHeaderText: e.target.value})} disabled={data.showFeedbackFormHeader === false} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-gray-500">Food Feedback Subheader</Label>
            <ToggleSwitch enabled={data.showFeedbackFormSubHeader !== false} onChange={v => onChange({...data, showFeedbackFormSubHeader: v})} />
          </div>
          <Input value={data.feedbackFormSubHeaderText} onChange={e => onChange({...data, feedbackFormSubHeaderText: e.target.value})} disabled={data.showFeedbackFormSubHeader === false} />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
          <span className="text-sm">Show Company Name</span>
          <ToggleSwitch enabled={!!data.showCompanyName} onChange={v => onChange({...data, showCompanyName: v})} />
        </div>
        <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
          <span className="text-sm">Show Building Name</span>
          <ToggleSwitch enabled={!!data.showBuildingName} onChange={v => onChange({...data, showBuildingName: v})} />
        </div>
        <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
          <span className="text-sm">Show Track Ticket Button</span>
          <ToggleSwitch enabled={!!data.showTrackTicket} onChange={v => onChange({...data, showTrackTicket: v})} />
        </div>
        <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
          <span className="text-sm">Show Priority</span>
          <ToggleSwitch enabled={data.showPriority !== false} onChange={v => onChange({...data, showPriority: v})} />
        </div>
        <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-slate-100">
          <div>
            <span className="text-sm font-semibold text-slate-800">Show Remarks / Description</span>
            <p className="text-[11px] text-slate-400">Enable guest comments textarea</p>
          </div>
          <div className="flex items-center gap-4">
            {data.showRemarks !== false && (
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-600">
                <Checkbox
                  checked={!!data.isRemarksMandatory}
                  onCheckedChange={c => onChange({...data, isRemarksMandatory: !!c})}
                />
                <span className={data.isRemarksMandatory ? "text-red-600 font-bold" : "text-slate-500"}>
                  Mandatory *
                </span>
              </label>
            )}
            <ToggleSwitch enabled={data.showRemarks !== false} onChange={v => onChange({...data, showRemarks: v})} />
          </div>
        </div>

        <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-slate-100">
          <div>
            <span className="text-sm font-semibold text-slate-800">Show Photo Upload Section</span>
            <p className="text-[11px] text-slate-400">Allow guest to attach camera/gallery photos</p>
          </div>
          <div className="flex items-center gap-4">
            {data.showPhotos !== false && (
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-600">
                <Checkbox
                  checked={!!data.isPhotosMandatory}
                  onCheckedChange={c => onChange({...data, isPhotosMandatory: !!c})}
                />
                <span className={data.isPhotosMandatory ? "text-red-600 font-bold" : "text-slate-500"}>
                  Mandatory *
                </span>
              </label>
            )}
            <ToggleSwitch enabled={data.showPhotos !== false} onChange={v => onChange({...data, showPhotos: v})} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Toggle Switch Component ────────────────────────────────────────────────
function ToggleSwitch({ enabled, onChange, disabled }: { enabled: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
        enabled ? "bg-blue-600" : "bg-slate-200"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  )
}

// ─── Field Badge ─────────────────────────────────────────────────────────────
function FieldBadge({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
      enabled
        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
        : "bg-slate-100 text-slate-400 border border-slate-200"
    }`}>
      {enabled
        ? <CheckCircle className="w-2.5 h-2.5" />
        : <XCircle className="w-2.5 h-2.5" />
      }
      {label}
    </span>
  )
}


const COMPLAINT_CATEGORIES = [
  "Cleaning and Hygiene",
  "Food Quality",
  "Food Shortage",
  "Staff"
]

const initialCustomization: QRLinkCustomization = {
  headerText: "Facility Feedback",
  showHeader: true,
  showReportingIssueAt: true,
  reportingIssueAtText: "Reporting issue at",
  showFeedbackFormHeader: true,
  showFeedbackFormSubHeader: true,
  showCompanyName: true,
  showBuildingName: true,
  showTrackTicket: true,
  showPriority: true,
  showRemarks: true,
  isRemarksMandatory: false,
  showPhotos: true,
  isPhotosMandatory: false,
  showIssueCategory: true,
  issueCategoryLabel: "Issue Category",
  issueCategoryPlaceholder: "Select the type of issue",
  issueCategories: COMPLAINT_CATEGORIES,
  allCategories: COMPLAINT_CATEGORIES,
  submitButtonText: "Submit Feedback",
  feedbackFormHeaderText: "Today's Meal Feedback",
  feedbackFormSubHeaderText: "How was your meal? 🍽️"
}

export default function QRLinksPage() {
  const [links, setLinks] = useState<QRLink[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const { user } = useAuth()

  // Data for selectors
  const [companies, setCompanies] = useState<Company[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [cafeterias, setCafeterias] = useState<Cafeteria[]>([])

  // Create Form State
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("")
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("")
  const [selectedCafeId, setSelectedCafeId] = useState<string>("")
  const [requireName, setRequireName] = useState(false)
  const [isNameMandatory, setIsNameMandatory] = useState(true)
  const [requireEmail, setRequireEmail] = useState(false)
  const [isEmailMandatory, setIsEmailMandatory] = useState(true)
  const [requireEmployeeId, setRequireEmployeeId] = useState(false)
  const [isEmployeeIdMandatory, setIsEmployeeIdMandatory] = useState(true)
  const [creating, setCreating] = useState(false)

  const [customization, setCustomization] = useState(initialCustomization)
  const [editCustomization, setEditCustomization] = useState(initialCustomization)


  // Edit Modal State
  const [editLink, setEditLink] = useState<QRLink | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editRequireName, setEditRequireName] = useState(false)
  const [editIsNameMandatory, setEditIsNameMandatory] = useState(true)
  const [editRequireEmail, setEditRequireEmail] = useState(false)
  const [editIsEmailMandatory, setEditIsEmailMandatory] = useState(true)
  const [editRequireEmployeeId, setEditRequireEmployeeId] = useState(false)
  const [editIsEmployeeIdMandatory, setEditIsEmployeeIdMandatory] = useState(true)
  const [editSelectedCompanyId, setEditSelectedCompanyId] = useState<string>("")
  const [editSelectedBuildingId, setEditSelectedBuildingId] = useState<string>("")
  const [editSelectedCafeId, setEditSelectedCafeId] = useState<string>("")
  const [saving, setSaving] = useState(false)

  // Standee Modal State
  const [standeeLink, setStandeeLink] = useState<QRLink | null>(null)
  const [standeeModalOpen, setStandeeModalOpen] = useState(false)
  const [standeeStyle, setStandeeStyle] = useState<"criss_cross" | "diner">("criss_cross")
  const [downloadingStandee, setDownloadingStandee] = useState(false)

  const openStandeeModal = (link: QRLink) => {
    setStandeeLink(link)
    setStandeeStyle("criss_cross")
    setStandeeModalOpen(true)
  }

  const handleDownloadStandee = async (link: QRLink, style: "criss_cross" | "diner") => {
    try {
      setDownloadingStandee(true)
      const targetUrl = `${origin || (typeof window !== "undefined" ? window.location.origin : "")}/report/${link.id}`
      await downloadStandeePdf({
        url: targetUrl,
        company: link.companyName,
        building: link.buildingName,
        cafe: link.cafeName,
        style,
      })
      toast({
        title: "Standee PDF Generated!",
        description: `Downloaded 6x2.5 ft vector PDF for ${link.cafeName} (${style === "diner" ? "Diner Engagement" : "5-Step Flow"}).`,
      })
    } catch (err: any) {
      toast({
        title: "Error Generating PDF",
        description: err?.message || "Could not generate standee PDF",
        variant: "destructive",
      })
    } finally {
      setDownloadingStandee(false)
    }
  }

  // Origin for full URLs
  const [origin, setOrigin] = useState("")

  useEffect(() => {
    setOrigin(window.location.origin)
    fetchLinks()
    fetchMasterData()
  }, [])

  const fetchLinks = async () => {
    try {
      setLoading(true)
      const data = await qrLinksService.getAll()
      setLinks(data)
    } catch (e) {
      toast({ title: "Error", description: "Failed to load QR links", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const fetchMasterData = async () => {
    try {
      const allCompanies = await companiesService.getAll()
      setCompanies(allCompanies)
      const allBuildings = await buildingsService.getAll()
      setBuildings(allBuildings)
      const allCafes = await cafeteriasService.getAll()
      setCafeterias(allCafes)
    } catch (e) {
      console.error(e)
    }
  }

  const handleCreate = async () => {
    if (!selectedCompanyId || !selectedBuildingId || !selectedCafeId) {
      toast({ title: "Missing fields", description: "Please select Company, Building, and Cafe.", variant: "destructive" })
      return
    }

    setCreating(true)
    try {
      const company = companies.find(c => c.id === selectedCompanyId)
      const building = buildings.find(b => b.id === selectedBuildingId)
      const cafe = cafeterias.find(c => c.id === selectedCafeId)

      await qrLinksService.create({
        companyId: company!.id,
        companyName: company!.name,
        buildingId: building!.id,
        buildingName: building!.name,
        cafeId: cafe!.id,
        cafeName: cafe!.name,
        createdBy: user?.uid || 'admin',
        createdByName: user?.displayName || 'Admin',
        requireName,
        isNameMandatory,
        requireEmail,
        isEmailMandatory,
        requireEmployeeId,
        isEmployeeIdMandatory,
        showRemarks: customization.showRemarks !== false,
        isRemarksMandatory: !!customization.isRemarksMandatory,
        showPhotos: customization.showPhotos !== false,
        isPhotosMandatory: !!customization.isPhotosMandatory,
        customization: {
          ...customization,
          isNameMandatory,
          isEmailMandatory,
          isEmployeeIdMandatory,
          showRemarks: customization.showRemarks !== false,
          isRemarksMandatory: !!customization.isRemarksMandatory,
          showPhotos: customization.showPhotos !== false,
          isPhotosMandatory: !!customization.isPhotosMandatory,
        }
      })
      toast({ title: "Success", description: "QR Link generated." })
      setModalOpen(false)
      setSelectedCompanyId("")
      setSelectedBuildingId("")
      setSelectedCafeId("")
      setRequireName(false)
      setIsNameMandatory(true)
      setRequireEmail(false)
      setIsEmailMandatory(true)
      setRequireEmployeeId(false)
      setIsEmployeeIdMandatory(true)
      setCustomization(initialCustomization)
      fetchLinks()
    } catch (e) {
      toast({ title: "Error", description: "Failed to create link.", variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  const handleGenerateAll = async () => {
    if (!confirm("Are you sure you want to generate QR links for all missing cafeterias?")) return;
    
    setCreating(true)
    let generatedCount = 0;
    
    try {
      for (const cafe of cafeterias) {
        const company = companies.find(c => c.id === cafe.companyId);
        const building = buildings.find(b => b.id === cafe.buildingId);
        
        if (!company || !building) continue;
        
        const existingLink = links.find(l => l.cafeId === cafe.id && l.buildingId === building.id && l.companyId === company.id);
        if (existingLink) continue;

        await qrLinksService.create({
          companyId: company.id,
          companyName: company.name,
          buildingId: building.id,
          buildingName: building.name,
          cafeId: cafe.id,
          cafeName: cafe.name,
          createdBy: user?.uid || 'admin',
          createdByName: user?.displayName || 'Admin',
          requireName: false,
          requireEmail: false,
          requireEmployeeId: false,
          customization: initialCustomization
        });
        generatedCount++;
      }
      
      toast({ title: "Success", description: `Generated ${generatedCount} new QR links.` })
      fetchLinks()
    } catch (e) {
      toast({ title: "Error", description: "Failed to generate all links.", variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  const openEditModal = (link: QRLink) => {
    setEditLink(link)
    setEditRequireName(!!link.requireName)
    setEditIsNameMandatory(link.isNameMandatory ?? link.customization?.isNameMandatory ?? true)
    setEditRequireEmail(!!link.requireEmail)
    setEditIsEmailMandatory(link.isEmailMandatory ?? link.customization?.isEmailMandatory ?? true)
    setEditRequireEmployeeId(!!link.requireEmployeeId)
    setEditIsEmployeeIdMandatory(link.isEmployeeIdMandatory ?? link.customization?.isEmployeeIdMandatory ?? true)
    const existingActive = link.customization?.issueCategories || COMPLAINT_CATEGORIES
    const allKnown = Array.from(new Set([
      ...COMPLAINT_CATEGORIES,
      ...(link.customization?.allCategories || []),
      ...existingActive
    ]))
    setEditCustomization({
      ...initialCustomization,
      ...(link.customization || {}),
      issueCategories: existingActive,
      allCategories: allKnown,
      showIssueCategory: link.customization?.showIssueCategory !== false,
      issueCategoryLabel: link.customization?.issueCategoryLabel || "Issue Category",
      issueCategoryPlaceholder: link.customization?.issueCategoryPlaceholder || "Select the type of issue",
      showRemarks: link.customization?.showRemarks !== false,
      isRemarksMandatory: !!(link.customization?.isRemarksMandatory ?? link.isRemarksMandatory),
      showPhotos: link.customization?.showPhotos !== false,
      isPhotosMandatory: !!(link.customization?.isPhotosMandatory ?? link.isPhotosMandatory),
    })
    setEditSelectedCompanyId(link.companyId)
    setEditSelectedBuildingId(link.buildingId)
    setEditSelectedCafeId(link.cafeId)
    setEditModalOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editLink) return
    if (!editSelectedCompanyId || !editSelectedBuildingId || !editSelectedCafeId) {
      toast({ title: "Missing fields", description: "Please select Company, Building, and Cafe.", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const company = companies.find(c => c.id === editSelectedCompanyId)
      const building = buildings.find(b => b.id === editSelectedBuildingId)
      const cafe = cafeterias.find(c => c.id === editSelectedCafeId)

      const updatedCustomization = {
        ...editCustomization,
        isNameMandatory: editIsNameMandatory,
        isEmailMandatory: editIsEmailMandatory,
        isEmployeeIdMandatory: editIsEmployeeIdMandatory,
        showRemarks: editCustomization.showRemarks !== false,
        isRemarksMandatory: !!editCustomization.isRemarksMandatory,
        showPhotos: editCustomization.showPhotos !== false,
        isPhotosMandatory: !!editCustomization.isPhotosMandatory,
      }

      await qrLinksService.update(editLink.id, {
        companyId: company!.id,
        companyName: company!.name,
        buildingId: building!.id,
        buildingName: building!.name,
        cafeId: cafe!.id,
        cafeName: cafe!.name,
        requireName: editRequireName,
        isNameMandatory: editIsNameMandatory,
        requireEmail: editRequireEmail,
        isEmailMandatory: editIsEmailMandatory,
        requireEmployeeId: editRequireEmployeeId,
        isEmployeeIdMandatory: editIsEmployeeIdMandatory,
        showRemarks: editCustomization.showRemarks !== false,
        isRemarksMandatory: !!editCustomization.isRemarksMandatory,
        showPhotos: editCustomization.showPhotos !== false,
        isPhotosMandatory: !!editCustomization.isPhotosMandatory,
        customization: updatedCustomization
      })
      toast({ title: "Saved!", description: "Field settings updated successfully." })
      setEditModalOpen(false)
      setEditLink(null)
      // Update local state immediately for instant feedback
      setLinks(prev => prev.map(l => l.id === editLink.id
        ? {
            ...l,
            companyId: company!.id,
            companyName: company!.name,
            buildingId: building!.id,
            buildingName: building!.name,
            cafeId: cafe!.id,
            cafeName: cafe!.name,
            requireName: editRequireName,
            isNameMandatory: editIsNameMandatory,
            requireEmail: editRequireEmail,
            isEmailMandatory: editIsEmailMandatory,
            requireEmployeeId: editRequireEmployeeId,
            isEmployeeIdMandatory: editIsEmployeeIdMandatory,
            showRemarks: editCustomization.showRemarks !== false,
            isRemarksMandatory: !!editCustomization.isRemarksMandatory,
            showPhotos: editCustomization.showPhotos !== false,
            isPhotosMandatory: !!editCustomization.isPhotosMandatory,
            customization: updatedCustomization
          }
        : l
      ))
    } catch (e) {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this link? The QR code will stop working.")) return
    try {
      await qrLinksService.delete(id)
      toast({ title: "Deleted", description: "Link has been deactivated." })
      fetchLinks()
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete.", variant: "destructive" })
    }
  }

  const downloadQR = (link: QRLink) => {
    const svg = document.getElementById(`qr-${link.id}`)
    if (!svg) return
    const svgData = new XMLSerializer().serializeToString(svg)
    // Scale up the SVG for high-res download
    const scaledSvgData = svgData
      .replace(/width="160"/, 'width="800"')
      .replace(/height="160"/, 'height="800"');
      
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    const img = new Image()
    
    img.onload = () => {
      const qrSize = 800; 
      const padding = 60;
      const headerHeight = 250; 
      
      canvas.width = qrSize + (padding * 2); 
      canvas.height = qrSize + headerHeight + (padding * 2);
      
      if (!ctx) return;
      
      // Draw White Background
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.textAlign = "center";
      const centerX = canvas.width / 2;
      
      // Call to action
      ctx.fillStyle = "#0f172a"; 
      ctx.font = "bold 48px sans-serif";
      ctx.fillText("Drop your feedback or complaints", centerX, padding + 50);
      
      // Company & Building
      ctx.fillStyle = "#64748b"; 
      ctx.font = "28px sans-serif";
      ctx.fillText(`${link.companyName}  •  ${link.buildingName}`, centerX, padding + 120);
      
      // Cafe Name
      ctx.fillStyle = "#2563eb"; 
      ctx.font = "bold 40px sans-serif";
      ctx.fillText(link.cafeName, centerX, padding + 180);
      
      // Draw QR Code Image
      ctx.drawImage(img, padding, headerHeight + padding, qrSize, qrSize);
      
      const pngFile = canvas.toDataURL("image/png")
      const downloadLink = document.createElement("a")
      downloadLink.download = `QR-${link.cafeName.replace(/[^a-z0-9]/gi, '_')}.png`
      downloadLink.href = `${pngFile}`
      downloadLink.click()
    }
    img.src = "data:image/svg+xml;base64," + btoa(scaledSvgData)
  }

  const filteredBuildings = buildings.filter(b => b.companyId === selectedCompanyId)
  const filteredCafes = cafeterias.filter(c => c.buildingId === selectedBuildingId || c.companyId === selectedCompanyId)

  const filteredEditBuildings = buildings.filter(b => b.companyId === editSelectedCompanyId)
  const filteredEditCafes = cafeterias.filter(c => c.buildingId === editSelectedBuildingId || c.companyId === editSelectedCompanyId)


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <QrCode className="h-6 w-6 text-blue-600" /> Public Complaint QR Links
          </h1>
          <p className="text-gray-500">Generate public QR codes for capturing tickets from specific locations.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2 bg-white" onClick={handleGenerateAll} disabled={creating}>
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
            Generate All
          </Button>
          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> Generate New Link
              </Button>
            </DialogTrigger>
          <DialogContent className="!max-w-none !w-screen !h-screen !m-0 !p-0 !rounded-none border-0 overflow-hidden bg-gray-50">
            <div className="flex h-full w-full">
              {/* Left Side: Form Controls */}
              <div className="w-1/2 border-r border-slate-200 bg-white overflow-y-auto custom-scrollbar flex flex-col">
                <div className="p-6">
                  <DialogHeader className="mb-6">
                    <DialogTitle className="text-xl">Generate New QR Link</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
              <div className="space-y-2">
                <Label>Company</Label>
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger><SelectValue placeholder="Select Company" /></SelectTrigger>
                  <SelectContent>
                    {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Building</Label>
                <Select value={selectedBuildingId} onValueChange={setSelectedBuildingId} disabled={!selectedCompanyId}>
                  <SelectTrigger><SelectValue placeholder="Select Building" /></SelectTrigger>
                  <SelectContent>
                    {filteredBuildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cafe / Location</Label>
                <Select value={selectedCafeId} onValueChange={setSelectedCafeId} disabled={!selectedBuildingId}>
                  <SelectTrigger><SelectValue placeholder="Select Cafe" /></SelectTrigger>
                  <SelectContent>
                    {filteredCafes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="pt-4 border-t space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-800">Form Fields & Mandatory Requirements</h4>
                  <span className="text-[11px] text-slate-400 font-medium">Control guest field requirements</span>
                </div>

                {/* Name */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Guest Name</p>
                      <p className="text-[10px] text-slate-500">Display name field on form</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {requireName && (
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-600">
                        <Checkbox
                          checked={isNameMandatory}
                          onCheckedChange={c => setIsNameMandatory(!!c)}
                        />
                        <span className={isNameMandatory ? "text-red-600 font-bold" : "text-slate-500"}>
                          Mandatory *
                        </span>
                      </label>
                    )}
                    <ToggleSwitch enabled={requireName} onChange={setRequireName} />
                  </div>
                </div>

                {/* Contact */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Contact / Email</p>
                      <p className="text-[10px] text-slate-500">Contact number or email for ticket follow-up</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {requireEmail && (
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-600">
                        <Checkbox
                          checked={isEmailMandatory}
                          onCheckedChange={c => setIsEmailMandatory(!!c)}
                        />
                        <span className={isEmailMandatory ? "text-red-600 font-bold" : "text-slate-500"}>
                          Mandatory *
                        </span>
                      </label>
                    )}
                    <ToggleSwitch enabled={requireEmail} onChange={setRequireEmail} />
                  </div>
                </div>

                {/* Employee ID */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <IdCard className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Employee ID</p>
                      <p className="text-[10px] text-slate-500">Company corporate badge identification</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {requireEmployeeId && (
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-600">
                        <Checkbox
                          checked={isEmployeeIdMandatory}
                          onCheckedChange={c => setIsEmployeeIdMandatory(!!c)}
                        />
                        <span className={isEmployeeIdMandatory ? "text-red-600 font-bold" : "text-slate-500"}>
                          Mandatory *
                        </span>
                      </label>
                    )}
                    <ToggleSwitch enabled={requireEmployeeId} onChange={setRequireEmployeeId} />
                  </div>
                </div>
              </div>
              <CustomizationFields data={customization} onChange={setCustomization} />
            </div>
          </div>
          <div className="p-4 border-t border-slate-100 bg-slate-50 mt-auto sticky bottom-0 z-10 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreate} disabled={creating || !selectedCompanyId || !selectedBuildingId || !selectedCafeId}>
                    {creating ? "Generating..." : "Generate"}
                  </Button>
                </div>
              </div>
              
              {/* Right Side: Live Preview */}
              <div className="w-1/2 bg-slate-50 flex items-center justify-center p-6 overflow-hidden relative">
                 <div className="absolute top-4 left-4 flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                   <Eye className="w-3 h-3" /> Live Preview
                 </div>
                 <ReportPreview 
                   customization={customization}
                   companyName={companies.find(c => c.id === selectedCompanyId)?.name}
                   buildingName={buildings.find(b => b.id === selectedBuildingId)?.name}
                   cafeName={cafeterias.find(c => c.id === selectedCafeId)?.name}
                   requireName={requireName}
                   isNameMandatory={isNameMandatory}
                   requireEmail={requireEmail}
                   isEmailMandatory={isEmailMandatory}
                   requireEmployeeId={requireEmployeeId}
                   isEmployeeIdMandatory={isEmployeeIdMandatory}
                 />
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* ── Edit Fields Modal ─────────────────────────────────────────────── */}
      <Dialog open={editModalOpen} onOpenChange={(o) => { if (!o) setEditLink(null); setEditModalOpen(o) }}>
        <DialogContent className="!max-w-none !w-screen !h-screen !m-0 !p-0 !rounded-none border-0 overflow-hidden bg-gray-50">
          {editLink && (
            <div className="flex h-full w-full">
              {/* Left Side: Form Controls */}
              <div className="w-1/2 border-r border-slate-200 bg-white overflow-y-auto custom-scrollbar flex flex-col">
                <div className="p-6">
                  <DialogHeader className="mb-6">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                      <Settings2 className="w-5 h-5 text-blue-600" />
                      Edit Form Fields
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Select value={editSelectedCompanyId} onValueChange={setEditSelectedCompanyId}>
                    <SelectTrigger><SelectValue placeholder="Select Company" /></SelectTrigger>
                    <SelectContent>
                      {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Building</Label>
                  <Select value={editSelectedBuildingId} onValueChange={setEditSelectedBuildingId} disabled={!editSelectedCompanyId}>
                    <SelectTrigger><SelectValue placeholder="Select Building" /></SelectTrigger>
                    <SelectContent>
                      {filteredEditBuildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cafe / Location</Label>
                  <Select value={editSelectedCafeId} onValueChange={setEditSelectedCafeId} disabled={!editSelectedBuildingId}>
                    <SelectTrigger><SelectValue placeholder="Select Cafe" /></SelectTrigger>
                    <SelectContent>
                      {filteredEditCafes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Toggle fields */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Form Fields & Mandatory Requirements</p>
                  <span className="text-[11px] text-slate-400">Control guest requirements</span>
                </div>

                {/* Name */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Guest Name</p>
                      <p className="text-[10px] text-slate-400">Display name field on form</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {editRequireName && (
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-600">
                        <Checkbox
                          checked={editIsNameMandatory}
                          onCheckedChange={c => setEditIsNameMandatory(!!c)}
                        />
                        <span className={editIsNameMandatory ? "text-red-600 font-bold" : "text-slate-500"}>
                          Mandatory *
                        </span>
                      </label>
                    )}
                    <ToggleSwitch enabled={editRequireName} onChange={setEditRequireName} />
                  </div>
                </div>

                {/* Contact / Email */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Contact / Email</p>
                      <p className="text-[10px] text-slate-400">Phone number or email for follow-up</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {editRequireEmail && (
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-600">
                        <Checkbox
                          checked={editIsEmailMandatory}
                          onCheckedChange={c => setEditIsEmailMandatory(!!c)}
                        />
                        <span className={editIsEmailMandatory ? "text-red-600 font-bold" : "text-slate-500"}>
                          Mandatory *
                        </span>
                      </label>
                    )}
                    <ToggleSwitch enabled={editRequireEmail} onChange={setEditRequireEmail} />
                  </div>
                </div>

                {/* Employee ID */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <IdCard className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Employee ID</p>
                      <p className="text-[10px] text-slate-400">Company employee identification</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {editRequireEmployeeId && (
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-600">
                        <Checkbox
                          checked={editIsEmployeeIdMandatory}
                          onCheckedChange={c => setEditIsEmployeeIdMandatory(!!c)}
                        />
                        <span className={editIsEmployeeIdMandatory ? "text-red-600 font-bold" : "text-slate-500"}>
                          Mandatory *
                        </span>
                      </label>
                    )}
                    <ToggleSwitch enabled={editRequireEmployeeId} onChange={setEditRequireEmployeeId} />
                  </div>
                </div>
              </div>
              <CustomizationFields data={editCustomization} onChange={setEditCustomization} />
            </div>
          </div>
          <div className="p-4 border-t border-slate-100 bg-slate-50 mt-auto sticky bottom-0 z-10 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditModalOpen(false)} disabled={saving}>Cancel</Button>
                  <Button onClick={handleSaveEdit} disabled={saving} className="gap-2 bg-blue-600 hover:bg-blue-700">
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : "Save Changes"}
                  </Button>
                </div>
              </div>
              
              {/* Right Side: Live Preview */}
              <div className="w-1/2 bg-slate-50 flex items-center justify-center p-6 overflow-hidden relative">
                 <div className="absolute top-4 left-4 flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                   <Eye className="w-3 h-3" /> Live Preview
                 </div>
                 <ReportPreview 
                   customization={editCustomization}
                   companyName={companies.find(c => c.id === editSelectedCompanyId)?.name}
                   buildingName={buildings.find(b => b.id === editSelectedBuildingId)?.name}
                   cafeName={cafeterias.find(c => c.id === editSelectedCafeId)?.name}
                   requireName={editRequireName}
                   isNameMandatory={editIsNameMandatory}
                   requireEmail={editRequireEmail}
                   isEmailMandatory={editIsEmailMandatory}
                   requireEmployeeId={editRequireEmployeeId}
                   isEmployeeIdMandatory={editIsEmployeeIdMandatory}
                 />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading links...</div>
      ) : links.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg bg-white">
          <QrCode className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No QR links generated yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {links.map((link) => {
            const url = `${origin}/report/${link.id}`
            return (
              <div key={link.id} className="bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col">
                
                {/* Card Header */}
                <div className="p-5 flex items-start justify-between border-b border-slate-100">
                  <div className="flex-1 min-w-0 pr-2">
                    <h3 className="font-bold text-lg text-slate-800 truncate">{link.cafeName}</h3>
                    <div className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{link.companyName} – {link.buildingName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 h-8 w-8 rounded-lg"
                      onClick={() => openEditModal(link)}
                      title="Edit enabled fields"
                    >
                      <Settings2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 w-8 rounded-lg"
                      onClick={() => handleDelete(link.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Field Badges */}
                <div className="px-5 py-3 flex flex-wrap gap-1.5 bg-slate-50/50 border-b border-slate-100">
                  <FieldBadge enabled={!!link.requireName} label={link.requireName ? (link.isNameMandatory !== false ? "Name (Req)" : "Name (Opt)") : "Name (Off)"} />
                  <FieldBadge enabled={!!link.requireEmail} label={link.requireEmail ? (link.isEmailMandatory !== false ? "Contact (Req)" : "Contact (Opt)") : "Contact (Off)"} />
                  <FieldBadge enabled={!!link.requireEmployeeId} label={link.requireEmployeeId ? (link.isEmployeeIdMandatory !== false ? "Emp ID (Req)" : "Emp ID (Opt)") : "Emp ID (Off)"} />
                  {link.customization?.showRemarks !== false && (
                    <FieldBadge enabled={true} label={link.customization?.isRemarksMandatory ? "Remarks (Req)" : "Remarks (Opt)"} />
                  )}
                  {link.customization?.showPhotos !== false && (
                    <FieldBadge enabled={true} label={link.customization?.isPhotosMandatory ? "Photo (Req)" : "Photo (Opt)"} />
                  )}
                </div>

                {/* QR Code */}
                <div className="flex justify-center py-5 bg-white">
                  <QRCodeSVG
                    id={`qr-${link.id}`}
                    value={url}
                    size={160}
                    level="H"
                    includeMargin={true}
                  />
                </div>

                {/* Actions */}
                <div className="mt-auto p-4 space-y-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <Input readOnly value={url} className="text-xs font-mono bg-gray-50 h-8 text-slate-500" />
                    <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={() => {
                      navigator.clipboard.writeText(url)
                      toast({ title: "Copied!", description: "Link copied to clipboard." })
                    }}>
                      <LinkIcon className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button className="w-full gap-1.5 text-xs" variant="outline" onClick={() => downloadQR(link)}>
                      <Download className="w-3.5 h-3.5" /> Download QR
                    </Button>
                    <Button
                      className="w-full gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
                      onClick={() => openStandeeModal(link)}
                    >
                      <FileText className="w-3.5 h-3.5" /> Standee (6×2.5ft)
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Standee 6x2.5 ft Export Modal ─────────────────────────────────────── */}
      <Dialog open={standeeModalOpen} onOpenChange={(o) => { if (!o) setStandeeLink(null); setStandeeModalOpen(o) }}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-6 bg-slate-50 border-slate-200">
          {standeeLink && (
            <div className="space-y-6">
              {/* Header */}
              <DialogHeader className="pb-4 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700 shadow-sm">
                      <Printer className="w-6 h-6" />
                    </div>
                    <div>
                      <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        Roll-Up Standee Banner (6.0 ft × 2.5 ft)
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          100% Vector Print PDF
                        </span>
                      </DialogTitle>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Exact 30.0" × 72.0" (2,160 pt × 5,184 pt) standard roll-up standee banner with live table QR code.
                      </p>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              {/* Location Summary Bar */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-700">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold text-slate-900">{standeeLink.cafeName}</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-600">{standeeLink.companyName}</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-600">{standeeLink.buildingName}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px] bg-slate-100 px-2.5 py-1 rounded-md">
                  <LinkIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate max-w-[280px]">{`${origin}/report/${standeeLink.id}`}</span>
                </div>
              </div>

              {/* Style Selector Tabs */}
              <div className="space-y-3">
                <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Select Standee Layout & Design
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Style 1: 5-Step Criss-Cross Flow */}
                  <div
                    onClick={() => setStandeeStyle("criss_cross")}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      standeeStyle === "criss_cross"
                        ? "bg-white border-emerald-500 shadow-md ring-2 ring-emerald-100"
                        : "bg-white/70 border-slate-200 hover:border-slate-300 opacity-80"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Recommended for Operations
                        </span>
                        <h4 className="font-bold text-slate-800 text-sm mt-1">5-Step Criss-Cross Flow</h4>
                        <p className="text-xs text-slate-500">
                          Step-by-step zigzag pathway: Diner Scan ➔ Food/Cleanliness Rating ➔ Cloud Dispatch ➔ Mandatory Photo Proof ➔ Compliance Sync.
                        </p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        standeeStyle === "criss_cross" ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300"
                      }`}>
                        {standeeStyle === "criss_cross" && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                  </div>

                  {/* Style 2: Diner Engagement */}
                  <div
                    onClick={() => setStandeeStyle("diner")}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      standeeStyle === "diner"
                        ? "bg-white border-emerald-500 shadow-md ring-2 ring-emerald-100"
                        : "bg-white/70 border-slate-200 hover:border-slate-300 opacity-80"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                          Recommended for Cafeteria Entrance
                        </span>
                        <h4 className="font-bold text-slate-800 text-sm mt-1">Diner Engagement & Quick Feedback</h4>
                        <p className="text-xs text-slate-500">
                          High-visibility "YOUR FEEDBACK MATTERS" headline, extra-large center QR code, and 3 simple diner steps.
                        </p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        standeeStyle === "diner" ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300"
                      }`}>
                        {standeeStyle === "diner" && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Standee Preview Box (Scaled Mockup) */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center">
                <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100 mb-4 text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-emerald-600" /> Visual Preview (Scale: 6ft × 2.5ft Aspect Ratio)
                  </span>
                  <span className="text-slate-400">Physical Size: 30 inches × 72 inches (100% Vector)</span>
                </div>

                {/* Scaled Banner Mockup */}
                <div className="relative w-[250px] h-[600px] bg-slate-900 rounded-lg shadow-2xl p-2 border-4 border-slate-800 flex flex-col items-center justify-between overflow-hidden text-center select-none">
                  {/* Standee Base Plate */}
                  <div className="absolute top-0 inset-x-0 h-1.5 bg-emerald-500"></div>

                  {/* Standee Inner Card */}
                  <div className="w-full h-full bg-slate-50 rounded flex flex-col items-center justify-between p-3.5 overflow-hidden">
                    {/* Header */}
                    <div className="w-full space-y-1 pt-1">
                      <div className="flex items-center justify-center gap-1">
                        <div className="w-4 h-4 rounded-full border-2 border-emerald-500 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                        </div>
                        <span className="font-extrabold text-sm tracking-tight text-slate-900">cookhouse</span>
                      </div>
                      <div className="bg-emerald-50 text-emerald-800 text-[8px] font-bold px-2 py-0.5 rounded-full inline-block border border-emerald-200 truncate max-w-full">
                        {standeeLink.companyName} • {standeeLink.buildingName} • {standeeLink.cafeName}
                      </div>
                    </div>

                    {/* Headline */}
                    <div className="space-y-0.5">
                      <h4 className="font-black text-[11px] text-slate-900 uppercase tracking-tight leading-tight">
                        {standeeStyle === "diner" ? "YOUR FEEDBACK MATTERS!" : "CLOSED-LOOP FEEDBACK WORKFLOW"}
                      </h4>
                      <p className="text-[7.5px] text-emerald-700 font-semibold">
                        {standeeStyle === "diner" ? "Help Us Improve Every Single Meal You Enjoy" : "Instant Action • Tabletop QR • Photo Proof"}
                      </p>
                    </div>

                    {/* QR Code Container */}
                    <div className="p-2 bg-white rounded-lg border-2 border-emerald-300 shadow-sm flex flex-col items-center">
                      <QRCodeSVG
                        value={`${origin}/report/${standeeLink.id}`}
                        size={standeeStyle === "diner" ? 110 : 85}
                        level="H"
                        includeMargin={false}
                      />
                      <span className="text-[7px] font-bold text-slate-600 mt-1 uppercase tracking-wider">
                        Scan with any camera
                      </span>
                    </div>

                    {/* Pathway Highlights */}
                    <div className="w-full space-y-1 text-left text-[7.5px]">
                      {standeeStyle === "criss_cross" ? (
                        <>
                          <div className="bg-white p-1 rounded border border-slate-200 flex items-center gap-1 shadow-2xs">
                            <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white font-bold text-[7px] flex items-center justify-center shrink-0">1</span>
                            <span className="font-bold text-slate-800 truncate">Scan Table QR: Rate Dish / Hygiene</span>
                          </div>
                          <div className="bg-white p-1 rounded border border-slate-200 flex items-center gap-1 shadow-2xs">
                            <span className="w-3.5 h-3.5 rounded-full bg-blue-600 text-white font-bold text-[7px] flex items-center justify-center shrink-0">2</span>
                            <span className="font-bold text-slate-800 truncate">Immediate Cloud Dispatch to CookHouse</span>
                          </div>
                          <div className="bg-white p-1 rounded border border-slate-200 flex items-center gap-1 shadow-2xs">
                            <span className="w-3.5 h-3.5 rounded-full bg-amber-600 text-white font-bold text-[7px] flex items-center justify-center shrink-0">3</span>
                            <span className="font-bold text-slate-800 truncate">Mandatory Employee Photo Proof</span>
                          </div>
                          <div className="bg-white p-1 rounded border border-slate-200 flex items-center gap-1 shadow-2xs">
                            <span className="w-3.5 h-3.5 rounded-full bg-teal-600 text-white font-bold text-[7px] flex items-center justify-center shrink-0">4</span>
                            <span className="font-bold text-slate-800 truncate">100% Verified Compliance Audit Sync</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="bg-white p-1.5 rounded border border-slate-200 flex items-center gap-1.5 shadow-2xs">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span className="font-semibold text-slate-800">1. Open Camera & Point at QR Code</span>
                          </div>
                          <div className="bg-white p-1.5 rounded border border-slate-200 flex items-center gap-1.5 shadow-2xs">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span className="font-semibold text-slate-800">2. Rate Taste, Portion, or Housekeeping</span>
                          </div>
                          <div className="bg-white p-1.5 rounded border border-slate-200 flex items-center gap-1.5 shadow-2xs">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span className="font-semibold text-slate-800">3. Supervisor Resolves on the Spot</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="w-full bg-slate-900 text-white p-1 rounded text-[7px] space-y-0.5">
                      <p className="font-bold text-slate-200">Cookhouse Dining Compliance</p>
                      <p className="text-slate-400 text-[6.5px]">cookhouse.com • 100% Vector Print</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
                <Button variant="outline" onClick={() => setStandeeModalOpen(false)}>
                  Close
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => handleDownloadStandee(standeeLink, standeeStyle)}
                    disabled={downloadingStandee}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md h-10 px-5 text-sm"
                  >
                    {downloadingStandee ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Generating 6×2.5 ft Vector PDF...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" /> Download Standee Vector PDF (6×2.5 ft)
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
