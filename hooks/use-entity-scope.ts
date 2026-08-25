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

      // If the vendor staff (KAM/Supervisor) is explicitly assigned to specific companies, restrict to those.
      if (userProfile && userProfile.companyIds && userProfile.companyIds.length > 0) {
        setAssignedCompanyIds(userProfile.companyIds)
        setLoading(false)
        return
      }

      // Otherwise (Vendor Admin), fetch all companies assigned to the vendor
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
  }, [entityType, entityId, userProfile])

  // 3. Helper: Filter data based on scope
  const filterByScope = <T extends any>(data: T[], vendorIdField = "vendorId", companyIdField = "companyId"): T[] => {
    if (isSuperAdmin) return data

    if (entityType === "vendor_staff") {
      return data.filter((item: any) => {
        // 1. Check vendor ownership (if the record supports it)
        const isMyVendorData = item[vendorIdField] === entityId || !item[vendorIdField]
        
        // 2. If the record belongs to a company, strictly ensure the vendor is assigned to that company
        if (item[companyIdField]) {
          const isAssigned = assignedCompanyIds.includes(item[companyIdField])
          console.log(`DEBUG [ScopeFilter]: Checking record companyId: ${item[companyIdField]} against assignedCompanyIds:`, assignedCompanyIds, `Result: ${isAssigned}`);
          return isMyVendorData && isAssigned;
        }
        
        return isMyVendorData
      })
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
