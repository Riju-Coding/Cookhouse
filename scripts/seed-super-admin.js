/**
 * Seed Script — Super Admin Role & User
 * 
 * Run this once to set up the initial Super Admin role and user in Firestore.
 * 
 * Usage:
 *   1. Open browser console on your running app
 *   2. Paste this script and run it
 *   
 * OR run via Node.js with your Firebase config (requires firebase-admin)
 * 
 * This creates:
 *   1. A "Super Admin" role in the 'roles' collection with isSystem: true
 *   2. Updates the it-team@cookhouse.in user doc with userType: "super_admin"
 */

// === RUN IN BROWSER CONSOLE ===
// Navigate to your app first, then paste in console:

async function seedSuperAdmin() {
  // Import from the already-loaded Firebase SDK
  const { collection, addDoc, query, where, getDocs, updateDoc, doc, serverTimestamp } = await import('firebase/firestore');
  
  // Get the db instance from window (the app already initializes it)
  const { db } = await import('/lib/firebase');

  console.log("🔧 Starting Super Admin seed...");

  // 1. Check if Super Admin role already exists
  const rolesQuery = query(collection(db, 'roles'), where('key', '==', 'SUPER_ADMIN'));
  const rolesSnap = await getDocs(rolesQuery);

  let superAdminRoleId = '';

  if (rolesSnap.empty) {
    console.log("📝 Creating Super Admin role...");
    const roleRef = await addDoc(collection(db, 'roles'), {
      name: "Super Admin",
      key: "SUPER_ADMIN",
      userType: "super_admin",
      permissions: { ALL: true },
      status: "active",
      isSystem: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    superAdminRoleId = roleRef.id;
    console.log(`✅ Super Admin role created with ID: ${superAdminRoleId}`);
  } else {
    superAdminRoleId = rolesSnap.docs[0].id;
    console.log(`✅ Super Admin role already exists: ${superAdminRoleId}`);
    
    // Update existing role to ensure it has the new fields
    await updateDoc(doc(db, 'roles', superAdminRoleId), {
      userType: "super_admin",
      isSystem: true,
      updatedAt: serverTimestamp(),
    });
    console.log("📝 Updated existing role with new fields");
  }

  // 2. Update the it-team@cookhouse.in user
  const usersQuery = query(collection(db, 'users'), where('email', '==', 'it-team@cookhouse.in'));
  const usersSnap = await getDocs(usersQuery);

  if (usersSnap.empty) {
    console.log("📝 Creating it-team@cookhouse.in user doc...");
    await addDoc(collection(db, 'users'), {
      name: "Cookhouse IT Team",
      email: "it-team@cookhouse.in",
      phone: "",
      userType: "super_admin",
      roleId: superAdminRoleId,
      roleKey: "SUPER_ADMIN",
      vendorId: "",
      companyIds: [],
      buildingIds: [],
      cafeteriaIds: [],
      managerId: "",
      status: "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log("✅ Super Admin user created");
  } else {
    const userId = usersSnap.docs[0].id;
    await updateDoc(doc(db, 'users', userId), {
      userType: "super_admin",
      roleId: superAdminRoleId,
      roleKey: "SUPER_ADMIN",
      updatedAt: serverTimestamp(),
    });
    console.log(`✅ Updated existing user ${userId} with super_admin type`);
  }

  console.log("\n🎉 Super Admin seed complete!");
  console.log(`   Role ID: ${superAdminRoleId}`);
  console.log(`   User: it-team@cookhouse.in`);
  console.log(`   Type: super_admin`);
}

// Run the seed
seedSuperAdmin().catch(console.error);
