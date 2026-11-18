import { useEffect, useState } from 'react'
import { Bell as BellIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api, useAuth, can } from '../lib'

/** Bell with an unread badge. Polls every 30s, also fires a browser notification once permission is granted. */
export default function Bell({ className = '' }: { className?: string }) {
  const { me } = useAuth()
  const nav = useNavigate()
  const [n, setN] = useState(0)
  const allowed = !!me && (me.role !== 'staff' || can(me, 'students.viewAll'))
  useEffect(() => {
    if (!allowed) return
    let last = 0, live = true
    const poll = async () => {
      try {
        const r = await api<any>('/api/notifications/unread')
        if (!live) return
        setN(r.unread)
        if (r.latest && r.latest.id !== last) {
          if (last && 'Notification' in window && Notification.permission === 'granted') new Notification(r.latest.title, { body: r.latest.body, icon: '/logo.png', badge: '/logo.png' })
          last = r.latest.id
        }
      } catch { /* offline */ }
    }
    poll(); const t = setInterval(poll, 30000)
    window.addEventListener('gsa-seen', poll)
    return () => { live = false; clearInterval(t); window.removeEventListener('gsa-seen', poll) }
  }, [allowed])
  if (!allowed) return null
  const click = async () => {
    if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission()
    nav('/app/notifications')
  }
  return (
    <button onClick={click} aria-label={n ? `${n} unread notifications` : 'Notifications'} className={`relative rounded-md p-2 text-slate-400 hover:bg-white/10 hover:text-white lg:text-slate-400 ${className}`}>
      <BellIcon size={20} />
      {n > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-flame px-1 text-[10px] font-bold leading-[18px] text-white">{n > 99 ? '99+' : n}</span>}
    </button>
  )
}
