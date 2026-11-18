import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, MapPin, Phone, MessageCircle, ImageOff, X, ArrowUpRight } from 'lucide-react'
import { Logo } from '../components/ui'
import Carousel from '../components/Carousel'
import { API, useApi, useAuth } from '../lib'
import { SITE, fullAddress, mapsUrl } from '../site'

const sports = [
  { name: 'Fencing', text: 'Epee, foil and sabre with certified coaching, from first lunge to national circuits.' },
  { name: 'Table Tennis', text: 'Structured levels, match play, footwork and spin training.' },
  { name: 'Carrom', text: 'Precision and strike control with tournament preparation for all ages.' },
  { name: 'Chess', text: 'Rated-play coaching, tactics and endgames with result tracking.' },
  { name: 'Physical Fitness', text: 'Strength, mobility and conditioning built around each sport.' },
]
const features = [
  ['Athlete passport', 'Sports, levels, matches, medals, academics and coach remarks for every student in one record.'],
  ['Check-in alerts', 'Parents hear the moment a child checks in. Late arrivals and absences are flagged too.'],
  ['Fees without chasing', 'Reminders before the due date, online payment and instant confirmation.'],
  ['Private by design', 'Owner, coach and student each see only what they should, medical details included.'],
]
const src = (k: string) => `${API}/public/gallery/file/${encodeURIComponent(k)}`

export default function Landing() {
  const { me } = useAuth()
  const gallery = useApi<any>('/public/gallery')
  const [filter, setFilter] = useState('All')
  const [open, setOpen] = useState<string | null>(null)
  const photos: any[] = gallery.data?.photos ?? []
  const shown = filter === 'All' ? photos : photos.filter((p) => p.sport === filter)
  const slides = photos.slice(0, 10).map((p) => ({ id: p.id, src: src(p.key) }))
  return (
    <div className="min-h-screen bg-page">
      {/* hero: full-bleed, photos run behind the text */}
      <section className="relative overflow-hidden bg-ink text-white">
        {slides.length > 0 && <Carousel slides={slides} interval={5000} className="absolute inset-0 opacity-45" />}
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/80 to-transparent" />
        <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <Link to="/" className="rounded-md bg-white px-2 py-1"><Logo small className="!h-12" /></Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-white/75 md:flex" aria-label="Site">
            <a href="#sports" className="hover:text-white">Sports</a><a href="#gallery" className="hover:text-white">Gallery</a><a href="#platform" className="hover:text-white">App</a><a href="#contact" className="hover:text-white">Contact</a>
          </nav>
          <div className="flex items-center gap-2">
            {me ? <Link to="/app" className="rounded-md bg-white px-4 py-2 text-sm font-bold text-ink hover:bg-white/90">Open dashboard</Link> : (
              <>
                <Link to="/login" className="rounded-md border border-white/40 px-4 py-2 text-sm font-semibold hover:bg-white/10">Sign in</Link>
                <Link to="/signup" className="rounded-md bg-flame px-4 py-2 text-sm font-bold hover:brightness-110">Sign up</Link>
              </>
            )}
          </div>
        </header>
        <div className="relative z-10 mx-auto max-w-7xl px-4 pb-24 pt-20 sm:px-8 sm:pt-28 lg:pb-32">
          <div className="label text-sky">Indoor sports academy · Namakkal</div>
          <h1 className="mt-5 max-w-3xl text-5xl font-extrabold leading-[1.02] sm:text-7xl">Five sports.<br />One standard.</h1>
          <p className="mt-6 max-w-xl text-lg text-white/75">Fencing, table tennis, carrom, chess and physical fitness under one roof, with an app that keeps coaches, parents and students on the same page.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link to="/signup" className="inline-flex items-center gap-2 rounded-md bg-flame px-6 py-3.5 font-bold hover:brightness-110">Join the academy <ArrowRight size={18} /></Link>
            <a href={`tel:+${SITE.phoneIntl}`} className="inline-flex items-center gap-2 rounded-md border border-white/40 px-6 py-3.5 font-semibold hover:bg-white/10"><Phone size={18} /> {SITE.phone}</a>
          </div>
        </div>
        <div className="stripe relative z-10 h-1.5" />
      </section>

      {/* sports as a numbered list */}
      <section id="sports" className="mx-auto max-w-7xl px-4 py-20 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
          <div>
            <div className="label text-flame">What we teach</div>
            <h2 className="mt-3 text-4xl font-extrabold">Coached by specialists.</h2>
            <p className="mt-3 text-mute">Every discipline is tracked in the same system, so progress in each sport is visible to the family.</p>
          </div>
          <ol className="divide-y divide-line border-y border-line">
            {sports.map((s, i) => {
              const ph = photos.filter((p) => p.sport === s.name).slice(0, 6)
              return (
                <li key={s.name} className="grid items-center gap-4 py-6 sm:grid-cols-[3rem_1fr_9rem]">
                  <span className="font-display text-2xl font-bold text-mute">{String(i + 1).padStart(2, '0')}</span>
                  <div><h3 className="text-xl font-bold">{s.name}</h3><p className="mt-1 text-sm text-mute">{s.text}</p></div>
                  {ph.length > 0 && <Carousel className="aspect-[4/3] rounded-md" interval={3800 + i * 500} slides={ph.map((p) => ({ id: p.id, src: src(p.key) }))} />}
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      <section id="gallery" className="bg-ink text-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-8">
          <div className="label text-sky">Gallery</div>
          <h2 className="mt-3 text-4xl font-extrabold">Life at the academy</h2>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-b border-white/15" role="tablist" aria-label="Gallery sport">
            {['All', ...sports.map((x) => x.name)].map((t) => (
              <button key={t} role="tab" aria-selected={filter === t} onClick={() => setFilter(t)} className={`-mb-px border-b-2 py-2.5 text-sm font-semibold ${filter === t ? 'border-flame text-white' : 'border-transparent text-white/60 hover:text-white'}`}>{t}</button>
            ))}
          </div>
          {shown.length ? (
            <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {shown.map((p) => (
                <button key={p.id} onClick={() => setOpen(p.key)} className="group relative aspect-[4/3] overflow-hidden rounded-md bg-ink2">
                  <img src={src(p.key)} alt={p.caption || `${p.sport ?? 'Academy'} photo`} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  {(p.caption || p.sport) && <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-8 text-left text-xs font-medium">{p.caption || p.sport}</span>}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              {(filter === 'All' ? sports : sports.filter((x) => x.name === filter)).map((x) => (
                <div key={x.name} className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-white/25 text-center text-sm text-white/60"><ImageOff size={20} />{x.name}<span className="text-xs">Photos coming soon</span></div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="platform" className="mx-auto max-w-7xl px-4 py-20 sm:px-8">
        <div className="label text-flame">The app</div>
        <h2 className="mt-3 max-w-2xl text-4xl font-extrabold">An app that knows every athlete.</h2>
        <div className="mt-10 grid border-l border-t border-line sm:grid-cols-2">
          {features.map(([t, d]) => (
            <div key={t} className="border-b border-r border-line p-8"><h3 className="text-lg font-bold">{t}</h3><p className="mt-2 text-sm text-mute">{d}</p></div>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap items-center gap-x-10 gap-y-4 text-sm">
          {['1  Sign up', '2  Owner approves', '3  Track progress'].map((x) => <span key={x} className="font-display font-bold"><span className="text-flame">{x.slice(0, 1)}</span>{x.slice(1)}</span>)}
          <Link to="/signup" className="ml-auto inline-flex items-center gap-2 rounded-md bg-ink px-6 py-3 font-bold text-white hover:bg-brand">Sign up now <ArrowRight size={18} /></Link>
        </div>
      </section>

      <section id="contact" className="bg-ink text-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-8">
          <h2 className="text-4xl font-extrabold">Visit or get in touch</h2>
          <div className="mt-8 grid gap-px bg-white/15 md:grid-cols-3">
            <a href={`tel:+${SITE.phoneIntl}`} className="group bg-ink p-7 hover:bg-ink2"><Phone size={20} className="text-sky" /><div className="label mt-4 text-white/55">Call us</div><div className="mt-1 flex items-center justify-between text-xl font-bold">{SITE.phone}<ArrowUpRight size={18} className="opacity-0 transition group-hover:opacity-100" /></div></a>
            <a href={`https://wa.me/${SITE.phoneIntl}`} target="_blank" rel="noreferrer" className="group bg-ink p-7 hover:bg-ink2"><MessageCircle size={20} className="text-sky" /><div className="label mt-4 text-white/55">WhatsApp</div><div className="mt-1 text-xl font-bold">Chat with us</div></a>
            <a href={mapsUrl()} target="_blank" rel="noreferrer" className="group bg-ink p-7 hover:bg-ink2"><MapPin size={20} className="text-sky" /><div className="label mt-4 text-white/55">Find us</div><div className="mt-1 font-bold leading-snug">{fullAddress()}</div></a>
          </div>
        </div>
      </section>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4" onClick={() => setOpen(null)} role="dialog" aria-modal="true">
          <button className="absolute right-4 top-4 rounded-md bg-white p-2" aria-label="Close"><X size={20} /></button>
          <img src={src(open)} alt="" className="max-h-[88vh] max-w-full rounded-md" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
      <footer className="bg-ink pb-6 text-center text-xs text-white/50">&copy; {new Date().getFullYear()} {SITE.name} · {SITE.domain}</footer>
    </div>
  )
}
