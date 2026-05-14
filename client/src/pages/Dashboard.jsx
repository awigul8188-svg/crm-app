import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { api } from '../api'
import { useAuth } from '../App'
import { useNav } from '../App'
import { DISPOSITIONS, LEAD_SOURCES, ORDER_SOURCES, formatDate } from '../components/Badges'
import MultiSelect from '../components/MultiSelect'

const BRAND = '#00D4C8'
const CHART_COLORS = ['#00D4C8','#3b82f6','#6366f1','#f59e0b','#ef4444','#10b981','#8b5cf6','#f97316','#ec4899','#84cc16']
const TYPE_COLORS = { lead: '#3b82f6', repeat: '#6366f1', online_order: '#f59e0b' }

const PRESETS = [
  { label: 'Today',    value: 'today' },
  { label: 'Week',     value: 'week' },
  { label: 'Month',    value: 'month' },
  { label: 'Quarter',  value: 'quarter' },
  { label: 'All Time', value: 'all' },
  { label: 'Custom',   value: 'custom' },
]

function getPresetDates(v) {
  const fmt = d => d.toISOString().split('T')[0]
  const now = new Date(); const today = fmt(now)
  if (v === 'today')   return { from: today, to: today }
  if (v === 'week')    { const d = new Date(now); d.setDate(d.getDate()-7); return { from: fmt(d), to: today } }
  if (v === 'month')   { const d = new Date(now); d.setDate(1); return { from: fmt(d), to: today } }
  if (v === 'quarter') { const d = new Date(now); d.setMonth(d.getMonth()-3); return { from: fmt(d), to: today } }
  return { from: '', to: '' }
}

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#0d0d0d', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:'8px 12px', fontSize:12 }}>
      <div style={{ color:'rgba(255,255,255,0.6)', marginBottom:4 }}>{label}</div>
      {payload.map(p => <div key={p.name} style={{ color: p.color, display:'flex', gap:8 }}><span>{p.name}</span><b>{p.value}</b></div>)}
    </div>
  )
}

function StatCard({ label, value, sub, color, onClick, icon }) {
  return (
    <div onClick={onClick} className={`card p-5 relative overflow-hidden ${onClick ? 'cursor-pointer' : ''}`}
      style={{ transition: 'all 0.15s' }}
      onMouseEnter={e => onClick && (e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}>
      <div style={{ position:'absolute', top:0, left:0, width:3, height:'100%', background: color, borderRadius:'12px 0 0 12px' }} />
      <div style={{ position:'absolute', top:8, right:12, fontSize:22, opacity:0.15 }}>{icon}</div>
      <div className="text-xs font-bold text-ink-400 uppercase tracking-widest mb-2">{label}</div>
      <div className="text-3xl font-display font-bold text-ink-900">{value ?? '—'}</div>
      {sub && <div className="text-xs text-ink-400 mt-1.5">{sub}</div>}
    </div>
  )
}

function ModuleSection({ title, color, icon, data, type }) {
  const total = data?.totals?.find(t => t.type === type)?.count || 0
  const byDisp = (data?.byDisposition || []).filter(d => d.disposition)
  const wonDisp = type === 'online_order' ? 'Processed' : 'Closed Won'
  const won = byDisp.find(d => d.disposition === wonDisp)?.count || 0
  const winRate = total > 0 ? Math.round(won / total * 100) : 0

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span style={{ color }}>{icon}</span>
          <h3 className="font-display font-bold text-sm text-ink-900">{title}</h3>
        </div>
        <div className="flex gap-3 text-xs">
          <span className="badge" style={{ background:`${color}15`, color, border:`1px solid ${color}30` }}>{total} total</span>
          <span className="badge bg-green-50 text-green-700 border-green-200">{winRate}% {type === 'online_order' ? 'processed' : 'won'}</span>
        </div>
      </div>
      {byDisp.length === 0 ? (
        <div className="text-center text-ink-300 text-sm py-4">No data for this period</div>
      ) : (
        <div className="space-y-1.5">
          {byDisp.slice(0,8).map((d, i) => {
            const pct = total > 0 ? Math.round(d.count / total * 100) : 0
            return (
              <div key={d.disposition} className="flex items-center gap-2 text-xs">
                <div className="w-24 truncate text-ink-600 font-medium flex-shrink-0">{d.disposition}</div>
                <div className="flex-1 h-1.5 bg-surface-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                </div>
                <div className="w-10 text-right font-bold text-ink-800">{d.count}</div>
                <div className="w-8 text-right text-ink-400">{pct}%</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const { navigate } = useNav()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [preset, setPreset] = useState('all') // Default ALL TIME so imported data shows
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [filterDispositions, setFilterDispositions] = useState([])
  const [filterSources, setFilterSources] = useState([])
  const [filterUsers, setFilterUsers] = useState([])
  const [filterTypes, setFilterTypes] = useState([])
  const [notifCount, setNotifCount] = useState(0)

  const load = () => {
    setLoading(true)
    const dateF = preset === 'custom' ? { from: customFrom, to: customTo } : getPresetDates(preset)
    api.getAnalytics({ ...dateF, disposition: filterDispositions, lead_source: filterSources, assigned_to: filterUsers, type: filterTypes })
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [preset, customFrom, customTo, filterDispositions, filterSources, filterUsers, filterTypes])
  useEffect(() => {
    api.getUsers().then(setUsers)
    api.getNotifications().then(n => setNotifCount(n.total)).catch(() => {})
  }, [])

  const getTotal = (type) => data?.totals?.find(t => t.type === type)?.count || 0
  const totalAll = (data?.totals || []).reduce((s, t) => s + t.count, 0)
  const wonRate = data?.totalCount > 0 ? Math.round(data.wonCount / data.totalCount * 100) : 0

  // Order value from online orders (sum order_amount - need backend support, approximate with count)
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

  const hasFilters = filterDispositions.length || filterSources.length || filterUsers.length || filterTypes.length
  const clearFilters = () => { setFilterDispositions([]); setFilterSources([]); setFilterUsers([]); setFilterTypes([]) }

  // Separate analytics data by type for module sections
  const leadData = { totals: data?.totals, byDisposition: data?.byDisposition }
  const repeatData = { totals: data?.totals, byDisposition: data?.byDisposition }
  const orderData = { totals: data?.totals, byDisposition: data?.byDisposition }

  return (
    <div className="p-8 fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl text-ink-900">{greeting()}, {user.name} 👋</h1>
          <p className="text-ink-400 text-sm mt-0.5">Tech Atlantix · Sales Analytics</p>
        </div>
        {/* Date range pills */}
        <div className="flex bg-white border border-slate-200 rounded-xl p-1 gap-0.5 shadow-card flex-wrap">
          {PRESETS.map(r => (
            <button key={r.value} onClick={() => setPreset(r.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${preset === r.value ? 'text-dark-900 shadow-sm' : 'text-ink-500 hover:text-ink-800'}`}
              style={{ background: preset === r.value ? BRAND : 'transparent' }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date range */}
      {preset === 'custom' && (
        <div className="flex items-center gap-3 mb-5 bg-white border border-brand-200 rounded-xl px-4 py-3 shadow-card slide-down flex-wrap">
          <span className="text-sm font-semibold text-ink-600">Range:</span>
          <input type="date" className="input max-w-[160px]" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
          <span className="text-ink-300">→</span>
          <input type="date" className="input max-w-[160px]" value={customTo} onChange={e => setCustomTo(e.target.value)} />
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2.5 mb-4 flex-wrap items-center">
        <MultiSelect placeholder="All Types" options={[{value:'lead',label:'◎ Leads'},{value:'repeat',label:'↻ Repeat'},{value:'online_order',label:'◈ Orders'}]} selected={filterTypes} onChange={setFilterTypes} />
        <MultiSelect placeholder="All Dispositions" options={DISPOSITIONS} selected={filterDispositions} onChange={setFilterDispositions} />
        <MultiSelect placeholder="All Sources" options={[...LEAD_SOURCES, ...ORDER_SOURCES]} selected={filterSources} onChange={setFilterSources} />
        {user.role === 'manager' && (
          <MultiSelect placeholder="All Team Members" options={users.map(u => ({ value: String(u.id), label: u.name }))} selected={filterUsers} onChange={setFilterUsers} />
        )}
        {hasFilters ? <button onClick={clearFilters} className="btn btn-ghost btn-sm text-red-500 hover:bg-red-50">✕ Clear</button> : null}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32 flex-col gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-t-transparent spinner" style={{ borderColor: `${BRAND} transparent transparent` }} />
          <div className="text-sm text-ink-400">Loading analytics...</div>
        </div>
      ) : (
        <>
          {/* Top stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Leads" value={getTotal('lead')} icon="◎" color="#3b82f6"
              sub={<button onClick={() => navigate('leads')} className="text-brand-600 hover:underline">View all →</button>} />
            <StatCard label="Repeat Inquiries" value={getTotal('repeat')} icon="↻" color="#6366f1"
              sub={<button onClick={() => navigate('repeat')} className="text-brand-600 hover:underline">View all →</button>} />
            <StatCard label="Online Orders" value={getTotal('online_order')} icon="◈" color="#f59e0b"
              sub={<button onClick={() => navigate('orders')} className="text-brand-600 hover:underline">View all →</button>} />
            <StatCard label="Overall Win Rate" value={`${wonRate}%`} icon="★" color={BRAND}
              sub={`${data?.wonCount || 0} closed won of ${data?.totalCount || 0}`} />
          </div>

          {/* Trend + Disposition donut */}
          <div className="grid grid-cols-3 gap-5 mb-5">
            <div className="card p-5 col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-sm text-ink-900">Activity Trend</h3>
                <div className="flex gap-4">
                  {[['lead','◎ Leads','#3b82f6'],['repeat','↻ Repeat','#6366f1'],['online_order','◈ Orders','#f59e0b']].map(([k,l,c]) => (
                    <div key={k} className="flex items-center gap-1.5 text-xs text-ink-400">
                      <span className="w-2 h-2 rounded-full" style={{ background: c }} />{l}
                    </div>
                  ))}
                </div>
              </div>
              {trendData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-ink-300 text-sm">No data — try selecting All Time</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={trendData} barSize={6} barGap={2}>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<Tip />} />
                    <Bar dataKey="lead" name="Leads" fill="#3b82f6" radius={[3,3,0,0]} />
                    <Bar dataKey="repeat" name="Repeat" fill="#6366f1" radius={[3,3,0,0]} />
                    <Bar dataKey="online_order" name="Orders" fill="#f59e0b" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Summary donut */}
            <div className="card p-5">
              <h3 className="font-display font-bold text-sm text-ink-900 mb-3">Volume Split</h3>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={[
                    { name:'Leads', value: getTotal('lead') },
                    { name:'Repeat', value: getTotal('repeat') },
                    { name:'Orders', value: getTotal('online_order') },
                  ].filter(d => d.value > 0)} dataKey="value" cx="50%" cy="50%" outerRadius={60} innerRadius={30}>
                    {['#3b82f6','#6366f1','#f59e0b'].map((c, i) => <Cell key={i} fill={c} />)}
                  </Pie>
                  <Tooltip formatter={(v,n) => [v, n]} contentStyle={{ fontSize:11, borderRadius:8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-1">
                {[['◎ Leads','lead','#3b82f6'],['↻ Repeat','repeat','#6366f1'],['◈ Orders','online_order','#f59e0b']].map(([label, type, color]) => (
                  <div key={type} className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-ink-600 flex-1">{label}</span>
                    <span className="font-bold text-ink-900">{getTotal(type)}</span>
                    <span className="text-ink-400">{totalAll > 0 ? Math.round(getTotal(type)/totalAll*100) : 0}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Per-module disposition breakdown */}
          <div className="grid grid-cols-3 gap-5 mb-5">
            {/* Leads breakdown */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-bold text-sm text-ink-900">◎ Leads Disposition</h3>
                <span className="badge bg-blue-50 text-blue-600 border-blue-100">{getTotal('lead')} total</span>
              </div>
              {(data?.byDisposition || []).filter(d => d.disposition && d.disposition !== 'Processed' && d.disposition !== 'Cancelled').length === 0
                ? <div className="text-ink-300 text-sm text-center py-4">No data</div>
                : <div className="space-y-1.5">
                    {(data?.byDisposition || [])
                      .filter(d => d.disposition && d.disposition !== 'Processed' && d.disposition !== 'Cancelled')
                      .slice(0, 8).map((d, i) => {
                        const total = getTotal('lead')
                        const pct = total > 0 ? Math.round(d.count / total * 100) : 0
                        return (
                          <div key={d.disposition} className="flex items-center gap-2 text-xs">
                            <div className="w-20 truncate text-ink-600 font-medium">{d.disposition}</div>
                            <div className="flex-1 h-1.5 bg-surface-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: CHART_COLORS[i] }} />
                            </div>
                            <div className="w-8 text-right font-bold text-ink-800">{d.count}</div>
                          </div>
                        )
                      })}
                  </div>
              }
            </div>

            {/* Repeat breakdown */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-bold text-sm text-ink-900">↻ Repeat Disposition</h3>
                <span className="badge bg-violet-50 text-violet-600 border-violet-100">{getTotal('repeat')} total</span>
              </div>
              {(data?.byDisposition || []).filter(d => d.disposition && d.disposition !== 'Processed' && d.disposition !== 'Cancelled').length === 0
                ? <div className="text-ink-300 text-sm text-center py-4">No data</div>
                : <div className="space-y-1.5">
                    {(data?.byDisposition || [])
                      .filter(d => d.disposition && d.disposition !== 'Processed' && d.disposition !== 'Cancelled')
                      .slice(0, 8).map((d, i) => {
                        const total = getTotal('repeat')
                        const pct = total > 0 ? Math.round(d.count / total * 100) : 0
                        return (
                          <div key={d.disposition} className="flex items-center gap-2 text-xs">
                            <div className="w-20 truncate text-ink-600 font-medium">{d.disposition}</div>
                            <div className="flex-1 h-1.5 bg-surface-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: CHART_COLORS[i] }} />
                            </div>
                            <div className="w-8 text-right font-bold text-ink-800">{d.count}</div>
                          </div>
                        )
                      })}
                  </div>
              }
            </div>

            {/* Online Orders breakdown */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-bold text-sm text-ink-900">◈ Orders Status</h3>
                <span className="badge bg-amber-50 text-amber-600 border-amber-100">{getTotal('online_order')} total</span>
              </div>
              {(data?.byDisposition || []).filter(d => d.disposition === 'Processed' || d.disposition === 'Cancelled').length === 0
                ? <div className="text-ink-300 text-sm text-center py-4">No data</div>
                : <div className="space-y-2">
                    {[{ label: 'Processed', color: '#10b981' }, { label: 'Cancelled', color: '#ef4444' }].map(({ label, color }) => {
                      const count = (data?.byDisposition || []).find(d => d.disposition === label)?.count || 0
                      const total = getTotal('online_order')
                      const pct = total > 0 ? Math.round(count / total * 100) : 0
                      return (
                        <div key={label}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-medium" style={{ color }}>{label}</span>
                            <span className="font-bold text-ink-800">{count} <span className="text-ink-400 font-normal">({pct}%)</span></span>
                          </div>
                          <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                          </div>
                        </div>
                      )
                    })}
                    <div className="text-xs text-ink-400 mt-2 pt-2 border-t">
                      Verification: {(data?.byDisposition || []).length > 0 ? 'See orders list for detail' : '—'}
                    </div>
                  </div>
              }
            </div>
          </div>

          {/* Team + Source charts */}
          <div className="grid grid-cols-2 gap-5 mb-5">
            <div className="card p-5">
              <h3 className="font-display font-bold text-sm text-ink-900 mb-4">By Team Member</h3>
              {!data?.byPerson?.filter(p => p.name)?.length ? (
                <div className="h-40 flex items-center justify-center text-ink-300 text-sm">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.byPerson.filter(p => p.name)} layout="vertical" barSize={14}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} width={55} />
                    <Tooltip content={<Tip />} />
                    <Bar dataKey="count" name="Total" fill={BRAND} radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card p-5">
              <h3 className="font-display font-bold text-sm text-ink-900 mb-4">By Lead Source</h3>
              {!data?.bySource?.filter(s => s.source)?.length ? (
                <div className="h-40 flex items-center justify-center text-ink-300 text-sm">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.bySource.filter(s => s.source)} layout="vertical" barSize={14}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="source" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} width={85} />
                    <Tooltip content={<Tip />} />
                    <Bar dataKey="count" name="Count" fill="#6366f1" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Upcoming follow-ups */}
          {data?.upcomingFollowups?.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-sm text-ink-900">📅 Upcoming Follow-ups</h3>
                <button onClick={() => navigate('notifications')} className="text-xs text-brand-600 font-semibold hover:underline">View all →</button>
              </div>
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
                    <div className="text-right flex-shrink-0 ml-4">
                      <div className="text-xs font-bold" style={{ color: BRAND }}>{formatDate(fu.follow_up_date)}</div>
                      <div className="text-xs text-ink-400">{fu.assigned_name}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {totalAll === 0 && (
            <div className="card p-16 text-center">
              <div className="text-5xl mb-3 opacity-20">📊</div>
              <div className="font-display font-bold text-ink-400 text-lg">No data for this period</div>
              <div className="text-ink-300 text-sm mt-1">Switch to <button onClick={() => setPreset('all')} className="text-brand-600 font-semibold">All Time</button> to see all records</div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
