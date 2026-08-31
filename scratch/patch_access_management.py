import re

with open('app/admin/access-management/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Entity interface
content = re.sub(
    r'interface Entity \{([^}]+)\}',
    r'interface Entity {\1\n  permissions?: Record<string, boolean>\n  entityId?: string | null\n}',
    content
)

# 2. Add selectedPermissions state, vendorFilter state
content = re.sub(
    r'const \[selectedEntity, setSelectedEntity\] = useState<Entity \| null>\(null\)',
    r'const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null)\n  const [selectedPermissions, setSelectedPermissions] = useState<Record<string, boolean>>({})\n  const [vendorFilter, setVendorFilter] = useState<string>("all")',
    content
)

# 3. filteredEntities update for roles
content = re.sub(
    r'if \(activeTab === "roles"\) list = roles\.map\(r => \(\{ id: r\.id, name: r\.name, key: r\.key \}\)\)',
    r'if (activeTab === "roles") list = roles.map(r => ({ id: r.id, name: r.name, key: r.key, permissions: r.permissions, entityId: r.entityId }))',
    content
)

# 4. In filteredEntities, apply vendor filter
content = re.sub(
    r'if \(!searchQuery\) return list',
    r'if (activeTab === "roles" && vendorFilter !== "all") list = list.filter(r => r.entityId === vendorFilter)\n    if (!searchQuery) return list',
    content
)

# 5. handleSelectEntity update
content = re.sub(
    r'setSelectedEntity\(entity\)\n      setHasChanges\(false\)',
    r'setSelectedEntity(entity)\n      setSelectedPermissions(entity.permissions || {})\n      setHasChanges(false)',
    content
)

# 6. handleSave update to save role permissions
content = re.sub(
    r'const userType = activeTab === "companies" \? "company_user" : "vendor_staff"',
    r'const userType = activeTab === "companies" ? "company_user" : "vendor_staff"\n\n    if (activeTab === "roles") {\n      try {\n        const { doc, updateDoc } = await import("firebase/firestore")\n        await updateDoc(doc(db, "roles", selectedEntity.id), { permissions: selectedPermissions })\n        setRoles(prev => prev.map(r => r.id === selectedEntity.id ? { ...r, permissions: selectedPermissions } : r))\n      } catch (err) {\n        console.error("Failed to update role permissions", err)\n      }\n    }',
    content
)

# 7. Add Checkbox UI in right panel (above Route Search)
checkboxes_ui = """
                {activeTab === "roles" && (
                  <div className="mt-4 p-4 border border-orange-200 rounded-md bg-white space-y-3">
                    <h3 className="text-sm font-semibold text-orange-900 mb-2">Role Permissions (Checkboxes)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        { key: "CAN_REQUEST_CHANGES", label: "Can Request Menu Changes" },
                        { key: "CAN_APPROVE_REQUESTS", label: "Can Approve Menu Updates" },
                        { key: "CAN_REQUEST_MEAL_PLAN_ASSIGNMENT", label: "Can Request Meal Plan Assignment" },
                        { key: "CAN_REQUEST_STRUCTURE_CHANGES", label: "Can Request Structure Updates" },
                        { key: "CAN_APPROVE_STRUCTURE_REQUESTS", label: "Can Approve Structure Updates" },
                        { key: "CAN_CUT_STRUCTURE_ITEMS", label: "Can Cut Structure Items" },
                        { key: "ALLOW_HO_ATTENDANCE", label: "Allow HO Attendance" }
                      ].map(perm => (
                        <div key={perm.key} className="flex items-center space-x-2 bg-gray-50 p-2 rounded border">
                          <Checkbox
                            id={`perm-${perm.key}`}
                            checked={!!selectedPermissions[perm.key]}
                            onCheckedChange={(checked) => {
                              setSelectedPermissions(prev => ({ ...prev, [perm.key]: !!checked }))
                              setHasChanges(true)
                            }}
                          />
                          <Label htmlFor={`perm-${perm.key}`} className="text-xs cursor-pointer">{perm.label}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
"""
content = re.sub(
    r'\{\/\* Route Search \*\/\}',
    checkboxes_ui + '\n                {/* Route Search */}',
    content
)

# 8. Add Vendor Filter dropdown in left panel
vendor_dropdown = """
              {activeTab === "roles" && (
                <div className="mb-2">
                  <Select value={vendorFilter} onValueChange={setVendorFilter}>
                    <SelectTrigger className="w-full h-8 text-xs">
                      <SelectValue placeholder="Filter by Vendor..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      {vendors.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
"""
content = re.sub(
    r'\{\/\* Search \*\/\}',
    vendor_dropdown + '\n              {/* Search */}',
    content
)

# add Select imports
content = re.sub(
    r'import \{ Checkbox \} from "@/components/ui/checkbox"',
    r'import { Checkbox } from "@/components/ui/checkbox"\nimport { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"',
    content
)

with open('app/admin/access-management/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched!")
