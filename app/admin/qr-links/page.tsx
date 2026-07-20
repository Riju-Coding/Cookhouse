"use client"
import { useState, useEffect } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, Plus, Link as LinkIcon, Trash2, Building2, QrCode, Settings2, User, Mail, IdCard, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { qrLinksService, QRLink } from "@/lib/firestore/qrLinksService"
import { companiesService, buildingsService, Company, Building } from "@/lib/firestore"
import { cafeteriasService, Cafeteria } from "@/lib/firestore/cafeteriasService"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"

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
  const [requireEmail, setRequireEmail] = useState(false)
  const [requireEmployeeId, setRequireEmployeeId] = useState(false)
  const [creating, setCreating] = useState(false)

  // Edit Modal State
  const [editLink, setEditLink] = useState<QRLink | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editRequireName, setEditRequireName] = useState(false)
  const [editRequireEmail, setEditRequireEmail] = useState(false)
  const [editRequireEmployeeId, setEditRequireEmployeeId] = useState(false)
  const [saving, setSaving] = useState(false)

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
        requireEmail,
        requireEmployeeId
      })
      toast({ title: "Success", description: "QR Link generated." })
      setModalOpen(false)
      setSelectedCompanyId("")
      setSelectedBuildingId("")
      setSelectedCafeId("")
      setRequireName(false)
      setRequireEmail(false)
      setRequireEmployeeId(false)
      fetchLinks()
    } catch (e) {
      toast({ title: "Error", description: "Failed to create link.", variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  const openEditModal = (link: QRLink) => {
    setEditLink(link)
    setEditRequireName(!!link.requireName)
    setEditRequireEmail(!!link.requireEmail)
    setEditRequireEmployeeId(!!link.requireEmployeeId)
    setEditModalOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editLink) return
    setSaving(true)
    try {
      await qrLinksService.update(editLink.id, {
        requireName: editRequireName,
        requireEmail: editRequireEmail,
        requireEmployeeId: editRequireEmployeeId
      })
      toast({ title: "Saved!", description: "Field settings updated successfully." })
      setEditModalOpen(false)
      setEditLink(null)
      // Update local state immediately for instant feedback
      setLinks(prev => prev.map(l => l.id === editLink.id
        ? { ...l, requireName: editRequireName, requireEmail: editRequireEmail, requireEmployeeId: editRequireEmployeeId }
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

  const downloadQR = (linkId: string, name: string) => {
    const svg = document.getElementById(`qr-${linkId}`)
    if (!svg) return
    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    const img = new Image()
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx?.drawImage(img, 0, 0)
      const pngFile = canvas.toDataURL("image/png")
      const downloadLink = document.createElement("a")
      downloadLink.download = `QR-Complaint-${name.replace(/[^a-z0-9]/gi, '_')}.png`
      downloadLink.href = `${pngFile}`
      downloadLink.click()
    }
    img.src = "data:image/svg+xml;base64," + btoa(svgData)
  }

  const filteredBuildings = buildings.filter(b => b.companyId === selectedCompanyId)
  const filteredCafes = cafeterias.filter(c => c.buildingId === selectedBuildingId || c.companyId === selectedCompanyId)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <QrCode className="h-6 w-6 text-blue-600" /> Public Complaint QR Links
          </h1>
          <p className="text-gray-500">Generate public QR codes for capturing tickets from specific locations.</p>
        </div>
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Generate New Link
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate New QR Link</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
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
              <div className="pt-4 border-t space-y-4">
                <h4 className="text-sm font-semibold">Form Requirements</h4>
                <div className="flex items-center space-x-2">
                  <Checkbox id="req-name" checked={requireName} onCheckedChange={(c) => setRequireName(!!c)} />
                  <label htmlFor="req-name" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Require Name
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="req-email" checked={requireEmail} onCheckedChange={(c) => setRequireEmail(!!c)} />
                  <label htmlFor="req-email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Require Contact Number / Email
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="req-emp-id" checked={requireEmployeeId} onCheckedChange={(c) => setRequireEmployeeId(!!c)} />
                  <label htmlFor="req-emp-id" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Require Employee ID
                  </label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={creating || !selectedCompanyId || !selectedBuildingId || !selectedCafeId}>
                {creating ? "Generating..." : "Generate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Edit Fields Modal ─────────────────────────────────────────────── */}
      <Dialog open={editModalOpen} onOpenChange={(o) => { if (!o) setEditLink(null); setEditModalOpen(o) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Settings2 className="w-5 h-5 text-blue-600" />
              Edit Form Fields
            </DialogTitle>
          </DialogHeader>

          {editLink && (
            <div className="py-4 space-y-6">
              {/* Link context */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-1">
                <p className="font-bold text-slate-800 text-base">{editLink.cafeName}</p>
                <p className="text-sm text-slate-500 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  {editLink.companyName} · {editLink.buildingName}
                </p>
              </div>

              {/* Toggle fields */}
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Enable Fields on Form</p>

                {/* Name */}
                <div className="flex items-center justify-between py-4 px-4 rounded-xl bg-white border border-slate-100 hover:border-slate-200 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                      <User className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Name</p>
                      <p className="text-[11px] text-slate-400">Require guest to enter their name</p>
                    </div>
                  </div>
                  <ToggleSwitch enabled={editRequireName} onChange={setEditRequireName} />
                </div>

                {/* Contact / Email */}
                <div className="flex items-center justify-between py-4 px-4 rounded-xl bg-white border border-slate-100 hover:border-slate-200 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                      <Mail className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Contact / Email</p>
                      <p className="text-[11px] text-slate-400">Require phone number or email for follow-up</p>
                    </div>
                  </div>
                  <ToggleSwitch enabled={editRequireEmail} onChange={setEditRequireEmail} />
                </div>

                {/* Employee ID */}
                <div className="flex items-center justify-between py-4 px-4 rounded-xl bg-white border border-slate-100 hover:border-slate-200 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                      <IdCard className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Employee ID</p>
                      <p className="text-[11px] text-slate-400">Require company employee identification</p>
                    </div>
                  </div>
                  <ToggleSwitch enabled={editRequireEmployeeId} onChange={setEditRequireEmployeeId} />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditModalOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving} className="gap-2 bg-blue-600 hover:bg-blue-700">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : "Save Changes"}
            </Button>
          </DialogFooter>
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
                  <FieldBadge enabled={!!link.requireName} label="Name" />
                  <FieldBadge enabled={!!link.requireEmail} label="Contact" />
                  <FieldBadge enabled={!!link.requireEmployeeId} label="Emp ID" />
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
                  <Button className="w-full gap-2" variant="secondary" onClick={() => downloadQR(link.id, link.cafeName)}>
                    <Download className="w-4 h-4" /> Download QR
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
