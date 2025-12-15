import { Suspense } from "react"
import CompanyMenuEditForm from "@/components/company-menu-edit-form"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditCompanyMenuPage({ params }: PageProps) {
  const { id } = await params

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Edit Company Menu</h1>
        <p className="text-muted-foreground">Update menu assignment details</p>
      </div>
      <Suspense fallback={<div>Loading...</div>}>
        <CompanyMenuEditForm menuId={id} />
      </Suspense>
    </main>
  )
}
