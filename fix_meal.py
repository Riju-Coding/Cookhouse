import re

with open('app/admin/meal-plan-structure/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('</Button>}}', '</Button>')

with open('app/admin/meal-plan-structure/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
