"use client"

import { useState, useEffect, createContext, useContext, type ReactNode } from "react"
import { type User, signInWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth"
import { collection, query, where, getDocs } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"

interface AuthContextType {
  user: User | null
  isAdmin: boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<boolean>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user)

      if (user) {
        try {
          const usersQuery = query(collection(db, "users"), where("email", "==", user.email))
          const querySnapshot = await getDocs(usersQuery)
          setIsAdmin(!querySnapshot.empty)
        } catch (error) {
          console.error("Error checking user in collection:", error)
          setIsAdmin(false)
        }
      } else {
        setIsAdmin(false)
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const signIn = async (email: string, password: string): Promise<boolean> => {
    try {
      const usersQuery = query(collection(db, "users"), where("email", "==", email))
      const querySnapshot = await getDocs(usersQuery)

      if (querySnapshot.empty) {
        throw new Error("User not authorized for admin access")
      }

      // If user exists in collection, proceed with Firebase auth
      await signInWithEmailAndPassword(auth, email, password)
      return true
    } catch (error) {
      console.error("Sign in error:", error)
      return false
    }
  }

  const signOut = async () => {
    try {
      await firebaseSignOut(auth)
    } catch (error) {
      console.error("Sign out error:", error)
    }
  }

  return <AuthContext.Provider value={{ user, isAdmin, loading, signIn, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
