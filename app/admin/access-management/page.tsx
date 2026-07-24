"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { db } from "@/lib/firebase"
import { collection, getDocs } from "firebase/firestore"
import { accessPathsService, type AccessPath } from "@/lib/firestore/accessPathsService"
import { rolesService, type Role } from "@/lib/firestore/rolesService"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "@/hooks/use-toast"

// Icons
import {
  Shield,
  Building2,
  ChefHat,
  Search,
  Check,
  X,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Save,
  Zap,
  Info,
} from "lucide-react"

// UI Components
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

// ─── TYPES ──────────────────────────────────────────────────────────────────────

interface RouteInfo {
  path: string
  label: string
  category: string
}

interface Entity {
  id: string
  name: string
  email?: string
  contactPerson?: string
  status?: string
}

// Route groupings for better UX
const ROUTE_GROUPS: Record<string, { label: string; icon: string }> = {
  ingredients: { label: "Ingredients Management", icon: "📦" },
  master: { label: "Master Data", icon: "⚙️" },
  meals: { label: "Meal Management", icon: "🍽️" },
  services: { label: "Services", icon: "🔧" },
  organization: { label: "Organization", icon: "🏢" },
  "menu-management": { label: "Menu Management", icon: "📋" },
  vendors: { label: "Vendors", icon: "👨‍🍳" },
  "system-admin": { label: "System Administration", icon: "🔐" },
  other: { label: "Other", icon: "📁" },
}

// Map routes to their logical groups
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

// ─── PRESETS ────────────────────────────────────────────────────────────────────

const PRESETS: Record<string, { label: string; description: string; routes: string[] }> = {
  "menu-viewer": {
    label: "Menu Viewer",
    description: "View company menus, meal plans, and menu items",
    routes: ["/admin/company-menus", "/admin/menu-items", "/admin/meal-plans", "/admin/sub-meal-plans"],
  },
  "full-menu": {
    label: "Full Menu Access",
    description: "Create and manage menus, services, and meal plans",
    routes: [
      "/admin/company-menus", "/admin/combined-menu", "/admin/combined-menu-management",
      "/admin/menu-items", "/admin/meal-plans", "/admin/sub-meal-plans",
      "/admin/services", "/admin/sub-services", "/admin/updations",
    ],
  },
  "company-basics": {
    label: "Company Basics",
    description: "View own company, buildings, calendar, and menus",
    routes: [
      "/admin/companies", "/admin/buildings", "/admin/company-menus",
      "/admin/corporate-calendar", "/admin/employees",
    ],
  },
}

// ─── COMPONENT ──────────────────────────────────────────────────────────────────

export default function AccessManagementPage() {
  const { isSuperAdmin, userProfile } = useAuth()

  // Data
  const [companies, setCompanies] = useState<Entity[]>([])
  const [vendors, setVendors] = useState<Entity[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [allRoutes, setAllRoutes] = useState<RouteInfo[]>([])
  const [existingPaths, setExistingPaths] = useState<AccessPath[]>([])
  const [loading, setLoading] = useState(true)

  // UI State
  const [activeTab, setActiveTab] = useState("companies")
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null)
  const [selectedRoutes, setSelectedRoutes] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")
  const [routeSearchQuery, setRouteSearchQuery] = useState("")
  const [saving, setSaving] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [hasChanges, setHasChanges] = useState(false)

  // ─── LOAD DATA ──────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [companiesSnap, vendorsSnap, rolesRes, routesRes, pathsRes] = await Promise.all([
        getDocs(collection(db, "companies")),
        getDocs(collection(db, "vendors")),
        rolesService.getAll(),
        fetch("/api/routes").then((r) => r.json()),
        accessPathsService.getAll(),
      ])

      setCompanies(companiesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Entity[])
      setVendors(vendorsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Entity[])
      setRoles(rolesRes)
      setAllRoutes(routesRes.routes || [])
      setExistingPaths(pathsRes)
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ─── SELECT ENTITY ────────────────────────────────────────────────────────────
  const handleSelectEntity = useCallback(
    (entity: Entity) => {
      setSelectedEntity(entity)
      setHasChanges(false)

      const userType = activeTab === "companies" ? "company_user" : "vendor_staff"

      // Find existing access path for this entity or role
      let existingPath
      if (activeTab === "roles") {
        existingPath = existingPaths.find((p) => p.roleId === entity.id)
      } else {
        existingPath = existingPaths.find((p) => p.entityId === entity.id && p.userType === userType)
      }

      if (existingPath) {
        setSelectedRoutes(new Set(existingPath.allowedRoutes))
      } else {
        setSelectedRoutes(new Set())
      }
    },
    [activeTab, existingPaths]
  )

  // ─── TOGGLE ROUTE ─────────────────────────────────────────────────────────────
  const toggleRoute = (routePath: string) => {
    setSelectedRoutes((prev) => {
      const next = new Set(prev)
      if (next.has(routePath)) {
        next.delete(routePath)
      } else {
        next.add(routePath)
      }
      return next
    })
    setHasChanges(true)
  }

  // Toggle entire group
  const toggleGroup = (group: string) => {
    const groupRoutes = allRoutes
      .filter((r) => getRouteGroup(r.path) === group)
      .map((r) => r.path)

    const allChecked = groupRoutes.every((r) => selectedRoutes.has(r))

    setSelectedRoutes((prev) => {
      const next = new Set(prev)
      if (allChecked) {
        groupRoutes.forEach((r) => next.delete(r))
      } else {
        groupRoutes.forEach((r) => next.add(r))
      }
      return next
    })
    setHasChanges(true)
  }

  // Apply preset
  const applyPreset = (presetKey: string) => {
    const preset = PRESETS[presetKey]
    if (!preset) return

    setSelectedRoutes((prev) => {
      const next = new Set(prev)
      preset.routes.forEach((r) => next.add(r))
      return next
    })
    setHasChanges(true)
    toast({ title: "Preset Applied", description: `Added ${preset.label} routes` })
  }

  // ─── SAVE ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedEntity || !userProfile) return

    const userType = activeTab === "companies" ? "company_user" : "vendor_staff"

    try {
      setSaving(true)

      // Find existing access path for this entity or role
      let existingPath
      if (activeTab === "roles") {
        existingPath = existingPaths.find((p) => p.roleId === selectedEntity.id)
      } else {
        existingPath = existingPaths.find((p) => p.entityId === selectedEntity.id && p.userType === userType)
      }

      const payload = {
        userType: activeTab === "roles" ? ("company_user" as any) : (userType as any), // Fallback for role
        ...(activeTab === "roles" ? { roleId: selectedEntity.id } : { entityId: selectedEntity.id }),
        entityName: selectedEntity.name || (selectedEntity as any).key,
        allowedRoutes: Array.from(selectedRoutes),
        deniedRoutes: [],
        label: `${selectedEntity.name} Access Profile`,
        status: "active" as const,
        updatedBy: userProfile.email,
      }

      if (existingPath) {
        await accessPathsService.update(existingPath.id, payload)
      } else {
        await accessPathsService.add(payload)
      }

      toast({ title: "Success", description: `Access updated for ${selectedEntity.name}` })
      setHasChanges(false)

      // Refresh paths
      const pathsRes = await accessPathsService.getAll()
      setExistingPaths(pathsRes)
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Failed to save access paths", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  // ─── GROUPED ROUTES ───────────────────────────────────────────────────────────
  const groupedRoutes = useMemo(() => {
    const groups: Record<string, RouteInfo[]> = {}

    // Filter routes by search
    const filteredRoutes = routeSearchQuery.trim()
      ? allRoutes.filter(
          (r) =>
            r.path.toLowerCase().includes(routeSearchQuery.toLowerCase()) ||
            r.label.toLowerCase().includes(routeSearchQuery.toLowerCase())
        )
      : allRoutes

    // Exclude the dashboard (always allowed)
    filteredRoutes
      .filter((r) => r.path !== "/admin")
      .forEach((route) => {
        const group = getRouteGroup(route.path)
        if (!groups[group]) groups[group] = []
        groups[group].push(route)
      })

    return groups
  }, [allRoutes, routeSearchQuery])

  // ─── FILTERED ENTITIES ────────────────────────────────────────────────────────
  const filteredEntities = useMemo(() => {
    let list: Entity[] = []
    if (activeTab === "companies") list = companies
    if (activeTab === "vendors") list = vendors
    if (activeTab === "roles") list = roles.map(r => ({ id: r.id, name: r.name, key: r.key }))

    if (!searchQuery) return list
    const q = searchQuery.toLowerCase()
    return list.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.email && e.email.toLowerCase().includes(q)) ||
        ((e as any).key && (e as any).key.toLowerCase().includes(q))
    )
  }, [companies, vendors, roles, activeTab, searchQuery])

  // ─── NOT SUPER ADMIN GUARD ────────────────────────────────────────────────────
  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <Shield className="h-12 w-12 text-red-400 mx-auto" />
          <h2 className="text-xl font-bold">Super Admin Only</h2>
          <p className="text-sm text-gray-500">Only super administrators can manage access paths.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-2">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-600" />
            Access Management
          </h1>
          <p className="text-gray-600">
            Assign page-level access to companies and vendors. Changes take effect immediately.
          </p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* MAIN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT PANEL — Entity List */}
        <div className="lg:col-span-4">
          <Card className="sticky top-20">
            <CardHeader className="pb-3">
              <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedEntity(null); setSearchQuery("") }}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="companies" className="gap-2">
                    <Building2 className="h-3.5 w-3.5" />
                    Companies ({companies.length})
                  </TabsTrigger>
                  <TabsTrigger value="vendors" className="gap-2">
                    <ChefHat className="h-3.5 w-3.5" />
                    Vendors ({vendors.length})
                  </TabsTrigger>
                  <TabsTrigger value="roles" className="gap-2">
                    <Shield className="h-3.5 w-3.5" />
                    Roles ({roles.length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={`Search ${activeTab}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Entity List */}
              <ScrollArea className="h-[calc(100vh-360px)]">
                <div className="space-y-1 pr-3">
                  {filteredEntities.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">No {activeTab} found</p>
                  ) : (
                    filteredEntities.map((entity) => {
                      const isSelected = selectedEntity?.id === entity.id
                      const userType = activeTab === "companies" ? "company_user" : "vendor_staff"
                      let hasAccess = false
                      let routeCount = 0

                      if (activeTab === "roles") {
                        const existingPath = existingPaths.find((p) => p.roleId === entity.id)
                        hasAccess = !!existingPath
                        routeCount = existingPath?.allowedRoutes?.length || 0
                      } else {
                        const existingPath = existingPaths.find((p) => p.entityId === entity.id && p.userType === userType)
                        hasAccess = !!existingPath
                        routeCount = existingPath?.allowedRoutes?.length || 0
                      }

                      return (
                        <button
                          key={entity.id}
                          onClick={() => handleSelectEntity(entity)}
                          className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all text-sm ${
                            isSelected
                              ? "bg-blue-50 border-blue-200 ring-1 ring-blue-300"
                              : "bg-white border-gray-100 hover:bg-gray-50 hover:border-gray-200"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="min-w-0">
                              <div className="font-medium text-gray-900 truncate">{entity.name}</div>
                              {entity.email && (
                                <div className="text-xs text-gray-400 truncate">{entity.email}</div>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 ml-2 shrink-0">
                              {hasAccess ? (
                                <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                                  {routeCount} routes
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-gray-400">
                                  No access
                                </Badge>
                              )}
                            </div>
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT PANEL — Route Assignment */}
        <div className="lg:col-span-8">
          {!selectedEntity ? (
            <Card className="min-h-[60vh] flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
                  <Shield className="h-8 w-8 text-gray-300" />
                </div>
                <h3 className="text-lg font-semibold text-gray-500">Select a {activeTab === "companies" ? "company" : "vendor"}</h3>
                <p className="text-sm text-gray-400 max-w-sm">
                  Choose from the list on the left to manage their page access.
                </p>
              </div>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {activeTab === "companies" ? (
                        <Building2 className="h-5 w-5 text-blue-500" />
                      ) : (
                        <ChefHat className="h-5 w-5 text-orange-500" />
                      )}
                      {selectedEntity.name}
                    </CardTitle>
                    <p className="text-xs text-gray-500 mt-1">
                      {selectedRoutes.size} of {allRoutes.length - 1} routes enabled
                      {hasChanges && (
                        <span className="text-amber-600 font-semibold ml-2">• Unsaved changes</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleSave}
                      disabled={saving || !hasChanges}
                      size="sm"
                      className="gap-2"
                    >
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      {saving ? "Saving..." : "Save Access"}
                    </Button>
                  </div>
                </div>

                {/* Presets */}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span className="text-xs text-gray-500 font-medium">Quick Presets:</span>
                  {Object.entries(PRESETS).map(([key, preset]) => (
                    <Button
                      key={key}
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => applyPreset(key)}
                    >
                      <Zap className="h-3 w-3" />
                      {preset.label}
                    </Button>
                  ))}
                </div>

                {/* Route Search */}
                <div className="relative mt-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search routes..."
                    value={routeSearchQuery}
                    onChange={(e) => setRouteSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <ScrollArea className="h-[calc(100vh-420px)]">
                  <div className="space-y-4 pr-3">
                    {/* Info banner */}
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-700">
                      <Info className="h-4 w-4 mt-0.5 shrink-0" />
                      <div>
                        <strong>Dashboard (/admin)</strong> is always accessible.
                        Toggle routes below to control what pages this {activeTab === "companies" ? "company" : "vendor"}&apos;s users can see.
                        Changes are applied <strong>in real-time</strong>.
                      </div>
                    </div>

                    {/* Route Groups */}
                    {Object.entries(ROUTE_GROUPS).map(([groupKey, groupInfo]) => {
                      const routes = groupedRoutes[groupKey]
                      if (!routes || routes.length === 0) return null

                      const allChecked = routes.every((r) => selectedRoutes.has(r.path))
                      const someChecked = routes.some((r) => selectedRoutes.has(r.path))
                      const isCollapsed = collapsedGroups.has(groupKey)

                      return (
                        <div key={groupKey} className="rounded-lg border border-gray-200 overflow-hidden">
                          {/* Group Header */}
                          <button
                            onClick={() => {
                              setCollapsedGroups((prev) => {
                                const next = new Set(prev)
                                if (next.has(groupKey)) next.delete(groupKey)
                                else next.add(groupKey)
                                return next
                              })
                            }}
                            className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              {isCollapsed ? (
                                <ChevronRight className="h-4 w-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-gray-400" />
                              )}
                              <span className="text-sm font-semibold text-gray-700">
                                {groupInfo.icon} {groupInfo.label}
                              </span>
                              <Badge variant="outline" className="text-[10px]">
                                {routes.filter((r) => selectedRoutes.has(r.path)).length}/{routes.length}
                              </Badge>
                            </div>
                            <div onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={allChecked}
                                // @ts-ignore
                                indeterminate={someChecked && !allChecked}
                                onCheckedChange={() => toggleGroup(groupKey)}
                              />
                            </div>
                          </button>

                          {/* Routes */}
                          {!isCollapsed && (
                            <div className="divide-y divide-gray-100">
                              {routes.map((route) => {
                                const isChecked = selectedRoutes.has(route.path)
                                return (
                                  <label
                                    key={route.path}
                                    className={`flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors ${
                                      isChecked ? "bg-green-50/50" : "hover:bg-gray-50"
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <Checkbox
                                        checked={isChecked}
                                        onCheckedChange={() => toggleRoute(route.path)}
                                      />
                                      <div className="min-w-0">
                                        <div className="text-sm font-medium text-gray-800">{route.label}</div>
                                        <div className="text-[11px] text-gray-400 font-mono truncate">
                                          {route.path}
                                        </div>
                                      </div>
                                    </div>
                                    {isChecked && <Check className="h-4 w-4 text-green-500 shrink-0" />}
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
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
