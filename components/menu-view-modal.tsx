

"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { doc, getDoc, getDocs, collection, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Service, MealPlan, SubMealPlan, MenuItem } from "@/lib/types" // Importing core types
import { servicesService, mealPlansService, subMealPlansService, menuItemsService, structureAssignmentsService as companyStructureService } from "@/lib/services"
import { toast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Loader2, Download, X, History, Edit, Search, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react'

// ===============================================
// Type Augmentation for MenuUpdation (important for `updationNumber`)
// Ensure this matches your actual MenuUpdation structure if it's external
// ===============================================
declare module "@/lib/types" {
  export interface MenuUpdation {
    id: string;
    menuId: string;
    totalChanges: number;
    changedCells: Array<{
      date: string;
      serviceId: string;
      subServiceId: string; 
      mealPlanId: string;
      subMealPlanId: string;
      changes: Array<{
        action: 'added' | 'removed' | 'replaced';
        itemId: string;
        itemName?: string; // Name from the time of the update (if stored)
        replacedWith?: string; // New itemId in case of 'replaced'
        replacedWithName?: string; // New itemName in case of 'replaced' (if stored)
      }>;
    }>;
    createdAt: Date; 
    updationNumber?: number; // Property for sequential update number
    // ... other fields if any
  }
}

// Re-import MenuUpdation to ensure the augmented type is used
import type { MenuUpdation } from "@/lib/types"


interface MenuViewModalProps {
  isOpen: boolean
  onClose: () => void
  menuId: string
  menuType: "combined" | "company"
  preloadedMenuItems?: MenuItem[]
}

interface MenuData {
  startDate: string
  endDate: string
  status: string
  menuData?: any // Structure depends on menuType
  companyName?: string
  buildingName?: string
  companyId?: string
  buildingId?: string
  combinedMenuId?: string
  [key: string]: any
}

// Type for the selected version in the timeline
type SelectedVersion = MenuUpdation | 'oldest' | 'current';

// Interface for cell rendering data
interface CellRenderData {
  itemIds: string[]; // Effective item IDs for the selected version
  diffs: Array<{ // More specific type for diffs
    action: 'added' | 'removed' | 'replaced';
    itemId: string; // The ID of the item
    itemName?: string; // Optional name from the updation record itself
    replacedWith?: string; // For replaced actions, the new item ID
    replacedWithName?: string; // For replaced actions, the new item name (if stored)
  }>;
  isAffectedBySelectedUpdation: boolean; // True if this cell was part of the changes in the selected historical updation
}

export function MenuViewModal({ isOpen, onClose, menuId, menuType, preloadedMenuItems }: MenuViewModalProps) {
  const router = useRouter()
  const [menu, setMenu] = useState<MenuData | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const [services, setServices] = useState<Service[]>([])
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([])
  const [subMealPlans, setSubMealPlans] = useState<SubMealPlan[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>(preloadedMenuItems || [])
  const [dateRange, setDateRange] = useState<Array<{ date: string; day: string }>>([])
  // Renamed for clarity: tracks if ALL foundational data (services, plans, menuItems) are loaded
  const [allCoreDataLoaded, setAllCoreDataLoaded] = useState(false); 


  // ===============================================
  // Helper to get item name consistently
  // Ensures name is always looked up from `menuItems`
  // ===============================================
  const getMenuItemName = useCallback((itemId: string | undefined): string => {
    if (!itemId) return "N/A (No ID)"; 
    // This helper depends on `menuItems` being loaded. 
    // The component's loading state (`allCoreDataLoaded`) ensures `menuItems` is available.
    const item = menuItems.find(mi => mi.id === itemId);
    return item?.name || itemId; // Always fallback to ID if name not found in master list
  }, [menuItems]);


  const [structureAssignment, setStructureAssignment] = useState<any | null>(null)
  const [mealPlanStructureAssignment, setMealPlanStructureAssignment] = useState<any | null>(null)

  const [updations, setUpdations] = useState<MenuUpdation[]>([])
  const [selectedUpdation, setSelectedUpdation] = useState<SelectedVersion>('current'); // Default to 'current' version initially

  useEffect(() => {
    if (isOpen && menuId) {
      // Reset loading state for core data on modal open/menuId change
      setAllCoreDataLoaded(false); 
      setMenu(null); // Clear menu data to show loader properly
      setLoading(true); // Start loading indicator
      loadMenu();
    } else {
      setMenu(null)
      setUpdations([])
      setSelectedUpdation('current') // Reset to current when modal closes or menuId changes
      setSearchQuery("")
      setAllCoreDataLoaded(false); // Reset this too
      setLoading(false); // Ensure loader is off
    }
  }, [isOpen, menuId])

  const loadUpdations = async (currentMenu: MenuData, companyStructure: any | null, mealPlanStructure: any | null) => {
    try {
      setUpdations([])
      
      const menuIdsToTrack = [menuId]
      if (currentMenu.combinedMenuId) {
        menuIdsToTrack.push(currentMenu.combinedMenuId)
      }

      const q = query(collection(db, "updations"), where("menuId", "in", menuIdsToTrack))
      const snapshot = await getDocs(q)

      const data = snapshot.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as any),
          createdAt: (d.data() as any).createdAt?.toDate?.() || new Date((d.data() as any).createdAt),
        }))
        .filter((record: any) => {
          if (!record.changedCells || record.changedCells.length === 0) return false;
          
          if (menuType === "combined") {
            return (record.totalChanges ?? 0) > 0;
          }

          if (menuType === "company" && companyStructure && mealPlanStructure) {
            // An update is relevant only if at least ONE of its changes fully matches the company's assigned structure.
            return record.changedCells.some((cell: any) => {
              const dayKey = new Date(cell.date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
              
              const serviceDayStructure = companyStructure.weekStructure?.[dayKey];
              const mealPlanDayStructure = mealPlanStructure.weekStructure?.[dayKey];
              if (!serviceDayStructure || !mealPlanDayStructure) return false;

              // Check 1 & 2: Service and Sub-Service ID validation
              const serviceInStructure = serviceDayStructure.find((s: any) => s.serviceId === cell.serviceId);
              if (!serviceInStructure?.subServices?.some((ss: any) => ss.subServiceId === cell.subServiceId)) {
                return false;
              }
              
              // Check 3 & 4: Meal Plan and Sub-Meal Plan ID validation
              const mealPlanServiceData = mealPlanDayStructure.find((s: any) => s.serviceId === cell.serviceId);
              const mealPlanSubServiceData = mealPlanServiceData?.subServices?.find((ss: any) => ss.subServiceId === cell.subServiceId);
              const mealPlanData = mealPlanSubServiceData?.mealPlans?.find((mp: any) => mp.mealPlanId === cell.mealPlanId);
              if (!mealPlanData?.subMealPlans?.some((smp: any) => smp.subMealPlanId === cell.subMealPlanId)) {
                return false;
              }
              
              return true;
            });
          }

          return false;
        })
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) as MenuUpdation[] // Sort oldest first
      
      setUpdations(data)
    } catch (error) {
      console.error("Error loading updations:", error)
    }
  }

  const handleEdit = () => {
    onClose();
    if (menuType === "combined") {
      router.push(`/admin/menus/combined/${menuId}/edit`);
    } else {
      router.push(`/admin/menus/company/${menuId}/edit`);
    }
  }

  const loadMenu = async () => {
    try {
      const [
        menuSnap,
        servicesData,
        mealPlansData,
        subMealPlansData,
        itemsData // Menu items fetched here
      ] = await Promise.all([
        getDoc(doc(db, menuType === "combined" ? "combinedMenus" : "companyMenus", menuId)),
        servicesService.getAll(),
        mealPlansService.getAll(),
        subMealPlansService.getAll(),
        menuItemsService.getAll() // Always load menu items fresh here
      ]);

      if (!menuSnap.exists()) {
        toast({ title: "Error", description: "Menu not found.", variant: "destructive" });
        onClose();
        return;
      }
      const data = menuSnap.data() as MenuData;
      setMenu(data);
      setMenuItems(itemsData); // Set menu items here, making them available to `getMenuItemName`

      let activeStructureAssignment = null;
      let activeMealPlanStructure = null;

      if (menuType === "company" && data.companyId && data.buildingId) {
        const { structureAssignmentsService, mealPlanStructureAssignmentsService } = await import("@/lib/services");
        const [structureAssignments, mealPlanStructureAssignments] = await Promise.all([
          structureAssignmentsService.getAll(),
          mealPlanStructureAssignmentsService.getAll()
        ]);
        activeStructureAssignment = structureAssignments.find((sa: any) => sa.companyId === data.companyId && sa.buildingId === data.buildingId && sa.status === "active");
        activeMealPlanStructure = mealPlanStructureAssignments.find((mpsa: any) => mpsa.companyId === data.companyId && mpsa.buildingId === data.buildingId && mpsa.status === "active");
        setStructureAssignment(activeStructureAssignment);
        setMealPlanStructureAssignment(activeMealPlanStructure);
      }

      await loadUpdations(data, activeStructureAssignment, activeMealPlanStructure);
      
      let filteredServices = servicesData.filter((s: any) => s.status === "active").sort((a: any, b: any) => (a.order || 999) - (b.order || 999));
      let filteredMealPlans = mealPlansData.filter((mp: any) => mp.status === "active").sort((a: any, b: any) => (a.order || 999) - (b.order || 999));
      let filteredSubMealPlans = subMealPlansData.filter((smp: any) => smp.status === "active").sort((a: any, b: any) => (a.order || 999) - (b.order || 999));
      
      if (menuType === "company" && data.companyId && data.buildingId) {
        if (activeStructureAssignment) {
          const serviceIds = new Set<string>()
          Object.values(activeStructureAssignment.weekStructure || {}).forEach((dayServices: any) => dayServices.forEach((service: any) => serviceIds.add(service.serviceId)))
          filteredServices = filteredServices.filter((s) => serviceIds.has(s.id))
        }
        if (activeMealPlanStructure) {
          const mealPlanIds = new Set<string>()
          const subMealPlanIds = new Set<string>()
          Object.values(activeMealPlanStructure.weekStructure || {}).forEach((dayServices: any) => {
            dayServices.forEach((service: any) => {
              service.subServices?.forEach((subService: any) => {
                subService.mealPlans?.forEach((mealPlan: any) => {
                  mealPlanIds.add(mealPlan.mealPlanId)
                  mealPlan.subMealPlans?.forEach((subMealPlan: any) => subMealPlanIds.add(subMealPlan.subMealPlanId))
                })
              })
            })
          })
          filteredMealPlans = filteredMealPlans.filter((mp) => mealPlanIds.has(mp.id))
          filteredSubMealPlans = filteredSubMealPlans.filter((smp) => subMealPlanIds.has(smp.id))
        }
      }
      setServices(filteredServices);
      setMealPlans(filteredMealPlans);
      setSubMealPlans(filteredSubMealPlans);

      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      const dates: Array<{ date: string; day: string }> = [];
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const current = new Date(start);
      while (current <= end) {
        dates.push({ date: current.toISOString().split("T")[0], day: days[current.getDay()] });
        current.setDate(current.getDate() + 1);
      }
      setDateRange(dates);
      
      setAllCoreDataLoaded(true); // Mark all core data as loaded
    } catch (error) {
      console.error("Error loading menu:", error);
      toast({ title: "Error", description: "Failed to load menu data.", variant: "destructive" });
    } finally {
      setLoading(false); // End loading indicator
    }
  }

  // Removed loadMenuItemsLazy as menu items are now loaded with other core data
  
  const handleDownloadXLSX = async () => {
    if (!menu || !allCoreDataLoaded) { // Check allCoreDataLoaded
      toast({ title: "Info", description: "Menu data not fully loaded yet.", variant: "default" });
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
            dateRange.forEach(({ date, day }) => {
              const { itemIds } = getEffectiveMenuItemIdsForCell(date, service.id, mealPlan.id, subMealPlan.id, 'current');
              const itemNames = itemIds.map((id) => getMenuItemName(id)).join(", "); // Use getMenuItemName helper
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
      toast({
        title: "Error downloading menu",
        description: "Failed to generate XLSX file.",
        variant: "destructive",
      });
    }
  }

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })

  const mealPlanStructure = useMemo(() => {
    return mealPlans.map((mealPlan) => ({
      mealPlan,
      subMealPlans: subMealPlans.filter((smp) => smp.mealPlanId === mealPlan.id),
    }))
  }, [mealPlans, subMealPlans])

  const getFilteredStructureForService = (serviceId: string) => {
    return mealPlanStructure.map(({ mealPlan, subMealPlans }) => {
        if (menuType === "combined") return { mealPlan, subMealPlans };
        if (!mealPlanStructureAssignment?.weekStructure) return { mealPlan, subMealPlans: [] };
        const allowedSubMealPlanIds = new Set<string>();
        Object.values(mealPlanStructureAssignment.weekStructure).forEach((dayServices: any) => {
            const serviceData = dayServices.find((s: any) => s.serviceId === serviceId);
            serviceData?.subServices?.forEach((ss: any) => {
                const mpData = ss.mealPlans?.find((mp: any) => mp.mealPlanId === mealPlan.id);
                mpData?.subMealPlans?.forEach((smp: any) => allowedSubMealPlanIds.add(smp.subMealPlanId));
            });
        });
        return { mealPlan, subMealPlans: subMealPlans.filter(smp => allowedSubMealPlanIds.has(smp.id)) };
    }).filter(group => group.subMealPlans.length > 0);
  };


  // Helper to apply or reverse changes to a list of item IDs
  const applyOrReverseCellChanges = useCallback((initialItems: string[], changes: CellRenderData['diffs'], reverse: boolean) => {
    let updatedItems = new Set(initialItems);
    changes.forEach(change => {
      const action = reverse ? 
                     (change.action === 'added' ? 'removed' : change.action === 'removed' ? 'added' : 'replaced_reverse') :
                     change.action;

      if (action === "added") { // Applied (forward)
        updatedItems.add(change.itemId);
      } else if (action === "removed") { // Applied (forward)
        updatedItems.delete(change.itemId);
      } else if (action === "replaced") { // Applied (forward)
        updatedItems.delete(change.itemId); // Remove old item
        updatedItems.add(change.replacedWith!); // Add new item
      } else if (action === "added_reverse") { // Reversed (removed)
        updatedItems.add(change.itemId); // If it was removed, add it back
      } else if (action === "removed_reverse") { // Reversed (added)
        updatedItems.delete(change.itemId); // If it was added, remove it
      } else if (action === "replaced_reverse") { // Reversed (replaced X by Y)
        updatedItems.delete(change.replacedWith!); // Remove Y
        updatedItems.add(change.itemId); // Add X back
      }
    });
    return Array.from(updatedItems);
  }, []);

  // Main function to get the state of a cell for a given timeline version (UPDATED LOGIC)
  const getEffectiveMenuItemIdsForCell = useCallback((
    targetDate: string,
    targetServiceId: string,
    targetMealPlanId: string,
    targetSubMealPlanId: string,
    versionType: SelectedVersion
  ): CellRenderData => {
    // Crucial check: only proceed if all core data is loaded
    if (!menu || !menu.menuData || !allCoreDataLoaded) { 
      return { itemIds: [], diffs: [], isAffectedBySelectedUpdation: false };
    }

    const dayKey = new Date(targetDate).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    // 1. Get the CURRENT state of the cell from menu.menuData
    // This represents the FINAL state after all updates
    let currentLiveMenuItemIds: string[] = [];
    if (menuType === "combined") {
      const svcBlock = menu.menuData[targetDate]?.[targetServiceId] || {};
      Object.keys(svcBlock).forEach((subServiceId) => {
        const cellData = svcBlock[subServiceId]?.[targetMealPlanId]?.[targetSubMealPlanId];
        if (cellData?.menuItemIds) currentLiveMenuItemIds.push(...cellData.menuItemIds);
      });
    } else { // company menu
      const subServicesForDay = structureAssignment?.weekStructure?.[dayKey]?.find((s: any) => s.serviceId === targetServiceId)?.subServices || [];
      subServicesForDay.forEach((ss: any) => {
        const cell = menu.menuData[targetDate]?.[targetServiceId]?.[ss.subServiceId]?.[targetMealPlanId]?.[targetSubMealPlanId];
        if (cell?.menuItemIds) currentLiveMenuItemIds.push(...cell.menuItemIds);
      });
    }
    currentLiveMenuItemIds = Array.from(new Set(currentLiveMenuItemIds)); // Ensure uniqueness

    if (versionType === 'current') {
      return { itemIds: currentLiveMenuItemIds, diffs: [], isAffectedBySelectedUpdation: false };
    }

    let effectiveMenuItemIdsAtVersion = [...currentLiveMenuItemIds];
    let diffsForSelectedUpdation: CellRenderData['diffs'] = [];
    let isAffectedBySelectedUpdation = false; 

    // 2. Reverse apply updates to get to the desired historical state
    // Iterate through updates from NEWEST to OLDEST (reverse chronological)
    const sortedUpdations = [...updations].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    for (const updation of sortedUpdations) {
      // Determine if this update is LATER than our target version.
      // If so, we need to reverse its effects.
      let shouldReverseThisUpdate = false;
      if (versionType === 'oldest') {
        shouldReverseThisUpdate = true; // Reverse all updates to get to the oldest
      } else if (typeof versionType === 'object') {
        // If the current update happened AFTER the selected historical update, reverse it
        shouldReverseThisUpdate = updation.createdAt.getTime() > versionType.createdAt.getTime();
      }

      if (shouldReverseThisUpdate) {
        const relevantCellChangesFromUpdation = updation.changedCells.filter(cell => {
          if (cell.date !== targetDate || cell.serviceId !== targetServiceId || cell.mealPlanId !== targetMealPlanId || cell.subMealPlanId !== targetSubMealPlanId) {
            return false;
          }
          if (menuType === "company" && structureAssignment) {
            const assignedSubServices = structureAssignment.weekStructure?.[dayKey]?.find((s: any) => s.serviceId === targetServiceId)?.subServices?.map((ss: any) => ss.subServiceId) || [];
            return assignedSubServices.includes(cell.subServiceId);
          }
          return true;
        });

        if (relevantCellChangesFromUpdation.length > 0) {
          const combinedChanges = relevantCellChangesFromUpdation.flatMap(c => c.changes || []);
          effectiveMenuItemIdsAtVersion = applyOrReverseCellChanges(effectiveMenuItemIdsAtVersion, combinedChanges, true); // Apply in reverse
        }
      }

      // If this specific updation is our TARGET (and not just one we are reversing past)
      if (typeof versionType === 'object' && versionType.id === updation.id) {
        // We've reached our target historical point. 
        // The `effectiveMenuItemIdsAtVersion` now holds the state *before* this specific update.
        // We need to apply this update's changes FORWARD to get the state *at the end of* this update.
        // And record its diffs.
        const relevantCellChangesFromUpdation = updation.changedCells.filter(cell => {
          if (cell.date !== targetDate || cell.serviceId !== targetServiceId || cell.mealPlanId !== targetMealPlanId || cell.subMealPlanId !== targetSubMealPlanId) {
            return false;
          }
          if (menuType === "company" && structureAssignment) {
            const assignedSubServices = structureAssignment.weekStructure?.[dayKey]?.find((s: any) => s.serviceId === targetServiceId)?.subServices?.map((ss: any) => ss.subServiceId) || [];
            return assignedSubServices.includes(cell.subServiceId);
          }
          return true;
        });

        if (relevantCellChangesFromUpdation.length > 0) {
            const combinedChanges = relevantCellChangesFromUpdation.flatMap(c => c.changes || []);
            // This is the key: we want to show the state *after* this selected update.
            effectiveMenuItemIdsAtVersion = applyOrReverseCellChanges(effectiveMenuItemIdsAtVersion, combinedChanges, false); // Apply FORWARD
            diffsForSelectedUpdation = combinedChanges; // These are the changes *from this specific updation*
            isAffectedBySelectedUpdation = true;
        }
        break; // Stop processing once the target updation is handled
      }
    }

    return { itemIds: Array.from(effectiveMenuItemIdsAtVersion), diffs: diffsForSelectedUpdation, isAffectedBySelectedUpdation };
  }, [menu, updations, menuType, structureAssignment, applyOrReverseCellChanges, allCoreDataLoaded]); 


  const shouldShowRow = (serviceId: string, mealPlanId: string, subMealPlan: SubMealPlan) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    if (subMealPlan.name.toLowerCase().includes(query)) return true;
    // Only proceed with item search if core data is loaded
    if (!allCoreDataLoaded) return false; 
    for (const { date } of dateRange) {
      const { itemIds } = getEffectiveMenuItemIdsForCell(date, serviceId, mealPlan.id, subMealPlan.id, 'current'); // Always search current version
      const hasItemMatch = itemIds.some(id => getMenuItemName(id).toLowerCase().includes(query)); // Use getMenuItemName here
      if (hasItemMatch) return true;
    }
    return false;
  };
  
  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full h-full flex flex-col overflow-hidden">
            
            <div className="flex items-center justify-between p-4 border-b bg-white flex-shrink-0 z-10 shadow-sm">
              <div className="flex-1">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  {menuType === "combined" ? "Combined Menu Master" : "Company Menu View"}
                  {/* Show "Tracking Updates" only when a specific historical update is selected */}
                  {selectedUpdation !== 'current' && selectedUpdation !== 'oldest' && <span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded border border-amber-200">Tracking Updates</span>}
                </h2>
                <p className="text-sm text-gray-500">
                  Period: {formatDate(menu?.startDate || "")} - {formatDate(menu?.endDate || "")}
                </p>
              </div>
              
              <div className="flex gap-2 items-center">
                <div className="relative w-64 mr-2">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <Input 
                    placeholder="Search meals or items..." 
                    className="pl-8 h-9 text-sm" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
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
                    <button
                        onClick={() => setSelectedUpdation('oldest')}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${selectedUpdation === 'oldest' ? "bg-blue-600 text-white shadow-lg" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
                    >Oldest Version</button>
                    {updations.map((updation) => (
                        <button
                        key={updation.id}
                        onClick={() => setSelectedUpdation(updation)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${typeof selectedUpdation === 'object' && selectedUpdation.id === updation.id ? "bg-amber-500 text-white shadow-lg" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
                        >
                        <span>Update #{(updation as MenuUpdation).updationNumber}</span> {/* Using typed updationNumber */}
                        <span className="opacity-50 text-[10px]">{(updation as MenuUpdation).createdAt.toLocaleDateString()}</span>
                        <span className="bg-black/20 px-1 rounded">{(updation as MenuUpdation).totalChanges}</span>
                        </button>
                    ))}
                    <button
                        onClick={() => setSelectedUpdation('current')}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${selectedUpdation === 'current' ? "bg-green-600 text-white shadow-lg" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
                    >Current Version</button>
                  </div>
                </div>
              </div>
            )}

            {loading || !allCoreDataLoaded ? ( // Wait for allCoreDataLoaded to be true
              <div className="flex-1 flex flex-col items-center justify-center bg-gray-50">
                <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-4" />
                <p className="text-gray-500 font-medium">Loading menu structure and items...</p>
              </div>
            ) : menu ? (
              <div className="flex-1 overflow-auto bg-gray-50 pb-10">
                <div className="max-w-[98%] mx-auto py-6">
                  {menu.companyName && (
                    <div className="mb-6 p-4 bg-white rounded-lg border shadow-sm flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div><p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Company</p><p className="font-bold text-gray-800 flex items-center gap-2">{menu.companyName}</p></div>
                        <div className="h-8 w-px bg-gray-200" />
                        <div><p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Building</p><p className="font-semibold text-gray-700">{menu.buildingName}</p></div>
                      </div>
                    </div>
                  )}

                  {services.map((service) => {
                    const filteredStructure = getFilteredStructureForService(service.id);
                    if (filteredStructure.length === 0) return null;
                    return (
                    <div key={service.id} className="mb-10">
                      <div className="flex items-center gap-3 mb-4">
                        <h2 className="text-lg font-black bg-slate-800 text-white px-4 py-2 rounded-lg shadow-sm tracking-tight uppercase">{service.name}</h2>
                        <div className="h-px bg-gray-300 flex-1" />
                      </div>
                      <div className="overflow-x-auto rounded-xl border border-gray-400 bg-white shadow-md"> {/* Outer border color consistent */}
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-slate-50">
                              <th className="border-b border-r border-l border-gray-400 p-4 sticky left-0 z-20 bg-slate-50 min-w-[180px] text-left text-xs font-black uppercase text-slate-500">Meal Plan</th> {/* Added border-l, updated color */}
                              <th className="border-b border-r border-gray-400 p-4 sticky left-0 z-20 bg-slate-50 min-w-[180px] text-left text-xs font-black uppercase text-slate-500" style={{left: '180px'}}>Sub-Category</th> {/* Updated border color */}
                              {dateRange.map(({ date, day }) => (
                                <th key={date} className="border-b border-r border-gray-400 p-4 min-w-[220px] text-left"> {/* Updated border color */}
                                  <div className="font-bold text-slate-800">{new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                                  <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-tighter">{day}</div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredStructure.map(({ mealPlan, subMealPlans: relatedSubMPs }) => {
                              const visibleSubMPs = relatedSubMPs.filter(subMP => shouldShowRow(service.id, mealPlan.id, subMP));
                              return visibleSubMPs.map((subMealPlan, idx) => (
                                <tr key={`${mealPlan.id}-${subMealPlan.id}`} 
                                    className="transition-colors duration-300"> 
                                  <td className="border-b border-r border-l border-gray-400 p-4 sticky left-0 z-10 bg-white group-hover:bg-slate-50"> {/* Added border-l, updated color */}
                                    {idx === 0 && <div className="font-black text-indigo-700 text-sm">{mealPlan.name}</div>}
                                  </td>
                                  <td className="border-b border-r border-gray-400 p-4 sticky left-0 z-10 bg-white group-hover:bg-slate-50 text-sm font-medium text-slate-600" style={{left: '180px'}}> {/* Updated border color */}
                                    {subMealPlan.name}
                                  </td>
                                  {dateRange.map(({ date, day }) => {
                                    const { itemIds: cellItemIds, diffs: cellDiffs, isAffectedBySelectedUpdation } = getEffectiveMenuItemIdsForCell(date, service.id, mealPlan.id, subMealPlan.id, selectedUpdation);
                                    
                                    // Apply cell background color if this cell was affected by the SELECTED historical updation
                                    const cellBgColor = isAffectedBySelectedUpdation ? "bg-amber-50/30" : ""; 
                                    
                                    return (
                                      <td key={date} className={`border-b border-r border-gray-400  align-top transition-colors ${cellBgColor}`}> {/* Updated border color */}
                                        <div className="flex flex-col gap-2">
                                          {/* Show diffs only if a specific updation is selected AND there are changes relevant to this cell in that updation */}
                                          {cellDiffs.length > 0 && typeof selectedUpdation === 'object' ? (
                                            cellDiffs.map((ch, i) => (
                                              <div key={i} className="flex flex-col gap-1">
                                                {ch.action === "added" && <div className="p-2.5  bg-yellow-200 border border-yellow-200 shadow-sm"><div className="flex items-center justify-between text-[10px] font-black text-green-600 uppercase mb-1"><span>NW</span><CheckCircle2 className="h-3 w-3"/></div><div className="text-sm font-bold text-green-900">{getMenuItemName(ch.itemId)}</div></div>} {/* Now consistently uses getMenuItemName */}
                                                {ch.action === "removed" && <div className="p-2.5  bg-red-50 border border-red-100 opacity-60"><div className="text-[10px] font-black text-red-400 uppercase mb-1">Removed</div><div className="text-sm font-medium text-red-800 line-through">{getMenuItemName(ch.itemId)}</div></div>} {/* Now consistently uses getMenuItemName */}
                                                {ch.action === "replaced" && <div className="p-2.5  bg-white border-2 border-amber-200 shadow-md"><div className="flex items-center justify-between text-[10px] font-black text-amber-600 uppercase mb-1"><span>RP</span><AlertCircle className="h-3 w-3"/></div><div className="text-xs text-red-500 line-through opacity-50 mb-1">{getMenuItemName(ch.itemId)}</div><div className="flex items-center gap-2"><ArrowRight className="h-3 w-3 text-amber-500" /><div className="text-sm font-black text-slate-800">{getMenuItemName(ch.replacedWith)}</div></div></div>} {/* Now consistently uses getMenuItemName for both old and new */}
                                              </div>
                                            ))
                                          ) : ( // If no specific diffs for this cell in the selected updation, show the effective items for this version
                                            cellItemIds.length > 0 ? (
                                              cellItemIds.map(id => (<div key={id} className="p-2 rounded bg-indigo-50/50 border border-indigo-100 text-sm font-semibold text-slate-700">{getMenuItemName(id)}</div>))
                                            ) : <div className="text-xs text-slate-300 italic py-2">No items set</div>
                                          )}
                                        </div>
                                      </td>
                                    )
                                  })}
                                </tr>
                              ))
                            })}
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
  )
}