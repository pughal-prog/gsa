import { useLocalSearchParams, useRouter } from 'expo-router'
import { View, Text, Alert } from 'react-native'
import { useApi, Screen, Card, H1, Sub, Stat, Badge, Label, Row, Button } from '../../src/ui'
import { inr, fdate, api } from '../../src/api'
import { useAuth } from '../../src/auth'
import { C } from '../../src/theme'

export default function StudentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data, loading, error, reload } = useApi<any>(`/api/students/${id}`)
  const { me } = useAuth()
  const router = useRouter()
  const remove = () => Alert.alert('Delete student', `Permanently delete ${data.student.name} and all their records? This cannot be undone.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { try { await api(`/api/students/${id}`, undefined, 'DELETE'); router.back() } catch (e: any) { Alert.alert('Could not delete', e.message) } } },
  ])
  return (
    <Screen loading={loading} error={error} onRefresh={reload}>
      {data?.student && <StudentBody d={data} />}
      {data?.student && me?.role === 'owner' && <View style={{ marginTop: 24 }}><Button ghost title="Delete student" onPress={remove} /></View>}
    </Screen>
  )
}

export function StudentBody({ d }: { d: any }) {
  const s = d.student
  const sum = d.attendanceSummary
  const total = sum.present + sum.late + sum.absent
  const rate = total ? Math.round(((sum.present + sum.late) / total) * 100) : 0
  const pending = d.fees.filter((f: any) => f.status === 'pending').reduce((a: number, f: any) => a + f.amount, 0)
  return (
    <>
      <Text style={{ color: C.brand, fontSize: 11, letterSpacing: 1.5 }}>ATHLETE PASSPORT · {s.admission_no}</Text>
      <H1>{s.name}</H1>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {d.enrollments.map((e: any) => <Badge key={e.id} text={`${e.sport}${e.level ? ' · ' + e.level : ''}`} />)}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Stat label="Medals & wins" value={d.achievements.length} tone="good" />
        <Stat label="Attendance" value={`${rate}%`} />
        {d.fees.length > 0 && <Stat label="Fees pending" value={inr(pending)} tone={pending ? 'warn' : 'good'} />}
        <Stat label="Matches" value={d.matches.length} />
      </View>
      <Card style={{ marginTop: 12 }}>
        <Label>PERSONAL</Label>
        <Row k="Date of birth" v={fdate(s.dob)} /><Row k="Birthplace" v={s.birthplace} /><Row k="School" v={s.school} /><Row k="Studying" v={s.studying} />
        <Row k="Parent" v={s.parent_name} /><Row k="Parent phone" v={s.parent_phone} />
      </Card>
      <Card><Label>REMARKS</Label><Sub>{s.remarks || 'No remarks yet'}</Sub></Card>
      <Card>
        <Label>ACHIEVEMENTS</Label>
        {d.achievements.length ? d.achievements.map((a: any) => (
          <View key={a.id} style={{ marginBottom: 10 }}><Text style={{ color: C.volt, fontWeight: '600' }}>{a.position} · {a.level}</Text><Sub>{a.title} · {fdate(a.event_date)}</Sub></View>
        )) : <Sub>No achievements yet</Sub>}
      </Card>
      <Card>
        <Label>RECENT ATTENDANCE</Label>
        {d.attendance.slice(0, 10).map((a: any, i: number) => <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}><Sub>{fdate(a.att_date)} {a.check_in ?? ''}</Sub><Badge text={a.status} /></View>)}
      </Card>
      <Card>
        <Label>ACADEMIC JOURNEY</Label>
        {d.academic.length ? d.academic.map((r: any) => <Row key={r.id} k={`${r.year} ${r.term}`} v={`${r.percentage}%`} />) : <Sub>No records</Sub>}
      </Card>
    </>
  )
}
