"use client"

import React from "react"
import { ComplianceBuilder } from "@/components/compliances/ComplianceBuilder"

export default function TemplateBuilderPage({ params }: { params: { id: string } }) {
  return (
    <ComplianceBuilder 
      templateId={params.id === "new" ? undefined : params.id} 
    />
  )
}