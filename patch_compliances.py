import re

with open('app/admin/compliances/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add cafeterias to state
if 'const [cafeterias, setCafeterias] = useState<any[]>([])' not in content:
    content = content.replace(
        'const [buildings, setBuildings] = useState<any[]>([])',
        'const [buildings, setBuildings] = useState<any[]>([])\n  const [cafeterias, setCafeterias] = useState<any[]>([])'
    )

# 2. Add new filters to state
if 'const [filterCompany, setFilterCompany] = useState("all")' not in content:
    content = content.replace(
        'const [filterVendor, setFilterVendor] = useState("all")',
        'const [filterVendor, setFilterVendor] = useState("all")\n  const [filterCompany, setFilterCompany] = useState("all")\n  const [filterBuilding, setFilterBuilding] = useState("all")\n  const [filterCafeteria, setFilterCafeteria] = useState("all")'
    )

# 3. Fetch cafeterias in fetchInitialData
if "getDocs(collection(db, 'cafetarias'))" not in content:
    content = content.replace(
        "getDocs(collection(db, 'buildings')),",
        "getDocs(collection(db, 'buildings')),\n        getDocs(collection(db, 'cafetarias')),"
    )
    content = content.replace(
        "setBuildings(bSnap.docs.map(d => ({ id: d.id, ...d.data() })))",
        "setBuildings(bSnap.docs.map(d => ({ id: d.id, ...d.data() })))\n      setCafeterias(arguments[0][8].docs.map(d => ({ id: d.id, ...d.data() })))"
    )
    # Actually wait, arguments[0][8] won't work in JS like that because it's in a Promise.all destructuring.
    # Let's fix the Promise.all destructuring instead:
    pass

# We will just rewrite the fetchInitialData Promise.all block completely to avoid index issues.
old_promise = '''      const [
        templatesRes,
        formsRes,
        recentRecords,
        pendingRecords,
        vSnap,
        cSnap,
        bSnap,
        rSnap,
      ] = await Promise.all([
        complianceTemplatesService.getAll().catch(() => []),
        complianceFormsService.getAll().catch(() => []),
        complianceRecordsService.getRecent(50).catch(() => []),
        complianceRecordsService.getPending().catch(() => []),
        getDocs(collection(db, 'vendors')),
        getDocs(collection(db, 'companies')),
        getDocs(collection(db, 'buildings')),
        getDocs(collection(db, 'roles')),
      ])'''
      
new_promise = '''      const [
        templatesResFetch,
        formsRes,
        recentRecords,
        pendingRecords,
        vSnap,
        cSnap,
        bSnap,
        rSnap,
        cafeSnap,
      ] = await Promise.all([
        complianceTemplatesService.getAll().catch(() => []),
        complianceFormsService.getAll().catch(() => []),
        complianceRecordsService.getRecent(50).catch(() => []),
        complianceRecordsService.getPending().catch(() => []),
        getDocs(collection(db, 'vendors')),
        getDocs(collection(db, 'companies')),
        getDocs(collection(db, 'buildings')),
        getDocs(collection(db, 'roles')),
        getDocs(collection(db, 'cafetarias')),
      ])
      let templatesRes = templatesResFetch;
      setCafeterias(cafeSnap.docs.map(d => ({ id: d.id, ...d.data() })))'''

if old_promise in content:
    content = content.replace(old_promise, new_promise)

# 4. Update filteredTemplates
old_filtered = '''  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      const matchesSearch = !search || t.name.toLowerCase().includes(search.toLowerCase())
      const matchesType = filterType === 'all' || t.type === filterType
      const matchesVendor = filterVendor === 'all' || t.vendorId === filterVendor
      return matchesSearch && matchesType && matchesVendor
    })
  }, [templates, search, filterType, filterVendor])'''

new_filtered = '''  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      const matchesSearch = !search || t.name.toLowerCase().includes(search.toLowerCase())
      const matchesType = filterType === 'all' || t.type === filterType
      const matchesVendor = filterVendor === 'all' || t.vendorId === filterVendor
      const matchesCompany = filterCompany === 'all' || t.companyId === filterCompany
      const matchesBuilding = filterBuilding === 'all' || t.buildingId === filterBuilding
      const matchesCafeteria = filterCafeteria === 'all' || t.cafetariaId === filterCafeteria
      return matchesSearch && matchesType && matchesVendor && matchesCompany && matchesBuilding && matchesCafeteria
    })
  }, [templates, search, filterType, filterVendor, filterCompany, filterBuilding, filterCafeteria])'''

if old_filtered in content:
    content = content.replace(old_filtered, new_filtered)

# 5. Update the UI block
old_ui_start = "{/* ═══════════════ TEMPLATES TAB ═══════════════ */}"
old_ui_end_index = content.find("{/* ═══════════════ RECORDS TAB ═══════════════ */}")

if old_ui_end_index != -1 and old_ui_start in content:
    start_idx = content.find(old_ui_start)
    
    new_ui = '''{/* ═══════════════ TEMPLATES TAB ═══════════════ */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 bg-gray-50 p-4 rounded-lg border">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input placeholder="Search templates..." className="pl-9 bg-white" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(TEMPLATE_TYPE_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterVendor} onValueChange={setFilterVendor}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="All Vendors" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors</SelectItem>
                {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterCompany} onValueChange={(v) => { setFilterCompany(v); setFilterBuilding("all"); setFilterCafeteria("all"); }}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="All Companies" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterBuilding} onValueChange={(v) => { setFilterBuilding(v); setFilterCafeteria("all"); }} disabled={filterCompany === "all"}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="All Buildings" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Buildings</SelectItem>
                {buildings.filter(b => b.companyId === filterCompany).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Templates Table */}
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading templates...</div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg bg-white">
              <ListChecks className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No templates found.</p>
              <p className="text-gray-400 text-sm mt-1">Create your first compliance template to get started.</p>
              <Link href="/admin/compliances/new">
                <Button className="mt-4"><Plus className="mr-2 h-4 w-4" /> Create Template</Button>
              </Link>
            </div>
          ) : (
            <div className="rounded-md border bg-white shadow-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead>Template Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Assignments</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTemplates.map(template => {
                    const cfg = TEMPLATE_TYPE_CONFIG[template.type] || TEMPLATE_TYPE_CONFIG.general_checklist
                    const Icon = cfg.icon
                    return (
                      <TableRow key={template.id} className={template.status === 'inactive' ? 'opacity-60 bg-gray-50/50' : ''}>
                        <TableCell>
                          <div className="font-medium text-sm text-gray-900">{template.name}</div>
                          <div className="text-[10px] text-gray-500">{cfg.description}</div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] gap-1 ${cfg.bgColor} ${cfg.color} border ${cfg.borderColor}`}>
                            <Icon className="h-3 w-3" />
                            {cfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {template.vendorId && <Badge variant="outline" className="text-[10px] gap-1"><Building2 className="h-2.5 w-2.5" />{getName(vendors, template.vendorId)}</Badge>}
                            {template.companyId && <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700">{getName(companies, template.companyId)}</Badge>}
                            {template.buildingId && <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700">{getName(buildings, template.buildingId)}</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] capitalize bg-gray-50">{template.frequency.replace('_', ' ')}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={template.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                            {template.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/admin/compliances/${template.id}`}>
                              <Button variant="ghost" size="sm" className="h-8 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2">
                                <Pencil className="h-3 w-3 mr-1" /> Edit
                              </Button>
                            </Link>
                            <Button variant="ghost" size="sm" className="h-8 text-xs px-2" onClick={() => handleToggleTemplateStatus(template)}>
                              {template.status === 'active' ? <Ban className="h-3 w-3 mr-1 text-orange-500" /> : <CheckCircle className="h-3 w-3 mr-1 text-green-500" />}
                              {template.status === 'active' ? 'Disable' : 'Enable'}
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 text-xs text-red-600 hover:bg-red-50 px-2" onClick={() => handleDeleteTemplate(template.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      '''
    
    content = content[:start_idx] + new_ui + content[old_ui_end_index:]

with open('app/admin/compliances/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Compliances page patch successful!")
