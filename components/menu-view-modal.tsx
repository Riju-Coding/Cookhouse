"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { doc, getDoc, getDocs, collection, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Service, MealPlan, SubMealPlan, MenuItem } from "@/lib/types"
import { servicesService, mealPlansService, subMealPlansService, menuItemsService } from "@/lib/services"
import { toast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Loader2, Download, X, History, Edit, Search, ArrowRight, CheckCircle2, AlertCircle, Building2 } from 'lucide-react'


declare module "@/lib/types" {
  export interface MenuUpdation {
    id: string;
    menuId: string;
    totalChanges: number;
    changedCells: Array<{
      date: string; serviceId: string; subServiceId: string; mealPlanId: string; subMealPlanId: string;
      changes: Array<{
        action: 'added' | 'removed' | 'replaced'; itemId: string; replacedWith?: string;
      }>;
    }>;
    createdAt: Date; 
    updationNumber?: number;
    // This will be populated dynamically for combined menus
    affectedCompanies?: Array<{ companyName: string; buildingName: string }>;
  }
}

import type { MenuUpdation } from "@/lib/types"

interface MenuViewModalProps {
  isOpen: boolean; onClose: () => void; menuId: string; menuType: "combined" | "company";
  preloadedMenuItems?: MenuItem[];
}

interface MenuData {
  startDate: string; endDate: string; status: string; menuData?: any;
  companyName?: string; buildingName?: string; companyId?: string; buildingId?: string;
  combinedMenuId?: string; [key: string]: any;
}

type SelectedVersion = MenuUpdation | 'oldest' | 'current';

interface CellRenderData {
  itemIds: string[];
  diffs: Array<{ action: 'added' | 'removed' | 'replaced'; itemId: string; replacedWith?: string; }>;
  isAffectedBySelectedUpdation: boolean;
}

export function MenuViewModal({ isOpen, onClose, menuId, menuType, preloadedMenuItems }: MenuViewModalProps) {
  const router = useRouter();
  const [menu, setMenu] = useState<MenuData | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [subMealPlans, setSubMealPlans] = useState<SubMealPlan[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(preloadedMenuItems || []);
  const [dateRange, setDateRange] = useState<Array<{ date: string; day: string }>>([]);
  const [allCoreDataLoaded, setAllCoreDataLoaded] = useState(false);
  const [structureAssignment, setStructureAssignment] = useState<any | null>(null);
  const [mealPlanStructureAssignment, setMealPlanStructureAssignment] = useState<any | null>(null);
  const [updations, setUpdations] = useState<MenuUpdation[]>([]);
  const [selectedUpdation, setSelectedUpdation] = useState<SelectedVersion>('current');
  const [showAffectedList, setShowAffectedList] = useState<string | null>(null);

  const getMenuItemName = useCallback((itemId: string | undefined): string => {
    if (!itemId) return "";
    const item = menuItems.find(mi => mi.id === itemId);
    return item?.name || itemId; // Strict fallback to ID if not found
  }, [menuItems]);
  
  const formatUpdateDate = (date: Date) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[date.getDay()]}-${date.getDate().toString().padStart(2, '0')}-${months[date.getMonth()]}`;
  };

  useEffect(() => {
    if (isOpen && menuId) {
      setAllCoreDataLoaded(false);
      setMenu(null);
      setLoading(true);
      loadMenu();
    } else {
      setMenu(null);
      setUpdations([]);
      setSelectedUpdation('current');
      setSearchQuery("");
      setAllCoreDataLoaded(false);
      setLoading(false);
    }
  }, [isOpen, menuId]);

  const loadUpdations = async (currentMenu: MenuData, companyStructure: any | null, mealPlanStructure: any | null) => {
    const menuIdsToTrack = [menuId];
    if (currentMenu.combinedMenuId) menuIdsToTrack.push(currentMenu.combinedMenuId);
    
    const q = query(collection(db, "updations"), where("menuId", "in", menuIdsToTrack));
    const snapshot = await getDocs(q);

    let companyContext: any[] = [];
    if (menuType === "combined") {
      const { structureAssignmentsService, mealPlanStructureAssignmentsService } = await import("@/lib/services");
      const [cMenus, sAssigns, mAssigns] = await Promise.all([
        getDocs(query(collection(db, "companyMenus"), where("status", "==", "active"))),
        structureAssignmentsService.getAll(),
        mealPlanStructureAssignmentsService.getAll()
      ]);
      companyContext = cMenus.docs.map(doc => {
        const docData = doc.data();
        return {
          ...docData, id: doc.id,
          sAssign: sAssigns.find((s: any) => s.companyId === docData.companyId && s.buildingId === docData.buildingId && s.status === "active"),
          mAssign: mAssigns.find((m: any) => m.companyId === docData.companyId && m.buildingId === docData.buildingId && m.status === "active"),
        };
      }).filter(c => c.sAssign && c.mAssign);
    }

    const dataPromises = snapshot.docs.map(async (d) => {
      const updateData = d.data();
      const createdAt = updateData.createdAt?.toDate?.() || new Date(updateData.createdAt);
      let affected: { companyName: string; buildingName: string }[] = [];

      if (menuType === "combined") {
        const affectedSet = new Set<string>();
        updateData.changedCells?.forEach((cell: any) => {
          const dayKey = new Date(cell.date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
          companyContext.forEach(comp => {
            const hasService = comp.sAssign.weekStructure?.[dayKey]?.some((s: any) => s.serviceId === cell.serviceId);
            if (hasService) {
              const mpData = comp.mAssign.weekStructure?.[dayKey]?.find((s: any) => s.serviceId === cell.serviceId)
                              ?.subServices?.find((ss: any) => ss.subServiceId === cell.subServiceId)
                              ?.mealPlans?.find((mp: any) => mp.mealPlanId === cell.mealPlanId);
              if (mpData?.subMealPlans?.some((smp: any) => smp.subMealPlanId === cell.subMealPlanId)) {
                affectedSet.add(`${comp.companyName}|${comp.buildingName}`);
              }
            }
          });
        });
        affected = Array.from(affectedSet).map(s => ({ companyName: s.split('|')[0], buildingName: s.split('|')[1] }));
      }
      
      return { id: d.id, ...updateData, createdAt, affectedCompanies: affected };
    });

    const allData = await Promise.all(dataPromises);

    const filteredAndSorted = allData
      .filter((record: any) => {
        if (!record.changedCells || record.changedCells.length === 0) return false;
        if (menuType === "combined") return (record.totalChanges ?? 0) > 0;
        
        return record.changedCells.some((cell: any) => {
          const dayKey = new Date(cell.date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
          const sMatch = companyStructure?.weekStructure?.[dayKey]?.find((s: any) => s.serviceId === cell.serviceId);
          if (!sMatch?.subServices?.some((ss: any) => ss.subServiceId === cell.subServiceId)) return false;
          
          const mMatch = mealPlanStructure?.weekStructure?.[dayKey]?.find((s: any) => s.serviceId === cell.serviceId)
                       ?.subServices?.find((ss: any) => ss.subServiceId === cell.subServiceId)
                       ?.mealPlans?.find((mp: any) => mp.mealPlanId === cell.mealPlanId);
          return mMatch?.subMealPlans?.some((smp: any) => smp.subMealPlanId === cell.subMealPlanId);
        });
      })
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()) as MenuUpdation[];

    setUpdations(filteredAndSorted);
  };

  const handleEdit = () => {
    onClose();
    router.push(`/admin/menus/${menuType}/${menuId}/edit`);
  };

  const loadMenu = async () => {
    try {
      const [ menuSnap, servicesData, mealPlansData, subMealPlansData, itemsData ] = await Promise.all([
        getDoc(doc(db, menuType === "combined" ? "combinedMenus" : "companyMenus", menuId)),
        servicesService.getAll(), mealPlansService.getAll(), subMealPlansService.getAll(), menuItemsService.getAll()
      ]);

      if (!menuSnap.exists()) return onClose();
      const data = menuSnap.data() as MenuData;
      setMenu(data);
      setMenuItems(itemsData); // Set menu items here to guarantee availability

      let activeS = null, activeM = null;
      if (menuType === "company" && data.companyId && data.buildingId) {
        const { structureAssignmentsService, mealPlanStructureAssignmentsService } = await import("@/lib/services");
        const [sArr, mArr] = await Promise.all([structureAssignmentsService.getAll(), mealPlanStructureAssignmentsService.getAll()]);
        activeS = sArr.find((sa: any) => sa.companyId === data.companyId && sa.buildingId === data.buildingId && sa.status === "active");
        activeM = mArr.find((mpsa: any) => mpsa.companyId === data.companyId && mpsa.buildingId === data.buildingId && mpsa.status === "active");
        setStructureAssignment(activeS);
        setMealPlanStructureAssignment(activeM);
      }

      await loadUpdations(data, activeS, activeM);
      
      setServices(servicesData.filter((s: any) => s.status === "active").sort((a,b) => (a.order||999)-(b.order||999)));
      setMealPlans(mealPlansData.filter((mp: any) => mp.status === "active").sort((a,b) => (a.order||999)-(b.order||999)));
      setSubMealPlans(subMealPlansData.filter((smp: any) => smp.status === "active").sort((a,b) => (a.order||999)-(b.order||999)));

      const start = new Date(data.startDate), end = new Date(data.endDate), dates = [];
      const current = new Date(start);
      while (current <= end) {
        dates.push({ date: current.toISOString().split("T")[0], day: new Date(current).toLocaleDateString('en-US', { weekday: 'long' }) });
        current.setDate(current.getDate() + 1);
      }
      setDateRange(dates);
      setAllCoreDataLoaded(true);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };
  
  const handleDownloadXLSX = async () => {
    if (!menu || !allCoreDataLoaded) {
      toast({ title: "Menu data is still loading.", variant: "default" });
      return;
    }
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      services.forEach((service) => {
        const worksheet = workbook.addWorksheet(service.name.substring(0, 31));
        worksheet.addRow([`Menu - ${service.name}`]);
        if (menu.companyName) worksheet.addRow([`Company: ${menu.companyName}`, `Building: ${menu.buildingName}`]);
        worksheet.addRow([`Period: ${menu.startDate} to ${menu.endDate}`]);
        worksheet.addRow([]);
        const headers = ["Meal Plan", "Sub Meal Plan", ...dateRange.map((d) => d.date)];
        worksheet.addRow(headers);
        const validMealPlans = getFilteredStructureForService(service.id);
        validMealPlans.forEach(({ mealPlan, subMealPlans: relatedSubMealPlans }) => {
          relatedSubMealPlans.forEach((subMealPlan, idx) => {
            const row: any[] = [];
            row.push(idx === 0 ? mealPlan.name : "");
            row.push(subMealPlan.name);
            dateRange.forEach(({ date }) => {
              // We always download the "current" state of the menu
              const { itemIds } = getEffectiveCellData(date, service.id, mealPlan.id, subMealPlan.id, 'current');
              const itemNames = itemIds.map((id) => getMenuItemName(id)).join(", ");
              row.push(itemNames || "");
            });
            worksheet.addRow(row);
          });
        });
        worksheet.columns.forEach((col) => { col.width = 25 });
      });
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `menu-${menuType}-${new Date().toISOString().split("T")[0]}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading XLSX:", error);
      toast({ title: "Error Downloading", description: "Failed to generate Excel file.", variant: "destructive" });
    }
  };
  
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  
  const mealPlanStructure = useMemo(() => {
    return mealPlans.map(mp => ({ mealPlan: mp, subMealPlans: subMealPlans.filter(smp => smp.mealPlanId === mp.id) }));
  }, [mealPlans, subMealPlans]);

  const getFilteredStructureForService = (sId: string) => {
    return mealPlans.map(mp => {
      if (menuType === "combined") return { mealPlan: mp, subMealPlans: subMealPlans.filter(smp => smp.mealPlanId === mp.id) };
      const allowed = new Set<string>();
      Object.values(mealPlanStructureAssignment?.weekStructure || {}).forEach((day: any) => {
        day.find((s: any) => s.serviceId === sId)?.subServices?.forEach((ss: any) => {
          ss.mealPlans?.find((m: any) => m.mealPlanId === mp.id)?.subMealPlans?.forEach((smp: any) => allowed.add(smp.subMealPlanId));
        });
      });
      return { mealPlan: mp, subMealPlans: subMealPlans.filter(smp => smp.mealPlanId === mp.id && allowed.has(smp.id)) };
    }).filter(g => g.subMealPlans.length > 0);
  };
  
  const applyOrReverseChanges = useCallback((initial: string[], changes: any[], reverse: boolean) => {
    let items = new Set(initial);
    changes.forEach(c => {
      if (reverse) {
        if (c.action === "added") items.delete(c.itemId);
        else if (c.action === "removed") items.add(c.itemId);
        else if (c.action === "replaced") { items.delete(c.replacedWith!); items.add(c.itemId); }
      } else {
        if (c.action === "added") items.add(c.itemId);
        else if (c.action === "removed") items.delete(c.itemId);
        else if (c.action === "replaced") { items.delete(c.itemId); items.add(c.replacedWith!); }
      }
    });
    return Array.from(items);
  }, []);

  const getEffectiveCellData = useCallback((date: string, sId: string, mpId: string, smpId: string, version: SelectedVersion): CellRenderData => {
    if (!menu?.menuData || !allCoreDataLoaded) return { itemIds: [], diffs: [], isAffectedBySelectedUpdation: false };

    const dayKey = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    let currentIds = new Set<string>();
    if (menuType === "combined") {
      const svc = menu.menuData[date]?.[sId] || {};
      Object.keys(svc).forEach(ssId => svc[ssId]?.[mpId]?.[smpId]?.menuItemIds?.forEach((id: string) => currentIds.add(id)));
    } else {
      structureAssignment?.weekStructure?.[dayKey]?.find((s: any) => s.serviceId === sId)?.subServices?.forEach((ss: any) => {
        menu.menuData[date]?.[sId]?.[ss.subServiceId]?.[mpId]?.[smpId]?.menuItemIds?.forEach((id: string) => currentIds.add(id));
      });
    }

    if (version === 'current') return { itemIds: Array.from(currentIds), diffs: [], isAffectedBySelectedUpdation: false };

    let effective = new Set(currentIds);
    let diffs: any[] = [], isAffected = false;
    const sorted = [...updations].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    for (const upd of sorted) {
      const targetTime = typeof version === 'object' ? version.createdAt.getTime() : -1;
      const shouldReverse = upd.createdAt.getTime() > targetTime || version === 'oldest';

      const cellChanges = upd.changedCells.filter(c => c.date === date && c.serviceId === sId && c.mealPlanId === mpId && c.subMealPlanId === smpId);
      if (cellChanges.length > 0) {
        const combined = cellChanges.flatMap(c => c.changes || []);
        if (shouldReverse) effective = new Set(applyOrReverseChanges(Array.from(effective), combined, true));
      }

      if (typeof version === 'object' && version.id === upd.id) {
        const cellChangesForTarget = upd.changedCells.filter(c => c.date === date && c.serviceId === sId && c.mealPlanId === mpId && c.subMealPlanId === smpId);
        if (cellChangesForTarget.length > 0) {
          const combinedTarget = cellChangesForTarget.flatMap(c => c.changes || []);
          effective = new Set(applyOrReverseChanges(Array.from(effective), combinedTarget, false)); // Apply this one forward
          diffs = combinedTarget;
          isAffected = true;
        }
        break;
      }
    }
    return { itemIds: Array.from(effective), diffs, isAffectedBySelectedUpdation: isAffected };
  }, [menu, updations, menuType, structureAssignment, applyOrReverseChanges, allCoreDataLoaded]);

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full h-full flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b bg-white flex-shrink-0 z-10 shadow-sm">
              <div className="flex-1">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  {menuType === "combined" ? "Combined Menu Master" : "Company Menu View"}
                  {selectedUpdation !== 'current' && selectedUpdation !== 'oldest' && <span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded border border-amber-200">Tracking Updates</span>}
                </h2>
                <p className="text-sm text-gray-500">Period: {formatDate(menu?.startDate || "")} - {formatDate(menu?.endDate || "")}</p>
              </div>
              <div className="flex gap-2 items-center">
                <div className="relative w-64 mr-2"><Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" /><Input placeholder="Search meals or items..." className="pl-8 h-9 text-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
                <Button onClick={handleDownloadXLSX} variant="outline" size="sm"><Download className="h-4 w-4 mr-2" /> Download</Button>
                <Button size="sm" onClick={handleEdit} className="bg-indigo-600 hover:bg-indigo-700 text-white"><Edit className="h-4 w-4 mr-2" /> Edit</Button>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors ml-2"><X className="h-5 w-5 text-gray-500" /></button>
              </div>
            </div>

            {updations.length > 0 && (
              <div className="bg-slate-900 p-3 flex-shrink-0 overflow-x-auto shadow-inner">
                <div className="flex items-center gap-3">
                  <div className="flex items-center text-white text-xs font-bold mr-2 uppercase tracking-widest opacity-70"><History className="h-3 w-3 mr-1" /> Timeline</div>
                  <div className="flex gap-2">
                    <button onClick={() => setSelectedUpdation('oldest')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${selectedUpdation === 'oldest' ? "bg-blue-600 text-white shadow-lg" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>Oldest Version</button>
                    {updations.map((upd) => (
                      <div key={upd.id} className="relative">
                        <button onClick={() => setSelectedUpdation(upd)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${typeof selectedUpdation === 'object' && selectedUpdation.id === upd.id ? "bg-amber-500 text-white shadow-lg" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>
                          <span>Update #{upd.updationNumber}</span>
                          <span className="opacity-50 text-[10px]">{formatUpdateDate(upd.createdAt)}</span>
                          <span className="bg-black/20 px-1 rounded">{upd.totalChanges}</span>
                        </button>
                        {menuType === "combined" && upd.affectedCompanies && upd.affectedCompanies.length > 0 && (
                          <div className="absolute -top-2 -right-2 z-20">
                            <button onClick={(e) => { e.stopPropagation(); setShowAffectedList(showAffectedList === upd.id ? null : upd.id); }} className="bg-rose-500 hover:bg-rose-600 text-white text-[9px] font-bold h-5 w-5 rounded-full border border-white shadow-sm flex items-center justify-center transition-transform hover:scale-110">
                              {upd.affectedCompanies.length}
                            </button>
                            {showAffectedList === upd.id && (
                              <div className="absolute top-6 right-0 w-64 bg-white rounded-lg shadow-2xl border border-gray-200 p-3 z-50">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 pb-2 border-b">Affected Buildings</p>
                                <div className="max-h-48 overflow-y-auto space-y-1">
                                  {upd.affectedCompanies.map((c, i) => (
                                    <div key={i} className="text-xs font-bold text-slate-700 flex flex-col bg-slate-50 p-2 rounded border border-slate-100">
                                      <span>{c.buildingName}</span><span className="text-[10px] text-slate-400 font-medium">{c.companyName}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    <button onClick={() => setSelectedUpdation('current')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${selectedUpdation === 'current' ? "bg-green-600 text-white shadow-lg" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>Current Version</button>
                  </div>
                </div>
              </div>
            )}

            {loading || !allCoreDataLoaded ? (
              <div className="flex-1 flex flex-col items-center justify-center bg-gray-50"><Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-4" /><p className="text-gray-500 font-medium">Loading menu structure and items...</p></div>
            ) : menu ? (
              <div className="flex-1 overflow-auto bg-gray-50 pb-10">
                <div className="max-w-[98%] mx-auto py-6">
                  {menu.companyName && (<div className="mb-6 p-4 bg-white rounded-lg border shadow-sm flex items-center justify-between"><div className="flex items-center gap-6"><div><p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Company</p><p className="font-bold text-gray-800 flex items-center gap-2">{menu.companyName}</p></div><div className="h-8 w-px bg-gray-200" /><div><p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Building</p><p className="font-semibold text-gray-700">{menu.buildingName}</p></div></div></div>)}
                  {services.map((service) => {
                    const filteredStructure = getFilteredStructureForService(service.id);
                    if (filteredStructure.length === 0) return null;
                    return (
                    <div key={service.id} className="mb-10">
                      <div className="flex items-center gap-3 mb-4"><h2 className="text-lg font-black bg-slate-800 text-white px-4 py-2 rounded-lg shadow-sm tracking-tight uppercase">{service.name}</h2><div className="h-px bg-gray-300 flex-1" /></div>
                      <div className="overflow-x-auto rounded-xl border border-gray-400 bg-white shadow-md">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-slate-50">
                              <th className="border-b border-r border-l border-gray-400 p-4 sticky left-0 z-20 bg-slate-50 min-w-[180px] text-left text-xs font-black uppercase text-slate-500">Meal Plan</th>
                              <th className="border-b border-r border-gray-400 p-4 sticky left-0 z-20 bg-slate-50 min-w-[180px] text-left text-xs font-black uppercase text-slate-500" style={{left: '180px'}}>Sub-Category</th>
                              {dateRange.map(({ date, day }) => (<th key={date} className="border-b border-r border-gray-400 p-4 min-w-[220px] text-left"><div className="font-bold text-slate-800">{new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div><div className="text-[10px] font-bold text-indigo-600 uppercase tracking-tighter">{day}</div></th>))}
                            </tr>
                          </thead>
                          <tbody>
                            {getFilteredStructureForService(service.id).map(({ mealPlan, subMealPlans }) => (
                              subMealPlans.map((subMealPlan, idx) => (
                                <tr key={`${mealPlan.id}-${subMealPlan.id}`} className="transition-colors duration-300">
                                  <td className="border-b border-r border-l border-gray-400 p-4 sticky left-0 z-10 bg-white group-hover:bg-slate-50">{idx === 0 && <div className="font-black text-indigo-700 text-sm">{mealPlan.name}</div>}</td>
                                  <td className="border-b border-r border-gray-400 p-4 sticky left-0 z-10 bg-white group-hover:bg-slate-50 text-sm font-medium text-slate-600" style={{left: '180px'}}>{subMealPlan.name}</td>
                                  {dateRange.map(({ date }) => {
                                    const { itemIds, diffs, isAffectedBySelectedUpdation } = getEffectiveCellData(date, service.id, mealPlan.id, subMealPlan.id, selectedUpdation);
                                    return (
                                      <td key={date} className={`border-b border-r border-gray-400 p-3 align-top transition-colors ${isAffectedBySelectedUpdation ? "bg-amber-50/30" : ""}`}>
                                        <div className="flex flex-col gap-2">
                                          {diffs.length > 0 && typeof selectedUpdation === 'object' ? (
                                            diffs.map((ch, i) => (
                                              <div key={i} className="flex flex-col gap-1">
                                                {ch.action === "added" && <div className="p-2.5 rounded-lg bg-green-50 border border-green-200 shadow-sm"><div className="flex items-center justify-between text-[10px] font-black text-green-600 uppercase mb-1"><span>New Item Added</span><CheckCircle2 className="h-3 w-3"/></div><div className="text-sm font-bold text-green-900">{getMenuItemName(ch.itemId)}</div></div>}
                                                {ch.action === "removed" && <div className="p-2.5 rounded-lg bg-red-50 border border-red-100 opacity-60"><div className="text-[10px] font-black text-red-400 uppercase mb-1">Removed</div><div className="text-sm font-medium text-red-800 line-through">{getMenuItemName(ch.itemId)}</div></div>}
                                                {ch.action === "replaced" && <div className="p-2.5 rounded-lg bg-white border-2 border-amber-200 shadow-md"><div className="flex items-center justify-between text-[10px] font-black text-amber-600 uppercase mb-1"><span>Item Replaced</span><AlertCircle className="h-3 w-3"/></div><div className="text-xs text-red-500 line-through opacity-50 mb-1">{getMenuItemName(ch.itemId)}</div><div className="flex items-center gap-2"><ArrowRight className="h-3 w-3 text-amber-500" /><div className="text-sm font-black text-slate-800">{getMenuItemName(ch.replacedWith)}</div></div></div>}
                                              </div>
                                            ))
                                          ) : (
                                            itemIds.length > 0 ? (
                                              itemIds.map(id => (<div key={id} className="p-2 rounded bg-indigo-50/50 border border-indigo-100 text-sm font-semibold text-slate-700">{getMenuItemName(id)}</div>))
                                            ) : <div className="text-xs text-slate-300 italic py-2">No items set</div>
                                          )}
                                        </div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    )})}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}