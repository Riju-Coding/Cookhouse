"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { approvalRequestsService, ApprovalRequest } from "@/lib/firestore/approvalRequestsService"
import { format } from "date-fns"
import { CheckCircle, XCircle, Clock, Building2, User, Check, X, FileSignature, ArrowRight } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MenuEditModal } from "@/components/menu-edit-modal"
import { useToast } from "@/components/ui/use-toast"

export default function ApprovalsPage() {
  const { userProfile, isSuperAdmin, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [loading, setLoading] = useState(true)

  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectRemarks, setRejectRemarks] = useState("")

  const [reviewingRequest, setReviewingRequest] = useState<ApprovalRequest | null>(null)

  useEffect(() => {
    if (!authLoading && userProfile) {
      if (userProfile.userType === 'vendor_staff' || isSuperAdmin) {
        fetchRequests()
      } else {
        setLoading(false)
      }
    } else if (!authLoading && !userProfile) {
      setLoading(false)
    }
  }, [userProfile, authLoading, isSuperAdmin])

  const fetchRequests = async () => {
    try {
      const vendorId = userProfile?.vendorId || "";
      if (vendorId) {
        const data = await approvalRequestsService.getPendingForVendor(vendorId)
        setRequests(data)
      } else {
        setRequests([])
      }
    } catch (err) {
      console.error("Error fetching approval requests:", err)
    } finally {
      setLoading(false)
    }
  }

  const confirmApprove = async (req: ApprovalRequest) => {
    if (!userProfile?.id || !req.id) return
    try {
      await approvalRequestsService.updateStatus(req.id, 'APPROVED', userProfile.id)
      setRequests(prev => prev.filter(r => r.id !== req.id))
      setReviewingRequest(null)
      toast({ title: "Approved", description: "Request has been approved and merged." })
    } catch (err) {
      console.error("Error approving request:", err)
      toast({ title: "Error", description: "Could not approve request.", variant: "destructive" })
    }
  }

  const confirmReject = async () => {
    if (!userProfile?.id || !rejectingId) return
    if (!rejectRemarks.trim()) {
      toast({ title: "Validation Error", description: "Remarks are required to reject.", variant: "destructive" })
      return
    }
    try {
      await approvalRequestsService.updateStatus(rejectingId, 'REJECTED', userProfile.id, rejectRemarks)
      setRequests(prev => prev.filter(r => r.id !== rejectingId))
      setRejectingId(null)
      setRejectRemarks("")
      toast({ title: "Rejected", description: "Request has been rejected." })
    } catch (err) {
      console.error("Error rejecting request:", err)
      toast({ title: "Error", description: "Could not reject request.", variant: "destructive" })
    }
  }

  // --- MENU UPDATION SAVE HOOK ---
  const handleMenuSave = async (menuData: any, updations: any[]) => {
    if (!reviewingRequest?.id || !userProfile?.id) return
    try {
      // Menu is saved by MenuEditModal. We just need to mark the request APPROVED.
      await approvalRequestsService.updateStatus(reviewingRequest.id, 'APPROVED', userProfile.id)
      setRequests(prev => prev.filter(r => r.id !== reviewingRequest.id))
      setReviewingRequest(null)
      toast({ title: "Approved", description: "Menu changes have been applied and request approved." })
    } catch (err) {
      console.error("Error marking request approved after menu save:", err)
    }
  }

  const getTargetTypeLabel = (type: string) => {
    switch (type) {
      case 'MENU_UPDATION': return 'Menu Updation'
      case 'MEAL_PLAN_STRUCTURE': return 'Meal Plan Structure'
      case 'STRUCTURAL_ASSIGNMENT': return 'Structural Assignment'
      default: return type.replace(/_/g, ' ')
    }
  }

  if (authLoading || loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium">Loading approvals...</p>
        </div>
      </div>
    )
  }

  if (userProfile?.userType !== 'vendor_staff' && !isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <div className="p-8 bg-white rounded-2xl shadow-sm border border-red-100 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-500">You do not have permission to view this page. Only vendor staff or administrators can manage approvals.</p>
        </div>
      </div>
    )
  }

  const renderStructureDiff = (req: ApprovalRequest) => {
    let payload = null;
    if (req.targetType === 'MEAL_PLAN_STRUCTURE') payload = req.mealPlanStructurePayload;
    if (req.targetType === 'STRUCTURAL_ASSIGNMENT') payload = req.structuralAssignmentPayload;

    if (!payload?.proposedWeekStructure) return <p>No structure changes proposed.</p>;

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">Review the proposed week structure below:</p>
        <div className="max-h-[60vh] overflow-y-auto border rounded-lg bg-gray-50 p-4 space-y-4">
          {days.map(day => {
            const dayData = payload.proposedWeekStructure[day]
            if (!dayData || Object.keys(dayData).length === 0) return null;
            return (
              <div key={day} className="bg-white p-3 rounded-md shadow-sm border">
                <h4 className="font-semibold text-gray-800 border-b pb-2 mb-2">{day}</h4>
                {Object.entries(dayData).map(([serviceId, sData]: [string, any]) => (
                  <div key={serviceId} className="ml-2 mb-2">
                    <span className="text-sm font-medium text-blue-600">Service: {sData.name || serviceId}</span>
                    {sData.subServices && Object.entries(sData.subServices).map(([subId, ssData]: [string, any]) => (
                      <div key={subId} className="ml-4 text-sm mt-1">
                        <span className="text-gray-700 font-medium">{ssData.name || subId}</span>
                        <div className="ml-4 mt-1 flex flex-wrap gap-2">
                          {ssData.mealPlans && Object.entries(ssData.mealPlans).map(([mpId, mpData]: [string, any]) => (
                            <span key={mpId} className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded text-xs border border-orange-100">
                              {mpData.name || mpId}
                              {req.targetType === 'STRUCTURAL_ASSIGNMENT' && mpData.rates && (
                                <span className="ml-1 opacity-70">(Rates attached)</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-orange-100 rounded-xl">
          <FileSignature className="w-6 h-6 text-orange-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pending Approvals</h1>
          <p className="text-gray-500 text-sm mt-1">Review and manage client requests for menus and meal plans.</p>
        </div>
      </div>

      <div className="space-y-4">
        {requests.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">All Caught Up!</h3>
            <p className="text-gray-500">There are no pending approval requests at the moment.</p>
          </div>
        ) : (
          requests.map(request => (
            <div key={request.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all hover:shadow-md hover:border-orange-100 group">
              <div className="space-y-4 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg text-xs font-bold tracking-wide uppercase border border-orange-100 shadow-sm">
                    {getTargetTypeLabel(request.targetType)}
                  </span>
                  <span className="text-xs text-gray-500 flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                    <Clock className="w-3.5 h-3.5" />
                    {request.requestedAt?.toDate ? format(request.requestedAt.toDate(), 'PPP p') : 'Unknown Date'}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3 text-sm text-gray-700">
                    <div className="w-8 h-8 bg-white rounded-lg border border-gray-100 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-medium mb-0.5">Company ID</p>
                      <p className="font-semibold text-gray-900">{request.companyId}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 text-sm text-gray-700">
                    <div className="w-8 h-8 bg-white rounded-lg border border-gray-100 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-medium mb-0.5">Requested By</p>
                      <p className="font-semibold text-gray-900">{request.requestedByUserName}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 md:border-l md:pl-6 border-gray-100 pt-4 md:pt-0 border-t md:border-t-0">
                <button
                  onClick={() => setRejectingId(request.id!)}
                  className="flex-1 md:flex-none px-4 py-2.5 flex items-center justify-center gap-2 text-red-600 bg-white hover:bg-red-50 rounded-xl font-semibold text-sm transition-colors border border-red-200 hover:border-red-300"
                >
                  <X className="w-4 h-4" />
                  Reject
                </button>
                <button
                  onClick={() => setReviewingRequest(request)}
                  className="flex-1 md:flex-none px-4 py-2.5 flex items-center justify-center gap-2 text-white bg-green-600 hover:bg-green-700 rounded-xl font-semibold text-sm transition-all shadow-sm shadow-green-600/20 hover:shadow-green-600/30 whitespace-nowrap"
                >
                  Review & Approve <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Reject Dialog */}
      <Dialog open={!!rejectingId} onOpenChange={(o) => !o && setRejectingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Request</DialogTitle>
            <DialogDescription>Please provide a reason for rejecting this change request.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea 
              placeholder="E.g., We cannot accommodate this menu item on Wednesdays."
              value={rejectRemarks}
              onChange={e => setRejectRemarks(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmReject}>Confirm Rejection</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review & Approve Dialog (Structures) */}
      <Dialog open={!!reviewingRequest && reviewingRequest.targetType !== 'MENU_UPDATION'} onOpenChange={(o) => !o && setReviewingRequest(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Review {reviewingRequest?.targetType === 'MEAL_PLAN_STRUCTURE' ? 'Meal Plan Structure' : 'Structural Assignment'}</DialogTitle>
            <DialogDescription>Review the proposed changes below before approving.</DialogDescription>
          </DialogHeader>
          
          <div className="py-2">
            {reviewingRequest && renderStructureDiff(reviewingRequest)}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewingRequest(null)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => confirmApprove(reviewingRequest!)}>Approve & Merge</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Menu Edit Modal for Review */}
      {reviewingRequest?.targetType === 'MENU_UPDATION' && reviewingRequest.menuUpdationPayload && (
        <MenuEditModal
          isOpen={true}
          onClose={() => setReviewingRequest(null)}
          menuId={reviewingRequest.targetId}
          menuType="company"
          mode="edit"
          onSave={handleMenuSave}
          preFilledChanges={reviewingRequest.menuUpdationPayload.changedCells}
        />
      )}
    </div>
  )
}
