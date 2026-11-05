const admin = require('firebase-admin');
const fs = require('fs');

// Read .env.local manually
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      env[key] = val;
    }
  }
});

const projectId = env.FIREBASE_PROJECT_ID || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = env.FIREBASE_CLIENT_EMAIL;
let privateKey = env.FIREBASE_PRIVATE_KEY;

if (privateKey) {
  privateKey = privateKey.replace(/\\n/g, '\n');
}

console.log('Project ID:', projectId);
console.log('Client Email:', clientEmail ? clientEmail.slice(0, 15) + '...' : 'none');
console.log('Private Key exists:', !!privateKey);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const db = admin.firestore();

async function checkCollections() {
  try {
    const companiesSnap = await db.collection('companies').get();
    console.log(`\n--- COMPANIES (${companiesSnap.size}) ---`);
    companiesSnap.forEach(doc => {
      console.log(`ID: ${doc.id} | Name: ${doc.data().name} | Code/Short: ${doc.data().code || doc.data().shortName || ''}`);
    });

    const buildingsSnap = await db.collection('buildings').get();
    console.log(`\n--- BUILDINGS (${buildingsSnap.size}) ---`);
    buildingsSnap.forEach(doc => {
      console.log(`ID: ${doc.id} | Name: ${doc.data().name} | CompanyId: ${doc.data().companyId}`);
    });

    const rolesSnap = await db.collection('roles').get();
    console.log(`\n--- ROLES (${rolesSnap.size}) ---`);
    rolesSnap.forEach(doc => {
      console.log(`ID: ${doc.id} | Name: ${doc.data().name} | Key: ${doc.data().key}`);
    });

    const templatesSnap = await db.collection('complianceTemplates').get();
    console.log(`\n--- EXISTING COMPLIANCE TEMPLATES (${templatesSnap.size}) ---`);
    templatesSnap.forEach(doc => {
      console.log(`ID: ${doc.id} | Name: ${doc.data().name} | Company: ${doc.data().companyId} | Building: ${doc.data().buildingId}`);
    });
  } catch (err) {
    console.error('Error connecting to Firestore:', err);
  }
}

checkCollections().then(() => process.exit(0));
