"use client"
import { useState, useEffect } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, Plus, Link as LinkIcon, Trash2, MapPin, Building2, Ticket, QrCode } from "lucide-react"
import { qrLinksService, QRLink } from "@/lib/firestore/qrLinksService"
import { companiesService, buildingsService, Company, Building } from "@/lib/firestore"
import { cafeteriasService, Cafeteria } from "@/lib/firestore/cafeteriasService"
import { toast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"

export default function QRLinksPage() {
  const [links, setLinks] = useState<QRLink[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const { user } = useAuth()
  
  // Data for selectors
  const [companies, setCompanies] = useState<Company[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [cafeterias, setCafeterias] = useState<Cafeteria[]>([])

  // Form State
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("")
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("")
  const [selectedCafeId, setSelectedCafeId] = useState<string>("")
  const [creating, setCreating] = useState(false)

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
        createdByName: user?.displayName || 'Admin'
      })
      toast({ title: "Success", description: "QR Link generated." })
      setModalOpen(false)
      setSelectedCompanyId("")
      setSelectedBuildingId("")
      setSelectedCafeId("")
      fetchLinks()
    } catch (e) {
      toast({ title: "Error", description: "Failed to create link.", variant: "destructive" })
    } finally {
      setCreating(false)
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
              <div key={link.id} className="bg-white border rounded-lg shadow-sm p-5 space-y-4 flex flex-col relative">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{link.cafeName}</h3>
                    <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                      <Building2 className="w-3.5 h-3.5" /> {link.companyName} - {link.buildingName}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(link.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="flex justify-center py-4 bg-gray-50 rounded-md border border-dashed">
                  <QRCodeSVG 
                    id={`qr-${link.id}`}
                    value={url} 
                    size={160} 
                    level="H"
                    includeMargin={true}
                  />
                </div>

                <div className="mt-auto space-y-3">
                  <div className="flex items-center gap-2">
                    <Input readOnly value={url} className="text-xs font-mono bg-gray-50 h-8" />
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
