import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useAuth } from '../App'
import { useNav } from '../App'

const BRAND = '#00D4C8'
const URGENCY_COLOR = { critical:'#ef4444', high:'#f97316', normal:BRAND, low:'#94a3b8' }
const token = () => localStorage.getItem('crm_token')

function Tip({ active, payload, label }) {
  if (!active||!payload?.length) return null
  return <div style={{ background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,padding:'8px 12px',fontSize:12 }}>
    <div style={{ color:'var(--text-3)',marginBottom:4 }}>{label}</div>
    {payload.map(p=><div key={p.name} style={{ color:p.color||BRAND,display:'flex',gap:8 }}><span>{p.name}</span><b>{p.value}</b></div>)}
  </div>
}

function Donut({ segments, total, label }) {
  const r=52,cx=60,cy=60,sw=11,circ=2*Math.PI*r
  let offset=0
  const arcs=segments.map(s=>{const dash=(s.value/Math.max(total,1))*circ;const arc={...s,dash,offset};offset+=dash;return arc})
  return (
    <svg width={120} height={120} style={{ flexShrink:0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--card-2)" strokeWidth={sw} />
      {arcs.map((s,i)=><circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={sw} strokeDasharray={`${s.dash} ${circ-s.dash}`} strokeDashoffset={circ/4-s.offset} strokeLinecap="round" style={{transition:'stroke-dasharray 0.6s'}} />)}
      <text x={cx} y={cy-4} textAnchor="middle" fontSize={20} fontWeight={900} fill="var(--text)" fontFamily='"Bricolage Grotesque",sans-serif'>{total}</text>
      <text x={cx} y={cy+12} textAnchor="middle" fontSize={9} fontWeight={700} fill="var(--text-3)" letterSpacing="0.08em">{label}</text>
    </svg>
  )
}

// ── Parts drilldown modal ─────────────────────────────────────
function PartsDrilldown({ title, filter, onClose }) {
  const { navigate } = useNav()
  const [parts, setParts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const p = new URLSearchParams({ page: 1, ...filter })
    fetch(`/api/purchasing/my-parts?${p}`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(d => { setParts(Array.isArray(d?.parts) ? d.parts : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const statusColor = { pending:'#f59e0b', quoted:'#10b981', not_in_stock:'#94a3b8', unassigned:'var(--text-4)' }

  return createPortal(
    <div onClick={onClose} style={{ position:'fixed',inset:0,zIndex:99999,background:'rgba(0,0,0,0.55)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'var(--card)',borderRadius:20,boxShadow:'0 24px 80px rgba(0,0,0,0.3)',width:'100%',maxWidth:860,maxHeight:'88vh',display:'flex',flexDirection:'column',fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
        <div style={{ padding:'18px 24px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0 }}>
          <div>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:16,color:'var(--text)' }}>{title}</div>
            <div style={{ fontSize:12,color:'var(--text-3)',marginTop:2 }}>{loading?'Loading…':`${parts.length} parts`}</div>
          </div>
          <button onClick={onClose} style={{ width:32,height:32,borderRadius:10,border:'none',background:'var(--card-2)',cursor:'pointer',fontSize:18,color:'var(--text-3)' }}>×</button>
        </div>
        <div style={{ overflowY:'auto',flex:1 }}>
          {loading ? (
            <div style={{ display:'flex',alignItems:'center',justifyContent:'center',padding:60 }}>
              <div style={{ width:24,height:24,borderRadius:'50%',border:`2px solid ${BRAND}`,borderTopColor:'transparent',animation:'spin 0.8s linear infinite' }} />
            </div>
          ) : !parts.length ? (
            <div style={{ textAlign:'center',padding:60,color:'var(--text-3)' }}>
              <div style={{ fontSize:36,marginBottom:12 }}>✅</div>
              <div style={{ fontWeight:700,fontSize:16 }}>Nothing here</div>
            </div>
          ) : (
            <table style={{ width:'100%',borderCollapse:'collapse',fontSize:13 }}>
              <thead><tr style={{ background:'var(--card-2)',position:'sticky',top:0 }}>
                {['Part #','AE','Date','Urgency','Status','Quote'].map(h=><th key={h} style={{ textAlign:'left',padding:'10px 14px',fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.06em',borderBottom:'2px solid var(--border)' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {parts.map((p,i) => {
                  const status = p.not_in_stock ? 'not_in_stock' : p.assignment_status || 'pending'
                  return (
                    <tr key={p.requirement_id||i}
                      onClick={() => { navigate('purchaser-part-detail', { assignmentId: p.assignment_id }); onClose() }}
                      style={{ borderBottom:'1px solid var(--border)',background:i%2===0?'var(--card)':'var(--row-alt)',cursor:'pointer',transition:'background 0.1s' }}
                      onMouseEnter={e=>e.currentTarget.style.background=`${BRAND}08`}
                      onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'var(--card)':'var(--row-alt)'}>
                      <td style={{ padding:'10px 14px',fontFamily:'monospace',fontWeight:700,color:'var(--text)' }}>{p.part_number}</td>
                      <td style={{ padding:'10px 14px',color:'var(--text-2)' }}>{p.ae_name||'—'}</td>
                      <td style={{ padding:'10px 14px',color:'var(--text-3)',fontSize:12 }}>{p.inquiry_date ? new Date(p.inquiry_date).toLocaleDateString() : '—'}</td>
                      <td style={{ padding:'10px 14px' }}>
                        <span style={{ fontSize:11,fontWeight:700,padding:'2px 9px',borderRadius:20,background:`${URGENCY_COLOR[p.urgency||'normal']}18`,color:URGENCY_COLOR[p.urgency||'normal'],border:`1px solid ${URGENCY_COLOR[p.urgency||'normal']}30`,textTransform:'capitalize' }}>
                          {p.urgency||'normal'}
                        </span>
                      </td>
                      <td style={{ padding:'10px 14px' }}>
                        <span style={{ fontSize:11,fontWeight:700,padding:'2px 9px',borderRadius:20,background:`${statusColor[status]||BRAND}18`,color:statusColor[status]||BRAND,border:`1px solid ${statusColor[status]||BRAND}30`,textTransform:'capitalize' }}>
                          {status.replace('_',' ')}
                        </span>
                      </td>
                      <td style={{ padding:'10px 14px',fontWeight:700,color:p.price?'#10b981':'var(--text-4)' }}>{p.price?`$${p.price}`:'No quote'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>, document.body
  )
}

// ── Main Dashboard ────────────────────────────────────────────
export default function PurchaserDashboard() {
  const { user } = useAuth(); const { navigate } = useNav()
  const [data, setData] = useState(null); const [loading, setLoading] = useState(true)
  const [drilldown, setDrilldown] = useState(null) // { title, filter }

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/analytics/purchaser-full', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [])

  const completeFollowup = async (id) => {
    await fetch(`/api/purchasing/followup/${id}/complete`, { method:'PATCH', headers:{ Authorization:`Bearer ${token()}` } })
    load()
  }

  const greet = () => { const h=new Date().getHours(); return h<12?'Good morning':h<17?'Good afternoon':'Good evening' }

  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'60vh' }}>
      <div style={{ width:28,height:28,borderRadius:'50%',border:`2px solid ${BRAND}`,borderTopColor:'transparent',animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
  if (!data) return null

  const { stats={}, dailyTrend=[], byUrgency=[], byType=[], recentQuotes=[], followups={} } = data
  const s = stats
  const pendingSegs = [
    { color:'#ef4444', value: byUrgency.find(u=>u.urgency==='critical')?.count||0 },
    { color:'#f97316', value: byUrgency.find(u=>u.urgency==='high')?.count||0 },
    { color:BRAND,     value: byUrgency.find(u=>u.urgency==='normal')?.count||0 },
    { color:'#94a3b8', value: byUrgency.find(u=>u.urgency==='low')?.count||0 },
  ].filter(x=>x.value>0)
  const totalOverdue = (followups.overdue||[]).length
  const totalToday   = (followups.today||[]).length

  const statCard = (label, value, color, filter, sub) => (
    <div onClick={() => filter && setDrilldown({ title: label, filter })}
      style={{ background: color === BRAND ? 'linear-gradient(135deg,#0d1117,#0a2020)' : 'var(--card)', borderRadius:16, border: color === BRAND ? 'none' : '1px solid var(--border)', padding:'18px 20px', cursor: filter ? 'pointer' : 'default', transition:'all 0.15s', position:'relative', overflow:'hidden' }}
      onMouseEnter={e=>{ if(filter){ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow=`0 8px 20px ${color}20` }}}
      onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none' }}>
      {color === BRAND && <div style={{ position:'absolute',top:-30,right:-30,width:100,height:100,borderRadius:'50%',background:`radial-gradient(circle,${color}30 0%,transparent 70%)`,pointerEvents:'none' }} />}
      {filter && <div style={{ position:'absolute',top:10,right:12,fontSize:9,fontWeight:700,color:'rgba(255,255,255,0.25)' }}>VIEW →</div>}
      <div style={{ fontSize:9,fontWeight:700,color:color===BRAND?'rgba(255,255,255,0.35)':'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8 }}>{label}</div>
      <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:900,fontSize:36,color:color===BRAND?'#fff':color,lineHeight:1,marginBottom:4 }}>{value}</div>
      {sub && <div style={{ fontSize:12,color:color===BRAND?'rgba(255,255,255,0.4)':'var(--text-3)' }}>{sub}</div>}
    </div>
  )

  return (
    <div style={{ padding:'24px 28px',flex:1,overflowY:'auto',maxWidth:1300,fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:22,flexWrap:'wrap',gap:12 }}>
        <div>
          <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:800,fontSize:24,color:'var(--text)',margin:0 }}>{greet()}, {user.name} 👋</h1>
          <p style={{ color:'var(--text-3)',fontSize:13,margin:'3px 0 0' }}>{new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</p>
        </div>
        <button onClick={() => navigate('purchasing')} style={{ padding:'9px 18px',borderRadius:10,border:'none',background:BRAND,color:'#060610',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
          My Parts →
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20 }}>
        {statCard('Assigned to Me',  s.assigned,   BRAND,       { status:'all' },       'total parts')}
        {statCard('Pending Quote',   s.pending,    '#f59e0b',   { status:'pending' },   `${s.overdue||0} overdue`)}
        {statCard('Quoted',          s.quotedAll,  '#10b981',   { status:'quoted' },    'completed')}
        {statCard('Not In Stock',    s.notInStock, '#6366f1',   { status:'not_in_stock' }, 'flagged')}
      </div>

      {/* Today strip */}
      <div style={{ background:'linear-gradient(135deg,#0d1117,#0a2020)',borderRadius:16,padding:'16px 24px',marginBottom:20,display:'flex',gap:32,flexWrap:'wrap' }}>
        {[
          { label:'Quotes Today',     value:s.todayQuotes||0, color:BRAND },
          { label:'This Week',        value:s.weekQuotes||0,  color:'#10b981' },
          { label:'Avg Response',     value:s.avgHours?`${s.avgHours}h`:'—', color:'#6366f1' },
          { label:'Critical Pending', value:s.critical||0,    color:(s.critical||0)>0?'#ef4444':'#94a3b8',
            filter:(s.critical||0)>0?{urgency:'critical'}:null },
          { label:'Overdue (4+ days)',value:s.overdue||0,     color:(s.overdue||0)>0?'#f97316':'#94a3b8',
            filter:(s.overdue||0)>0?{status:'pending'}:null },
        ].map(item => (
          <div key={item.label} onClick={() => item.filter && setDrilldown({ title:item.label, filter:item.filter })}
            style={{ display:'flex',flexDirection:'column',gap:4,cursor:item.filter?'pointer':'default' }}>
            <div style={{ fontSize:9,fontWeight:700,color:'rgba(255,255,255,0.35)',textTransform:'uppercase',letterSpacing:'0.1em' }}>{item.label}</div>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:900,fontSize:24,color:item.color,lineHeight:1,textDecoration:item.filter?'underline dotted':'none' }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display:'grid',gridTemplateColumns:'2fr 1fr',gap:16,marginBottom:16 }}>
        {/* Daily trend */}
        <div style={{ background:'var(--card)',borderRadius:16,border:'1px solid var(--border)',padding:'20px 22px' }}>
          <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:15,color:'var(--text)',marginBottom:16 }}>Daily Quotes — Last 14 Days</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dailyTrend} barSize={16}>
              <XAxis dataKey="day" tick={{ fontSize:11,fill:'var(--text-3)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:11,fill:'var(--text-3)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<Tip />} formatter={v=>[v,'Quotes']} />
              <Bar dataKey="count" name="Quotes" radius={[6,6,0,0]}>
                {dailyTrend.map((_,i)=><Cell key={i} fill={i===dailyTrend.length-1?BRAND:`${BRAND}60`} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display:'flex',gap:20,marginTop:14,paddingTop:14,borderTop:'1px solid var(--border)' }}>
            {[
              {label:'Best Day',value:`${Math.max(...dailyTrend.map(d=>d.count||0),0)} quotes`},
              {label:'Avg/Day', value:`${(dailyTrend.reduce((s,d)=>s+(d.count||0),0)/(dailyTrend.length||1)).toFixed(1)} quotes`},
              {label:'Total 14d',value:`${dailyTrend.reduce((s,d)=>s+(d.count||0),0)} quotes`},
            ].map(s=>(
              <div key={s.label}>
                <div style={{ fontSize:9,fontWeight:700,color:'var(--text-4)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:3 }}>{s.label}</div>
                <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:16,color:'var(--text)' }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending by urgency */}
        <div style={{ background:'var(--card)',borderRadius:16,border:'1px solid var(--border)',padding:'20px 22px' }}>
          <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:15,color:'var(--text)',marginBottom:14 }}>Pending by Urgency</div>
          <div style={{ display:'flex',alignItems:'center',gap:16,marginBottom:14 }}>
            <Donut segments={pendingSegs} total={s.pending||0} label="PENDING" />
            <div style={{ flex:1,display:'flex',flexDirection:'column',gap:8 }}>
              {byUrgency.map(u=>(
                <div key={u.urgency} onClick={() => setDrilldown({ title:`${u.urgency} urgency`, filter:{ urgency:u.urgency } })}
                  style={{ display:'flex',alignItems:'center',gap:8,cursor:'pointer',padding:'4px 8px',borderRadius:8,transition:'background 0.1s' }}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--card-2)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <div style={{ width:10,height:10,borderRadius:3,background:URGENCY_COLOR[u.urgency]||BRAND,flexShrink:0 }} />
                  <span style={{ fontSize:12,color:'var(--text-2)',flex:1,textTransform:'capitalize' }}>{u.urgency||'Normal'}</span>
                  <span style={{ fontSize:13,fontWeight:700,color:'var(--text)' }}>{u.count}</span>
                </div>
              ))}
              {!byUrgency.length && <div style={{ color:'var(--text-3)',fontSize:13,textAlign:'center',padding:'16px 0' }}>All clear 🎉</div>}
            </div>
          </div>
          <div style={{ paddingTop:12,borderTop:'1px solid var(--border)' }}>
            <div style={{ fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8 }}>By Type</div>
            {byType.map(t=>(
              <div key={t.type} onClick={() => setDrilldown({ title: t.type==='lead'?'Lead Parts':t.type==='repeat'?'Repeat Parts':'Order Parts', filter:{ type:t.type } })}
                style={{ display:'flex',alignItems:'center',gap:8,marginBottom:6,cursor:'pointer',padding:'3px 6px',borderRadius:6 }}
                onMouseEnter={e=>e.currentTarget.style.background='var(--card-2)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <span style={{ fontSize:12,color:'var(--text-3)',flex:1 }}>{t.type==='lead'?'◎ Leads':t.type==='repeat'?'↻ Repeats':'◈ Orders'}</span>
                <span style={{ fontSize:12,color:BRAND,fontWeight:700 }}>{t.quoted||0}</span>
                <span style={{ fontSize:11,color:'var(--text-3)' }}>/{t.total||0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Follow-ups + Recent Quotes */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16 }}>
        {/* Follow-ups */}
        <div style={{ background:'var(--card)',borderRadius:16,border:'1px solid var(--border)',overflow:'hidden' }}>
          <div style={{ padding:'14px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:14,color:'var(--text)' }}>Follow-ups</div>
            <div style={{ display:'flex',gap:8 }}>
              {totalOverdue>0&&<span style={{ fontSize:11,fontWeight:700,color:'#ef4444',background:'#fef2f2',padding:'2px 10px',borderRadius:20,border:'1px solid #fecaca' }}>⚠ {totalOverdue} overdue</span>}
              {totalToday>0&&<span style={{ fontSize:11,fontWeight:700,color:'#f59e0b',background:'#fffbeb',padding:'2px 10px',borderRadius:20,border:'1px solid #fde68a' }}>📅 {totalToday} today</span>}
            </div>
          </div>
          <div style={{ padding:'12px 16px',maxHeight:280,overflowY:'auto' }}>
            {[...(followups.overdue||[]).map(f=>({...f,urgency:'overdue'})), ...(followups.today||[]).map(f=>({...f,urgency:'today'})), ...(followups.upcoming||[]).slice(0,4).map(f=>({...f,urgency:'upcoming'}))].length===0 ? (
              <div style={{ textAlign:'center',padding:'28px 0',color:'var(--text-3)',fontSize:13 }}>✅ No pending follow-ups</div>
            ) : (
              <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                {[...(followups.overdue||[]).map(f=>({...f,urgency:'overdue'})), ...(followups.today||[]).map(f=>({...f,urgency:'today'})), ...(followups.upcoming||[]).slice(0,4).map(f=>({...f,urgency:'upcoming'}))].map(fu=>(
                  <div key={fu.id} onClick={() => navigate('purchaser-part-detail',{ assignmentId: fu.assignment_id })}
                    style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:10,background:'var(--card-2)',border:`1px solid ${fu.urgency==='overdue'?'#fecaca':fu.urgency==='today'?'#fde68a':'var(--border)'}`,cursor:'pointer' }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--brand-dim)'} onMouseLeave={e=>e.currentTarget.style.background='var(--card-2)'}>
                    <div style={{ width:8,height:8,borderRadius:'50%',background:fu.urgency==='overdue'?'#ef4444':fu.urgency==='today'?'#f59e0b':BRAND,flexShrink:0 }} />
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontWeight:600,fontSize:12,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{fu.part_number}</div>
                      <div style={{ fontSize:11,color:'var(--text-3)',marginTop:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{fu.note}</div>
                    </div>
                    <div style={{ fontSize:11,fontWeight:700,color:fu.urgency==='overdue'?'#ef4444':fu.urgency==='today'?'#f59e0b':'var(--text-3)',flexShrink:0 }}>{fu.follow_up_date ? new Date(fu.follow_up_date).toLocaleDateString() : ''}</div>
                    <button onClick={e=>{e.stopPropagation();completeFollowup(fu.id)}} style={{ width:26,height:26,borderRadius:8,border:'1px solid var(--border)',background:'var(--card)',cursor:'pointer',fontSize:13,color:'var(--text-3)',flexShrink:0 }}>✓</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent quotes */}
        <div style={{ background:'var(--card)',borderRadius:16,border:'1px solid var(--border)',overflow:'hidden' }}>
          <div style={{ padding:'14px 20px',borderBottom:'1px solid var(--border)' }}>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:14,color:'var(--text)' }}>Recent Quotes</div>
          </div>
          <div style={{ padding:'12px 16px',maxHeight:280,overflowY:'auto' }}>
            {!recentQuotes?.length ? (
              <div style={{ textAlign:'center',padding:'28px 0',color:'var(--text-3)',fontSize:13 }}>No quotes submitted yet</div>
            ) : (
              <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                {recentQuotes.map((q,i)=>(
                  <div key={q.id||i} onClick={() => navigate('purchaser-part-detail',{ assignmentId: q.assignment_id })}
                    style={{ display:'flex',alignItems:'center',gap:12,padding:'10px 12px',borderRadius:10,background:'var(--card-2)',border:'1px solid var(--border)',cursor:'pointer',transition:'all 0.1s' }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--brand-dim)'} onMouseLeave={e=>e.currentTarget.style.background='var(--card-2)'}>
                    <div style={{ width:32,height:32,borderRadius:10,background:`${BRAND}20`,color:BRAND,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,flexShrink:0 }}>Q{i+1}</div>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontWeight:700,fontSize:12,color:'var(--text)',fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{q.part_number}</div>
                      <div style={{ fontSize:11,color:'var(--text-3)',marginTop:1 }}>{q.ae_name||q.inquiry_type||'—'}</div>
                    </div>
                    <div style={{ textAlign:'right',flexShrink:0 }}>
                      <div style={{ fontSize:13,fontWeight:700,color:'#10b981' }}>${q.price}</div>
                      <div style={{ fontSize:10,color:'var(--text-4)' }}>{q.condition}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Performance tips */}
      <div style={{ background:'var(--card)',borderRadius:16,border:`1px solid ${BRAND}30`,padding:'18px 22px' }}>
        <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:14,color:'var(--text)',marginBottom:12 }}>💡 Performance Insights</div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:12 }}>
          {[
            (s.overdue||0)>0 && { icon:'⚠️', text:`${s.overdue} part${s.overdue>1?'s are':' is'} overdue — quote these first`, color:'#ef4444' },
            (s.critical||0)>0 && { icon:'🚨', text:`${s.critical} critical urgency part${s.critical>1?'s':''} — customer-flagged`, color:'#ef4444' },
            s.avgHours && s.avgHours > 24 && { icon:'⏱', text:`Avg response ${s.avgHours}h — aim for under 24h`, color:'#f59e0b' },
            !(s.todayQuotes>0) && (s.pending||0)>0 && { icon:'📋', text:`No quotes today — ${s.pending} parts waiting`, color:'#f59e0b' },
            (s.todayQuotes||0)>0 && { icon:'🎯', text:`${s.todayQuotes} quotes today — great work!`, color:'#10b981' },
            !(s.pending>0) && { icon:'🏆', text:'All caught up! Nothing pending.', color:BRAND },
          ].filter(Boolean).slice(0,4).map((tip,i)=>(
            <div key={i} style={{ background:'var(--card-2)',borderRadius:12,padding:'12px 14px',border:`1px solid ${tip.color}25`,display:'flex',gap:10,alignItems:'flex-start' }}>
              <span style={{ fontSize:18,flexShrink:0 }}>{tip.icon}</span>
              <span style={{ fontSize:12,color:'var(--text-2)',lineHeight:1.4 }}>{tip.text}</span>
            </div>
          ))}
        </div>
      </div>

      {drilldown && <PartsDrilldown title={drilldown.title} filter={drilldown.filter} onClose={() => setDrilldown(null)} />}
    </div>
  )
}
