import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, Maximize2, VideoOff } from 'lucide-react'
import Hls from 'hls.js'
import { api, useApi } from '../lib'
import { Card, PageHeader, Btn, Loading, ErrorMsg, Empty, FormModal } from '../components/ui'

function Feed({ cam }: { cam: any }) {
  const v = useRef<HTMLVideoElement>(null)
  const [err, setErr] = useState(false)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    setErr(false)
    if (cam.stream_type === 'image') { const t = setInterval(() => setTick((x) => x + 1), 3000); return () => clearInterval(t) }
    if (cam.stream_type !== 'hls' || !v.current) return
    const el = v.current
    if (el.canPlayType('application/vnd.apple.mpegurl')) { el.src = cam.stream_url; el.play().catch(() => {}); return }
    if (!Hls.isSupported()) { setErr(true); return }
    const h = new Hls({ lowLatencyMode: true })
    h.loadSource(cam.stream_url); h.attachMedia(el)
    h.on(Hls.Events.MANIFEST_PARSED, () => el.play().catch(() => {}))
    h.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) setErr(true) })
    return () => h.destroy()
  }, [cam.stream_url, cam.stream_type])
  if (err) return <div className="grid h-full place-items-center text-sm text-slate-300"><div className="text-center"><VideoOff className="mx-auto mb-2" />Camera offline or link blocked</div></div>
  if (cam.stream_type === 'embed') return <iframe src={cam.stream_url} title={cam.name} allow="autoplay; fullscreen" className="h-full w-full border-0" />
  if (cam.stream_type === 'mjpeg') return <img src={cam.stream_url} alt={cam.name} onError={() => setErr(true)} className="h-full w-full object-contain" />
  if (cam.stream_type === 'image') return <img src={`${cam.stream_url}${cam.stream_url.includes('?') ? '&' : '?'}t=${tick}`} alt={cam.name} onError={() => setErr(true)} className="h-full w-full object-contain" />
  return <video ref={v} muted playsInline controls className="h-full w-full object-contain" />
}

export default function Cameras() {
  const { data, loading, error, reload } = useApi<any>('/api/cameras')
  const [modal, setModal] = useState(false)
  const [big, setBig] = useState<any>(null)
  if (loading) return <Loading />
  if (error) return <ErrorMsg text={error} />
  const cams: any[] = data.cameras.filter((c: any) => c.active)
  return (
    <>
      <PageHeader title="CCTV" sub="Live view of the academy. Visible to the owner only." action={<Btn onClick={() => setModal(true)}><Plus size={16} /> Add camera</Btn>} />
      {!cams.length ? <Card><Empty text="No cameras yet. Add the live stream link from your CCTV recorder (HLS .m3u8, MJPEG or snapshot URL)." /></Card> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cams.map((c) => (
            <div key={c.id} className="overflow-hidden rounded-lg border border-line bg-surface shadow-card">
              <div className="aspect-video bg-slate-900"><Feed cam={c} /></div>
              <div className="flex items-center justify-between p-3 text-sm">
                <div><b>{c.name}</b><div className="text-xs text-mute">{c.location || c.stream_type.toUpperCase()}</div></div>
                <div className="flex gap-1">
                  <button aria-label="Full screen" onClick={() => setBig(c)} className="rounded-lg p-2 hover:bg-soft"><Maximize2 size={16} /></button>
                  <button aria-label="Remove camera" onClick={async () => { if (confirm(`Remove ${c.name}?`)) { await api(`/api/cameras/${c.id}`, { method: 'DELETE' }); reload() } }} className="rounded-lg p-2 text-danger hover:bg-soft"><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-mute">Links must be https. Browsers block plain http streams on a secure site, so expose the camera through an https relay such as your recorder's cloud link, a Cloudflare Tunnel or go2rtc.</p>
      {big && <div className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-4" onClick={() => setBig(null)}><div className="aspect-video w-full max-w-5xl" onClick={(e) => e.stopPropagation()}><Feed cam={big} /></div></div>}
      {modal && <FormModal title="Add camera" onClose={() => setModal(false)} onSubmit={async (v) => { await api('/api/cameras', { body: v }); reload() }}
        fields={[{ name: 'name', label: 'Camera name', required: true }, { name: 'location', label: 'Location (e.g. Fencing hall)' },
          { name: 'stream_type', label: 'Stream type', type: 'select', required: true, defaultValue: 'hls', options: [{ value: 'hls', label: 'HLS (.m3u8)' }, { value: 'mjpeg', label: 'MJPEG' }, { value: 'image', label: 'Snapshot image (refreshes)' }, { value: 'embed', label: 'Embed page' }] },
          { name: 'stream_url', label: 'Stream link (https://...)', required: true, span: 2 }]} />}
    </>
  )
}
