import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { api } from '../api'
import { useAuth } from '../App'
import { useNav } from '../App'
import { DISPOSITIONS, LEAD_SOURCES, DispositionBadge, formatDate } from '../components/Badges'

const CHART_COLORS = ['#3b82f6','#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#06b6d4','#f97316','#84cc16','#ef4444']
const TYPE_COLORS = { lead: '#3b82f6', repeat: '#6366f1', online_order: '#f59e0b' }
const TYPE_LABELS = { lead: 'Leads', repeat: 'Repeat', online_order: 'Orders' }

const DATE_RANGES = [
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'This Quarter', value: 'quarter' },
  { label: 'All Time', value: 'all' },
]

function getDateRange(value) {
  const now = new Date()
  const fmt = d => d.toISOString().split('T')[0]
  const today = fmt(now)
  if (value === 'today') return { from: today, to: today }
  if (value === 'week') { const d = new Date(now); d.setDate(d.getDate() - 7); return { from: fmt(d), to: today } }
  if (value === 'month') { const d = new Date(now); d.setDate(1); return { from: fmt(d), to: today } }
  if (value === 'quarter') { const d = new Date(now); d.setMonth(d.getMonth() - 3); return { from: fmt(d), to: today } }
  return { from: '', to: '' }
}

function StatCard({ label, value, sub, icon, accent }) {
  return (
    <div className="card p-5 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full rounded-l-2xl" style={{ background: accent }} />
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-1">{label}</div>
          <div className="text-3xl font-display font-bold text-ink-900">{value ?? '—'}</div>
          {sub && <div className="text-xs text-ink-400 mt-1">{sub}</div>}
        </div>
        <div className="text-2xl opacity-60">{icon}</div>
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-ink-900 text-white rounded-xl px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold mb-1">{label}</div>
      {payload.map(p => <div key={p.name} style={{ color: p.color }}>{p.name}: <span className="font-bold">{p.value}</span></div>)}
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const { navigate } = useNav()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [dateRange, setDateRange] = useState('month')
  const [filters, setFilters] = useState({ lead_source: '', disposition: '', assigned_to: '', type: '' })

  const load = () => {
    setLoading(true)
    const dateF = getDateRange(dateRange)
    api.getAnalytics({ ...dateF, ...filters }).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [dateRange, filters])
  useEffect(() => { api.getUsers().then(setUsers) }, [])

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }))

  const getTotal = (type) => data?.totals?.find(t => t.type === type)?.count || 0
  const totalAll = (data?.totals || []).reduce((s, t) => s + t.count, 0)
  const wonRate = data?.totalCount > 0 ? Math.round(data.wonCount / data.totalCount * 100) : 0

  // Build trend data
  const trendDates = [...new Set((data?.trend || []).map(t => t.date))].sort()
  const trendData = trendDates.map(date => {
    const row = { date: date.slice(5) }
    ;['lead', 'repeat', 'online_order'].forEach(type => {
      const found = data?.trend?.find(t => t.date === date && t.type === type)
      row[type] = found?.count || 0
    })
    return row
  })

  const greeting = () => {
    const h = new Date().getHours()
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  }

  return (
    <div className="p-8 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-ink-900">{greeting()}, {user.name} ✌️</h1>
          <p className="text-ink-400 text-sm mt-0.5">Here's what's going on</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white border border-slate-200 rounded-xl p-1 gap-0.5">
            {DATE_RANGES.map(r => (
              <button key={r.value} onClick={() => setDateRange(r.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${dateRange === r.value ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2.5 mb-6 flex-wrap">
        {[
          { key: 'type', label: 'All Types', opts: [['lead','Leads'],['repeat','Repeat'],['online_order','Online Orders']] },
          { key: 'disposition', label: 'All Dispositions', opts: DISPOSITIONS.map(d => [d, d]) },
          { key: 'lead_source', label: 'All Sources', opts: LEAD_SOURCES.map(s => [s, s]) },
          ...(user.role === 'manager' ? [{ key: 'assigned_to', label: 'All Users', opts: users.map(u => [u.id, u.name]) }] : []),
        ].map(({ key, label, opts }) => (
          <select key={key} value={filters[key]} onChange={e => setFilter(key, e.target.value)}
            className="input-sm input max-w-48 bg-white">
            <option value="">{label}</option>
            {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}
        {Object.values(filters).some(Boolean) && (
          <button onClick={() => setFilters({ lead_source: '', disposition: '', assigned_to: '', type: '' })} className="btn btn-ghost btn-sm text-red-500 hover:bg-red-50">
            ✕ Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32"><div className="w-8 h-8 rounded-full border-2 border-brand-400 border-t-transparent spinner" /></div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Leads" value={getTotal('lead')} icon="◎" accent="#3b82f6" sub="Click to view" />
            <StatCard label="Repeat Inquiries" value={getTotal('repeat')} icon="↻" accent="#6366f1" />
            <StatCard label="Online Orders" value={getTotal('online_order')} icon="◈" accent="#f59e0b" />
            <StatCard label="Win Rate" value={`${wonRate}%`} icon="★" accent="#10b981" sub={`${data?.wonCount || 0} of ${data?.totalCount || 0} closed won`} />
          </div>

          <div className="grid grid-cols-3 gap-5 mb-5">
            {/* Trend chart */}
            <div className="card p-5 col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-sm text-ink-900">Activity Trend</h3>
                <div className="flex gap-3">
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-1.5 text-xs text-ink-500">
                      <span className="w-2 h-2 rounded-full" style={{ background: TYPE_COLORS[k] }} />{v}
                    </div>
                  ))}
                </div>
              </div>
              {trendData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-ink-300 text-sm">No data for this period</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={trendData} barSize={6} barGap={2}>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="lead" name="Leads" fill={TYPE_COLORS.lead} radius={[3,3,0,0]} />
                    <Bar dataKey="repeat" name="Repeat" fill={TYPE_COLORS.repeat} radius={[3,3,0,0]} />
                    <Bar dataKey="online_order" name="Orders" fill={TYPE_COLORS.online_order} radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Disposition pie */}
            <div className="card p-5">
              <h3 className="font-display font-bold text-sm text-ink-900 mb-4">By Disposition</h3>
              {!data?.byDisposition?.length ? (
                <div className="h-48 flex items-center justify-center text-ink-300 text-sm">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={data.byDisposition.slice(0, 8)} dataKey="count" nameKey="disposition" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                      {data.byDisposition.slice(0, 8).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="space-y-1.5 mt-2">
                {data?.byDisposition?.slice(0, 5).map((d, i) => (
                  <div key={d.disposition} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i] }} />
                      <span className="text-ink-600 truncate max-w-[120px]">{d.disposition || 'Unknown'}</span>
                    </div>
                    <span className="font-semibold text-ink-900">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5 mb-5">
            {/* By person */}
            <div className="card p-5">
              <h3 className="font-display font-bold text-sm text-ink-900 mb-4">By Team Member</h3>
              {!data?.byPerson?.length ? (
                <div className="h-32 flex items-center justify-center text-ink-300 text-sm">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data.byPerson} layout="vertical" barSize={14}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} width={60} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Total" fill="#3b82f6" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* By source */}
            <div className="card p-5">
              <h3 className="font-display font-bold text-sm text-ink-900 mb-4">By Lead Source</h3>
              {!data?.bySource?.filter(s => s.source)?.length ? (
                <div className="h-32 flex items-center justify-center text-ink-300 text-sm">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data.bySource.filter(s => s.source)} layout="vertical" barSize={14}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="source" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Count" fill="#6366f1" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Upcoming follow-ups */}
          {data?.upcomingFollowups?.length > 0 && (
            <div className="card p-5">
              <h3 className="font-display font-bold text-sm text-ink-900 mb-4">📅 Upcoming Follow-ups</h3>
              <div className="space-y-2">
                {data.upcomingFollowups.map(fu => (
                  <div key={fu.id} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500 text-sm">📅</div>
                      <div>
                        <div className="text-sm font-semibold text-ink-800">{fu.customer_name}</div>
                        <div className="text-xs text-ink-400 mt-0.5">{fu.note}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-ink-600">{formatDate(fu.follow_up_date)}</div>
                      <div className="text-xs text-ink-400">{fu.assigned_name}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
