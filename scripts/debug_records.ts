import { db } from "../lib/firebase";
import { collection, getDocs } from "firebase/firestore";

async function run() {
  const snap = await getDocs(collection(db, "complianceRecords"));
  console.log(`Total records: ${snap.size}`);
  snap.docs.forEach(d => {
    const data = d.data();
    console.log(`Record ID: ${d.id}`);
    console.log(`  Template: ${data.templateName}`);
    console.log(`  Status: ${data.status}`);
    console.log(`  Date: ${data.date}`);
    console.log(`  Company: ${data.companyId}`);
    console.log(`  Building: ${data.buildingId}`);
  });
}

run();
