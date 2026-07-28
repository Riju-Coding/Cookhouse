import re

with open('app/admin/qr-links/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Make DialogContent full screen, overriding responsive max-w limits
content = content.replace(
    '<DialogContent className="max-w-[100vw] w-screen h-[100dvh] max-h-screen p-0 border-0 rounded-none overflow-hidden bg-gray-50">',
    '<DialogContent className="sm:max-w-[100vw] max-w-[100vw] w-screen h-screen sm:rounded-none m-0 p-0 overflow-hidden bg-gray-50">'
)

with open('app/admin/qr-links/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
