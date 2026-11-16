import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { api, useApi, fdate } from '../lib'
import { Card, PageHeader, Btn, Loading, ErrorMsg, Badge, Empty } from '../components/ui'

export default function Approvals() {
  const { data, loading, error, reload } = useApi<any>('/api/signups')
  const [err, setErr] = useState('')
  const act = async (fn: () => Promise<unknown>) => { setErr(''); try { await fn(); reload() } catch (e: any) { setErr(e.message) } }
  if (loading) return <Loading />
  if (error) return <ErrorMsg text={error} />
  const rows: any[] = data.signups
  return (
    <>
      <PageHeader title="Sign-up approvals" sub="New students, parents and coaches who registered themselves. They can sign in only after you approve." />
      {err && <div className="mb-3"><ErrorMsg text={err} /></div>}
      {!rows.length ? <Card><Empty text="No registrations waiting" /></Card> : (
        <div className="grid gap-3">
          {rows.map((r) => (
            <Card key={r.user_id} className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2"><b>{r.name}</b><Badge tone="stored">{r.role === 'staff' ? 'Coach / staff' : 'Student'}</Badge></div>
                <div className="mt-1 text-sm text-mute">{r.email} · {r.phone}{r.parent_name ? ` · Parent: ${r.parent_name}` : ''}{r.dob ? ` · DOB ${fdate(r.dob)}` : ''}</div>
                <div className="text-xs text-mute">Requested {fdate(r.created_at)}</div>
              </div>
              <div className="flex gap-2">
                <Btn onClick={() => act(() => api(`/api/signups/${r.user_id}/approve`, { body: {} }))}><Check size={16} /> Approve</Btn>
                <Btn variant="danger" onClick={() => confirm(`Reject and remove ${r.name}?`) && act(() => api(`/api/signups/${r.user_id}`, { method: 'DELETE' }))}><X size={16} /> Reject</Btn>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
