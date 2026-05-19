import { useState, useEffect } from 'react'
import { api } from '../api'
import { useAuth } from '../App'
import { useNav } from '../App'
import { formatDate, timeAgo } from '../components/Badges'

const BRAND = '#00D4C8'
const TYPE_ICONS = { lead: '◎', repeat: '↻', online_order: '◈' }
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
      style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 16px', background: '#fff', borderRadius: '14px', border: '1px solid #f1f5f9', cursor: 'pointer', transition: 'all 0.15s', marginBottom: '8px' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = BRAND; e.currentTarget.style.boxShadow = `0 2px 12px rgba(0,212,200,0.1)` }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#f1f5f9'; e.currentTarget.style.boxShadow = 'none' }}
    >
      <div style={{ width: 36, height: 36, borderRadius: '10px', background: `${BRAND}18`, color: BRAND, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', flexShrink: 0 }}>
        {fu.customer_name?.[0]?.toUpperCase() || '?'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '3px' }}>
          <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>{fu.customer_name}</span>
          {fu.customer_company && <span style={{ fontSize: '12px', color: '#94a3b8' }}>· {fu.customer_company}</span>}
          {fu.inquiry_type && (
            <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: `${TYPE_COLORS[fu.inquiry_type]}18`, color: TYPE_COLORS[fu.inquiry_type] }}>
              {TYPE_ICONS[fu.inquiry_type]} {TYPE_LABELS[fu.inquiry_type]}
            </span>
          )}
        </div>
        <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 4px' }}>{fu.note}</p>
        <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#94a3b8' }}>
          {fu.follow_up_date && <span style={{ color: '#f59e0b', fontWeight: 600 }}>📅 {formatDate(fu.follow_up_date)}</span>}
          <span>👤 {fu.assigned_name || '—'}</span>
        </div>
      </div>
      <button
        onClick={handleComplete}
        disabled={completing}
        title="Mark complete"
        style={{ width: 32, height: 32, borderRadius: '10px', border: `2px dashed #cbd5e1`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = BRAND; e.currentTarget.style.background = `${BRAND}12` }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = 'transparent' }}
      >
        {completing ? <div style={{ width: 12, height: 12, borderRadius: '50%', border: `2px solid ${BRAND}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} /> : <span style={{ color: '#94a3b8', fontSize: '13px' }}>✓</span>}
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
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '12px',
        padding: '14px 16px', borderRadius: '14px', cursor: 'pointer',
        background: notif.read ? '#fff' : `${BRAND}06`,
        border: `1px solid ${notif.read ? '#f1f5f9' : `${BRAND}30`}`,
        transition: 'all 0.15s', marginBottom: '8px', position: 'relative',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = BRAND; e.currentTarget.style.boxShadow = `0 2px 12px rgba(0,212,200,0.1)` }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = notif.read ? '#f1f5f9' : `${BRAND}30`; e.currentTarget.style.boxShadow = 'none' }}
    >
      {/* Unread dot */}
      {!notif.read && (
        <div style={{ position: 'absolute', top: '16px', right: '16px', width: 8, height: 8, borderRadius: '50%', background: BRAND }} />
      )}

      {/* Actor avatar */}
      <div style={{ width: 36, height: 36, borderRadius: '10px', background: '#f1f5f9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', flexShrink: 0 }}>
        {notif.actor_name?.[0]?.toUpperCase() || '?'}
      </div>

      <div style={{ flex: 1, minWidth: 0, paddingRight: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '3px' }}>
          <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>{notif.actor_name}</span>
          <span style={{ fontSize: '13px', color: '#475569' }}>{notif.action}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>{notif.customer_name}</span>
          {notif.inquiry_type && (
            <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: `${typeColor}18`, color: typeColor }}>
              {notif.type_icon || TYPE_ICONS[notif.inquiry_type]} {TYPE_LABELS[notif.inquiry_type] || notif.inquiry_type}
            </span>
          )}
        </div>

        {notif.comment && (
          <div style={{ fontSize: '12px', color: '#64748b', background: '#f8fafc', borderRadius: '8px', padding: '6px 10px', marginBottom: '4px', fontStyle: 'italic' }}>
            "{notif.comment}"
          </div>
        )}

        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
          {timeAgo(notif.created_at)}
          {notif.inquiry_id && <span style={{ color: BRAND, marginLeft: '8px' }}>View inquiry →</span>}
        </div>
      </div>
    </div>
  )
}

export default function Notifications() {
  const { user } = useAuth()
  const { navigate } = useNav()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('activity') // managers default to activity
  const [localActivity, setLocalActivity] = useState([])

  const load = () => {
    setLoading(true)
    api.getNotifications().then(d => {
      setData(d)
      setLocalActivity(d.activity || [])
      // Default tab: managers → activity, AEs → followups
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

  const quoteNotifs = (data?.activity || []).filter(n => n.inquiry_type === 'quote')
  const unreadQuotes = quoteNotifs.filter(n => !n.read).length
  const activityNotifs = (data?.activity || []).filter(n => n.inquiry_type !== 'quote')
  const unreadActivityFiltered = activityNotifs.filter(n => !n.read).length

  const tabs = [
    ...(user.role === 'manager' || user.role === 'purchasing_manager' ? [{ key: 'activity', label: 'Activity', count: unreadActivityFiltered }] : []),
    { key: 'followups', label: 'Follow-ups', count: followupTotal },
    ...(['manager','purchasing_manager','ae'].includes(user.role) ? [{ key: 'quotes', label: '🔧 Quotes', count: unreadQuotes }] : []),
  ]

  return (
    <div className="p-8 max-w-3xl fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-ink-900 flex items-center gap-2">
            🔔 Notifications
          </h1>
          <p className="text-ink-400 text-sm mt-0.5">
            {user.role === 'manager' ? 'Team activity and follow-up reminders' : 'Your follow-up reminders'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {user.role === 'manager' && unreadActivity > 0 && (
            <button onClick={handleMarkAllRead}
              style={{ padding: '8px 14px', borderRadius: '10px', border: `1px solid ${BRAND}40`, background: `${BRAND}10`, color: '#00b8ad', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
              ✓ Mark all read
            </button>
          )}
          <button onClick={load} className="btn-secondary btn-sm">↻ Refresh</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', borderRadius: '12px', padding: '4px', marginBottom: '20px' }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, padding: '9px 16px', borderRadius: '10px', border: 'none',
              background: activeTab === tab.key ? '#fff' : 'transparent',
              color: activeTab === tab.key ? '#0f172a' : '#64748b',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              boxShadow: activeTab === tab.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s', fontFamily: '"Plus Jakarta Sans", sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}>
            {tab.label}
            {tab.count > 0 && (
              <span style={{ background: tab.key === 'activity' ? BRAND : '#f59e0b', color: tab.key === 'activity' ? '#0d0d0d' : '#0d0d0d', fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '20px', minWidth: '18px', textAlign: 'center' }}>
                {tab.count > 99 ? '99+' : tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${BRAND}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <>
          {/* Activity tab — managers only */}
          {activeTab === 'activity' && user.role === 'manager' && (
            <div>
              {localActivity.length === 0 ? (
                <div className="card p-16 text-center">
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
                  <div className="font-display font-bold text-ink-400 text-lg">No activity yet</div>
                  <div className="text-ink-300 text-sm mt-1">Team actions will appear here</div>
                </div>
              ) : (
                <div>
                  {localActivity.map(notif => (
                    <ActivityCard key={notif.id} notif={notif} onNavigate={navigate} onRead={handleRead} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Follow-ups tab */}
          {activeTab === 'followups' && (
            <div>
              {followupTotal === 0 ? (
                <div className="card p-16 text-center">
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
                  <div className="font-display font-bold text-ink-400 text-lg">All caught up!</div>
                  <div className="text-ink-300 text-sm mt-1">No pending follow-ups right now</div>
                </div>
              ) : (
                <div>
                  {/* Overdue */}
                  {data.followups.overdue.length > 0 && (
                    <div style={{ marginBottom: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse 2s infinite' }} />
                        <span style={{ fontFamily: '"Bricolage Grotesque", sans-serif', fontWeight: 700, fontSize: '12px', color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          Overdue — {data.followups.overdue.length}
                        </span>
                      </div>
                      <div style={{ borderLeft: '2px solid #fecaca', paddingLeft: '16px' }}>
                        {data.followups.overdue.map(fu => <FollowUpCard key={fu.id} fu={fu} onComplete={load} onNavigate={navigate} />)}
                      </div>
                    </div>
                  )}

                  {/* Due Today */}
                  {data.followups.today.length > 0 && (
                    <div style={{ marginBottom: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                        <span style={{ fontFamily: '"Bricolage Grotesque", sans-serif', fontWeight: 700, fontSize: '12px', color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          Due Today — {data.followups.today.length}
                        </span>
                      </div>
                      <div style={{ borderLeft: '2px solid #fde68a', paddingLeft: '16px' }}>
                        {data.followups.today.map(fu => <FollowUpCard key={fu.id} fu={fu} onComplete={load} onNavigate={navigate} />)}
                      </div>
                    </div>
                  )}

                  {/* This Week */}
                  {data.followups.upcoming.length > 0 && (
                    <div style={{ marginBottom: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: BRAND }} />
                        <span style={{ fontFamily: '"Bricolage Grotesque", sans-serif', fontWeight: 700, fontSize: '12px', color: '#00b8ad', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          This Week — {data.followups.upcoming.length}
                        </span>
                      </div>
                      <div style={{ borderLeft: `2px solid ${BRAND}40`, paddingLeft: '16px' }}>
                        {data.followups.upcoming.map(fu => <FollowUpCard key={fu.id} fu={fu} onComplete={load} onNavigate={navigate} />)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }`}</style>
    </div>
  )
}
