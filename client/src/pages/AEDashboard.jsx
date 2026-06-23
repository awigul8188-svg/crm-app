import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { LayoutDashboard, Target, RotateCcw, ShoppingBag, AlertCircle, Clock, TrendingUp, Plus } from 'lucide-react'
import { useNav } from '../App'
import { useAuth } from '../App'
import { formatDate, formatDateShort, timeAgo, DispositionBadge, DISPOSITIONS, PPC_OPTIONS, VERIFICATION_OPTIONS, ORDER_SOURCES, LEAD_SOURCES } from '../components/Badges'
import NewInquiryModal from '../components/NewInquiryModal'

const BRAND = '#00D4C8'
const C = ['#00D4C8','#3b82f6','#6366f1','#f59e0b','#ef4444','#10b981','#8b5cf6','#f97316','#ec4899','#84cc16']
const TYPE_ICONS  = { lead:'◎', repeat:'↻', online_order:'◈' }
const TYPE_COLORS = { lead:'#3b82f6', repeat:'#6366f1', online_order:'#f59e0b' }
const TYPE_LABELS = { lead:'Lead', repeat:'Repeat', online_order:'Online Order' }

const inp = { width:'100%', boxSizing:'border-box', background:'#fff', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'10px 14px', fontSize:'13px', color:'#0f172a', fontFamily:'"Plus Jakarta Sans",sans-serif', outline:'none', transition:'border 0.15s' }

const PRESETS = [
  { label:'Today',   value:'today'   },
  { label:'Week',    value:'week'    },
  { label:'Month',   value:'month'   },
  { label:'Quarter', value:'quarter' },
  { label:'All Time',value:'all'     },
  { label:'Custom',  value:'custom'  },
]

function getDateFilters(preset, customFrom, customTo) {
  const fmt = d => d.toISOString().split('T')[0]
  const now = new Date(); const today = fmt(now)
  if (preset === 'today')   return { from: today, to: today }
  if (preset === 'week')    { const d = new Date(now); d.setDate(d.getDate()-7); return { from: fmt(d), to: today } }
  if (preset === 'month')   { const d = new Date(now); d.setDate(1); return { from: fmt(d), to: today } }
  if (preset === 'quarter') { const d = new Date(now); d.setMonth(d.getMonth()-3); return { from: fmt(d), to: today } }
  if (preset === 'custom')  return { from: customFrom, to: customTo }
  return { from: '', to: '' }
}

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#0d0d0d', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:'8px 12px', fontSize:12 }}>
      <div style={{ color:'rgba(255,255,255,0.6)', marginBottom:4 }}>{label}</div>
      {payload.map(p => <div key={p.name} style={{ color:p.color||BRAND, display:'flex', gap:8 }}><span>{p.name}</span><b>{p.value}</b></div>)}
    </div>
  )
}

function Loader() {
  return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'60px 0' }}><div style={{ width:28, height:28, borderRadius:'50%', border:`2px solid ${BRAND}`, borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} /></div>
}

function useSummary() {
  const [summary, setSummary] = useState(null)
  useEffect(() => {
    fetch('/api/analytics/summary', { headers: { Authorization:`Bearer ${localStorage.getItem('crm_token')}` } })
      .then(r => r.json()).then(setSummary).catch(() => {})
  }, [])
  return summary
}

function BentoTop({ summary }) {
  if (!summary) return null
  const f = summary.conversionFunnel || {}
  const max = f.total || 1
  const steps = [
    { label:'All Leads', value:f.total,   color:'#3b82f6' },
    { label:'Quoted',    value:f.quoted,  color:'#6366f1' },
    { label:'Bidding',   value:f.bidding, color:'#f59e0b' },
    { label:'Won',       value:f.won,     color:'#10b981' },
  ]
  const overdue   = summary.overdueCount   || 0
  const untouched = summary.untouchedCount || 0

  return (
    <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:14, marginBottom:24 }}>
      <div style={{ background:'#fff', borderRadius:20, border:'1px solid rgba(0,0,0,0.06)', padding:'20px 22px', boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
          <TrendingUp size={14} style={{ color:BRAND }} />
          <span style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.08em' }}>My Lead Conversion Funnel</span>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
          {steps.map(s => {
            const pct = max > 0 ? Math.round((s.value||0)/max*100) : 0
            return (
              <div key={s.label}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:5 }}>
                  <span style={{ fontSize:12, color:'#64748b', fontWeight:500 }}>{s.label}</span>
                  <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
                    <span style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontSize:18, fontWeight:800, color:'#0f172a', lineHeight:1 }}>{(s.value||0).toLocaleString()}</span>
                    <span style={{ fontSize:11, color:'#94a3b8' }}>{pct}%</span>
                  </div>
                </div>
                <div style={{ height:6, background:'#f1f5f9', borderRadius:6 }}>
                  <div style={{ height:'100%', borderRadius:6, background:s.color, width:`${pct}%`, transition:'width 0.4s ease' }} />
                </div>
              </div>
            )
          })}
        </div>
        {f.won > 0 && f.total > 0 && (() => {
          const winPct = Math.round(f.won / f.total * 100)
          const r = 22; const circ = 2 * Math.PI * r
          return (
            <div style={{ marginTop:14, paddingTop:12, borderTop:'1px solid #f1f5f9', display:'flex', alignItems:'center', gap:16 }}>
              <div style={{ flexShrink:0 }}>
                <svg width="54" height="54" viewBox="0 0 54 54" style={{ display:'block' }}>
                  <circle cx="27" cy="27" r={r} fill="none" stroke="#f1f5f9" strokeWidth="5" />
                  <circle cx="27" cy="27" r={r} fill="none" stroke="#10b981" strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={`${circ * winPct / 100} ${circ * (1 - winPct / 100)}`}
                    transform="rotate(-90 27 27)"
                    style={{ transition:'stroke-dasharray 1.2s cubic-bezier(0.34,1.56,0.64,1)' }}
                  />
                  <text x="27" y="31" textAnchor="middle" fontSize="11" fontWeight="700" fill="#10b981">{winPct}%</text>
                </svg>
                <div style={{ fontSize:9, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.08em', textAlign:'center', marginTop:3 }}>Win Rate</div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, flex:1 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:11, color:'#64748b' }}>Active</span>
                  <span style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontSize:16, fontWeight:800, color:'#0f172a' }}>{(f.total - f.won - (f.lost||0)).toLocaleString()}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:11, color:'#64748b' }}>Won</span>
                  <span style={{ fontSize:14, fontWeight:700, color:'#10b981' }}>{f.won}</span>
                </div>
              </div>
            </div>
          )
        })()}
      </div>

      <div style={{ background:overdue>0?'#fff5f5':'#f0fdf4', borderRadius:20, border:`1px solid ${overdue>0?'#fecaca':'#bbf7d0'}`, padding:'20px 22px', boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
          <AlertCircle size={14} style={{ color:overdue>0?'#ef4444':'#10b981' }} />
          <span style={{ fontSize:11, fontWeight:700, color:overdue>0?'#ef4444':'#16a34a', textTransform:'uppercase', letterSpacing:'0.08em' }}>Overdue</span>
          {overdue>0 && <span style={{ width:7, height:7, borderRadius:'50%', background:'#ef4444', display:'inline-block', animation:'pulse 2s infinite', marginLeft:'auto' }} />}
        </div>
        <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontSize:52, fontWeight:900, lineHeight:1, color:overdue>0?'#dc2626':'#16a34a', fontVariantNumeric:'tabular-nums' }}>{overdue}</div>
        <div style={{ fontSize:12, color:overdue>0?'#ef4444':'#16a34a', marginTop:8, fontWeight:500 }}>
          {overdue===0 ? 'All follow-ups on track ✓' : overdue===1 ? '1 follow-up is overdue' : `${overdue} follow-ups are overdue`}
        </div>
      </div>

      <div style={{ background:untouched>0?'#fffbeb':'#f0fdf4', borderRadius:20, border:`1px solid ${untouched>0?'#fde68a':'#bbf7d0'}`, padding:'20px 22px', boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
          <Clock size={14} style={{ color:untouched>0?'#d97706':'#10b981' }} />
          <span style={{ fontSize:11, fontWeight:700, color:untouched>0?'#d97706':'#16a34a', textTransform:'uppercase', letterSpacing:'0.08em' }}>Needs Attention</span>
          {untouched>0 && <span style={{ width:7, height:7, borderRadius:'50%', background:'#f59e0b', display:'inline-block', animation:'pulse 2s infinite 0.4s', marginLeft:'auto' }} />}
        </div>
        <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontSize:52, fontWeight:900, lineHeight:1, color:untouched>0?'#d97706':'#16a34a', fontVariantNumeric:'tabular-nums' }}>{untouched}</div>
        <div style={{ fontSize:12, color:untouched>0?'#d97706':'#16a34a', marginTop:8, fontWeight:500 }}>
          {untouched===0 ? 'All inquiries touched ✓' : `${untouched} with no activity 7+ days`}
        </div>
      </div>
    </div>
  )
}

// ── Count-up hook ────────────────────────────────────────────────
function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(typeof target === 'number' ? 0 : target)
  useEffect(() => {
    if (typeof target !== 'number') { setVal(target); return }
    if (target === 0) { setVal(0); return }
    const start = performance.now()
    const tick = now => {
      const t = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setVal(Math.round(target * ease))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target])
  return val
}

// ── Metric Card ─────────────────────────────────────────────────
function MetricCard({ label, value, sub, color = BRAND, prefix = '', suffix = '', onClick }) {
  const animated = useCountUp(value)
  const display = typeof value === 'number' ? animated.toLocaleString() : (value ?? '—')
  return (
    <div onClick={onClick}
      className={`metric-card${onClick ? ' clickable' : ''}`}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = `0 8px 24px ${color}30` } }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = '' }}>
      <div style={{ position:'absolute', top:0, left:0, width:3, height:'100%', background:color, borderRadius:'14px 0 0 14px' }} />
      {onClick && <div className="absolute top-2.5 right-3 text-[9px] font-bold tracking-widest text-ink-300">VIEW ↗</div>}
      <div className="text-[10px] font-bold text-ink-400 uppercase tracking-[0.08em] mb-2">{label}</div>
      <div className="font-display font-extrabold text-[26px] text-ink-900 leading-none" style={{ fontVariantNumeric:'tabular-nums' }}>{prefix}{display}{suffix}</div>
      {sub && <div className="text-[11px] text-ink-400 mt-1.5">{sub}</div>}
    </div>
  )
}

// ── Section Label ────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
      <div style={{ width:3, height:14, borderRadius:2, background: BRAND, flexShrink:0 }} />
      <span style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.1em' }}>{children}</span>
    </div>
  )
}

function STitle({ children, right }) {
  return <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
    <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:14, color:'#0f172a' }}>{children}</div>
    {right}
  </div>
}

// ── Date filter bar ─────────────────────────────────────────────
function DateBar({ preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo }) {
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
        <div className="flex bg-white border border-slate-200 rounded-xl p-1 gap-0.5">
          {PRESETS.map(r => (
            <button key={r.value} onClick={() => setPreset(r.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150 whitespace-nowrap border ${
                preset === r.value ? 'text-dark-900 border-transparent' : 'bg-transparent text-ink-400 border-transparent hover:text-ink-700'
              }`}
              style={preset === r.value ? { background: BRAND } : {}}>
              {r.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'#fff', border:`1px solid ${BRAND}40`, borderRadius:12, padding:'6px 14px' }}>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ padding:'4px 8px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:12, outline:'none' }} />
            <span style={{ color:'#94a3b8' }}>→</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ padding:'4px 8px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:12, outline:'none' }} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Inquiry Quick Edit Modal ─────────────────────────────────────
// Opens on top of DrilldownModal — edit and return to list
function InquiryQuickEditModal({ id, onClose, onSaved }) {
  const [inquiry, setInquiry] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [comment, setComment] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [newFollowup, setNewFollowup] = useState({ note:'', follow_up_date:'' })
  const [showFollowupForm, setShowFollowupForm] = useState(false)

  // Editable fields
  const [disposition, setDisposition] = useState('')
  const [notes, setNotes] = useState('')
  const [customDate, setCustomDate] = useState('')
  const [requirements, setRequirements] = useState([])
  const [ppcOrOutbound, setPpcOrOutbound] = useState('')
  const [orderAmount, setOrderAmount] = useState('')
  const [orderRef, setOrderRef] = useState('')

  const load = () => {
    fetch(`/api/inquiries/${id}`, { headers: { Authorization:`Bearer ${localStorage.getItem('crm_token')}` } })
      .then(r => r.json()).then(d => {
        setInquiry(d)
        setDisposition(d.disposition || '')
        setNotes(d.notes || '')
        setCustomDate(d.created_at ? d.created_at.split('T')[0] : '')
        setRequirements(d.requirements || [])
        setPpcOrOutbound(d.ppc_or_outbound || '')
        setOrderAmount(d.order_amount || '')
        setOrderRef(d.order_ref || '')
        setLoading(false)
      }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  const handleSave = async () => {
    setSaving(true); setError('')
    try {
      await fetch(`/api/inquiries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('crm_token')}` },
        body: JSON.stringify({ disposition, notes, ppc_or_outbound: ppcOrOutbound, order_amount: orderAmount, order_ref: orderRef, requirements, custom_date: customDate, assigned_to: inquiry.assigned_to })
      })
      onSaved()
      onClose()
    } catch(e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const handleComment = async () => {
    if (!comment.trim()) return
    setSendingComment(true)
    await fetch(`/api/inquiries/${id}/comments`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('crm_token')}`}, body: JSON.stringify({ comment }) })
    setComment(''); setSendingComment(false); load()
  }

  const handleFollowup = async () => {
    if (!newFollowup.note.trim()) return
    await fetch(`/api/inquiries/${id}/followups`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('crm_token')}`}, body: JSON.stringify(newFollowup) })
    setNewFollowup({ note:'', follow_up_date:'' }); setShowFollowupForm(false); load()
  }

  const addReq = () => setRequirements(r => [...r, { part_number:'', quantity:'' }])
  const updateReq = (i, k, v) => setRequirements(r => r.map((x, idx) => idx===i ? {...x,[k]:v} : x))
  const removeReq = (i) => setRequirements(r => r.filter((_,idx) => idx!==i))

  const dispositionsForType = inquiry?.type === 'online_order'
    ? ['Processed','Cancelled']
    : DISPOSITIONS.filter(d => d !== 'Processed' && d !== 'Cancelled')

  return createPortal(
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:999999, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:20, boxShadow:'0 32px 100px rgba(0,0,0,0.3)', width:'100%', maxWidth:660, maxHeight:'90vh', overflowY:'auto', animation:'modalIn 0.18s ease-out', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
        <style>{`@keyframes modalIn{from{opacity:0;transform:scale(0.96) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>

        {/* Header */}
        <div style={{ padding:'18px 24px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, background:'#fff', zIndex:10, borderRadius:'20px 20px 0 0' }}>
          {loading ? <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:15, color:'#0f172a' }}>Loading...</div> : (
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                <span style={{ fontSize:13, fontWeight:600, color: TYPE_COLORS[inquiry?.type] }}>{TYPE_ICONS[inquiry?.type]} {TYPE_LABELS[inquiry?.type]}</span>
                <DispositionBadge disposition={inquiry?.disposition} />
              </div>
              <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:16, color:'#0f172a' }}>{inquiry?.customer_name}</div>
              {inquiry?.customer_company && <div style={{ fontSize:12, color:'#94a3b8' }}>{inquiry?.customer_company}</div>}
            </div>
          )}
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:10, border:'none', background:'#f1f5f9', cursor:'pointer', fontSize:18, color:'#64748b', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>×</button>
        </div>

        {loading ? <Loader /> : (
          <div style={{ padding:'20px 24px 24px' }}>
            {/* Date + Disposition row */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Date</div>
                <input type="date" value={customDate} onChange={e => setCustomDate(e.target.value)} style={inp} />
              </div>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>{inquiry?.type === 'online_order' ? 'Status' : 'Disposition'}</div>
                <select value={disposition} onChange={e => setDisposition(e.target.value)} style={{ ...inp, cursor:'pointer' }}>
                  {dispositionsForType.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
            </div>

            {/* Type-specific fields */}
            {inquiry?.type === 'repeat' && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>PPC or Outbound</div>
                <select value={ppcOrOutbound} onChange={e => setPpcOrOutbound(e.target.value)} style={{ ...inp, cursor:'pointer' }}>
                  <option value="">—</option>
                  {PPC_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            )}
            {inquiry?.type === 'online_order' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Verification</div>
                  <select value={orderRef} onChange={e => setOrderRef(e.target.value)} style={{ ...inp, cursor:'pointer' }}>
                    <option value="">—</option>
                    {VERIFICATION_OPTIONS.map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Order Amount</div>
                  <input value={orderAmount} onChange={e => setOrderAmount(e.target.value)} placeholder="e.g. 500" style={inp} />
                </div>
              </div>
            )}

            {/* Part Numbers */}
            <div style={{ marginBottom:14 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase' }}>Part Numbers</div>
                <button onClick={addReq} style={{ fontSize:11, color:BRAND, fontWeight:700, background:'none', border:'none', cursor:'pointer' }}>+ Add</button>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {requirements.map((r, i) => (
                  <div key={i} style={{ display:'flex', gap:8 }}>
                    <input value={r.part_number} onChange={e => updateReq(i,'part_number',e.target.value)} placeholder="Part number" style={{ ...inp, flex:1 }} />
                    <input value={r.quantity} onChange={e => updateReq(i,'quantity',e.target.value)} placeholder="Qty" style={{ ...inp, width:80 }} />
                    <button onClick={() => removeReq(i)} style={{ border:'none', background:'none', cursor:'pointer', color:'#ef4444', fontSize:18, flexShrink:0, display:'flex', alignItems:'center' }}>×</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Comments</div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Add comments..." style={{ ...inp, resize:'none' }} />
            </div>

            {error && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:12, padding:'10px 14px', fontSize:13, color:'#dc2626', marginBottom:14 }}>⚠ {error}</div>}

            {/* Save */}
            <button onClick={handleSave} disabled={saving}
              style={{ width:'100%', padding:'12px', borderRadius:12, border:'none', background:saving?'#94a3b8':BRAND, color:'#0d0d0d', fontWeight:700, fontSize:14, cursor:saving?'not-allowed':'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', marginBottom:20 }}>
              {saving ? 'Saving...' : '✓ Save Changes'}
            </button>

            {/* Add Comment */}
            <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:16, marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:8 }}>Add Comment</div>
              <div style={{ display:'flex', gap:8 }}>
                <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Write a comment..." onKeyDown={e => e.key==='Enter' && handleComment()} style={{ ...inp, flex:1 }} />
                <button onClick={handleComment} disabled={sendingComment || !comment.trim()}
                  style={{ padding:'10px 16px', borderRadius:12, border:'none', background:BRAND, color:'#0d0d0d', fontWeight:700, fontSize:13, cursor:'pointer', flexShrink:0, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
                  {sendingComment ? '...' : 'Send'}
                </button>
              </div>
            </div>

            {/* Comments list */}
            {inquiry?.activity?.filter(a => a.action === 'Comment').length > 0 && (
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:8 }}>Comments</div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {inquiry.activity.filter(a => a.action==='Comment').map(a => (
                    <div key={a.id} style={{ background:'#f8fafc', borderRadius:10, padding:'10px 14px', border:'1px solid #f1f5f9' }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ fontSize:12, fontWeight:600, color:'#0f172a' }}>{a.user_name}</span>
                        <span style={{ fontSize:11, color:'#94a3b8' }}>{timeAgo(a.created_at)}</span>
                      </div>
                      <div style={{ fontSize:13, color:'#475569' }}>{a.comment}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Follow-up */}
            <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:16 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase' }}>Follow-ups</div>
                <button onClick={() => setShowFollowupForm(!showFollowupForm)} style={{ fontSize:11, color:BRAND, fontWeight:700, background:'none', border:'none', cursor:'pointer' }}>{showFollowupForm ? 'Cancel' : '+ Add'}</button>
              </div>
              {showFollowupForm && (
                <div style={{ background:'#f8fafc', borderRadius:12, padding:14, border:'1px solid #e2e8f0', marginBottom:10 }}>
                  <input value={newFollowup.note} onChange={e => setNewFollowup(f=>({...f,note:e.target.value}))} placeholder="Follow-up note *" style={{ ...inp, marginBottom:8 }} />
                  <div style={{ display:'flex', gap:8 }}>
                    <input type="date" value={newFollowup.follow_up_date} onChange={e => setNewFollowup(f=>({...f,follow_up_date:e.target.value}))} style={{ ...inp, flex:1 }} />
                    <button onClick={handleFollowup} style={{ padding:'10px 16px', borderRadius:12, border:'none', background:BRAND, color:'#0d0d0d', fontWeight:700, fontSize:13, cursor:'pointer', flexShrink:0, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Add</button>
                  </div>
                </div>
              )}
              {inquiry?.followups?.filter(f => !f.completed).map(fu => (
                <div key={fu.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid #f8fafc' }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background: new Date(fu.follow_up_date) < new Date() ? '#ef4444' : BRAND, flexShrink:0 }} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:500, color:'#475569' }}>{fu.note}</div>
                    {fu.follow_up_date && <div style={{ fontSize:11, color:BRAND, fontWeight:600 }}>{formatDate(fu.follow_up_date)}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

// ── Drilldown Modal ─────────────────────────────────────────────
function DrilldownModal({ title, type, filters, onClose }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)

  const load = useCallback(() => {
    const p = new URLSearchParams()
    if (type) p.set('type', type)
    if (filters.disposition) p.set('disposition', filters.disposition)
    if (filters.from) p.set('from', filters.from)
    if (filters.to) p.set('to', filters.to)
    fetch(`/api/inquiries?${p}`, { headers: { Authorization:`Bearer ${localStorage.getItem('crm_token')}` } })
      .then(r => r.json()).then(d => { setRows(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [type, JSON.stringify(filters)])

  useEffect(() => { load() }, [load])

  return createPortal(
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:20, boxShadow:'0 24px 80px rgba(0,0,0,0.25)', width:'100%', maxWidth:900, maxHeight:'87vh', display:'flex', flexDirection:'column', animation:'modalIn 0.18s ease-out', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
        <style>{`@keyframes modalIn{from{opacity:0;transform:scale(0.96) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>

        <div style={{ padding:'18px 24px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:16, color:'#0f172a' }}>{title}</div>
            <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>{loading ? 'Loading...' : `${rows.length} records — click any row to edit`}</div>
          </div>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:10, border:'none', background:'#f1f5f9', cursor:'pointer', fontSize:18, color:'#64748b', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
        </div>

        <div style={{ overflowY:'auto', flex:1 }}>
          {loading ? <Loader /> : rows.length === 0 ? (
            <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>No records found</div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#f8fafc', position:'sticky', top:0 }}>
                  {['Date','Customer','Company','Disposition','Parts','Notes',''].map(h => (
                    <th key={h} style={{ textAlign:'left', padding:'10px 14px', fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap', borderBottom:'2px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom:'1px solid #f1f5f9', background:i%2===0?'#fff':'#fafbfc', transition:'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background=`${BRAND}08`}
                    onMouseLeave={e => e.currentTarget.style.background=i%2===0?'#fff':'#fafbfc'}>
                    <td style={{ padding:'10px 14px', color:'#64748b', fontFamily:'monospace', fontSize:12, whiteSpace:'nowrap' }}>{formatDateShort(r.created_at)}</td>
                    <td style={{ padding:'10px 14px', fontWeight:600, color:'#0f172a', whiteSpace:'nowrap' }}>{r.customer_name}</td>
                    <td style={{ padding:'10px 14px', color:'#64748b', fontSize:12 }}>{r.customer_company||'—'}</td>
                    <td style={{ padding:'10px 14px' }}><DispositionBadge disposition={r.disposition} /></td>
                    <td style={{ padding:'10px 14px', fontFamily:'monospace', fontSize:11, color:'#475569', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.requirements?.map(req => req.part_number).join(', ')||'—'}</td>
                    <td style={{ padding:'10px 14px', color:'#94a3b8', fontSize:12, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.notes||'—'}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <button onClick={() => setEditingId(r.id)}
                        style={{ padding:'5px 12px', borderRadius:8, border:`1px solid ${BRAND}40`, background:`${BRAND}10`, color:BRAND, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', whiteSpace:'nowrap' }}>
                        ✏ Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Quick edit stacks on top */}
      {editingId && (
        <InquiryQuickEditModal
          id={editingId}
          onClose={() => setEditingId(null)}
          onSaved={() => { setEditingId(null); load() }}
        />
      )}
    </div>,
    document.body
  )
}

// ── Module data hook ─────────────────────────────────────────────
function useModuleData(type, dateFilters) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const key = JSON.stringify({ type, ...dateFilters })

  useEffect(() => {
    setLoading(true)
    const p = new URLSearchParams({ type })
    if (dateFilters.from) p.set('from', dateFilters.from)
    if (dateFilters.to) p.set('to', dateFilters.to)
    fetch(`/api/analytics/module?${p}`, { headers: { Authorization:`Bearer ${localStorage.getItem('crm_token')}` } })
      .then(r => r.json()).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [key])

  return { data, loading }
}

// ── Leads Tab ───────────────────────────────────────────────────
function AELeadsTab({ dateFilters, onDrilldown }) {
  const { data, loading } = useModuleData('lead', dateFilters)
  if (loading) return <Loader />
  if (!data) return null
  const p = data.period
  const trendData = (data.trend||[]).map(t => ({ ...t, date: t.date?.slice(5) }))
  const drill = (title, extra={}) => onDrilldown({ title, type:'lead', filters:{ ...dateFilters, ...extra }})

  return (
    <div>
      <SectionLabel>Today</SectionLabel>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        <MetricCard label="My Leads Today" value={data.today.total} color="#3b82f6" onClick={() => drill('My Leads Today', { from: new Date().toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] })} />
        <MetricCard label="Win Rate" value={`${p.win_rate}%`} color={BRAND} sub={`${p.closed_won} won of ${p.total}`} />
        <MetricCard label="In Progress" value={p.in_progress} color="#f59e0b" onClick={() => drill('My In Progress Leads')} />
      </div>

      <SectionLabel>Period</SectionLabel>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        <MetricCard label="Total Leads" value={p.total} color="#3b82f6" onClick={() => drill('All My Leads')} />
        <MetricCard label="Closed Won" value={p.closed_won} color="#10b981" onClick={() => drill('My Closed Won Leads', { disposition:'Closed Won' })} />
        <MetricCard label="Closed Lost" value={p.closed_lost} color="#ef4444" onClick={() => drill('My Closed Lost Leads', { disposition:'Closed Lost' })} />
        <MetricCard label="Quoted" value={p.quoted} color="#6366f1" onClick={() => drill('My Quoted Leads', { disposition:'Quoted' })} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        <MetricCard label="Bidding" value={p.bidding} color="#8b5cf6" onClick={() => drill('My Bidding Leads', { disposition:'Bidding' })} />
        <MetricCard label="Fake Leads" value={p.fake} color="#94a3b8" onClick={() => drill('My Fake Leads', { disposition:'Fake Lead' })} />
        <MetricCard label="No Response" value={p.no_response} color="#64748b" onClick={() => drill('No Response', { disposition:'No response' })} />
        <MetricCard label="Cold" value={(p.cold||0)} color="#cbd5e1" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:20, marginBottom:20 }}>
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', padding:18 }}>
          <STitle>Lead Trend — Won vs Total</STitle>
          {trendData.length === 0 ? <div style={{ height:160, display:'flex', alignItems:'center', justifyContent:'center', color:'#94a3b8' }}>No data</div> : (
            <ResponsiveContainer width="100%" height={180}><BarChart data={trendData} barSize={8} barGap={2}><XAxis dataKey="date" tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} /><Tooltip content={<Tip />} /><Bar dataKey="total" name="Total" fill="#3b82f6" radius={[3,3,0,0]} /><Bar dataKey="won" name="Won" fill="#10b981" radius={[3,3,0,0]} /></BarChart></ResponsiveContainer>
          )}
        </div>
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', padding:18 }}>
          <STitle>By Source</STitle>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {(data.bySource||[]).filter(s=>s.source).slice(0,7).map((s,i) => (
              <div key={s.source} onClick={() => drill(`Source: ${s.source}`)} style={{ cursor:'pointer' }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:2 }}><span style={{ color:'#475569' }}>{s.source}</span><span style={{ fontWeight:700 }}>{s.count}</span></div>
                <div style={{ height:4, background:'#f1f5f9', borderRadius:4 }}><div style={{ height:'100%', borderRadius:4, background:C[i%C.length], width:`${p.total>0?Math.round(s.count/p.total*100):0}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', padding:18 }}>
        <STitle>By Disposition</STitle>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(155px,1fr))', gap:10 }}>
          {(data.byDisposition||[]).filter(d=>d.disposition).map((d,i) => {
            const pct = p.total>0 ? Math.round(d.count/p.total*100) : 0
            return (
              <div key={d.disposition} onClick={() => drill(d.disposition, { disposition:d.disposition })}
                style={{ background:'#f8fafc', borderRadius:12, padding:'12px 14px', border:'1px solid #f1f5f9', cursor:'pointer', transition:'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor=C[i%C.length]; e.currentTarget.style.background='#fff' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='#f1f5f9'; e.currentTarget.style.background='#f8fafc' }}>
                <div style={{ fontSize:11, color:'#64748b', marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.disposition}</div>
                <div style={{ fontSize:20, fontWeight:800, color:'#0f172a', fontFamily:'"Bricolage Grotesque",sans-serif' }}>{d.count}</div>
                <div style={{ height:3, background:'#e2e8f0', borderRadius:4, marginTop:6 }}><div style={{ height:'100%', borderRadius:4, background:C[i%C.length], width:`${pct}%` }} /></div>
                <div style={{ fontSize:10, color:'#94a3b8', marginTop:3 }}>{pct}%</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Repeat Tab ──────────────────────────────────────────────────
function AERepeatTab({ dateFilters, onDrilldown }) {
  const { data, loading } = useModuleData('repeat', dateFilters)
  if (loading) return <Loader />
  if (!data) return null
  const p = data.period
  const drill = (title, extra={}) => onDrilldown({ title, type:'repeat', filters:{ ...dateFilters, ...extra }})

  return (
    <div>
      <SectionLabel>Today</SectionLabel>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        <MetricCard label="My Repeat Today" value={data.today.total} color="#6366f1" onClick={() => drill('My Repeat Today', { from: new Date().toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] })} />
        <MetricCard label="PPC (Period)" value={p.ppc} color="#3b82f6" onClick={() => drill('My PPC Inquiries')} />
        <MetricCard label="Outbound (Period)" value={p.outbound} color="#8b5cf6" onClick={() => drill('My Outbound Inquiries')} />
      </div>

      <SectionLabel>Period</SectionLabel>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        <MetricCard label="Total" value={p.total} color="#6366f1" onClick={() => drill('All My Repeat Inquiries')} />
        <MetricCard label="Closed Won" value={p.closed_won} color="#10b981" onClick={() => drill('My Closed Won Repeat', { disposition:'Closed Won' })} />
        <MetricCard label="Win Rate" value={`${p.win_rate}%`} color={BRAND} />
        <MetricCard label="PPC vs Outbound" value={`${p.ppc}/${p.outbound}`} color="#8b5cf6" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', padding:18 }}>
          <STitle>By Disposition</STitle>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {(data.byDisposition||[]).slice(0,10).map((d,i) => (
              <div key={d.disposition} onClick={() => drill(d.disposition, { disposition:d.disposition })} style={{ cursor:'pointer' }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:2 }}><span style={{ color:'#475569' }}>{d.disposition||'Unknown'}</span><span style={{ fontWeight:700 }}>{d.count}</span></div>
                <div style={{ height:4, background:'#f1f5f9', borderRadius:4 }}><div style={{ height:'100%', borderRadius:4, background:C[i%C.length], width:`${p.total>0?Math.round(d.count/p.total*100):0}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', padding:18 }}>
          <STitle>Volume Trend</STitle>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={(data.trend||[]).map(t => ({ ...t, date:t.date?.slice(5) }))}>
              <XAxis dataKey="date" tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<Tip />} />
              <Line type="monotone" dataKey="total" name="Inquiries" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ── Orders Tab ──────────────────────────────────────────────────
function AEOrdersTab({ dateFilters, onDrilldown }) {
  const { data, loading } = useModuleData('online_order', dateFilters)
  if (loading) return <Loader />
  if (!data) return null
  const t = data.today; const p = data.period
  const drill = (title, extra={}) => onDrilldown({ title, type:'online_order', filters:{ ...dateFilters, ...extra }})

  return (
    <div>
      <SectionLabel>Today</SectionLabel>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:12 }}>
        <MetricCard label="Orders Today" value={t.total} color="#f59e0b" onClick={() => drill('My Orders Today', { from: new Date().toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] })} />
        <MetricCard label="Verified" value={t.verified} color="#10b981" />
        <MetricCard label="Not Verified" value={t.not_verified} color="#ef4444" />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        <MetricCard label="Value Today" value={t.value.toFixed(0)} color={BRAND} prefix="$" />
        <MetricCard label="Processed" value={t.processed} color="#10b981" onClick={() => drill('My Processed Orders Today', { from: new Date().toISOString().split('T')[0], to: new Date().toISOString().split('T')[0], disposition:'Processed' })} />
        <MetricCard label="Cancelled" value={t.cancelled} color="#ef4444" />
      </div>

      <SectionLabel>Period</SectionLabel>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:12 }}>
        <MetricCard label="Total Orders" value={p.total} color="#f59e0b" onClick={() => drill('All My Orders')} />
        <MetricCard label="Verified" value={p.verified} color="#10b981" />
        <MetricCard label="Not Verified" value={p.not_verified} color="#ef4444" />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24 }}>
        <MetricCard label="Total Value" value={p.value.toFixed(0)} color={BRAND} prefix="$" />
        <MetricCard label="Processed" value={p.processed} color="#10b981" sub={p.total>0?`${Math.round(p.processed/p.total*100)}%`:''} onClick={() => drill('My Processed Orders', { disposition:'Processed' })} />
        <MetricCard label="Cancelled" value={p.cancelled} color="#ef4444" sub={p.total>0?`${Math.round(p.cancelled/p.total*100)}%`:''} onClick={() => drill('My Cancelled Orders', { disposition:'Cancelled' })} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:20 }}>
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', padding:18 }}>
          <STitle>Processed vs Cancelled Trend</STitle>
          <ResponsiveContainer width="100%" height={180}><BarChart data={(data.trend||[]).map(t => ({ ...t, date:t.date?.slice(5) }))} barSize={8}><XAxis dataKey="date" tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} /><Tooltip content={<Tip />} /><Bar dataKey="processed" name="Processed" fill="#10b981" radius={[3,3,0,0]} /><Bar dataKey="cancelled" name="Cancelled" fill="#ef4444" radius={[3,3,0,0]} /></BarChart></ResponsiveContainer>
        </div>
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', padding:18 }}>
          <STitle>By Source</STitle>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {(data.bySource||[]).filter(s=>s.source).map((s,i) => (
              <div key={s.source} onClick={() => drill(`Source: ${s.source}`)} style={{ cursor:'pointer' }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}><span style={{ color:'#475569' }}>{s.source}</span><span style={{ fontWeight:700 }}>{s.count}</span></div>
                <div style={{ height:5, background:'#f1f5f9', borderRadius:4 }}><div style={{ height:'100%', borderRadius:4, background:C[i], width:`${p.total>0?Math.round(s.count/p.total*100):0}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Overview Tab ────────────────────────────────────────────────
function AEOverviewTab({ data, loading, dateFilters, onDrilldown, onNavigate }) {
  const summary = useSummary()
  if (loading) return <Loader />
  if (!data) return <div style={{ textAlign:'center', padding:'60px 0', color:'#94a3b8', fontSize:14 }}>Could not load overview — please refresh.</div>
  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <div>
      <BentoTop summary={summary} />
      <SectionLabel>Today</SectionLabel>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:24 }}>
        <MetricCard label="Leads Today" value={data.today.leads} color="#3b82f6" onClick={() => onDrilldown({ title:'My Leads Today', type:'lead', filters:{ from:todayStr, to:todayStr } })} sub={<button onClick={e => { e.stopPropagation(); onNavigate('leads') }} style={{ color:BRAND, background:'none', border:'none', cursor:'pointer', fontSize:12, padding:0, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>View all →</button>} />
        <MetricCard label="Repeat Today" value={data.today.repeat} color="#6366f1" onClick={() => onDrilldown({ title:'My Repeat Today', type:'repeat', filters:{ from:todayStr, to:todayStr } })} sub={<button onClick={e => { e.stopPropagation(); onNavigate('repeat') }} style={{ color:BRAND, background:'none', border:'none', cursor:'pointer', fontSize:12, padding:0, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>View all →</button>} />
        <MetricCard label="Orders Today" value={data.today.orders} color="#f59e0b" onClick={() => onDrilldown({ title:'My Orders Today', type:'online_order', filters:{ from:todayStr, to:todayStr } })} sub={<button onClick={e => { e.stopPropagation(); onNavigate('orders') }} style={{ color:BRAND, background:'none', border:'none', cursor:'pointer', fontSize:12, padding:0, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>View all →</button>} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', padding:18 }}>
          <STitle>📈 My Performance</STitle>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
            {[['This Month',data.month.won,data.month.total,data.month.win_rate,'#10b981'],['This Year',data.year.won,data.year.total,data.year.win_rate,BRAND],['All Time',data.all.won,data.all.total,data.all.win_rate,'#6366f1']].map(([lbl,won,total,rate,clr]) => (
              <div key={lbl} style={{ background:'#f8fafc', borderRadius:12, padding:'12px 14px', textAlign:'center' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>{lbl}</div>
                <div style={{ fontSize:20, fontWeight:800, color:clr, fontFamily:'"Bricolage Grotesque",sans-serif' }}>{won}</div>
                <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>won of {total}</div>
                <div style={{ marginTop:8, height:4, background:'#e2e8f0', borderRadius:4 }}><div style={{ height:'100%', borderRadius:4, background:clr, width:`${rate}%` }} /></div>
                <div style={{ fontSize:11, fontWeight:700, color:clr, marginTop:4 }}>{rate}%</div>
              </div>
            ))}
          </div>
          {data.weeklyTrend?.length > 0 && (
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={data.weeklyTrend.map((w,i) => ({ ...w, week:`W${i+1}` }))}>
                <XAxis dataKey="week" tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<Tip />} />
                <Line type="monotone" dataKey="total" name="Total" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="won" name="Won" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', padding:18 }}>
          <STitle>📋 My Active Pipeline</STitle>
          {!data.pipeline?.length ? <div style={{ textAlign:'center', color:'#94a3b8', padding:'32px 0' }}>No active pipeline</div> : (
            <ResponsiveContainer width="100%" height={200}><BarChart data={data.pipeline.slice(0,7)} layout="vertical" barSize={12}><XAxis type="number" tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} /><YAxis type="category" dataKey="disposition" tick={{ fontSize:10, fill:'#475569' }} axisLine={false} tickLine={false} width={100} /><Tooltip content={<Tip />} /><Bar dataKey="count" name="Count" fill={BRAND} radius={[0,4,4,0]} /></BarChart></ResponsiveContainer>
          )}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', padding:18 }}>
          <STitle>📅 My Follow-ups <span style={{ fontSize:12, color:'#94a3b8', fontWeight:400 }}>{data.followups?.overdue?.length + data.followups?.today?.length > 0 ? `⚠ ${data.followups.overdue.length + data.followups.today.length} urgent` : ''}</span></STitle>
          {[...( data.followups?.overdue||[]).map(f=>({...f,urgency:'overdue'})), ...(data.followups?.today||[]).map(f=>({...f,urgency:'today'})), ...(data.followups?.upcoming||[]).map(f=>({...f,urgency:'upcoming'}))].slice(0,6).map(fu => (
            <div key={fu.id} onClick={() => onNavigate('inquiry-detail',{id:fu.inquiry_id})} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid #f8fafc', cursor:'pointer' }}>
              <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0, background: fu.urgency==='overdue'?'#ef4444':fu.urgency==='today'?'#f59e0b':BRAND }} />
              <div style={{ flex:1 }}><div style={{ fontSize:13, fontWeight:600, color:'#0f172a' }}>{fu.customer_name}</div><div style={{ fontSize:11, color:'#64748b' }}>{fu.note}</div></div>
              <div style={{ fontSize:11, fontWeight:700, color: fu.urgency==='overdue'?'#ef4444':fu.urgency==='today'?'#f59e0b':BRAND, flexShrink:0 }}>{formatDate(fu.follow_up_date)}</div>
            </div>
          ))}
          {!data.followups?.overdue?.length && !data.followups?.today?.length && !data.followups?.upcoming?.length && <div style={{ textAlign:'center', color:'#94a3b8', padding:'20px 0', fontSize:13 }}>✅ All caught up!</div>}
        </div>

        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', padding:18 }}>
          <STitle>⚠️ Needs Attention <span style={{ fontSize:12, color:'#94a3b8', fontWeight:400 }}>No activity 7+ days</span></STitle>
          {!data.untouched?.length ? <div style={{ textAlign:'center', color:'#94a3b8', padding:'20px 0', fontSize:13 }}>✅ All up to date!</div> : data.untouched.map(inq => (
            <div key={inq.id} onClick={() => onDrilldown({ title:'Needs Attention', type:inq.type, filters:{ disposition: inq.disposition } })}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid #f8fafc', cursor:'pointer' }}>
              <div style={{ width:32, height:32, borderRadius:8, background:`${TYPE_COLORS[inq.type]}18`, color:TYPE_COLORS[inq.type], display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0 }}>{TYPE_ICONS[inq.type]}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:13, color:'#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{inq.customer_name}</div>
                <DispositionBadge disposition={inq.disposition} />
              </div>
              <div style={{ fontSize:11, color:'#94a3b8', flexShrink:0 }}>{inq.last_activity ? timeAgo(inq.last_activity) : timeAgo(inq.created_at)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main AE Dashboard ───────────────────────────────────────────
export default function AEDashboard() {
  const { user } = useAuth()
  const { navigate } = useNav()
  const [activeTab, setActiveTab] = useState('overview')
  const [preset, setPreset] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [overviewData, setOverviewData] = useState(null)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [drilldown, setDrilldown] = useState(null)
  const [newModal, setNewModal] = useState(null)

  const dateFilters = getDateFilters(preset, customFrom, customTo)

  const loadOverview = () => {
    setOverviewLoading(true)
    fetch('/api/analytics/ae', { headers: { Authorization:`Bearer ${localStorage.getItem('crm_token')}` } })
      .then(r => r.json()).then(d => { setOverviewData(d); setOverviewLoading(false) }).catch(() => setOverviewLoading(false))
  }
  useEffect(() => { loadOverview() }, [])

  const greeting = () => { const h = new Date().getHours(); return h<12?'Good morning':h<17?'Good afternoon':'Good evening' }

  const tabs = [
    { key:'overview', label:'My Overview', icon:<LayoutDashboard size={13} /> },
    { key:'leads',    label:'Leads',       icon:<Target size={13} /> },
    { key:'repeat',   label:'Repeat',      icon:<RotateCcw size={13} /> },
    { key:'orders',   label:'Orders',      icon:<ShoppingBag size={13} /> },
  ]

  return (
    <div className="page-wrap" style={{ maxWidth:1200 }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes modalIn{from{opacity:0;transform:scale(0.94) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(239,68,68,0.5)}70%{box-shadow:0 0 0 7px rgba(239,68,68,0)}100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}}
      `}</style>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display font-extrabold text-2xl text-ink-900">{greeting()}, {user.name} 👋</h1>
          <p className="text-ink-400 text-sm mt-1">{new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {[['New Lead','lead','#3b82f6'],['New Repeat','repeat','#6366f1'],['New Order','online_order','#f59e0b']].map(([label,type,color]) => (
            <button key={type} onClick={() => setNewModal(type)}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 16px', borderRadius:12, border:`1px solid ${color}30`, background:`${color}10`, color, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', transition:'all 0.15s', whiteSpace:'nowrap' }}
              onMouseEnter={e => { e.currentTarget.style.background=color; e.currentTarget.style.color='#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background=`${color}10`; e.currentTarget.style.color=color }}>
              <Plus size={12} />{label}
            </button>
          ))}
        </div>
      </div>

      {/* Date filter — always visible */}
      <DateBar preset={preset} setPreset={setPreset} customFrom={customFrom} setCustomFrom={setCustomFrom} customTo={customTo} setCustomTo={setCustomTo} />

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, background:'#f1f5f9', borderRadius:14, padding:4, marginBottom:24, width:'fit-content' }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 18px', borderRadius:10, border:'none', background:activeTab===tab.key?'#fff':'transparent', color:activeTab===tab.key?'#0f172a':'#64748b', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', boxShadow:activeTab===tab.key?'0 1px 4px rgba(0,0,0,0.08)':'none', transition:'all 0.15s', whiteSpace:'nowrap' }}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <AEOverviewTab data={overviewData} loading={overviewLoading} dateFilters={dateFilters} onDrilldown={setDrilldown} onNavigate={navigate} />}
      {activeTab === 'leads'    && <AELeadsTab    dateFilters={dateFilters} onDrilldown={setDrilldown} />}
      {activeTab === 'repeat'   && <AERepeatTab   dateFilters={dateFilters} onDrilldown={setDrilldown} />}
      {activeTab === 'orders'   && <AEOrdersTab   dateFilters={dateFilters} onDrilldown={setDrilldown} />}

      {/* Drilldown + quick edit */}
      {drilldown && <DrilldownModal {...drilldown} onClose={() => setDrilldown(null)} />}

      {newModal && <NewInquiryModal defaultType={newModal} onClose={() => setNewModal(null)} onCreated={() => { setNewModal(null); loadOverview() }} />}
    </div>
  )
}
