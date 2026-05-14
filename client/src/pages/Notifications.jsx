import { useState, useEffect } from 'react'
import { api } from '../api'
import { useNav } from '../App'
import { formatDate, timeAgo } from '../components/Badges'

const TYPE_ICONS = { lead: '◎', repeat: '↻', online_order: '◈' }
const TYPE_LABELS = { lead: 'Lead', repeat: 'Repeat', online_order: 'Online Order' }

function FollowUpCard({ fu, onComplete, onNavigate }) {
  const [completing, setCompleting] = useState(false)

  const handleComplete = async (e) => {
    e.stopPropagation()
    setCompleting(true)
    await api.completeFollowup(fu.id)
    onComplete()
  }

  return (
    <div className="flex items-start gap-3 p-4 bg-white rounded-xl border border-slate-100 hover:border-brand-200 transition-all cursor-pointer"
      onClick={() => onNavigate('inquiry-detail', { id: fu.inquiry_id })}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm flex-shrink-0 font-bold"
        style={{ background: 'rgba(0,212,200,0.1)', color: '#00D4C8' }}>
        {fu.customer_name?.[0]?.toUpperCase() || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="font-semibold text-ink-900 text-sm">{fu.customer_name}</span>
          {fu.customer_company && <span className="text-ink-400 text-xs">· {fu.customer_company}</span>}
          <span className="badge bg-slate-50 text-ink-500 border-slate-200 text-xs">{TYPE_ICONS[fu.inquiry_type]} {TYPE_LABELS[fu.inquiry_type]}</span>
        </div>
        <p className="text-sm text-ink-600 mb-1">{fu.note}</p>
        <div className="flex items-center gap-3 text-xs text-ink-400">
          {fu.follow_up_date && <span>📅 {formatDate(fu.follow_up_date)}</span>}
          <span>👤 {fu.assigned_name || '—'}</span>
        </div>
      </div>
      <button
        onClick={handleComplete}
        disabled={completing}
        className="flex-shrink-0 w-8 h-8 rounded-xl border-2 border-dashed border-ink-300 hover:border-brand-400 flex items-center justify-center transition-all"
        title="Mark complete"
      >
        {completing ? <div className="w-3 h-3 rounded-full border border-brand-400 border-t-transparent spinner" /> : <span className="text-ink-300 text-xs">✓</span>}
      </button>
    </div>
  )
}

export default function Notifications() {
  const { navigate } = useNav()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    api.getNotifications().then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const total = data ? data.overdue.length + data.today.length + data.upcoming.length : 0

  return (
    <div className="p-8 max-w-3xl fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-ink-900 flex items-center gap-2">
            🔔 Follow-up Notifications
            {total > 0 && (
              <span className="text-sm font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: '#00D4C8' }}>{total}</span>
            )}
          </h1>
          <p className="text-ink-400 text-sm mt-0.5">Pending follow-ups across all your inquiries</p>
        </div>
        <button onClick={load} className="btn-secondary btn-sm">↻ Refresh</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-7 h-7 rounded-full border-2 border-t-transparent spinner" style={{ borderColor: '#00D4C8 transparent transparent' }} />
        </div>
      ) : total === 0 ? (
        <div className="card p-16 text-center">
          <div className="text-5xl mb-3">✅</div>
          <div className="font-display font-bold text-ink-400 text-lg">All caught up!</div>
          <div className="text-ink-300 text-sm mt-1">No pending follow-ups right now</div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overdue */}
          {data.overdue.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <h2 className="font-display font-bold text-sm text-red-600 uppercase tracking-wide">
                  Overdue — {data.overdue.length}
                </h2>
              </div>
              <div className="space-y-2 border-l-2 border-red-200 pl-4">
                {data.overdue.map(fu => (
                  <FollowUpCard key={fu.id} fu={fu} onComplete={load} onNavigate={navigate} />
                ))}
              </div>
            </div>
          )}

          {/* Due Today */}
          {data.today.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <h2 className="font-display font-bold text-sm text-amber-600 uppercase tracking-wide">
                  Due Today — {data.today.length}
                </h2>
              </div>
              <div className="space-y-2 border-l-2 border-amber-200 pl-4">
                {data.today.map(fu => (
                  <FollowUpCard key={fu.id} fu={fu} onComplete={load} onNavigate={navigate} />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming */}
          {data.upcoming.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full" style={{ background: '#00D4C8' }} />
                <h2 className="font-display font-bold text-sm uppercase tracking-wide" style={{ color: '#00b8ad' }}>
                  This Week — {data.upcoming.length}
                </h2>
              </div>
              <div className="space-y-2 border-l-2 pl-4" style={{ borderColor: 'rgba(0,212,200,0.3)' }}>
                {data.upcoming.map(fu => (
                  <FollowUpCard key={fu.id} fu={fu} onComplete={load} onNavigate={navigate} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
