"use client"
import { useState, useEffect } from "react"
import { qrLinksService, QRLink } from "@/lib/firestore/qrLinksService"
import { ticketService, TicketPriority } from "@/lib/firestore/ticketService"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MapPin, Loader2, CheckCircle2, Ticket, ImagePlus, X } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { storage } from "@/lib/firebase"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import Link from "next/link"

const COMPLAINT_CATEGORIES = [
  "Maintenance & Repairs",
  "Cleaning & Hygiene",
  "Food Quality & Service",
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
  const [category, setCategory] = useState("")
  const [priority, setPriority] = useState<TicketPriority>("Medium")
  const [description, setDescription] = useState("")
  
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
Contact: ${contact || 'N/A'}
Category: ${category}

Location Details:
- Company: ${linkInfo?.companyName}
- Building: ${linkInfo?.buildingName}
- Cafe/Location: ${linkInfo?.cafeName}

Complaint:
${description}
      `.trim()

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
        description: fullDescription,
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
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="bg-slate-50 p-4 border-b">
        <div className="flex items-start gap-3">
          <div className="mt-1">
            <MapPin className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-500">Reporting issue at:</p>
            <h2 className="font-bold text-gray-900">{linkInfo.cafeName}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{linkInfo.buildingName} • {linkInfo.companyName}</p>
          </div>
          <Link href="/report/track">
            <Button variant="outline" size="sm" className="text-xs shrink-0">
              Track Ticket
            </Button>
          </Link>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label>Your Name (Optional)</Label>
            <Input 
              placeholder="e.g. John Doe" 
              value={name} 
              onChange={e => setName(e.target.value)} 
            />
          </div>
          <div className="space-y-2">
            <Label>Contact Number / Email (Optional)</Label>
            <Input 
              placeholder="For follow-up" 
              value={contact} 
              onChange={e => setContact(e.target.value)} 
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-red-500 font-medium">Issue Category *</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className={category ? "" : "text-gray-500"}>
              <SelectValue placeholder="Select the type of issue" />
            </SelectTrigger>
            <SelectContent>
              {COMPLAINT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Urgency / Priority</Label>
          <Select value={priority} onValueChange={(val: TicketPriority) => setPriority(val)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Low">Low - Not urgent</SelectItem>
              <SelectItem value="Medium">Medium - Needs attention soon</SelectItem>
              <SelectItem value="High">High - Affects operations</SelectItem>
              <SelectItem value="Critical">Critical - Safety/Major disruption</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-red-500 font-medium">Description *</Label>
          <Textarea 
            placeholder="Please describe the issue in detail..." 
            className="min-h-[120px]"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        <div className="space-y-3">
          <Label>Attach Proof / Photos (Optional)</Label>
          
          {photos.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-3">
              {photos.map((photo, idx) => (
                <div key={idx} className="relative group aspect-square rounded-md border bg-gray-50 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={URL.createObjectURL(photo)} alt="Preview" className="w-full h-full object-cover" />
                  <button 
                    type="button"
                    onClick={() => removePhoto(idx)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-80 hover:opacity-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="relative">
            <input 
              type="file" 
              accept="image/png, image/jpeg, image/webp" 
              multiple 
              onChange={handlePhotoSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
              disabled={submitting}
            />
            <Button type="button" variant="outline" className="w-full border-dashed flex items-center justify-center gap-2 h-12 text-gray-500 pointer-events-none">
              <ImagePlus className="w-5 h-5" />
              <span>Select Images</span>
            </Button>
          </div>
          <p className="text-xs text-gray-500">Only image files (.jpg, .png, .webp) up to 5MB are allowed.</p>
        </div>

        <Button type="submit" className="w-full h-12 text-lg mt-4" disabled={submitting || uploadingPhotos}>
          {submitting ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> {uploadingPhotos ? "Uploading Photos..." : "Submitting..."}</>
          ) : (
            "Submit Complaint"
          )}
        </Button>
      </form>
    </div>
  )
}
