import * as SecureStore from 'expo-secure-store'

export const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8787'
export const WEB = process.env.EXPO_PUBLIC_WEB_URL || 'https://globalsportsacademy.in'
const KEY = 'gsa_token'

export const getToken = () => SecureStore.getItemAsync(KEY)
export const setToken = (t: string) => SecureStore.setItemAsync(KEY, t)
export const clearToken = () => SecureStore.deleteItemAsync(KEY)

export async function api<T = any>(path: string, body?: unknown, method?: string): Promise<T> {
  const t = await getToken()
  const res = await fetch(`${API}${path}`, {
    method: method ?? (body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

export const inr = (n?: number | null) => (Math.round(n ?? 0) < 0 ? '-' : '') + '₹' + Math.abs(Math.round(n ?? 0)).toLocaleString('en-IN')
export const fdate = (d?: string | null) =>
  d ? new Date(d.length === 10 ? d + 'T00:00:00' : d.replace(' ', 'T') + 'Z').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
