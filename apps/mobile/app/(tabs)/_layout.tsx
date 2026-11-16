import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth, can } from '../../src/auth'
import { C } from '../../src/theme'

const icon = (name: any) => ({ color, size }: { color: string; size: number }) => <Ionicons name={name} color={color} size={size} />

export default function TabsLayout() {
  const { me } = useAuth()
  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: C.card }, headerTintColor: C.text, sceneStyle: { backgroundColor: C.bg },
      tabBarStyle: { backgroundColor: C.card, borderTopColor: C.line }, tabBarActiveTintColor: C.brand, tabBarInactiveTintColor: C.mute,
    }}>
      <Tabs.Screen name="index" options={{ title: me?.role === 'student' ? 'Passport' : 'Home', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="people" options={{ title: 'Students', tabBarIcon: icon('people'), href: can(me, 'students.view') ? undefined : null }} />
      <Tabs.Screen name="fees" options={{ title: 'Fees', tabBarIcon: icon('card'), href: me?.role === 'student' || can(me, 'fees.view') ? undefined : null }} />
      <Tabs.Screen name="alerts" options={{ title: 'Alerts', tabBarIcon: icon('notifications'), href: me?.role === 'staff' && !can(me, 'students.viewAll') ? null : undefined }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: icon('ellipsis-horizontal') }} />
    </Tabs>
  )
}
