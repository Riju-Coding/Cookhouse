const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Read .env.local for credentials
const envPath = path.resolve(__dirname, '..', '.env.local');
const envText = fs.readFileSync(envPath, 'utf8');

function getEnv(key) {
  const match = envText.match(new RegExp(`^${key}=(.*)$`, 'm'));
  if (!match) return null;
  let val = match[1].trim();
  if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
  return val.replace(/\\n/g, '\n');
}

const projectId = getEnv('FIREBASE_PROJECT_ID') || 'cookhouse-main';
const clientEmail = getEnv('FIREBASE_CLIENT_EMAIL');
const privateKey = getEnv('FIREBASE_PRIVATE_KEY');

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

async function inspect() {
  console.log("Checking Firestore collections...");
  
  const collections = ['ingredients', 'templates', 'menuItems', 'categories', 'recipes', 'recipeMaster'];
  
  for (const col of collections) {
    try {
      const snap = await db.collection(col).get();
      console.log(`\nCollection [${col}]: ${snap.docs.length} documents`);
      if (snap.docs.length > 0) {
        console.log(`Sample document from [${col}]:`);
        const sample = snap.docs[0].data();
        console.log("ID:", snap.docs[0].id);
        console.log(JSON.stringify(sample, null, 2).slice(0, 400));
        
        // Show first 5 names
        const names = snap.docs.slice(0, 10).map(d => d.data().name || d.data().title || d.id);
        console.log(`First 10 items in [${col}]:`, names);
      }
    } catch (err) {
      console.log(`Error checking [${col}]:`, err.message);
    }
  }
}

inspect().then(() => process.exit(0)).catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
