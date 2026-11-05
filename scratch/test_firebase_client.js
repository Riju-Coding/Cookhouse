const fs = require('fs');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc, query, limit } = require('firebase/firestore');

// Read .env.local
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

const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

console.log('Connecting with projectId:', firebaseConfig.projectId);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  try {
    const compSnap = await getDocs(collection(db, 'companies'));
    console.log(`Successfully fetched ${compSnap.size} companies:`);
    compSnap.forEach(d => {
      console.log(`  - [${d.id}] ${d.data().name}`);
    });

    const bldgSnap = await getDocs(collection(db, 'buildings'));
    console.log(`Successfully fetched ${bldgSnap.size} buildings:`);
    bldgSnap.forEach(d => {
      console.log(`  - [${d.id}] ${d.data().name} (companyId: ${d.data().companyId})`);
    });

    const roleSnap = await getDocs(collection(db, 'roles'));
    console.log(`Successfully fetched ${roleSnap.size} roles:`);
    roleSnap.forEach(d => {
      console.log(`  - [${d.id}] ${d.data().name} (key: ${d.data().key})`);
    });

    const tempSnap = await getDocs(collection(db, 'complianceTemplates'));
    console.log(`Successfully fetched ${tempSnap.size} compliance templates.`);
  } catch (err) {
    console.error('Firestore Error:', err);
  }
}

run().then(() => process.exit(0));
