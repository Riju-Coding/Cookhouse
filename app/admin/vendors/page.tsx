"use client"

import { useState, useEffect } from "react"
import { vendorsService, type Vendor } from "@/lib/firestore"
import { toast } from "@/hooks/use-toast"

// Icons
import { 
  ChevronDown, 
  ChevronRight, 
  Plus, 
  MoreHorizontal, 
  Pencil, 
  Trash2, 
  ChefHat,
  MapPin,
  Star,
  CreditCard,
  Building,
  Info
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const initialVendorState = {
  name: "",
  email: "",
  phone: "",
  contactPerson: "",
  address: "",
  description: "",
  status: "active",
  registrationNumber: "",
  gstNumber: "",
  serviceAreas: "", // Form input as string
  cuisineTypes: "", // Form input as string
  bankDetails: {
    accountName: "",
    accountNumber: "",
    ifscCode: "",
    bankName: ""
  }
}

export default function VendorManagementPage() {
  const [data, setData] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Dialog States
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState(initialVendorState)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const res = await vendorsService.getAll()
      setData(res)
    } catch (error) {
      toast({ title: "Error", description: "Failed to load vendors", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const toggleRow = (id: string) => {
    const newSet = new Set(expandedIds)
    newSet.has(id) ? newSet.delete(id) : newSet.add(id)
    setExpandedIds(newSet)
  }

  const handleOpenAdd = () => {
    setEditingId(null)
    setFormData(initialVendorState)
    setIsModalOpen(true)
  }

  const handleEdit = (vendor: Vendor) => {
    setEditingId(vendor.id)
    setFormData({
      ...vendor,
      serviceAreas: vendor.serviceAreas?.join(", ") || "",
      cuisineTypes: vendor.cuisineTypes?.join(", ") || "",
      bankDetails: vendor.bankDetails || initialVendorState.bankDetails
    } as any)
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name || !formData.email) {
      toast({ title: "Error", description: "Name and Email are required", variant: "destructive" })
      return
    }

    try {
      setIsSaving(true)
      
      // Transform strings back to arrays for Firestore
      const payload = {
        ...formData,
        serviceAreas: typeof formData.serviceAreas === 'string' 
          ? formData.serviceAreas.split(",").map(s => s.trim()).filter(s => s) 
          : [],
        cuisineTypes: typeof formData.cuisineTypes === 'string' 
          ? formData.cuisineTypes.split(",").map(s => s.trim()).filter(s => s) 
          : [],
        rating: (formData as any).rating || 0,
        totalOrders: (formData as any).totalOrders || 0,
      }

      if (editingId) {
        await vendorsService.update(editingId, payload as any)
        toast({ title: "Success", description: "Vendor updated" })
      } else {
        await vendorsService.add(payload as any)
        toast({ title: "Success", description: "Vendor created" })
      }
      
      setIsModalOpen(false)
      fetchData()
    } catch (error) {
      toast({ title: "Error", description: "Operation failed", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return
    try {
      await vendorsService.delete(id)
      toast({ title: "Success", description: "Vendor deleted" })
      fetchData()
    } catch (error) {
      toast({ title: "Error", description: "Delete failed", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-6 p-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendor Management</h1>
          <p className="text-gray-600">Manage your catering partners and their business details.</p>
        </div>
        <Button onClick={handleOpenAdd}>
          <Plus className="mr-2 h-4 w-4" /> Add Vendor
        </Button>
      </div>

      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Vendor Info</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center">Loading...</TableCell></TableRow>
            ) : data.map((vendor) => {
              const isExpanded = expandedIds.has(vendor.id)
              return (
                <React.Fragment key={vendor.id}>
                  <TableRow 
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleRow(vendor.id)}
                  >
                    <TableCell>
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-blue-600">{vendor.name}</div>
                      <div className="text-xs text-gray-500">{vendor.email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{vendor.contactPerson}</div>
                      <div className="text-xs text-gray-400">{vendor.phone}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-bold">{vendor.rating}</span>
                        <span className="text-[10px] text-gray-400">({vendor.totalOrders} orders)</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={vendor.status === 'active' ? 'default' : 'secondary'}>{vendor.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(vendor)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(vendor.id)}><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>

                  {isExpanded && (
                    <TableRow className="bg-gray-50/50">
                      <TableCell colSpan={6} className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <Card className="shadow-none">
                            <CardContent className="pt-4 space-y-2">
                              <h4 className="text-xs font-bold uppercase text-gray-400 flex items-center gap-2"><ChefHat className="h-3 w-3"/> Specialties</h4>
                              <div className="flex flex-wrap gap-1">
                                {vendor.cuisineTypes?.map(c => <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>)}
                              </div>
                              <h4 className="text-xs font-bold uppercase text-gray-400 pt-2 flex items-center gap-2"><MapPin className="h-3 w-3"/> Service Areas</h4>
                              <div className="flex flex-wrap gap-1">
                                {vendor.serviceAreas?.map(a => <Badge key={a} variant="secondary" className="text-[10px] bg-blue-100 text-blue-700 border-none">{a}</Badge>)}
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="shadow-none border-blue-100 bg-blue-50/30">
                            <CardContent className="pt-4 space-y-2">
                              <h4 className="text-xs font-bold uppercase text-blue-500 flex items-center gap-2"><CreditCard className="h-3 w-3"/> Bank Details</h4>
                              <div className="text-xs"><strong>Bank:</strong> {vendor.bankDetails?.bankName}</div>
                              <div className="text-xs"><strong>A/C:</strong> {vendor.bankDetails?.accountNumber}</div>
                              <div className="text-xs"><strong>IFSC:</strong> {vendor.bankDetails?.ifscCode}</div>
                              <div className="text-xs"><strong>Name:</strong> {vendor.bankDetails?.accountName}</div>
                            </CardContent>
                          </Card>

                          <Card className="shadow-none">
                            <CardContent className="pt-4 space-y-2">
                              <h4 className="text-xs font-bold uppercase text-gray-400 flex items-center gap-2"><Info className="h-3 w-3"/> Business Info</h4>
                              <div className="text-xs text-gray-600 italic">"{vendor.description}"</div>
                              <div className="text-xs pt-2"><strong>GST:</strong> {vendor.gstNumber}</div>
                              <div className="text-xs"><strong>Reg No:</strong> {vendor.registrationNumber}</div>
                            </CardContent>
                          </Card>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Vendor" : "New Vendor Registration"}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">Contact Info</TabsTrigger>
              <TabsTrigger value="business">Business</TabsTrigger>
              <TabsTrigger value="bank">Banking</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vendor Name *</Label>
                  <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Contact Person</Label>
                  <Input value={formData.contactPerson} onChange={e => setFormData({...formData, contactPerson: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Full Address</Label>
                  <Textarea value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="business" className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>GST Number</Label>
                  <Input value={formData.gstNumber} onChange={e => setFormData({...formData, gstNumber: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Registration Number</Label>
                  <Input value={formData.registrationNumber} onChange={e => setFormData({...formData, registrationNumber: e.target.value})} />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Cuisines (comma separated)</Label>
                  <Input value={formData.cuisineTypes} placeholder="Indian, Chinese, Continental" onChange={e => setFormData({...formData, cuisineTypes: e.target.value})} />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Service Areas (comma separated)</Label>
                  <Input value={formData.serviceAreas} placeholder="Gurugram, Delhi, Noida" onChange={e => setFormData({...formData, serviceAreas: e.target.value})} />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Short Description</Label>
                  <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="bank" className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 rounded-lg border p-4 bg-gray-50/50">
                <div className="space-y-2">
                  <Label>Bank Name</Label>
                  <Input value={formData.bankDetails.bankName} onChange={e => setFormData({...formData, bankDetails: {...formData.bankDetails, bankName: e.target.value}})} />
                </div>
                <div className="space-y-2">
                  <Label>IFSC Code</Label>
                  <Input value={formData.bankDetails.ifscCode} onChange={e => setFormData({...formData, bankDetails: {...formData.bankDetails, ifscCode: e.target.value}})} />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Account Name</Label>
                  <Input value={formData.bankDetails.accountName} onChange={e => setFormData({...formData, bankDetails: {...formData.bankDetails, accountName: e.target.value}})} />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Account Number</Label>
                  <Input value={formData.bankDetails.accountNumber} onChange={e => setFormData({...formData, bankDetails: {...formData.bankDetails, accountNumber: e.target.value}})} />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : editingId ? "Update Vendor" : "Create Vendor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Add this at the top of your file to avoid React is not defined error in some environments
import React from "react"