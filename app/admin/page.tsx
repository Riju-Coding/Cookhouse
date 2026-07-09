"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, Tags, Building2, Percent, Users, LayoutDashboard, Search } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { CompanyAdminDashboard } from "@/components/dashboards/CompanyAdminDashboard"
import { useEffect, useState } from "react"
import { db } from "@/lib/firebase"
import { collection, getDocs } from "firebase/firestore"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const stats = [
  { name: "Total Ingredients", value: "0", icon: Package },
  { name: "Templates", value: "0", icon: Tags },
  { name: "Brands", value: "0", icon: Building2 },
  { name: "Tax Templates", value: "0", icon: Percent },
  { name: "Suppliers", value: "0", icon: Users },
]

export default function AdminDashboard() {
  const { userProfile } = useAuth();
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

  useEffect(() => {
    if (userProfile?.userType === 'admin' || userProfile?.userType === 'super_admin' || userProfile?.userType === 'vendor_admin') {
      const fetchCompanies = async () => {
        const snap = await getDocs(collection(db, 'companies'));
        const companyList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCompanies(companyList);
        if (companyList.length > 0) {
          setSelectedCompanyId(companyList[0].id);
        }
      };
      fetchCompanies();
    }
  }, [userProfile]);

  if (userProfile?.userType === 'company_user') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-indigo-600" />
            Company Dashboard
          </h1>
          <p className="text-gray-600">Welcome to your management overview.</p>
        </div>
        <CompanyAdminDashboard />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome to Cookhouse Admin Panel</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.name}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.name}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Get started by managing your collections</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="text-center p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <Package className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <h3 className="font-medium">Add Ingredient</h3>
            </div>
            <div className="text-center p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <Tags className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <h3 className="font-medium">Add Template</h3>
            </div>
            <div className="text-center p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <Building2 className="h-8 w-8 mx-auto mb-2 text-purple-600" />
              <h3 className="font-medium">Add Brand</h3>
            </div>
            <div className="text-center p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <Users className="h-8 w-8 mx-auto mb-2 text-orange-600" />
              <h3 className="font-medium">Add Supplier</h3>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Global Manpower Overview for Admins and Vendor Admins */}
      {(userProfile?.userType === 'admin' || userProfile?.userType === 'super_admin' || userProfile?.userType === 'vendor_admin') && (
        <Card className="mt-8 border-indigo-100 shadow-sm">
          <CardHeader className="bg-indigo-50/50 pb-4 border-b border-indigo-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-indigo-900">
                  <Search className="h-5 w-5 text-indigo-600" />
                  Inspect Company Manpower
                </CardTitle>
                <CardDescription>View live compliance and attendance tracking for a specific company.</CardDescription>
              </div>
              {companies.length > 0 && (
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger className="w-[250px] bg-white">
                    <SelectValue placeholder="Select a company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map(company => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name || 'Unnamed Company'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {selectedCompanyId ? (
              <CompanyAdminDashboard companyIdOverride={selectedCompanyId} />
            ) : (
              <div className="text-center py-8 text-gray-400">
                {companies.length === 0 ? "Loading companies..." : "Select a company to view data"}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
