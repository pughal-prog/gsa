import { useEffect, useState } from 'react'
import { View, Text, TextInput, KeyboardAvoidingView, ScrollView, Platform, StyleSheet, Pressable, Image, Linking } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import * as Google from 'expo-auth-session/providers/google'
import { api } from '../src/api'
import { useAuth } from '../src/auth'
import { C } from '../src/theme'
import { Button } from '../src/ui'

WebBrowser.maybeCompleteAuthSession()
const hasGoogle = !!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
const PHONE = '9042999507'

function GoogleButton({ label, onToken, onError }: { label: string; onToken: (t: string) => void; onError: (m: string) => void }) {
  const [request, response, prompt] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  })
  useEffect(() => {
    if (response?.type === 'success' && response.params.id_token) onToken(response.params.id_token)
    else if (response?.type === 'error') onError('Google sign-in failed')
  }, [response])
  return <Button ghost title={label} disabled={!request} onPress={() => prompt()} />
}

export default function Login() {
  const { signIn } = useAuth()
  const [tab, setTab] = useState<'signin' | 'signup'>('signin')
  const [role, setRole] = useState<'student' | 'staff'>('student')
  const [f, setF] = useState<Record<string, string>>({})
  const [err, setErr] = useState('')
  const [done, setDone] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }))

  const submitIn = async () => {
    setBusy(true); setErr('')
    try { await signIn((await api('/auth/login', { username: f.username, password: f.password })).token) } catch (e: any) { setErr(e.message); setBusy(false) }
  }
  const submitUp = async () => {
    if (f.password !== f.again) return setErr('Passwords do not match')
    setBusy(true); setErr('')
    try { setDone((await api('/auth/signup', { role, name: f.name, email: f.email, phone: f.phone, dob: f.dob, parent_name: f.parent_name, password: f.password })).message) }
    catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  const google = async (idToken: string) => {
    setErr('')
    try {
      const r = await api('/auth/google', tab === 'signin' ? { idToken } : { idToken, signup: { role, phone: f.phone, name: f.name, dob: f.dob, parent_name: f.parent_name } })
      if (r.token) await signIn(r.token); else setDone(r.message)
    } catch (e: any) {
      if (/sign up first/i.test(e.message)) { setTab('signup'); setErr('No account found for this Google email. Enter your phone number, then tap Sign up with Google.') } else setErr(e.message)
    }
  }
  const noGoogle = () => setErr('Google sign-in is not configured yet (see README).')

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={st.wrap} keyboardShouldPersistTaps="handled">
        <Image source={require('../assets/logo.png')} style={st.logo} resizeMode="contain" accessibilityLabel="Global Sports Academy" />
        <View style={st.card}>
          {done ? (
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <Text style={st.h}>Registration received</Text>
              <Text style={[st.p, { textAlign: 'center', marginVertical: 10 }]}>{done} You can sign in once the academy approves your account.</Text>
              <Button title="Back to sign in" onPress={() => { setDone(''); setTab('signin') }} />
            </View>
          ) : (
            <>
              <View style={st.seg}>
                {(['signin', 'signup'] as const).map((t) => (
                  <Pressable key={t} onPress={() => { setTab(t); setErr('') }} style={[st.segBtn, tab === t && st.segOn]}>
                    <Text style={{ fontWeight: '700', color: tab === t ? C.brand : C.mute }}>{t === 'signin' ? 'Sign in' : 'Sign up'}</Text>
                  </Pressable>
                ))}
              </View>
              {tab === 'signin' ? (
                <>
                  <TextInput style={st.input} placeholder="User ID or email" placeholderTextColor={C.mute} autoCapitalize="none" autoCorrect={false} value={f.username ?? ''} onChangeText={set('username')} />
                  <TextInput style={st.input} placeholder="Password" placeholderTextColor={C.mute} secureTextEntry value={f.password ?? ''} onChangeText={set('password')} onSubmitEditing={submitIn} />
                </>
              ) : (
                <>
                  <View style={st.seg}>
                    {([['student', 'Student / Parent'], ['staff', 'Coach / Staff']] as const).map(([v, l]) => (
                      <Pressable key={v} onPress={() => setRole(v)} style={[st.segBtn, role === v && st.segOn]}><Text style={{ fontWeight: '700', color: role === v ? C.brand : C.mute }}>{l}</Text></Pressable>
                    ))}
                  </View>
                  <TextInput style={st.input} placeholder={role === 'student' ? "Student's full name" : 'Full name'} placeholderTextColor={C.mute} value={f.name ?? ''} onChangeText={set('name')} />
                  <TextInput style={st.input} placeholder="Email" placeholderTextColor={C.mute} autoCapitalize="none" keyboardType="email-address" value={f.email ?? ''} onChangeText={set('email')} />
                  <TextInput style={st.input} placeholder="Phone (WhatsApp)" placeholderTextColor={C.mute} keyboardType="phone-pad" value={f.phone ?? ''} onChangeText={set('phone')} />
                  {role === 'student' && <>
                    <TextInput style={st.input} placeholder="Date of birth (YYYY-MM-DD)" placeholderTextColor={C.mute} value={f.dob ?? ''} onChangeText={set('dob')} />
                    <TextInput style={st.input} placeholder="Parent / guardian name" placeholderTextColor={C.mute} value={f.parent_name ?? ''} onChangeText={set('parent_name')} />
                  </>}
                  <TextInput style={st.input} placeholder="Password (min 8 characters)" placeholderTextColor={C.mute} secureTextEntry value={f.password ?? ''} onChangeText={set('password')} />
                  <TextInput style={st.input} placeholder="Repeat password" placeholderTextColor={C.mute} secureTextEntry value={f.again ?? ''} onChangeText={set('again')} />
                </>
              )}
              {!!err && <Text style={{ color: C.danger, marginBottom: 10 }}>{err}</Text>}
              <Button title={busy ? 'Please wait...' : tab === 'signin' ? 'Sign in' : 'Sign up'} onPress={tab === 'signin' ? submitIn : submitUp} disabled={busy} />
              <Text style={st.or}>or</Text>
              {hasGoogle
                ? <GoogleButton label={tab === 'signin' ? 'Sign in with Google' : 'Sign up with Google'} onToken={google} onError={setErr} />
                : <Button ghost title={tab === 'signin' ? 'Sign in with Google' : 'Sign up with Google'} onPress={noGoogle} />}
            </>
          )}
        </View>
        <Pressable onPress={() => Linking.openURL(`tel:+91${PHONE}`)}><Text style={st.contact}>Need help? Call {PHONE}</Text></Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const st = StyleSheet.create({
  wrap: { padding: 20, paddingTop: 56, paddingBottom: 40 },
  logo: { width: '100%', height: 170, marginBottom: 12 },
  card: { backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 22, padding: 18 },
  h: { color: C.text, fontSize: 22, fontWeight: '800' }, p: { color: C.mute, fontSize: 14 },
  seg: { flexDirection: 'row', backgroundColor: C.card2, borderRadius: 12, padding: 4, marginBottom: 14 },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9 },
  segOn: { backgroundColor: '#fff' },
  input: { backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 14, color: C.text, padding: 13, marginBottom: 10, fontSize: 15 },
  or: { color: C.mute, textAlign: 'center', marginVertical: 12 },
  contact: { color: C.brand, textAlign: 'center', marginTop: 18, fontWeight: '600' },
})
