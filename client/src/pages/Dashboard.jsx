import { useState, useEffect, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { api } from '../api'
import { useAuth } from '../App'
import { useNav } from '../App'
import { DISPOSITIONS, LEAD_SOURCES, formatDate } from '../components/Badges'
import MultiSelect from '../components/MultiSelect'

const CHART_COLORS = ['#00D4C8','#00D4C8','#2dd4bf','#0891b2','#3b82f6','#6366f1','#8b5cf6','#f59e0b','#f97316','#ef4444']
const TYPE_COLORS = { lead: '#00D4C8', repeat: '#3b82f6', online_order: '#f59e0b' }
const TYPE_LABELS = { lead: 'Leads', repeat: 'Repeat', online_order: 'Orders' }

const PRESET_RANGES = [
  { label: 'Today',     value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month',value: 'month' },
  { label: 'Quarter',   value: 'quarter' },
  { label: 'All Time',  value: 'all' },
  { label: 'Custom',    value: 'custom' },
]

function getPresetDates(value) {
  const fmt = d => d.toISOString().split('T')[0]
  const now = new Date()
  const today = fmt(now)
  if (value === 'today')   return { from: today, to: today }
  if (value === 'week')    { const d = new Date(now); d.setDate(d.getDate()-7); return { from: fmt(d), to: today } }
  if (value === 'month')   { const d = new Date(now); d.setDate(1); return { from: fmt(d), to: today } }
  if (value === 'quarter') { const d = new Date(now); d.setMonth(d.getMonth()-3); return { from: fmt(d), to: today } }
  return { from: '', to: '' }
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-navy-900 text-white rounded-xl px-3 py-2 text-xs shadow-xl border border-white/10">
      <div className="font-semibold mb-1.5 text-white/70">{label}</div>
      {payload.map(p => <div key={p.name} className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: p.color }} />{p.name}: <span className="font-bold ml-auto">{p.value}</span></div>)}
    </div>
  )
}

function StatCard({ label, value, sub, icon, accent }) {
  return (
    <div className="card p-5 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full rounded-l-2xl" style={{ background: accent }} />
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-bold text-ink-400 uppercase tracking-widest mb-2">{label}</div>
          <div className="text-3xl font-display font-bold text-ink-900">{value ?? '—'}</div>
          {sub && <div className="text-xs text-ink-400 mt-1">{sub}</div>}
        </div>
        <div className="text-xl text-ink-200">{icon}</div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const { navigate } = useNav()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [preset, setPreset] = useState('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  // Multi-select filter state
  const [filterDispositions, setFilterDispositions] = useState([])
  const [filterSources, setFilterSources] = useState([])
  const [filterUsers, setFilterUsers] = useState([])
  const [filterTypes, setFilterTypes] = useState([])

  const load = () => {
    setLoading(true)
    const dateF = preset === 'custom'
      ? { from: customFrom, to: customTo }
      : getPresetDates(preset)

    const filters = {
      ...dateF,
      disposition: filterDispositions,
      lead_source: filterSources,
      assigned_to: filterUsers,
      type: filterTypes,
    }

    api.getAnalytics(filters)
      .then(d => { setData(d); setLoading(false) })
      .catch(err => { console.error(err); setLoading(false) })
  }

  useEffect(() => { load() }, [preset, customFrom, customTo, filterDispositions, filterSources, filterUsers, filterTypes])
  useEffect(() => { api.getUsers().then(setUsers) }, [])

  const getTotal = (type) => data?.totals?.find(t => t.type === type)?.count || 0
  const wonRate = data?.totalCount > 0 ? Math.round(data.wonCount / data.totalCount * 100) : 0

  const trendDates = [...new Set((data?.trend || []).map(t => t.date))].sort()
  const trendData = trendDates.map(date => {
    const row = { date: date.slice(5) }
    ;['lead','repeat','online_order'].forEach(type => {
      row[type] = data?.trend?.find(t => t.date === date && t.type === type)?.count || 0
    })
    return row
  })

  const greeting = () => {
    const h = new Date().getHours()
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  }

  const hasActiveFilters = filterDispositions.length || filterSources.length || filterUsers.length || filterTypes.length
  const clearAllFilters = () => { setFilterDispositions([]); setFilterSources([]); setFilterUsers([]); setFilterTypes([]) }

  return (
    <div className="p-8 fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-ink-900">{greeting()}, {user.name} 👋</h1>
          <p className="text-ink-400 text-sm mt-0.5">Tech Atlantix · Sales Overview</p>
        </div>
        {/* Preset range pills */}
        <div className="flex bg-white border border-slate-200 rounded-xl p-1 gap-0.5 shadow-card">
          {PRESET_RANGES.map(r => (
            <button key={r.value} onClick={() => setPreset(r.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${preset === r.value ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-500 hover:text-ink-800'}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date range */}
      {preset === 'custom' && (
        <div className="flex items-center gap-3 mb-5 bg-white border border-brand-200 rounded-xl px-4 py-3 shadow-card slide-down">
          <span className="text-sm font-semibold text-ink-600">Custom range:</span>
          <input type="date" className="input max-w-[160px]" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
          <span className="text-ink-300 text-sm">→</span>
          <input type="date" className="input max-w-[160px]" value={customTo} onChange={e => setCustomTo(e.target.value)} />
          {customFrom && customTo && <span className="text-xs text-brand-600 font-medium">{customFrom} to {customTo}</span>}
        </div>
      )}

      {/* Multi-select filters */}
      <div className="flex gap-2.5 mb-6 flex-wrap items-center">
        <MultiSelect
          placeholder="All Types"
          options={[{value:'lead',label:'🎯 Leads'},{value:'repeat',label:'🔁 Repeat'},{value:'online_order',label:'🛒 Orders'}]}
          selected={filterTypes}
          onChange={setFilterTypes}
        />
        <MultiSelect
          placeholder="All Dispositions"
          options={DISPOSITIONS}
          selected={filterDispositions}
          onChange={setFilterDispositions}
        />
        <MultiSelect
          placeholder="All Sources"
          options={LEAD_SOURCES}
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
        {hasActiveFilters > 0 && (
          <button onClick={clearAllFilters} className="btn btn-ghost btn-sm text-red-500 hover:bg-red-50">✕ Clear filters</button>
        )}
        {(filterDispositions.length > 0 || filterSources.length > 0 || filterTypes.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {[...filterTypes.map(t => ({label: TYPE_LABELS[t], key: t, type: 'type'})),
              ...filterDispositions.map(d => ({label: d, key: d, type: 'disp'})),
              ...filterSources.map(s => ({label: s, key: s, type: 'src'}))
            ].map(tag => (
              <span key={tag.key} className="tag">
                {tag.label}
                <button onClick={() => {
                  if (tag.type === 'type') setFilterTypes(f => f.filter(v => v !== tag.key))
                  if (tag.type === 'disp') setFilterDispositions(f => f.filter(v => v !== tag.key))
                  if (tag.type === 'src') setFilterSources(f => f.filter(v => v !== tag.key))
                }} className="text-brand-500 hover:text-red-500 ml-0.5">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <div className="w-10 h-10 rounded-full border-2 border-brand-400 border-t-transparent spinner mx-auto mb-3" />
            <div className="text-sm text-ink-400">Loading analytics...</div>
          </div>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Leads" value={getTotal('lead')} icon="◎" accent="#0d9488"
              sub={<button onClick={() => navigate('leads')} className="text-brand-600 hover:text-brand-700">View all →</button>} />
            <StatCard label="Repeat Inquiries" value={getTotal('repeat')} icon="↻" accent="#3b82f6"
              sub={<button onClick={() => navigate('repeat')} className="text-brand-600 hover:text-brand-700">View all →</button>} />
            <StatCard label="Online Orders" value={getTotal('online_order')} icon="◈" accent="#f59e0b"
              sub={<button onClick={() => navigate('orders')} className="text-brand-600 hover:text-brand-700">View all →</button>} />
            <StatCard label="Win Rate" value={`${wonRate}%`} icon="★" accent="#14b8a6"
              sub={`${data?.wonCount || 0} won of ${data?.totalCount || 0} total`} />
          </div>

          <div className="grid grid-cols-3 gap-5 mb-5">
            {/* Trend chart */}
            <div className="card p-5 col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-sm text-ink-900">Activity Trend</h3>
                <div className="flex gap-4">
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-1.5 text-xs text-ink-400">
                      <span className="w-2 h-2 rounded-full" style={{ background: TYPE_COLORS[k] }} />{v}
                    </div>
                  ))}
                </div>
              </div>
              {trendData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-ink-300 text-sm">No data for this period</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={trendData} barSize={7} barGap={2}>
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

            {/* Disposition donut */}
            <div className="card p-5">
              <h3 className="font-display font-bold text-sm text-ink-900 mb-3">By Disposition</h3>
              {!data?.byDisposition?.filter(d => d.disposition)?.length ? (
                <div className="h-40 flex items-center justify-center text-ink-300 text-sm">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={data.byDisposition.slice(0,8)} dataKey="count" nameKey="disposition" cx="50%" cy="50%" outerRadius={65} innerRadius={30}>
                      {data.byDisposition.slice(0,8).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="space-y-1.5 mt-1">
                {data?.byDisposition?.slice(0,5).map((d, i) => (
                  <div key={d.disposition} className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i] }} />
                    <span className="text-ink-600 flex-1 truncate">{d.disposition || '—'}</span>
                    <span className="font-bold text-ink-900">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5 mb-5">
            {/* By person */}
            <div className="card p-5">
              <h3 className="font-display font-bold text-sm text-ink-900 mb-4">By Team Member</h3>
              {!data?.byPerson?.filter(p => p.name)?.length ? (
                <div className="h-32 flex items-center justify-center text-ink-300 text-sm">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data.byPerson.filter(p => p.name)} layout="vertical" barSize={12}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} width={55} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Total" fill="#0d9488" radius={[0,4,4,0]} />
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
                  <BarChart data={data.bySource.filter(s => s.source)} layout="vertical" barSize={12}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="source" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Count" fill="#3b82f6" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Upcoming follow-ups */}
          {data?.upcomingFollowups?.length > 0 && (
            <div className="card p-5">
              <h3 className="font-display font-bold text-sm text-ink-900 mb-4">📅 Upcoming Follow-ups</h3>
              <div className="divide-y divide-slate-50">
                {data.upcomingFollowups.map(fu => (
                  <div key={fu.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500 text-sm flex-shrink-0">📅</div>
                      <div>
                        <div className="text-sm font-semibold text-ink-800">{fu.customer_name}</div>
                        <div className="text-xs text-ink-400 mt-0.5">{fu.note}</div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-bold text-brand-600">{formatDate(fu.follow_up_date)}</div>
                      <div className="text-xs text-ink-400">{fu.assigned_name}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data?.totalCount === 0 && (
            <div className="card p-16 text-center mt-4">
              <div className="text-5xl mb-3">📊</div>
              <div className="font-display font-bold text-ink-400 text-lg">No data for this period</div>
              <div className="text-ink-300 text-sm mt-1">Try changing the date range or clearing filters</div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
