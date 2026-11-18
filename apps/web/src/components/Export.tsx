import { FileDown, FileSpreadsheet, Share2 } from 'lucide-react'
import { exportPdf } from '../pdf'
import { Btn } from './ui'

export type ExportData = { title: string; subtitle?: string; head: string[]; rows: (string | number)[][]; filename: string }

/** Excel (.xlsx) download, built in the browser. */
export async function exportXlsx(o: ExportData) {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.aoa_to_sheet([o.head, ...o.rows])
  ws['!cols'] = o.head.map((h, i) => ({ wch: Math.min(40, Math.max(h.length, ...o.rows.map((r) => String(r[i] ?? '').length)) + 2) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, o.title.slice(0, 30).replace(/[\\/?*[\]:]/g, ' '))
  XLSX.writeFile(wb, o.filename.replace(/\.pdf$/, '') + '.xlsx')
}

/** PDF, share and Excel buttons for any list. */
export function ExportButtons({ share, ...o }: ExportData & { share?: boolean }) {
  const pdfName = o.filename.endsWith('.pdf') ? o.filename : o.filename + '.pdf'
  return (
    <>
      <Btn variant="ghost" onClick={() => exportPdf({ ...o, filename: pdfName })}><FileDown size={16} /> PDF</Btn>
      <Btn variant="ghost" onClick={() => exportXlsx(o)}><FileSpreadsheet size={16} /> Excel</Btn>
      {share && <Btn variant="ghost" onClick={() => exportPdf({ ...o, filename: pdfName, share: true })}><Share2 size={16} /> Share</Btn>}
    </>
  )
}
