import * as XLSX from "xlsx"
import type { MealPlanStructureAssignment, Company, Building } from "@/lib/services"

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

interface ExportOptions {
  getServiceName: (id: string) => string
  getSubServiceName: (id: string) => string
  getMealPlanName: (id: string) => string
  getSubMealPlanName: (id: string) => string
}

interface HierarchyRow {
  level: number // 0 = Service, 1 = Sub-Service, 2 = Meal Plan, 3 = Sub-Meal Plan
  text: string
  dayData: { [day: string]: string }
}

export async function exportAllMealPlanStructures(
  structures: MealPlanStructureAssignment[],
  companies: Company[],
  buildings: Building[],
  options: ExportOptions,
) {
  const workbook = XLSX.utils.book_new()

  // Group structures by building
  const groupedByBuilding = new Map<string, MealPlanStructureAssignment>()
  structures.forEach((structure) => {
    const key = `${structure.companyId}-${structure.buildingId}`
    groupedByBuilding.set(key, structure)
  })

  // Create a sheet for each building
  companies.forEach((company) => {
    const companyBuildings = buildings.filter((b) => b.companyId === company.id && (!b.status || b.status === "active"))

    companyBuildings.forEach((building) => {
      const structureKey = `${company.id}-${building.id}`
      const structure = groupedByBuilding.get(structureKey)

      if (structure && structure.weekStructure) {
        // Create sheet name: "CompanyName - BuildingName"
        const sheetName = `${company.name} - ${building.name}`.substring(0, 31)

        // Collect all hierarchy rows
        const hierarchyRows: HierarchyRow[] = []

        // Build hierarchy: Service > SubService > MealPlan > SubMealPlan
        const allServices = new Map<string, { serviceId: string; subServices: Map<string, any> }>()

        // First pass: collect all services and sub-services across all days
        DAYS.forEach((day) => {
          const dayServices = structure.weekStructure[day] || []
          dayServices.forEach((svc: any) => {
            if (!allServices.has(svc.serviceId)) {
              allServices.set(svc.serviceId, {
                serviceId: svc.serviceId,
                subServices: new Map(),
              })
            }

            const serviceEntry = allServices.get(svc.serviceId)!
            svc.subServices?.forEach((subSvc: any) => {
              if (!serviceEntry.subServices.has(subSvc.subServiceId)) {
                serviceEntry.subServices.set(subSvc.subServiceId, {
                  subServiceId: subSvc.subServiceId,
                  mealPlans: new Map(),
                })
              }

              const subServiceEntry = serviceEntry.subServices.get(subSvc.subServiceId)!
              subSvc.mealPlans?.forEach((mealPlan: any) => {
                if (!subServiceEntry.mealPlans.has(mealPlan.mealPlanId)) {
                  subServiceEntry.mealPlans.set(mealPlan.mealPlanId, {
                    mealPlanId: mealPlan.mealPlanId,
                    subMealPlans: new Set(),
                  })
                }

                const mealPlanEntry = subServiceEntry.mealPlans.get(mealPlan.mealPlanId)!
                mealPlan.subMealPlans?.forEach((subMeal: any) => {
                  mealPlanEntry.subMealPlans.add(subMeal.subMealPlanId)
                })
              })
            })
          })
        })

        // Second pass: create rows with proper hierarchy and indentation
        allServices.forEach((serviceData, serviceId) => {
          const serviceName = options.getServiceName(serviceId)

          // Add Service row
          const serviceRow: HierarchyRow = {
            level: 0,
            text: serviceName,
            dayData: {},
          }
          DAYS.forEach((day) => {
            serviceRow.dayData[day] = ""
          })
          hierarchyRows.push(serviceRow)

          // Add Sub-Services under this Service
          serviceData.subServices.forEach((subServiceData, subServiceId) => {
            const subServiceName = options.getSubServiceName(subServiceId)

            // Add Sub-Service row
            const subServiceRow: HierarchyRow = {
              level: 1,
              text: subServiceName,
              dayData: {},
            }
            DAYS.forEach((day) => {
              subServiceRow.dayData[day] = ""
            })
            hierarchyRows.push(subServiceRow)

            // Add Meal Plans under this Sub-Service
            subServiceData.mealPlans.forEach((mealPlanData, mealPlanId) => {
              const mealPlanName = options.getMealPlanName(mealPlanId)

              // Add Meal Plan row with day-wise meal plan assignments
              const mealPlanRow: HierarchyRow = {
                level: 2,
                text: mealPlanName,
                dayData: {},
              }

              DAYS.forEach((day) => {
                const dayService = structure.weekStructure[day]?.find((s: any) => s.serviceId === serviceId)
                const daySubService = dayService?.subServices?.find((ss: any) => ss.subServiceId === subServiceId)
                const dayMealPlan = daySubService?.mealPlans?.find((mp: any) => mp.mealPlanId === mealPlanId)

                mealPlanRow.dayData[day] = dayMealPlan ? "✓" : ""
              })
              hierarchyRows.push(mealPlanRow)

              // Add Sub-Meal Plans under this Meal Plan
              mealPlanData.subMealPlans.forEach((subMealPlanId) => {
                const subMealPlanName = options.getSubMealPlanName(subMealPlanId)

                // Add Sub-Meal Plan row
                const subMealPlanRow: HierarchyRow = {
                  level: 3,
                  text: subMealPlanName,
                  dayData: {},
                }

                DAYS.forEach((day) => {
                  const dayService = structure.weekStructure[day]?.find((s: any) => s.serviceId === serviceId)
                  const daySubService = dayService?.subServices?.find((ss: any) => ss.subServiceId === subServiceId)
                  const dayMealPlan = daySubService?.mealPlans?.find((mp: any) => mp.mealPlanId === mealPlanId)
                  const hasSubMeal = dayMealPlan?.subMealPlans?.some((smp: any) => smp.subMealPlanId === subMealPlanId)

                  subMealPlanRow.dayData[day] = hasSubMeal ? "•" : ""
                })
                hierarchyRows.push(subMealPlanRow)
              })
            })
          })
        })

        const sheetData: any[] = []

        // Header section
        sheetData.push([`MEAL PLAN STRUCTURE - ${company.name}`])
        sheetData.push([`Building: ${building.name}`])
        sheetData.push([])

        // Column headers with days
        const headers = [
          "Service / Sub-Service / Meal Plan / Sub-Meal Plan",
          ...DAYS.map((day) => day.charAt(0).toUpperCase() + day.slice(1)),
        ]
        sheetData.push(headers)

        // Add hierarchy rows with indentation
        hierarchyRows.forEach((row) => {
          const prefix = row.level === 0 ? "" : row.level === 1 ? "  └─ " : row.level === 2 ? "      ├─ " : "        • "
          const rowData = [prefix + row.text]

          DAYS.forEach((day) => {
            rowData.push(row.dayData[day] || "")
          })

          sheetData.push(rowData)
        })

        // Create worksheet
        const worksheet = XLSX.utils.aoa_to_sheet(sheetData)

        // Set column widths
        const colWidths = [50, 16, 16, 16, 16, 16, 16, 16]
        worksheet["!cols"] = colWidths.map((width) => ({ wch: width }))

        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
      }
    })
  })

  // Generate file and download
  const fileName = `Meal_Plan_Structure_${new Date().toISOString().split("T")[0]}.xlsx`

  if (workbook.SheetNames.length === 0) {
    console.log("[v0] ERROR: Workbook has no sheets, adding empty sheet")
    const emptySheet = XLSX.utils.aoa_to_sheet([["No data available"]])
    XLSX.utils.book_append_sheet(workbook, emptySheet, "Empty")
  }

  XLSX.writeFile(workbook, fileName)
}
