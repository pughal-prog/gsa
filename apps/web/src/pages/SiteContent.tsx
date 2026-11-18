import { useState } from 'react'
import { Upload, Trash2 } from 'lucide-react'
import { API, api, getToken, useApi, cx } from '../lib'
import { Card, PageHeader, Loading, ErrorMsg, Empty } from '../components/ui'

const STATUS_NEXT: Record<string, string> = { new: 'contacted', contacted: 'joined' }

export default function SiteContent() {
  return (
    <>
      <PageHeader title="Gallery" sub="Photos shown on the public home page, grouped by sport." />
      <Gallery />
    </>
  )
}

function Gallery() {
  const { data, loading, error, reload } = useApi<any>('/api/site/gallery')
  const sports = useApi<any>('/api/sports').data?.sports ?? []
  const [sport, setSport] = useState('')
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true); setErr('')
    for (const file of Array.from(files)) {
      const fd = new FormData(); fd.append('file', file); fd.append('sport_id', sport); fd.append('caption', caption)
      const r = await fetch(`${API}/api/site/gallery`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: fd })
      if (!r.ok) { setErr((await r.json().catch(() => ({}))).error || 'Upload failed'); break }
    }
    setBusy(false); reload()
  }
  if (loading) return <Loading />
  if (error) return <ErrorMsg text={error} />
  return (
    <>
      <Card className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm"><span className="mb-1 block text-xs text-mute">Sport</span>
          <select value={sport} onChange={(e) => setSport(e.target.value)} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"><option value="">General</option>{sports.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="min-w-48 flex-1 text-sm"><span className="mb-1 block text-xs text-mute">Caption (optional)</span>
          <input value={caption} onChange={(e) => setCaption(e.target.value)} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm" /></label>
        <label className={cx('inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white', busy && 'opacity-50')}>
          <Upload size={16} /> {busy ? 'Uploading...' : 'Upload photos'}<input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => upload(e.target.files)} /></label>
        {err && <ErrorMsg text={err} />}
      </Card>
      {!data.photos.length ? <Card><Empty text="No photos yet. Upload JPEG, PNG or WebP images, max 5 MB each. They appear on the home page under the chosen sport." /></Card> : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {data.photos.map((p: any) => (
            <div key={p.id} className="overflow-hidden rounded-lg border border-line bg-surface">
              <img src={`${API}/public/gallery/file/${encodeURIComponent(p.key)}`} alt={p.caption || ''} className="aspect-[4/3] w-full object-cover" />
              <div className="flex items-center justify-between gap-2 p-2 text-xs"><span className="truncate text-mute">{p.sport ?? 'General'}{p.caption ? ` · ${p.caption}` : ''}</span>
                <button aria-label="Delete photo" onClick={async () => { if (confirm('Delete this photo?')) { await api(`/api/site/gallery/${p.id}`, { method: 'DELETE' }); reload() } }} className="rounded p-1 text-mute hover:bg-danger/10 hover:text-danger"><Trash2 size={14} /></button></div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
