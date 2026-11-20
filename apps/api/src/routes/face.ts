import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import { Env, all, one, run, can, audit, istNow, num, str, App } from '../lib'
import { recordArrival } from '../notify'

/**
 * GSA Face Attendance backend.
 *
 * Two surfaces:
 *  - /device/face/*  used by the dedicated academy phone. Authenticated by a per-device random token
 *                    obtained once through a one-time pairing code. No secret is ever built into the APK.
 *  - /api/face/*     used by the website (and the app's admin screen) with a normal signed-in session.
 *                    Needs the owner, or staff with the `face.manage` permission.
 *
 * Face templates NEVER reach the server: it only stores consent, lifecycle metadata and attendance events.
 */

const CONSENT_VERSION = 'v1'
const NOTIFY_WINDOW_MS = 6 * 60 * 60 * 1000 // do not message parents about scans older than 6 hours
const MAX_BATCH = 100
const EVENT_ID = /^[A-Za-z0-9-]{8,64}$/

// ---------- helpers ----------
async function sha256Hex(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('')
}
function randomHex(bytes: number) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('')
}
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
function pairingCode() {
  const r = crypto.getRandomValues(new Uint8Array(10))
  const s = Array.from(r, (n) => CODE_CHARS[n % CODE_CHARS.length]).join('')
  return `${s.slice(0, 5)}-${s.slice(5)}`
}
const normCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, '')
const plusMinutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString()
const addDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

function isMinor(dob: string | null) {
  if (!dob) return true // unknown age: treat as a minor, guardian consent required
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return true
  const eighteen = new Date(d); eighteen.setFullYear(d.getFullYear() + 18)
  return eighteen.getTime() > Date.now()
}

// =====================================================================
// DEVICE SURFACE
// =====================================================================
type DeviceRow = { id: number; name: string; mode: 'ENTRY' | 'EXIT' }
type DeviceApp = { Bindings: Env; Variables: { device: DeviceRow } }
export const faceDevice = new Hono<DeviceApp>()

/** Exchange a one-time pairing code (created by an admin) for this phone's device token. */
faceDevice.post('/pair', async (c) => {
  const b = await c.req.json<{ code?: string }>().catch(() => ({} as any))
  const code = normCode(String(b.code ?? ''))
  if (code.length !== 10) return c.json({ error: 'Enter the 10 character pairing code' }, 400)
  const hash = await sha256Hex(code)
  const row = await one<{ device_id: number }>(c.env.DB,
    "SELECT device_id FROM face_pairing_codes WHERE code_hash = ? AND used_at IS NULL AND expires_at > ?", hash, new Date().toISOString())
  if (!row) return c.json({ error: 'Pairing code is invalid or has expired. Ask the owner for a new one.' }, 401)
  const dev = await one<DeviceRow & { revoked_at: string | null }>(c.env.DB, 'SELECT id, name, mode, revoked_at FROM face_devices WHERE id = ?', row.device_id)
  if (!dev || dev.revoked_at) return c.json({ error: 'This device was revoked' }, 401)
  const token = `gsad_${randomHex(32)}`
  // Mark the code used first; a second request with the same code then fails.
  const claimed = await run(c.env.DB, "UPDATE face_pairing_codes SET used_at = ? WHERE code_hash = ? AND used_at IS NULL", new Date().toISOString(), hash)
  if (!claimed.meta.changes) return c.json({ error: 'Pairing code was already used' }, 401)
  await run(c.env.DB, "UPDATE face_devices SET token_hash = ?, paired_at = datetime('now'), last_seen = datetime('now'), active = 1 WHERE id = ?", await sha256Hex(token), dev.id)
  return c.json({ token, device: { id: dev.id, name: dev.name, mode: dev.mode } })
})

const deviceAuth: MiddlewareHandler<DeviceApp> = async (c, next) => {
  const h = c.req.header('Authorization') ?? ''
  if (!h.startsWith('Device ')) return c.json({ error: 'Unauthorized device' }, 401)
  const dev = await one<DeviceRow>(c.env.DB,
    'SELECT id, name, mode FROM face_devices WHERE token_hash = ? AND active = 1 AND revoked_at IS NULL', await sha256Hex(h.slice(7).trim()))
  if (!dev) return c.json({ error: 'Unauthorized device' }, 401)
  c.set('device', dev)
  await run(c.env.DB, "UPDATE face_devices SET last_seen = datetime('now') WHERE id = ?", dev.id)
  await next()
}
faceDevice.use('/config', deviceAuth)
faceDevice.use('/roster', deviceAuth)
faceDevice.use('/enrolled', deviceAuth)
faceDevice.use('/deleted', deviceAuth)
faceDevice.use('/events', deviceAuth)

faceDevice.get('/config', (c) => {
  const d = c.get('device')
  return c.json({
    device: { id: d.id, name: d.name }, mode: d.mode, server_time: new Date().toISOString(),
    consent_version: CONSENT_VERSION, cooldown_seconds: 600,
  })
})

/** Who may be enrolled on the phone, and whose templates must now be deleted from it. */
faceDevice.get('/roster', async (c) => {
  const today = istNow().date
  const students = await all(c.env.DB, `
    SELECT s.id, s.name, s.admission_no, s.batch_time, e.status
    FROM face_enrolments e JOIN students s ON s.id = e.student_id
    WHERE s.status = 'active' AND e.status IN ('consented','enrolled') AND (e.retention_until IS NULL OR e.retention_until >= ?)
    ORDER BY s.name`, today)
  const deleteIds = await all<{ student_id: number }>(c.env.DB, `
    SELECT e.student_id FROM face_enrolments e JOIN students s ON s.id = e.student_id
    WHERE (e.status = 'revoked' AND e.delete_confirmed_at IS NULL)
       OR (e.status IN ('consented','enrolled') AND e.retention_until IS NOT NULL AND e.retention_until < ?)
       OR s.status <> 'active'`, today)
  return c.json({ students, delete_ids: deleteIds.map((r) => r.student_id), server_time: new Date().toISOString() })
})

faceDevice.post('/enrolled', async (c) => {
  const d = c.get('device')
  const b = await c.req.json<{ student_id?: number; model_sha?: string }>().catch(() => ({} as any))
  const id = num(b.student_id)
  const e = await one<{ status: string }>(c.env.DB, 'SELECT status FROM face_enrolments WHERE student_id = ?', id)
  if (!e || e.status === 'revoked') return c.json({ error: 'No active consent for this student' }, 409)
  await run(c.env.DB, "UPDATE face_enrolments SET status = 'enrolled', enrolled_at = datetime('now'), enrolled_device_id = ?, model_sha = ? WHERE student_id = ?", d.id, str(b.model_sha), id)
  return c.json({ ok: true })
})

/** The phone confirms it erased these templates. */
faceDevice.post('/deleted', async (c) => {
  const b = await c.req.json<{ student_ids?: number[] }>().catch(() => ({} as any))
  const ids = (Array.isArray(b.student_ids) ? b.student_ids : []).map(Number).filter(Number.isFinite).slice(0, 500)
  for (const id of ids) {
    await run(c.env.DB, `UPDATE face_enrolments SET status = 'revoked', revoked_at = COALESCE(revoked_at, datetime('now')), delete_confirmed_at = datetime('now') WHERE student_id = ?`, id)
  }
  return c.json({ ok: true, confirmed: ids.length })
})

type Incoming = {
  event_id: string; student_id: number; event_type: 'ENTRY' | 'EXIT'; method?: 'face' | 'manual'
  occurred_at: string; match_score?: number; liveness_score?: number; marked_by?: string
}

/**
 * Batch upload of scans. Idempotent on event_id. An event is acknowledged ONLY after it is durably stored
 * (or was already stored earlier). `rejected` events are permanently invalid; the phone keeps them for review.
 * Anything not listed in either array must be retried.
 */
faceDevice.post('/events', async (c) => {
  const d = c.get('device')
  const b = await c.req.json<{ events?: Incoming[] }>().catch(() => ({} as any))
  const events = Array.isArray(b.events) ? b.events.slice(0, MAX_BATCH) : []
  const acked: string[] = []
  const rejected: { event_id: string; reason: string }[] = []

  for (const ev of events) {
    const eid = String(ev?.event_id ?? '')
    try {
      if (!EVENT_ID.test(eid)) { rejected.push({ event_id: eid, reason: 'bad_event_id' }); continue }
      if (ev.event_type !== 'ENTRY' && ev.event_type !== 'EXIT') { rejected.push({ event_id: eid, reason: 'bad_event_type' }); continue }
      const method = ev.method === 'manual' ? 'manual' : 'face'
      const when = new Date(String(ev.occurred_at))
      if (Number.isNaN(when.getTime()) || when.getTime() > Date.now() + 10 * 60_000 || when.getTime() < Date.now() - 400 * 86_400_000) {
        rejected.push({ event_id: eid, reason: 'bad_time' }); continue
      }
      const already = await one(c.env.DB, 'SELECT 1 AS x FROM attendance_events WHERE event_id = ?', eid)
      if (already) { acked.push(eid); continue } // retry of something we already saved

      const s = await one<any>(c.env.DB, "SELECT id, name, parent_phone, batch_time, status FROM students WHERE id = ?", num(ev.student_id))
      if (!s || s.status !== 'active') { rejected.push({ event_id: eid, reason: 'unknown_student' }); continue }
      if (method === 'face') {
        const en = await one<{ status: string }>(c.env.DB, 'SELECT status FROM face_enrolments WHERE student_id = ?', s.id)
        if (!en || en.status === 'revoked') { rejected.push({ event_id: eid, reason: 'no_consent' }); continue }
      }
      const at = istNow(when)
      const fresh = Date.now() - when.getTime() <= NOTIFY_WINDOW_MS
      const source = method === 'face' ? 'face' : 'face-manual'
      let applied = 0

      // Update the daily summary first (idempotent), then store the event. If the insert fails the event is
      // not acknowledged, the phone retries, and the retry finds the summary already updated.
      if (ev.event_type === 'ENTRY') {
        const r = await recordArrival(c.env, s, at, { source, notify: fresh })
        applied = r.status === 'duplicate' ? 0 : 1
      } else {
        const day = await one<{ id: number; check_out: string | null }>(c.env.DB, 'SELECT id, check_out FROM attendance WHERE student_id = ? AND att_date = ?', s.id, at.date)
        if (day && (!day.check_out || day.check_out < at.time)) {
          await run(c.env.DB, 'UPDATE attendance SET check_out = ? WHERE id = ?', at.time, day.id)
          applied = 1
        }
      }
      await run(c.env.DB,
        `INSERT OR IGNORE INTO attendance_events (event_id, student_id, device_id, event_type, method, occurred_at, att_date, att_time, match_score, liveness_score, marked_by, applied)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        eid, s.id, d.id, ev.event_type, method, when.toISOString(), at.date, at.time,
        Number.isFinite(Number(ev.match_score)) ? Number(ev.match_score) : null,
        Number.isFinite(Number(ev.liveness_score)) ? Number(ev.liveness_score) : null,
        str(ev.marked_by)?.slice(0, 80) ?? null, applied)
      acked.push(eid)
    } catch (e) {
      console.error('face event failed', eid, e) // not acked: the phone keeps it and retries
    }
  }
  return c.json({ acked, rejected })
})

// =====================================================================
// ADMIN SURFACE (website and the app's admin screen)
// =====================================================================
export const faceAdmin = new Hono<App>()
faceAdmin.use('*', async (c, next) => {
  if (!can(c.get('auth'), 'face.manage')) return c.json({ error: 'Forbidden' }, 403)
  await next()
})

async function newCode(c: any, deviceId: number) {
  const code = pairingCode()
  await run(c.env.DB, 'DELETE FROM face_pairing_codes WHERE device_id = ? OR expires_at < ?', deviceId, new Date().toISOString())
  await run(c.env.DB, 'INSERT INTO face_pairing_codes (code_hash, device_id, expires_at) VALUES (?,?,?)', await sha256Hex(normCode(code)), deviceId, plusMinutes(15))
  return code
}

faceAdmin.get('/devices', async (c) =>
  c.json({ devices: await all(c.env.DB, `SELECT id, name, mode, active, paired_at, last_seen, revoked_at, (token_hash IS NOT NULL) AS paired FROM face_devices WHERE revoked_at IS NULL ORDER BY id`) }))

faceAdmin.post('/devices', async (c) => {
  const b = await c.req.json<any>().catch(() => ({}))
  const name = str(b.name)
  if (!name) return c.json({ error: 'Give the device a name' }, 400)
  const res = await run(c.env.DB, 'INSERT INTO face_devices (name, mode, created_by) VALUES (?,?,?)', name.slice(0, 60), b.mode === 'EXIT' ? 'EXIT' : 'ENTRY', c.get('auth').uid)
  const id = res.meta.last_row_id as number
  await audit(c, 'face.device.create', { id, name })
  return c.json({ id, code: await newCode(c, id), expires_in_minutes: 15 }, 201)
})

faceAdmin.post('/devices/:id/pairing-code', async (c) => {
  const id = num(c.req.param('id'))
  if (!(await one(c.env.DB, 'SELECT 1 AS x FROM face_devices WHERE id = ? AND revoked_at IS NULL', id))) return c.json({ error: 'Not found' }, 404)
  await audit(c, 'face.device.recode', { id })
  return c.json({ code: await newCode(c, id), expires_in_minutes: 15 })
})

faceAdmin.patch('/devices/:id', async (c) => {
  const id = num(c.req.param('id'))
  const b = await c.req.json<any>().catch(() => ({}))
  const d = await one<any>(c.env.DB, 'SELECT * FROM face_devices WHERE id = ? AND revoked_at IS NULL', id)
  if (!d) return c.json({ error: 'Not found' }, 404)
  const mode = b.mode === 'ENTRY' || b.mode === 'EXIT' ? b.mode : d.mode
  await run(c.env.DB, 'UPDATE face_devices SET mode = ?, name = ?, active = ? WHERE id = ?', mode, str(b.name)?.slice(0, 60) ?? d.name, b.active === undefined ? d.active : b.active ? 1 : 0, id)
  await audit(c, 'face.device.update', { id, mode })
  return c.json({ ok: true })
})

faceAdmin.delete('/devices/:id', async (c) => {
  if (c.get('auth').role !== 'owner') return c.json({ error: 'Owner access only' }, 403)
  const id = num(c.req.param('id'))
  await run(c.env.DB, "UPDATE face_devices SET revoked_at = datetime('now'), active = 0, token_hash = NULL WHERE id = ?", id)
  await audit(c, 'face.device.revoke', { id })
  return c.json({ ok: true })
})

faceAdmin.get('/students', async (c) => {
  const rows = await all<any>(c.env.DB, `
    SELECT s.id, s.name, s.admission_no, s.dob, e.status, e.guardian_name, e.guardian_relation, e.consent_at, e.enrolled_at, e.retention_until, e.revoked_at, e.delete_confirmed_at
    FROM students s LEFT JOIN face_enrolments e ON e.student_id = s.id WHERE s.status = 'active' ORDER BY s.name`)
  return c.json({ students: rows.map((r) => ({ ...r, dob: undefined, is_minor: isMinor(r.dob), status: r.status ?? 'none' })) })
})

faceAdmin.put('/students/:id/consent', async (c) => {
  const id = num(c.req.param('id'))
  const b = await c.req.json<any>().catch(() => ({}))
  const s = await one<any>(c.env.DB, "SELECT id, dob FROM students WHERE id = ? AND status = 'active'", id)
  if (!s) return c.json({ error: 'Not found' }, 404)
  if (b.confirm !== true) return c.json({ error: 'Consent must be confirmed explicitly' }, 400)
  const minor = isMinor(s.dob)
  const guardian = str(b.guardian_name)
  if (minor && (!guardian || guardian.length < 2)) return c.json({ error: 'A parent or guardian name is required for a minor' }, 400)
  const days = Math.min(Math.max(num(b.retention_days, 365), 30), 1095)
  const cur = await one<{ status: string }>(c.env.DB, 'SELECT status FROM face_enrolments WHERE student_id = ?', id)
  const status = cur?.status === 'enrolled' ? 'enrolled' : 'consented'
  await run(c.env.DB, `
    INSERT INTO face_enrolments (student_id, status, is_minor, guardian_name, guardian_relation, consent_version, consent_at, consent_recorded_by, retention_until)
    VALUES (?,?,?,?,?,?,datetime('now'),?,?)
    ON CONFLICT(student_id) DO UPDATE SET status = excluded.status, is_minor = excluded.is_minor, guardian_name = excluded.guardian_name,
      guardian_relation = excluded.guardian_relation, consent_version = excluded.consent_version, consent_at = excluded.consent_at,
      consent_recorded_by = excluded.consent_recorded_by, retention_until = excluded.retention_until,
      revoked_at = NULL, revoked_by = NULL, delete_confirmed_at = NULL`,
    id, status, minor ? 1 : 0, guardian, str(b.guardian_relation), CONSENT_VERSION, c.get('auth').uid, addDays(days))
  await audit(c, 'face.consent', { student_id: id, minor, retention_days: days })
  return c.json({ ok: true, status, retention_until: addDays(days) })
})

/** Withdraw consent / delete the face data. The phone erases the template on its next sync. */
faceAdmin.delete('/students/:id', async (c) => {
  const id = num(c.req.param('id'))
  const r = await run(c.env.DB, "UPDATE face_enrolments SET status = 'revoked', revoked_at = datetime('now'), revoked_by = ?, delete_confirmed_at = NULL WHERE student_id = ?", c.get('auth').uid, id)
  if (!r.meta.changes) return c.json({ error: 'No face data for this student' }, 404)
  await audit(c, 'face.revoke', { student_id: id })
  return c.json({ ok: true })
})

faceAdmin.get('/events', async (c) => {
  const date = c.req.query('date') || istNow().date
  const rows = await all(c.env.DB, `
    SELECT e.id, e.event_id, s.name AS student, s.admission_no, e.event_type, e.method, e.att_time, e.att_date, e.match_score, e.liveness_score, e.marked_by, e.applied, d.name AS device
    FROM attendance_events e JOIN students s ON s.id = e.student_id LEFT JOIN face_devices d ON d.id = e.device_id
    WHERE e.att_date = ? ORDER BY e.occurred_at DESC LIMIT 500`, date)
  return c.json({ date, events: rows })
})
