"use client"

import React, { useState, useEffect, useMemo } from "react"
import { rolesService, type Role } from "@/lib/firestore/rolesService"
import { permissionsService, type Permission } from "@/lib/firestore/permissionsService"
import { toast } from "@/hooks/use-toast"

// Icons
import { Plus, MoreHorizontal, Pencil, Trash2, Lock, Ban } from "lucide-react"

// UI Components
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea" // Added for permission modal
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const initialRoleState: Omit<Role, "id" | "createdAt" | "updatedAt"> = {
  name: "",
  key: "",
  permissions: {},
  status: 'active',
}

const initialPermissionState: Omit<Permission, "id" | "createdAt" | "updatedAt"> = {
  name: "",
  key: "",
  description: "",
  pageName: "",
  status: 'active',
}

export default function RoleManagementPage() {
  // --- ROLES STATE ---
  const [data, setData] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false)
  const [roleFormData, setRoleFormData] = useState(initialRoleState)
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
  const [isSavingRole, setIsSavingRole] = useState(false)

  // --- PERMISSIONS STATE ---
  const [availablePermissions, setAvailablePermissions] = useState<Permission[]>([])
  const [isPermModalOpen, setIsPermModalOpen] = useState(false)
  const [permFormData, setPermFormData] = useState(initialPermissionState)
  const [isSavingPerm, setIsSavingPerm] = useState(false)

  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    try {
      setLoading(true)
      const [rolesRes, permsRes] = await Promise.all([
        rolesService.getAll(),
        permissionsService.getAll()
      ])
      setData(rolesRes)
      setAvailablePermissions(permsRes)
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Failed to load initial data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // --- ROLES LOGIC ---
  const groupedPermissions = useMemo(() => {
    const currentRolePermissions = roleFormData.permissions || {};
    const filtered = availablePermissions.filter(p => p.status === 'active' || currentRolePermissions[p.key]);

    return filtered.reduce((acc, permission) => {
      const page = permission.pageName || "General";
      if (!acc[page]) {
        acc[page] = [];
      }
      acc[page].push(permission);
      return acc;
    }, {} as Record<string, Permission[]>);
  }, [availablePermissions, roleFormData.permissions]);

  const handleRoleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    const newKey = newName.trim().toUpperCase().replace(/\s+/g, '_');
    setRoleFormData(prev => ({ ...prev, name: newName, key: newKey }));
  };

  const handleRolePermissionChange = (permissionKey: string, checked: boolean) => {
    setRoleFormData(prev => {
      const newPermissions = { ...prev.permissions };
      if (checked) {
        newPermissions[permissionKey] = true;
      } else {
        delete newPermissions[permissionKey]; 
      }
      return { ...prev, permissions: newPermissions };
    })
  }

  const handleOpenAddRole = () => {
    setEditingRoleId(null)
    setRoleFormData(initialRoleState)
    setIsRoleModalOpen(true)
  }

  const handleEditRole = (role: Role) => {
    setEditingRoleId(role.id)
    setRoleFormData({ ...initialRoleState, ...role })
    setIsRoleModalOpen(true)
  }

  const handleSaveRole = async () => {
    if (!roleFormData.name || !roleFormData.key) {
      toast({ title: "Error", description: "Role Name is required", variant: "destructive" })
      return
    }

    try {
      setIsSavingRole(true)
      const payload = {
        name: roleFormData.name,
        key: roleFormData.key,
        permissions: roleFormData.permissions,
        status: roleFormData.status,
      }

      if (editingRoleId) {
        await rolesService.update(editingRoleId, payload)
        toast({ title: "Success", description: "Role updated successfully" })
      } else {
        await rolesService.add(payload)
        toast({ title: "Success", description: "Role created successfully" })
      }
      
      setIsRoleModalOpen(false)
      const rolesRes = await rolesService.getAll();
      setData(rolesRes);
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "The operation failed.", variant: "destructive" })
    } finally {
      setIsSavingRole(false)
    }
  }
  
  const handleToggleRoleStatus = async (role: Role) => {
    const newStatus = role.status === 'active' ? 'inactive' : 'active';
    try {
      await rolesService.update(role.id, { status: newStatus });
      toast({ title: "Success", description: `Role ${newStatus === 'active' ? 'enabled' : 'disabled'}` });
      const rolesRes = await rolesService.getAll();
      setData(rolesRes);
    } catch (error) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  const handleDeleteRole = async (id: string) => {
    if (!confirm("Are you sure? This action cannot be undone.")) return;
    try {
        await rolesService.delete(id);
        toast({ title: "Success", description: "Role deleted" });
        const rolesRes = await rolesService.getAll();
        setData(rolesRes);
    } catch (error) {
        toast({ title: "Error", description: "Delete failed", variant: "destructive" });
    }
  }


  // --- QUICK ADD PERMISSION LOGIC ---
  const handleOpenAddPerm = () => {
    setPermFormData(initialPermissionState)
    setIsPermModalOpen(true)
  }

  const handlePermNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    const newKey = newName.trim().toUpperCase().replace(/\s+/g, '_');
    setPermFormData(prev => ({ ...prev, name: newName, key: newKey }));
  };

  const handleSavePerm = async () => {
    if (!permFormData.name || !permFormData.pageName) {
      toast({ title: "Error", description: "Name and Page Name are required", variant: "destructive" })
      return
    }

    try {
      setIsSavingPerm(true)
      const newPermRef = await permissionsService.add(permFormData)
      
      // Update local state instantly so it appears in the list
      const newPerm: Permission = { 
        ...permFormData, 
        id: newPermRef.id, 
        createdAt: new Date(), 
        updatedAt: new Date() 
      }
      setAvailablePermissions(prev => [...prev, newPerm].sort((a, b) => a.pageName.localeCompare(b.pageName)))
      
      // Auto-check this new permission for the role currently being created/edited
      handleRolePermissionChange(newPerm.key, true)

      toast({ title: "Success", description: "Permission created and selected" })
      setIsPermModalOpen(false)
    } catch (error) {
      toast({ title: "Error", description: "Failed to create permission", variant: "destructive" })
    } finally {
      setIsSavingPerm(false)
    }
  }


  return (
    <div className="space-y-6 p-2">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Role Management</h1>
          <p className="text-gray-600">Define user roles and their system permissions.</p>
        </div>
        <Button onClick={handleOpenAddRole}>
          <Plus className="mr-2 h-4 w-4" /> Create Role
        </Button>
      </div>

      {/* ROLES TABLE */}
      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead>Role Name</TableHead>
              <TableHead>Permissions Count</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="h-24 text-center">Loading...</TableCell></TableRow>
            ) : data.map((role) => (
              <TableRow key={role.id} className={role.status === 'inactive' ? 'bg-gray-50 text-gray-500' : ''}>
                <TableCell className="font-semibold">{role.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{Object.keys(role.permissions || {}).length} enabled</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={role.status === 'active' ? 'default' : 'secondary'}>
                    {role.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditRole(role)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleRoleStatus(role)}>
                        <Ban className="mr-2 h-4 w-4" />
                        {role.status === 'active' ? 'Disable' : 'Enable'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteRole(role.id)}><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* ROLE DIALOG */}
      <Dialog open={isRoleModalOpen} onOpenChange={setIsRoleModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRoleId ? "Edit Role" : "Create New Role"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Role Name *</Label><Input value={roleFormData.name} onChange={handleRoleNameChange} /></div>
              <div className="space-y-2"><Label>Role Key</Label><Input value={roleFormData.key} readOnly className="bg-gray-100" /></div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 font-semibold"><Lock className="h-4 w-4 text-gray-600" /> Permissions</Label>
                {/* NEW BUTTON TO ADD PERMISSION ON THE FLY */}
                <Button type="button" variant="outline" size="sm" onClick={handleOpenAddPerm} className="h-8 text-xs">
                  <Plus className="h-3 w-3 mr-1" /> Add Permission
                </Button>
              </div>
              <div className="space-y-4 rounded-lg border p-4 max-h-[40vh] overflow-y-auto">
                {Object.keys(groupedPermissions).length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No active permissions found. Create one above.</p>
                ) : (
                  Object.entries(groupedPermissions).map(([pageName, permissions]) => (
                    <div key={pageName} className="space-y-3">
                      <h4 className="font-medium text-sm text-gray-800 border-b pb-1">{pageName}</h4>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3 pl-2">
                        {permissions.map(p => {
                          const isInactive = p.status === 'inactive';
                          return (
                            <div key={p.key} className="flex items-center space-x-2">
                              <Checkbox
                                id={p.key}
                                checked={!!roleFormData.permissions[p.key]}
                                onCheckedChange={(c) => handleRolePermissionChange(p.key, !!c)}
                                disabled={isInactive && !roleFormData.permissions[p.key]}
                              />
                              <Label
                                htmlFor={p.key}
                                className={`font-normal cursor-pointer text-sm ${isInactive ? 'text-gray-400 line-through' : ''}`}
                                title={isInactive ? `This permission is currently disabled system-wide.` : p.description}
                              >
                                {p.name}
                              </Label>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                  <Label>Role Status</Label>
                  <p className="text-xs text-gray-500">Inactive roles cannot be assigned to new users.</p>
              </div>
              <Switch
                checked={roleFormData.status === 'active'}
                onCheckedChange={(c) => setRoleFormData({...roleFormData, status: c ? 'active' : 'inactive'})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRoleModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRole} disabled={isSavingRole}>{isSavingRole ? "Saving..." : "Save Role"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QUICK ADD PERMISSION DIALOG (Nested visually, but sibling in DOM) */}
      <Dialog open={isPermModalOpen} onOpenChange={setIsPermModalOpen}>
        <DialogContent className="max-w-md bg-white border-2 border-blue-50 shadow-xl">
          <DialogHeader>
            <DialogTitle>Quick Create Permission</DialogTitle>
            <DialogDescription>Add a new permission system-wide. It will be auto-selected for this role.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Permission Name *</Label>
              <Input value={permFormData.name} onChange={handlePermNameChange} placeholder="e.g., Delete Users" />
            </div>
            <div className="space-y-2">
              <Label>Permission Key</Label>
              <Input value={permFormData.key} readOnly className="bg-gray-100" />
            </div>
            <div className="space-y-2">
              <Label>Group / Page Name *</Label>
              <Input value={permFormData.pageName} placeholder="e.g., User Management" onChange={e => setPermFormData({...permFormData, pageName: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={permFormData.description} placeholder="What does this do?" onChange={e => setPermFormData({...permFormData, description: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPermModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePerm} disabled={isSavingPerm}>
              {isSavingPerm ? "Creating..." : "Create & Select"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}