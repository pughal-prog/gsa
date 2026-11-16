import { View } from 'react-native'
import { useAuth } from '../../src/auth'
import { useApi, Screen, Card, H1, Sub, Stat, Badge, Label } from '../../src/ui'
import { inr, fdate } from '../../src/api'
import { StudentBody } from '../student/[id]'

export default function Home() {
  const { me } = useAuth()
  if (me?.role === 'student') return <MyPassport />
  if (me?.role === 'staff') return <StaffHome id={me.refId!} />
  return <OwnerHome />
}

function OwnerHome() {
  const { data: d, loading, error, reload } = useApi<any>('/api/reports/overview')
  return (
    <Screen loading={loading} error={error} onRefresh={reload}>
      {d && <>
        <H1>Academy overview</H1><Sub>As of {fdate(d.today)}</Sub>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <Stat label="Students" value={d.counts.students} />
          <Stat label="Income (month)" value={inr(d.thisMonth.income)} tone="good" />
          <Stat label="Expenses (month)" value={inr(d.thisMonth.expense)} />
          <Stat label="Fees pending" value={inr(d.pendingFees.total)} tone={d.pendingFees.overdue ? 'bad' : 'warn'} />
        </View>
        <Card style={{ marginTop: 12 }}>
          <Label>LOW STOCK</Label>
          {d.lowStock.length ? d.lowStock.map((e: any) => <Sub key={e.id}>{e.name}: {e.qty} left</Sub>) : <Sub>All stocked</Sub>}
        </Card>
        <Card>
          <Label>RECENT ACHIEVEMENTS</Label>
          {d.recent.map((a: any, i: number) => <Sub key={i}>{a.position}: {a.title} ({a.student})</Sub>)}
        </Card>
      </>}
    </Screen>
  )
}

function StaffHome({ id }: { id: number }) {
  const { data: d, loading, error, reload } = useApi<any>(`/api/staff/${id}`)
  return (
    <Screen loading={loading} error={error} onRefresh={reload}>
      {d && <>
        <H1>Hello, {d.staff.name.split(' ')[0]}</H1><Sub>{d.staff.sport} · {d.staff.category}</Sub>
        <View style={{ flexDirection: 'row', gap: 12 }}><Stat label="Students" value={d.students.length} /><Stat label="Wins" value={d.studentAchievements.length} tone="good" /></View>
        <Card>
          <Label>YOUR STUDENTS</Label>
          {d.students.map((s: any) => (
            <View key={s.id + s.sport} style={{ marginBottom: 10 }}>
              <Sub>{s.name} · {s.sport}</Sub>
              <Badge text={s.pending_fees > 0 ? 'Pending' : 'Paid'} />
            </View>
          ))}
        </Card>
      </>}
    </Screen>
  )
}

function MyPassport() {
  const { data, loading, error, reload } = useApi<any>('/api/me/student')
  return <Screen loading={loading} error={error} onRefresh={reload}>{data?.student && <StudentBody d={data} />}</Screen>
}
