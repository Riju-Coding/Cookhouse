import re

with open('app/admin/qr-links/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Make DialogContent full screen with !important to override tailwind-merge issues
content = content.replace(
    '<DialogContent className="sm:max-w-[100vw] max-w-[100vw] w-screen h-screen sm:rounded-none m-0 p-0 overflow-hidden bg-gray-50">',
    '<DialogContent className="!max-w-none !w-screen !h-screen !m-0 !p-0 !rounded-none border-0 overflow-hidden bg-gray-50">'
)

with open('app/admin/qr-links/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
