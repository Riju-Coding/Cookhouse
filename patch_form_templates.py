import re

with open('app/admin/form-templates/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add useAuth import
if 'import { useAuth }' not in content:
    content = content.replace(
        'import { toast } from "@/hooks/use-toast"',
        'import { toast } from "@/hooks/use-toast"\nimport { useAuth } from "@/hooks/use-auth"'
    )

# Add useAuth hook and filter states to component
if 'const { userProfile, userType } = useAuth()' not in content:
    content = content.replace(
        'export default function FormTemplatesPage() {',
        'export default function FormTemplatesPage() {\n  const { userProfile, userType } = useAuth()\n  const [selectedCompanyId, setSelectedCompanyId] = useState("all")\n  const [selectedBuildingId, setSelectedBuildingId] = useState("all")\n  const [selectedCafeteriaId, setSelectedCafeteriaId] = useState("all")'
    )

# Update fetchInitialData for data isolation
old_fetch = '''      const [
        formsRes,
        companiesSnap,
        buildingsSnap,
        cafeteriasSnap,
        areasSnap,
        vendorsSnap
      ] = await Promise.all([
        complianceFormsService.getAll(),
        getDocs(collection(db, 'companies')),
        getDocs(collection(db, 'buildings')),
        getDocs(collection(db, 'cafetarias')),
        getDocs(collection(db, 'areas')),
        getDocs(collection(db, 'vendors')),
      ])

      setForms(formsRes)
      setCompanies(companiesSnap.docs.map(d => ({ id: d.id, ...d.data() })))'''

new_fetch = '''      let [
        formsRes,
        companiesSnap,
        buildingsSnap,
        cafeteriasSnap,
        areasSnap,
        vendorsSnap
      ] = await Promise.all([
        complianceFormsService.getAll(),
        getDocs(collection(db, 'companies')),
        getDocs(collection(db, 'buildings')),
        getDocs(collection(db, 'cafetarias')),
        getDocs(collection(db, 'areas')),
        getDocs(collection(db, 'vendors')),
      ])

      let companiesData = companiesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      let formsData = formsRes

      // --- DATA ISOLATION ---
      if (userProfile?.companyIds?.length) {
        companiesData = companiesData.filter(c => userProfile.companyIds.includes(c.id))
        formsData = formsData.filter(f => !f.companyId || userProfile.companyIds.includes(f.companyId))
      }
      
      if (userProfile?.vendorId) {
        companiesData = companiesData.filter(c => (c as any).vendorIds?.includes(userProfile.vendorId))
        formsData = formsData.filter(f => f.vendorId === userProfile.vendorId)
      }

      setForms(formsData)
      setCompanies(companiesData)'''

if old_fetch in content:
    content = content.replace(old_fetch, new_fetch)

# Replace the Card based rendering with Table + Filters
old_ui_start = '<div className="space-y-3">'
old_ui_end_index = content.find('{/* Form Modal */}')
if old_ui_end_index != -1 and old_ui_start in content:
    start_idx = content.find(old_ui_start)
    
    new_ui = '''
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg border">
        <div>
          <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Company</Label>
          <Select value={selectedCompanyId} onValueChange={(v) => { setSelectedCompanyId(v); setSelectedBuildingId("all"); setSelectedCafeteriaId("all"); }}>
            <SelectTrigger className="bg-white"><SelectValue placeholder="All Companies" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Companies</SelectItem>
              {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Building</Label>
          <Select value={selectedBuildingId} onValueChange={(v) => { setSelectedBuildingId(v); setSelectedCafeteriaId("all"); }} disabled={selectedCompanyId === "all"}>
            <SelectTrigger className="bg-white"><SelectValue placeholder="All Buildings" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Buildings</SelectItem>
              {buildings.filter(b => b.companyId === selectedCompanyId).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Cafeteria</Label>
          <Select value={selectedCafeteriaId} onValueChange={setSelectedCafeteriaId} disabled={selectedBuildingId === "all"}>
            <SelectTrigger className="bg-white"><SelectValue placeholder="All Cafeterias" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cafeterias</SelectItem>
              {cafeterias.filter(c => c.buildingId === selectedBuildingId).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Form Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Assignments</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {forms.filter(f => {
              if (selectedCompanyId !== "all" && f.companyId !== selectedCompanyId) return false;
              if (selectedBuildingId !== "all" && f.buildingId !== selectedBuildingId) return false;
              if (selectedCafeteriaId !== "all" && f.cafetariaId !== selectedCafeteriaId) return false;
              return true;
            }).length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-gray-500">No form templates found matching filters.</TableCell>
              </TableRow>
            ) : forms.filter(f => {
              if (selectedCompanyId !== "all" && f.companyId !== selectedCompanyId) return false;
              if (selectedBuildingId !== "all" && f.buildingId !== selectedBuildingId) return false;
              if (selectedCafeteriaId !== "all" && f.cafetariaId !== selectedCafeteriaId) return false;
              return true;
            }).map(form => (
              <React.Fragment key={form.id}>
                <TableRow className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleFormExpand(form.id)}>
                  <TableCell>
                    {expandedFormId === form.id ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </TableCell>
                  <TableCell className="font-medium text-gray-900">{form.name}</TableCell>
                  <TableCell>
                    <Badge variant={form.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                      {form.status === 'active' ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize">{form.frequency}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {form.vendorId && <Badge variant="outline" className="text-xs">Vendor: {vendors.find(v => v.id === form.vendorId)?.name || 'Unknown'}</Badge>}
                      {form.companyId && <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">Company: {getCompanyName(form.companyId)}</Badge>}
                      {form.buildingId && <Badge variant="outline" className="text-xs bg-green-50 text-green-700">Building: {getBuildingName(form.buildingId)}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" className="text-blue-600 hover:bg-blue-50 h-8 w-8 p-0" onClick={() => handleEditForm(form)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 h-8 w-8 p-0" onClick={() => handleDeleteForm(form.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {expandedFormId === form.id && (
                  <TableRow className="bg-gray-50/50">
                    <TableCell colSpan={6} className="p-0 border-b">
                      <div className="p-6">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="font-semibold text-gray-700 text-sm">Questions List ({subForms.filter(s => s.formId === form.id).length})</h4>
                          <Button size="sm" className="bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 h-8" variant="outline" onClick={() => {
                            setSubFormData({ ...initialSubFormState, formId: form.id, order: subForms.filter(s => s.formId === form.id).length });
                            setEditingSubFormId(null);
                            setIsSubFormModalOpen(true);
                          }}>
                            <Plus className="w-3 h-3 mr-1" /> Add Question
                          </Button>
                        </div>
                        
                        {isFetching ? (
                          <div className="flex items-center justify-center py-4"><Spinner className="h-5 w-5 mr-2" /><span className="text-sm text-gray-600">Loading questions...</span></div>
                        ) : subForms.filter(s => s.formId === form.id).length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-4 border rounded bg-white">No questions added yet</p>
                        ) : (
                          <div className="space-y-2">
                            {subForms.filter(s => s.formId === form.id).map((subForm, index) => (
                              <div key={subForm.id} className="flex justify-between items-start p-3 bg-white rounded border hover:border-gray-300 transition-colors">
                                <div className="flex-1">
                                  <div className="flex items-start gap-2">
                                    <span className="text-xs font-semibold text-gray-500 bg-gray-100 rounded-full w-5 h-5 flex items-center justify-center mt-0.5">{index + 1}</span>
                                    <p className="text-sm font-medium text-gray-900">{subForm.question}</p>
                                  </div>
                                  <div className="flex gap-2 mt-2 ml-7 flex-wrap">
                                    <Badge variant="outline" className="text-[10px] uppercase bg-gray-50 text-gray-600">{subForm.type.replace('_', ' ')}</Badge>
                                    {subForm.isRequired && <Badge className="text-[10px] uppercase bg-red-50 text-red-700 border-red-200 hover:bg-red-50">Required</Badge>}
                                    {subForm.isPhotoRequired && <Badge className="text-[10px] uppercase bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-50">Photo Required</Badge>}
                                  </div>
                                </div>
                                <div className="flex gap-1 ml-2">
                                  <Button size="sm" variant="ghost" className="text-blue-600 hover:bg-blue-50 h-7 w-7 p-0" onClick={() => handleEditSubForm(subForm)}><Pencil className="w-3 h-3" /></Button>
                                  <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 h-7 w-7 p-0" onClick={() => handleDeleteSubForm(subForm.id)}><Trash2 className="w-3 h-3" /></Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      '''
    
    content = content[:start_idx] + new_ui + content[old_ui_end_index:]

with open('app/admin/form-templates/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Form Templates patch successful!")
