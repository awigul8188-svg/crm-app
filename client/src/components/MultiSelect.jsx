import { useState, useRef, useEffect } from 'react'

export default function MultiSelect({ label, options, selected, onChange, placeholder }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const isSelected = (val) => selected.includes(val)

  const toggle = (val) => {
    onChange(isSelected(val) ? selected.filter(v => v !== val) : [...selected, val])
  }

  const selectAll = () => onChange(options.map(o => typeof o === 'object' ? o.value : o))
  const clearAll = () => onChange([])

  const triggerLabel = selected.length === 0
    ? (placeholder || label || 'Select...')
    : selected.length === 1
      ? (typeof options.find(o => (typeof o === 'object' ? o.value : o) === selected[0]) === 'object'
          ? options.find(o => o.value === selected[0])?.label
          : selected[0])
      : `${selected.length} selected`

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'white',
          border: `1px solid ${open ? '#00d4c8' : '#e2e8f0'}`,
          borderRadius: '12px',
          padding: '9px 12px',
          fontSize: '13px',
          cursor: 'pointer',
          color: selected.length === 0 ? '#94a3b8' : '#0f172a',
          minWidth: '160px',
          boxShadow: open ? '0 0 0 3px rgba(0,212,200,0.15)' : 'none',
          transition: 'all 0.15s',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>{triggerLabel}</span>
        {selected.length > 0 && (
          <span
            onClick={(e) => { e.stopPropagation(); clearAll() }}
            style={{ width: '16px', height: '16px', background: '#e2e8f0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', cursor: 'pointer', color: '#64748b', flexShrink: 0 }}
          >×</span>
        )}
        <span style={{ color: '#94a3b8', fontSize: '10px', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          zIndex: 9999,
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          minWidth: '200px',
          maxHeight: '280px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Select all / None */}
          <div style={{ display: 'flex', gap: '8px', padding: '8px 12px', borderBottom: '1px solid #f1f5f9', flexShrink: 0, background: '#fafafa', borderRadius: '12px 12px 0 0' }}>
            <button type="button" onClick={selectAll} style={{ fontSize: '11px', fontWeight: 600, color: '#00b8ad', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>All</button>
            <span style={{ color: '#e2e8f0' }}>·</span>
            <button type="button" onClick={clearAll} style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>None</button>
            {selected.length > 0 && <span style={{ fontSize: '11px', color: '#00b8ad', marginLeft: 'auto' }}>{selected.length} selected</span>}
          </div>

          {/* Options */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {options.map((opt) => {
              const val = typeof opt === 'object' ? opt.value : opt
              const lbl = typeof opt === 'object' ? opt.label : opt
              const checked = isSelected(val)
              return (
                <div
                  key={val}
                  onClick={() => toggle(val)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    background: checked ? 'rgba(0,212,200,0.06)' : 'transparent',
                    transition: 'background 0.1s',
                    fontSize: '13px',
                  }}
                  onMouseEnter={e => { if (!checked) e.currentTarget.style.background = '#f8fafc' }}
                  onMouseLeave={e => { e.currentTarget.style.background = checked ? 'rgba(0,212,200,0.06)' : 'transparent' }}
                >
                  {/* Checkbox */}
                  <div style={{
                    width: '16px', height: '16px', borderRadius: '5px', flexShrink: 0,
                    border: checked ? '2px solid #00d4c8' : '2px solid #cbd5e1',
                    background: checked ? '#00d4c8' : 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.1s',
                  }}>
                    {checked && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5l2.5 2.5 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <span style={{ color: checked ? '#0f172a' : '#475569', fontWeight: checked ? 600 : 400, flex: 1 }}>{lbl}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
