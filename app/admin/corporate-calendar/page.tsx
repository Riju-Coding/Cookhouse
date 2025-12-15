"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, Plus, Trash2, Edit } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import {
  holidaysService,
  companiesService,
  buildingsService,
  type Holiday,
  type Company,
  type Building,
} from "@/lib/firestore"

export default function CorporateCalendarPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [filteredBuildings, setFilteredBuildings] = useState<Building[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null)
  const [selectedCompany, setSelectedCompany] = useState<string>("")
  const [selectedBuilding, setSelectedBuilding] = useState<string>("")
  const [filterCompany, setFilterCompany] = useState<string>("")
  const [filterBuilding, setFilterBuilding] = useState<string>("")
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7))

  const [formData, setFormData] = useState({
    date: "",
    name: "",
    description: "",
    companyId: "",
    buildingId: "",
    type: "building" as "national" | "company" | "building",
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (selectedCompany) {
      const companyBuildings = buildings.filter((b) => b.companyId === selectedCompany)
      setFilteredBuildings(companyBuildings)
    } else {
      setFilteredBuildings(buildings)
    }
  }, [selectedCompany, buildings])

  const loadData = async () => {
    try {
      setLoading(true)
      const [holidaysData, companiesData, buildingsData] = await Promise.all([
        holidaysService.getAll(),
        companiesService.getAll(),
        buildingsService.getAll(),
      ])

      // Add company and building names to holidays
      const enrichedHolidays = holidaysData.map((holiday) => ({
        ...holiday,
        companyName: companiesData.find((c) => c.id === holiday.companyId)?.name || "",
        buildingName: buildingsData.find((b) => b.id === holiday.buildingId)?.name || "",
      }))

      setHolidays(enrichedHolidays)
      setCompanies(companiesData)
      setBuildings(buildingsData)
    } catch (error) {
      console.error("Error loading data:", error)
      toast({
        title: "Error",
        description: "Failed to load calendar data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.date || !formData.name || !formData.companyId || !formData.buildingId) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    try {
      const company = companies.find((c) => c.id === formData.companyId)
      const building = buildings.find((b) => b.id === formData.buildingId)

      const holidayData = {
        ...formData,
        companyName: company?.name || "",
        buildingName: building?.name || "",
      }

      if (editingHoliday) {
        await holidaysService.update(editingHoliday.id, holidayData)
        toast({
          title: "Success",
          description: "Holiday updated successfully",
        })
      } else {
        await holidaysService.add(holidayData)
        toast({
          title: "Success",
          description: "Holiday added successfully",
        })
      }

      await loadData()
      resetForm()
      setIsDialogOpen(false)
    } catch (error) {
      console.error("Error saving holiday:", error)
      toast({
        title: "Error",
        description: "Failed to save holiday",
        variant: "destructive",
      })
    }
  }

  const handleEdit = (holiday: Holiday) => {
    setEditingHoliday(holiday)
    setFormData({
      date: holiday.date,
      name: holiday.name,
      description: holiday.description || "",
      companyId: holiday.companyId,
      buildingId: holiday.buildingId,
      type: holiday.type,
    })
    setSelectedCompany(holiday.companyId)
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this holiday?")) return

    try {
      await holidaysService.delete(id)
      toast({
        title: "Success",
        description: "Holiday deleted successfully",
      })
      await loadData()
    } catch (error) {
      console.error("Error deleting holiday:", error)
      toast({
        title: "Error",
        description: "Failed to delete holiday",
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setFormData({
      date: "",
      name: "",
      description: "",
      companyId: "",
      buildingId: "",
      type: "building",
    })
    setSelectedCompany("")
    setEditingHoliday(null)
  }

  const filteredHolidays = holidays.filter((holiday) => {
    const matchesCompany = !filterCompany || holiday.companyId === filterCompany
    const matchesBuilding = !filterBuilding || holiday.buildingId === filterBuilding
    const matchesMonth = !selectedMonth || holiday.date.startsWith(selectedMonth)
    return matchesCompany && matchesBuilding && matchesMonth
  })

  const getTypeColor = (type: string) => {
    switch (type) {
      case "national":
        return "bg-red-100 text-red-800"
      case "company":
        return "bg-blue-100 text-blue-800"
      case "building":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading calendar...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Corporate Calendar</h1>
          <p className="text-muted-foreground">Manage holidays for companies and buildings</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Add Holiday
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingHoliday ? "Edit Holiday" : "Add New Holiday"}</DialogTitle>
              <DialogDescription>
                {editingHoliday ? "Update the holiday details" : "Create a new holiday for a company building"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="type">Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: any) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="national">National Holiday</SelectItem>
                      <SelectItem value="company">Company Holiday</SelectItem>
                      <SelectItem value="building">Building Holiday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="name">Holiday Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Christmas Day"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>

              <div>
                <Label htmlFor="company">Company *</Label>
                <Select
                  value={formData.companyId}
                  onValueChange={(value) => {
                    setFormData({ ...formData, companyId: value, buildingId: "" })
                    setSelectedCompany(value)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="building">Building *</Label>
                <Select
                  value={formData.buildingId}
                  onValueChange={(value) => setFormData({ ...formData, buildingId: value })}
                  disabled={!selectedCompany}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select building" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredBuildings.map((building) => (
                      <SelectItem key={building.id} value={building.id}>
                        {building.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">{editingHoliday ? "Update Holiday" : "Add Holiday"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="mr-2 h-5 w-5" />
            Filter Holidays
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="filter-month">Month</Label>
              <Input
                id="filter-month"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="filter-company">Company</Label>
              <Select value={filterCompany} onValueChange={setFilterCompany}>
                <SelectTrigger>
                  <SelectValue placeholder="All companies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All companies</SelectItem>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="filter-building">Building</Label>
              <Select value={filterBuilding} onValueChange={setFilterBuilding}>
                <SelectTrigger>
                  <SelectValue placeholder="All buildings" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All buildings</SelectItem>
                  {buildings
                    .filter((b) => !filterCompany || b.companyId === filterCompany)
                    .map((building) => (
                      <SelectItem key={building.id} value={building.id}>
                        {building.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Holidays List */}
      <Card>
        <CardHeader>
          <CardTitle>Holidays ({filteredHolidays.length})</CardTitle>
          <CardDescription>
            {selectedMonth ? `Showing holidays for ${selectedMonth}` : "Showing all holidays"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredHolidays.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No holidays found for the selected filters</div>
          ) : (
            <div className="space-y-4">
              {filteredHolidays
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map((holiday) => (
                  <div key={holiday.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="font-semibold">{holiday.name}</h3>
                        <Badge className={getTypeColor(holiday.type)}>{holiday.type}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>Date: {new Date(holiday.date).toLocaleDateString()}</div>
                        <div>Company: {holiday.companyName}</div>
                        <div>Building: {holiday.buildingName}</div>
                        {holiday.description && <div>Description: {holiday.description}</div>}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(holiday)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(holiday.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
