import { useState, useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../App'
import { useNav } from '../App'
import { DispositionBadge, DISPOSITIONS, LEAD_SOURCES, ORDER_SOURCES, formatDateShort } from '../components/Badges'
import NewInquiryModal from '../components/NewInquiryModal'
import MultiSelect from '../components/MultiSelect'
import PageHeader from '../components/PageHeader'
import ClosedWonModal from '../components/ClosedWonModal'

const TYPE_ICONS  = { lead: '◎', repeat: '↻', online_order: '◈' }
const TYPE_LABELS = { lead: 'Lead', repeat: 'Repeat Inquiry', online_order: 'Online Order' }

const HEADERS = {
  lead:         ['Date','Assigned To','Disposition','Lead Source','Name','Email','Company','Ph#','Part Number','Qty','Comments',''],
  repeat:       ['Date','Disposition','Assigned To','Name','Email','Phone','Company','Part#','Qty','Comments','PPC/Outbound',''],
  online_order: ['Date','Name','Email','Part Number','Total Qty','Order Amount','Source','Assigned To','Comments','Verification','Status',''],
}

// Inline disposition dropdown — appears in place of the badge
function InlineDispositionEdit({ inquiry, dispositions, onSave, onCancel, onClosedWon }) {
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

    // Intercept Closed Won — don't save yet, open the modal instead
    if (newDisp === 'Closed Won') {
      onClosedWon(inquiry)
      onCancel()
      return
    }

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
          background: '#fff', cursor: 'pointer', outline: 'none',
          boxShadow: '0 0 0 3px rgba(0,212,200,0.15)',
          minWidth: '160px', color: '#0f172a',
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
  const [showNew, setShowNew] = useState(false)
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState(null)
  const [editingDisp, setEditingDisp] = useState(null) // inquiry id being edited
  const [closedWonInquiry, setClosedWonInquiry] = useState(null) // inquiry object for modal

  const load = () => {
    setLoading(true)
    api.getInquiries(type, { disposition: filterDispositions, lead_source: filterSources })
      .then(d => { setInquiries(d); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [type, filterDispositions, filterSources])
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

  const hasFilters = filterDispositions.length || filterSources.length || filterUsers.length || search
  const clearAll = () => { setFilterDispositions([]); setFilterSources([]); setFilterUsers([]); setSearch('') }

  return (
    <div className="page-wrap">
      <PageHeader
        title={title}
        subtitle={`${filtered.length} record${filtered.length !== 1 ? 's' : ''}`}
        action={<button onClick={() => setShowNew(true)} className="btn-primary">+ New {TYPE_LABELS[type]}</button>}
      />

      {/* Filters */}
      <div className="flex gap-2 mb-3 flex-wrap items-center">
        <div className="search-wrap">
          <Search size={15} className="search-icon" />
          <input
            className="input w-52"
            placeholder="Search name, part, email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
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
        {user.role === 'manager' && (
          <MultiSelect
            placeholder="All Team Members"
            options={users.map(u => ({ value: String(u.id), label: u.name }))}
            selected={filterUsers}
            onChange={setFilterUsers}
          />
        )}
        {hasFilters && (
          <button onClick={clearAll} className="btn btn-sm text-red-500 bg-red-50 border border-red-100 hover:bg-red-100">
            ✕ Clear all
          </button>
        )}
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
              }} className="ml-1 text-brand-600 hover:text-brand-800 bg-transparent border-none cursor-pointer text-sm leading-none">×</button>
            </span>
          ))}
        </div>
      )}

      {/* Inline edit hint */}
      <p className="text-[11px] text-ink-300 mb-3">
        Click any <strong className="text-ink-400">disposition badge</strong> to edit it inline
      </p>

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
                          onClosedWon={(inq) => { setEditingDisp(null); setClosedWonInquiry(inq) }}
                        />
                      ) : (
                        <div
                          title="Click to change disposition"
                          style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <DispositionBadge disposition={inq.disposition} />
                          <span style={{ color: '#cbd5e1', fontSize: '10px' }}>✎</span>
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
                      <td className="table-cell w-10" onClick={e => e.stopPropagation()}>
                        {user.role === 'manager' && (
                          <button
                            onClick={e => handleDelete(e, inq.id)}
                            disabled={deleting === inq.id}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-red-300 hover:text-red-500 hover:bg-red-50 transition-all duration-150 border-none bg-transparent cursor-pointer text-sm"
                          >
                            {deleting === inq.id ? <span className="w-3 h-3 rounded-full border-2 border-red-400 border-t-transparent spinner" /> : '✕'}
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

      {closedWonInquiry && (
        <ClosedWonModal
          inquiry={closedWonInquiry}
          requirements={closedWonInquiry.requirements || []}
          onClose={() => {
            // Save the disposition as Closed Won even if they cancel the order creation
            api.updateInquiry(closedWonInquiry.id, {
              disposition: 'Closed Won',
              assigned_to: closedWonInquiry.assigned_to,
              notes: closedWonInquiry.notes,
              requirements: closedWonInquiry.requirements,
              ppc_or_outbound: closedWonInquiry.ppc_or_outbound,
              order_amount: closedWonInquiry.order_amount,
              order_ref: closedWonInquiry.order_ref,
            }).catch(() => {})
            setInquiries(prev => prev.map(i => i.id === closedWonInquiry.id ? { ...i, disposition: 'Closed Won' } : i))
            setClosedWonInquiry(null)
          }}
          onCreated={() => {
            api.updateInquiry(closedWonInquiry.id, {
              disposition: 'Closed Won',
              assigned_to: closedWonInquiry.assigned_to,
              notes: closedWonInquiry.notes,
              requirements: closedWonInquiry.requirements,
              ppc_or_outbound: closedWonInquiry.ppc_or_outbound,
              order_amount: closedWonInquiry.order_amount,
              order_ref: closedWonInquiry.order_ref,
            }).catch(() => {})
            setInquiries(prev => prev.map(i => i.id === closedWonInquiry.id ? { ...i, disposition: 'Closed Won' } : i))
            setClosedWonInquiry(null)
            navigate('operations')
          }}
        />
      )}
    </div>
  )
}
