import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Plus, ArrowLeft, ShieldCheck } from 'lucide-react'
import { api, useApi, useAuth, inr, fdate, age } from '../lib'
import { Card, PageHeader, Table, Btn, Loading, ErrorMsg, Badge, FormModal, Modal, Field, Stat, Empty } from '../components/ui'

const PERMS: [string, string][] = [
  ['students.view', 'View assigned students'], ['students.viewAll', 'View all students'], ['students.edit', 'Add and edit students'],
  ['attendance.mark', 'Mark attendance'], ['achievements.edit', 'Add achievements, matches, photos'], ['fees.view', 'View fees'],
  ['fees.collect', 'Collect fees and create bills'], ['equipment.view', 'View equipment stock'],
  ['students.contact', 'See parent phone and address'], ['students.medical', 'See and edit medical info'],
]

const staffFields = (sports: any[]): Field[] => [
  { name: 'name', label: 'Full name', required: true }, { name: 'email', label: 'Email (for Google sign-in)', type: 'email' },
  { name: 'dob', label: 'Date of birth', type: 'date' }, { name: 'phone', label: 'Phone', type: 'tel' },
  { name: 'primary_sport_id', label: 'Primary sport', type: 'select', options: sports.map((s) => ({ value: s.id, label: s.name })) },
  { name: 'experience_years', label: 'Experience (years)', type: 'number' }, { name: 'category', label: 'Category (e.g. National referee)' },
  { name: 'major_domain', label: 'Major domain' }, { name: 'joined_on', label: 'Joined on', type: 'date' },
  { name: 'training', label: 'Training / certifications', type: 'textarea' }, { name: 'achievements', label: 'Achievements', type: 'textarea' },
]

export default function Staff() {
  const nav = useNavigate()
  const { data, loading, error, reload } = useApi<any>('/api/staff')
  const sports = useApi<any>('/api/sports').data?.sports ?? []
  const [adding, setAdding] = useState(false)
  const [created, setCreated] = useState<any>(null)
  return (
    <>
      <PageHeader title="Staff" sub="Coaches and staff. Access is controlled per person." action={<Btn onClick={() => setAdding(true)}><Plus size={16} /> Add staff</Btn>} />
      <Card>
        {loading ? <Loading /> : error ? <ErrorMsg text={error} /> : (
          <Table rows={data.staff} onRow={(r: any) => nav(`/app/staff/${r.id}`)} cols={[
            { head: 'Name', cell: (r: any) => <div><div className="font-medium">{r.name}</div><div className="text-xs text-mute">{age(r.dob) ?? '-'} yrs</div></div> },
            { head: 'Sport', cell: (r: any) => r.sport || '-' }, { head: 'Category', cell: (r: any) => r.category || '-' },
            { head: 'Experience', cell: (r: any) => `${r.experience_years ?? 0} yrs` }, { head: 'Students', cell: (r: any) => r.students },
            { head: 'Access', cell: (r: any) => <Badge tone="stored">{JSON.parse(r.permissions).length} permissions</Badge>, className: 'hidden md:table-cell' },
          ]} />
        )}
      </Card>
      {adding && <FormModal title="Add staff" fields={staffFields(sports)} submitLabel="Create staff login" onClose={() => setAdding(false)} onSubmit={async (v) => { setCreated(await api('/api/staff', { body: v })); reload() }} />}
      {created && (
        <Modal title="Staff login created" onClose={() => setCreated(null)}>
          <p className="text-sm text-mute">Share these now. The password is shown once. New staff start with basic access; adjust it on their profile.</p>
          <div className="mt-4 rounded-md bg-soft p-4 font-mono text-sm"><div>User ID: <b className="text-brand">{created.username}</b></div><div>Password: <b className="text-brand">{created.tempPassword}</b></div></div>
          <div className="mt-4 text-right"><Btn onClick={() => setCreated(null)}>Done</Btn></div>
        </Modal>
      )}
    </>
  )
}

export function MyStaffHome() {
  const { me } = useAuth()
  return <StaffProfile id={String(me?.refId)} self />
}
export function StaffDetail() {
  const { id } = useParams()
  return (
    <>
      <Link to="/app/staff" className="mb-4 inline-flex items-center gap-1 text-sm text-mute hover:text-slate-900"><ArrowLeft size={16} /> Staff</Link>
      <StaffProfile id={id!} />
    </>
  )
}

function StaffProfile({ id, self }: { id: string; self?: boolean }) {
  const { me } = useAuth()
  const { data, loading, error, reload } = useApi<any>(`/api/staff/${id}`)
  const sports = useApi<any>('/api/sports').data?.sports ?? []
  const [modal, setModal] = useState<'edit' | 'perms' | null>(null)
  if (loading) return <Loading />
  if (error || !data) return <ErrorMsg text={error || 'Not found'} />
  const s = data.staff
  const owner = me?.role === 'owner'
  const pendingStudents = data.students.filter((x: any) => x.pending_fees > 0).length
  return (
    <>
      <PageHeader title={self ? `Welcome, ${s.name.split(' ')[0]}` : s.name} sub={`${s.sport ?? 'Staff'} · ${s.category ?? ''}`}
        action={owner && <div className="flex gap-2"><Btn variant="ghost" onClick={() => setModal('perms')}><ShieldCheck size={16} /> Access</Btn><Btn variant="ghost" onClick={() => setModal('edit')}>Edit</Btn></div>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Students training" value={data.students.length} /><Stat label="Fees pending (their students)" value={pendingStudents} tone={pendingStudents ? 'warn' : 'good'} hint="students with dues" />
        <Stat label="Student achievements" value={data.studentAchievements.length} tone="good" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Profile</h2>
          {[['Date of birth', fdate(s.dob)], ['Age', age(s.dob)], ['Sport', s.sport], ['Experience', `${s.experience_years ?? 0} years`], ['Category', s.category], ['Major domain', s.major_domain], ['Phone', s.phone], ['Training', s.training], ['Achievements', s.achievements]].map(([k, v]) => (
            <div key={String(k)} className="flex justify-between gap-4 border-b border-line/50 py-2 text-sm last:border-0"><span className="text-mute">{k}</span><span className="text-right">{v || '-'}</span></div>
          ))}
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Recent wins by their students</h2>
          {data.studentAchievements.length ? data.studentAchievements.slice(0, 8).map((a: any, i: number) => (
            <div key={i} className="border-b border-line/50 py-2 text-sm last:border-0"><span className="font-medium text-brand">{a.position}</span> · {a.title}<div className="text-xs text-mute">{a.student} · {a.level} · {fdate(a.event_date)}</div></div>
          )) : <Empty text="No achievements yet" />}
        </Card>
      </div>
      <Card className="mt-4">
        <h2 className="mb-3 font-semibold">Students and sports</h2>
        <Table rows={data.students} empty="No students assigned" onRow={me?.role !== 'student' ? (r: any) => (location.href = `/app/students/${r.id}`) : undefined} cols={[
          { head: 'Student', cell: (r: any) => <div><div className="font-medium">{r.name}</div><div className="text-xs text-mute">{r.admission_no}</div></div> }, { head: 'Sport', cell: (r: any) => r.sport },
          { head: 'Level', cell: (r: any) => r.level || '-' }, { head: 'Fees', cell: (r: any) => r.pending_fees > 0 ? <span className="text-warn">Pending {inr(r.pending_fees)}</span> : <Badge tone="paid">Paid</Badge> },
          { head: 'Achievements', cell: (r: any) => r.achievements },
        ]} />
      </Card>
      {modal === 'edit' && <FormModal title="Edit staff" fields={staffFields(sports).filter((f) => f.name !== 'email')} initial={s} onClose={() => setModal(null)} onSubmit={async (v) => { await api(`/api/staff/${s.id}`, { method: 'PATCH', body: v }); reload() }} />}
      {modal === 'perms' && <PermsModal staff={s} onClose={() => setModal(null)} onSaved={reload} />}
    </>
  )
}

function PermsModal({ staff, onClose, onSaved }: { staff: any; onClose: () => void; onSaved: () => void }) {
  const [sel, setSel] = useState<string[]>(staff.permissions)
  const [busy, setBusy] = useState(false)
  return (
    <Modal title={`Access for ${staff.name}`} onClose={onClose}>
      <p className="mb-3 text-sm text-mute">The owner always has full control. Tick only what this person needs.</p>
      <div className="space-y-2">
        {PERMS.map(([k, l]) => (
          <label key={k} className="flex cursor-pointer items-center gap-3 rounded-md bg-soft px-3 py-2.5 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-[#0b4aa2]" checked={sel.includes(k)} onChange={(e) => setSel(e.target.checked ? [...sel, k] : sel.filter((x) => x !== k))} />{l}
          </label>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={busy} onClick={async () => { setBusy(true); await api(`/api/staff/${staff.id}`, { method: 'PATCH', body: { permissions: sel } }); onSaved(); onClose() }}>Save access</Btn></div>
    </Modal>
  )
}
