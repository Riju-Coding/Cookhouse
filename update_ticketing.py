import re
import sys

def main():
    try:
        with open('app/admin/ticketing/page.tsx', 'r', encoding='utf-8') as f:
            content = f.read()

        # 1. Add date range state
        state_marker = 'const [searchQuery, setSearchQuery] = useState("")'
        if state_marker in content and 'startDate' not in content:
            new_state = state_marker + '\n  const [startDate, setStartDate] = useState("")\n  const [endDate, setEndDate] = useState("")'
            content = content.replace(state_marker, new_state)

        # 2. Add date range filter logic
        filter_marker = 'if (employeeIdFilter && !t.creatorId.toLowerCase().includes(employeeIdFilter.toLowerCase())) return false'
        if filter_marker in content and 'const ticketDate = t.createdAt.toDate()' not in content:
            date_filter = '''      if (employeeIdFilter && !t.creatorId.toLowerCase().includes(employeeIdFilter.toLowerCase())) return false
      
      const ticketDate = t.createdAt.toDate()
      if (startDate) {
        const start = new Date(startDate)
        start.setHours(0, 0, 0, 0)
        if (ticketDate < start) return false
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        if (ticketDate > end) return false
      }'''
            content = content.replace(filter_marker, date_filter)

        # 3. Add UI elements for Date Pickers
        ui_marker = '<div className="flex flex-col md:flex-row gap-4 items-end">'
        if ui_marker in content and 'startDate' not in content.split(ui_marker)[1]:
            new_ui = ui_marker + '''
            <div className="w-full md:w-[150px] space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase">Start Date</label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="w-full md:w-[150px] space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase">End Date</label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>'''
            content = content.replace(ui_marker, new_ui)

        # 4. Modify handleExport to add Summary sheet
        export_end_marker = "xlsx.utils.book_append_sheet(wb, ws, \"Tickets\")"
        if export_end_marker in content and 'Summary' not in content:
            new_export = '''xlsx.utils.book_append_sheet(wb, ws, "Tickets")
    
    // Add summary sheet
    let totalLoved = 0;
    let totalGood = 0;
    let totalOkay = 0;
    let totalNeedsImprovement = 0;
    
    filteredTickets.forEach(t => {
      if (t.category === "Food Quality") {
        const desc = t.description || ""
        totalLoved += (desc.match(/Rating: Loved it/gi) || []).length;
        totalGood += (desc.match(/Rating: Good/gi) || []).length;
        totalOkay += (desc.match(/Rating: Okay/gi) || []).length;
        totalNeedsImprovement += (desc.match(/Rating: (Nope|Needs Improvement)/gi) || []).length;
      }
    })
    
    const totalRatings = totalLoved + totalGood + totalOkay + totalNeedsImprovement;
    
    const summaryData = [
      { "Rating Type": "Loved It", "Count": totalLoved, "Percentage": totalRatings > 0 ? ((totalLoved / totalRatings) * 100).toFixed(2) + "%" : "0%" },
      { "Rating Type": "Good", "Count": totalGood, "Percentage": totalRatings > 0 ? ((totalGood / totalRatings) * 100).toFixed(2) + "%" : "0%" },
      { "Rating Type": "Okay", "Count": totalOkay, "Percentage": totalRatings > 0 ? ((totalOkay / totalRatings) * 100).toFixed(2) + "%" : "0%" },
      { "Rating Type": "Needs Improvement", "Count": totalNeedsImprovement, "Percentage": totalRatings > 0 ? ((totalNeedsImprovement / totalRatings) * 100).toFixed(2) + "%" : "0%" },
      { "Rating Type": "Total Reviews", "Count": totalRatings, "Percentage": "100%" }
    ]
    
    const wsSummary = xlsx.utils.json_to_sheet(summaryData)
    xlsx.utils.book_append_sheet(wb, wsSummary, "Summary")'''
            content = content.replace(export_end_marker, new_export)

        with open('app/admin/ticketing/page.tsx', 'w', encoding='utf-8') as f:
            f.write(content)
            
        print("Updated ticketing page with date filters and summary export.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
