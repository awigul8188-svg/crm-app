import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { HelpCircle, X, Send, Sparkles } from 'lucide-react'
import { useAuth } from '../App'
import { assistantApi } from '../api'

const BRAND = '#00D4C8'

// Role-aware starter questions (the assistant itself is also role-scoped server-side).
const SUGGESTIONS = {
  ae: ['How do I create a new lead?', 'How do I mark a deal as Closed Won?', 'Where do I see who quoted my parts?'],
  manager: ['How do I review pending orders?', 'How do I import data?', 'Where do I see GP by buyer?'],
  purchasing_manager: ['How do I assign a part to a purchaser?', 'How do I reset a purchaser password?', "Why aren't imported parts in the queue?"],
  purchaser: ['How do I quote a part from multiple suppliers?', 'How do I mark a part not in stock?', 'Where are my pending parts?'],
  buyer: ['How do I fill the vendor side of an order?', 'How do I mark an order complete?', 'How do I filter the order list?'],
}

export default function HelpAssistant() {
  const { user } = useAuth()
  const [enabled, setEnabled] = useState(false) // hide launcher until a key is configured
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([]) // {role:'user'|'assistant', content}
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  const suggestions = SUGGESTIONS[user?.role] || SUGGESTIONS.ae

  useEffect(() => { assistantApi.status().then(s => setEnabled(!!s?.configured)).catch(() => {}) }, [])
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [messages, busy])
  useEffect(() => { if (open && inputRef.current) inputRef.current.focus() }, [open])

  if (!enabled) return null

  const send = async (text) => {
    const q = (text ?? input).trim()
    if (!q || busy) return
    setError('')
    const next = [...messages, { role: 'user', content: q }]
    setMessages(next); setInput(''); setBusy(true)
    try {
      const { answer } = await assistantApi.ask(next)
      setMessages([...next, { role: 'assistant', content: answer }])
    } catch (e) {
      setError(e.message || 'Something went wrong.')
    } finally { setBusy(false) }
  }

  const onKey = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }

  return createPortal(
    <>
      {/* Floating launcher */}
      {!open && (
        <button onClick={() => setOpen(true)} title="Help — ask the assistant"
          style={{ position: 'fixed', right: 22, bottom: 22, zIndex: 100000, width: 52, height: 52, borderRadius: '50%', border: 'none',
            background: BRAND, color: '#062b29', cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,212,200,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <HelpCircle size={26} />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div style={{ position: 'fixed', right: 22, bottom: 22, zIndex: 100000, width: 'min(400px, calc(100vw - 32px))', height: 'min(580px, calc(100vh - 60px))',
          background: '#fff', borderRadius: 18, boxShadow: '0 24px 70px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          fontFamily: '"Plus Jakarta Sans",sans-serif', border: '1px solid #e2e8f0' }}>
          {/* Header */}
          <div style={{ padding: '14px 16px', background: '#0a0a0a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <Sparkles size={17} style={{ color: BRAND }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, fontFamily: '"Bricolage Grotesque",sans-serif' }}>Help Assistant</div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)' }}>Ask how to do anything in the app</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ width: 30, height: 30, borderRadius: 9, border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', background: '#f8fafc' }}>
            {messages.length === 0 && (
              <div>
                <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, marginBottom: 14 }}>
                  Hi {user?.name?.split(' ')[0] || 'there'} 👋 I can help you find your way around. Try one of these, or ask your own:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {suggestions.map(s => (
                    <button key={s} onClick={() => send(s)}
                      style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', color: '#0f172a', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = BRAND; e.currentTarget.style.background = `${BRAND}08` }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#fff' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                <div style={{ maxWidth: '85%', padding: '9px 13px', borderRadius: 14, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                  background: m.role === 'user' ? BRAND : '#fff', color: m.role === 'user' ? '#062b29' : '#1e293b',
                  border: m.role === 'user' ? 'none' : '1px solid #e2e8f0',
                  borderBottomRightRadius: m.role === 'user' ? 4 : 14, borderBottomLeftRadius: m.role === 'user' ? 14 : 4 }}>
                  {m.content}
                </div>
              </div>
            ))}

            {busy && (
              <div style={{ display: 'flex', gap: 4, padding: '9px 13px', alignItems: 'center' }}>
                {[0, 1, 2].map(i => <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#cbd5e1', animation: `helpdot 1s ${i * 0.15}s infinite ease-in-out` }} />)}
              </div>
            )}
            {error && <div style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '8px 11px' }}>{error}</div>}
          </div>

          {/* Composer */}
          <div style={{ padding: 12, borderTop: '1px solid #f1f5f9', flexShrink: 0, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey} rows={1} placeholder="Ask a question…"
              style={{ flex: 1, resize: 'none', maxHeight: 90, border: '1px solid #e2e8f0', borderRadius: 12, padding: '9px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#0f172a' }} />
            <button onClick={() => send()} disabled={busy || !input.trim()}
              style={{ width: 38, height: 38, borderRadius: 11, border: 'none', background: input.trim() && !busy ? BRAND : '#e2e8f0', color: input.trim() && !busy ? '#062b29' : '#94a3b8', cursor: input.trim() && !busy ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
      <style>{`@keyframes helpdot{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-5px);opacity:1}}`}</style>
    </>,
    document.body
  )
}
