import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

/**
 * GET /api/routes
 * Scans the app/admin directory to discover all page routes.
 * Returns a structured list of routes with their labels derived from folder names.
 */
export async function GET() {
  try {
    const appDir = path.join(process.cwd(), "app", "admin")
    const routes: { path: string; label: string; category: string }[] = []

    function scanDir(dir: string, routePrefix: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) continue

        // Skip special Next.js directories
        if (entry.name.startsWith("_") || entry.name.startsWith(".") || entry.name.startsWith("(")) continue

        const fullPath = path.join(dir, entry.name)
        const routePath = `${routePrefix}/${entry.name}`

        // Check if this directory has a page.tsx (is a route)
        const hasPage = fs.existsSync(path.join(fullPath, "page.tsx")) ||
                       fs.existsSync(path.join(fullPath, "page.ts")) ||
                       fs.existsSync(path.join(fullPath, "page.jsx")) ||
                       fs.existsSync(path.join(fullPath, "page.js"))

        if (hasPage) {
          // Convert folder name to human-readable label
          const label = entry.name
            .split("-")
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ")

          routes.push({
            path: routePath,
            label,
            category: "admin",
          })
        }

        // Recursively scan subdirectories
        scanDir(fullPath, routePath)
      }
    }

    scanDir(appDir, "/admin")

    // Sort alphabetically
    routes.sort((a, b) => a.path.localeCompare(b.path))

    return NextResponse.json({
      routes,
      total: routes.length,
      scannedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error("Route scanning error:", error)
    return NextResponse.json(
      { error: "Failed to scan routes", message: error.message },
      { status: 500 }
    )
  }
}
