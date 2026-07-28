import re

with open('app/admin/qr-links/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix Create Modal Footer nesting
bad_create_close = '''              <CustomizationFields data={customization} onChange={setCustomization} />
            </div>
                </div>
                </div>
                <div className="p-4 border-t border-slate-100 bg-slate-50 mt-auto sticky bottom-0 z-10 flex justify-end gap-2">'''
good_create_close = '''              <CustomizationFields data={customization} onChange={setCustomization} />
            </div>
          </div>
          <div className="p-4 border-t border-slate-100 bg-slate-50 mt-auto sticky bottom-0 z-10 flex justify-end gap-2">'''
content = content.replace(bad_create_close, good_create_close)


# Fix Edit Modal Footer nesting
bad_edit_close = '''              <CustomizationFields data={editCustomization} onChange={setEditCustomization} />


                  </div>
                </div>
                <div className="p-4 border-t border-slate-100 bg-slate-50 mt-auto sticky bottom-0 z-10 flex justify-end gap-2">'''
good_edit_close = '''              <CustomizationFields data={editCustomization} onChange={setEditCustomization} />
            </div>
          </div>
          <div className="p-4 border-t border-slate-100 bg-slate-50 mt-auto sticky bottom-0 z-10 flex justify-end gap-2">'''
content = content.replace(bad_edit_close, good_edit_close)


# Fix missing editLink closing tags
bad_edit_end = '''                 <ReportPreview 
                   customization={editCustomization}
                   companyName={companies.find(c => c.id === editSelectedCompanyId)?.name}
                   buildingName={buildings.find(b => b.id === editSelectedBuildingId)?.name}
                   cafeName={cafeterias.find(c => c.id === editSelectedCafeId)?.name}
                 />
              </div>

        </DialogContent>'''
good_edit_end = '''                 <ReportPreview 
                   customization={editCustomization}
                   companyName={companies.find(c => c.id === editSelectedCompanyId)?.name}
                   buildingName={buildings.find(b => b.id === editSelectedBuildingId)?.name}
                   cafeName={cafeterias.find(c => c.id === editSelectedCafeId)?.name}
                 />
              </div>
            </div>
          )}
        </DialogContent>'''
content = content.replace(bad_edit_end, good_edit_end)


with open('app/admin/qr-links/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
