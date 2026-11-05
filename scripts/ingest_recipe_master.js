const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  doc, 
  writeBatch, 
  serverTimestamp, 
  getCountFromServer,
  getDocs,
  limit,
  query
} = require('firebase/firestore');

// Firebase client config for cookhouse-main
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

const DATA_FILE = path.resolve('C:/compliances/CatterCom/scratch/full_recipes_master.json');
const TARGET_COLLECTION = 'recipeMaster';
const BATCH_SIZE = 200; // Safe chunk size below Firestore 500 limit

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function commitBatchWithRetry(batch, batchIndex, totalBatches, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await batch.commit();
      return true;
    } catch (err) {
      console.warn(`[Batch ${batchIndex}/${totalBatches}] Commit attempt ${attempt} failed: ${err.message}`);
      if (attempt < maxRetries) {
        const backoff = attempt * 2000;
        console.log(`Waiting ${backoff}ms before retry...`);
        await sleep(backoff);
      } else {
        throw err;
      }
    }
  }
}

async function run() {
  console.log(`=== LIVE RECIPE MASTER INGESTION ===`);
  console.log(`Target Collection: ${TARGET_COLLECTION} in project: ${firebaseConfig.projectId}`);
  console.log(`Reading prepared dataset from: ${DATA_FILE}`);

  if (!fs.existsSync(DATA_FILE)) {
    throw new Error(`Data file not found at ${DATA_FILE}`);
  }

  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const recipes = JSON.parse(raw);
  console.log(`Loaded ${recipes.length} recipes to ingest.\n`);

  const totalBatches = Math.ceil(recipes.length / BATCH_SIZE);
  console.log(`Total batches to process: ${totalBatches} (batch size: ${BATCH_SIZE})\n`);

  const startTime = Date.now();
  let committedCount = 0;

  for (let i = 0; i < recipes.length; i += BATCH_SIZE) {
    const chunk = recipes.slice(i, i + BATCH_SIZE);
    const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
    const batch = writeBatch(db);

    chunk.forEach(recipe => {
      // Deterministic document ID: recipe_<oldRecipeId>
      const docRef = doc(db, TARGET_COLLECTION, recipe.id);
      
      const payload = {
        oldRecipeId: recipe.oldRecipeId,
        name: recipe.name,
        menuItemId: recipe.menuItemId || null,
        menuItemName: recipe.menuItemName || null,
        category: recipe.category || '',
        categoryId: recipe.categoryId || 0,
        inGram: recipe.inGram || 0,
        isPiece: recipe.isPiece || 0,
        status: recipe.status || 'active',
        ingredientsCount: recipe.ingredientsCount || recipe.ingredients.length,
        ingredients: recipe.ingredients || [],
        variations: recipe.variations || {
          standard: {
            variationName: 'Standard Recipe',
            rateTier: 'standard',
            season: 'all'
          }
        },
        source: 'sql_migration',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      batch.set(docRef, payload, { merge: true });
    });

    console.log(`[Batch ${batchIndex}/${totalBatches}] Committing ${chunk.length} recipes...`);
    await commitBatchWithRetry(batch, batchIndex, totalBatches);
    committedCount += chunk.length;
    console.log(`[Batch ${batchIndex}/${totalBatches}] Committed successfully. Total so far: ${committedCount}/${recipes.length}`);

    // Small delay between batches to be gentle on network
    if (batchIndex < totalBatches) {
      await sleep(300);
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nAll ${committedCount} recipes committed in ${durationSec}s!`);

  // Verify by querying count
  console.log(`\nVerifying live collection count in Firestore...`);
  try {
    const collRef = collection(db, TARGET_COLLECTION);
    const countSnap = await getCountFromServer(collRef);
    console.log(`=== LIVE VERIFICATION: ${countSnap.data().count} documents in ${TARGET_COLLECTION} ===`);
  } catch (countErr) {
    console.log(`Count query fallback: fetching sample docs...`);
    const qSnap = await getDocs(query(collection(db, TARGET_COLLECTION), limit(5)));
    console.log(`Successfully fetched sample docs from ${TARGET_COLLECTION}: ${qSnap.size} docs retrieved.`);
  }

  console.log(`\nIngestion completed successfully!`);
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(`\nIngestion failed with error:`, err);
    process.exit(1);
  });
