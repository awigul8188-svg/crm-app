import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useAuth } from '../App'
import { useNav } from '../App'
import { formatDate, timeAgo, DispositionBadge } from '../components/Badges'

const BRAND = '#00D4C8'
const C = ['#00D4C8','#3b82f6','#6366f1','#f59e0b','#ef4444','#10b981','#8b5cf6','#f97316','#ec4899','#84cc16']
const TYPE_ICONS  = { lead:'◎', repeat:'↻', online_order:'◈' }
const TYPE_COLORS = { lead:'#3b82f6', repeat:'#6366f1', online_order:'#f59e0b' }
const inp = { width:'100%', boxSizing:'border-box', background:'var(--input-bg)', border:'1px solid var(--input-border)', borderRadius:10, padding:'9px 13px', fontSize:13, color:'var(--text)', fontFamily:'"Plus Jakarta Sans",sans-serif', outline:'none' }
const token = () => localStorage.getItem('crm_token')

function Loader() {
  return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'60px 0' }}>
    <div style={{ width:26, height:26, borderRadius:'50%', border:`2px solid ${BRAND}`, borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />
  </div>
}
function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:10, padding:'8px 12px', fontSize:12 }}>
    <div style={{ color:'var(--text-3)', marginBottom:4 }}>{label}</div>
    {payload.map(p => <div key={p.name} style={{ color:p.color||BRAND, display:'flex', gap:8 }}><span>{p.name}</span><b>{p.value?.toLocaleString()}</b></div>)}
  </div>
}
function Sparkline({ data=[], color=BRAND }) {
  if (data.length < 2) return <svg width={70} height={26} />
  const max=Math.max(...data), min=Math.min(...data), range=max-min||1
  const pts = data.map((v,i) => `${(i/(data.length-1))*70},${26-((v-min)/range)*22-2}`)
  return <svg width={70} height={26} style={{ overflow:'visible' }}>
    <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <circle cx={pts[pts.length-1].split(',')[0]} cy={pts[pts.length-1].split(',')[1]} r={3} fill={color} />
  </svg>
}
function ProgressRing({ pct, size=70, stroke=7, color=BRAND, label, sub }) {
  const r = (size-stroke*2)/2, circ = 2*Math.PI*r, fill = Math.min(100,pct||0)
  return <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
    <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--card-2)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${(fill/100)*circ} ${circ}`} strokeLinecap="round"
        style={{ transition:'stroke-dasharray 0.8s ease' }} />
    </svg>
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
      <span style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:size>60?16:13, color:'var(--text)', lineHeight:1 }}>{label}</span>
      {sub&&<span style={{ fontSize:10, color:'var(--text-3)' }}>{sub}</span>}
    </div>
  </div>
}

// ── Drilldown Modal ──────────────────────────────────────────
function DrilldownModal({ title, filters, onClose }) {
  const { navigate } = useNav()
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(true)
  useEffect(() => {
    const p = new URLSearchParams()
    if (filters.type)        p.set('type', filters.type)
    if (filters.disposition) p.set('disposition', filters.disposition)
    if (filters.assigned_to) p.set('assigned_to', filters.assigned_to)
    if (filters.from)        p.set('from', filters.from)
    if (filters.to)          p.set('to', filters.to)
    fetch(`/api/inquiries?${p}`, { headers:{ Authorization:`Bearer ${token()}` } })
      .then(r=>r.json()).then(d=>{ setRows(Array.isArray(d)?d:[]); setLoading(false) })
      .catch(()=>setLoading(false))
  }, [])
  return createPortal(
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'var(--card)', borderRadius:20, boxShadow:'0 24px 80px rgba(0,0,0,0.3)', width:'100%', maxWidth:920, maxHeight:'88vh', display:'flex', flexDirection:'column', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
        <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:16, color:'var(--text)' }}>{title}</div>
            <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>{loading?'Loading...':`${rows.length} records`}</div>
          </div>
          <button onClick={onClose} style={{ width:32,height:32,borderRadius:10,border:'none',background:'var(--card-2)',cursor:'pointer',fontSize:18,color:'var(--text-3)' }}>×</button>
        </div>
        <div style={{ overflowY:'auto', flex:1 }}>
          {loading ? <Loader /> : !rows.length ? <div style={{ textAlign:'center', padding:60, color:'var(--text-3)' }}>No records found</div> : (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:'var(--card-2)', position:'sticky', top:0 }}>
                {['Date','Customer','AE','Type','Disposition','Notes'].map(h=><th key={h} style={{ textAlign:'left', padding:'10px 14px', fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:'2px solid var(--border)' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.map((r,i)=>(
                  <tr key={r.id} onClick={()=>{ navigate('inquiry-detail',{id:r.id}); onClose() }} style={{ borderBottom:'1px solid var(--border)', background:i%2===0?'var(--card)':'var(--row-alt)', cursor:'pointer' }}
                    onMouseEnter={e=>e.currentTarget.style.background=`${BRAND}08`} onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'var(--card)':'var(--row-alt)'}>
                    <td style={{ padding:'10px 14px', color:'var(--text-3)', fontSize:12, whiteSpace:'nowrap' }}>{new Date(r.created_at).toLocaleDateString()}</td>
                    <td style={{ padding:'10px 14px', fontWeight:600, color:'var(--text)', whiteSpace:'nowrap' }}>{r.customer_name}{r.customer_company&&<div style={{ fontSize:11,color:'var(--text-3)' }}>{r.customer_company}</div>}</td>
                    <td style={{ padding:'10px 14px', color:'var(--text-2)', fontSize:12, whiteSpace:'nowrap' }}>{r.ae_name||'—'}</td>
                    <td style={{ padding:'10px 14px' }}><span style={{ fontSize:12, color:TYPE_COLORS[r.type]||'var(--text-3)' }}>{TYPE_ICONS[r.type]} {r.type==='online_order'?'Order':r.type==='lead'?'Lead':'Repeat'}</span></td>
                    <td style={{ padding:'10px 14px' }}><DispositionBadge disposition={r.disposition} /></td>
                    <td style={{ padding:'10px 14px', color:'var(--text-3)', fontSize:12, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.notes||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>, document.body
  )
}

// ── Set Target Modal ─────────────────────────────────────────
function SetTargetModal({ ae, existing, onClose, onSaved }) {
  const { year, quarter } = getCurrentQuarter()
  const [form, setForm] = useState({ year, quarter, revenue_target: existing?.revenue_target||'', leads_target: existing?.leads_target||'', repeat_target: existing?.repeat_target||'', orders_target: existing?.orders_target||'', notes: existing?.notes||'' })
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  const save = async () => {
    setSaving(true)
    await fetch('/api/analytics/targets', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token()}` }, body: JSON.stringify({ ae_id: ae.id, ...form }) })
    setSaving(false); onSaved()
  }
  return createPortal(
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:999999, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'var(--card)', borderRadius:20, boxShadow:'0 24px 80px rgba(0,0,0,0.3)', width:'100%', maxWidth:480, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
        <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:16, color:'var(--text)' }}>Set Quarterly Target</div>
            <div style={{ fontSize:12, color:'var(--text-3)' }}>for {ae.name}</div>
          </div>
          <button onClick={onClose} style={{ width:32,height:32,borderRadius:10,border:'none',background:'var(--card-2)',cursor:'pointer',fontSize:18,color:'var(--text-3)' }}>×</button>
        </div>
        <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Year</div>
              <select value={form.year} onChange={e=>set('year',parseInt(e.target.value))} style={{ ...inp, cursor:'pointer' }}>
                {[2024,2025,2026,2027].map(y=><option key={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Quarter</div>
              <select value={form.quarter} onChange={e=>set('quarter',parseInt(e.target.value))} style={{ ...inp, cursor:'pointer' }}>
                {[1,2,3,4].map(q=><option key={q} value={q}>Q{q}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Revenue Target ($)</div>
            <input value={form.revenue_target} onChange={e=>set('revenue_target',e.target.value)} placeholder="e.g. 25000" style={inp} type="number" />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            {[['Leads Target','leads_target'],['Repeat Target','repeat_target'],['Orders Target','orders_target']].map(([label,key])=>(
              <div key={key}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>{label}</div>
                <input value={form[key]} onChange={e=>set(key,e.target.value)} placeholder="0" style={inp} type="number" />
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Notes</div>
            <input value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Optional notes..." style={inp} />
          </div>
          <button onClick={save} disabled={saving} style={{ padding:'12px', borderRadius:12, border:'none', background:saving?'var(--card-2)':BRAND, color:saving?'var(--text-3)':'#060610', fontWeight:700, fontSize:14, cursor:saving?'not-allowed':'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
            {saving ? 'Saving...' : '✓ Save Target'}
          </button>
        </div>
      </div>
    </div>, document.body
  )
}

function getCurrentQuarter() {
  const now = new Date()
  return { year: now.getFullYear(), quarter: Math.ceil((now.getMonth()+1)/3) }
}

// ── Metric Card ──────────────────────────────────────────────
function MetricCard({ label, value, sub, color=BRAND, icon, onClick, dark }) {
  return (
    <div onClick={onClick} style={{ background: dark ? 'linear-gradient(135deg,#0d1117,#0f2027)' : 'var(--card)', borderRadius:16, border:dark?'none':'1px solid var(--border)', padding:'20px', cursor:onClick?'pointer':'default', transition:'all 0.15s', position:'relative', overflow:'hidden' }}
      onMouseEnter={e=>{ if(onClick){ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow=`0 8px 24px ${color}25` }}}
      onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none' }}>
      {dark && <div style={{ position:'absolute', top:-30, right:-30, width:120, height:120, borderRadius:'50%', background:`radial-gradient(circle,${color}30 0%,transparent 70%)`, pointerEvents:'none' }} />}
      {onClick && !dark && <div style={{ position:'absolute', top:0, left:0, width:3, height:'100%', background:color, borderRadius:'16px 0 0 16px' }} />}
      <div style={{ fontSize:10, fontWeight:700, color:dark?'rgba(255,255,255,0.4)':'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>{icon&&<span style={{ marginRight:6 }}>{icon}</span>}{label}</div>
      <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:900, fontSize:32, color:dark?'#fff':'var(--text)', lineHeight:1, marginBottom:4 }}>{value}</div>
      {sub && <div style={{ fontSize:12, color:dark?'rgba(255,255,255,0.4)':'var(--text-3)' }}>{sub}</div>}
      {onClick && <div style={{ position:'absolute', top:12, right:12, fontSize:9, fontWeight:700, color:dark?'rgba(255,255,255,0.3)':'var(--text-4)' }}>VIEW ↗</div>}
    </div>
  )
}

// ── Main Manager Dashboard ───────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth(); const { navigate } = useNav()
  const [data, setData] = useState(null); const [loading, setLoading] = useState(true)
  const [drilldown, setDrilldown] = useState(null) // { title, filters }
  const [targetModal, setTargetModal] = useState(null) // { ae, existing }
  const [activeTab, setActiveTab] = useState('overview')

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/analytics/manager-full', { headers:{ Authorization:`Bearer ${token()}` } })
      .then(r=>r.json()).then(d=>{ setData(d); setLoading(false) }).catch(()=>setLoading(false))
  }, [])
  useEffect(()=>{ load() },[])

  const drill = (title, filters={}) => setDrilldown({ title, filters })
  const { year, quarter } = getCurrentQuarter()

  const greet = () => { const h=new Date().getHours(); return h<12?'Good morning':h<17?'Good afternoon':'Good evening' }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}><div style={{ width:28,height:28,borderRadius:'50%',border:`2px solid ${BRAND}`,borderTopColor:'transparent',animation:'spin 0.8s linear infinite' }}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
  if (!data) return null

  const { kpis, aePerformance, revenueByMonth, pipeline, byType, followupsToday, meta } = data
  const totalFollowups = followupsToday.reduce((s,ae) => s+ae.overdue.length+ae.today.length, 0)

  const tabs = [
    { key:'overview', label:'Overview' },
    { key:'team',     label:`Team (${aePerformance.length})` },
    { key:'targets',  label:'Targets' },
    { key:'followups',label:`Follow-ups${totalFollowups>0?` (${totalFollowups})`:''}` },
  ]

  return (
    <div style={{ padding:'24px 28px', flex:1, overflowY:'auto', maxWidth:1400, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:24, color:'var(--text)', margin:0 }}>{greet()}, {user.name} 👋</h1>
          <p style={{ color:'var(--text-3)', fontSize:13, margin:'3px 0 0' }}>{new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})} · Q{meta.quarter} {meta.year}</p>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={()=>navigate('leads')} style={{ padding:'9px 16px', borderRadius:10, border:'1px solid var(--border)', background:'var(--card)', color:'var(--text-2)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>View Leads</button>
          <button onClick={load} style={{ padding:'9px 16px', borderRadius:10, border:'none', background:BRAND, color:'#060610', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>↺ Refresh</button>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:14, marginBottom:20 }}>
        <MetricCard label="Total Revenue (All Time)" value={`$${(kpis.totalRevenue/1000).toFixed(1)}k`} color={BRAND} dark onClick={()=>drill('All Closed Won / Processed',{})} />
        <MetricCard label={`Q${meta.quarter} Revenue`} value={`$${(kpis.quarterRevenue/1000).toFixed(1)}k`} color="#10b981" dark onClick={()=>drill(`Q${meta.quarter} Revenue`,{from:meta.qStart,to:meta.qEnd})} />
        <MetricCard label="Team Win Rate" value={`${kpis.teamWinRate}%`} color="#6366f1" onClick={()=>drill('All Closed Won',{disposition:'Closed Won'})} sub={`${kpis.totalWon} closed won`} />
        <MetricCard label="Active Pipeline" value={kpis.activePipeline} color="#f59e0b" onClick={()=>drill('Active Pipeline')} sub="in-progress inquiries" />
      </div>

      {/* Today quick stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:24 }}>
        {[{label:'Leads Today',value:kpis.todayLeads,color:'#3b82f6',type:'lead'},{label:'Orders Today',value:kpis.todayOrders,color:'#f59e0b',type:'online_order'},{label:'Repeat Today',value:kpis.todayRepeat,color:'#6366f1',type:'repeat'}].map(s=>(
          <div key={s.label} onClick={()=>drill(s.label,{type:s.type,from:new Date().toISOString().split('T')[0],to:new Date().toISOString().split('T')[0]})} style={{ background:'var(--card)', borderRadius:12, border:'1px solid var(--border)', padding:'14px 18px', cursor:'pointer', display:'flex', alignItems:'center', gap:14, transition:'all 0.15s' }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=s.color;e.currentTarget.style.background='var(--brand-dim)'}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--card)'}}>
            <div style={{ width:40,height:40,borderRadius:12,background:`${s.color}18`,color:s.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0 }}>{TYPE_ICONS[s.type]}</div>
            <div><div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:24, color:'var(--text)', lineHeight:1 }}>{s.value}</div><div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>{s.label}</div></div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, background:'var(--card-2)', borderRadius:14, padding:4, marginBottom:24, width:'fit-content', border:'1px solid var(--border)' }}>
        {tabs.map(tab=>(
          <button key={tab.key} onClick={()=>setActiveTab(tab.key)} style={{ padding:'8px 18px', borderRadius:10, border:'none', background:activeTab===tab.key?'var(--card)':'transparent', color:activeTab===tab.key?'var(--text)':'var(--text-3)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', boxShadow:activeTab===tab.key?'0 1px 4px rgba(0,0,0,0.1)':'none', transition:'all 0.15s', whiteSpace:'nowrap' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ────────────────────────────────── */}
      {activeTab==='overview' && (
        <div style={{ animation:'fadeIn 0.2s ease' }}>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16, marginBottom:16 }}>
            {/* Revenue chart */}
            <div style={{ background:'var(--card)', borderRadius:16, border:'1px solid var(--border)', padding:'20px 22px' }}>
              <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:15, color:'var(--text)', marginBottom:16 }}>Revenue — Last 12 Months</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={revenueByMonth} barSize={18}>
                  <XAxis dataKey="month" tick={{ fontSize:11, fill:'var(--text-3)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:11, fill:'var(--text-3)' }} axisLine={false} tickLine={false} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<Tip />} formatter={v=>[`$${v.toLocaleString()}`,'Revenue']} />
                  <Bar dataKey="revenue" name="Revenue" radius={[6,6,0,0]}>
                    {revenueByMonth.map((_,i)=><Cell key={i} fill={i===revenueByMonth.length-1?BRAND:`${BRAND}60`} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* By type */}
            <div style={{ background:'var(--card)', borderRadius:16, border:'1px solid var(--border)', padding:'20px 22px' }}>
              <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:15, color:'var(--text)', marginBottom:16 }}>By Type</div>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {byType.map(t=>(
                  <div key={t.type} onClick={()=>drill(`${t.type==='lead'?'Leads':t.type==='repeat'?'Repeats':'Orders'} — All`,{type:t.type})} style={{ cursor:'pointer' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                      <span style={{ fontSize:13, fontWeight:600, color:'var(--text-2)' }}>{TYPE_ICONS[t.type]} {t.type==='lead'?'Leads':t.type==='repeat'?'Repeats':'Orders'}</span>
                      <span style={{ fontSize:12, color:'var(--text-3)' }}>{t.won}/{t.total} · <span style={{ color:BRAND, fontWeight:700 }}>{t.winRate}%</span></span>
                    </div>
                    <div style={{ height:6, background:'var(--card-2)', borderRadius:99 }}>
                      <div style={{ height:'100%', width:`${t.winRate}%`, background:TYPE_COLORS[t.type]||BRAND, borderRadius:99, transition:'width 0.6s' }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:20, paddingTop:16, borderTop:'1px solid var(--border)' }}>
                <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:14, color:'var(--text)', marginBottom:12 }}>Pipeline Status</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {pipeline.slice(0,6).map((p,i)=>(
                    <div key={p.disposition} onClick={()=>drill(p.disposition,{disposition:p.disposition})} style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                      <div style={{ width:8,height:8,borderRadius:3,background:C[i%C.length],flexShrink:0 }} />
                      <span style={{ flex:1, fontSize:12, color:'var(--text-2)' }}>{p.disposition}</span>
                      <span style={{ fontSize:12, fontWeight:700, color:'var(--text)' }}>{p.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* AE comparison summary */}
          <div style={{ background:'var(--card)', borderRadius:16, border:'1px solid var(--border)', padding:'20px 22px' }}>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:15, color:'var(--text)', marginBottom:16 }}>Team at a Glance</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12 }}>
              {aePerformance.map(ae=>(
                <div key={ae.id} onClick={()=>drill(`${ae.name}'s Inquiries`,{assigned_to:ae.id})} style={{ background:'var(--card-2)', borderRadius:12, padding:'14px', border:'1px solid var(--border)', cursor:'pointer', transition:'all 0.15s' }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=BRAND;e.currentTarget.style.background='var(--brand-dim)'}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--card-2)'}}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                    <div style={{ width:34,height:34,borderRadius:10,background:`${BRAND}20`,color:BRAND,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:13 }}>{ae.name.split(' ').map(n=>n[0]).join('').slice(0,2)}</div>
                    <div><div style={{ fontWeight:700, color:'var(--text)', fontSize:13 }}>{ae.name}</div><div style={{ fontSize:11, color:'var(--text-3)' }}>{ae.total} total · {ae.won} won</div></div>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:6 }}>
                    <span style={{ color:'var(--text-3)' }}>Win Rate</span>
                    <span style={{ fontWeight:700, color:ae.winRate>=70?'#10b981':ae.winRate>=50?BRAND:'#f59e0b' }}>{ae.winRate}%</span>
                  </div>
                  <div style={{ height:5, background:'var(--border)', borderRadius:99, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${ae.winRate}%`, background:ae.winRate>=70?'#10b981':ae.winRate>=50?BRAND:'#f59e0b', borderRadius:99 }} />
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-3)', marginTop:8 }}>Today: <span style={{ color:'var(--text-2)', fontWeight:600 }}>{ae.todayCount}</span> · Q{meta.quarter}: <span style={{ color:BRAND, fontWeight:600 }}>{ae.quarter.leads+ae.quarter.repeats+ae.quarter.orders}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TEAM TAB ──────────────────────────────────── */}
      {activeTab==='team' && (
        <div style={{ animation:'fadeIn 0.2s ease' }}>
          <div style={{ background:'var(--card)', borderRadius:16, border:'1px solid var(--border)', overflow:'hidden', marginBottom:16 }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:'var(--card-2)' }}>
                {['AE','Leads','Repeats','Orders','Win Rate','Revenue','Q Revenue','Trend'].map(h=>(
                  <th key={h} style={{ textAlign:'left', padding:'12px 16px', fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', borderBottom:'2px solid var(--border)' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {[...aePerformance].sort((a,b)=>b.won-a.won).map((ae,i)=>(
                  <tr key={ae.id} style={{ borderBottom:'1px solid var(--border)', transition:'background 0.1s', cursor:'pointer' }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--brand-dim)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{ padding:'14px 16px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:34,height:34,borderRadius:10,background:`${BRAND}20`,color:BRAND,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:13,flexShrink:0 }}>{ae.name.split(' ').map(n=>n[0]).join('').slice(0,2)}</div>
                        <div><div style={{ fontWeight:700, color:'var(--text)' }}>{ae.name}</div><div style={{ fontSize:11, color:'var(--text-3)' }}>{ae.total} total</div></div>
                      </div>
                    </td>
                    <td style={{ padding:'14px 16px' }} onClick={()=>drill(`${ae.name} — Leads`,{assigned_to:ae.id,type:'lead'})}>
                      <span style={{ color:BRAND, fontWeight:700 }}>{ae.leads.won}</span><span style={{ color:'var(--text-3)', fontSize:12 }}>/{ae.leads.total}</span>
                      <div style={{ fontSize:11, color:'var(--text-3)' }}>{ae.leads.winRate}%</div>
                    </td>
                    <td style={{ padding:'14px 16px' }} onClick={()=>drill(`${ae.name} — Repeats`,{assigned_to:ae.id,type:'repeat'})}>
                      <span style={{ color:BRAND, fontWeight:700 }}>{ae.repeats.won}</span><span style={{ color:'var(--text-3)', fontSize:12 }}>/{ae.repeats.total}</span>
                      <div style={{ fontSize:11, color:'var(--text-3)' }}>{ae.repeats.winRate}%</div>
                    </td>
                    <td style={{ padding:'14px 16px' }} onClick={()=>drill(`${ae.name} — Orders`,{assigned_to:ae.id,type:'online_order'})}>
                      <span style={{ color:BRAND, fontWeight:700 }}>{ae.orders.processed}</span><span style={{ color:'var(--text-3)', fontSize:12 }}>/{ae.orders.total}</span>
                      <div style={{ fontSize:11, color:'var(--text-3)' }}>{ae.orders.rate}%</div>
                    </td>
                    <td style={{ padding:'14px 16px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:120 }}>
                        <div style={{ flex:1, height:6, background:'var(--card-2)', borderRadius:99 }}>
                          <div style={{ height:'100%', width:`${ae.winRate}%`, background:ae.winRate>=70?'#10b981':ae.winRate>=50?BRAND:'#f59e0b', borderRadius:99 }} />
                        </div>
                        <span style={{ fontSize:12, fontWeight:700, color:'var(--text-2)', minWidth:34 }}>{ae.winRate}%</span>
                      </div>
                    </td>
                    <td style={{ padding:'14px 16px' }}><span style={{ fontWeight:700, color:'var(--text)' }}>${(ae.revenue/1000).toFixed(1)}k</span></td>
                    <td style={{ padding:'14px 16px' }}><span style={{ fontWeight:700, color:BRAND }}>${(ae.quarterRevenue/1000).toFixed(1)}k</span></td>
                    <td style={{ padding:'14px 16px' }}><Sparkline data={ae.trend.map(t=>t.won)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Monthly breakdown per AE */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            {aePerformance.map(ae=>(
              <div key={ae.id} style={{ background:'var(--card)', borderRadius:16, border:'1px solid var(--border)', padding:'18px 20px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                  <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:14, color:'var(--text)' }}>{ae.name}</div>
                  <button onClick={()=>drill(`${ae.name}'s All Inquiries`,{assigned_to:ae.id})} style={{ fontSize:11, color:BRAND, fontWeight:700, background:'none', border:'none', cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>View all →</button>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                  {[{label:'Leads',won:ae.leads.won,total:ae.leads.total,rate:ae.leads.winRate,color:'#3b82f6',type:'lead'},{label:'Repeats',won:ae.repeats.won,total:ae.repeats.total,rate:ae.repeats.winRate,color:'#6366f1',type:'repeat'},{label:'Orders',won:ae.orders.processed,total:ae.orders.total,rate:ae.orders.rate,color:'#f59e0b',type:'online_order'}].map(s=>(
                    <div key={s.label} onClick={()=>drill(`${ae.name} — ${s.label}`,{assigned_to:ae.id,type:s.type})} style={{ background:'var(--card-2)', borderRadius:10, padding:'12px', border:'1px solid var(--border)', cursor:'pointer', textAlign:'center', transition:'all 0.15s' }}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor=s.color;e.currentTarget.style.background='var(--card)'}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--card-2)'}}>
                      <div style={{ fontSize:10, fontWeight:700, color:'var(--text-4)', textTransform:'uppercase', marginBottom:6 }}>{s.label}</div>
                      <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:20, color:s.color }}>{s.won}</div>
                      <div style={{ fontSize:11, color:'var(--text-3)' }}>of {s.total}</div>
                      <div style={{ height:3, background:'var(--border)', borderRadius:99, marginTop:8 }}><div style={{ height:'100%', width:`${s.rate}%`, background:s.color, borderRadius:99 }} /></div>
                      <div style={{ fontSize:10, fontWeight:700, color:s.color, marginTop:4 }}>{s.rate}%</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:12, paddingTop:12, borderTop:'1px solid var(--border)' }}>
                  <div style={{ fontSize:12, color:'var(--text-3)' }}>10-week trend</div>
                  <Sparkline data={ae.trend.map(t=>t.total)} color="var(--text-3)" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TARGETS TAB ──────────────────────────────── */}
      {activeTab==='targets' && (
        <div style={{ animation:'fadeIn 0.2s ease' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div style={{ fontSize:13, color:'var(--text-3)' }}>Q{meta.quarter} {meta.year} targets — click an AE to set or edit their target</div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:16 }}>
            {aePerformance.map(ae=>{
              const t = ae.target
              const revPct  = t?.revenue_target > 0 ? Math.min(100,Math.round((ae.quarter.revenue||0)/t.revenue_target*100)) : 0
              const leadPct = t?.leads_target > 0   ? Math.min(100,Math.round((ae.quarter.leads||0)/t.leads_target*100)) : 0
              const repPct  = t?.repeat_target > 0  ? Math.min(100,Math.round((ae.quarter.repeats||0)/t.repeat_target*100)) : 0
              const ordPct  = t?.orders_target > 0  ? Math.min(100,Math.round((ae.quarter.orders||0)/t.orders_target*100)) : 0
              const overallPct = t ? Math.round((revPct+leadPct+repPct+ordPct)/4) : 0
              return (
                <div key={ae.id} style={{ background:'var(--card)', borderRadius:16, border:`1px solid ${t?'var(--border)':BRAND+'40'}`, padding:'20px', position:'relative' }}>
                  {!t && <div style={{ position:'absolute', top:12, right:12, fontSize:10, fontWeight:700, color:BRAND, background:`${BRAND}15`, padding:'3px 10px', borderRadius:20 }}>NO TARGET SET</div>}
                  <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
                    <ProgressRing pct={overallPct} size={64} stroke={6} color={overallPct>=80?'#10b981':overallPct>=50?BRAND:'#f59e0b'} label={`${overallPct}%`} sub="overall" />
                    <div>
                      <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:16, color:'var(--text)' }}>{ae.name}</div>
                      <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>Q{meta.quarter} {meta.year}</div>
                      <button onClick={()=>setTargetModal({ae, existing:t})} style={{ marginTop:6, fontSize:11, fontWeight:700, color:BRAND, background:`${BRAND}15`, border:`1px solid ${BRAND}30`, borderRadius:8, padding:'4px 12px', cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
                        {t ? '✏ Edit Target' : '+ Set Target'}
                      </button>
                    </div>
                  </div>
                  {t ? (
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                      {[
                        {label:'Revenue',achieved:`$${(ae.quarter.revenue/1000).toFixed(1)}k`,target:`$${(t.revenue_target/1000).toFixed(1)}k`,pct:revPct,color:'#10b981'},
                        {label:'Leads Won',achieved:ae.quarter.leads,target:t.leads_target,pct:leadPct,color:'#3b82f6'},
                        {label:'Repeats Won',achieved:ae.quarter.repeats,target:t.repeat_target,pct:repPct,color:'#6366f1'},
                        {label:'Orders Proc',achieved:ae.quarter.orders,target:t.orders_target,pct:ordPct,color:'#f59e0b'},
                      ].filter(r=>r.target>0).map(row=>(
                        <div key={row.label}>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                            <span style={{ color:'var(--text-2)', fontWeight:500 }}>{row.label}</span>
                            <span style={{ color:'var(--text)', fontWeight:700 }}>{row.achieved} <span style={{ color:'var(--text-3)', fontWeight:400 }}>/ {row.target}</span></span>
                          </div>
                          <div style={{ height:6, background:'var(--card-2)', borderRadius:99, overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${row.pct}%`, background:row.color, borderRadius:99, transition:'width 0.6s' }} />
                          </div>
                          <div style={{ fontSize:10, color:row.pct>=100?'#10b981':row.color, fontWeight:700, marginTop:2 }}>{row.pct}%{row.pct>=100&&' ✓'}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign:'center', padding:'16px 0', color:'var(--text-3)', fontSize:13 }}>No target set for this quarter. Click "Set Target" above.</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── FOLLOW-UPS TAB ───────────────────────────── */}
      {activeTab==='followups' && (
        <div style={{ animation:'fadeIn 0.2s ease' }}>
          {followupsToday.length === 0 ? (
            <div style={{ background:'var(--card)', borderRadius:16, border:'1px solid var(--border)', padding:'60px', textAlign:'center' }}>
              <div style={{ fontSize:36, marginBottom:12 }}>✅</div>
              <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:18, color:'var(--text)', marginBottom:8 }}>All caught up!</div>
              <div style={{ color:'var(--text-3)', fontSize:14 }}>No overdue or today's follow-ups for the team.</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {followupsToday.map(ae=>(
                <div key={ae.ae_id} style={{ background:'var(--card)', borderRadius:16, border:'1px solid var(--border)', overflow:'hidden' }}>
                  <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', background:'var(--card-2)', display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ width:32,height:32,borderRadius:10,background:`${BRAND}20`,color:BRAND,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:12 }}>{ae.ae_name.split(' ').map(n=>n[0]).join('').slice(0,2)}</div>
                    <span style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:14, color:'var(--text)' }}>{ae.ae_name}</span>
                    {ae.overdue.length>0&&<span style={{ fontSize:11, fontWeight:700, color:'#ef4444', background:'#fef2f2', padding:'2px 10px', borderRadius:20, border:'1px solid #fecaca' }}>⚠ {ae.overdue.length} overdue</span>}
                    {ae.today.length>0&&<span style={{ fontSize:11, fontWeight:700, color:'#f59e0b', background:'#fffbeb', padding:'2px 10px', borderRadius:20, border:'1px solid #fde68a' }}>📅 {ae.today.length} today</span>}
                  </div>
                  <div style={{ padding:'14px 20px', display:'flex', flexDirection:'column', gap:8 }}>
                    {[...ae.overdue.map(f=>({...f,urgency:'overdue'})), ...ae.today.map(f=>({...f,urgency:'today'}))].map(fu=>(
                      <div key={fu.id} onClick={()=>navigate('inquiry-detail',{id:fu.inquiry_id})} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:10, background:'var(--card-2)', cursor:'pointer', border:`1px solid ${fu.urgency==='overdue'?'#fecaca':'var(--border)'}`, transition:'all 0.15s' }}
                        onMouseEnter={e=>e.currentTarget.style.background='var(--brand-dim)'} onMouseLeave={e=>e.currentTarget.style.background='var(--card-2)'}>
                        <div style={{ width:8,height:8,borderRadius:'50%',background:fu.urgency==='overdue'?'#ef4444':'#f59e0b',flexShrink:0 }} />
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:600, fontSize:13, color:'var(--text)' }}>{fu.customer_name}</div>
                          <div style={{ fontSize:12, color:'var(--text-3)', marginTop:1 }}>{fu.note}</div>
                        </div>
                        <div style={{ fontSize:11, fontWeight:700, color:fu.urgency==='overdue'?'#ef4444':'#f59e0b', flexShrink:0 }}>{formatDate(fu.follow_up_date)}</div>
                        <span style={{ fontSize:11, color:TYPE_COLORS[fu.inquiry_type]||'var(--text-3)', background:`${TYPE_COLORS[fu.inquiry_type]||'#94a3b8'}18`, padding:'2px 8px', borderRadius:8, flexShrink:0 }}>{TYPE_ICONS[fu.inquiry_type]} {fu.inquiry_type==='online_order'?'Order':fu.inquiry_type==='lead'?'Lead':'Repeat'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {drilldown && <DrilldownModal title={drilldown.title} filters={drilldown.filters} onClose={()=>setDrilldown(null)} />}
      {targetModal && <SetTargetModal ae={targetModal.ae} existing={targetModal.existing} onClose={()=>setTargetModal(null)} onSaved={()=>{ setTargetModal(null); load() }} />}
    </div>
  )
}
