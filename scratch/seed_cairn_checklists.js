const fs = require('fs');
const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  writeBatch,
  serverTimestamp 
} = require('firebase/firestore');

// Load environment variables
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

// Cairn Facility Constants
const VENDOR_ID = 'X8TGaw7HnyzXXpcsA9HL'; // Cookhouse
const COMPANY_ID = 'EqRLIcgyfLtFPHDBSvFJ'; // Cairns
const ROLE_SUPERVISOR = 'pRLZZl26JcVhokLZXl7t'; // Supervisor
const ROLE_STAFF = 'BVDyE8PT0AmXcMiNwI6x'; // Staff

const SITES = {
  OB: {
    buildingId: 'XlXuTwn8gDkSqAxIZ8cQ',
    buildingName: 'OB',
    cafetariaId: 'Oq84I2KMMSKxvPtoi8rE',
    cafetariaName: 'OB',
  },
  MPT: {
    buildingId: 'HudpWZCFsUSp5UChILqJ',
    buildingName: 'MPT',
    cafetariaId: 'WGL0oJPV2ahMqDHavbs8',
    cafetariaName: 'MPT Cafe',
  }
};

// Load extracted templates JSON
const rawTemplates = JSON.parse(fs.readFileSync('C:/Cookhouseadmin-main/scratch/cairn_standardized_templates.json', 'utf8'));

console.log(`Loaded ${rawTemplates.length} base templates.`);

async function seedAll() {
  console.log("🚀 Starting Cairn Industrial Compliance Seeding (OB & MPT)...");

  let totalTemplatesSeeded = 0;
  let totalFieldsSeeded = 0;

  for (const base of rawTemplates) {
    const targetSites = [];
    if (base.building_applicability === 'OB' || base.building_applicability === 'BOTH') {
      targetSites.push({ key: 'OB', ...SITES.OB });
    }
    if (base.building_applicability === 'MPT' || base.building_applicability === 'BOTH') {
      targetSites.push({ key: 'MPT', ...SITES.MPT });
    }

    for (const site of targetSites) {
      const templateId = `cairn_${site.key.toLowerCase()}_${base.key}`;
      const templateName = `[Cairn - ${site.key}] ${base.title}`;

      // 1. Template Record
      const templateData = {
        name: templateName,
        type: 'general_checklist',
        vendorId: VENDOR_ID,
        companyId: COMPANY_ID,
        buildingId: site.buildingId,
        cafetariaId: site.cafetariaId,
        frequency: base.frequency || 'daily',
        assignedRole: ROLE_SUPERVISOR,
        scopeMode: 'hotel_facility',
        department: base.department,
        category: base.category,
        description: `${base.description} Operating standard for Cairn ${site.key} facility management.`,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await setDoc(doc(db, 'complianceTemplates', templateId), templateData);

      // Legacy form sync
      await setDoc(doc(db, 'complianceForms', templateId), {
        name: templateName,
        vendorId: VENDOR_ID,
        companyId: COMPANY_ID,
        buildingId: site.buildingId,
        cafetariaId: site.cafetariaId,
        frequency: base.frequency || 'daily',
        assignedRole: ROLE_SUPERVISOR,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      totalTemplatesSeeded++;

      // 2. Field Records in batches
      const questions = base.questions || [];
      const batchSize = 25;
      for (let i = 0; i < questions.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = questions.slice(i, i + batchSize);

        for (let j = 0; j < chunk.length; j++) {
          const qIdx = i + j;
          const q = chunk[j];
          const fieldId = `${templateId}_q${qIdx + 1}`;

          const fieldData = {
            templateId: templateId,
            question: q.question,
            type: q.type || 'yes_no',
            isRequired: q.isRequired !== false,
            isPhotoRequired: !!q.isPhotoRequired,
            order: qIdx + 1,
            unit: q.unit || null,
            options: q.options || null,
            servicePhase: 'none',
            createdAt: new Date(),
          };

          const fieldDocRef = doc(db, 'complianceTemplateFields', fieldId);
          batch.set(fieldDocRef, fieldData);

          // Legacy subForm sync
          const subFormDocRef = doc(db, 'complianceSubForms', fieldId);
          batch.set(subFormDocRef, {
            formId: templateId,
            question: q.question,
            type: q.type || 'yes_no',
            isRequired: q.isRequired !== false,
            isPhotoRequired: !!q.isPhotoRequired,
            order: qIdx + 1,
            unit: q.unit || null,
            options: q.options || null,
            createdAt: new Date(),
          });

          totalFieldsSeeded++;
        }

        await batch.commit();
      }

      console.log(`  ✓ Seeded '${templateName}' with ${questions.length} checkpoints.`);
    }
  }

  console.log(`\n🎉 SEEDING COMPLETED SUCCESSFULLY!`);
  console.log(`   Total Templates Seeded: ${totalTemplatesSeeded}`);
  console.log(`   Total Checkpoints / Questions Seeded: ${totalFieldsSeeded}`);
}

seedAll().then(() => process.exit(0)).catch(err => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
