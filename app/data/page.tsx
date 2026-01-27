"use client"

import { useState } from "react"

export default function FirestoreDumpPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    const res = await fetch("/api/firestore-export")
    const json = await res.json()
    setData(json)
    setLoading(false)
  }

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "firestore-full-export.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>🔥 Firestore Full Export</h1>

      <button onClick={fetchData}>
        {loading ? "Fetching..." : "Extract ALL Collections"}
      </button>

      {data && (
        <button onClick={downloadJSON} style={{ marginLeft: 12 }}>
          ⬇ Download JSON
        </button>
      )}

      <pre
        style={{
          marginTop: 20,
          maxHeight: "70vh",
          overflow: "auto",
          background: "#111",
          color: "#0f0",
          padding: 16,
        }}
      >
        {data && JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}
