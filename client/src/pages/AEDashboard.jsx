import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useAuth } from '../App'
import { useNav } from '../App'
import { formatDate, DispositionBadge } from '../components/Badges'

const BRAND = '#00D4C8'
const TYPE_COLORS = { lead:'#3b82f6', repeat:'#6366f1', online_order:'#f59e0b' }
const TYPE_ICONS  = { lead:'◎', repeat:'↻', online_order:'◈' }
const token = () => localStorage.getItem('crm_token')
const inp = { width:'100%', boxSizing:'border-box', background:'var(--input-bg)', border:'1px solid var(--input-border)', borderRadius:10, padding:'9px 13px', fontSize:13, color:'var(--text)', fontFamily:'"Plus Jakarta Sans",sans-serif', outline:'none' }

function Loader() {
  return <div style={{ display:'flex',alignItems:'center',justifyContent:'center',padding:'48px 0' }}>
    <div style={{ width:24,height:24,borderRadius:'50%',border:`2px solid ${BRAND}`,borderTopColor:'transparent',animation:'spin 0.8s linear infinite' }} />
  </div>
}
function Tip({ active, payload, label }) {
  if (!active||!payload?.length) return null
  return <div style={{ background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,padding:'8px 12px',fontSize:12 }}>
    <div style={{ color:'var(--text-3)',marginBottom:4 }}>{label}</div>
    {payload.map(p=><div key={p.name} style={{ color:p.color||BRAND,display:'flex',gap:8 }}><span>{p.name}</span><b>{p.value}</b></div>)}
  </div>
}

// ── Progress Ring ────────────────────────────────────────────
function Ring({ pct, size=80, stroke=8, color=BRAND, children }) {
  const r=(size-stroke*2)/2, circ=2*Math.PI*r, fill=Math.min(100,pct||0)
  return (
    <div style={{ position:'relative',width:size,height:size,flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--card-2)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${(fill/100)*circ} ${circ}`} strokeLinecap="round"
          style={{ transition:'stroke-dasharray 0.8s ease' }} />
      </svg>
      <div style={{ position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center' }}>{children}</div>
    </div>
  )
}

// ── Drilldown Modal ──────────────────────────────────────────
function DrilldownModal({ title, filters, onClose }) {
  const { navigate } = useNav()
  const { user } = useAuth()
  const [rows,setRows]=useState([]); const [loading,setLoading]=useState(true)
  useEffect(()=>{
    const p=new URLSearchParams()
    Object.entries({ ...filters, assigned_to: user.id }).forEach(([k,v])=>{ if(v) p.set(k,v) })
    fetch(`/api/inquiries?${p}`,{headers:{Authorization:`Bearer ${token()}`}})
      .then(r=>r.json()).then(d=>{setRows(Array.isArray(d)?d:[]);setLoading(false)}).catch(()=>setLoading(false))
  },[])
  return createPortal(
    <div onClick={onClose} style={{ position:'fixed',inset:0,zIndex:99999,background:'rgba(0,0,0,0.55)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'var(--card)',borderRadius:20,boxShadow:'0 24px 80px rgba(0,0,0,0.3)',width:'100%',maxWidth:880,maxHeight:'88vh',display:'flex',flexDirection:'column',fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
        <div style={{ padding:'18px 24px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0 }}>
          <div>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:16,color:'var(--text)' }}>{title}</div>
            <div style={{ fontSize:12,color:'var(--text-3)',marginTop:2 }}>{loading?'Loading…':`${rows.length} records`}</div>
          </div>
          <button onClick={onClose} style={{ width:32,height:32,borderRadius:10,border:'none',background:'var(--card-2)',cursor:'pointer',fontSize:18,color:'var(--text-3)' }}>×</button>
        </div>
        <div style={{ overflowY:'auto',flex:1 }}>
          {loading?<Loader />:!rows.length?<div style={{ textAlign:'center',padding:60,color:'var(--text-3)' }}>No records found</div>:(
            <table style={{ width:'100%',borderCollapse:'collapse',fontSize:13 }}>
              <thead><tr style={{ background:'var(--card-2)',position:'sticky',top:0 }}>
                {['Date','Customer','Type','Disposition','Value','Notes'].map(h=><th key={h} style={{ textAlign:'left',padding:'10px 14px',fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.06em',borderBottom:'2px solid var(--border)' }}>{h}</th>)}
              </tr></thead>
              <tbody>{rows.map((r,i)=>(
                <tr key={r.id} onClick={()=>{navigate('inquiry-detail',{id:r.id});onClose()}} style={{ borderBottom:'1px solid var(--border)',background:i%2===0?'var(--card)':'var(--row-alt)',cursor:'pointer' }}
                  onMouseEnter={e=>e.currentTarget.style.background=`${BRAND}08`} onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'var(--card)':'var(--row-alt)'}>
                  <td style={{ padding:'10px 14px',color:'var(--text-3)',fontSize:12,whiteSpace:'nowrap' }}>{new Date(r.created_at).toLocaleDateString()}</td>
                  <td style={{ padding:'10px 14px',fontWeight:600,color:'var(--text)' }}>{r.customer_name}{r.customer_company&&<div style={{ fontSize:11,color:'var(--text-3)' }}>{r.customer_company}</div>}</td>
                  <td style={{ padding:'10px 14px' }}><span style={{ fontSize:12,color:TYPE_COLORS[r.type]||'var(--text-3)' }}>{TYPE_ICONS[r.type]} {r.type==='online_order'?'Order':r.type==='lead'?'Lead':'Repeat'}</span></td>
                  <td style={{ padding:'10px 14px' }}><DispositionBadge disposition={r.disposition} /></td>
                  <td style={{ padding:'10px 14px',fontWeight:600,color:'var(--text)' }}>{r.order_amount?`$${r.order_amount}`:'—'}</td>
                  <td style={{ padding:'10px 14px',color:'var(--text-3)',fontSize:12,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{r.notes||'—'}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>
    </div>, document.body
  )
}

// ── Follow-up row ─────────────────────────────────────────────
function FollowupRow({ fu, onComplete }) {
  const { navigate } = useNav()
  const isOverdue = new Date(fu.follow_up_date) < new Date(new Date().toDateString())
  return (
    <div style={{ display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:10,background:'var(--card-2)',border:`1px solid ${isOverdue?'#fecaca':'var(--border)'}`,cursor:'pointer',transition:'all 0.15s' }}
      onClick={()=>navigate('inquiry-detail',{id:fu.inquiry_id})}
      onMouseEnter={e=>e.currentTarget.style.background='var(--brand-dim)'} onMouseLeave={e=>e.currentTarget.style.background='var(--card-2)'}>
      <div style={{ width:8,height:8,borderRadius:'50%',background:isOverdue?'#ef4444':'#f59e0b',flexShrink:0 }} />
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:600,fontSize:13,color:'var(--text)' }}>{fu.customer_name}</div>
        <div style={{ fontSize:12,color:'var(--text-3)',marginTop:1 }}>{fu.note}</div>
      </div>
      <div style={{ fontSize:11,fontWeight:700,color:isOverdue?'#ef4444':'#f59e0b',flexShrink:0 }}>{formatDate(fu.follow_up_date)}</div>
      <span style={{ fontSize:11,color:TYPE_COLORS[fu.inquiry_type]||'var(--text-3)',background:`${TYPE_COLORS[fu.inquiry_type]||'#94a3b8'}18`,padding:'2px 8px',borderRadius:8,flexShrink:0 }}>{TYPE_ICONS[fu.inquiry_type]}</span>
      <button onClick={e=>{e.stopPropagation();onComplete(fu.id)}} style={{ width:28,height:28,borderRadius:8,border:'1px solid var(--border)',background:'var(--card)',cursor:'pointer',fontSize:14,color:'var(--text-3)',flexShrink:0 }}>✓</button>
    </div>
  )
}

export default function AEDashboard() {
  const { user } = useAuth(); const { navigate } = useNav()
  const [data, setData] = useState(null); const [loading, setLoading] = useState(true)
  const [drilldown, setDrilldown] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/analytics/ae',{headers:{Authorization:`Bearer ${token()}`}})
      .then(r=>r.json()).then(d=>{setData(d);setLoading(false)}).catch(()=>setLoading(false))
  },[])
  useEffect(()=>{load()},[])

  const completeFollowup = async (id) => {
    await fetch(`/api/analytics/followup/${id}/complete`,{method:'PATCH',headers:{Authorization:`Bearer ${token()}`}})
    load()
  }

  const drill = (title, filters={}) => setDrilldown({title, filters})
  const greet = () => { const h=new Date().getHours(); return h<12?'Good morning':h<17?'Good afternoon':'Good evening' }

  if (loading) return <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'60vh' }}><div style={{ width:28,height:28,borderRadius:'50%',border:`2px solid ${BRAND}`,borderTopColor:'transparent',animation:'spin 0.8s linear infinite' }}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
  if (!data) return null

  const { today, month, quarter, target, quarterAchievement, totalRevenue, pipeline, followups, weeklyTrend, monthlyBreakdown, meta } = data
  const totalOverdue = followups.overdue.length, totalToday = followups.today.length
  const qRev  = quarterAchievement?.revenue || 0
  const revPct  = target?.revenue_target > 0 ? Math.min(100,Math.round(qRev/target.revenue_target*100)) : 0
  const leadPct = target?.leads_target > 0   ? Math.min(100,Math.round((quarterAchievement?.leads||0)/target.leads_target*100)) : 0
  const repPct  = target?.repeat_target > 0  ? Math.min(100,Math.round((quarterAchievement?.repeats||0)/target.repeat_target*100)) : 0
  const ordPct  = target?.orders_target > 0  ? Math.min(100,Math.round((quarterAchievement?.orders||0)/target.orders_target*100)) : 0
  const overallPct = target ? Math.round((revPct+(target.leads_target>0?leadPct:revPct)+(target.repeat_target>0?repPct:revPct)+(target.orders_target>0?ordPct:revPct))/4) : 0

  const tabs = [
    {key:'overview',label:'Overview'},
    {key:'performance',label:'Performance'},
    {key:'followups',label:`Follow-ups${(totalOverdue+totalToday)>0?` (${totalOverdue+totalToday})`:''}`, urgent: totalOverdue>0},
    {key:'activity',label:'Activity'},
  ]

  return (
    <div style={{ padding:'24px 28px',flex:1,overflowY:'auto',maxWidth:1300,fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>

      {/* Header */}
      <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:22,flexWrap:'wrap',gap:12 }}>
        <div>
          <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:800,fontSize:24,color:'var(--text)',margin:0 }}>{greet()}, {user.name} 👋</h1>
          <p style={{ color:'var(--text-3)',fontSize:13,margin:'3px 0 0' }}>{new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})} · Q{meta.quarter} {meta.year}</p>
        </div>
        <button onClick={()=>navigate('leads')} style={{ padding:'9px 18px',borderRadius:10,border:'none',background:BRAND,color:'#060610',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'"Plus Jakarta Sans",sans-serif' }}>+ New Inquiry</button>
      </div>

      {/* Quarterly Target Hero */}
      {target ? (
        <div style={{ background:'linear-gradient(135deg,#0d1117,#0a2020)',borderRadius:20,padding:'24px 28px',marginBottom:20,position:'relative',overflow:'hidden' }}>
          <div style={{ position:'absolute',top:-40,right:-40,width:200,height:200,borderRadius:'50%',background:`radial-gradient(circle,${BRAND}20 0%,transparent 70%)`,pointerEvents:'none' }} />
          <div style={{ display:'flex',alignItems:'center',gap:24,flexWrap:'wrap' }}>
            <Ring pct={overallPct} size={100} stroke={9} color={overallPct>=80?'#10b981':overallPct>=50?BRAND:'#f59e0b'}>
              <span style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:900,fontSize:20,color:'#fff',lineHeight:1 }}>{overallPct}%</span>
              <span style={{ fontSize:9,color:'rgba(255,255,255,0.4)' }}>overall</span>
            </Ring>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:4 }}>Q{meta.quarter} {meta.year} Target Progress</div>
              <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12 }}>
                {[
                  {label:'Revenue',done:`$${(qRev/1000).toFixed(1)}k`,target:`$${(target.revenue_target/1000).toFixed(1)}k`,pct:revPct,show:target.revenue_target>0,color:'#10b981'},
                  {label:'Leads Won',done:quarterAchievement.leads,target:target.leads_target,pct:leadPct,show:target.leads_target>0,color:'#3b82f6'},
                  {label:'Repeats Won',done:quarterAchievement.repeats,target:target.repeat_target,pct:repPct,show:target.repeat_target>0,color:'#6366f1'},
                  {label:'Orders',done:quarterAchievement.orders,target:target.orders_target,pct:ordPct,show:target.orders_target>0,color:'#f59e0b'},
                ].filter(r=>r.show).map(row=>(
                  <div key={row.label}>
                    <div style={{ display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:5 }}>
                      <span style={{ color:'rgba(255,255,255,0.5)' }}>{row.label}</span>
                      <span style={{ color:'#fff',fontWeight:700 }}>{row.done}<span style={{ color:'rgba(255,255,255,0.3)',fontWeight:400 }}> / {row.target}</span></span>
                    </div>
                    <div style={{ height:5,background:'rgba(255,255,255,0.1)',borderRadius:99 }}>
                      <div style={{ height:'100%',width:`${row.pct}%`,background:row.color,borderRadius:99,transition:'width 0.8s ease' }} />
                    </div>
                    <div style={{ fontSize:10,color:row.pct>=100?'#10b981':row.color,fontWeight:700,marginTop:3 }}>{row.pct}%{row.pct>=100&&' ✓'}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {target.notes && <div style={{ marginTop:14,paddingTop:14,borderTop:'1px solid rgba(255,255,255,0.08)',fontSize:12,color:'rgba(255,255,255,0.4)' }}>📝 {target.notes}</div>}
        </div>
      ) : (
        <div style={{ background:'var(--card)',borderRadius:16,border:`2px dashed ${BRAND}40`,padding:'20px 24px',marginBottom:20,display:'flex',alignItems:'center',gap:14 }}>
          <div style={{ width:40,height:40,borderRadius:12,background:`${BRAND}15`,color:BRAND,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0 }}>🎯</div>
          <div><div style={{ fontWeight:700,color:'var(--text)',fontSize:14 }}>No quarterly target set yet</div><div style={{ fontSize:13,color:'var(--text-3)' }}>Ask your manager to set your Q{meta?.quarter} target</div></div>
        </div>
      )}

      {/* Quick stats row */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:22 }}>
        {[
          {label:'Today',value:(today.leads||0)+(today.repeat||0)+(today.orders||0),sub:`${today.leads}L · ${today.repeat}R · ${today.orders}O`,color:BRAND,filters:{ from:new Date().toISOString().split('T')[0], to:new Date().toISOString().split('T')[0] }},
          {label:'This Month',value:month.total,sub:`${month.won} won · ${month.win_rate}%`,color:'#10b981',filters:{ from:new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().split('T')[0] }},
          {label:'Win Rate (All)',value:`${data.all.win_rate||0}%`,sub:`${data.all.won} of ${data.all.total}`,color:'#6366f1',filters:{ disposition:'Closed Won' }},
          {label:'All Time Revenue',value:`$${(totalRevenue/1000).toFixed(1)}k`,sub:'from closed deals',color:'#f59e0b',filters:{ disposition:'Closed Won' }},
        ].map(s=>(
          <div key={s.label} onClick={()=>drill(s.label,s.filters)} style={{ background:'var(--card)',borderRadius:14,border:'1px solid var(--border)',padding:'16px 18px',cursor:'pointer',transition:'all 0.15s' }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=s.color;e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow=`0 6px 20px ${s.color}20`}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none'}}>
            <div style={{ fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:6 }}>{s.label} <span style={{ fontSize:9 }}>↗</span></div>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:800,fontSize:28,color:s.color,lineHeight:1,marginBottom:4 }}>{s.value}</div>
            <div style={{ fontSize:12,color:'var(--text-3)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex',gap:2,background:'var(--card-2)',borderRadius:14,padding:4,marginBottom:22,width:'fit-content',border:'1px solid var(--border)' }}>
        {tabs.map(tab=>(
          <button key={tab.key} onClick={()=>setActiveTab(tab.key)} style={{ padding:'8px 18px',borderRadius:10,border:'none',background:activeTab===tab.key?'var(--card)':'transparent',color:activeTab===tab.key?'var(--text)':'var(--text-3)',fontSize:13,fontWeight:tab.urgent?700:600,cursor:'pointer',fontFamily:'"Plus Jakarta Sans",sans-serif',boxShadow:activeTab===tab.key?'0 1px 4px rgba(0,0,0,0.1)':'none',transition:'all 0.15s',whiteSpace:'nowrap',position:'relative' }}>
            {tab.label}
            {tab.urgent&&<span style={{ position:'absolute',top:4,right:4,width:7,height:7,borderRadius:'50%',background:'#ef4444' }} />}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ─────────────────────────────── */}
      {activeTab==='overview' && (
        <div style={{ animation:'fadeIn 0.2s ease' }}>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16 }}>
            {/* Monthly bar chart */}
            <div style={{ background:'var(--card)',borderRadius:16,border:'1px solid var(--border)',padding:'20px 22px' }}>
              <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:15,color:'var(--text)',marginBottom:16 }}>Monthly Volume — Last 6 Months</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyBreakdown} barSize={10} barGap={2}>
                  <XAxis dataKey="month" tick={{ fontSize:11,fill:'var(--text-3)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:11,fill:'var(--text-3)' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<Tip />} />
                  <Bar dataKey="leadsWon" name="Leads Won" fill="#3b82f6" radius={[4,4,0,0]} />
                  <Bar dataKey="repeatsWon" name="Repeats Won" fill="#6366f1" radius={[4,4,0,0]} />
                  <Bar dataKey="ordersProcessed" name="Orders" fill="#f59e0b" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display:'flex',gap:16,marginTop:12,justifyContent:'center' }}>
                {[{label:'Leads',color:'#3b82f6'},{label:'Repeats',color:'#6366f1'},{label:'Orders',color:'#f59e0b'}].map(l=>(
                  <div key={l.label} style={{ display:'flex',alignItems:'center',gap:6,fontSize:11,color:'var(--text-3)' }}>
                    <div style={{ width:10,height:10,borderRadius:3,background:l.color }} />{l.label}
                  </div>
                ))}
              </div>
            </div>
            {/* Weekly trend */}
            <div style={{ background:'var(--card)',borderRadius:16,border:'1px solid var(--border)',padding:'20px 22px' }}>
              <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:15,color:'var(--text)',marginBottom:16 }}>Win Rate Trend — 12 Weeks</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={weeklyTrend.map((w,i)=>({...w,week:`W${i+1}`,rate:w.total>0?Math.round(w.won/w.total*100):0}))}>
                  <XAxis dataKey="week" tick={{ fontSize:11,fill:'var(--text-3)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:11,fill:'var(--text-3)' }} axisLine={false} tickLine={false} domain={[0,100]} tickFormatter={v=>`${v}%`} />
                  <Tooltip content={<Tip />} formatter={v=>[`${v}%`,'Win Rate']} />
                  <Line type="monotone" dataKey="rate" name="Win Rate" stroke={BRAND} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="total" name="Total" stroke="#94a3b8" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          {/* Per-type cards */}
          <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14 }}>
            {['lead','repeat','online_order'].map(type=>{
              const label = type==='lead'?'Leads':type==='repeat'?'Repeats':'Orders'
              const wonKey = type==='online_order'?'ordersProcessed':'leadsWon'
              const latest = monthlyBreakdown[monthlyBreakdown.length-1]
              const typeData = type==='lead'?{won:data.all.won,total:data.all.total}:{won:0,total:0}
              // use pipeline for dispositions
              const typePipeline = pipeline.filter(p=>p.type===type||!p.type)
              return (
                <div key={type} onClick={()=>drill(`My ${label}`,{type})} style={{ background:'var(--card)',borderRadius:14,border:'1px solid var(--border)',padding:'18px 20px',cursor:'pointer',transition:'all 0.15s' }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=TYPE_COLORS[type];e.currentTarget.style.background='var(--brand-dim)'}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--card)'}}>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14 }}>
                    <div>
                      <div style={{ fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:4 }}>{label}</div>
                      <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:900,fontSize:30,color:TYPE_COLORS[type],lineHeight:1 }}>
                        {type==='lead'?quarter.total:type==='repeat'?quarterAchievement.repeats:quarterAchievement.orders}
                      </div>
                      <div style={{ fontSize:12,color:'var(--text-3)',marginTop:3 }}>this quarter</div>
                    </div>
                    <span style={{ fontSize:28,opacity:0.6 }}>{TYPE_ICONS[type]}</span>
                  </div>
                  <div style={{ display:'flex',gap:10 }}>
                    {[{label:'Month',v:monthlyBreakdown[monthlyBreakdown.length-1]?.[type==='lead'?'leadsWon':type==='repeat'?'repeatsWon':'ordersProcessed']||0},{label:'All Time',v:type==='lead'?data.all.won:type==='repeat'?quarterAchievement.repeats*3:quarterAchievement.orders*3}].map(s=>(
                      <div key={s.label} style={{ flex:1,background:'var(--card-2)',borderRadius:8,padding:'8px',textAlign:'center' }}>
                        <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:16,color:'var(--text)' }}>{s.v}</div>
                        <div style={{ fontSize:10,color:'var(--text-3)',marginTop:2 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── PERFORMANCE TAB ──────────────────────────── */}
      {activeTab==='performance' && (
        <div style={{ animation:'fadeIn 0.2s ease' }}>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16 }}>
            {/* Disposition breakdown */}
            <div style={{ background:'var(--card)',borderRadius:16,border:'1px solid var(--border)',padding:'20px 22px' }}>
              <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:15,color:'var(--text)',marginBottom:16 }}>My Pipeline by Disposition</div>
              <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
                {pipeline.slice(0,8).map((p,i)=>{
                  const maxCount = pipeline[0]?.count||1
                  return (
                    <div key={p.disposition} onClick={()=>drill(p.disposition,{disposition:p.disposition})} style={{ cursor:'pointer' }}>
                      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5 }}>
                        <span style={{ fontSize:13,color:'var(--text-2)',fontWeight:500 }}>{p.disposition||'Unknown'}</span>
                        <span style={{ fontSize:12,fontWeight:700,color:'var(--text)' }}>{p.count}</span>
                      </div>
                      <div style={{ height:7,background:'var(--card-2)',borderRadius:99 }}>
                        <div style={{ height:'100%',width:`${(p.count/maxCount)*100}%`,background:[BRAND,'#3b82f6','#6366f1','#f59e0b','#ef4444','#10b981','#8b5cf6','#f97316'][i%8],borderRadius:99,transition:'width 0.5s' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            {/* Quarter progress detail */}
            <div style={{ background:'var(--card)',borderRadius:16,border:'1px solid var(--border)',padding:'20px 22px' }}>
              <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:15,color:'var(--text)',marginBottom:16 }}>Q{meta.quarter} {meta.year} Breakdown</div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14 }}>
                {[
                  {label:'Leads Won',value:quarterAchievement.leads,target:target?.leads_target,color:'#3b82f6',filters:{type:'lead',disposition:'Closed Won'}},
                  {label:'Repeats Won',value:quarterAchievement.repeats,target:target?.repeat_target,color:'#6366f1',filters:{type:'repeat',disposition:'Closed Won'}},
                  {label:'Orders',value:quarterAchievement.orders,target:target?.orders_target,color:'#f59e0b',filters:{type:'online_order',disposition:'Processed'}},
                  {label:'Revenue',value:`$${(qRev/1000).toFixed(1)}k`,target:target?.revenue_target?`$${(target.revenue_target/1000).toFixed(1)}k`:null,color:'#10b981',filters:{disposition:'Closed Won'}},
                ].map(s=>(
                  <div key={s.label} onClick={()=>drill(`Q${meta.quarter} ${s.label}`,{...s.filters,from:meta.qStart,to:meta.qEnd})} style={{ background:'var(--card-2)',borderRadius:12,padding:'14px',cursor:'pointer',transition:'all 0.15s' }}
                    onMouseEnter={e=>{e.currentTarget.style.background='var(--brand-dim)';e.currentTarget.style.borderColor=s.color}}
                    onMouseLeave={e=>{e.currentTarget.style.background='var(--card-2)'}}>
                    <div style={{ fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8 }}>{s.label}</div>
                    <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:900,fontSize:24,color:s.color,marginBottom:4 }}>{s.value}</div>
                    {s.target&&<div style={{ fontSize:11,color:'var(--text-3)' }}>Target: {s.target}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Monthly detail table */}
          <div style={{ background:'var(--card)',borderRadius:16,border:'1px solid var(--border)',overflow:'hidden' }}>
            <div style={{ padding:'16px 20px',borderBottom:'1px solid var(--border)' }}>
              <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:15,color:'var(--text)' }}>Monthly Breakdown</div>
            </div>
            <table style={{ width:'100%',borderCollapse:'collapse',fontSize:13 }}>
              <thead><tr style={{ background:'var(--card-2)' }}>
                {['Month','Leads','Leads Won','Repeats','Repeats Won','Orders','Orders Done','Win Rate'].map(h=><th key={h} style={{ textAlign:'left',padding:'10px 14px',fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.06em' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {monthlyBreakdown.map((m,i)=>{
                  const total=m.leads+m.repeats+m.orders
                  const won=m.leadsWon+m.repeatsWon+m.ordersProcessed
                  const rate=total>0?Math.round(won/total*100):0
                  return (
                    <tr key={m.month} style={{ borderBottom:'1px solid var(--border)',background:i%2===0?'var(--card)':'var(--row-alt)' }}>
                      <td style={{ padding:'10px 14px',fontWeight:600,color:'var(--text)' }}>{m.month}</td>
                      <td style={{ padding:'10px 14px',color:'var(--text-2)' }}>{m.leads}</td>
                      <td style={{ padding:'10px 14px',color:'#3b82f6',fontWeight:600 }}>{m.leadsWon}</td>
                      <td style={{ padding:'10px 14px',color:'var(--text-2)' }}>{m.repeats}</td>
                      <td style={{ padding:'10px 14px',color:'#6366f1',fontWeight:600 }}>{m.repeatsWon}</td>
                      <td style={{ padding:'10px 14px',color:'var(--text-2)' }}>{m.orders}</td>
                      <td style={{ padding:'10px 14px',color:'#f59e0b',fontWeight:600 }}>{m.ordersProcessed}</td>
                      <td style={{ padding:'10px 14px' }}><span style={{ fontWeight:700,color:rate>=70?'#10b981':rate>=50?BRAND:'#f59e0b' }}>{rate}%</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── FOLLOW-UPS TAB ────────────────────────────── */}
      {activeTab==='followups' && (
        <div style={{ animation:'fadeIn 0.2s ease' }}>
          {(followups.overdue.length+followups.today.length+followups.upcoming.length)===0 ? (
            <div style={{ background:'var(--card)',borderRadius:16,border:'1px solid var(--border)',padding:60,textAlign:'center' }}>
              <div style={{ fontSize:36,marginBottom:12 }}>✅</div>
              <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:18,color:'var(--text)',marginBottom:8 }}>All caught up!</div>
              <div style={{ color:'var(--text-3)',fontSize:14 }}>No pending follow-ups.</div>
            </div>
          ) : (
            <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
              {followups.overdue.length>0&&(
                <div style={{ background:'var(--card)',borderRadius:16,border:'1px solid #fecaca',overflow:'hidden' }}>
                  <div style={{ padding:'12px 20px',background:'#fef2f2',borderBottom:'1px solid #fecaca',display:'flex',alignItems:'center',gap:8 }}>
                    <span style={{ fontSize:16 }}>⚠️</span>
                    <span style={{ fontWeight:700,color:'#ef4444',fontSize:14 }}>Overdue ({followups.overdue.length})</span>
                    <span style={{ fontSize:12,color:'#ef4444',opacity:0.7 }}>— needs immediate attention</span>
                  </div>
                  <div style={{ padding:'12px 16px',display:'flex',flexDirection:'column',gap:8 }}>
                    {followups.overdue.map(fu=><FollowupRow key={fu.id} fu={fu} onComplete={completeFollowup} />)}
                  </div>
                </div>
              )}
              {followups.today.length>0&&(
                <div style={{ background:'var(--card)',borderRadius:16,border:'1px solid #fde68a',overflow:'hidden' }}>
                  <div style={{ padding:'12px 20px',background:'#fffbeb',borderBottom:'1px solid #fde68a',display:'flex',alignItems:'center',gap:8 }}>
                    <span style={{ fontSize:16 }}>📅</span>
                    <span style={{ fontWeight:700,color:'#f59e0b',fontSize:14 }}>Due Today ({followups.today.length})</span>
                  </div>
                  <div style={{ padding:'12px 16px',display:'flex',flexDirection:'column',gap:8 }}>
                    {followups.today.map(fu=><FollowupRow key={fu.id} fu={fu} onComplete={completeFollowup} />)}
                  </div>
                </div>
              )}
              {followups.upcoming.length>0&&(
                <div style={{ background:'var(--card)',borderRadius:16,border:'1px solid var(--border)',overflow:'hidden' }}>
                  <div style={{ padding:'12px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:8 }}>
                    <span style={{ fontSize:16 }}>🔮</span>
                    <span style={{ fontWeight:700,color:'var(--text)',fontSize:14 }}>Upcoming ({followups.upcoming.length})</span>
                  </div>
                  <div style={{ padding:'12px 16px',display:'flex',flexDirection:'column',gap:8 }}>
                    {followups.upcoming.map(fu=><FollowupRow key={fu.id} fu={fu} onComplete={completeFollowup} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── ACTIVITY TAB ─────────────────────────────── */}
      {activeTab==='activity' && (
        <div style={{ animation:'fadeIn 0.2s ease' }}>
          <div style={{ background:'var(--card)',borderRadius:16,border:'1px solid var(--border)',padding:'20px 22px' }}>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:15,color:'var(--text)',marginBottom:16 }}>Recent Activity</div>
            {(!data.recentActivity||data.recentActivity.length===0) ? <div style={{ textAlign:'center',padding:40,color:'var(--text-3)' }}>No recent activity</div> : (
              <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
                {data.recentActivity.map((a,i)=>(
                  <div key={a.id} onClick={()=>navigate('inquiry-detail',{id:a.entity_id})} style={{ display:'flex',gap:12,alignItems:'flex-start',padding:'10px',borderRadius:10,cursor:'pointer',transition:'background 0.1s' }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--card-2)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <div style={{ width:32,height:32,borderRadius:10,background:`${BRAND}20`,color:BRAND,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0 }}>
                      {a.action==='Closed Won'?'🏆':a.action==='Processed'?'✅':a.action==='Quoted'?'💬':'📝'}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13,color:'var(--text)',lineHeight:1.4 }}><b>{a.customer_name}</b> — {a.action}{a.comment&&`: "${a.comment.slice(0,60)}"`}</div>
                      <div style={{ fontSize:11,color:'var(--text-3)',marginTop:2 }}>{new Date(a.created_at).toLocaleString()}</div>
                    </div>
                    <span style={{ fontSize:11,color:TYPE_COLORS[a.inquiry_type]||'var(--text-3)',flexShrink:0 }}>{TYPE_ICONS[a.inquiry_type]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {drilldown && <DrilldownModal title={drilldown.title} filters={drilldown.filters} onClose={()=>setDrilldown(null)} />}
    </div>
  )
}
