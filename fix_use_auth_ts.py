import re

with open('hooks/use-auth.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix import error (remove resolveUserProfile from import)
content = content.replace('import { resolveUserProfile } from "@/lib/firestore/usersService"\n', '')

old_query_logic = '''    // Build query conditions
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

new_query_logic = '''    // Build query conditions
    // Prioritize entityId (Company/Vendor) for access paths over roleId.
    // In the UI, company access paths are assigned to the company, not the role.
    let q;
    if (entityId) {
      q = query(
        collection(db, "access_paths"),
        where("entityId", "==", entityId),
        where("status", "==", "active")
      )
    } else if (profile.roleId) {
      q = query(
        collection(db, "access_paths"),
        where("roleId", "==", profile.roleId),
        where("status", "==", "active")
      )
    } else {
      // Fallback
      setAllowedRoutes(new Set(["/admin"]))
      setAccessLoading(false)
      return
    }'''

content = content.replace(old_query_logic, new_query_logic)

with open('hooks/use-auth.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
