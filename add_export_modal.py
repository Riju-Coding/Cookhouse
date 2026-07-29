import re

def update_file():
    with open('app/admin/ticketing/page.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Revert the UI inputs for Start/End Date from the main filters
    ui_inputs_regex = r'<div className="w-full md:w-\[150px\] space-y-1\.5">\s*<label className="text-xs font-semibold text-gray-500 uppercase">Start Date</label>\s*<Input type="date" value=\{startDate\} onChange=\{e => setStartDate\(e\.target\.value\)\} />\s*</div>\s*<div className="w-full md:w-\[150px\] space-y-1\.5">\s*<label className="text-xs font-semibold text-gray-500 uppercase">End Date</label>\s*<Input type="date" value=\{endDate\} onChange=\{e => setEndDate\(e\.target\.value\)\} />\s*</div>'
    content = re.sub(ui_inputs_regex, '', content)

    # 2. Remove startDate / endDate from filteredTickets
    filtered_tickets_logic_regex = r'const ticketDate = t\.createdAt\.toDate\(\)\s*if \(startDate\) \{[\s\S]*?if \(ticketDate > end\) return false\s*\}'
    content = re.sub(filtered_tickets_logic_regex, '', content)
    
    # Remove state if existing
    content = re.sub(r'const \[startDate, setStartDate\] = useState\(""\)\s*const \[endDate, setEndDate\] = useState\(""\)', '', content)

    # 3. Add Export Modal States
    state_insert = '''  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [exportTimeframe, setExportTimeframe] = useState("Today")
  const [exportStartDate, setExportStartDate] = useState("")
  const [exportEndDate, setExportEndDate] = useState("")'''
    content = content.replace('const [searchQuery, setSearchQuery] = useState("")', state_insert + '\n  const [searchQuery, setSearchQuery] = useState("")')

    # 4. Modify handleExport to filter based on exportTimeframe
    handle_export_start = r'const handleExport = \(\) => \{'
    handle_export_replacement = '''const handleExport = () => {
    // Filter the current filteredTickets based on the exportTimeframe
    let finalTickets = filteredTickets;
    const now = new Date();
    
    if (exportTimeframe === "Today") {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      finalTickets = filteredTickets.filter(t => t.createdAt.toDate() >= today);
    } else if (exportTimeframe === "This Month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      finalTickets = filteredTickets.filter(t => t.createdAt.toDate() >= startOfMonth);
    } else if (exportTimeframe === "Custom") {
      if (exportStartDate) {
        const start = new Date(exportStartDate);
        start.setHours(0, 0, 0, 0);
        finalTickets = finalTickets.filter(t => t.createdAt.toDate() >= start);
      }
      if (exportEndDate) {
        const end = new Date(exportEndDate);
        end.setHours(23, 59, 59, 999);
        finalTickets = finalTickets.filter(t => t.createdAt.toDate() <= end);
      }
    }
    
    const exportData: any[] = []
    const merges: any[] = []
    let currentRowIndex = 1

    finalTickets.forEach(t => {'''
    content = re.sub(r'const handleExport = \(\) => \{\s*const exportData: any\[\] = \[\]\s*const merges: any\[\] = \[\]\s*let currentRowIndex = 1\s*filteredTickets\.forEach\(t => \{', handle_export_replacement, content)

    # 5. Fix the summary sheet count logic inside handleExport to use finalTickets
    content = content.replace('filteredTickets.forEach(t => {\n      if (t.category === "Food Quality") {', 'finalTickets.forEach(t => {\n      if (t.category === "Food Quality") {')

    # 6. Change main export button onClick to setExportModalOpen(true)
    content = content.replace('onClick={handleExport}', 'onClick={() => setExportModalOpen(true)}')

    # 7. Add Modal UI at the end of the return statement
    modal_ui = '''
      {/* Export Options Modal */}
      <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Export Tickets</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Timeframe</label>
              <Select value={exportTimeframe} onValueChange={setExportTimeframe}>
                <SelectTrigger>
                  <SelectValue placeholder="Select timeframe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Time (No Filter)</SelectItem>
                  <SelectItem value="Today">Today</SelectItem>
                  <SelectItem value="This Month">This Month</SelectItem>
                  <SelectItem value="Custom">Custom Date Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {exportTimeframe === "Custom" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Date</label>
                  <Input type="date" value={exportStartDate} onChange={(e) => setExportStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">End Date</label>
                  <Input type="date" value={exportEndDate} onChange={(e) => setExportEndDate(e.target.value)} />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportModalOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              handleExport();
              setExportModalOpen(false);
            }}>
              Download Excel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}'''
    content = re.sub(r'</div>\s*\)\s*\}\s*$', modal_ui, content)

    with open('app/admin/ticketing/page.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
        
    print("Export modal functionality added successfully.")

if __name__ == "__main__":
    update_file()
