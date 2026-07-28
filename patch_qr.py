import re

with open('app/admin/qr-links/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add categories and initial customization
categories_code = """
const COMPLAINT_CATEGORIES = [
  "Cleaning and Hygiene",
  "Food Quality",
  "Food Shortage",
  "Staff"
]

const initialCustomization = {
  headerText: "Facility Feedback",
  showCompanyName: true,
  showBuildingName: true,
  showTrackTicket: true,
  issueCategories: COMPLAINT_CATEGORIES,
  submitButtonText: "Submit Feedback",
  feedbackFormHeaderText: "Today's Meal Feedback",
  feedbackFormSubHeaderText: "How was your meal? 🍽️"
}
"""

content = content.replace('export default function QRLinksPage() {', categories_code + '\nexport default function QRLinksPage() {')

# 2. Add state inside component
state_code = """
  const [customization, setCustomization] = useState(initialCustomization)
  const [editCustomization, setEditCustomization] = useState(initialCustomization)
"""
content = content.replace('const [creating, setCreating] = useState(false)', 'const [creating, setCreating] = useState(false)\n' + state_code)

# 3. Handle edit click
content = content.replace(
    'setEditRequireEmployeeId(!!link.requireEmployeeId)',
    'setEditRequireEmployeeId(!!link.requireEmployeeId)\n    setEditCustomization(link.customization || initialCustomization)'
)

# 4. Handle Create
content = content.replace(
    'requireEmployeeId\n      })',
    'requireEmployeeId,\n        customization\n      })'
)

content = content.replace(
    'setRequireEmployeeId(false)',
    'setRequireEmployeeId(false)\n      setCustomization(initialCustomization)'
)

# 5. Handle Save Edit
content = content.replace(
    'requireEmployeeId: editRequireEmployeeId\n      })',
    'requireEmployeeId: editRequireEmployeeId,\n        customization: editCustomization\n      })'
)

content = content.replace(
    'requireEmployeeId: editRequireEmployeeId }',
    'requireEmployeeId: editRequireEmployeeId, customization: editCustomization }'
)

# 6. Add Customization UI components
ui_component = """
// --- Customization Form Helper ---
function CustomizationFields({ data, onChange }: { data: any, onChange: (d: any) => void }) {
  const toggleCategory = (cat: string) => {
    const cats = data.issueCategories || []
    if (cats.includes(cat)) {
      onChange({ ...data, issueCategories: cats.filter((c: string) => c !== cat) })
    } else {
      onChange({ ...data, issueCategories: [...cats, cat] })
    }
  }

  return (
    <div className="pt-4 border-t space-y-4">
      <h4 className="text-sm font-semibold">UI Customization</h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs text-gray-500">Main Header Text</Label>
          <Input value={data.headerText} onChange={e => onChange({...data, headerText: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-gray-500">Submit Button Text</Label>
          <Input value={data.submitButtonText} onChange={e => onChange({...data, submitButtonText: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-gray-500">Food Feedback Header</Label>
          <Input value={data.feedbackFormHeaderText} onChange={e => onChange({...data, feedbackFormHeaderText: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-gray-500">Food Feedback Subheader</Label>
          <Input value={data.feedbackFormSubHeaderText} onChange={e => onChange({...data, feedbackFormSubHeaderText: e.target.value})} />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-gray-500">Allowed Categories</Label>
        <div className="flex flex-wrap gap-2">
          {COMPLAINT_CATEGORIES.map(cat => (
            <div key={cat} className="flex items-center space-x-2 bg-gray-50 p-2 rounded border">
              <Checkbox id={`cat-${cat}`} checked={(data.issueCategories || []).includes(cat)} onCheckedChange={() => toggleCategory(cat)} />
              <label htmlFor={`cat-${cat}`} className="text-xs">{cat}</label>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
          <span className="text-sm">Show Company Name</span>
          <ToggleSwitch enabled={!!data.showCompanyName} onChange={v => onChange({...data, showCompanyName: v})} />
        </div>
        <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
          <span className="text-sm">Show Building Name</span>
          <ToggleSwitch enabled={!!data.showBuildingName} onChange={v => onChange({...data, showBuildingName: v})} />
        </div>
        <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
          <span className="text-sm">Show Track Ticket Button</span>
          <ToggleSwitch enabled={!!data.showTrackTicket} onChange={v => onChange({...data, showTrackTicket: v})} />
        </div>
      </div>
    </div>
  )
}
"""
content = content.replace('// ─── Toggle Switch Component', ui_component + '\n// ─── Toggle Switch Component')

# 7. Insert Customization UI into Create Modal
content = content.replace(
    '</div>\n            </div>\n            <DialogFooter>',
    '</div>\n              <CustomizationFields data={customization} onChange={setCustomization} />\n            </div>\n            <DialogFooter>'
)

# 8. Insert Customization UI into Edit Modal
content = content.replace(
    '</ToggleSwitch>\n                </div>\n              </div>\n            </div>\n          )}\n\n          <DialogFooter',
    '</ToggleSwitch>\n                </div>\n              </div>\n              <CustomizationFields data={editCustomization} onChange={setEditCustomization} />\n            </div>\n          )}\n\n          <DialogFooter'
)

with open('app/admin/qr-links/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('QR Links patched successfully!')
