import { ReactNode, useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Pressable, StyleSheet } from 'react-native'
import { C } from './theme'
import { api } from './api'

export function useApi<T = any>(path: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(!!path)
  const load = useCallback(async () => {
    if (!path) return
    try { setData(await api<T>(path)); setError('') } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }, [path])
  useEffect(() => { load() }, [load])
  return { data, error, loading, reload: load }
}

export function Screen({ children, onRefresh, loading, error }: { children: ReactNode; onRefresh?: () => Promise<void> | void; loading?: boolean; error?: string }) {
  const [r, setR] = useState(false)
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={onRefresh ? <RefreshControl refreshing={r} tintColor={C.brand} onRefresh={async () => { setR(true); await onRefresh(); setR(false) }} /> : undefined}>
      {loading ? <ActivityIndicator color={C.brand} style={{ marginTop: 60 }} /> : error ? <Text style={s.err}>{error}</Text> : children}
    </ScrollView>
  )
}

export const Card = ({ children, style }: { children: ReactNode; style?: any }) => <View style={[s.card, style]}>{children}</View>
export const H1 = ({ children }: { children: ReactNode }) => <Text style={s.h1}>{children}</Text>
export const Sub = ({ children }: { children: ReactNode }) => <Text style={s.sub}>{children}</Text>
export const Label = ({ children }: { children: ReactNode }) => <Text style={s.label}>{children}</Text>

export const Stat = ({ label, value, tone }: { label: string; value: string | number; tone?: 'good' | 'warn' | 'bad' }) => (
  <Card style={{ flex: 1, minWidth: '45%' }}>
    <Text style={s.label}>{label.toUpperCase()}</Text>
    <Text style={[s.stat, tone === 'good' && { color: C.leaf }, tone === 'warn' && { color: C.warn }, tone === 'bad' && { color: C.danger }]}>{value}</Text>
  </Card>
)

const badgeColor: Record<string, string> = { paid: C.leaf, present: C.leaf, pending: C.warn, late: C.warn, absent: C.danger, overdue: C.danger }
export const Badge = ({ text }: { text: string }) => {
  const c = badgeColor[text.toLowerCase()] ?? C.ice
  return <View style={{ backgroundColor: c + '26', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' }}><Text style={{ color: c, fontSize: 12, fontWeight: '600' }}>{text}</Text></View>
}

export const Button = ({ title, onPress, ghost, disabled }: { title: string; onPress: () => void; ghost?: boolean; disabled?: boolean }) => (
  <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button"
    style={({ pressed }) => [s.btn, ghost && { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.line }, (pressed || disabled) && { opacity: 0.6 }]}>
    <Text style={[s.btnText, ghost && { color: C.text }]}>{title}</Text>
  </Pressable>
)

export const Row = ({ k, v }: { k: string; v: ReactNode }) => (
  <View style={s.row}><Text style={{ color: C.mute, fontSize: 14 }}>{k}</Text><Text style={{ color: C.text, fontSize: 14, flexShrink: 1, textAlign: 'right' }}>{v ?? '-'}</Text></View>
)

const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12, shadowColor: '#10245A', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  h1: { color: C.text, fontSize: 26, fontWeight: '700', marginBottom: 4 },
  sub: { color: C.mute, fontSize: 14, marginBottom: 16 },
  label: { color: C.mute, fontSize: 11, letterSpacing: 1, marginBottom: 6 },
  stat: { color: C.text, fontSize: 26, fontWeight: '700' },
  err: { color: C.danger, marginTop: 40, textAlign: 'center' },
  btn: { backgroundColor: C.brand, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 9, borderBottomColor: C.line + '80', borderBottomWidth: StyleSheet.hairlineWidth },
})
