export interface StandeeOptions {
  url: string
  company: string
  building: string
  cafe: string
  style?: "criss_cross" | "diner"
}

export async function downloadStandeePdf(options: StandeeOptions): Promise<void> {
  const { url, company, building, cafe, style = "criss_cross" } = options
  const safeCompany = (company || "Company").replace(/[^a-zA-Z0-9_-]/g, "_")
  const safeBuilding = (building || "Building").replace(/[^a-zA-Z0-9_-]/g, "_")
  const safeCafe = (cafe || "Cafeteria").replace(/[^a-zA-Z0-9_-]/g, "_")
  const filename = `Cookhouse_Standee_6x2.5ft_${safeCompany}_${safeBuilding}_${safeCafe}_${style}.pdf`

  // 1. Try server-side PyMuPDF vector PDF generator
  try {
    const res = await fetch("/api/standee", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        company,
        building,
        cafe,
        style,
        format: "pdf",
      }),
    })

    if (res.ok) {
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = blobUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
      return
    }
  } catch (err) {
    console.warn("Server-side standee generation failed, trying client-side fallback...", err)
  }

  // 2. Client-side fallback using jsPDF (30in x 72in = 2160pt x 5184pt)
  const { jsPDF } = await import("jspdf")
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "in",
    format: [30, 72],
  })

  // Draw standee background & structure in PDF
  const pageW = 30
  const pageH = 72

  // Background
  pdf.setFillColor(248, 250, 252)
  pdf.rect(0, 0, pageW, pageH, "F")

  // Header band
  pdf.setFillColor(5, 150, 105)
  pdf.rect(0, 0, pageW, 1.2, "F")

  // Brand title
  pdf.setTextColor(15, 23, 42)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(54)
  pdf.text("cookhouse", pageW / 2, 4.5, { align: "center" })

  // Location Badge
  pdf.setFillColor(236, 253, 245)
  pdf.roundedRect(4, 5.5, pageW - 8, 1.2, 0.6, 0.6, "F")
  pdf.setTextColor(4, 120, 87)
  pdf.setFontSize(22)
  pdf.text(`${company.toUpperCase()} • ${building.toUpperCase()} • ${cafe.toUpperCase()}`, pageW / 2, 6.3, { align: "center" })

  // Headline
  pdf.setTextColor(15, 23, 42)
  pdf.setFontSize(48)
  pdf.text(style === "diner" ? "YOUR FEEDBACK MATTERS!" : "CLOSED-LOOP DINING EXPERIENCE", pageW / 2, 9, { align: "center" })

  pdf.setTextColor(5, 150, 105)
  pdf.setFontSize(28)
  pdf.text(style === "diner" ? "Help Us Improve Every Single Meal You Enjoy" : "Your Feedback. Instant Action. Guaranteed Resolution.", pageW / 2, 10.5, { align: "center" })

  // Standee steps / content description
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(71, 85, 105)
  pdf.setFontSize(20)
  pdf.text("Scan the tabletop QR code to rate dishes, request sanitization, or report facility issues.", pageW / 2, 12, { align: "center" })

  // Footer
  pdf.setFillColor(15, 23, 42)
  pdf.rect(0, pageH - 4, pageW, 4, "F")
  pdf.setTextColor(255, 255, 255)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(26)
  pdf.text("Enterprise Food Service Operations & Quality Compliance", pageW / 2, pageH - 2.2, { align: "center" })
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(18)
  pdf.setTextColor(148, 163, 184)
  pdf.text(`${company} • ${building} • ${cafe} | cookhouse.com`, pageW / 2, pageH - 1.2, { align: "center" })

  pdf.save(filename)
}
