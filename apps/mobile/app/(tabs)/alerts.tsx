import { Text } from 'react-native'
import { useApi, Screen, Card, H1, Sub } from '../../src/ui'
import { fdate } from '../../src/api'
import { C } from '../../src/theme'

export default function Alerts() {
  const { data, loading, error, reload } = useApi<any>('/api/notifications')
  return (
    <Screen loading={loading} error={error} onRefresh={reload}>
      <H1>Alerts</H1><Sub>Check-ins, late arrivals, fees and announcements</Sub>
      {data?.notifications.map((n: any) => (
        <Card key={n.id}><Text style={{ color: C.text, fontWeight: '600' }}>{n.title}</Text><Sub>{n.body}</Sub><Text style={{ color: C.mute, fontSize: 12 }}>{fdate(n.created_at)}{n.student ? ` · ${n.student}` : ''}</Text></Card>
      ))}
      {data && !data.notifications.length && <Sub>Nothing yet</Sub>}
    </Screen>
  )
}
