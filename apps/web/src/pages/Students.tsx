import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Trash2, FileDown } from 'lucide-react'
import { exportPdf } from '../pdf'
import { api, useApi, useAuth, can, inr, age } from '../lib'
import { Card, PageHeader, Table, Btn, Loading, ErrorMsg, Badge, AuthImg, FormModal, Modal } from '../components/ui'
import { studentFields } from './StudentDetail'
import { DeleteStudent } from '../components/DeleteStudent'

export default function Students() {
  const { me } = useAuth()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [sport, setSport] = useState('')
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<any>(null)
  const [created, setCreated] = useState<{ username: string; tempPassword: string } | null>(null)
  const { data, loading, error, reload } = useApi<any>(`/api/students?q=${encodeURIComponent(q)}&sport=${sport}`)
  const sports = useApi<any>('/api/sports')
  return (
    <>
      <PageHeader title="Students" sub={me?.role === 'staff' ? 'Students assigned to you' : 'All enrolled athletes'}
        action={<div className="flex gap-2"><Btn variant="ghost" onClick={() => exportPdf({ title: 'Student list', head: ['Admission', 'Name', 'Sports', 'Parent', 'Phone', 'Pending fees'], rows: (data?.students ?? []).map((s: any) => [s.admission_no, s.name, s.sports || '-', s.parent_name || '-', s.parent_phone || '-', inr(s.pending_fees)]), filename: 'students.pdf' })}><FileDown size={16} /> PDF</Btn>
          {can(me, 'students.edit') && <Btn onClick={() => setAdding(true)}><Plus size={16} /> Add student</Btn>}</div>} />
      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative min-w-60 flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or admission no." aria-label="Search students"
              className="w-full rounded-md border border-line bg-soft py-2 pl-9 pr-3 text-sm outline-none focus:border-brand" />
          </div>
          <select value={sport} onChange={(e) => setSport(e.target.value)} aria-label="Filter by sport" className="rounded-md border border-line bg-soft px-3 py-2 text-sm">
            <option value="">All sports</option>
            {sports.data?.sports.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {loading ? <Loading /> : error ? <ErrorMsg text={error} /> : (
          <Table rows={data.students} onRow={(r: any) => nav(`/app/students/${r.id}`)} cols={[
            { head: 'Student', cell: (r: any) => <div className="flex items-center gap-3"><AuthImg k={r.photo_key} alt="" className="h-9 w-9 rounded-full" /><div><div className="font-medium">{r.name}</div><div className="text-xs text-mute">{r.admission_no} · {age(r.dob) ?? '-'} yrs</div></div></div> },
            { head: 'Sports', cell: (r: any) => r.sports || '-' },
            { head: 'Parent', cell: (r: any) => <div>{r.parent_name}<div className="text-xs text-mute">{r.parent_phone}</div></div>, className: 'hidden md:table-cell' },
            { head: 'Fees pending', cell: (r: any) => r.pending_fees > 0 ? <span className="text-warn">{inr(r.pending_fees)}</span> : <Badge tone="paid">Clear</Badge> },
            { head: 'Status', cell: (r: any) => <Badge>{r.status}</Badge>, className: 'hidden sm:table-cell' },
            ...(me?.role === 'owner' ? [{ head: '', cell: (r: any) => (
              <button aria-label={`Delete ${r.name}`} title="Delete student" onClick={(e) => { e.stopPropagation(); setDeleting(r) }} className="rounded-lg p-2 text-mute hover:bg-danger/10 hover:text-danger"><Trash2 size={16} /></button>) }] : []),
          ]} />
        )}
      </Card>
      {deleting && <DeleteStudent s={deleting} onClose={() => setDeleting(null)} onDone={reload} />}
      {adding && <FormModal title="Add student" fields={studentFields} onClose={() => setAdding(false)} submitLabel="Create student & login"
        onSubmit={async (v) => { const r = await api('/api/students', { body: v }); setCreated(r); reload() }} />}
      {created && (
        <Modal title="Student login created" onClose={() => setCreated(null)}>
          <p className="text-sm text-mute">Share these with the parent now. The password is shown only once and must be changed at first sign-in.</p>
          <div className="mt-4 rounded-md bg-soft p-4 font-mono text-sm"><div>User ID: <b className="text-brand">{created.username}</b></div><div>Password: <b className="text-brand">{created.tempPassword}</b></div></div>
          <div className="mt-4 text-right"><Btn onClick={() => setCreated(null)}>Done</Btn></div>
        </Modal>
      )}
    </>
  )
}
