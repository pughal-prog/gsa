import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Swords, CircleDot, Target, Crown, Dumbbell, BellRing, IdCard, Fingerprint, Wallet, ShieldCheck, ArrowRight, MapPin, Phone, MessageCircle, UserPlus, BadgeCheck, LineChart, ImageOff, X } from 'lucide-react'
import { Logo } from '../components/ui'
import { API, useApi, useAuth } from '../lib'
import { SITE, fullAddress, mapsUrl } from '../site'

const sports = [
  { icon: Swords, name: 'Fencing', text: 'Epee, foil and sabre with certified coaching, from first lunge to national circuits.', c: 'border-flame text-flame bg-flame/10' },
  { icon: CircleDot, name: 'Table Tennis', text: 'Structured levels, match play, footwork and spin training.', c: 'border-brand text-brand bg-brand/10' },
  { icon: Target, name: 'Carrom', text: 'Precision and strike control with tournament preparation for all ages.', c: 'border-leaf text-leaf bg-leaf/10' },
  { icon: Crown, name: 'Chess', text: 'Rated-play coaching, tactics and endgames with result tracking.', c: 'border-sky text-sky bg-sky/10' },
  { icon: Dumbbell, name: 'Physical Fitness', text: 'Strength, mobility and conditioning built around each sport.', c: 'border-amber-500 text-amber-600 bg-amber-500/10' },
]
const features = [
  { icon: IdCard, title: 'Athlete Passport', text: 'A lasting record for every student: sports, levels, matches, medals, academics and coach remarks in one place.' },
  { icon: Fingerprint, title: 'Biometric check-in alerts', text: 'The moment your child checks in, parents are notified. Late arrivals and absences are flagged too.' },
  { icon: Wallet, title: 'Fees without chasing', text: 'Reminders before the due date, online payment by UPI and cards, and instant confirmation.' },
  { icon: ShieldCheck, title: 'Safe, role-based access', text: 'Owner, coach and student each see only what they should. Every sensitive change is logged.' },
]
const steps = [
  { icon: UserPlus, t: 'Sign up', d: 'Create your account with email or Google in a minute.' },
  { icon: BadgeCheck, t: 'Get approved', d: 'The academy confirms your registration and sets up your sports.' },
  { icon: LineChart, t: 'Track progress', d: 'Follow attendance, fees, matches and achievements anytime.' },
]

import Carousel from '../components/Carousel'
const src = (k: string) => `${API}/public/gallery/file/${encodeURIComponent(k)}`

export default function Landing() {
  const { me } = useAuth()
  const gallery = useApi<any>('/public/gallery')
  const [filter, setFilter] = useState('All')
  const [open, setOpen] = useState<string | null>(null)
  const photos: any[] = gallery.data?.photos ?? []
  const shown = filter === 'All' ? photos : photos.filter((p) => p.sport === filter)
  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
        <div className="stripe h-1" />
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 sm:px-8">
          <Link to="/"><Logo small className="!h-[72px]" /></Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex" aria-label="Site">
            <a href="#sports" className="hover:text-brand">Sports</a><a href="#gallery" className="hover:text-brand">Gallery</a><a href="#platform" className="hover:text-brand">Platform</a><a href="#contact" className="hover:text-brand">Contact</a>
          </nav>
          <div className="flex items-center gap-2">
            {me ? <Link to="/app" className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">Open dashboard</Link> : (
              <>
                <Link to="/login" className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-soft">Sign in</Link>
                <Link to="/signup" className="hidden rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark sm:block">Sign up</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="hero-bg">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-8 lg:grid-cols-2 lg:py-24">
          <div className="rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-brand shadow-sm"><span className="h-2 w-2 rounded-full bg-leaf" /> Indoor sports academy · Namakkal</span>
            <h1 className="mt-6 text-5xl font-extrabold leading-[1.05] text-slate-900 sm:text-6xl">Train like a <span className="text-flame">champion</span>.<br />Grow like a <span className="text-brand">global</span> athlete.</h1>
            <p className="mt-6 max-w-xl text-lg text-slate-600">Fencing, table tennis, carrom, chess and physical fitness under one roof, with a connected app that keeps coaches, parents and students on the same page.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/signup" className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 font-semibold text-white shadow-card hover:bg-brand-dark">Join the academy <ArrowRight size={18} /></Link>
              <a href={`tel:+${SITE.phoneIntl}`} className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-6 py-3 font-semibold text-slate-800 hover:bg-soft"><Phone size={18} /> {SITE.phone}</a>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-md">
            {photos.length > 0 ? (
              <div className="rounded-3xl border border-line bg-surface p-3 shadow-card">
                <Carousel className="aspect-[4/3] rounded-2xl" slides={photos.slice(0, 8).map((p) => ({ id: p.id, src: src(p.key), title: p.caption || p.sport || 'Global Sports Academy', sub: p.sport }))} />
              </div>
            ) : <div className="rounded-3xl border border-line bg-surface p-6 shadow-card"><Logo className="mx-auto !h-auto w-full" /></div>}
          </div>
        </div>
      </section>

      <section id="sports" className="mx-auto max-w-7xl px-4 py-20 sm:px-8">
        <h2 className="text-3xl font-extrabold sm:text-4xl">Five disciplines. One standard.</h2>
        <p className="mt-2 max-w-xl text-mute">Coached by specialists and tracked in the same system, so progress in every sport is visible.</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {sports.map((s) => (
            <div key={s.name} className={`overflow-hidden rounded-2xl border-t-4 bg-surface shadow-card transition hover:-translate-y-1 ${s.c.split(' ')[0]}`}>
              {photos.some((p) => p.sport === s.name) && <Carousel className="aspect-[16/9]" interval={4000 + (s.name.length % 3) * 700} slides={photos.filter((p) => p.sport === s.name).slice(0, 6).map((p) => ({ id: p.id, src: src(p.key) }))} />}
              <div className="p-6"><span className={`grid h-12 w-12 place-items-center rounded-xl ${s.c.split(' ').slice(1).join(' ')}`}><s.icon size={24} /></span>
              <h3 className="mt-5 text-lg font-bold">{s.name}</h3><p className="mt-2 text-sm text-mute">{s.text}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section id="gallery" className="bg-page">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-8">
          <h2 className="text-3xl font-extrabold sm:text-4xl">Life at the academy</h2>
          <p className="mt-2 max-w-xl text-mute">Training sessions, matches and prize days, sport by sport.</p>
          <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Gallery sport">
            {['All', ...sports.map((x) => x.name)].map((t) => (
              <button key={t} role="tab" aria-selected={filter === t} onClick={() => setFilter(t)} className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${filter === t ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-slate-700 hover:bg-soft'}`}>{t}</button>
            ))}
          </div>
          {shown.length ? (
            <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {shown.map((p) => (
                <button key={p.id} onClick={() => setOpen(p.key)} className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-softer shadow-card">
                  <img src={src(p.key)} alt={p.caption || `${p.sport ?? 'Academy'} photo`} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                  {(p.caption || p.sport) && <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/80 to-transparent px-3 pb-2 pt-6 text-left text-xs font-medium text-white">{p.caption || p.sport}</span>}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
              {(filter === 'All' ? sports : sports.filter((x) => x.name === filter)).map((x) => (
                <div key={x.name} className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-surface text-center text-sm text-mute"><ImageOff size={22} />{x.name}<span className="text-xs">Photos coming soon</span></div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="platform">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-8 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-extrabold sm:text-4xl">An app that knows every athlete.</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {features.map((f) => (
                <div key={f.title}><span className="grid h-10 w-10 place-items-center rounded-lg bg-brand/10 text-brand"><f.icon size={20} /></span>
                  <h3 className="mt-3 font-bold">{f.title}</h3><p className="mt-1 text-sm text-mute">{f.text}</p></div>
              ))}
            </div>
          </div>
          <div className="mx-auto w-full max-w-sm">
            <div className="rounded-[2rem] border border-line bg-surface p-4 shadow-card">
              <div className="mb-3 flex items-center gap-2 px-2 text-xs font-medium text-mute"><BellRing size={14} /> Parent alerts</div>
              {[['Reached the academy', 'Aarav has reached Global Sports Academy at 4:52 PM.', 'text-leaf bg-leaf/10'], ['Fee due soon', 'Monthly fee is due on the 10th. Pay from the app.', 'text-warn bg-warn/10'], ['New medal', 'Aarav won Gold at the State Fencing Championship.', 'text-brand bg-brand/10']].map(([t, b, c]) => (
                <div key={t} className="mb-2 rounded-2xl bg-soft p-4"><div className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${c}`}>{t}</div><div className="mt-2 text-sm text-slate-700">{b}</div></div>
              ))}
            </div>
            <p className="mt-3 text-center text-xs text-mute">Sample notifications</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-8">
        <h2 className="text-center text-3xl font-extrabold sm:text-4xl">Get started in three steps</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.t} className="rounded-2xl border border-line bg-surface p-6 text-center shadow-card">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand text-white"><s.icon size={24} /></span>
              <div className="mt-4 text-xs font-bold text-flame">STEP {i + 1}</div><h3 className="text-lg font-bold">{s.t}</h3><p className="mt-1 text-sm text-mute">{s.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center"><Link to="/signup" className="inline-flex items-center gap-2 rounded-xl bg-brand px-7 py-3 font-semibold text-white hover:bg-brand-dark">Sign up now <ArrowRight size={18} /></Link></div>
      </section>

      <section id="contact" className="brand-panel text-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-8">
          <h2 className="text-3xl font-extrabold sm:text-4xl">Visit or get in touch</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <a href={`tel:+${SITE.phoneIntl}`} className="rounded-2xl bg-white/10 p-6 backdrop-blur transition hover:bg-white/20"><Phone /><div className="mt-3 text-sm text-white/70">Call us</div><div className="text-xl font-bold">{SITE.phone}</div></a>
            <a href={`https://wa.me/${SITE.phoneIntl}`} target="_blank" rel="noreferrer" className="rounded-2xl bg-white/10 p-6 backdrop-blur transition hover:bg-white/20"><MessageCircle /><div className="mt-3 text-sm text-white/70">WhatsApp</div><div className="text-xl font-bold">Chat with us</div></a>
            <a href={mapsUrl()} target="_blank" rel="noreferrer" className="rounded-2xl bg-white/10 p-6 backdrop-blur transition hover:bg-white/20"><MapPin /><div className="mt-3 text-sm text-white/70">Find us</div><div className="font-bold leading-snug">{fullAddress()}</div></a>
          </div>
        </div>
      </section>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/80 p-4" onClick={() => setOpen(null)} role="dialog" aria-modal="true">
          <button className="absolute right-4 top-4 rounded-full bg-white p-2" aria-label="Close"><X size={20} /></button>
          <img src={src(open)} alt="" className="max-h-[88vh] max-w-full rounded-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
      <footer className="py-6 text-center text-xs text-mute">&copy; {new Date().getFullYear()} {SITE.name} · {SITE.domain}</footer>
    </div>
  )
}
