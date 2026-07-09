import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Shield, Save } from "lucide-react"
import { db } from "@/lib/firebase"
import { doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { toast } from "@/hooks/use-toast"

export function PoliciesTab({ companies, fetchAll }: { companies: any[], fetchAll: () => void }) {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(companies[0]?.id || "")
  const [saving, setSaving] = useState(false)

  // Find selected company
  const company = companies.find(c => c.id === selectedCompanyId)
  
  // Local state for policy settings
  const [policy, setPolicy] = useState({
    autoShiftStart: company?.attendancePolicy?.autoShiftStart ?? false,
    autoShiftStartWindowMins: company?.attendancePolicy?.autoShiftStartWindowMins ?? 15,
    vendorHQEnabled: company?.attendancePolicy?.vendorHQEnabled ?? true,
    multiSiteEnabled: company?.attendancePolicy?.multiSiteEnabled ?? true,
    travelGracePeriodMins: company?.attendancePolicy?.travelGracePeriodMins ?? 30,
    breakGracePeriodMins: company?.attendancePolicy?.breakGracePeriodMins ?? 10,
    geofenceRadiusDefault: company?.attendancePolicy?.geofenceRadiusDefault ?? 100,
    gpsAccuracyThreshold: company?.attendancePolicy?.gpsAccuracyThreshold ?? 100,
  })

  // Update local state when company changes
  React.useEffect(() => {
    if (company) {
      setPolicy({
        autoShiftStart: company.attendancePolicy?.autoShiftStart ?? false,
        autoShiftStartWindowMins: company.attendancePolicy?.autoShiftStartWindowMins ?? 15,
        vendorHQEnabled: company.attendancePolicy?.vendorHQEnabled ?? true,
        multiSiteEnabled: company.attendancePolicy?.multiSiteEnabled ?? true,
        travelGracePeriodMins: company.attendancePolicy?.travelGracePeriodMins ?? 30,
        breakGracePeriodMins: company.attendancePolicy?.breakGracePeriodMins ?? 10,
        geofenceRadiusDefault: company.attendancePolicy?.geofenceRadiusDefault ?? 100,
        gpsAccuracyThreshold: company.attendancePolicy?.gpsAccuracyThreshold ?? 100,
      })
    }
  }, [selectedCompanyId, company])

  const handleToggle = (key: keyof typeof policy) => {
    setPolicy(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleChange = (key: keyof typeof policy, value: string) => {
    setPolicy(prev => ({ ...prev, [key]: parseInt(value) || 0 }))
  }

  const handleSave = async () => {
    if (!selectedCompanyId) return
    setSaving(true)
    try {
      await updateDoc(doc(db, "companies", selectedCompanyId), {
        attendancePolicy: policy,
        updatedAt: serverTimestamp()
      })
      toast({
        title: "Policies Saved",
        description: "Attendance policies have been successfully updated.",
      })
      fetchAll()
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message,
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Company Attendance Policies
          </CardTitle>
          <CardDescription>Configure global attendance rules, grace periods, and tracking permissions per company.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="w-full md:w-1/3">
            <Label className="text-xs font-medium text-gray-500 mb-1 block">Select Company</Label>
            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a company" />
              </SelectTrigger>
              <SelectContent>
                {companies.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCompanyId && (
            <div className="space-y-6 border-t pt-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                
                {/* Toggles */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-gray-900 border-b pb-2">Features & Tracking</h3>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Auto Shift Start</Label>
                      <p className="text-xs text-gray-500">Automatically check-in when entering geofence near shift time.</p>
                    </div>
                    <Switch checked={policy.autoShiftStart} onCheckedChange={() => handleToggle("autoShiftStart")} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Vendor HQ Support</Label>
                      <p className="text-xs text-gray-500">Allow attendance from Vendor Headquarters as a valid site.</p>
                    </div>
                    <Switch checked={policy.vendorHQEnabled} onCheckedChange={() => handleToggle("vendorHQEnabled")} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Multi-Site Tracking</Label>
                      <p className="text-xs text-gray-500">Allow employees to work across multiple sites in one shift.</p>
                    </div>
                    <Switch checked={policy.multiSiteEnabled} onCheckedChange={() => handleToggle("multiSiteEnabled")} />
                  </div>
                </div>

                {/* Thresholds */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-gray-900 border-b pb-2">Thresholds & Limits</h3>
                  
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5 flex-1">
                      <Label className="text-sm">Travel Grace Period (Mins)</Label>
                      <p className="text-xs text-gray-500">Max time allowed between sites before marking as a break.</p>
                    </div>
                    <Input className="w-20 text-center" type="number" value={policy.travelGracePeriodMins} onChange={e => handleChange("travelGracePeriodMins", e.target.value)} />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5 flex-1">
                      <Label className="text-sm">Break Grace Period (Mins)</Label>
                      <p className="text-xs text-gray-500">Time outside all sites before auto-marking as a break.</p>
                    </div>
                    <Input className="w-20 text-center" type="number" value={policy.breakGracePeriodMins} onChange={e => handleChange("breakGracePeriodMins", e.target.value)} />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5 flex-1">
                      <Label className="text-sm">Default Geofence Radius (Meters)</Label>
                      <p className="text-xs text-gray-500">Default coverage area when adding new sites.</p>
                    </div>
                    <Input className="w-20 text-center" type="number" value={policy.geofenceRadiusDefault} onChange={e => handleChange("geofenceRadiusDefault", e.target.value)} />
                  </div>
                </div>

              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Saving..." : "Save Policies"}
                </Button>
              </div>

            </div>
          )}

        </CardContent>
      </Card>
    </div>
  )
}
