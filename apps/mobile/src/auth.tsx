import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { api, getToken, setToken, clearToken } from './api'

export type Me = { uid: number; role: 'owner' | 'staff' | 'student'; name: string; refId: number | null; perms: string[] }
type Ctx = { me: Me | null; ready: boolean; signIn: (token: string) => Promise<void>; signOut: () => Promise<void> }
const AuthCtx = createContext<Ctx>(null as any)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [ready, setReady] = useState(false)
  const load = async () => {
    try { if (await getToken()) setMe((await api<{ user: Me }>('/auth/me')).user) } catch { await clearToken(); setMe(null) }
    setReady(true)
  }
  useEffect(() => { load() }, [])
  return (
    <AuthCtx.Provider value={{ me, ready, signIn: async (t) => { await setToken(t); await load() }, signOut: async () => { await clearToken(); setMe(null) } }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const can = (me: Me | null, p: string) => !!me && (me.role === 'owner' || (me.role === 'staff' && me.perms.includes(p)))
