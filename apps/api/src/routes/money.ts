import { Hono } from 'hono'
import { App, all, one, run, can, canSeeStudent, needPerm, ownerOnly, audit, timingSafeEqual, num, str, istNow } from '../lib'
import { notifyParent } from '../notify'

export const money = new Hono<App>()

// ---------------- FEES ----------------
money.get('/fees', needPerm('fees.view'), async (c) => {
  const a = c.get('auth')
  const where: string[] = []
  const p: unknown[] = []
  const status = c.req.query('status')
  if (status) { where.push('f.status = ?'); p.push(status) }
  if (a.role === 'staff' && !a.perms.includes('students.viewAll')) {
    where.push('f.student_id IN (SELECT student_id FROM enrollments WHERE staff_id = ? AND active = 1)'); p.push(a.refId)
  }
  const rows = await all(c.env.DB, `SELECT f.*, s.name AS student, s.admission_no FROM fees f JOIN students s ON s.id = f.student_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY f.due_date DESC LIMIT 500`, ...p)
  return c.json({ fees: rows })
})

money.post('/fees', needPerm('fees.collect'), async (c) => {
  const b = await c.req.json<any>()
  if (!b.student_id || !b.amount || !b.due_date) return c.json({ error: 'student_id, amount, due_date required' }, 400)
  const r = await run(c.env.DB, 'INSERT INTO fees (student_id, description, amount, due_date) VALUES (?,?,?,?)',
    b.student_id, b.description || 'Fee', num(b.amount), b.due_date)
  return c.json({ id: r.meta.last_row_id }, 201)
})

/** Generate this month's bills from fee plans for every active enrollment (idempotent per month). */
money.post('/fees/generate-monthly', ownerOnly, async (c) => {
  const { date } = istNow()
  const month = date.slice(0, 7)
  const due = `${month}-10`
  const rows = await all<any>(c.env.DB, `
    SELECT e.student_id, fp.amount, sp.name AS sport FROM enrollments e
    JOIN fee_plans fp ON fp.sport_id = e.sport_id AND fp.period = 'monthly'
    JOIN sports sp ON sp.id = e.sport_id JOIN students s ON s.id = e.student_id
    WHERE e.active = 1 AND s.status = 'active'`)
  let created = 0
  for (const r of rows) {
    const desc = `${r.sport} monthly fee ${month}`
    const exists = await one(c.env.DB, 'SELECT 1 AS x FROM fees WHERE student_id = ? AND description = ?', r.student_id, desc)
    if (exists) continue
    await run(c.env.DB, 'INSERT INTO fees (student_id, description, amount, due_date) VALUES (?,?,?,?)', r.student_id, desc, r.amount, due)
    created++
  }
  await audit(c, 'fees.generate', { month, created })
  return c.json({ created })
})

money.get('/fee-plans', async (c) =>
  c.json({ plans: await all(c.env.DB, 'SELECT fp.*, sp.name AS sport FROM fee_plans fp JOIN sports sp ON sp.id = fp.sport_id ORDER BY sp.name') }))
money.post('/fee-plans', ownerOnly, async (c) => {
  const b = await c.req.json<any>()
  await run(c.env.DB, 'INSERT INTO fee_plans (sport_id, name, amount, period) VALUES (?,?,?,?)', b.sport_id, b.name, num(b.amount), b.period || 'monthly')
  return c.json({ ok: true }, 201)
})

async function markPaid(c: { env: any }, feeId: number, method: string, paymentId?: string) {
  const f = await one<any>(c.env.DB, `SELECT f.*, s.name, s.id AS sid, s.parent_phone FROM fees f JOIN students s ON s.id = f.student_id WHERE f.id = ?`, feeId)
  if (!f || f.status === 'paid') return f
  const { date } = istNow()
  await run(c.env.DB, "UPDATE fees SET status = 'paid', paid_on = ?, method = ?, razorpay_payment_id = COALESCE(?, razorpay_payment_id) WHERE id = ?", date, method, paymentId ?? null, feeId)
  await run(c.env.DB, "INSERT INTO incomes (type, amount, student_id, note, income_date) VALUES ('student_fee',?,?,?,?)", f.amount, f.student_id, f.description, date)
  await notifyParent(c.env, { id: f.sid, parent_phone: f.parent_phone }, 'fee_paid', 'Fee received',
    `Payment of Rs ${f.amount} received for ${f.name} (${f.description}). Thank you.`)
  return f
}

money.post('/fees/:id/mark-paid', needPerm('fees.collect'), async (c) => {
  const id = num(c.req.param('id'))
  const { method } = await c.req.json<any>().catch(() => ({}))
  await markPaid(c, id, method === 'upi' ? 'upi' : 'cash')
  await audit(c, 'fee.mark-paid', { id, method })
  return c.json({ ok: true })
})

// ---------------- RAZORPAY ----------------
money.post('/payments/order', async (c) => {
  const a = c.get('auth')
  const { feeId } = await c.req.json<{ feeId: number }>()
  const f = await one<any>(c.env.DB, 'SELECT * FROM fees WHERE id = ?', feeId)
  if (!f || f.status !== 'pending') return c.json({ error: 'Fee not payable' }, 400)
  if (!(await canSeeStudent(c, f.student_id))) return c.json({ error: 'Forbidden' }, 403)
  if (!c.env.RAZORPAY_KEY_ID || !c.env.RAZORPAY_KEY_SECRET) return c.json({ error: 'Online payments are not configured yet' }, 503)
  const r = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${c.env.RAZORPAY_KEY_ID}:${c.env.RAZORPAY_KEY_SECRET}`), 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: Math.round(f.amount * 100), currency: 'INR', receipt: `fee_${f.id}`, notes: { feeId: String(f.id), by: String(a.uid) } }),
  })
  if (!r.ok) return c.json({ error: 'Could not create payment order' }, 502)
  const order = await r.json<any>()
  await run(c.env.DB, 'UPDATE fees SET razorpay_order_id = ? WHERE id = ?', order.id, f.id)
  return c.json({ orderId: order.id, amount: order.amount, currency: 'INR', keyId: c.env.RAZORPAY_KEY_ID })
})

async function hmacHex(secret: string, data: string) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data))
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Client-side confirmation after checkout. The webhook is the source of truth, this makes the UI instant. */
money.post('/payments/verify', async (c) => {
  const b = await c.req.json<any>()
  const f = await one<any>(c.env.DB, 'SELECT * FROM fees WHERE razorpay_order_id = ?', b.razorpay_order_id)
  if (!f || !(await canSeeStudent(c, f.student_id))) return c.json({ error: 'Forbidden' }, 403)
  const expected = await hmacHex(c.env.RAZORPAY_KEY_SECRET ?? '', `${b.razorpay_order_id}|${b.razorpay_payment_id}`)
  if (!timingSafeEqual(expected, String(b.razorpay_signature))) return c.json({ error: 'Signature mismatch' }, 400)
  await markPaid(c, f.id, 'razorpay', b.razorpay_payment_id)
  return c.json({ ok: true })
})

export const razorpayWebhook = new Hono<App>()
razorpayWebhook.post('/', async (c) => {
  const raw = await c.req.text()
  const secret = c.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) return c.json({ error: 'not configured' }, 503)
  const expected = await hmacHex(secret, raw)
  if (!timingSafeEqual(expected, c.req.header('x-razorpay-signature') ?? '')) return c.json({ error: 'bad signature' }, 400)
  const ev = JSON.parse(raw)
  if (ev.event === 'payment.captured' || ev.event === 'order.paid') {
    const pay = ev.payload?.payment?.entity
    const f = await one<any>(c.env.DB, 'SELECT id FROM fees WHERE razorpay_order_id = ?', pay?.order_id)
    if (f) await markPaid(c, f.id, 'razorpay', pay?.id)
  }
  return c.json({ ok: true })
})

// ---------------- INCOME / EXPENSES (owner) ----------------
money.get('/finance/incomes', ownerOnly, async (c) =>
  c.json({ incomes: await all(c.env.DB, `SELECT i.*, s.name AS student FROM incomes i LEFT JOIN students s ON s.id = i.student_id ORDER BY income_date DESC LIMIT 500`) }))
money.post('/finance/incomes', ownerOnly, async (c) => {
  const b = await c.req.json<any>()
  await run(c.env.DB, 'INSERT INTO incomes (type, amount, student_id, note, income_date, status) VALUES (?,?,?,?,?,?)',
    b.type, num(b.amount), b.student_id ?? null, str(b.note), b.income_date || istNow().date, b.status === 'pending' ? 'pending' : 'received')
  return c.json({ ok: true }, 201)
})
money.get('/finance/expenses', ownerOnly, async (c) =>
  c.json({ expenses: await all(c.env.DB, 'SELECT * FROM expenses ORDER BY expense_date DESC LIMIT 500') }))
money.post('/finance/expenses', ownerOnly, async (c) => {
  const b = await c.req.json<any>()
  await run(c.env.DB, 'INSERT INTO expenses (category, amount, note, expense_date) VALUES (?,?,?,?)', b.category, num(b.amount), str(b.note), b.expense_date || istNow().date)
  return c.json({ ok: true }, 201)
})

// ---------------- EQUIPMENT & STOCK (owner; staff may view) ----------------
money.get('/equipment', needPerm('equipment.view'), async (c) =>
  c.json({ equipment: await all(c.env.DB, `SELECT e.*, sp.name AS sport FROM equipment e LEFT JOIN sports sp ON sp.id = e.sport_id ORDER BY e.name`) }))
money.post('/equipment', ownerOnly, async (c) => {
  const b = await c.req.json<any>()
  const r = await run(c.env.DB, 'INSERT INTO equipment (name, sport_id, qty, reorder_level, cost_price, sale_price) VALUES (?,?,?,?,?,?)',
    b.name, b.sport_id ?? null, num(b.qty), num(b.reorder_level, 2), num(b.cost_price), num(b.sale_price))
  return c.json({ id: r.meta.last_row_id }, 201)
})
money.get('/equipment/txns', ownerOnly, async (c) =>
  c.json({ txns: await all(c.env.DB, `SELECT t.*, e.name AS equipment, s.name AS student FROM equipment_txns t JOIN equipment e ON e.id = t.equipment_id
    LEFT JOIN students s ON s.id = t.student_id ORDER BY t.txn_date DESC, t.id DESC LIMIT 500`) }))

/** purchase: stock in + expense; sale: stock out + income; issue/damage: stock out (damage may be charged); return: stock in. */
money.post('/equipment/:id/txn', ownerOnly, async (c) => {
  const id = num(c.req.param('id'))
  const b = await c.req.json<any>()
  const qty = Math.max(1, Math.floor(num(b.qty, 1)))
  const eq = await one<any>(c.env.DB, 'SELECT * FROM equipment WHERE id = ?', id)
  if (!eq) return c.json({ error: 'Not found' }, 404)
  const type = b.type as string
  if (!['purchase', 'sale', 'issue', 'return', 'damage'].includes(type)) return c.json({ error: 'Invalid type' }, 400)
  const delta = type === 'purchase' || type === 'return' ? qty : -qty
  if (eq.qty + delta < 0) return c.json({ error: `Only ${eq.qty} in stock` }, 400)
  const date = b.txn_date || istNow().date
  const amount = num(b.amount, type === 'sale' ? eq.sale_price * qty : type === 'purchase' ? eq.cost_price * qty : 0)
  await run(c.env.DB, 'INSERT INTO equipment_txns (equipment_id, type, qty, amount, student_id, party, txn_date, note) VALUES (?,?,?,?,?,?,?,?)',
    id, type, qty, amount, b.student_id ?? null, str(b.party), date, str(b.note))
  await run(c.env.DB, 'UPDATE equipment SET qty = qty + ? WHERE id = ?', delta, id)
  if (type === 'sale' && amount > 0)
    await run(c.env.DB, "INSERT INTO incomes (type, amount, student_id, note, income_date, status) VALUES ('equipment_sale',?,?,?,?,?)",
      amount, b.student_id ?? null, `${qty} x ${eq.name}${b.party ? ' to ' + b.party : ''}`, date, b.paid === false ? 'pending' : 'received')
  if (type === 'purchase' && amount > 0)
    await run(c.env.DB, "INSERT INTO expenses (category, amount, note, expense_date) VALUES ('Equipment',?,?,?)", amount, `${qty} x ${eq.name}`, date)
  await audit(c, 'equipment.txn', { id, type, qty })
  return c.json({ ok: true })
})
