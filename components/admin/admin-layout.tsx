"use client"

import type React from "react"
import NextTopLoader from 'nextjs-toploader';
import { useState, useMemo, useRef, useCallback, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  LayoutDashboard,
  Package,
  Tags,
  Building2,
  Percent,
  Users,
  LogOut,
  Menu,
  X,
  Search,
  Layers,
  Grid3X3,
  Settings,
  FileText,
  Building,
  ChevronDown,
  ChevronRight,
  Calendar,
  MonitorUp,
  BrainCircuit,
  MapPin,
  Ticket,
  Code,
  Activity,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ActivityTracker } from "@/components/attendance/ActivityTracker"
import { SessionTimeTracker } from "@/components/attendance/SessionTimeTracker"

interface AdminLayoutProps {
  children: React.ReactNode
}

const navigation = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard, category: "main" },
  { name: "Team Management", href: "/admin/team-management", icon: Users, category: "main" },
  { name: "Ingredients", href: "/admin/ingredients", icon: Package, category: "ingredients" },
  { name: "GP", href: "/admin/gp", icon: Layers, category: "ingredients" },
  { name: "SubGp", href: "/admin/subgp", icon: Grid3X3, category: "ingredients" },
  { name: "Templates", href: "/admin/templates", icon: Tags, category: "master" },
  { name: "Brands", href: "/admin/brands", icon: Building2, category: "master" },
  { name: "Sub Brands", href: "/admin/sub-brands", icon: Building2, category: "master" },
  { name: "Types", href: "/admin/types", icon: FileText, category: "master" },
  { name: "Defaults", href: "/admin/defaults", icon: Settings, category: "master" },
  { name: "Tax Templates", href: "/admin/tax-templates", icon: Percent, category: "master" },
  { name: "Suppliers", href: "/admin/suppliers", icon: Users, category: "master" },
  { name: "Categories", href: "/admin/categories", icon: Tags, category: "master" },
  { name: "Meal Plans", href: "/admin/meal-plans", icon: FileText, category: "meals" },
  { name: "Sub Meal Plans", href: "/admin/sub-meal-plans", icon: Grid3X3, category: "meals" },
  { name: "Menu Items", href: "/admin/menu-items", icon: FileText, category: "meals" },
  { name: "Services", href: "/admin/services", icon: Settings, category: "services" },
  { name: "Sub Services", href: "/admin/sub-services", icon: Grid3X3, category: "services" },
  { name: "Companies", href: "/admin/companies", icon: Building2, category: "organization" },
  { name: "Buildings", href: "/admin/buildings", icon: Building, category: "organization" },
  { name: "KAM Notebook", href: "/admin/kam-notebook", icon: FileText, category: "organization" },
  { name: "Tickets & Rewards", href: "/admin/ticketing", icon: Ticket, category: "organization" },
  { name: "Public QR Links", href: "/admin/qr-links", icon: Ticket, category: "organization" },
  { name: "Developer Board", href: "/admin/developer-board", icon: Code, category: "organization" },
  { name: "Combined Menu Creation", href: "/admin/combined-menu", icon: Building2, category: "menu-management" },
  { name: "Combined Menu Management", href: "/admin/combined-menu-management", icon: Building2, category: "menu-management" },
  { name: "Menu Tracker", href: "/admin/updations", icon: Building2, category: "menu-management" },
  { name: "Company Wise Menu", href: "/admin/company-menus", icon: Building, category: "menu-management" },
  { name: "Presentation", href: "/admin/presentation", icon: MonitorUp, category: "menu-management" },
  { name: "Corporate Deck (PDF)", href: "/admin/corporate-deck", icon: FileText, category: "menu-management" },
  { name: "Menu Planning Rules", href: "/admin/menu-planning-rules", icon: Settings, category: "menu-management" },
  { name: "AI Training Module", href: "/admin/ai-training", icon: BrainCircuit, category: "system-admin" },
  { name: "Corporate Calendar", href: "/admin/corporate-calendar", icon: Calendar, category: "organization" },
  { name: "Structure Assignment", href: "/admin/structure-assignment", icon: Calendar, category: "organization" },
  { name: "Structure Management", href: "/admin/structure-management", icon: Settings, category: "organization" },
  { name: "Meal Plan Structure", href: "/admin/meal-plan-structure", icon: FileText, category: "organization" },
  { name: "Vendors Management", href: "/admin/vendors", icon: FileText, category: "vendors" },
  { name: "Attendance Management", href: "/admin/attendance", icon: MapPin, category: "attendance" },
  { name: "Admin Activity", href: "/admin/attendance-dashboard", icon: Activity, category: "attendance" },
  { name: "Task Manager", href: "/admin/task-manager", icon: Code, category: "tasks" },
  { name: "Access Management", href: "/admin/access-management", icon: Settings, category: "system-admin" },
  { name: "Roles", href: "/admin/roles", icon: Users, category: "system-admin" },
  { name: "Permissions", href: "/admin/permissions", icon: Settings, category: "system-admin" },
  { name: "Users", href: "/admin/users", icon: Users, category: "system-admin" },
]

const categories = [
  { key: "main", label: "Main", icon: LayoutDashboard },
  { key: "ingredients", label: "Ingredients Management", icon: Package },
  { key: "master", label: "Master Data", icon: Settings },
  { key: "meals", label: "Meal Management", icon: FileText },
  { key: "services", label: "Services Management", icon: Settings },
  { key: "organization", label: "Organization", icon: Building2 },
  { key: "menu-management", label: "Menu Management", icon: Building2 },
  { key: "vendors", label: "Vendors Management", icon: Building2 },
  { key: "attendance", label: "Attendance", icon: MapPin },
  { key: "tasks", label: "Tasks", icon: Code },
  { key: "system-admin", label: "System Administration", icon: Settings },
]

export function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
  const [isIframe, setIsIframe] = useState(false)
  const sidebarScrollRef = useRef<HTMLElement>(null)
  const sidebarScrollPositionRef = useRef(0)
  const { signOut, hasRouteAccess, isSuperAdmin } = useAuth()
  const pathname = usePathname()

  useEffect(() => {
    setIsIframe(window.self !== window.top)
  }, [])

  // Filter navigation based on user's allowed routes
  const accessFilteredNavigation = useMemo(() => {
    if (isSuperAdmin) return navigation
    return navigation.filter((item) => {
      // Dashboard is always visible
      if (item.href === "/admin") return true
      return hasRouteAccess(item.href)
    })
  }, [isSuperAdmin, hasRouteAccess])

  const filteredNavigation = useMemo(() => {
    if (!searchQuery.trim()) return accessFilteredNavigation
    return accessFilteredNavigation.filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [searchQuery, accessFilteredNavigation])

  const handleSignOut = async () => {
    await signOut()
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    setShowSearchResults(value.length > 0)
  }

  const handleSearchResultClick = () => {
    setSearchQuery("")
    setShowSearchResults(false)
    setSidebarOpen(false)
  }

  const toggleSection = (categoryKey: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [categoryKey]: !prev[categoryKey],
    }))
  }

  const handleSidebarScroll = useCallback(() => {
    if (sidebarScrollRef.current) {
      sidebarScrollPositionRef.current = sidebarScrollRef.current.scrollTop
    }
  }, [])

  // Restore sidebar scroll position after route change
  useEffect(() => {
    const el = sidebarScrollRef.current
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTop = sidebarScrollPositionRef.current
      })
    }
  }, [pathname])

  const NavigationContent = ({ isMobile = false, navRef, onScroll }: { isMobile?: boolean; navRef?: React.Ref<HTMLElement>; onScroll?: () => void }) => (
    <nav ref={navRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
      {categories.map((category) => {
        const categoryItems = accessFilteredNavigation.filter((item) => item.category === category.key)
        if (categoryItems.length === 0) return null // Hide empty categories
        const isCollapsed = collapsedSections[category.key]
        const CategoryIcon = category.icon

        return (
          <div key={category.key} className="mb-4">
            <button
              onClick={() => toggleSection(category.key)}
              className="w-full flex items-center justify-between px-2 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
            >
              <div className="flex items-center">
                <CategoryIcon className="mr-2 h-4 w-4" />
                {category.label}
              </div>
              {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            {!isCollapsed && (
              <div className="mt-1 space-y-1">
                {categoryItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        "group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors",
                        pathname === item.href
                          ? "bg-gray-100 text-gray-900"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                      )}
                      onClick={isMobile ? () => setSidebarOpen(false) : undefined}
                    >
                      <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                      {item.name}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )

  if (isIframe) {
    return (
      <div className="min-h-screen bg-gray-50">
        <NextTopLoader
          color="#000000"
          initialPosition={0.08}
          crawlSpeed={200}
          height={3}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={200}
          shadow="0 0 10px #000000,0 0 5px #000000"
        />
        <main className="h-screen w-full overflow-y-auto">
          {children}
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NextTopLoader
        color="#000000"
        initialPosition={0.08}
        crawlSpeed={200}
        height={3}
        crawl={true}
        showSpinner={false}
        easing="ease"
        speed={200}
        shadow="0 0 10px #000000,0 0 5px #000000"
      />
      <ActivityTracker />

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white">
            <div className="flex h-16 items-center justify-between px-4 flex-shrink-0">
              <h1 className="text-xl font-bold text-gray-900">Cookhouse Admin</h1>
              <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col">
              <NavigationContent isMobile={true} />
            </div>
            <div className="p-4 flex-shrink-0">
              <Button variant="outline" onClick={handleSignOut} className="w-full bg-transparent">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="hidden lg:fixed lg:top-16 lg:bottom-0 lg:left-0 lg:flex lg:w-64 lg:flex-col lg:z-40">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200 overflow-hidden">
          <div className="flex-1 overflow-hidden flex flex-col">
            <NavigationContent navRef={sidebarScrollRef} onScroll={handleSidebarScroll} />
          </div>
          <div className="p-4 flex-shrink-0">
            <Button variant="outline" onClick={handleSignOut} className="w-full bg-transparent">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      <div className="fixed top-0 left-0 right-0 z-50 flex h-16 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm lg:px-6">
        <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(true)} className="lg:hidden">
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="hidden lg:block text-xl font-bold text-gray-900 shrink-0">Cookhouse Admin</h1>
        <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
          <div className="relative flex flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" style={{ marginTop: '-14px' }} />
              <Input
                type="text"
                placeholder="Search navigation..."
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => setShowSearchResults(searchQuery.length > 0)}
                onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                className="pl-10 pr-4"
              />
            </div>

            {showSearchResults && filteredNavigation.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                {filteredNavigation.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={handleSearchResultClick}
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                    >
                      <Icon className="mr-3 h-4 w-4 text-gray-400" />
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-gray-500 capitalize">{item.category}</div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <SessionTimeTracker />
          </div>
        </div>
      </div>

      <div className="lg:pl-64 pt-16 h-screen flex flex-col">
        <main className="flex-1 overflow-y-auto py-6 px-4 sm:px-6 lg:px-8 bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  )
}
