import re

with open('hooks/use-auth.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_query_logic = '''    // Build query conditions
    // If a user has a role, their routes should ONLY be determined by their role.
    // If they have no role, their routes are determined by their entity (Company/Vendor).
    let q;
    if (profile.roleId) {
      q = query(
        collection(db, "access_paths"),
        where("roleId", "==", profile.roleId),
        where("status", "==", "active")
      )
    } else if (entityId) {
      q = query(
        collection(db, "access_paths"),
        where("entityId", "==", entityId),
        where("status", "==", "active")
      )
    } else {
      // Fallback (should be caught by the earlier !entityId && !profile.roleId check)
      setAllowedRoutes(new Set(["/admin"]))
      setAccessLoading(false)
      return
    }'''

new_query_logic = '''    // Build query conditions
    // We should fetch access paths for BOTH the user's role (if any) AND their entity (Company/Vendor)
    let q;
    if (profile.roleId && entityId) {
      q = query(
        collection(db, "access_paths"),
        or(
          where("roleId", "==", profile.roleId),
          where("entityId", "==", entityId)
        ),
        where("status", "==", "active")
      )
    } else if (profile.roleId) {
      q = query(
        collection(db, "access_paths"),
        where("roleId", "==", profile.roleId),
        where("status", "==", "active")
      )
    } else if (entityId) {
      q = query(
        collection(db, "access_paths"),
        where("entityId", "==", entityId),
        where("status", "==", "active")
      )
    } else {
      // Fallback
      setAllowedRoutes(new Set(["/admin"]))
      setAccessLoading(false)
      return
    }'''

content = content.replace(old_query_logic, new_query_logic)

old_match_logic = '''        const matchesUser = data.userId === profile.id
        const matchesRole = profile.roleId ? (data.roleId === profile.roleId) : false
        const matchesType = !profile.roleId && (data.userType === profile.userType && !data.userId && !data.roleId)'''

new_match_logic = '''        const matchesUser = data.userId === profile.id
        const matchesRole = profile.roleId ? (data.roleId === profile.roleId) : false
        // Allow type match (e.g. company_wide access) even if they have a role
        const matchesType = (data.userType === profile.userType && !data.userId && !data.roleId)'''

content = content.replace(old_match_logic, new_match_logic)

with open('hooks/use-auth.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
