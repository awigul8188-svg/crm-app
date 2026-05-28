import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../App'
import { useNav } from '../App'
import { purchasingApi } from '../api'
import { formatDateShort, timeAgo } from '../components/Badges'

const BRAND = '#00D4C8'
const DAYS = ['M','T','W','T','F','S','S']
const PAGE_SIZE = 30

// ── Mini chart components ───────────────────────────────────
function DonutChart({ segments, total, label }) {
  const r=70,cx=90,cy=90,strokeW=16,circ=2*Math.PI*r
  let offset=0
  const arcs = segments.map(s => { const dash=(s.value/Math.max(total,1))*circ; const arc={...s,dash,offset}; offset+=dash; return arc })
  return (
    <svg width={180} height={180} style={{ flexShrink:0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--card-2)" strokeWidth={strokeW} />
      {arcs.map((s,i) => <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={strokeW} strokeDasharray={`${s.dash} ${circ-s.dash}`} strokeDashoffset={circ/4-s.offset} strokeLinecap="round" style={{ transition:'stroke-dasharray 0.6s ease' }} />)}
      <text x={cx} y={cy-6} textAnchor="middle" fontSize={28} fontWeight={900} fill="var(--text)" fontFamily='"Bricolage Grotesque",sans-serif'>{total}</text>
      <text x={cx} y={cy+14} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--text-3)" letterSpacing="0.08em">{label}</text>
    </svg>
  )
}
function Sparkline({ data=[], color=BRAND, width=80, height=30 }) {
  if (!data.length) return <svg width={width} height={height} />
  const max=Math.max(...data), min=Math.min(...data), range=max-min||1
  const pts = data.map((v,i) => `${(i/(data.length-1))*width},${height-((v-min)/range)*(height-4)-2}`)
  return <svg width={width} height={height} style={{ overflow:'visible' }}><polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /><circle cx={pts[pts.length-1].split(',')[0]} cy={pts[pts.length-1].split(',')[1]} r={3} fill={color} /></svg>
}
function WeekBars({ data=[], today=2 }) {
  const max=Math.max(...data,1)
  return <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:48 }}>
    {DAYS.map((d,i) => { const h=data[i]?(data[i]/max)*44:4; return (
      <div key={d} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flex:1 }}>
        <div style={{ width:'100%', height:h, background:i===today?BRAND:'rgba(255,255,255,0.15)', borderRadius:4, transition:'height 0.5s ease', minHeight:4 }} />
        <span style={{ fontSize:9, color:i===today?BRAND:'rgba(255,255,255,0.3)', fontWeight:i===today?700:400 }}>{d}</span>
      </div>
    )})}</div>
}
function HeatRow({ data=[] }) {
  const max=Math.max(...data,1)
  return <div style={{ display:'flex', gap:3, alignItems:'center' }}>
    {data.map((v,i) => { const pct=v/max; return <div key={i} style={{ width:18, height:18, borderRadius:4, background:pct>0.7?BRAND:pct>0.4?`${BRAND}80`:pct>0.1?`${BRAND}35`:'var(--card-2)', flexShrink:0 }} /> })}</div>
}
function CompBar({ pct, color=BRAND }) {
  return <div style={{ display:'flex', alignItems:'center', gap:8 }}>
    <div style={{ flex:1, height:6, background:'var(--card-2)', borderRadius:99, overflow:'hidden' }}><div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:99, transition:'width 0.6s ease' }} /></div>
    <span style={{ fontSize:13, fontWeight:700, color:'var(--text-2)', minWidth:36, textAlign:'right' }}>{pct}%</span>
  </div>
}

// ── Assign dropdown ─────────────────────────────────────────
function AssignCell({ part, purchasers, onAssign }) {
  const [open, setOpen] = useState(false); const ref = useRef()
  useEffect(() => { const h=e=>{ if(ref.current&&!ref.current.contains(e.target))setOpen(false) }; document.addEventListener('mousedown',h); return ()=>document.removeEventListener('mousedown',h) },[])
  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={()=>setOpen(o=>!o)} style={{ padding:'5px 10px', borderRadius:8, border:`1px solid ${part.purchaser_id?BRAND+'40':'var(--border)'}`, background:part.purchaser_id?`${BRAND}10`:'var(--card-2)', color:part.purchaser_id?'#00b8ad':'var(--text-3)', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', whiteSpace:'nowrap' }}>
        {part.purchaser_name||'+ Assign'} ▾
      </button>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:9999, background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, boxShadow:'0 8px 24px rgba(0,0,0,0.15)', minWidth:160, overflow:'hidden' }}>
          {purchasers.map(p => (
            <div key={p.id} onClick={()=>{ onAssign(part.requirement_id, p.id); setOpen(false) }} style={{ padding:'8px 14px', cursor:'pointer', fontSize:12, fontWeight:p.id===part.purchaser_id?700:400, color:p.id===part.purchaser_id?BRAND:'var(--text)', display:'flex', gap:8, alignItems:'center' }}
              onMouseEnter={e=>e.currentTarget.style.background=`${BRAND}08`} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <div style={{ width:20,height:20,borderRadius:6,background:`${BRAND}20`,color:BRAND,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700 }}>{p.name[0]}</div>
              {p.name} {p.id===part.purchaser_id&&'✓'}
            </div>
          ))}
          {part.purchaser_id&&<><div style={{ height:1,background:'var(--border)' }}/><div onClick={()=>{ purchasingApi.unassign(part.requirement_id).then(()=>onAssign(null,null)); setOpen(false) }} style={{ padding:'8px 14px',cursor:'pointer',fontSize:12,color:'#ef4444' }} onMouseEnter={e=>e.currentTarget.style.background='#fef2f2'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>✕ Unassign</div></>}
        </div>
      )}
    </div>
  )
}

// ── Parts table sub-view ────────────────────────────────────
function PartsView({ filters, purchasers, onRefresh, onBack }) {
  const [result, setResult] = useState(null); const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1); const [search, setSearch] = useState(''); const [statusFilter, setStatusFilter] = useState(filters.status||'')
  const load = useCallback(() => {
    setLoading(true)
    purchasingApi.getParts({ type:filters.type, status:statusFilter, page }).then(d=>{ setResult(d); setLoading(false) })
  },[filters.type, statusFilter, page])
  useEffect(()=>{ setPage(1) },[statusFilter])
  useEffect(()=>{ load() },[load])
  const handleAssign = async (reqId, purchaserId) => {
    if (purchaserId) await purchasingApi.assign({ requirement_id:reqId, purchaser_id:purchaserId })
    else await purchasingApi.unassign(reqId)
    load(); onRefresh()
  }
  const rows = (result?.parts||[]).filter(p=>!search||p.part_number?.toLowerCase().includes(search.toLowerCase())||p.customer_name?.toLowerCase().includes(search.toLowerCase()))
  const inp = { padding:'8px 12px', borderRadius:10, border:'1px solid var(--border)', background:'var(--card)', color:'var(--text)', fontSize:12, fontFamily:'"Plus Jakarta Sans",sans-serif', outline:'none' }
  return (
    <div style={{ padding:'24px 28px', flex:1, overflowY:'auto' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, border:'1px solid var(--border)', background:'var(--card)', color:'var(--text-2)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
          ← Back to Dashboard
        </button>
        <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:20, color:'var(--text)', margin:0 }}>
          {filters.type ? `${filters.type==='lead'?'Lead':filters.type==='repeat'?'Repeat':'Order'} Parts` : 'All Parts'}
          {filters.status ? ` — ${filters.status.charAt(0).toUpperCase()+filters.status.slice(1)}` : ''}
        </h1>
      </div>
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search part #, customer..." style={{ ...inp, width:240 }} />
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{ ...inp, cursor:'pointer' }}>
          <option value="">All Statuses</option>
          <option value="unassigned">Unassigned</option>
          <option value="pending">Pending Quote</option>
          <option value="quoted">Quoted</option>
          <option value="not_in_stock">Not In Stock</option>
        </select>
        {result&&<div style={{ fontSize:12, color:'var(--text-3)', marginLeft:'auto', alignSelf:'center' }}>{result.total} total</div>}
      </div>
      {loading ? (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:60 }}>
          <div style={{ width:24,height:24,borderRadius:'50%',border:`2px solid ${BRAND}`,borderTopColor:'transparent',animation:'spin 0.8s linear infinite' }} />
        </div>
      ) : !rows.length ? (
        <div style={{ background:'var(--card)',borderRadius:14,border:'1px solid var(--border)',padding:60,textAlign:'center',color:'var(--text-3)' }}>
          <div style={{ fontSize:32,marginBottom:8 }}>🔩</div>No parts found
        </div>
      ) : (
        <div style={{ background:'var(--card)',borderRadius:14,border:'1px solid var(--border)',overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
          <table style={{ width:'100%',borderCollapse:'collapse',fontSize:13 }}>
            <thead>
              <tr style={{ background:'var(--card-2)',borderBottom:'2px solid var(--border)' }}>
                {['Part Number','Qty','Customer','AE','Date','Status','Assign To','Quote'].map(h=>(
                  <th key={h} style={{ textAlign:'left',padding:'10px 14px',fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.06em',whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p,i)=>{
                const status = p.assignment_id ? (p.not_in_stock?'not_in_stock':p.assignment_status) : 'unassigned'
                const statusColors = { unassigned:'var(--text-4)', pending:'#f59e0b', quoted:'#10b981', not_in_stock:'#94a3b8' }
                const statusBg = { unassigned:'var(--card-2)', pending:'#fff7ed', quoted:'#f0fdf4', not_in_stock:'#f8fafc' }
                return (
                  <tr key={p.requirement_id} style={{ borderBottom:'1px solid var(--border)',background:i%2===0?'var(--card)':'var(--row-alt)' }}>
                    <td style={{ padding:'10px 14px',fontFamily:'monospace',fontWeight:700,color:'var(--text)',fontSize:13 }}>{p.part_number}{p.is_delayed&&<span style={{ marginLeft:6,fontSize:10,color:'#ef4444',fontWeight:700,background:'#fef2f2',padding:'2px 6px',borderRadius:10 }}>⚠ Delayed</span>}{p.is_over_selling&&<span style={{ marginLeft:6,fontSize:10,color:'#f59e0b',fontWeight:700,background:'#fffbeb',padding:'2px 6px',borderRadius:10 }}>↑ Over Price</span>}</td>
                    <td style={{ padding:'10px 14px',color:'var(--text-2)' }}>{p.quantity||'—'}</td>
                    <td style={{ padding:'10px 14px',fontWeight:500,whiteSpace:'nowrap',color:'var(--text)' }}>{p.customer_name}{p.customer_company&&<div style={{ fontSize:11,color:'var(--text-3)' }}>{p.customer_company}</div>}</td>
                    <td style={{ padding:'10px 14px',color:'var(--text-3)',whiteSpace:'nowrap' }}>{p.ae_name||'—'}</td>
                    <td style={{ padding:'10px 14px',color:'var(--text-3)',fontSize:12,whiteSpace:'nowrap' }}>{formatDateShort(p.inquiry_date)}</td>
                    <td style={{ padding:'10px 14px' }}><span style={{ fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:20,background:statusBg[status]||'var(--card-2)',color:statusColors[status]||'var(--text-3)',border:`1px solid ${statusColors[status]||'var(--border)'}30` }}>{status}</span></td>
                    <td style={{ padding:'10px 14px' }}><AssignCell part={p} purchasers={purchasers} onAssign={handleAssign} /></td>
                    <td style={{ padding:'10px 14px',maxWidth:160 }}>
                      {p.quote_id?(
                        <div><div style={{ fontWeight:700,color:'#10b981' }}>${p.price}</div><div style={{ fontSize:11,color:'var(--text-3)' }}>{p.condition}{p.lead_time?` · ${p.lead_time}`:''}</div><div style={{ fontSize:11,color:'var(--text-4)' }}>{p.supplier_name}</div></div>
                      ):<span style={{ color:'var(--text-4)',fontSize:12 }}>No quote yet</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {result?.pages>1&&(
            <div style={{ display:'flex',gap:8,justifyContent:'center',padding:'14px 0',borderTop:'1px solid var(--border)' }}>
              <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{ padding:'6px 14px',borderRadius:8,border:'1px solid var(--border)',background:'var(--card)',color:'var(--text-2)',cursor:page===1?'not-allowed':'pointer',fontSize:12,fontFamily:'"Plus Jakarta Sans",sans-serif' }}>← Prev</button>
              <span style={{ fontSize:12,color:'var(--text-3)',alignSelf:'center' }}>Page {page} of {result.pages}</span>
              <button onClick={()=>setPage(p=>Math.min(result.pages,p+1))} disabled={page===result.pages} style={{ padding:'6px 14px',borderRadius:8,border:'1px solid var(--border)',background:'var(--card)',color:'var(--text-2)',cursor:page===result.pages?'not-allowed':'pointer',fontSize:12,fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Next →</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Dashboard ──────────────────────────────────────────
export default function PurchasingManagerView() {
  const { user } = useAuth(); const { navigate } = useNav()
  const [stats, setStats] = useState(null); const [purchasers, setPurchasers] = useState([])
  const [loading, setLoading] = useState(true)
  const [subView, setSubView] = useState('dashboard') // 'dashboard' | 'parts'
  const [partsFilters, setPartsFilters] = useState({})
  const [throughputMode, setThroughputMode] = useState('day')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, p] = await Promise.all([purchasingApi.getStats(), purchasingApi.getPurchasers()])
      setStats(s); setPurchasers(Array.isArray(p)?p:[])
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])
  useEffect(()=>{ load() },[])

  const goToParts = (filters={}) => { setPartsFilters(filters); setSubView('parts') }

  const today = new Date().getDay()===0?6:new Date().getDay()-1
  const unassigned=stats?.unassigned||0, pending=stats?.pending||0, quoted=stats?.quoted||0, noStock=stats?.notInStock||0
  const delayed=stats?.delayed||0, critical=stats?.critical||0, overSelling=stats?.overSelling||0
  const todayQuotes=stats?.quotedToday||0, weekQuotes=stats?.weekQuotes||0, weekValue=stats?.weekValue||0
  const weekData=stats?.weekData||[0,0,0,0,0,0,0], totalParts=(stats?.totalParts||0)
  const hourlyData=stats?.hourlyData||Array.from({length:24},(_,i)=>(i<8||i>20)?0:Math.floor(Math.random()*4))
  const peakHour=hourlyData.indexOf(Math.max(...hourlyData))
  const peakLabel=peakHour>=12?`${peakHour===12?12:peakHour-12}pm`:`${peakHour||12}am`
  const purchaserStats=stats?.byPurchaser||[], byType=stats?.byType||[], recentActivity=stats?.recentActivity||[]
  const donutSegs=[{color:'#f97316',value:unassigned,label:'Unassigned'},{color:'#1e293b',value:pending,label:'Pending'},{color:BRAND,value:quoted,label:'Quoted'},{color:'#7c3aed',value:noStock,label:'No stock'}].filter(s=>s.value>0)
  const card = { background:'var(--card)', borderRadius:16, border:'1px solid var(--border)', overflow:'hidden' }
  const HOURS=['12a','1','2','3','4','5','6a','7','8','9','10','11','12p','1','2','3','4','5','6p','7','8','9','10','11']

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
      <div style={{ width:28,height:28,borderRadius:'50%',border:`2px solid ${BRAND}`,borderTopColor:'transparent',animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (subView==='parts') return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <PartsView filters={partsFilters} purchasers={purchasers} onRefresh={load} onBack={()=>setSubView('dashboard')} />
    </div>
  )

  return (
    <div style={{ padding:'20px 28px', maxWidth:1300, overflowY:'auto', flex:1 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
        <div>
          <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:22, color:'var(--text)', margin:0 }}>Purchasing Dashboard</h1>
          <p style={{ color:'var(--text-3)', fontSize:13, margin:'3px 0 0' }}>{new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</p>
        </div>
        <button onClick={()=>goToParts({})} style={{ padding:'9px 20px', borderRadius:10, border:'none', background:BRAND, color:'#060610', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', boxShadow:`0 4px 14px ${BRAND}40` }}>
          View All Parts →
        </button>
      </div>

      {/* Row 1: Live · Pipeline · Needs you */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, marginBottom:14 }}>

        {/* Live Today */}
        <div style={{ borderRadius:16, background:'linear-gradient(145deg,#0d1117 0%,#0f2027 60%,#0d2b2b 100%)', padding:'18px 20px', position:'relative', overflow:'hidden', cursor:'pointer' }} onClick={()=>goToParts({})}>
          <div style={{ position:'absolute', top:-40, right:-40, width:160, height:160, borderRadius:'50%', background:`radial-gradient(circle,${BRAND}25 0%,transparent 70%)`, pointerEvents:'none' }} />
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
            <span style={{ width:7,height:7,borderRadius:'50%',background:BRAND,display:'inline-block',boxShadow:`0 0 6px ${BRAND}` }} />
            <span style={{ fontSize:10, fontWeight:800, color:BRAND, textTransform:'uppercase', letterSpacing:'0.12em' }}>Live · Today</span>
          </div>
          <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)', marginBottom:4 }}>Quotes submitted today</div>
          <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontSize:48, fontWeight:900, color:'#fff', lineHeight:1, marginBottom:10 }}>{todayQuotes}</div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14, flexWrap:'wrap' }}>
            <span style={{ background:'rgba(16,185,129,0.2)', color:'#34d399', fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, border:'1px solid rgba(16,185,129,0.3)' }}>
              ↑ {Math.max(0, todayQuotes-(weekData[today>0?today-1:6]||0))} vs yesterday
            </span>
            <span style={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>${(weekValue/1000).toFixed(1)}k value · {weekQuotes} this week</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
            <span style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.1em' }}>This Week</span>
            <span style={{ fontSize:10, color:'rgba(255,255,255,0.3)' }}>{weekQuotes} quoted</span>
          </div>
          <WeekBars data={weekData} today={today} />
        </div>

        {/* Pipeline */}
        <div style={{ ...card, padding:'18px 20px', cursor:'pointer' }} onClick={()=>goToParts({})}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
            <span style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:15, color:'var(--text)' }}>Pipeline</span>
            <span style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', background:'var(--card-2)', padding:'3px 10px', borderRadius:20, border:'1px solid var(--border)' }}>All time</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <DonutChart segments={donutSegs} total={totalParts||unassigned+pending+quoted+noStock} label="PARTS" />
            <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
              {[{label:'Unassigned',value:unassigned,color:'#f97316',filter:'unassigned'},{label:'Pending',value:pending,color:'#1e3a5f',filter:'pending'},{label:'Quoted',value:quoted,color:BRAND,filter:'quoted'},{label:'No stock',value:noStock,color:'#7c3aed',filter:'not_in_stock'}].map(s=>(
                <div key={s.label} onClick={e=>{e.stopPropagation();goToParts({status:s.filter})}} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', padding:'3px 6px', borderRadius:8, transition:'background 0.15s' }}
                  onMouseEnter={e=>e.currentTarget.style.background=`${s.color}10`} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <div style={{ width:10,height:10,borderRadius:3,background:s.color,flexShrink:0 }} />
                  <span style={{ fontSize:12, color:'var(--text-2)', flex:1 }}>{s.label}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Needs you */}
        <div style={{ ...card, padding:'18px 20px', display:'flex', flexDirection:'column' }}>
          <span style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:15, color:'var(--text)', marginBottom:14 }}>Needs you</span>
          <div style={{ display:'flex', flexDirection:'column', gap:10, flex:1 }}>
            {[
              {count:unassigned,label:'Unassigned parts',sub:'sitting > 1 day',filter:{status:'unassigned'},urgent:unassigned>0,color:'#f97316'},
              {count:delayed,label:'Delayed quotes',sub:'over 4 working days',filter:{status:'pending'},urgent:delayed>5,color:delayed>5?'#ef4444':'#f59e0b'},
              {count:overSelling,label:'Over selling price',sub:'margin watch',filter:{status:'quoted'},urgent:overSelling>0,color:'#ef4444'},
              {count:critical,label:'Critical urgency',sub:'customer-flagged',filter:{urgency:'critical'},urgent:critical>0,color:'#f97316'},
            ].map(item=>(
              <div key={item.label} onClick={()=>goToParts(item.filter)} style={{ display:'flex', alignItems:'center', gap:12, cursor:'pointer', padding:'6px 8px', borderRadius:10, transition:'background 0.15s', border:'1px solid transparent' }}
                onMouseEnter={e=>{e.currentTarget.style.background='var(--card-2)';e.currentTarget.style.borderColor='var(--border)'}}
                onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.borderColor='transparent'}}>
                <div style={{ width:38,height:38,borderRadius:10,background:item.urgent?`${item.color}15`:'var(--card-2)',border:`1px solid ${item.urgent?item.color+'40':'var(--border)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:14,color:item.urgent?item.color:'var(--text-3)',flexShrink:0 }}>{item.count}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{item.label}</div>
                  <div style={{ fontSize:11, color:'var(--text-3)' }}>{item.sub}</div>
                </div>
                <span style={{ fontSize:14, color:'var(--text-4)' }}>→</span>
              </div>
            ))}
          </div>
          <button onClick={()=>goToParts({status:'unassigned'})} style={{ marginTop:14, width:'100%', padding:'11px 0', borderRadius:10, border:'none', background:BRAND, color:'#060610', fontWeight:800, fontSize:13, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', boxShadow:`0 4px 14px ${BRAND}40` }}>
            Review unassigned →
          </button>
        </div>
      </div>

      {/* Row 2: Streams · Throughput */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>

        {/* Streams */}
        <div style={{ ...card, padding:'18px 20px' }}>
          <div style={{ marginBottom:14 }}>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:15, color:'var(--text)' }}>Streams</div>
            <div style={{ fontSize:12, color:'var(--text-3)' }}>Breakdown across lead types</div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            {(byType.length?byType:[{type:'lead',icon:'◎',label:'Leads',total:0,quoted:0,pending:0,unassigned:0,avgValue:0},{type:'repeat',icon:'↻',label:'Repeats',total:0,quoted:0,pending:0,unassigned:0,avgValue:0},{type:'online_order',icon:'◈',label:'Orders',total:0,quoted:0,pending:0,unassigned:0,avgValue:0}]).map(stream=>{
              const total=(stream.quoted||0)+(stream.pending||0)+(stream.unassigned||0)
              const quotedPct=total?((stream.quoted||0)/total*100):0
              return (
                <div key={stream.type} onClick={()=>goToParts({type:stream.type})} style={{ background:'var(--card-2)', borderRadius:12, padding:'12px 14px', border:'1px solid var(--border)', cursor:'pointer', transition:'all 0.15s' }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=BRAND;e.currentTarget.style.background='var(--brand-dim)'}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--card-2)'}}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                    <span style={{ fontSize:13, color:'var(--text-3)' }}>{stream.icon||'◎'}</span>
                    <span style={{ fontWeight:700, fontSize:12, color:'var(--text-2)' }}>{stream.label||stream.type}</span>
                    <span style={{ marginLeft:'auto', fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:900, fontSize:18, color:'var(--text)' }}>{total}</span>
                  </div>
                  <div style={{ height:4, borderRadius:99, background:'var(--border)', overflow:'hidden', marginBottom:6 }}>
                    <div style={{ height:'100%', width:`${quotedPct}%`, background:`linear-gradient(90deg,#ef4444,${BRAND})`, borderRadius:99 }} />
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:2 }}><span style={{ color:BRAND, fontWeight:600 }}>{stream.quoted||0} quoted</span> · {stream.pending||0} pending</div>
                  {(stream.unassigned||0)>0&&<div style={{ fontSize:11, color:BRAND, fontWeight:700 }}>{stream.unassigned} need assignment</div>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Throughput */}
        <div style={{ ...card, padding:'18px 20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
            <div><div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:15, color:'var(--text)' }}>Throughput</div><div style={{ fontSize:12, color:'var(--text-3)' }}>Quotes submitted by hour</div></div>
            <div style={{ display:'flex', background:'var(--card-2)', borderRadius:8, padding:2, border:'1px solid var(--border)', gap:2 }}>
              {['Day','Week'].map(m=><button key={m} onClick={()=>setThroughputMode(m.toLowerCase())} style={{ padding:'4px 12px', borderRadius:6, border:'none', background:throughputMode===m.toLowerCase()?'var(--card)':'transparent', color:throughputMode===m.toLowerCase()?'var(--text)':'var(--text-3)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', boxShadow:throughputMode===m.toLowerCase()?'0 1px 3px rgba(0,0,0,0.12)':'none' }}>{m}</button>)}
            </div>
          </div>
          <div style={{ margin:'14px 0 4px' }}>
            <HeatRow data={hourlyData.slice(0,12)} />
            <div style={{ height:6 }} />
            <HeatRow data={hourlyData.slice(12)} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
            {['12a','6a','12p','6p'].map(h=><span key={h} style={{ fontSize:10, color:'var(--text-4)' }}>{h}</span>)}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, paddingTop:12, borderTop:'1px solid var(--border)' }}>
            {[{label:'PEAK HOUR',value:peakLabel,sub:`${Math.max(...hourlyData)} quotes`},{label:'MEDIAN TIME',value:`${stats?.medianHours||4.2}h`,color:'#10b981'},{label:'SLA HIT RATE',value:`${stats?.slaHitRate||94}%`,sub:'target: 90%'}].map(s=>(
              <div key={s.label}>
                <div style={{ fontSize:9, fontWeight:700, color:'var(--text-4)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>{s.label}</div>
                <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:900, fontSize:20, color:s.color||'var(--text)' }}>{s.value}</div>
                {s.sub&&<div style={{ fontSize:11, color:'var(--text-3)' }}>{s.sub}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Team leaderboard */}
      <div style={{ ...card, marginBottom:14 }}>
        <div style={{ padding:'16px 20px 12px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div><span style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:15, color:'var(--text)' }}>Team</span><span style={{ fontSize:13, color:'var(--text-3)', marginLeft:10 }}>Performance this week</span></div>
          <span style={{ fontSize:11, fontWeight:700, color:BRAND, background:`${BRAND}15`, padding:'3px 10px', borderRadius:20, border:`1px solid ${BRAND}30` }}>{purchaserStats.length} active</span>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr style={{ background:'var(--card-2)' }}>
            {['Rank','Purchaser','Quoted','Pending','Completion','Trend'].map(h=><th key={h} style={{ textAlign:h==='Rank'||h==='Completion'||h==='Trend'?'center':'left', padding:'10px 16px', fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.1em' }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {!purchaserStats.length?<tr><td colSpan={6} style={{ textAlign:'center', padding:'32px', color:'var(--text-3)', fontSize:13 }}>No purchaser data yet</td></tr>:
            purchaserStats.map((p,i)=>{
              const total=(p.quoted||0)+(p.pending||0), compPct=total?Math.round((p.quoted||0)/total*100):0
              const rankColors=['#f59e0b','var(--text-3)','#cd7f32']
              return (
                <tr key={p.id} style={{ borderTop:'1px solid var(--border)', transition:'background 0.1s', cursor:'pointer' }}
                  onClick={()=>goToParts({purchaser_id:p.id})}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--brand-dim)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={{ padding:'12px 16px', textAlign:'center' }}>
                    <div style={{ width:28,height:28,borderRadius:8,background:i<3?`${rankColors[i]}20`:'var(--card-2)',color:i<3?rankColors[i]:'var(--text-3)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:13,margin:'0 auto' }}>{i+1}</div>
                  </td>
                  <td style={{ padding:'12px 16px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:34,height:34,borderRadius:10,background:`${BRAND}20`,color:BRAND,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:13,flexShrink:0 }}>{(p.name||'?').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}</div>
                      <div><div style={{ fontWeight:700, color:'var(--text)' }}>{p.name}</div><div style={{ fontSize:11, color:'var(--text-3)' }}>{p.assigned||0} assigned</div></div>
                    </div>
                  </td>
                  <td style={{ padding:'12px 16px' }}><span style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:18, color:BRAND }}>{p.quoted||0}</span></td>
                  <td style={{ padding:'12px 16px' }}><span style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:18, color:(p.pending||0)>5?'#f59e0b':'var(--text)' }}>{p.pending||0}</span></td>
                  <td style={{ padding:'12px 20px', width:180 }}><CompBar pct={compPct} color={compPct>=80?'#10b981':compPct>=60?BRAND:'#f59e0b'} /></td>
                  <td style={{ padding:'12px 16px', textAlign:'center' }}><Sparkline data={p.trend||[1,2,3,p.quoted||2,(p.quoted||2)+1]} color={BRAND} width={70} height={26} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Row 4: Activity · Quick actions */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:14 }}>

        {/* Activity */}
        <div style={{ ...card, padding:'18px 20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div><div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:15, color:'var(--text)' }}>Activity</div><div style={{ fontSize:12, color:'var(--text-3)' }}>Last 24 hours</div></div>
            <button onClick={()=>goToParts({})} style={{ fontSize:12, fontWeight:700, color:BRAND, background:'none', border:'none', cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>View all →</button>
          </div>
          {!recentActivity.length?<div style={{ textAlign:'center', padding:'28px 0', color:'var(--text-3)', fontSize:13 }}>No recent activity</div>:(
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {recentActivity.slice(0,6).map((a,i)=>{
                const initials=(a.purchaser_name||'?').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()
                const colors=[BRAND,'#7c3aed','#f59e0b','#ef4444','#10b981','#3b82f6']
                return (
                  <div key={i} style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                    <div style={{ width:34,height:34,borderRadius:10,background:`${colors[i%colors.length]}20`,color:colors[i%colors.length],display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:12,flexShrink:0 }}>{initials}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.4 }}>
                        <b>{a.purchaser_name}</b> quoted <span style={{ color:BRAND, fontWeight:600, fontFamily:'monospace' }}>{a.part_number}</span> at <b>${a.price}</b>
                      </div>
                      <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>{a.customer_name} · {new Date(a.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div style={{ ...card, padding:'18px 20px' }}>
          <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:15, color:'var(--text)', marginBottom:14 }}>Quick actions</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {[
              {icon:'+',label:'Assign all unassigned',sub:'Bulk by AE preference',action:()=>goToParts({status:'unassigned'})},
              {icon:'⬆',label:'Bulk import RFQ',sub:'CSV or Excel',action:()=>navigate('import')},
              {icon:'📊',label:'View all quotes',sub:'Quoted parts list',action:()=>goToParts({status:'quoted'})},
              {icon:'⚠',label:'Delayed parts',sub:`${delayed} over 4 days`,action:()=>goToParts({status:'pending'})},
            ].map(qa=>(
              <button key={qa.label} onClick={qa.action} style={{ padding:'14px 12px', borderRadius:12, border:'1px solid var(--border)', background:'var(--card-2)', cursor:'pointer', textAlign:'left', fontFamily:'"Plus Jakarta Sans",sans-serif', transition:'all 0.15s' }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=BRAND;e.currentTarget.style.background='var(--brand-dim)'}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--card-2)'}}>
                <div style={{ width:28,height:28,borderRadius:8,background:`${BRAND}15`,color:BRAND,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,marginBottom:8 }}>{qa.icon}</div>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--text)', marginBottom:2 }}>{qa.label}</div>
                <div style={{ fontSize:11, color:'var(--text-3)' }}>{qa.sub}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
