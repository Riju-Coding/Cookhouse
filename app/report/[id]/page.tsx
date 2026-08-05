"use client"
import { useState, useEffect } from "react"
import { qrLinksService, QRLink } from "@/lib/firestore/qrLinksService"
import { ticketService, TicketPriority } from "@/lib/firestore/ticketService"
import { usersService, type User } from "@/lib/firestore/usersService"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MapPin, Loader2, CheckCircle2, Ticket, ImagePlus, X, ChefHat, Copy, CheckSquare } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { storage, db } from "@/lib/firebase"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { collection, query, where, getDocs } from "firebase/firestore"
import { menuItemsService, servicesService, subServicesService, mealPlanStructureAssignmentsService } from "@/lib/services"
import Link from "next/link"

const COMPLAINT_CATEGORIES = [
  "Cleaning and Hygiene",
  "Food Quality",
  "Food Shortage",
  "Staff"
]

export default function PublicReportPage({ params }: { params: { id: string } }) {
  const [linkInfo, setLinkInfo] = useState<QRLink | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [successTicketId, setSuccessTicketId] = useState<string | null>(null)

  // Form State
  const activeCategories = linkInfo?.customization?.issueCategories || COMPLAINT_CATEGORIES
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
  const [shortItems, setShortItems] = useState<Set<string>>(new Set())
  
  // Staff Selection State
  const [companyStaff, setCompanyStaff] = useState<User[]>([])
  const [selectedStaffId, setSelectedStaffId] = useState("")
  
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
          if (data.customization?.issueCategories?.length === 1) {
            setCategory(data.customization.issueCategories[0])
          }
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
    async function fetchStaff() {
      if (category !== "Staff" || !linkInfo) return
      try {
        const staff = await usersService.getByCompany(linkInfo.companyId)
        setCompanyStaff(staff)
      } catch (err) {
        console.error("Failed to fetch staff:", err)
      }
    }
    fetchStaff()
  }, [category, linkInfo])

  useEffect(() => {
    async function fetchTodayMenu() {
      if ((category !== "Food Quality" && category !== "Food Shortage") || !linkInfo) return
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
        
        if (activeServices.length === 1) {
            setSelectedServiceId(activeServices[0].id)
            const subForService = activeSubServices.filter((s: any) => s.serviceId === activeServices[0].id)
            if (subForService.length === 1) {
                setSelectedSubServiceId(subForService[0].id)
            }
        }


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

  // Auto-select sub-service if there is only one for the selected service
  useEffect(() => {
    if (selectedServiceId && subServices.length > 0) {
      const subForService = subServices.filter(s => s.serviceId === selectedServiceId)
      if (subForService.length === 1) {
        setSelectedSubServiceId(subForService[0].id)
      } else if (!subForService.find(s => s.id === selectedSubServiceId)) {
        // If current subService doesn't belong to the newly selected service, clear it
        setSelectedSubServiceId("")
      }
    }
  }, [selectedServiceId, subServices])

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
            updated[item.id] = { rating: "Loved it", remark: "" }
          }
        })
        return updated
      })
    })

  }, [todayMenuData, selectedServiceId, selectedSubServiceId, todayStructure])

  const handleMenuFeedbackChange = (itemId: string, field: "rating" | "remark", value: string) => {
    setMenuFeedback(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value }
    }))
  }

  const toggleShortItem = (itemId: string) => {
    setShortItems(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!category) {
      toast({ title: "Required Fields", description: "Category is required.", variant: "destructive" })
      return
    }
    
    // Description is required ONLY for general categories (not Food Quality or Food Shortage)
    if (category !== "Food Quality" && category !== "Food Shortage" && !description) {
      toast({ title: "Required Fields", description: "Description is required for this issue category.", variant: "destructive" })
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

      if (category === "Food Quality" && todayMenuItems.length > 0) {
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
      } else if (category === "Food Shortage" && shortItems.size > 0) {
        const serviceName = services.find(s => s.id === selectedServiceId)?.name || 'Unknown Service'
        const subServiceName = subServices.find(s => s.id === selectedSubServiceId)?.name || 'Unknown Sub-Service'
        let shortageText = `\n\n--- Food Shortage (${serviceName} - ${subServiceName}) ---\nShort Items:\n`
        
        todayMenuItems.forEach(item => {
          if (shortItems.has(item.id)) {
            shortageText += `- ${item.name}\n`
          }
        })
        finalDescription += shortageText
      } else if (category === "Staff" && selectedStaffId) {
        const staff = companyStaff.find(s => s.id === selectedStaffId)
        if (staff) {
          finalDescription += `\n\n--- Staff Member Involved ---\nName: ${staff.name}\nEmail: ${staff.email}\nPhone: ${staff.phone}`
        }
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
        buildingName: linkInfo!.buildingName || '',
        priority: priority,
        photos: photoUrls,
        category: category
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
      <div className="flex flex-col items-center justify-center py-20 text-gray-500 p-4 sm:p-6 md:p-8">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p>Loading form...</p>
      </div>
    )
  }

  if (error || !linkInfo) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
      <div className="bg-white p-6 rounded-lg shadow-sm text-center border">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Ticket className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid or Expired Link</h2>
        <p className="text-gray-500">The QR code you scanned is no longer valid or could not be found.</p>
      </div>
      </div>
    )
  }

  if (successTicketId) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Feedback Received</h2>
        <p className="text-gray-600 mb-6">Thank you for your feedback. Our team has been notified.</p>
      </div>
      </div>
    )
  }

  return (
    <>

      {linkInfo.customization?.showHeader !== false && (
      <header className="w-full bg-white/70 backdrop-blur-xl border-b border-slate-200/50 shadow-[0_4px_30px_rgba(0,0,0,0.03)] sticky top-0 z-50 flex items-center justify-between px-6 py-4 transition-all duration-300">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-2 rounded-xl shadow-lg shadow-blue-500/20">
            <ChefHat className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 tracking-tight">
              {linkInfo.customization?.headerText || "Facility Feedback"}
            </h1>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Guest Services</p>
          </div>
        </div>
      </header>
      )}
      <div className="p-4 sm:p-6 md:p-8">

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
              {linkInfo.customization?.showReportingIssueAt !== false && (
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">{linkInfo.customization?.reportingIssueAtText || "Reporting issue at"}</p>
              )}
              <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight leading-tight">{linkInfo.cafeName}</h2>
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-500">
                {linkInfo.customization?.showBuildingName !== false && <span className="bg-slate-100 px-2 py-0.5 rounded-md">{linkInfo.buildingName}</span>}
                {(linkInfo.customization?.showBuildingName !== false && linkInfo.customization?.showCompanyName !== false) && <span className="text-slate-300">•</span>}
                {linkInfo.customization?.showCompanyName !== false && <span>{linkInfo.companyName}</span>}
              </div>
            </div>
          </div>
          {linkInfo.customization?.showTrackTicket !== false && (
          <Link href="/report/track" className="shrink-0 w-full sm:w-auto">
            <Button variant="outline" size="sm" className="w-full sm:w-auto rounded-xl border-slate-200 hover:bg-slate-50 hover:text-blue-600 font-semibold shadow-sm transition-all text-xs h-9">
              Track Ticket
            </Button>
          </Link>
          )}
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

        {activeCategories.length > 1 && (
        <div className="space-y-2.5">
          <Label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            Issue Category <span className="text-red-500">*</span>
          </Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className={`rounded-xl h-12 px-4 transition-all hover:bg-white ${category ? "bg-white border-blue-200 ring-2 ring-blue-500/10" : "bg-slate-50/50 border-slate-200"}`}>
              <SelectValue placeholder="Select the type of issue" />
            </SelectTrigger>
            <SelectContent className="rounded-xl overflow-hidden shadow-xl border-slate-100">
              {activeCategories.map((c: string) => <SelectItem key={c} value={c} className="py-2.5 cursor-pointer font-medium">{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        )}

        {category === "Staff" && (
          <div className="space-y-2.5 animate-in slide-in-from-top-2 fade-in duration-300">
            <Label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              Select Staff Member <span className="text-red-500">*</span>
            </Label>
            <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
              <SelectTrigger className="rounded-xl h-12 px-4 bg-white border-slate-200 transition-all hover:bg-slate-50">
                <SelectValue placeholder="Which staff member is involved?" />
              </SelectTrigger>
              <SelectContent className="rounded-xl overflow-hidden shadow-xl border-slate-100 max-h-[300px]">
                {companyStaff.length === 0 ? (
                  <div className="py-4 text-center text-sm text-gray-500">No staff found for this company.</div>
                ) : (
                  companyStaff.map(staff => (
                    <SelectItem key={staff.id} value={staff.id} className="py-2.5 cursor-pointer font-medium">
                      {staff.name} {staff.userType === 'vendor_staff' ? '(Vendor Staff)' : ''}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {linkInfo.customization?.showPriority !== false && (
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
        )}

        {linkInfo.customization?.showRemarks !== false && (
        <div className="space-y-2.5">
          <Label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            {(category === "Food Quality" || category === "Food Shortage") ? "General Remarks (Optional)" : "Description *"}
            {(category !== "Food Quality" && category !== "Food Shortage") && <span className="text-red-500">*</span>}
          </Label>
          <Textarea 
            placeholder={(category === "Food Quality" || category === "Food Shortage") ? "Any overall feedback..." : "Please describe the issue in detail..."}
            className="min-h-[140px] rounded-2xl bg-slate-50/50 border-slate-200 focus-visible:ring-blue-500 p-4 transition-all hover:bg-white resize-none"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>
        )}

        {(category === "Food Quality" || category === "Food Shortage") && (
          <div className="rounded-[2rem] overflow-hidden border border-violet-100 shadow-[0_8px_40px_rgba(139,92,246,0.08)]">
            
            {/* Section Header */}
            <div className={`bg-gradient-to-br ${category === "Food Quality" ? "from-violet-600 via-purple-600 to-indigo-600" : "from-orange-500 via-amber-500 to-yellow-500"} p-6 sm:p-8 relative overflow-hidden`}>
              <div className="absolute inset-0 opacity-20" style={{backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "30px 30px"}} />
              <div className="relative z-10">
                {linkInfo.customization?.showFeedbackFormHeader !== false && (
                  <>
                    <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full mb-3">
                      <ChefHat className="w-3.5 h-3.5 text-white" />
                      <span className="text-[11px] font-black text-white uppercase tracking-widest">{category === "Food Quality" ? (linkInfo.customization?.feedbackFormHeaderText || "Today's Meal Feedback") : "Today's Menu"}</span>
                    </div>
                    <h3 className="text-2xl font-black text-white tracking-tight">{category === "Food Quality" ? "How was your meal? 🍽️" : "What items were short? 📉"}</h3>
                  </>
                )}
                {linkInfo.customization?.showFeedbackFormSubHeader !== false && (
                  <p className={`text-white/80 text-sm font-medium mt-1`}>
                    {category === "Food Quality" ? (linkInfo.customization?.feedbackFormSubHeaderText || "Rate each dish honestly — your feedback helps us improve!") : "Select the items below that were missing or ran out."}
                  </p>
                )}
              </div>
            </div>

            {/* Service Selectors */}
            <div className="bg-white p-5 sm:p-6 border-b border-slate-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Service</Label>
                  <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                    <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-slate-200 focus:ring-violet-500 font-semibold text-slate-700 shadow-none hover:bg-white transition-colors">
                      <SelectValue placeholder="e.g. Lunch, Dinner…" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl shadow-2xl border-slate-100">
                      {services.map(s => <SelectItem key={s.id} value={s.id} className="py-3 cursor-pointer font-semibold">{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Meal Type</Label>
                  <Select value={selectedSubServiceId} onValueChange={setSelectedSubServiceId} disabled={!selectedServiceId}>
                    <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-slate-200 focus:ring-violet-500 font-semibold text-slate-700 shadow-none hover:bg-white transition-colors disabled:opacity-40">
                      <SelectValue placeholder="e.g. Normal Meal…" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl shadow-2xl border-slate-100">
                      {subServices.filter(ss => ss.serviceId === selectedServiceId).map(ss => (
                        <SelectItem key={ss.id} value={ss.id} className="py-3 cursor-pointer font-semibold">{ss.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Menu Item Cards */}
            <div className="bg-slate-50/70 p-5 sm:p-6 space-y-4">
              {menuLoading ? (
                <div className="flex flex-col items-center justify-center py-14 gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-violet-100 border-t-violet-500 animate-spin" />
                    <span className="absolute inset-0 flex items-center justify-center text-2xl">🍳</span>
                  </div>
                  <p className="text-sm font-bold text-slate-500">Fetching today's menu…</p>
                </div>

              ) : !todayMenuData ? (
                <div className="text-center py-10 space-y-2">
                  <p className="text-4xl">🗓️</p>
                  <p className="font-black text-slate-700">No menu today</p>
                  <p className="text-sm text-slate-400">You can still leave overall feedback above.</p>
                </div>

              ) : (!selectedServiceId || !selectedSubServiceId) ? (
                <div className="text-center py-10 space-y-3">
                  <div className="w-16 h-16 bg-violet-100 rounded-[1.5rem] flex items-center justify-center mx-auto">
                    <span className="text-3xl">👆</span>
                  </div>
                  <p className="font-black text-slate-700">Pick your meal above</p>
                  <p className="text-sm text-slate-400 max-w-[220px] mx-auto">Select a service and meal type to see today's dishes</p>
                </div>

              ) : todayMenuItems.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <p className="text-4xl">🤷</p>
                  <p className="font-black text-slate-700">No dishes found</p>
                  <p className="text-sm text-slate-400">Try a different service or meal type.</p>
                </div>

              ) : (
                <div className="space-y-3">
                  {/* Count pill */}
                  <div className="flex items-center gap-2 pb-1">
                    <span className={`text-xs font-black uppercase tracking-widest ${category === "Food Quality" ? "text-violet-600" : "text-amber-600"}`}>
                      {todayMenuItems.length} dishes to {category === "Food Quality" ? "rate" : "check"}
                    </span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>

                  {todayMenuItems.map((item, idx) => {
                    if (category === "Food Shortage") {
                      const isShort = shortItems.has(item.id)
                      return (
                        <div
                          key={item.id}
                          onClick={() => toggleShortItem(item.id)}
                          className={`bg-white rounded-[1.5rem] shadow-sm border transition-all duration-300 cursor-pointer flex items-center p-4 gap-4 ${
                            isShort ? "border-amber-400 bg-amber-50 shadow-[0_4px_20px_rgba(251,191,36,0.15)]" : "border-slate-100 hover:border-amber-200"
                          }`}
                        >
                          <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 border-2 transition-colors ${
                            isShort ? "bg-amber-500 border-amber-500 text-white" : "border-slate-300 bg-white"
                          }`}>
                            {isShort && <CheckSquare className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-slate-800 text-base truncate">{item.name}</p>
                          </div>
                        </div>
                      )
                    }

                    // Food Quality layout
                    const selected = menuFeedback[item.id]?.rating
                    const ratings = [
                      { label: "Loved it",      short: "Loved it",    emoji: "😍", bg: "from-pink-500 to-rose-500",     activeBg: "bg-gradient-to-r from-pink-500 to-rose-500",     activeTxt: "text-white", ring: "ring-pink-400"   },
                      { label: "Good",           short: "Good",        emoji: "😊", bg: "from-emerald-400 to-teal-500",  activeBg: "bg-gradient-to-r from-emerald-400 to-teal-500",  activeTxt: "text-white", ring: "ring-emerald-400" },
                      { label: "It's okay",      short: "Okay",        emoji: "😐", bg: "from-amber-400 to-orange-400",  activeBg: "bg-gradient-to-r from-amber-400 to-orange-400",  activeTxt: "text-white", ring: "ring-amber-400"   },
                      { label: "Not Likeable",   short: "Needs Improvement", emoji: "👎", bg: "from-slate-400 to-slate-500",   activeBg: "bg-gradient-to-r from-slate-500 to-slate-600",   activeTxt: "text-white", ring: "ring-slate-400"   },
                    ]
                    return (
                      <div
                        key={item.id}
                        className={`bg-white rounded-[1.5rem] shadow-sm border transition-all duration-300 ${
                          selected ? "border-violet-200 shadow-[0_4px_20px_rgba(139,92,246,0.12)]" : "border-slate-100"
                        }`}
                      >
                        {/* Item header */}
                        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
                          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center shrink-0 text-lg font-black text-violet-600">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-slate-800 text-base truncate">{item.name}</p>
                            {selected && (
                              <p className="text-[11px] font-bold text-violet-500 mt-0.5 animate-in fade-in duration-200">
                                {ratings.find(r => r.label === selected)?.emoji} You rated: {selected}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Rating pills — horizontal scroll on mobile */}
                        <div className="px-4 pb-4">
                          <div className="flex gap-2 overflow-x-auto py-2 -my-2 px-1 -mx-1 scrollbar-hide">
                            {ratings.map(rating => {
                              const isSelected = selected === rating.label
                              return (
                                <button
                                  key={rating.label}
                                  type="button"
                                  onClick={() => handleMenuFeedbackChange(item.id, "rating", rating.label)}
                                  className={`
                                    flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full font-bold text-sm
                                    transition-all duration-200 active:scale-95 select-none
                                    ${isSelected
                                      ? `${rating.activeBg} ${rating.activeTxt} ring-2 ring-offset-1 ${rating.ring} shadow-lg scale-[1.03]`
                                      : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:scale-[1.02]"
                                    }
                                  `}
                                >
                                  <span className="text-base leading-none">{rating.emoji}</span>
                                  <span className="whitespace-nowrap">{rating.short}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {/* Remark input — slides in for negative ratings */}
                        {(selected === "It's okay" || selected === "Not Likeable") && (
                          <div className="px-5 pb-5 animate-in slide-in-from-top-2 fade-in duration-300">
                            <div className="relative">
                              <Input
                                placeholder={`What didn't hit right about ${item.name}? 💬`}
                                value={menuFeedback[item.id]?.remark || ""}
                                onChange={e => handleMenuFeedbackChange(item.id, "remark", e.target.value)}
                                className="h-12 rounded-2xl bg-slate-50 border-slate-200 focus-visible:ring-violet-400 focus-visible:bg-white text-sm font-medium pl-4 pr-4 placeholder:text-slate-400"
                                autoFocus
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
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
            linkInfo.customization?.submitButtonText || "Submit Complaint"
          )}
        </Button>
      </form>
    </div>
    </div>
    </>
  )
}
