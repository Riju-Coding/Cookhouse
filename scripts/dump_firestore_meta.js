const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const fs = require('fs');

const firebaseConfig = {
  apiKey: "AIzaSyAQAQw5i-ZQSCdEAUgMnk970vSh7SES1Kk",
  authDomain: "cookhouse-main.firebaseapp.com",
  databaseURL: "https://cookhouse-main-default-rtdb.firebaseio.com",
  projectId: "cookhouse-main",
  storageBucket: "cookhouse-main.firebasestorage.app",
  messagingSenderId: "884440480404",
  appId: "1:884440480404:web:25aa348feb697352939281",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function dumpMetadata() {
  console.log("Fetching all templates and menuItems from Firestore...");

  const [tmplSnap, menuSnap, ingSnap] = await Promise.all([
    getDocs(collection(db, 'templates')),
    getDocs(collection(db, 'menuItems')),
    getDocs(collection(db, 'ingredients'))
  ]);

  console.log(`Total Templates in Firestore: ${tmplSnap.docs.length}`);
  console.log(`Total MenuItems in Firestore: ${menuSnap.docs.length}`);
  console.log(`Total Ingredients in Firestore: ${ingSnap.docs.length}`);

  const templates = tmplSnap.docs.map(d => ({ id: d.id, name: d.data().name }));
  const menuItems = menuSnap.docs.map(d => ({ id: d.id, name: d.data().name, category: d.data().category || '' }));
  const ingredients = ingSnap.docs.map(d => ({
    id: d.id,
    name: d.data().name,
    templateId: d.data().templateId,
    packing: d.data().packing,
    u1: d.data().u1,
    u2: d.data().u2
  }));

  fs.writeFileSync('scratch/firestore_templates.json', JSON.stringify(templates, null, 2));
  fs.writeFileSync('scratch/firestore_menu_items.json', JSON.stringify(menuItems, null, 2));
  fs.writeFileSync('scratch/firestore_ingredients.json', JSON.stringify(ingredients, null, 2));

  console.log("Dumped to scratch/firestore_*.json successfully!");
}

dumpMetadata().then(() => process.exit(0)).catch(e => {
  console.error("Error:", e);
  process.exit(1);
});
