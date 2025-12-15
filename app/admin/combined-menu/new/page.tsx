import { Suspense } from "react"
import CombinedMenuEditForm from "@/components/combined-menu-edit-form"

export default function NewMenuPage() {
  return (
    <main className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Create New Combined Menu</h1>
        <p className="text-muted-foreground">Set up a new menu configuration</p>
      </div>
      <Suspense fallback={<div>Loading...</div>}>
        <CombinedMenuEditForm menuId="new" />
      </Suspense>
    </main>
  )
}
