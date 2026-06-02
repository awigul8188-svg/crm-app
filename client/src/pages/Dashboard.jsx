import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts'
import { useAuth } from '../App'
import { useNav } from '../App'

// ── Design tokens (Atlantix light palette) ────────────────────
const BRAND  = '#1FC9BE'
const INK    = '#0E1525'
const BLUE   = '#1361FF'
const CORAL  = '#FF7466'
const PURPLE = '#6F66F0'
const PALETTE= ['#1FC9BE','#1361FF','#6F66F0','#FF7466','#FFB266','#0E807A','#0A4FE0','#4C44C0','#C2453A','#525866']
const T = () => localStorage.getItem('crm_token')
const fmt$ = v => v>=1000000?`$${(v/1000000).toFixed(1)}m`:v>=1000?`$${(v/1000).toFixed(1)}k`:`$${Math.round(v||0)}`

// ── Helpers ───────────────────────────────────────────────────
function Avatar({ name, size=28, tone='neutral' }) {
  const initials = (name||'?').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()
  const tones = { neutral:{bg:'#F3F3EF',fg:'#525866'}, brand:{bg:'#E8F8F2',fg:'#0E807A'}, blue:{bg:'#E6F0FF',fg:'#0A4FE0'} }
  const t = tones[tone]||tones.neutral
  return <span style={{ width:size,height:size,borderRadius:size,background:t.bg,color:t.fg,flexShrink:0,display:'inline-flex',alignItems:'center',justifyContent:'center',fontWeight:600,fontSize:Math.round(size*0.38),letterSpacing:'0.02em' }}>{initials}</span>
}
function Pill({ children, tone='neutral', size='sm' }) {
  const tones = { neutral:{bg:'#F3F3EF',fg:'#525866',bd:'#E5E5DE'}, brand:{bg:'#E8F8F2',fg:'#0E807A',bd:'#B8EFE9'}, success:{bg:'#E8F8F2',fg:'#0E807A',bd:'#B8EFE9'}, warn:{bg:'#FFF3E6',fg:'#A55B16',bd:'#FFD7B8'}, danger:{bg:'#FFEDEB',fg:'#C2453A',bd:'#FFCFCB'}, info:{bg:'#E6F0FF',fg:'#0A4FE0',bd:'#C7DBFF'}, purple:{bg:'#EFEEFE',fg:'#4C44C0',bd:'#D9D6FB'} }
  const t = tones[tone]||tones.neutral
  return <span style={{ display:'inline-flex',alignItems:'center',gap:4,background:t.bg,color:t.fg,border:`1px solid ${t.bd}`,fontSize:size==='xs'?10:11,fontWeight:600,padding:size==='xs'?'1px 6px':'2px 8px',borderRadius:999,whiteSpace:'nowrap' }}>{children}</span>
}
function SectionHeader({ children }) {
  return <div style={{ fontSize:11,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:12,marginTop:22,display:'flex',alignItems:'center',gap:8 }}>{children}<span style={{ flex:1,height:1,background:'#ECEAE3' }} /></div>
}
function Tip({ active, payload, label }) {
  if (!active||!payload?.length) return null
  return <div style={{ background:'#fff',border:'1px solid #ECEAE3',borderRadius:10,padding:'8px 12px',fontSize:12,boxShadow:'0 4px 12px rgba(0,0,0,0.08)' }}>
    <div style={{ color:'#9CA3AF',marginBottom:4,fontSize:11 }}>{label}</div>
    {payload.map(p=><div key={p.name} style={{ color:p.color||BRAND,display:'flex',gap:8,justifyContent:'space-between' }}><span>{p.name}</span><b>{p.value}</b></div>)}
  </div>
}

// ── Stat card ─────────────────────────────────────────────────
function Stat({ label, value, color=INK, sub, delta, onClick }) {
  const [hover,setHover] = useState(false)
  return (
    <div onClick={onClick} onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      style={{ background:'#fff',borderRadius:18,padding:'18px 20px',border:`1px solid ${hover&&onClick?color:'#ECEAE3'}`,cursor:onClick?'pointer':'default',transition:'all 0.15s',boxShadow:hover&&onClick?`0 4px 16px ${color}20`:'none',position:'relative',overflow:'hidden' }}>
      <div style={{ position:'absolute',top:0,left:0,width:3,height:'100%',background:color,borderRadius:'2px 0 0 2px' }} />
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10 }}>
        <span style={{ fontSize:11,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'0.08em' }}>{label}</span>
      </div>
      <div style={{ fontFamily:'"Poppins",sans-serif',fontWeight:700,fontSize:28,color:INK,letterSpacing:'-0.03em',lineHeight:1,marginBottom:5 }}>{typeof value==='number'?value.toLocaleString():value}</div>
      <div style={{ display:'flex',alignItems:'center',gap:6,fontSize:11,color:'#9CA3AF' }}>
        {delta&&<span style={{ color,fontWeight:600 }}>{delta}</span>}
        {sub&&<span>{sub}</span>}
      </div>
    </div>
  )
}

// ── Disposition tile ──────────────────────────────────────────
function DisTile({ label, value, pct, color, onClick }) {
  const [h,setH] = useState(false)
  return (
    <div onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{ background:h?`${color}06`:'#FBFBF8',border:`1px solid ${h?color:'#ECEAE3'}`,borderRadius:12,padding:'12px 14px',cursor:'pointer',transition:'all 0.15s' }}>
      <div style={{ fontSize:11,color:'#9CA3AF',fontWeight:500,marginBottom:6,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{label}</div>
      <div style={{ fontFamily:'"Poppins",sans-serif',fontWeight:700,fontSize:22,color:INK,letterSpacing:'-0.02em',lineHeight:1 }}>{value.toLocaleString()}</div>
      <div style={{ height:3,background:'#ECEAE3',borderRadius:99,marginTop:8 }}>
        <div style={{ height:'100%',background:color,borderRadius:99,width:`${pct}%`,transition:'width 0.5s' }} />
      </div>
      <div style={{ fontSize:10,color:'#9CA3AF',marginTop:4 }}>{pct}% of total</div>
    </div>
  )
}

// ── Top list card ─────────────────────────────────────────────
function TopListCard({ title, data=[], accent, onDrill }) {
  const max = data[0]?.count||1
  return (
    <div style={{ background:'#fff',borderRadius:18,border:'1px solid #ECEAE3',padding:'22px 24px' }}>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14 }}>
        <h3 style={{ fontFamily:'"Poppins",sans-serif',fontSize:15,fontWeight:700,margin:0,letterSpacing:'-0.01em' }}>{title}</h3>
      </div>
      <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
        {data.slice(0,8).map((d,i)=>(
          <div key={d.name||d.company} onClick={()=>onDrill&&onDrill(d)} style={{ display:'flex',alignItems:'center',gap:10,cursor:onDrill?'pointer':'default' }}>
            <span style={{ display:'inline-flex',alignItems:'center',justifyContent:'center',width:22,height:22,borderRadius:6,background:i===0?accent:'#F3F3EF',color:i===0?'#fff':'#525866',fontFamily:'"Poppins",sans-serif',fontWeight:700,fontSize:11,flexShrink:0 }}>{i+1}</span>
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ display:'flex',justifyContent:'space-between',marginBottom:3 }}>
                <span style={{ fontSize:12,fontWeight:600,color:INK,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{d.name||d.company}</span>
                <span style={{ fontSize:12,fontWeight:700,color:i===0?accent:INK,flexShrink:0 }}>{d.count}</span>
              </div>
              <div style={{ height:3,background:'#F3F3EF',borderRadius:99 }}>
                <div style={{ height:'100%',background:i===0?accent:'#D1D5DB',borderRadius:99,width:`${(d.count/max)*100}%`,transition:'width 0.5s' }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Multi-select chip ─────────────────────────────────────────
function MultiChip({ placeholder, options=[], selected=[], onChange }) {
  const [open,setOpen] = useState(false)
  const ref = useRef()
  useEffect(()=>{
    const h = e => { if(ref.current&&!ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown',h)
    return ()=>document.removeEventListener('mousedown',h)
  },[])
  const toggle = v => onChange(selected.includes(v)?selected.filter(x=>x!==v):[...selected,v])
  const active = selected.length > 0
  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={()=>setOpen(!open)} style={{ padding:'6px 12px',borderRadius:9,background:active?'#E8F8F2':'#fff',border:`1px solid ${active?'#B8EFE9':'#E5E5DE'}`,color:active?'#0E807A':'#525866',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',display:'inline-flex',alignItems:'center',gap:6 }}>
        {active?`${placeholder} · ${selected.length}`:placeholder}
        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {open&&(
        <div style={{ position:'absolute',top:'calc(100% + 4px)',left:0,zIndex:500,background:'#fff',borderRadius:12,border:'1px solid #ECEAE3',boxShadow:'0 12px 32px rgba(15,17,23,0.10)',minWidth:200,maxHeight:260,overflowY:'auto',padding:6 }}>
          {options.map(o=>{
            const v = typeof o==='object'?o.value:o
            const l = typeof o==='object'?o.label:o
            const sel = selected.includes(v)
            return (
              <div key={v} onClick={()=>toggle(v)} style={{ padding:'7px 10px',borderRadius:7,cursor:'pointer',fontSize:12,color:INK,display:'flex',alignItems:'center',gap:8,background:sel?'#E8F8F2':'transparent' }}
                onMouseEnter={e=>{if(!sel)e.currentTarget.style.background='#FBFBF8'}} onMouseLeave={e=>{if(!sel)e.currentTarget.style.background='transparent'}}>
                <span style={{ width:14,height:14,borderRadius:4,border:`1.5px solid ${sel?BRAND:'#CBD5E1'}`,background:sel?BRAND:'#fff',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                  {sel&&<svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3}><path d="M5 12l4 4 10-10"/></svg>}
                </span>
                {l}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Segmented ─────────────────────────────────────────────────
function Segmented({ value, onChange, options }) {
  return (
    <div style={{ display:'inline-flex',background:'#F3F3EF',padding:3,borderRadius:10,gap:2 }}>
      {options.map(o=>{
        const active = value===o.value
        return <button key={o.value} onClick={()=>onChange(o.value)} style={{ padding:'5px 12px',borderRadius:8,border:'none',background:active?'#fff':'transparent',color:active?INK:'#9CA3AF',fontSize:12,fontWeight:active?600:500,cursor:'pointer',fontFamily:'inherit',boxShadow:active?'0 1px 3px rgba(0,0,0,0.08)':'none',transition:'all 0.12s' }}>{o.label}</button>
      })}
    </div>
  )
}

// ── Set Target Modal ──────────────────────────────────────────
function SetTargetModal({ ae, existing, onClose, onSaved }) {
  const now = new Date()
  const [form,setForm] = useState({ year:existing?.year||now.getFullYear(), quarter:existing?.quarter||Math.ceil((now.getMonth()+1)/3), gp_target:existing?.gp_target||'', revenue_target:existing?.revenue_target||'', leads_target:existing?.leads_target||'', repeat_target:existing?.repeat_target||'', orders_target:existing?.orders_target||'' })
  const [saving,setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    await fetch('/api/analytics/targets',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+T()},body:JSON.stringify({ae_id:ae.id,...form})})
    setSaving(false); onSaved()
  }
  const inp = { width:'100%',boxSizing:'border-box',background:'#FBFBF8',border:'1px solid #ECEAE3',borderRadius:10,padding:'9px 13px',fontSize:13,color:INK,fontFamily:'inherit',outline:'none' }
  return createPortal(
    <div onClick={onClose} style={{ position:'fixed',inset:0,zIndex:99999,background:'rgba(14,21,37,0.5)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#fff',borderRadius:20,boxShadow:'0 24px 80px rgba(0,0,0,0.15)',width:'100%',maxWidth:440,fontFamily:'inherit' }}>
        <div style={{ padding:'20px 24px',borderBottom:'1px solid #ECEAE3' }}>
          <div style={{ fontFamily:'"Poppins",sans-serif',fontWeight:700,fontSize:16,color:INK }}>Set Target — {ae.name}</div>
          <div style={{ fontSize:12,color:'#9CA3AF',marginTop:3 }}>GP is the primary tracked metric</div>
        </div>
        <div style={{ padding:'20px 24px',display:'flex',flexDirection:'column',gap:12 }}>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
            <div><div style={{ fontSize:11,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6 }}>Year</div>
              <select value={form.year} onChange={e=>setForm(f=>({...f,year:parseInt(e.target.value)}))} style={{ ...inp,cursor:'pointer' }}>{[2024,2025,2026,2027].map(y=><option key={y}>{y}</option>)}</select></div>
            <div><div style={{ fontSize:11,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6 }}>Quarter</div>
              <select value={form.quarter} onChange={e=>setForm(f=>({...f,quarter:parseInt(e.target.value)}))} style={{ ...inp,cursor:'pointer' }}>{[1,2,3,4].map(q=><option key={q} value={q}>Q{q}</option>)}</select></div>
          </div>
          <div>
            <div style={{ fontSize:11,fontWeight:700,color:'#0E807A',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6 }}>GP Target ($) ★</div>
            <input value={form.gp_target} onChange={e=>setForm(f=>({...f,gp_target:e.target.value}))} placeholder="e.g. 50000" style={inp} type="number" />
          </div>
          <div>
            <div style={{ fontSize:11,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6 }}>Revenue Target ($)</div>
            <input value={form.revenue_target} onChange={e=>setForm(f=>({...f,revenue_target:e.target.value}))} placeholder="e.g. 150000" style={inp} type="number" />
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10 }}>
            {[['Leads','leads_target'],['Repeats','repeat_target'],['Orders','orders_target']].map(([l,k])=>(
              <div key={k}><div style={{ fontSize:11,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6 }}>{l}</div>
                <input value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} placeholder="0" style={inp} type="number" /></div>
            ))}
          </div>
          <div style={{ display:'flex',gap:10,marginTop:4 }}>
            <button onClick={save} disabled={saving} style={{ flex:1,padding:'12px',borderRadius:12,border:'none',background:saving?'#F3F3EF':BRAND,color:saving?'#9CA3AF':'#fff',fontWeight:700,fontSize:14,cursor:saving?'not-allowed':'pointer',fontFamily:'inherit' }}>{saving?'Saving…':'Save Target'}</button>
            <button onClick={onClose} style={{ padding:'12px 18px',borderRadius:12,border:'1px solid #ECEAE3',background:'#fff',color:'#525866',cursor:'pointer',fontFamily:'inherit' }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>, document.body
  )
}

// ── Drilldown Modal ───────────────────────────────────────────
function DrilldownModal({ title, filters, onClose }) {
  const { navigate } = useNav()
  const [rows,setRows] = useState([]); const [loading,setLoading] = useState(true)
  useEffect(()=>{
    const p = new URLSearchParams(); Object.entries(filters||{}).forEach(([k,v])=>{ if(v) p.set(k,v) })
    fetch('/api/inquiries?'+p,{headers:{Authorization:'Bearer '+T()}}).then(r=>r.json()).then(d=>{setRows(Array.isArray(d)?d:[]);setLoading(false)}).catch(()=>setLoading(false))
  },[])
  const tc = { lead:BLUE, repeat:PURPLE, online_order:CORAL }
  return createPortal(
    <div onClick={onClose} style={{ position:'fixed',inset:0,zIndex:99999,background:'rgba(14,21,37,0.5)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#fff',borderRadius:20,boxShadow:'0 24px 80px rgba(0,0,0,0.15)',width:'100%',maxWidth:920,maxHeight:'88vh',display:'flex',flexDirection:'column',fontFamily:'inherit' }}>
        <div style={{ padding:'18px 24px',borderBottom:'1px solid #ECEAE3',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0 }}>
          <div>
            <div style={{ fontFamily:'"Poppins",sans-serif',fontWeight:700,fontSize:16,color:INK }}>{title}</div>
            <div style={{ fontSize:12,color:'#9CA3AF',marginTop:2 }}>{loading?'Loading…':`${rows.length} records — click to open`}</div>
          </div>
          <button onClick={onClose} style={{ width:32,height:32,borderRadius:10,border:'1px solid #ECEAE3',background:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#9CA3AF',fontSize:18 }}>×</button>
        </div>
        <div style={{ overflowY:'auto',flex:1 }}>
          {loading?(<div style={{ display:'flex',alignItems:'center',justifyContent:'center',padding:60 }}><div style={{ width:24,height:24,borderRadius:'50%',border:'2px solid '+BRAND,borderTopColor:'transparent',animation:'spin 0.8s linear infinite' }}/></div>)
          :!rows.length?(<div style={{ textAlign:'center',padding:60,color:'#9CA3AF' }}>No records found</div>):(
            <table style={{ width:'100%',borderCollapse:'collapse',fontSize:13 }}>
              <thead><tr style={{ background:'#FBFBF8',position:'sticky',top:0 }}>
                {['Date','Customer','Company','AE','Type','Disposition'].map(h=><th key={h} style={{ textAlign:'left',padding:'10px 16px',fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'0.08em',borderBottom:'1px solid #ECEAE3' }}>{h}</th>)}
              </tr></thead>
              <tbody>{rows.map((r,i)=>(
                <tr key={r.id} onClick={()=>{navigate('inquiry-detail',{id:r.id});onClose()}} style={{ borderTop:'1px solid #F2F1EC',cursor:'pointer',transition:'background 0.12s' }}
                  onMouseEnter={e=>e.currentTarget.style.background='#FBFBF8'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={{ padding:'12px 16px',color:'#9CA3AF',fontSize:11,whiteSpace:'nowrap' }}>{new Date(r.created_at).toLocaleDateString()}</td>
                  <td style={{ padding:'12px 16px',fontWeight:600,color:INK }}>{r.customer_name}</td>
                  <td style={{ padding:'12px 16px',color:'#6B7280',fontSize:12 }}>{r.customer_company||'—'}</td>
                  <td style={{ padding:'12px 16px' }}><div style={{ display:'flex',alignItems:'center',gap:6 }}><Avatar name={r.assigned_name} size={22} /><span style={{ fontSize:12,color:'#525866' }}>{(r.assigned_name||'—').split(' ')[0]}</span></div></td>
                  <td style={{ padding:'12px 16px' }}><span style={{ fontSize:11,fontWeight:600,color:tc[r.type]||'#9CA3AF',padding:'2px 8px',borderRadius:999,background:`${tc[r.type]||'#9CA3AF'}12` }}>{r.type==='online_order'?'Order':r.type==='lead'?'Lead':'Repeat'}</span></td>
                  <td style={{ padding:'12px 16px' }}>
                    <Pill tone={r.disposition==='Closed Won'||r.disposition==='Processed'?'success':r.disposition==='Closed Lost'||r.disposition==='Cancelled'?'danger':r.disposition==='Quoted'||r.disposition==='Bidding'?'info':'neutral'} size="xs">{r.disposition||'—'}</Pill>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>
    </div>, document.body
  )
}

// ── My Performance (own target + stats) ───────────────────────
function MyPerformance({ own, meta, onDrill, userId, onSetTarget }) {
  const t = own?.target
  const gpPct  = t?.gp_target>0  ? Math.min(100,Math.round((own.gp||0)/t.gp_target*100))     : 0
  const revPct = t?.revenue_target>0 ? Math.min(100,Math.round((own.revenue||0)/t.revenue_target*100)) : 0
  return (
    <div style={{ marginBottom:28 }}>
      {t ? (
        <div style={{ background:`linear-gradient(135deg, ${INK} 0%, #1A2138 100%)`,borderRadius:20,padding:'22px 24px',marginBottom:16,position:'relative',overflow:'hidden' }}>
          <div style={{ position:'absolute',top:-80,right:-40,width:200,height:200,borderRadius:'50%',background:`radial-gradient(circle,${BRAND}60 0%,transparent 65%)`,pointerEvents:'none' }} />
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16,position:'relative' }}>
            <div>
              <div style={{ fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:4 }}>Q{meta?.quarter} {meta?.year} Targets</div>
              <div style={{ fontFamily:'"Poppins",sans-serif',fontSize:12,color:'rgba(255,255,255,0.6)' }}>GP is your primary tracked metric</div>
            </div>
            <button onClick={onSetTarget} style={{ fontSize:11,color:BRAND,background:BRAND+'20',border:`1px solid ${BRAND}40`,borderRadius:8,padding:'5px 12px',cursor:'pointer',fontFamily:'inherit',fontWeight:600 }}>Edit Target</button>
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:16,position:'relative' }}>
            {t.gp_target>0&&(
              <div>
                <div style={{ display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:6 }}>
                  <span style={{ color:'rgba(255,255,255,0.5)' }}>GP Target</span>
                  <span style={{ color:'#fff',fontWeight:700 }}>{fmt$(own.gp||0)} <span style={{ color:'rgba(255,255,255,0.35)',fontWeight:400 }}>/ {fmt$(t.gp_target)}</span></span>
                </div>
                <div style={{ height:6,background:'rgba(255,255,255,0.12)',borderRadius:99 }}>
                  <div style={{ height:'100%',width:gpPct+'%',background:'#10b981',borderRadius:99,transition:'width 0.6s' }} />
                </div>
                <div style={{ fontSize:10,fontWeight:700,color:gpPct>=100?'#10b981':'#1FC9BE',marginTop:3 }}>{gpPct}%{gpPct>=100&&' ✓'}</div>
              </div>
            )}
            {t.revenue_target>0&&(
              <div>
                <div style={{ display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:6 }}>
                  <span style={{ color:'rgba(255,255,255,0.5)' }}>Revenue</span>
                  <span style={{ color:'#fff',fontWeight:700 }}>{fmt$(own.revenue||0)} <span style={{ color:'rgba(255,255,255,0.35)',fontWeight:400 }}>/ {fmt$(t.revenue_target)}</span></span>
                </div>
                <div style={{ height:6,background:'rgba(255,255,255,0.12)',borderRadius:99 }}>
                  <div style={{ height:'100%',width:revPct+'%',background:BRAND,borderRadius:99,transition:'width 0.6s' }} />
                </div>
                <div style={{ fontSize:10,fontWeight:700,color:BRAND,marginTop:3 }}>{revPct}%{revPct>=100&&' ✓'}</div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ background:'#fff',borderRadius:16,border:`2px dashed ${BRAND}60`,padding:'16px 20px',marginBottom:16,display:'flex',alignItems:'center',gap:14,cursor:'pointer' }} onClick={onSetTarget}>
          <span style={{ fontSize:24 }}>🎯</span>
          <div><div style={{ fontWeight:700,color:INK,fontSize:14 }}>No quarterly target set</div><div style={{ fontSize:13,color:'#9CA3AF' }}>Click to set your GP and revenue targets for Q{meta?.quarter}</div></div>
        </div>
      )}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(145px,1fr))',gap:12 }}>
        <Stat label="My Total" value={own?.total||0} color={INK} onClick={()=>onDrill('My Inquiries',{assigned_to:userId})} />
        <Stat label="Closed Won" value={own?.won||0} color="#0E807A" delta={`${own?.winRate||0}%`} sub="win rate" onClick={()=>onDrill('My Wins',{assigned_to:userId,disposition:'Closed Won'})} />
        <Stat label="Closed Lost" value={own?.lost||0} color="#C2453A" onClick={()=>onDrill('My Losses',{assigned_to:userId,disposition:'Closed Lost'})} />
        <Stat label="In Progress" value={own?.active||0} color={BLUE} onClick={()=>onDrill('My Pipeline',{assigned_to:userId})} />
        <Stat label="Revenue" value={fmt$(own?.revenue||0)} color="#0E807A" onClick={()=>onDrill('My Revenue',{assigned_to:userId,disposition:'Closed Won'})} />
        <Stat label="Gross Profit" value={(own?.gp||0)>0?fmt$(own.gp):'—'} color={BRAND} sub={(own?.gp||0)===0?'Tracking from new closes':t?.gp_target?gpPct+'% of target':null} />
      </div>
      {(own?.revByMonth||[]).length>0&&(
        <div style={{ background:'#fff',borderRadius:18,border:'1px solid #ECEAE3',padding:'20px 24px',marginTop:14 }}>
          <h3 style={{ fontFamily:'"Poppins",sans-serif',fontSize:15,fontWeight:700,margin:'0 0 14px',letterSpacing:'-0.01em' }}>Revenue & GP — Last 6 Months</h3>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={own.revByMonth} barSize={10} barGap={3}>
              <XAxis dataKey="month" tick={{ fontSize:11,fill:'#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:11,fill:'#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={v=>'$'+(v/1000).toFixed(0)+'k'} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="revenue" name="Revenue" fill={BRAND+'80'} radius={[4,4,0,0]} />
              <Bar dataKey="gp" name="GP" fill="#10b981" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ── Overview tab ─────────────────────────────────────────────
function OverviewTab({ data, onDrill }) {
  const { own, team, trend14=[], today={}, meta } = data
  const total = (trend14||[]).reduce((s,d)=>s+d.total,0)
  const won   = (trend14||[]).reduce((s,d)=>s+d.won,0)
  const winRate = total>0?Math.round(won/total*100):0
  return (
    <div>
      <div style={{ display:'grid',gridTemplateColumns:'1.3fr 1fr 1fr 1fr',gap:14,marginBottom:16 }}>
        {/* Hero */}
        <div style={{ background:`linear-gradient(135deg,${INK} 0%,#1A2138 100%)`,borderRadius:20,padding:'22px 24px',color:'#fff',position:'relative',overflow:'hidden' }}>
          <div style={{ position:'absolute',inset:0,opacity:0.05,backgroundImage:'radial-gradient(circle at 1px 1px,#fff 1px,transparent 0)',backgroundSize:'16px 16px',pointerEvents:'none' }} />
          <div style={{ position:'absolute',top:-80,right:-40,width:200,height:200,borderRadius:'50%',background:`radial-gradient(circle,${BRAND}80 0%,transparent 65%)`,pointerEvents:'none' }} />
          <div style={{ position:'relative' }}>
            <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:10 }}>
              <span style={{ width:6,height:6,borderRadius:99,background:BRAND,boxShadow:`0 0 10px ${BRAND}` }} />
              <span style={{ fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.55)',textTransform:'uppercase',letterSpacing:'0.14em' }}>Total activity</span>
            </div>
            <div style={{ fontFamily:'"Poppins",sans-serif',fontWeight:700,fontSize:52,lineHeight:1,letterSpacing:'-0.04em',marginBottom:8 }}>{total.toLocaleString()}</div>
            <div style={{ display:'flex',alignItems:'center',gap:6,fontSize:12,color:'rgba(255,255,255,0.55)' }}>
              <span style={{ background:`${BRAND}25`,color:BRAND,padding:'3px 8px',borderRadius:99,fontWeight:600,fontSize:11,border:`1px solid ${BRAND}30` }}>{winRate}% win</span>
              <span>{won} closed wins</span>
            </div>
          </div>
        </div>
        <Stat label="Leads" value={data.leads?.total||0} color={BLUE} delta={today?.leads>0?`+${today.leads} today`:null} onClick={()=>onDrill('All Leads',{type:'lead'})} />
        <Stat label="Repeat" value={data.repeats?.total||0} color={PURPLE} delta={today?.repeat>0?`+${today.repeat} today`:null} onClick={()=>onDrill('Repeat Inquiries',{type:'repeat'})} />
        <Stat label="Online Orders" value={data.orders?.total||0} color={CORAL} delta={today?.orders>0?`+${today.orders} today`:null} sub={fmt$(data.orders?.totalValue||0)+' value'} onClick={()=>onDrill('Online Orders',{type:'online_order'})} />
      </div>

      {/* Activity trend */}
      <div style={{ display:'grid',gridTemplateColumns:'1.6fr 1fr',gap:16,marginBottom:16 }}>
        <div style={{ background:'#fff',borderRadius:18,border:'1px solid #ECEAE3',padding:'22px 24px' }}>
          <h3 style={{ fontFamily:'"Poppins",sans-serif',fontSize:16,fontWeight:700,margin:'0 0 4px',letterSpacing:'-0.01em' }}>Activity trend</h3>
          <div style={{ fontSize:12,color:'#9CA3AF',marginBottom:14 }}>New inquiries per day, last 14 days</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={trend14} barSize={7} barGap={2}>
              <XAxis dataKey="date" tick={{ fontSize:9,fill:'#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={d=>d?.slice(5)} />
              <YAxis tick={{ fontSize:9,fill:'#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="lead" name="Leads" fill={BLUE} radius={[3,3,0,0]} stackId="a" />
              <Bar dataKey="repeat" name="Repeat" fill={PURPLE} radius={[0,0,0,0]} stackId="a" />
              <Bar dataKey="online_order" name="Orders" fill={CORAL} radius={[3,3,0,0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display:'flex',gap:14,justifyContent:'center',marginTop:8 }}>
            {[{label:'Leads',color:BLUE},{label:'Repeat',color:PURPLE},{label:'Orders',color:CORAL}].map(l=>(
              <div key={l.label} style={{ display:'flex',alignItems:'center',gap:5,fontSize:11,color:'#9CA3AF' }}>
                <span style={{ width:9,height:9,borderRadius:2,background:l.color }} />{l.label}
              </div>
            ))}
          </div>
        </div>
        <div style={{ background:'#fff',borderRadius:18,border:'1px solid #ECEAE3',padding:'22px 24px' }}>
          <h3 style={{ fontFamily:'"Poppins",sans-serif',fontSize:16,fontWeight:700,margin:'0 0 4px',letterSpacing:'-0.01em' }}>By team member</h3>
          <div style={{ fontSize:12,color:'#9CA3AF',marginBottom:16 }}>Total inquiries owned</div>
          <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
            {(team?.aes||[]).sort((a,b)=>b.total-a.total).slice(0,5).map((ae,i)=>{
              const max = Math.max(...(team?.aes||[]).map(a=>a.total),1)
              const pct = Math.round((ae.total/max)*100)
              return (
                <div key={ae.id} style={{ display:'flex',alignItems:'center',gap:10,cursor:'pointer' }} onClick={()=>onDrill(`${ae.name}'s inquiries`,{assigned_to:ae.id})}>
                  <Avatar name={ae.name} size={28} tone={i===0?'brand':'neutral'} />
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}>
                      <span style={{ fontSize:12,fontWeight:600,color:INK }}>{ae.name.split(' ')[0]}</span>
                      <span style={{ fontFamily:'"Poppins",sans-serif',fontSize:14,fontWeight:700,color:INK }}>{ae.total}</span>
                    </div>
                    <div style={{ height:4,background:'#F3F3EF',borderRadius:99,overflow:'hidden' }}>
                      <div style={{ height:'100%',background:PALETTE[i],width:pct+'%',transition:'width 0.5s' }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Team GP table */}
      <div style={{ background:'#fff',borderRadius:18,border:'1px solid #ECEAE3',overflow:'hidden',marginBottom:16 }}>
        <div style={{ padding:'20px 24px 14px',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
          <h3 style={{ fontFamily:'"Poppins",sans-serif',fontSize:16,fontWeight:700,margin:0,letterSpacing:'-0.01em' }}>Team performance</h3>
          <Pill tone="brand" size="xs">{(team?.aes||[]).length} reps</Pill>
        </div>
        <div style={{ borderTop:'1px solid #F2F1EC',overflowX:'auto' }}>
          <table style={{ width:'100%',borderCollapse:'collapse',fontSize:13 }}>
            <thead><tr style={{ background:'#FBFBF8' }}>
              {['Rep','Total','Won','Win Rate','Revenue','GP','Q GP Target',''].map(h=>(
                <th key={h} style={{ textAlign:h==='Rep'?'left':'center',padding:'10px 14px',fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'0.08em',whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {(team?.aes||[]).sort((a,b)=>b.won-a.won).map((ae,i)=>{
                const gpP = ae.target?.gp_target>0?Math.min(100,Math.round((ae.gp||0)/ae.target.gp_target*100)):null
                return (
                  <tr key={ae.id} onClick={()=>onDrill(`${ae.name}'s inquiries`,{assigned_to:ae.id})} style={{ borderTop:'1px solid #F2F1EC',cursor:'pointer',transition:'background 0.12s' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#FBFBF8'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{ padding:'14px' }}>
                      <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                        <Avatar name={ae.name} size={30} tone={i===0?'brand':'neutral'} />
                        <div><div style={{ fontSize:13,fontWeight:600,color:INK }}>{ae.name}</div><div style={{ fontSize:11,color:'#9CA3AF' }}>AE · #{i+1}</div></div>
                      </div>
                    </td>
                    <td style={{ padding:'14px',textAlign:'center',fontFamily:'"Poppins",sans-serif',fontWeight:700,fontSize:15 }}>{ae.total}</td>
                    <td style={{ padding:'14px',textAlign:'center',fontFamily:'"Poppins",sans-serif',fontWeight:700,color:'#0E807A' }}>{ae.won}</td>
                    <td style={{ padding:'14px',textAlign:'center' }}>
                      <span style={{ padding:'3px 10px',borderRadius:99,fontSize:11,fontWeight:700,background:ae.winRate>=20?'#E8F8F2':ae.winRate>=10?'#FFF3E6':'#FFEDEB',color:ae.winRate>=20?'#0E807A':ae.winRate>=10?'#A55B16':'#C2453A' }}>{ae.winRate}%</span>
                    </td>
                    <td style={{ padding:'14px',textAlign:'center',fontWeight:600,color:INK }}>{fmt$(ae.revenue||0)}</td>
                    <td style={{ padding:'14px',textAlign:'center',fontWeight:700,color:(ae.gp||0)>0?'#0E807A':'#9CA3AF' }}>{(ae.gp||0)>0?fmt$(ae.gp):'—'}</td>
                    <td style={{ padding:'14px',textAlign:'center' }}>
                      {gpP!==null?(<div style={{ display:'flex',alignItems:'center',gap:6,justifyContent:'center' }}><div style={{ width:50,height:4,background:'#F3F3EF',borderRadius:99 }}><div style={{ height:'100%',width:gpP+'%',background:gpP>=100?'#10b981':BRAND,borderRadius:99 }} /></div><span style={{ fontSize:11,color:'#9CA3AF' }}>{gpP}%</span></div>)
                      :<span style={{ fontSize:11,color:'#9CA3AF' }}>No target</span>}
                    </td>
                    <td style={{ padding:'14px',textAlign:'center' }} onClick={e=>e.stopPropagation()}>
                      <span data-set-target={ae.id} style={{ fontSize:11,color:BRAND,background:'#E8F8F2',border:'1px solid #B8EFE9',borderRadius:8,padding:'4px 10px',cursor:'pointer',fontWeight:600 }}>{ae.target?'Edit':'+ Target'}</span>
                    </td>
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

// ── Leads tab ─────────────────────────────────────────────────
function LeadsTab({ data, onDrill, filterDispositions, filterSources, filterUsers }) {
  const { leads, leadsAEBreakdown=[], today={} } = data
  if (!leads) return null
  return (
    <div>
      <SectionHeader>Today</SectionHeader>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:22 }}>
        <Stat label="Leads received" value={today?.leads||0} color={BLUE} sub="last 24h" />
        {(leadsAEBreakdown||[]).slice(0,3).map((ae,i)=>(
          <Stat key={ae.id} label={ae.name.split(' ')[0]+' today'} value={ae.today||0} color={PALETTE[i+1]} sub={`${ae.total} this period`} />
        ))}
      </div>

      <SectionHeader>Period summary</SectionHeader>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:12 }}>
        <Stat label="Total leads" value={leads.total||0} color={BLUE} onClick={()=>onDrill('All Leads',{type:'lead'})} />
        <Stat label="Closed Won" value={leads.won||0} color="#0E807A" delta={`${leads.winRate||0}%`} sub="win rate" onClick={()=>onDrill('Leads — Closed Won',{type:'lead',disposition:'Closed Won'})} />
        <Stat label="Closed Lost" value={leads.lost||0} color="#C2453A" onClick={()=>onDrill('Leads — Closed Lost',{type:'lead',disposition:'Closed Lost'})} />
        <Stat label="In progress" value={leads.active||0} color="#FFB266" />
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:22 }}>
        <Stat label="Quoted" value={(leads.byDisposition||[]).find(d=>d.disposition==='Quoted')?.count||0} color={PURPLE} onClick={()=>onDrill('Leads — Quoted',{type:'lead',disposition:'Quoted'})} />
        <Stat label="Bidding" value={(leads.byDisposition||[]).find(d=>d.disposition==='Bidding')?.count||0} color="#4C44C0" onClick={()=>onDrill('Leads — Bidding',{type:'lead',disposition:'Bidding'})} />
        <Stat label="Fake leads" value={leads.fake||0} color="#9CA3AF" onClick={()=>onDrill('Fake Leads',{type:'lead',disposition:'Fake Lead'})} />
        <Stat label="No response" value={(leads.byDisposition||[]).find(d=>d.disposition==='No response'||d.disposition==='No Response')?.count||0} color="#525866" onClick={()=>onDrill('No Response',{type:'lead',disposition:'No response'})} />
      </div>

      <div style={{ display:'grid',gridTemplateColumns:'1.5fr 1fr',gap:16,marginBottom:16 }}>
        <div style={{ background:'#fff',borderRadius:18,border:'1px solid #ECEAE3',padding:'22px 24px' }}>
          <h3 style={{ fontFamily:'"Poppins",sans-serif',fontSize:16,fontWeight:700,margin:'0 0 14px',letterSpacing:'-0.01em' }}>By lead source</h3>
          <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
            {(leads.bySource||[]).slice(0,8).map((s,i)=>{
              const max = leads.bySource[0]?.count||1
              return (
                <div key={s.source} onClick={()=>onDrill('Leads — '+s.source,{type:'lead',lead_source:s.source})} style={{ cursor:'pointer' }}>
                  <div style={{ display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4 }}>
                    <span style={{ color:'#525866',fontWeight:500 }}>{s.source}</span>
                    <span style={{ fontWeight:700,color:INK }}>{s.count}</span>
                  </div>
                  <div style={{ height:18,background:'#F3F3EF',borderRadius:6,overflow:'hidden',position:'relative' }}>
                    <div style={{ height:'100%',width:`${(s.count/max)*100}%`,background:PALETTE[i%PALETTE.length],borderRadius:6,display:'flex',alignItems:'center',justifyContent:'flex-end',paddingRight:8,fontSize:10,fontWeight:700,color:'#fff',transition:'width 0.5s' }}>
                      {s.count/max>0.2&&s.count}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div style={{ background:'#fff',borderRadius:18,border:'1px solid #ECEAE3',padding:'22px 24px' }}>
          <h3 style={{ fontFamily:'"Poppins",sans-serif',fontSize:16,fontWeight:700,margin:'0 0 14px',letterSpacing:'-0.01em' }}>By disposition</h3>
          <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
            {(leads.byDisposition||[]).slice(0,8).map((d,i)=>{
              const pct = leads.total>0?Math.round((d.count/leads.total)*100):0
              return (
                <div key={d.disposition} onClick={()=>onDrill('Leads — '+d.disposition,{type:'lead',disposition:d.disposition})} style={{ cursor:'pointer' }}>
                  <div style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}>
                    <span style={{ fontSize:12,fontWeight:500,color:'#525866' }}>{d.disposition}</span>
                    <span style={{ fontSize:12,fontWeight:700,color:INK }}>{d.count} <span style={{ color:'#9CA3AF',fontWeight:400 }}>· {pct}%</span></span>
                  </div>
                  <div style={{ height:4,background:'#F3F3EF',borderRadius:99 }}><div style={{ height:'100%',background:PALETTE[i%PALETTE.length],borderRadius:99,width:pct+'%',transition:'width 0.5s' }} /></div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Disposition tiles */}
      <div style={{ background:'#fff',borderRadius:18,border:'1px solid #ECEAE3',padding:'22px 24px',marginBottom:16 }}>
        <h3 style={{ fontFamily:'"Poppins",sans-serif',fontSize:16,fontWeight:700,margin:'0 0 4px',letterSpacing:'-0.01em' }}>Disposition breakdown</h3>
        <div style={{ fontSize:12,color:'#9CA3AF',marginBottom:16 }}>Click a tile to drill in</div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:10 }}>
          {(leads.byDisposition||[]).map((d,i)=>(
            <DisTile key={d.disposition} label={d.disposition} value={d.count} pct={leads.total>0?Math.round((d.count/leads.total)*100):0} color={PALETTE[i%PALETTE.length]} onClick={()=>onDrill('Leads — '+d.disposition,{type:'lead',disposition:d.disposition})} />
          ))}
        </div>
      </div>

      {/* AE performance table */}
      <div style={{ background:'#fff',borderRadius:18,border:'1px solid #ECEAE3',overflow:'hidden' }}>
        <div style={{ padding:'22px 24px 14px',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
          <div>
            <h3 style={{ fontFamily:'"Poppins",sans-serif',fontSize:16,fontWeight:700,margin:0,letterSpacing:'-0.01em' }}>AE performance</h3>
            <div style={{ fontSize:12,color:'#9CA3AF',marginTop:2 }}>Click any row to view their leads</div>
          </div>
          <Pill tone="brand" size="xs">{(leadsAEBreakdown||[]).length} reps</Pill>
        </div>
        <div style={{ overflowX:'auto',borderTop:'1px solid #F2F1EC' }}>
          <table style={{ width:'100%',borderCollapse:'collapse',fontSize:13 }}>
            <thead><tr style={{ background:'#FBFBF8' }}>
              {['Rep','Total','Today','Won','Lost','Quoted','Bidding','Fake','No Resp.','Cold','Win Rate'].map(h=>(
                <th key={h} style={{ textAlign:h==='Rep'?'left':'center',padding:'10px 14px',fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'0.08em',whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {(leadsAEBreakdown||[]).map((ae,i)=>(
                <tr key={ae.id} onClick={()=>onDrill(`${ae.name}'s Leads`,{type:'lead',assigned_to:ae.id})} style={{ borderTop:'1px solid #F2F1EC',cursor:'pointer',transition:'background 0.12s' }}
                  onMouseEnter={e=>e.currentTarget.style.background='#FBFBF8'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={{ padding:'14px' }}>
                    <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                      <Avatar name={ae.name} size={30} tone={i===0?'brand':'neutral'} />
                      <div><div style={{ fontSize:13,fontWeight:600,color:INK }}>{ae.name}</div><div style={{ fontSize:11,color:'#9CA3AF' }}>#{i+1} rank</div></div>
                    </div>
                  </td>
                  <td style={{ padding:'14px',textAlign:'center',fontFamily:'"Poppins",sans-serif',fontWeight:700,fontSize:15 }}>{ae.total}</td>
                  <td style={{ padding:'14px',textAlign:'center',color:'#525866' }}>{ae.today||0}</td>
                  <td style={{ padding:'14px',textAlign:'center',fontFamily:'"Poppins",sans-serif',fontWeight:700,color:'#0E807A' }}>{ae.won}</td>
                  <td style={{ padding:'14px',textAlign:'center',color:'#C2453A' }}>{ae.lost}</td>
                  <td style={{ padding:'14px',textAlign:'center',color:PURPLE }}>{ae.quoted}</td>
                  <td style={{ padding:'14px',textAlign:'center',color:'#4C44C0' }}>{ae.bidding}</td>
                  <td style={{ padding:'14px',textAlign:'center',color:'#9CA3AF' }}>{ae.fake}</td>
                  <td style={{ padding:'14px',textAlign:'center',color:'#525866' }}>{ae.noResp}</td>
                  <td style={{ padding:'14px',textAlign:'center',color:'#525866' }}>{ae.cold}</td>
                  <td style={{ padding:'14px',textAlign:'center' }}>
                    <span style={{ padding:'3px 10px',borderRadius:99,fontSize:11,fontWeight:700,background:ae.winRate>=20?'#E8F8F2':ae.winRate>=10?'#FFF3E6':'#FFEDEB',color:ae.winRate>=20?'#0E807A':ae.winRate>=10?'#A55B16':'#C2453A' }}>{ae.winRate}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Repeat tab ────────────────────────────────────────────────
function RepeatTab({ data, onDrill }) {
  const { repeats, today={} } = data
  if (!repeats) return null
  return (
    <div>
      <SectionHeader>Today</SectionHeader>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:22 }}>
        <Stat label="Inquiries received" value={today?.repeat||0} color={PURPLE} sub="last 24h" />
        <Stat label="Win rate (period)" value={`${repeats.winRate||0}%`} color={BRAND} sub={`${repeats.won}/${repeats.total}`} />
        <Stat label="In progress" value={repeats.active||0} color="#FFB266" />
      </div>

      <SectionHeader>Period summary</SectionHeader>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:22 }}>
        <Stat label="Total inquiries" value={repeats.total||0} color={PURPLE} onClick={()=>onDrill('Repeat Inquiries',{type:'repeat'})} />
        <Stat label="Closed Won" value={repeats.won||0} color="#0E807A" delta={`${repeats.winRate||0}%`} sub="win rate" onClick={()=>onDrill('Repeat — Closed Won',{type:'repeat',disposition:'Closed Won'})} />
        <Stat label="Closed Lost" value={repeats.lost||0} color="#C2453A" onClick={()=>onDrill('Repeat — Closed Lost',{type:'repeat',disposition:'Closed Lost'})} />
        <Stat label="Active" value={repeats.active||0} color="#FFB266" />
      </div>

      <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:16 }}>
        <TopListCard title="Top Customers" data={repeats.topCustomers||[]} accent={PURPLE} onDrill={(d)=>onDrill('Repeats — '+d.name,{type:'repeat',search:d.name})} />
        <TopListCard title="Top Reps" data={(repeats.topReps||[]).map(r=>({...r,name:r.name}))} accent={BRAND} onDrill={(d)=>onDrill(`${d.name}'s Repeats`,{type:'repeat',assigned_to:d.id})} />
        <TopListCard title="Top Companies" data={(repeats.topCompanies||[]).map(c=>({...c,name:c.company}))} accent={CORAL} onDrill={(d)=>onDrill('Repeats — '+d.company,{type:'repeat',search:d.company})} />
      </div>

      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16 }}>
        <div style={{ background:'#fff',borderRadius:18,border:'1px solid #ECEAE3',padding:'22px 24px' }}>
          <h3 style={{ fontFamily:'"Poppins",sans-serif',fontSize:16,fontWeight:700,margin:'0 0 14px',letterSpacing:'-0.01em' }}>By disposition</h3>
          <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
            {(repeats.byDisposition||[]).slice(0,8).map((d,i)=>{
              const pct = repeats.total>0?Math.round((d.count/repeats.total)*100):0
              return (
                <div key={d.disposition} onClick={()=>onDrill('Repeat — '+d.disposition,{type:'repeat',disposition:d.disposition})} style={{ cursor:'pointer' }}>
                  <div style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}>
                    <span style={{ fontSize:12,fontWeight:500,color:'#525866' }}>{d.disposition}</span>
                    <span style={{ fontSize:12,fontWeight:700,color:INK }}>{d.count} <span style={{ color:'#9CA3AF',fontWeight:400 }}>· {pct}%</span></span>
                  </div>
                  <div style={{ height:4,background:'#F3F3EF',borderRadius:99 }}><div style={{ height:'100%',background:PALETTE[i%PALETTE.length],borderRadius:99,width:pct+'%',transition:'width 0.5s' }} /></div>
                </div>
              )
            })}
          </div>
        </div>
        <div style={{ background:'#fff',borderRadius:18,border:'1px solid #ECEAE3',padding:'22px 24px' }}>
          <h3 style={{ fontFamily:'"Poppins",sans-serif',fontSize:16,fontWeight:700,margin:'0 0 14px',letterSpacing:'-0.01em' }}>Disposition tiles</h3>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8 }}>
            {(repeats.byDisposition||[]).slice(0,6).map((d,i)=>(
              <DisTile key={d.disposition} label={d.disposition} value={d.count} pct={repeats.total>0?Math.round((d.count/repeats.total)*100):0} color={PALETTE[i%PALETTE.length]} onClick={()=>onDrill('Repeat — '+d.disposition,{type:'repeat',disposition:d.disposition})} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Orders tab ────────────────────────────────────────────────
function OrdersTab({ data, onDrill }) {
  const { orders, ordersAEBreakdown=[], today={}, trend14=[] } = data
  if (!orders) return null
  return (
    <div>
      <SectionHeader>Today</SectionHeader>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:10,marginBottom:22 }}>
        <Stat label="Received" value={today?.orders||0} color={CORAL} sub="last 24h" />
        <Stat label="Verified" value={orders.verified||0} color="#0E807A" />
        <Stat label="Not Verified" value={orders.notVerified||0} color="#C2453A" />
        <Stat label="Total Value" value={fmt$(orders.totalValue||0)} color={BRAND} />
        <Stat label="Processed" value={orders.processed||0} color="#0E807A" sub={`${orders.processRate||0}%`} />
        <Stat label="Cancelled" value={orders.cancelled||0} color="#C2453A" />
      </div>

      <SectionHeader>Period</SectionHeader>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:10,marginBottom:22 }}>
        <Stat label="Total orders" value={orders.total||0} color={CORAL} onClick={()=>onDrill('All Orders',{type:'online_order'})} />
        <Stat label="Verified" value={orders.verified||0} color="#0E807A" onClick={()=>onDrill('Verified Orders',{type:'online_order'})} />
        <Stat label="Not Verified" value={orders.notVerified||0} color="#C2453A" onClick={()=>onDrill('Unverified Orders',{type:'online_order'})} />
        <Stat label="Total value" value={fmt$(orders.totalValue||0)} color={BRAND} onClick={()=>onDrill('Processed Orders',{type:'online_order',disposition:'Processed'})} />
        <Stat label="Processed" value={orders.processed||0} color="#0E807A" delta={`${orders.processRate||0}%`} onClick={()=>onDrill('Processed',{type:'online_order',disposition:'Processed'})} />
        <Stat label="Cancelled" value={orders.cancelled||0} color="#C2453A" onClick={()=>onDrill('Cancelled',{type:'online_order',disposition:'Cancelled'})} />
      </div>

      <div style={{ display:'grid',gridTemplateColumns:'1.5fr 1fr',gap:16,marginBottom:16 }}>
        <div style={{ background:'#fff',borderRadius:18,border:'1px solid #ECEAE3',padding:'22px 24px' }}>
          <h3 style={{ fontFamily:'"Poppins",sans-serif',fontSize:16,fontWeight:700,margin:'0 0 4px',letterSpacing:'-0.01em' }}>Processed vs cancelled trend</h3>
          <div style={{ fontSize:12,color:'#9CA3AF',marginBottom:14 }}>Last 14 days</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={trend14} barSize={10} barGap={3}>
              <XAxis dataKey="date" tick={{ fontSize:9,fill:'#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={d=>d?.slice(5)} />
              <YAxis tick={{ fontSize:9,fill:'#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="processed" name="Processed" fill="#0E807A" radius={[3,3,0,0]} />
              <Bar dataKey="cancelled" name="Cancelled" fill="#C2453A" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background:'#fff',borderRadius:18,border:'1px solid #ECEAE3',padding:'22px 24px' }}>
          <h3 style={{ fontFamily:'"Poppins",sans-serif',fontSize:16,fontWeight:700,margin:'0 0 14px',letterSpacing:'-0.01em' }}>By disposition</h3>
          <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
            {(orders.byDisposition||[]).map((d,i)=>{
              const pct = orders.total>0?Math.round((d.count/orders.total)*100):0
              return (
                <div key={d.disposition} onClick={()=>onDrill('Orders — '+d.disposition,{type:'online_order',disposition:d.disposition})} style={{ cursor:'pointer' }}>
                  <div style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}>
                    <span style={{ fontSize:12,fontWeight:500,color:'#525866' }}>{d.disposition}</span>
                    <span style={{ fontSize:12,fontWeight:700,color:INK }}>{d.count} <span style={{ color:'#9CA3AF',fontWeight:400 }}>· {pct}%</span></span>
                  </div>
                  <div style={{ height:4,background:'#F3F3EF',borderRadius:99 }}><div style={{ height:'100%',background:PALETTE[i%PALETTE.length],borderRadius:99,width:pct+'%',transition:'width 0.5s' }} /></div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Team table */}
      <div style={{ background:'#fff',borderRadius:18,border:'1px solid #ECEAE3',overflow:'hidden' }}>
        <div style={{ padding:'20px 24px 14px' }}>
          <h3 style={{ fontFamily:'"Poppins",sans-serif',fontSize:16,fontWeight:700,margin:0,letterSpacing:'-0.01em' }}>Team performance</h3>
          <div style={{ fontSize:12,color:'#9CA3AF',marginTop:2 }}>Processing rate by rep</div>
        </div>
        <div style={{ borderTop:'1px solid #F2F1EC' }}>
          <table style={{ width:'100%',borderCollapse:'collapse',fontSize:13 }}>
            <thead><tr style={{ background:'#FBFBF8' }}>
              {['Rep','Total','Today','Processed','Cancelled','Rate'].map(h=>(
                <th key={h} style={{ textAlign:h==='Rep'?'left':'center',padding:'10px 16px',fontSize:10,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'0.08em' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {(ordersAEBreakdown||[]).map((ae,i)=>(
                <tr key={ae.id} onClick={()=>onDrill(`${ae.name}'s Orders`,{type:'online_order',assigned_to:ae.id})} style={{ borderTop:'1px solid #F2F1EC',cursor:'pointer',transition:'background 0.12s' }}
                  onMouseEnter={e=>e.currentTarget.style.background='#FBFBF8'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={{ padding:'14px 16px' }}>
                    <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                      <Avatar name={ae.name} size={28} tone={i===0?'brand':'neutral'} />
                      <span style={{ fontSize:13,fontWeight:600,color:INK }}>{ae.name}</span>
                    </div>
                  </td>
                  <td style={{ padding:'14px 16px',textAlign:'center',fontFamily:'"Poppins",sans-serif',fontWeight:700,fontSize:15 }}>{ae.total}</td>
                  <td style={{ padding:'14px 16px',textAlign:'center',color:'#525866' }}>{ae.today||0}</td>
                  <td style={{ padding:'14px 16px',textAlign:'center',color:'#0E807A',fontWeight:600 }}>{ae.processed}</td>
                  <td style={{ padding:'14px 16px',textAlign:'center',color:'#C2453A' }}>{ae.cancelled}</td>
                  <td style={{ padding:'14px 16px',textAlign:'center' }}>
                    <span style={{ padding:'3px 10px',borderRadius:99,fontSize:11,fontWeight:700,background:ae.rate>=50?'#E8F8F2':ae.rate>=25?'#FFF3E6':'#FFEDEB',color:ae.rate>=50?'#0E807A':ae.rate>=25?'#A55B16':'#C2453A' }}>{ae.rate}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth(); const { navigate } = useNav()
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState('overview')
  const [preset,  setPreset]  = useState('month')
  const [filterDisp,  setFilterDisp]  = useState([])
  const [filterSrc,   setFilterSrc]   = useState([])
  const [filterUsers, setFilterUsers] = useState([])
  const [drilldown, setDrilldown]     = useState(null)
  const [targetModal, setTargetModal] = useState(null)

  // Map preset to date range
  const dateRange = useMemo(() => {
    const now = new Date(); const to = now.toISOString().split('T')[0]
    if (preset==='today')   { return { from:to, to } }
    if (preset==='week')    { const d=new Date(now); d.setDate(d.getDate()-7); return { from:d.toISOString().split('T')[0], to } }
    if (preset==='month')   { const d=new Date(now); d.setDate(d.getDate()-30); return { from:d.toISOString().split('T')[0], to } }
    if (preset==='quarter') { const d=new Date(now); d.setDate(d.getDate()-90); return { from:d.toISOString().split('T')[0], to } }
    return {}
  }, [preset])

  const load = useCallback(() => {
    setLoading(true)
    const p = new URLSearchParams()
    if (dateRange.from) p.set('from', dateRange.from)
    if (dateRange.to)   p.set('to',   dateRange.to)
    fetch('/api/analytics/manager-dashboard?'+p, { headers:{ Authorization:'Bearer '+T() } })
      .then(r=>r.json()).then(d=>{ setData(d); setLoading(false) }).catch(()=>setLoading(false))
  }, [dateRange])
  useEffect(()=>{ load() },[load])

  const drill = (title, filters={}) => {
    const f = { ...filters, ...(dateRange.from?{from:dateRange.from}:{}), ...(dateRange.to?{to:dateRange.to}:{}) }
    if (filterUsers.length) f.assigned_to = filterUsers.join(',')
    setDrilldown({ title, filters:f })
  }

  // Handle set target click in team table (via data attribute)
  const handleTableClick = (e) => {
    const btn = e.target.closest('[data-set-target]')
    if (btn && data) {
      const aeId = parseInt(btn.getAttribute('data-set-target'))
      const ae = data.team?.aes?.find(a=>a.id===aeId)
      if (ae) { e.stopPropagation(); setTargetModal({ ae, existing:ae.target }) }
    }
  }

  const tabs = [
    { value:'overview', label:'Overview' },
    { value:'lead',     label:'Leads' },
    { value:'repeat',   label:'Repeat' },
    { value:'orders',   label:'Online Orders' },
  ]

  const dispositionOpts = tab==='orders' ? ['Processed','Cancelled','Quoted','Initial Contact'] : tab==='repeat' ? ['Closed Won','Quoted','Bidding','Initial Contact','Hold','Closed Lost'] : ['Closed Won','Closed Lost','Quoted','Bidding','Initial Contact','Cold','Cold Lead','Hold','Fake Lead','No response']
  const aeOpts = (data?.team?.aes||[]).map(a=>({ value:String(a.id), label:a.name }))

  const greet = () => { const h=new Date().getHours(); return h<12?'Good morning':h<17?'Good afternoon':'Good evening' }

  return (
    <div style={{ padding:'28px 32px',flex:1,overflowY:'auto',fontFamily:'"Plus Jakarta Sans",sans-serif',background:'#FAFAF8',minHeight:'100%' }} onClick={handleTableClick}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} * { box-sizing: border-box; }`}</style>

      {/* Header */}
      <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:22,gap:16,flexWrap:'wrap' }}>
        <div>
          <div style={{ fontSize:12,color:'#9CA3AF',fontWeight:500,marginBottom:4 }}>Dashboard</div>
          <h1 style={{ fontFamily:'"Poppins",sans-serif',fontSize:34,fontWeight:700,margin:0,letterSpacing:'-0.03em',color:INK }}>{greet()}, {user?.name?.split(' ')[0]}.</h1>
          <p style={{ color:'#9CA3AF',fontSize:13,marginTop:5,marginBottom:0 }}>Tech Atlantix · Sales analytics for the {preset==='all'?'all time':preset}</p>
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:8 }}>
          <button onClick={()=>setTargetModal({ ae:user, existing:data?.own?.target })} style={{ padding:'9px 16px',borderRadius:10,border:'1px solid #ECEAE3',background:'#fff',color:'#525866',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit' }}>🎯 My Target</button>
          <button onClick={()=>navigate('leads')} style={{ padding:'9px 16px',borderRadius:10,border:'none',background:BRAND,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit' }}>+ New inquiry</button>
        </div>
      </div>

      {/* My Performance */}
      {data && <MyPerformance own={data.own} meta={data.meta} userId={user?.id} onDrill={drill} onSetTarget={()=>setTargetModal({ ae:user, existing:data?.own?.target })} />}

      {/* Filter bar */}
      <div style={{ display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',marginBottom:22 }}>
        <Segmented value={preset} onChange={setPreset} options={[{value:'today',label:'Today'},{value:'week',label:'Week'},{value:'month',label:'Month'},{value:'quarter',label:'Quarter'},{value:'all',label:'All'}]} />
        <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
          <MultiChip placeholder="Disposition" options={dispositionOpts} selected={filterDisp} onChange={setFilterDisp} />
          <MultiChip placeholder="Team member" options={aeOpts} selected={filterUsers} onChange={setFilterUsers} />
        </div>
        {(filterDisp.length>0||filterSrc.length>0||filterUsers.length>0)&&(
          <button onClick={()=>{ setFilterDisp([]); setFilterSrc([]); setFilterUsers([]) }} style={{ padding:'6px 12px',borderRadius:9,background:'#FFEDEB',border:'1px solid #FFCFCB',color:'#C2453A',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit' }}>× Clear</button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ marginBottom:22,borderBottom:'1px solid #ECEAE3' }}>
        <div style={{ display:'flex',gap:4 }}>
          {tabs.map(t=>{
            const active = tab===t.value
            return (
              <button key={t.value} onClick={()=>setTab(t.value)} style={{ padding:'10px 16px',border:'none',background:'transparent',fontSize:13,fontWeight:600,cursor:'pointer',color:active?INK:'#9CA3AF',position:'relative',fontFamily:'inherit',transition:'color 0.15s' }}>
                {t.label}
                {active&&<span style={{ position:'absolute',bottom:-1,left:6,right:6,height:2,background:BRAND,borderRadius:99 }} />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      {loading?(
        <div style={{ display:'flex',alignItems:'center',justifyContent:'center',padding:80 }}>
          <div style={{ width:28,height:28,borderRadius:'50%',border:'2px solid '+BRAND,borderTopColor:'transparent',animation:'spin 0.8s linear infinite' }}/>
        </div>
      ):data&&(
        <>
          {tab==='overview'&&<OverviewTab data={data} onDrill={drill} />}
          {tab==='lead'    &&<LeadsTab    data={data} onDrill={drill} filterDispositions={filterDisp} filterSources={filterSrc} filterUsers={filterUsers} />}
          {tab==='repeat'  &&<RepeatTab   data={data} onDrill={drill} />}
          {tab==='orders'  &&<OrdersTab   data={data} onDrill={drill} />}
        </>
      )}

      {drilldown&&<DrilldownModal title={drilldown.title} filters={drilldown.filters} onClose={()=>setDrilldown(null)} />}
      {targetModal&&<SetTargetModal ae={targetModal.ae} existing={targetModal.existing} onClose={()=>setTargetModal(null)} onSaved={()=>{ setTargetModal(null); load() }} />}
    </div>
  )
}
