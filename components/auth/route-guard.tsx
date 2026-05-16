"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { AccessDenied } from "./access-denied"
import { Loader2 } from "lucide-react"

interface RouteGuardProps {
  children: React.ReactNode
}

/**
 * RouteGuard wraps page content and checks access on every route change.
 * - Super Admin always passes.
 * - Other users are checked against their access_paths in real-time.
 * - Shows a loading skeleton while resolving, then 403 if denied.
 */
export function RouteGuard({ children }: RouteGuardProps) {
  const { loading, userProfile, hasRouteAccess, isSuperAdmin } = useAuth()
  const pathname = usePathname()

  // Still loading auth state
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <p className="text-sm text-gray-500">Verifying access...</p>
        </div>
      </div>
    )
  }

  // No profile means not authorized at all — handled by ProtectedRoute
  if (!userProfile) {
    return null
  }

  // Super Admin bypasses all checks
  if (isSuperAdmin) {
    return <>{children}</>
  }

  // Check route access
  if (!hasRouteAccess(pathname)) {
    return <AccessDenied />
  }

  return <>{children}</>
}
