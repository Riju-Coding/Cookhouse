import re

with open('app/admin/qr-links/page.tsx', 'r', encoding='utf-8') as f:
    admin_content = f.read()

# 1. Update initialCustomization
init_custom = '''const initialCustomization = {
  headerText: "Facility Feedback",
  showHeader: true,
  showFeedbackFormHeader: true,
  showFeedbackFormSubHeader: true,
  showCompanyName: true,
  showBuildingName: true,
  showTrackTicket: true,
  showPriority: true,
  showRemarks: true,
  issueCategories: COMPLAINT_CATEGORIES,
  submitButtonText: "Submit Feedback",
  feedbackFormHeaderText: "Today's Meal Feedback",
  feedbackFormSubHeaderText: "How was your meal? 🍽️"
}'''
admin_content = re.sub(r'const initialCustomization = \{.*?\n\}', init_custom, admin_content, flags=re.DOTALL)

# 2. Add toggles in CustomizationFields
toggles = '''        <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
          <span className="text-sm">Show Track Ticket Button</span>
          <ToggleSwitch enabled={!!data.showTrackTicket} onChange={v => onChange({...data, showTrackTicket: v})} />
        </div>
        <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
          <span className="text-sm">Show Priority</span>
          <ToggleSwitch enabled={data.showPriority !== false} onChange={v => onChange({...data, showPriority: v})} />
        </div>
        <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
          <span className="text-sm">Show Remarks Box</span>
          <ToggleSwitch enabled={data.showRemarks !== false} onChange={v => onChange({...data, showRemarks: v})} />
        </div>'''
admin_content = admin_content.replace('''        <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
          <span className="text-sm">Show Track Ticket Button</span>
          <ToggleSwitch enabled={!!data.showTrackTicket} onChange={v => onChange({...data, showTrackTicket: v})} />
        </div>''', toggles)

with open('app/admin/qr-links/page.tsx', 'w', encoding='utf-8') as f:
    f.write(admin_content)


with open('app/report/[id]/page.tsx', 'r', encoding='utf-8') as f:
    report_content = f.read()

# 3. Add auto-select sub-service effect
auto_select_effect = '''  // Auto-select sub-service if there is only one for the selected service
  useEffect(() => {
    if (selectedServiceId && subServices.length > 0) {
      const subForService = subServices.filter(s => s.serviceId === selectedServiceId)
      if (subForService.length === 1) {
        setSelectedSubServiceId(subForService[0].id)
      } else if (!subForService.find(s => s.id === selectedSubServiceId)) {
        // If current subService doesn't belong to the newly selected service, clear it
        setSelectedSubServiceId("")
      }
    }
  }, [selectedServiceId, subServices])

  // Update todayMenuItems when selected service/subservice changes'''
report_content = report_content.replace('  // Update todayMenuItems when selected service/subservice changes', auto_select_effect)

# 4. Wrap Priority
priority_block = '''        {linkInfo.customization?.showPriority !== false && (
        <div className="space-y-2.5">
          <Label className="text-sm font-bold text-slate-700">Urgency / Priority</Label>
          <Select value={priority} onValueChange={(val: TicketPriority) => setPriority(val)}>
            <SelectTrigger className="rounded-xl h-12 px-4 bg-white border-slate-200 transition-all hover:bg-slate-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl overflow-hidden shadow-xl border-slate-100">
              <SelectItem value="Low" className="py-2.5 cursor-pointer font-medium"><span className="text-emerald-600 font-bold mr-2">•</span>Low - Not urgent</SelectItem>
              <SelectItem value="Medium" className="py-2.5 cursor-pointer font-medium"><span className="text-blue-600 font-bold mr-2">•</span>Medium - Needs attention soon</SelectItem>
              <SelectItem value="High" className="py-2.5 cursor-pointer font-medium"><span className="text-orange-500 font-bold mr-2">•</span>High - Affects operations</SelectItem>
              <SelectItem value="Critical" className="py-2.5 cursor-pointer font-medium"><span className="text-red-600 font-bold mr-2">•</span>Critical - Safety/Major disruption</SelectItem>
            </SelectContent>
          </Select>
        </div>
        )}'''

old_priority = '''        <div className="space-y-2.5">
          <Label className="text-sm font-bold text-slate-700">Urgency / Priority</Label>
          <Select value={priority} onValueChange={(val: TicketPriority) => setPriority(val)}>
            <SelectTrigger className="rounded-xl h-12 px-4 bg-white border-slate-200 transition-all hover:bg-slate-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl overflow-hidden shadow-xl border-slate-100">
              <SelectItem value="Low" className="py-2.5 cursor-pointer font-medium"><span className="text-emerald-600 font-bold mr-2">•</span>Low - Not urgent</SelectItem>
              <SelectItem value="Medium" className="py-2.5 cursor-pointer font-medium"><span className="text-blue-600 font-bold mr-2">•</span>Medium - Needs attention soon</SelectItem>
              <SelectItem value="High" className="py-2.5 cursor-pointer font-medium"><span className="text-orange-500 font-bold mr-2">•</span>High - Affects operations</SelectItem>
              <SelectItem value="Critical" className="py-2.5 cursor-pointer font-medium"><span className="text-red-600 font-bold mr-2">•</span>Critical - Safety/Major disruption</SelectItem>
            </SelectContent>
          </Select>
        </div>'''
report_content = report_content.replace(old_priority, priority_block)

# 5. Wrap Remarks
remarks_block = '''        {linkInfo.customization?.showRemarks !== false && (
        <div className="space-y-2.5">
          <Label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            {(category === "Food Quality" || category === "Food Shortage") ? "General Remarks (Optional)" : "Description *"}
            {(category !== "Food Quality" && category !== "Food Shortage") && <span className="text-red-500">*</span>}
          </Label>
          <Textarea 
            placeholder={(category === "Food Quality" || category === "Food Shortage") ? "Any overall feedback..." : "Please describe the issue in detail..."}
            className="min-h-[140px] rounded-2xl bg-slate-50/50 border-slate-200 focus-visible:ring-blue-500 p-4 transition-all hover:bg-white resize-none"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>
        )}'''

old_remarks = '''        <div className="space-y-2.5">
          <Label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            {(category === "Food Quality" || category === "Food Shortage") ? "General Remarks (Optional)" : "Description *"}
            {(category !== "Food Quality" && category !== "Food Shortage") && <span className="text-red-500">*</span>}
          </Label>
          <Textarea 
            placeholder={(category === "Food Quality" || category === "Food Shortage") ? "Any overall feedback..." : "Please describe the issue in detail..."}
            className="min-h-[140px] rounded-2xl bg-slate-50/50 border-slate-200 focus-visible:ring-blue-500 p-4 transition-all hover:bg-white resize-none"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>'''
report_content = report_content.replace(old_remarks, remarks_block)

# 6. Submit Button Text
submit_old = '''          {submitting ? (
            <><Loader2 className="w-6 h-6 mr-2 animate-spin" /> {uploadingPhotos ? "Uploading Photos..." : "Submitting Complaint..."}</>
          ) : (
            "Submit Complaint"
          )}'''
submit_new = '''          {submitting ? (
            <><Loader2 className="w-6 h-6 mr-2 animate-spin" /> {uploadingPhotos ? "Uploading Photos..." : "Submitting Complaint..."}</>
          ) : (
            linkInfo.customization?.submitButtonText || "Submit Complaint"
          )}'''
report_content = report_content.replace(submit_old, submit_new)

with open('app/report/[id]/page.tsx', 'w', encoding='utf-8') as f:
    f.write(report_content)
