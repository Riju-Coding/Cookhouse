// @ts-nocheck
"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { complianceRecordsService, type ComplianceRecord, type ComplianceRecordStatus } from "@/lib/firestore/complianceRecordsService"
import { Loader2, CheckCircle2, AlertTriangle, XCircle, FileText, MapPin, Truck, Thermometer, User } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { auth } from "@/lib/firebase"

interface ComplianceRecordModalProps {
  isOpen: boolean
  onClose: () => void
  recordId: string | null
  onStatusChange?: () => void
}

export function ComplianceRecordModal({ isOpen, onClose, recordId, onStatusChange }: ComplianceRecordModalProps) {
  const [record, setRecord] = useState<ComplianceRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (isOpen && recordId) {
      loadRecord()
    } else {
      setRecord(null)
    }
  }, [isOpen, recordId])

  const loadRecord = async () => {
    setLoading(true)
    try {
      const data = await complianceRecordsService.getById(recordId!)
      setRecord(data)
    } catch (e) {
      toast({ title: "Error", description: "Failed to load record details.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (status: ComplianceRecordStatus) => {
    if (!record) return
    setUpdating(true)
    try {
      const user = auth.currentUser
      await complianceRecordsService.updateStatus(
        record.id, 
        status, 
        user?.uid || 'admin', 
        user?.displayName || 'Admin'
      )
      toast({ title: "Success", description: `Record marked as ${status}.` })
      loadRecord()
      if (onStatusChange) onStatusChange()
    } catch (e) {
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" })
    } finally {
      setUpdating(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {loading || !record ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
            <p className="text-gray-500">Loading record details...</p>
          </div>
        ) : (
          <>
            <DialogHeader className="p-6 border-b bg-gray-50 shrink-0">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <DialogTitle className="text-xl">{record.templateName || record.formName || "Compliance Record"}</DialogTitle>
                    <Badge variant={
                      record.status === 'approved' ? 'default' : 
                      record.status === 'flagged' ? 'destructive' : 
                      record.status === 'rejected' ? 'destructive' :
                      'secondary'
                    } className="uppercase text-[10px]">
                      {record.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-500 flex items-center gap-4">
                    <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> {(record.templateType || 'legacy').replace('_', ' ')}</span>
                    <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {record.companyName || '—'} {record.buildingName ? `- ${record.buildingName}` : ''}</span>
                    <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {record.submittedByName || 'Unknown User'}</span>
                  </div>
                </div>
              </div>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white border rounded-lg p-3 shadow-sm">
                  <p className="text-xs text-gray-500 font-medium">Date</p>
                  <p className="font-semibold">{record.date ? new Date(record.date).toLocaleDateString() : (record.createdAt?.toMillis ? new Date(record.createdAt.toMillis()).toLocaleDateString() : '—')}</p>
                </div>
                {record.batchNumber && (
                  <div className="bg-white border rounded-lg p-3 shadow-sm">
                    <p className="text-xs text-gray-500 font-medium">Batch Number</p>
                    <p className="font-semibold text-xs mt-1">{record.batchNumber}</p>
                  </div>
                )}
                {record.vendorName && (
                  <div className="bg-white border rounded-lg p-3 shadow-sm">
                    <p className="text-xs text-gray-500 font-medium">Vendor</p>
                    <p className="font-semibold">{record.vendorName}</p>
                  </div>
                )}
                {record.vehicleNumber && (
                  <div className="bg-white border rounded-lg p-3 shadow-sm">
                    <p className="text-xs text-gray-500 font-medium">Vehicle</p>
                    <p className="font-semibold">{record.vehicleNumber}</p>
                  </div>
                )}
              </div>

              {/* Vehicle Checklist */}
              {record.vehicleCondition && record.vehicleCondition.checks && Object.keys(record.vehicleCondition.checks).length > 0 && (
                <div className="border rounded-lg overflow-hidden shadow-sm">
                  <div className="bg-slate-100 p-3 border-b font-semibold flex items-center gap-2">
                    <Truck className="h-4 w-4" /> Vehicle Condition
                  </div>
                  <div className="p-0 bg-white grid grid-cols-1 md:grid-cols-2">
                    {Object.entries(record.vehicleCondition.checks).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between p-3 border-b border-r last:border-b-0">
                        <span className="text-sm font-medium capitalize">{key.replace(/_/g, ' ')}</span>
                        {typeof value === 'boolean' ? (
                          value ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <span className="text-sm">{String(value)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Menu Items Table */}
              {record.items && record.items.length > 0 && (
                <div className="border rounded-lg overflow-hidden shadow-sm">
                  <div className="bg-slate-100 p-3 border-b font-semibold flex items-center gap-2">
                    <Thermometer className="h-4 w-4" /> Menu Items & Readings
                  </div>
                  <Table className="bg-white">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item Name</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Temperature</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {record.items.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{item.menuItemName}</TableCell>
                          <TableCell>{item.quantity ? `${item.quantity} ${item.quantityUnit || 'units'}` : '—'}</TableCell>
                          <TableCell>
                            {item.temperature ? (
                              <span className={`px-2 py-1 rounded text-xs font-bold ${
                                item.temperature < 60 ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                              }`}>
                                {item.temperature} {item.temperatureUnit || '°C'}
                              </span>
                            ) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* General Checklist Answers */}
              {record.answers && record.answers.length > 0 && (
                <div className="border rounded-lg overflow-hidden shadow-sm">
                  <div className="bg-slate-100 p-3 border-b font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Checklist Responses
                  </div>
                  <div className="p-4 bg-white space-y-4">
                    {record.answers.map((ans, idx) => (
                      <div key={idx} className="border-b pb-3 last:border-b-0 last:pb-0">
                        <p className="text-sm text-gray-500 mb-1">{ans.question || `Field ID: ${ans.fieldId}`}</p>
                        <p className="font-medium capitalize">{String(ans.answer || ans.value || '—')}</p>
                        {ans.photoUrl && (
                          <div className="mt-2">
                            <img src={ans.photoUrl} alt="Answer attachment" className="h-24 w-24 object-cover rounded-md border" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
            </div>

            <div className="p-4 border-t bg-gray-50 shrink-0 flex items-center justify-between">
              <Button variant="outline" onClick={onClose}>Close</Button>
              {record.status === 'submitted' && (
                <div className="flex gap-2">
                  <Button variant="destructive" onClick={() => handleUpdateStatus('rejected')} disabled={updating}>
                    <XCircle className="h-4 w-4 mr-2" /> Reject
                  </Button>
                  <Button variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 hover:bg-amber-100" onClick={() => handleUpdateStatus('flagged')} disabled={updating}>
                    <AlertTriangle className="h-4 w-4 mr-2" /> Flag Issue
                  </Button>
                  <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleUpdateStatus('approved')} disabled={updating}>
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Approve
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
