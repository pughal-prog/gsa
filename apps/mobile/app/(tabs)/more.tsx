import { useState } from 'react'
import { TextInput, View, Text, Pressable } from 'react-native'
import { api } from '../../src/api'
import { useAuth } from '../../src/auth'
import { Screen, Card, H1, Sub, Button, Label } from '../../src/ui'
import { C } from '../../src/theme'

const KINDS = ['query', 'suggestion', 'report', 'help'] as const

export default function More() {
  const { me, signOut } = useAuth()
  const [kind, setKind] = useState<(typeof KINDS)[number]>('query')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [note, setNote] = useState('')
  const send = async () => {
    try { await api('/api/queries', { kind, subject, message }); setNote('Sent. The academy will reply here.'); setSubject(''); setMessage('') } catch (e: any) { setNote(e.message) }
  }
  const input = { backgroundColor: C.card2, borderColor: C.line, borderWidth: 1, borderRadius: 14, color: C.text, padding: 12, marginBottom: 10 } as const
  return (
    <Screen>
      <H1>{me?.name}</H1><Sub>{me?.role}</Sub>
      <Card>
        <Label>QUERY, SUGGESTION, REPORT OR HELP</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {KINDS.map((k) => (
            <Pressable key={k} onPress={() => setKind(k)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, backgroundColor: kind === k ? C.brand : C.card2 }}>
              <Text style={{ color: kind === k ? '#FFFFFF' : C.text, textTransform: 'capitalize' }}>{k}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput style={input} placeholder="Subject" placeholderTextColor={C.mute} value={subject} onChangeText={setSubject} />
        <TextInput style={[input, { height: 110, textAlignVertical: 'top' }]} multiline placeholder="Message" placeholderTextColor={C.mute} value={message} onChangeText={setMessage} />
        {!!note && <Text style={{ color: C.ice, marginBottom: 8 }}>{note}</Text>}
        <Button title="Send" onPress={send} disabled={!subject || !message} />
      </Card>
      <Button ghost title="Sign out" onPress={signOut} />
    </Screen>
  )
}
