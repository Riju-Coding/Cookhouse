"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, BrainCircuit } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { servicesService, subServicesService, mealPlansService } from "@/lib/services"
import type { Service, SubService, MealPlan } from "@/lib/types"

interface OKFGenerateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (menuId: string) => void
}

export function OKFGenerateModal({ open, onOpenChange, onSuccess }: OKFGenerateModalProps) {
  const [loading, setLoading] = useState(false)
  const [services, setServices] = useState<Service[]>([])
  const [subServices, setSubServices] = useState<SubService[]>([])
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([])

  const [selectedService, setSelectedService] = useState("")
  const [selectedSubService, setSelectedSubService] = useState("")
  const [selectedMealPlan, setSelectedMealPlan] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open])

  async function loadData() {
    try {
      const [svcs, ssvcs, mps] = await Promise.all([
        servicesService.getActive(),
        subServicesService.getActive(),
        mealPlansService.getActive()
      ])
      setServices(svcs.sort((a, b) => (a.order || 0) - (b.order || 0)))
      setSubServices(ssvcs.sort((a, b) => (a.order || 0) - (b.order || 0)))
      setMealPlans(mps)
    } catch (error) {
      console.error(error)
      toast({ title: "Error loading data", variant: "destructive" })
    }
  }

  const validSubServices = subServices.filter(ss => ss.serviceId === selectedService)
  const validMealPlans = mealPlans.filter(mp => mp.status === "active" || !mp.status).sort((a, b) => (a.order || 0) - (b.order || 0))

  const handleGenerate = async () => {
    if (!selectedService || !selectedSubService || !selectedMealPlan || !startDate || !endDate) {
      toast({ title: "Error", description: "Please fill all fields", variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/ai/generate-menu-okf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: selectedService,
          subServiceId: selectedSubService,
          mealPlanId: selectedMealPlan,
          startDate,
          endDate
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Generation failed")

      toast({ title: "Menu Generated!", description: "AI successfully created the menu." })
      onSuccess(data.menuId)
      onOpenChange(false)
    } catch (error: any) {
      console.error(error)
      toast({ title: "Error generating menu", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-indigo-900">
            <BrainCircuit className="h-5 w-5" />
            Generate via OKF Agent
          </DialogTitle>
          <DialogDescription>
            The AI will use the extracted Open Knowledge Format (OKF) rules to autonomously plan this menu.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Date Range</Label>
            <div className="flex gap-2">
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Service</Label>
            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger><SelectValue placeholder="Select Service" /></SelectTrigger>
              <SelectContent>
                {services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Sub-Service</Label>
            <Select value={selectedSubService} onValueChange={setSelectedSubService} disabled={!selectedService}>
              <SelectTrigger><SelectValue placeholder="Select Sub-Service" /></SelectTrigger>
              <SelectContent>
                {validSubServices.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Meal Plan Structure</Label>
            <Select value={selectedMealPlan} onValueChange={setSelectedMealPlan} disabled={!selectedSubService}>
              <SelectTrigger><SelectValue placeholder="Select Meal Plan" /></SelectTrigger>
              <SelectContent>
                {validMealPlans.map(mp => <SelectItem key={mp.id} value={mp.id}>{mp.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button 
          onClick={handleGenerate} 
          disabled={loading || !selectedService || !selectedSubService || !selectedMealPlan || !startDate || !endDate}
          className="w-full bg-indigo-600 hover:bg-indigo-700"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Agent is planning menu...
            </>
          ) : (
            "Ask Agent to Generate"
          )}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
