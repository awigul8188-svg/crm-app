import { useState, useRef, useEffect } from 'react'

export default function MultiSelect({ label, options, selected, onChange, placeholder }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (val) => {
    if (selected.includes(val)) onChange(selected.filter(v => v !== val))
    else onChange([...selected, val])
  }

  const clearAll = (e) => { e.stopPropagation(); onChange([]) }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`input flex items-center justify-between gap-2 min-w-[160px] text-left ${open ? 'border-brand-400 ring-2 ring-brand-100' : ''}`}
      >
        <span className={`truncate ${selected.length === 0 ? 'text-ink-300' : 'text-ink-900'}`}>
          {selected.length === 0
            ? placeholder || label
            : selected.length === 1
              ? selected[0]
              : `${selected.length} selected`}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {selected.length > 0 && (
            <span onClick={clearAll} className="w-4 h-4 rounded-full bg-ink-200 hover:bg-red-200 text-ink-500 hover:text-red-600 flex items-center justify-center text-xs transition-colors">×</span>
          )}
          <span className={`text-ink-400 transition-transform text-xs ${open ? 'rotate-180' : ''}`}>▾</span>
        </div>
      </button>

      {open && (
        <div className="absolute top-full mt-1.5 left-0 z-50 bg-white border border-slate-200 rounded-xl shadow-card-hover min-w-full max-h-64 overflow-y-auto slide-down" style={{ minWidth: '200px' }}>
          {/* Select all / clear */}
          <div className="flex gap-2 px-3 py-2 border-b border-slate-100 sticky top-0 bg-white">
            <button type="button" onClick={() => onChange(options.map(o => typeof o === 'string' ? o : o.value))} className="text-xs text-brand-600 font-semibold hover:text-brand-700">All</button>
            <span className="text-ink-200">·</span>
            <button type="button" onClick={() => onChange([])} className="text-xs text-ink-400 font-semibold hover:text-ink-600">None</button>
          </div>
          {options.map(opt => {
            const val = typeof opt === 'string' ? opt : opt.value
            const lbl = typeof opt === 'string' ? opt : opt.label
            const isSelected = selected.includes(val)
            return (
              <label key={val} className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-brand-50 transition-colors text-sm ${isSelected ? 'bg-brand-50/60' : ''}`}>
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSelected ? 'bg-brand-600 border-brand-600' : 'border-ink-300'}`}>
                  {isSelected && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <span className={isSelected ? 'text-ink-900 font-medium' : 'text-ink-600'}>{lbl}</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
