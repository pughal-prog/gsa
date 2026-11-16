import { useState } from 'react'
import { Pressable, TextInput, Text } from 'react-native'
import { useRouter } from 'expo-router'
import { useApi, Screen, Card, H1, Sub, Badge } from '../../src/ui'
import { inr } from '../../src/api'
import { C } from '../../src/theme'

export default function People() {
  const [q, setQ] = useState('')
  const router = useRouter()
  const { data, loading, error, reload } = useApi<any>(`/api/students?q=${encodeURIComponent(q)}`)
  return (
    <Screen loading={loading && !data} error={error} onRefresh={reload}>
      <H1>Students</H1>
      <TextInput value={q} onChangeText={setQ} placeholder="Search name or admission no." placeholderTextColor={C.mute}
        style={{ backgroundColor: C.card2, borderColor: C.line, borderWidth: 1, borderRadius: 14, color: C.text, padding: 12, marginBottom: 14 }} />
      {data?.students.map((s: any) => (
        <Pressable key={s.id} onPress={() => router.push(`/student/${s.id}`)}>
          <Card>
            <Text style={{ color: C.text, fontSize: 16, fontWeight: '600' }}>{s.name}</Text>
            <Sub>{s.admission_no} · {s.sports || 'No sport'}</Sub>
            {s.pending_fees > 0 ? <Badge text={`Pending ${inr(s.pending_fees)}`} /> : <Badge text="Paid" />}
          </Card>
        </Pressable>
      ))}
    </Screen>
  )
}
