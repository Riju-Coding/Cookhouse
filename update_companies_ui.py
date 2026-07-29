import re

with open('app/admin/companies/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add usersService import
if 'import { usersService, type User }' not in content:
    content = content.replace(
        'import { toast } from "@/hooks/use-toast"',
        'import { toast } from "@/hooks/use-toast"\nimport { usersService, type User } from "@/lib/firestore/usersService"'
    )

# 2. Add users state
content = content.replace(
    'const [vendors, setVendors] = useState<Vendor[]>([]) // Store available vendors',
    'const [vendors, setVendors] = useState<Vendor[]>([]) // Store available vendors\n  const [users, setUsers] = useState<User[]>([])'
)

# 3. Fetch users in fetchData
old_fetch = '''      const [companiesRes, buildingsRes, vendorsRes] = await Promise.all([
        companiesService.getAll(),
        buildingsService.getAll(),
        vendorsService.getAll() // Fetch vendors
      ])

      setVendors(vendorsRes as Vendor[])'''

new_fetch = '''      const [companiesRes, buildingsRes, vendorsRes, usersRes] = await Promise.all([
        companiesService.getAll(),
        buildingsService.getAll(),
        vendorsService.getAll(), // Fetch vendors
        usersService.getAll() // Fetch users
      ])

      setVendors(vendorsRes as Vendor[])
      setUsers(usersRes as User[])'''

content = content.replace(old_fetch, new_fetch)

# 4. Add Company Users header
content = content.replace(
    '<TableHead>Assigned Vendors</TableHead>',
    '<TableHead>Company Users</TableHead>\n              <TableHead>Assigned Vendors</TableHead>'
)
# Update colspan for loading/empty states
content = content.replace('colSpan={7}', 'colSpan={8}')

# 5. Add Company Users cell
old_cell = '''                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                            {assignedVendors.length > 0 ? (
                                assignedVendors.map(v => <Badge key={v.id} variant="secondary" className="text-[10px] bg-green-50 text-green-700 border-green-200">{v.name}</Badge>)
                            ) : (
                                <span className="text-xs text-gray-400 italic">None assigned</span>
                            )}
                        </div>
                      </TableCell>'''

new_cell = '''                      <TableCell>
                        <div className="flex flex-col gap-1">
                            {users.filter(u => u.userType === 'company_user' && u.companyIds?.includes(company.id)).length > 0 ? (
                                users.filter(u => u.userType === 'company_user' && u.companyIds?.includes(company.id)).map(u => <span key={u.id} className="text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded-md">{u.email}</span>)
                            ) : (
                                <span className="text-xs text-gray-400 italic">Not assigned</span>
                            )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                            {assignedVendors.length > 0 ? (
                                assignedVendors.map(v => <Badge key={v.id} variant="secondary" className="text-[10px] bg-green-50 text-green-700 border-green-200">{v.name}</Badge>)
                            ) : (
                                <span className="text-xs text-gray-400 italic">None assigned</span>
                            )}
                        </div>
                      </TableCell>'''

content = content.replace(old_cell, new_cell)

with open('app/admin/companies/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
