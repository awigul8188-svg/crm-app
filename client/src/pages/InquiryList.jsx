import { useState, useEffect, useRef } from 'react'
import { api } from '../api'
import { useAuth } from '../App'
import { useNav } from '../App'
import { DispositionBadge, DISPOSITIONS, LEAD_SOURCES, ORDER_SOURCES, formatDateShort } from '../components/Badges'
import NewInquiryModal from '../components/NewInquiryModal'
import MultiSelect from '../components/MultiSelect'

const TYPE_ICONS  = { lead: '◎', repeat: '↻', online_order: '◈' }
const TYPE_LABELS = { lead: 'Lead', repeat: 'Repeat Inquiry', online_order: 'Online Order' }

const HEADERS = {
  lead:         ['Date','Assigned To','Disposition','Lead Source','Name','Email','Company','Ph#','Part Number','Qty','Comments',''],
  repeat:       ['Date','Disposition','Assigned To','Name','Email','Phone','Company','Part#','Qty','Comments','PPC/Outbound',''],
  online_order: ['Date','Name','Email','Part Number','Total Qty','Order Amount','Source','Assigned To','Comments','Verification','Status',''],
}

// Inline disposition dropdown — appears in place of the badge
function InlineDispositionEdit({ inquiry, dispositions, onSave, onCancel }) {
  const ref = useRef()
  const [value, setValue] = useState(inquiry.disposition || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    ref.current?.focus()
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onCancel()
    }
    setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleChange = async (e) => {
    const newDisp = e.target.value
    setValue(newDisp)
    setSaving(true)
    try {
      await api.updateInquiry(inquiry.id, {
        disposition: newDisp,
        assigned_to: inquiry.assigned_to,
        notes: inquiry.notes,
        requirements: inquiry.requirements,
        ppc_or_outbound: inquiry.ppc_or_outbound,
        order_amount: inquiry.order_amount,
        order_ref: inquiry.order_ref,
      })
      onSave(inquiry.id, newDisp)
    } catch (e) {
      onCancel()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
      <select
        value={value}
        onChange={handleChange}
        disabled={saving}
        autoFocus
        style={{
          fontSize: '12px', fontWeight: 600, padding: '4px 8px',
          borderRadius: '8px', border: '2px solid #00D4C8',
          background: 'var(--card)', cursor: 'pointer', outline: 'none',
          boxShadow: '0 0 0 3px rgba(0,212,200,0.15)',
          minWidth: '160px', color: 'var(--text)',
          fontFamily: '"Plus Jakarta Sans", sans-serif',
        }}
      >
        {dispositions.map(d => <option key={d} value={d}>{d}</option>)}
      </select>
      {saving && (
        <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
          width: 12, height: 12, borderRadius: '50%', border: '2px solid #00D4C8',
          borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
      )}
    </div>
  )
}

export default function InquiryList({ type, title }) {
  const { user } = useAuth()
  const { navigate } = useNav()
  const [inquiries, setInquiries] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterDispositions, setFilterDispositions] = useState([])
  const [filterSources, setFilterSources] = useState([])
  const [filterUsers, setFilterUsers] = useState([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState(null)
  const [editingDisp, setEditingDisp] = useState(null) // inquiry id being edited

  const load = () => {
    setLoading(true)
    api.getInquiries(type, { disposition: filterDispositions, lead_source: filterSources, assigned_to: filterUsers, from: dateFrom, to: dateTo })
      .then(d => { setInquiries(d); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [type, filterDispositions, filterSources, filterUsers, dateFrom, dateTo])
  useEffect(() => { api.getUsers().then(setUsers) }, [])

  const filtered = inquiries.filter(i => {
    if (filterUsers.length && !filterUsers.includes(String(i.assigned_to))) return false
    if (!search) return true
    const s = search.toLowerCase()
    return i.customer_name?.toLowerCase().includes(s) || i.customer_company?.toLowerCase().includes(s) ||
      i.customer_email?.toLowerCase().includes(s) || i.requirements?.some(r => r.part_number.toLowerCase().includes(s))
  })

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    if (!confirm('Delete this inquiry? Cannot be undone.')) return
    setDeleting(id)
    try { await api.deleteInquiry(id); load() }
    catch (err) { alert(err.message) }
    finally { setDeleting(null) }
  }

  // Inline disposition save — update locally without full reload
  const handleDispSave = (id, newDisp) => {
    setInquiries(prev => prev.map(i => i.id === id ? { ...i, disposition: newDisp } : i))
    setEditingDisp(null)
  }

  const dispositionOptions = type === 'online_order'
    ? ['Processed', 'Cancelled']
    : DISPOSITIONS.filter(d => d !== 'Processed' && d !== 'Cancelled')

  const sourceOptions = type === 'online_order' ? ORDER_SOURCES : LEAD_SOURCES

  const hasFilters = filterDispositions.length || filterSources.length || filterUsers.length || search || dateFrom || dateTo
  const clearAll = () => { setFilterDispositions([]); setFilterSources([]); setFilterUsers([]); setSearch(''); setDateFrom(''); setDateTo('') }

  return (
    <div className="p-8 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display font-bold text-2xl text-ink-900 flex items-center gap-2.5">
            <span className="text-ink-300">{TYPE_ICONS[type]}</span> {title}
          </h1>
          <p className="text-ink-400 text-sm mt-0.5">{filtered.length} records</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary">+ New {TYPE_LABELS[type]}</button>
      </div>

      {/* Filters — all visible */}
      {/* Date range row */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, flexWrap:'wrap' }}>
        <span style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.50)' }}>Date:</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          style={{ padding:'7px 10px', border:'1px solid rgba(255,255,255,0.09)', borderRadius:10, fontSize:12, outline:'none', fontFamily:'"Plus Jakarta Sans",sans-serif', color:'var(--text)' }} />
        <span style={{ color:'rgba(255,255,255,0.38)', fontSize:13 }}>→</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          style={{ padding:'7px 10px', border:'1px solid rgba(255,255,255,0.09)', borderRadius:10, fontSize:12, outline:'none', fontFamily:'"Plus Jakarta Sans",sans-serif', color:'var(--text)' }} />
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo('') }}
            style={{ fontSize:11, color:'rgba(255,255,255,0.38)', background:'none', border:'none', cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
            clear dates
          </button>
        )}
      </div>
      <div className="flex gap-2.5 mb-4 flex-wrap items-center">
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <input
            style={{ padding: '9px 12px 9px 34px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.09)', fontSize: '13px', background: 'var(--card)', outline: 'none', width: '220px', fontFamily: '"Plus Jakarta Sans", sans-serif', color: 'var(--text)' }}
            placeholder="Search name, part, email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.38)', fontSize: '14px', pointerEvents: 'none' }}>⌕</span>
        </div>

        <MultiSelect
          placeholder={type === 'online_order' ? 'All Statuses' : 'All Dispositions'}
          options={dispositionOptions}
          selected={filterDispositions}
          onChange={setFilterDispositions}
        />

        <MultiSelect
          placeholder="All Sources"
          options={sourceOptions}
          selected={filterSources}
          onChange={setFilterSources}
        />

        {/* Assigned To — all roles see this, AEs see only themselves */}
        {user.role === 'manager' && (
          <MultiSelect
            placeholder="All Team Members"
            options={users.map(u => ({ value: String(u.id), label: u.name }))}
            selected={filterUsers}
            onChange={setFilterUsers}
          />
        )}

        {hasFilters ? (
          <button onClick={clearAll}
            style={{ fontSize: '12px', fontWeight: 600, color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '6px 12px', cursor: 'pointer', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
            ✕ Clear all
          </button>
        ) : null}
      </div>

      {/* Active filter tags */}
      {(filterDispositions.length > 0 || filterSources.length > 0 || filterUsers.length > 0) && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {[
            ...filterDispositions.map(d => ({ k: d, label: d, type: 'd' })),
            ...filterSources.map(s => ({ k: s, label: s, type: 's' })),
            ...filterUsers.map(id => ({ k: id, label: users.find(u => String(u.id) === id)?.name || id, type: 'u' })),
          ].map(tag => (
            <span key={tag.k + tag.type} className="tag">
              {tag.label}
              <button onClick={() => {
                if (tag.type === 'd') setFilterDispositions(f => f.filter(v => v !== tag.k))
                else if (tag.type === 's') setFilterSources(f => f.filter(v => v !== tag.k))
                else setFilterUsers(f => f.filter(v => v !== tag.k))
              }} style={{ marginLeft: '2px', color: '#00b8ad', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}>×</button>
            </span>
          ))}
        </div>
      )}

      {/* Tip for inline editing */}
      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.38)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
        <span>💡</span> Click any <strong>disposition badge</strong> to edit it inline — no need to open the record
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-7 h-7 rounded-full border-2 border-t-transparent spinner" style={{ borderColor: '#00D4C8 transparent transparent' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="text-5xl mb-3 opacity-20">{TYPE_ICONS[type]}</div>
          <div className="font-display font-bold text-ink-400">No {title.toLowerCase()} found</div>
          <div className="text-ink-300 text-sm mt-1">Try clearing filters or create a new one</div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  {HEADERS[type].map((h, i) => <th key={i} className="text-left px-4 py-3">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map(inq => {
                  const partNums = inq.requirements?.map(r => r.part_number).join(', ') || '—'
                  const qtys = inq.requirements?.map(r => r.quantity).join(', ') || '—'
                  const totalQty = inq.requirements?.reduce((s, r) => { const n = parseInt(r.quantity); return s + (isNaN(n) ? 0 : n) }, 0)
                  const isEditingDisp = editingDisp === inq.id

                  // Disposition cell — clickable to edit inline
                  const dispCell = (
                    <td className="table-cell" onClick={e => { e.stopPropagation(); setEditingDisp(inq.id) }}>
                      {isEditingDisp ? (
                        <InlineDispositionEdit
                          inquiry={inq}
                          dispositions={dispositionOptions}
                          onSave={handleDispSave}
                          onCancel={() => setEditingDisp(null)}
                        />
                      ) : (
                        <div
                          title="Click to change disposition"
                          style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <DispositionBadge disposition={inq.disposition} />
                          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px' }}>✎</span>
                        </div>
                      )}
                    </td>
                  )

                  return (
                    <tr key={inq.id}
                      className="table-row"
                      onClick={() => { if (editingDisp !== inq.id) navigate('inquiry-detail', { id: inq.id }) }}
                      style={{ cursor: editingDisp === inq.id ? 'default' : 'pointer' }}
                    >
                      <td className="table-cell text-ink-400 font-mono text-xs whitespace-nowrap">{formatDateShort(inq.created_at)}</td>

                      {type === 'lead' && <>
                        <td className="table-cell font-semibold text-ink-700 whitespace-nowrap">{inq.assigned_name||'—'}</td>
                        {dispCell}
                        <td className="table-cell text-xs text-ink-500 whitespace-nowrap">{inq.lead_source||'—'}</td>
                        <td className="table-cell font-semibold text-ink-900 whitespace-nowrap">{inq.customer_name}</td>
                        <td className="table-cell text-xs text-ink-500">{inq.customer_email||'—'}</td>
                        <td className="table-cell text-xs text-ink-500 whitespace-nowrap">{inq.customer_company||'—'}</td>
                        <td className="table-cell text-xs text-ink-500">{inq.customer_phone||'—'}</td>
                        <td className="table-cell font-mono text-xs text-ink-700 max-w-[140px] truncate">{partNums}</td>
                        <td className="table-cell text-xs text-ink-600">{qtys}</td>
                        <td className="table-cell text-xs text-ink-400 max-w-[140px] truncate">{inq.notes||'—'}</td>
                      </>}

                      {type === 'repeat' && <>
                        {dispCell}
                        <td className="table-cell font-semibold text-ink-700 whitespace-nowrap">{inq.assigned_name||'—'}</td>
                        <td className="table-cell font-semibold text-ink-900 whitespace-nowrap">{inq.customer_name}</td>
                        <td className="table-cell text-xs text-ink-500">{inq.customer_email||'—'}</td>
                        <td className="table-cell text-xs text-ink-500">{inq.customer_phone||'—'}</td>
                        <td className="table-cell text-xs text-ink-500 whitespace-nowrap">{inq.customer_company||'—'}</td>
                        <td className="table-cell font-mono text-xs text-ink-700 max-w-[130px] truncate">{partNums}</td>
                        <td className="table-cell text-xs text-ink-600">{qtys}</td>
                        <td className="table-cell text-xs text-ink-400 max-w-[130px] truncate">{inq.notes||'—'}</td>
                        <td className="table-cell text-xs">{inq.ppc_or_outbound ? <span className="badge bg-violet-50 text-violet-600 border-violet-100">{inq.ppc_or_outbound}</span> : '—'}</td>
                      </>}

                      {type === 'online_order' && <>
                        <td className="table-cell font-semibold text-ink-900 whitespace-nowrap">{inq.customer_name}</td>
                        <td className="table-cell text-xs text-ink-500">{inq.customer_email||'—'}</td>
                        <td className="table-cell font-mono text-xs text-ink-700 max-w-[130px] truncate">{partNums}</td>
                        <td className="table-cell font-semibold text-ink-700">{totalQty||'—'}</td>
                        <td className="table-cell font-semibold text-green-700">{inq.order_amount ? `$${inq.order_amount}` : '—'}</td>
                        <td className="table-cell text-xs text-ink-500 whitespace-nowrap">{inq.lead_source||'—'}</td>
                        <td className="table-cell font-semibold text-ink-700 whitespace-nowrap">{inq.assigned_name||'—'}</td>
                        <td className="table-cell text-xs text-ink-400 max-w-[130px] truncate">{inq.notes||'—'}</td>
                        <td className="table-cell text-xs">
                          {inq.order_ref
                            ? <span className={`badge ${inq.order_ref === 'Verified' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-500 border-red-200'}`}>{inq.order_ref}</span>
                            : '—'}
                        </td>
                        {dispCell}
                      </>}

                      {/* Delete — managers only */}
                      <td className="table-cell" onClick={e => e.stopPropagation()}>
                        {user.role === 'manager' && (
                          <button
                            onClick={e => handleDelete(e, inq.id)}
                            disabled={deleting === inq.id}
                            style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: '#fca5a5', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#ef4444' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#fca5a5' }}
                          >
                            {deleting === inq.id ? '...' : '🗑'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showNew && (
        <NewInquiryModal
          defaultType={type}
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); load() }}
        />
      )}
    </div>
  )
}
