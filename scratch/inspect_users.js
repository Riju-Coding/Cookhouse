const fs = require('fs');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit, query } = require('firebase/firestore');

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

async function inspectUsers() {
  const snap = await getDocs(query(collection(db, 'users'), limit(15)));
  console.log(`Found ${snap.size} users:`);
  snap.forEach(d => {
    const u = d.data();
    console.log(`[${d.id}] ${u.name || u.email}`);
    console.log(`   roleId: ${u.roleId} | roleKey: ${u.roleKey} | userType: ${u.userType}`);
    console.log(`   companies: ${JSON.stringify(u.companyIds || [])}`);
    console.log(`   buildings: ${JSON.stringify(u.buildingIds || [])}`);
    console.log(`   cafeterias: ${JSON.stringify(u.cafeteriaIds || [])}`);
  });
}

inspectUsers().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
