import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

export const API = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8787'
export type Role = 'owner' | 'staff' | 'student'
export type User = { id: number; name: string; role: Role; username?: string; mustChangePassword?: boolean }
export type Me = { uid: number; role: Role; name: string; refId: number | null; perms: string[]; mustChange?: boolean }

const TOKEN_KEY = 'gsa_token'
export const getToken = () => localStorage.getItem(TOKEN_KEY)

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const t = getToken()
  const res = await fetch(`${API}${path}`, {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && t && !path.startsWith('/auth/')) {
    localStorage.removeItem(TOKEN_KEY)
    location.href = '/login'
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

// ---------- auth context ----------
type AuthCtx = { me: Me | null; loading: boolean; login: (token: string) => Promise<void>; logout: () => void }
const Ctx = createContext<AuthCtx>(null as any)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(!!getToken())
  const load = async () => {
    try { setMe((await api<{ user: Me }>('/auth/me')).user) } catch { setMe(null) } finally { setLoading(false) }
  }
  useEffect(() => { if (getToken()) load() }, [])
  return (
    <Ctx.Provider value={{
      me, loading,
      login: async (token) => { localStorage.setItem(TOKEN_KEY, token); await load() },
      logout: () => { localStorage.removeItem(TOKEN_KEY); setMe(null); location.href = '/' },
    }}>{children}</Ctx.Provider>
  )
}

export const can = (me: Me | null, perm: string) => !!me && (me.role === 'owner' || (me.role === 'staff' && me.perms.includes(perm)))

// ---------- hooks ----------
export function useApi<T = any>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!path) return
    let live = true
    setLoading(true)
    api<T>(path).then((d) => live && (setData(d), setError(''))).catch((e) => live && setError(e.message)).finally(() => live && setLoading(false))
    return () => { live = false }
  }, [path, tick, ...deps])
  return { data, error, loading, reload: () => setTick((t) => t + 1) }
}

// ---------- formatting ----------
export const inr = (n: number | null | undefined) => (Math.round(n ?? 0) < 0 ? '-' : '') + '₹' + Math.abs(Math.round(n ?? 0)).toLocaleString('en-IN')
export const fdate = (d?: string | null) => (d ? new Date(d.length === 10 ? d + 'T00:00:00' : d.replace(' ', 'T') + 'Z').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-')
export const age = (dob?: string | null) => (dob ? Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000) : null)
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')
