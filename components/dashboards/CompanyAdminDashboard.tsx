"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, Timestamp, onSnapshot } from "firebase/firestore";
import { ticketService } from "@/lib/firestore/ticketService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, ShieldCheck, Clock, Users, AlertTriangle, FileText, CheckCircle2, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function CompanyAdminDashboard({ companyIdOverride }: { companyIdOverride?: string }) {
  const { userProfile } = useAuth();
  const [vendorStaff, setVendorStaff] = useState<any[]>([]);
  const [expectedManpower, setExpectedManpower] = useState(0);
  const [activeManpower, setActiveManpower] = useState(0);
  const [loading, setLoading] = useState(true);
  const [raisingTicket, setRaisingTicket] = useState(false);
  const [isIncreaseModalOpen, setIsIncreaseModalOpen] = useState(false);
  const [increaseAmount, setIncreaseAmount] = useState<number>(0);
  const [increaseReason, setIncreaseReason] = useState("");

  useEffect(() => {
    const targetCompanyId = companyIdOverride || userProfile?.companyIds?.[0];
    if (!targetCompanyId) return;

    let unsubscribeCafeterias: () => void;
    let unsubscribeUsers: () => void;
    let unsubscribeSessions: () => void;

    const setupListeners = async () => {
      try {
        setLoading(true);

        // 1. Listen to Expected Manpower from Cafeterias (Filter by vendorId in memory to avoid missing index errors)
        const cafeteriasQuery = query(collection(db, 'cafetarias'), where('companyId', '==', targetCompanyId));
          
        unsubscribeCafeterias = onSnapshot(cafeteriasQuery, (snap) => {
          let totalExpected = 0;
          snap.forEach(doc => {
            const data = doc.data();
            // In-memory filter if restricted to a specific vendor
            if (userProfile?.vendorId && data.vendorId !== userProfile.vendorId) return;

            if (data.expectedManpower) {
              totalExpected += Number(data.expectedManpower);
            }
          });
          setExpectedManpower(totalExpected);
        }, (error) => {
          console.error("Cafeterias snapshot error:", error);
        });

        // 2. Listen to Vendor Staff assigned to this company (Filter by userType and vendorId in memory)
        const staffQuery = query(
          collection(db, 'users'), 
          where('companyIds', 'array-contains', targetCompanyId)
        );
        
        unsubscribeUsers = onSnapshot(staffQuery, (snap) => {
          let staffList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
          // In-memory filter for vendor_staff
          staffList = staffList.filter((staff: any) => staff.userType === 'vendor_staff');
          
          // In-memory filter if restricted to a specific vendor
          if (userProfile?.vendorId) {
            staffList = staffList.filter((staff: any) => staff.vendorId === userProfile.vendorId);
          }
          
          setVendorStaff(staffList);

          // 3. Re-calculate Active Manpower when staff list changes
          fetchActiveSessions(staffList);
        }, (error) => {
          console.error("Users snapshot error:", error);
        });

      } catch (err) {
        console.error("Error setting up company dashboard listeners:", err);
      } finally {
        setLoading(false);
      }
    };

    const fetchActiveSessions = async (staffList: any[]) => {
      if (staffList.length === 0) {
        setActiveManpower(0);
        return;
      }
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('timestamp', '>=', Timestamp.fromDate(startOfDay))
      );
      
      // Clear previous session listener if exists
      if (unsubscribeSessions) unsubscribeSessions();

      // Real-time listener for attendance today
      unsubscribeSessions = onSnapshot(attendanceQuery, (snap) => {
        // Group records by userId to find their latest status
        const latestUserStatus = new Map<string, { status: string, timestamp: number, companyId: string }>();
        
        snap.forEach(doc => {
          const data = doc.data();
          const userId = data.userId;
          
          let currentTimestamp = 0;
          if (data.timestamp) {
            if (typeof data.timestamp.toMillis === 'function') currentTimestamp = data.timestamp.toMillis();
            else if (data.timestamp.seconds) currentTimestamp = data.timestamp.seconds * 1000;
            else if (data.timestamp instanceof Date) currentTimestamp = data.timestamp.getTime();
            else currentTimestamp = new Date(data.timestamp).getTime();
          }
          
          if (!latestUserStatus.has(userId) || currentTimestamp > latestUserStatus.get(userId)!.timestamp) {
            latestUserStatus.set(userId, { 
              status: data.status, 
              timestamp: currentTimestamp,
              companyId: data.companyId 
            });
          }
        });

        // Count how many staff members are currently 'IN' for this company
        let activeCount = 0;
        
        latestUserStatus.forEach((userStatus, userId) => {
          if (userStatus.status !== 'IN') return;
          if (userStatus.companyId !== targetCompanyId) return;
          
          // If the admin is restricted to a vendor, we MUST verify the user belongs to that vendor
          if (userProfile?.vendorId) {
            const isVendorStaff = staffList.some(s => s.id === userId && s.vendorId === userProfile.vendorId);
            if (!isVendorStaff) return;
          }
          
          activeCount++;
        });
        
        setActiveManpower(activeCount);
      }, (error) => {
        console.error("Attendance snapshot error:", error);
      });
    };

    setupListeners();

    return () => {
      if (unsubscribeCafeterias) unsubscribeCafeterias();
      if (unsubscribeUsers) unsubscribeUsers();
      if (unsubscribeSessions) unsubscribeSessions();
    };
  }, [userProfile, companyIdOverride]);

  const handleRaiseShortageTicket = async () => {
    const targetCompanyId = companyIdOverride || userProfile?.companyIds?.[0];
    if (!targetCompanyId) return;
    setRaisingTicket(true);
    try {
      await ticketService.createTicket({
        title: `Manpower Shortage Alert - ${new Date().toLocaleDateString()}`,
        description: `Expected manpower was ${expectedManpower} but only ${activeManpower} vendor staff are actively signed in. Please arrange for immediate backup.`,
        creatorId: userProfile.id,
        creatorName: userProfile?.name || 'Admin',
        companyId: targetCompanyId,
        companyName: "Company", // Ideally fetch actual name
        priority: 'High',
        photos: []
      });
      toast.success("Shortage ticket raised successfully.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to raise ticket.");
    } finally {
      setRaisingTicket(false);
    }
  };

  const handleRequestIncrease = async () => {
    const targetCompanyId = companyIdOverride || userProfile?.companyIds?.[0];
    if (!targetCompanyId || increaseAmount <= 0) return;
    
    setRaisingTicket(true);
    try {
      await ticketService.createTicket({
        title: `Manpower Capacity Increase Request`,
        description: `Company requires an additional ${increaseAmount} staff on-site (Current target: ${expectedManpower}).\nReason provided: ${increaseReason}`,
        creatorId: userProfile?.id || 'admin',
        creatorName: userProfile?.name || 'Admin',
        companyId: targetCompanyId,
        companyName: "Company", 
        priority: 'Medium',
        photos: []
      });
      toast.success("Request for capacity increase submitted successfully.");
      setIsIncreaseModalOpen(false);
      setIncreaseAmount(0);
      setIncreaseReason("");
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit request.");
    } finally {
      setRaisingTicket(false);
    }
  };

  const getDocStatus = (doc: any) => {
    if (doc.status === 'expired') return { label: 'Expired', color: 'bg-red-100 text-red-700 border-red-200' };
    if (doc.status === 'pending') return { label: 'Pending Verification', color: 'bg-amber-100 text-amber-700 border-amber-200' };
    
    // Check if expiring within 30 days
    if (doc.expiryDate) {
      const expiry = new Date(doc.expiryDate.seconds ? doc.expiryDate.toDate() : doc.expiryDate);
      const daysLeft = (expiry.getTime() - new Date().getTime()) / (1000 * 3600 * 24);
      if (daysLeft <= 0) return { label: 'Expired', color: 'bg-red-100 text-red-700 border-red-200' };
      if (daysLeft < 30) return { label: `Expiring in ${Math.ceil(daysLeft)}d`, color: 'bg-orange-100 text-orange-700 border-orange-200' };
    }
    
    return { label: 'Valid', color: 'bg-green-100 text-green-700 border-green-200' };
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 animate-pulse">Loading dashboard...</div>;
  }

  const isShortage = expectedManpower > 0 && activeManpower < expectedManpower;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Manpower Overview */}
        <Card className={isShortage ? "border-red-200 shadow-sm" : "shadow-sm"}>
          <CardHeader className="pb-3 border-b bg-gray-50/50">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Daily Manpower Overview
            </CardTitle>
            <CardDescription>Live tracking of vendor staff attendance vs expected capacity.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4 text-center mb-6">
              <div className="p-4 border rounded-lg bg-gray-50">
                <div className="text-3xl font-bold text-gray-800 mb-1">{expectedManpower}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Expected Staff</div>
              </div>
              <div className={`p-4 border rounded-lg ${isShortage ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                <div className={`text-3xl font-bold mb-1 ${isShortage ? 'text-red-700' : 'text-green-700'}`}>{activeManpower}</div>
                <div className={`text-xs uppercase tracking-wider font-semibold ${isShortage ? 'text-red-600' : 'text-green-600'}`}>Active Today</div>
              </div>
            </div>

            {isShortage ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-red-800">Manpower Shortage Detected</h4>
                  <p className="text-xs text-red-600 mt-1 mb-3">You are currently {expectedManpower - activeManpower} staff short of your required capacity for today.</p>
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    className="w-full text-xs shadow-sm" 
                    onClick={handleRaiseShortageTicket}
                    disabled={raisingTicket}
                  >
                    <Ticket className="h-3 w-3 mr-2" />
                    {raisingTicket ? 'Raising Ticket...' : 'Raise Shortage Ticket to Vendor'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold text-green-800">Optimal Manpower</h4>
                  <p className="text-xs text-green-600 mt-0.5">Vendor attendance meets expected capacity.</p>
                </div>
              </div>
            )}

            <div className="mt-6 pt-4 border-t">
              <Button 
                variant="outline" 
                className="w-full text-xs text-gray-700 hover:text-indigo-700 hover:border-indigo-200 hover:bg-indigo-50"
                onClick={() => setIsIncreaseModalOpen(true)}
              >
                Request Capacity Increase
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Tracker */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b bg-gray-50/50">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-600" />
            Vendor Staff Compliance Tracker
          </CardTitle>
          <CardDescription>Monitor expiration of Police Verifications and Medical Certificates for all assigned vendors.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6 p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-6 py-3 font-medium">Staff Name</th>
                  <th className="px-6 py-3 font-medium">Document Type</th>
                  <th className="px-6 py-3 font-medium">Expiry Date</th>
                  <th className="px-6 py-3 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y border-t">
                {vendorStaff.map(staff => {
                  const docs = staff.complianceDocuments || [];
                  if (docs.length === 0) {
                    return (
                      <tr key={staff.id} className="bg-white hover:bg-gray-50/50">
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {staff.name}
                          <div className="text-xs text-gray-400 font-normal">{staff.phone}</div>
                        </td>
                        <td className="px-6 py-4 text-gray-500 italic" colSpan={3}>
                          No compliance documents uploaded by Vendor.
                        </td>
                      </tr>
                    );
                  }

                  return docs.map((doc: any, idx: number) => {
                    const statusInfo = getDocStatus(doc);
                    return (
                      <tr key={`${staff.id}-${idx}`} className="bg-white hover:bg-gray-50/50">
                        <td className="px-6 py-4">
                          {idx === 0 && (
                            <>
                              <div className="font-medium text-gray-900">{staff.name}</div>
                              <div className="text-xs text-gray-400">{staff.phone}</div>
                            </>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-gray-400" />
                            {doc.type}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {doc.expiryDate ? new Date(doc.expiryDate.seconds ? doc.expiryDate.toDate() : doc.expiryDate).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Badge variant="outline" className={`${statusInfo.color} font-medium border`}>
                            {statusInfo.label}
                          </Badge>
                        </td>
                      </tr>
                    );
                  });
                })}
                {vendorStaff.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      No vendor staff currently assigned to this company.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isIncreaseModalOpen} onOpenChange={setIsIncreaseModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Manpower Increase</DialogTitle>
            <DialogDescription>
              Submit a formal request to the Vendor to increase the baseline Expected Manpower for your facilities.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Additional Staff Needed</Label>
              <Input 
                type="number" 
                min="1" 
                value={increaseAmount || ''} 
                onChange={e => setIncreaseAmount(parseInt(e.target.value) || 0)} 
                placeholder="e.g. 5"
              />
            </div>
            <div className="space-y-2">
              <Label>Reason for Increase</Label>
              <Input 
                value={increaseReason} 
                onChange={e => setIncreaseReason(e.target.value)} 
                placeholder="e.g. Opening new cafeteria wing, seasonal demand"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsIncreaseModalOpen(false)}>Cancel</Button>
            <Button onClick={handleRequestIncrease} disabled={raisingTicket || increaseAmount <= 0}>
              {raisingTicket ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
