"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useEntityScope } from "@/hooks/use-entity-scope"
import { usersService, type User } from "@/lib/firestore/usersService"
import { rolesService, type Role } from "@/lib/firestore/rolesService"
import { accessPathsService, type AccessPath } from "@/lib/firestore/accessPathsService"
import { toast } from "@/hooks/use-toast"
import { CrudTable } from "@/components/admin/crud-table"

// Icons
import {
  Users,
  ShieldAlert,
  Key,
  Shield,
  Loader2,
  Save,
  Check,
  ChevronDown,
  ChevronRight,
  Info,
  Search,
  Zap
} from "lucide-react"

// UI Components
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

// --- TYPES ---

interface RouteInfo {
  path: string
  label: string
}

const ROUTE_GROUPS: Record<string, { label: string; icon: string }> = {
  ingredients: { label: "Ingredients", icon: "📦" },
  master: { label: "Master Data", icon: "⚙️" },
  meals: { label: "Meals", icon: "🍽️" },
  services: { label: "Services", icon: "🔧" },
  organization: { label: "Org Management", icon: "🏢" },
  "menu-management": { label: "Menu Logic", icon: "📋" },
  vendors: { label: "Vendors", icon: "👨‍🍳" },
  "system-admin": { label: "Security", icon: "🔐" },
  other: { label: "Other", icon: "📁" },
}

function getRouteGroup(routePath: string): string {
  const routeToGroup: Record<string, string> = {
    "/admin/ingredients": "ingredients",
    "/admin/gp": "ingredients",
    "/admin/subgp": "ingredients",
    "/admin/templates": "master",
    "/admin/brands": "master",
    "/admin/sub-brands": "master",
    "/admin/types": "master",
    "/admin/defaults": "master",
    "/admin/tax-templates": "master",
    "/admin/suppliers": "master",
    "/admin/categories": "master",
    "/admin/meal-plans": "meals",
    "/admin/sub-meal-plans": "meals",
    "/admin/menu-items": "meals",
    "/admin/services": "services",
    "/admin/sub-services": "services",
    "/admin/companies": "organization",
    "/admin/buildings": "organization",
    "/admin/corporate-calendar": "organization",
    "/admin/structure-assignment": "organization",
    "/admin/structure-management": "organization",
    "/admin/meal-plan-structure": "organization",
    "/admin/combined-menu": "menu-management",
    "/admin/combined-menu-management": "menu-management",
    "/admin/updations": "menu-management",
    "/admin/company-menus": "menu-management",
    "/admin/presentation": "menu-management",
    "/admin/corporate-deck": "menu-management",
    "/admin/vendors": "vendors",
    "/admin/access-management": "system-admin",
    "/admin/roles": "system-admin",
    "/admin/permissions": "system-admin",
    "/admin/users": "system-admin",
  }
  return routeToGroup[routePath] || "other"
}

export default function TeamManagementPage() {
  const { userProfile, isSuperAdmin, allowedRoutes: parentAllowedRoutes } = useAuth()
  const { entityId, entityType, injectEntityId } = useEntityScope()

  const [activeTab, setActiveTab] = useState("users")
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [allRouteInfos, setAllRouteInfos] = useState<RouteInfo[]>([])
  const [existingUserPaths, setExistingUserPaths] = useState<AccessPath[]>([])
  const [loading, setLoading] = useState(true)

  // Delegation state
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [delegatedRoutes, setDelegatedRoutes] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [routeSearch, setRouteSearch] = useState("")

  const fetchData = useCallback(async () => {
    if (!entityId || !entityType) return
    try {
      setLoading(true)
      const [usersData, rolesData, routesRes, pathsRes] = await Promise.all([
        entityType === "vendor_staff" 
          ? usersService.getByVendor(entityId) 
          : usersService.getByCompany(entityId),
        rolesService.getScopedRoles(entityType, entityId),
        fetch("/api/routes").then(r => r.json()),
        accessPathsService.getAll() // We filter client-side for simplicity
      ])

      setUsers(usersData)
      setRoles(rolesData)
      setAllRouteInfos(routesRes.routes || [])
      setExistingUserPaths(pathsRes.filter(p => p.entityId === entityId))
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Failed to load team data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [entityId, entityType])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // --- CRUD HANDLERS ---
  const handleAddUser = async (data: any) => {
    const payload = injectEntityId(data)
    payload.userType = entityType
    if (entityType === "company_user") {
        payload.companyIds = [entityId]
    } else {
        payload.vendorId = entityId
    }
    await usersService.add(payload)
    fetchData()
  }

  const handleEditUser = async (id: string, data: any) => {
    await usersService.update(id, data)
    fetchData()
  }

  const handleDeleteUser = async (id: string) => {
    await usersService.delete(id)
    fetchData()
  }

  const handleAddRole = async (data: any) => {
    const payload = injectEntityId(data)
    payload.userType = entityType
    payload.entityId = entityId
    payload.isSystem = false
    await rolesService.add(payload)
    fetchData()
  }

  const handleEditRole = async (id: string, data: any) => {
    await rolesService.update(id, data)
    fetchData()
  }

  const handleDeleteRole = async (id: string) => {
    await rolesService.delete(id)
    fetchData()
  }

  // --- DELEGATION LOGIC ---
  const handleSelectUserForDelegation = (userId: string) => {
    setSelectedUserId(userId)
    const existing = existingUserPaths.find(p => p.userId === userId)
    if (existing) {
      setDelegatedRoutes(new Set(existing.allowedRoutes))
    } else {
      setDelegatedRoutes(new Set())
    }
  }

  const toggleRoute = (path: string) => {
    setDelegatedRoutes(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const toggleGroup = (groupKey: string) => {
    const groupPaths = routesIAmAllowedToSee
      .filter(r => getRouteGroup(r.path) === groupKey)
      .map(r => r.path)
    
    const allChecked = groupPaths.every(p => delegatedRoutes.has(p))
    setDelegatedRoutes(prev => {
      const next = new Set(prev)
      if (allChecked) groupPaths.forEach(p => next.delete(p))
      else groupPaths.forEach(p => next.add(p))
      return next
    })
  }

  const handleSaveDelegation = async () => {
    if (!selectedUserId || !userProfile) return
    const user = users.find(u => u.id === selectedUserId)
    if (!user) return

    try {
      setIsSaving(true)
      const existing = existingUserPaths.find(p => p.userId === selectedUserId)
      const payload = {
        userId: selectedUserId,
        userType: entityType as any,
        entityId: entityId as string,
        entityName: userProfile.name, // The admin's entity name
        allowedRoutes: Array.from(delegatedRoutes),
        deniedRoutes: [],
        label: `Delegated Access for ${user.name}`,
        status: "active" as const,
        updatedBy: userProfile.email
      }

      if (existing) {
        await accessPathsService.update(existing.id, payload)
      } else {
        await accessPathsService.add(payload)
      }

      toast({ title: "Success", description: `Access paths delegated to ${user.name}` })
      fetchData()
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Failed to save delegation", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  // --- FILTERED DATA ---
  const routesIAmAllowedToSee = useMemo(() => {
    // Super Admin sees all. Others see what they are allowed.
    if (isSuperAdmin) return allRouteInfos
    return allRouteInfos.filter(r => parentAllowedRoutes.has(r.path) || r.path === "/admin")
  }, [allRouteInfos, parentAllowedRoutes, isSuperAdmin])

  const groupedRoutes = useMemo(() => {
    const groups: Record<string, RouteInfo[]> = {}
    const filtered = routeSearch.trim() 
      ? routesIAmAllowedToSee.filter(r => r.label.toLowerCase().includes(routeSearch.toLowerCase()) || r.path.toLowerCase().includes(routeSearch.toLowerCase()))
      : routesIAmAllowedToSee

    filtered.forEach(route => {
      if (route.path === "/admin") return // Skip dashboard
      const group = getRouteGroup(route.path)
      if (!groups[group]) groups[group] = []
      groups[group].push(route)
    })
    return groups
  }, [routesIAmAllowedToSee, routeSearch])

  // --- UI ---
  if (loading && users.length === 0) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="animate-spin h-8 w-8 text-blue-500" /></div>
  }

  const userColumns = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "roleKey", label: "Role" },
    { key: "status", label: "Status" },
  ]

  const userFields = [
    { name: "name", label: "Full Name", type: "text" as const, required: true },
    { name: "email", label: "Email Address", type: "text" as const, required: true },
    { name: "phone", label: "Phone Number", type: "text" as const },
    { name: "roleId", label: "Role", type: "select" as const, required: true, options: roles.map(r => ({ value: r.id, label: r.name })) },
    { name: "status", label: "Status", type: "select" as const, required: true, options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }] },
  ]

  const roleColumns = [
    { key: "name", label: "Role Name" },
    { key: "key", label: "Role Key" },
    { key: "status", label: "Status" },
  ]

  const roleFields = [
    { name: "name", label: "Role Name", type: "text" as const, required: true },
    { name: "key", label: "Role Key (Internal)", type: "text" as const, required: true },
    { name: "status", label: "Status", type: "select" as const, required: true, options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }] },
  ]

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Users className="h-8 w-8 text-blue-600" />
            Team Management
          </h1>
          <p className="text-gray-500 mt-1">Manage your team members, custom roles, and delegate specific page access.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-gray-100/80 p-1">
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" /> Users
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2">
            <ShieldAlert className="h-4 w-4" /> Roles
          </TabsTrigger>
          <TabsTrigger value="access" className="gap-2">
            <Key className="h-4 w-4" /> Path Delegation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card className="border-none shadow-sm">
            <CardContent className="pt-6">
              <CrudTable
                title="Entity Users"
                data={users}
                columns={userColumns}
                formFields={userFields}
                onAdd={handleAddUser}
                onEdit={handleEditUser}
                onDelete={handleDeleteUser}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles">
          <Card className="border-none shadow-sm">
            <CardContent className="pt-6">
              <CrudTable
                title="Entity Roles"
                data={roles}
                columns={roleColumns}
                formFields={roleFields}
                onAdd={handleAddRole}
                onEdit={handleEditRole}
                onDelete={handleDeleteRole}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* User List Panel */}
            <Card className="lg:col-span-4 border-none shadow-sm h-fit sticky top-24">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-lg">Select Team Member</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  <div className="p-3 space-y-2">
                    {users.map(user => (
                      <button
                        key={user.id}
                        onClick={() => handleSelectUserForDelegation(user.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-all ${
                          selectedUserId === user.id 
                          ? "bg-blue-50 border-blue-200 ring-2 ring-blue-100" 
                          : "bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <div className="font-semibold text-gray-900">{user.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{user.email}</div>
                        <div className="mt-2 flex items-center justify-between">
                          <Badge variant="outline" className="text-[10px]">{user.roleKey || 'No Role'}</Badge>
                          {existingUserPaths.some(p => p.userId === user.id) && (
                            <div className="flex items-center text-[10px] text-green-600 font-medium bg-green-50 px-1.5 py-0.5 rounded">
                              <Check className="h-2.5 w-2.5 mr-1" /> Paths Active
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                    {users.length === 0 && <div className="text-center py-10 text-gray-400">No users found.</div>}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Path Selection Panel */}
            <Card className="lg:col-span-8 border-none shadow-sm">
              <CardHeader className="pb-3 border-b flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-lg">Delegate Paths</CardTitle>
                  <p className="text-xs text-gray-500">Enable/disable specific pages for the selected user.</p>
                </div>
                <Button 
                    onClick={handleSaveDelegation} 
                    disabled={!selectedUserId || isSaving}
                    className="gap-2"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Delegation
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {!selectedUserId ? (
                  <div className="flex flex-col items-center justify-center py-32 text-gray-400 space-y-4">
                    <div className="p-4 bg-gray-50 rounded-full"><Key className="h-10 w-10 opacity-20" /></div>
                    <div className="text-sm font-medium">Select a user to manage their path access</div>
                  </div>
                ) : (
                  <div className="p-6 space-y-6">
                    <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
                        <Info className="h-5 w-5 text-amber-600 shrink-0" />
                        <p className="text-xs text-amber-800 leading-relaxed">
                            <strong>Note:</strong> You can only delegate paths that you currently have access to. 
                            Users will still be restricted by their primary role permissions.
                        </p>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input 
                            placeholder="Search available paths..." 
                            className="pl-10" 
                            value={routeSearch}
                            onChange={e => setRouteSearch(e.target.value)}
                        />
                    </div>

                    <ScrollArea className="h-[600px] pr-4">
                      <div className="space-y-6">
                        {Object.entries(ROUTE_GROUPS).map(([groupKey, groupInfo]) => {
                          const routes = groupedRoutes[groupKey]
                          if (!routes || routes.length === 0) return null

                          const allChecked = routes.every(r => delegatedRoutes.has(r.path))
                          const someChecked = routes.some(r => delegatedRoutes.has(r.path))
                          const isCollapsed = collapsedGroups.has(groupKey)

                          return (
                            <div key={groupKey} className="border rounded-xl overflow-hidden bg-white shadow-sm transition-all">
                              <div 
                                className="flex items-center justify-between p-4 bg-gray-50/50 cursor-pointer hover:bg-gray-100/50 transition-colors"
                                onClick={() => {
                                  setCollapsedGroups(prev => {
                                    const next = new Set(prev)
                                    if (next.has(groupKey)) next.delete(groupKey)
                                    else next.add(groupKey)
                                    return next
                                  })
                                }}
                              >
                                <div className="flex items-center gap-3">
                                  {isCollapsed ? <ChevronRight className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                                  <span className="font-bold text-sm text-gray-700 flex items-center gap-2">
                                    <span className="text-lg">{groupInfo.icon}</span> {groupInfo.label}
                                  </span>
                                  <Badge variant="secondary" className="text-[10px]">
                                    {routes.filter(r => delegatedRoutes.has(r.path)).length} / {routes.length}
                                  </Badge>
                                </div>
                                <div onClick={e => e.stopPropagation()}>
                                  <Checkbox 
                                    checked={allChecked} 
                                    // @ts-ignore
                                    indeterminate={someChecked && !allChecked}
                                    onCheckedChange={() => toggleGroup(groupKey)}
                                  />
                                </div>
                              </div>

                              {!isCollapsed && (
                                <div className="divide-y border-t bg-white">
                                  {routes.map(route => {
                                    const isChecked = delegatedRoutes.has(route.path)
                                    return (
                                      <label 
                                        key={route.path}
                                        className={`flex items-center justify-between p-4 cursor-pointer hover:bg-blue-50/30 transition-colors ${isChecked ? 'bg-blue-50/10' : ''}`}
                                      >
                                        <div className="flex items-center gap-3">
                                          <Checkbox 
                                            checked={isChecked}
                                            onCheckedChange={() => toggleRoute(route.path)}
                                          />
                                          <div>
                                            <div className="text-sm font-semibold text-gray-800">{route.label}</div>
                                            <div className="text-[10px] font-mono text-gray-400">{route.path}</div>
                                          </div>
                                        </div>
                                        {isChecked && <Check className="h-4 w-4 text-blue-500" />}
                                      </label>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
