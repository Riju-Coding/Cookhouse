import re

with open('app/admin/qr-links/page.tsx', 'r', encoding='utf-8') as f:
    admin_content = f.read()

# 1. Add import for ReportPreview
if 'import ReportPreview from' not in admin_content:
    admin_content = admin_content.replace('import { QrCode, Building2, Download, Trash2, Settings2, Plus, Copy, Check, Eye, Pencil, User, Mail, IdCard, Loader2 } from "lucide-react"',
                                          'import { QrCode, Building2, Download, Trash2, Settings2, Plus, Copy, Check, Eye, Pencil, User, Mail, IdCard, Loader2 } from "lucide-react"\nimport ReportPreview from "./ReportPreview"')

# 2. Add Reporting Issue At defaults
init_custom = '''const initialCustomization = {
  headerText: "Facility Feedback",
  showHeader: true,
  showReportingIssueAt: true,
  reportingIssueAtText: "Reporting issue at",
  showFeedbackFormHeader: true,
  showFeedbackFormSubHeader: true,'''
admin_content = admin_content.replace('''const initialCustomization = {
  headerText: "Facility Feedback",
  showHeader: true,
  showFeedbackFormHeader: true,
  showFeedbackFormSubHeader: true,''', init_custom)

# 3. Add Reporting Issue At to CustomizationFields
fields_replacement = '''        <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
          <span className="text-sm">Main Header Text (Top Navbar)</span>
          <ToggleSwitch enabled={data.showHeader !== false} onChange={v => onChange({...data, showHeader: v})} />
        </div>
        {data.showHeader !== false && (
          <Input 
            value={data.headerText} 
            onChange={e => onChange({...data, headerText: e.target.value})} 
            placeholder="Facility Feedback" 
          />
        )}
        
        <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
          <span className="text-sm">"Reporting issue at" Text</span>
          <ToggleSwitch enabled={data.showReportingIssueAt !== false} onChange={v => onChange({...data, showReportingIssueAt: v})} />
        </div>
        {data.showReportingIssueAt !== false && (
          <Input 
            value={data.reportingIssueAtText || "Reporting issue at"} 
            onChange={e => onChange({...data, reportingIssueAtText: e.target.value})} 
            placeholder="Reporting issue at" 
          />
        )}'''

admin_content = admin_content.replace('''        <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
          <span className="text-sm">Main Header Text (Top Navbar)</span>
          <ToggleSwitch enabled={data.showHeader !== false} onChange={v => onChange({...data, showHeader: v})} />
        </div>
        {data.showHeader !== false && (
          <Input 
            value={data.headerText} 
            onChange={e => onChange({...data, headerText: e.target.value})} 
            placeholder="Facility Feedback" 
          />
        )}''', fields_replacement)

# 4. Modify Create Modal layout
# DialogContent -> DialogContent className="max-w-5xl"
create_dialog_old = '<DialogContent>'
create_dialog_new = '<DialogContent className="max-w-5xl p-0 overflow-hidden bg-gray-50">'
admin_content = admin_content.replace(create_dialog_old, create_dialog_new)

# Modify layout for Create modal
create_modal_inner_old = '''            <DialogHeader>
              <DialogTitle>Generate New QR Link</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">'''

create_modal_inner_new = '''            <div className="flex h-[80vh] w-full">
              {/* Left Side: Form Controls */}
              <div className="w-1/2 border-r border-slate-200 bg-white overflow-y-auto custom-scrollbar flex flex-col">
                <div className="p-6">
                  <DialogHeader className="mb-6">
                    <DialogTitle className="text-xl">Generate New QR Link</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">'''
admin_content = admin_content.replace(create_modal_inner_old, create_modal_inner_new)

# Footer for Create Modal
create_footer_old = '''            <DialogFooter>
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={creating || !selectedCompanyId || !selectedBuildingId || !selectedCafeId}>
                {creating ? "Generating..." : "Generate"}
              </Button>
            </DialogFooter>
          </DialogContent>'''

create_footer_new = '''                </div>
                </div>
                <div className="p-4 border-t border-slate-100 bg-slate-50 mt-auto sticky bottom-0 z-10 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreate} disabled={creating || !selectedCompanyId || !selectedBuildingId || !selectedCafeId}>
                    {creating ? "Generating..." : "Generate"}
                  </Button>
                </div>
              </div>
              
              {/* Right Side: Live Preview */}
              <div className="w-1/2 bg-slate-50 flex items-center justify-center p-6 overflow-hidden relative">
                 <div className="absolute top-4 left-4 flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                   <Eye className="w-3 h-3" /> Live Preview
                 </div>
                 <ReportPreview 
                   customization={customization}
                   companyName={companies.find(c => c.id === selectedCompanyId)?.name}
                   buildingName={buildings.find(b => b.id === selectedBuildingId)?.name}
                   cafeName={cafeterias.find(c => c.id === selectedCafeId)?.name}
                 />
              </div>
            </div>
          </DialogContent>'''
admin_content = admin_content.replace(create_footer_old, create_footer_new)

# 5. Modify Edit Modal layout
edit_dialog_old = '<DialogContent className="max-w-md">'
edit_dialog_new = '<DialogContent className="max-w-5xl p-0 overflow-hidden bg-gray-50">'
admin_content = admin_content.replace(edit_dialog_old, edit_dialog_new)

edit_modal_inner_old = '''          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Settings2 className="w-5 h-5 text-blue-600" />
              Edit Form Fields
            </DialogTitle>
          </DialogHeader>

          {editLink && (
            <div className="py-4 space-y-6">'''
edit_modal_inner_new = '''          {editLink && (
            <div className="flex h-[80vh] w-full">
              {/* Left Side: Form Controls */}
              <div className="w-1/2 border-r border-slate-200 bg-white overflow-y-auto custom-scrollbar flex flex-col">
                <div className="p-6">
                  <DialogHeader className="mb-6">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                      <Settings2 className="w-5 h-5 text-blue-600" />
                      Edit Form Fields
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6">'''
admin_content = admin_content.replace(edit_modal_inner_old, edit_modal_inner_new)

edit_footer_old = '''          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditModalOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving} className="gap-2 bg-blue-600 hover:bg-blue-700">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>'''
edit_footer_new = '''                  </div>
                </div>
                <div className="p-4 border-t border-slate-100 bg-slate-50 mt-auto sticky bottom-0 z-10 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditModalOpen(false)} disabled={saving}>Cancel</Button>
                  <Button onClick={handleSaveEdit} disabled={saving} className="gap-2 bg-blue-600 hover:bg-blue-700">
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : "Save Changes"}
                  </Button>
                </div>
              </div>
              
              {/* Right Side: Live Preview */}
              <div className="w-1/2 bg-slate-50 flex items-center justify-center p-6 overflow-hidden relative">
                 <div className="absolute top-4 left-4 flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                   <Eye className="w-3 h-3" /> Live Preview
                 </div>
                 <ReportPreview 
                   customization={editCustomization}
                   companyName={companies.find(c => c.id === editSelectedCompanyId)?.name}
                   buildingName={buildings.find(b => b.id === editSelectedBuildingId)?.name}
                   cafeName={cafeterias.find(c => c.id === editSelectedCafeId)?.name}
                 />
              </div>
            </div>
          )}
        </DialogContent>'''
admin_content = admin_content.replace(edit_footer_old, edit_footer_new)
# Note: we replaced {editLink && ( ... )} but we didn't remove the closing `)}` above DialogFooter.
# Ah wait! The original code has `)}` right before DialogFooter. Let's fix that cleanly.
admin_content = admin_content.replace('''            </div>
          )}''', '') # Strip the old closing bracket first

with open('app/admin/qr-links/page.tsx', 'w', encoding='utf-8') as f:
    f.write(admin_content)
