import { AdminLayout } from "@/components/admin/admin-layout"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { RouteGuard } from "@/components/auth/route-guard"

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
  <ProtectedRoute>
  <AdminLayout><RouteGuard>{children}</RouteGuard></AdminLayout>
  </ProtectedRoute>
  )
  
}