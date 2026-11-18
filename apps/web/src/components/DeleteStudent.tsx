import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { api } from '../lib'
import { Modal, Btn, ErrorMsg } from './ui'

/** Owner-only confirmation. The admission number must be typed to enable the button. */
export function DeleteStudent({ s, onClose, onDone }: { s: { id: number; name: string; admission_no: string }; onClose: () => void; onDone?: () => void }) {
  const nav = useNavigate()
  const [typed, setTyped] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true); setErr('')
    try { await api(`/api/students/${s.id}`, { method: 'DELETE' }); onClose(); if (onDone) onDone(); else nav('/app/students', { replace: true }) }
    catch (e: any) { setErr(e.message); setBusy(false) }
  }
  return (
    <Modal title="Delete student" onClose={onClose}>
      <p className="text-sm text-slate-600">You are about to permanently delete <b>{s.name}</b> ({s.admission_no}), along with their login, attendance, fees, photos and notifications. This cannot be undone.</p>
      <label className="mt-4 block text-sm"><span className="mb-1 block text-xs text-mute">Type <b>{s.admission_no}</b> to confirm</span>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-danger" /></label>
      {err && <div className="mt-3"><ErrorMsg text={err} /></div>}
      <div className="mt-5 flex justify-end gap-2">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="danger" disabled={typed.trim().toLowerCase() !== s.admission_no.toLowerCase() || busy} onClick={go}><Trash2 size={16} /> {busy ? 'Deleting...' : 'Delete permanently'}</Btn>
      </div>
    </Modal>
  )
}
