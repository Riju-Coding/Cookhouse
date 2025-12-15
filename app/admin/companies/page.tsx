"use client"

import { useState, useEffect } from "react"
import { companiesService, buildingsService, type Company, type Building } from "@/lib/firestore"
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
  MapPin
} from "lucide-react"

// UI Components
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
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
  const [loading, setLoading] = useState(true)
  const [expandedCompanyIds, setExpandedCompanyIds] = useState<Set<string>>(new Set())

  // Dialog States
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false)
  const [isBuildingModalOpen, setIsBuildingModalOpen] = useState(false)
  
  // Form Data States
  const [companyFormData, setCompanyFormData] = useState(initialCompanyState)
  const [buildingFormData, setBuildingFormData] = useState(initialBuildingState)
  
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
      const [companiesRes, buildingsRes] = await Promise.all([
        companiesService.getAll(),
        buildingsService.getAll()
      ])

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

  // --- EXPAND/COLLAPSE LOGIC ---
  const toggleRow = (companyId: string) => {
    const newSet = new Set(expandedCompanyIds)
    if (newSet.has(companyId)) {
      newSet.delete(companyId)
    } else {
      newSet.add(companyId)
    }
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

  // *** FIXED SAVE HANDLER ***
  const handleSaveCompany = async () => {
    if (!companyFormData.name || !companyFormData.code) {
        toast({ title: "Error", description: "Name and Code are required", variant: "destructive" })
        return
    }

    try {
      setIsSaving(true)
      
      if (editingCompanyId) {
        // --- UPDATE MODE ---
        await companiesService.update(editingCompanyId, companyFormData)
        toast({ title: "Success", description: "Company updated" })
        setIsCompanyModalOpen(false)
        await fetchData()
      } else {
        // --- CREATE MODE ---
        // 1. Add company
        await companiesService.add(companyFormData)
        toast({ title: "Success", description: "Company created" })
        
        // 2. Close the company modal immediately
        setIsCompanyModalOpen(false)

        // 3. Fetch latest data to ensure we have the new ID
        const result = await fetchData() // This refreshes the table
        
        if (result && result.companiesRes) {
            // 4. Find the company we just created using the unique CODE
            const newCompany = result.companiesRes.find(c => c.code === companyFormData.code)
            
            if (newCompany) {
                // 5. Set target and Open Building Modal
                setTargetCompanyForBuilding(newCompany)
                
                // Set timeout to allow UI to settle (Company modal fade out -> Building modal fade in)
                setTimeout(() => {
                    setBuildingFormData(initialBuildingState)
                    setIsBuildingModalOpen(true)
                }, 500)
            }
        }
      }
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Operation failed", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteCompany = async (id: string) => {
    if(!confirm("Are you sure? This will delete the company and potentially orphan its buildings.")) return
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
    if (!buildingFormData.name || !buildingFormData.code) {
        toast({ title: "Error", description: "Building Name and Code are required", variant: "destructive" })
        return
    }

    try {
      setIsSaving(true)
      const payload = {
        ...buildingFormData,
        companyId: targetCompanyForBuilding.id,
        capacity: Number(buildingFormData.capacity) || 0
      }
      
      await buildingsService.add(payload as any)
      toast({ title: "Success", description: `Building added to ${targetCompanyForBuilding.name}` })
      
      // Auto-expand the company row so user sees the new building
      setExpandedCompanyIds(prev => new Set(prev).add(targetCompanyForBuilding.id))
      
      // Refresh list to show new building
      await fetchData()

      if (addAnother) {
        setBuildingFormData(initialBuildingState)
      } else {
        setIsBuildingModalOpen(false)
        setTargetCompanyForBuilding(null)
      }
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Failed to add building", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteBuilding = async (id: string) => {
    if(!confirm("Delete this building?")) return
    try {
      await buildingsService.delete(id)
      toast({ title: "Success", description: "Building deleted" })
      fetchData()
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-6 p-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Companies & Buildings</h1>
          <p className="text-gray-600">Manage companies and their associated buildings in one view.</p>
        </div>
        <Button onClick={handleOpenAddCompany}>
          <Plus className="mr-2 h-4 w-4" /> Add Company
        </Button>
      </div>

      <div className="rounded-md border bg-white shadow-sm">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Company Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
               <TableRow>
                 <TableCell colSpan={6} className="h-24 text-center">Loading data...</TableCell>
               </TableRow>
            ) : data.length === 0 ? (
                <TableRow>
                 <TableCell colSpan={6} className="h-24 text-center">No companies found.</TableCell>
               </TableRow>
            ) : (
              data.map((company) => {
                const isExpanded = expandedCompanyIds.has(company.id)
                return (
                  <>
                    {/* Main Company Row */}
                    <TableRow 
                        key={company.id} 
                        className={`cursor-pointer transition-colors hover:bg-gray-50 ${isExpanded ? "bg-gray-50" : ""}`}
                        onClick={() => toggleRow(company.id)}
                    >
                      <TableCell>
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                      </TableCell>
                      <TableCell className="font-medium">
                        {company.name}
                        <div className="text-xs text-gray-500">{company.buildings.length} Buildings</div>
                      </TableCell>
                      <TableCell>{company.code}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                            <span className="text-sm">{company.contactPerson}</span>
                            <span className="text-xs text-gray-400">{company.phone}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={company.status === 'active' ? 'default' : 'secondary'}>
                            {company.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenAddBuilding(company); }}>
                                <Building2 className="mr-2 h-4 w-4" /> Add Building
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditCompany(company); }}>
                                <Pencil className="mr-2 h-4 w-4" /> Edit Company
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                                className="text-red-600 focus:text-red-600"
                                onClick={(e) => { e.stopPropagation(); handleDeleteCompany(company.id); }}
                            >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete Company
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>

                    {/* Expanded Building View */}
                    {isExpanded && (
                      <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                        <TableCell colSpan={6} className="p-4 sm:pl-14">
                            <Card className="border-gray-200 shadow-sm">
                                <CardContent className="p-0">
                                    <div className="flex items-center justify-between border-b p-4 bg-white rounded-t-lg">
                                        <h3 className="font-semibold flex items-center gap-2 text-sm text-gray-700">
                                            <Building2 className="h-4 w-4" />
                                            Buildings for {company.name}
                                        </h3>
                                        <Button size="sm" variant="outline" onClick={() => handleOpenAddBuilding(company)}>
                                            <Plus className="mr-2 h-3 w-3" /> New Building
                                        </Button>
                                    </div>
                                    
                                    {company.buildings.length > 0 ? (
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="border-b-0">
                                                    <TableHead className="text-xs">Name</TableHead>
                                                    <TableHead className="text-xs">Code</TableHead>
                                                    <TableHead className="text-xs">Address</TableHead>
                                                    <TableHead className="text-xs">Capacity</TableHead>
                                                    <TableHead className="text-xs text-right">Action</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {company.buildings.map(b => (
                                                    <TableRow key={b.id} className="border-b-0 hover:bg-gray-50">
                                                        <TableCell className="py-2 text-sm font-medium">{b.name}</TableCell>
                                                        <TableCell className="py-2 text-sm text-gray-500">{b.code}</TableCell>
                                                        <TableCell className="py-2 text-sm text-gray-500 truncate max-w-[200px]">
                                                            <div className="flex items-center gap-1">
                                                                <MapPin className="h-3 w-3" /> {b.address}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-2 text-sm text-gray-500">{b.capacity}</TableCell>
                                                        <TableCell className="py-2 text-right">
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm" 
                                                                className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                onClick={() => handleDeleteBuilding(b.id)}
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    ) : (
                                        <div className="p-8 text-center text-gray-500 text-sm">
                                            No buildings added yet. 
                                            <button 
                                                className="ml-1 text-blue-600 hover:underline"
                                                onClick={() => handleOpenAddBuilding(company)}
                                            >
                                                Add one now
                                            </button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* --- MODAL: COMPANY --- */}
      <Dialog open={isCompanyModalOpen} onOpenChange={setIsCompanyModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{editingCompanyId ? "Edit Company" : "Add Company"}</DialogTitle>
                <DialogDescription>Enter company details below.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Name *</Label>
                    <Input value={companyFormData.name} onChange={e => setCompanyFormData({...companyFormData, name: e.target.value})} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Code *</Label>
                    <Input value={companyFormData.code} onChange={e => setCompanyFormData({...companyFormData, code: e.target.value})} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Phone</Label>
                    <Input value={companyFormData.phone} onChange={e => setCompanyFormData({...companyFormData, phone: e.target.value})} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Email</Label>
                    <Input value={companyFormData.email} onChange={e => setCompanyFormData({...companyFormData, email: e.target.value})} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Contact</Label>
                    <Input value={companyFormData.contactPerson} onChange={e => setCompanyFormData({...companyFormData, contactPerson: e.target.value})} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Address</Label>
                    <Textarea value={companyFormData.address} onChange={e => setCompanyFormData({...companyFormData, address: e.target.value})} className="col-span-3" />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsCompanyModalOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveCompany} disabled={isSaving}>Save</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- MODAL: BUILDING --- */}
      <Dialog open={isBuildingModalOpen} onOpenChange={setIsBuildingModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Add Building</DialogTitle>
                <DialogDescription>
                    Adding building for: <span className="font-semibold text-black">{targetCompanyForBuilding?.name}</span>
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Name *</Label>
                    <Input value={buildingFormData.name} onChange={e => setBuildingFormData({...buildingFormData, name: e.target.value})} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Code *</Label>
                    <Input value={buildingFormData.code} onChange={e => setBuildingFormData({...buildingFormData, code: e.target.value})} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Address</Label>
                    <Textarea value={buildingFormData.address} onChange={e => setBuildingFormData({...buildingFormData, address: e.target.value})} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Floor</Label>
                    <Input value={buildingFormData.floor} onChange={e => setBuildingFormData({...buildingFormData, floor: e.target.value})} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Capacity</Label>
                    <Input type="number" value={buildingFormData.capacity} onChange={e => setBuildingFormData({...buildingFormData, capacity: e.target.value})} className="col-span-3" />
                </div>
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