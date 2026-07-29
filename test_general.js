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
Food was a bit cold today. But overall okay!

--- Meal Feedback (Lunch - Main Course) ---

Item: Rice
Rating: Loved it
Remark: Good
`

const getGeneral = (desc) => {
   const parts = desc.split("--- Meal Feedback");
   const firstPart = parts[0];
   const match = firstPart.match(/Complaint:\s*([\s\S]*)/);
   return match ? match[1].trim() : firstPart.trim();
}

console.log("General Feedback:", getGeneral(desc));
