import { useEffect, useRef, useState } from 'react'

/**
 * Hero stage: instead of floating objects, each sport is played out as a short looping drill
 * (rally, strike, knight tour, lunge, rep). The stage cycles on its own and can be switched by hand.
 */
const V = '#d9f24c'
const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

function TableTennis() {
  const rally = 'M70,115 L330,190 L70,170 L330,110 L70,205 L330,150 L70,115'
  return (
    <g>
      <rect x="40" y="70" width="320" height="160" rx="4" {...line} />
      <line x1="200" y1="56" x2="200" y2="244" {...line} strokeWidth={3} />
      <line x1="40" y1="150" x2="360" y2="150" {...line} opacity=".25" />
      <path d={rally} fill="none" stroke={V} strokeWidth="1.5" strokeDasharray="3 6" opacity=".45" />
      <rect x="20" y="100" width="9" height="46" rx="4" fill="#fff"><animate attributeName="y" values="100;150;110;175;100" dur="2.4s" repeatCount="indefinite" /></rect>
      <rect x="371" y="100" width="9" height="46" rx="4" fill="#fff"><animate attributeName="y" values="160;105;170;125;160" dur="2.4s" repeatCount="indefinite" /></rect>
      <circle r="9" fill={V}><animateMotion dur="2.4s" repeatCount="indefinite" path={rally} /></circle>
    </g>
  )
}

function Carrom() {
  const ring = Array.from({ length: 6 }, (_, k) => { const a = (k / 6) * Math.PI * 2; return [Math.cos(a), Math.sin(a)] })
  return (
    <g>
      <rect x="80" y="20" width="240" height="240" rx="8" {...line} />
      <rect x="102" y="42" width="196" height="196" {...line} opacity=".35" />
      {[[92, 32], [308, 32], [92, 248], [308, 248]].map(([x, y]) => <circle key={x + '' + y} cx={x} cy={y} r="11" fill="none" stroke="#fff" strokeWidth="2" />)}
      <circle cx="200" cy="140" r="34" {...line} opacity=".3" />
      {ring.map(([x, y], k) => (
        <circle key={k} cx={200 + x * 19} cy={140 + y * 19} r="8.5" fill="#fff" fillOpacity={k % 2 ? 0.95 : 0.35} stroke="#fff">
          <animateTransform attributeName="transform" type="translate" values={`0 0;0 0;${x * 62} ${y * 52};0 0`} keyTimes="0;.36;.78;1" dur="3.2s" repeatCount="indefinite" calcMode="spline" keySplines="0 0 1 1;.2 .7 .3 1;.5 0 .5 1" />
        </circle>
      ))}
      <circle cx="200" cy="140" r="8.5" fill="#ff5a1f" />
      <circle cx="200" cy="236" r="12" fill={V}>
        <animate attributeName="cy" values="236;236;158;158;236" keyTimes="0;.12;.36;.55;1" dur="3.2s" repeatCount="indefinite" />
      </circle>
    </g>
  )
}

function Chess() {
  const cell = 44, ox = 46, oy = 40
  const c = (x: number, y: number) => [ox + cell * x + cell / 2, oy + cell * y + cell / 2]
  const tour = [[0, 4], [1, 2], [3, 3], [4, 1], [2, 0], [0, 1], [1, 3], [0, 4]].map(([x, y]) => c(x, y))
  const d = 'M' + tour.map((p) => p.join(',')).join(' L')
  return (
    <g>
      {Array.from({ length: 35 }, (_, k) => { const x = k % 7, y = Math.floor(k / 7); return (x + y) % 2 ? <rect key={k} x={ox + x * cell} y={oy + y * cell} width={cell} height={cell} fill="#fff" fillOpacity=".14" /> : null })}
      <rect x={ox} y={oy} width={cell * 7} height={cell * 5} {...line} />
      <path d={d} fill="none" stroke={V} strokeWidth="2" strokeDasharray="4 6" opacity=".6" />
      {tour.slice(1, 7).map((p, k) => <circle key={k} cx={p[0]} cy={p[1]} r="4" fill={V} opacity=".7" />)}
      <g>
        <circle r="13" fill={V} stroke="#0a0f24" strokeWidth="2" />
        <path d="M-5,6 L-5,-2 Q-5,-8 1,-8 L6,-4 L3,-1 L5,6 Z" fill="#0a0f24" />
        <animateMotion dur="6s" repeatCount="indefinite" path={d} calcMode="linear" />
      </g>
    </g>
  )
}

function Fencing() {
  return (
    <g>
      <rect x="30" y="118" width="340" height="64" rx="4" {...line} />
      <line x1="200" y1="118" x2="200" y2="182" {...line} opacity=".4" />
      <line x1="130" y1="118" x2="130" y2="182" {...line} opacity=".4" /><line x1="270" y1="118" x2="270" y2="182" {...line} opacity=".4" />
      <g>
        <circle cx="96" cy="140" r="11" fill="#fff" /><line x1="96" y1="151" x2="96" y2="178" {...line} stroke="#fff" strokeWidth="5" />
        <line x1="104" y1="146" x2="150" y2="146" stroke={V} strokeWidth="3" strokeLinecap="round"><animate attributeName="x2" values="150;150;214;214;150" keyTimes="0;.35;.5;.7;1" dur="2.8s" repeatCount="indefinite" /></line>
        <animateTransform attributeName="transform" type="translate" values="0 0;0 0;44 0;44 0;0 0" keyTimes="0;.35;.5;.7;1" dur="2.8s" repeatCount="indefinite" />
      </g>
      <g>
        <circle cx="304" cy="140" r="11" fill="#ff5a1f" /><line x1="304" y1="151" x2="304" y2="178" {...line} stroke="#ff5a1f" strokeWidth="5" />
        <line x1="296" y1="146" x2="256" y2="146" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        <animateTransform attributeName="transform" type="translate" values="0 0;0 0;16 0;16 0;0 0" keyTimes="0;.35;.5;.7;1" dur="2.8s" repeatCount="indefinite" />
      </g>
      <circle cx="262" cy="146" r="0" fill="none" stroke={V} strokeWidth="3"><animate attributeName="r" values="0;0;0;22;0" keyTimes="0;.35;.5;.62;.75" dur="2.8s" repeatCount="indefinite" /></circle>
    </g>
  )
}

function Fitness() {
  return (
    <g>
      <line x1="60" y1="252" x2="340" y2="252" {...line} opacity=".5" />
      <circle cx="200" cy="146" r="104" fill="none" stroke="#fff" strokeOpacity=".18" strokeWidth="6" />
      <circle cx="200" cy="146" r="104" fill="none" stroke={V} strokeWidth="6" strokeLinecap="round" pathLength="1" strokeDasharray="1" transform="rotate(-90 200 146)">
        <animate attributeName="stroke-dashoffset" values="1;0;1" dur="2.4s" repeatCount="indefinite" />
      </circle>
      <g>
        <line x1="130" y1="190" x2="270" y2="190" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
        {[[116, 'big'], [132, 'small'], [268, 'small'], [284, 'big']].map(([x, k]) => <rect key={x as number} x={(x as number) - (k === 'big' ? 8 : 6)} y={k === 'big' ? 160 : 168} width={k === 'big' ? 16 : 12} height={k === 'big' ? 60 : 44} rx="4" fill={k === 'big' ? V : '#fff'} />)}
        <animateTransform attributeName="transform" type="translate" values="0 40;0 -34;0 40" keyTimes="0;.5;1" dur="2.4s" repeatCount="indefinite" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1" />
      </g>
    </g>
  )
}

const SCENES = [
  { name: 'Fencing', Scene: Fencing, note: 'Lunge and recover' },
  { name: 'Table tennis', Scene: TableTennis, note: 'Rally and spin' },
  { name: 'Carrom', Scene: Carrom, note: 'Strike and clear' },
  { name: 'Chess', Scene: Chess, note: 'Think three moves ahead' },
  { name: 'Fitness', Scene: Fitness, note: 'Strength for every sport' },
]
const HOLD = 6500

export default function SportStage({ className = '' }: { className?: string }) {
  const [i, setI] = useState(0)
  const svg = useRef<SVGSVGElement>(null)
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  useEffect(() => { if (reduced) return; const t = setTimeout(() => setI((x) => (x + 1) % SCENES.length), HOLD); return () => clearTimeout(t) }, [i, reduced])
  useEffect(() => { if (reduced) svg.current?.pauseAnimations() }, [i, reduced])
  const { name, Scene, note } = SCENES[i]
  return (
    <div className={`flex flex-col ${className}`}
      onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const s = svg.current; if (s) s.style.transform = `translate(${((e.clientX - r.left) / r.width - 0.5) * 14}px, ${((e.clientY - r.top) / r.height - 0.5) * 10}px)` }}>
      <div className="px-6 pt-6 sm:px-8 sm:pt-8">
        <div key={name} className="rise font-display text-[clamp(2.6rem,6vw,4.6rem)] font-black leading-none text-transparent" style={{ WebkitTextStroke: '1.5px rgba(255,255,255,.55)' }}>{name}</div>
        <div key={note} className="rise mt-2 text-sm font-semibold text-white/80">{note}</div>
      </div>
      <svg ref={svg} key={i} viewBox="0 0 400 290" className="min-h-0 w-full flex-1 text-white transition-transform duration-300 ease-out" role="img" aria-label={`${name} drill animation`}>
        <Scene />
      </svg>
      <div className="flex flex-wrap gap-2 px-6 pb-6 sm:px-8 sm:pb-8">
        {SCENES.map((s, k) => (
          <button key={s.name} onClick={() => setI(k)} aria-pressed={k === i}
            className={`relative overflow-hidden rounded-full px-3.5 py-1.5 text-xs font-bold transition ${k === i ? 'bg-white text-ink' : 'bg-white/15 text-white hover:bg-white/25'}`}>
            {s.name}
            {k === i && !reduced && <span key={i} className="stage-bar absolute inset-x-0 bottom-0 h-[3px] origin-left bg-brand" style={{ animationDuration: `${HOLD}ms` }} />}
          </button>
        ))}
      </div>
    </div>
  )
}
