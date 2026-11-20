import { useState } from 'react'
import { ScanFace, Trash2, Smartphone, ShieldCheck } from 'lucide-react'
import { api, useApi } from '../lib'
import { toast } from '../components/fx'
import { Card, PageHeader, Loading, ErrorMsg, Empty, Badge, Btn, Tabs, Modal, FormModal, Table } from '../components/ui'

const STATUS_LABEL: Record<string, string> = { none: 'No consent', consented: 'Consent given, not enrolled on phone', enrolled: 'Enrolled', revoked: 'Deleted' }

export default function FaceAttendance() {
  const [tab, setTab] = useState('Students')
  return (
    <>
      <PageHeader title="Face attendance" sub="Authorise the academy phone, record guardian consent, and review scans. Face data stays on the phone; this page only holds consent and attendance records." />
      <Tabs tabs={['Students', 'Phones', 'Scans today']} value={tab} onChange={setTab} />
      {tab === 'Students' ? <Students /> : tab === 'Phones' ? <Phones /> : <Scans />}
    </>
  )
}

function Students() {
  const { data, loading, error, reload } = useApi<any>('/api/face/students')
  const [sel, setSel] = useState<any>(null)
  const [q, setQ] = useState('')
  if (loading) return <Loading />
  if (error) return <ErrorMsg text={error} />
  const rows = (data?.students ?? []).filter((s: any) => (s.name + s.admission_no).toLowerCase().includes(q.toLowerCase()))
  const revoke = async (s: any) => {
    if (!confirm(`Delete face data for ${s.name}? The phone erases the template the next time it syncs.`)) return
    try { await api(`/api/face/students/${s.id}`, { method: 'DELETE' }); toast('Face data will be erased from the phone'); reload() } catch (e: any) { toast(e.message) }
  }
  return (
    <>
      <Card className="mb-4 flex gap-3 p-4 text-sm text-ink2">
        <ShieldCheck className="mt-0.5 shrink-0 text-brand" size={18} />
        <p>A student can only be enrolled on the phone after consent is recorded here. For a minor, a parent or guardian must give it. You can withdraw consent at any time, and the face template is then deleted from the phone.</p>
      </Card>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search students" aria-label="Search students" className="mb-3 w-full max-w-xs rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand" />
      <Table<any> rows={rows} empty="No students found" cols={[
        { head: 'Student', cell: (s) => <div><div className="font-semibold">{s.name}</div><div className="text-xs text-mute">{s.admission_no}{s.is_minor ? ' · minor' : ''}</div></div> },
        { head: 'Face data', cell: (s) => <Badge tone={s.status === 'enrolled' ? 'sent' : s.status === 'revoked' ? 'failed' : 'stored'}>{STATUS_LABEL[s.status]}</Badge> },
        { head: 'Guardian', cell: (s) => s.guardian_name ? `${s.guardian_name}${s.guardian_relation ? ` (${s.guardian_relation})` : ''}` : '-', className: 'hidden md:table-cell' },
        { head: 'Keep until', cell: (s) => s.retention_until ?? '-', className: 'hidden md:table-cell' },
        { head: '', cell: (s) => (
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setSel(s)}>{s.status === 'none' || s.status === 'revoked' ? 'Record consent' : 'Renew consent'}</Btn>
            {(s.status === 'consented' || s.status === 'enrolled') && <Btn variant="ghost" onClick={() => revoke(s)} aria-label={`Delete face data for ${s.name}`}><Trash2 size={15} /></Btn>}
          </div>
        ) },
      ]} />
      {sel && (
        <FormModal title={`Face consent: ${sel.name}`} submitLabel="Record consent" onClose={() => setSel(null)}
          fields={[
            { name: 'guardian_name', label: sel.is_minor ? 'Parent or guardian name' : 'Name (optional for adults)', required: sel.is_minor, span: 2 },
            { name: 'guardian_relation', label: 'Relation', defaultValue: sel.is_minor ? 'Parent' : 'Self' },
            { name: 'retention_days', label: 'Keep face data for (days)', type: 'number', defaultValue: 365 },
            { name: 'confirm', label: 'Type YES to confirm the guardian agreed to face recognition attendance', required: true, span: 2 },
          ]}
          onSubmit={async (v) => {
            if (String(v.confirm).trim().toUpperCase() !== 'YES') throw new Error('Type YES to confirm consent was given')
            await api(`/api/face/students/${sel.id}/consent`, { method: 'PUT', body: { ...v, confirm: true } })
            toast('Consent recorded. Enrol the face on the academy phone.'); reload()
          }} />
      )}
    </>
  )
}

function Phones() {
  const { data, loading, error, reload } = useApi<any>('/api/face/devices')
  const [adding, setAdding] = useState(false)
  const [code, setCode] = useState<{ code: string; name: string } | null>(null)
  if (loading) return <Loading />
  if (error) return <ErrorMsg text={error} />
  const devices: any[] = data?.devices ?? []
  const act = async (fn: () => Promise<any>, msg: string) => { try { await fn(); toast(msg); reload() } catch (e: any) { toast(e.message) } }
  return (
    <>
      <div className="mb-4 flex justify-end"><Btn onClick={() => setAdding(true)}><Smartphone size={16} /> Add phone</Btn></div>
      {!devices.length ? <Card><Empty text="No phone is authorised yet. Add the academy phone, then enter the pairing code in the GSA Face Attendance app." /></Card> : (
        <div className="space-y-3">
          {devices.map((d) => (
            <Card key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="flex items-center gap-2 font-bold">{d.name}<Badge tone={d.paired ? 'sent' : 'stored'}>{d.paired ? 'Paired' : 'Waiting for pairing'}</Badge></div>
                <div className="mt-1 text-xs text-mute">{d.last_seen ? `Last seen ${String(d.last_seen).slice(0, 16)} UTC` : 'Never connected'}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-sm text-mute">Scan mode
                  <select value={d.mode} onChange={(e) => act(() => api(`/api/face/devices/${d.id}`, { method: 'PATCH', body: { mode: e.target.value } }), `Phone now records ${e.target.value}`)} className="ml-2 rounded-md border border-line bg-white px-2 py-2 text-sm font-semibold">
                    <option>ENTRY</option><option>EXIT</option>
                  </select>
                </label>
                <Btn variant="ghost" onClick={async () => { try { const r = await api<any>(`/api/face/devices/${d.id}/pairing-code`, { method: 'POST' }); setCode({ code: r.code, name: d.name }) } catch (e: any) { toast(e.message) } }}>New pairing code</Btn>
                <Btn variant="ghost" onClick={() => confirm(`Revoke ${d.name}? It stops syncing immediately.`) && act(() => api(`/api/face/devices/${d.id}`, { method: 'DELETE' }), 'Phone revoked')}>Revoke</Btn>
              </div>
            </Card>
          ))}
        </div>
      )}
      {adding && (
        <FormModal title="Add a phone" submitLabel="Create pairing code" onClose={() => setAdding(false)}
          fields={[{ name: 'name', label: 'Phone name', required: true, defaultValue: 'Academy phone (iQOO 12)', span: 2 }, { name: 'mode', label: 'Records', type: 'select', options: [{ value: 'ENTRY', label: 'ENTRY' }, { value: 'EXIT', label: 'EXIT' }], defaultValue: 'ENTRY' }]}
          onSubmit={async (v) => { const r = await api<any>('/api/face/devices', { method: 'POST', body: v }); setCode({ code: r.code, name: v.name }); reload() }} />
      )}
      {code && (
        <Modal title={`Pair ${code.name}`} onClose={() => setCode(null)}>
          <p className="text-sm text-mute">Open GSA Face Attendance on the phone, choose Pair this phone, and enter:</p>
          <div className="my-4 rounded-lg bg-soft py-5 text-center font-mono text-3xl font-bold tracking-widest">{code.code}</div>
          <p className="text-xs text-mute">The code works once and expires in 15 minutes. Close this window when the phone has paired.</p>
        </Modal>
      )}
    </>
  )
}

function Scans() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const { data, loading, error } = useApi<any>(`/api/face/events?date=${date}`)
  return (
    <>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" className="mb-3 rounded-md border border-line bg-white px-3 py-2 text-sm" />
      {loading ? <Loading /> : error ? <ErrorMsg text={error} /> : (
        <Table<any> rows={data?.events ?? []} empty="No scans on this date" cols={[
          { head: 'Time', cell: (e) => e.att_time },
          { head: 'Student', cell: (e) => <div><div className="font-semibold">{e.student}</div><div className="text-xs text-mute">{e.admission_no}</div></div> },
          { head: 'Type', cell: (e) => <Badge tone={e.event_type === 'ENTRY' ? 'sent' : 'stored'}>{e.event_type}</Badge> },
          { head: 'How', cell: (e) => e.method === 'manual' ? `Manual${e.marked_by ? ` by ${e.marked_by}` : ''}` : <span className="inline-flex items-center gap-1"><ScanFace size={14} />Face {e.match_score ? `${Math.round(e.match_score * 100)}%` : ''}</span> },
          { head: 'Counted', cell: (e) => e.applied ? 'Yes' : 'Repeat scan', className: 'hidden md:table-cell' },
        ]} />
      )}
    </>
  )
}
