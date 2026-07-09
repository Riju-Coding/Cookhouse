"use client";

import React, { useState } from "react";
import { User } from "@/lib/firestore/usersService";
import { Cafeteria, cafeteriasService } from "@/lib/firestore/cafeteriasService";
import { Building2, Store, Users, UserCheck, Settings, Save, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface OrganizationHierarchyViewProps {
  users: User[];
  companies: any[];
  cafeterias: Cafeteria[];
  vendors: any[];
}

export function OrganizationHierarchyView({ users, companies, cafeterias, vendors }: OrganizationHierarchyViewProps) {
  const [localCafeterias, setLocalCafeterias] = useState<Cafeteria[]>(cafeterias);
  const [savingManpowerId, setSavingManpowerId] = useState<string | null>(null);

  // Group cafeterias by company
  const getCompanyCafeterias = (companyId: string) => localCafeterias.filter(c => c.companyId === companyId);
  
  // Get Vendor assigned to cafeteria
  const getCafeteriaVendor = (vendorId: string) => vendors.find(v => v.id === vendorId);

  // Get Users assigned to cafeteria
  const getCafeteriaUsers = (cafeteriaId: string) => users.filter(u => u.cafeteriaIds?.includes(cafeteriaId));

  const handleUpdateManpower = async (cafeteriaId: string, newValue: number) => {
    try {
      setSavingManpowerId(cafeteriaId);
      await cafeteriasService.update(cafeteriaId, { expectedManpower: newValue });
      
      // Update local state
      setLocalCafeterias(prev => prev.map(c => 
        c.id === cafeteriaId ? { ...c, expectedManpower: newValue } : c
      ));
      
      toast.success("Expected Manpower updated successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update manpower");
    } finally {
      setSavingManpowerId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-blue-900">Organization Hierarchy & Manpower Config</h3>
          <p className="text-sm text-blue-700 mt-1">
            View your entire staff deployment tree. You can also directly configure the <strong>Expected Manpower</strong> 
            (target active vendor staff) required for each individual cafeteria from this screen.
          </p>
        </div>
      </div>

      <Accordion type="multiple" defaultValue={companies.map(c => c.id)} className="space-y-4">
        {companies.map(company => {
          const companyCafes = getCompanyCafeterias(company.id);
          
          return (
            <AccordionItem key={company.id} value={company.id} className="border bg-white rounded-lg shadow-sm px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <Building2 className="h-6 w-6 text-indigo-600" />
                  <div className="text-left">
                    <div className="font-bold text-lg text-gray-900">{company.name}</div>
                    <div className="text-sm text-gray-500 font-normal">{companyCafes.length} Cafeterias Managed</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 pb-6 space-y-6">
                {companyCafes.length === 0 ? (
                  <div className="text-center p-6 bg-gray-50 rounded-lg text-gray-400 border border-dashed">
                    No cafeterias assigned to this company yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {companyCafes.map(cafe => {
                      const cafeVendor = getCafeteriaVendor(cafe.vendorId);
                      const cafeUsers = getCafeteriaUsers(cafe.id);
                      
                      // Group users by role
                      const kams = cafeUsers.filter(u => u.roleKey.toLowerCase().includes('kam'));
                      const cafeManagers = cafeUsers.filter(u => u.roleKey.toLowerCase().includes('manager') && !u.roleKey.toLowerCase().includes('kam'));
                      const vendorStaff = cafeUsers.filter(u => u.userType === 'vendor_staff' && !kams.includes(u) && !cafeManagers.includes(u));
                      const otherStaff = cafeUsers.filter(u => !kams.includes(u) && !cafeManagers.includes(u) && !vendorStaff.includes(u));

                      return (
                        <Card key={cafe.id} className="border-gray-200 overflow-hidden shadow-none">
                          <CardHeader className="bg-gray-50/80 pb-3 border-b border-gray-100 p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <Store className="h-5 w-5 text-blue-500" />
                                <div>
                                  <CardTitle className="text-base">{cafe.name}</CardTitle>
                                  {cafeVendor && (
                                    <Badge variant="outline" className="mt-1 bg-white text-[10px]">Vendor: {cafeVendor.name}</Badge>
                                  )}
                                </div>
                              </div>
                              
                              {/* Expected Manpower Input Box */}
                              <div className="bg-white p-2 border rounded-md shadow-sm">
                                <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Expected Manpower</label>
                                <div className="flex items-center gap-2">
                                  <Input 
                                    type="number" 
                                    className="h-7 w-20 text-sm font-semibold"
                                    defaultValue={cafe.expectedManpower || 0}
                                    onBlur={(e) => handleUpdateManpower(cafe.id, parseInt(e.target.value) || 0)}
                                    disabled={savingManpowerId === cafe.id}
                                  />
                                  {savingManpowerId === cafe.id ? (
                                    <span className="text-xs text-gray-400 animate-pulse">Saving...</span>
                                  ) : (
                                    <Save className="h-3.5 w-3.5 text-gray-400" />
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                          
                          <CardContent className="p-4 bg-white space-y-4">
                            {/* Key Account Managers */}
                            {kams.length > 0 && (
                              <div>
                                <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1 mb-2">
                                  <UserCheck className="h-3 w-3" /> Key Account Managers
                                </h4>
                                <div className="space-y-1">
                                  {kams.map(u => (
                                    <div key={u.id} className="flex justify-between items-center text-sm p-1.5 bg-blue-50/50 rounded border border-blue-100">
                                      <span className="font-medium text-blue-900">{u.name}</span>
                                      <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-700 border-none">{u.roleKey}</Badge>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Cafe Managers */}
                            {cafeManagers.length > 0 && (
                              <div>
                                <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1 mb-2">
                                  <Settings className="h-3 w-3" /> Cafe Managers
                                </h4>
                                <div className="space-y-1">
                                  {cafeManagers.map(u => (
                                    <div key={u.id} className="flex justify-between items-center text-sm p-1.5 bg-purple-50/50 rounded border border-purple-100">
                                      <span className="font-medium text-purple-900">{u.name}</span>
                                      <Badge variant="secondary" className="text-[10px] bg-purple-100 text-purple-700 border-none">{u.roleKey}</Badge>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Vendor Staff Pool */}
                            {vendorStaff.length > 0 && (
                              <div>
                                <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1 mb-2">
                                  <Users className="h-3 w-3" /> Vendor Staff Assigned ({vendorStaff.length})
                                </h4>
                                <div className="flex flex-wrap gap-1.5">
                                  {vendorStaff.map(u => (
                                    <Badge key={u.id} variant="outline" className="bg-gray-50 text-gray-700 font-normal text-xs border-gray-200">
                                      {u.name}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Other Users */}
                            {otherStaff.length > 0 && (
                              <div>
                                <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1 mb-2">
                                  <Users className="h-3 w-3" /> Other Assigned Users ({otherStaff.length})
                                </h4>
                                <div className="flex flex-wrap gap-1.5">
                                  {otherStaff.map(u => (
                                    <Badge key={u.id} variant="outline" className="bg-gray-50 text-gray-500 font-normal text-[10px] border-gray-200">
                                      {u.name} ({u.roleKey})
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {cafeUsers.length === 0 && (
                              <div className="text-sm text-gray-400 italic py-2">
                                No users currently assigned to this cafeteria.
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </div>
  );
}
