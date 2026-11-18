/** Line drawings of each sport's playing surface. They draw themselves; change `kind` (used as a key) to replay. */
export type CourtKind = 'fencing' | 'table' | 'carrom' | 'chess' | 'fitness'

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, pathLength: 1 }

export function CourtArt({ kind, className = '' }: { kind: CourtKind; className?: string }) {
  let d: JSX.Element
  if (kind === 'table') d = (
    <>
      <rect x="40" y="60" width="320" height="180" rx="4" {...S} />
      <line x1="200" y1="44" x2="200" y2="256" {...S} strokeWidth={3} />
      <line x1="40" y1="150" x2="360" y2="150" {...S} />
      <line x1="196" y1="44" x2="204" y2="44" {...S} /><line x1="196" y1="256" x2="204" y2="256" {...S} />
      <circle cx="280" cy="105" r="9" {...S} className="gold" />
    </>
  )
  else if (kind === 'carrom') d = (
    <>
      <rect x="80" y="30" width="240" height="240" rx="6" {...S} />
      <rect x="104" y="54" width="192" height="192" {...S} />
      <circle cx="200" cy="150" r="38" {...S} /><circle cx="200" cy="150" r="9" {...S} className="gold" />
      {[[92, 42], [308, 42], [92, 258], [308, 258]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="11" {...S} />)}
      <line x1="136" y1="86" x2="264" y2="86" {...S} /><line x1="136" y1="214" x2="264" y2="214" {...S} />
      <line x1="136" y1="86" x2="136" y2="214" {...S} /><line x1="264" y1="86" x2="264" y2="214" {...S} />
    </>
  )
  else if (kind === 'chess') d = (
    <>
      {Array.from({ length: 9 }).map((_, i) => <line key={`h${i}`} x1="60" y1={30 + i * 30} x2="300" y2={30 + i * 30} {...S} strokeWidth={i % 8 === 0 ? 3 : 1.5} />)}
      {Array.from({ length: 9 }).map((_, i) => <line key={`v${i}`} x1={60 + i * 30} y1="30" x2={60 + i * 30} y2="270" {...S} strokeWidth={i % 8 === 0 ? 3 : 1.5} />)}
      <path d="M180 120 l30 30 l-30 30 l-30 -30 z" {...S} className="gold" />
    </>
  )
  else if (kind === 'fencing') d = (
    <>
      <rect x="20" y="115" width="360" height="70" rx="3" {...S} />
      <line x1="200" y1="115" x2="200" y2="185" {...S} strokeWidth={3} />
      <line x1="150" y1="115" x2="150" y2="185" {...S} /><line x1="250" y1="115" x2="250" y2="185" {...S} />
      <line x1="70" y1="115" x2="70" y2="185" {...S} /><line x1="330" y1="115" x2="330" y2="185" {...S} />
      <path d="M96 78 L132 78 M104 66 L96 78 L104 90" {...S} className="gold" />
      <path d="M304 222 L268 222 M296 210 L304 222 L296 234" {...S} className="gold" />
    </>
  )
  else d = (
    <>
      <circle cx="200" cy="150" r="110" {...S} /><circle cx="200" cy="150" r="76" {...S} /><circle cx="200" cy="150" r="42" {...S} />
      <path d="M40 150 H140 L158 112 L186 196 L212 100 L234 150 H360" {...S} strokeWidth={3} className="gold" />
    </>
  )
  return <svg key={kind} viewBox="0 0 400 300" className={`court ${className}`} role="img" aria-label={`${kind} playing area`}>{d}</svg>
}
