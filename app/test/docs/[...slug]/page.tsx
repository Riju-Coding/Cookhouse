import { Metadata } from "next"

interface TestPageProps {
    params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: TestPageProps): Promise<Metadata> {
  const resolvedParams = await params
  return {
    title: "Slug: " + resolvedParams.slug[2],
    description: "A page for testing dynamic routing in Next.js",
  }
}

export default async function TestPage({ params }: TestPageProps) {
  return (
    <div style={{ padding: 24 }}>
      <h1>Test Page {(await params).slug[2]}</h1>
      <p>This page is used for testing purposes.</p>
    </div>
  )
}