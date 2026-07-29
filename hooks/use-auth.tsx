"use client"

import { useState, useEffect, createContext, useContext, useCallback, useRef, type ReactNode } from "react"
import { type User as FirebaseUser, signInWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth"
import { collection, query, where, getDocs, onSnapshot, or, type Unsubscribe } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { loginSessionService } from "@/lib/firestore/loginSessionService"
import { useDesktopAgent } from "./useDesktopAgent"

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
  officeLocation?: {
    address: string;
    latitude: number;
    longitude: number;
    radius: number;
  }
  assignedShifts: { 
    cafeteriaId: string; 
    shiftId: string;
    workDays: string[];
    workType: 'Remote' | 'On-site' | 'Hybrid';
  }[]
  assignedBreaks?: {
    name: string;
    durationMinutes: number;
  }[]
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
  loginSessionId: string | null
  loginSessionError: string | null
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
  const [loginSessionId, setLoginSessionId] = useState<string | null>(null)
  const [loginSessionError, setLoginSessionError] = useState<string | null>(null)
  
  // Initialize Desktop Agent Deep Tracking (No-op if running in browser)
  const { isDesktop, currentApp } = useDesktopAgent(loginSessionId);

  const [authLoading, setAuthLoading] = useState(true)     // Firebase Auth resolving
  const [accessLoading, setAccessLoading] = useState(true)  // Access paths resolving
  const loginSessionIdRef = useRef<string | null>(null)

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
        officeLocation: data.officeLocation || undefined,
        assignedShifts: data.assignedShifts || [],
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

    // Developer Role — bypass entity checks, grant specific routes
    if (profile.roleKey === "DEVELOPER") {
      setAllowedRoutes(new Set([
        "/admin",
        "/admin/task-manager",
        "/admin/ticketing"
      ]))
      setAccessLoading(false)
      return
    }

    // Employee Type — bypass entity checks, grant employee routes
    if (profile.userType === "employee") {
      setAllowedRoutes(new Set([
        "/admin",
        "/admin/task-manager",
      ]))
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

    // No entity and no role mapped — deny everything except dashboard
    if (!entityId && !profile.roleId) {
      setAllowedRoutes(new Set(["/admin"]))
      setAccessLoading(false)
      return
    }

    // Build query conditions
    // Prioritize entityId (Company/Vendor) for access paths over roleId.
    // In the UI, company access paths are assigned to the company, not the role.
    let q;
    if (entityId) {
      q = query(
        collection(db, "access_paths"),
        where("entityId", "==", entityId),
        where("status", "==", "active")
      )
    } else if (profile.roleId) {
      q = query(
        collection(db, "access_paths"),
        where("roleId", "==", profile.roleId),
        where("status", "==", "active")
      )
    } else {
      // Fallback
      setAllowedRoutes(new Set(["/admin"]))
      setAccessLoading(false)
      return
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const routes = new Set<string>()
      const denied = new Set<string>()

      snapshot.docs.forEach((doc) => {
        const data = doc.data()
        
        // Match conditions: 
        // 1. Matches user specifically
        // 2. Matches role specifically
        // 3. Matches user type globally (only if no role is defined)
        const matchesUser = data.userId === profile.id
        const matchesRole = profile.roleId ? (data.roleId === profile.roleId) : false
        // Allow type match (e.g. company_wide access) even if they have a role
        const matchesType = (data.userType === profile.userType && !data.userId && !data.roleId)
        
        console.log("DEBUG: access_paths doc:", data.id, "matchesRole:", matchesRole, "matchesType:", matchesType, "matchesUser:", matchesUser)

        if (!matchesUser && !matchesType && !matchesRole) return

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

      console.log("DEBUG: Final allowed routes for profile:", profile.email, "roleId:", profile.roleId, "routes:", Array.from(routes))

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
        console.log("DEBUG: resolveUserProfile result:", profile)
        setUserProfile(profile)

        if (profile) {
          // Setup listener — this will set accessLoading=false when ready
          console.log("DEBUG: Calling setupAccessListener")
          setupAccessListener(profile)
          
          // Start a new login session if not already started
          if (!loginSessionIdRef.current) {
            setLoginSessionError(null)
            
            // Check local storage for an active session ID for today
            const storedSessionStr = localStorage.getItem('cookhouse_session');
            let storedSessionId = null;
            if (storedSessionStr) {
              try {
                const stored = JSON.parse(storedSessionStr);
                // Only reuse if it's from today and same user
                const today = new Date().toDateString();
                if (stored.userId === profile.id && stored.date === today) {
                  storedSessionId = stored.id;
                }
              } catch (e) {}
            }

            if (storedSessionId) {
              setLoginSessionId(storedSessionId);
              loginSessionIdRef.current = storedSessionId;
            } else {
              loginSessionService.startSession(profile.id, profile.name, profile.roleKey || profile.userType).then(id => {
                setLoginSessionId(id)
                loginSessionIdRef.current = id
                localStorage.setItem('cookhouse_session', JSON.stringify({
                  id,
                  userId: profile.id,
                  date: new Date().toDateString()
                }));
              }).catch(err => {
                console.error("Login session failed:", err)
                setLoginSessionError(err.message || "Failed to start session")
              })
            }
          }
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
        if (loginSessionIdRef.current) {
          loginSessionService.endSession(loginSessionIdRef.current).catch(console.error)
          setLoginSessionId(null)
          loginSessionIdRef.current = null
          localStorage.removeItem('cookhouse_session');
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
      if (loginSessionIdRef.current) {
        await loginSessionService.endSession(loginSessionIdRef.current).catch(console.error)
        setLoginSessionId(null)
        loginSessionIdRef.current = null
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
        loginSessionId,
        loginSessionError,
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
