import re

with open('app/report/[id]/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix form validation
old_validation = '''    if (!category || !description) {
      toast({ title: "Required Fields", description: "Category and description are required.", variant: "destructive" })
      return
    }'''

new_validation = '''    if (!category) {
      toast({ title: "Required Fields", description: "Category is required.", variant: "destructive" })
      return
    }
    
    // Description is required ONLY for general categories (not Food Quality or Food Shortage)
    if (category !== "Food Quality" && category !== "Food Shortage" && !description) {
      toast({ title: "Required Fields", description: "Description is required for this issue category.", variant: "destructive" })
      return
    }'''

content = content.replace(old_validation, new_validation)

with open('app/report/[id]/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
