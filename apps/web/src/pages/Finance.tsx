import { useState } from 'react'
import { Plus } from 'lucide-react'
import { api, useApi, inr, fdate } from '../lib'
import { Card, PageHeader, Table, Btn, Loading, ErrorMsg, Badge, FormModal, Tabs, Stat } from '../components/ui'

const TYPES = [['student_fee', 'Student fee'], ['entry_fee', 'Annual / entry fee'], ['cash_prize', 'Cash prize'], ['equipment_sale', 'Equipment sale'], ['other', 'Other']]
const label = Object.fromEntries(TYPES)

export default function Finance() {
  const [tab, setTab] = useState('Income')
  const inc = useApi<any>('/api/finance/incomes')
  const exp = useApi<any>('/api/finance/expenses')
  const [adding, setAdding] = useState(false)
  if (inc.loading || exp.loading) return <Loading />
  if (inc.error || exp.error) return <ErrorMsg text={inc.error || exp.error} />
  const incomes: any[] = inc.data.incomes, expenses: any[] = exp.data.expenses
  const received = incomes.filter((i) => i.status === 'received').reduce((a, i) => a + i.amount, 0)
  const pending = incomes.filter((i) => i.status === 'pending').reduce((a, i) => a + i.amount, 0)
  const spent = expenses.reduce((a, e) => a + e.amount, 0)
  return (
    <>
      <PageHeader title="Finance" sub="Income, pending amounts and expenses" action={<Btn onClick={() => setAdding(true)}><Plus size={16} /> Add {tab === 'Income' ? 'income' : 'expense'}</Btn>} />
      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <Stat label="Received" value={inr(received)} tone="good" /><Stat label="Pending income" value={inr(pending)} tone="warn" />
        <Stat label="Expenses" value={inr(spent)} /><Stat label="Net" value={inr(received - spent)} tone={received - spent >= 0 ? 'good' : 'bad'} />
      </div>
      <Tabs tabs={['Income', 'Expenses']} value={tab} onChange={setTab} />
      <Card>
        {tab === 'Income' ? (
          <Table rows={incomes} cols={[{ head: 'Date', cell: (i: any) => fdate(i.income_date) }, { head: 'Source', cell: (i: any) => label[i.type] }, { head: 'Student', cell: (i: any) => i.student || '-' },
            { head: 'Note', cell: (i: any) => i.note || '-' }, { head: 'Amount', cell: (i: any) => <b>{inr(i.amount)}</b> }, { head: 'Status', cell: (i: any) => <Badge>{i.status}</Badge> }]} />
        ) : (
          <Table rows={expenses} cols={[{ head: 'Date', cell: (e: any) => fdate(e.expense_date) }, { head: 'Category', cell: (e: any) => e.category }, { head: 'Note', cell: (e: any) => e.note || '-' }, { head: 'Amount', cell: (e: any) => <b>{inr(e.amount)}</b> }]} />
        )}
      </Card>
      {adding && tab === 'Income' && <FormModal title="Add income" onClose={() => setAdding(false)} onSubmit={async (v) => { await api('/api/finance/incomes', { body: v }); inc.reload() }}
        fields={[{ name: 'type', label: 'Source', type: 'select', required: true, options: TYPES.map(([value, label]) => ({ value, label })) }, { name: 'amount', label: 'Amount (Rs)', type: 'number', required: true },
          { name: 'income_date', label: 'Date', type: 'date' }, { name: 'status', label: 'Status', type: 'select', options: [{ value: 'received', label: 'Received' }, { value: 'pending', label: 'Pending' }], defaultValue: 'received' }, { name: 'note', label: 'Note', type: 'textarea' }]} />}
      {adding && tab === 'Expenses' && <FormModal title="Add expense" onClose={() => setAdding(false)} onSubmit={async (v) => { await api('/api/finance/expenses', { body: v }); exp.reload() }}
        fields={[{ name: 'category', label: 'Category', required: true }, { name: 'amount', label: 'Amount (Rs)', type: 'number', required: true }, { name: 'expense_date', label: 'Date', type: 'date' }, { name: 'note', label: 'Note', type: 'textarea' }]} />}
    </>
  )
}
