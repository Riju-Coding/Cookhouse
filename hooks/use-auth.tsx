"use client"

import { useState, useEffect, createContext, useContext, useCallback, useRef, type ReactNode } from "react"
import { type User as FirebaseUser, signInWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth"
import { collection, query, where, getDocs, onSnapshot, type Unsubscribe } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"

// ─── TYPES ──────────────────────────────────────────────────────────────────────

export type UserType = "super_admin" | "vendor_staff" | "company_user" | "employee"

export interface UserProfile {
  id: string
  name: string
  email: string
  phone: string
  userType: UserType
  roleId: string
  roleKey: string
  vendorId: string
  companyIds: string[]
  buildingIds: string[]
  cafeteriaIds: string[]
  managerId: string
  status: "active" | "inactive"
}

export interface SignInResult {
  success: boolean
  error?: string
  userType?: UserType
}

interface AuthContextType {
  user: FirebaseUser | null
  userProfile: UserProfile | null
  userType: UserType | null
  allowedRoutes: Set<string>
  loading: boolean
  signIn: (email: string, password: string) => Promise<SignInResult>
  signOut: () => Promise<void>
  hasRouteAccess: (path: string) => boolean
  isSuperAdmin: boolean
}

// ─── CONTEXT ────────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// ─── SUPER ADMIN EMAIL ──────────────────────────────────────────────────────────
const SUPER_ADMIN_EMAIL = "it-team@cookhouse.in"

// ─── PROVIDER ───────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [allowedRoutes, setAllowedRoutes] = useState<Set<string>>(new Set())
  const [authLoading, setAuthLoading] = useState(true)     // Firebase Auth resolving
  const [accessLoading, setAccessLoading] = useState(true)  // Access paths resolving

  // Combined loading — both must be resolved before anything renders
  const loading = authLoading || accessLoading

  // Ref to track the active access_paths unsubscribe
  const accessUnsubRef = useRef<Unsubscribe | null>(null)

  // Derived states
  const userType = userProfile?.userType || null
  const isSuperAdmin = userProfile?.userType === "super_admin" || userProfile?.email === SUPER_ADMIN_EMAIL

  // ─── Resolve user profile from Firestore ──────────────────────────────────────
  const resolveUserProfile = useCallback(async (firebaseUser: FirebaseUser): Promise<UserProfile | null> => {
    try {
      const usersQuery = query(collection(db, "users"), where("email", "==", firebaseUser.email))
      const querySnapshot = await getDocs(usersQuery)

      if (querySnapshot.empty) return null

      const userDoc = querySnapshot.docs[0]
      const data = userDoc.data()

      return {
        id: userDoc.id,
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        userType: data.userType || (data.email === SUPER_ADMIN_EMAIL ? "super_admin" : "company_user"),
        roleId: data.roleId || "",
        roleKey: data.roleKey || "",
        vendorId: data.vendorId || "",
        companyIds: data.companyIds || [],
        buildingIds: data.buildingIds || [],
        cafeteriaIds: data.cafeteriaIds || [],
        managerId: data.managerId || "",
        status: data.status || "active",
      } as UserProfile
    } catch (error) {
      console.error("Error resolving user profile:", error)
      return null
    }
  }, [])

  // ─── Setup access_paths listener for a given profile ──────────────────────────
  const setupAccessListener = useCallback((profile: UserProfile) => {
    // Tear down any previous listener
    if (accessUnsubRef.current) {
      accessUnsubRef.current()
      accessUnsubRef.current = null
    }

    // Super Admin — instant resolution, bypass all checks
    const profileIsSuperAdmin = profile.userType === "super_admin" || profile.email === SUPER_ADMIN_EMAIL
    if (profileIsSuperAdmin) {
      setAllowedRoutes(new Set(["__ALL__"]))
      setAccessLoading(false)
      return
    }

    // Determine entityId
    let entityId: string | null = null
    if (profile.userType === "vendor_staff" && profile.vendorId) {
      entityId = profile.vendorId
    } else if (profile.userType === "company_user" && profile.companyIds?.length > 0) {
      entityId = profile.companyIds[0]
    }

    // No entity mapped — deny everything except dashboard
    if (!entityId) {
      setAllowedRoutes(new Set(["/admin"]))
      setAccessLoading(false)
      return
    }

    // Real-time listener on access_paths
    // We fetch everything for this entity and filter by userType or userId on client
    const q = query(
      collection(db, "access_paths"),
      where("entityId", "==", entityId),
      where("status", "==", "active")
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const routes = new Set<string>()
      const denied = new Set<string>()

      snapshot.docs.forEach((doc) => {
        const data = doc.data()
        
        // Only apply if it matches this specific user OR their user type
        const matchesUser = data.userId === profile.id
        const matchesType = data.userType === profile.userType && !data.userId
        
        if (!matchesUser && !matchesType) return

        if (data.allowedRoutes) {
          data.allowedRoutes.forEach((r: string) => routes.add(r))
        }
        if (data.deniedRoutes) {
          data.deniedRoutes.forEach((r: string) => denied.add(r))
        }
      })

      // Remove denied routes
      denied.forEach((r) => routes.delete(r))

      // Always allow dashboard
      routes.add("/admin")

      setAllowedRoutes(routes)
      setAccessLoading(false)  // Access is resolved
    }, (error) => {
      console.error("Error subscribing to access_paths:", error)
      // On error, allow only dashboard
      setAllowedRoutes(new Set(["/admin"]))
      setAccessLoading(false)
    })

    accessUnsubRef.current = unsubscribe
  }, [])

  // ─── Firebase Auth state listener ─────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)

      if (firebaseUser) {
        setAccessLoading(true) // Reset access loading when auth changes

        const profile = await resolveUserProfile(firebaseUser)
        setUserProfile(profile)

        if (profile) {
          // Setup listener — this will set accessLoading=false when ready
          setupAccessListener(profile)
        } else {
          // No profile in users collection
          setAllowedRoutes(new Set())
          setAccessLoading(false)
        }
      } else {
        // Signed out
        if (accessUnsubRef.current) {
          accessUnsubRef.current()
          accessUnsubRef.current = null
        }
        setUserProfile(null)
        setAllowedRoutes(new Set())
        setAccessLoading(false)
      }

      setAuthLoading(false)
    })

    return () => {
      unsubscribe()
      if (accessUnsubRef.current) {
        accessUnsubRef.current()
      }
    }
  }, [resolveUserProfile, setupAccessListener])

  // ─── Route access check ───────────────────────────────────────────────────────
  const hasRouteAccess = useCallback(
    (path: string): boolean => {
      // Still loading — deny (loading UI shown by RouteGuard/ProtectedRoute)
      if (loading) return false

      // No profile — deny
      if (!userProfile) return false

      // Super Admin — always allow
      if (isSuperAdmin) return true

      // Dashboard is always accessible for any authenticated user
      if (path === "/admin") return true

      // Check exact match in allowed routes
      if (allowedRoutes.has(path)) return true

      // Check parent route match for sub-pages only
      // e.g., if "/admin/companies" is allowed, then "/admin/companies/[id]" is also allowed
      // BUT skip "/admin" itself — it must NOT act as a wildcard for all sub-routes
      for (const route of allowedRoutes) {
        if (route === "/admin") continue  // Skip — dashboard is not a wildcard
        if (path.startsWith(route + "/")) return true
      }

      return false
    },
    [loading, userProfile, isSuperAdmin, allowedRoutes]
  )

  // ─── Sign In ──────────────────────────────────────────────────────────────────
  const signIn = async (email: string, password: string): Promise<SignInResult> => {
    try {
      // Check if user exists in users collection
      const usersQuery = query(collection(db, "users"), where("email", "==", email))
      const querySnapshot = await getDocs(usersQuery)

      if (querySnapshot.empty) {
        return { success: false, error: "User not authorized for admin access" }
      }

      const userData = querySnapshot.docs[0].data()

      // Check if user is active
      if (userData.status === "inactive") {
        return { success: false, error: "Account is disabled. Contact your administrator." }
      }

      // Proceed with Firebase auth
      await signInWithEmailAndPassword(auth, email, password)

      return {
        success: true,
        userType: userData.userType || "company_user",
      }
    } catch (error: any) {
      console.error("Sign in error:", error)

      if (error.code === "auth/user-not-found") {
        return { success: false, error: "No account found with this email. Please register first." }
      }
      if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
        return { success: false, error: "Incorrect password." }
      }

      return { success: false, error: "Login failed. Please try again." }
    }
  }

  // ─── Sign Out ─────────────────────────────────────────────────────────────────
  const signOut = async () => {
    try {
      if (accessUnsubRef.current) {
        accessUnsubRef.current()
        accessUnsubRef.current = null
      }
      await firebaseSignOut(auth)
      setUserProfile(null)
      setAllowedRoutes(new Set())
    } catch (error) {
      console.error("Sign out error:", error)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        userType,
        allowedRoutes,
        loading,
        signIn,
        signOut,
        hasRouteAccess,
        isSuperAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
