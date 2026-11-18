import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil, Upload, Trophy, Swords, Trash2 } from 'lucide-react'
import { API, api, getToken, useApi, useAuth, can, inr, fdate, age, cx } from '../lib'
import { Card, Stat, Tabs, Table, Badge, Btn, Loading, ErrorMsg, Empty, AuthImg, FormModal, Field } from '../components/ui'
import { DeleteStudent } from '../components/DeleteStudent'
import { PayButton } from './Fees'

export const studentFields: Field[] = [
  { name: 'name', label: 'Full name', required: true },
  { name: 'dob', label: 'Date of birth', type: 'date' },
  { name: 'birthplace', label: 'Birthplace' },
  { name: 'identification_mark', label: 'Identification mark' },
  { name: 'address', label: 'Address', type: 'textarea' },
  { name: 'parent_name', label: 'Parent / guardian name' },
  { name: 'parent_phone', label: 'Parent phone (WhatsApp)', type: 'tel' },
  { name: 'parent_email', label: 'Parent email', type: 'email' },
  { name: 'parent_occupation', label: 'Parent occupation' },
  { name: 'joined_on', label: 'Joined on', type: 'date' },
  { name: 'school', label: 'School' },
  { name: 'college', label: 'College' },
  { name: 'academic_year', label: 'Academic year / class' },
  { name: 'studying', label: 'Currently studying' },
  { name: 'biometric_id', label: 'Biometric device ID' },
  { name: 'batch_time', label: 'Batch start time', type: 'time', defaultValue: '17:00' },
  { name: 'remarks', label: 'Remarks', type: 'textarea' },
]

const CATEGORIES = ['Sub-Junior', 'Junior', 'Cadet', 'Senior', 'District', 'State', 'National', 'Zonal', 'International'].map((v) => ({ value: v, label: v }))

export function MyPassport() {
  const { data, loading, error, reload } = useApi<any>('/api/me/student')
  if (loading) return <Loading />
  if (error || !data?.student) return <ErrorMsg text={error || 'Not found'} />
  return <StudentView d={data} reload={reload} />
}

export default function StudentDetail() {
  const { id } = useParams()
  const { data, loading, error, reload } = useApi<any>(`/api/students/${id}`)
  if (loading) return <Loading />
  if (error || !data?.student) return <ErrorMsg text={error || 'Not found'} />
  return (
    <>
      <Link to="/app/students" className="mb-4 inline-flex items-center gap-1 text-sm text-mute hover:text-slate-900"><ArrowLeft size={16} /> Students</Link>
      <StudentView d={data} reload={reload} />
    </>
  )
}

const Row = ({ k, v }: { k: string; v: any }) => (
  <div className="flex justify-between gap-4 border-b border-line/50 py-2 text-sm last:border-0"><span className="text-mute">{k}</span><span className="text-right">{v || '-'}</span></div>
)

const MED: [string, string, string][] = [
  ['takes_medicine', 'medicine_details', 'Takes regular medicine'], ['has_allergy', 'allergy_details', 'Has any allergy'],
  ['had_surgery', 'surgery_details', 'Has undergone surgery'], ['bone_damage', 'bone_details', 'Has any bone damage'],
]
function Medical({ d, reload }: { d: any; reload: () => void }) {
  const { me } = useAuth()
  const m = d.medical ?? {}
  const canEdit = me?.role === 'owner' || me?.role === 'student' || can(me, 'students.medical')
  const [v, setV] = useState<any>({ ...m })
  const [msg, setMsg] = useState('')
  const set = (k: string, x: any) => setV((o: any) => ({ ...o, [k]: x }))
  const save = async () => { try { await api(`/api/students/${d.student.id}/medical`, { method: 'PUT', body: v }); setMsg('Saved'); reload() } catch (e: any) { setMsg(e.message) } }
  const inp = 'w-full rounded-md border border-line bg-soft px-3 py-2 text-sm'
  return (
    <Card>
      <h2 className="mb-1 font-semibold">Medical information</h2>
      <p className="mb-4 text-xs text-mute">Private. Only the owner and the student can see this unless the owner grants a coach access.</p>
      <div className="space-y-4">
        {MED.map(([flag, det, label]) => (
          <div key={flag} className="rounded-md border border-line p-3">
            <label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" disabled={!canEdit} checked={!!v[flag]} onChange={(e) => set(flag, e.target.checked ? 1 : 0)} className="h-4 w-4" /> {label}</label>
            {!!v[flag] && <textarea disabled={!canEdit} rows={2} placeholder="Details (name, since when, which bone, etc.)" value={v[det] ?? ''} onChange={(e) => set(det, e.target.value)} className={`${inp} mt-2`} />}
          </div>
        ))}
        <label className="block text-sm font-medium">Any other health issues<textarea disabled={!canEdit} rows={2} value={v.other_issues ?? ''} onChange={(e) => set('other_issues', e.target.value)} className={`${inp} mt-1`} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">Blood group<input disabled={!canEdit} value={v.blood_group ?? ''} onChange={(e) => set('blood_group', e.target.value)} className={`${inp} mt-1`} /></label>
          <label className="block text-sm font-medium">Emergency contact<input disabled={!canEdit} value={v.emergency_contact ?? ''} onChange={(e) => set('emergency_contact', e.target.value)} className={`${inp} mt-1`} /></label>
        </div>
      </div>
      {canEdit && <div className="mt-4 flex items-center gap-3"><Btn onClick={save}>Save medical info</Btn>{msg && <span className="text-sm text-mute" role="status">{msg}</span>}</div>}
    </Card>
  )
}

function StudentView({ d, reload }: { d: any; reload: () => void }) {
  const { me } = useAuth()
  const s = d.student
  const tabs = ['Passport', 'Personal', ...(d.canSeeMedical ? ['Medical'] : []), 'Sports', 'Achievements', 'Academics', 'Attendance', 'Fees', 'Equipment', 'Photos']
  const [tab, setTab] = useState('Passport')
  const [modal, setModal] = useState<'edit' | 'enroll' | 'ach' | 'match' | 'acad' | 'delete' | null>(null)
  const edit = can(me, 'students.edit')
  const addAch = can(me, 'achievements.edit')
  const sportOpts = useApi<any>('/api/sports').data?.sports.map((x: any) => ({ value: x.id, label: x.name })) ?? []
  const staffOpts = useApi<any>(me?.role === 'student' ? null : '/api/staff').data?.staff.map((x: any) => ({ value: x.id, label: `${x.name} (${x.sport ?? '-'})` })) ?? []
  const pending = d.fees.filter((f: any) => f.status === 'pending')
  const pendingTotal = pending.reduce((a: number, f: any) => a + f.amount, 0)
  const total = d.attendanceSummary.present + d.attendanceSummary.late + d.attendanceSummary.absent
  const rate = total ? Math.round(((d.attendanceSummary.present + d.attendanceSummary.late) / total) * 100) : 0

  return (
    <>
      {/* Athlete Passport header */}
      <div className="brand-panel relative mb-6 overflow-hidden rounded-lg p-6 text-white shadow-card">
        <div className="stripe absolute inset-x-0 top-0 h-1.5" />
        <div className="relative flex flex-wrap items-center gap-6">
          <AuthImg k={s.photo_key} alt={`Photo of ${s.name}`} className="h-28 w-28 rounded-lg border-4 border-white/30 !bg-white/15 !text-white/70" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-widest text-white/70">Athlete passport · {s.admission_no}</div>
            <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">{s.name}</h1>
            <div className="mt-2 flex flex-wrap gap-2 text-sm text-white/85">
              <span>{age(s.dob) ?? '-'} yrs</span><span className="text-white/50">·</span><span>{s.school || 'School not set'}</span><span className="text-white/50">·</span><span>Joined {fdate(s.joined_on)}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {d.enrollments.map((e: any) => <span key={e.id} className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">{e.sport}{e.level ? ` · ${e.level}` : ''}</span>)}
            </div>
          </div>
          {edit && <Btn variant="ghost" onClick={() => setModal('edit')}><Pencil size={14} /> Edit</Btn>}
        </div>
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'Passport' && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Medals & wins" value={d.achievements.length} tone="good" />
            <Stat label="Matches played" value={d.matches.length} />
            <Stat label="Attendance (60 days)" value={`${rate}%`} hint={`${d.attendanceSummary.late} late, ${d.attendanceSummary.absent} absent`} />
            {d.fees.length > 0 || me?.role === 'student' ? <Stat label="Fees pending" value={inr(pendingTotal)} tone={pendingTotal ? 'warn' : 'good'} /> : <Stat label="Level" value={d.enrollments[0]?.level ?? '-'} />}
          </div>
          <Card>
            <h2 className="mb-3 font-semibold">Remarks</h2>
            <p className="text-sm text-slate-600">{s.remarks || 'No remarks yet.'}</p>
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold">Latest achievements</h2>
            {d.achievements.length ? <div className="grid gap-3 sm:grid-cols-2">{d.achievements.slice(0, 4).map((a: any) => <AchCard key={a.id} a={a} />)}</div> : <Empty text="No achievements recorded yet" />}
          </Card>
        </div>
      )}

      {tab === 'Personal' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><h2 className="mb-2 font-semibold">Student</h2>
            <Row k="Date of birth" v={fdate(s.dob)} /><Row k="Age" v={age(s.dob)} /><Row k="Birthplace" v={s.birthplace} />
            <Row k="Identification mark" v={s.identification_mark} /><Row k="Address" v={s.address} /></Card>
          <Card><h2 className="mb-2 font-semibold">Parent / guardian</h2>
            <Row k="Name" v={s.parent_name} /><Row k="Phone" v={s.parent_phone} /><Row k="Email" v={s.parent_email} /><Row k="Occupation" v={s.parent_occupation} /></Card>
          <Card><h2 className="mb-2 font-semibold">School & college</h2>
            <Row k="School" v={s.school} /><Row k="College" v={s.college} /><Row k="Academic year" v={s.academic_year} /><Row k="Studying" v={s.studying} /></Card>
          {me?.role !== 'student' && <Card><h2 className="mb-2 font-semibold">Academy</h2>
            <Row k="Biometric ID" v={s.biometric_id} /><Row k="Batch time" v={s.batch_time} /><Row k="Status" v={<Badge>{s.status}</Badge>} /></Card>}
        </div>
      )}

      {tab === 'Medical' && <Medical d={d} reload={reload} />}

      {tab === 'Sports' && (
        <Card>
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Sports & coaches</h2>
            {edit && <Btn variant="ghost" onClick={() => setModal('enroll')}><Plus size={14} /> Enrol / update</Btn>}</div>
          <Table rows={d.enrollments} empty="Not enrolled in any sport" cols={[
            { head: 'Sport', cell: (e: any) => <b>{e.sport}</b> }, { head: 'Coach', cell: (e: any) => e.staff_name || '-' },
            { head: 'Level', cell: (e: any) => e.level || '-' }, { head: 'Category', cell: (e: any) => e.category || '-' },
            { head: 'Details', cell: (e: any) => e.sport_meta ? Object.entries(JSON.parse(e.sport_meta)).map(([k, v]) => `${k}: ${v}`).join(', ') : '-' },
            { head: 'Joined', cell: (e: any) => fdate(e.joined_on) },
          ]} />
        </Card>
      )}

      {tab === 'Achievements' && (
        <div className="space-y-4">
          <Card>
            <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold"><Trophy size={18} className="text-brand" /> Achievements</h2>
              {addAch && <Btn variant="ghost" onClick={() => setModal('ach')}><Plus size={14} /> Add</Btn>}</div>
            {d.achievements.length ? <div className="grid gap-3 sm:grid-cols-2">{d.achievements.map((a: any) => <AchCard key={a.id} a={a} />)}</div> : <Empty text="No achievements yet" />}
          </Card>
          <Card>
            <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold"><Swords size={18} className="text-sky" /> Matches attended</h2>
              {addAch && <Btn variant="ghost" onClick={() => setModal('match')}><Plus size={14} /> Add</Btn>}</div>
            <Table rows={d.matches} cols={[{ head: 'Event', cell: (m: any) => m.event }, { head: 'Sport', cell: (m: any) => m.sport || '-' }, { head: 'Category', cell: (m: any) => m.category || '-' }, { head: 'Date', cell: (m: any) => fdate(m.event_date) }, { head: 'Result', cell: (m: any) => m.result || '-' }]} />
          </Card>
        </div>
      )}

      {tab === 'Academics' && (
        <Card>
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Academic journey</h2>
            {edit && <Btn variant="ghost" onClick={() => setModal('acad')}><Plus size={14} /> Add result</Btn>}</div>
          <Table rows={d.academic} empty="No academic records" cols={[{ head: 'Year', cell: (r: any) => r.year }, { head: 'Term', cell: (r: any) => r.term },
            { head: 'Score', cell: (r: any) => <div className="flex items-center gap-3"><div className="h-2 w-32 overflow-hidden rounded-full bg-softer"><div className="h-full bg-sky" style={{ width: `${r.percentage}%` }} /></div>{r.percentage}%</div> }, { head: 'Notes', cell: (r: any) => r.notes || '-' }]} />
        </Card>
      )}

      {tab === 'Attendance' && (
        <Card>
          <div className="mb-3 flex gap-2"><Badge tone="present">{d.attendanceSummary.present} present</Badge><Badge tone="late">{d.attendanceSummary.late} late</Badge><Badge tone="absent">{d.attendanceSummary.absent} absent</Badge></div>
          <Table rows={d.attendance} empty="No attendance yet" cols={[{ head: 'Date', cell: (a: any) => fdate(a.att_date) }, { head: 'Check-in', cell: (a: any) => a.check_in || '-' }, { head: 'Status', cell: (a: any) => <Badge>{a.status}</Badge> }]} />
        </Card>
      )}

      {tab === 'Fees' && (
        <Card>
          <Table rows={d.fees} empty="Fee details are not available for your role" cols={[
            { head: 'Description', cell: (f: any) => f.description }, { head: 'Amount', cell: (f: any) => inr(f.amount) }, { head: 'Due', cell: (f: any) => fdate(f.due_date) },
            { head: 'Status', cell: (f: any) => <Badge tone={f.status === 'pending' && f.due_date < new Date().toISOString().slice(0, 10) ? 'overdue' : f.status}>{f.status === 'pending' && f.due_date < new Date().toISOString().slice(0, 10) ? 'overdue' : f.status}</Badge> },
            { head: '', cell: (f: any) => f.status === 'pending' && me?.role === 'student' ? <PayButton fee={f} onPaid={reload} /> : f.paid_on ? <span className="text-xs text-mute">Paid {fdate(f.paid_on)}</span> : null },
          ]} />
        </Card>
      )}

      {tab === 'Equipment' && (
        <Card>
          <h2 className="mb-3 font-semibold">Equipment purchased, issued or damaged</h2>
          <Table rows={d.equipment} empty="No equipment records" cols={[{ head: 'Item', cell: (t: any) => t.equipment }, { head: 'Type', cell: (t: any) => <Badge tone={t.type === 'damage' ? 'absent' : 'stored'}>{t.type}</Badge> }, { head: 'Qty', cell: (t: any) => t.qty }, { head: 'Amount', cell: (t: any) => t.amount ? inr(t.amount) : '-' }, { head: 'Date', cell: (t: any) => fdate(t.txn_date) }, { head: 'Note', cell: (t: any) => t.note || '-' }]} />
        </Card>
      )}

      {tab === 'Photos' && <Photos d={d} reload={reload} canUpload={addAch} />}

      {me?.role === 'owner' && (
        <div className="mt-10 rounded-lg border border-danger/30 bg-danger/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-semibold text-danger">Delete student</h2>
              <p className="text-sm text-mute">Permanently removes this student, their login, attendance, fees, photos and notifications. Income and equipment history stays but is unlinked. This cannot be undone.</p></div>
            <Btn variant="danger" onClick={() => setModal('delete')}><Trash2 size={16} /> Delete student</Btn>
          </div>
        </div>
      )}
      {modal === 'delete' && <DeleteStudent s={s} onClose={() => setModal(null)} />}

      {modal === 'edit' && <FormModal title="Edit student" fields={studentFields} initial={s} onClose={() => setModal(null)} onSubmit={async (v) => { await api(`/api/students/${s.id}`, { method: 'PATCH', body: v }); reload() }} />}
      {modal === 'enroll' && <FormModal title="Enrol in a sport" onClose={() => setModal(null)} onSubmit={async (v) => {
        const meta = v.sport_id == 1 && v.weapon ? { weapon: v.weapon } : v.sport_id == 4 && v.rating ? { rating: v.rating } : undefined
        await api(`/api/students/${s.id}/enrollments`, { body: { ...v, sport_meta: meta } }); reload() }}
        fields={[{ name: 'sport_id', label: 'Sport', type: 'select', options: sportOpts, required: true }, { name: 'staff_id', label: 'Coach', type: 'select', options: staffOpts },
          { name: 'level', label: 'Level', type: 'select', options: ['Beginner', 'Intermediate', 'Advanced', 'Elite'].map((x) => ({ value: x, label: x })) },
          { name: 'category', label: 'Category', type: 'select', options: CATEGORIES }, { name: 'joined_on', label: 'Joined on', type: 'date' },
          { name: 'weapon', label: 'Fencing weapon (if fencing)', type: 'select', options: ['Epee', 'Foil', 'Sabre'].map((x) => ({ value: x, label: x })) },
          { name: 'rating', label: 'Chess rating (if chess)', type: 'number' }]} />}
      {modal === 'ach' && <FormModal title="Add achievement" onClose={() => setModal(null)} onSubmit={async (v) => { await api(`/api/students/${s.id}/achievements`, { body: v }); reload() }}
        fields={[{ name: 'title', label: 'Title / event', required: true, span: 2 }, { name: 'sport_id', label: 'Sport', type: 'select', options: sportOpts }, { name: 'level', label: 'Level', type: 'select', options: CATEGORIES },
          { name: 'position', label: 'Position / medal' }, { name: 'event_date', label: 'Date', type: 'date' }, { name: 'cash_prize', label: 'Cash prize (Rs)', type: 'number' }]} />}
      {modal === 'match' && <FormModal title="Add match" onClose={() => setModal(null)} onSubmit={async (v) => { await api(`/api/students/${s.id}/matches`, { body: v }); reload() }}
        fields={[{ name: 'event', label: 'Event', required: true, span: 2 }, { name: 'sport_id', label: 'Sport', type: 'select', options: sportOpts }, { name: 'category', label: 'Category', type: 'select', options: CATEGORIES },
          { name: 'event_date', label: 'Date', type: 'date' }, { name: 'result', label: 'Result' }]} />}
      {modal === 'acad' && <FormModal title="Add academic result" onClose={() => setModal(null)} onSubmit={async (v) => { await api(`/api/students/${s.id}/academic`, { body: v }); reload() }}
        fields={[{ name: 'year', label: 'Academic year', required: true, defaultValue: '2025-26' }, { name: 'term', label: 'Term', required: true }, { name: 'percentage', label: 'Percentage', type: 'number', required: true }, { name: 'notes', label: 'Notes', type: 'textarea' }]} />}
    </>
  )
}

const AchCard = ({ a }: { a: any }) => (
  <div className="rounded-md border border-line bg-soft p-4">
    <div className="flex items-center justify-between"><span className="text-sm font-semibold text-brand">{a.position || 'Participant'}</span>{a.level && <Badge tone="stored">{a.level}</Badge>}</div>
    <div className="mt-1 text-sm">{a.title}</div>
    <div className="mt-1 text-xs text-mute">{a.sport} · {fdate(a.event_date)}</div>
  </div>
)

function Photos({ d, reload, canUpload }: { d: any; reload: () => void; canUpload: boolean }) {
  const [kind, setKind] = useState('prize')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const upload = async (file?: File) => {
    if (!file) return
    setBusy(true); setErr('')
    const fd = new FormData()
    fd.append('file', file); fd.append('student_id', String(d.student.id)); fd.append('kind', kind)
    const r = await fetch(`${API}/api/media/upload`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: fd })
    if (!r.ok) setErr((await r.json().catch(() => ({}))).error || 'Upload failed'); else reload()
    setBusy(false)
  }
  const groups: [string, string][] = [['profile', 'Profile'], ['prize', 'Prize photos'], ['match', 'Match photos'], ['other', 'Other']]
  return (
    <div className="space-y-4">
      {canUpload && (
        <Card className="flex flex-wrap items-center gap-3">
          <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Photo type" className="rounded-md border border-line bg-soft px-3 py-2 text-sm">
            {groups.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <label className={cx('inline-flex cursor-pointer items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white', busy && 'opacity-50')}>
            <Upload size={16} /> {busy ? 'Uploading...' : 'Upload photo'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
          </label>
          <span className="text-xs text-mute">JPEG, PNG or WebP, max 5 MB</span>
          {err && <ErrorMsg text={err} />}
        </Card>
      )}
      {groups.map(([k, label]) => {
        const items = d.media.filter((m: any) => m.kind === k)
        return items.length ? (
          <Card key={k}><h2 className="mb-3 font-semibold">{label}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{items.map((m: any) => <AuthImg key={m.id} k={m.r2_key} alt={m.caption || label} className="aspect-square w-full rounded-md" />)}</div></Card>
        ) : null
      })}
      {!d.media.length && <Empty text="No photos yet" />}
    </div>
  )
}
