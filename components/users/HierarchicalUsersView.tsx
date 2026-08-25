"use client";

import React, { useMemo } from "react";
import { User } from "@/lib/firestore/usersService";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Building2, Shield, Users, Store, User as UserIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface HierarchicalUsersViewProps {
  users: User[];
  companies: any[];
  vendors: any[];
  buildings: any[];
  cafeterias: any[];
}

export function HierarchicalUsersView({ users, companies, vendors, buildings, cafeterias }: HierarchicalUsersViewProps) {
  
  const superAdmins = useMemo(() => users.filter(u => u.userType === 'super_admin'), [users]);
  
  const getCompanyUsers = (companyId: string) => users.filter(u => u.userType === 'company_user' && (u.companyIds || []).includes(companyId));
  
  const getVendorStaffForCompany = (companyId: string) => {
    return users.filter(u => u.userType === 'vendor_staff' && (u.companyIds || []).includes(companyId));
  };
  
  const getEmployeesForCompany = (companyId: string) => {
    return users.filter(u => u.userType === 'employee' && (u.companyIds || []).includes(companyId));
  };

  const getVendorName = (vendorId: string) => vendors.find(v => v.id === vendorId)?.name || "Unknown Vendor";

  const renderUserList = (userList: User[], emptyMessage: string) => {
    if (userList.length === 0) return <p className="text-sm text-gray-400 italic">{emptyMessage}</p>;
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {userList.map(u => (
          <div key={u.id} className={`p-3 border rounded-md flex items-start gap-3 bg-white shadow-sm ${u.status === 'inactive' ? 'opacity-60 grayscale' : ''}`}>
            <div className="bg-gray-100 p-2 rounded-full">
              <UserIcon className="h-4 w-4 text-gray-500" />
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="font-semibold text-sm truncate">{u.name}</div>
              <div className="text-xs text-gray-500 truncate">{u.email}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                <Badge variant="outline" className="text-[10px] uppercase">{u.roleKey || u.userType}</Badge>
                {u.status === 'inactive' && <Badge variant="destructive" className="text-[10px]">Inactive</Badge>}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Super Admins Section */}
      {superAdmins.length > 0 && (
        <Card className="border-blue-200 shadow-sm">
          <CardHeader className="bg-blue-50/50 pb-3 border-b border-blue-100">
            <CardTitle className="text-lg flex items-center gap-2 text-blue-800">
              <Shield className="h-5 w-5" /> Super Administrators
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 bg-gray-50/30">
            {renderUserList(superAdmins, "No Super Admins found.")}
          </CardContent>
        </Card>
      )}

      {/* Companies Section */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Building2 className="h-6 w-6 text-gray-500" /> Client Companies
        </h3>
        
        {companies.length === 0 ? (
          <p className="text-sm text-gray-500 bg-gray-50 p-4 rounded border border-dashed">No companies available.</p>
        ) : (
          <Accordion type="multiple" className="w-full space-y-3">
            {companies.map(company => {
              const companyAdmins = getCompanyUsers(company.id);
              const vendorStaff = getVendorStaffForCompany(company.id);
              const employees = getEmployeesForCompany(company.id);
              
              // Group Vendor Staff by Vendor
              const vendorStaffByVendor = vendorStaff.reduce((acc, staff) => {
                const vid = staff.vendorId || "unassigned";
                if (!acc[vid]) acc[vid] = [];
                acc[vid].push(staff);
                return acc;
              }, {} as Record<string, User[]>);

              const totalUsersInCompany = companyAdmins.length + vendorStaff.length + employees.length;

              return (
                <AccordionItem key={company.id} value={company.id} className="border rounded-lg bg-white shadow-sm overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 hover:bg-gray-50 data-[state=open]:bg-gray-50 data-[state=open]:border-b">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg text-blue-700">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div className="text-left">
                          <div className="font-semibold text-gray-900">{company.name}</div>
                          <div className="text-xs text-gray-500 font-normal">{company.address || 'No address'}</div>
                        </div>
                      </div>
                      <Badge variant="secondary" className="font-normal">
                        {totalUsersInCompany} Users Assigned
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-0 bg-gray-50/50">
                    <div className="p-4 space-y-6">
                      
                      {/* Company Admins */}
                      <div>
                        <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                          <Users className="h-4 w-4 text-blue-500" /> Company Users & Admins
                        </h4>
                        {renderUserList(companyAdmins, "No company users assigned to this company.")}
                      </div>

                      {/* Vendor Staff Grouped by Vendor */}
                      <div>
                        <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                          <Store className="h-4 w-4 text-orange-500" /> Assigned Vendors & Staff
                        </h4>
                        
                        {Object.keys(vendorStaffByVendor).length === 0 ? (
                          <p className="text-sm text-gray-400 italic">No vendor staff assigned to this company.</p>
                        ) : (
                          <div className="space-y-4">
                            {Object.entries(vendorStaffByVendor).map(([vendorId, staffList]) => (
                              <div key={vendorId} className="border border-orange-100 bg-orange-50/30 rounded-lg p-3">
                                <h5 className="text-xs font-bold text-orange-800 uppercase mb-2">
                                  Vendor: {vendorId === "unassigned" ? "Unassigned Vendor" : getVendorName(vendorId)}
                                </h5>
                                {renderUserList(staffList as User[], "")}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Employees */}
                      <div>
                        <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                          <Users className="h-4 w-4 text-green-500" /> Employees
                        </h4>
                        {renderUserList(employees, "No employees assigned to this company.")}
                      </div>

                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>

    </div>
  );
}
