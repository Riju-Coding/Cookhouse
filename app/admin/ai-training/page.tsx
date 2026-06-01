"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Loader2, Upload, BrainCircuit, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { servicesService, subServicesService } from "@/lib/services"
import type { Service, SubService } from "@/lib/types"
import * as XLSX from "xlsx"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

export default function AITrainingPage() {
  const [loading, setLoading] = useState(true)
  const [training, setTraining] = useState(false)

  // Master Data
  const [services, setServices] = useState<Service[]>([])
  const [subServices, setSubServices] = useState<SubService[]>([])

  // Selection State
  const [selectedServiceId, setSelectedServiceId] = useState<string>("")
  const [selectedSubServiceId, setSelectedSubServiceId] = useState<string>("")
  
  // File State
  const [files, setFiles] = useState<File[]>([])
  const [parsedData, setParsedData] = useState<any[]>([])
  const [existingProfile, setExistingProfile] = useState<string | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        const [svcs, ssvcs] = await Promise.all([
          servicesService.getActive(),
          subServicesService.getActive()
        ])
        setServices(svcs.sort((a, b) => (a.order || 0) - (b.order || 0)))
        setSubServices(ssvcs.sort((a, b) => (a.order || 0) - (b.order || 0)))
      } catch (error) {
        console.error(error)
        toast({ title: "Error loading services", variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  useEffect(() => {
    async function fetchProfile() {
      if (!selectedServiceId || !selectedSubServiceId) {
        setExistingProfile(null)
        return
      }
      setLoadingProfile(true)
      const docId = `${selectedServiceId}_${selectedSubServiceId}`
      try {
        const snap = await getDoc(doc(db, "aiTrainingProfiles", docId))
        if (snap.exists()) {
          setExistingProfile(snap.data().profileText)
        } else {
          setExistingProfile(null)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoadingProfile(false)
      }
    }
    fetchProfile()
  }, [selectedServiceId, selectedSubServiceId])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const uploadedFiles = Array.from(e.target.files)
    setFiles(uploadedFiles)

    // Parse all files
    const allData: any[] = []
    
    for (const file of uploadedFiles) {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: "array" })
      
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName]
        const json = XLSX.utils.sheet_to_json(worksheet)
        if (json.length > 0) {
          allData.push({
            fileName: file.name,
            sheetName,
            data: json
          })
        }
      })
    }
    
    setParsedData(allData)
    toast({ title: "Files Parsed", description: `Successfully parsed ${uploadedFiles.length} files.` })
  }

  const handleTrainAI = async () => {
    if (!selectedServiceId || !selectedSubServiceId) {
      toast({ title: "Select Service", description: "Please select a service and sub-service first.", variant: "destructive" })
      return
    }
    if (parsedData.length === 0) {
      toast({ title: "No Data", description: "Please upload at least one menu file.", variant: "destructive" })
      return
    }

    setTraining(true)
    try {
      const res = await fetch("/api/ai/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: selectedServiceId,
          subServiceId: selectedSubServiceId,
          trainingData: parsedData
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Training failed")

      toast({ 
        title: "Training Complete!", 
        description: "AI has successfully learned from these menus and updated its profile." 
      })
      setFiles([])
      setParsedData([])
      setExistingProfile(data.profileText) // Update report preview
    } catch (error: any) {
      console.error(error)
      toast({ title: "Training Error", description: error.message, variant: "destructive" })
    } finally {
      setTraining(false)
    }
  }

  // Basic markdown parser to make the report look great
  const parseBoldText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-indigo-950">{part.slice(2, -2)}</strong>
      }
      return <span key={i}>{part}</span>
    })
  }

  const formatProfileText = (text: string) => {
    return text.split('\n').map((line, i) => {
      // Headers
      if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-bold text-indigo-900 mt-4 mb-2">{parseBoldText(line.replace('### ', ''))}</h3>
      if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-extrabold text-indigo-950 mt-5 mb-2 border-b border-indigo-100 pb-1">{parseBoldText(line.replace('## ', ''))}</h2>
      if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-black text-indigo-950 mt-6 mb-3">{parseBoldText(line.replace('# ', ''))}</h1>
      
      // Lists
      if (line.startsWith('- ')) return <li key={i} className="ml-6 mb-1 list-disc marker:text-indigo-400 text-gray-700">{parseBoldText(line.substring(2))}</li>
      if (line.startsWith('* ')) return <li key={i} className="ml-6 mb-1 list-disc marker:text-indigo-400 text-gray-700">{parseBoldText(line.substring(2))}</li>
      
      // Empty lines
      if (!line.trim()) return <div key={i} className="h-2"></div>

      // Normal text
      return <p key={i} className="mb-2 leading-relaxed text-gray-700">{parseBoldText(line)}</p>
    })
  }

  if (loading) {
    return <div className="flex items-center justify-center h-[calc(100vh-64px)]"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  const validSubServices = subServices.filter(ss => ss.serviceId === selectedServiceId)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <BrainCircuit className="h-6 w-6 text-indigo-600" />
            AI Fine-Tuning Module
          </h1>
          <p className="text-sm text-gray-500 mt-1">Upload historical menus to train the AI on your specific planning patterns and preferences.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Select Target Configuration</CardTitle>
          <CardDescription>Choose the service and sub-service you want to train the AI for.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1 space-y-2">
            <Label>Service</Label>
            <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
              <SelectTrigger>
                <SelectValue placeholder="Select Service" />
              </SelectTrigger>
              <SelectContent>
                {services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-2">
            <Label>Sub-Service</Label>
            <Select value={selectedSubServiceId} onValueChange={setSelectedSubServiceId} disabled={!selectedServiceId}>
              <SelectTrigger>
                <SelectValue placeholder="Select Sub-Service" />
              </SelectTrigger>
              <SelectContent>
                {validSubServices.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Upload Historical Menus</CardTitle>
          <CardDescription>Upload Excel files containing past menus. The AI will analyze them to learn patterns.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center w-full">
            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 mb-3 text-gray-400" />
                <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                <p className="text-xs text-gray-500">Excel files (.xlsx, .csv)</p>
              </div>
              <input type="file" className="hidden" multiple accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
            </label>
          </div>

          {files.length > 0 && (
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-md flex flex-col gap-2">
              <div className="text-sm font-medium text-blue-900 mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                {files.length} file(s) ready for analysis
              </div>
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-blue-700 bg-white p-2 rounded border border-blue-100">
                  <FileSpreadsheet className="h-4 w-4 text-blue-400" />
                  {f.name} ({(f.size / 1024).toFixed(1)} KB)
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button 
          size="lg" 
          onClick={handleTrainAI} 
          disabled={training || files.length === 0 || !selectedServiceId || !selectedSubServiceId}
          className="bg-indigo-600 hover:bg-indigo-700 w-full sm:w-auto"
        >
          {training ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <BrainCircuit className="h-5 w-5 mr-2" />}
          {training ? "Training AI..." : "Start AI Training"}
        </Button>
      </div>

      {loadingProfile && (
        <div className="flex justify-center p-4">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}

      {existingProfile && !training && !loadingProfile && (
        <Card className="border-indigo-100 bg-white shadow-md overflow-hidden">
          <CardHeader className="bg-indigo-50/80 border-b border-indigo-100 pb-4">
            <CardTitle className="text-xl text-indigo-950 flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              Current Training Report
            </CardTitle>
            <CardDescription className="text-indigo-700/80 text-sm mt-1">
              This is the knowledge the AI is currently using when suggesting menus for this Service/Sub-Service.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 pb-8 px-6 sm:px-8 bg-gradient-to-b from-white to-indigo-50/20">
            <div className="max-w-none text-sm sm:text-base">
              {formatProfileText(existingProfile)}
            </div>
          </CardContent>
        </Card>
      )}

      {training && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 flex flex-col items-center justify-center space-y-4">
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
            <BrainCircuit className="h-12 w-12 text-indigo-600 animate-pulse relative z-10" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-indigo-900">Fine-tuning AI Profile</h3>
            <p className="text-sm text-indigo-700 mt-1">The AI is analyzing thousands of cells to learn your preferred flavor combinations, dietary distributions, and structural patterns...</p>
          </div>
        </div>
      )}
    </div>
  )
}
