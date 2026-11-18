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
