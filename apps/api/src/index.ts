import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { App, Env, requireAuth } from './lib'
import { auth } from './routes/auth'
import { people } from './routes/people'
import { money, razorpayWebhook } from './routes/money'
import { ops, device } from './routes/ops'
import { publicApi, siteApi } from './routes/site'
import { approvals } from './routes/extra'
import { markAbsentees, sendFeeReminders } from './notify'

const app = new Hono<App>()

app.use('*', secureHeaders({ crossOriginResourcePolicy: 'cross-origin' })) // gallery photos are shown on the web origin
app.use('*', async (c, next) => {
  const allowed = [c.env.WEB_ORIGIN, 'http://localhost:5173', 'http://localhost:4173', 'http://localhost:8081']
  return cors({ origin: (o) => (allowed.includes(o) ? o : ''), allowHeaders: ['Authorization', 'Content-Type'], maxAge: 86400 })(c, next)
})

app.get('/', (c) => c.json({ service: 'Global Sports Academy API', status: 'ok', version: '0.1.0' }))

// Public / machine endpoints (own authentication)
app.route('/auth', approvals)
app.route('/auth', auth)
app.route('/webhooks/razorpay', razorpayWebhook)
app.route('/device', device)
app.route('/public', publicApi)

// Everything else requires a signed-in user
app.use('/api/*', requireAuth)
app.route('/api', people)
app.route('/api', money)
app.route('/api', ops)
app.route('/api', siteApi)

app.onError((e, c) => {
  console.error(e)
  return c.json({ error: 'Something went wrong' }, 500)
})

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(event.cron === '0 3 * * *' ? sendFeeReminders(env) : markAbsentees(env))
  },
}
