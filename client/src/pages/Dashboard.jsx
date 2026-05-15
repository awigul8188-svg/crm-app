import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { api } from '../api'
import { useAuth } from '../App'
import { useNav } from '../App'
import { DISPOSITIONS, LEAD_SOURCES, ORDER_SOURCES, formatDate } from '../components/Badges'
import MultiSelect from '../components/MultiSelect'

const BRAND = '#00D4C8'
const CHART_COLORS = ['#00D4C8','#3b82f6','#6366f1','#f59e0b','#ef4444','#10b981','#8b5cf6','#f97316','#ec4899','#84cc16']

const PRESETS = [
  { label: 'Today', value: 'today' },
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Quarter', value: 'quarter' },
  { label: 'All Time', value: 'all' },
  { label: 'Custom', value: 'custom' },
]

function getPresetDates(v) {
  const fmt = d => d.toISOString().split('T')[0]
  const now = new Date(); const today = fmt(now)
  if (v === 'today') return { from: today, to: today }
  if (v === 'week') { const d = new Date(now); d.setDate(d.getDate()-7); return { from: fmt(d), to: today } }
  if (v === 'month') { const d = new Date(now); d.setDate(1); return { from: fmt(d), to: today } }
  if (v === 'quarter') { const d = new Date(now); d.setMonth(d.getMonth()-3); return { from: fmt(d), to: today } }
  return { from: '', to: '' }
}

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#0d0d0d', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:'8px 12px', fontSize:12 }}>
      <div style={{ color:'rgba(255,255,255,0.6)', marginBottom:4 }}>{label}</div>
      {payload.map(p => <div key={p.name} style={{ color: p.color || BRAND, display:'flex', gap:8 }}><span>{p.name}</span><b>{p.value}</b></div>)}
    </div>
  )
}

function MetricCard({ label, value, sub, color = BRAND, prefix = '', suffix = '' }) {
  return (
    <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:'16px 20px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, left:0, width:3, height:'100%', background: color, borderRadius:'16px 0 0 16px' }} />
      <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>{label}</div>
      <div style={{ fontSize:28, fontWeight:800, color:'#0f172a', fontFamily:'"Bricolage Grotesque", sans-serif' }}>{prefix}{typeof value === 'number' ? value.toLocaleString() : (value ?? '—')}{suffix}</div>
      {sub && <div style={{ fontSize:12, color:'#94a3b8', marginTop:4 }}>{sub}</div>}
    </div>
  )
}

function SectionTitle({ children }) {
  return <div style={{ fontFamily:'"Bricolage Grotesque", sans-serif', fontWeight:700, fontSize:14, color:'#0f172a', marginBottom:14 }}>{children}</div>
}

// ─── Overview Tab ────────────────────────────────────────────────
function OverviewTab({ preset, customFrom, customTo, filterDispositions, filterSources, filterUsers, filterTypes, users }) {
  const { navigate } = useNav()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const dateF = preset === 'custom' ? { from: customFrom, to: customTo } : getPresetDates(preset)
    api.getAnalytics({ ...dateF, disposition: filterDispositions, lead_source: filterSources, assigned_to: filterUsers, type: filterTypes })
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [preset, customFrom, customTo, filterDispositions, filterSources, filterUsers, filterTypes])

  const getTotal = (type) => data?.totals?.find(t => t.type === type)?.count || 0
  const wonRate = data?.totalCount > 0 ? Math.round(data.wonCount / data.totalCount * 100) : 0
  const trendDates = [...new Set((data?.trend || []).map(t => t.date))].sort()
  const trendData = trendDates.map(date => {
    const row = { date: date.slice(5) }
    ;['lead','repeat','online_order'].forEach(type => { row[type] = data?.trend?.find(t => t.date === date && t.type === type)?.count || 0 })
    return row
  })

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'80px 0' }}><div style={{ width:32, height:32, borderRadius:'50%', border:`2px solid ${BRAND}`, borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} /></div>

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
        <MetricCard label="Total Leads" value={getTotal('lead')} color="#3b82f6" sub={<button onClick={() => navigate('leads')} style={{ color:BRAND, background:'none', border:'none', cursor:'pointer', fontSize:12, padding:0, fontFamily:'"Plus Jakarta Sans", sans-serif' }}>View all →</button>} />
        <MetricCard label="Repeat Inquiries" value={getTotal('repeat')} color="#6366f1" sub={<button onClick={() => navigate('repeat')} style={{ color:BRAND, background:'none', border:'none', cursor:'pointer', fontSize:12, padding:0, fontFamily:'"Plus Jakarta Sans", sans-serif' }}>View all →</button>} />
        <MetricCard label="Online Orders" value={getTotal('online_order')} color="#f59e0b" sub={<button onClick={() => navigate('orders')} style={{ color:BRAND, background:'none', border:'none', cursor:'pointer', fontSize:12, padding:0, fontFamily:'"Plus Jakarta Sans", sans-serif' }}>View all →</button>} />
        <MetricCard label="Win Rate" value={`${wonRate}%`} color={BRAND} sub={`${data?.wonCount||0} of ${data?.totalCount||0} closed won`} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:20, marginBottom:20 }}>
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:20 }}>
          <SectionTitle>Activity Trend</SectionTitle>
          {trendData.length === 0 ? <div style={{ height:180, display:'flex', alignItems:'center', justifyContent:'center', color:'#94a3b8', fontSize:14 }}>No data — try All Time</div> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trendData} barSize={6} barGap={2}>
                <XAxis dataKey="date" tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="lead" name="Leads" fill="#3b82f6" radius={[3,3,0,0]} />
                <Bar dataKey="repeat" name="Repeat" fill="#6366f1" radius={[3,3,0,0]} />
                <Bar dataKey="online_order" name="Orders" fill="#f59e0b" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:20 }}>
          <SectionTitle>By Team Member</SectionTitle>
          {!data?.byPerson?.filter(p=>p.name)?.length ? <div style={{ height:180, display:'flex', alignItems:'center', justifyContent:'center', color:'#94a3b8', fontSize:14 }}>No data</div> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.byPerson.filter(p=>p.name)} layout="vertical" barSize={12}>
                <XAxis type="number" tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize:11, fill:'#475569' }} axisLine={false} tickLine={false} width={55} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="count" name="Total" fill={BRAND} radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {data?.upcomingFollowups?.length > 0 && (
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:20 }}>
          <SectionTitle>📅 Upcoming Follow-ups</SectionTitle>
          {data.upcomingFollowups.map(fu => (
            <div key={fu.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #f8fafc' }}>
              <div><div style={{ fontWeight:600, fontSize:14, color:'#0f172a' }}>{fu.customer_name}</div><div style={{ fontSize:12, color:'#94a3b8' }}>{fu.note}</div></div>
              <div style={{ textAlign:'right' }}><div style={{ fontSize:12, fontWeight:700, color:BRAND }}>{formatDate(fu.follow_up_date)}</div><div style={{ fontSize:11, color:'#94a3b8' }}>{fu.assigned_name}</div></div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Orders Tab ──────────────────────────────────────────────────
function OrdersTab({ preset, customFrom, customTo }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const dateF = preset === 'custom' ? { from: customFrom, to: customTo } : getPresetDates(preset)
    const p = new URLSearchParams({ type: 'online_order', ...Object.fromEntries(Object.entries(dateF).filter(([,v]) => v)) })
    fetch(`/api/analytics/module?${p}`, { headers: { Authorization: `Bearer ${localStorage.getItem('crm_token')}` } })
      .then(r => r.json()).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [preset, customFrom, customTo])

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'80px 0' }}><div style={{ width:32, height:32, borderRadius:'50%', border:`2px solid ${BRAND}`, borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} /></div>
  if (!data) return null

  const t = data.today; const p = data.period

  return (
    <div>
      {/* Today */}
      <div style={{ marginBottom:8 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>Today</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:12, marginBottom:24 }}>
          <MetricCard label="Orders Received" value={t.total} color="#f59e0b" />
          <MetricCard label="Verified" value={t.verified} color="#10b981" />
          <MetricCard label="Not Verified" value={t.not_verified} color="#ef4444" />
          <MetricCard label="Order Value" value={t.value.toFixed(0)} color={BRAND} prefix="$" />
          <MetricCard label="Processed" value={t.processed} color="#10b981" />
          <MetricCard label="Cancelled" value={t.cancelled} color="#ef4444" />
        </div>
      </div>

      {/* Period */}
      <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>
        {preset === 'all' ? 'All Time' : preset === 'today' ? 'Today' : 'Selected Period'}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:12, marginBottom:24 }}>
        <MetricCard label="Total Orders" value={p.total} color="#f59e0b" />
        <MetricCard label="Verified" value={p.verified} color="#10b981" />
        <MetricCard label="Not Verified" value={p.not_verified} color="#ef4444" />
        <MetricCard label="Total Value" value={p.value.toFixed(0)} color={BRAND} prefix="$" />
        <MetricCard label="Processed" value={p.processed} color="#10b981" sub={p.total > 0 ? `${Math.round(p.processed/p.total*100)}%` : '0%'} />
        <MetricCard label="Cancelled" value={p.cancelled} color="#ef4444" sub={p.total > 0 ? `${Math.round(p.cancelled/p.total*100)}%` : '0%'} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:20, marginBottom:20 }}>
        {/* Trend */}
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:20 }}>
          <SectionTitle>Orders Trend — Processed vs Cancelled</SectionTitle>
          {!data.trend?.length ? <div style={{ height:160, display:'flex', alignItems:'center', justifyContent:'center', color:'#94a3b8' }}>No data</div> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.trend.map(t => ({ ...t, date: t.date?.slice(5) }))} barSize={8}>
                <XAxis dataKey="date" tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="processed" name="Processed" fill="#10b981" radius={[3,3,0,0]} />
                <Bar dataKey="cancelled" name="Cancelled" fill="#ef4444" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* By source */}
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:20 }}>
          <SectionTitle>By Source</SectionTitle>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {(data.bySource||[]).filter(s=>s.source).map((s,i) => (
              <div key={s.source}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                  <span style={{ color:'#475569', fontWeight:500 }}>{s.source}</span>
                  <span style={{ fontWeight:700, color:'#0f172a' }}>{s.count}</span>
                </div>
                <div style={{ height:6, background:'#f1f5f9', borderRadius:4 }}>
                  <div style={{ height:'100%', borderRadius:4, background: CHART_COLORS[i], width: `${p.total > 0 ? Math.round(s.count/p.total*100) : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* By person */}
      <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:20 }}>
        <SectionTitle>By Team Member</SectionTitle>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ borderBottom:'1px solid #f1f5f9', color:'#94a3b8', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>
              <th style={{ textAlign:'left', padding:'8px 0' }}>Name</th>
              <th style={{ textAlign:'right', padding:'8px 0' }}>Total</th>
              <th style={{ textAlign:'right', padding:'8px 0' }}>Processed</th>
              <th style={{ textAlign:'right', padding:'8px 0' }}>Rate</th>
            </tr>
          </thead>
          <tbody>
            {(data.byPerson||[]).filter(p=>p.name).map(p => (
              <tr key={p.name} style={{ borderBottom:'1px solid #f8fafc' }}>
                <td style={{ padding:'10px 0', fontWeight:600, color:'#0f172a' }}>{p.name}</td>
                <td style={{ padding:'10px 0', textAlign:'right', color:'#475569' }}>{p.count}</td>
                <td style={{ padding:'10px 0', textAlign:'right', color:'#10b981', fontWeight:600 }}>{p.processed||0}</td>
                <td style={{ padding:'10px 0', textAlign:'right', color:BRAND, fontWeight:700 }}>{p.count > 0 ? Math.round((p.processed||0)/p.count*100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Top List Component ─────────────────────────────────────────
function TopList({ data, label, color, showCompany }) {
  const [period, setPeriod] = useState('month')
  const rows = data?.[period] || []
  const max = rows[0]?.count || 1

  return (
    <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:20 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <SectionTitle>{label}</SectionTitle>
        <div style={{ display:'flex', gap:2, background:'#f1f5f9', borderRadius:8, padding:3 }}>
          {[['day','Today'],['month','Month'],['year','Year']].map(([val,lbl]) => (
            <button key={val} onClick={() => setPeriod(val)}
              style={{ padding:'4px 10px', borderRadius:6, border:'none', background: period===val ? '#fff' : 'transparent', color: period===val ? '#0f172a' : '#64748b', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans", sans-serif', boxShadow: period===val ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition:'all 0.12s' }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ textAlign:'center', color:'#94a3b8', fontSize:13, padding:'24px 0' }}>No data for this period</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {rows.map((row, i) => (
            <div key={row.name + i} style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:22, height:22, borderRadius:6, background: i === 0 ? color : '#f1f5f9', color: i === 0 ? '#fff' : '#94a3b8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0 }}>
                {i + 1}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
                  <div>
                    <span style={{ fontSize:13, fontWeight:600, color:'#0f172a' }}>{row.name || 'Unknown'}</span>
                    {showCompany && row.company && <span style={{ fontSize:11, color:'#94a3b8', marginLeft:6 }}>· {row.company}</span>}
                  </div>
                  <span style={{ fontSize:13, fontWeight:700, color: i === 0 ? color : '#475569', flexShrink:0, marginLeft:8 }}>{row.count}</span>
                </div>
                <div style={{ height:4, background:'#f1f5f9', borderRadius:4 }}>
                  <div style={{ height:'100%', borderRadius:4, background: i === 0 ? color : '#cbd5e1', width:`${Math.round(row.count / max * 100)}%`, transition:'width 0.3s' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Repeat Tab ──────────────────────────────────────────────────
function RepeatTab({ preset, customFrom, customTo }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const dateF = preset === 'custom' ? { from: customFrom, to: customTo } : getPresetDates(preset)
    const p = new URLSearchParams({ type: 'repeat', ...Object.fromEntries(Object.entries(dateF).filter(([,v]) => v)) })
    fetch(`/api/analytics/module?${p}`, { headers: { Authorization: `Bearer ${localStorage.getItem('crm_token')}` } })
      .then(r => r.json()).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [preset, customFrom, customTo])

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'80px 0' }}><div style={{ width:32, height:32, borderRadius:'50%', border:`2px solid ${BRAND}`, borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} /></div>
  if (!data) return null

  const t = data.today; const p = data.period

  return (
    <div>
      <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>Today</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24 }}>
        <MetricCard label="Inquiries Received" value={t.total} color="#6366f1" />
        <MetricCard label="PPC" value={p.ppc} color="#3b82f6" />
        <MetricCard label="Outbound Repeat" value={p.outbound} color="#8b5cf6" />
      </div>

      <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>Period Summary</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        <MetricCard label="Total Inquiries" value={p.total} color="#6366f1" />
        <MetricCard label="Closed Won" value={p.closed_won} color="#10b981" />
        <MetricCard label="Win Rate" value={`${p.win_rate}%`} color={BRAND} />
        <MetricCard label="PPC vs Outbound" value={`${p.ppc} / ${p.outbound}`} color="#8b5cf6" />
      </div>

      {/* Top Customers + Top Reps side by side */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
        <TopList data={data.topCustomers} label="🏆 Top Customers" color="#6366f1" showCompany />
        <TopList data={data.topReps} label="⭐ Top Reps" color={BRAND} showCompany={false} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
        {/* Disposition breakdown */}
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:20 }}>
          <SectionTitle>By Disposition</SectionTitle>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {(data.byDisposition||[]).slice(0,10).map((d,i) => (
              <div key={d.disposition}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                  <span style={{ color:'#475569', fontWeight:500 }}>{d.disposition||'Unknown'}</span>
                  <span style={{ fontWeight:700, color:'#0f172a' }}>{d.count}</span>
                </div>
                <div style={{ height:5, background:'#f1f5f9', borderRadius:4 }}>
                  <div style={{ height:'100%', borderRadius:4, background: CHART_COLORS[i % CHART_COLORS.length], width: `${p.total > 0 ? Math.round(d.count/p.total*100) : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* By person chart */}
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:20 }}>
          <SectionTitle>Inquiries by Rep (Period)</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={(data.byPerson||[]).filter(p=>p.name)} layout="vertical" barSize={14}>
              <XAxis type="number" tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize:11, fill:'#475569' }} axisLine={false} tickLine={false} width={55} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="count" name="Inquiries" fill="#6366f1" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Trend */}
      <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:20 }}>
        <SectionTitle>Volume Trend</SectionTitle>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={(data.trend||[]).map(t => ({ ...t, date: t.date?.slice(5) }))}>
            <XAxis dataKey="date" tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<Tip />} />
            <Line type="monotone" dataKey="total" name="Inquiries" stroke="#6366f1" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── Leads Tab ───────────────────────────────────────────────────
function LeadsTab({ preset, customFrom, customTo }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const dateF = preset === 'custom' ? { from: customFrom, to: customTo } : getPresetDates(preset)
    const p = new URLSearchParams({ type: 'lead', ...Object.fromEntries(Object.entries(dateF).filter(([,v]) => v)) })
    fetch(`/api/analytics/module?${p}`, { headers: { Authorization: `Bearer ${localStorage.getItem('crm_token')}` } })
      .then(r => r.json()).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [preset, customFrom, customTo])

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'80px 0' }}><div style={{ width:32, height:32, borderRadius:'50%', border:`2px solid ${BRAND}`, borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} /></div>
  if (!data) return null

  const p = data.period
  const trendData = (data.trend || []).map(t => ({ ...t, date: t.date?.slice(5) }))

  // Build source lookup per AE
  const aeSourceMap = {}
  ;(data.aeSourceBreakdown || []).forEach(row => {
    if (!aeSourceMap[row.ae_name]) aeSourceMap[row.ae_name] = []
    aeSourceMap[row.ae_name].push({ source: row.source, count: row.count })
  })

  return (
    <div>
      {/* ── Summary Cards ── */}
      <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>Today</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        <MetricCard label="Leads Received" value={data.today.total} color="#3b82f6" />
        {(data.today.perAE || []).slice(0, 3).map((ae, i) => (
          <MetricCard key={ae.name} label={ae.name} value={ae.count} color={CHART_COLORS[i+1]} sub="leads today" />
        ))}
      </div>

      <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>Period Summary</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        <MetricCard label="Total Leads" value={p.total} color="#3b82f6" />
        <MetricCard label="Closed Won" value={p.closed_won} color="#10b981" sub={`${p.win_rate}% win rate`} />
        <MetricCard label="Closed Lost" value={p.closed_lost} color="#ef4444" />
        <MetricCard label="In Progress" value={p.in_progress} color="#f59e0b" />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:28 }}>
        <MetricCard label="Quoted" value={p.quoted} color="#6366f1" />
        <MetricCard label="Bidding" value={p.bidding} color="#8b5cf6" />
        <MetricCard label="Fake Leads" value={p.fake} color="#94a3b8" />
        <MetricCard label="No Response" value={p.no_response} color="#64748b" />
      </div>

      {/* ── Trend + Source ── */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:20, marginBottom:20 }}>
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:20 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <SectionTitle>Lead Trend — Won vs Total</SectionTitle>
            <div style={{ display:'flex', gap:12 }}>
              {[['Total','#3b82f6'],['Won','#10b981']].map(([l,c]) => (
                <div key={l} style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'#94a3b8' }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:c, display:'inline-block' }} />{l}
                </div>
              ))}
            </div>
          </div>
          {trendData.length === 0 ? <div style={{ height:180, display:'flex', alignItems:'center', justifyContent:'center', color:'#94a3b8' }}>No data — try All Time</div> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trendData} barSize={8} barGap={2}>
                <XAxis dataKey="date" tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="total" name="Total" fill="#3b82f6" radius={[3,3,0,0]} />
                <Bar dataKey="won" name="Won" fill="#10b981" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:20 }}>
          <SectionTitle>By Lead Source</SectionTitle>
          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
            {(data.bySource || []).filter(s => s.source).slice(0, 8).map((s, i) => (
              <div key={s.source}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                  <span style={{ color:'#475569', fontWeight:500 }}>{s.source}</span>
                  <span style={{ fontWeight:700, color:'#0f172a' }}>{s.count}</span>
                </div>
                <div style={{ height:5, background:'#f1f5f9', borderRadius:4 }}>
                  <div style={{ height:'100%', borderRadius:4, background: CHART_COLORS[i % CHART_COLORS.length], width:`${p.total > 0 ? Math.round(s.count/p.total*100) : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Disposition breakdown ── */}
      <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:20, marginBottom:20 }}>
        <SectionTitle>By Disposition</SectionTitle>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:12 }}>
          {(data.byDisposition || []).filter(d => d.disposition).map((d, i) => {
            const pct = p.total > 0 ? Math.round(d.count / p.total * 100) : 0
            return (
              <div key={d.disposition} style={{ background:'#f8fafc', borderRadius:12, padding:'12px 14px', border:'1px solid #f1f5f9' }}>
                <div style={{ fontSize:11, color:'#64748b', fontWeight:500, marginBottom:6, truncate:true }}>{d.disposition}</div>
                <div style={{ fontSize:22, fontWeight:800, color:'#0f172a', fontFamily:'"Bricolage Grotesque",sans-serif' }}>{d.count}</div>
                <div style={{ height:3, background:'#e2e8f0', borderRadius:4, marginTop:8 }}>
                  <div style={{ height:'100%', borderRadius:4, background: CHART_COLORS[i % CHART_COLORS.length], width:`${pct}%` }} />
                </div>
                <div style={{ fontSize:10, color:'#94a3b8', marginTop:4 }}>{pct}% of total</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── AE Performance Table ── */}
      <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:20 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <SectionTitle>AE Performance — Leads</SectionTitle>
          <div style={{ fontSize:11, color:'#94a3b8' }}>All time stats per rep</div>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:'2px solid #f1f5f9' }}>
                {['Rep','Total','Today','This Month','Won','Lost','Quoted','Bidding','Fake','No Response','Cold','Win Rate','Top Source'].map(h => (
                  <th key={h} style={{ textAlign: h === 'Rep' ? 'left' : 'center', padding:'8px 10px', fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.aePerformance || []).filter(ae => ae.name).map((ae, i) => {
                const winRate = ae.total > 0 ? Math.round(ae.won / ae.total * 100) : 0
                const topSource = (aeSourceMap[ae.name] || [])[0]?.source || '—'
                const rowColor = i % 2 === 0 ? '#fff' : '#fafbfc'
                return (
                  <tr key={ae.id || ae.name} style={{ background: rowColor, borderBottom:'1px solid #f1f5f9' }}>
                    <td style={{ padding:'12px 10px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        {ae.avatar_url
                          ? <img src={ae.avatar_url} alt={ae.name} style={{ width:28, height:28, borderRadius:8, objectFit:'cover', flexShrink:0 }} />
                          : <div style={{ width:28, height:28, borderRadius:8, background:`${CHART_COLORS[i]}25`, color:CHART_COLORS[i], display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:12, flexShrink:0 }}>{ae.name?.[0]}</div>
                        }
                        <span style={{ fontWeight:700, color:'#0f172a', whiteSpace:'nowrap' }}>{ae.name}</span>
                      </div>
                    </td>
                    <td style={{ padding:'12px 10px', textAlign:'center', fontWeight:700, color:'#0f172a' }}>{ae.total}</td>
                    <td style={{ padding:'12px 10px', textAlign:'center', color:'#475569' }}>{ae.today}</td>
                    <td style={{ padding:'12px 10px', textAlign:'center', color:'#475569' }}>{ae.this_month}</td>
                    <td style={{ padding:'12px 10px', textAlign:'center', fontWeight:700, color:'#10b981' }}>{ae.won}</td>
                    <td style={{ padding:'12px 10px', textAlign:'center', color:'#ef4444' }}>{ae.lost}</td>
                    <td style={{ padding:'12px 10px', textAlign:'center', color:'#6366f1' }}>{ae.quoted}</td>
                    <td style={{ padding:'12px 10px', textAlign:'center', color:'#8b5cf6' }}>{ae.bidding}</td>
                    <td style={{ padding:'12px 10px', textAlign:'center', color:'#94a3b8' }}>{ae.fake}</td>
                    <td style={{ padding:'12px 10px', textAlign:'center', color:'#64748b' }}>{ae.no_response}</td>
                    <td style={{ padding:'12px 10px', textAlign:'center', color:'#64748b' }}>{ae.cold}</td>
                    <td style={{ padding:'12px 10px', textAlign:'center' }}>
                      <span style={{ padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:700, background: winRate >= 20 ? '#f0fdf4' : winRate >= 10 ? '#fff7ed' : '#fef2f2', color: winRate >= 20 ? '#16a34a' : winRate >= 10 ? '#d97706' : '#dc2626' }}>
                        {winRate}%
                      </span>
                    </td>
                    <td style={{ padding:'12px 10px', textAlign:'center', fontSize:11, color:'#64748b', whiteSpace:'nowrap' }}>{topSource}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


// ─── Main Dashboard ──────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [preset, setPreset] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [filterDispositions, setFilterDispositions] = useState([])
  const [filterSources, setFilterSources] = useState([])
  const [filterUsers, setFilterUsers] = useState([])
  const [filterTypes, setFilterTypes] = useState([])
  const [users, setUsers] = useState([])

  useEffect(() => { api.getUsers().then(setUsers) }, [])

  const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }

  const tabs = [
    { key: 'overview', label: '▣ Overview' },
    { key: 'leads', label: '◎ Leads' },
    { key: 'repeat', label: '↻ Repeat' },
    { key: 'orders', label: '◈ Online Orders' },
  ]

  return (
    <div className="p-8 fade-in">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 className="font-display font-bold text-2xl text-ink-900">{greeting()}, {user.name} 👋</h1>
          <p className="text-ink-400 text-sm mt-0.5">Tech Atlantix · Sales Analytics</p>
        </div>
        {/* Date range pills */}
        <div style={{ display:'flex', background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:4, gap:2, flexWrap:'wrap' }}>
          {PRESETS.map(r => (
            <button key={r.value} onClick={() => setPreset(r.value)}
              style={{ padding:'6px 12px', borderRadius:8, border:'none', background: preset===r.value ? BRAND : 'transparent', color: preset===r.value ? '#0d0d0d' : '#64748b', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans", sans-serif', transition:'all 0.15s' }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date */}
      {preset === 'custom' && (
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16, background:'#fff', border:`1px solid ${BRAND}40`, borderRadius:12, padding:'10px 16px' }}>
          <span style={{ fontSize:13, fontWeight:600, color:'#475569' }}>Range:</span>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ padding:'6px 10px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:13, outline:'none' }} />
          <span style={{ color:'#94a3b8' }}>→</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ padding:'6px 10px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:13, outline:'none' }} />
        </div>
      )}

      {/* Filters — only on overview */}
      {activeTab === 'overview' && (
        <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
          <MultiSelect placeholder="All Types" options={[{value:'lead',label:'◎ Leads'},{value:'repeat',label:'↻ Repeat'},{value:'online_order',label:'◈ Orders'}]} selected={filterTypes} onChange={setFilterTypes} />
          <MultiSelect placeholder="All Dispositions" options={DISPOSITIONS} selected={filterDispositions} onChange={setFilterDispositions} />
          <MultiSelect placeholder="All Sources" options={[...LEAD_SOURCES, ...ORDER_SOURCES]} selected={filterSources} onChange={setFilterSources} />
          {user.role === 'manager' && <MultiSelect placeholder="All Team Members" options={users.map(u => ({ value: String(u.id), label: u.name }))} selected={filterUsers} onChange={setFilterUsers} />}
          {(filterDispositions.length || filterSources.length || filterUsers.length || filterTypes.length) ? (
            <button onClick={() => { setFilterDispositions([]); setFilterSources([]); setFilterUsers([]); setFilterTypes([]) }}
              style={{ fontSize:12, fontWeight:600, color:'#ef4444', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'6px 12px', cursor:'pointer', fontFamily:'"Plus Jakarta Sans", sans-serif' }}>
              ✕ Clear
            </button>
          ) : null}
        </div>
      )}

      {/* Module tabs */}
      <div style={{ display:'flex', gap:2, background:'#f1f5f9', borderRadius:14, padding:4, marginBottom:24, width:'fit-content' }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{ padding:'9px 18px', borderRadius:10, border:'none', background: activeTab===tab.key ? '#fff' : 'transparent', color: activeTab===tab.key ? '#0f172a' : '#64748b', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans", sans-serif', boxShadow: activeTab===tab.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition:'all 0.15s', whiteSpace:'nowrap' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab preset={preset} customFrom={customFrom} customTo={customTo} filterDispositions={filterDispositions} filterSources={filterSources} filterUsers={filterUsers} filterTypes={filterTypes} users={users} />}
      {activeTab === 'leads' && <LeadsTab preset={preset} customFrom={customFrom} customTo={customTo} />}
      {activeTab === 'repeat' && <RepeatTab preset={preset} customFrom={customFrom} customTo={customTo} />}
      {activeTab === 'orders' && <OrdersTab preset={preset} customFrom={customFrom} customTo={customTo} />}
    </div>
  )
}
