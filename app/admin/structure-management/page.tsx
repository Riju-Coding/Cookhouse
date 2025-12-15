"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, Search, Eye, Calendar } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  structureAssignmentService,
  companiesService,
  buildingsService,
  servicesService,
  subServicesService,
} from "@/lib/firestore"
import Link from "next/link"

interface StructureAssignment {
  id: string
  companyId: string
  buildingId: string
  weeklyStructure: {
    [day: string]: {
      services: {
        serviceId: string
        subServices: {
          subServiceId: string
          rate: number
        }[]
      }[]
    }
  }
  createdAt: any
  updatedAt: any
}

interface Company {
  id: string
  name: string
}

interface Building {
  id: string
  name: string
  companyId: string
}

interface Service {
  id: string
  name: string
}

interface SubService {
  id: string
  name: string
  serviceId: string
}

export default function StructureManagementPage() {
  const [structures, setStructures] = useState<StructureAssignment[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [subServices, setSubServices] = useState<SubService[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [viewingStructure, setViewingStructure] = useState<StructureAssignment | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)

  const daysOfWeek = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [structuresData, companiesData, buildingsData, servicesData, subServicesData] = await Promise.all([
        structureAssignmentService.getAll(),
        companiesService.getAll(),
        buildingsService.getAll(),
        servicesService.getAll(),
        subServicesService.getAll(),
      ])

      setStructures(structuresData)
      setCompanies(companiesData)
      setBuildings(buildingsData)
      setServices(servicesData)
      setSubServices(subServicesData)
    } catch (error) {
      console.error("Error loading data:", error)
      toast.error("Failed to load structure assignments")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this structure assignment?")) {
      return
    }

    try {
      await structureAssignmentService.delete(id)
      toast.success("Structure assignment deleted successfully")
      loadData()
    } catch (error) {
      console.error("Error deleting structure:", error)
      toast.error("Failed to delete structure assignment")
    }
  }

  const handleView = (structure: StructureAssignment) => {
    setViewingStructure(structure)
    setIsViewDialogOpen(true)
  }

  const getCompanyName = (companyId: string) => {
    const company = companies.find((c) => c.id === companyId)
    return company?.name || "Unknown Company"
  }

  const getBuildingName = (buildingId: string) => {
    const building = buildings.find((b) => b.id === buildingId)
    return building?.name || "Unknown Building"
  }

  const getServiceName = (serviceId: string) => {
    const service = services.find((s) => s.id === serviceId)
    return service?.name || "Unknown Service"
  }

  const getSubServiceName = (subServiceId: string) => {
    const subService = subServices.find((ss) => ss.id === subServiceId)
    return subService?.name || "Unknown Sub Service"
  }

  const getTotalServicesCount = (structure: StructureAssignment) => {
    if (!structure.weeklyStructure) return 0

    let total = 0
    daysOfWeek.forEach((day) => {
      if (structure.weeklyStructure[day]?.services) {
        total += structure.weeklyStructure[day].services.length
      }
    })
    return total
  }

  const getActiveDaysCount = (structure: StructureAssignment) => {
    if (!structure.weeklyStructure) return 0

    return daysOfWeek.filter(
      (day) => structure.weeklyStructure[day]?.services && structure.weeklyStructure[day].services.length > 0,
    ).length
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A"

    // Handle Firestore Timestamp objects
    if (timestamp.toDate && typeof timestamp.toDate === "function") {
      return timestamp.toDate().toLocaleDateString()
    }

    // Handle JavaScript Date objects
    if (timestamp instanceof Date) {
      return timestamp.toLocaleDateString()
    }

    // Handle timestamp strings or numbers
    if (typeof timestamp === "string" || typeof timestamp === "number") {
      return new Date(timestamp).toLocaleDateString()
    }

    return "N/A"
  }

  const filteredStructures = structures.filter((structure) => {
    const companyName = getCompanyName(structure.companyId).toLowerCase()
    const buildingName = getBuildingName(structure.buildingId).toLowerCase()
    const searchLower = searchTerm.toLowerCase()

    return companyName.includes(searchLower) || buildingName.includes(searchLower)
  })

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Structure Management</CardTitle>
              <CardDescription>
                Manage building structure assignments with edit and delete functionality
              </CardDescription>
            </div>
            <Link href="/admin/structure-assignment">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create New Structure
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <Search className="h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by company or building name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Building</TableHead>
                  <TableHead>Active Days</TableHead>
                  <TableHead>Total Services</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="w-[150px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStructures.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      No structure assignments found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStructures.map((structure) => (
                    <TableRow key={structure.id}>
                      <TableCell className="font-medium">{getCompanyName(structure.companyId)}</TableCell>
                      <TableCell>{getBuildingName(structure.buildingId)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          <Calendar className="mr-1 h-3 w-3" />
                          {getActiveDaysCount(structure)}/7 days
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getTotalServicesCount(structure)} services</Badge>
                      </TableCell>
                      <TableCell>{formatDate(structure.createdAt)}</TableCell>
                      <TableCell>{formatDate(structure.updatedAt)}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => handleView(structure)} title="View Details">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Link href={`/admin/structure-assignment?edit=${structure.id}`}>
                            <Button variant="ghost" size="sm" title="Edit Structure">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(structure.id)}
                            title="Delete Structure"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* View Structure Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Structure Details</DialogTitle>
            <DialogDescription>
              {viewingStructure && (
                <>
                  {getCompanyName(viewingStructure.companyId)} - {getBuildingName(viewingStructure.buildingId)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {viewingStructure && (
            <div className="space-y-6">
              {daysOfWeek.map((day) => {
                const dayData = viewingStructure.weeklyStructure?.[day]
                const hasServices = dayData?.services && dayData.services.length > 0

                return (
                  <div key={day} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold capitalize text-lg">{day}</h3>
                      <Badge variant={hasServices ? "default" : "secondary"}>
                        {hasServices ? `${dayData.services.length} services` : "No services"}
                      </Badge>
                    </div>

                    {hasServices ? (
                      <div className="space-y-3">
                        {dayData.services.map((service, serviceIndex) => (
                          <div key={serviceIndex} className="bg-gray-50 rounded-md p-3">
                            <h4 className="font-medium text-blue-600 mb-2">{getServiceName(service.serviceId)}</h4>
                            {service.subServices && service.subServices.length > 0 && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {service.subServices.map((subService, subIndex) => (
                                  <div
                                    key={subIndex}
                                    className="flex justify-between items-center bg-white rounded px-3 py-2 text-sm"
                                  >
                                    <span>{getSubServiceName(subService.subServiceId)}</span>
                                    <Badge variant="outline">₹{subService.rate}</Badge>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No services assigned for this day</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
            {viewingStructure && (
              <Link href={`/admin/structure-assignment?edit=${viewingStructure.id}`}>
                <Button>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Structure
                </Button>
              </Link>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
