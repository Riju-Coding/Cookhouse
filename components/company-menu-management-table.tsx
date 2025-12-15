"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getDocs, collection, deleteDoc, doc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Edit2, Trash2, Plus, Loader } from "lucide-react"

interface CompanyMenu {
  id: string
  companyId: string
  companyName: string
  menuId: string
  menuName: string
  status: string
  createdAt?: string
  updatedAt?: string
}

interface Company {
  id: string
  name: string
}

export default function CompanyMenuManagementTable() {
  const router = useRouter()
  const [menus, setMenus] = useState<CompanyMenu[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompany, setSelectedCompany] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (selectedCompany) {
      loadMenusByCompany(selectedCompany)
    } else {
      setMenus([])
    }
  }, [selectedCompany])

  const loadData = async () => {
    try {
      setLoading(true)
      const companiesSnap = await getDocs(collection(db, "companies"))
      const companiesData = companiesSnap.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
      })) as Company[]
      setCompanies(companiesData)

      if (companiesData.length > 0) {
        setSelectedCompany(companiesData[0].id)
      }
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadMenusByCompany = async (companyId: string) => {
    try {
      const menusSnap = await getDocs(collection(db, "companyMenus"))
      const menusData = menusSnap.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((menu: any) => menu.companyId === companyId) as CompanyMenu[]
      setMenus(menusData)
    } catch (error) {
      console.error("Error loading menus:", error)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      setDeleting(id)
      await deleteDoc(doc(db, "companyMenus", id))
      setMenus(menus.filter((m) => m.id !== id))
    } catch (error) {
      console.error("Error deleting menu:", error)
    } finally {
      setDeleting(null)
    }
  }

  const handleEdit = (id: string) => {
    router.push(`/company-menus/${id}/edit`)
  }

  const handleCreate = () => {
    if (selectedCompany) {
      router.push(`/company-menus/new?companyId=${selectedCompany}`)
    }
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Company Menus</h1>
          <p className="text-muted-foreground">Manage menus assigned to companies</p>
        </div>
        <Button onClick={handleCreate} disabled={!selectedCompany} className="gap-2">
          <Plus className="h-4 w-4" />
          New Menu
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Company</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedCompany} onValueChange={setSelectedCompany}>
            <SelectTrigger className="w-full md:w-64">
              <SelectValue placeholder="Select a company" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedCompany && (
        <Card>
          <CardHeader>
            <CardTitle>
              Menus for {companies.find((c) => c.id === selectedCompany)?.name || "Selected Company"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : menus.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No menus assigned to this company yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Menu Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {menus.map((menu) => (
                      <TableRow key={menu.id}>
                        <TableCell className="font-medium">{menu.menuName}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              menu.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {menu.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {menu.createdAt ? new Date(menu.createdAt).toLocaleDateString() : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(menu.id)} className="gap-2">
                              <Edit2 className="h-4 w-4" />
                              Edit
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive gap-2"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogTitle>Delete Menu Assignment</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove "{menu.menuName}" from this company? This action
                                  cannot be undone.
                                </AlertDialogDescription>
                                <div className="flex justify-end gap-2">
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(menu.id)}
                                    disabled={deleting === menu.id}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    {deleting === menu.id ? "Deleting..." : "Delete"}
                                  </AlertDialogAction>
                                </div>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
