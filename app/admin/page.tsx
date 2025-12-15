"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, Tags, Building2, Percent, Users } from "lucide-react"

const stats = [
  { name: "Total Ingredients", value: "0", icon: Package },
  { name: "Templates", value: "0", icon: Tags },
  { name: "Brands", value: "0", icon: Building2 },
  { name: "Tax Templates", value: "0", icon: Percent },
  { name: "Suppliers", value: "0", icon: Users },
]

export default function AdminDashboard() {
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
    </div>
  )
}
