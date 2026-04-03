"use client"

import React, { useState, useEffect } from "react"
import { permissionsService, type Permission } from "@/lib/firestore/permissionsService"
import { toast } from "@/hooks/use-toast"

// Icons
import { Plus, MoreHorizontal, Pencil, Trash2, Ban } from "lucide-react"

// UI Components
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const initialPermissionState = {
  name: "",
  key: "",
  description: "",
  pageName: "",
  status: 'active' as 'active' | 'inactive',
}

export default function PermissionManagementPage() {
  const [data, setData] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState(initialPermissionState)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const res = await permissionsService.getAll()
      setData(res)
    } catch (error) {
      toast({ title: "Error", description: "Failed to load permissions", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    const newKey = newName.trim().toUpperCase().replace(/\s+/g, '_');
    setFormData(prev => ({ ...prev, name: newName, key: newKey }));
  };
  
  const handleOpenAdd = () => {
    setEditingId(null)
    setFormData(initialPermissionState)
    setIsModalOpen(true)
  }

  const handleEdit = (permission: Permission) => {
    setEditingId(permission.id)
    setFormData({
        name: permission.name,
        key: permission.key,
        description: permission.description,
        pageName: permission.pageName,
        status: permission.status || 'active'
    })
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name || !formData.pageName) {
      toast({ title: "Error", description: "Name and Page Name are required", variant: "destructive" })
      return
    }

    try {
      setIsSaving(true)
      if (editingId) {
        await permissionsService.update(editingId, formData)
        toast({ title: "Success", description: "Permission updated" })
      } else {
        await permissionsService.add(formData)
        toast({ title: "Success", description: "Permission created" })
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
    if (!confirm("Are you sure? Deleting a permission might affect existing roles.")) return
    try {
      await permissionsService.delete(id)
      toast({ title: "Success", description: "Permission deleted" })
      fetchData()
    } catch (error) {
      toast({ title: "Error", description: "Delete failed", variant: "destructive" })
    }
  }

  const handleToggleStatus = async (permission: Permission) => {
    const newStatus = permission.status === 'active' ? 'inactive' : 'active';
    try {
      await permissionsService.update(permission.id, { status: newStatus });
      toast({ title: "Success", description: `Permission ${newStatus === 'active' ? 'enabled' : 'disabled'}` });
      fetchData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 p-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Permission Management</h1>
          <p className="text-gray-600">Create and manage system-wide permissions for roles.</p>
        </div>
        <Button onClick={handleOpenAdd}>
          <Plus className="mr-2 h-4 w-4" /> Create Permission
        </Button>
      </div>

      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead>Permission Name</TableHead>
              <TableHead>Page / Group</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="h-24 text-center">Loading...</TableCell></TableRow>
            ) : data.map((perm) => (
              <TableRow key={perm.id} className={perm.status === 'inactive' ? 'bg-gray-50 text-gray-500' : ''}>
                <TableCell className="font-semibold">{perm.name}</TableCell>
                <TableCell><Badge variant="outline">{perm.pageName}</Badge></TableCell>
                <TableCell>
                  <Badge variant={perm.status === 'active' ? 'default' : 'secondary'}>
                    {perm.status || 'active'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {/* --- ACTION MENU --- */}
                  <DropdownMenu>
                    {/* Added stopPropagation so clicks don't interfere with the table row */}
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    
                    <DropdownMenuContent align="end" className="w-40">
                      {/* EDIT OPTION */}
                      <DropdownMenuItem onClick={() => handleEdit(perm)} className="cursor-pointer">
                        <Pencil className="mr-2 h-4 w-4" /> 
                        Edit
                      </DropdownMenuItem>
                      
                      {/* DISABLE/ENABLE OPTION */}
                      <DropdownMenuItem onClick={() => handleToggleStatus(perm)} className="cursor-pointer">
                        <Ban className="mr-2 h-4 w-4" />
                        {perm.status === 'active' ? 'Disable' : 'Enable'}
                      </DropdownMenuItem>
                      
                      <DropdownMenuSeparator />
                      
                      {/* DELETE OPTION */}
                      <DropdownMenuItem 
                        onClick={() => handleDelete(perm.id)} 
                        className="text-red-600 focus:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> 
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Permission" : "New Permission"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Permission Name *</Label>
              <Input value={formData.name} onChange={handleNameChange} />
            </div>
            <div className="space-y-2">
              <Label>Permission Key</Label>
              <Input value={formData.key} readOnly className="bg-gray-100" />
            </div>
            <div className="space-y-2">
              <Label>Page Name / Group *</Label>
              <Input value={formData.pageName} placeholder="e.g., Reports, User Management" onChange={e => setFormData({...formData, pageName: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={formData.description} placeholder="Explain what this permission allows" onChange={e => setFormData({...formData, description: e.target.value})} />
            </div>
             <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                  <Label>Permission Status</Label>
                  <p className="text-xs text-gray-500">
                    Inactive permissions cannot be assigned to new roles.
                  </p>
              </div>
              <Switch
                checked={formData.status === 'active'}
                onCheckedChange={(checked) => setFormData({...formData, status: checked ? 'active' : 'inactive'})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>{isSaving ? "Saving..." : "Save Permission"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}