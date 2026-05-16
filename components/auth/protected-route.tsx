"use client"

import type React from "react"

import { useAuth } from "@/hooks/use-auth"
import { LoginForm } from "./login-form"

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, userProfile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  // Not authenticated or no profile in users collection
  if (!user || !userProfile) {
    return <LoginForm />
  }

  // User account is disabled
  if (userProfile.status === "inactive") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3 max-w-md p-8">
          <h2 className="text-xl font-bold text-gray-900">Account Disabled</h2>
          <p className="text-sm text-gray-500">
            Your account has been disabled. Please contact your administrator.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
