import re

with open('app/report/[id]/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update COMPLAINT_CATEGORIES resolution
# In the render we'll use a local constant derived from linkInfo
content = content.replace(
    'const [name, setName] = useState("")',
    'const activeCategories = linkInfo?.customization?.issueCategories || COMPLAINT_CATEGORIES\n  const [name, setName] = useState("")'
)

# 2. Auto-select category if there is only 1
content = content.replace(
    'if (!data) {\n          setError(true)\n        } else {\n          setLinkInfo(data)\n        }',
    '''if (!data) {
          setError(true)
        } else {
          setLinkInfo(data)
          if (data.customization?.issueCategories?.length === 1) {
            setCategory(data.customization.issueCategories[0])
          }
        }'''
)

# 3. Auto-select service/subservice if there is only 1
auto_select_code = '''
        setServices(activeServices)
        setSubServices(activeSubServices)
        
        if (activeServices.length === 1) {
            setSelectedServiceId(activeServices[0].id)
            const subForService = activeSubServices.filter((s: any) => s.serviceId === activeServices[0].id)
            if (subForService.length === 1) {
                setSelectedSubServiceId(subForService[0].id)
            }
        }
'''
content = content.replace('setServices(activeServices)\n        setSubServices(activeSubServices)', auto_select_code)


# 4. Hide Category dropdown if there is only 1 category
category_select = '''<div className="space-y-2.5">
          <Label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            Issue Category <span className="text-red-500">*</span>
          </Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className={`rounded-xl h-12 px-4 transition-all hover:bg-white ${category ? "bg-white border-blue-200 ring-2 ring-blue-500/10" : "bg-slate-50/50 border-slate-200"}`}>
              <SelectValue placeholder="Select the type of issue" />
            </SelectTrigger>
            <SelectContent className="rounded-xl overflow-hidden shadow-xl border-slate-100">
              {COMPLAINT_CATEGORIES.map(c => <SelectItem key={c} value={c} className="py-2.5 cursor-pointer font-medium">{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>'''
        
new_category_select = '''{activeCategories.length > 1 && (
        <div className="space-y-2.5">
          <Label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            Issue Category <span className="text-red-500">*</span>
          </Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className={`rounded-xl h-12 px-4 transition-all hover:bg-white ${category ? "bg-white border-blue-200 ring-2 ring-blue-500/10" : "bg-slate-50/50 border-slate-200"}`}>
              <SelectValue placeholder="Select the type of issue" />
            </SelectTrigger>
            <SelectContent className="rounded-xl overflow-hidden shadow-xl border-slate-100">
              {activeCategories.map((c: string) => <SelectItem key={c} value={c} className="py-2.5 cursor-pointer font-medium">{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        )}'''
content = content.replace(category_select, new_category_select)


# 5. Apply headerText customization
content = content.replace(
    '<p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Reporting issue at</p>',
    '<p className="text-xs font-bold text-blue-600 uppercase tracking-wider">{linkInfo.customization?.headerText || "Reporting issue at"}</p>'
)

# 6. Apply showCompanyName and showBuildingName customization
building_company_code = '''<div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-500">
                <span className="bg-slate-100 px-2 py-0.5 rounded-md">{linkInfo.buildingName}</span>
                <span className="text-slate-300">•</span>
                <span>{linkInfo.companyName}</span>
              </div>'''

new_building_company_code = '''<div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-500">
                {linkInfo.customization?.showBuildingName !== false && <span className="bg-slate-100 px-2 py-0.5 rounded-md">{linkInfo.buildingName}</span>}
                {(linkInfo.customization?.showBuildingName !== false && linkInfo.customization?.showCompanyName !== false) && <span className="text-slate-300">•</span>}
                {linkInfo.customization?.showCompanyName !== false && <span>{linkInfo.companyName}</span>}
              </div>'''
content = content.replace(building_company_code, new_building_company_code)

# 7. Apply showTrackTicket customization
track_ticket_code = '''<Link href="/report/track" className="shrink-0 w-full sm:w-auto">
            <Button variant="outline" size="sm" className="w-full sm:w-auto rounded-xl border-slate-200 hover:bg-slate-50 hover:text-blue-600 font-semibold shadow-sm transition-all text-xs h-9">
              Track Ticket
            </Button>
          </Link>'''

new_track_ticket_code = '''{linkInfo.customization?.showTrackTicket !== false && (
          <Link href="/report/track" className="shrink-0 w-full sm:w-auto">
            <Button variant="outline" size="sm" className="w-full sm:w-auto rounded-xl border-slate-200 hover:bg-slate-50 hover:text-blue-600 font-semibold shadow-sm transition-all text-xs h-9">
              Track Ticket
            </Button>
          </Link>
          )}'''
content = content.replace(track_ticket_code, new_track_ticket_code)

# 8. Submit button text
content = content.replace(
    '<Button type="submit" className="h-12 text-lg font-bold w-full bg-blue-600 hover:bg-blue-700 shadow-md gap-2 rounded-2xl" disabled={submitting}>',
    '<Button type="submit" className="h-12 text-lg font-bold w-full bg-blue-600 hover:bg-blue-700 shadow-md gap-2 rounded-2xl" disabled={submitting}>'
)
content = content.replace(
    '{submitting ? "Submitting..." : "Submit Report"}',
    '{submitting ? "Submitting..." : (linkInfo.customization?.submitButtonText || "Submit Report")}'
)

# 9. Food Feedback Header Text
content = content.replace(
    """{category === "Food Quality" ? "Today's Meal Feedback" : "Today's Menu"}""",
    """{category === "Food Quality" ? (linkInfo.customization?.feedbackFormHeaderText || "Today's Meal Feedback") : "Today's Menu"}"""
)

content = content.replace(
    """{category === "Food Quality" ? "Rate each dish honestly — your feedback helps us improve!" : "Select the items below that were missing or ran out."}""",
    """{category === "Food Quality" ? (linkInfo.customization?.feedbackFormSubHeaderText || "Rate each dish honestly — your feedback helps us improve!") : "Select the items below that were missing or ran out."}"""
)


with open('app/report/[id]/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Report Form patched successfully!')
