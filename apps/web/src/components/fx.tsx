import { ReactNode, useEffect, useRef, useState, MouseEvent } from 'react'

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Counts up to a number when it scrolls into view. `format` turns the animated value into text. */
export function CountUp({ value, format = (n: number) => String(Math.round(n)), ms = 1100 }: { value: number; format?: (n: number) => string; ms?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [n, setN] = useState(reduced() ? value : 0)
  useEffect(() => {
    if (reduced()) { setN(value); return }
    const el = ref.current
    if (!el) return
    let raf = 0
    const run = () => {
      const t0 = performance.now()
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / ms)
        setN(value * (1 - Math.pow(1 - p, 3)))
        if (p < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }
    if (!('IntersectionObserver' in window)) { setN(value); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); run() } }, { threshold: 0.3 })
    io.observe(el)
    return () => { io.disconnect(); cancelAnimationFrame(raf) }
  }, [value, ms])
  return <span ref={ref}>{format(n)}</span>
}

/** Card that tilts a few degrees toward the cursor and carries a soft spotlight. */
export function Tilt({ children, className = '', max = 6 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const move = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el || reduced()) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height
    el.style.setProperty('--mx', `${x * 100}%`)
    el.style.setProperty('--my', `${y * 100}%`)
    el.style.transform = `perspective(900px) rotateX(${(0.5 - y) * max}deg) rotateY(${(x - 0.5) * max}deg) translateY(-3px)`
  }
  const leave = () => { if (ref.current) ref.current.style.transform = '' }
  return <div ref={ref} onMouseMove={move} onMouseLeave={leave} className={`tilt ${className}`}>{children}</div>
}

/** Button or link wrapper that leans slightly toward the cursor. */
export function Magnetic({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const move = (e: MouseEvent<HTMLSpanElement>) => {
    const el = ref.current
    if (!el || reduced()) return
    const r = el.getBoundingClientRect()
    el.style.transform = `translate(${(e.clientX - (r.left + r.width / 2)) * 0.18}px, ${(e.clientY - (r.top + r.height / 2)) * 0.28}px)`
  }
  return <span ref={ref} onMouseMove={move} onMouseLeave={() => { if (ref.current) ref.current.style.transform = '' }} className={`magnetic inline-block ${className}`}>{children}</span>
}

/** Headline whose words rise in one after another. Pass plain strings and optional `{ text, className }` parts. */
export function SplitWords({ parts }: { parts: (string | { text: string; className: string })[] }) {
  let i = 0
  return (
    <>
      {parts.map((p, k) => {
        const text = typeof p === 'string' ? p : p.text
        const cls = typeof p === 'string' ? '' : p.className
        return text.split(' ').filter(Boolean).map((w) => (
          <span key={`${k}-${w}-${i}`} className="word-mask"><span className={`word ${cls}`} style={{ animationDelay: `${120 + i++ * 70}ms` }}>{w}&nbsp;</span></span>
        ))
      })}
    </>
  )
}

/** Thin bar at the top of the page that tracks scroll position. */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const on = () => {
      const h = document.documentElement
      const p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)
      if (ref.current) ref.current.style.transform = `scaleX(${p})`
    }
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return <div ref={ref} className="scroll-progress" aria-hidden />
}

/** True once the page has scrolled past `px`. Used to switch the header to its frosted state. */
export function useScrolled(px = 24) {
  const [s, setS] = useState(false)
  useEffect(() => {
    const on = () => setS(window.scrollY > px)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [px])
  return s
}

/** Soft light that follows the cursor on desktop. Hidden on touch screens. */
export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (reduced() || !window.matchMedia('(pointer: fine)').matches) return
    let raf = 0, x = 0, y = 0
    const on = (e: globalThis.MouseEvent) => {
      x = e.clientX; y = e.clientY
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (ref.current) ref.current.style.transform = `translate3d(${x - 160}px, ${y - 160}px, 0)` })
    }
    window.addEventListener('mousemove', on, { passive: true })
    return () => window.removeEventListener('mousemove', on)
  }, [])
  return <div ref={ref} className="cursor-glow" aria-hidden />
}

/** Moves its layers at different speeds while scrolling. Put `data-speed` on children (0.1 = slow, 0.4 = fast). */
export function Parallax({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (reduced()) return
    const el = ref.current
    if (!el) return
    const layers = Array.from(el.querySelectorAll<HTMLElement>('[data-speed]'))
    let raf = 0
    const on = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const y = window.scrollY
        if (y > 1200) return
        layers.forEach((l) => { l.style.transform = `translate3d(0, ${y * Number(l.dataset.speed)}px, 0)` })
      })
    }
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return <div ref={ref} className={className}>{children}</div>
}

/** A hand-drawn style underline that draws itself when it scrolls into view. */
export function Squiggle({ className = '' }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !('IntersectionObserver' in window)) { el?.classList.add('drawn'); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('drawn'); io.disconnect() } }, { threshold: 0.6 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <svg ref={ref} viewBox="0 0 200 12" preserveAspectRatio="none" className={`squiggle ${className}`} aria-hidden>
      <path d="M2 8 C 30 2, 50 12, 80 6 S 130 2, 160 7 S 190 9, 198 4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" pathLength={1} />
    </svg>
  )
}

/** Adds a ripple to any element with the `rip` class. Call once at startup. */
export function initRipple() {
  if (typeof document === 'undefined') return
  document.addEventListener('pointerdown', (e) => {
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('.rip')
    if (!el || reduced() || (el as HTMLButtonElement).disabled) return
    const r = el.getBoundingClientRect()
    const size = Math.max(r.width, r.height)
    const d = document.createElement('span')
    d.className = 'ripple'
    d.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`
    el.appendChild(d)
    setTimeout(() => d.remove(), 650)
  }, { passive: true })
}

type ToastItem = { id: number; text: string; tone: 'ok' | 'error' }
let toastFn: ((text: string, tone?: 'ok' | 'error') => void) | null = null
/** Shows a short message at the bottom of the screen. Safe to call from anywhere once <Toaster /> is mounted. */
export const toast = (text: string, tone: 'ok' | 'error' = 'ok') => toastFn?.(text, tone)

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])
  useEffect(() => {
    toastFn = (text, tone = 'ok') => {
      const id = Date.now() + Math.random()
      setItems((x) => [...x.slice(-2), { id, text, tone }])
      setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3200)
    }
    return () => { toastFn = null }
  }, [])
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast-in rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-2xl ${t.tone === 'ok' ? 'bg-ink' : 'bg-danger'}`}>
          <span className={`mr-2 inline-block h-2 w-2 rounded-full ${t.tone === 'ok' ? 'bg-leaf' : 'bg-white'}`} />{t.text}
        </div>
      ))}
    </div>
  )
}
