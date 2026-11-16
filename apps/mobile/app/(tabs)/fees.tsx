import { Linking, View, Text } from 'react-native'
import { useAuth } from '../../src/auth'
import { useApi, Screen, Card, H1, Sub, Badge, Button } from '../../src/ui'
import { inr, fdate, WEB } from '../../src/api'
import { C } from '../../src/theme'

export default function Fees() {
  const { me } = useAuth()
  const student = me?.role === 'student'
  const { data, loading, error, reload } = useApi<any>(student ? '/api/me/student' : '/api/fees')
  const fees: any[] = (student ? data?.fees : data?.fees) ?? []
  const today = new Date().toISOString().slice(0, 10)
  return (
    <Screen loading={loading} error={error} onRefresh={reload}>
      <H1>Fees</H1><Sub>{student ? 'Your bills and payments' : 'Billing overview'}</Sub>
      {fees.map((f) => {
        const overdue = f.status === 'pending' && f.due_date < today
        return (
          <Card key={f.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: C.text, fontWeight: '600', flexShrink: 1 }}>{f.student ? `${f.student}: ` : ''}{f.description}</Text>
              <Text style={{ color: C.text, fontWeight: '700' }}>{inr(f.amount)}</Text>
            </View>
            <Sub>Due {fdate(f.due_date)}</Sub>
            <Badge text={overdue ? 'Overdue' : f.status} />
            {student && f.status === 'pending' && (
              <View style={{ marginTop: 12 }}><Button title={`Pay ${inr(f.amount)}`} onPress={() => Linking.openURL(`${WEB}/app/fees`)} /></View>
            )}
          </Card>
        )
      })}
      {!fees.length && <Sub>No bills</Sub>}
    </Screen>
  )
}
