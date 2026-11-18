import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, useAuth } from '../lib'
import { Card, PageHeader, Btn, ErrorMsg } from '../components/ui'

export default function ChangePassword() {
  const { me, login } = useAuth()
  const nav = useNavigate()
  const [err, setErr] = useState('')
  const [ok, setOk] = useState(false)
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    if (f.get('next') !== f.get('again')) return setErr('New passwords do not match')
    try { await api('/auth/change-password', { body: { current: f.get('current'), next: f.get('next') } }); setOk(true); setErr(''); await login(localStorage.getItem('gsa_token')!); setTimeout(() => nav('/app'), 800) }
    catch (er: any) { setErr(er.message) }
  }
  const input = 'w-full rounded-md border border-line bg-soft px-4 py-3 text-sm outline-none focus:border-brand'
  return (
    <>
      <PageHeader title="Change password" sub={me?.mustChange ? 'Please set a new password to continue.' : undefined} />
      <Card className="max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <input name="current" type="password" required placeholder="Current password" autoComplete="current-password" className={input} />
          <input name="next" type="password" required minLength={8} placeholder="New password (min 8 characters)" autoComplete="new-password" className={input} />
          <input name="again" type="password" required minLength={8} placeholder="Repeat new password" autoComplete="new-password" className={input} />
          {err && <ErrorMsg text={err} />}{ok && <div className="rounded-md bg-brand/10 p-3 text-sm text-brand">Password updated.</div>}
          <Btn type="submit">Update password</Btn>
        </form>
      </Card>
    </>
  )
}
