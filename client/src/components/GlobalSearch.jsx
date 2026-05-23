import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNav } from '../App'
import { formatDateShort } from './Badges'

const BRAND = '#00D4C8'
const TYPE_ICONS  = { lead:'◎', repeat:'↻', online_order:'◈' }
const TYPE_LABELS = { lead:'Lead', repeat:'Repeat', online_order:'Order' }
const TYPE_COLORS = { lead:'#3b82f6', repeat:'#6366f1', online_order:'#f59e0b' }

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function GlobalSearch({ onClose }) {
  const { navigate } = useNav()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [cursor, setCursor] = useState(-1)
  const inputRef = useRef()
  const debounced = useDebounce(query, 220)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (debounced.length < 2) { setResults(null); setLoading(false); return }
    setLoading(true)
    fetch(`/api/customers/search?q=${encodeURIComponent(debounced)}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('crm_token')}` }
    }).then(r => r.json()).then(d => { setResults(d); setLoading(false); setCursor(-1) })
      .catch(() => setLoading(false))
  }, [debounced])

  // Flatten all results for keyboard nav
  const allItems = results ? [
    ...(results.customers||[]).map(c => ({ type:'customer', ...c })),
    ...(results.inquiries||[]).map(i => ({ type:'inquiry', ...i })),
  ] : []

  const handleSelect = useCallback((item) => {
    if (item.type === 'customer') navigate('customer-detail', { id: item.id })
    else {
      const dest = item.type === 'online_order' ? 'orders' : item.type + 's'
      navigate('inquiry-detail', { id: item.id })
    }
    onClose()
  }, [navigate, onClose])

  const handleKey = (e) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c+1, allItems.length-1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c-1, -1)) }
    if (e.key === 'Enter' && cursor >= 0 && allItems[cursor]) { handleSelect(allItems[cursor]) }
  }

  const hasResults = results && (results.customers?.length > 0 || results.inquiries?.length > 0)

  return createPortal(
    <div onClick={onClose} style={{
      position:'fixed', inset:0, zIndex:999999,
      background:'rgba(0,0,0,0.6)', backdropFilter:'blur(8px)',
      display:'flex', alignItems:'flex-start', justifyContent:'center',
      paddingTop:'10vh',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width:'100%', maxWidth:600,
        background:'var(--card)',
        border:'1px solid var(--border-2)',
        borderRadius:20,
        boxShadow:'0 32px 100px rgba(0,0,0,0.5)',
        overflow:'hidden',
        animation:'modalIn 0.15s ease-out',
      }}>
        <style>{`@keyframes modalIn{from{opacity:0;transform:scale(0.96) translateY(-8px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>

        {/* Search input */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'16px 20px', borderBottom:'1px solid var(--border)' }}>
          <span style={{ fontSize:18, color:'var(--text-3)', flexShrink:0 }}>⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search customers, leads, orders, parts..."
            style={{
              flex:1, border:'none', outline:'none', background:'transparent',
              fontSize:16, color:'var(--text)', fontFamily:'"Plus Jakarta Sans",sans-serif',
            }}
          />
          {loading && <div style={{ width:16, height:16, borderRadius:'50%', border:`2px solid ${BRAND}`, borderTopColor:'transparent', animation:'spin 0.8s linear infinite', flexShrink:0 }} />}
          {query && <button onClick={() => setQuery('')} style={{ fontSize:14, color:'var(--text-3)', background:'none', border:'none', cursor:'pointer', padding:0 }}>✕</button>}
          <kbd style={{ fontSize:11, color:'var(--text-4)', background:'var(--card-2)', border:'1px solid var(--border)', borderRadius:6, padding:'2px 6px' }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight:'60vh', overflowY:'auto' }}>
          {!query || query.length < 2 ? (
            <div style={{ padding:'24px 20px', textAlign:'center' }}>
              <div style={{ fontSize:28, marginBottom:8 }}>🔍</div>
              <div style={{ fontSize:13, color:'var(--text-3)' }}>Type at least 2 characters to search</div>
              <div style={{ fontSize:11, color:'var(--text-4)', marginTop:6 }}>Search across customers, leads, repeat inquiries, online orders, and part numbers</div>
            </div>
          ) : !hasResults && !loading ? (
            <div style={{ padding:'32px 20px', textAlign:'center' }}>
              <div style={{ fontSize:28, marginBottom:8 }}>😕</div>
              <div style={{ fontSize:14, color:'var(--text-3)', fontWeight:600 }}>No results for "{query}"</div>
              <div style={{ fontSize:12, color:'var(--text-4)', marginTop:4 }}>Try a different name, email, or part number</div>
            </div>
          ) : hasResults ? (
            <div style={{ padding:'8px 0' }}>
              {/* Customers section */}
              {results.customers?.length > 0 && (
                <div>
                  <div style={{ padding:'8px 20px 4px', fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.1em' }}>Customers</div>
                  {results.customers.map((c, i) => {
                    const globalIdx = i
                    const isActive = cursor === globalIdx
                    return (
                      <div key={c.id} onClick={() => handleSelect({ type:'customer', ...c })}
                        style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 20px', cursor:'pointer', background:isActive?'var(--brand-dim)':'transparent', transition:'background 0.1s' }}
                        onMouseEnter={e => { setCursor(globalIdx); e.currentTarget.style.background='var(--brand-dim)' }}
                        onMouseLeave={e => { if(cursor !== globalIdx) e.currentTarget.style.background='transparent' }}>
                        <div style={{ width:34, height:34, borderRadius:10, background:`${BRAND}20`, color:BRAND, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:14, flexShrink:0 }}>{c.name?.[0]?.toUpperCase()}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontWeight:600, fontSize:14, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</div>
                          <div style={{ fontSize:12, color:'var(--text-3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{[c.company, c.email].filter(Boolean).join(' · ')}</div>
                        </div>
                        <span style={{ fontSize:11, color:'var(--text-4)', flexShrink:0 }}>Customer →</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Inquiries section */}
              {results.inquiries?.length > 0 && (
                <div>
                  <div style={{ padding:'8px 20px 4px', fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.1em', marginTop:4 }}>Inquiries</div>
                  {results.inquiries.map((inq, i) => {
                    const globalIdx = (results.customers?.length||0) + i
                    const isActive = cursor === globalIdx
                    return (
                      <div key={inq.id} onClick={() => handleSelect({ type:'inquiry', ...inq })}
                        style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 20px', cursor:'pointer', background:isActive?'var(--brand-dim)':'transparent', transition:'background 0.1s' }}
                        onMouseEnter={e => { setCursor(globalIdx); e.currentTarget.style.background='var(--brand-dim)' }}
                        onMouseLeave={e => { if(cursor !== globalIdx) e.currentTarget.style.background='transparent' }}>
                        <div style={{ width:34, height:34, borderRadius:10, background:`${TYPE_COLORS[inq.type]}18`, color:TYPE_COLORS[inq.type], display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>{TYPE_ICONS[inq.type]}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                            <span style={{ fontWeight:700, fontSize:14, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{inq.customer_name}</span>
                            <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20, background:`${TYPE_COLORS[inq.type]}18`, color:TYPE_COLORS[inq.type], flexShrink:0 }}>{TYPE_LABELS[inq.type]}</span>
                          </div>
                          <div style={{ fontSize:12, color:'var(--text-3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {inq.disposition} {inq.parts ? `· ${inq.parts}` : ''} {inq.customer_company ? `· ${inq.customer_company}` : ''}
                          </div>
                        </div>
                        <span style={{ fontSize:11, color:'var(--text-4)', flexShrink:0, whiteSpace:'nowrap' }}>{formatDateShort(inq.created_at)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer hints */}
        <div style={{ padding:'10px 20px', borderTop:'1px solid var(--border)', display:'flex', gap:16, alignItems:'center' }}>
          <span style={{ fontSize:11, color:'var(--text-4)', display:'flex', gap:6, alignItems:'center' }}>
            <kbd style={{ background:'var(--card-2)', border:'1px solid var(--border)', borderRadius:5, padding:'1px 5px', fontSize:10 }}>↑↓</kbd> Navigate
          </span>
          <span style={{ fontSize:11, color:'var(--text-4)', display:'flex', gap:6, alignItems:'center' }}>
            <kbd style={{ background:'var(--card-2)', border:'1px solid var(--border)', borderRadius:5, padding:'1px 5px', fontSize:10 }}>↵</kbd> Open
          </span>
          <span style={{ fontSize:11, color:'var(--text-4)', display:'flex', gap:6, alignItems:'center' }}>
            <kbd style={{ background:'var(--card-2)', border:'1px solid var(--border)', borderRadius:5, padding:'1px 5px', fontSize:10 }}>ESC</kbd> Close
          </span>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>,
    document.body
  )
}
