import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { AuthProvider, useAuth } from '../src/auth'
import { C } from '../src/theme'

function Gate() {
  const { me, ready } = useAuth()
  const segments = useSegments()
  const router = useRouter()
  useEffect(() => {
    if (!ready) return
    const onLogin = segments[0] === 'login'
    if (!me && !onLogin) router.replace('/login')
    if (me && onLogin) router.replace('/(tabs)')
  }, [me, ready, segments])
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: C.card }, headerTintColor: C.text, contentStyle: { backgroundColor: C.bg } }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="student/[id]" options={{ title: 'Student' }} />
    </Stack>
  )
}

export default function Root() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Gate />
    </AuthProvider>
  )
}
