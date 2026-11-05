const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit, query } = require('firebase/firestore');

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

async function run() {
  console.log("Connecting to Firestore with Client SDK...");
  
  for (const col of ['templates', 'ingredients', 'menuItems', 'recipes', 'categories']) {
    try {
      const snap = await getDocs(query(collection(db, col), limit(25)));
      console.log(`\nCollection [${col}] count in sample: ${snap.docs.length}`);
      if (snap.docs.length > 0) {
        console.log(`First doc ID: ${snap.docs[0].id}`);
        console.log("Sample doc data:", JSON.stringify(snap.docs[0].data(), null, 2).slice(0, 300));
        const names = snap.docs.map(d => d.data().name || d.data().title || d.id);
        console.log(`Sample names in [${col}]:`, names.slice(0, 10));
      }
    } catch (e) {
      console.log(`Error querying [${col}]:`, e.message);
    }
  }
}

run().then(() => process.exit(0)).catch(e => {
  console.error("Fatal:", e);
  process.exit(1);
});
