import re

# 1. Update layout.tsx
with open('app/report/layout.tsx', 'r', encoding='utf-8') as f:
    layout_content = f.read()

# Remove header from layout
header_pattern = r'<header className="w-full max-w-2xl.*?</header>'
layout_content = re.sub(header_pattern, '', layout_content, flags=re.DOTALL)

# Remove padding from main
main_old = '<main className="flex-1 w-full max-w-2xl p-4 sm:p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">'
main_new = '<main className="flex-1 w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out flex flex-col">'
layout_content = layout_content.replace(main_old, main_new)

with open('app/report/layout.tsx', 'w', encoding='utf-8') as f:
    f.write(layout_content)


# 2. Update page.tsx
with open('app/report/[id]/page.tsx', 'r', encoding='utf-8') as f:
    page_content = f.read()

header_code = '''
      {linkInfo.customization?.showHeader !== false && (
      <header className="w-full bg-white/70 backdrop-blur-xl border-b border-slate-200/50 shadow-[0_4px_30px_rgba(0,0,0,0.03)] sticky top-0 z-50 flex items-center justify-between px-6 py-4 transition-all duration-300">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-2 rounded-xl shadow-lg shadow-blue-500/20">
            <ChefHat className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 tracking-tight">
              {linkInfo.customization?.headerText || "Facility Feedback"}
            </h1>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Guest Services</p>
          </div>
        </div>
      </header>
      )}
      <div className="p-4 sm:p-6 md:p-8">
'''

# We need to wrap the return statement with a div to hold the header and the padded content
return_statement_idx = page_content.rfind('return (')
# Replace return ( with return ( <> header_code

# Wait, there are multiple returns for error states!
# Let's wrap all of them with the padding.
# "if (loading)"
loading_old = '''  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">'''
loading_new = '''  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500 p-4 sm:p-6 md:p-8">'''
page_content = page_content.replace(loading_old, loading_new)

# "if (error || !linkInfo)"
error_old = '''  if (error || !linkInfo) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm text-center border">'''
error_new = '''  if (error || !linkInfo) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
      <div className="bg-white p-6 rounded-lg shadow-sm text-center border">'''
page_content = page_content.replace(error_old, error_new).replace(
    '''        <p className="text-gray-500">The QR code you scanned is no longer valid or could not be found.</p>
      </div>
    )
  }''', 
    '''        <p className="text-gray-500">The QR code you scanned is no longer valid or could not be found.</p>
      </div>
      </div>
    )
  }'''
)

# "if (successTicketId)"
success_old = '''  if (successTicketId) {
    return (
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center">'''
success_new = '''  if (successTicketId) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center">'''
page_content = page_content.replace(success_old, success_new).replace(
    '''        </Link>
      </div>
    )
  }''',
    '''        </Link>
      </div>
      </div>
    )
  }'''
)

# Main return
main_return_old = '''  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 overflow-hidden">'''
main_return_new = f'''  return (
    <>
{header_code}
    <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 overflow-hidden">'''
page_content = page_content.replace(main_return_old, main_return_new)

# Close the padded div at the very end of the file
page_content = page_content.replace(
    '''        </Button>
      </form>
    </div>
  )
}''',
    '''        </Button>
      </form>
    </div>
    </div>
    </>
  )
}'''
)

# Finally, we should change the previous "headerText" in the "Reporting issue at" block to just say "Reporting issue at" hardcoded, or whatever.
# The user complained that they changed headerText to something else but it still said Facility Feedback.
# Now `headerText` will change the navbar header!
# Let's revert the "Reporting issue at" block to its original state or leave it as is.
# I will change it to hardcode "Reporting issue at" so the `headerText` strictly controls the Top Navbar.
page_content = page_content.replace(
    '{linkInfo.customization?.showHeader !== false && (\n                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">{linkInfo.customization?.headerText || "Reporting issue at"}</p>\n              )}',
    '<p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Reporting issue at</p>'
)

with open('app/report/[id]/page.tsx', 'w', encoding='utf-8') as f:
    f.write(page_content)


# 3. We must also update `app/report/track/page.tsx` since we removed the header from layout!
with open('app/report/track/page.tsx', 'r', encoding='utf-8') as f:
    track_content = f.read()

track_header = '''
      <header className="w-full bg-white/70 backdrop-blur-xl border-b border-slate-200/50 shadow-[0_4px_30px_rgba(0,0,0,0.03)] sticky top-0 z-50 flex items-center justify-between px-6 py-4 transition-all duration-300">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-2 rounded-xl shadow-lg shadow-blue-500/20">
            <ChefHat className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 tracking-tight">Track Ticket</h1>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Guest Services</p>
          </div>
        </div>
      </header>
      <div className="p-4 sm:p-6 md:p-8 w-full max-w-2xl mx-auto">
'''

track_return_old = '''  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">'''
track_return_new = f'''  return (
    <>
{track_header}
    <div className="w-full space-y-6">'''
track_content = track_content.replace(track_return_old, track_return_new)
track_content = track_content.replace(
    '''    </div>
  )
}''',
    '''    </div>
    </div>
    </>
  )
}'''
)

# Fix imports in page.tsx for ChefHat if it's missing?
# wait, ChefHat is imported in app/report/[id]/page.tsx (I know because it was used in Food Quality header)
# Let's check `import { ChefHat }` in track/page.tsx
if 'import { ChefHat' not in track_content:
    track_content = track_content.replace('import { Search, Loader2, Clock, CheckCircle2, AlertCircle } from "lucide-react"', 'import { Search, Loader2, Clock, CheckCircle2, AlertCircle, ChefHat } from "lucide-react"')
    
with open('app/report/track/page.tsx', 'w', encoding='utf-8') as f:
    f.write(track_content)

print("Headers updated to be dynamic.")
