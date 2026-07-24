"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { techCandidatesService } from "@/lib/services"

export default function ExamLogin() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setLoading(true)
    setError("")
    
    try {
      const candidate = await techCandidatesService.getByEmail(email.trim().toLowerCase())
      
      if (!candidate) {
        setError("No pending exam found for this email address.")
        setLoading(false)
        return
      }
      
      // Found candidate, redirect to exam portal
      router.push(`/exam/${candidate.id}`)
    } catch (err) {
      console.error(err)
      setError("An error occurred. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Tech Assessment</CardTitle>
          <CardDescription>Enter your registered email address to start</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Input 
                type="email" 
                placeholder="developer@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verifying..." : "Start Exam"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
