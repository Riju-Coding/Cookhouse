import re

with open('app/admin/meal-plan-structure/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Make sure isSuperAdmin is extracted
if 'const { userProfile, userType } = useAuth()' in content:
    content = content.replace(
        'const { userProfile, userType } = useAuth()',
        'const { userProfile, userType, isSuperAdmin } = useAuth()'
    )

# Disable checkboxes
content = content.replace('<Checkbox ', '<Checkbox disabled={!isSuperAdmin} ')
content = content.replace('<Checkbox\n', '<Checkbox disabled={!isSuperAdmin}\n')

# Hide main Save Structure Button
content = content.replace(
    '<Button onClick={handleSaveStructure}',
    '{isSuperAdmin && <Button onClick={handleSaveStructure}'
)
content = content.replace(
    'Save Changes\n              </Button>',
    'Save Changes\n              </Button>}'
)

# Hide modals confirm buttons
content = content.replace(
    '<Button\n              onClick={handleCopyStructureToBuildings}',
    '{isSuperAdmin && <Button\n              onClick={handleCopyStructureToBuildings}'
)
content = content.replace(
    'Confirm Copy\n            </Button>',
    'Confirm Copy\n            </Button>}'
)

content = content.replace(
    '<Button onClick={handleConfirmChoice}',
    '{isSuperAdmin && <Button onClick={handleConfirmChoice}'
)
content = content.replace(
    'Confirm & Proceed\n              </Button>',
    'Confirm & Proceed\n              </Button>}'
)

content = content.replace(
    '<Button onClick={handleConfirmCopyChoice}',
    '{isSuperAdmin && <Button onClick={handleConfirmCopyChoice}'
)
content = content.replace(
    'Confirm Copy\n            </Button>',
    'Confirm Copy\n            </Button>}'
)

content = content.replace(
    '<Button onClick={() => setIsCopyMpSelectedDays(DAYS)}',
    '{isSuperAdmin && <Button onClick={() => setIsCopyMpSelectedDays(DAYS)}'
)
content = content.replace(
    'Select All\n                  </Button>',
    'Select All\n                  </Button>}'
)

content = content.replace(
    '<Button onClick={handleConfirmCopyMp}',
    '{isSuperAdmin && <Button onClick={handleConfirmCopyMp}'
)
content = content.replace(
    'Confirm Copy\n                </Button>',
    'Confirm Copy\n                </Button>}'
)

# Hide main Action dropdown / Edit / Delete buttons within structure
content = content.replace(
    '<DropdownMenuTrigger asChild>\n                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">',
    '{isSuperAdmin && <DropdownMenuTrigger asChild>\n                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">'
)
content = content.replace(
    '<MoreVertical className="h-4 w-4" />\n                              </Button>\n                            </DropdownMenuTrigger>',
    '<MoreVertical className="h-4 w-4" />\n                              </Button>\n                            </DropdownMenuTrigger>}'
)

# Add sub-service button
content = content.replace(
    '<Button variant="outline" size="sm" onClick={() => setIsModalOpen(true)}',
    '{isSuperAdmin && <Button variant="outline" size="sm" onClick={() => setIsModalOpen(true)}'
)
content = content.replace(
    'Add Service / Sub-Service\n                </Button>',
    'Add Service / Sub-Service\n                </Button>}'
)

with open('app/admin/meal-plan-structure/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patch successful!")
