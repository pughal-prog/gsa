import { lazy, Suspense, useEffect, useRef, useState, FormEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, MapPin, Phone, MessageCircle, ImageOff, X, ArrowUpRight, Swords, Dices, Crown, Dumbbell, CircleDot,
  Bell, ShieldCheck, Receipt, IdCard, Trophy, Star, ChevronDown, Smartphone, CheckCircle2, Users, Award, CalendarCheck, Menu,
} from 'lucide-react'
import { Logo } from '../components/ui'
import Carousel from '../components/Carousel'
import ChatWidget from '../components/ChatWidget'
import { CountUp, Tilt, Magnetic, SplitWords, ScrollProgress, useScrolled, CursorGlow, Squiggle } from '../components/fx'
import { CourtArt, CourtKind } from '../components/court'
const Hero3D = lazy(() => import('../components/Hero3D'))
import { API, useApi, useAuth } from '../lib'
import { SITE, fullAddress, mapsUrl } from '../site'

const sports = [
  { name: 'Fencing', icon: Swords, text: 'Epee, foil and sabre with certified coaching, from the first lunge to national circuits.', tag: 'Olympic discipline' },
  { name: 'Table Tennis', icon: CircleDot, text: 'Structured levels, match play, footwork, spin and tournament preparation.', tag: 'Fast reflexes' },
  { name: 'Carrom', icon: Dices, text: 'Precision, striking control and tournament routines for every age group.', tag: 'Focus and finesse' },
  { name: 'Chess', icon: Crown, text: 'Rated-play coaching, tactics, openings and endgames with result tracking.', tag: 'Strategic mind' },
  { name: 'Physical Fitness', icon: Dumbbell, text: 'Strength, mobility and conditioning built around each sport.', tag: 'Strong foundation' },
]
const ages = [
  { name: 'Sub Junior', text: 'The youngest players. Fun drills, basics and a love for the game.', c: 'bg-sky' },
  { name: 'Cadet', text: 'Technique, discipline and first competitive matches.', c: 'bg-leaf' },
  { name: 'Junior', text: 'Serious training, rated play and district level events.', c: 'bg-brand' },
  { name: 'Senior', text: 'Advanced coaching for zonal, state and national circuits.', c: 'bg-flame' },
]
const pathway = ['Beginner', 'District', 'Zonal', 'State', 'National']
const features = [
  { icon: IdCard, t: 'Athlete passport', d: 'Sports, levels, matches, medals, academics and coach remarks for every student in one record.' },
  { icon: Bell, t: 'Instant check-in alerts', d: 'Parents hear the moment a child checks in. Late arrivals and absences are flagged too.' },
  { icon: Receipt, t: 'Clear fees', d: 'Fee plans per sport, bills with due dates and quick confirmation, no paper chasing.' },
  { icon: ShieldCheck, t: 'Private by design', d: 'Owner, coach and student each see only what they should, medical details included.' },
  { icon: Trophy, t: 'Achievements by level', d: 'District, zonal and state results tracked by age category, ready to show.' },
  { icon: CalendarCheck, t: 'Attendance records', d: 'Daily attendance with history, exports to PDF and Excel for the academy.' },
]
const faqs = [
  ['What age can my child start?', 'Children can begin from the Sub Junior group. Coaches place each student in the right age category and level after a short assessment.'],
  ['Can we try a class before joining?', 'Yes. Send a trial request with the form on this page or call us, and we will confirm a suitable batch.'],
  ['How do I follow my child’s progress?', 'After the owner approves your sign-up, you can see attendance, fees, achievements and announcements in the website or the Android app.'],
  ['How are fees collected?', 'The academy sets a fee plan for each sport. Your bills and due dates appear in the app, and you are notified before they fall due.'],
  ['Is my child’s information safe?', 'Yes. Only the owner, the assigned coach and you can see your child’s record, and health details are limited to the owner and student.'],
]
const src = (k: string) => `${API}/public/gallery/file/${encodeURIComponent(k)}`

function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!('IntersectionObserver' in window)) { el.classList.add('in'); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('in'); io.disconnect() } }, { threshold: 0.12 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return ref
}
function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useReveal()
  return <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>
}
const Eyebrow = ({ children, light }: { children: ReactNode; light?: boolean }) => (
  <div className={`label ${light ? 'text-sky' : 'text-brand'}`}>{children}</div>
)

function TrialForm({ compact, bar, sportList }: { compact?: boolean; bar?: boolean; sportList: { id: number; name: string }[] }) {
  const [f, setF] = useState({ name: '', phone: '', sport_id: '', child_age: '', message: '', website: '' })
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [err, setErr] = useState('')
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }))
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(''); setState('busy')
    try {
      const r = await fetch(`${API}/public/enquiry`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, sport_id: f.sport_id ? Number(f.sport_id) : null }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Could not send. Please call us.')
      setState('done')
    } catch (x: any) { setErr(x.message); setState('idle') }
  }
  if (state === 'done') return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <CheckCircle2 size={44} className="text-leaf" />
      <div className="font-display text-xl font-bold">Thank you</div>
      <p className="text-sm text-mute">We have your request and will call you shortly to confirm a trial batch.</p>
    </div>
  )
  const inp = 'w-full rounded-lg border border-line bg-white px-3.5 py-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-sky/30'
  return (
    <form onSubmit={submit} className={bar ? 'grid gap-3 lg:grid-cols-[1.2fr_1.2fr_1fr_.7fr_auto] lg:items-center' : 'space-y-3'}>
      <input className="hidden" tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set('website', e.target.value)} aria-hidden />
      <div className={bar ? 'contents' : compact ? 'grid gap-3' : 'grid gap-3 sm:grid-cols-2'}>
        <label className="block"><span className="sr-only">Your name</span><input required className={inp} placeholder="Your name" value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
        <label className="block"><span className="sr-only">Phone number</span><input required inputMode="tel" className={inp} placeholder="Phone number" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></label>
        <label className="block"><span className="sr-only">Sport</span>
          <select className={inp} value={f.sport_id} onChange={(e) => set('sport_id', e.target.value)}><option value="">Choose a sport</option>{sportList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="block"><span className="sr-only">Child age</span><input className={inp} placeholder="Child’s age" value={f.child_age} onChange={(e) => set('child_age', e.target.value)} /></label>
      </div>
      {!compact && <textarea className={inp} rows={3} placeholder="Anything we should know? (optional)" value={f.message} onChange={(e) => set('message', e.target.value)} />}
      {err && <p key={err} className="shake text-sm font-medium text-danger lg:col-span-full" role="alert">{err}</p>}
      <button disabled={state === 'busy'} className={`rip inline-flex items-center justify-center gap-2 rounded-lg bg-flame px-5 py-3.5 font-bold text-white transition hover:brightness-110 disabled:opacity-60 ${bar ? "" : "w-full"}`}>
        {state === 'busy' ? 'Sending...' : 'Request a trial class'} <ArrowRight size={18} />
      </button>
    </form>
  )
}


const courtOf: CourtKind[] = ['fencing', 'table', 'carrom', 'chess', 'fitness']

/** Hero panel backdrop: the playing surface of each sport draws itself in turn. */
function HeroCourt() {
  const [i, setI] = useState(0)
  useEffect(() => { const t = setInterval(() => setI((x) => (x + 1) % courtOf.length), 5200); return () => clearInterval(t) }, [])
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center p-6" aria-hidden>
      <div key={i} className="w-full"><CourtArt kind={courtOf[i]} /></div>
    </div>
  )
}

/** Desktop: the section pins to the screen and scrolling walks through the five sports, each with its own court. */
function PinnedSports({ photos }: { photos: any[] }) {
  const ref = useRef<HTMLElement>(null)
  const [i, setI] = useState(0)
  useEffect(() => {
    const on = () => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const p = Math.min(0.999, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight)))
      setI(Math.floor(p * sports.length))
    }
    on()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on) }
  }, [])
  const cur = sports[i]
  const ph = photos.filter((p) => p.sport === cur.name).slice(0, 6)
  return (
    <section id="sports" ref={ref} className="relative hidden bg-ink text-white lg:block" style={{ height: `${sports.length * 85 + 15}vh` }}>
      <div className="sticky top-0 grid h-screen grid-cols-[1fr_1.1fr] items-center gap-10 overflow-hidden px-8 xl:px-16">
        <div className="aurora" />
        <div className="relative z-10 max-w-xl">
          <h2 className="text-5xl font-extrabold leading-[1.02] xl:text-6xl">Five sports.<br />One academy.</h2>
          <ul className="mt-10 space-y-1">
            {sports.map((s, k) => (
              <li key={s.name}>
                <button onClick={() => { const el = ref.current; if (el) window.scrollTo({ top: el.offsetTop + (el.offsetHeight - window.innerHeight) * ((k + 0.5) / sports.length), behavior: 'smooth' }) }}
                  className={`flex w-full items-center gap-4 py-1.5 text-left font-display font-extrabold transition-all duration-500 ${k === i ? 'text-4xl text-white xl:text-5xl' : 'text-2xl text-white/30 hover:text-white/60'}`}>
                  <span className={`h-1 rounded-full bg-gold transition-all duration-500 ${k === i ? 'w-10' : 'w-0'}`} />{s.name}
                </button>
              </li>
            ))}
          </ul>
          <div key={cur.name} className="rise mt-6 min-h-[8.5rem]">
            <span className="rounded-full border border-white/25 px-3 py-1 text-xs font-semibold text-white/80">{cur.tag}</span>
            <p className="mt-3 max-w-md text-lg leading-relaxed text-white/75">{cur.text}</p>
            <a href="#trial" className="mt-4 inline-flex items-center gap-2 font-bold text-gold hover:gap-3">Try a {cur.name} class <ArrowRight size={18} /></a>
          </div>
        </div>
        <div className="relative z-10 mx-auto w-full max-w-2xl">
          <CourtArt kind={courtOf[i]} className="w-full" />
          {ph.length > 0 && (
            <div key={cur.name} className="rise absolute -bottom-6 -right-2 h-44 w-64 overflow-hidden rounded-2xl border border-white/20 shadow-2xl shadow-black/50 xl:h-52 xl:w-72">
              <Carousel className="absolute inset-0" interval={3200} slides={ph.map((p) => ({ id: p.id, src: src(p.key) }))} />
            </div>
          )}
        </div>
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2" aria-hidden>
          {sports.map((_, k) => <span key={k} className={`h-1.5 rounded-full transition-all duration-500 ${k === i ? 'w-8 bg-gold' : 'w-1.5 bg-white/30'}`} />)}
        </div>
      </div>
    </section>
  )
}

const APK_URL = 'https://github.com/pughal-prog/gsa/releases/latest/download/GlobalSportsAcademy.apk'

export default function Landing() {
  const { me } = useAuth()
  const scrolled = useScrolled()
  const gallery = useApi<any>('/public/gallery')
  const reviewsQ = useApi<any>('/public/reviews')
  const sportsQ = useApi<any>('/public/sports')
  const [filter, setFilter] = useState('All')
  const [open, setOpen] = useState<string | null>(null)
  const [faq, setFaq] = useState<number | null>(0)
  const [menu, setMenu] = useState(false)
  const photos: any[] = gallery.data?.photos ?? []
  const reviews: any[] = reviewsQ.data?.reviews ?? []
  const sportList: { id: number; name: string }[] = sportsQ.data?.sports ?? []
  const shown = filter === 'All' ? photos : photos.filter((p) => p.sport === filter)
  const slides = photos.slice(0, 10).map((p) => ({ id: p.id, src: src(p.key) }))
  const nav = [['Sports', '#sports'], ['Programmes', '#programmes'], ['App', '#platform'], ['Gallery', '#gallery'], ['Reviews', '#reviews'], ['Contact', '#contact']]

  return (
    <div className="min-h-screen bg-page text-ink">
      <ScrollProgress />
      <CursorGlow />
      {/* announcement bar */}
      <div className="bg-ink text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 px-4 py-2 text-center text-xs font-medium sm:text-sm">
          <span className="rounded bg-gold px-2 py-0.5 text-[11px] font-bold text-ink">Admissions open</span>
          <span className="text-white/80">Fencing, table tennis, carrom, chess and fitness. Book a trial class today.</span>
          <a href="#trial" className="hidden font-semibold text-gold underline-offset-2 hover:underline sm:inline">Book now</a>
        </div>
      </div>

      {/* header */}
      <header className={`glass-head sticky top-0 z-40 border-b border-line bg-white ${scrolled ? "scrolled" : ""}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5 sm:px-8">
          <Link to="/" aria-label="Global Sports Academy home"><Logo small className="!h-12" /></Link>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-ink/70 lg:flex" aria-label="Site">
            {nav.map(([t, h]) => <a key={t} href={h} className="transition hover:text-brand">{t}</a>)}
          </nav>
          <div className="flex items-center gap-2">
            {me ? <Link to="/app" className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-dark">Open dashboard</Link> : (
              <>
                <Link to="/login" className="hidden rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:border-brand hover:text-brand sm:inline-block">Sign in</Link>
                <Link to="/signup" className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-dark">Join now</Link>
              </>
            )}
            <button className="rounded-lg border border-line p-2 lg:hidden" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu((x) => !x)}>{menu ? <X size={20} /> : <Menu size={20} />}</button>
          </div>
        </div>
        {menu && (
          <nav className="border-t border-line bg-white px-4 py-3 lg:hidden" aria-label="Mobile">
            {nav.map(([t, h]) => <a key={t} href={h} onClick={() => setMenu(false)} className="block rounded-lg px-3 py-2.5 font-semibold hover:bg-soft">{t}</a>)}
            {!me && <Link to="/login" className="block rounded-lg px-3 py-2.5 font-semibold hover:bg-soft">Sign in</Link>}
          </nav>
        )}
      </header>

      {/* hero */}
      <section className="hero-light relative overflow-hidden text-ink">
        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-4 pb-52 pt-10 sm:px-8 lg:grid-cols-[1.12fr_0.88fr] lg:pb-56 lg:pt-14">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold text-ink2"><span className="h-2 w-2 rounded-full bg-flame" />Indoor sports academy, Namakkal</div>
            <h1 className="mt-6 text-[clamp(2.7rem,6vw,5.6rem)] font-extrabold leading-[.92] tracking-tight" aria-label="Where young athletes train, compete and win."><SplitWords parts={["Where young athletes train,", "compete and win."]} /></h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink2/75">Five sports under one roof, certified coaching for every age category, and an app that keeps coaches, parents and students on the same page.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Magnetic><a href="#trial" className="rip inline-flex items-center gap-2 rounded-lg bg-flame px-6 py-3.5 font-bold text-white shadow-lg shadow-flame/30 transition hover:brightness-110">Book a trial class <ArrowRight size={18} /></a></Magnetic>
              <Magnetic><a href={`tel:+${SITE.phoneIntl}`} className="rip inline-flex items-center gap-2 rounded-lg border border-ink/20 bg-white px-6 py-3.5 font-semibold transition hover:border-brand hover:text-brand"><Phone size={18} /> {SITE.phone}</a></Magnetic>
            </div>
            <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink2/75">
              {['Certified coaches', 'All age categories', 'Parent app with live alerts'].map((x) => <li key={x} className="flex items-center gap-2"><CheckCircle2 size={16} className="text-leaf" />{x}</li>)}
            </ul>
          </div>
          <div className="panel-arena relative h-[360px] overflow-hidden rounded-[2rem] shadow-2xl shadow-brand/30 sm:h-[440px] lg:h-[540px]">
            <div className="absolute inset-0 opacity-40" aria-hidden><HeroCourt /></div>
            <Suspense fallback={null}><Hero3D className="absolute inset-0 z-[2]" /></Suspense>
            <div className="absolute bottom-4 left-4 z-[3] flex gap-2 text-xs font-bold">
              <span className="rounded-full bg-gold px-3 py-1.5 text-ink">5 sports</span>
              <span className="rounded-full bg-white/15 px-3 py-1.5 text-white backdrop-blur">4 age groups</span>
            </div>
          </div>
        </div>
        {/* booking bar */}
        <div id="trial" className="absolute inset-x-0 bottom-10 z-20 mx-auto max-w-6xl scroll-mt-24 px-4 sm:px-8">
          <div className="glass-card rounded-2xl p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-2xl font-extrabold">Book a trial class</h2>
              <p className="text-sm text-mute">Leave your number and we will call you back to confirm a batch.</p>
            </div>
            <TrialForm bar compact sportList={sportList} />
          </div>
        </div>
      </section>

      {/* facts strip overlapping the hero */}
      <div className="relative z-20 mx-auto mt-8 max-w-6xl px-4 sm:px-8">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-line shadow-xl shadow-navy/10 md:grid-cols-4">
          {[[Trophy, 5, 'Sports taught'], [Users, 4, 'Age categories'], [Award, 3, 'Levels: District, Zonal, State'], [Smartphone, 'Web + App', 'For parents and coaches']].map(([I, n, l]: any) => (
            <div key={l} className="flex items-center gap-3 bg-white px-5 py-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand"><I size={22} /></span>
              <div><div className="font-display text-xl font-extrabold leading-none">{typeof n === "number" ? <CountUp value={n} /> : n}</div><div className="mt-1 text-xs text-mute">{l}</div></div>
            </div>
          ))}
        </div>
      </div>

      {/* sports */}
      <PinnedSports photos={photos} />
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-8 lg:hidden">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow>What we teach</Eyebrow>
          <h2 className="mt-3 text-3xl font-extrabold sm:text-5xl">Five disciplines, one standard</h2>
          <Squiggle className="mx-auto mt-2" />
          <p className="mt-3 text-mute">Every sport is coached by specialists and tracked in the same system, so progress is visible to the family.</p>
        </Reveal>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sports.map((s, i) => {
            const ph = photos.filter((p) => p.sport === s.name).slice(0, 6)
            const I = s.icon
            return (
              <Reveal key={s.name} delay={i * 60}>
                <Tilt className="h-full rounded-2xl"><article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white">
                  <div className="relative aspect-[16/10] bg-gradient-to-br from-navy to-navy2">
                    {ph.length > 0 ? <Carousel className="absolute inset-0" interval={3800 + i * 500} slides={ph.map((p) => ({ id: p.id, src: src(p.key) }))} /> : <div className="grid h-full place-items-center text-white/30"><I size={64} /></div>}
                    <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-[11px] font-bold text-navy">{s.tag}</span>
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-flame/10 text-flame"><I size={20} /></span><h3 className="text-xl font-extrabold">{s.name}</h3></div>
                    <p className="mt-3 flex-1 text-sm leading-relaxed text-mute">{s.text}</p>
                    <a href="#trial" className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-brand group-hover:gap-2.5">Try a class <ArrowRight size={16} /></a>
                  </div>
                </article></Tilt>
              </Reveal>
            )
          })}
          <Reveal delay={300}>
            <div className="flex h-full flex-col justify-center rounded-2xl bg-navy p-8 text-white">
              <div className="label text-sky">Not sure which sport?</div>
              <h3 className="mt-2 text-2xl font-extrabold">Let our coaches guide you</h3>
              <p className="mt-2 text-sm text-white/75">Tell us your child’s age and interests and we will suggest the best fit.</p>
              <a href={`https://wa.me/${SITE.phoneIntl}`} target="_blank" rel="noreferrer" className="mt-5 inline-flex w-fit items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-bold text-navy hover:bg-sky hover:text-white"><MessageCircle size={18} /> Chat on WhatsApp</a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* programmes by age */}
      <section id="programmes" className="bg-soft">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-8">
          <Reveal className="max-w-2xl">
            <Eyebrow>Programmes</Eyebrow>
            <h2 className="mt-3 text-3xl font-extrabold sm:text-5xl">A path for every age</h2>
            <p className="mt-3 text-mute">Students train with players their own age and move up as they grow.</p>
          </Reveal>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {ages.map((a, i) => (
              <Reveal key={a.name} delay={i * 70}>
                <div className="h-full overflow-hidden rounded-2xl bg-white shadow-sm">
                  <div className={`${a.c} h-1.5`} />
                  <div className="p-6"><div className="font-display text-3xl font-extrabold text-ink/15">{String(i + 1).padStart(2, '0')}</div><h3 className="mt-1 text-xl font-extrabold">{a.name}</h3><p className="mt-2 text-sm text-mute">{a.text}</p></div>
                </div>
              </Reveal>
            ))}
          </div>
          {/* pathway */}
          <Reveal className="mt-14 rounded-2xl bg-white p-6 shadow-sm sm:p-8">
            <div className="label text-brand">The competition pathway</div>
            <ol className="mt-5 grid gap-4 sm:grid-cols-5">
              {pathway.map((p, i) => (
                <li key={p} className="relative">
                  <div className="flex items-center gap-3 sm:flex-col sm:items-start">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-extrabold text-white ${i === 0 ? 'bg-leaf' : i === pathway.length - 1 ? 'bg-flame' : 'bg-brand'}`}>{i + 1}</span>
                    <div className="font-display font-bold">{p}</div>
                  </div>
                  {i < pathway.length - 1 && <div className="absolute left-[2.6rem] right-0 top-5 hidden h-0.5 bg-gradient-to-r from-brand/40 to-transparent sm:block" />}
                </li>
              ))}
            </ol>
            <p className="mt-5 text-sm text-mute">Every match and medal is recorded with its level and age category in the student’s passport.</p>
          </Reveal>
        </div>
      </section>

      {/* app features */}
      <section id="platform" className="mx-auto max-w-7xl px-4 py-24 sm:px-8">
        <div className="grid items-start gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <Eyebrow>The academy app</Eyebrow>
            <h2 className="mt-3 text-3xl font-extrabold sm:text-5xl">An app that knows every athlete</h2>
            <p className="mt-4 text-mute">Parents, students and coaches use one simple platform on the website and on Android. Sign up, get approved by the academy, and follow everything in one place.</p>
            <ol className="mt-7 space-y-3">
              {['Sign up with your phone or Google account', 'The academy owner approves your request', 'Track attendance, fees, achievements and announcements'].map((x, i) => (
                <li key={x} className="flex items-center gap-3 text-sm font-medium"><span className="grid h-7 w-7 place-items-center rounded-full bg-flame text-xs font-bold text-white">{i + 1}</span>{x}</li>
              ))}
            </ol>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/signup" className="inline-flex items-center gap-2 rounded-lg bg-navy px-6 py-3.5 font-bold text-white hover:bg-navy2">Sign up now <ArrowRight size={18} /></Link>
              <a href={APK_URL} download className="inline-flex items-center gap-2 rounded-lg bg-flame px-6 py-3.5 font-bold text-white hover:opacity-90"><Smartphone size={18} /> Download Android app (APK)</a>
            </div>
            <p className="mt-3 text-xs text-mute">After downloading, open the file and allow "Install from this source" if Android asks. Works on Android 6 and above.</p>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2">
            <Reveal className="sm:col-span-2">
              <Tilt className="rounded-2xl">
                <div className="relative overflow-hidden rounded-2xl bg-deep p-7 text-white">
                  <div className="aurora" />
                  <div className="relative">
                    <h3 className="text-2xl font-extrabold">Know the moment they arrive</h3>
                    <p className="mt-2 max-w-md text-sm text-white/70">Parents get an alert when a child checks in, and a flag when they are late or absent.</p>
                    <div className="mt-6 max-w-sm space-y-2.5" aria-label="Sample alerts">
                      {[['Checked in', 'Sample student arrived at 5:02 pm', 'bg-leaf'], ['Running late', 'Not yet checked in for the 5:00 batch', 'bg-gold']].map(([t, d, c], i) => (
                        <div key={t} className="rise flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur" style={{ animationDelay: `${400 + i * 500}ms` }}>
                          <span className={`h-2.5 w-2.5 rounded-full ${c}`} /><div><div className="text-sm font-bold">{t}</div><div className="text-xs text-white/65">{d}</div></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Tilt>
            </Reveal>
            {features.filter((_, k) => k !== 1).map((f, i) => (
              <Reveal key={f.t} delay={i * 50} className={i === 4 ? 'sm:col-span-2' : ''}>
                <Tilt className="h-full rounded-2xl">
                  <div className="h-full rounded-2xl border border-line bg-white p-6">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand"><f.icon size={22} /></span>
                    <h3 className="mt-4 text-lg font-bold">{f.t}</h3><p className="mt-1.5 text-sm leading-relaxed text-mute">{f.d}</p>
                  </div>
                </Tilt>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* sport marquee */}
      <div className="overflow-hidden bg-deep py-8" aria-hidden>
        <div className="marquee flex w-max gap-12 whitespace-nowrap font-display text-6xl font-extrabold sm:text-8xl">
          {[...sports, ...sports, ...sports].map((s, i) => <span key={i} className="flex items-center gap-12"><span className="outline-word">{s.name}</span><span className="text-flame">/</span></span>)}
        </div>
      </div>

      {/* gallery */}
      <section id="gallery" className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-8">
          <Reveal className="flex flex-wrap items-end justify-between gap-4">
            <div><Eyebrow>Gallery</Eyebrow><h2 className="mt-3 text-3xl font-extrabold sm:text-5xl">Life at the academy</h2></div>
          </Reveal>
          <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Gallery sport">
            {['All', ...sports.map((x) => x.name)].map((t) => (
              <button key={t} role="tab" aria-selected={filter === t} onClick={() => setFilter(t)} className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${filter === t ? 'border-navy bg-navy text-white' : 'border-line text-ink/70 hover:border-brand hover:text-brand'}`}>{t}</button>
            ))}
          </div>
          {shown.length ? (
            <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {shown.map((p, i) => (
                <button key={p.id} onClick={() => setOpen(p.key)} className={`group relative overflow-hidden rounded-xl bg-soft ${i % 7 === 0 ? 'aspect-square md:col-span-2 md:row-span-2' : 'aspect-[4/3]'}`}>
                  <img src={src(p.key)} alt={p.caption || `${p.sport ?? 'Academy'} photo`} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  {(p.caption || p.sport) && <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2 pt-8 text-left text-xs font-medium text-white">{p.caption || p.sport}</span>}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              {(filter === 'All' ? sports : sports.filter((x) => x.name === filter)).map((x) => (
                <div key={x.name} className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line text-center text-sm text-mute"><ImageOff size={20} />{x.name}<span className="text-xs">Photos coming soon</span></div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* reviews */}
      {reviews.length > 0 && (
        <section id="reviews" className="bg-soft">
          <div className="mx-auto max-w-7xl px-4 py-24 sm:px-8">
            <Reveal className="mx-auto max-w-2xl text-center"><Eyebrow>Parent voices</Eyebrow><h2 className="mt-3 text-3xl font-extrabold sm:text-5xl">What families say</h2></Reveal>
            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {reviews.slice(0, 6).map((r, i) => (
                <Reveal key={r.id} delay={i * 60}>
                  <figure className="h-full rounded-2xl bg-white p-6 shadow-sm">
                    <div className="flex gap-0.5 text-gold" aria-label={`${r.rating} out of 5`}>{Array.from({ length: r.rating }).map((_, n) => <Star key={n} size={16} fill="currentColor" />)}</div>
                    <blockquote className="mt-3 text-sm leading-relaxed text-ink/80">{r.body}</blockquote>
                    <figcaption className="mt-4 text-sm"><b>{r.name}</b>{r.relation && <span className="text-mute"> · {r.relation}</span>}</figcaption>
                  </figure>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-4xl px-4 py-24 sm:px-8">
        <Reveal className="text-center"><Eyebrow>Questions</Eyebrow><h2 className="mt-3 text-3xl font-extrabold sm:text-5xl">Parents often ask</h2></Reveal>
        <div className="mt-10 divide-y divide-line rounded-2xl border border-line">
          {faqs.map(([q, a], i) => (
            <div key={q}>
              <button className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-bold" aria-expanded={faq === i} onClick={() => setFaq(faq === i ? null : i)}>
                {q}<ChevronDown size={20} className={`shrink-0 text-brand transition ${faq === i ? 'rotate-180' : ''}`} />
              </button>
              {faq === i && <p className="px-5 pb-5 text-sm leading-relaxed text-mute">{a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* closing CTA with full form + contact */}
      <section id="contact" className="relative overflow-hidden bg-navy text-white">
        <div className="hero-grid absolute inset-0" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-8 lg:grid-cols-2">
          <div>
            <Eyebrow light>Contact</Eyebrow>
            <h2 className="mt-3 text-3xl font-extrabold sm:text-5xl">Start your journey with us</h2>
            <p className="mt-3 max-w-md text-white/75">Visit the academy, call, or send a message. We reply quickly.</p>
            <div className="mt-8 space-y-3">
              <a href={`tel:+${SITE.phoneIntl}`} className="group flex items-center gap-4 rounded-xl bg-white/10 p-4 transition hover:bg-white/15"><span className="grid h-11 w-11 place-items-center rounded-lg bg-sky text-white"><Phone size={20} /></span><div className="flex-1"><div className="label text-white/60">Call us</div><div className="text-lg font-bold">{SITE.phone}</div></div><ArrowUpRight size={18} className="opacity-0 transition group-hover:opacity-100" /></a>
              <a href={`https://wa.me/${SITE.phoneIntl}`} target="_blank" rel="noreferrer" className="group flex items-center gap-4 rounded-xl bg-white/10 p-4 transition hover:bg-white/15"><span className="grid h-11 w-11 place-items-center rounded-lg bg-leaf text-white"><MessageCircle size={20} /></span><div className="flex-1"><div className="label text-white/60">WhatsApp</div><div className="text-lg font-bold">Chat with us</div></div><ArrowUpRight size={18} className="opacity-0 transition group-hover:opacity-100" /></a>
              <a href={mapsUrl()} target="_blank" rel="noreferrer" className="group flex items-center gap-4 rounded-xl bg-white/10 p-4 transition hover:bg-white/15"><span className="grid h-11 w-11 place-items-center rounded-lg bg-flame text-white"><MapPin size={20} /></span><div className="flex-1"><div className="label text-white/60">Find us</div><div className="font-bold leading-snug">{fullAddress()}</div></div><ArrowUpRight size={18} className="opacity-0 transition group-hover:opacity-100" /></a>
            </div>
          </div>
          <div className="rounded-2xl bg-white p-6 text-ink sm:p-8">
            <h3 className="text-2xl font-extrabold">Send an enquiry</h3>
            <p className="mb-5 mt-1 text-sm text-mute">Tell us a little and we will get back to you.</p>
            <TrialForm sportList={sportList} />
          </div>
        </div>
      </section>

      <footer className="bg-ink text-white/70">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm sm:px-8">
          <div className="flex items-center gap-3"><span className="rounded-md bg-white px-1.5 py-1"><Logo small className="!h-9" /></span><span>&copy; {new Date().getFullYear()} {SITE.name}</span></div>
          <nav className="flex flex-wrap gap-5" aria-label="Footer">
            <a href="#sports" className="hover:text-white">Sports</a><a href="#faq" className="hover:text-white">FAQ</a><Link to="/privacy" className="hover:text-white">Privacy</Link><Link to="/login" className="hover:text-white">Sign in</Link>
          </nav>
        </div>
      </footer>

      {/* floating assistant (right) and WhatsApp (left) */}
      <ChatWidget />
      <a href={`https://wa.me/${SITE.phoneIntl}`} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp" className="fixed bottom-5 left-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-leaf text-white shadow-lg shadow-black/30 transition hover:scale-105"><MessageCircle size={26} /></a>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4" onClick={() => setOpen(null)} role="dialog" aria-modal="true">
          <button className="absolute right-4 top-4 rounded-md bg-white p-2" aria-label="Close"><X size={20} /></button>
          <img src={src(open)} alt="" className="max-h-[88vh] max-w-full rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
