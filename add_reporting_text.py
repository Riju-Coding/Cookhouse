import re

with open('app/admin/qr-links/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add Reporting Issue At text setting
old_grid = '''        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-gray-500">Main Header Text</Label>
            <ToggleSwitch enabled={data.showHeader !== false} onChange={v => onChange({...data, showHeader: v})} />
          </div>
          <Input value={data.headerText} onChange={e => onChange({...data, headerText: e.target.value})} disabled={data.showHeader === false} />
        </div>'''

new_grid = '''        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-gray-500">Main Header Text</Label>
            <ToggleSwitch enabled={data.showHeader !== false} onChange={v => onChange({...data, showHeader: v})} />
          </div>
          <Input value={data.headerText} onChange={e => onChange({...data, headerText: e.target.value})} disabled={data.showHeader === false} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-gray-500">"Reporting issue at" Text</Label>
            <ToggleSwitch enabled={data.showReportingIssueAt !== false} onChange={v => onChange({...data, showReportingIssueAt: v})} />
          </div>
          <Input value={data.reportingIssueAtText || "Reporting issue at"} onChange={e => onChange({...data, reportingIssueAtText: e.target.value})} disabled={data.showReportingIssueAt === false} />
        </div>'''

content = content.replace(old_grid, new_grid)

with open('app/admin/qr-links/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
