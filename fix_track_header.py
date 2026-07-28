import re

with open('app/report/track/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

header = '''  return (
    <>
      <div className="bg-slate-800 text-white p-4 shadow-md sticky top-0 z-50 flex items-center justify-center relative">
        <h1 className="text-lg font-bold">Track Ticket</h1>
      </div>
      <div className="w-full max-w-2xl mx-auto space-y-6 p-4">'''

content = content.replace('''  return (
    <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-6 space-y-6">''', header + '''\n      <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-6 space-y-6">''')

content = content.replace('''    </div>
  )
}''', '''    </div>
    </div>
    </>
  )
}''')

with open('app/report/track/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
