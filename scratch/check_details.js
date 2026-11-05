const fs = require('fs');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  }
});

const app = initializeApp({
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});
const db = getFirestore(app);

async function run() {
  const vendorsSnap = await getDocs(collection(db, 'vendors'));
  console.log(`\n--- VENDORS (${vendorsSnap.size}) ---`);
  vendorsSnap.forEach(d => console.log(`[${d.id}] ${d.data().name}`));

  const cafesSnap = await getDocs(collection(db, 'cafetarias'));
  console.log(`\n--- CAFETARIAS for Cairns (${cafesSnap.size} total) ---`);
  cafesSnap.forEach(d => {
    if (d.data().companyId === 'EqRLIcgyfLtFPHDBSvFJ') {
      console.log(`[${d.id}] ${d.data().name} | bldg: ${d.data().buildingId}`);
    }
  });

  const tempSnap = await getDocs(collection(db, 'complianceTemplates'));
  console.log(`\n--- EXISTING COMPLIANCE TEMPLATES (${tempSnap.size}) ---`);
  tempSnap.forEach(d => {
    const data = d.data();
    console.log(`[${d.id}] ${data.name} | Type: ${data.type} | Company: ${data.companyId} | Bldg: ${data.buildingId}`);
  });
}

run().then(() => process.exit(0));
