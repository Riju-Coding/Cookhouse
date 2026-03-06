import { AdminLayout } from "@/components/admin/admin-layout"
import { ProtectedRoute } from "@/components/auth/protected-route"

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
  <ProtectedRoute>
  <AdminLayout>{children}</AdminLayout>
  </ProtectedRoute>
  )
  
}