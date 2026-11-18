import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export type PdfOpts = { title: string; subtitle?: string; head: string[]; rows: (string | number)[][]; filename: string; share?: boolean }

/** Builds a branded PDF. share=true opens the phone/browser share sheet where supported, otherwise downloads. */
export async function exportPdf(o: PdfOpts) {
  const doc = new jsPDF({ orientation: o.head.length > 6 ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' })
  const w = doc.internal.pageSize.getWidth()
  doc.setFillColor(11, 74, 162); doc.rect(0, 0, w, 54, 'F')
  doc.setTextColor(255); doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.text('Global Sports Academy', 40, 28)
  doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.text('Nochipattiyar Thottam, Mudhalaipatti, Namakkal  |  9042999507', 40, 44)
  doc.setTextColor(20); doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.text(o.title, 40, 84)
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100)
  doc.text([o.subtitle, `Generated ${new Date().toLocaleString('en-IN')}`].filter(Boolean).join('   |   '), 40, 100)
  autoTable(doc, { startY: 112, head: [o.head], body: o.rows.map((r) => r.map((x) => String(x ?? '-'))), styles: { fontSize: 9, cellPadding: 5 }, headStyles: { fillColor: [11, 74, 162] }, alternateRowStyles: { fillColor: [243, 246, 251] }, margin: { left: 40, right: 40 } })
  const blob = doc.output('blob')
  const file = new File([blob], o.filename, { type: 'application/pdf' })
  const nav = navigator as any
  if (o.share && nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title: o.title }); return } catch { /* cancelled, fall through to download */ }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = o.filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}
