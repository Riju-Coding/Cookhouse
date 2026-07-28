import re

with open('app/report/track/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the bad extra closing tags
bad_close = """    </div>
    </div>
    </>
  )
}"""
good_close = """    </div>
  )
}"""
content = content.replace(bad_close, good_close)

# Wait, we DO want the header. Where was the outer div?
# Let's just fix the syntax error for now, then we can add the header properly later if needed.

with open('app/report/track/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
