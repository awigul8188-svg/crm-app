import { useState, useEffect } from 'react'
import { Bell, RefreshCw, Check } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../App'
import { useNav } from '../App'
import { formatDate, timeAgo } from '../components/Badges'
import PageHeader from '../components/PageHeader'

const BRAND = '#00D4C8'
const TYPE_LABELS = { lead: 'Lead', repeat: 'Repeat', online_order: 'Online Order' }
const TYPE_COLORS = { lead: '#3b82f6', repeat: '#6366f1', online_order: '#f59e0b' }

function FollowUpCard({ fu, onComplete, onNavigate }) {
  const [completing, setCompleting] = useState(false)
  const handleComplete = async (e) => {
    e.stopPropagation(); setCompleting(true)
    await api.completeFollowup(fu.id)
    onComplete()
  }
  return (
    <div
      onClick={() => onNavigate('inquiry-detail', { id: fu.inquiry_id })}
      className="card card-hover flex items-start gap-3 p-4 mb-2 cursor-pointer"
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
        style={{ background: `${BRAND}15`, color: BRAND }}>
        {fu.customer_name?.[0]?.toUpperCase() || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="font-bold text-sm text-ink-900">{fu.customer_name}</span>
          {fu.customer_company && <span className="text-xs text-ink-400">· {fu.customer_company}</span>}
          {fu.inquiry_type && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: `${TYPE_COLORS[fu.inquiry_type]}15`, color: TYPE_COLORS[fu.inquiry_type] }}>
              {TYPE_LABELS[fu.inquiry_type]}
            </span>
          )}
        </div>
        <p className="text-sm text-ink-600 mb-1">{fu.note}</p>
        <div className="flex gap-3 text-[11px] text-ink-400">
          {fu.follow_up_date && <span className="font-semibold text-amber-600">📅 {formatDate(fu.follow_up_date)}</span>}
          <span>{fu.assigned_name || '—'}</span>
        </div>
      </div>
      <button
        onClick={handleComplete}
        disabled={completing}
        title="Mark complete"
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-150 border-2 border-dashed border-ink-200 bg-transparent cursor-pointer hover:border-brand-400 hover:bg-brand-50"
      >
        {completing
          ? <span className="w-3 h-3 rounded-full border-2 border-brand-400 border-t-transparent spinner" />
          : <Check size={13} className="text-ink-400" />}
      </button>
    </div>
  )
}

function ActivityCard({ notif, onNavigate, onRead }) {
  const handleClick = async () => {
    if (!notif.read) await api.markNotificationRead(notif.id).catch(() => {})
    onRead(notif.id)
    if (notif.inquiry_id) onNavigate('inquiry-detail', { id: notif.inquiry_id })
  }
  const typeColor = TYPE_COLORS[notif.inquiry_type] || '#64748b'

  return (
    <div
      onClick={handleClick}
      className="flex items-start gap-3 p-4 rounded-2xl cursor-pointer transition-all duration-150 mb-2 border relative"
      style={{
        background: notif.read ? '#fff' : `${BRAND}05`,
        borderColor: notif.read ? '#f1f5f9' : `${BRAND}25`,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = BRAND; e.currentTarget.style.boxShadow = `0 2px 12px rgba(0,212,200,0.08)` }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = notif.read ? '#f1f5f9' : `${BRAND}25`; e.currentTarget.style.boxShadow = 'none' }}
    >
      {!notif.read && (
        <span className="absolute top-4 right-4 w-2 h-2 rounded-full" style={{ background: BRAND }} />
      )}
      <div className="w-9 h-9 rounded-xl bg-surface-100 text-ink-500 flex items-center justify-center font-bold text-sm flex-shrink-0">
        {notif.actor_name?.[0]?.toUpperCase() || '?'}
      </div>
      <div className="flex-1 min-w-0 pr-4">
        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
          <span className="font-bold text-sm text-ink-900">{notif.actor_name}</span>
          <span className="text-sm text-ink-500">{notif.action}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mb-1">
          <span className="text-sm font-semibold text-ink-900">{notif.customer_name}</span>
          {notif.inquiry_type && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: `${typeColor}15`, color: typeColor }}>
              {TYPE_LABELS[notif.inquiry_type] || notif.inquiry_type}
            </span>
          )}
        </div>
        {notif.comment && (
          <div className="text-xs text-ink-500 bg-surface-50 rounded-lg px-2.5 py-1.5 mb-1 italic">
            "{notif.comment}"
          </div>
        )}
        <div className="text-[11px] text-ink-400">
          {timeAgo(notif.created_at)}
          {notif.inquiry_id && <span className="text-brand-600 ml-2">View inquiry →</span>}
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ color, label, count }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      <span className="font-display font-bold text-xs uppercase tracking-[0.08em]" style={{ color }}>
        {label} — {count}
      </span>
    </div>
  )
}

export default function Notifications() {
  const { user } = useAuth()
  const { navigate } = useNav()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('activity')
  const [localActivity, setLocalActivity] = useState([])

  const load = () => {
    setLoading(true)
    api.getNotifications().then(d => {
      setData(d)
      setLocalActivity(d.activity || [])
      if (user.role === 'ae') setActiveTab('followups')
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleMarkAllRead = async () => {
    await api.markAllRead()
    setLocalActivity(prev => prev.map(n => ({ ...n, read: 1 })))
  }

  const handleRead = (id) => {
    setLocalActivity(prev => prev.map(n => n.id === id ? { ...n, read: 1 } : n))
  }

  const followupTotal = data ? data.followups.overdue.length + data.followups.today.length + data.followups.upcoming.length : 0
  const unreadActivity = localActivity.filter(n => !n.read).length

  const tabs = [
    ...(user.role === 'manager' ? [{ key: 'activity', label: 'Activity', count: unreadActivity }] : []),
    { key: 'followups', label: 'Follow-ups', count: followupTotal },
  ]

  const headerActions = (
    <div className="flex items-center gap-2">
      {user.role === 'manager' && unreadActivity > 0 && (
        <button onClick={handleMarkAllRead}
          className="btn btn-sm border text-brand-600 hover:bg-brand-50"
          style={{ borderColor: `${BRAND}40`, background: `${BRAND}08` }}>
          <Check size={13} /> Mark all read
        </button>
      )}
      <button onClick={load} className="btn-secondary btn-sm">
        <RefreshCw size={13} /> Refresh
      </button>
    </div>
  )

  return (
    <div className="page-wrap max-w-3xl">
      <PageHeader
        icon={<Bell size={18} />}
        title="Notifications"
        subtitle={user.role === 'manager' ? 'Team activity and follow-up reminders' : 'Your follow-up reminders'}
        action={headerActions}
      />

      {/* Tabs */}
      <div className="flex gap-0.5 bg-surface-100 rounded-2xl p-1 mb-5 border border-slate-200">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-150 border ${
              activeTab === tab.key
                ? 'bg-white text-ink-900 border-slate-200 shadow-card'
                : 'bg-transparent text-ink-400 border-transparent hover:text-ink-700'
            }`}>
            {tab.label}
            {tab.count > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                style={{ background: tab.key === 'activity' ? BRAND : '#f59e0b', color: '#0a0a0a' }}>
                {tab.count > 99 ? '99+' : tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-7 h-7 rounded-full border-2 border-brand-400 border-t-transparent spinner" />
        </div>
      ) : (
        <>
          {/* Activity tab */}
          {activeTab === 'activity' && user.role === 'manager' && (
            localActivity.length === 0 ? (
              <div className="card p-16 text-center">
                <Bell size={40} className="mx-auto mb-3 text-ink-200" />
                <div className="font-display font-bold text-ink-400 text-lg">No activity yet</div>
                <div className="text-ink-300 text-sm mt-1">Team actions will appear here</div>
              </div>
            ) : (
              <div>{localActivity.map(notif => <ActivityCard key={notif.id} notif={notif} onNavigate={navigate} onRead={handleRead} />)}</div>
            )
          )}

          {/* Follow-ups tab */}
          {activeTab === 'followups' && (
            followupTotal === 0 ? (
              <div className="card p-16 text-center">
                <Check size={40} className="mx-auto mb-3 text-ink-200" />
                <div className="font-display font-bold text-ink-400 text-lg">All caught up!</div>
                <div className="text-ink-300 text-sm mt-1">No pending follow-ups right now</div>
              </div>
            ) : (
              <div>
                {data.followups.overdue.length > 0 && (
                  <div className="mb-6">
                    <SectionLabel color="#ef4444" label="Overdue" count={data.followups.overdue.length} />
                    <div className="border-l-2 border-red-200 pl-4">
                      {data.followups.overdue.map(fu => <FollowUpCard key={fu.id} fu={fu} onComplete={load} onNavigate={navigate} />)}
                    </div>
                  </div>
                )}
                {data.followups.today.length > 0 && (
                  <div className="mb-6">
                    <SectionLabel color="#f59e0b" label="Due Today" count={data.followups.today.length} />
                    <div className="border-l-2 border-amber-200 pl-4">
                      {data.followups.today.map(fu => <FollowUpCard key={fu.id} fu={fu} onComplete={load} onNavigate={navigate} />)}
                    </div>
                  </div>
                )}
                {data.followups.upcoming.length > 0 && (
                  <div className="mb-6">
                    <SectionLabel color={BRAND} label="This Week" count={data.followups.upcoming.length} />
                    <div className="border-l-2 pl-4" style={{ borderColor: `${BRAND}40` }}>
                      {data.followups.upcoming.map(fu => <FollowUpCard key={fu.id} fu={fu} onComplete={load} onNavigate={navigate} />)}
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </>
      )}
    </div>
  )
}
