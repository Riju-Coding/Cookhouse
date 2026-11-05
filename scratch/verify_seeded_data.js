const fs = require('fs');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');

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

async function verify() {
  console.log('--- FIRESTORE VERIFICATION FOR CAIRN ---');
  const obSnap = await getDocs(query(collection(db, 'complianceTemplates'), where('buildingId', '==', 'XlXuTwn8gDkSqAxIZ8cQ')));
  const mptSnap = await getDocs(query(collection(db, 'complianceTemplates'), where('buildingId', '==', 'HudpWZCFsUSp5UChILqJ')));
  console.log(`✅ Cairn OB Templates Seeded: ${obSnap.size}`);
  console.log(`✅ Cairn MPT Templates Seeded: ${mptSnap.size}`);

  console.log('\n--- SAMPLE TEMPLATES: CAIRN OB ---');
  obSnap.docs.slice(0, 5).forEach(d => console.log(`• [${d.id}] ${d.data().name} (${d.data().category})`));

  console.log('\n--- SAMPLE TEMPLATES: CAIRN MPT ---');
  mptSnap.docs.slice(0, 5).forEach(d => console.log(`• [${d.id}] ${d.data().name} (${d.data().category})`));

  console.log('\n--- SAMPLE CHECKPOINTS: Water Dispenser 12-Step SOP ---');
  const qSnap = await getDocs(query(collection(db, 'complianceTemplateFields'), where('templateId', '==', 'cairn_ob_water_dispenser_cleaning')));
  const sortedQ = qSnap.docs.map(d => d.data()).sort((a, b) => a.order - b.order);
  sortedQ.forEach(q => console.log(`  ${q.order}. ${q.question} ${q.isPhotoRequired ? '[📸 Photo Req]' : ''}`));

  console.log('\n--- SAMPLE CHECKPOINTS: Eye Wash Station Protocol ---');
  const eyeSnap = await getDocs(query(collection(db, 'complianceTemplateFields'), where('templateId', '==', 'cairn_ob_eye_wash_refilling')));
  const sortedEye = eyeSnap.docs.map(d => d.data()).sort((a, b) => a.order - b.order);
  sortedEye.forEach(q => console.log(`  ${q.order}. ${q.question} [Type: ${q.type}]`));

  console.log('\n--- SAMPLE CHECKPOINTS: Staff Grooming Audit Card ---');
  const groomSnap = await getDocs(query(collection(db, 'complianceTemplateFields'), where('templateId', '==', 'cairn_ob_grooming_check_card')));
  const sortedGroom = groomSnap.docs.map(d => d.data()).sort((a, b) => a.order - b.order);
  sortedGroom.forEach(q => console.log(`  ${q.order}. ${q.question}`));
}

verify().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
