"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { db } from "@/lib/firebase"
import { collection, getDocs } from "firebase/firestore"
import { complianceFormsService, type ComplianceForm } from "@/lib/firestore/complianceFormsService"
import { complianceSubFormsService } from "@/lib/firestore/complianceSubFormsService"
import { toast } from "@/hooks/use-toast"

// Icons - ADDED ListChecks here
import { Plus, Pencil, Trash2, Ban, CheckCircle, ClipboardList, ListChecks } from "lucide-react"

// UI Components
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function ComplianceManagementPage() {
  const [data, setData] = useState<ComplianceForm[]>([])
  const [loading, setLoading] = useState(true)

  // Relational data for display in table
  const [vendors, setVendors] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [buildings, setBuildings] = useState<any[]>([])
  const [cafeterias, setCafeterias] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])

  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    try {
      setLoading(true)
      const [formsRes, vSnap, cSnap, bSnap, cafSnap, rSnap] = await Promise.all([
        complianceFormsService.getAll(),
        getDocs(collection(db, 'vendors')),
        getDocs(collection(db, 'companies')),
        getDocs(collection(db, 'buildings')),
        getDocs(collection(db, 'cafetarias')),
        getDocs(collection(db, 'roles')) // Assuming roles are also fetched for `assignedRole` display
      ])

      setData(formsRes)
      setVendors(vSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setCompanies(cSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setBuildings(bSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setCafeterias(cafSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setRoles(rSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Failed to load compliance forms", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async (form: ComplianceForm) => {
    const newStatus = form.status === 'active' ? 'inactive' : 'active';
    try {
      await complianceFormsService.update(form.id, { status: newStatus });
      toast({ title: "Success", description: `Form ${newStatus === 'active' ? 'enabled' : 'disabled'}` });
      fetchInitialData(); // Re-fetch to update status in table
    } catch (error) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this compliance form and all its questions?")) return
    try {
      // First delete all subforms
      const subforms = await complianceSubFormsService.getByFormId(id);
      await Promise.all(subforms.map(sf => complianceSubFormsService.delete(sf.id)));

      // Then delete the main form
      await complianceFormsService.delete(id)
      toast({ title: "Success", description: "Compliance form deleted" })
      fetchInitialData() // Re-fetch data to update the table
    } catch (error) {
      toast({ title: "Error", description: "Delete failed", variant: "destructive" })
    }
  }

  // Helper functions for displaying names
  const getName = (arr: any[], id: string) => arr.find(item => item.id === id)?.name || <span className="text-gray-400">—</span>;

  return (
    <div className="space-y-6 p-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-blue-600" /> Compliance Forms
          </h1>
          <p className="text-gray-600">Create and manage compliance checklists for specific locations.</p>
        </div>
        <Link href="/admin/compliances/new">
          <Button><Plus className="mr-2 h-4 w-4" /> Create Form</Button>
        </Link>
      </div>

      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead>Form Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Assigned Role</TableHead>
              <TableHead>Questions</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="h-24 text-center">Loading Forms...</TableCell></TableRow>
            ) : data.length === 0 ? (
               <TableRow><TableCell colSpan={8} className="h-24 text-center text-gray-500">No compliance forms found.</TableCell></TableRow>
            ) : data.map((form) => (
              <TableRow key={form.id} className={form.status === 'inactive' ? 'bg-gray-50 text-gray-500' : ''}>
                <TableCell className="font-semibold">{form.name}</TableCell>
                <TableCell className="text-sm">
                  <div className="flex flex-col">
                    <span>{getName(companies, form.companyId)}</span>
                    <span className="text-xs text-gray-400">{getName(buildings, form.buildingId)} - {getName(cafeterias, form.cafetariaId)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{getName(vendors, form.vendorId)}</TableCell>
                <TableCell><Badge variant="outline">{form.frequency}</Badge></TableCell>
                <TableCell className="text-sm">{getName(roles, form.assignedRole)}</TableCell>
                <TableCell className="text-sm">
                  <span className="text-gray-600">—</span> 
                </TableCell>
                <TableCell>
                  <Badge variant={form.status === 'active' ? 'default' : 'secondary'}>
                    {form.status || 'active'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link href={`/admin/compliances/${form.id}`}>
                      <Button variant="ghost" className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50" title="Edit Form">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button variant="ghost" className={`h-8 w-8 p-0 ${form.status === 'active' ? 'text-orange-600 hover:text-orange-800 hover:bg-orange-50' : 'text-green-600 hover:text-green-800 hover:bg-green-50'}`} onClick={() => handleToggleStatus(form)} title={form.status === 'active' ? 'Disable Form' : 'Enable Form'}>
                      {form.status === 'active' ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50" onClick={() => handleDelete(form.id)} title="Delete Form">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}