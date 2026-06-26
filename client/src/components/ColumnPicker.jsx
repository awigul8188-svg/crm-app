import { useState, useEffect, useRef } from 'react'
import { SlidersHorizontal } from 'lucide-react'

const BRAND = '#00D4C8'

// Per-table, per-browser column visibility. `columns` is an array of { key, label|h, locked? }.
// `defaultHidden` are keys hidden until the user opts them in. Locked columns are always shown.
export function useColumnPrefs(storageKey, columns, defaultHidden = []) {
  const sk = 'cols:' + storageKey
  const [hidden, setHidden] = useState(() => {
    try { const s = localStorage.getItem(sk); if (s) return new Set(JSON.parse(s)) } catch {}
    return new Set(defaultHidden)
  })
  useEffect(() => { try { localStorage.setItem(sk, JSON.stringify([...hidden])) } catch {} }, [sk, hidden])
  const toggle = (key) => setHidden(h => { const n = new Set(h); n.has(key) ? n.delete(key) : n.add(key); return n })
  const reset  = () => setHidden(new Set(defaultHidden))
  const visibleColumns = columns.filter(c => c.locked || !hidden.has(c.key))
  return { visibleColumns, hidden, toggle, reset }
}

// "Columns" button + checkbox popover. Wire to the values from useColumnPrefs.
export function ColumnPicker({ columns, hidden, toggle, reset }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const k = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k) }
  }, [open])
  const shownCount = columns.filter(c => c.locked || !hidden.has(c.key)).length
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="btn btn-secondary btn-sm" onClick={() => setOpen(o => !o)} title="Choose columns"
        style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
        <SlidersHorizontal size={14} /> Columns <span style={{ color: '#94a3b8', fontWeight: 600 }}>{shownCount}/{columns.length}</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 60, background: '#fff',
          border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.14)', padding: 6, width: 230, maxHeight: 340, overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px 8px' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Show columns</span>
            <button onClick={reset} style={{ fontSize: 11, fontWeight: 600, color: BRAND, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Reset</button>
          </div>
          {columns.map(c => {
            const on = c.locked || !hidden.has(c.key)
            return (
              <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 8px', borderRadius: 8,
                cursor: c.locked ? 'not-allowed' : 'pointer', opacity: c.locked ? 0.55 : 1 }}
                onMouseEnter={e => { if (!c.locked) e.currentTarget.style.background = '#f8fafc' }}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <input type="checkbox" checked={on} disabled={c.locked} onChange={() => toggle(c.key)}
                  style={{ accentColor: BRAND, cursor: c.locked ? 'not-allowed' : 'pointer' }} />
                <span style={{ fontSize: 13, color: '#334155' }}>{c.label || c.h}{c.locked ? '  (always shown)' : ''}</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
