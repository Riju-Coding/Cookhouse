import OpenAI from "openai"
import { collection, getDocs, query, where, getDoc, doc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import {
  mealPlanStructureAssignmentsService,
  menuItemsService,
  mealPlansService,
  servicesService,
  subMealPlansService,
  subServicesService,
  menuPlanningRulesService,
} from "@/lib/services"

export const runtime = "nodejs"

type MenuCell = {
  menuItemIds: string[]
}

type MenuData = Record<
  string,
  Record<string, Record<string, Record<string, Record<string, MenuCell>>>>
>

function getEnv(name: string): string | undefined {
  const v = process.env[name]
  if (!v) return undefined
  const t = v.trim()
  return t.length ? t : undefined
}

function addDays(yyyyMmDd: string, days: number): string {
  const d = new Date(yyyyMmDd)
  d.setDate(d.getDate() + days)
  return d.toISOString().split("T")[0]
}

function eachDateInclusive(start: string, end: string): string[] {
  const out: string[] = []
  let cur = new Date(start)
  const e = new Date(end)
  while (cur <= e) {
    out.push(cur.toISOString().split("T")[0])
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

function dayKeyFromDate(date: string): string {
  const d = new Date(date)
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
  return days[d.getDay()]
}

function buildAllowedCellsByDate(params: {
  dates: string[]
  assignments: any[]
  serviceId: string
  subServiceId: string
}): Record<string, Array<{ mealPlanId: string; subMealPlanId: string }>> {
  const { dates, assignments, serviceId, subServiceId } = params
  const out: Record<string, Array<{ mealPlanId: string; subMealPlanId: string }>> = {}

  for (const date of dates) {
    const dayKey = dayKeyFromDate(date)
    const set = new Set<string>()

    for (const a of assignments) {
      if (a?.status && a.status !== "active") continue
      const day = a?.weekStructure?.[dayKey]
      if (!Array.isArray(day)) continue

      for (const s of day) {
        if (s?.serviceId !== serviceId) continue
        const subServices = Array.isArray(s?.subServices) ? s.subServices : []
        for (const ss of subServices) {
          // Data uses subServiceId in most places, but keep fallback to id
          const ssId = ss?.subServiceId || ss?.id
          if (ssId !== subServiceId) continue
          const mealPlans = Array.isArray(ss?.mealPlans) ? ss.mealPlans : []
          for (const mp of mealPlans) {
            const mpId = mp?.mealPlanId
            if (!mpId) continue
            const smps = Array.isArray(mp?.subMealPlans) ? mp.subMealPlans : []
            for (const smp of smps) {
              const smpId = smp?.subMealPlanId
              if (!smpId) continue
              set.add(`${mpId}|${smpId}`)
            }
          }
        }
      }
    }

    out[date] = Array.from(set).map((k) => {
      const [mealPlanId, subMealPlanId] = k.split("|")
      return { mealPlanId, subMealPlanId }
    })
  }

  return out
}

function sliceMenuDataToScope(params: {
  menuData: any
  dates: string[]
  serviceId: string
  subServiceId: string
}): any {
  const { menuData, dates, serviceId, subServiceId } = params
  const out: any = {}
  if (!menuData || typeof menuData !== "object") return out

  for (const date of dates) {
    const day = (menuData as any)[date]
    const ss = day?.[serviceId]?.[subServiceId]
    if (ss) out[date] = { [serviceId]: { [subServiceId]: ss } }
  }
  return out
}

function computeMissingCells(params: {
  dates: string[]
  allowedCellsByDate: Record<string, Array<{ mealPlanId: string; subMealPlanId: string }>>
  currentMenuDataScoped: any
  serviceId: string
  subServiceId: string
}): Record<string, Array<{ mealPlanId: string; subMealPlanId: string }>> {
  const { dates, allowedCellsByDate, currentMenuDataScoped, serviceId, subServiceId } = params
  const missing: Record<string, Array<{ mealPlanId: string; subMealPlanId: string }>> = {}

  for (const date of dates) {
    const allowed = allowedCellsByDate[date] || []
    const ss = currentMenuDataScoped?.[date]?.[serviceId]?.[subServiceId] || {}
    const miss: Array<{ mealPlanId: string; subMealPlanId: string }> = []

    for (const c of allowed) {
      const cell = ss?.[c.mealPlanId]?.[c.subMealPlanId]
      const ids = Array.isArray(cell?.menuItemIds) ? cell.menuItemIds : []
      if (!ids || ids.length === 0) miss.push(c)
    }

    missing[date] = miss
  }

  return missing
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function buildCandidateMenuItems(params: {
  topByCell: Record<string, Array<{ itemId: string; count: number }>>
  allowedCellsByDate: Record<string, Array<{ mealPlanId: string; subMealPlanId: string }>>
  serviceId: string
  subServiceId: string
  menuItemsById: Map<string, { id: string; name: string; category?: string }>
  maxItems?: number
}): { menuItems: Array<{ id: string; name: string; category: string }>; candidatesByCellKey: Record<string, string[]> } {
  const {
    topByCell,
    allowedCellsByDate,
    serviceId,
    subServiceId,
    menuItemsById,
    maxItems = 600,
  } = params

  const cellKeys = new Set<string>()
  Object.values(allowedCellsByDate).forEach((cells) => {
    cells.forEach((c) => cellKeys.add(`${serviceId}|${subServiceId}|${c.mealPlanId}|${c.subMealPlanId}`))
  })

  const candidatesByCellKey: Record<string, string[]> = {}
  const globalCounts = new Map<string, number>()

  for (const ck of cellKeys) {
    const top = topByCell[ck] || []
    const ids = top.slice(0, 30).map((t) => t.itemId).filter(Boolean)
    candidatesByCellKey[ck] = ids
    top.forEach((t) => globalCounts.set(t.itemId, (globalCounts.get(t.itemId) || 0) + (t.count || 0)))
  }

  const globalTop = Array.from(globalCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(200, Math.floor(maxItems / 2)))
    .map(([id]) => id)

  const finalSet = new Set<string>()
  globalTop.forEach((id) => finalSet.add(id))
  Object.values(candidatesByCellKey).forEach((ids) => ids.forEach((id) => finalSet.add(id)))

  const outItems: Array<{ id: string; name: string; category: string }> = []
  for (const id of finalSet) {
    const it = menuItemsById.get(id)
    if (!it?.name) continue
    outItems.push({ id, name: it.name, category: it.category || "" })
    if (outItems.length >= maxItems) break
  }

  return { menuItems: outItems, candidatesByCellKey }
}

function buildGlobalTopFromHistory(topByCell: Record<string, Array<{ itemId: string; count: number }>>, max = 300): string[] {
  const global = new Map<string, number>()
  Object.values(topByCell || {}).forEach((arr) => {
    ;(arr || []).forEach((t) => global.set(t.itemId, (global.get(t.itemId) || 0) + (t.count || 0)))
  })
  return Array.from(global.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([id]) => id)
}

function deterministicSuggest(params: {
  dates: string[]
  missingCellsByDate: Record<string, Array<{ mealPlanId: string; subMealPlanId: string }>>
  serviceId: string
  subServiceId: string
  topByCell: Record<string, Array<{ itemId: string; count: number }>>
  globalTop: string[]
  currentMenuDataScoped: any
  subMealPlansRepeatAllowed: Set<string>
  mealPlansById?: Map<string, { id: string; name?: string }>
  subMealPlansById?: Map<string, { id: string; name?: string }>
  menuItemsById?: Map<string, { id: string; name?: string; category?: string }>
}): any {
  const {
    dates,
    missingCellsByDate,
    serviceId,
    subServiceId,
    topByCell,
    globalTop,
    currentMenuDataScoped,
    subMealPlansRepeatAllowed,
    mealPlansById,
    subMealPlansById,
    menuItemsById,
  } = params

  const out: any = {}
  const usedByCellKey = new Map<string, Set<string>>() // cellKey -> used itemIds in target range

  // Seed with items already present in draft (avoid duplicates unless repeat allowed)
  for (const date of dates) {
    const ss = currentMenuDataScoped?.[date]?.[serviceId]?.[subServiceId]
    if (!ss) continue
    for (const mealPlanId of Object.keys(ss)) {
      for (const subMealPlanId of Object.keys(ss[mealPlanId] || {})) {
        const cell = ss[mealPlanId]?.[subMealPlanId]
        const ids = Array.isArray(cell?.menuItemIds) ? cell.menuItemIds : []
        const cellKey = `${serviceId}|${subServiceId}|${mealPlanId}|${subMealPlanId}`
        if (!usedByCellKey.has(cellKey)) usedByCellKey.set(cellKey, new Set())
        ids.forEach((id: string) => usedByCellKey.get(cellKey)!.add(id))
      }
    }
  }

  for (const date of dates) {
    const missing = missingCellsByDate[date] || []
    for (const c of missing) {
      const cellKey = `${serviceId}|${subServiceId}|${c.mealPlanId}|${c.subMealPlanId}`
      if (!usedByCellKey.has(cellKey)) usedByCellKey.set(cellKey, new Set())
      const used = usedByCellKey.get(cellKey)!

      const repeatAllowed = subMealPlansRepeatAllowed.has(c.subMealPlanId)
      const candidates = (topByCell[cellKey] || []).map((t) => t.itemId).filter(Boolean)
      const pool = candidates.length ? candidates : globalTop

      const mealPlanName = mealPlansById?.get(c.mealPlanId)?.name || ""
      const subMealPlanName = subMealPlansById?.get(c.subMealPlanId)?.name || ""

      let pick: string | null = null
      let bestScore = -1e9
      for (const id of pool) {
        if (!id) continue
        if (!repeatAllowed && used.has(id)) continue

        const count = (topByCell[cellKey] || []).find((t) => t.itemId === id)?.count || 0
        const it = menuItemsById?.get(id)
        const cm = categoryMatchScore({
          subMealPlanName,
          mealPlanName,
          menuItemCategory: it?.category,
          menuItemName: it?.name || "",
        })

        const score = count * 10 + cm
        if (score > bestScore) {
          bestScore = score
          pick = id
        }
      }

      if (!pick && pool.length) pick = pool[0]
      if (!pick) continue

      // Write into sparse menuData
      if (!out[date]) out[date] = {}
      if (!out[date][serviceId]) out[date][serviceId] = {}
      if (!out[date][serviceId][subServiceId]) out[date][serviceId][subServiceId] = {}
      if (!out[date][serviceId][subServiceId][c.mealPlanId]) out[date][serviceId][subServiceId][c.mealPlanId] = {}
      out[date][serviceId][subServiceId][c.mealPlanId][c.subMealPlanId] = { menuItemIds: [pick] }

      used.add(pick)
    }
  }

  return out
}

function buildHistorySummary(menus: Array<{ menuData?: any }>) {
  const counts = new Map<string, Map<string, number>>() // cellKey -> itemId -> count
  const usedByDate = new Map<string, Set<string>>() // date -> itemIds

  for (const m of menus) {
    const data: MenuData = (m as any).menuData || {}
    for (const date of Object.keys(data)) {
      const day = data[date]
      if (!usedByDate.has(date)) usedByDate.set(date, new Set())
      const dateSet = usedByDate.get(date)!

      for (const serviceId of Object.keys(day || {})) {
        const ssObj = day[serviceId] || {}
        for (const subServiceId of Object.keys(ssObj)) {
          const mpObj = ssObj[subServiceId] || {}
          for (const mealPlanId of Object.keys(mpObj)) {
            const smpObj = mpObj[mealPlanId] || {}
            for (const subMealPlanId of Object.keys(smpObj)) {
              const cell = smpObj[subMealPlanId]
              const ids = Array.isArray(cell?.menuItemIds) ? cell.menuItemIds : []
              const cellKey = `${serviceId}|${subServiceId}|${mealPlanId}|${subMealPlanId}`

              if (!counts.has(cellKey)) counts.set(cellKey, new Map())
              const itemCount = counts.get(cellKey)!

              for (const id of ids) {
                if (!id) continue
                itemCount.set(id, (itemCount.get(id) || 0) + 1)
                dateSet.add(id)
              }
            }
          }
        }
      }
    }
  }

  // Convert to compact JSON-able structures
  const topByCell: Record<string, Array<{ itemId: string; count: number }>> = {}
  counts.forEach((m, cellKey) => {
    const top = Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([itemId, count]) => ({ itemId, count }))
    topByCell[cellKey] = top
  })

  const usedItemsByDate: Record<string, string[]> = {}
  usedByDate.forEach((set, date) => {
    usedItemsByDate[date] = Array.from(set)
  })

  return { topByCell, usedItemsByDate }
}

function normalizeText(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function categoryMatchScore(params: {
  subMealPlanName: string
  mealPlanName: string
  menuItemCategory?: string
  menuItemName: string
}): number {
  const smp = normalizeText(params.subMealPlanName)
  const mp = normalizeText(params.mealPlanName)
  const cat = normalizeText(params.menuItemCategory || "")
  const name = normalizeText(params.menuItemName)

  const text = `${smp} ${mp}`

  let score = 0

  const wantsFruit = text.includes("fruit")
  const wantsBanana = text.includes("banana")
  const wantsSalad = text.includes("salad")
  const wantsDessert = text.includes("dessert") || text.includes("sweet") || text.includes("halwa") || text.includes("kheer")
  const wantsDry = text.includes("dry")
  const wantsGravy = text.includes("gravy") || text.includes("curry")
  const wantsRice = text.includes("rice") || text.includes("biryani") || text.includes("pulao")
  const wantsRoti = text.includes("roti") || text.includes("chapati") || text.includes("phulka") || text.includes("naan")

  const isFruitLike = cat.includes("fruit") || name.includes("banana") || name.includes("apple") || name.includes("papaya") || name.includes("watermelon")
  const isDessertLike = cat.includes("dessert") || cat.includes("sweet") || name.includes("halwa") || name.includes("kheer") || name.includes("payasam")
  const isSaladLike = cat.includes("salad") || name.includes("salad")
  const isRiceLike = cat.includes("rice") || name.includes("rice") || name.includes("biryani") || name.includes("pulao")
  const isRotiLike = cat.includes("roti") || name.includes("roti") || name.includes("chapati") || name.includes("naan") || name.includes("phulka")
  const isGravyLike = cat.includes("gravy") || cat.includes("curry") || name.includes("curry") || name.includes("gravy")
  const isDryLike = cat.includes("dry") || name.includes("dry")

  if (wantsFruit) score += isFruitLike ? 6 : -1
  if (wantsBanana) score += name.includes("banana") ? 6 : 0
  if (wantsDessert) score += isDessertLike ? 6 : -1
  if (wantsSalad) score += isSaladLike ? 5 : -1
  if (wantsRice) score += isRiceLike ? 5 : -1
  if (wantsRoti) score += isRotiLike ? 5 : -1
  if (wantsGravy) score += isGravyLike ? 4 : -1
  if (wantsDry) score += isDryLike ? 4 : -1

  if ((wantsDry || wantsGravy) && isFruitLike && !wantsFruit) score -= 6
  if ((wantsDry || wantsGravy) && isDessertLike && !wantsDessert) score -= 3

  return score
}

function calcFillRatio(params: {
  menuData: any
  dates: string[]
  allowedCellsByDate: Record<string, Array<{ mealPlanId: string; subMealPlanId: string }>>
  serviceId: string
  subServiceId: string
}): number {
  const { menuData, dates, allowedCellsByDate, serviceId, subServiceId } = params
  let total = 0
  let filled = 0
  for (const date of dates) {
    const allowed = allowedCellsByDate[date] || []
    total += allowed.length
    const ss = menuData?.[date]?.[serviceId]?.[subServiceId] || {}
    for (const c of allowed) {
      const cell = ss?.[c.mealPlanId]?.[c.subMealPlanId]
      const ids = Array.isArray(cell?.menuItemIds) ? cell.menuItemIds : []
      if (ids.length > 0) filled += 1
    }
  }
  if (!total) return 0
  return filled / total
}

function pickHighQualityHistoryMenus(params: {
  historyMenus: Array<{ menuData?: any; startDate?: string; endDate?: string }>
  serviceId: string
  subServiceId: string
  buildAllowedCellsByDateForDates: (dates: string[]) => Record<string, Array<{ mealPlanId: string; subMealPlanId: string }>>
  minFillRatio?: number
  maxMenus?: number
}): Array<{ menuData?: any; startDate?: string; endDate?: string }> {
  const { historyMenus, serviceId, subServiceId, buildAllowedCellsByDateForDates, minFillRatio = 0.9, maxMenus = 12 } = params

  return historyMenus
    .map((m) => {
      const s = (m as any).startDate
      const e = (m as any).endDate
      if (!s || !e) return { m, score: 0 }
      const dates = eachDateInclusive(s, e)
      const allowed = buildAllowedCellsByDateForDates(dates)
      const ratio = calcFillRatio({
        menuData: (m as any).menuData || {},
        dates,
        allowedCellsByDate: allowed,
        serviceId,
        subServiceId,
      })
      return { m, score: ratio }
    })
    .filter((x) => x.score >= minFillRatio)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxMenus)
    .map((x) => x.m)
}

function indexById<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((i) => [i.id, i]))
}

type EnrichedMenu = Record<
  string,
  Array<{
    serviceId: string
    serviceName: string
    subServices: Array<{
      subServiceId: string
      subServiceName: string
      mealPlans: Array<{
        mealPlanId: string
        mealPlanName: string
        subMealPlans: Array<{
          subMealPlanId: string
          subMealPlanName: string
          items: Array<{ menuItemId: string; menuItemName: string; category?: string }>
        }>
      }>
    }>
  }>
>

async function handleSuggest(startDate: string, endDate: string, scope?: { serviceId?: string | null; subServiceId?: string | null; companyId?: string | null }) {
  const apiKey = getEnv("AWS_BEARER_TOKEN_BEDROCK") ?? getEnv("OPENAI_API_KEY")
  const baseURL = getEnv("OPENAI_BASE_URL") ?? "https://bedrock-mantle.ap-south-1.api.aws/v1"
  const model = getEnv("BEDROCK_MANTLE_MODEL") ?? "openai.gpt-oss-120b"

  if (!apiKey) {
    return Response.json(
      { ok: false, error: "Missing AWS_BEARER_TOKEN_BEDROCK (or OPENAI_API_KEY)." },
      { status: 400 },
    )
  }

  if (!scope?.serviceId || !scope?.subServiceId) {
    return Response.json(
      {
        ok: false,
        error: "serviceId and subServiceId are required for suggestions (to match the menu edit grid).",
      },
      { status: 400 },
    )
  }

  // Load structure + menu items
  const [services, subServices, mealPlans, subMealPlans, menuItems, mealPlanStructureAssignments] = await Promise.all([
    servicesService.getActive(),
    subServicesService.getActive(),
    mealPlansService.getActive(),
    subMealPlansService.getActive(),
    menuItemsService.getActive(),
    mealPlanStructureAssignmentsService.getAll(),
  ])
  const servicesById = indexById(services)
  const subServicesById = indexById(subServices)
  const mealPlansById = indexById(mealPlans)
  const subMealPlansById = indexById(subMealPlans)
  const menuItemsById = indexById(menuItems)

  // Fetch last 2 weeks of combined menus (by endDate)
  const historyStart = addDays(startDate, -14)
  const q = query(
    collection(db, "combinedMenus"),
    where("endDate", ">=", historyStart),
    where("endDate", "<", startDate),
  )
  const snap = await getDocs(q)
  const historyMenus = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))

  const targetDates = eachDateInclusive(startDate, endDate)

  const allowedCellsByDate = buildAllowedCellsByDate({
    dates: targetDates,
    assignments: mealPlanStructureAssignments || [],
    serviceId: scope.serviceId,
    subServiceId: scope.subServiceId,
  })

  const hasAnyAllowedCell = Object.values(allowedCellsByDate).some((cells) => cells.length > 0)
  if (!hasAnyAllowedCell) {
    return Response.json({
      ok: true,
      startDate,
      endDate,
      historyWindowDays: 14,
      result: { menuData: {} },
      menuData: {},
      enrichedMenu: {},
      note: "No meal plan structure found for this service/sub-service in the target range.",
    })
  }

  const buildAllowedForDates = (dates: string[]) =>
    buildAllowedCellsByDate({
      dates,
      assignments: mealPlanStructureAssignments || [],
      serviceId: scope.serviceId,
      subServiceId: scope.subServiceId,
    })

  // Use only "high-quality" menus (>=90% filled in this service/sub-service) as the strongest signal.
  const bestHistoryMenus = pickHighQualityHistoryMenus({
    historyMenus,
    serviceId: scope.serviceId,
    subServiceId: scope.subServiceId,
    buildAllowedCellsByDateForDates: buildAllowedForDates,
    minFillRatio: 0.9,
    maxMenus: 12,
  })

  const historyForModel = bestHistoryMenus.length > 0 ? bestHistoryMenus : historyMenus
  const history = buildHistorySummary(historyForModel)

  const fillMode: "missing_only" | "all" = (handleSuggest as any).__fillMode === "all" ? "all" : "missing_only"
  const currentMenuDataScoped =
    fillMode === "missing_only"
      ? sliceMenuDataToScope({
          menuData: (handleSuggest as any).__currentMenuData,
          dates: targetDates,
          serviceId: scope.serviceId,
          subServiceId: scope.subServiceId,
        })
      : {}

  const missingCellsByDate =
    fillMode === "missing_only"
      ? computeMissingCells({
          dates: targetDates,
          allowedCellsByDate,
          currentMenuDataScoped,
          serviceId: scope.serviceId,
          subServiceId: scope.subServiceId,
        })
      : allowedCellsByDate

  const hasAnyMissing = Object.values(missingCellsByDate).some((cells) => cells.length > 0)
  if (!hasAnyMissing) {
    return Response.json({
      ok: true,
      startDate,
      endDate,
      historyWindowDays: 14,
      result: { menuData: {} },
      menuData: {},
      enrichedMenu: {},
      note: "No missing cells detected for the selected service/sub-service. Nothing to suggest.",
    })
  }

  // Build a compact candidate catalog to stay under context limits
  const globalTop = buildGlobalTopFromHistory(history.topByCell, 400)
  const { menuItems: candidateMenuItems, candidatesByCellKey } = buildCandidateMenuItems({
    topByCell: history.topByCell,
    allowedCellsByDate,
    serviceId: scope.serviceId,
    subServiceId: scope.subServiceId,
    menuItemsById,
    maxItems: 600,
  })
  if (candidateMenuItems.length < 150) {
    // Fallback: add more active items so the model always has options
    const extra = menuItems
      .filter((i) => i?.name)
      .slice(0, 600 - candidateMenuItems.length)
      .map((i) => ({ id: i.id, name: i.name, category: i.category || "" }))
    candidateMenuItems.push(...extra)
  }

  const rules = scope.serviceId && scope.subServiceId 
    ? await menuPlanningRulesService.getMergedRule(scope.serviceId, scope.subServiceId, scope.companyId) 
    : null

  let aiTrainingProfileText = ""
  if (scope.serviceId && scope.subServiceId) {
    const docId = `${scope.serviceId}_${scope.subServiceId}`
    const profileSnap = await getDoc(doc(db, "aiTrainingProfiles", docId))
    if (profileSnap.exists()) {
      aiTrainingProfileText = profileSnap.data().profileText || ""
    }
  }

  const client = new OpenAI({ apiKey, baseURL })

  const system = [
    "You are a menu planning assistant for a corporate catering admin system.",
    "Return ONLY valid JSON. No markdown. No extra text.",
    "Goal: suggest items for missing cells in a Combined Menu for the target date range.",
    "Constraints:",
    "- Only generate for the provided allowedCellsByDate (do not invent mealPlanId/subMealPlanId).",
    "- Avoid repeating the same menuItemId in the SAME cellKey across different dates within the target range unless the subMealPlan is marked isRepeatPlan=true.",
    "- Prefer variety using the provided two-week history.",
    "- Output must be structurally correct.",
    "- STRONGLY prefer items that match the provided 'rules' (day rules and cell rules). If an exact match cannot be found in the catalog, pick the closest probable match to avoid leaving cells blank.",
  ]

  if (rules?.grandRules && rules.grandRules.length > 0) {
    system.push("\n### GRAND RULES (Service Level Constraints):")
    rules.grandRules.forEach(gr => system.push(`- ${gr}`))
  }

  if (aiTrainingProfileText) {
    system.push("\n### AI TRAINING PROFILE (Historical Patterns to follow):")
    system.push(aiTrainingProfileText)
  }

  const systemString = system.join("\n")

  try {
    // For large ranges, chunk by week to stay under context limits.
    const dateChunks = chunk(targetDates, 7)
    const mergedMenuData: any = {}

    for (const dates of dateChunks) {
      const allowedChunk: any = {}
      dates.forEach((d) => (allowedChunk[d] = missingCellsByDate[d] || []))

      const user = {
        task: "Generate suggestions ONLY for the missing cells (allowedCellsByDate). Do not include cells that already have items.",
        target: { startDate: dates[0], endDate: dates[dates.length - 1], dates },
        scope: {
          serviceId: scope?.serviceId || null,
          subServiceId: scope?.subServiceId || null,
        },
        allowedCellsByDate: allowedChunk,
        currentMenuDataScoped,
        candidatesByCellKey,
        schema: {
          menuData:
            "Object keyed by date (YYYY-MM-DD) -> serviceId -> subServiceId -> mealPlanId -> subMealPlanId -> {menuItemIds: string[]}",
        },
        cellKey: "serviceId|subServiceId|mealPlanId|subMealPlanId",
        history,
        catalog: {
          // keep these small; UI will enrich names later
          subMealPlans: subMealPlans.map((smp) => ({ id: smp.id, isRepeatPlan: !!(smp as any).isRepeatPlan })),
          menuItems: candidateMenuItems,
        },
        rules: rules?.dayRules || {},
        output: {
          menuData:
            "Return JSON with a single key: {\"menuData\": ...}. Only for the provided dates and allowed cells. For each missing cell, include menuItemIds with 1 itemId (or up to 2 if confident).",
        },
      }

      const resp = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemString },
          { role: "user", content: JSON.stringify(user) },
        ],
        temperature: 0.3,
      })

      const text = resp.choices?.[0]?.message?.content ?? ""
      const parsed = JSON.parse(text)
      const chunkMenuData: any = parsed?.menuData || parsed || {}

      for (const d of Object.keys(chunkMenuData || {})) mergedMenuData[d] = chunkMenuData[d]
    }

    let rawMenuData: MenuData = mergedMenuData

    const empty = !rawMenuData || Object.keys(rawMenuData).length === 0
    if (empty) {
      const repeatAllowed = new Set(
        subMealPlans.filter((smp) => !!(smp as any).isRepeatPlan).map((smp) => smp.id),
      )
      rawMenuData = deterministicSuggest({
        dates: targetDates,
        missingCellsByDate,
        serviceId: scope.serviceId,
        subServiceId: scope.subServiceId,
        topByCell: history.topByCell,
        globalTop,
        currentMenuDataScoped,
        subMealPlansRepeatAllowed: repeatAllowed,
        mealPlansById,
        subMealPlansById,
        menuItemsById,
      })
    }

    // Hard-filter output to scope + allowedCellsByDate (defense-in-depth)
    if (scope?.serviceId && scope?.subServiceId) {
      const filtered: any = {}
      for (const date of Object.keys(rawMenuData || {})) {
        const day = (rawMenuData as any)[date]
        const svc = day?.[scope.serviceId]
        const ss = svc?.[scope.subServiceId]
        if (ss) {
          const allowed = new Set((allowedCellsByDate[date] || []).map((c) => `${c.mealPlanId}|${c.subMealPlanId}`))
          const ssFiltered: any = {}
          for (const mealPlanId of Object.keys(ss || {})) {
            const mpObj = ss[mealPlanId]
            if (!mpObj || typeof mpObj !== "object") continue
            const mpFiltered: any = {}
            for (const subMealPlanId of Object.keys(mpObj)) {
              if (!allowed.has(`${mealPlanId}|${subMealPlanId}`)) continue
              mpFiltered[subMealPlanId] = mpObj[subMealPlanId]
            }
            if (Object.keys(mpFiltered).length > 0) ssFiltered[mealPlanId] = mpFiltered
          }
          if (Object.keys(ssFiltered).length > 0) {
            filtered[date] = { [scope.serviceId]: { [scope.subServiceId]: ssFiltered } }
          }
        }
      }
      rawMenuData = filtered
    }

    const enriched: EnrichedMenu = {}
    for (const date of Object.keys(rawMenuData || {})) {
      const day = rawMenuData[date] || {}
      const servicesOut: EnrichedMenu[string] = []

      for (const serviceId of Object.keys(day)) {
        const serviceObj = day[serviceId] || {}
        const serviceName = servicesById.get(serviceId)?.name || "Service"
        const subServicesOut: any[] = []

        for (const subServiceId of Object.keys(serviceObj)) {
          const subServiceObj = serviceObj[subServiceId] || {}
          const subServiceName = subServicesById.get(subServiceId)?.name || "SubService"
          const mealPlansOut: any[] = []

          for (const mealPlanId of Object.keys(subServiceObj)) {
            const mealPlanObj = subServiceObj[mealPlanId] || {}
            const mealPlanName = mealPlansById.get(mealPlanId)?.name || "Meal Plan"
            const subMealPlansOut: any[] = []

            for (const subMealPlanId of Object.keys(mealPlanObj)) {
              const cell = mealPlanObj[subMealPlanId]
              const ids = Array.isArray(cell?.menuItemIds) ? cell.menuItemIds : []
              const subMealPlanName = subMealPlansById.get(subMealPlanId)?.name || "Sub Meal Plan"

              const items = ids
                .map((menuItemId) => {
                  const it = menuItemsById.get(menuItemId)
                  return {
                    menuItemId,
                    menuItemName: it?.name || "Menu Item",
                    category: it?.category,
                  }
                })
                .filter((x) => x.menuItemId)

              subMealPlansOut.push({
                subMealPlanId,
                subMealPlanName,
                items,
              })
            }

            mealPlansOut.push({
              mealPlanId,
              mealPlanName,
              subMealPlans: subMealPlansOut,
            })
          }

          subServicesOut.push({
            subServiceId,
            subServiceName,
            mealPlans: mealPlansOut,
          })
        }

        servicesOut.push({
          serviceId,
          serviceName,
          subServices: subServicesOut,
        })
      }

      enriched[date] = servicesOut
    }

    return Response.json({
      ok: true,
      startDate,
      endDate,
      historyWindowDays: 14,
      result: { menuData: rawMenuData },
      menuData: rawMenuData,
      enrichedMenu: enriched,
      debug: {
        historyMenus: historyMenus.length,
        bestHistoryMenus: bestHistoryMenus.length,
        candidateMenuItems: candidateMenuItems.length,
        anyMissing: hasAnyMissing,
      },
    })
  } catch (err: any) {
    return Response.json(
      {
        ok: false,
        error: err?.message ?? String(err),
      },
      { status: 500 },
    )
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const startDate: string | undefined = body?.startDate
  const endDate: string | undefined = body?.endDate
  const serviceId: string | undefined = body?.serviceId
  const subServiceId: string | undefined = body?.subServiceId
  const companyId: string | undefined = body?.companyId
  const currentMenuData: any = body?.currentMenuData
  const fillMode: "missing_only" | "all" = body?.fillMode === "all" ? "all" : "missing_only"

  if (!startDate || !endDate) {
    return Response.json({ ok: false, error: "startDate and endDate are required (YYYY-MM-DD)." }, { status: 400 })
  }

  // Pass currentMenuData via a global-ish request-scoped variable by re-calling internal helper below (kept simple).
  ;(handleSuggest as any).__currentMenuData = currentMenuData
  ;(handleSuggest as any).__fillMode = fillMode

  return handleSuggest(startDate, endDate, { serviceId, subServiceId, companyId })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const startDate = url.searchParams.get("startDate")
  const endDate = url.searchParams.get("endDate")
  const serviceId = url.searchParams.get("serviceId")
  const subServiceId = url.searchParams.get("subServiceId")
  const companyId = url.searchParams.get("companyId")

  if (!startDate || !endDate) {
    return Response.json(
      {
        ok: false,
        error: "Use POST JSON body or pass ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD",
        examples: [
          { method: "GET", url: "/api/ai/menu-suggest?startDate=2026-06-01&endDate=2026-06-07" },
          { method: "POST", body: { startDate: "2026-06-01", endDate: "2026-06-07" } },
        ],
      },
      { status: 400 },
    )
  }

  return handleSuggest(startDate, endDate, { serviceId, subServiceId, companyId })
}
