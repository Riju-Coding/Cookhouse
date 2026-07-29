import { db } from "./lib/firebase"
import { collection, getDocs } from "firebase/firestore"

async function checkData() {
  const usersSnap = await getDocs(collection(db, "users"))
  console.log("USERS:")
  usersSnap.forEach(doc => {
    const data = doc.data()
    if (data.userType === "company_user") {
      console.log(`- ${doc.id}: email=${data.email}, companyIds=${JSON.stringify(data.companyIds)}, roleId=${data.roleId}`)
    }
  })

  const pathsSnap = await getDocs(collection(db, "access_paths"))
  console.log("\nACCESS PATHS:")
  pathsSnap.forEach(doc => {
    const data = doc.data()
    console.log(`- ${doc.id}: entityId=${data.entityId}, entityName=${data.entityName}, userType=${data.userType}, roleId=${data.roleId}, routes=${data.allowedRoutes?.length}`)
  })
}

checkData().then(() => process.exit(0))
