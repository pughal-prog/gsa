import { Env, all, one, run, istNow, toMinutes } from './lib'

type Student = { id: number; name: string; parent_phone: string | null; batch_time: string }

/** Store a parent notification and try to deliver it (WhatsApp Cloud API when configured). */
export async function notifyParent(
  env: Env, s: { id: number; parent_phone: string | null }, type: string, title: string, body: string,
) {
  const res = await run(env.DB,
    'INSERT INTO notifications (student_id, to_phone, type, title, body) VALUES (?,?,?,?,?)',
    s.id, s.parent_phone, type, title, body)
  const nid = res.meta.last_row_id
  if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_ID || !s.parent_phone) {
    await run(env.DB, "UPDATE notifications SET status = 'stored' WHERE id = ?", nid)
    return
  }
  try {
    const to = s.parent_phone.replace(/\D/g, '')
    const r = await fetch(`https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', to, type: 'template',
        template: {
          name: env.WHATSAPP_TEMPLATE || 'gsa_update', language: { code: 'en' },
          components: [{ type: 'body', parameters: [{ type: 'text', text: body.slice(0, 900) }] }],
        },
      }),
    })
    if (!r.ok) throw new Error(`WhatsApp ${r.status}: ${(await r.text()).slice(0, 200)}`)
    await run(env.DB, "UPDATE notifications SET status = 'sent' WHERE id = ?", nid)
  } catch (e) {
    await run(env.DB, "UPDATE notifications SET status = 'failed', error = ? WHERE id = ?", String(e), nid)
  }
}

export const fmtTime = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

/** Called when a student scans on the biometric device. Records attendance + notifies the parent. */
export async function recordArrival(env: Env, student: Student, at = istNow()) {
  const existing = await one(env.DB, 'SELECT id FROM attendance WHERE student_id = ? AND att_date = ?', student.id, at.date)
  if (existing) return { status: 'duplicate' as const }
  const grace = Number(env.LATE_GRACE_MINUTES || 10)
  const late = toMinutes(at.time) > toMinutes(student.batch_time) + grace
  const status = late ? 'late' : 'present'
  await run(env.DB, 'INSERT INTO attendance (student_id, att_date, check_in, status, source) VALUES (?,?,?,?,?)',
    student.id, at.date, at.time, status, 'biometric')
  const academy = env.ACADEMY_NAME || 'the academy'
  if (late) {
    await notifyParent(env, student as any, 'late',
      'Late arrival',
      `${student.name} arrived late at ${academy} at ${fmtTime(at.time)} (batch time ${fmtTime(student.batch_time)}).`)
  } else {
    await notifyParent(env, student as any, 'arrival',
      'Reached the academy',
      `${student.name} has reached ${academy} at ${fmtTime(at.time)}.`)
  }
  return { status }
}

/** 20:00 IST: mark absentees and notify parents. */
export async function markAbsentees(env: Env) {
  const { date } = istNow()
  const rows = await all<Student>(env.DB,
    `SELECT s.id, s.name, s.parent_phone, s.batch_time FROM students s
     WHERE s.status = 'active' AND NOT EXISTS (SELECT 1 FROM attendance a WHERE a.student_id = s.id AND a.att_date = ?)`, date)
  for (const s of rows) {
    await run(env.DB, "INSERT OR IGNORE INTO attendance (student_id, att_date, status, source) VALUES (?,?, 'absent', 'system')", s.id, date)
    await notifyParent(env, s, 'absent', 'Absent today', `${s.name} did not attend ${env.ACADEMY_NAME || 'the academy'} today (${date}).`)
  }
  return rows.length
}

/** 08:30 IST: remind for fees due within 3 days or overdue (at most once per fee per 3 days). */
export async function sendFeeReminders(env: Env) {
  const { date } = istNow()
  const rows = await all<any>(env.DB,
    `SELECT f.id, f.description, f.amount, f.due_date, s.id AS sid, s.name, s.parent_phone
     FROM fees f JOIN students s ON s.id = f.student_id
     WHERE f.status = 'pending' AND f.due_date <= date(?, '+3 days')
       AND (f.reminder_sent_on IS NULL OR f.reminder_sent_on <= date(?, '-3 days'))`, date, date)
  for (const f of rows) {
    const overdue = f.due_date < date
    await notifyParent(env, { id: f.sid, parent_phone: f.parent_phone }, overdue ? 'fee_overdue' : 'fee_due',
      overdue ? 'Fee overdue' : 'Fee due soon',
      `${f.name}: ${f.description}, Rs ${f.amount} ${overdue ? 'was due on' : 'is due on'} ${f.due_date}. Please pay from the Global Sports Academy app.`)
    await run(env.DB, 'UPDATE fees SET reminder_sent_on = ? WHERE id = ?', date, f.id)
  }
  return rows.length
}
