"use client";

import React, { useState, useEffect } from "react";
import { User } from "@/lib/firestore/usersService";
import { Cafeteria } from "@/lib/firestore/cafeteriasService";
import { complianceTemplatesService, ComplianceTemplate } from "@/lib/firestore/complianceTemplatesService";
import { complianceTemplateFieldsService, ComplianceTemplateField } from "@/lib/firestore/complianceTemplateFieldsService";
import { Building2, Store, Users, FileText, ChevronRight, ChevronDown, ListChecks, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

interface KAMHierarchyViewProps {
  users: User[];
  roles?: any[];
  companies: any[];
  buildings: any[];
  cafeterias: Cafeteria[];
  vendors: any[];
}

export function KAMHierarchyView({ users, roles = [], companies, buildings, cafeterias, vendors }: KAMHierarchyViewProps) {
  const [templates, setTemplates] = useState<ComplianceTemplate[]>([]);
  const [templateFields, setTemplateFields] = useState<Record<string, ComplianceTemplateField[]>>({});
  const [loadingFields, setLoadingFields] = useState<Record<string, boolean>>({});
  const [isExporting, setIsExporting] = useState(false);

  // Robustly identify Key Account Managers
  const kamRoleIds = roles
    .filter(r => 
      r.key === 'key_account_manager' || 
      (r.name && r.name.toLowerCase().includes('key account manager')) ||
      (r.name && r.name.toLowerCase().includes('kam'))
    )
    .map(r => r.id);

  const kams = users.filter(u => 
    u.roleKey === 'key_account_manager' || 
    (u.roleId && kamRoleIds.includes(u.roleId))
  );

  useEffect(() => {
    const fetchTemplates = async () => {
      const allTemplates = await complianceTemplatesService.getAll();
      setTemplates(allTemplates);
    };
    fetchTemplates();
  }, []);

  const loadFields = async (templateId: string) => {
    if (templateFields[templateId]) return; // Already loaded
    
    setLoadingFields(prev => ({ ...prev, [templateId]: true }));
    try {
      const fields = await complianceTemplateFieldsService.getByTemplateId(templateId);
      setTemplateFields(prev => ({ ...prev, [templateId]: fields }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingFields(prev => ({ ...prev, [templateId]: false }));
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      // Fetch all fields once to avoid N+1 queries during export
      const allFieldsSnap = await getDocs(collection(db, 'complianceTemplateFields'));
      const allFields = allFieldsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as ComplianceTemplateField[];

      kams.forEach(kam => {
        const kamVendor = vendors.find(v => v.id === kam.vendorId);
        const kamCompanies = companies.filter(c => kam.companyIds?.includes(c.id));
        
        // Skip KAMs with no companies
        if (kamCompanies.length === 0) return;

        const sheetData: any[] = [];
        sheetData.push(["Company", "Building", "Cafeteria", "Staff", "Compliance Questions"]);
        const merges: any[] = [];
        let currentRow = 1; // 0 is header

        kamCompanies.forEach(company => {
          const companyBuildings = buildings.filter(b => b.companyId === company.id && kam.buildingIds?.includes(b.id));

          if (companyBuildings.length === 0) {
            sheetData.push([company.name, "No Buildings Assigned", "", "", ""]);
            currentRow++;
          }

          companyBuildings.forEach(building => {
            const buildingCafes = cafeterias.filter(c => c.buildingId === building.id && kam.cafeteriaIds?.includes(c.id));
            
            if (buildingCafes.length === 0) {
              sheetData.push([company.name, building.name, "No Cafeterias Assigned", "", ""]);
              currentRow++;
            }

            buildingCafes.forEach(cafe => {
              // Get assigned staff
              const staff = users
                .filter(u => u.userType === 'employee' && u.cafeteriaIds?.includes(cafe.id))
                .map(u => u.name)
                .join(", ");
              
              // Get assigned questions
              const cafeTemplates = templates.filter(t => t.cafetariaId === cafe.id || t.buildingId === building.id);
              let allQuestions: string[] = [];
              
              cafeTemplates.forEach(t => {
                const fields = allFields.filter(f => f.templateId === t.id);
                fields.forEach(f => {
                  allQuestions.push(`[${t.name}] ${f.question}`);
                });
              });

              if (allQuestions.length === 0) {
                sheetData.push([
                  company.name,
                  building.name,
                  cafe.name,
                  staff || "No Staff",
                  "No Compliances"
                ]);
                currentRow++;
              } else {
                const startRow = currentRow;
                allQuestions.forEach((q, idx) => {
                  if (idx === 0) {
                    sheetData.push([
                      company.name,
                      building.name,
                      cafe.name,
                      staff || "No Staff",
                      q
                    ]);
                  } else {
                    sheetData.push(["", "", "", "", q]);
                  }
                  currentRow++;
                });
                
                const endRow = currentRow - 1;
                if (endRow > startRow) {
                  // Merge Company
                  merges.push({ s: { r: startRow, c: 0 }, e: { r: endRow, c: 0 } });
                  // Merge Building
                  merges.push({ s: { r: startRow, c: 1 }, e: { r: endRow, c: 1 } });
                  // Merge Cafeteria
                  merges.push({ s: { r: startRow, c: 2 }, e: { r: endRow, c: 2 } });
                  // Merge Staff
                  merges.push({ s: { r: startRow, c: 3 }, e: { r: endRow, c: 3 } });
                }
              }
            });
          });
        });

        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws['!merges'] = merges;
        ws['!cols'] = [
          {wch: 20}, // Company
          {wch: 20}, // Building
          {wch: 20}, // Cafeteria
          {wch: 20}, // Staff
          {wch: 60}  // Questions
        ];

        // Setup sheet name and avoid duplicates
        let sheetName = kamVendor ? `${kamVendor.name} - ${kam.name}` : kam.name;
        sheetName = sheetName.replace(/[\[\]\*\?\:\/\\]/g, ""); // Remove invalid excel chars
        if (sheetName.length > 31) {
          sheetName = sheetName.substring(0, 31);
        }
        
        let finalSheetName = sheetName;
        let counter = 1;
        while (wb.SheetNames.includes(finalSheetName)) {
           const suffix = `_${counter}`;
           finalSheetName = sheetName.substring(0, 31 - suffix.length) + suffix;
           counter++;
        }

        XLSX.utils.book_append_sheet(wb, ws, finalSheetName);
      });

      XLSX.writeFile(wb, "KAM_Overview_Export.xlsx");
    } catch (e) {
      console.error(e);
      alert("Failed to export Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  if (kams.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardContent className="py-12 text-center text-gray-500">
          <Users className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <p>No Key Account Managers found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end mb-4">
        <Button 
          variant="outline" 
          className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
          onClick={handleExportExcel}
          disabled={isExporting}
        >
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? "Exporting..." : "Export to Excel"}
        </Button>
      </div>

      {kams.map(kam => {
        const kamVendor = vendors.find(v => v.id === kam.vendorId);
        const kamCompanies = companies.filter(c => kam.companyIds?.includes(c.id));
        
        return (
          <Card key={kam.id} className="shadow-sm border-blue-100 overflow-hidden">
            <CardHeader className="bg-blue-50/50 border-b pb-4">
              <CardTitle className="text-lg flex items-center gap-2 text-blue-900">
                <Users className="h-5 w-5 text-blue-500" />
                {kam.name}
                <Badge variant="outline" className="ml-2 bg-blue-100 text-blue-700 border-blue-200">
                  Key Account Manager
                </Badge>
                {kamVendor && (
                  <Badge className="ml-auto bg-gray-800 text-white font-normal text-xs">
                    {kamVendor.name}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {kamCompanies.length === 0 ? (
                <div className="p-6 text-sm text-gray-500">No companies assigned to this manager.</div>
              ) : (
                <Accordion type="multiple" className="w-full">
                  {kamCompanies.map(company => {
                    const companyBuildings = buildings.filter(b => b.companyId === company.id && kam.buildingIds?.includes(b.id));

                    return (
                      <AccordionItem value={`comp-${company.id}`} key={company.id} className="border-b-0 border-t">
                        <AccordionTrigger className="px-6 py-4 hover:bg-gray-50 hover:no-underline font-semibold">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-gray-500" />
                            {company.name}
                            <Badge variant="secondary" className="ml-2 text-xs">{companyBuildings.length} Buildings</Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-6 pb-6 pt-2 bg-gray-50/30">
                          {companyBuildings.length === 0 ? (
                            <p className="text-sm text-gray-500 italic ml-6">No buildings assigned under this company.</p>
                          ) : (
                            <div className="space-y-4 ml-2 border-l-2 border-gray-200 pl-4">
                              {companyBuildings.map(building => {
                                const buildingCafes = cafeterias.filter(c => c.buildingId === building.id && kam.cafeteriaIds?.includes(c.id));

                                return (
                                  <div key={building.id} className="bg-white border rounded-lg overflow-hidden shadow-sm">
                                    <div className="bg-gray-50 px-4 py-3 border-b flex items-center font-medium text-gray-800">
                                      <Building2 className="h-4 w-4 mr-2 text-purple-500" />
                                      {building.name}
                                    </div>
                                    <div className="p-4 space-y-4">
                                      {buildingCafes.length === 0 ? (
                                        <p className="text-sm text-gray-500 italic">No cafeterias assigned under this building.</p>
                                      ) : (
                                        buildingCafes.map(cafe => {
                                          const cafeTemplates = templates.filter(t => t.cafetariaId === cafe.id || t.buildingId === building.id);

                                          return (
                                            <div key={cafe.id} className="border rounded-md p-3">
                                              <div className="flex items-center font-medium text-gray-800 mb-3">
                                                <Store className="h-4 w-4 mr-2 text-orange-500" />
                                                {cafe.name}
                                                <Badge variant="outline" className="ml-auto text-xs font-normal">
                                                  {cafeTemplates.length} Compliances
                                                </Badge>
                                              </div>
                                              
                                              {cafeTemplates.length > 0 ? (
                                                <Accordion type="multiple" className="w-full mt-2">
                                                  {cafeTemplates.map(template => (
                                                    <AccordionItem value={`template-${template.id}`} key={template.id} className="border rounded-md mb-2 overflow-hidden last:mb-0">
                                                      <AccordionTrigger 
                                                        className="px-3 py-2 text-sm hover:no-underline bg-slate-50 font-medium"
                                                        onClick={() => loadFields(template.id)}
                                                      >
                                                        <div className="flex items-center gap-2">
                                                          <FileText className="h-3.5 w-3.5 text-blue-500" />
                                                          {template.name}
                                                          <Badge variant="outline" className="ml-2 text-[10px] uppercase text-gray-500">
                                                            {template.frequency.replace('_', ' ')}
                                                          </Badge>
                                                        </div>
                                                      </AccordionTrigger>
                                                      <AccordionContent className="p-3 bg-white border-t">
                                                        {loadingFields[template.id] ? (
                                                          <p className="text-xs text-gray-500 animate-pulse">Loading questions...</p>
                                                        ) : (
                                                          <div className="space-y-2">
                                                            {!templateFields[template.id] || templateFields[template.id].length === 0 ? (
                                                              <p className="text-xs text-gray-400 italic">No questions defined in this template.</p>
                                                            ) : (
                                                              templateFields[template.id].map((field, idx) => (
                                                                <div key={field.id} className="flex gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                                                  <span className="text-gray-400 font-mono text-xs w-4 mt-0.5">{idx + 1}.</span>
                                                                  <div className="flex-1">
                                                                    <p className="font-medium text-gray-800">{field.question}</p>
                                                                    <div className="flex gap-2 mt-1">
                                                                      <Badge variant="secondary" className="text-[10px]">{field.type}</Badge>
                                                                      {field.isRequired && <Badge variant="outline" className="text-[10px] border-red-200 text-red-600">Required</Badge>}
                                                                      {field.isPhotoRequired && <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-600">Photo Req</Badge>}
                                                                    </div>
                                                                  </div>
                                                                </div>
                                                              ))
                                                            )}
                                                          </div>
                                                        )}
                                                      </AccordionContent>
                                                    </AccordionItem>
                                                  ))}
                                                </Accordion>
                                              ) : (
                                                <p className="text-xs text-gray-400">No compliance forms attached specifically to this cafeteria.</p>
                                              )}
                                            </div>
                                          )
                                        })
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    )
                  })}
                </Accordion>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  );
}
