"use client"

import { useMemo, useState, useEffect } from "react"
import { useAuth } from "./use-auth"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"

export function useEntityScope() {
  const { userProfile, isSuperAdmin } = useAuth()
  const [assignedCompanyIds, setAssignedCompanyIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  // 1. Determine entity type and ID
  const entityType = userProfile?.userType || null
  const entityId = useMemo(() => {
    if (entityType === "vendor_staff") return userProfile?.vendorId || null
    if (entityType === "company_user") return userProfile?.companyIds?.[0] || null
    return null
  }, [entityType, userProfile])

  // 2. For Vendors: Fetch assigned companies from companies collection
  useEffect(() => {
    async function fetchAssignedCompanies() {
      if (entityType !== "vendor_staff" || !entityId) {
        setAssignedCompanyIds([])
        setLoading(false)
        return
      }

      try {
        const q = query(
          collection(db, "companies"),
          where("vendorIds", "array-contains", entityId)
        )
        const snap = await getDocs(q)
        const ids = snap.docs.map(doc => doc.id)
        setAssignedCompanyIds(ids)
      } catch (error) {
        console.error("Error fetching assigned companies:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchAssignedCompanies()
  }, [entityType, entityId])

  // 3. Helper: Filter data based on scope
  const filterByScope = <T extends any>(data: T[], vendorIdField = "vendorId", companyIdField = "companyId"): T[] => {
    if (isSuperAdmin) return data

    if (entityType === "vendor_staff") {
      // Vendors see only their own created items OR unassigned items
      return data.filter((item: any) => item[vendorIdField] === entityId || !item[vendorIdField])
    }

    if (entityType === "company_user") {
      // Companies see only their own company's data
      return data.filter((item: any) => userProfile?.companyIds?.includes(item[companyIdField]))
    }

    return []
  }

  // 4. Helper: Inject entity IDs into new records
  const injectEntityId = (data: any) => {
    const payload = { ...data }
    if (entityType === "vendor_staff") {
      payload.vendorId = entityId
    } else if (entityType === "company_user") {
      payload.companyId = entityId
    }
    return payload
  }

  return {
    entityType,
    entityId,
    assignedCompanyIds,
    isSuperAdmin,
    loading: loading && !isSuperAdmin && entityType === "vendor_staff",
    filterByScope,
    injectEntityId,
    userProfile
  }
}
