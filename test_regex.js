const desc = `[Public Complaint Submission]
Reporter Name: Sudipta
Contact: N/A
Employee ID: 12345
Category: Food Quality

Location Details:
- Company: TechCorp
- Building: Main
- Cafe/Location: Cafe A

Complaint:
Food was a bit cold today.

--- Meal Feedback (Lunch - Main Course) ---

Item: Rice
Rating: Loved it
Remark: Good

Item: Dal
Rating: Good

Item: Salad
Rating: Needs Improvement
Remark: Stale
`

const itemRegex = /Item:\s*(.+)\nRating:\s*(.+)(?:\nRemark:\s*(.*))?/g;
let match;
while ((match = itemRegex.exec(desc)) !== null) {
   console.log("Found:", match[1], " | ", match[2], " | ", match[3]);
}
