export const runtime = "nodejs";

import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebaseAdmin"

export async function GET() {
  try {
    const collections = await adminDb.listCollections()
    const data: any = {}

    for (const col of collections) {
      let snap

      try {
        snap = await col.orderBy("createdAt", "desc").limit(1).get()
      } catch {
        try {
          snap = await col.orderBy("datetime", "desc").limit(1).get()
        } catch {
          try {
            snap = await col.orderBy("updatedAt", "desc").limit(1).get()
          } catch {
            snap = await col.limit(1).get()
          }
        }
      }

      data[col.id] = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
    }

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
