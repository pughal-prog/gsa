import type { Context, MiddlewareHandler } from 'hono'
import { SignJWT, jwtVerify, createRemoteJWKSet } from 'jose'

export type Env = {
  DB: D1Database
  MEDIA: R2Bucket
  JWT_SECRET: string
  WEB_ORIGIN: string
  GOOGLE_CLIENT_ID: string
  LATE_GRACE_MINUTES: string
  ACADEMY_NAME: string
  RAZORPAY_KEY_ID?: string
  RAZORPAY_KEY_SECRET?: string
  RAZORPAY_WEBHOOK_SECRET?: string
  BIOMETRIC_DEVICE_KEY?: string
  WHATSAPP_TOKEN?: string
  WHATSAPP_PHONE_ID?: string
  WHATSAPP_TEMPLATE?: string
}

export type Role = 'owner' | 'staff' | 'student'
export type Auth = { uid: number; role: Role; name: string; refId: number | null; perms: string[] }
export type App = { Bindings: Env; Variables: { auth: Auth } }
export type Ctx = Context<App>

// ---------- D1 helpers ----------
export const all = async <T = any>(db: D1Database, sql: string, ...p: unknown[]): Promise<T[]> =>
  (await db.prepare(sql).bind(...p).all<T>()).results
export const one = async <T = any>(db: D1Database, sql: string, ...p: unknown[]): Promise<T | null> =>
  await db.prepare(sql).bind(...p).first<T>()
export const run = async (db: D1Database, sql: string, ...p: unknown[]) =>
  await db.prepare(sql).bind(...p).run()

// ---------- time (IST) ----------
export function istNow(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d)
  const g = (t: string) => parts.find((p) => p.type === t)!.value
  const hh = g('hour') === '24' ? '00' : g('hour')
  return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${hh}:${g('minute')}` }
}
export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

// ---------- passwords (PBKDF2, Workers max 100k iterations) ----------
const ITER = 100_000
const b64 = (u: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(u)))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
async function derive(pw: string, salt: Uint8Array, iter: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits'])
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256)
}
export async function hashPassword(pw: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return `pbkdf2$${ITER}$${b64(salt)}$${b64(await derive(pw, salt, ITER))}`
}
export async function verifyPassword(pw: string, stored: string) {
  const [, iter, salt, hash] = stored.split('$')
  const got = b64(await derive(pw, unb64(salt), Number(iter)))
  return timingSafeEqual(got, hash)
}
export function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}
export function tempPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const r = crypto.getRandomValues(new Uint8Array(10))
  return Array.from(r, (n) => chars[n % chars.length]).join('')
}

// ---------- JWT ----------
const key = (env: Env) => new TextEncoder().encode(env.JWT_SECRET)
export const signToken = (env: Env, uid: number, role: Role) =>
  new SignJWT({ role }).setProtectedHeader({ alg: 'HS256' }).setSubject(String(uid))
    .setIssuedAt().setExpirationTime('12h').sign(key(env))

const googleJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))
export async function verifyGoogleToken(env: Env, idToken: string) {
  const { payload } = await jwtVerify(idToken, googleJwks, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: env.GOOGLE_CLIENT_ID,
  })
  if (!payload.email || payload.email_verified !== true) throw new Error('Unverified Google email')
  return { email: String(payload.email).toLowerCase(), name: String(payload.name ?? '') }
}

// ---------- RBAC ----------
export const requireAuth: MiddlewareHandler<App> = async (c, next) => {
  const h = c.req.header('Authorization')
  if (!h?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401)
  try {
    const { payload } = await jwtVerify(h.slice(7), key(c.env))
    const uid = Number(payload.sub)
    const u = await one<{ id: number; role: Role; name: string; active: number }>(
      c.env.DB, 'SELECT id, role, name, active FROM users WHERE id = ?', uid)
    if (!u || !u.active) return c.json({ error: 'Account disabled' }, 401)
    let refId: number | null = null
    let perms: string[] = []
    if (u.role === 'staff') {
      const s = await one<{ id: number; permissions: string }>(c.env.DB, 'SELECT id, permissions FROM staff WHERE user_id = ?', uid)
      refId = s?.id ?? null
      perms = s ? JSON.parse(s.permissions) : []
    } else if (u.role === 'student') {
      refId = (await one<{ id: number }>(c.env.DB, 'SELECT id FROM students WHERE user_id = ?', uid))?.id ?? null
    }
    c.set('auth', { uid, role: u.role, name: u.name, refId, perms })
    await next()
  } catch {
    return c.json({ error: 'Invalid or expired session' }, 401)
  }
}

export const can = (a: Auth, perm: string) => a.role === 'owner' || (a.role === 'staff' && a.perms.includes(perm))

export const needPerm = (perm: string): MiddlewareHandler<App> => async (c, next) => {
  if (!can(c.get('auth'), perm)) return c.json({ error: 'Forbidden' }, 403)
  await next()
}
export const ownerOnly: MiddlewareHandler<App> = async (c, next) => {
  if (c.get('auth').role !== 'owner') return c.json({ error: 'Owner access only' }, 403)
  await next()
}

/** Can this user see this student? Owner: all. Staff: assigned (or students.viewAll). Student: self. */
export async function canSeeStudent(c: Ctx, studentId: number) {
  const a = c.get('auth')
  if (a.role === 'owner') return true
  if (a.role === 'student') return a.refId === studentId
  if (!a.perms.includes('students.view')) return false
  if (a.perms.includes('students.viewAll')) return true
  const r = await one(c.env.DB, 'SELECT 1 AS x FROM enrollments WHERE student_id = ? AND staff_id = ? AND active = 1', studentId, a.refId)
  return !!r
}

export async function audit(c: Ctx, action: string, detail?: unknown) {
  await run(c.env.DB, 'INSERT INTO audit_log (user_id, action, detail) VALUES (?,?,?)',
    c.get('auth')?.uid ?? null, action, detail ? JSON.stringify(detail) : null)
}

export const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d)
export const str = (v: unknown) => (v === undefined || v === null || v === '' ? null : String(v).trim())
