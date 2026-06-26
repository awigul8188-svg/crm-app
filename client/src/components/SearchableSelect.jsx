import { useState, useRef, useEffect } from 'react'

const BRAND = '#00D4C8'

/**
 * Generic type-to-search single select.
 * items: [{ value, label, sub?, group? }]
 * value: currently selected value (string/number)
 * onChange(value, item)
 */
export default function SearchableSelect({ items, value, onChange, placeholder = 'Search…', emptyText = 'No matches' }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef()
  const inputRef = useRef()

  const selected = items.find(i => String(i.value) === String(value))

  const filtered = items.filter(i => {
    if (!query) return true
    const q = query.toLowerCase()
    return (i.label || '').toLowerCase().includes(q) || (i.sub || '').toLowerCase().includes(q)
  })

  // Preserve declared order of groups
  const groups = []
  filtered.forEach(i => { const g = i.group || ''; if (!groups.includes(g)) groups.push(g) })

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQuery('') } }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const pick = (i) => { onChange(String(i.value), i); setOpen(false); setQuery('') }
  const handleOpen = () => { setOpen(true); setQuery(''); setTimeout(() => inputRef.current?.focus(), 50) }

  const row = (i) => {
    const isSel = String(i.value) === String(value)
    return (
      <div key={i.value} onClick={() => pick(i)}
        style={{ padding: '9px 14px', cursor: 'pointer', background: isSel ? `${BRAND}12` : 'transparent', borderBottom: '1px solid #f8fafc', transition: 'background 0.1s' }}
        onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#f8fafc' }}
        onMouseLeave={e => { e.currentTarget.style.background = isSel ? `${BRAND}12` : 'transparent' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', flex: 1 }}>
            {i.label}
            {i.sub && <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 6, fontSize: 11 }}>{i.sub}</span>}
          </div>
          {isSel && <span style={{ color: BRAND, fontSize: 14 }}>✓</span>}
        </div>
      </div>
    )
  }

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <div onClick={handleOpen}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box',
          background: '#fff', border: `1px solid ${open ? BRAND : '#e2e8f0'}`, borderRadius: 12, padding: '10px 14px',
          fontSize: 13, cursor: 'pointer', boxShadow: open ? `0 0 0 3px rgba(0,212,200,0.12)` : 'none', transition: 'all 0.15s' }}>
        {selected
          ? <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: '#0f172a' }}>{selected.label}</span>
          : <span style={{ color: '#94a3b8' }}>{placeholder}</span>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {selected && <span onClick={e => { e.stopPropagation(); onChange('', null) }}
            style={{ width: 16, height: 16, background: '#e2e8f0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#64748b', cursor: 'pointer' }}>×</span>}
          <span style={{ color: '#94a3b8', fontSize: 10, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
        </div>
      </div>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 99999, background: '#fff',
          border: '1px solid #e2e8f0', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', maxHeight: 300, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: 10, borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
            <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Type to search…" onClick={e => e.stopPropagation()}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 13, outline: 'none' }} />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.length === 0
              ? <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>{emptyText}{query ? ` for “${query}”` : ''}</div>
              : groups.map(g => (
                <div key={g || '_'}>
                  {g && <div style={{ padding: '6px 14px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', background: '#fafafa' }}>{g}</div>}
                  {filtered.filter(i => (i.group || '') === g).slice(0, 100).map(row)}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
