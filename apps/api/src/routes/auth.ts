import { Hono } from 'hono'
import { App, Ctx, all, one, run, verifyPassword, hashPassword, signToken, verifyGoogleToken, requireAuth, tempPassword, istNow, str } from '../lib'

export const auth = new Hono<App>()

auth.post('/login', async (c) => {
  const { username, password } = await c.req.json<{ username?: string; password?: string }>().catch(() => ({} as any))
  if (!username || !password) return c.json({ error: 'Username and password required' }, 400)
  const u = await one<any>(c.env.DB, 'SELECT * FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE', username.trim(), username.trim())
  // Always run a hash to keep timing similar for unknown users
  const ok = u ? await verifyPassword(password, u.password_hash) : (await hashPassword(password), false)
  if (!u || !ok) return c.json({ error: 'Invalid username or password' }, 401)
  if (u.pending) return c.json({ error: 'Your registration is awaiting approval by the academy.', code: 'pending' }, 403)
  if (!u.active) return c.json({ error: 'This account has been disabled. Contact the academy.' }, 403)
  return c.json({ token: await signToken(c.env, u.id, u.role), user: publicUser(u) })
})

/**
 * Google sign-in. Existing accounts sign in directly. Unknown emails can sign up by sending `signup`
 * (role etc.); that creates a pending account which the owner must approve.
 */
auth.post('/google', async (c) => {
  const { idToken, signup } = await c.req.json<{ idToken?: string; signup?: any }>().catch(() => ({} as any))
  if (!idToken) return c.json({ error: 'idToken required' }, 400)
  let g
  try { g = await verifyGoogleToken(c.env, idToken) } catch { return c.json({ error: 'Google verification failed' }, 401) }
  const u = await one<any>(c.env.DB, 'SELECT * FROM users WHERE email = ? COLLATE NOCASE', g.email)
  if (u) {
    if (u.pending) return c.json({ error: 'Your registration is awaiting approval by the academy.', code: 'pending' }, 403)
    if (!u.active) return c.json({ error: 'This account has been disabled. Contact the academy.' }, 403)
    return c.json({ token: await signToken(c.env, u.id, u.role), user: publicUser(u) })
  }
  if (!signup) return c.json({ error: 'No academy account uses this Google email yet. Please sign up first.', code: 'not_registered' }, 404)
  const err = await createPending(c, { ...signup, email: g.email, name: signup.name || g.name || g.email })
  if (err) return c.json({ error: err }, 400)
  return c.json({ pending: true, message: 'Registration received. The academy will approve your account soon.' }, 201)
})

/** Public sign-up (student/parent or coach). Needs owner approval before first sign-in. */
auth.post('/signup', async (c) => {
  const b = await c.req.json<any>().catch(() => ({}))
  if (b.website) return c.json({ pending: true }, 201) // honeypot: bots fill hidden fields
  if (!b.password || String(b.password).length < 8) return c.json({ error: 'Password must be at least 8 characters' }, 400)
  const err = await createPending(c, b)
  if (err) return c.json({ error: err }, 400)
  return c.json({ pending: true, message: 'Registration received. The academy will approve your account soon.' }, 201)
})

async function createPending(c: Ctx, b: any): Promise<string | null> {
  const role = b.role === 'staff' ? 'staff' : b.role === 'student' ? 'student' : null
  if (!role) return 'Choose whether you are a student/parent or a coach'
  const name = str(b.name)
  const email = str(b.email)?.toLowerCase() ?? null
  const phone = str(b.phone)?.replace(/[^\d+]/g, '') ?? null
  if (!name || name.length < 2) return 'Enter your full name'
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return 'Enter a valid email'
  if (!phone || phone.replace(/\D/g, '').length < 10) return 'Enter a valid phone number'
  const dup = await one(c.env.DB, 'SELECT 1 AS x FROM users WHERE email = ? COLLATE NOCASE OR username = ? COLLATE NOCASE', email, email)
  if (dup) return 'An account with this email already exists. Try signing in.'
  const open = await one<{ n: number }>(c.env.DB, 'SELECT COUNT(*) AS n FROM users WHERE pending = 1')
  if (open && open.n >= 200) return 'Too many pending registrations right now. Please contact the academy.'
  const hash = await hashPassword(b.password ? String(b.password) : tempPassword())
  const u = await run(c.env.DB,
    'INSERT INTO users (username, email, password_hash, role, name, pending, must_change_password, signup_note) VALUES (?,?,?,?,?,1,0,?)',
    email, email, hash, role, name, str(b.note))
  const uid = u.meta.last_row_id
  if (role === 'student') {
    const n = await one<{ n: number }>(c.env.DB, "SELECT COALESCE(MAX(CAST(substr(username, 7) AS INTEGER)), 0) + 1 AS n FROM users WHERE username LIKE 'GSA-S-%'")
    const maxAdm = await one<{ n: number }>(c.env.DB, "SELECT COALESCE(MAX(CAST(substr(admission_no, 7) AS INTEGER)), 0) + 1 AS n FROM students")
    const code = `GSA-S-${String(Math.max(n!.n, maxAdm!.n)).padStart(4, '0')}`
    await run(c.env.DB,
      "INSERT INTO students (user_id, admission_no, name, dob, parent_name, parent_phone, parent_email, joined_on, status) VALUES (?,?,?,?,?,?,?,?, 'pending')",
      uid, code, name, str(b.dob), str(b.parent_name), phone, email, istNow().date)
  } else {
    await run(c.env.DB, 'INSERT INTO staff (user_id, name, phone, joined_on) VALUES (?,?,?,?)', uid, name, phone, istNow().date)
  }
  return null
}

auth.get('/me', requireAuth, async (c) => {
  const a = c.get('auth')
  const u = await one<any>(c.env.DB, 'SELECT must_change_password FROM users WHERE id = ?', a.uid)
  return c.json({ user: { ...a, mustChange: !!u?.must_change_password } })
})

auth.post('/change-password', requireAuth, async (c) => {
  const { current, next } = await c.req.json<{ current?: string; next?: string }>().catch(() => ({} as any))
  if (!current || !next || next.length < 8) return c.json({ error: 'New password must be at least 8 characters' }, 400)
  const a = c.get('auth')
  const u = await one<any>(c.env.DB, 'SELECT password_hash FROM users WHERE id = ?', a.uid)
  if (!u || !(await verifyPassword(current, u.password_hash))) return c.json({ error: 'Current password is wrong' }, 400)
  await run(c.env.DB, 'UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?', await hashPassword(next), a.uid)
  return c.json({ ok: true })
})

const publicUser = (u: any) => ({
  id: u.id, username: u.username, name: u.name, role: u.role, email: u.email, mustChangePassword: !!u.must_change_password,
})
