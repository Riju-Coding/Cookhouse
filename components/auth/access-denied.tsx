"use client"

import { Shield, ArrowLeft, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"

export function AccessDenied() {
  const { signOut, userProfile } = useAuth()
  const router = useRouter()

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-6 max-w-md mx-auto p-8">
        {/* Icon */}
        <div className="relative mx-auto w-20 h-20">
          <div className="absolute inset-0 rounded-full bg-red-100 animate-pulse" />
          <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-red-50 border-2 border-red-200">
            <Shield className="h-10 w-10 text-red-500" />
          </div>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
          <p className="text-gray-500 text-sm leading-relaxed">
            You don&apos;t have permission to access this page.
            {userProfile?.userType === "company_user" && (
              <> Your company administrator can request access from Cookhouse support.</>
            )}
            {userProfile?.userType === "vendor_staff" && (
              <> Contact your vendor admin to update your access permissions.</>
            )}
          </p>
        </div>

        {/* User Info */}
        {userProfile && (
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-500">
            <p>Logged in as: <span className="font-semibold text-gray-700">{userProfile.email}</span></p>
            <p>Role: <span className="font-semibold text-gray-700 uppercase">{userProfile.roleKey || userProfile.userType}</span></p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" onClick={() => router.push("/admin")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Go to Dashboard
          </Button>
          <Button variant="ghost" onClick={signOut} className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50">
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  )
}
