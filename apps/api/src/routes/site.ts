import { Hono } from 'hono'
import { App, all, one, run, ownerOnly, audit, num, str, putFile, getFile, deleteFiles, maxUpload, sendMail } from '../lib'

/** Public, no sign-in. Mounted at /public. */
export const publicApi = new Hono<App>()

publicApi.post('/enquiry', async (c) => {
  const b = await c.req.json<any>().catch(() => ({}))
  if (b.website) return c.json({ ok: true }, 201) // honeypot
  const name = str(b.name), phone = str(b.phone)?.replace(/[^\d+]/g, '')
  if (!name || name.length < 2) return c.json({ error: 'Enter your name' }, 400)
  if (!phone || phone.replace(/\D/g, '').length < 10) return c.json({ error: 'Enter a valid phone number' }, 400)
  const recent = await one<{ n: number }>(c.env.DB, "SELECT COUNT(*) AS n FROM enquiries WHERE created_at > datetime('now','-1 hour')")
  if (recent && recent.n >= 40) return c.json({ error: 'Too many enquiries right now. Please call us instead.' }, 429)
  await run(c.env.DB, 'INSERT INTO enquiries (name, phone, sport_id, child_age, message) VALUES (?,?,?,?,?)',
    name.slice(0, 80), phone.slice(0, 20), b.sport_id ? num(b.sport_id) : null, str(b.child_age)?.slice(0, 20) ?? null, str(b.message)?.slice(0, 500) ?? null)
  // in-app alert for the owner (picked up by the app's foreground and background checks)
  const sp = b.sport_id ? await one<{ name: string }>(c.env.DB, 'SELECT name FROM sports WHERE id = ?', num(b.sport_id)) : null
  await run(c.env.DB, "INSERT INTO notifications (student_id, type, title, body, status) VALUES (NULL, 'enquiry', ?, ?, 'sent')",
    'New trial class request', `${name.slice(0, 60)} (${phone.slice(0, 20)})${sp ? ' wants ' + sp.name : ''}${str(b.child_age) ? ', age ' + str(b.child_age)!.slice(0, 10) : ''}. Open Trial enquiries.`)
  // tell the owner by email (only if Resend and OWNER_EMAIL are set); never blocks or fails the visitor
  if (c.env.OWNER_EMAIL) {
    const esc = (t: string) => t.replace(/[<>&]/g, '')
    c.executionCtx.waitUntil(sendMail(c.env, c.env.OWNER_EMAIL, 'New trial request: ' + esc(name), `<p><b>${esc(name)}</b> asked for a trial class.</p><p>Phone: ${esc(phone)}<br>Child age: ${esc(str(b.child_age) ?? '-')}<br>Message: ${esc(str(b.message) ?? '-')}</p><p>See it in the app under Enquiries.</p>`).catch(() => false))
  }
  return c.json({ ok: true }, 201)
})

publicApi.get('/sports', async (c) => c.json({ sports: await all(c.env.DB, 'SELECT id, name FROM sports ORDER BY name') }))

publicApi.get('/gallery', async (c) => {
  const rows = await all(c.env.DB, `SELECT g.id, g.r2_key AS key, g.caption, sp.name AS sport FROM gallery g LEFT JOIN sports sp ON sp.id = g.sport_id ORDER BY g.id DESC LIMIT 120`)
  c.header('Cache-Control', 'public, max-age=300')
  return c.json({ photos: rows })
})

publicApi.get('/gallery/file/*', async (c) => {
  const key = decodeURIComponent(c.req.path.replace(/^.*\/gallery\/file\//, ''))
  if (!(await one(c.env.DB, 'SELECT 1 AS x FROM gallery WHERE r2_key = ?', key))) return c.notFound() // only published gallery photos
  const obj = await getFile(c.env, key)
  if (!obj) return c.notFound()
  return new Response(obj.body, { headers: { 'Content-Type': obj.type, 'Cache-Control': 'public, max-age=86400' } })
})

publicApi.get('/reviews', async (c) => {
  c.header('Cache-Control', 'public, max-age=300')
  return c.json({ reviews: await all(c.env.DB, "SELECT id, name, relation, rating, body, created_at FROM reviews WHERE status = 'approved' ORDER BY id DESC LIMIT 30") })
})

/** Signed-in routes, mounted under /api. */
export const siteApi = new Hono<App>()

// Parents (student accounts) submit a review. It stays hidden until the owner approves it.
siteApi.post('/reviews', async (c) => {
  const a = c.get('auth')
  if (a.role !== 'student') return c.json({ error: 'Only parents and students can post reviews' }, 403)
  const b = await c.req.json<any>()
  const body = str(b.body)
  if (!body || body.length < 10) return c.json({ error: 'Please write a few words about your experience' }, 400)
  const s = await one<any>(c.env.DB, 'SELECT parent_name, name FROM students WHERE id = ?', a.refId)
  await run(c.env.DB, "INSERT INTO reviews (user_id, name, relation, rating, body) VALUES (?,?,?,?,?)",
    a.uid, s?.parent_name || a.name, s ? `Parent of ${s.name.split(' ')[0]}` : 'Parent', Math.min(5, Math.max(1, num(b.rating, 5))), body.slice(0, 800))
  return c.json({ ok: true }, 201)
})

siteApi.get('/site/reviews', ownerOnly, async (c) => c.json({ reviews: await all(c.env.DB, 'SELECT * FROM reviews ORDER BY (status = \'pending\') DESC, id DESC') }))
siteApi.post('/site/reviews', ownerOnly, async (c) => {
  const b = await c.req.json<any>()
  if (!b.name || !b.body) return c.json({ error: 'Name and review text required' }, 400)
  await run(c.env.DB, "INSERT INTO reviews (name, relation, rating, body, status) VALUES (?,?,?,?, 'approved')", String(b.name).slice(0, 80), str(b.relation), Math.min(5, Math.max(1, num(b.rating, 5))), String(b.body).slice(0, 800))
  return c.json({ ok: true }, 201)
})
siteApi.patch('/site/reviews/:id', ownerOnly, async (c) => {
  const b = await c.req.json<any>()
  if (!['approved', 'hidden', 'pending'].includes(b.status)) return c.json({ error: 'Invalid status' }, 400)
  await run(c.env.DB, 'UPDATE reviews SET status = ? WHERE id = ?', b.status, num(c.req.param('id')))
  return c.json({ ok: true })
})
siteApi.delete('/site/reviews/:id', ownerOnly, async (c) => { await run(c.env.DB, 'DELETE FROM reviews WHERE id = ?', num(c.req.param('id'))); return c.json({ ok: true }) })

siteApi.get('/site/enquiries', ownerOnly, async (c) =>
  c.json({ enquiries: await all(c.env.DB, `SELECT e.*, sp.name AS sport FROM enquiries e LEFT JOIN sports sp ON sp.id = e.sport_id ORDER BY (e.status = 'new') DESC, e.id DESC LIMIT 300`) }))
siteApi.patch('/site/enquiries/:id', ownerOnly, async (c) => {
  const b = await c.req.json<any>()
  if (!['new', 'contacted', 'joined', 'closed'].includes(b.status)) return c.json({ error: 'Invalid status' }, 400)
  await run(c.env.DB, 'UPDATE enquiries SET status = ? WHERE id = ?', b.status, num(c.req.param('id')))
  return c.json({ ok: true })
})

siteApi.get('/site/gallery', ownerOnly, async (c) =>
  c.json({ photos: await all(c.env.DB, 'SELECT g.id, g.r2_key AS key, g.caption, g.sport_id, sp.name AS sport FROM gallery g LEFT JOIN sports sp ON sp.id = g.sport_id ORDER BY g.id DESC') }))
siteApi.post('/site/gallery', ownerOnly, async (c) => {
  const form = await c.req.formData()
  const file = form.get('file') as unknown as File | null
  if (!file || typeof file === 'string') return c.json({ error: 'file required' }, 400)
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return c.json({ error: 'Only JPEG, PNG or WebP images' }, 400)
  if (file.size > maxUpload(c.env)) return c.json({ error: 'Photo too large' }, 400)
  const key = `gallery/${crypto.randomUUID()}.${file.type.split('/')[1]}`
  await putFile(c.env, key, file)
  const sport = num(form.get('sport_id'))
  await run(c.env.DB, 'INSERT INTO gallery (sport_id, r2_key, caption) VALUES (?,?,?)', sport || null, key, str(form.get('caption')))
  await audit(c, 'gallery.add', { key })
  return c.json({ key }, 201)
})
siteApi.delete('/site/gallery/:id', ownerOnly, async (c) => {
  const g = await one<any>(c.env.DB, 'SELECT r2_key FROM gallery WHERE id = ?', num(c.req.param('id')))
  if (!g) return c.json({ error: 'Not found' }, 404)
  await run(c.env.DB, 'DELETE FROM gallery WHERE id = ?', num(c.req.param('id')))
  await deleteFiles(c.env, [g.r2_key])
  return c.json({ ok: true })
})
