import { ReactNode, useEffect, useState, FormEvent } from 'react'
import { X } from 'lucide-react'
import { API, getToken, cx } from '../lib'
import { CountUp } from './fx'

export const Card = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cx('rounded-lg border border-line bg-surface p-5', className)}>{children}</div>
)

export const PageHeader = ({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
      {sub && <p className="mt-1 text-sm text-mute">{sub}</p>}
    </div>
    {action}
  </div>
)

/** Numbers count up; text such as "Rs 12,000" keeps its symbols and animates the digits. */
function animate(v: ReactNode): ReactNode {
  if (typeof v === 'number') return <CountUp value={v} />
  if (typeof v === 'string') {
    const m = v.match(/^(\D*)(-?[\d,]+(?:\.\d+)?)(\D*)$/)
    if (m) {
      const num = Number(m[2].replace(/,/g, ''))
      const dec = (m[2].split('.')[1] ?? '').length
      if (Number.isFinite(num)) return <>{m[1]}<CountUp value={num} format={(n) => (dec ? n.toFixed(dec) : Math.round(n).toString()).replace(/\B(?=(\d{3})+(?!\d))(?<!\.\d*)/g, ',')} />{m[3]}</>
    }
  }
  return v
}

export const Stat = ({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: 'good' | 'bad' | 'warn' }) => (
  <Card className="rise lift border-t-4 border-t-ink">
    <div className="label text-mute">{label}</div>
    <div className={cx('mt-2 font-display text-3xl font-semibold', tone === 'good' && 'text-leaf', tone === 'bad' && 'text-danger', tone === 'warn' && 'text-warn')}>{animate(value)}</div>
    {hint && <div className="mt-1 text-xs text-mute">{hint}</div>}
  </Card>
)

const tones: Record<string, string> = {
  paid: 'bg-leaf/10 text-leaf', present: 'bg-leaf/10 text-leaf', received: 'bg-leaf/10 text-leaf', active: 'bg-leaf/10 text-leaf', sent: 'bg-leaf/10 text-leaf', closed: 'bg-leaf/10 text-leaf',
  pending: 'bg-warn/10 text-warn', late: 'bg-warn/10 text-warn', open: 'bg-warn/10 text-warn', stored: 'bg-sky/10 text-sky', queued: 'bg-sky/10 text-sky',
  absent: 'bg-danger/10 text-danger', failed: 'bg-danger/10 text-danger', overdue: 'bg-danger/10 text-danger',
}
export const Badge = ({ children, tone }: { children: ReactNode; tone?: string }) => (
  <span className={cx('inline-block rounded-md px-2 py-0.5 text-xs font-semibold', tones[tone ?? String(children).toLowerCase()] ?? 'bg-softer text-slate-600')}>{children}</span>
)

export const Btn = ({ variant = 'primary', className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) => (
  <button {...p} className={cx(
    'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky',
    variant === 'primary' && 'bg-ink text-white hover:bg-brand',
    variant === 'ghost' && 'border border-line bg-surface text-slate-700 hover:bg-soft',
    variant === 'danger' && 'bg-danger/10 text-danger hover:bg-danger/20', className)} />
)

export const Empty = ({ text }: { text: string }) => <div className="py-10 text-center text-sm text-mute">{text}</div>
export const Loading = () => (
  <div className="space-y-3 py-6" aria-busy="true" aria-label="Loading">
    <div className="skeleton h-8 w-48" />
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-24" />)}</div>
    {[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-12" />)}
  </div>
)
export const ErrorMsg = ({ text }: { text: string }) => <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger" role="alert">{text}</div>

export type Col<T> = { head: string; cell: (r: T) => ReactNode; className?: string }
export function Table<T>({ cols, rows, onRow, empty = 'Nothing here yet' }: { cols: Col<T>[]; rows: T[]; onRow?: (r: T) => void; empty?: string }) {
  if (!rows.length) return <Empty text={empty} />
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead><tr className="border-b-2 border-ink/80 label text-ink">
          {cols.map((c) => <th key={c.head} className={cx('px-3 py-2 font-medium', c.className)}>{c.head}</th>)}
        </tr></thead>
        <tbody className="stagger">
          {rows.map((r, i) => (
            <tr key={i} onClick={onRow ? () => onRow(r) : undefined} className={cx('border-b border-line/60', onRow && 'cursor-pointer hover:bg-soft/70')}>
              {cols.map((c) => <td key={c.head} className={cx('px-3 py-3', c.className)}>{c.cell(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export const Tabs = ({ tabs, value, onChange }: { tabs: string[]; value: string; onChange: (t: string) => void }) => (
  <div className="mb-5 flex gap-6 overflow-x-auto border-b border-line" role="tablist">
    {tabs.map((t) => (
      <button key={t} role="tab" aria-selected={t === value} onClick={() => onChange(t)}
        className={cx('-mb-px whitespace-nowrap border-b-2 py-2.5 text-sm font-semibold transition', t === value ? 'border-flame text-ink' : 'border-transparent text-mute hover:text-ink')}>{t}</button>
    ))}
  </div>
)

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', h)
    return () => removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-surface p-6 shadow-xl sm:max-w-xl sm:rounded-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-mute hover:bg-soft hover:text-slate-900"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export type Field = { name: string; label: string; type?: 'text' | 'date' | 'number' | 'email' | 'tel' | 'textarea' | 'select' | 'time'; options?: { value: string | number; label: string }[]; required?: boolean; span?: 2; defaultValue?: any }

export function FormModal({ title, fields, onClose, onSubmit, submitLabel = 'Save', initial }: {
  title: string; fields: Field[]; onClose: () => void; onSubmit: (v: Record<string, any>) => Promise<void>; submitLabel?: string; initial?: Record<string, any>
}) {
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const v: Record<string, any> = {}
    fields.forEach((f) => { const x = fd.get(f.name); v[f.name] = x === '' ? null : f.type === 'number' && x !== null ? Number(x) : x })
    setBusy(true); setErr('')
    try { await onSubmit(v); onClose() } catch (er: any) { setErr(er.message); setBusy(false) }
  }
  const cls = 'w-full rounded-md border border-line bg-soft px-3 py-2 text-sm outline-none focus:border-brand'
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <label key={f.name} className={cx('block text-sm', (f.span === 2 || f.type === 'textarea') && 'sm:col-span-2')}>
            <span className="mb-1 block text-xs text-mute">{f.label}{f.required && ' *'}</span>
            {f.type === 'textarea' ? <textarea name={f.name} rows={3} required={f.required} defaultValue={initial?.[f.name] ?? f.defaultValue ?? ''} className={cls} />
              : f.type === 'select' ? (
                <select name={f.name} required={f.required} defaultValue={initial?.[f.name] ?? f.defaultValue ?? ''} className={cls}>
                  <option value="">Select...</option>
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : <input name={f.name} type={f.type ?? 'text'} step={f.type === 'number' ? 'any' : undefined} required={f.required} defaultValue={initial?.[f.name] ?? f.defaultValue ?? ''} className={cls} />}
          </label>
        ))}
        {err && <div className="sm:col-span-2"><ErrorMsg text={err} /></div>}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Btn type="button" variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" disabled={busy}>{busy ? 'Saving...' : submitLabel}</Btn>
        </div>
      </form>
    </Modal>
  )
}

/** Image from the private media endpoint (needs the Authorization header, so fetch as blob). */
export function AuthImg({ k, alt, className }: { k?: string | null; alt: string; className?: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    if (!k) return
    let url = ''
    fetch(`${API}/api/media/${encodeURIComponent(k)}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.blob() : Promise.reject())).then((b) => { url = URL.createObjectURL(b); setSrc(url) }).catch(() => {})
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [k])
  if (!k || !src) return <div className={cx('flex items-center justify-center bg-soft text-xs text-mute', className)} aria-label={alt}>{k ? '...' : 'No photo'}</div>
  return <img src={src} alt={alt} className={cx('object-cover', className)} />
}

export const Logo = ({ small, className }: { small?: boolean; className?: string }) => (
  <img src="/logo.png" alt="Global Sports Academy" className={cx(small ? 'h-14' : 'h-24', 'w-auto', className)} />
)
