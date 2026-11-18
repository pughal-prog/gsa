import { useState } from 'react'
import { Plus, Zap } from 'lucide-react'
import { ExportButtons } from '../components/Export'
import { api, useApi, useAuth, can, inr, fdate } from '../lib'
import { Card, PageHeader, Table, Btn, Loading, ErrorMsg, Badge, FormModal, Stat, Tabs } from '../components/ui'

declare global { interface Window { Razorpay?: any } }

function loadRazorpay() {
  return new Promise<void>((res, rej) => {
    if (window.Razorpay) return res()
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = () => res(); s.onerror = () => rej(new Error('Could not load payment window'))
    document.body.appendChild(s)
  })
}

export function PayButton({ fee, onPaid }: { fee: any; onPaid: () => void }) {
  const { me } = useAuth()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const pay = async () => {
    setBusy(true); setErr('')
    try {
      const o = await api('/api/payments/order', { body: { feeId: fee.id } })
      await loadRazorpay()
      new window.Razorpay({
        key: o.keyId, amount: o.amount, currency: o.currency, order_id: o.orderId, name: 'Global Sports Academy', description: fee.description,
        prefill: { name: me?.name }, theme: { color: '#0b4aa2' },
        handler: async (r: any) => { try { await api('/api/payments/verify', { body: r }); onPaid() } catch (e: any) { setErr(e.message) } },
        modal: { ondismiss: () => setBusy(false) },
      }).open()
    } catch (e: any) { setErr(e.message); setBusy(false) }
  }
  return <div><Btn onClick={pay} disabled={busy} className="py-1.5"><Zap size={14} /> Pay {inr(fee.amount)}</Btn>{err && <div className="mt-1 text-xs text-danger">{err}</div>}</div>
}

export default function Fees() {
  const { me } = useAuth()
  const [status, setStatus] = useState('')
  const isStudent = me?.role === 'student'
  const own = useApi<any>(isStudent ? '/api/me/student' : null)
  const all = useApi<any>(isStudent ? null : `/api/fees?status=${status}`)
  const students = useApi<any>(can(me, 'fees.collect') ? '/api/students' : null).data?.students ?? []
  const [adding, setAdding] = useState(false)
  const [tab, setTab] = useState('Bills')
  const [planModal, setPlanModal] = useState<any>(null)
  const sportsList = useApi<any>(me?.role === 'owner' ? '/api/sports' : null).data?.sports ?? []
  const plans = useApi<any>(me?.role === 'owner' ? '/api/fee-plans' : null)
  const [msg, setMsg] = useState('')
  const today = new Date().toISOString().slice(0, 10)
  const reload = () => (isStudent ? own.reload() : all.reload())
  const loading = isStudent ? own.loading : all.loading
  const error = isStudent ? own.error : all.error
  const fees: any[] = isStudent ? own.data?.fees ?? [] : all.data?.fees ?? []
  if (loading) return <Loading />
  if (error) return <ErrorMsg text={error} />
  const pending = fees.filter((f) => f.status === 'pending')
  const overdue = pending.filter((f) => f.due_date < today)
  return (
    <>
      <PageHeader title="Fees" sub={isStudent ? 'Your bills and payments' : 'Billing and collections'}
        action={(
          <div className="flex gap-2">
            <ExportButtons title={'Fees'} head={['Student', 'Description', 'Due', 'Amount', 'Status']} rows={fees.map((f: any) => [f.student || f.student_name || '-', f.description || f.title || '-', f.due_date, inr(f.amount), f.status])} filename={'fees.pdf'} share={true} />
            {can(me, 'fees.collect') && <>
            {me?.role === 'owner' && <Btn variant="ghost" onClick={async () => { const r = await api('/api/fees/generate-monthly', { method: 'POST', body: {} }); setMsg(`${r.created} monthly bills generated`); reload() }}>Generate monthly bills</Btn>}
            <Btn onClick={() => setAdding(true)}><Plus size={16} /> New bill</Btn></>}
          </div>)} />
      {msg && <div className="mb-4 rounded-md bg-brand/10 p-3 text-sm text-brand">{msg}</div>}
      {me?.role === 'owner' && <Tabs tabs={['Bills', 'Fee structure']} value={tab} onChange={setTab} />}
      {tab === 'Fee structure' && me?.role === 'owner' ? (
        <Card>
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Fee plans</h2><Btn onClick={() => setPlanModal({})}><Plus size={16} /> New plan</Btn></div>
          <p className="mb-3 text-sm text-mute">Define what each section costs, then assign plans (with a custom amount if needed) from a student's Fees tab. Generating monthly bills uses these.</p>
          <Table rows={plans.data?.plans ?? []} empty="No plans yet" cols={[
            { head: 'Section', cell: (p: any) => p.sport }, { head: 'Plan', cell: (p: any) => <b>{p.name}</b> }, { head: 'Amount', cell: (p: any) => inr(p.amount) }, { head: 'Period', cell: (p: any) => p.period },
            { head: 'Status', cell: (p: any) => <Badge tone={p.active ? 'active' : 'closed'}>{p.active ? 'active' : 'off'}</Badge> },
            { head: '', cell: (p: any) => <div className="flex gap-1"><Btn variant="ghost" className="py-1 text-xs" onClick={() => setPlanModal(p)}>Edit</Btn><Btn variant="danger" className="py-1 text-xs" onClick={async () => { if (confirm(`Delete plan ${p.name}?`)) { await api(`/api/fee-plans/${p.id}`, { method: 'DELETE' }); plans.reload() } }}>Delete</Btn></div> },
          ]} />
        </Card>
      ) : <>
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Stat label="Pending" value={inr(pending.reduce((a, f) => a + f.amount, 0))} tone="warn" hint={`${pending.length} bills`} />
        <Stat label="Overdue" value={inr(overdue.reduce((a, f) => a + f.amount, 0))} tone={overdue.length ? 'bad' : 'good'} hint={`${overdue.length} bills`} />
        <Stat label="Paid" value={inr(fees.filter((f) => f.status === 'paid').reduce((a, f) => a + f.amount, 0))} tone="good" />
      </div>
      <Card>
        {!isStudent && (
          <div className="mb-3 flex gap-2">{['', 'pending', 'paid'].map((s) => <Btn key={s} variant={status === s ? 'primary' : 'ghost'} className="py-1.5" onClick={() => setStatus(s)}>{s || 'All'}</Btn>)}</div>
        )}
        <Table rows={fees} empty="No bills" cols={[
          ...(!isStudent ? [{ head: 'Student', cell: (f: any) => <div><div className="font-medium">{f.student}</div><div className="text-xs text-mute">{f.admission_no}</div></div> }] : []),
          { head: 'Description', cell: (f: any) => f.description }, { head: 'Amount', cell: (f: any) => inr(f.amount) }, { head: 'Due', cell: (f: any) => fdate(f.due_date) },
          { head: 'Status', cell: (f: any) => { const o = f.status === 'pending' && f.due_date < today; return <Badge tone={o ? 'overdue' : f.status}>{o ? 'overdue' : f.status}</Badge> } },
          { head: '', cell: (f: any) => f.status !== 'pending' ? <span className="text-xs text-mute">{f.method} · {fdate(f.paid_on)}</span>
            : isStudent ? <PayButton fee={f} onPaid={reload} />
            : can(me, 'fees.collect') ? <div className="flex gap-1"><Btn variant="ghost" className="py-1 text-xs" onClick={async () => { await api(`/api/fees/${f.id}/mark-paid`, { body: { method: 'cash' } }); reload() }}>Cash</Btn><Btn variant="ghost" className="py-1 text-xs" onClick={async () => { await api(`/api/fees/${f.id}/mark-paid`, { body: { method: 'upi' } }); reload() }}>UPI</Btn></div> : null },
        ]} />
      </Card>
      </>}
      {planModal && <FormModal title={planModal.id ? 'Edit fee plan' : 'New fee plan'} initial={planModal} onClose={() => setPlanModal(null)} onSubmit={async (v) => { if (planModal.id) await api(`/api/fee-plans/${planModal.id}`, { method: 'PATCH', body: v }); else await api('/api/fee-plans', { body: v }); plans.reload() }}
        fields={[...(planModal.id ? [] : [{ name: 'sport_id', label: 'Section / sport', type: 'select' as const, required: true, options: sportsList.map((s: any) => ({ value: s.id, label: s.name })) }]), { name: 'name', label: 'Plan name', required: true, defaultValue: 'Monthly coaching' }, { name: 'amount', label: 'Amount (Rs)', type: 'number', required: true },
          { name: 'period', label: 'Billing period', type: 'select', options: [{ value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' }, { value: 'yearly', label: 'Yearly' }, { value: 'once', label: 'One time' }] }]} />}
      {adding && <FormModal title="New bill" onClose={() => setAdding(false)} onSubmit={async (v) => { await api('/api/fees', { body: v }); reload() }}
        fields={[{ name: 'student_id', label: 'Student', type: 'select', required: true, options: students.map((s: any) => ({ value: s.id, label: `${s.name} (${s.admission_no})` })), span: 2 },
          { name: 'description', label: 'Description', required: true, defaultValue: 'Monthly fee' }, { name: 'amount', label: 'Amount (Rs)', type: 'number', required: true }, { name: 'due_date', label: 'Due date', type: 'date', required: true }]} />}
    </>
  )
}
