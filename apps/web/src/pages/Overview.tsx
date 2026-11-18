import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, BarChart } from 'recharts'
import { Link } from 'react-router-dom'
import { useApi, inr, fdate } from '../lib'
import { Card, PageHeader, Stat, Loading, ErrorMsg, Badge } from '../components/ui'

const COLORS = ['#2540f2', '#ff5a1f', '#0fa968', '#6cb8ff', '#b8d200']
const tip = { contentStyle: { background: '#ffffff', border: '1px solid #dde4f0', borderRadius: 12, color: '#0f1b33', boxShadow: '0 8px 24px -12px rgba(16,36,80,.25)' } }
const label: Record<string, string> = { student_fee: 'Student fees', entry_fee: 'Entry fees', cash_prize: 'Cash prizes', equipment_sale: 'Equipment sales', other: 'Other' }

export default function Overview() {
  const { data: d, loading, error } = useApi<any>('/api/reports/overview')
  if (loading) return <Loading />
  if (error || !d) return <ErrorMsg text={error || 'No data'} />
  const att = d.attendance ?? {}
  const attTotal = (att.present ?? 0) + (att.late ?? 0) + (att.absent ?? 0)
  const rate = attTotal ? Math.round((((att.present ?? 0) + (att.late ?? 0)) / attTotal) * 100) : 0
  const incomeBySource = Object.values((d.bySource as any[]).reduce((acc, r) => {
    const k = r.type; acc[k] = acc[k] || { name: label[k] ?? k, received: 0, pending: 0 }
    acc[k][r.status === 'pending' ? 'pending' : 'received'] += r.total; return acc
  }, {} as Record<string, any>)) as any[]
  const net = d.thisMonth.income - d.thisMonth.expense
  return (
    <>
      <PageHeader title="Academy overview" sub={`Status as of ${fdate(d.today)}`} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active students" value={d.counts.students} hint={`${d.counts.staff} coaches and staff`} />
        <Stat label="Income this month" value={inr(d.thisMonth.income)} tone="good" hint={`Expenses ${inr(d.thisMonth.expense)}`} />
        <Stat label="Net this month" value={inr(net)} tone={net >= 0 ? 'good' : 'bad'} />
        <Stat label="Fees pending" value={inr(d.pendingFees.total)} tone={d.pendingFees.overdue ? 'bad' : 'warn'} hint={`${d.pendingFees.n} bills, ${inr(d.pendingFees.overdue)} overdue`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-4 font-semibold">Monthly report: income vs expense</h2>
          <div className="h-72" role="img" aria-label="Monthly income and expense chart">
            <ResponsiveContainer>
              <ComposedChart data={d.monthly}>
                <CartesianGrid stroke="#e3e9f4" vertical={false} />
                <XAxis dataKey="month" stroke="#5d6b86" fontSize={12} />
                <YAxis stroke="#5d6b86" fontSize={12} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip {...tip} formatter={(v: number) => inr(v)} />
                <Bar dataKey="income" name="Income" fill="#2540f2" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill="#ff5a1f" radius={[6, 6, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Students by sport</h2>
          <div className="h-72" role="img" aria-label="Students by sport">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={d.bySport} dataKey="students" nameKey="sport" innerRadius={55} outerRadius={95} paddingAngle={3} stroke="none">
                  {d.bySport.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip {...tip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {d.bySport.map((s: any, i: number) => <li key={s.sport} className="flex items-center justify-between"><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{s.sport}</span><span className="text-mute">{s.students}</span></li>)}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="mb-4 font-semibold">Income by source (this year)</h2>
          <div className="space-y-3">
            {incomeBySource.map((r) => (
              <div key={r.name} className="flex items-center justify-between text-sm">
                <span>{r.name}</span>
                <span><span className="font-medium">{inr(r.received)}</span>{r.pending > 0 && <span className="ml-2 text-warn">+{inr(r.pending)} pending</span>}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Academic growth (avg %)</h2>
          <div className="h-48" role="img" aria-label="Academic average by term">
            <ResponsiveContainer>
              <BarChart data={d.academic}>
                <XAxis dataKey="period" stroke="#5d6b86" fontSize={11} />
                <YAxis domain={[0, 100]} stroke="#5d6b86" fontSize={11} />
                <Tooltip {...tip} />
                <Bar dataKey="avg" fill="#6cb8ff" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <h2 className="mb-1 font-semibold">Attendance this month</h2>
          <div className="font-display text-4xl font-semibold text-leaf">{rate}%</div>
          <div className="mt-3 flex gap-3 text-sm"><Badge tone="present">{att.present ?? 0} present</Badge><Badge tone="late">{att.late ?? 0} late</Badge><Badge tone="absent">{att.absent ?? 0} absent</Badge></div>
          <h2 className="mb-2 mt-6 font-semibold">Low stock</h2>
          {d.lowStock.length ? d.lowStock.map((e: any) => (
            <div key={e.id} className="flex justify-between text-sm"><span>{e.name}</span><span className="text-warn">{e.qty} left</span></div>
          )) : <p className="text-sm text-mute">All stocked.</p>}
          <Link to="/app/stock" className="mt-3 inline-block text-sm text-sky hover:underline">Open equipment</Link>
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="mb-4 font-semibold">Recent achievements</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {d.recent.map((a: any, i: number) => (
            <div key={i} className="rounded-md bg-soft p-4">
              <div className="text-sm font-semibold text-brand">{a.position} · {a.level}</div>
              <div className="mt-1 text-sm">{a.title}</div>
              <div className="mt-1 text-xs text-mute">{a.student} · {fdate(a.event_date)}</div>
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}
