import re

with open('app/admin/qr-links/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add Edit states
edit_states = '''  const [editRequireEmployeeId, setEditRequireEmployeeId] = useState(false)
  const [editSelectedCompanyId, setEditSelectedCompanyId] = useState<string>("")
  const [editSelectedBuildingId, setEditSelectedBuildingId] = useState<string>("")
  const [editSelectedCafeId, setEditSelectedCafeId] = useState<string>("")'''
content = content.replace('  const [editRequireEmployeeId, setEditRequireEmployeeId] = useState(false)', edit_states)

# 2. openEditModal
open_edit_modal = '''    setEditCustomization(link.customization || initialCustomization)
    setEditSelectedCompanyId(link.companyId)
    setEditSelectedBuildingId(link.buildingId)
    setEditSelectedCafeId(link.cafeId)
    setEditModalOpen(true)'''
content = content.replace('    setEditCustomization(link.customization || initialCustomization)\n    setEditModalOpen(true)', open_edit_modal)

# 3. filtered arrays
filtered_arrays = '''  const filteredBuildings = buildings.filter(b => b.companyId === selectedCompanyId)
  const filteredCafes = cafeterias.filter(c => c.buildingId === selectedBuildingId || c.companyId === selectedCompanyId)

  const filteredEditBuildings = buildings.filter(b => b.companyId === editSelectedCompanyId)
  const filteredEditCafes = cafeterias.filter(c => c.buildingId === editSelectedBuildingId || c.companyId === editSelectedCompanyId)
'''
content = content.replace('  const filteredBuildings = buildings.filter(b => b.companyId === selectedCompanyId)\n  const filteredCafes = cafeterias.filter(c => c.buildingId === selectedBuildingId || c.companyId === selectedCompanyId)', filtered_arrays)


# 4. handleSaveEdit
save_edit = '''  const handleSaveEdit = async () => {
    if (!editLink) return
    if (!editSelectedCompanyId || !editSelectedBuildingId || !editSelectedCafeId) {
      toast({ title: "Missing fields", description: "Please select Company, Building, and Cafe.", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const company = companies.find(c => c.id === editSelectedCompanyId)
      const building = buildings.find(b => b.id === editSelectedBuildingId)
      const cafe = cafeterias.find(c => c.id === editSelectedCafeId)

      await qrLinksService.update(editLink.id, {
        companyId: company!.id,
        companyName: company!.name,
        buildingId: building!.id,
        buildingName: building!.name,
        cafeId: cafe!.id,
        cafeName: cafe!.name,
        requireName: editRequireName,
        requireEmail: editRequireEmail,
        requireEmployeeId: editRequireEmployeeId,
        customization: editCustomization
      })
      toast({ title: "Saved!", description: "Field settings updated successfully." })
      setEditModalOpen(false)
      setEditLink(null)
      // Update local state immediately for instant feedback
      setLinks(prev => prev.map(l => l.id === editLink.id
        ? { ...l, companyId: company!.id, companyName: company!.name, buildingId: building!.id, buildingName: building!.name, cafeId: cafe!.id, cafeName: cafe!.name, requireName: editRequireName, requireEmail: editRequireEmail, requireEmployeeId: editRequireEmployeeId, customization: editCustomization }
        : l
      ))
    } catch (e) {'''

content = content.replace('''  const handleSaveEdit = async () => {
    if (!editLink) return
    setSaving(true)
    try {
      await qrLinksService.update(editLink.id, {
        requireName: editRequireName,
        requireEmail: editRequireEmail,
        requireEmployeeId: editRequireEmployeeId,
        customization: editCustomization
      })
      toast({ title: "Saved!", description: "Field settings updated successfully." })
      setEditModalOpen(false)
      setEditLink(null)
      // Update local state immediately for instant feedback
      setLinks(prev => prev.map(l => l.id === editLink.id
        ? { ...l, requireName: editRequireName, requireEmail: editRequireEmail, requireEmployeeId: editRequireEmployeeId, customization: editCustomization }
        : l
      ))
    } catch (e) {''', save_edit)


# 5. UI elements in Modal
ui_context = '''              {/* Link context */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-1">
                <p className="font-bold text-slate-800 text-base">{editLink.cafeName}</p>
                <p className="text-sm text-slate-500 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  {editLink.companyName} · {editLink.buildingName}
                </p>
              </div>'''

ui_edit_fields = '''              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Select value={editSelectedCompanyId} onValueChange={setEditSelectedCompanyId}>
                    <SelectTrigger><SelectValue placeholder="Select Company" /></SelectTrigger>
                    <SelectContent>
                      {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Building</Label>
                  <Select value={editSelectedBuildingId} onValueChange={setEditSelectedBuildingId} disabled={!editSelectedCompanyId}>
                    <SelectTrigger><SelectValue placeholder="Select Building" /></SelectTrigger>
                    <SelectContent>
                      {filteredEditBuildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cafe / Location</Label>
                  <Select value={editSelectedCafeId} onValueChange={setEditSelectedCafeId} disabled={!editSelectedBuildingId}>
                    <SelectTrigger><SelectValue placeholder="Select Cafe" /></SelectTrigger>
                    <SelectContent>
                      {filteredEditCafes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <CustomizationFields data={editCustomization} onChange={setEditCustomization} />'''

content = content.replace(ui_context, ui_edit_fields)

# Let's remove the second occurrence of <CustomizationFields data={editCustomization} onChange={setEditCustomization} /> which is further down in the edit modal, as I just added it to the top part.
# Wait, let me check if there was a CustomizationFields already there in Edit Modal. Yes, the previous patch added it.
# Let's see the previous patch's output or just assume I need to remove it from where it was.
# Ah, I don't need to replace it like this. I can just replace the Link context block and let the existing CustomizationFields stay where it is.
ui_edit_fields_without_customization = '''              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Select value={editSelectedCompanyId} onValueChange={setEditSelectedCompanyId}>
                    <SelectTrigger><SelectValue placeholder="Select Company" /></SelectTrigger>
                    <SelectContent>
                      {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Building</Label>
                  <Select value={editSelectedBuildingId} onValueChange={setEditSelectedBuildingId} disabled={!editSelectedCompanyId}>
                    <SelectTrigger><SelectValue placeholder="Select Building" /></SelectTrigger>
                    <SelectContent>
                      {filteredEditBuildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cafe / Location</Label>
                  <Select value={editSelectedCafeId} onValueChange={setEditSelectedCafeId} disabled={!editSelectedBuildingId}>
                    <SelectTrigger><SelectValue placeholder="Select Cafe" /></SelectTrigger>
                    <SelectContent>
                      {filteredEditCafes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>'''
content = content.replace(ui_edit_fields, ui_edit_fields_without_customization) # if the first replacement didn't match, this does nothing
# Wait, let's just do it properly.

with open('app/admin/qr-links/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Edit modal fields patched.")
