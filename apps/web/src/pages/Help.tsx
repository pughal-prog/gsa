import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, useApi, useAuth, fdate } from '../lib'
import { Card, PageHeader, Btn, Loading, Badge, FormModal, Empty } from '../components/ui'

const KINDS = [{ value: 'query', label: 'Query' }, { value: 'suggestion', label: 'Suggestion' }, { value: 'report', label: 'Report a problem' }, { value: 'help', label: 'Help' }]

export default function Help() {
  const { me } = useAuth()
  const { data, loading, reload } = useApi<any>('/api/queries')
  const [open, setOpen] = useState(false)
  const [replying, setReplying] = useState<any>(null)
  return (
    <>
      <PageHeader title="Help & feedback" sub={me?.role === 'owner' ? 'Queries, suggestions and reports from staff and families' : 'Ask a question, share a suggestion or report a problem'}
        action={<Btn onClick={() => setOpen(true)}>New message</Btn>} />
      <Card className="mb-4"><div className="text-sm text-slate-600">Account: <b>{me?.name}</b> · <Link to="/app/password" className="text-sky hover:underline">Change password</Link></div></Card>
      {loading ? <Loading /> : !data.queries.length ? <Card><Empty text="No messages yet" /></Card> : (
        <div className="space-y-3">
          {data.queries.map((q: any) => (
            <Card key={q.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2"><Badge tone="stored">{q.kind}</Badge><b>{q.subject}</b></div>
                <div className="flex items-center gap-2 text-xs text-mute">{q.from_name && `${q.from_name} (${q.from_role}) · `}{fdate(q.created_at)}<Badge>{q.status}</Badge></div>
              </div>
              <p className="mt-2 text-sm text-slate-600">{q.message}</p>
              {q.reply && <p className="mt-3 rounded-xl bg-soft p-3 text-sm"><span className="text-xs text-brand">Academy reply</span><br />{q.reply}</p>}
              {me?.role === 'owner' && <div className="mt-3"><Btn variant="ghost" className="py-1 text-xs" onClick={() => setReplying(q)}>Reply / close</Btn></div>}
            </Card>
          ))}
        </div>
      )}
      {open && <FormModal title="New message" submitLabel="Send" onClose={() => setOpen(false)} onSubmit={async (v) => { await api('/api/queries', { body: v }); reload() }}
        fields={[{ name: 'kind', label: 'Type', type: 'select', required: true, options: KINDS, defaultValue: 'query' }, { name: 'subject', label: 'Subject', required: true }, { name: 'message', label: 'Message', type: 'textarea', required: true }]} />}
      {replying && <FormModal title="Reply" submitLabel="Send reply" onClose={() => setReplying(null)} onSubmit={async (v) => { await api(`/api/queries/${replying.id}`, { method: 'PATCH', body: v }); reload() }}
        fields={[{ name: 'reply', label: 'Reply', type: 'textarea' }, { name: 'status', label: 'Status', type: 'select', options: [{ value: 'open', label: 'Open' }, { value: 'closed', label: 'Closed' }], defaultValue: 'closed' }]} />}
    </>
  )
}
