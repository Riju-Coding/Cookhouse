"use client"
import { useState, useEffect } from "react"
import { qrLinksService, QRLink } from "@/lib/firestore/qrLinksService"
import { ticketService, TicketPriority } from "@/lib/firestore/ticketService"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MapPin, Loader2, CheckCircle2, Ticket, ImagePlus, X, ChefHat } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { storage, db } from "@/lib/firebase"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { collection, query, where, getDocs } from "firebase/firestore"
import { menuItemsService, servicesService, subServicesService, mealPlanStructureAssignmentsService } from "@/lib/services"
import Link from "next/link"

const COMPLAINT_CATEGORIES = [
  "Maintenance & Repairs",
  "Cleaning & Hygiene",
  "Food Quality & Service",
  "Catering Services",
  "Safety Hazard",
  "Other"
]

export default function PublicReportPage({ params }: { params: { id: string } }) {
  const [linkInfo, setLinkInfo] = useState<QRLink | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [successTicketId, setSuccessTicketId] = useState<string | null>(null)

  // Form State
  const [name, setName] = useState("")
  const [contact, setContact] = useState("")
  const [employeeId, setEmployeeId] = useState("")
  const [category, setCategory] = useState("")
  const [priority, setPriority] = useState<TicketPriority>("Medium")
  const [description, setDescription] = useState("")
  
  // Menu Feedback State
  const [todayMenuData, setTodayMenuData] = useState<any>(null)
  const [todayMenuItems, setTodayMenuItems] = useState<{ id: string; name: string }[]>([])
  const [menuFeedback, setMenuFeedback] = useState<Record<string, { rating: string; remark: string }>>({})
  
  const [services, setServices] = useState<{ id: string; name: string }[]>([])
  const [subServices, setSubServices] = useState<{ id: string; name: string; serviceId: string }[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState("")
  const [selectedSubServiceId, setSelectedSubServiceId] = useState("")
  const [todayStructure, setTodayStructure] = useState<any[]>([])
  
  const [menuLoading, setMenuLoading] = useState(false)
  const [menuLoaded, setMenuLoaded] = useState(false)
  
  // File Upload State
  const [photos, setPhotos] = useState<File[]>([])
  const [uploadingPhotos, setUploadingPhotos] = useState(false)

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const files = Array.from(e.target.files)
    
    // Validate that files are strictly images
    const validImages = files.filter(file => {
      if (!file.type.startsWith("image/")) {
        toast({ title: "Invalid File", description: `${file.name} is not a valid image file.`, variant: "destructive" })
        return false
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({ title: "File Too Large", description: `${file.name} is larger than 5MB.`, variant: "destructive" })
        return false
      }
      return true
    })

    setPhotos(prev => [...prev, ...validImages])
    // Reset input value so same files can be selected again if removed
    e.target.value = ""
  }

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index))
  }

  useEffect(() => {
    async function load() {
      try {
        const data = await qrLinksService.getById(params.id)
        if (!data) {
          setError(true)
        } else {
          setLinkInfo(data)
        }
      } catch (e) {
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.id])

  useEffect(() => {
    async function fetchTodayMenu() {
      if (category !== "Catering Services" || !linkInfo) return
      if (menuLoaded) return // prevent refetching

      setMenuLoading(true)
      try {
        const [allItems, allServices, allSubServices, assignment] = await Promise.all([
          menuItemsService.getAll(),
          servicesService.getAll(),
          subServicesService.getAll(),
          mealPlanStructureAssignmentsService.getByCompanyAndBuilding(linkInfo.companyId, linkInfo.buildingId)
        ])
        
        const itemsMap = new Map(allItems.map((i: any) => [i.id, i.name]))
        
        const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
        const todayName = DAYS[new Date().getDay()]
        
        let structureForToday: any[] = []
        if (assignment && assignment.weekStructure && assignment.weekStructure[todayName]) {
          structureForToday = assignment.weekStructure[todayName]
        }
        setTodayStructure(structureForToday)
        
        // Filter Services and SubServices based on today's structure
        const activeServiceIds = new Set(structureForToday.map((s: any) => s.serviceId))
        const activeServices = allServices.filter(s => activeServiceIds.has(s.id))
        
        const activeSubServices: typeof subServices = []
        structureForToday.forEach((service: any) => {
          service.subServices?.forEach((sub: any) => {
            const found = allSubServices.find(ss => ss.id === sub.subServiceId)
            if (found) {
              activeSubServices.push({ ...found, serviceId: service.serviceId })
            } else if (sub.subServiceName) {
               // Fallback if not in allSubServices but has a name in structure
               activeSubServices.push({ id: sub.subServiceId, name: sub.subServiceName, serviceId: service.serviceId })
            }
          })
        })
        
        setServices(activeServices)
        setSubServices(activeSubServices)

        const q = query(
          collection(db, "companyMenus"),
          where("companyId", "==", linkInfo.companyId),
          where("buildingId", "==", linkInfo.buildingId),
          where("status", "==", "active")
        )
        
        const snap = await getDocs(q)
        if (!snap.empty) {
          const menuDoc = snap.docs[0].data()
          const menuData = menuDoc.menuData || {}
          
          const todayDate = new Date().toISOString().split("T")[0]
          const todayData = menuData[todayDate] || null
          
          console.log("[DEBUG] Fetching menu for date:", todayDate, "Found data:", !!todayData)
          
          setTodayMenuData(todayData)
          
          if (!todayData) {
            setTodayMenuItems([])
          }
        } else {
          setTodayMenuData(null)
          setTodayMenuItems([])
        }
        setMenuLoaded(true)
      } catch (err) {
        console.error("Error fetching menu:", err)
      } finally {
        setMenuLoading(false)
      }
    }

    fetchTodayMenu()
  }, [category, linkInfo, menuLoaded])

  // Update todayMenuItems when selected service/subservice changes
  useEffect(() => {
    if (!todayMenuData || !selectedServiceId || !selectedSubServiceId || todayStructure.length === 0) {
      setTodayMenuItems([])
      return
    }

    const itemIds = new Set<string>()
    const serviceData = todayMenuData[selectedServiceId]
    
    if (serviceData) {
      const subServiceData = serviceData[selectedSubServiceId]
      
      if (subServiceData) {
        // Find the selected sub-service in today's structure to know which meal plans map to it
        const structureService = todayStructure.find((s: any) => s.serviceId === selectedServiceId)
        const structureSubService = structureService?.subServices?.find((ss: any) => ss.subServiceId === selectedSubServiceId)
        
        if (structureSubService && structureSubService.mealPlans) {
          structureSubService.mealPlans.forEach((mealPlan: any) => {
            const mpId = mealPlan.mealPlanId
            if (subServiceData[mpId]) {
              mealPlan.subMealPlans?.forEach((subMealPlan: any) => {
                const smpId = subMealPlan.subMealPlanId
                const subMealPlanData = subServiceData[mpId][smpId]
                
                if (subMealPlanData && Array.isArray(subMealPlanData.menuItemIds)) {
                  subMealPlanData.menuItemIds.forEach((id: string) => itemIds.add(id))
                }
              })
            }
          })
        }
      }
    }
    
    // Quick resolve
    menuItemsService.getAll().then(allItems => {
      const itemsMap = new Map(allItems.map((i: any) => [i.id, i.name]))
      const resolvedItems = Array.from(itemIds).map(id => ({
        id,
        name: itemsMap.get(id) || "Unknown Item"
      }))
      
      setTodayMenuItems(resolvedItems)
      
      setMenuFeedback(prev => {
        const updated = { ...prev }
        resolvedItems.forEach(item => {
          if (!updated[item.id]) {
            updated[item.id] = { rating: "Satisfactory", remark: "" }
          }
        })
        return updated
      })
    })

  }, [todayMenuData, selectedServiceId, selectedSubServiceId])

  const handleMenuFeedbackChange = (itemId: string, field: "rating" | "remark", value: string) => {
    setMenuFeedback(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value }
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!category || !description) {
      toast({ title: "Required Fields", description: "Category and description are required.", variant: "destructive" })
      return
    }

    setSubmitting(true)
    try {
      const fullDescription = `
[Public Complaint Submission]
Reporter Name: ${name || 'Anonymous'}
Contact: ${contact || 'N/A'}${linkInfo?.requireEmployeeId ? `\nEmployee ID: ${employeeId || 'N/A'}` : ''}
Category: ${category}

Location Details:
- Company: ${linkInfo?.companyName}
- Building: ${linkInfo?.buildingName}
- Cafe/Location: ${linkInfo?.cafeName}

Complaint:
${description}
      `.trim()

      let finalDescription = fullDescription

      if (category === "Catering Services" && todayMenuItems.length > 0) {
        const serviceName = services.find(s => s.id === selectedServiceId)?.name || 'Unknown Service'
        const subServiceName = subServices.find(s => s.id === selectedSubServiceId)?.name || 'Unknown Sub-Service'
        let menuFeedbackText = `\n\n--- Meal Feedback (${serviceName} - ${subServiceName}) ---\n`
        todayMenuItems.forEach(item => {
          const feedback = menuFeedback[item.id]
          if (feedback) {
            menuFeedbackText += `\nItem: ${item.name}\nRating: ${feedback.rating}`
            if (feedback.remark) {
              menuFeedbackText += `\nRemark: ${feedback.remark}`
            }
            menuFeedbackText += "\n"
          }
        })
        finalDescription += menuFeedbackText
      }

      setUploadingPhotos(true)
      const photoUrls: string[] = []

      // Upload photos sequentially
      for (const file of photos) {
        try {
          const fileExtension = file.name.split('.').pop()
          const fileName = `public_tickets/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExtension}`
          const storageRef = ref(storage, fileName)
          await uploadBytes(storageRef, file)
          const url = await getDownloadURL(storageRef)
          photoUrls.push(url)
        } catch (uploadError) {
          console.error("Failed to upload photo:", file.name, uploadError)
          toast({ title: "Upload Warning", description: `Failed to upload ${file.name}. Continuing without it.`, variant: "default" })
        }
      }
      setUploadingPhotos(false)

      const ticketId = await ticketService.createTicket({
        title: `${category} Issue at ${linkInfo?.cafeName}`,
        description: finalDescription,
        creatorId: "public_user",
        creatorName: name || "Public Guest",
        companyId: linkInfo!.companyId,
        companyName: linkInfo!.companyName,
        priority: priority,
        photos: photoUrls
      })

      // Save to local storage so they don't lose it
      if (typeof window !== "undefined") {
        localStorage.setItem("cookhouse_last_ticket_id", ticketId)
      }

      setSuccessTicketId(ticketId)
    } catch (err) {
      console.error(err)
      toast({ title: "Submission Failed", description: "We couldn't submit your ticket. Please try again.", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p>Loading form...</p>
      </div>
    )
  }

  if (error || !linkInfo) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm text-center border">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Ticket className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid or Expired Link</h2>
        <p className="text-gray-500">The QR code you scanned is no longer valid or could not be found.</p>
      </div>
    )
  }

  if (successTicketId) {
    return (
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Complaint Received</h2>
        <p className="text-gray-600 mb-6">Thank you for reporting this issue. Our facility team has been notified.</p>
        
        <div className="bg-gray-50 p-4 rounded-lg mb-8 border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Your Tracking ID</p>
          <p className="font-mono text-xl font-bold text-blue-600">{successTicketId}</p>
        </div>

        <Link href={`/report/track?id=${successTicketId}`}>
          <Button className="w-full h-12 text-lg">Track Ticket Status</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 overflow-hidden">
      
      {/* Location Details Header */}
      <div className="bg-gradient-to-br from-slate-50/80 to-white/80 p-6 sm:p-8 border-b border-slate-100 relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl"></div>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-4">
            <div className="bg-blue-50 p-3 rounded-2xl shrink-0 mt-1 sm:mt-0 shadow-sm border border-blue-100/50">
              <MapPin className="w-6 h-6 text-blue-600" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Reporting issue at</p>
              <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight leading-tight">{linkInfo.cafeName}</h2>
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-500">
                <span className="bg-slate-100 px-2 py-0.5 rounded-md">{linkInfo.buildingName}</span>
                <span className="text-slate-300">•</span>
                <span>{linkInfo.companyName}</span>
              </div>
            </div>
          </div>
          <Link href="/report/track" className="shrink-0 w-full sm:w-auto">
            <Button variant="outline" size="sm" className="w-full sm:w-auto rounded-xl border-slate-200 hover:bg-slate-50 hover:text-blue-600 font-semibold shadow-sm transition-all text-xs h-9">
              Track Ticket
            </Button>
          </Link>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-8">
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {linkInfo.requireName && (
            <div className="space-y-2.5">
              <Label className="text-sm font-semibold text-slate-700">Your Name <span className="text-red-500">*</span></Label>
              <Input 
                placeholder="e.g. John Doe" 
                value={name} 
                onChange={e => setName(e.target.value)}
                required
                className="rounded-xl bg-slate-50/50 border-slate-200 focus-visible:ring-blue-500 h-12 px-4 transition-all hover:bg-white"
              />
            </div>
          )}
          
          {linkInfo.requireEmail && (
            <div className="space-y-2.5">
              <Label className="text-sm font-semibold text-slate-700">Contact Number / Email <span className="text-red-500">*</span></Label>
              <Input 
                placeholder="For follow-up" 
                value={contact} 
                onChange={e => setContact(e.target.value)} 
                required
                className="rounded-xl bg-slate-50/50 border-slate-200 focus-visible:ring-blue-500 h-12 px-4 transition-all hover:bg-white"
              />
            </div>
          )}
          
          {linkInfo.requireEmployeeId && (
            <div className="space-y-2.5 sm:col-span-2">
              <Label className="text-sm font-semibold text-slate-700">Employee ID <span className="text-red-500">*</span></Label>
              <Input 
                placeholder="e.g. EMP12345" 
                value={employeeId} 
                onChange={e => setEmployeeId(e.target.value)} 
                required
                className="rounded-xl bg-slate-50/50 border-slate-200 focus-visible:ring-blue-500 h-12 px-4 transition-all hover:bg-white"
              />
            </div>
          )}
        </div>

        <div className="space-y-2.5">
          <Label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            Issue Category <span className="text-red-500">*</span>
          </Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className={`rounded-xl h-12 px-4 transition-all hover:bg-white ${category ? "bg-white border-blue-200 ring-2 ring-blue-500/10" : "bg-slate-50/50 border-slate-200"}`}>
              <SelectValue placeholder="Select the type of issue" />
            </SelectTrigger>
            <SelectContent className="rounded-xl overflow-hidden shadow-xl border-slate-100">
              {COMPLAINT_CATEGORIES.map(c => <SelectItem key={c} value={c} className="py-2.5 cursor-pointer font-medium">{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2.5">
          <Label className="text-sm font-bold text-slate-700">Urgency / Priority</Label>
          <Select value={priority} onValueChange={(val: TicketPriority) => setPriority(val)}>
            <SelectTrigger className="rounded-xl h-12 px-4 bg-white border-slate-200 transition-all hover:bg-slate-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl overflow-hidden shadow-xl border-slate-100">
              <SelectItem value="Low" className="py-2.5 cursor-pointer font-medium"><span className="text-emerald-600 font-bold mr-2">•</span>Low - Not urgent</SelectItem>
              <SelectItem value="Medium" className="py-2.5 cursor-pointer font-medium"><span className="text-blue-600 font-bold mr-2">•</span>Medium - Needs attention soon</SelectItem>
              <SelectItem value="High" className="py-2.5 cursor-pointer font-medium"><span className="text-orange-500 font-bold mr-2">•</span>High - Affects operations</SelectItem>
              <SelectItem value="Critical" className="py-2.5 cursor-pointer font-medium"><span className="text-red-600 font-bold mr-2">•</span>Critical - Safety/Major disruption</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2.5">
          <Label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            {category === "Catering Services" ? "General Remarks (Optional)" : "Description *"}
            {category !== "Catering Services" && <span className="text-red-500">*</span>}
          </Label>
          <Textarea 
            placeholder={category === "Catering Services" ? "Any overall feedback about the catering services..." : "Please describe the issue in detail..."}
            className="min-h-[140px] rounded-2xl bg-slate-50/50 border-slate-200 focus-visible:ring-blue-500 p-4 transition-all hover:bg-white resize-none"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        {category === "Catering Services" && (
          <div className="space-y-6 bg-gradient-to-b from-white to-slate-50 p-6 sm:p-8 rounded-[2rem] border border-blue-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden">
            {/* Decorative element */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500"></div>

            <div className="space-y-1 border-b border-slate-100 pb-4">
              <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-blue-600" />
                Meal Feedback
              </h3>
              <p className="text-sm font-medium text-slate-500">Select your meal below to rate individual items.</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Service <span className="text-blue-600">*</span></Label>
                <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                  <SelectTrigger className="h-12 rounded-xl bg-white border-slate-200 focus:ring-blue-500 font-medium shadow-sm"><SelectValue placeholder="E.g. Lunch" /></SelectTrigger>
                  <SelectContent className="rounded-xl shadow-xl">
                    {services.map(s => <SelectItem key={s.id} value={s.id} className="py-2.5 cursor-pointer">{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Sub Service <span className="text-blue-600">*</span></Label>
                <Select value={selectedSubServiceId} onValueChange={setSelectedSubServiceId} disabled={!selectedServiceId}>
                  <SelectTrigger className="h-12 rounded-xl bg-white border-slate-200 focus:ring-blue-500 font-medium shadow-sm disabled:opacity-50"><SelectValue placeholder="E.g. Normal Meal" /></SelectTrigger>
                  <SelectContent className="rounded-xl shadow-xl">
                    {subServices.filter(ss => ss.serviceId === selectedServiceId).map(ss => <SelectItem key={ss.id} value={ss.id} className="py-2.5 cursor-pointer">{ss.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {menuLoading ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span className="text-sm font-semibold tracking-wide">Locating today's menu...</span>
              </div>
            ) : !todayMenuData ? (
              <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl text-center">
                <p className="text-sm font-semibold text-amber-700">No active menu found for today.</p>
                <p className="text-xs text-amber-600 mt-1">You can still provide general remarks above.</p>
              </div>
            ) : (!selectedServiceId || !selectedSubServiceId) ? (
              <div className="bg-blue-50/50 border border-blue-100/50 p-6 rounded-2xl text-center border-dashed">
                <p className="text-sm font-semibold text-blue-700">Please select a service above to view menu items.</p>
              </div>
            ) : todayMenuItems.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl text-center border-dashed">
                <p className="text-sm font-semibold text-slate-600">No items found for this selection.</p>
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                {todayMenuItems.map(item => (
                  <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md hover:border-blue-200 group">
                    <p className="font-bold text-slate-800 text-lg mb-4">{item.name}</p>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        { label: "Satisfactory", color: "emerald", icon: "👍" },
                        { label: "Good", color: "blue", icon: "✨" },
                        { label: "Bad", color: "orange", icon: "👎" },
                        { label: "Not Likeable", color: "red", icon: "🤢" }
                      ].map(rating => {
                        const isSelected = menuFeedback[item.id]?.rating === rating.label;
                        return (
                          <div 
                            key={rating.label}
                            onClick={() => handleMenuFeedbackChange(item.id, "rating", rating.label)}
                            className={`
                              cursor-pointer rounded-xl border p-3 flex flex-col items-center justify-center gap-1.5 transition-all duration-200 transform hover:scale-[1.02] active:scale-95
                              ${isSelected 
                                ? rating.color === 'emerald' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-[0_0_0_1px_rgba(16,185,129,1)]' :
                                  rating.color === 'blue' ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-[0_0_0_1px_rgba(59,130,246,1)]' :
                                  rating.color === 'orange' ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-[0_0_0_1px_rgba(249,115,22,1)]' :
                                  'bg-red-50 border-red-500 text-red-700 shadow-[0_0_0_1px_rgba(239,68,68,1)]'
                                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300"}
                            `}
                          >
                            <span className="text-xl">{rating.icon}</span>
                            <span className={`text-[10px] sm:text-xs font-black uppercase tracking-wider ${isSelected ? 'opacity-100' : 'opacity-70'}`}>
                              {rating.label}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                    
                    {(menuFeedback[item.id]?.rating === "Bad" || menuFeedback[item.id]?.rating === "Not Likeable") && (
                      <div className="pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="relative">
                          <Input 
                            placeholder={`Please tell us why ${item.name} was ${menuFeedback[item.id]?.rating.toLowerCase()}...`}
                            value={menuFeedback[item.id]?.remark || ""}
                            onChange={e => handleMenuFeedbackChange(item.id, "remark", e.target.value)}
                            className="pl-4 pr-4 h-12 rounded-xl bg-red-50/30 border-red-200 focus-visible:ring-red-500 focus-visible:bg-white text-sm"
                            autoFocus
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-3 pt-2">
          <Label className="text-sm font-bold text-slate-700">Attach Proof / Photos (Optional)</Label>
          
          {photos.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 mb-4">
              {photos.map((photo, idx) => (
                <div key={idx} className="relative group aspect-square rounded-2xl border-2 border-slate-100 shadow-sm bg-slate-50 overflow-hidden transform transition-all duration-300 hover:scale-105 hover:shadow-md hover:border-blue-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={URL.createObjectURL(photo)} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  <button 
                    type="button"
                    onClick={() => removePhoto(idx)}
                    className="absolute top-2 right-2 bg-red-500/90 hover:bg-red-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all shadow-sm transform scale-75 group-hover:scale-100"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="relative group">
            <input 
              type="file" 
              accept="image/png, image/jpeg, image/webp" 
              multiple 
              onChange={handlePhotoSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
              disabled={submitting}
            />
            <div className="w-full border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 h-32 bg-slate-50 text-slate-500 group-hover:bg-blue-50/50 group-hover:border-blue-300 group-hover:text-blue-600 transition-all">
              <div className="bg-white p-3 rounded-full shadow-sm group-hover:shadow-md transition-shadow">
                <ImagePlus className="w-6 h-6 text-blue-500" />
              </div>
              <span className="font-semibold text-sm">Tap to Select Images</span>
            </div>
          </div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Supported: JPG, PNG, WEBP (Max 5MB)</p>
        </div>

        <Button 
          type="submit" 
          className="w-full h-14 text-lg font-bold rounded-2xl mt-8 shadow-xl shadow-blue-500/20 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white transition-all transform hover:scale-[1.01] active:scale-[0.98]" 
          disabled={submitting || uploadingPhotos}
        >
          {submitting ? (
            <><Loader2 className="w-6 h-6 mr-2 animate-spin" /> {uploadingPhotos ? "Uploading Photos..." : "Submitting Complaint..."}</>
          ) : (
            "Submit Complaint"
          )}
        </Button>
      </form>
    </div>
  )
}
