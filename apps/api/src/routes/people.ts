import { Hono } from 'hono'
import {
  App, Ctx, all, one, run, can, canSeeStudent, needPerm, ownerOnly, audit, hashPassword, tempPassword, str, num, deleteFiles,
} from '../lib'

export const people = new Hono<App>()

const STUDENT_FIELDS = ['name', 'dob', 'birthplace', 'identification_mark', 'address', 'parent_name', 'parent_phone',
  'parent_email', 'parent_occupation', 'joined_on', 'school', 'college', 'academic_year', 'studying', 'remarks',
  'biometric_id', 'batch_time', 'status'] as const
const STAFF_FIELDS = ['name', 'dob', 'phone', 'primary_sport_id', 'experience_years', 'category', 'training',
  'achievements', 'major_domain', 'joined_on'] as const

async function nextCode(c: Ctx, table: 'students' | 'staff', prefix: string) {
  // MAX-based so codes stay unique after deletions
  const r = await one<{ n: number }>(c.env.DB,
    `SELECT COALESCE(MAX(CAST(substr(username, ?) AS INTEGER)), 0) + 1 AS n FROM users WHERE username LIKE ?`, prefix.length + 1, `${prefix}%`)
  let n = r!.n
  if (table === 'students') {
    const a = await one<{ n: number }>(c.env.DB, `SELECT COALESCE(MAX(CAST(substr(admission_no, ?) AS INTEGER)), 0) + 1 AS n FROM students`, prefix.length + 1)
    n = Math.max(n, a!.n)
  }
  return `${prefix}${String(n).padStart(4, '0')}`
}

// ---------------- STUDENTS ----------------
people.get('/students', needPerm('students.view'), async (c) => {
  const a = c.get('auth')
  const q = c.req.query('q')?.trim()
  const sport = c.req.query('sport')
  const where: string[] = ["s.status != 'pending'"]
  const params: unknown[] = []
  if (a.role === 'staff' && !a.perms.includes('students.viewAll')) {
    where.push('s.id IN (SELECT student_id FROM enrollments WHERE staff_id = ? AND active = 1)'); params.push(a.refId)
  }
  if (q) { where.push('(s.name LIKE ? OR s.admission_no LIKE ?)'); params.push(`%${q}%`, `%${q}%`) }
  if (sport) { where.push('s.id IN (SELECT student_id FROM enrollments WHERE sport_id = ?)'); params.push(sport) }
  const rows = await all(c.env.DB, `
    SELECT s.id, s.admission_no, s.name, s.dob, s.photo_key, s.parent_name, s.parent_phone, s.status, s.joined_on,
      (SELECT group_concat(sp.name, ', ') FROM enrollments e JOIN sports sp ON sp.id = e.sport_id WHERE e.student_id = s.id AND e.active = 1) AS sports,
      (SELECT COALESCE(SUM(amount),0) FROM fees f WHERE f.student_id = s.id AND f.status = 'pending') AS pending_fees
    FROM students s ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY s.name LIMIT 500`, ...params)
  const hide = a.role === 'staff' && !a.perms.includes('students.contact')
  return c.json({ students: hide ? rows.map((r: any) => ({ ...r, parent_phone: null, parent_name: null })) : rows })
})

people.post('/students', needPerm('students.edit'), async (c) => {
  const b = await c.req.json<any>()
  if (!b.name) return c.json({ error: 'Name is required' }, 400)
  const code = await nextCode(c, 'students', 'GSA-S-')
  const pw = tempPassword()
  const u = await run(c.env.DB,
    "INSERT INTO users (username, email, password_hash, role, name) VALUES (?,?,?,'student',?)",
    code, str(b.email), await hashPassword(pw), b.name)
  const vals = STUDENT_FIELDS.map((f) => (f === 'batch_time' ? str(b[f]) ?? '17:00' : f === 'status' ? 'active' : str(b[f])))
  const s = await run(c.env.DB,
    `INSERT INTO students (user_id, admission_no, ${STUDENT_FIELDS.join(',')}) VALUES (?,?,${STUDENT_FIELDS.map(() => '?').join(',')})`,
    u.meta.last_row_id, code, ...vals)
  await audit(c, 'student.create', { id: s.meta.last_row_id })
  // Temporary password is shown once, hand it to the parent. They must change it on first login.
  return c.json({ id: s.meta.last_row_id, username: code, tempPassword: pw }, 201)
})

people.get('/students/:id', async (c) => {
  const id = num(c.req.param('id'))
  if (!(await canSeeStudent(c, id))) return c.json({ error: 'Forbidden' }, 403)
  return c.json(await studentProfile(c, id))
})

people.patch('/students/:id', needPerm('students.edit'), async (c) => {
  const id = num(c.req.param('id'))
  if (!(await canSeeStudent(c, id))) return c.json({ error: 'Forbidden' }, 403)
  const b = await c.req.json<any>()
  const keys = STUDENT_FIELDS.filter((f) => f in b)
  if (!keys.length) return c.json({ error: 'Nothing to update' }, 400)
  await run(c.env.DB, `UPDATE students SET ${keys.map((k) => `${k} = ?`).join(',')} WHERE id = ?`, ...keys.map((k) => str(b[k])), id)
  await audit(c, 'student.update', { id, keys })
  return c.json({ ok: true })
})

/** Owner only. Permanently removes the student, their login, attendance, fees, photos and notifications.
 *  Financial income/equipment history is kept but unlinked from the student. */
people.delete('/students/:id', ownerOnly, async (c) => {
  const id = num(c.req.param('id'))
  const s = await one<any>(c.env.DB, 'SELECT id, user_id, name, admission_no, photo_key FROM students WHERE id = ?', id)
  if (!s) return c.json({ error: 'Not found' }, 404)
  const keys = (await all<{ r2_key: string }>(c.env.DB, 'SELECT r2_key FROM media WHERE student_id = ?', id)).map((m) => m.r2_key)
  if (s.photo_key && !keys.includes(s.photo_key)) keys.push(s.photo_key)
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE incomes SET student_id = NULL WHERE student_id = ?').bind(id),
    c.env.DB.prepare('UPDATE equipment_txns SET student_id = NULL WHERE student_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM students WHERE id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM queries WHERE user_id = ?').bind(s.user_id),
    c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(s.user_id),
  ])
  await deleteFiles(c.env, keys)
  await audit(c, 'student.delete', { id, admission_no: s.admission_no, name: s.name })
  return c.json({ ok: true })
})

// ---------------- MEDICAL (owner, the student, or staff granted students.medical) ----------------
const MED_BOOL = ['takes_medicine', 'has_allergy', 'had_surgery', 'bone_damage'] as const
const MED_TEXT = ['medicine_details', 'allergy_details', 'surgery_details', 'bone_details', 'other_issues', 'blood_group', 'emergency_contact'] as const
people.put('/students/:id/medical', async (c) => {
  const a = c.get('auth')
  const id = num(c.req.param('id'))
  const mine = a.role === 'student' && a.refId === id
  if (!(mine || a.role === 'owner' || (a.role === 'staff' && a.perms.includes('students.medical') && (await canSeeStudent(c, id))))) return c.json({ error: 'Forbidden' }, 403)
  const b = await c.req.json<any>()
  const vals = [...MED_BOOL.map((k) => (b[k] ? 1 : 0)), ...MED_TEXT.map((k) => str(b[k])?.slice(0, 500) ?? null)]
  const cols = [...MED_BOOL, ...MED_TEXT]
  await run(c.env.DB,
    `INSERT INTO student_medical (student_id, ${cols.join(',')}, updated_at) VALUES (?,${cols.map(() => '?').join(',')}, datetime('now'))
     ON CONFLICT(student_id) DO UPDATE SET ${cols.map((k) => `${k} = excluded.${k}`).join(',')}, updated_at = datetime('now')`, id, ...vals)
  await audit(c, 'student.medical', { id })
  return c.json({ ok: true })
})

// ---------------- SIGN-UP APPROVALS (owner) ----------------
people.get('/signups', ownerOnly, async (c) => {
  const rows = await all(c.env.DB, `
    SELECT u.id AS user_id, u.role, u.name, u.email, u.created_at, u.signup_note,
      COALESCE(s.parent_phone, st.phone) AS phone, s.dob, s.parent_name, s.admission_no
    FROM users u LEFT JOIN students s ON s.user_id = u.id LEFT JOIN staff st ON st.user_id = u.id
    WHERE u.pending = 1 ORDER BY u.id DESC`)
  return c.json({ signups: rows })
})
people.post('/signups/:userId/approve', ownerOnly, async (c) => {
  const uid = num(c.req.param('userId'))
  const u = await one<any>(c.env.DB, 'SELECT id, role FROM users WHERE id = ? AND pending = 1', uid)
  if (!u) return c.json({ error: 'Not found' }, 404)
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET pending = 0 WHERE id = ?').bind(uid),
    c.env.DB.prepare("UPDATE students SET status = 'active' WHERE user_id = ?").bind(uid),
  ])
  await audit(c, 'signup.approve', { uid })
  return c.json({ ok: true })
})
people.delete('/signups/:userId', ownerOnly, async (c) => {
  const uid = num(c.req.param('userId'))
  const u = await one<any>(c.env.DB, 'SELECT id FROM users WHERE id = ? AND pending = 1', uid)
  if (!u) return c.json({ error: 'Not found' }, 404)
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM students WHERE user_id = ?').bind(uid),
    c.env.DB.prepare('DELETE FROM staff WHERE user_id = ?').bind(uid),
    c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(uid),
  ])
  await audit(c, 'signup.reject', { uid })
  return c.json({ ok: true })
})

people.post('/students/:id/enrollments', needPerm('students.edit'), async (c) => {
  const id = num(c.req.param('id'))
  const b = await c.req.json<any>()
  if (!b.sport_id) return c.json({ error: 'sport_id required' }, 400)
  await run(c.env.DB,
    `INSERT INTO enrollments (student_id, sport_id, staff_id, level, category, sport_meta, joined_on)
     VALUES (?,?,?,?,?,?,?) ON CONFLICT(student_id, sport_id) DO UPDATE SET staff_id = excluded.staff_id,
     level = excluded.level, category = excluded.category, sport_meta = excluded.sport_meta, active = 1`,
    id, b.sport_id, b.staff_id ?? null, str(b.level), str(b.category), b.sport_meta ? JSON.stringify(b.sport_meta) : null, str(b.joined_on))
  return c.json({ ok: true }, 201)
})

people.post('/students/:id/achievements', needPerm('achievements.edit'), async (c) => {
  const id = num(c.req.param('id'))
  if (!(await canSeeStudent(c, id))) return c.json({ error: 'Forbidden' }, 403)
  const b = await c.req.json<any>()
  if (!b.title) return c.json({ error: 'Title required' }, 400)
  const r = await run(c.env.DB,
    'INSERT INTO achievements (student_id, sport_id, title, level, position, event_date, cash_prize, photo_key, age_category) VALUES (?,?,?,?,?,?,?,?,?)',
    id, b.sport_id ?? null, b.title, str(b.level), str(b.position), str(b.event_date), num(b.cash_prize), str(b.photo_key), str(b.age_category))
  if (num(b.cash_prize) > 0) {
    await run(c.env.DB, "INSERT INTO incomes (type, amount, student_id, note, income_date) VALUES ('cash_prize',?,?,?,?)",
      num(b.cash_prize), id, `Prize: ${b.title}`, str(b.event_date) ?? new Date().toISOString().slice(0, 10))
  }
  return c.json({ id: r.meta.last_row_id }, 201)
})

people.post('/students/:id/matches', needPerm('achievements.edit'), async (c) => {
  const id = num(c.req.param('id'))
  if (!(await canSeeStudent(c, id))) return c.json({ error: 'Forbidden' }, 403)
  const b = await c.req.json<any>()
  if (!b.event) return c.json({ error: 'Event required' }, 400)
  await run(c.env.DB, 'INSERT INTO matches (student_id, sport_id, event, category, event_date, result, photo_key, age_category) VALUES (?,?,?,?,?,?,?,?)',
    id, b.sport_id ?? null, b.event, str(b.category), str(b.event_date), str(b.result), str(b.photo_key), str(b.age_category))
  return c.json({ ok: true }, 201)
})

people.post('/students/:id/academic', needPerm('students.edit'), async (c) => {
  const id = num(c.req.param('id'))
  const b = await c.req.json<any>()
  await run(c.env.DB, 'INSERT INTO academic_records (student_id, term, year, percentage, notes) VALUES (?,?,?,?,?)',
    id, b.term, b.year, num(b.percentage), str(b.notes))
  return c.json({ ok: true }, 201)
})

export async function studentProfile(c: Ctx, id: number) {
  const db = c.env.DB
  const a = c.get('auth')
  const student = await one<any>(db, 'SELECT * FROM students WHERE id = ?', id)
  if (!student) return { student: null }
  const showMoney = can(a, 'fees.view') || a.role === 'student'
  const [enrollments, achievements, matches, academic, media, attendance, fees, equipment] = await Promise.all([
    all(db, `SELECT e.*, sp.name AS sport, st.name AS staff_name FROM enrollments e JOIN sports sp ON sp.id = e.sport_id
             LEFT JOIN staff st ON st.id = e.staff_id WHERE e.student_id = ?`, id),
    all(db, `SELECT a.*, sp.name AS sport FROM achievements a LEFT JOIN sports sp ON sp.id = a.sport_id WHERE a.student_id = ? ORDER BY event_date DESC`, id),
    all(db, `SELECT m.*, sp.name AS sport FROM matches m LEFT JOIN sports sp ON sp.id = m.sport_id WHERE m.student_id = ? ORDER BY event_date DESC`, id),
    all(db, 'SELECT * FROM academic_records WHERE student_id = ? ORDER BY year, term', id),
    all(db, 'SELECT id, kind, r2_key, caption FROM media WHERE student_id = ? ORDER BY id DESC', id),
    all(db, 'SELECT att_date, check_in, status FROM attendance WHERE student_id = ? ORDER BY att_date DESC LIMIT 60', id),
    showMoney ? all(db, 'SELECT * FROM fees WHERE student_id = ? ORDER BY due_date DESC', id) : Promise.resolve([]),
    a.role === 'owner' || a.role === 'student'
      ? all(db, `SELECT t.*, e.name AS equipment FROM equipment_txns t JOIN equipment e ON e.id = t.equipment_id WHERE t.student_id = ? ORDER BY txn_date DESC`, id)
      : Promise.resolve([]),
  ])
  if (a.role === 'student') delete student.biometric_id
  if (a.role === 'staff' && !a.perms.includes('students.contact'))
    for (const f of ['address', 'parent_name', 'parent_phone', 'parent_email', 'parent_occupation', 'identification_mark', 'birthplace']) student[f] = null
  const seeMedical = a.role === 'owner' || a.role === 'student' || (a.role === 'staff' && a.perms.includes('students.medical'))
  const feePlans = a.role === 'owner' ? await all(db, 'SELECT sfp.plan_id, sfp.custom_amount, fp.name, fp.amount, fp.period, sp.name AS sport FROM student_fee_plans sfp JOIN fee_plans fp ON fp.id = sfp.plan_id JOIN sports sp ON sp.id = fp.sport_id WHERE sfp.student_id = ?', id) : []
  const medical = seeMedical ? await one<any>(db, 'SELECT * FROM student_medical WHERE student_id = ?', id) : null
  return {
    feePlans, medical, canSeeMedical: seeMedical, student, enrollments, achievements, matches, academic, media, attendance, fees, equipment,
    attendanceSummary: {
      present: attendance.filter((x: any) => x.status === 'present').length,
      late: attendance.filter((x: any) => x.status === 'late').length,
      absent: attendance.filter((x: any) => x.status === 'absent').length,
    },
  }
}

// ---------------- STAFF (owner manages) ----------------
people.get('/staff', needPerm('students.view'), async (c) => {
  const a = c.get('auth')
  const rows = await all(c.env.DB, `
    SELECT st.id, st.name, st.dob, st.phone, st.photo_key, st.experience_years, st.category, st.major_domain, st.permissions, sp.name AS sport,
      (SELECT COUNT(DISTINCT student_id) FROM enrollments e WHERE e.staff_id = st.id AND e.active = 1) AS students
    FROM staff st JOIN users u ON u.id = st.user_id AND u.pending = 0 LEFT JOIN sports sp ON sp.id = st.primary_sport_id ORDER BY st.name`)
  return c.json({ staff: a.role === 'owner' ? rows : rows.map(({ permissions, ...r }: any) => r) })
})

people.post('/staff', ownerOnly, async (c) => {
  const b = await c.req.json<any>()
  if (!b.name) return c.json({ error: 'Name is required' }, 400)
  const code = await nextCode(c, 'staff', 'GSA-T-')
  const pw = tempPassword()
  const u = await run(c.env.DB, "INSERT INTO users (username, email, password_hash, role, name) VALUES (?,?,?,'staff',?)",
    code, str(b.email), await hashPassword(pw), b.name)
  const perms = Array.isArray(b.permissions) ? b.permissions : ['students.view', 'attendance.mark']
  const s = await run(c.env.DB,
    `INSERT INTO staff (user_id, ${STAFF_FIELDS.join(',')}, permissions) VALUES (?,${STAFF_FIELDS.map(() => '?').join(',')},?)`,
    u.meta.last_row_id, ...STAFF_FIELDS.map((f) => (f === 'experience_years' ? num(b[f]) : str(b[f]))), JSON.stringify(perms))
  await audit(c, 'staff.create', { id: s.meta.last_row_id })
  return c.json({ id: s.meta.last_row_id, username: code, tempPassword: pw }, 201)
})

people.patch('/staff/:id', ownerOnly, async (c) => {
  const id = num(c.req.param('id'))
  const b = await c.req.json<any>()
  const keys = STAFF_FIELDS.filter((f) => f in b)
  if (keys.length) await run(c.env.DB, `UPDATE staff SET ${keys.map((k) => `${k} = ?`).join(',')} WHERE id = ?`, ...keys.map((k) => str(b[k])), id)
  if (Array.isArray(b.permissions)) await run(c.env.DB, 'UPDATE staff SET permissions = ? WHERE id = ?', JSON.stringify(b.permissions), id)
  await audit(c, 'staff.update', { id, keys, perms: b.permissions })
  return c.json({ ok: true })
})

people.get('/staff/:id', async (c) => {
  const a = c.get('auth')
  const id = num(c.req.param('id'))
  if (a.role === 'student') return c.json({ error: 'Forbidden' }, 403)
  if (a.role === 'staff' && a.refId !== id) return c.json({ error: 'Forbidden' }, 403)
  const staff = await one<any>(c.env.DB, `SELECT st.*, sp.name AS sport, u.username, u.email FROM staff st
    LEFT JOIN sports sp ON sp.id = st.primary_sport_id JOIN users u ON u.id = st.user_id WHERE st.id = ?`, id)
  if (!staff) return c.json({ error: 'Not found' }, 404)
  const students = await all(c.env.DB, `
    SELECT s.id, s.name, s.admission_no, sp.name AS sport, e.level, e.category,
      (SELECT COALESCE(SUM(amount),0) FROM fees f WHERE f.student_id = s.id AND f.status = 'pending') AS pending_fees,
      (SELECT COUNT(*) FROM achievements ac WHERE ac.student_id = s.id AND ac.sport_id = e.sport_id) AS achievements
    FROM enrollments e JOIN students s ON s.id = e.student_id JOIN sports sp ON sp.id = e.sport_id
    WHERE e.staff_id = ? AND e.active = 1 ORDER BY s.name`, id)
  const wins = await all(c.env.DB, `
    SELECT ac.title, ac.level, ac.position, ac.event_date, s.name AS student FROM achievements ac
    JOIN students s ON s.id = ac.student_id
    WHERE ac.student_id IN (SELECT student_id FROM enrollments WHERE staff_id = ?) ORDER BY ac.event_date DESC LIMIT 30`, id)
  staff.permissions = JSON.parse(staff.permissions)
  return c.json({ staff, students, studentAchievements: wins })
})

people.get('/sports', async (c) => c.json({ sports: await all(c.env.DB, 'SELECT * FROM sports ORDER BY name') }))
people.post('/sports', ownerOnly, async (c) => {
  const b = await c.req.json<any>()
  const name = str(b.name)
  if (!name || name.length < 2) return c.json({ error: 'Enter a section name' }, 400)
  if (await one(c.env.DB, 'SELECT 1 AS x FROM sports WHERE name = ? COLLATE NOCASE', name)) return c.json({ error: 'That section already exists' }, 400)
  const r = await run(c.env.DB, 'INSERT INTO sports (name) VALUES (?)', name.slice(0, 40))
  await audit(c, 'sport.add', { name })
  return c.json({ id: r.meta.last_row_id }, 201)
})

// student fee structure (owner)
people.get('/students/:id/fee-plans', ownerOnly, async (c) =>
  c.json({ assigned: await all(c.env.DB, 'SELECT sfp.plan_id, sfp.custom_amount, fp.name, fp.amount, fp.period, sp.name AS sport FROM student_fee_plans sfp JOIN fee_plans fp ON fp.id = sfp.plan_id JOIN sports sp ON sp.id = fp.sport_id WHERE sfp.student_id = ?', num(c.req.param('id'))) }))
people.put('/students/:id/fee-plans', ownerOnly, async (c) => {
  const id = num(c.req.param('id'))
  const b = await c.req.json<any>()
  const list: any[] = Array.isArray(b.plans) ? b.plans : []
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM student_fee_plans WHERE student_id = ?').bind(id),
    ...list.map((p) => c.env.DB.prepare('INSERT INTO student_fee_plans (student_id, plan_id, custom_amount) VALUES (?,?,?)').bind(id, num(p.plan_id), p.custom_amount === '' || p.custom_amount == null ? null : num(p.custom_amount))),
  ])
  await audit(c, 'student.feeplans', { id, count: list.length })
  return c.json({ ok: true })
})
