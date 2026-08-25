import { NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { collection, addDoc, getDocs, query, where } from "firebase/firestore"

export async function GET() {
  try {
    const permissionsRef = collection(db, "permissions")
    
    const requiredPermissions = [
      {
        name: "Can Request Changes",
        key: "CAN_REQUEST_CHANGES",
        description: "Allows the user to submit change requests for structures and menus, rather than editing directly.",
        pageName: "Vendor Operations",
        status: "active"
      },
      {
        name: "Can Approve Requests",
        key: "CAN_APPROVE_REQUESTS",
        description: "Allows the user to review and approve change requests from companies or staff.",
        pageName: "Vendor Operations",
        status: "active"
      },
      {
        name: "Can Direct Edit",
        key: "CAN_DIRECT_EDIT",
        description: "Bypasses the approval flow, allowing direct edits to live structures and menus.",
        pageName: "Vendor Operations",
        status: "active"
      }
    ]

    const results = []

    for (const perm of requiredPermissions) {
      const q = query(permissionsRef, where("key", "==", perm.key))
      const snapshot = await getDocs(q)
      
      if (snapshot.empty) {
        const docRef = await addDoc(permissionsRef, {
          ...perm,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        results.push(`Added ${perm.key} (${docRef.id})`)
      } else {
        results.push(`Skipped ${perm.key} (Already exists)`)
      }
    }

    return NextResponse.json({ success: true, results })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message })
  }
}
