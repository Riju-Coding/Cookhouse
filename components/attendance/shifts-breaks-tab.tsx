import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Clock, Plus, Trash2, Edit2, Settings, ChevronRight } from "lucide-react"
import { db } from "@/lib/firebase"
import { doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { toast } from "@/hooks/use-toast"

export function ShiftsAndBreaksTab({ cafeterias, fetchAll }: { cafeterias: any[], fetchAll: () => void }) {
  const [selectedCafe, setSelectedCafe] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [shifts, setShifts] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  const openEditModal = (cafe: any) => {
    setSelectedCafe(cafe)
    // Map legacy data to new format if it exists but no shifts array is present
    if (!cafe.shifts || cafe.shifts.length === 0) {
      if (cafe.shiftStart || cafe.shiftEnd) {
         setShifts([{
           id: "legacy_shift",
           name: "Default Shift",
           startTime: cafe.shiftStart || "09:00",
           endTime: cafe.shiftEnd || "18:00",
           breaks: cafe.breaks || []
         }])
      } else {
         setShifts([])
      }
    } else {
      setShifts(cafe.shifts)
    }
    setIsModalOpen(true)
  }

  const addShift = () => {
    setShifts([...shifts, {
      id: `shift_${Date.now()}`,
      name: "New Shift",
      startTime: "09:00",
      endTime: "17:00",
      breaks: []
    }])
  }

  const removeShift = (index: number) => {
    setShifts(shifts.filter((_, i) => i !== index))
  }

  const updateShift = (index: number, field: string, value: any) => {
    const newShifts = [...shifts]
    newShifts[index] = { ...newShifts[index], [field]: value }
    setShifts(newShifts)
  }

  const addBreak = (shiftIndex: number) => {
    const newShifts = [...shifts]
    newShifts[shiftIndex].breaks.push({ name: "Lunch", maxMinutes: 30 })
    setShifts(newShifts)
  }

  const removeBreak = (shiftIndex: number, breakIndex: number) => {
    const newShifts = [...shifts]
    newShifts[shiftIndex].breaks.splice(breakIndex, 1)
    setShifts(newShifts)
  }

  const updateBreak = (shiftIndex: number, breakIndex: number, field: string, value: any) => {
    const newShifts = [...shifts]
    newShifts[shiftIndex].breaks[breakIndex] = { ...newShifts[shiftIndex].breaks[breakIndex], [field]: value }
    setShifts(newShifts)
  }

  const handleSave = async () => {
    if (!selectedCafe) return
    setSaving(true)
    try {
      await updateDoc(doc(db, "cafetarias", selectedCafe.id), {
        shifts,
        updatedAt: serverTimestamp()
      })
      toast({
        title: "Success",
        description: "Shifts and breaks updated successfully.",
      })
      fetchAll()
      setIsModalOpen(false)
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
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5 text-green-600" />
            Manage Shifts & Breaks
          </CardTitle>
          <CardDescription>Configure multiple shifts (e.g. Morning, Night) and break limits per cafeteria.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cafeteria</TableHead>
                  <TableHead>Company & Building</TableHead>
                  <TableHead>Configured Shifts</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cafeterias.map((cafe) => (
                  <TableRow key={cafe.id}>
                    <TableCell className="font-medium">{cafe.name}</TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {cafe.companyName} - {cafe.buildingName}
                    </TableCell>
                    <TableCell>
                      {cafe.shifts?.length ? (
                        <div className="flex gap-2 flex-col">
                          {cafe.shifts.map((s: any, i: number) => (
                            <div key={i} className="text-sm font-medium">
                              {s.name} <span className="text-gray-500 font-normal">({s.startTime}-{s.endTime})</span>
                              {s.breaks?.length > 0 && <span className="text-xs text-blue-600 ml-2 bg-blue-50 px-1 rounded">{s.breaks.length} Breaks</span>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">Legacy or None Configured</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEditModal(cafe)}>
                        <Edit2 className="h-4 w-4 mr-1" /> Configure
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {cafeterias.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-gray-500">
                      No cafeterias found. Add them in structure management.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Configure Shifts: {selectedCafe?.name}</DialogTitle>
            <DialogDescription>
              Create multiple shifts for this cafeteria and set up the allowed breaks for each shift.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4 overflow-y-auto pr-2">
            <div className="flex justify-end">
                <Button onClick={addShift} size="sm" variant="outline"><Plus className="w-4 h-4 mr-2" /> Add New Shift</Button>
            </div>

            {shifts.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border">
                    <Clock className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p>No shifts configured yet.</p>
                </div>
            ) : (
              <div className="space-y-6">
                {shifts.map((shift, sIndex) => (
                    <div key={shift.id} className="border rounded-xl p-4 bg-gray-50/50 shadow-sm relative">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="absolute top-2 right-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => removeShift(sIndex)}
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 pr-8">
                            <div className="space-y-2">
                                <Label className="text-xs">Shift Name</Label>
                                <Input value={shift.name} onChange={e => updateShift(sIndex, "name", e.target.value)} placeholder="e.g. Morning Shift" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs">Start Time</Label>
                                <Input type="time" value={shift.startTime} onChange={e => updateShift(sIndex, "startTime", e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs">End Time</Label>
                                <Input type="time" value={shift.endTime} onChange={e => updateShift(sIndex, "endTime", e.target.value)} />
                            </div>
                        </div>

                        <div className="bg-white border rounded-lg p-3">
                            <div className="flex justify-between items-center mb-3">
                                <Label className="text-xs font-semibold text-gray-600">Configured Breaks for this Shift</Label>
                                <Button size="sm" variant="secondary" onClick={() => addBreak(sIndex)} className="h-7 text-xs">
                                    <Plus className="w-3 h-3 mr-1" /> Add Break
                                </Button>
                            </div>
                            
                            {shift.breaks.length === 0 ? (
                                <p className="text-xs text-gray-400 italic">No breaks configured for this shift.</p>
                            ) : (
                                <div className="space-y-2">
                                    {shift.breaks.map((b: any, bIndex: number) => (
                                        <div key={bIndex} className="flex gap-2 items-center">
                                            <Input 
                                                className="h-8 text-sm flex-1" 
                                                placeholder="Break Name" 
                                                value={b.name} 
                                                onChange={e => updateBreak(sIndex, bIndex, "name", e.target.value)} 
                                            />
                                            <div className="flex items-center gap-2">
                                                <Input 
                                                    className="h-8 text-sm w-20" 
                                                    type="number" 
                                                    placeholder="Mins" 
                                                    value={b.maxMinutes} 
                                                    onChange={e => updateBreak(sIndex, bIndex, "maxMinutes", parseInt(e.target.value)||0)} 
                                                />
                                                <span className="text-xs text-gray-500">mins</span>
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600" onClick={() => removeBreak(sIndex, bIndex)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700">
              {saving ? "Saving..." : "Save Shift Configurations"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
