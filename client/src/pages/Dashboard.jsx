import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { api } from '../api'
import { useAuth } from '../App'
import { useNav } from '../App'
import { DISPOSITIONS, LEAD_SOURCES, ORDER_SOURCES, formatDate, formatDateShort, DispositionBadge } from '../components/Badges'
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
  if (v === 'today')   return { from: today, to: today }
  if (v === 'week')    { const d = new Date(now); d.setDate(d.getDate()-7); return { from: fmt(d), to: today } }
  if (v === 'month')   { const d = new Date(now); d.setDate(1); return { from: fmt(d), to: today } }
  if (v === 'quarter') { const d = new Date(now); d.setMonth(d.getMonth()-3); return { from: fmt(d), to: today } }
  return { from: '', to: '' }
}

function getDateFilters(preset, customFrom, customTo) {
  return preset === 'custom' ? { from: customFrom, to: customTo } : getPresetDates(preset)
}

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#0d0d0d', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:'8px 12px', fontSize:12 }}>
      <div style={{ color:'rgba(255,255,255,0.6)', marginBottom:4 }}>{label}</div>
      {payload.map(p => <div key={p.name} style={{ color: p.color||BRAND, display:'flex', gap:8 }}><span>{p.name}</span><b>{p.value}</b></div>)}
    </div>
  )
}

// ── Metric Card ─────────────────────────────────────────────────
function MetricCard({ label, value, sub, color = BRAND, prefix = '', suffix = '', onClick }) {
  return (
    <div onClick={onClick} style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:'16px 20px', position:'relative', overflow:'hidden', cursor: onClick ? 'pointer' : 'default', transition:'all 0.15s' }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = `0 4px 16px ${color}20` }}}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#f1f5f9'; e.currentTarget.style.boxShadow = 'none' }}>
      <div style={{ position:'absolute', top:0, left:0, width:3, height:'100%', background: color, borderRadius:'16px 0 0 16px' }} />
      {onClick && <div style={{ position:'absolute', top:10, right:12, fontSize:10, color:'#94a3b8' }}>click to view ↗</div>}
      <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>{label}</div>
      <div style={{ fontSize:28, fontWeight:800, color:'#0f172a', fontFamily:'"Bricolage Grotesque", sans-serif' }}>{prefix}{typeof value === 'number' ? value.toLocaleString() : (value ?? '—')}{suffix}</div>
      {sub && <div style={{ fontSize:12, color:'#94a3b8', marginTop:4 }}>{sub}</div>}
    </div>
  )
}

function SectionTitle({ children }) {
  return <div style={{ fontFamily:'"Bricolage Grotesque", sans-serif', fontWeight:700, fontSize:14, color:'#0f172a', marginBottom:14 }}>{children}</div>
}

// ── Drilldown Modal ─────────────────────────────────────────────
function DrilldownModal({ title, type, filters, onClose }) {
  const { navigate } = useNav()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const p = new URLSearchParams()
    if (type) p.set('type', type)
    if (filters.disposition) p.set('disposition', filters.disposition)
    if (filters.from) p.set('from', filters.from)
    if (filters.to) p.set('to', filters.to)
    if (filters.assigned_to) p.set('assigned_to', filters.assigned_to)
    fetch(`/api/inquiries?${p}`, { headers: { Authorization: `Bearer ${localStorage.getItem('crm_token')}` } })
      .then(r => r.json()).then(d => { setRows(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleRowClick = (id) => { onClose(); navigate('inquiry-detail', { id }) }

  return createPortal(
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:20, boxShadow:'0 24px 80px rgba(0,0,0,0.25)', width:'100%', maxWidth:860, maxHeight:'85vh', display:'flex', flexDirection:'column', animation:'modalIn 0.18s ease-out', fontFamily:'"Plus Jakarta Sans", sans-serif' }}>
        <style>{`@keyframes modalIn { from{opacity:0;transform:scale(0.96) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)} }`}</style>
        <div style={{ padding:'18px 24px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:16, color:'#0f172a' }}>{title}</div>
            <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>{loading ? 'Loading...' : `${rows.length} records — click any row to open`}</div>
          </div>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:10, border:'none', background:'#f1f5f9', cursor:'pointer', fontSize:18, color:'#64748b', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
        </div>
        <div style={{ overflowY:'auto', flex:1 }}>
          {loading ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:60 }}>
              <div style={{ width:28, height:28, borderRadius:'50%', border:`2px solid ${BRAND}`, borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />
            </div>
          ) : rows.length === 0 ? (
            <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>No records found</div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#f8fafc', position:'sticky', top:0 }}>
                  {['Date','Customer','Company','Assigned To','Disposition','Part Numbers'].map(h => (
                    <th key={h} style={{ textAlign:'left', padding:'10px 16px', fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} onClick={() => handleRowClick(r.id)} style={{ borderBottom:'1px solid #f1f5f9', cursor:'pointer', background: i%2===0 ? '#fff':'#fafbfc', transition:'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = `${BRAND}08`}
                    onMouseLeave={e => e.currentTarget.style.background = i%2===0 ? '#fff':'#fafbfc'}>
                    <td style={{ padding:'10px 16px', color:'#64748b', whiteSpace:'nowrap', fontFamily:'monospace', fontSize:12 }}>{formatDateShort(r.created_at)}</td>
                    <td style={{ padding:'10px 16px', fontWeight:600, color:'#0f172a' }}>{r.customer_name}</td>
                    <td style={{ padding:'10px 16px', color:'#64748b', fontSize:12 }}>{r.customer_company||'—'}</td>
                    <td style={{ padding:'10px 16px', color:'#475569' }}>{r.assigned_name||'—'}</td>
                    <td style={{ padding:'10px 16px' }}><DispositionBadge disposition={r.disposition} /></td>
                    <td style={{ padding:'10px 16px', fontFamily:'monospace', fontSize:11, color:'#475569', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {r.requirements?.map(req => req.part_number).join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Top List ────────────────────────────────────────────────────
function TopList({ data, label, color, showCompany, onDrilldown }) {
  const [period, setPeriod] = useState('month')
  const rows = data?.[period] || []
  const max = rows[0]?.count || 1
  return (
    <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:20 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <SectionTitle>{label}</SectionTitle>
        <div style={{ display:'flex', gap:2, background:'#f1f5f9', borderRadius:8, padding:3 }}>
          {[['day','Today'],['month','Month'],['year','Year']].map(([val,lbl]) => (
            <button key={val} onClick={() => setPeriod(val)} style={{ padding:'4px 10px', borderRadius:6, border:'none', background:period===val?'#fff':'transparent', color:period===val?'#0f172a':'#64748b', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', boxShadow:period===val?'0 1px 3px rgba(0,0,0,0.08)':'none', transition:'all 0.12s' }}>{lbl}</button>
          ))}
        </div>
      </div>
      {rows.length === 0 ? (
        <div style={{ textAlign:'center', color:'#94a3b8', fontSize:13, padding:'24px 0' }}>No data for this period</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {rows.map((row, i) => (
            <div key={row.name+i} style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:22, height:22, borderRadius:6, background:i===0?color:'#f1f5f9', color:i===0?'#fff':'#94a3b8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0 }}>{i+1}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
                  <div><span style={{ fontSize:13, fontWeight:600, color:'#0f172a' }}>{row.name||'Unknown'}</span>
                    {showCompany && row.company && <span style={{ fontSize:11, color:'#94a3b8', marginLeft:6 }}>· {row.company}</span>}
                  </div>
                  <span style={{ fontSize:13, fontWeight:700, color:i===0?color:'#475569', flexShrink:0, marginLeft:8 }}>{row.count}</span>
                </div>
                <div style={{ height:4, background:'#f1f5f9', borderRadius:4 }}>
                  <div style={{ height:'100%', borderRadius:4, background:i===0?color:'#cbd5e1', width:`${Math.round(row.count/max*100)}%`, transition:'width 0.3s' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Shared filter bar ───────────────────────────────────────────
function FilterBar({ preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo, filterDispositions, setFilterDispositions, filterSources, setFilterSources, filterUsers, setFilterUsers, users, activeTab }) {
  const dispositionOpts = activeTab === 'orders' ? ['Processed','Cancelled'] : DISPOSITIONS.filter(d => d !== 'Processed' && d !== 'Cancelled')
  const sourceOpts = activeTab === 'orders' ? ORDER_SOURCES : LEAD_SOURCES
  const hasFilters = filterDispositions.length || filterSources.length || filterUsers.length
  return (
    <div style={{ marginBottom:20 }}>
      {/* Date presets */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12, flexWrap:'wrap' }}>
        <div style={{ display:'flex', background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:4, gap:2 }}>
          {PRESETS.map(r => (
            <button key={r.value} onClick={() => setPreset(r.value)} style={{ padding:'6px 12px', borderRadius:8, border:'none', background:preset===r.value?BRAND:'transparent', color:preset===r.value?'#0d0d0d':'#64748b', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', transition:'all 0.15s', whiteSpace:'nowrap' }}>{r.label}</button>
          ))}
        </div>
        {preset === 'custom' && (
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'#fff', border:`1px solid ${BRAND}40`, borderRadius:12, padding:'6px 14px' }}>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ padding:'4px 8px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:13, outline:'none' }} />
            <span style={{ color:'#94a3b8' }}>→</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ padding:'4px 8px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:13, outline:'none' }} />
          </div>
        )}
      </div>
      {/* Filter dropdowns */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
        <MultiSelect placeholder={activeTab === 'orders' ? 'All Statuses' : 'All Dispositions'} options={dispositionOpts} selected={filterDispositions} onChange={setFilterDispositions} />
        <MultiSelect placeholder="All Sources" options={sourceOpts} selected={filterSources} onChange={setFilterSources} />
        <MultiSelect placeholder="All Team Members" options={users.map(u => ({ value: String(u.id), label: u.name }))} selected={filterUsers} onChange={setFilterUsers} />
        {hasFilters && <button onClick={() => { setFilterDispositions([]); setFilterSources([]); setFilterUsers([]) }} style={{ fontSize:12, fontWeight:600, color:'#ef4444', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'6px 12px', cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>✕ Clear filters</button>}
      </div>
    </div>
  )
}

// ── Loader ──────────────────────────────────────────────────────
function Loader() {
  return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'80px 0' }}><div style={{ width:32, height:32, borderRadius:'50%', border:`2px solid ${BRAND}`, borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} /></div>
}

// ── Overview Tab ────────────────────────────────────────────────
function OverviewTab({ filters, users, onDrilldown }) {
  const { navigate } = useNav()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.getAnalytics({ from: filters.from, to: filters.to, disposition: filters.dispositions, lead_source: filters.sources, assigned_to: filters.users })
      .then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [JSON.stringify(filters)])

  if (loading) return <Loader />
  const getTotal = type => data?.totals?.find(t => t.type === type)?.count || 0
  const totalAll = (data?.totals||[]).reduce((s,t) => s + t.count, 0)
  const wonRate = data?.totalCount > 0 ? Math.round(data.wonCount / data.totalCount * 100) : 0
  const trendDates = [...new Set((data?.trend||[]).map(t => t.date))].sort()
  const trendData = trendDates.map(date => {
    const row = { date: date.slice(5) }
    ;['lead','repeat','online_order'].forEach(type => { row[type] = data?.trend?.find(t => t.date===date && t.type===type)?.count || 0 })
    return row
  })

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
        <MetricCard label="Total Leads" value={getTotal('lead')} color="#3b82f6" onClick={() => onDrilldown({ title:'All Leads', type:'lead', filters: { from: filters.from, to: filters.to } })} sub={<button onClick={e => { e.stopPropagation(); navigate('leads') }} style={{ color:BRAND, background:'none', border:'none', cursor:'pointer', fontSize:12, padding:0, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>View all →</button>} />
        <MetricCard label="Repeat Inquiries" value={getTotal('repeat')} color="#6366f1" onClick={() => onDrilldown({ title:'All Repeat Inquiries', type:'repeat', filters: { from: filters.from, to: filters.to } })} sub={<button onClick={e => { e.stopPropagation(); navigate('repeat') }} style={{ color:BRAND, background:'none', border:'none', cursor:'pointer', fontSize:12, padding:0, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>View all →</button>} />
        <MetricCard label="Online Orders" value={getTotal('online_order')} color="#f59e0b" onClick={() => onDrilldown({ title:'All Online Orders', type:'online_order', filters: { from: filters.from, to: filters.to } })} sub={<button onClick={e => { e.stopPropagation(); navigate('orders') }} style={{ color:BRAND, background:'none', border:'none', cursor:'pointer', fontSize:12, padding:0, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>View all →</button>} />
        <MetricCard label="Win Rate" value={`${wonRate}%`} color={BRAND} sub={`${data?.wonCount||0} of ${data?.totalCount||0}`} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:20, marginBottom:20 }}>
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:20 }}>
          <SectionTitle>Activity Trend</SectionTitle>
          {trendData.length === 0 ? <div style={{ height:180, display:'flex', alignItems:'center', justifyContent:'center', color:'#94a3b8' }}>No data</div> : (
            <ResponsiveContainer width="100%" height={200}><BarChart data={trendData} barSize={6} barGap={2}><XAxis dataKey="date" tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} /><Tooltip content={<Tip />} /><Bar dataKey="lead" name="Leads" fill="#3b82f6" radius={[3,3,0,0]} /><Bar dataKey="repeat" name="Repeat" fill="#6366f1" radius={[3,3,0,0]} /><Bar dataKey="online_order" name="Orders" fill="#f59e0b" radius={[3,3,0,0]} /></BarChart></ResponsiveContainer>
          )}
        </div>
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:20 }}>
          <SectionTitle>By Team Member</SectionTitle>
          {!data?.byPerson?.filter(p=>p.name)?.length ? <div style={{ height:180, display:'flex', alignItems:'center', justifyContent:'center', color:'#94a3b8' }}>No data</div> : (
            <ResponsiveContainer width="100%" height={200}><BarChart data={data.byPerson.filter(p=>p.name)} layout="vertical" barSize={12}><XAxis type="number" tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} /><YAxis type="category" dataKey="name" tick={{ fontSize:11, fill:'#475569' }} axisLine={false} tickLine={false} width={55} /><Tooltip content={<Tip />} /><Bar dataKey="count" name="Total" fill={BRAND} radius={[0,4,4,0]} /></BarChart></ResponsiveContainer>
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

// ── Module data fetcher hook ────────────────────────────────────
function useModuleData(type, filters) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const key = JSON.stringify({ type, ...filters })

  useEffect(() => {
    setLoading(true)
    const p = new URLSearchParams({ type })
    if (filters.from) p.set('from', filters.from)
    if (filters.to) p.set('to', filters.to)
    if (filters.dispositions?.length) p.set('disposition', filters.dispositions.join(','))
    if (filters.sources?.length) p.set('lead_source', filters.sources.join(','))
    if (filters.users?.length) p.set('assigned_to', filters.users.join(','))
    fetch(`/api/analytics/module?${p}`, { headers: { Authorization: `Bearer ${localStorage.getItem('crm_token')}` } })
      .then(r => r.json()).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [key])

  return { data, loading }
}

// ── Leads Tab ───────────────────────────────────────────────────
function LeadsTab({ filters, onDrilldown }) {
  const { data, loading } = useModuleData('lead', filters)
  if (loading) return <Loader />
  if (!data) return null
  const p = data.period
  const trendData = (data.trend||[]).map(t => ({ ...t, date: t.date?.slice(5) }))

  const aeSourceMap = {}
  ;(data.aeSourceBreakdown||[]).forEach(row => {
    if (!aeSourceMap[row.ae_name]) aeSourceMap[row.ae_name] = []
    aeSourceMap[row.ae_name].push({ source: row.source, count: row.count })
  })

  const drill = (title, extra = {}) => onDrilldown({ title, type:'lead', filters: { from: filters.from, to: filters.to, assigned_to: filters.users?.join(','), ...extra } })

  return (
    <div>
      <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>Today</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        <MetricCard label="Leads Received" value={data.today.total} color="#3b82f6" onClick={() => drill('Leads Today', { from: new Date().toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] })} />
        {(data.today.perAE||[]).slice(0,3).map((ae,i) => (
          <MetricCard key={ae.name} label={`${ae.name} — Today`} value={ae.count} color={CHART_COLORS[i+1]} />
        ))}
      </div>

      <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>Period Summary</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        <MetricCard label="Total Leads" value={p.total} color="#3b82f6" onClick={() => drill('All Leads')} />
        <MetricCard label="Closed Won" value={p.closed_won} color="#10b981" sub={`${p.win_rate}% win rate`} onClick={() => drill('Closed Won Leads', { disposition:'Closed Won' })} />
        <MetricCard label="Closed Lost" value={p.closed_lost} color="#ef4444" onClick={() => drill('Closed Lost Leads', { disposition:'Closed Lost' })} />
        <MetricCard label="In Progress" value={p.in_progress} color="#f59e0b" />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:28 }}>
        <MetricCard label="Quoted" value={p.quoted} color="#6366f1" onClick={() => drill('Quoted Leads', { disposition:'Quoted' })} />
        <MetricCard label="Bidding" value={p.bidding} color="#8b5cf6" onClick={() => drill('Bidding Leads', { disposition:'Bidding' })} />
        <MetricCard label="Fake Leads" value={p.fake} color="#94a3b8" onClick={() => drill('Fake Leads', { disposition:'Fake Lead' })} />
        <MetricCard label="No Response" value={p.no_response} color="#64748b" onClick={() => drill('No Response Leads', { disposition:'No response' })} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:20, marginBottom:20 }}>
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:20 }}>
          <SectionTitle>Lead Trend — Won vs Total</SectionTitle>
          {trendData.length === 0 ? <div style={{ height:180, display:'flex', alignItems:'center', justifyContent:'center', color:'#94a3b8' }}>No data</div> : (
            <ResponsiveContainer width="100%" height={200}><BarChart data={trendData} barSize={8} barGap={2}><XAxis dataKey="date" tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} /><Tooltip content={<Tip />} /><Bar dataKey="total" name="Total" fill="#3b82f6" radius={[3,3,0,0]} /><Bar dataKey="won" name="Won" fill="#10b981" radius={[3,3,0,0]} /></BarChart></ResponsiveContainer>
          )}
        </div>
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:20 }}>
          <SectionTitle>By Lead Source</SectionTitle>
          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
            {(data.bySource||[]).filter(s=>s.source).slice(0,8).map((s,i) => (
              <div key={s.source} style={{ cursor:'pointer' }} onClick={() => drill(`Source: ${s.source}`, { lead_source: s.source })}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                  <span style={{ color:'#475569', fontWeight:500 }}>{s.source}</span>
                  <span style={{ fontWeight:700, color:'#0f172a' }}>{s.count}</span>
                </div>
                <div style={{ height:5, background:'#f1f5f9', borderRadius:4 }}>
                  <div style={{ height:'100%', borderRadius:4, background:CHART_COLORS[i%CHART_COLORS.length], width:`${p.total>0?Math.round(s.count/p.total*100):0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:20, marginBottom:20 }}>
        <SectionTitle>By Disposition</SectionTitle>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(170px,1fr))', gap:10 }}>
          {(data.byDisposition||[]).filter(d=>d.disposition).map((d,i) => {
            const pct = p.total>0 ? Math.round(d.count/p.total*100) : 0
            return (
              <div key={d.disposition} onClick={() => drill(`${d.disposition}`, { disposition: d.disposition })} style={{ background:'#f8fafc', borderRadius:12, padding:'12px 14px', border:'1px solid #f1f5f9', cursor:'pointer', transition:'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor=CHART_COLORS[i%CHART_COLORS.length]; e.currentTarget.style.background='#fff' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='#f1f5f9'; e.currentTarget.style.background='#f8fafc' }}>
                <div style={{ fontSize:11, color:'#64748b', fontWeight:500, marginBottom:6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.disposition}</div>
                <div style={{ fontSize:22, fontWeight:800, color:'#0f172a', fontFamily:'"Bricolage Grotesque",sans-serif' }}>{d.count}</div>
                <div style={{ height:3, background:'#e2e8f0', borderRadius:4, marginTop:8 }}>
                  <div style={{ height:'100%', borderRadius:4, background:CHART_COLORS[i%CHART_COLORS.length], width:`${pct}%` }} />
                </div>
                <div style={{ fontSize:10, color:'#94a3b8', marginTop:4 }}>{pct}% of total</div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:20 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <SectionTitle>AE Performance</SectionTitle>
          <div style={{ fontSize:11, color:'#94a3b8' }}>Click a row to drill down</div>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:'2px solid #f1f5f9' }}>
                {['Rep','Total','Today','Month','Won','Lost','Quoted','Bidding','Fake','No Resp.','Cold','Win Rate','Top Source'].map(h => (
                  <th key={h} style={{ textAlign:h==='Rep'?'left':'center', padding:'8px 10px', fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.aePerformance||[]).filter(ae=>ae.name).map((ae,i) => {
                const wr = ae.total>0 ? Math.round(ae.won/ae.total*100) : 0
                const topSrc = (aeSourceMap[ae.name]||[])[0]?.source || '—'
                return (
                  <tr key={ae.id||ae.name} onClick={() => drill(`${ae.name}'s Leads`, { assigned_to: String(ae.id) })} style={{ background:i%2===0?'#fff':'#fafbfc', borderBottom:'1px solid #f1f5f9', cursor:'pointer', transition:'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background=`${BRAND}08`}
                    onMouseLeave={e => e.currentTarget.style.background=i%2===0?'#fff':'#fafbfc'}>
                    <td style={{ padding:'12px 10px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        {ae.avatar_url ? <img src={ae.avatar_url} alt={ae.name} style={{ width:28, height:28, borderRadius:8, objectFit:'cover', flexShrink:0 }} /> : <div style={{ width:28, height:28, borderRadius:8, background:`${CHART_COLORS[i]}25`, color:CHART_COLORS[i], display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:12, flexShrink:0 }}>{ae.name?.[0]}</div>}
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
                      <span style={{ padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:700, background:wr>=20?'#f0fdf4':wr>=10?'#fff7ed':'#fef2f2', color:wr>=20?'#16a34a':wr>=10?'#d97706':'#dc2626' }}>{wr}%</span>
                    </td>
                    <td style={{ padding:'12px 10px', textAlign:'center', fontSize:11, color:'#64748b', whiteSpace:'nowrap' }}>{topSrc}</td>
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

// ── Repeat Tab ──────────────────────────────────────────────────
function RepeatTab({ filters, onDrilldown }) {
  const { data, loading } = useModuleData('repeat', filters)
  if (loading) return <Loader />
  if (!data) return null
  const p = data.period
  const drill = (title, extra = {}) => onDrilldown({ title, type:'repeat', filters: { from: filters.from, to: filters.to, assigned_to: filters.users?.join(','), ...extra } })

  return (
    <div>
      <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>Today</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24 }}>
        <MetricCard label="Inquiries Received" value={data.today.total} color="#6366f1" onClick={() => drill('Repeat Inquiries Today', { from: new Date().toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] })} />
        <MetricCard label="PPC (Period)" value={p.ppc} color="#3b82f6" onClick={() => drill('PPC Inquiries')} />
        <MetricCard label="Outbound Repeat (Period)" value={p.outbound} color="#8b5cf6" onClick={() => drill('Outbound Repeat Inquiries')} />
      </div>
      <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>Period Summary</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        <MetricCard label="Total Inquiries" value={p.total} color="#6366f1" onClick={() => drill('All Repeat Inquiries')} />
        <MetricCard label="Closed Won" value={p.closed_won} color="#10b981" onClick={() => drill('Closed Won', { disposition:'Closed Won' })} />
        <MetricCard label="Win Rate" value={`${p.win_rate}%`} color={BRAND} />
        <MetricCard label="PPC vs Outbound" value={`${p.ppc} / ${p.outbound}`} color="#8b5cf6" />
      </div>

      {/* Top 3 lists side by side */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20, marginBottom:20 }}>
        <TopList data={data.topCustomers} label="🏆 Top Customers" color="#6366f1" showCompany onDrilldown={onDrilldown} />
        <TopList data={data.topReps} label="⭐ Top Reps" color={BRAND} showCompany={false} onDrilldown={onDrilldown} />
        <TopList data={data.topCompanies} label="🏢 Top Companies" color="#f59e0b" showCompany={false} onDrilldown={onDrilldown} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:20 }}>
          <SectionTitle>By Disposition</SectionTitle>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {(data.byDisposition||[]).slice(0,10).map((d,i) => (
              <div key={d.disposition} onClick={() => drill(d.disposition, { disposition: d.disposition })} style={{ cursor:'pointer' }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                  <span style={{ color:'#475569', fontWeight:500 }}>{d.disposition||'Unknown'}</span>
                  <span style={{ fontWeight:700, color:'#0f172a' }}>{d.count}</span>
                </div>
                <div style={{ height:5, background:'#f1f5f9', borderRadius:4 }}>
                  <div style={{ height:'100%', borderRadius:4, background:CHART_COLORS[i%CHART_COLORS.length], width:`${p.total>0?Math.round(d.count/p.total*100):0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:20 }}>
          <SectionTitle>Inquiries by Rep</SectionTitle>
          <ResponsiveContainer width="100%" height={220}><BarChart data={(data.byPerson||[]).filter(p=>p.name)} layout="vertical" barSize={14}><XAxis type="number" tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} /><YAxis type="category" dataKey="name" tick={{ fontSize:11, fill:'#475569' }} axisLine={false} tickLine={false} width={55} /><Tooltip content={<Tip />} /><Bar dataKey="count" name="Inquiries" fill="#6366f1" radius={[0,4,4,0]} /></BarChart></ResponsiveContainer>
        </div>
      </div>

      <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:20 }}>
        <SectionTitle>Volume Trend</SectionTitle>
        <ResponsiveContainer width="100%" height={180}><LineChart data={(data.trend||[]).map(t => ({ ...t, date: t.date?.slice(5) }))}><XAxis dataKey="date" tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} /><Tooltip content={<Tip />} /><Line type="monotone" dataKey="total" name="Inquiries" stroke="#6366f1" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
      </div>
    </div>
  )
}

// ── Orders Tab ──────────────────────────────────────────────────
function OrdersTab({ filters, onDrilldown }) {
  const { data, loading } = useModuleData('online_order', filters)
  if (loading) return <Loader />
  if (!data) return null
  const t = data.today; const p = data.period
  const drill = (title, extra = {}) => onDrilldown({ title, type:'online_order', filters: { from: filters.from, to: filters.to, assigned_to: filters.users?.join(','), ...extra } })

  return (
    <div>
      <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>Today</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:12, marginBottom:24 }}>
        <MetricCard label="Orders Received" value={t.total} color="#f59e0b" onClick={() => drill('Orders Today', { from: new Date().toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] })} />
        <MetricCard label="Verified" value={t.verified} color="#10b981" />
        <MetricCard label="Not Verified" value={t.not_verified} color="#ef4444" />
        <MetricCard label="Order Value" value={t.value.toFixed(0)} color={BRAND} prefix="$" />
        <MetricCard label="Processed" value={t.processed} color="#10b981" />
        <MetricCard label="Cancelled" value={t.cancelled} color="#ef4444" />
      </div>
      <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>Period</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:12, marginBottom:24 }}>
        <MetricCard label="Total Orders" value={p.total} color="#f59e0b" onClick={() => drill('All Orders')} />
        <MetricCard label="Verified" value={p.verified} color="#10b981" />
        <MetricCard label="Not Verified" value={p.not_verified} color="#ef4444" />
        <MetricCard label="Total Value" value={p.value.toFixed(0)} color={BRAND} prefix="$" />
        <MetricCard label="Processed" value={p.processed} color="#10b981" sub={p.total>0?`${Math.round(p.processed/p.total*100)}%`:''} onClick={() => drill('Processed Orders', { disposition:'Processed' })} />
        <MetricCard label="Cancelled" value={p.cancelled} color="#ef4444" sub={p.total>0?`${Math.round(p.cancelled/p.total*100)}%`:''} onClick={() => drill('Cancelled Orders', { disposition:'Cancelled' })} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:20, marginBottom:20 }}>
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:20 }}>
          <SectionTitle>Processed vs Cancelled Trend</SectionTitle>
          {!data.trend?.length ? <div style={{ height:160, display:'flex', alignItems:'center', justifyContent:'center', color:'#94a3b8' }}>No data</div> : (
            <ResponsiveContainer width="100%" height={180}><BarChart data={data.trend.map(t => ({ ...t, date: t.date?.slice(5) }))} barSize={8}><XAxis dataKey="date" tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} /><Tooltip content={<Tip />} /><Bar dataKey="processed" name="Processed" fill="#10b981" radius={[3,3,0,0]} /><Bar dataKey="cancelled" name="Cancelled" fill="#ef4444" radius={[3,3,0,0]} /></BarChart></ResponsiveContainer>
          )}
        </div>
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:20 }}>
          <SectionTitle>By Source</SectionTitle>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {(data.bySource||[]).filter(s=>s.source).map((s,i) => (
              <div key={s.source} style={{ cursor:'pointer' }} onClick={() => drill(`Source: ${s.source}`)}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}><span style={{ color:'#475569', fontWeight:500 }}>{s.source}</span><span style={{ fontWeight:700, color:'#0f172a' }}>{s.count}</span></div>
                <div style={{ height:6, background:'#f1f5f9', borderRadius:4 }}><div style={{ height:'100%', borderRadius:4, background:CHART_COLORS[i], width:`${p.total>0?Math.round(s.count/p.total*100):0}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:20 }}>
        <SectionTitle>Team Performance</SectionTitle>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr style={{ borderBottom:'2px solid #f1f5f9' }}>{['Name','Total','Processed','Rate'].map(h => <th key={h} style={{ textAlign:h==='Name'?'left':'right', padding:'8px 10px', fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em' }}>{h}</th>)}</tr></thead>
          <tbody>
            {(data.byPerson||[]).filter(p=>p.name).map((p,i) => {
              const rate = p.count>0?Math.round((p.processed||0)/p.count*100):0
              return (
                <tr key={p.name} onClick={() => drill(`${p.name}'s Orders`)} style={{ borderBottom:'1px solid #f1f5f9', cursor:'pointer', background:i%2===0?'#fff':'#fafbfc' }}
                  onMouseEnter={e => e.currentTarget.style.background=`${BRAND}08`}
                  onMouseLeave={e => e.currentTarget.style.background=i%2===0?'#fff':'#fafbfc'}>
                  <td style={{ padding:'10px 10px', fontWeight:600, color:'#0f172a' }}>{p.name}</td>
                  <td style={{ padding:'10px 10px', textAlign:'right', color:'#475569' }}>{p.count}</td>
                  <td style={{ padding:'10px 10px', textAlign:'right', color:'#10b981', fontWeight:600 }}>{p.processed||0}</td>
                  <td style={{ padding:'10px 10px', textAlign:'right' }}><span style={{ padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:700, background:rate>=50?'#f0fdf4':rate>=25?'#fff7ed':'#fef2f2', color:rate>=50?'#16a34a':rate>=25?'#d97706':'#dc2626' }}>{rate}%</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main Dashboard ──────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [preset, setPreset] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [filterDispositions, setFilterDispositions] = useState([])
  const [filterSources, setFilterSources] = useState([])
  const [filterUsers, setFilterUsers] = useState([])
  const [users, setUsers] = useState([])
  const [drilldown, setDrilldown] = useState(null)

  useEffect(() => { api.getUsers().then(setUsers) }, [])

  const dateF = getDateFilters(preset, customFrom, customTo)
  const filters = { from: dateF.from, to: dateF.to, dispositions: filterDispositions, sources: filterSources, users: filterUsers }

  const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }

  const tabs = [
    { key: 'overview', label: '▣ Overview' },
    { key: 'leads',    label: '◎ Leads' },
    { key: 'repeat',   label: '↻ Repeat' },
    { key: 'orders',   label: '◈ Online Orders' },
  ]

  return (
    <div className="p-8 fade-in">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ marginBottom:20 }}>
        <h1 className="font-display font-bold text-2xl text-ink-900">{greeting()}, {user.name} 👋</h1>
        <p className="text-ink-400 text-sm mt-0.5">Tech Atlantix · Sales Analytics</p>
      </div>

      {/* Shared filter bar — same for ALL tabs */}
      <FilterBar
        preset={preset} setPreset={setPreset}
        customFrom={customFrom} setCustomFrom={setCustomFrom}
        customTo={customTo} setCustomTo={setCustomTo}
        filterDispositions={filterDispositions} setFilterDispositions={setFilterDispositions}
        filterSources={filterSources} setFilterSources={setFilterSources}
        filterUsers={filterUsers} setFilterUsers={setFilterUsers}
        users={users} activeTab={activeTab}
      />

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, background:'#f1f5f9', borderRadius:14, padding:4, marginBottom:24, width:'fit-content' }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ padding:'9px 18px', borderRadius:10, border:'none', background:activeTab===tab.key?'#fff':'transparent', color:activeTab===tab.key?'#0f172a':'#64748b', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', boxShadow:activeTab===tab.key?'0 1px 4px rgba(0,0,0,0.08)':'none', transition:'all 0.15s', whiteSpace:'nowrap' }}>{tab.label}</button>
        ))}
      </div>

      {/* Tab content — all receive same filters */}
      {activeTab === 'overview' && <OverviewTab filters={filters} users={users} onDrilldown={setDrilldown} />}
      {activeTab === 'leads'    && <LeadsTab    filters={filters} onDrilldown={setDrilldown} />}
      {activeTab === 'repeat'   && <RepeatTab   filters={filters} onDrilldown={setDrilldown} />}
      {activeTab === 'orders'   && <OrdersTab   filters={filters} onDrilldown={setDrilldown} />}

      {/* Drilldown modal */}
      {drilldown && <DrilldownModal {...drilldown} onClose={() => setDrilldown(null)} />}
    </div>
  )
}
