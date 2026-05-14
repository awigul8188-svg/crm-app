import { useState, useEffect } from 'react'
import { api } from '../api'
import { useAuth } from '../App'
import { useNav } from '../App'

function StatCard({ icon, label, value, sub, color, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`card p-5 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-2xl mb-1">{icon}</div>
          <div className="text-2xl font-display font-bold text-gray-900">{value}</div>
          <div className="text-sm font-medium text-gray-600 mt-0.5">{label}</div>
        </div>
        {sub !== undefined && (
          <div className={`text-xs font-semibold px-2 py-1 rounded-lg ${color}`}>{sub} open</div>
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const { navigate } = useNav()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getStats().then(s => { setStats(s); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const total = (obj) => (obj?.open || 0) + (obj?.in_progress || 0)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display font-bold text-2xl text-gray-900">
          {greeting()}, {user.name} ✌️
        </h1>
        <p className="text-gray-500 text-sm mt-1">Here's what's happening today</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon="🎯" label="Leads" value={total(stats?.leads)}
          sub={stats?.leads?.open} color="bg-blue-50 text-blue-600"
          onClick={() => navigate('leads')}
        />
        <StatCard
          icon="🔁" label="Repeat Inquiries" value={total(stats?.repeat)}
          sub={stats?.repeat?.open} color="bg-violet-50 text-violet-600"
          onClick={() => navigate('repeat')}
        />
        <StatCard
          icon="🛒" label="Online Orders" value={total(stats?.orders)}
          sub={stats?.orders?.open} color="bg-amber-50 text-amber-600"
          onClick={() => navigate('orders')}
        />
        <StatCard
          icon="📅" label="Upcoming Follow-ups" value={stats?.upcomingFollowups ?? 0}
          color="bg-brand-50 text-brand-600"
        />
      </div>

      {/* Status breakdown */}
      {stats && (
        <div className="card p-6">
          <h2 className="font-display font-bold text-base text-gray-900 mb-4">Status Breakdown</h2>
          <div className="space-y-4">
            {[
              { label: 'Leads', data: stats.leads, icon: '🎯', nav: 'leads' },
              { label: 'Repeat Inquiries', data: stats.repeat, icon: '🔁', nav: 'repeat' },
              { label: 'Online Orders', data: stats.orders, icon: '🛒', nav: 'orders' },
            ].map(({ label, data, icon, nav }) => {
              const t = (data?.open || 0) + (data?.in_progress || 0) + (data?.closed || 0)
              return (
                <div key={label} className="flex items-center gap-4">
                  <div className="w-28 text-sm text-gray-600 flex items-center gap-1.5">
                    <span>{icon}</span> {label}
                  </div>
                  <div className="flex-1 flex gap-1.5 h-2">
                    {[
                      { key: 'open', color: 'bg-blue-400' },
                      { key: 'in_progress', color: 'bg-amber-400' },
                      { key: 'closed', color: 'bg-gray-300' },
                    ].map(({ key, color }) => (
                      <div
                        key={key}
                        className={`${color} rounded-full transition-all`}
                        style={{ width: t ? `${(data?.[key] || 0) / t * 100}%` : '0%', minWidth: data?.[key] ? '4px' : '0' }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-3 text-xs text-gray-500 w-40">
                    <span className="text-blue-500">{data?.open || 0} open</span>
                    <span className="text-amber-500">{data?.in_progress || 0} in progress</span>
                    <span>{data?.closed || 0} closed</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
