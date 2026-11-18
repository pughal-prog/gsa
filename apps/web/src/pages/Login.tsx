import { FormEvent, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { CheckCircle2, ShieldCheck, Fingerprint, IdCard } from 'lucide-react'
import { api, useAuth, cx } from '../lib'
import { Logo, Btn, ErrorMsg } from '../components/ui'
import { SITE } from '../site'

const GOOGLE_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
declare global { interface Window { google?: any } }

const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" /></svg>
)

type Tab = 'signin' | 'signup'
const inputCls = 'w-full rounded-md border border-line bg-surface px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10'

export default function Login({ initial = 'signin' }: { initial?: Tab }) {
  const { me, login } = useAuth()
  const nav = useNavigate()
  const [tab, setTab] = useState<Tab>(initial)
  const [role, setRole] = useState<'student' | 'staff'>('student')
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const gbtn = useRef<HTMLDivElement>(null)
  const live = useRef({ tab, role })
  live.current = { tab, role }

  const finish = async (token: string) => { await login(token); nav('/app', { replace: true }) }

  const googleCallback = async (credential: string) => {
    setErr(''); setInfo('')
    try {
      if (live.current.tab === 'signin') {
        try { return await finish((await api('/auth/google', { body: { idToken: credential } })).token) }
        catch (e: any) { if (/sign up first/i.test(e.message)) { setTab('signup'); setErr('No account found for this Google email. Fill in the details below and tap Google again to sign up.'); return } throw e }
      }
      const f = new FormData(formRef.current!)
      const phone = String(f.get('phone') || '')
      if (phone.replace(/\D/g, '').length < 10) return setErr('Enter your phone number first, then tap the Google button.')
      const r = await api('/auth/google', { body: { idToken: credential, signup: { role: live.current.role, phone, dob: f.get('dob') || undefined, parent_name: f.get('parent_name') || undefined, name: f.get('name') || undefined } } })
      if (r.token) await finish(r.token); else setDone(r.message)
    } catch (e: any) { setErr(e.message) }
  }

  useEffect(() => {
    if (!GOOGLE_ID) return
    const init = () => {
      window.google?.accounts.id.initialize({ client_id: GOOGLE_ID, callback: (r: { credential: string }) => googleCallback(r.credential) })
      if (gbtn.current) { gbtn.current.innerHTML = ''; window.google?.accounts.id.renderButton(gbtn.current, { theme: 'outline', size: 'large', width: 340, text: live.current.tab === 'signin' ? 'signin_with' : 'signup_with', shape: 'pill' }) }
    }
    if (window.google) { init(); return }
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = init
    document.body.appendChild(s)
  }, [tab, done])

  if (me) return <Navigate to="/app" replace />

  const signin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setErr('')
    const f = new FormData(e.currentTarget); setBusy(true)
    try { await finish((await api('/auth/login', { body: { username: f.get('username'), password: f.get('password') } })).token) } catch (er: any) { setErr(er.message); setBusy(false) }
  }
  const signup = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setErr('')
    const f = new FormData(e.currentTarget)
    if (f.get('password') !== f.get('again')) return setErr('Passwords do not match')
    setBusy(true)
    try {
      const body: any = Object.fromEntries(f.entries()); delete body.again; body.role = role
      setDone((await api('/auth/signup', { body })).message)
    } catch (er: any) { setErr(er.message) } finally { setBusy(false) }
  }
  const googleFallback = () => setErr('Google sign-in is not switched on yet. Add VITE_GOOGLE_CLIENT_ID to the web app settings (see README).')
  const lab = 'mb-1 block text-xs font-semibold text-slate-600'

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="brand-panel relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex"><div className="aurora" />
        <Link to="/" className="inline-block self-start rounded-lg bg-white p-3 shadow-card"><Logo small className="!h-28" /></Link>
        <div>
          <h2 className="text-4xl font-extrabold leading-tight">Everything about every athlete, in one place.</h2>
          <ul className="mt-8 space-y-4 text-white/90">
            {[[IdCard, 'Athlete Passport with sports, medals and academics'], [Fingerprint, 'Instant parent alerts on check-in, late and absence'], [ShieldCheck, 'Secure access for owner, coaches and students']].map(([I, t]: any) => (
              <li key={t} className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-white/15"><I size={18} /></span>{t}</li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-white/70">{SITE.phone} · {SITE.domain}</p>
      </aside>

      <main className="flex items-center justify-center bg-page p-4 sm:p-10">
        <div className="w-full max-w-md rise">
          <Link to="/" className="mb-6 flex justify-center lg:hidden"><Logo small className="!h-24" /></Link>
          <div className="rounded-lg border border-line bg-surface p-6 shadow-card sm:p-8">
            {done ? (
              <div className="py-6 text-center">
                <CheckCircle2 className="mx-auto text-leaf" size={52} />
                <h1 className="mt-4 text-2xl font-extrabold">Registration received</h1>
                <p className="mt-2 text-sm text-mute">{done} You will be able to sign in as soon as the academy approves your account. For urgent help call {SITE.phone}.</p>
                <Btn className="mt-6" onClick={() => { setDone(''); setTab('signin') }}>Back to sign in</Btn>
              </div>
            ) : (
              <>
                <div className="mb-6 grid grid-cols-2 rounded-md bg-soft p-1" role="tablist">
                  {(['signin', 'signup'] as Tab[]).map((t) => (
                    <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setErr('') }}
                      className={cx('rounded-lg py-2 text-sm font-semibold transition', tab === t ? 'bg-surface text-brand shadow-sm' : 'text-mute hover:text-slate-900')}>{t === 'signin' ? 'Sign in' : 'Sign up'}</button>
                  ))}
                </div>

                {tab === 'signin' ? (
                  <form onSubmit={signin} className="space-y-4">
                    <div><h1 className="text-2xl font-extrabold">Welcome back</h1><p className="mt-1 text-sm text-mute">Use the ID issued by the academy, or your email.</p></div>
                    <label className="block"><span className={lab}>User ID or email</span><input name="username" autoComplete="username" required className={inputCls} placeholder="GSA-S-0001 or you@email.com" /></label>
                    <label className="block"><span className={lab}>Password</span><input name="password" type="password" autoComplete="current-password" required className={inputCls} /></label>
                    {err && <ErrorMsg text={err} />}
                    <Btn type="submit" className="w-full py-3" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</Btn>
                  </form>
                ) : (
                  <form ref={formRef} onSubmit={signup} className="space-y-3">
                    <div><h1 className="text-2xl font-extrabold">Create your account</h1><p className="mt-1 text-sm text-mute">The academy approves new accounts before first sign-in.</p></div>
                    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="I am a">
                      {([['student', 'Student / Parent'], ['staff', 'Coach / Staff']] as const).map(([v, l]) => (
                        <button type="button" key={v} role="radio" aria-checked={role === v} onClick={() => setRole(v)}
                          className={cx('rounded-md border px-3 py-2.5 text-sm font-semibold transition', role === v ? 'border-brand bg-brand/10 text-brand' : 'border-line text-slate-600 hover:bg-soft')}>{l}</button>
                      ))}
                    </div>
                    <label className="block"><span className={lab}>{role === 'student' ? "Student's full name" : 'Full name'}</span><input name="name" required className={inputCls} autoComplete="name" /></label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block"><span className={lab}>Email</span><input name="email" type="email" required className={inputCls} autoComplete="email" /></label>
                      <label className="block"><span className={lab}>Phone (WhatsApp)</span><input name="phone" type="tel" required className={inputCls} autoComplete="tel" placeholder="10 digit number" /></label>
                    </div>
                    {role === 'student' && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block"><span className={lab}>Date of birth</span><input name="dob" type="date" className={inputCls} /></label>
                        <label className="block"><span className={lab}>Parent / guardian name</span><input name="parent_name" className={inputCls} /></label>
                      </div>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block"><span className={lab}>Password</span><input name="password" type="password" minLength={8} required className={inputCls} autoComplete="new-password" /></label>
                      <label className="block"><span className={lab}>Repeat password</span><input name="again" type="password" minLength={8} required className={inputCls} autoComplete="new-password" /></label>
                    </div>
                    <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
                    {err && <ErrorMsg text={err} />}
                    <Btn type="submit" className="w-full py-3" disabled={busy}>{busy ? 'Submitting...' : 'Sign up'}</Btn>
                  </form>
                )}

                <div className="my-5 flex items-center gap-3 text-xs text-mute"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
                {GOOGLE_ID ? <div ref={gbtn} className="flex min-h-11 justify-center" /> : (
                  <button type="button" onClick={googleFallback} className="flex w-full items-center justify-center gap-3 rounded-full border border-line bg-surface py-2.5 text-sm font-semibold text-slate-700 hover:bg-soft">
                    <GoogleG /> {tab === 'signin' ? 'Sign in with Google' : 'Sign up with Google'}
                  </button>
                )}
                <p className="mt-4 text-center text-xs text-mute">{tab === 'signin' ? 'Google works for emails already registered. New here? ' : 'Already registered? '}
                  <button className="font-semibold text-brand hover:underline" onClick={() => { setTab(tab === 'signin' ? 'signup' : 'signin'); setErr('') }}>{tab === 'signin' ? 'Sign up' : 'Sign in'}</button></p>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
