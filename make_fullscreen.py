import re

with open('app/admin/qr-links/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Make DialogContent full screen
content = content.replace(
    '<DialogContent className="max-w-5xl p-0 overflow-hidden bg-gray-50">',
    '<DialogContent className="max-w-[100vw] w-screen h-[100dvh] max-h-screen p-0 border-0 rounded-none overflow-hidden bg-gray-50">'
)

# Change the h-[80vh] inner wrapper to h-full to take up the full dialog
content = content.replace(
    '<div className="flex h-[80vh] w-full">',
    '<div className="flex h-full w-full">'
)

with open('app/admin/qr-links/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
