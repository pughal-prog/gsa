import { useState } from 'react'
import { api, useApi } from '../lib'
import { Card, PageHeader, Table, Btn, Loading, ErrorMsg, Badge } from '../components/ui'

export default function Attendance() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const { data, loading, error, reload } = useApi<any>(`/api/attendance?date=${date}`)
  const [msg, setMsg] = useState('')
  const mark = async (id: number, status: 'present' | 'absent') => {
    setMsg('')
    try { await api('/api/attendance/manual', { body: { student_id: id, status } }); setMsg('Saved. Parent notified.'); reload() } catch (e: any) { setMsg(e.message) }
  }
  const rows: any[] = data?.attendance ?? []
  const count = (s: string) => rows.filter((r) => r.status === s).length
  return (
    <>
      <PageHeader title="Attendance" sub="Biometric check-ins appear here live. Use manual marking only if the device is down."
        action={<input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" className="rounded-xl border border-line bg-soft px-3 py-2 text-sm" />} />
      <div className="mb-4 flex flex-wrap gap-2"><Badge tone="present">{count('present')} present</Badge><Badge tone="late">{count('late')} late</Badge><Badge tone="absent">{count('absent')} absent</Badge><Badge tone="pending">{count('pending')} not yet in</Badge></div>
      {msg && <div className="mb-3 rounded-xl bg-soft p-3 text-sm" role="status">{msg}</div>}
      <Card>
        {loading ? <Loading /> : error ? <ErrorMsg text={error} /> : (
          <Table rows={rows} cols={[
            { head: 'Student', cell: (r: any) => <div><div className="font-medium">{r.name}</div><div className="text-xs text-mute">{r.admission_no}</div></div> },
            { head: 'Batch', cell: (r: any) => r.batch_time }, { head: 'Check-in', cell: (r: any) => r.check_in || '-' },
            { head: 'Status', cell: (r: any) => <Badge>{r.status}</Badge> }, { head: 'Source', cell: (r: any) => r.source || '-', className: 'hidden md:table-cell' },
            { head: '', cell: (r: any) => date === new Date().toISOString().slice(0, 10) && r.status === 'pending' ? (
              <div className="flex gap-1"><Btn variant="ghost" className="py-1 text-xs" onClick={() => mark(r.student_id, 'present')}>Present</Btn><Btn variant="danger" className="py-1 text-xs" onClick={() => mark(r.student_id, 'absent')}>Absent</Btn></div>) : null },
          ]} />
        )}
      </Card>
    </>
  )
}
