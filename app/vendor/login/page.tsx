"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth"
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"

// UI Components
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ChefHat, Eye, EyeOff, ArrowLeft, Loader2, CheckCircle } from "lucide-react"

export default function VendorLoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<"login" | "register">("login")

  // Login state
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // Register state
  const [regEmail, setRegEmail] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [regConfirmPassword, setRegConfirmPassword] = useState("")
  const [regName, setRegName] = useState("")
  const [regStep, setRegStep] = useState<"verify" | "credentials">("verify")
  const [verifiedVendor, setVerifiedVendor] = useState<any>(null)
  const [regSuccess, setRegSuccess] = useState(false)

  // ─── LOGIN HANDLER ──────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const usersQuery = query(
        collection(db, "users"),
        where("email", "==", email)
      )
      const userSnap = await getDocs(usersQuery)

      if (userSnap.empty) {
        setError("No vendor account found with this email. Please register first.")
        setLoading(false)
        return
      }

      const userData = userSnap.docs[0].data()

      if (userData.userType !== "vendor_staff") {
        setError("This account is not a vendor login. Please use the correct login page.")
        setLoading(false)
        return
      }

      if (userData.status === "inactive") {
        setError("Account is disabled. Contact your administrator.")
        setLoading(false)
        return
      }

      await signInWithEmailAndPassword(auth, email, password)
      router.push("/admin")
    } catch (error: any) {
      if (error.code === "auth/user-not-found") {
        setError("No account found. Please register first.")
      } else if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
        setError("Incorrect password.")
      } else {
        setError("Login failed. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  // ─── VERIFY EMAIL ─────────────────────────────────────────────────────────
  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      // Check if this email is a contact email in vendors collection
      const vendorsQuery = query(
        collection(db, "vendors"),
        where("email", "==", regEmail)
      )
      const vendorsSnap = await getDocs(vendorsQuery)

      if (vendorsSnap.empty) {
        setError(
          "This email is not registered as a vendor contact. " +
          "The Cookhouse team must first register your vendor with this email."
        )
        setLoading(false)
        return
      }

      // Check if already registered
      const usersQuery = query(
        collection(db, "users"),
        where("email", "==", regEmail)
      )
      const usersSnap = await getDocs(usersQuery)
      if (!usersSnap.empty) {
        setError("An account with this email already exists. Please login instead.")
        setLoading(false)
        return
      }

      const vendorDoc = vendorsSnap.docs[0]
      setVerifiedVendor({ id: vendorDoc.id, ...vendorDoc.data() })
      setRegStep("credentials")
    } catch (error) {
      setError("Verification failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // ─── REGISTER ─────────────────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (regPassword !== regConfirmPassword) {
      setError("Passwords do not match.")
      return
    }

    if (regPassword.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }

    setLoading(true)

    try {
      const credential = await createUserWithEmailAndPassword(auth, regEmail, regPassword)

      await addDoc(collection(db, "users"), {
        name: regName || verifiedVendor?.contactPerson || verifiedVendor?.name,
        email: regEmail,
        phone: verifiedVendor?.phone || "",
        userType: "vendor_staff",
        roleId: "",
        roleKey: "VENDOR_ADMIN",
        vendorId: verifiedVendor?.id,
        companyIds: [],
        buildingIds: [],
        cafeteriaIds: [],
        managerId: "",
        status: "active",
        firebaseUid: credential.user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      setRegSuccess(true)
    } catch (error: any) {
      if (error.code === "auth/email-already-in-use") {
        setError("An account with this email already exists in the auth system. Please login.")
      } else {
        setError("Registration failed. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  // ─── SUCCESS SCREEN ─────────────────────────────────────────────────────────
  if (regSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="pt-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Registration Complete!</h2>
            <p className="text-sm text-gray-500">
              Your vendor account for <strong>{verifiedVendor?.name}</strong> has been created.
              You can now log in with your credentials.
            </p>
            <Button onClick={() => { setMode("login"); setEmail(regEmail); setRegSuccess(false) }} className="w-full">
              Continue to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── LOGIN FORM ─────────────────────────────────────────────────────────────
  if (mode === "login") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-1 text-center">
            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-2">
              <ChefHat className="h-6 w-6 text-orange-600" />
            </div>
            <CardTitle className="text-2xl font-bold">Vendor Login</CardTitle>
            <CardDescription>Sign in to your vendor dashboard</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="vendor@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700" disabled={loading}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...</> : "Sign In"}
              </Button>
            </form>

            <div className="mt-6 text-center space-y-2">
              <p className="text-sm text-gray-600">
                First time?{" "}
                <button
                  onClick={() => { setMode("register"); setError("") }}
                  className="text-orange-600 hover:underline font-medium"
                >
                  Register your vendor account
                </button>
              </p>
              <p className="text-xs text-gray-400">
                <button onClick={() => router.push("/login")} className="hover:underline">
                  ← Back to Admin Login
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── REGISTER FORM ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-2">
            <ChefHat className="h-6 w-6 text-orange-600" />
          </div>
          <CardTitle className="text-2xl font-bold">Vendor Registration</CardTitle>
          <CardDescription>
            {regStep === "verify"
              ? "Enter your vendor contact email to verify"
              : `Create credentials for ${verifiedVendor?.name}`}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {regStep === "verify" ? (
            <form onSubmit={handleVerifyEmail} className="space-y-4">
              <div className="space-y-2">
                <Label>Vendor Contact Email</Label>
                <Input
                  type="email"
                  placeholder="The email registered with Cookhouse"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                />
                <p className="text-[11px] text-gray-400">
                  This must match the contact email Cookhouse has on file for your catering business.
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700" disabled={loading}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</> : "Verify Email"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm">
                <p className="text-green-700 font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" /> Verified: {verifiedVendor?.name}
                </p>
                <p className="text-green-600 text-xs mt-1">{regEmail}</p>
              </div>

              <div className="space-y-2">
                <Label>Your Name</Label>
                <Input
                  placeholder="Your full name"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Create Password</Label>
                <Input
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <Input
                  type="password"
                  placeholder="Re-enter password"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700" disabled={loading}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Account...</> : "Create Account"}
              </Button>
            </form>
          )}

          <div className="mt-4 text-center">
            <button
              onClick={() => { setMode("login"); setError(""); setRegStep("verify") }}
              className="text-sm text-gray-500 hover:underline flex items-center gap-1 mx-auto"
            >
              <ArrowLeft className="h-3 w-3" /> Back to Login
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
