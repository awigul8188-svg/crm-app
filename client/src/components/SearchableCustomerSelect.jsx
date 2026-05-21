import { useState, useRef, useEffect } from 'react'

const BRAND = '#00D4C8'

export default function SearchableCustomerSelect({ customers, value, onChange, placeholder = 'Search customers...' }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef()
  const inputRef = useRef()

  const selected = customers.find(c => String(c.id) === String(value))

  const filtered = customers.filter(c => {
    if (!query) return true
    const q = query.toLowerCase()
    return c.name?.toLowerCase().includes(q) ||
      c.company?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
  })

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (customer) => {
    onChange(String(customer.id))
    setOpen(false)
    setQuery('')
  }

  const handleOpen = () => {
    setOpen(true)
    setQuery('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      {/* Trigger */}
      <div
        onClick={handleOpen}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', boxSizing: 'border-box',
          background: 'var(--card)', border: `1px solid ${open ? BRAND : '#e2e8f0'}`,
          borderRadius: '12px', padding: '10px 14px',
          fontSize: '13px', cursor: 'pointer',
          boxShadow: open ? `0 0 0 3px rgba(0,212,200,0.12)` : 'none',
          transition: 'all 0.15s', fontFamily: '"Plus Jakarta Sans", sans-serif',
        }}
      >
        {selected ? (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>{selected.name}</span>
            {selected.company && <span style={{ color: 'rgba(255,255,255,0.38)', marginLeft: '6px', fontSize: '12px' }}>— {selected.company}</span>}
          </div>
        ) : (
          <span style={{ color: 'rgba(255,255,255,0.38)' }}>{placeholder}</span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {selected && (
            <span
              onClick={(e) => { e.stopPropagation(); onChange(''); }}
              style={{ width: 16, height: 16, background: '#e2e8f0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'rgba(255,255,255,0.50)', cursor: 'pointer' }}
            >×</span>
          )}
          <span style={{ color: 'rgba(255,255,255,0.38)', fontSize: '10px', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
        </div>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          zIndex: 99999, background: 'var(--card)',
          border: '1px solid rgba(255,255,255,0.09)', borderRadius: '14px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          maxHeight: '280px', display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Search input */}
          <div style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.38)', fontSize: '14px' }}>⌕</span>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Type to search..."
                onClick={e => e.stopPropagation()}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '8px 10px 8px 30px',
                  border: '1px solid rgba(255,255,255,0.09)', borderRadius: '10px',
                  fontSize: '13px', outline: 'none',
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                }}
              />
            </div>
          </div>

          {/* Results */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'rgba(255,255,255,0.38)', fontSize: '13px' }}>
                No customers found for "{query}"
              </div>
            ) : (
              filtered.slice(0, 100).map(c => (
                <div
                  key={c.id}
                  onClick={() => handleSelect(c)}
                  style={{
                    padding: '10px 14px', cursor: 'pointer',
                    background: String(c.id) === String(value) ? `${BRAND}12` : 'transparent',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (String(c.id) !== String(value)) e.currentTarget.style.background = '#f8fafc' }}
                  onMouseLeave={e => { e.currentTarget.style.background = String(c.id) === String(value) ? `${BRAND}12` : 'transparent' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                      background: String(c.id) === String(value) ? BRAND : '#f1f5f9',
                      color: String(c.id) === String(value) ? '#0d0d0d' : '#64748b',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: 700,
                    }}>
                      {c.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{c.name}</div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.38)' }}>
                        {[c.company, c.email].filter(Boolean).join(' · ') || 'No details'}
                      </div>
                    </div>
                    {String(c.id) === String(value) && (
                      <span style={{ marginLeft: 'auto', color: BRAND, fontSize: '14px' }}>✓</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Count */}
          {filtered.length > 0 && (
            <div style={{ padding: '6px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '11px', color: 'rgba(255,255,255,0.38)', flexShrink: 0, background: 'rgba(255,255,255,0.03)' }}>
              {filtered.length} customer{filtered.length !== 1 ? 's' : ''}{query ? ` matching "${query}"` : ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
