import { useState } from 'react'
import { Plus, PackagePlus, Layers } from 'lucide-react'
import { api, useApi, useAuth, inr, fdate } from '../lib'
import { Card, PageHeader, Table, Btn, Loading, ErrorMsg, Badge, FormModal, Tabs, Stat } from '../components/ui'
import { ExportButtons } from '../components/Export'

export default function Stock() {
  const { me } = useAuth()
  const owner = me?.role === 'owner'
  const [tab, setTab] = useState('Stock')
  const eq = useApi<any>('/api/equipment')
  const tx = useApi<any>(owner ? '/api/equipment/txns' : null)
  const sportsApi = useApi<any>('/api/sports')
  const sports = sportsApi.data?.sports ?? []
  const students = useApi<any>(owner ? '/api/students' : null).data?.students ?? []
  const [sportTab, setSportTab] = useState('All')
  const [modal, setModal] = useState<'new' | 'section' | { item: any; mode: 'stock' | 'record' | 'edit' } | null>(null)
  if (eq.loading) return <Loading />
  if (eq.error) return <ErrorMsg text={eq.error} />
  const items: any[] = eq.data.equipment
  const value = items.reduce((a, e) => a + e.qty * e.cost_price, 0)
  const groups = [...new Set([...sports.map((s: any) => s.name), ...items.map((e) => e.sport || 'General')])].filter((g) => items.some((e) => (e.sport || 'General') === g) || owner)
  const low = items.filter((e) => e.qty <= e.reorder_level)
  const sportOpts = sports.map((s: any) => ({ value: s.id, label: s.name }))
  const done = () => { eq.reload(); tx.reload() }
  return (
    <>
      <PageHeader title="Equipment shop" sub="Stock by section, purchases, sales and damages"
        action={<div className="flex flex-wrap gap-2">
          <ExportButtons title="Equipment stock" head={['Section', 'Category', 'Item', 'In stock', 'Reorder at']} rows={items.map((e) => [e.sport || 'General', e.category || '-', e.name, e.qty, e.reorder_level])} filename="equipment" />
          {owner && <><Btn variant="ghost" onClick={() => setModal('section')}><Layers size={16} /> New section</Btn><Btn onClick={() => setModal('new')}><Plus size={16} /> New item</Btn></>}
        </div>} />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Stat label="Items" value={items.length} /><Stat label="Stock value (at cost)" value={inr(value)} /><Stat label="Needs reorder" value={low.length} tone={low.length ? 'warn' : 'good'} hint={low.map((l) => l.name).slice(0, 2).join(', ')} />
      </div>
      {owner && <Tabs tabs={['Stock', 'Transactions']} value={tab} onChange={setTab} />}
      <Card>
        {tab === 'Stock' ? (
          <div>
            <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Section">
              {['All', ...groups].map((g) => <button key={g} role="tab" aria-selected={sportTab === g} onClick={() => setSportTab(g)} className={`rounded-md border px-4 py-1.5 text-sm font-semibold ${sportTab === g ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-slate-700 hover:bg-soft'}`}>{g}</button>)}
            </div>
            {groups.filter((g) => sportTab === 'All' || g === sportTab).map((g) => (
              <section key={g} className="mb-6 last:mb-0">
                <h3 className="label mb-2 text-mute">{g}</h3>
                <Table rows={items.filter((e) => (e.sport || 'General') === g)} empty="No items in this section yet" cols={[
                  { head: 'Item', cell: (e: any) => <b>{e.name}</b> }, { head: 'Category', cell: (e: any) => e.category || '-' },
                  { head: 'In stock', cell: (e: any) => <span className={e.qty <= e.reorder_level ? 'text-warn' : ''}>{e.qty}{e.qty <= e.reorder_level && ' (low)'}</span> },
                  ...(owner ? [{ head: 'Cost', cell: (e: any) => inr(e.cost_price) }, { head: 'Sale price', cell: (e: any) => inr(e.sale_price) },
                    { head: '', cell: (e: any) => <div className="flex flex-wrap gap-1">
                      <Btn variant="ghost" className="py-1 text-xs" onClick={() => setModal({ item: e, mode: 'stock' })}><PackagePlus size={13} /> Add stock</Btn>
                      <Btn variant="ghost" className="py-1 text-xs" onClick={() => setModal({ item: e, mode: 'record' })}>Sell / issue</Btn>
                      <Btn variant="ghost" className="py-1 text-xs" onClick={() => setModal({ item: e, mode: 'edit' })}>Edit</Btn>
                      <Btn variant="danger" className="py-1 text-xs" onClick={async () => { if (confirm(`Delete ${e.name} and its history?`)) { await api(`/api/equipment/${e.id}`, { method: 'DELETE' }); done() } }}>Delete</Btn></div> }] : []),
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
      {modal === 'section' && <FormModal title="New equipment section" submitLabel="Create" onClose={() => setModal(null)} onSubmit={async (v) => { await api('/api/sports', { body: v }); sportsApi.reload() }}
        fields={[{ name: 'name', label: 'Section name (e.g. Badminton, Skating)', required: true, span: 2 }]} />}
      {modal === 'new' && <FormModal title="New equipment item" onClose={() => setModal(null)} onSubmit={async (v) => { await api('/api/equipment', { body: v }); done() }}
        fields={[{ name: 'name', label: 'Name', required: true, span: 2 }, { name: 'sport_id', label: 'Section / sport', type: 'select', options: sportOpts }, { name: 'category', label: 'Category (e.g. Rackets, Balls, Wear)' }, { name: 'qty', label: 'Opening quantity', type: 'number', defaultValue: 0 },
          { name: 'reorder_level', label: 'Reorder level', type: 'number', defaultValue: 2 }, { name: 'cost_price', label: 'Cost price', type: 'number' }, { name: 'sale_price', label: 'Sale price', type: 'number' }]} />}
      {modal && typeof modal === 'object' && modal.mode === 'edit' && <FormModal title={`Edit: ${modal.item.name}`} initial={modal.item} onClose={() => setModal(null)} onSubmit={async (v) => { await api(`/api/equipment/${modal.item.id}`, { method: 'PATCH', body: v }); done() }}
        fields={[{ name: 'name', label: 'Name', required: true, span: 2 }, { name: 'sport_id', label: 'Section / sport', type: 'select', options: sportOpts }, { name: 'category', label: 'Category' }, { name: 'reorder_level', label: 'Reorder level', type: 'number' }, { name: 'cost_price', label: 'Cost price', type: 'number' }, { name: 'sale_price', label: 'Sale price', type: 'number' }]} />}
      {modal && typeof modal === 'object' && modal.mode === 'stock' && <FormModal title={`Add stock: ${modal.item.name}`} submitLabel="Add" onClose={() => setModal(null)} onSubmit={async (v) => { await api(`/api/equipment/${modal.item.id}/txn`, { body: { ...v, type: 'purchase' } }); done() }}
        fields={[{ name: 'qty', label: 'Quantity received', type: 'number', required: true, defaultValue: 1 }, { name: 'amount', label: 'Total cost (blank = from cost price)', type: 'number' }, { name: 'party', label: 'Supplier' }, { name: 'txn_date', label: 'Date', type: 'date' }]} />}
      {modal && typeof modal === 'object' && modal.mode === 'record' && <FormModal title={`Record: ${modal.item.name}`} onClose={() => setModal(null)} onSubmit={async (v) => { await api(`/api/equipment/${modal.item.id}/txn`, { body: v }); done() }}
        fields={[{ name: 'type', label: 'Type', type: 'select', required: true, options: [{ value: 'sale', label: 'Sale to student / other' }, { value: 'issue', label: 'Issue to student' }, { value: 'return', label: 'Return' }, { value: 'damage', label: 'Damaged / lost' }] },
          { name: 'qty', label: 'Quantity', type: 'number', required: true, defaultValue: 1 }, { name: 'student_id', label: 'Student (if any)', type: 'select', options: students.map((s: any) => ({ value: s.id, label: s.name })) },
          { name: 'party', label: 'Buyer name' }, { name: 'amount', label: 'Amount (blank = auto from price)', type: 'number' }, { name: 'txn_date', label: 'Date', type: 'date' }, { name: 'note', label: 'Note', type: 'textarea' }]} />}
    </>
  )
}
