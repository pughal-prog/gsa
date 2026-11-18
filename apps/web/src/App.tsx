import { useState, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { LayoutDashboard, Users, UserCog, Wallet, Receipt, Boxes, CalendarCheck, Bell, LifeBuoy, LogOut, Menu, X, IdCard, UserCheck, KeyRound, Images } from 'lucide-react'
import { useAuth, useApi, can, cx, Role } from './lib'
import { Logo, Loading } from './components/ui'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Privacy from './pages/Privacy'
const Overview = lazy(() => import('./pages/Overview'))
import Students from './pages/Students'
import StudentDetail, { MyPassport } from './pages/StudentDetail'
import Staff, { StaffDetail, MyStaffHome } from './pages/Staff'
import Fees from './pages/Fees'
import Finance from './pages/Finance'
import Stock from './pages/Stock'
import Attendance from './pages/Attendance'
import Notifications from './pages/Notifications'
import Help from './pages/Help'
import ChangePassword from './pages/ChangePassword'
import Approvals from './pages/Approvals'
import SiteContent from './pages/SiteContent'
import NotifBell from './components/Bell'

type Item = { to: string; label: string; icon: any; show: (me: any) => boolean }
const NAV: Item[] = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, show: (m) => m.role === 'owner' },
  { to: '/app/me', label: 'My dashboard', icon: LayoutDashboard, show: (m) => m.role === 'staff' },
  { to: '/app/passport', label: 'My passport', icon: IdCard, show: (m) => m.role === 'student' },
  { to: '/app/students', label: 'Students', icon: Users, show: (m) => can(m, 'students.view') },
  { to: '/app/approvals', label: 'Approvals', icon: UserCheck, show: (m) => m.role === 'owner' },
  { to: '/app/website', label: 'Gallery', icon: Images, show: (m) => m.role === 'owner' },
  { to: '/app/staff', label: 'Staff', icon: UserCog, show: (m) => m.role === 'owner' },
  { to: '/app/fees', label: 'Fees', icon: Receipt, show: (m) => m.role === 'student' || can(m, 'fees.view') },
  { to: '/app/finance', label: 'Finance', icon: Wallet, show: (m) => m.role === 'owner' },
  { to: '/app/stock', label: 'Equipment', icon: Boxes, show: (m) => can(m, 'equipment.view') },
  { to: '/app/attendance', label: 'Attendance', icon: CalendarCheck, show: (m) => can(m, 'attendance.mark') },
  { to: '/app/notifications', label: 'Notifications', icon: Bell, show: (m) => m.role !== 'staff' || can(m, 'students.viewAll') },
  { to: '/app/help', label: 'Help & feedback', icon: LifeBuoy, show: () => true },
]

function Shell() {
  const { me, loading, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const pending = useApi<any>(me?.role === 'owner' ? '/api/signups' : null, [loc.pathname])
  if (loading) return <Loading />
  if (!me) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  if (me.mustChange && loc.pathname !== '/app/password') return <Navigate to="/app/password" replace />
  const items = NAV.filter((n) => n.show(me))
  const home = me.role === 'owner' ? '/app' : me.role === 'staff' ? '/app/me' : '/app/passport'
  const count = pending.data?.signups?.length ?? 0
  const nav = (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {items.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.to === '/app'} onClick={() => setOpen(false)}
          className={({ isActive }) => cx('flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition', isActive ? 'bg-white/10 text-white shadow-[inset_3px_0_0_var(--color-flame)]' : 'text-slate-400 hover:bg-white/5 hover:text-white')}>
          <n.icon size={18} /> <span className="flex-1">{n.label}</span>
          {n.to === '/app/approvals' && count > 0 && <span className="rounded-full bg-flame px-2 py-0.5 text-xs font-semibold text-white">{count}</span>}
        </NavLink>
      ))}
    </nav>
  )
  const userBox = (
    <div className="border-t border-white/10 pt-4">
      <div className="flex items-center gap-3 px-2 pb-3">
        <div className="grid h-9 w-9 place-items-center rounded-md bg-flame text-sm font-bold text-white">{me.name.slice(0, 1)}</div>
        <div className="min-w-0"><div className="truncate text-sm font-semibold text-white">{me.name}</div><div className="text-xs capitalize text-slate-400">{me.role}</div></div>
      </div>
      <NavLink to="/app/password" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white"><KeyRound size={18} /> Password</NavLink>
      <button onClick={logout} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white"><LogOut size={18} /> Sign out</button>
    </div>
  )
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col overflow-y-auto bg-ink p-4 lg:flex">
        <NavLink to={home} className="mb-5 block rounded-lg bg-white p-2"><Logo small className="mx-auto !h-20" /></NavLink>
        {nav}
        <div className="mt-auto"><div className="mb-2 flex justify-end"><NotifBell /></div>{userBox}</div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur lg:hidden">
          <div className="stripe h-1" />
          <div className="flex items-center justify-between px-4 py-2">
            <NavLink to={home}><Logo small className="!h-14" /></NavLink>
            <div className="flex items-center gap-1"><NotifBell /><button onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open} className="rounded-lg p-2 hover:bg-soft">{open ? <X /> : <Menu />}</button></div>
          </div>
        </header>
        {open && (
          <div className="fixed inset-x-0 top-[76px] z-30 max-h-[80vh] overflow-y-auto border-b border-line bg-surface p-4 shadow-xl lg:hidden">{nav}<div className="mt-3">{userBox}</div></div>
        )}
        <main className="mx-auto max-w-7xl p-4 sm:p-8"><Outlet /></main>
      </div>
    </div>
  )
}

const RoleGate = ({ roles, children }: { roles: Role[]; children: JSX.Element }) => {
  const { me } = useAuth()
  return me && roles.includes(me.role) ? children : <Navigate to="/app" replace />
}
const AppHome = () => {
  const { me } = useAuth()
  if (me?.role === 'owner') return <Suspense fallback={<Loading />}><Overview /></Suspense>
  return <Navigate to={me?.role === 'staff' ? '/app/me' : '/app/passport'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/signup" element={<Login initial="signup" />} />
      <Route path="/app" element={<Shell />}>
        <Route index element={<AppHome />} />
        <Route path="me" element={<RoleGate roles={['staff']}><MyStaffHome /></RoleGate>} />
        <Route path="passport" element={<RoleGate roles={['student']}><MyPassport /></RoleGate>} />
        <Route path="students" element={<RoleGate roles={['owner', 'staff']}><Students /></RoleGate>} />
        <Route path="students/:id" element={<RoleGate roles={['owner', 'staff']}><StudentDetail /></RoleGate>} />
        <Route path="staff" element={<RoleGate roles={['owner']}><Staff /></RoleGate>} />
        <Route path="staff/:id" element={<RoleGate roles={['owner', 'staff']}><StaffDetail /></RoleGate>} />
        <Route path="approvals" element={<RoleGate roles={['owner']}><Approvals /></RoleGate>} />
        <Route path="website" element={<RoleGate roles={['owner']}><SiteContent /></RoleGate>} />
        <Route path="fees" element={<Fees />} />
        <Route path="finance" element={<RoleGate roles={['owner']}><Finance /></RoleGate>} />
        <Route path="stock" element={<RoleGate roles={['owner', 'staff']}><Stock /></RoleGate>} />
        <Route path="attendance" element={<RoleGate roles={['owner', 'staff']}><Attendance /></RoleGate>} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="help" element={<Help />} />
        <Route path="password" element={<ChangePassword />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
