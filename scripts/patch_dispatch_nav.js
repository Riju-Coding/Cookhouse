const fs = require('fs');

const file = 'C:/COOKHOUSEADMIN-MAIN/components/admin/admin-layout.tsx';
let c = fs.readFileSync(file, 'utf8');

if (!c.includes('Truck,')) {
  c = c.replace(/ChefHat,/g, 'ChefHat,\n  Truck,');
}

const target = '{ name: "Recipe Master", href: "/admin/recipes", icon: ChefHat, category: "meals" },';
const addition = '\n  { name: "Daily Food Dispatch", href: "/admin/dispatch", icon: Truck, category: "menu-management" },';

if (!c.includes('/admin/dispatch')) {
  c = c.replace(target, target + addition);
}

fs.writeFileSync(file, c, 'utf8');
console.log('Successfully patched admin-layout.tsx!');

// Also patch access-management
const accessFile = 'C:/COOKHOUSEADMIN-MAIN/app/admin/access-management/page.tsx';
if (fs.existsSync(accessFile)) {
  let ac = fs.readFileSync(accessFile, 'utf8');
  if (!ac.includes('"/admin/dispatch"')) {
    ac = ac.replace('"/admin/recipes": "meals",', '"/admin/recipes": "meals",\n    "/admin/dispatch": "menu-management",');
    ac = ac.replace('"/admin/company-menus",', '"/admin/dispatch", "/admin/company-menus",');
    fs.writeFileSync(accessFile, ac, 'utf8');
    console.log('Successfully patched access-management/page.tsx!');
  }
}
