const fs = require('fs');
const content = fs.readFileSync('c:\\COOKHOUSEADMIN-MAIN\\components\\menu-edit-modal.tsx', 'utf-8');
const lines = content.split('\n');

const out = { interfaces: [], services: [], components: [] };
for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (line.startsWith('interface ')) {
    out.interfaces.push((i + 1) + ': ' + line.substring(0, 50));
  } else if (line.match(/^(export (default )?)?(const|function) [A-Z]/)) {
    out.components.push((i + 1) + ': ' + line.substring(0, 80));
  } else if (line.startsWith('const ') && line.includes('Service = {')) {
    out.services.push((i + 1) + ': ' + line.substring(0, 50));
  }
}
fs.writeFileSync('c:\\COOKHOUSEADMIN-MAIN\\temp-out.json', JSON.stringify(out, null, 2));
