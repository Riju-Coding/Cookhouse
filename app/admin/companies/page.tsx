"use client"

import { useState, useEffect } from "react"
import { 
  companiesService, 
  buildingsService, 
  vendorsService, // Added this
  type Company, 
  type Building,
  type Vendor // Added this
} from "@/lib/firestore"
import { toast } from "@/hooks/use-toast"

// Icons
import { 
  ChevronDown, 
  ChevronRight, 
  Plus, 
  MoreHorizontal, 
  Pencil, 
  Trash2, 
  Building2,
  MapPin,
  UserPlus,
  CheckCircle2
} from "lucide-react"

// UI Components
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox" // Ensure you have this shadcn component
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"

// --- TYPES ---
type CompanyWithBuildings = Company & {
  buildings: Building[]
}

// --- INITIAL STATES ---
const initialCompanyState = {
  name: "",
  code: "",
  address: "",
  phone: "",
  email: "",
  contactPerson: "",
  status: "active",
}

const initialBuildingState = {
  name: "",
  code: "",
  address: "",
  floor: "",
  capacity: 0,
  status: "active",
}

export default function CompaniesPage() {
  const [data, setData] = useState<CompanyWithBuildings[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([]) // Store available vendors
  const [loading, setLoading] = useState(true)
  const [expandedCompanyIds, setExpandedCompanyIds] = useState<Set<string>>(new Set())
  
  // Selection State
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set())

  // Dialog States
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false)
  const [isBuildingModalOpen, setIsBuildingModalOpen] = useState(false)
  const [isAssignVendorModalOpen, setIsAssignVendorModalOpen] = useState(false)
  
  // Form Data States
  const [companyFormData, setCompanyFormData] = useState(initialCompanyState)
  const [buildingFormData, setBuildingFormData] = useState(initialBuildingState)
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([])
  
  // Editing / Target States
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null)
  const [targetCompanyForBuilding, setTargetCompanyForBuilding] = useState<Company | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  // --- DATA FETCHING ---
  const fetchData = async () => {
    try {
      setLoading(true)
      const [companiesRes, buildingsRes, vendorsRes] = await Promise.all([
        companiesService.getAll(),
        buildingsService.getAll(),
        vendorsService.getAll() // Fetch vendors
      ])

      setVendors(vendorsRes as Vendor[])

      const mergedData = companiesRes.map(company => ({
        ...company,
        buildings: buildingsRes.filter(b => b.companyId === company.id)
      }))

      setData(mergedData)
      return { companiesRes, buildingsRes, mergedData }
    } catch (error) {
      console.error("Error fetching data:", error)
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" })
      return null
    } finally {
      setLoading(false)
    }
  }

  // --- SELECTION LOGIC ---
  const toggleSelectAll = () => {
    if (selectedCompanyIds.size === data.length) {
      setSelectedCompanyIds(new Set())
    } else {
      setSelectedCompanyIds(new Set(data.map(c => c.id)))
    }
  }

  const toggleSelectCompany = (id: string) => {
    const newSet = new Set(selectedCompanyIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedCompanyIds(newSet)
  }

  // --- VENDOR ASSIGNMENT HANDLER ---
  const handleOpenAssignVendors = () => {
    if (selectedCompanyIds.size === 0) {
      toast({ title: "Selection Required", description: "Please select at least one company." })
      return
    }
    setSelectedVendorIds([])
    setIsAssignVendorModalOpen(true)
  }

  const handleSaveVendorAssignment = async () => {
    if (selectedVendorIds.length === 0) {
        toast({ title: "Error", description: "Select at least one vendor", variant: "destructive" })
        return
    }

    try {
      setIsSaving(true)
      const updatePromises = Array.from(selectedCompanyIds).map(companyId => 
        companiesService.update(companyId, { vendorIds: selectedVendorIds } as any)
      )

      await Promise.all(updatePromises)
      toast({ title: "Success", description: `Assigned vendors to ${selectedCompanyIds.size} companies.` })
      setIsAssignVendorModalOpen(false)
      setSelectedCompanyIds(new Set())
      fetchData()
    } catch (error) {
      toast({ title: "Error", description: "Failed to assign vendors", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  // --- EXPAND/COLLAPSE LOGIC ---
  const toggleRow = (companyId: string) => {
    const newSet = new Set(expandedCompanyIds)
    if (newSet.has(companyId)) newSet.delete(companyId)
    else newSet.add(companyId)
    setExpandedCompanyIds(newSet)
  }

  // --- COMPANY HANDLERS ---
  const handleOpenAddCompany = () => {
    setEditingCompanyId(null)
    setCompanyFormData(initialCompanyState)
    setIsCompanyModalOpen(true)
  }

  const handleEditCompany = (company: Company) => {
    setEditingCompanyId(company.id)
    setCompanyFormData({
      name: company.name || "",
      code: company.code || "",
      address: company.address || "",
      phone: company.phone || "",
      email: company.email || "",
      contactPerson: company.contactPerson || "",
      status: company.status || "active",
    })
    setIsCompanyModalOpen(true)
  }

  const handleSaveCompany = async () => {
    if (!companyFormData.name || !companyFormData.code) {
        toast({ title: "Error", description: "Name and Code are required", variant: "destructive" })
        return
    }

    try {
      setIsSaving(true)
      if (editingCompanyId) {
        await companiesService.update(editingCompanyId, companyFormData)
        toast({ title: "Success", description: "Company updated" })
        setIsCompanyModalOpen(false)
        await fetchData()
      } else {
        await companiesService.add(companyFormData)
        toast({ title: "Success", description: "Company created" })
        setIsCompanyModalOpen(false)
        const result = await fetchData()
        if (result && result.companiesRes) {
            const newCompany = result.companiesRes.find(c => c.code === companyFormData.code)
            if (newCompany) {
                setTargetCompanyForBuilding(newCompany)
                setTimeout(() => {
                    setBuildingFormData(initialBuildingState)
                    setIsBuildingModalOpen(true)
                }, 500)
            }
        }
      }
    } catch (error) {
      toast({ title: "Error", description: "Operation failed", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteCompany = async (id: string) => {
    if(!confirm("Are you sure?")) return
    try {
      await companiesService.delete(id)
      toast({ title: "Success", description: "Company deleted" })
      fetchData()
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" })
    }
  }

  // --- BUILDING HANDLERS ---
  const handleOpenAddBuilding = (company: Company) => {
    setTargetCompanyForBuilding(company)
    setBuildingFormData(initialBuildingState)
    setIsBuildingModalOpen(true)
  }

  const handleSaveBuilding = async (addAnother: boolean) => {
    if (!targetCompanyForBuilding) return
    try {
      setIsSaving(true)
      const payload = { ...buildingFormData, companyId: targetCompanyForBuilding.id, capacity: Number(buildingFormData.capacity) || 0 }
      await buildingsService.add(payload as any)
      toast({ title: "Success", description: `Building added` })
      setExpandedCompanyIds(prev => new Set(prev).add(targetCompanyForBuilding.id))
      await fetchData()
      if (addAnother) setBuildingFormData(initialBuildingState)
      else { setIsBuildingModalOpen(false); setTargetCompanyForBuilding(null); }
    } catch (error) {
      toast({ title: "Error", description: "Failed to add building", variant: "destructive" })
    } finally { setIsSaving(false) }
  }

  const handleDeleteBuilding = async (id: string) => {
    if(!confirm("Delete this building?")) return
    try {
      await buildingsService.delete(id)
      toast({ title: "Success", description: "Building deleted" })
      fetchData()
    } catch (error) { toast({ title: "Error", description: "Failed to delete", variant: "destructive" }) }
  }

  return (
    <div className="space-y-6 p-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Companies & Buildings</h1>
          <p className="text-gray-600">Manage companies, buildings, and assign vendors.</p>
        </div>
        <div className="flex gap-2">
            {selectedCompanyIds.size > 0 && (
                <Button variant="outline" className="border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100" onClick={handleOpenAssignVendors}>
                    <UserPlus className="mr-2 h-4 w-4" /> Assign Vendor ({selectedCompanyIds.size})
                </Button>
            )}
            <Button onClick={handleOpenAddCompany}>
                <Plus className="mr-2 h-4 w-4" /> Add Company
            </Button>
        </div>
      </div>

      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox 
                    checked={selectedCompanyIds.size === data.length && data.length > 0} 
                    onCheckedChange={toggleSelectAll} 
                />
              </TableHead>
              <TableHead className="w-[30px]"></TableHead>
              <TableHead>Company Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Assigned Vendors</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
               <TableRow><TableCell colSpan={7} className="h-24 text-center">Loading data...</TableCell></TableRow>
            ) : data.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center">No companies found.</TableCell></TableRow>
            ) : (
              data.map((company) => {
                const isExpanded = expandedCompanyIds.has(company.id)
                const isSelected = selectedCompanyIds.has(company.id)
                // Match vendor IDs to names for the badge display
                const assignedVendors = vendors.filter(v => (company as any).vendorIds?.includes(v.id))

                return (
                  <React.Fragment key={company.id}>
                    <TableRow className={`hover:bg-gray-50 ${isExpanded ? "bg-gray-50" : ""} ${isSelected ? "bg-blue-50/50" : ""}`}>
                      <TableCell>
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleSelectCompany(company.id)} />
                      </TableCell>
                      <TableCell onClick={() => toggleRow(company.id)} className="cursor-pointer">
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                      </TableCell>
                      <TableCell className="font-medium cursor-pointer" onClick={() => toggleRow(company.id)}>
                        {company.name}
                        <div className="text-xs text-gray-500">{company.buildings.length} Buildings</div>
                      </TableCell>
                      <TableCell>{company.code}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                            {assignedVendors.length > 0 ? (
                                assignedVendors.map(v => <Badge key={v.id} variant="secondary" className="text-[10px] bg-green-50 text-green-700 border-green-200">{v.name}</Badge>)
                            ) : (
                                <span className="text-xs text-gray-400 italic">None assigned</span>
                            )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={company.status === 'active' ? 'default' : 'secondary'}>{company.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenAddBuilding(company)}><Building2 className="mr-2 h-4 w-4" /> Add Building</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedCompanyIds(new Set([company.id])); handleOpenAssignVendors(); }}><UserPlus className="mr-2 h-4 w-4" /> Assign Vendor</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleEditCompany(company)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteCompany(company.id)}><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow className="bg-gray-50/50">
                        <TableCell colSpan={7} className="p-4 sm:pl-20">
                            <Card className="border-gray-200 shadow-sm">
                                <CardContent className="p-0">
                                    <div className="flex items-center justify-between border-b p-4 bg-white rounded-t-lg">
                                        <h3 className="font-semibold flex items-center gap-2 text-sm text-gray-700"><Building2 className="h-4 w-4" /> Buildings for {company.name}</h3>
                                        <Button size="sm" variant="outline" onClick={() => handleOpenAddBuilding(company)}><Plus className="mr-2 h-3 w-3" /> New Building</Button>
                                    </div>
                                    {company.buildings.length > 0 ? (
                                        <Table>
                                            <TableHeader><TableRow className="border-b-0"><TableHead className="text-xs">Name</TableHead><TableHead className="text-xs">Code</TableHead><TableHead className="text-xs">Capacity</TableHead><TableHead className="text-xs text-right">Action</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {company.buildings.map(b => (
                                                    <TableRow key={b.id} className="border-b-0 hover:bg-gray-50">
                                                        <TableCell className="py-2 text-sm font-medium">{b.name}</TableCell>
                                                        <TableCell className="py-2 text-sm text-gray-500">{b.code}</TableCell>
                                                        <TableCell className="py-2 text-sm text-gray-500">{b.capacity}</TableCell>
                                                        <TableCell className="py-2 text-right"><Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:bg-red-50" onClick={() => handleDeleteBuilding(b.id)}><Trash2 className="h-3 w-3" /></Button></TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    ) : ( <div className="p-8 text-center text-gray-500 text-sm">No buildings.</div> )}
                                </CardContent>
                            </Card>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* --- MODAL: ASSIGN VENDORS --- */}
      <Dialog open={isAssignVendorModalOpen} onOpenChange={setIsAssignVendorModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Assign Vendors</DialogTitle>
            <DialogDescription>Select catering vendors to assign to {selectedCompanyIds.size} companies.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <ScrollArea className="h-[200px] w-full rounded-md border p-4">
              {vendors.map((vendor) => (
                <div key={vendor.id} className="flex items-center space-x-3 mb-4 last:mb-0">
                  <Checkbox 
                    id={`v-${vendor.id}`} 
                    checked={selectedVendorIds.includes(vendor.id)}
                    onCheckedChange={(checked) => {
                        if (checked) setSelectedVendorIds([...selectedVendorIds, vendor.id])
                        else setSelectedVendorIds(selectedVendorIds.filter(id => id !== vendor.id))
                    }}
                  />
                  <Label htmlFor={`v-${vendor.id}`} className="text-sm font-medium leading-none cursor-pointer">
                    {vendor.name}
                    <p className="text-[10px] text-gray-400 font-normal">{vendor.cuisineTypes?.join(", ")}</p>
                  </Label>
                </div>
              ))}
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignVendorModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveVendorAssignment} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- MODAL: COMPANY & BUILDING --- (Existing code remains same) */}
      <Dialog open={isCompanyModalOpen} onOpenChange={setIsCompanyModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{editingCompanyId ? "Edit Company" : "Add Company"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">Name *</Label><Input value={companyFormData.name} onChange={e => setCompanyFormData({...companyFormData, name: e.target.value})} className="col-span-3" /></div>
                <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">Code *</Label><Input value={companyFormData.code} onChange={e => setCompanyFormData({...companyFormData, code: e.target.value})} className="col-span-3" /></div>
                <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">Phone</Label><Input value={companyFormData.phone} onChange={e => setCompanyFormData({...companyFormData, phone: e.target.value})} className="col-span-3" /></div>
                <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">Email</Label><Input value={companyFormData.email} onChange={e => setCompanyFormData({...companyFormData, email: e.target.value})} className="col-span-3" /></div>
                <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">Contact</Label><Input value={companyFormData.contactPerson} onChange={e => setCompanyFormData({...companyFormData, contactPerson: e.target.value})} className="col-span-3" /></div>
                <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">Address</Label><Textarea value={companyFormData.address} onChange={e => setCompanyFormData({...companyFormData, address: e.target.value})} className="col-span-3" /></div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsCompanyModalOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveCompany} disabled={isSaving}>Save</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBuildingModalOpen} onOpenChange={setIsBuildingModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Add Building</DialogTitle>
                <DialogDescription>Adding building for: <span className="font-semibold text-black">{targetCompanyForBuilding?.name}</span></DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">Name *</Label><Input value={buildingFormData.name} onChange={e => setBuildingFormData({...buildingFormData, name: e.target.value})} className="col-span-3" /></div>
                <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">Code *</Label><Input value={buildingFormData.code} onChange={e => setBuildingFormData({...buildingFormData, code: e.target.value})} className="col-span-3" /></div>
                <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">Address</Label><Textarea value={buildingFormData.address} onChange={e => setBuildingFormData({...buildingFormData, address: e.target.value})} className="col-span-3" /></div>
                <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">Floor</Label><Input value={buildingFormData.floor} onChange={e => setBuildingFormData({...buildingFormData, floor: e.target.value})} className="col-span-3" /></div>
                <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">Capacity</Label><Input type="number" value={buildingFormData.capacity} onChange={e => setBuildingFormData({...buildingFormData, capacity: e.target.value})} className="col-span-3" /></div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsBuildingModalOpen(false)}>Cancel</Button>
                <Button variant="secondary" onClick={() => handleSaveBuilding(true)} disabled={isSaving}>Save & Add Another</Button>
                <Button onClick={() => handleSaveBuilding(false)} disabled={isSaving}>Save & Finish</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

import React from "react"