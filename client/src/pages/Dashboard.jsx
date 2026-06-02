import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useAuth } from '../App'
import { useNav } from '../App'

const BRAND = '#00D4C8'
const C = ['#00D4C8','#3b82f6','#6366f1','#f59e0b','#ef4444','#10b981','#8b5cf6','#f97316']
const token = () => localStorage.getItem('crm_token')
const fmt$ = v => v >= 1000 ? '$'+(v/1000).toFixed(1)+'k' : '$'+Math.round(v||0)

function Tip({ active, payload, label }) {
  if (!active||!payload?.length) return null
  return <div style={{ background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,padding:'8px 12px',fontSize:12 }}>
    <div style={{ color:'var(--text-3)',marginBottom:4 }}>{label}</div>
    {payload.map(p=><div key={p.name} style={{ color:p.color||BRAND,display:'flex',gap:8 }}><span>{p.name}</span><b>{p.value?.toLocaleString()}</b></div>)}
  </div>
}

function DrilldownModal({ title, filters, onClose }) {
  const { navigate } = useNav()
  const [rows,setRows]=useState([]); const [loading,setLoading]=useState(true)
  useEffect(()=>{
    const p=new URLSearchParams()
    Object.entries(filters||{}).forEach(([k,v])=>{ if(v) p.set(k,v) })
    fetch('/api/inquiries?'+p,{headers:{Authorization:'Bearer '+token()}})
      .then(r=>r.json()).then(d=>{setRows(Array.isArray(d)?d:[]);setLoading(false)}).catch(()=>setLoading(false))
  },[])
  const tc = { lead:'#3b82f6', repeat:'#6366f1', online_order:'#f59e0b' }
  return createPortal(
    <div onClick={onClose} style={{ position:'fixed',inset:0,zIndex:99999,background:'rgba(0,0,0,0.55)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'var(--card)',borderRadius:20,boxShadow:'0 24px 80px rgba(0,0,0,0.3)',width:'100%',maxWidth:920,maxHeight:'88vh',display:'flex',flexDirection:'column' }}>
        <div style={{ padding:'18px 24px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0 }}>
          <div>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:16,color:'var(--text)' }}>{title}</div>
            <div style={{ fontSize:12,color:'var(--text-3)',marginTop:2 }}>{loading?'Loading…':rows.length+' records'}</div>
          </div>
          <button onClick={onClose} style={{ width:32,height:32,borderRadius:10,border:'none',background:'var(--card-2)',cursor:'pointer',fontSize:18,color:'var(--text-3)' }}>x</button>
        </div>
        <div style={{ overflowY:'auto',flex:1 }}>
          {loading?(<div style={{ display:'flex',alignItems:'center',justifyContent:'center',padding:60 }}><div style={{ width:24,height:24,borderRadius:'50%',border:'2px solid '+BRAND,borderTopColor:'transparent',animation:'spin 0.8s linear infinite' }}/></div>)
          :!rows.length?(<div style={{ textAlign:'center',padding:60,color:'var(--text-3)' }}>No records</div>):(
            <table style={{ width:'100%',borderCollapse:'collapse',fontSize:13 }}>
              <thead><tr style={{ background:'var(--card-2)',position:'sticky',top:0 }}>
                {['Date','Customer','AE','Type','Disposition','Value'].map(h=><th key={h} style={{ textAlign:'left',padding:'10px 14px',fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.06em',borderBottom:'2px solid var(--border)' }}>{h}</th>)}
              </tr></thead>
              <tbody>{rows.map((r,i)=>(
                <tr key={r.id} onClick={()=>{navigate('inquiry-detail',{id:r.id});onClose()}} style={{ borderBottom:'1px solid var(--border)',background:i%2===0?'var(--card)':'var(--row-alt)',cursor:'pointer' }}
                  onMouseEnter={e=>e.currentTarget.style.background=BRAND+'08'} onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'var(--card)':'var(--row-alt)'}>
                  <td style={{ padding:'10px 14px',color:'var(--text-3)',fontSize:12 }}>{new Date(r.created_at).toLocaleDateString()}</td>
                  <td style={{ padding:'10px 14px',fontWeight:600,color:'var(--text)' }}>{r.customer_name}{r.customer_company&&<div style={{ fontSize:11,color:'var(--text-3)' }}>{r.customer_company}</div>}</td>
                  <td style={{ padding:'10px 14px',color:'var(--text-2)',fontSize:12 }}>{r.assigned_name||'—'}</td>
                  <td style={{ padding:'10px 14px' }}><span style={{ fontSize:12,color:tc[r.type]||'var(--text-3)' }}>{r.type==='online_order'?'Order':r.type==='lead'?'Lead':'Repeat'}</span></td>
                  <td style={{ padding:'10px 14px',fontSize:12,color:'var(--text-2)' }}>{r.disposition||'—'}</td>
                  <td style={{ padding:'10px 14px',fontWeight:600,color:r.order_amount?'#10b981':'var(--text-4)' }}>{r.order_amount?'$'+r.order_amount:'—'}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>
    </div>, document.body
  )
}

function SetTargetModal({ ae, existing, onClose, onSaved }) {
  const now = new Date()
  const [form,setForm]=useState({ year:existing?.year||now.getFullYear(), quarter:existing?.quarter||Math.ceil((now.getMonth()+1)/3), gp_target:existing?.gp_target||'', revenue_target:existing?.revenue_target||'', leads_target:existing?.leads_target||'', repeat_target:existing?.repeat_target||'', orders_target:existing?.orders_target||'', notes:existing?.notes||'' })
  const [saving,setSaving]=useState(false)
  const save = async () => {
    setSaving(true)
    await fetch('/api/analytics/targets',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token()},body:JSON.stringify({ae_id:ae.id,...form})})
    setSaving(false); onSaved()
  }
  const inp = { width:'100%',boxSizing:'border-box',background:'var(--input-bg)',border:'1px solid var(--input-border)',borderRadius:10,padding:'9px 13px',fontSize:13,color:'var(--text)',fontFamily:'"Plus Jakarta Sans",sans-serif',outline:'none' }
  return createPortal(
    <div onClick={onClose} style={{ position:'fixed',inset:0,zIndex:999999,background:'rgba(0,0,0,0.55)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'var(--card)',borderRadius:20,padding:'24px',width:'100%',maxWidth:460,fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
        <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:16,color:'var(--text)',marginBottom:4 }}>Set Target — {ae.name}</div>
        <div style={{ fontSize:12,color:'var(--text-3)',marginBottom:18 }}>GP is the primary target metric</div>
        <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
            <div><div style={{ fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6 }}>Year</div>
              <select value={form.year} onChange={e=>setForm(f=>({...f,year:parseInt(e.target.value)}))} style={{ ...inp,cursor:'pointer' }}>{[2024,2025,2026,2027].map(y=><option key={y}>{y}</option>)}</select></div>
            <div><div style={{ fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6 }}>Quarter</div>
              <select value={form.quarter} onChange={e=>setForm(f=>({...f,quarter:parseInt(e.target.value)}))} style={{ ...inp,cursor:'pointer' }}>{[1,2,3,4].map(q=><option key={q} value={q}>Q{q}</option>)}</select></div>
          </div>
          <div><div style={{ fontSize:11,fontWeight:700,color:'#10b981',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6 }}>GP Target ($) ★ Primary</div>
            <input value={form.gp_target} onChange={e=>setForm(f=>({...f,gp_target:e.target.value}))} placeholder="e.g. 50000" style={inp} type="number" /></div>
          <div><div style={{ fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6 }}>Revenue Target ($)</div>
            <input value={form.revenue_target} onChange={e=>setForm(f=>({...f,revenue_target:e.target.value}))} placeholder="e.g. 150000" style={inp} type="number" /></div>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10 }}>
            {[['Leads','leads_target'],['Repeats','repeat_target'],['Orders','orders_target']].map(([l,k])=>(
              <div key={k}><div style={{ fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6 }}>{l}</div>
                <input value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} placeholder="0" style={inp} type="number" /></div>
            ))}
          </div>
          <div style={{ display:'flex',gap:10,marginTop:4 }}>
            <button onClick={save} disabled={saving} style={{ flex:1,padding:'12px',borderRadius:12,border:'none',background:saving?'var(--card-2)':BRAND,color:saving?'var(--text-3)':'#060610',fontWeight:700,fontSize:14,cursor:saving?'not-allowed':'pointer',fontFamily:'inherit' }}>{saving?'Saving…':'Save Target'}</button>
            <button onClick={onClose} style={{ padding:'12px 18px',borderRadius:12,border:'1px solid var(--border)',background:'var(--card)',color:'var(--text-2)',cursor:'pointer',fontFamily:'inherit' }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>, document.body
  )
}

function Stat({ label, value, sub, color=BRAND, filters, drill }) {
  return (
    <div onClick={()=>drill&&filters&&drill(label,filters)} style={{ background:'var(--card-2)',borderRadius:12,padding:'14px 16px',cursor:drill&&filters?'pointer':'default',transition:'all 0.15s',border:'1px solid transparent',position:'relative' }}
      onMouseEnter={e=>{ if(drill&&filters){e.currentTarget.style.borderColor=color;e.currentTarget.style.background='var(--card)'} }}
      onMouseLeave={e=>{ e.currentTarget.style.borderColor='transparent';e.currentTarget.style.background='var(--card-2)' }}>
      {drill&&filters&&<span style={{ position:'absolute',top:8,right:10,fontSize:9,color:'var(--text-4)' }}>↗</span>}
      <div style={{ fontSize:9,fontWeight:700,color:'var(--text-4)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:4 }}>{label}</div>
      <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:800,fontSize:24,color,lineHeight:1 }}>{value}</div>
      {sub&&<div style={{ fontSize:11,color:'var(--text-3)',marginTop:3 }}>{sub}</div>}
    </div>
  )
}

function ProgressBar({ label, achieved, target, pct, color=BRAND }) {
  return (
    <div>
      <div style={{ display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:5 }}>
        <span style={{ color:'rgba(255,255,255,0.6)',fontWeight:500 }}>{label}</span>
        <span style={{ color:'#fff',fontWeight:700 }}>{achieved} <span style={{ color:'rgba(255,255,255,0.35)',fontWeight:400 }}>/ {target}</span></span>
      </div>
      <div style={{ height:6,background:'rgba(255,255,255,0.1)',borderRadius:99 }}>
        <div style={{ height:'100%',width:Math.min(100,pct||0)+'%',background:color,borderRadius:99,transition:'width 0.6s' }} />
      </div>
      <div style={{ fontSize:10,fontWeight:700,color:pct>=100?'#10b981':color,marginTop:3 }}>{Math.round(pct||0)}%{pct>=100&&' ✓'}</div>
    </div>
  )
}

function BarList({ items, labelKey, valueKey, onDrill, filterKey }) {
  const max = items[0]?.[valueKey]||1
  return (
    <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
      {items.slice(0,8).map((item,i)=>(
        <div key={item[labelKey]} onClick={()=>onDrill&&onDrill(item[labelKey],filterKey,item[labelKey])} style={{ cursor:onDrill?'pointer':'default' }}>
          <div style={{ display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4 }}>
            <span style={{ color:'var(--text-2)' }}>{item[labelKey]}</span>
            <span style={{ fontWeight:700,color:'var(--text)' }}>{item[valueKey]}</span>
          </div>
          <div style={{ height:5,background:'var(--card-2)',borderRadius:99 }}>
            <div style={{ height:'100%',width:(item[valueKey]/max)*100+'%',background:C[i%C.length],borderRadius:99 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function Section({ title, icon, children }) {
  return (
    <div style={{ marginBottom:32 }}>
      <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:18,paddingBottom:12,borderBottom:'2px solid var(--border)' }}>
        <span style={{ fontSize:22 }}>{icon}</span>
        <h2 style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:800,fontSize:20,color:'var(--text)',margin:0 }}>{title}</h2>
      </div>
      {children}
    </div>
  )
}

const SEL = { background:'var(--input-bg)',border:'1px solid var(--input-border)',borderRadius:10,padding:'7px 12px',fontSize:12,color:'var(--text)',fontFamily:'"Plus Jakarta Sans",sans-serif',outline:'none',cursor:'pointer' }

export default function Dashboard() {
  const { user } = useAuth(); const { navigate } = useNav()
  const [data,setData]=useState(null); const [loading,setLoading]=useState(true)
  const [from,setFrom]=useState(''); const [to,setTo]=useState('')
  const [drilldown,setDrilldown]=useState(null)
  const [targetModal,setTargetModal]=useState(null)
  const [leadF,setLeadF]=useState({ disposition:'',source:'',ae:'' })
  const [ordF, setOrdF] =useState({ disposition:'' })
  const [repF, setRepF] =useState({ disposition:'' })

  const load = useCallback(() => {
    setLoading(true)
    const p=new URLSearchParams(); if(from) p.set('from',from); if(to) p.set('to',to)
    fetch('/api/analytics/manager-dashboard?'+p,{headers:{Authorization:'Bearer '+token()}})
      .then(r=>r.json()).then(d=>{setData(d);setLoading(false)}).catch(()=>setLoading(false))
  },[from,to])
  useEffect(()=>{load()},[load])

  const drill = (title,filters={}) => setDrilldown({title,filters:{...filters,...(from?{from}:{}),...(to?{to}:{})}})

  const greet = () => { const h=new Date().getHours(); return h<12?'Good morning':h<17?'Good afternoon':'Good evening' }

  if (loading) return <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'60vh' }}><div style={{ width:28,height:28,borderRadius:'50%',border:'2px solid '+BRAND,borderTopColor:'transparent',animation:'spin 0.8s linear infinite' }}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
  if (!data) return null

  const { own, team, leads, repeats, orders, meta } = data
  const t = own?.target
  const gpPct  = t?.gp_target  > 0 ? Math.min(100,Math.round((own.gp||0)/t.gp_target*100))     : 0
  const revPct = t?.revenue_target > 0 ? Math.min(100,Math.round((own.revenue||0)/t.revenue_target*100)) : 0

  return (
    <div style={{ padding:'24px 28px',flex:1,overflowY:'auto',maxWidth:1400,fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12 }}>
        <div>
          <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:800,fontSize:24,color:'var(--text)',margin:0 }}>{greet()}, {user.name} 👋</h1>
          <p style={{ color:'var(--text-3)',fontSize:13,margin:'3px 0 0' }}>{new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})} · Q{meta?.quarter} {meta?.year}</p>
        </div>
        <div style={{ display:'flex',gap:8,alignItems:'center',flexWrap:'wrap' }}>
          <div style={{ display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--text-3)' }}>From<input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={SEL} /></div>
          <div style={{ display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--text-3)' }}>To<input type="date" value={to} onChange={e=>setTo(e.target.value)} style={SEL} /></div>
          {(from||to)&&<button onClick={()=>{setFrom('');setTo('')}} style={{ padding:'7px 12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--card)',color:'var(--text-3)',fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>x Clear</button>}
          <button onClick={()=>setTargetModal({ae:user,existing:own?.target})} style={{ padding:'9px 16px',borderRadius:10,border:'1px solid '+BRAND+'40',background:BRAND+'10',color:BRAND,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit' }}>Target My Q{meta?.quarter}</button>
          <button onClick={load} style={{ padding:'9px 16px',borderRadius:10,border:'none',background:BRAND,color:'#060610',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit' }}>Refresh</button>
        </div>
      </div>

      {/* ══ 1. OWN PERFORMANCE ══════════════════════════════ */}
      <Section title="My Performance" icon="👤">
        {t&&(
          <div style={{ background:'linear-gradient(135deg,#0d1117,#0a2020)',borderRadius:16,padding:'20px 24px',marginBottom:16 }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14 }}>
              <div style={{ fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.1em' }}>Q{meta.quarter} {meta.year} Target</div>
              <button onClick={()=>setTargetModal({ae:user,existing:t})} style={{ fontSize:11,color:BRAND,background:BRAND+'15',border:'1px solid '+BRAND+'30',borderRadius:8,padding:'4px 12px',cursor:'pointer',fontFamily:'inherit' }}>Edit</button>
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:16 }}>
              {t.gp_target>0&&<ProgressBar label="GP Target" achieved={fmt$(own.gp||0)} target={fmt$(t.gp_target)} pct={gpPct} color="#10b981" />}
              {t.revenue_target>0&&<ProgressBar label="Revenue Target" achieved={fmt$(own.revenue||0)} target={fmt$(t.revenue_target)} pct={revPct} color={BRAND} />}
            </div>
          </div>
        )}
        {!t&&<div style={{ background:'var(--card)',borderRadius:12,border:'2px dashed '+BRAND+'40',padding:'16px 20px',marginBottom:16,display:'flex',alignItems:'center',gap:12 }}>
          <span style={{ fontSize:24 }}>🎯</span>
          <div><div style={{ fontWeight:700,color:'var(--text)',fontSize:14 }}>No quarterly target set</div><div style={{ fontSize:13,color:'var(--text-3)' }}>Click "Target My Q{meta?.quarter}" to set your GP and revenue targets</div></div>
        </div>}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:12,marginBottom:16 }}>
          <Stat label="Total" value={own?.total||0} filters={{ assigned_to:user.id }} drill={drill} />
          <Stat label="Closed Won" value={own?.won||0} color="#10b981" sub={(own?.winRate||0)+'% win rate'} filters={{ assigned_to:user.id,disposition:'Closed Won' }} drill={drill} />
          <Stat label="Closed Lost" value={own?.lost||0} color="#ef4444" filters={{ assigned_to:user.id,disposition:'Closed Lost' }} drill={drill} />
          <Stat label="In Progress" value={own?.active||0} color={BRAND} filters={{ assigned_to:user.id }} drill={drill} />
          <Stat label="Revenue" value={fmt$(own?.revenue||0)} color="#10b981" filters={{ assigned_to:user.id,disposition:'Closed Won' }} drill={drill} />
          <Stat label="Gross Profit" value={fmt$(own?.gp||0)} color="#f59e0b" sub={t?.gp_target?gpPct+'% of target':null} filters={{ assigned_to:user.id,disposition:'Closed Won' }} drill={drill} />
        </div>
        {(own?.revByMonth||[]).length>0&&(
          <div style={{ background:'var(--card)',borderRadius:14,border:'1px solid var(--border)',padding:'16px 20px' }}>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:14,color:'var(--text)',marginBottom:12 }}>Revenue & GP — Last 6 Months</div>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={own.revByMonth} barSize={10} barGap={3}>
                <XAxis dataKey="month" tick={{ fontSize:11,fill:'var(--text-3)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:11,fill:'var(--text-3)' }} axisLine={false} tickLine={false} tickFormatter={v=>'$'+(v/1000).toFixed(0)+'k'} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="revenue" name="Revenue" fill={BRAND+'80'} radius={[4,4,0,0]} />
                <Bar dataKey="gp" name="GP" fill="#10b981" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>

      {/* ══ 2. TEAM PERFORMANCE ═══════════════════════════════ */}
      <Section title="Team Performance" icon="👥">
        <div style={{ background:'var(--card)',borderRadius:14,border:'1px solid var(--border)',overflow:'hidden' }}>
          <table style={{ width:'100%',borderCollapse:'collapse',fontSize:13 }}>
            <thead><tr style={{ background:'var(--card-2)' }}>
              {['AE','Total','Won','Win Rate','Revenue','GP','Q GP Target',''].map(h=>(
                <th key={h} style={{ textAlign:'left',padding:'10px 14px',fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.06em' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {(team?.aes||[]).sort((a,b)=>b.won-a.won).map((ae,i)=>{
                const gpP = ae.target?.gp_target>0?Math.min(100,Math.round((ae.gp||0)/ae.target.gp_target*100)):null
                return (
                  <tr key={ae.id} style={{ borderBottom:'1px solid var(--border)',cursor:'pointer',transition:'background 0.1s' }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--brand-dim)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                    onClick={()=>drill(ae.name+"'s Inquiries",{assigned_to:ae.id})}>
                    <td style={{ padding:'12px 14px',fontWeight:700,color:'var(--text)' }}>{ae.name}</td>
                    <td style={{ padding:'12px 14px',color:'var(--text-2)' }}>{ae.total}</td>
                    <td style={{ padding:'12px 14px',fontWeight:700,color:'#10b981' }}>{ae.won}</td>
                    <td style={{ padding:'12px 14px' }}>
                      <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                        <div style={{ width:50,height:5,background:'var(--card-2)',borderRadius:99 }}><div style={{ height:'100%',width:ae.winRate+'%',background:ae.winRate>=70?'#10b981':ae.winRate>=50?BRAND:'#f59e0b',borderRadius:99 }} /></div>
                        <span style={{ fontSize:12,fontWeight:700,color:ae.winRate>=70?'#10b981':ae.winRate>=50?BRAND:'#f59e0b' }}>{ae.winRate}%</span>
                      </div>
                    </td>
                    <td style={{ padding:'12px 14px',fontWeight:600,color:'var(--text)' }}>{fmt$(ae.revenue||0)}</td>
                    <td style={{ padding:'12px 14px',fontWeight:700,color:'#10b981' }}>{fmt$(ae.gp||0)}</td>
                    <td style={{ padding:'12px 14px' }}>
                      {gpP!==null?(<div style={{ display:'flex',alignItems:'center',gap:6 }}><div style={{ width:50,height:5,background:'var(--card-2)',borderRadius:99 }}><div style={{ height:'100%',width:gpP+'%',background:gpP>=100?'#10b981':BRAND,borderRadius:99 }} /></div><span style={{ fontSize:11,color:'var(--text-3)' }}>{gpP}%</span></div>)
                      :<span style={{ fontSize:11,color:'var(--text-4)' }}>No target</span>}
                    </td>
                    <td style={{ padding:'12px 14px' }} onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>setTargetModal({ae,existing:ae.target})} style={{ fontSize:11,color:BRAND,background:BRAND+'10',border:'1px solid '+BRAND+'30',borderRadius:8,padding:'4px 10px',cursor:'pointer',fontFamily:'inherit' }}>{ae.target?'Edit':'+ Target'}</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ══ 3. LEADS ════════════════════════════════════════ */}
      <Section title="Leads" icon="◎">
        <div style={{ display:'flex',gap:8,flexWrap:'wrap',padding:'12px 14px',background:'var(--card)',borderRadius:12,border:'1px solid var(--border)',marginBottom:14 }}>
          <select value={leadF.disposition} onChange={e=>setLeadF(f=>({...f,disposition:e.target.value}))} style={SEL}>
            <option value="">All Dispositions</option>
            {(leads?.byDisposition||[]).map(d=><option key={d.disposition} value={d.disposition}>{d.disposition}</option>)}
          </select>
          <select value={leadF.source} onChange={e=>setLeadF(f=>({...f,source:e.target.value}))} style={SEL}>
            <option value="">All Sources</option>
            {(leads?.bySource||[]).map(s=><option key={s.source} value={s.source}>{s.source}</option>)}
          </select>
          <select value={leadF.ae} onChange={e=>setLeadF(f=>({...f,ae:e.target.value}))} style={SEL}>
            <option value="">All AEs</option>
            {(leads?.byAE||[]).map(a=><option key={a.name} value={a.name}>{a.name}</option>)}
          </select>
          {(leadF.disposition||leadF.source||leadF.ae)&&<button onClick={()=>setLeadF({disposition:'',source:'',ae:''})} style={{ padding:'7px 12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--card)',color:'var(--text-3)',fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>x Clear</button>}
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:12,marginBottom:16 }}>
          <Stat label="Total" value={leads?.total||0} filters={{ type:'lead',...(leadF.disposition?{disposition:leadF.disposition}:{}) }} drill={drill} />
          <Stat label="Closed Won" value={leads?.won||0} color="#10b981" sub={(leads?.winRate||0)+'%'} filters={{ type:'lead',disposition:'Closed Won' }} drill={drill} />
          <Stat label="Closed Lost" value={leads?.lost||0} color="#ef4444" filters={{ type:'lead',disposition:'Closed Lost' }} drill={drill} />
          <Stat label="In Progress" value={leads?.active||0} color={BRAND} filters={{ type:'lead' }} drill={drill} />
          <Stat label="Fake Leads" value={leads?.fake||0} color="#94a3b8" filters={{ type:'lead',disposition:'Fake Lead' }} drill={drill} />
          <Stat label="Win Rate" value={(leads?.winRate||0)+'%'} color={leads?.winRate>=60?'#10b981':leads?.winRate>=40?BRAND:'#f59e0b'} />
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14 }}>
          <div style={{ background:'var(--card)',borderRadius:14,border:'1px solid var(--border)',padding:'16px 18px' }}>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:14,color:'var(--text)',marginBottom:12 }}>By Source</div>
            <BarList items={leads?.bySource||[]} labelKey="source" valueKey="count" onDrill={(val)=>drill('Leads — '+val,{type:'lead',lead_source:val})} />
          </div>
          <div style={{ background:'var(--card)',borderRadius:14,border:'1px solid var(--border)',padding:'16px 18px' }}>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:14,color:'var(--text)',marginBottom:12 }}>By Disposition</div>
            <BarList items={leads?.byDisposition||[]} labelKey="disposition" valueKey="count" onDrill={(val)=>drill('Leads — '+val,{type:'lead',disposition:val})} />
          </div>
        </div>
        <div style={{ background:'var(--card)',borderRadius:14,border:'1px solid var(--border)',padding:'16px 18px',marginTop:14 }}>
          <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:14,color:'var(--text)',marginBottom:12 }}>By AE</div>
          <table style={{ width:'100%',borderCollapse:'collapse',fontSize:13 }}>
            <thead><tr style={{ background:'var(--card-2)' }}>{['AE','Total','Won','Win Rate'].map(h=><th key={h} style={{ textAlign:'left',padding:'8px 12px',fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase' }}>{h}</th>)}</tr></thead>
            <tbody>{(leads?.byAE||[]).map((ae,i)=>(
              <tr key={ae.name} onClick={()=>drill(ae.name+' — Leads',{type:'lead',assigned_to:ae.id||''})} style={{ borderBottom:'1px solid var(--border)',cursor:'pointer' }}
                onMouseEnter={e=>e.currentTarget.style.background='var(--brand-dim)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <td style={{ padding:'8px 12px',fontWeight:600,color:'var(--text)' }}>{ae.name}</td>
                <td style={{ padding:'8px 12px',color:'var(--text-2)' }}>{ae.total}</td>
                <td style={{ padding:'8px 12px',fontWeight:700,color:'#10b981' }}>{ae.won}</td>
                <td style={{ padding:'8px 12px',fontWeight:700,color:ae.total>0&&Math.round(ae.won/ae.total*100)>=60?'#10b981':BRAND }}>{ae.total>0?Math.round(ae.won/ae.total*100):0}%</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Section>

      {/* ══ 4. REPEAT ═══════════════════════════════════════ */}
      <Section title="Repeat Inquiries" icon="↻">
        <div style={{ display:'flex',gap:8,flexWrap:'wrap',padding:'12px 14px',background:'var(--card)',borderRadius:12,border:'1px solid var(--border)',marginBottom:14 }}>
          <select value={repF.disposition} onChange={e=>setRepF(f=>({...f,disposition:e.target.value}))} style={SEL}>
            <option value="">All Dispositions</option>
            {(repeats?.byDisposition||[]).map(d=><option key={d.disposition} value={d.disposition}>{d.disposition}</option>)}
          </select>
          {repF.disposition&&<button onClick={()=>setRepF({disposition:''})} style={{ padding:'7px 12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--card)',color:'var(--text-3)',fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>x Clear</button>}
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:12,marginBottom:16 }}>
          <Stat label="Total" value={repeats?.total||0} filters={{ type:'repeat' }} drill={drill} />
          <Stat label="Closed Won" value={repeats?.won||0} color="#10b981" sub={(repeats?.winRate||0)+'%'} filters={{ type:'repeat',disposition:'Closed Won' }} drill={drill} />
          <Stat label="Closed Lost" value={repeats?.lost||0} color="#ef4444" filters={{ type:'repeat',disposition:'Closed Lost' }} drill={drill} />
          <Stat label="In Progress" value={repeats?.active||0} color={BRAND} filters={{ type:'repeat' }} drill={drill} />
          <Stat label="Win Rate" value={(repeats?.winRate||0)+'%'} color={repeats?.winRate>=70?'#10b981':BRAND} />
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14 }}>
          <div style={{ background:'var(--card)',borderRadius:14,border:'1px solid var(--border)',padding:'16px 18px' }}>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:14,color:'var(--text)',marginBottom:12 }}>Top Customers</div>
            <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
              {(repeats?.topCustomers||[]).slice(0,8).map((c,i)=>(
                <div key={c.name} onClick={()=>drill('Repeats — '+c.name,{type:'repeat',search:c.name})} style={{ display:'flex',alignItems:'center',gap:10,cursor:'pointer',padding:'5px 8px',borderRadius:8 }}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--card-2)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <span style={{ fontSize:11,fontWeight:700,color:'var(--text-4)',width:18 }}>#{i+1}</span>
                  <div style={{ flex:1,minWidth:0 }}><div style={{ fontSize:12,fontWeight:600,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{c.name}</div>
                  {c.company&&<div style={{ fontSize:11,color:'var(--text-3)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{c.company}</div>}</div>
                  <span style={{ fontSize:12,fontWeight:700,color:BRAND,flexShrink:0 }}>{c.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background:'var(--card)',borderRadius:14,border:'1px solid var(--border)',padding:'16px 18px' }}>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:14,color:'var(--text)',marginBottom:12 }}>Top Reps</div>
            <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
              {(repeats?.topReps||[]).slice(0,8).map((r,i)=>(
                <div key={r.name} onClick={()=>drill(r.name+' — Repeats',{type:'repeat',assigned_to:r.id})} style={{ display:'flex',alignItems:'center',gap:10,cursor:'pointer',padding:'5px 8px',borderRadius:8 }}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--card-2)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <span style={{ fontSize:11,fontWeight:700,color:'var(--text-4)',width:18 }}>#{i+1}</span>
                  <span style={{ flex:1,fontSize:12,fontWeight:600,color:'var(--text)' }}>{r.name}</span>
                  <span style={{ fontSize:12,fontWeight:700,color:BRAND,flexShrink:0 }}>{r.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background:'var(--card)',borderRadius:14,border:'1px solid var(--border)',padding:'16px 18px' }}>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:14,color:'var(--text)',marginBottom:12 }}>Top Companies</div>
            <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
              {(repeats?.topCompanies||[]).slice(0,8).map((c,i)=>(
                <div key={c.company} onClick={()=>drill('Repeats — '+c.company,{type:'repeat',search:c.company})} style={{ display:'flex',alignItems:'center',gap:10,cursor:'pointer',padding:'5px 8px',borderRadius:8 }}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--card-2)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <span style={{ fontSize:11,fontWeight:700,color:'var(--text-4)',width:18 }}>#{i+1}</span>
                  <span style={{ flex:1,fontSize:12,fontWeight:600,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{c.company}</span>
                  <span style={{ fontSize:12,fontWeight:700,color:BRAND,flexShrink:0 }}>{c.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ══ 5. ORDERS ════════════════════════════════════════ */}
      <Section title="Online Orders" icon="◈">
        <div style={{ display:'flex',gap:8,flexWrap:'wrap',padding:'12px 14px',background:'var(--card)',borderRadius:12,border:'1px solid var(--border)',marginBottom:14 }}>
          <select value={ordF.disposition} onChange={e=>setOrdF(f=>({...f,disposition:e.target.value}))} style={SEL}>
            <option value="">All Statuses</option>
            {(orders?.byDisposition||[]).map(d=><option key={d.disposition} value={d.disposition}>{d.disposition}</option>)}
          </select>
          {ordF.disposition&&<button onClick={()=>setOrdF({disposition:''})} style={{ padding:'7px 12px',borderRadius:10,border:'1px solid var(--border)',background:'var(--card)',color:'var(--text-3)',fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>x Clear</button>}
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:12,marginBottom:16 }}>
          <Stat label="Total" value={orders?.total||0} filters={{ type:'online_order',...(ordF.disposition?{disposition:ordF.disposition}:{}) }} drill={drill} />
          <Stat label="Processed" value={orders?.processed||0} color="#10b981" sub={(orders?.processRate||0)+'%'} filters={{ type:'online_order',disposition:'Processed' }} drill={drill} />
          <Stat label="Cancelled" value={orders?.cancelled||0} color="#ef4444" filters={{ type:'online_order',disposition:'Cancelled' }} drill={drill} />
          <Stat label="In Progress" value={orders?.active||0} color={BRAND} filters={{ type:'online_order' }} drill={drill} />
          <Stat label="Total Value" value={fmt$(orders?.totalValue||0)} color="#10b981" filters={{ type:'online_order',disposition:'Processed' }} drill={drill} />
          <Stat label="Avg Value" value={fmt$(orders?.avgValue||0)} color={BRAND} />
          <Stat label="Verified" value={orders?.verified||0} color="#10b981" filters={{ type:'online_order' }} drill={drill} />
          <Stat label="Unverified" value={orders?.notVerified||0} color="#f59e0b" filters={{ type:'online_order' }} drill={drill} />
        </div>
        <div style={{ background:'var(--card)',borderRadius:14,border:'1px solid var(--border)',padding:'16px 18px' }}>
          <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:14,color:'var(--text)',marginBottom:12 }}>By AE</div>
          <table style={{ width:'100%',borderCollapse:'collapse',fontSize:13 }}>
            <thead><tr style={{ background:'var(--card-2)' }}>{['AE','Total','Processed','Rate'].map(h=><th key={h} style={{ textAlign:'left',padding:'8px 12px',fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase' }}>{h}</th>)}</tr></thead>
            <tbody>{(orders?.byAE||[]).map((ae,i)=>(
              <tr key={ae.name} onClick={()=>drill(ae.name+' — Orders',{type:'online_order'})} style={{ borderBottom:'1px solid var(--border)',cursor:'pointer' }}
                onMouseEnter={e=>e.currentTarget.style.background='var(--brand-dim)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <td style={{ padding:'8px 12px',fontWeight:600,color:'var(--text)' }}>{ae.name}</td>
                <td style={{ padding:'8px 12px',color:'var(--text-2)' }}>{ae.total}</td>
                <td style={{ padding:'8px 12px',fontWeight:700,color:'#10b981' }}>{ae.processed}</td>
                <td style={{ padding:'8px 12px',fontWeight:700,color:ae.total>0&&Math.round(ae.processed/ae.total*100)>=80?'#10b981':BRAND }}>{ae.total>0?Math.round(ae.processed/ae.total*100):0}%</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Section>

      {drilldown&&<DrilldownModal title={drilldown.title} filters={drilldown.filters} onClose={()=>setDrilldown(null)} />}
      {targetModal&&<SetTargetModal ae={targetModal.ae} existing={targetModal.existing} onClose={()=>setTargetModal(null)} onSaved={()=>{setTargetModal(null);load()}} />}
    </div>
  )
}
