import { useEffect, useRef, useState, FormEvent } from 'react'
import { MessageCircle, X, Send, Bot } from 'lucide-react'
import { API } from '../lib'

type Msg = { role: 'user' | 'bot'; text: string; live?: boolean }
const START = ['Which sports do you teach?', 'How do I join?', 'Book a trial class', 'Where are you located?']

/** Public assistant for the website. Answers general academy questions, never private data. */
export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([{ role: 'bot', text: 'Hi! I am the Global Sports Academy assistant. How can I help you today?' }])
  const [chips, setChips] = useState<string[]>(START)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [msgs, open, busy])

  /** Types the reply out word by word so it reads like a live answer. */
  async function stream(full: string) {
    const words = full.split(/(\s+)/)
    setMsgs((x) => [...x, { role: 'bot', text: '', live: true }])
    let shown = ''
    for (let i = 0; i < words.length; i++) {
      shown += words[i]
      if (i % 2 === 0) { const cur = shown; setMsgs((x) => x.map((m, k) => (k === x.length - 1 ? { ...m, text: cur } : m))); await new Promise((r) => setTimeout(r, 28)) }
    }
    setMsgs((x) => x.map((m, k) => (k === x.length - 1 ? { ...m, text: full, live: false } : m)))
  }

  async function send(m: string) {
    const message = m.trim()
    if (!message || busy) return
    if (/^book a trial class$/i.test(message)) { setOpen(false); document.getElementById('trial')?.scrollIntoView({ behavior: 'smooth' }); return }
    setMsgs((x) => [...x, { role: 'user', text: message }]); setText(''); setBusy(true); setChips([])
    try {
      const r = await fetch(`${API}/public/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, history: msgs.slice(-6).map((x) => ({ role: x.role === 'user' ? 'user' : 'assistant', text: x.text })) }) })
      const d = await r.json().catch(() => ({}))
      await stream(d.reply || 'Sorry, something went wrong. Please call 9042999507.')
      setChips(d.chips ?? START)
    } catch {
      setMsgs((x) => [...x, { role: 'bot', text: 'I could not connect. Please check your internet or call 9042999507.' }]); setChips(START)
    } finally { setBusy(false) }
  }
  const submit = (e: FormEvent) => { e.preventDefault(); send(text) }

  return (
    <>
      {open && (
        <div role="dialog" aria-label="Academy assistant" className="pop-in fixed bottom-24 right-4 z-50 flex h-[min(34rem,calc(100vh-8rem))] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl shadow-navy/25 sm:right-5">
          <div className="flex items-center gap-3 bg-navy px-4 py-3 text-white">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-sky"><Bot size={20} /></span>
            <div className="flex-1"><div className="text-sm font-bold">GSA Assistant</div><div className="text-[11px] text-white/70">Ask about sports, joining and timings</div></div>
            <button aria-label="Close chat" onClick={() => setOpen(false)} className="rounded-md p-1.5 hover:bg-white/10"><X size={18} /></button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto bg-soft/60 p-4" aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === 'user' ? 'rounded-br-sm bg-navy text-white' : 'rounded-bl-sm bg-white text-ink shadow-sm'}`}>{m.text}</div>
              </div>
            ))}
            {busy && <div className="flex justify-start" aria-label="Assistant is typing"><div className="flex gap-1 rounded-2xl rounded-bl-sm bg-white px-4 py-3.5 shadow-sm"><span className="typing-dot" /><span className="typing-dot" style={{ animationDelay: '.15s' }} /><span className="typing-dot" style={{ animationDelay: '.3s' }} /></div></div>}
            {!busy && chips.length > 0 && !msgs[msgs.length - 1]?.live && (
              <div className="flex flex-wrap gap-2 pt-1">{chips.map((c) => <button key={c} onClick={() => send(c)} className="rounded-full border border-brand/30 bg-white px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand hover:text-white">{c}</button>)}</div>
            )}
            <div ref={end} />
          </div>
          <form onSubmit={submit} className="flex gap-2 border-t border-line bg-white p-3">
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Type your question..." aria-label="Your question" className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-sky/30" />
            <button disabled={busy || !text.trim()} aria-label="Send" className="grid h-11 w-11 place-items-center rounded-lg bg-flame text-white disabled:opacity-50"><Send size={18} /></button>
          </form>
        </div>
      )}
      <button onClick={() => setOpen((x) => !x)} aria-label={open ? 'Close assistant' : 'Open assistant'} aria-expanded={open}
        className="rip fixed bottom-5 right-4 z-50 flex items-center gap-2 rounded-full bg-navy px-5 py-3.5 font-bold text-white shadow-lg shadow-black/30 transition hover:scale-105 hover:bg-navy2 sm:right-5">
        {open ? <X size={20} /> : <MessageCircle size={20} />}<span className="hidden sm:inline">{open ? 'Close' : 'Ask us'}</span>
      </button>
    </>
  )
}
