import { useState } from 'react'
import { Phone, MessageCircle, Trash2, Star, Check, EyeOff } from 'lucide-react'
import { api, useApi } from '../lib'
import { Card, PageHeader, Loading, ErrorMsg, Empty, Badge, Btn, Tabs } from '../components/ui'

const STATUSES = ['new', 'contacted', 'joined', 'closed']
const waLink = (p: string) => `https://wa.me/${p.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}`

export default function Enquiries() {
  const [tab, setTab] = useState('Trial requests')
  return (
    <>
      <PageHeader title="Enquiries" sub="Trial requests from the website, and parent reviews waiting for your approval." />
      <Tabs tabs={['Trial requests', 'Reviews']} value={tab} onChange={setTab} />
      {tab === 'Trial requests' ? <Requests /> : <Reviews />}
    </>
  )
}

function Requests() {
  const { data, loading, error, reload } = useApi<any>('/api/site/enquiries')
  const [filter, setFilter] = useState('all')
  if (loading) return <Loading />
  if (error) return <ErrorMsg text={error} />
  const rows: any[] = (data?.enquiries ?? []).filter((e: any) => filter === 'all' || e.status === filter)
  const newCount = (data?.enquiries ?? []).filter((e: any) => e.status === 'new').length
  const set = async (id: number, status: string) => { await api(`/api/site/enquiries/${id}`, { method: 'PATCH', body: { status } }); reload() }
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">{newCount} new</span>
        {['all', ...STATUSES].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`rounded-full border px-3 py-1 font-semibold capitalize ${filter === s ? 'border-ink bg-ink text-white' : 'border-line text-mute hover:text-ink'}`}>{s}</button>
        ))}
      </div>
      {!rows.length ? <Card><Empty text="No trial requests here yet. Requests from the home page form appear here." /></Card> : (
        <div className="space-y-3">
          {rows.map((e) => (
            <Card key={e.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2"><span className="text-base font-bold">{e.name}</span><Badge>{e.status}</Badge></div>
                  <div className="mt-1 text-sm text-mute">{[e.sport, e.child_age && `age ${e.child_age}`, String(e.created_at).slice(0, 16).replace('T', ' ')].filter(Boolean).join(' · ')}</div>
                  {e.message && <p className="mt-2 max-w-xl text-sm">{e.message}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a href={`tel:${e.phone}`} className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-2 text-sm font-semibold hover:border-brand"><Phone size={15} />{e.phone}</a>
                  <a href={waLink(e.phone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md bg-leaf px-3 py-2 text-sm font-semibold text-white"><MessageCircle size={15} />WhatsApp</a>
                  <select aria-label="Status" value={e.status} onChange={(x) => set(e.id, x.target.value)} className="rounded-md border border-line bg-white px-2 py-2 text-sm capitalize">
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}

function Reviews() {
  const { data, loading, error, reload } = useApi<any>('/api/site/reviews')
  if (loading) return <Loading />
  if (error) return <ErrorMsg text={error} />
  const rows: any[] = data?.reviews ?? []
  const set = async (id: number, status: string) => { await api(`/api/site/reviews/${id}`, { method: 'PATCH', body: { status } }); reload() }
  if (!rows.length) return <Card><Empty text="No reviews yet. Parents can post one from their account, and it waits here for your approval." /></Card>
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <Card key={r.id} className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2"><b>{r.name}</b><span className="text-sm text-mute">{r.relation}</span><Badge tone={r.status === 'approved' ? 'paid' : r.status === 'pending' ? 'pending' : undefined}>{r.status}</Badge></div>
              <div className="mt-1 flex gap-0.5 text-gold">{Array.from({ length: r.rating }).map((_, i) => <Star key={i} size={14} fill="currentColor" />)}</div>
              <p className="mt-2 text-sm">{r.body}</p>
            </div>
            <div className="flex gap-2">
              {r.status !== 'approved' && <Btn onClick={() => set(r.id, 'approved')}><Check size={15} /> Approve</Btn>}
              {r.status === 'approved' && <Btn variant="ghost" onClick={() => set(r.id, 'hidden')}><EyeOff size={15} /> Hide</Btn>}
              <Btn variant="danger" aria-label="Delete review" onClick={async () => { if (confirm('Delete this review?')) { await api(`/api/site/reviews/${r.id}`, { method: 'DELETE' }); reload() } }}><Trash2 size={15} /></Btn>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
