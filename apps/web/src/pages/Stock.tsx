import { useState } from 'react'
import { Plus, FileDown } from 'lucide-react'
import { exportPdf } from '../pdf'
import { api, useApi, useAuth, inr, fdate } from '../lib'
import { Card, PageHeader, Table, Btn, Loading, ErrorMsg, Badge, FormModal, Tabs, Stat } from '../components/ui'

export default function Stock() {
  const { me } = useAuth()
  const owner = me?.role === 'owner'
  const [tab, setTab] = useState('Stock')
  const eq = useApi<any>('/api/equipment')
  const tx = useApi<any>(owner ? '/api/equipment/txns' : null)
  const sports = useApi<any>('/api/sports').data?.sports ?? []
  const students = useApi<any>(owner ? '/api/students' : null).data?.students ?? []
  const [sportTab, setSportTab] = useState('All')
  const [modal, setModal] = useState<'new' | { item: any } | null>(null)
  if (eq.loading) return <Loading />
  if (eq.error) return <ErrorMsg text={eq.error} />
  const items: any[] = eq.data.equipment
  const value = items.reduce((a, e) => a + e.qty * e.cost_price, 0)
  const groups = [...new Set(items.map((e) => e.sport || 'General'))]
  const low = items.filter((e) => e.qty <= e.reorder_level)
  return (
    <>
      <PageHeader title="Equipment & stock" sub="Inventory, purchases, sales and damages"
        action={<div className="flex gap-2"><Btn variant="ghost" onClick={() => exportPdf({ title: 'Equipment stock', head: ['Sport', 'Item', 'In stock', 'Reorder at'], rows: items.map((e) => [e.sport || 'General', e.name, e.qty, e.reorder_level]), filename: 'equipment.pdf' })}><FileDown size={16} /> PDF</Btn>{owner && <Btn onClick={() => setModal('new')}><Plus size={16} /> New item</Btn>}</div>} />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Stat label="Items" value={items.length} /><Stat label="Stock value (at cost)" value={inr(value)} /><Stat label="Needs reorder" value={low.length} tone={low.length ? 'warn' : 'good'} hint={low.map((l) => l.name).slice(0, 2).join(', ')} />
      </div>
      {owner && <Tabs tabs={['Stock', 'Transactions']} value={tab} onChange={setTab} />}
      <Card>
        {tab === 'Stock' ? (
          <div>
            <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Sport">
              {['All', ...groups].map((g) => <button key={g} role="tab" aria-selected={sportTab === g} onClick={() => setSportTab(g)} className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${sportTab === g ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-slate-700 hover:bg-soft'}`}>{g}</button>)}
            </div>
            {groups.filter((g) => sportTab === 'All' || g === sportTab).map((g) => (
              <section key={g} className="mb-6 last:mb-0">
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-mute">{g}</h3>
                <Table rows={items.filter((e) => (e.sport || 'General') === g)} cols={[
                  { head: 'Item', cell: (e: any) => <b>{e.name}</b> },
                  { head: 'In stock', cell: (e: any) => <span className={e.qty <= e.reorder_level ? 'text-warn' : ''}>{e.qty}{e.qty <= e.reorder_level && ' (low)'}</span> },
                  ...(owner ? [{ head: 'Cost', cell: (e: any) => inr(e.cost_price) }, { head: 'Sale price', cell: (e: any) => inr(e.sale_price) }, { head: '', cell: (e: any) => <Btn variant="ghost" className="py-1 text-xs" onClick={() => setModal({ item: e })}>Record</Btn> }] : []),
                ]} />
              </section>
            ))}
          </div>
        ) : (
          <Table rows={tx.data?.txns ?? []} cols={[{ head: 'Date', cell: (t: any) => fdate(t.txn_date) }, { head: 'Item', cell: (t: any) => t.equipment },
            { head: 'Type', cell: (t: any) => <Badge tone={t.type === 'damage' ? 'absent' : t.type === 'sale' ? 'paid' : 'stored'}>{t.type}</Badge> }, { head: 'Qty', cell: (t: any) => t.qty },
            { head: 'Student / party', cell: (t: any) => t.student || t.party || '-' }, { head: 'Amount', cell: (t: any) => (t.amount ? inr(t.amount) : '-') }, { head: 'Note', cell: (t: any) => t.note || '-' }]} />
        )}
      </Card>
      {modal === 'new' && <FormModal title="New equipment item" onClose={() => setModal(null)} onSubmit={async (v) => { await api('/api/equipment', { body: v }); eq.reload() }}
        fields={[{ name: 'name', label: 'Name', required: true, span: 2 }, { name: 'sport_id', label: 'Sport', type: 'select', options: sports.map((s: any) => ({ value: s.id, label: s.name })) }, { name: 'qty', label: 'Opening quantity', type: 'number', defaultValue: 0 },
          { name: 'reorder_level', label: 'Reorder level', type: 'number', defaultValue: 2 }, { name: 'cost_price', label: 'Cost price', type: 'number' }, { name: 'sale_price', label: 'Sale price', type: 'number' }]} />}
      {modal && modal !== 'new' && <FormModal title={`Record: ${modal.item.name}`} onClose={() => setModal(null)} onSubmit={async (v) => { await api(`/api/equipment/${modal.item.id}/txn`, { body: v }); eq.reload(); tx.reload() }}
        fields={[{ name: 'type', label: 'Type', type: 'select', required: true, options: [{ value: 'purchase', label: 'Purchase (stock in)' }, { value: 'sale', label: 'Sale to student / other' }, { value: 'issue', label: 'Issue to student' }, { value: 'return', label: 'Return' }, { value: 'damage', label: 'Damaged / lost' }] },
          { name: 'qty', label: 'Quantity', type: 'number', required: true, defaultValue: 1 }, { name: 'student_id', label: 'Student (if any)', type: 'select', options: students.map((s: any) => ({ value: s.id, label: s.name })) },
          { name: 'party', label: 'Supplier / buyer name' }, { name: 'amount', label: 'Amount (blank = auto from price)', type: 'number' }, { name: 'txn_date', label: 'Date', type: 'date' }, { name: 'note', label: 'Note', type: 'textarea' }]} />}
    </>
  )
}
