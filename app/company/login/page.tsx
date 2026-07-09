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
import { Building2, Eye, EyeOff, ArrowLeft, Loader2, CheckCircle } from "lucide-react"

export default function CompanyLoginPage() {
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
  const [verifiedCompany, setVerifiedCompany] = useState<any>(null)
  const [regSuccess, setRegSuccess] = useState(false)

  // ─── LOGIN HANDLER ──────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      // Check if this email exists in users collection with userType company_user
      const usersQuery = query(
        collection(db, "users"),
        where("email", "==", email)
      )
      const userSnap = await getDocs(usersQuery)

      if (userSnap.empty) {
        setError("No company account found with this email. Please register first.")
        setLoading(false)
        return
      }

      const userData = userSnap.docs[0].data()

      if (userData.userType !== "company_user") {
        setError("This account is not a company login. Please use the correct login page.")
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

  // ─── VERIFY EMAIL (Registration Step 1) ─────────────────────────────────────
  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      // Check if already created by admin in users collection
      const usersQuery = query(
        collection(db, "users"),
        where("email", "==", regEmail),
        where("userType", "==", "company_user")
      )
      const usersSnap = await getDocs(usersQuery)

      if (usersSnap.empty) {
        setError("This email is not registered as a company user. Your admin must add your email in User Management first.")
        setLoading(false)
        return
      }

      const userDoc = usersSnap.docs[0];
      const userData = userDoc.data();

      // Check if they already have a firebaseUid (meaning they already registered auth)
      if (userData.firebaseUid) {
        setError("An account with this email is already fully registered. Please login instead.")
        setLoading(false)
        return
      }

      // Fetch the company name for the success UI
      let companyName = "Your Company";
      if (userData.companyIds && userData.companyIds.length > 0) {
        const companyDoc = await getDocs(query(collection(db, "companies"), where("__name__", "==", userData.companyIds[0])));
        if (!companyDoc.empty) {
          companyName = companyDoc.docs[0].data().name;
        }
      }

      setVerifiedCompany({ id: userDoc.id, name: companyName, ...userData })
      setRegStep("credentials")
    } catch (error) {
      setError("Verification failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // ─── REGISTER (Registration Step 2) ─────────────────────────────────────────
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
      // Create Firebase Auth account
      const credential = await createUserWithEmailAndPassword(auth, regEmail, regPassword)

      // Update existing user document in Firestore with firebaseUid
      const { doc, updateDoc } = await import("firebase/firestore")
      await updateDoc(doc(db, "users", verifiedCompany.id), {
        firebaseUid: credential.user.uid,
        name: regName || verifiedCompany.name,
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="pt-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Registration Complete!</h2>
            <p className="text-sm text-gray-500">
              Your company account for <strong>{verifiedCompany?.name}</strong> has been created.
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-1 text-center">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-2">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold">Company Login</CardTitle>
            <CardDescription>Sign in to your company dashboard</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="company@example.com"
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

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...</> : "Sign In"}
              </Button>
            </form>

            <div className="mt-6 text-center space-y-2">
              <p className="text-sm text-gray-600">
                First time?{" "}
                <button
                  onClick={() => { setMode("register"); setError("") }}
                  className="text-blue-600 hover:underline font-medium"
                >
                  Register your company account
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-2">
            <Building2 className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold">Company Registration</CardTitle>
          <CardDescription>
            {regStep === "verify"
              ? "Enter your company contact email to verify"
              : `Create credentials for ${verifiedCompany?.name}`}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {regStep === "verify" ? (
            <form onSubmit={handleVerifyEmail} className="space-y-4">
              <div className="space-y-2">
                <Label>Company Contact Email</Label>
                <Input
                  type="email"
                  placeholder="The email registered with Cookhouse"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                />
                <p className="text-[11px] text-gray-400">
                  This must match the contact email your company admin provided to Cookhouse.
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</> : "Verify Email"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Company Info */}
              <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm">
                <p className="text-green-700 font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" /> Verified: {verifiedCompany?.name}
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

              <Button type="submit" className="w-full" disabled={loading}>
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
