import { useEffect, useState } from 'react'
import { Megaphone, FileDown } from 'lucide-react'
import { exportPdf } from '../pdf'
import { api, useApi, useAuth, fdate } from '../lib'
import { Card, PageHeader, Table, Btn, Loading, ErrorMsg, Badge, FormModal, Empty } from '../components/ui'

export default function Notifications() {
  const { me } = useAuth()
  const { data, loading, error, reload } = useApi<any>('/api/notifications')
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState('')
  useEffect(() => { if (data) api('/api/notifications/seen', { method: 'POST', body: {} }).then(() => window.dispatchEvent(new Event('gsa-seen'))).catch(() => {}) }, [data])
  if (loading) return <Loading />
  if (error) return <ErrorMsg text={error} />
  const rows: any[] = data.notifications
  return (
    <>
      <PageHeader title="Notifications" sub={me?.role === 'student' ? 'Alerts sent to your parent / guardian' : 'Everything sent to parents: check-ins, late, absence, fees'}
        action={<div className="flex gap-2"><Btn variant="ghost" onClick={() => exportPdf({ title: 'Notifications', head: ['When', 'Student', 'Message'], rows: rows.map((n) => [fdate(n.created_at), n.student || 'All', `${n.title}: ${n.body}`]), filename: 'notifications.pdf' })}><FileDown size={16} /> PDF</Btn>{me?.role === 'owner' && <Btn onClick={() => setOpen(true)}><Megaphone size={16} /> Announce</Btn>}</div>} />
      {sent && <div className="mb-4 rounded-md bg-brand/10 p-3 text-sm text-brand">{sent}</div>}
      <Card>
        {me?.role === 'student' ? (
          rows.length ? rows.map((n) => <div key={n.id} className="border-b border-line/60 py-3 last:border-0"><div className="flex justify-between"><b className="text-sm">{n.title}</b><span className="text-xs text-mute">{fdate(n.created_at)}</span></div><div className="text-sm text-slate-600">{n.body}</div></div>) : <Empty text="No notifications yet" />
        ) : (
          <Table rows={rows} cols={[{ head: 'When', cell: (n: any) => fdate(n.created_at) }, { head: 'Student', cell: (n: any) => n.student || 'All' }, { head: 'Type', cell: (n: any) => <Badge tone="stored">{n.type}</Badge> },
            { head: 'Message', cell: (n: any) => <div><b>{n.title}</b><div className="text-xs text-mute">{n.body}</div></div> }, { head: 'Delivery', cell: (n: any) => <Badge>{n.status}</Badge> }]} />
        )}
      </Card>
      {me?.role === 'owner' && <p className="mt-3 text-xs text-mute">Delivery "stored" means the message is saved but WhatsApp is not connected yet. Add the WhatsApp credentials to start real delivery.</p>}
      {open && <FormModal title="Announcement to all parents" submitLabel="Send" onClose={() => setOpen(false)} onSubmit={async (v) => { const r = await api('/api/notifications/broadcast', { body: v }); setSent(`Sent to ${r.sent} parents`); reload() }}
        fields={[{ name: 'title', label: 'Title', required: true, span: 2 }, { name: 'body', label: 'Message', type: 'textarea', required: true }]} />}
    </>
  )
}
