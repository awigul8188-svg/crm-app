import { useState, useEffect } from 'react'
import { api } from '../api'
import { useAuth } from '../App'
import { useNav } from '../App'
import { StatusBadge, timeAgo } from '../components/Badges'
import Modal from '../components/Modal'
import NewInquiryModal from '../components/NewInquiryModal'

const STATUS_OPTIONS = ['open', 'in_progress', 'closed', 'won', 'lost']

const TYPE_ICONS = { lead: '🎯', repeat: '🔁', online_order: '🛒' }

export default function InquiryList({ type, title }) {
  const { user } = useAuth()
  const { navigate } = useNav()
  const [inquiries, setInquiries] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [search, setSearch] = useState('')

  const load = () => {
    setLoading(true)
    api.getInquiries(type, statusFilter || undefined)
      .then(data => { setInquiries(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [type, statusFilter])

  const filtered = inquiries.filter(i => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      i.customer_name?.toLowerCase().includes(s) ||
      i.customer_company?.toLowerCase().includes(s) ||
      i.requirements?.some(r => r.part_number.toLowerCase().includes(s))
    )
  })

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-900 flex items-center gap-2">
            {TYPE_ICONS[type]} {title}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{filtered.length} records</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-1.5">
          + New {title.replace(' Inquiries', '').replace('Online ', '')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <input
          className="input max-w-xs"
          placeholder="Search customer, company, part..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="input max-w-40" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">{TYPE_ICONS[type]}</div>
          <div className="font-medium">No {title.toLowerCase()} yet</div>
          <div className="text-sm mt-1">Create your first one ↗</div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(inq => (
            <div
              key={inq.id}
              onClick={() => navigate('inquiry-detail', { id: inq.id })}
              className="card p-4 cursor-pointer hover:shadow-md transition-all duration-150 hover:border-brand-200"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900 text-sm">{inq.customer_name}</span>
                    {inq.customer_company && (
                      <span className="text-gray-400 text-xs">· {inq.customer_company}</span>
                    )}
                  </div>
                  {inq.requirements?.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {inq.requirements.map(r => (
                        <span key={r.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg font-mono">
                          {r.part_number} × {r.quantity}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">No requirements added</span>
                  )}
                  {inq.notes && (
                    <p className="text-xs text-gray-500 mt-1.5 truncate">{inq.notes}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <StatusBadge status={inq.status} />
                  <span className="text-xs text-gray-400">
                    {inq.assigned_name && <span className="text-gray-500 font-medium">{inq.assigned_name} · </span>}
                    {timeAgo(inq.created_at)}
                  </span>
                </div>
              </div>
            </div>
          ))}
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
