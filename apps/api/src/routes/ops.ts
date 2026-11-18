import { Hono } from 'hono'
import { App, all, one, run, can, needPerm, ownerOnly, canSeeStudent, audit, timingSafeEqual, istNow, num, str, putFile, getFile, maxUpload } from '../lib'
import { recordArrival, notifyParent } from '../notify'
import { studentProfile } from './people'

export const ops = new Hono<App>()

// ---------------- ATTENDANCE ----------------
ops.get('/attendance', needPerm('attendance.mark'), async (c) => {
  const date = c.req.query('date') || istNow().date
  const a = c.get('auth')
  const scoped = a.role === 'staff' && !a.perms.includes('students.viewAll')
  const rows = await all(c.env.DB, `
    SELECT s.id AS student_id, s.name, s.admission_no, s.batch_time, at.check_in, COALESCE(at.status, 'pending') AS status, at.source
    FROM students s LEFT JOIN attendance at ON at.student_id = s.id AND at.att_date = ?
    WHERE s.status = 'active' ${scoped ? 'AND s.id IN (SELECT student_id FROM enrollments WHERE staff_id = ? AND active = 1)' : ''}
    ORDER BY s.name`, ...(scoped ? [date, a.refId] : [date]))
  return c.json({ date, attendance: rows })
})

ops.post('/attendance/manual', needPerm('attendance.mark'), async (c) => {
  const b = await c.req.json<any>()
  if (!(await canSeeStudent(c, num(b.student_id)))) return c.json({ error: 'Forbidden' }, 403)
  const s = await one<any>(c.env.DB, 'SELECT id, name, parent_phone, batch_time FROM students WHERE id = ?', b.student_id)
  if (!s) return c.json({ error: 'Not found' }, 404)
  if (b.status === 'absent') {
    const { date } = istNow()
    await run(c.env.DB, `INSERT INTO attendance (student_id, att_date, status, source) VALUES (?,?, 'absent','manual')
      ON CONFLICT(student_id, att_date) DO UPDATE SET status = 'absent', source = 'manual'`, s.id, date)
    await notifyParent(c.env, s, 'absent', 'Absent today', `${s.name} was marked absent today.`)
    return c.json({ ok: true })
  }
  return c.json(await recordArrival(c.env, s))
})

/**
 * Biometric device endpoint. The device (or a small gateway next to it) POSTs { biometric_id }
 * with header X-Device-Key. Only the device-side ID is stored here, never fingerprint templates.
 */
export const device = new Hono<App>()
device.post('/biometric', async (c) => {
  const key = c.env.BIOMETRIC_DEVICE_KEY
  if (!key || !timingSafeEqual(key, c.req.header('x-device-key') ?? '')) return c.json({ error: 'Unauthorized device' }, 401)
  const { biometric_id } = await c.req.json<{ biometric_id?: string }>().catch(() => ({} as any))
  if (!biometric_id) return c.json({ error: 'biometric_id required' }, 400)
  const s = await one<any>(c.env.DB, "SELECT id, name, parent_phone, batch_time FROM students WHERE biometric_id = ? AND status = 'active'", String(biometric_id))
  if (!s) return c.json({ error: 'Unknown biometric id' }, 404)
  return c.json({ student: s.name, ...(await recordArrival(c.env, s)) })
})

// ---------------- NOTIFICATIONS ----------------
async function visibleNotifs(c: any, limit: number) {
  const a = c.get('auth')
  if (a.role === 'student')
    return all<any>(c.env.DB, 'SELECT id, type, title, body, created_at FROM notifications WHERE student_id = ? ORDER BY id DESC LIMIT ?', a.refId, limit)
  if (a.role === 'staff' && !a.perms.includes('students.viewAll')) return []
  // owner: an announcement sent to many parents shows as one row
  return all<any>(c.env.DB, `SELECT * FROM (
      SELECT n.id, n.type, n.title, n.body, n.status, n.created_at, n.batch, 1 AS recipients, s.name AS student FROM notifications n LEFT JOIN students s ON s.id = n.student_id WHERE n.batch IS NULL
      UNION ALL
      SELECT MAX(id) AS id, 'announcement' AS type, title, body, MIN(status) AS status, MIN(created_at) AS created_at, batch, COUNT(*) AS recipients, NULL AS student FROM notifications WHERE batch IS NOT NULL GROUP BY batch
    ) ORDER BY id DESC LIMIT ?`, limit)
}
ops.get('/notifications', async (c) => {
  const a = c.get('auth')
  const list = await visibleNotifs(c, 200)
  const seen = (await one<any>(c.env.DB, 'SELECT notif_seen_id AS n FROM users WHERE id = ?', a.uid))?.n ?? 0
  return c.json({ notifications: list, unread: list.filter((n: any) => n.id > seen && !(a.role === 'owner' && n.type === 'announcement')).length, seenId: seen })
})
ops.get('/notifications/unread', async (c) => {
  const a = c.get('auth')
  const list = await visibleNotifs(c, 200)
  const seen = (await one<any>(c.env.DB, 'SELECT notif_seen_id AS n FROM users WHERE id = ?', a.uid))?.n ?? 0
  const fresh = list.filter((n: any) => n.id > seen && !(a.role === 'owner' && n.type === 'announcement'))
  return c.json({ unread: fresh.length, latest: fresh[0] ?? null })
})
ops.post('/notifications/seen', async (c) => {
  const a = c.get('auth')
  const list = await visibleNotifs(c, 1)
  if (list[0]) await run(c.env.DB, 'UPDATE users SET notif_seen_id = MAX(notif_seen_id, ?) WHERE id = ?', list[0].id, a.uid)
  return c.json({ ok: true })
})
ops.post('/devices', async (c) => {
  const { token, platform } = await c.req.json<any>().catch(() => ({} as any))
  if (!token) return c.json({ error: 'token required' }, 400)
  await run(c.env.DB, 'INSERT OR REPLACE INTO device_tokens (token, user_id, platform) VALUES (?,?,?)', String(token).slice(0, 300), c.get('auth').uid, str(platform))
  return c.json({ ok: true })
})
ops.post('/notifications/broadcast', ownerOnly, async (c) => {
  const { title, body, studentIds } = await c.req.json<any>()
  if (!title || !body) return c.json({ error: 'title and body required' }, 400)
  const rows = Array.isArray(studentIds) && studentIds.length
    ? await all<any>(c.env.DB, `SELECT id, parent_phone FROM students WHERE id IN (${studentIds.map(() => '?').join(',')})`, ...studentIds)
    : await all<any>(c.env.DB, "SELECT id, parent_phone FROM students WHERE status = 'active'")
  const batch = crypto.randomUUID()
  for (const s of rows) { const id = await notifyParent(c.env, s, 'announcement', title, body); if (id) await run(c.env.DB, 'UPDATE notifications SET batch = ? WHERE id = ?', batch, id) }
  return c.json({ sent: rows.length, batch })
})
/** Owner only: delete one sent notification, or a whole announcement (batch). */
ops.delete('/notifications/:id', ownerOnly, async (c) => {
  const id = c.req.param('id')
  if (id.includes('-')) await run(c.env.DB, 'DELETE FROM notifications WHERE batch = ?', id)
  else await run(c.env.DB, 'DELETE FROM notifications WHERE id = ?', num(id))
  await audit(c, 'notification.delete', { id })
  return c.json({ ok: true })
})

// ---------------- QUERIES / SUGGESTIONS / REPORTS / HELP ----------------
ops.post('/queries', async (c) => {
  const b = await c.req.json<any>()
  if (!['query', 'suggestion', 'report', 'help'].includes(b.kind) || !b.subject || !b.message) return c.json({ error: 'kind, subject, message required' }, 400)
  await run(c.env.DB, 'INSERT INTO queries (user_id, kind, subject, message) VALUES (?,?,?,?)', c.get('auth').uid, b.kind, String(b.subject).slice(0, 150), String(b.message).slice(0, 4000))
  return c.json({ ok: true }, 201)
})
ops.get('/queries', async (c) => {
  const a = c.get('auth')
  const rows = a.role === 'owner'
    ? await all(c.env.DB, 'SELECT q.*, u.name AS from_name, u.role AS from_role FROM queries q JOIN users u ON u.id = q.user_id ORDER BY q.id DESC LIMIT 200')
    : await all(c.env.DB, 'SELECT * FROM queries WHERE user_id = ? ORDER BY id DESC LIMIT 100', a.uid)
  return c.json({ queries: rows })
})
ops.patch('/queries/:id', ownerOnly, async (c) => {
  const b = await c.req.json<any>()
  await run(c.env.DB, 'UPDATE queries SET status = ?, reply = COALESCE(?, reply) WHERE id = ?', b.status || 'closed', str(b.reply), num(c.req.param('id')))
  return c.json({ ok: true })
})

// ---------------- MEDIA (R2) ----------------
ops.post('/media/upload', async (c) => {
  const a = c.get('auth')
  const form = await c.req.formData()
  const file = form.get('file') as unknown as File | null
  const studentId = num(form.get('student_id'))
  const kind = String(form.get('kind') || 'other')
  if (!file || typeof file === 'string') return c.json({ error: 'file required' }, 400)
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return c.json({ error: 'Only JPEG, PNG or WebP images' }, 400)
  if (file.size > 5 * 1024 * 1024) return c.json({ error: 'Max 5 MB' }, 400)
  if (!can(a, 'achievements.edit') || (studentId && !(await canSeeStudent(c, studentId)))) return c.json({ error: 'Forbidden' }, 403)
  if (file.size > maxUpload(c.env)) return c.json({ error: 'Image too large' }, 400)
  const key = `${studentId || 'general'}/${crypto.randomUUID()}.${file.type.split('/')[1]}`
  await putFile(c.env, key, file)
  await run(c.env.DB, 'INSERT INTO media (student_id, kind, r2_key, caption) VALUES (?,?,?,?)', studentId || null, kind, key, str(form.get('caption')))
  if (kind === 'profile' && studentId) await run(c.env.DB, 'UPDATE students SET photo_key = ? WHERE id = ?', key, studentId)
  return c.json({ key }, 201)
})
ops.get('/media/*', async (c) => {
  const key = decodeURIComponent(c.req.path.replace(/^.*\/media\//, ''))
  const m = await one<any>(c.env.DB, 'SELECT student_id FROM media WHERE r2_key = ?', key)
  const staffPhoto = !m && (await one(c.env.DB, 'SELECT 1 AS x FROM staff WHERE photo_key = ?', key))
  if (!m && !staffPhoto) return c.notFound()
  if (m?.student_id && !(await canSeeStudent(c, m.student_id))) return c.json({ error: 'Forbidden' }, 403)
  const obj = await getFile(c.env, key)
  if (!obj) return c.notFound()
  return new Response(obj.body, { headers: { 'Content-Type': obj.type, 'Cache-Control': 'private, max-age=3600' } })
})

// ---------------- ROLE HOME ENDPOINTS ----------------
ops.get('/me/student', async (c) => {
  const a = c.get('auth')
  if (a.role !== 'student' || !a.refId) return c.json({ error: 'Students only' }, 403)
  return c.json(await studentProfile(c, a.refId))
})

// ---------------- OWNER REPORTS ----------------
ops.get('/reports/overview', ownerOnly, async (c) => {
  const db = c.env.DB
  const { date } = istNow()
  const month = date.slice(0, 7)
  const [counts, monthly, bySource, pendingFees, bySport, academic, attendance, lowStock, recent, expensesByCat] = await Promise.all([
    one<any>(db, `SELECT (SELECT COUNT(*) FROM students WHERE status='active') AS students, (SELECT COUNT(*) FROM staff st JOIN users u ON u.id = st.user_id WHERE u.pending = 0) AS staff,
      (SELECT COUNT(*) FROM achievements) AS achievements, (SELECT COUNT(*) FROM matches) AS matches`),
    all(db, `SELECT m AS month, COALESCE(inc,0) AS income, COALESCE(exp,0) AS expense FROM (
        SELECT strftime('%Y-%m', income_date) AS m FROM incomes UNION SELECT strftime('%Y-%m', expense_date) FROM expenses)
      LEFT JOIN (SELECT strftime('%Y-%m', income_date) AS im, SUM(amount) AS inc FROM incomes WHERE status='received' GROUP BY im) ON im = m
      LEFT JOIN (SELECT strftime('%Y-%m', expense_date) AS em, SUM(amount) AS exp FROM expenses GROUP BY em) ON em = m
      ORDER BY m DESC LIMIT 12`),
    all(db, `SELECT type, status, SUM(amount) AS total FROM incomes WHERE strftime('%Y', income_date) = strftime('%Y', ?) GROUP BY type, status`, date),
    one<any>(db, "SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS n, COALESCE(SUM(CASE WHEN due_date < ? THEN amount END),0) AS overdue FROM fees WHERE status='pending'", date),
    all(db, `SELECT sp.name AS sport, COUNT(DISTINCT e.student_id) AS students FROM sports sp LEFT JOIN enrollments e ON e.sport_id = sp.id AND e.active = 1 GROUP BY sp.id ORDER BY students DESC`),
    all(db, `SELECT year || ' ' || term AS period, ROUND(AVG(percentage),1) AS avg FROM academic_records GROUP BY year, term ORDER BY year, term`),
    one<any>(db, `SELECT SUM(status='present') AS present, SUM(status='late') AS late, SUM(status='absent') AS absent FROM attendance WHERE strftime('%Y-%m', att_date) = ?`, month),
    all(db, 'SELECT id, name, qty, reorder_level FROM equipment WHERE qty <= reorder_level ORDER BY qty'),
    all(db, `SELECT ac.title, ac.level, ac.position, ac.event_date, s.name AS student FROM achievements ac JOIN students s ON s.id = ac.student_id ORDER BY ac.event_date DESC LIMIT 6`),
    all(db, `SELECT category, SUM(amount) AS total FROM expenses WHERE strftime('%Y', expense_date) = strftime('%Y', ?) GROUP BY category ORDER BY total DESC`, date),
  ])
  const thisMonth = monthly.find((m: any) => m.month === month) ?? { income: 0, expense: 0 }
  return c.json({
    counts, monthly: monthly.reverse(), bySource, pendingFees, bySport, academic, attendance, lowStock, recent, expensesByCat,
    thisMonth, today: date,
  })
})
