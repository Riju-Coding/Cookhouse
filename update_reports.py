import re
import sys

def main():
    try:
        # 1. Update report page
        with open('app/report/[id]/page.tsx', 'r', encoding='utf-8') as f:
            report_content = f.read()

        report_content = report_content.replace('short: "Nope",        emoji: "😤"', 'short: "Needs Improvement", emoji: "👎"')

        with open('app/report/[id]/page.tsx', 'w', encoding='utf-8') as f:
            f.write(report_content)

        # 2. Update ticketing export
        with open('app/admin/ticketing/page.tsx', 'r', encoding='utf-8') as f:
            ticketing_content = f.read()

        export_old = '''  const handleExport = () => {
    const exportData = filteredTickets.map(t => ({
      "Ticket ID": t.id,
      "Title": t.title,
      "Description": t.description,
      "Company": t.companyName,
      "Category": t.category || "Uncategorized",
      "Employee Name": t.creatorName,
      "Employee ID": t.creatorId,
      "Priority": t.priority,
      "Status": t.status,
      "Submitted At": t.createdAt.toDate().toLocaleString(),
      "SLA Breach At": t.slaBreachAt.toDate().toLocaleString(),
      "Is Breached": (t.slaBreachAt.toMillis() < Date.now() && t.status !== 'Resolved' && t.status !== 'Closed') ? "Yes" : "No"
    }))'''

        export_new = '''  const handleExport = () => {
    const exportData = filteredTickets.map(t => {
      let lovedCount = 0;
      let goodCount = 0;
      let okayCount = 0;
      let needsImprovementCount = 0;
      
      if (t.category === "Food Quality") {
        const desc = t.description || "";
        lovedCount = (desc.match(/Rating: Loved it/gi) || []).length;
        goodCount = (desc.match(/Rating: Good/gi) || []).length;
        okayCount = (desc.match(/Rating: Okay/gi) || []).length;
        needsImprovementCount = (desc.match(/Rating: (Nope|Needs Improvement)/gi) || []).length;
      }

      return {
        "Ticket ID": t.id,
        "Title": t.title,
        "Description": t.description,
        "Company": t.companyName,
        "Category": t.category || "Uncategorized",
        "Employee Name": t.creatorName,
        "Employee ID": t.creatorId,
        "Priority": t.priority,
        "Status": t.status,
        "Loved It (Count)": t.category === "Food Quality" ? lovedCount : "N/A",
        "Good (Count)": t.category === "Food Quality" ? goodCount : "N/A",
        "Okay (Count)": t.category === "Food Quality" ? okayCount : "N/A",
        "Needs Improvement (Count)": t.category === "Food Quality" ? needsImprovementCount : "N/A",
        "Submitted At": t.createdAt.toDate().toLocaleString(),
        "SLA Breach At": t.slaBreachAt.toDate().toLocaleString(),
        "Is Breached": (t.slaBreachAt.toMillis() < Date.now() && t.status !== 'Resolved' && t.status !== 'Closed') ? "Yes" : "No"
      };
    })'''

        if export_old in ticketing_content:
            ticketing_content = ticketing_content.replace(export_old, export_new)
            with open('app/admin/ticketing/page.tsx', 'w', encoding='utf-8') as f:
                f.write(ticketing_content)
            print("Successfully updated ticketing export.")
        else:
            print("Could not find the export data string to replace.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
