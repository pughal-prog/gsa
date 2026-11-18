import { useEffect, useState } from 'react'

export type Slide = { id: number | string; src: string; title?: string; sub?: string }

/** Auto-running slideshow: crossfade plus a slow zoom. Pauses on hover, honours reduced motion. */
export default function Carousel({ slides, interval = 4500, className = '' }: { slides: Slide[]; interval?: number; className?: string }) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (slides.length < 2 || paused) return
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), interval)
    return () => clearInterval(t)
  }, [slides.length, paused, interval])
  useEffect(() => { if (i >= slides.length) setI(0) }, [slides.length, i])
  if (!slides.length) return null
  return (
    <div className={`relative overflow-hidden bg-slate-900 ${className}`} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-roledescription="carousel">
      <style>{`@keyframes kb{from{transform:scale(1)}to{transform:scale(1.08)}}@media (prefers-reduced-motion:reduce){.kb{animation:none!important}}`}</style>
      {slides.map((s, n) => (
        <img key={s.id} src={s.src} alt={s.title || 'Academy photo'} loading={n === 0 ? 'eager' : 'lazy'}
          className={`kb absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${n === i ? 'opacity-100' : 'opacity-0'}`}
          style={n === i ? { animation: `kb ${interval + 1200}ms ease-out forwards` } : undefined} />
      ))}
      {(slides[i].title || slides[i].sub) && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 pt-12 text-white">
          <div className="text-sm font-semibold">{slides[i].title}</div>{slides[i].sub && <div className="text-xs opacity-80">{slides[i].sub}</div>}
        </div>
      )}
      {slides.length > 1 && (
        <div className="absolute right-3 top-3 flex gap-1">
          {slides.slice(0, 8).map((s, n) => <button key={s.id} aria-label={`Photo ${n + 1}`} onClick={() => setI(n)} className={`h-1.5 rounded-full transition-all ${n === i ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`} />)}
        </div>
      )}
    </div>
  )
}
