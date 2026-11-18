import { Hono } from 'hono'
import { App, one, num, sign, sendMail, Env } from '../lib'

// ---------- one-click approval from the owner's email ----------
const page = (title: string, body: string) => new Response(
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<body style="font-family:system-ui,sans-serif;background:#f4f6fb;margin:0;display:grid;place-items:center;min-height:100vh"><div style="background:#fff;border:1px solid #e3e8f0;border-radius:14px;padding:28px;max-width:420px;margin:16px">
<h2 style="margin:0 0 8px">${title}</h2>${body}</div></body>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!))

export const approvals = new Hono<App>()
// GET only shows a confirm button (mail scanners that prefetch links cannot approve anything)
approvals.get('/approve', async (c) => {
  const uid = num(c.req.query('uid')), act = c.req.query('act') === 'reject' ? 'reject' : 'approve', sig = c.req.query('sig') ?? ''
  if (sig !== (await sign(c.env, `${act}:${uid}`))) return page('Link not valid', '<p>This link is invalid or has been changed.</p>')
  const u = await one<any>(c.env.DB, 'SELECT name, email, role, pending FROM users WHERE id = ?', uid)
  if (!u || !u.pending) return page('Already handled', '<p>This registration has already been approved or removed.</p>')
  const col = act === 'approve' ? '#1f9d55' : '#d93025'
  return page(act === 'approve' ? 'Approve registration' : 'Reject registration',
    `<p><b>${esc(u.name)}</b><br>${esc(u.email ?? '')}<br>Role: ${esc(u.role)}</p>
     <form method="post" action="/auth/approve"><input type="hidden" name="uid" value="${uid}"><input type="hidden" name="act" value="${act}"><input type="hidden" name="sig" value="${sig}">
     <button style="background:${col};color:#fff;border:0;border-radius:10px;padding:12px 22px;font-size:16px;font-weight:600;cursor:pointer">${act === 'approve' ? 'Approve' : 'Reject'}</button></form>`)
})
approvals.post('/approve', async (c) => {
  const f = await c.req.parseBody()
  const uid = num(f.uid), act = f.act === 'reject' ? 'reject' : 'approve', sig = String(f.sig ?? '')
  if (sig !== (await sign(c.env, `${act}:${uid}`))) return page('Link not valid', '<p>This link is invalid or has been changed.</p>')
  const u = await one<any>(c.env.DB, 'SELECT id, name FROM users WHERE id = ? AND pending = 1', uid)
  if (!u) return page('Already handled', '<p>This registration has already been approved or removed.</p>')
  if (act === 'approve') {
    await c.env.DB.batch([c.env.DB.prepare('UPDATE users SET pending = 0 WHERE id = ?').bind(uid), c.env.DB.prepare("UPDATE students SET status = 'active' WHERE user_id = ?").bind(uid)])
    return page('Approved', `<p>${esc(u.name)} can now sign in.</p>`)
  }
  await c.env.DB.batch([c.env.DB.prepare('DELETE FROM students WHERE user_id = ?').bind(uid), c.env.DB.prepare('DELETE FROM staff WHERE user_id = ?').bind(uid), c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(uid)])
  return page('Rejected', `<p>${esc(u.name)}'s registration was removed.</p>`)
})

/** Emails the owner a one-click approve/reject link for a new registration. */
export async function mailOwnerSignup(env: Env, origin: string, uid: number) {
  if (!env.RESEND_API_KEY) return
  const u = await one<any>(env.DB, 'SELECT name, email, role FROM users WHERE id = ?', uid)
  const to = env.OWNER_EMAIL || (await one<any>(env.DB, "SELECT email FROM users WHERE role = 'owner' AND email IS NOT NULL ORDER BY id LIMIT 1"))?.email
  if (!u || !to) return
  const link = async (act: string) => `${origin}/auth/approve?uid=${uid}&act=${act}&sig=${await sign(env, `${act}:${uid}`)}`
  const btn = (href: string, label: string, col: string) => `<a href="${href}" style="display:inline-block;background:${col};color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;margin-right:8px">${label}</a>`
  await sendMail(env, to, `New ${u.role} registration: ${u.name}`,
    `<div style="font-family:system-ui,sans-serif"><h3>New ${esc(u.role)} registration</h3><p><b>${esc(u.name)}</b><br>${esc(u.email ?? '')}</p>
     <p>${btn(await link('approve'), 'Approve', '#1f9d55')}${btn(await link('reject'), 'Reject', '#d93025')}</p>
     <p style="color:#667">You can also manage this from the Approvals page in the app.</p></div>`)
}
