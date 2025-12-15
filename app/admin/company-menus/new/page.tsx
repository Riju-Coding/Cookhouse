import { Suspense } from "react"
import CompanyMenuEditForm from "@/components/company-menu-edit-form"

export default function NewCompanyMenuPage() {
  return (
    <main className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Assign Menu to Company</h1>
        <p className="text-muted-foreground">Create a new company menu assignment</p>
      </div>
      <Suspense fallback={<div>Loading...</div>}>
        <CompanyMenuEditForm menuId="new" />
      </Suspense>
    </main>
  )
}
