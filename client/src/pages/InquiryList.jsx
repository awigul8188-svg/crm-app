import { useState, useEffect } from 'react'
import { api } from '../api'
import { useNav } from '../App'
import { DispositionBadge, DISPOSITIONS, LEAD_SOURCES, formatDateShort } from '../components/Badges'
import NewInquiryModal from '../components/NewInquiryModal'

const TYPE_ICONS = { lead: '◎', repeat: '↻', online_order: '◈' }
const TYPE_LABELS = { lead: 'Lead', repeat: 'Repeat Inquiry', online_order: 'Online Order' }

export default function InquiryList({ type, title }) {
  const { navigate } = useNav()
  const [inquiries, setInquiries] = useState([])
  const [loading, setLoading] = useState(true)
  const [dispositionFilter, setDispositionFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [search, setSearch] = useState('')

  const load = () => {
    setLoading(true)
    api.getInquiries(type, undefined, dispositionFilter || undefined)
      .then(d => { setInquiries(d); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [type, dispositionFilter])

  const filtered = inquiries.filter(i => {
    if (sourceFilter && i.lead_source !== sourceFilter) return false
    if (!search) return true
    const s = search.toLowerCase()
    return i.customer_name?.toLowerCase().includes(s) || i.customer_company?.toLowerCase().includes(s) || i.customer_email?.toLowerCase().includes(s) || i.requirements?.some(r => r.part_number.toLowerCase().includes(s))
  })

  const headers = {
    lead: ['Date','Assigned To','Disposition','Lead Source','Name','Email','Company','Ph#','Part Number','Qty','Comments'],
    repeat: ['Date','Disposition','Assigned To','Name','Email','Phone','Company','Part#','Qty','Comments','PPC/Outbound'],
    online_order: ['Date','Name','Email','Part Number','Total Qty','Order Amount','Source','Assigned To','Comments','Order #','Status'],
  }

  return (
    <div className="p-8 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-ink-900 flex items-center gap-2.5">
            <span className="text-ink-400">{TYPE_ICONS[type]}</span> {title}
          </h1>
          <p className="text-ink-400 text-sm mt-0.5">{filtered.length} records</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary">
          + New {TYPE_LABELS[type]}
        </button>
      </div>

      {/* Filters bar */}
      <div className="flex gap-2.5 mb-5 flex-wrap">
        <div className="relative">
          <input className="input pl-8 max-w-xs" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300 text-sm">⌕</span>
        </div>
        <select className="input max-w-52" value={dispositionFilter} onChange={e => setDispositionFilter(e.target.value)}>
          <option value="">All Dispositions</option>
          {DISPOSITIONS.map(d => <option key={d}>{d}</option>)}
        </select>
        {type !== 'online_order' && (
          <select className="input max-w-44" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
            <option value="">All Sources</option>
            {LEAD_SOURCES.map(s => <option key={s}>{s}</option>)}
          </select>
        )}
        {(dispositionFilter || sourceFilter || search) && (
          <button onClick={() => { setDispositionFilter(''); setSourceFilter(''); setSearch('') }} className="btn btn-ghost text-red-500 hover:bg-red-50 text-sm">✕ Clear</button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-24"><div className="w-7 h-7 rounded-full border-2 border-brand-400 border-t-transparent spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="text-5xl mb-3 opacity-30">{TYPE_ICONS[type]}</div>
          <div className="font-display font-bold text-ink-400">No {title.toLowerCase()} found</div>
          <div className="text-ink-300 text-sm mt-1">Try adjusting filters or create a new one</div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  {headers[type].map(h => <th key={h} className="text-left px-4 py-3">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map(inq => {
                  const partNums = inq.requirements?.map(r => r.part_number).join(', ') || '—'
                  const qtys = inq.requirements?.map(r => r.quantity).join(', ') || '—'
                  const totalQty = inq.requirements?.reduce((s, r) => { const n = parseInt(r.quantity); return s + (isNaN(n) ? 0 : n) }, 0) || '—'

                  return (
                    <tr key={inq.id} className="table-row" onClick={() => navigate('inquiry-detail', { id: inq.id })}>
                      <td className="table-cell text-ink-400 whitespace-nowrap font-mono text-xs">{formatDateShort(inq.created_at)}</td>
                      {type === 'lead' && <>
                        <td className="table-cell"><span className="font-semibold text-ink-700">{inq.assigned_name || '—'}</span></td>
                        <td className="table-cell"><DispositionBadge disposition={inq.disposition} /></td>
                        <td className="table-cell text-ink-500 text-xs whitespace-nowrap">{inq.lead_source || '—'}</td>
                        <td className="table-cell font-semibold text-ink-900 whitespace-nowrap">{inq.customer_name}</td>
                        <td className="table-cell text-ink-500 text-xs">{inq.customer_email || '—'}</td>
                        <td className="table-cell text-ink-500 text-xs whitespace-nowrap">{inq.customer_company || '—'}</td>
                        <td className="table-cell text-ink-500 text-xs whitespace-nowrap">{inq.customer_phone || '—'}</td>
                        <td className="table-cell font-mono text-xs text-ink-700 max-w-[160px] truncate">{partNums}</td>
                        <td className="table-cell text-ink-600 text-xs">{qtys}</td>
                        <td className="table-cell text-ink-400 text-xs max-w-[160px] truncate">{inq.notes || '—'}</td>
                      </>}
                      {type === 'repeat' && <>
                        <td className="table-cell"><DispositionBadge disposition={inq.disposition} /></td>
                        <td className="table-cell font-semibold text-ink-700">{inq.assigned_name || '—'}</td>
                        <td className="table-cell font-semibold text-ink-900 whitespace-nowrap">{inq.customer_name}</td>
                        <td className="table-cell text-ink-500 text-xs">{inq.customer_email || '—'}</td>
                        <td className="table-cell text-ink-500 text-xs">{inq.customer_phone || '—'}</td>
                        <td className="table-cell text-ink-500 text-xs whitespace-nowrap">{inq.customer_company || '—'}</td>
                        <td className="table-cell font-mono text-xs text-ink-700 max-w-[140px] truncate">{partNums}</td>
                        <td className="table-cell text-ink-600 text-xs">{qtys}</td>
                        <td className="table-cell text-ink-400 text-xs max-w-[140px] truncate">{inq.notes || '—'}</td>
                        <td className="table-cell text-xs"><span className={`badge ${inq.ppc_or_outbound ? 'bg-violet-50 text-violet-600 border-violet-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>{inq.ppc_or_outbound || '—'}</span></td>
                      </>}
                      {type === 'online_order' && <>
                        <td className="table-cell font-semibold text-ink-900 whitespace-nowrap">{inq.customer_name}</td>
                        <td className="table-cell text-ink-500 text-xs">{inq.customer_email || '—'}</td>
                        <td className="table-cell font-mono text-xs text-ink-700 max-w-[140px] truncate">{partNums}</td>
                        <td className="table-cell text-ink-700 font-semibold">{totalQty}</td>
                        <td className="table-cell font-semibold text-green-700">{inq.order_amount || '—'}</td>
                        <td className="table-cell text-ink-500 text-xs whitespace-nowrap">{inq.lead_source || '—'}</td>
                        <td className="table-cell font-semibold text-ink-700">{inq.assigned_name || '—'}</td>
                        <td className="table-cell text-ink-400 text-xs max-w-[140px] truncate">{inq.notes || '—'}</td>
                        <td className="table-cell font-mono text-xs text-ink-500">{inq.order_ref || '—'}</td>
                        <td className="table-cell"><DispositionBadge disposition={inq.disposition} /></td>
                      </>}
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
