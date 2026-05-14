import { useState, useEffect } from 'react'
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

export default function InquiryList({ type, title }) {
  const { user } = useAuth()
  const { navigate } = useNav()
  const [inquiries, setInquiries] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterDispositions, setFilterDispositions] = useState([])
  const [filterSources, setFilterSources] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState(null)

  const load = () => {
    setLoading(true)
    api.getInquiries(type, { disposition: filterDispositions, lead_source: filterSources })
      .then(d => { setInquiries(d); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [type, filterDispositions, filterSources])

  const filtered = inquiries.filter(i => {
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

  const dispositionOptions = type === 'online_order'
    ? ['Processed', 'Cancelled']
    : DISPOSITIONS.filter(d => d !== 'Processed' && d !== 'Cancelled')

  const sourceOptions = type === 'online_order' ? ORDER_SOURCES : LEAD_SOURCES

  return (
    <div className="p-8 fade-in">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display font-bold text-2xl text-ink-900 flex items-center gap-2.5">
            <span className="text-ink-300">{TYPE_ICONS[type]}</span> {title}
          </h1>
          <p className="text-ink-400 text-sm mt-0.5">{filtered.length} records</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary">+ New {TYPE_LABELS[type]}</button>
      </div>

      {/* Filters */}
      <div className="flex gap-2.5 mb-4 flex-wrap items-center">
        <div className="relative">
          <input className="input pl-8 max-w-xs" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300 text-sm pointer-events-none">⌕</span>
        </div>
        <MultiSelect placeholder={type === 'online_order' ? 'All Statuses' : 'All Dispositions'} options={dispositionOptions} selected={filterDispositions} onChange={setFilterDispositions} />
        <MultiSelect placeholder="All Sources" options={sourceOptions} selected={filterSources} onChange={setFilterSources} />
        {(filterDispositions.length || filterSources.length || search) ? (
          <button onClick={() => { setFilterDispositions([]); setFilterSources([]); setSearch('') }} className="btn btn-ghost btn-sm text-red-500 hover:bg-red-50">✕ Clear</button>
        ) : null}
      </div>

      {/* Active filter tags */}
      {(filterDispositions.length > 0 || filterSources.length > 0) && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {[...filterDispositions.map(d => ({ k: d, type: 'd' })), ...filterSources.map(s => ({ k: s, type: 's' }))].map(tag => (
            <span key={tag.k} className="tag">
              {tag.k}
              <button onClick={() => {
                if (tag.type === 'd') setFilterDispositions(f => f.filter(v => v !== tag.k))
                else setFilterSources(f => f.filter(v => v !== tag.k))
              }} className="text-brand-500 hover:text-red-500">×</button>
            </span>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24"><div className="w-7 h-7 rounded-full border-2 border-brand-400 border-t-transparent spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="text-5xl mb-3 opacity-20">{TYPE_ICONS[type]}</div>
          <div className="font-display font-bold text-ink-400">No {title.toLowerCase()} found</div>
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

                  return (
                    <tr key={inq.id} className="table-row" onClick={() => navigate('inquiry-detail', { id: inq.id })}>
                      <td className="table-cell text-ink-400 font-mono text-xs whitespace-nowrap">{formatDateShort(inq.created_at)}</td>

                      {type === 'lead' && <>
                        <td className="table-cell font-semibold text-ink-700 whitespace-nowrap">{inq.assigned_name||'—'}</td>
                        <td className="table-cell"><DispositionBadge disposition={inq.disposition} /></td>
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
                        <td className="table-cell"><DispositionBadge disposition={inq.disposition} /></td>
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
                        <td className="table-cell"><DispositionBadge disposition={inq.disposition} /></td>
                      </>}

                      <td className="table-cell" onClick={e => e.stopPropagation()}>
                        {user.role === 'manager' && (
                          <button onClick={e => handleDelete(e, inq.id)} disabled={deleting === inq.id}
                            className="btn-icon btn-sm text-red-400 hover:text-red-600 hover:bg-red-50 text-xs">
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

      {showNew && <NewInquiryModal defaultType={type} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load() }} />}
    </div>
  )
}
