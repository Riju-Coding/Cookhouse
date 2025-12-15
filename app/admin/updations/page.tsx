"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Calendar, Building2, AlertCircle, RefreshCw } from 'lucide-react'
import Link from "next/link"
import { updationService, clearServiceCache } from "@/lib/services"
import type { MenuUpdation } from "@/lib/types"

export default function UpdatesReportPage() {
  const [updations, setUpdations] = useState<MenuUpdation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState<"all" | "combined" | "company">("all")

  useEffect(() => {
    loadUpdations()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      loadUpdations()
    }, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [])

  async function loadUpdations() {
    try {
      clearServiceCache()
      const data = await updationService.getAll()
      const dataWithIds = data.map((u: any) => ({
        ...u,
        id: u.id || `${u.menuId}-${u.updationNumber}`,
      }))
      setUpdations(dataWithIds)
    } catch (error) {
      console.error("Error loading updations:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setLoading(true)
    await loadUpdations()
  }

  const filtered = updations.filter((u) => {
    const matchesSearch =
      (u.menuName?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (u.companyName?.toLowerCase() || "").includes(searchTerm.toLowerCase())

    const matchesType = filterType === "all" || u.menuType === filterType

    return matchesSearch && matchesType
  })

  const stats = {
    totalUpdates: updations.length,
    totalChanges: updations.reduce((sum, u) => sum + (u.totalChanges || 0), 0),
    combinedMenus: updations.filter((u) => u.menuType === "combined").length,
    companyMenus: updations.filter((u) => u.menuType === "company").length,
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Updates Report</h1>
            <p className="text-gray-600 mt-1">Track all menu changes and updates across combined and company menus</p>
          </div>
        </div>
        <Button 
          onClick={handleRefresh} 
          variant="outline" 
          size="sm"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Updates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalUpdates}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Changes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalChanges}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Combined Menu Updates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats.combinedMenus}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Company Menu Updates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{stats.companyMenus}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search by menu name or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            {(["all", "combined", "company"] as const).map((type) => (
              <Button
                key={type}
                variant={filterType === type ? "default" : "outline"}
                onClick={() => setFilterType(type)}
              >
                {type === "all" ? "All" : type === "combined" ? "Combined" : "Company"}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Updates List */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="p-8 text-center text-gray-500">Loading updates...</CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-gray-500">
              {updations.length === 0 ? "No updates yet" : "No updates match your search"}
            </CardContent>
          </Card>
        ) : (
          filtered.map((updation) => (
            <Card key={updation.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold">{updation.menuName}</h3>
                      <Badge
                        variant={updation.menuType === "combined" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {updation.menuType === "combined" ? "Combined Menu" : "Company Menu"}
                      </Badge>
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                        Update #{updation.updationNumber}
                      </Badge>
                    </div>

                    {/* Company & Building Info for Company Menus */}
                    {updation.menuType === "company" && updation.companyName && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 mt-2">
                        <Building2 className="h-4 w-4" />
                        <span>{updation.companyName}</span>
                        {updation.buildingName && <span>• {updation.buildingName}</span>}
                      </div>
                    )}

                    {/* Date Range */}
                    <div className="flex items-center gap-2 text-sm text-gray-600 mt-2">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {updation.menuStartDate} to {updation.menuEndDate}
                      </span>
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div className="text-right text-sm text-gray-500">
                    <div>{new Date(updation.createdAt).toLocaleDateString()}</div>
                    <div>{new Date(updation.createdAt).toLocaleTimeString()}</div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Change Summary */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-blue-50 rounded border border-blue-200">
                    <div className="text-xs text-blue-600 font-semibold">Total Changes</div>
                    <div className="text-2xl font-bold text-blue-700">{updation.totalChanges}</div>
                  </div>
                  <div className="p-3 bg-green-50 rounded border border-green-200">
                    <div className="text-xs text-green-600 font-semibold">Added Items</div>
                    <div className="text-2xl font-bold text-green-700">
                      {updation.changedCells.reduce(
                        (sum, cell) => sum + cell.changes.filter((c) => c.action === "added").length,
                        0,
                      )}
                    </div>
                  </div>
                  <div className="p-3 bg-red-50 rounded border border-red-200">
                    <div className="text-xs text-red-600 font-semibold">Removed Items</div>
                    <div className="text-2xl font-bold text-red-700">
                      {updation.changedCells.reduce(
                        (sum, cell) => sum + cell.changes.filter((c) => c.action === "removed").length,
                        0,
                      )}
                    </div>
                  </div>
                </div>

                {/* Changed Cells */}
                {updation.changedCells.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-gray-700">Changed Cells ({updation.changedCells.length})</h4>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {updation.changedCells.map((cell, idx) => (
                        <div key={idx} className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
                          <div className="font-semibold text-yellow-800">
                            {cell.date} • Meal Plan: {cell.mealPlanId}
                          </div>
                          <div className="mt-1 space-y-1">
                            {cell.changes.map((change, changeIdx) => (
                              <div key={changeIdx} className="ml-2 text-yellow-700">
                                {change.action === "added" && <span>✓ Added: {change.itemName}</span>}
                                {change.action === "removed" && <span>✗ Removed: {change.itemName}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
