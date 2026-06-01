import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, AreaChart, Area } from 'recharts'
import { useNav } from '../App'
import { useAuth } from '../App'
import { formatDate, formatDateShort, timeAgo, DispositionBadge, DISPOSITIONS, PPC_OPTIONS, VERIFICATION_OPTIONS } from '../components/Badges'
import NewInquiryModal from '../components/NewInquiryModal'

const BRAND = '#00D4C8'
const C = ['#00D4C8','#3b82f6','#6366f1','#f59e0b','#ef4444','#10b981','#8b5cf6','#f97316','#ec4899','#84cc16']
const TYPE_ICONS  = { lead:'◎', repeat:'↻', online_order:'◈' }
const TYPE_COLORS = { lead:'#3b82f6', repeat:'#6366f1', online_order:'#f59e0b' }
const TYPE_LABELS = { lead:'Lead', repeat:'Repeat', online_order:'Online Order' }

const inp = { width:'100%', boxSizing:'border-box', background:'var(--input-bg)', border:'1px solid var(--border)', borderRadius:'12px', padding:'10px 14px', fontSize:'13px', color:'var(--text)', fontFamily:'"Plus Jakarta Sans",sans-serif', outline:'none', transition:'border 0.15s' }

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
    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 14px', fontSize:12, boxShadow:'0 8px 30px rgba(0,0,0,0.12)' }}>
      <div style={{ color:'var(--text-3)', marginBottom:6, fontWeight:600 }}>{label}</div>
      {payload.map(p => <div key={p.name} style={{ color:p.color||BRAND, display:'flex', gap:12, justifyContent:'space-between', marginBottom:2 }}><span>{p.name}</span><b style={{color:'var(--text)'}}>{p.value}</b></div>)}
    </div>
  )
}

function Loader() {
  return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'60px 0' }}><div style={{ width:28, height:28, borderRadius:'50%', border:`2px solid ${BRAND}`, borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} /></div>
}

// ── Metric Card ─────────────────────────────────────────────────
function MetricCard({ label, value, sub, color = BRAND, prefix = '', suffix = '', onClick }) {
  return (
    <div onClick={onClick} style={{ background:'var(--card)', borderRadius:16, border:'1px solid var(--border)', padding:'18px 20px', position:'relative', overflow:'hidden', cursor:onClick?'pointer':'default', transition:'all 0.2s', display:'flex', flexDirection:'column', justifyContent:'space-between' }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.borderColor=color; e.currentTarget.style.boxShadow=`0 8px 24px ${color}15`; e.currentTarget.style.transform='translateY(-2px)' }}}
      onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.boxShadow='none'; e.currentTarget.style.transform='none' }}>
      <div style={{ position:'absolute', top:0, left:0, width:4, height:'100%', background:color, borderRadius:'16px 0 0 16px' }} />
      {onClick && <div style={{ position:'absolute', top:12, right:14, fontSize:10, color:'var(--text-4)', fontWeight:700, transition:'color 0.2s' }}>↗ VIEW</div>}
      <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>{label}</div>
      <div style={{ fontSize:28, fontWeight:800, color:'var(--text)', fontFamily:'"Bricolage Grotesque",sans-serif', lineHeight:1 }}>{prefix}{typeof value === 'number' ? value.toLocaleString() : (value ?? '—')}{suffix}</div>
      {sub && <div style={{ fontSize:12, color:'var(--text-3)', marginTop:8, fontWeight:500 }}>{sub}</div>}
    </div>
  )
}

function CircularProgress({ percent, color, size = 60, stroke = 6, label }) {
  const r = (size - stroke) / 2
  const c = Math.PI * r * 2
  const offset = c - (percent / 100) * c
  return (
    <div style={{ position:'relative', width:size, height:size, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border-2)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" style={{ transition:'stroke-dashoffset 1s ease-out' }} />
      </svg>
      <div style={{ position:'absolute', fontSize:size*0.25, fontWeight:800, color:'var(--text)', fontFamily:'"Bricolage Grotesque",sans-serif' }}>{percent}%</div>
      {label && <div style={{ position:'absolute', bottom:-20, fontSize:11, fontWeight:600, color:'var(--text-3)', whiteSpace:'nowrap' }}>{label}</div>}
    </div>
  )
}

function STitle({ children, right }) {
  return <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
    <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:16, color:'var(--text)', letterSpacing:'-0.01em' }}>{children}</div>
    {right}
  </div>
}

// ── Date filter bar ─────────────────────────────────────────────
function DateBar({ preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo }) {
  return (
    <div style={{ marginBottom:24 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
        <div style={{ display:'flex', background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, padding:4, gap:2 }}>
          {PRESETS.map(r => (
            <button key={r.value} onClick={() => setPreset(r.value)}
              style={{ padding:'8px 14px', borderRadius:8, border:'none', background:preset===r.value?'var(--brand-dim)':'transparent', color:preset===r.value?BRAND:'var(--text-3)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', transition:'all 0.15s', whiteSpace:'nowrap' }}>
              {r.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--card)', border:`1px solid var(--border)`, borderRadius:12, padding:'6px 14px' }}>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ padding:'6px 10px', border:'1px solid var(--border-2)', background:'var(--input-bg)', color:'var(--text)', borderRadius:8, fontSize:12, outline:'none' }} />
            <span style={{ color:'var(--text-4)' }}>→</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ padding:'6px 10px', border:'1px solid var(--border-2)', background:'var(--input-bg)', color:'var(--text)', borderRadius:8, fontSize:12, outline:'none' }} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Inquiry Quick Edit Modal ─────────────────────────────────────
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
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:999999, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(5px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'var(--card)', borderRadius:20, border:'1px solid var(--border)', boxShadow:'0 32px 100px rgba(0,0,0,0.5)', width:'100%', maxWidth:660, maxHeight:'90vh', overflowY:'auto', animation:'modalIn 0.18s ease-out', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
        
        {/* Header */}
        <div style={{ padding:'20px 24px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, background:'var(--card)', zIndex:10, borderRadius:'20px 20px 0 0' }}>
          {loading ? <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:15, color:'var(--text)' }}>Loading...</div> : (
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                <span style={{ fontSize:12, fontWeight:700, color: TYPE_COLORS[inquiry?.type], background:`${TYPE_COLORS[inquiry?.type]}15`, padding:'4px 10px', borderRadius:8 }}>{TYPE_ICONS[inquiry?.type]} {TYPE_LABELS[inquiry?.type]}</span>
                <DispositionBadge disposition={inquiry?.disposition} />
              </div>
              <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:20, color:'var(--text)' }}>{inquiry?.customer_name}</div>
              {inquiry?.customer_company && <div style={{ fontSize:13, color:'var(--text-3)', marginTop:2 }}>{inquiry?.customer_company}</div>}
            </div>
          )}
          <button onClick={onClose} style={{ width:36, height:36, borderRadius:10, border:'none', background:'var(--card-2)', cursor:'pointer', fontSize:18, color:'var(--text-3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>✕</button>
        </div>

        {loading ? <Loader /> : (
          <div style={{ padding:'24px' }}>
            {/* Quick Edit Form Body (same logic, updated CSS variables) */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:8 }}>Date</div>
                <input type="date" value={customDate} onChange={e => setCustomDate(e.target.value)} style={inp} />
              </div>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:8 }}>{inquiry?.type === 'online_order' ? 'Status' : 'Disposition'}</div>
                <select value={disposition} onChange={e => setDisposition(e.target.value)} style={{ ...inp, cursor:'pointer' }}>
                  {dispositionsForType.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
            </div>

            {/* Type-specific fields */}
            {inquiry?.type === 'repeat' && (
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:8 }}>PPC or Outbound</div>
                <select value={ppcOrOutbound} onChange={e => setPpcOrOutbound(e.target.value)} style={{ ...inp, cursor:'pointer' }}>
                  <option value="">—</option>
                  {PPC_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            )}
            {inquiry?.type === 'online_order' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:8 }}>Verification</div>
                  <select value={orderRef} onChange={e => setOrderRef(e.target.value)} style={{ ...inp, cursor:'pointer' }}>
                    <option value="">—</option>
                    {VERIFICATION_OPTIONS.map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:8 }}>Order Amount</div>
                  <input value={orderAmount} onChange={e => setOrderAmount(e.target.value)} placeholder="e.g. 500" style={inp} />
                </div>
              </div>
            )}

            {/* Part Numbers */}
            <div style={{ marginBottom:16, background:'var(--card-2)', padding:16, borderRadius:14, border:'1px solid var(--border)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--text)', letterSpacing:'0.06em', textTransform:'uppercase' }}>Requirements</div>
                <button onClick={addReq} style={{ fontSize:12, color:BRAND, fontWeight:700, background:'none', border:'none', cursor:'pointer', padding:0 }}>+ Add Part</button>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {requirements.map((r, i) => (
                  <div key={i} style={{ display:'flex', gap:8 }}>
                    <input value={r.part_number} onChange={e => updateReq(i,'part_number',e.target.value)} placeholder="Part number" style={{ ...inp, flex:1 }} />
                    <input value={r.quantity} onChange={e => updateReq(i,'quantity',e.target.value)} placeholder="Qty" style={{ ...inp, width:90 }} />
                    <button onClick={() => removeReq(i)} style={{ border:'none', background:'var(--danger)', color:'#fff', borderRadius:8, cursor:'pointer', width:36, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:8 }}>Internal Notes</div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Add context..." style={{ ...inp, resize:'none' }} />
            </div>

            {error && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:12, padding:'12px 16px', fontSize:13, color:'#ef4444', marginBottom:20 }}>⚠ {error}</div>}

            {/* Save */}
            <button onClick={handleSave} disabled={saving}
              style={{ width:'100%', padding:'14px', borderRadius:12, border:'none', background:saving?'var(--card-2)':`linear-gradient(135deg, ${BRAND}, #0891b2)`, color:saving?'var(--text-4)':'#fff', fontWeight:700, fontSize:15, cursor:saving?'not-allowed':'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', marginBottom:24, boxShadow:saving?'none':`0 8px 20px ${BRAND}40`, transition:'all 0.2s' }}>
              {saving ? 'Saving changes...' : 'Save & Update Pipeline'}
            </button>

            {/* Interactive Timeline (Comments & Followups) */}
            <div style={{ borderTop:'1px solid var(--border)', paddingTop:24 }}>
              <STitle>Activity Timeline</STitle>
              
              <div style={{ background:'var(--card-2)', borderRadius:14, padding:16, border:'1px solid var(--border)', marginBottom:16 }}>
                <div style={{ display:'flex', gap:10 }}>
                  <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Type an update or comment..." onKeyDown={e => e.key==='Enter' && handleComment()} style={{ ...inp, flex:1, background:'var(--input-bg)' }} />
                  <button onClick={handleComment} disabled={sendingComment || !comment.trim()}
                    style={{ padding:'0 20px', borderRadius:10, border:'none', background:'var(--text)', color:'var(--card)', fontWeight:700, fontSize:13, cursor:'pointer', flexShrink:0 }}>
                    {sendingComment ? '...' : 'Post'}
                  </button>
                </div>
              </div>

              {inquiry?.activity?.filter(a => a.action === 'Comment').map(a => (
                <div key={a.id} style={{ display:'flex', gap:12, marginBottom:16 }}>
                   <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--brand-dim)', color:BRAND, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:12, flexShrink:0 }}>{a.user_name[0]}</div>
                   <div>
                     <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                       <span style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{a.user_name}</span>
                       <span style={{ fontSize:11, color:'var(--text-4)' }}>{timeAgo(a.created_at)}</span>
                     </div>
                     <div style={{ fontSize:14, color:'var(--text-2)', background:'var(--card-2)', padding:'10px 14px', borderRadius:'0 12px 12px 12px', border:'1px solid var(--border)' }}>{a.comment}</div>
                   </div>
                </div>
              ))}
            </div>

            {/* Add Follow-up */}
            <div style={{ borderTop:'1px solid var(--border)', paddingTop:24, marginTop:8 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>Scheduled Follow-ups</div>
                <button onClick={() => setShowFollowupForm(!showFollowupForm)} style={{ fontSize:12, color:BRAND, fontWeight:700, background:'none', border:'none', cursor:'pointer' }}>{showFollowupForm ? 'Cancel' : '+ Schedule New'}</button>
              </div>
              
              {showFollowupForm && (
                <div style={{ background:'var(--brand-dim)', borderRadius:12, padding:16, border:`1px solid ${BRAND}30`, marginBottom:16 }}>
                  <input value={newFollowup.note} onChange={e => setNewFollowup(f=>({...f,note:e.target.value}))} placeholder="What needs to be done?" style={{ ...inp, marginBottom:10, background:'var(--card)' }} />
                  <div style={{ display:'flex', gap:10 }}>
                    <input type="date" value={newFollowup.follow_up_date} onChange={e => setNewFollowup(f=>({...f,follow_up_date:e.target.value}))} style={{ ...inp, flex:1, background:'var(--card)' }} />
                    <button onClick={handleFollowup} style={{ padding:'0 20px', borderRadius:10, border:'none', background:BRAND, color:'#000', fontWeight:700, fontSize:13, cursor:'pointer' }}>Confirm</button>
                  </div>
                </div>
              )}

              {inquiry?.followups?.filter(f => !f.completed).map(fu => {
                const isOverdue = new Date(fu.follow_up_date) < new Date(new Date().setHours(0,0,0,0));
                return (
                  <div key={fu.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px', border:'1px solid var(--border)', borderRadius:12, marginBottom:8, background:'var(--card-2)' }}>
                    <div style={{ width:10, height:10, borderRadius:'50%', background: isOverdue ? '#ef4444' : BRAND, flexShrink:0, boxShadow:`0 0 8px ${isOverdue ? '#ef4444' : BRAND}` }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>{fu.note}</div>
                      <div style={{ fontSize:12, color:isOverdue?'#ef4444':BRAND, fontWeight:600, marginTop:4 }}>Due: {formatDate(fu.follow_up_date)}</div>
                    </div>
                  </div>
                )
              })}
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
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(5px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'var(--card)', borderRadius:20, border:'1px solid var(--border)', boxShadow:'0 32px 100px rgba(0,0,0,0.5)', width:'100%', maxWidth:1000, maxHeight:'85vh', display:'flex', flexDirection:'column', animation:'modalIn 0.18s ease-out', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
        
        <div style={{ padding:'20px 24px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, background:'var(--card-2)', borderRadius:'20px 20px 0 0' }}>
          <div>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:20, color:'var(--text)', letterSpacing:'-0.01em' }}>{title}</div>
            <div style={{ fontSize:13, color:'var(--text-3)', marginTop:4, fontWeight:500 }}>{loading ? 'Fetching records...' : `${rows.length} records found`}</div>
          </div>
          <button onClick={onClose} style={{ width:36, height:36, borderRadius:10, border:'1px solid var(--border)', background:'var(--card)', cursor:'pointer', fontSize:18, color:'var(--text-2)', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s' }} onMouseEnter={e=>e.currentTarget.style.background='var(--brand-dim)'} onMouseLeave={e=>e.currentTarget.style.background='var(--card)'}>✕</button>
        </div>

        <div style={{ overflowY:'auto', flex:1, padding:20 }}>
          {loading ? <Loader /> : rows.length === 0 ? (
            <div style={{ textAlign:'center', padding:80, color:'var(--text-4)' }}>
              <div style={{ fontSize:40, marginBottom:16 }}>📭</div>
              <div style={{ fontSize:16, fontWeight:600, color:'var(--text-3)' }}>No records match this criteria.</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {rows.map((r) => (
                <div key={r.id} style={{ display:'flex', alignItems:'center', background:'var(--card-2)', border:'1px solid var(--border)', borderRadius:14, padding:'16px 20px', gap:20, transition:'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor=BRAND; e.currentTarget.style.transform='translateX(4px)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='none' }}>
                  
                  <div style={{ flexShrink:0, width:90 }}>
                    <div style={{ fontSize:11, color:'var(--text-4)', textTransform:'uppercase', fontWeight:700, marginBottom:4 }}>Created</div>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', fontFamily:'monospace' }}>{formatDateShort(r.created_at)}</div>
                  </div>
                  
                  <div style={{ flex:1, minWidth:200 }}>
                    <div style={{ fontSize:15, fontWeight:800, color:'var(--text)', marginBottom:4 }}>{r.customer_name}</div>
                    <div style={{ fontSize:12, color:'var(--text-3)' }}>{r.customer_company||'No Company Listed'}</div>
                  </div>

                  <div style={{ flexShrink:0, width:140 }}>
                     <DispositionBadge disposition={r.disposition} />
                  </div>

                  <div style={{ flex:1.5, minWidth:0 }}>
                    <div style={{ fontSize:11, color:'var(--text-4)', textTransform:'uppercase', fontWeight:700, marginBottom:4 }}>Requirements</div>
                    <div style={{ fontSize:13, color:'var(--text-2)', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.requirements?.map(req => req.part_number).join(', ')||'—'}</div>
                  </div>

                  <button onClick={() => setEditingId(r.id)}
                    style={{ padding:'8px 16px', borderRadius:10, border:`1px solid ${BRAND}40`, background:`${BRAND}15`, color:BRAND, fontSize:13, fontWeight:700, cursor:'pointer', flexShrink:0, transition:'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.background=BRAND; e.currentTarget.style.color='#000' }}
                    onMouseLeave={e => { e.currentTarget.style.background=`${BRAND}15`; e.currentTarget.style.color=BRAND }}>
                    Open File →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
  if (!data || data.error) return null
  const p = data.period
  const trendData = (data.trend||[]).map(t => ({ ...t, date: t.date?.slice(5) }))
  const drill = (title, extra={}) => onDrilldown({ title, type:'lead', filters:{ ...dateFilters, ...extra }})

  return (
    <div style={{ animation:'modalIn 0.3s ease-out' }}>
      <STitle>Today's Snapshot</STitle>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:32 }}>
        <MetricCard label="New Leads" value={data.today.total} color="#3b82f6" onClick={() => drill('My Leads Today', { from: new Date().toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] })} />
        <MetricCard label="Period Win Rate" value={`${p.win_rate}%`} color={BRAND} sub={`${p.closed_won} won out of ${p.total} total`} />
        <MetricCard label="In Progress" value={p.in_progress} color="#f59e0b" onClick={() => drill('My In Progress Leads')} />
      </div>

      <STitle>Period Pipeline Overview</STitle>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:16 }}>
        <MetricCard label="Total Leads" value={p.total} color="#3b82f6" onClick={() => drill('All My Leads')} />
        <MetricCard label="Closed Won" value={p.closed_won} color="#10b981" onClick={() => drill('My Closed Won Leads', { disposition:'Closed Won' })} />
        <MetricCard label="Closed Lost" value={p.closed_lost} color="#ef4444" onClick={() => drill('My Closed Lost Leads', { disposition:'Closed Lost' })} />
        <MetricCard label="Quoted" value={p.quoted} color="#6366f1" onClick={() => drill('My Quoted Leads', { disposition:'Quoted' })} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:32 }}>
        <MetricCard label="Bidding" value={p.bidding} color="#8b5cf6" onClick={() => drill('My Bidding Leads', { disposition:'Bidding' })} />
        <MetricCard label="Fake Leads" value={p.fake} color="var(--text-4)" onClick={() => drill('My Fake Leads', { disposition:'Fake Lead' })} />
        <MetricCard label="No Response" value={p.no_response} color="var(--text-3)" onClick={() => drill('No Response', { disposition:'No response' })} />
        <MetricCard label="Cold" value={(p.cold||0)} color="var(--text-4)" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:24, marginBottom:24 }}>
        <div style={{ background:'var(--card)', borderRadius:16, border:'1px solid var(--border)', padding:24 }}>
          <STitle>Conversion Trend (Total vs Won)</STitle>
          {trendData.length === 0 ? <div style={{ height:200, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-4)' }}>No trend data available</div> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={trendData} barSize={10} barGap={4}>
                <XAxis dataKey="date" tick={{ fontSize:11, fill:'var(--text-3)', fontWeight:600 }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{ fontSize:11, fill:'var(--text-3)', fontWeight:600 }} axisLine={false} tickLine={false} allowDecimals={false} dx={-10} />
                <Tooltip content={<Tip />} cursor={{ fill:'var(--card-2)' }} />
                <Bar dataKey="total" name="Total Inquiries" fill="var(--border-2)" radius={[4,4,0,0]} />
                <Bar dataKey="won" name="Successfully Won" fill={BRAND} radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        
        <div style={{ background:'var(--card)', borderRadius:16, border:'1px solid var(--border)', padding:24 }}>
          <STitle>Lead Sources</STitle>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {(data.bySource||[]).filter(s=>s.source).slice(0,6).map((s,i) => (
              <div key={s.source} onClick={() => drill(`Source: ${s.source}`)} style={{ cursor:'pointer', group:'true' }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6, fontWeight:600 }}><span style={{ color:'var(--text)' }}>{s.source}</span><span style={{ color:'var(--text-2)' }}>{s.count}</span></div>
                <div style={{ height:6, background:'var(--card-2)', borderRadius:6, overflow:'hidden' }}><div style={{ height:'100%', background:C[i%C.length], width:`${p.total>0?Math.round(s.count/p.total*100):0}%`, transition:'width 1s ease-out' }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Repeat Tab ──────────────────────────────────────────────────
function AERepeatTab({ dateFilters, onDrilldown }) {
  const { data, loading } = useModuleData('repeat', dateFilters)
  if (loading) return <Loader />
  if (!data || data.error) return null
  const p = data.period
  const drill = (title, extra={}) => onDrilldown({ title, type:'repeat', filters:{ ...dateFilters, ...extra }})

  return (
    <div style={{ animation:'modalIn 0.3s ease-out' }}>
      <STitle>Today's Activity</STitle>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:32 }}>
        <MetricCard label="Repeat Inquiries" value={data.today.total} color="#6366f1" onClick={() => drill('My Repeat Today', { from: new Date().toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] })} />
        <MetricCard label="PPC Sourced" value={p.ppc} color="#3b82f6" onClick={() => drill('My PPC Inquiries')} />
        <MetricCard label="Outbound Sourced" value={p.outbound} color="#8b5cf6" onClick={() => drill('My Outbound Inquiries')} />
      </div>

      <STitle>Period Overview</STitle>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:32 }}>
        <MetricCard label="Total Inquiries" value={p.total} color="#6366f1" onClick={() => drill('All My Repeat Inquiries')} />
        <MetricCard label="Successfully Closed" value={p.closed_won} color="#10b981" onClick={() => drill('My Closed Won Repeat', { disposition:'Closed Won' })} />
        <MetricCard label="Win Rate" value={`${p.win_rate}%`} color={BRAND} />
        <MetricCard label="Sourcing Split" value={`${p.ppc} / ${p.outbound}`} sub="PPC vs Outbound" color="#8b5cf6" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, marginBottom:24 }}>
        <div style={{ background:'var(--card)', borderRadius:16, border:'1px solid var(--border)', padding:24 }}>
          <STitle>Disposition Spread</STitle>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {(data.byDisposition||[]).slice(0,8).map((d,i) => (
              <div key={d.disposition} onClick={() => drill(d.disposition, { disposition:d.disposition })} style={{ cursor:'pointer' }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6, fontWeight:600 }}><span style={{ color:'var(--text)' }}>{d.disposition||'Uncategorized'}</span><span style={{ color:'var(--text-2)' }}>{d.count}</span></div>
                <div style={{ height:6, background:'var(--card-2)', borderRadius:6, overflow:'hidden' }}><div style={{ height:'100%', background:C[i%C.length], width:`${p.total>0?Math.round(d.count/p.total*100):0}%`, transition:'width 1s ease-out' }} /></div>
              </div>
            ))}
          </div>
        </div>
        
        <div style={{ background:'var(--card)', borderRadius:16, border:'1px solid var(--border)', padding:24 }}>
          <STitle>Inquiry Flow</STitle>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={(data.trend||[]).map(t => ({ ...t, date:t.date?.slice(5) }))}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize:11, fill:'var(--text-3)', fontWeight:600 }} axisLine={false} tickLine={false} dy={10} />
              <YAxis tick={{ fontSize:11, fill:'var(--text-3)', fontWeight:600 }} axisLine={false} tickLine={false} allowDecimals={false} dx={-10}/>
              <Tooltip content={<Tip />} />
              <Area type="monotone" dataKey="total" name="Total Repeat" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
            </AreaChart>
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
  if (!data || data.error) return null
  const t = data.today; const p = data.period
  const drill = (title, extra={}) => onDrilldown({ title, type:'online_order', filters:{ ...dateFilters, ...extra }})

  return (
    <div style={{ animation:'modalIn 0.3s ease-out' }}>
      <STitle>Today's Action</STitle>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:16 }}>
        <MetricCard label="Orders Logged" value={t.total} color="#f59e0b" onClick={() => drill('My Orders Today', { from: new Date().toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] })} />
        <MetricCard label="Total Value" value={t.value.toFixed(0)} color={BRAND} prefix="$" />
        <MetricCard label="Processed" value={t.processed} color="#10b981" onClick={() => drill('My Processed Orders Today', { from: new Date().toISOString().split('T')[0], to: new Date().toISOString().split('T')[0], disposition:'Processed' })} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:32 }}>
        <MetricCard label="Verified Safe" value={t.verified} color="#10b981" />
        <MetricCard label="Pending Verification" value={t.not_verified} color="var(--text-3)" />
        <MetricCard label="Cancelled/Fake" value={t.cancelled} color="#ef4444" />
      </div>

      <STitle>Period Analysis</STitle>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:16, marginBottom:32 }}>
        <MetricCard label="Orders" value={p.total} color="#f59e0b" onClick={() => drill('All My Orders')} />
        <MetricCard label="Value" value={p.value.toFixed(0)} color={BRAND} prefix="$" />
        <MetricCard label="Processed" value={p.processed} color="#10b981" sub={p.total>0?`${Math.round(p.processed/p.total*100)}% Conversion`:''} onClick={() => drill('My Processed Orders', { disposition:'Processed' })} />
        <MetricCard label="Cancelled" value={p.cancelled} color="#ef4444" onClick={() => drill('My Cancelled Orders', { disposition:'Cancelled' })} />
        <MetricCard label="Verified" value={p.verified} color="#10b981" />
        <MetricCard label="Unverified" value={p.not_verified} color="var(--text-4)" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:24 }}>
        <div style={{ background:'var(--card)', borderRadius:16, border:'1px solid var(--border)', padding:24 }}>
          <STitle>Processed vs Cancelled Ratio</STitle>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={(data.trend||[]).map(t => ({ ...t, date:t.date?.slice(5) }))} barSize={12} barGap={4}>
              <XAxis dataKey="date" tick={{ fontSize:11, fill:'var(--text-3)', fontWeight:600 }} axisLine={false} tickLine={false} dy={10} />
              <YAxis tick={{ fontSize:11, fill:'var(--text-3)', fontWeight:600 }} axisLine={false} tickLine={false} allowDecimals={false} dx={-10} />
              <Tooltip content={<Tip />} cursor={{ fill:'var(--card-2)' }} />
              <Bar dataKey="processed" name="Successfully Processed" fill="#10b981" radius={[4,4,0,0]} />
              <Bar dataKey="cancelled" name="Cancelled" fill="#ef4444" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        <div style={{ background:'var(--card)', borderRadius:16, border:'1px solid var(--border)', padding:24 }}>
          <STitle>Order Origination</STitle>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {(data.bySource||[]).filter(s=>s.source).map((s,i) => (
              <div key={s.source} onClick={() => drill(`Source: ${s.source}`)} style={{ cursor:'pointer' }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6, fontWeight:600 }}><span style={{ color:'var(--text)' }}>{s.source}</span><span style={{ color:'var(--text-2)' }}>{s.count}</span></div>
                <div style={{ height:6, background:'var(--card-2)', borderRadius:6, overflow:'hidden' }}><div style={{ height:'100%', background:C[i%C.length], width:`${p.total>0?Math.round(s.count/p.total*100):0}%`, transition:'width 1s ease-out' }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Overview Tab ────────────────────────────────────────────────
function AEOverviewTab({ data, dateFilters, onDrilldown, onNavigate }) {
  if (!data || data.error) return <Loader />
  const todayStr = new Date().toISOString().split('T')[0]
  
  const qRev = data.quarterAchievement?.revenue || 0
  const qTarget = data.target?.revenue_target || 0
  const qRevPct = qTarget > 0 ? Math.min(Math.round((qRev/qTarget)*100), 100) : 0

  const allFollowups = [
    ...(data.followups?.overdue||[]).map(f=>({...f, status:'overdue', clr:'#ef4444'})),
    ...(data.followups?.today||[]).map(f=>({...f, status:'today', clr:'#f59e0b'})),
    ...(data.followups?.upcoming||[]).map(f=>({...f, status:'upcoming', clr:BRAND}))
  ].sort((a,b) => new Date(a.follow_up_date) - new Date(b.follow_up_date))

  return (
    <div style={{ animation:'modalIn 0.3s ease-out' }}>
      
      {/* Target Achievement Row */}
      {data.target && (
        <div style={{ display:'flex', gap:24, marginBottom:32 }}>
          <div style={{ flex:1, background:'var(--card)', borderRadius:16, border:'1px solid var(--border)', padding:24, display:'flex', alignItems:'center', gap:32, boxShadow:'0 12px 40px rgba(0,0,0,0.05)' }}>
            <CircularProgress percent={qRevPct} color={BRAND} size={110} stroke={10} label="REVENUE TARGET" />
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>Quarterly Pace</div>
              <div style={{ display:'flex', alignItems:'baseline', gap:12 }}>
                <span style={{ fontSize:36, fontWeight:800, color:'var(--text)', fontFamily:'"Bricolage Grotesque",sans-serif', lineHeight:1 }}>${qRev.toLocaleString()}</span>
                <span style={{ fontSize:16, color:'var(--text-3)', fontWeight:600 }}>/ ${qTarget.toLocaleString()}</span>
              </div>
            </div>
          </div>
          
          <div style={{ flex:1, background:'var(--card)', borderRadius:16, border:'1px solid var(--border)', padding:24, display:'flex', alignItems:'center', gap:32 }}>
            <CircularProgress percent={data.all.win_rate} color="#10b981" size={110} stroke={10} label="ALL-TIME WIN RATE" />
            <div style={{ width:'100%' }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>Historical Conversion</div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                <span style={{ fontSize:14, color:'var(--text-2)', fontWeight:600 }}>Successfully Won</span>
                <span style={{ fontSize:14, color:'#10b981', fontWeight:800 }}>{data.all.won}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', paddingTop:8, borderTop:'1px solid var(--border)' }}>
                <span style={{ fontSize:14, color:'var(--text-2)', fontWeight:600 }}>Total Opportunities</span>
                <span style={{ fontSize:14, color:'var(--text)', fontWeight:800 }}>{data.all.total}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Center Row */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, marginBottom:32 }}>
        
        {/* Urgent Follow-ups */}
        <div style={{ background:'var(--card)', borderRadius:16, border:'1px solid var(--border)', padding:24, display:'flex', flexDirection:'column' }}>
          <STitle right={<span style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444', padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:800 }}>{allFollowups.filter(f=>f.status!=='upcoming').length} PENDING</span>}>Priority Action Items</STitle>
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:10 }}>
            {allFollowups.length === 0 ? (
              <div style={{ margin:'auto', textAlign:'center', color:'var(--text-4)' }}>
                <div style={{ fontSize:32, marginBottom:10 }}>🎯</div>
                <div style={{ fontSize:14, fontWeight:600 }}>Inbox Zero</div>
                <div style={{ fontSize:12 }}>No pending follow-ups.</div>
              </div>
            ) : allFollowups.slice(0, 6).map(fu => (
              <div key={fu.id} onClick={() => onNavigate('inquiry-detail',{id:fu.inquiry_id})} 
                style={{ display:'flex', alignItems:'center', gap:14, padding:'14px', background:'var(--card-2)', border:'1px solid var(--border)', borderRadius:12, cursor:'pointer', transition:'all 0.2s' }}
                onMouseEnter={e=>e.currentTarget.style.borderColor=fu.clr}
                onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
                <div style={{ width:10, height:10, borderRadius:'50%', flexShrink:0, background:fu.clr, boxShadow:`0 0 10px ${fu.clr}80` }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                    <span style={{ fontSize:14, fontWeight:800, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{fu.customer_name}</span>
                    <span style={{ fontSize:11, fontWeight:800, color:fu.clr, background:`${fu.clr}15`, padding:'2px 8px', borderRadius:8 }}>{formatDate(fu.follow_up_date)}</span>
                  </div>
                  <div style={{ fontSize:12, color:'var(--text-3)', fontWeight:500 }}>{fu.note}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stale Leads */}
        <div style={{ background:'var(--card)', borderRadius:16, border:'1px solid var(--border)', padding:24, display:'flex', flexDirection:'column' }}>
          <STitle right={<span style={{ background:'var(--card-2)', color:'var(--text-3)', padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:800 }}>7+ DAYS STALE</span>}>Pipeline At Risk</STitle>
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:10 }}>
            {!data.untouched?.length ? (
              <div style={{ margin:'auto', textAlign:'center', color:'var(--text-4)' }}>
                <div style={{ fontSize:32, marginBottom:10 }}>✨</div>
                <div style={{ fontSize:14, fontWeight:600 }}>Perfect Health</div>
                <div style={{ fontSize:12 }}>All active leads have recent touchpoints.</div>
              </div>
            ) : data.untouched.map(inq => (
              <div key={inq.id} onClick={() => onDrilldown({ title:'Stale Pipeline', type:inq.type, filters:{ disposition: inq.disposition } })}
                style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 14px', background:'var(--card-2)', border:'1px solid var(--border)', borderRadius:12, cursor:'pointer', transition:'all 0.2s' }}
                onMouseEnter={e=>e.currentTarget.style.borderColor='var(--text-3)'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
                <div style={{ width:36, height:36, borderRadius:10, background:`${TYPE_COLORS[inq.type]}18`, color:TYPE_COLORS[inq.type], display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>{TYPE_ICONS[inq.type]}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:800, fontSize:14, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:4 }}>{inq.customer_name}</div>
                  <DispositionBadge disposition={inq.disposition} />
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'var(--text-4)', textTransform:'uppercase', marginBottom:4 }}>Last touch</div>
                  <div style={{ fontSize:12, color:'#ef4444', fontWeight:700 }}>{inq.last_activity ? timeAgo(inq.last_activity) : timeAgo(inq.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pipeline Health */}
      <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:24, marginBottom:24 }}>
        <div style={{ background:'var(--card)', borderRadius:16, border:'1px solid var(--border)', padding:24 }}>
          <STitle>Active Pipeline Spread</STitle>
          {!data.pipeline?.length ? <div style={{ textAlign:'center', color:'var(--text-4)', padding:'40px 0' }}>No active opportunities</div> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.pipeline.slice(0,8)} layout="vertical" barSize={16} margin={{ left:40, right:20 }}>
                <XAxis type="number" tick={{ fontSize:11, fill:'var(--text-3)', fontWeight:600 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="disposition" tick={{ fontSize:12, fill:'var(--text)', fontWeight:600 }} axisLine={false} tickLine={false} width={120} dx={-10} />
                <Tooltip content={<Tip />} cursor={{ fill:'var(--card-2)' }} />
                <Bar dataKey="count" name="Opportunities" fill={`url(#brandGrad)`} radius={[0,8,8,0]}>
                   <defs>
                    <linearGradient id="brandGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#0891b2" />
                      <stop offset="100%" stopColor={BRAND} />
                    </linearGradient>
                  </defs>
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
           <MetricCard label="Total Booked (All Time)" value={data.totalRevenue} color="#10b981" prefix="$" />
           <MetricCard label="Current Month Win Rate" value={`${data.month.win_rate}%`} sub={`${data.month.won} of ${data.month.total} processed`} color={BRAND} />
           <div style={{ flex:1, background:'var(--brand-dim)', borderRadius:16, border:`1px solid ${BRAND}30`, padding:20, display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center', textAlign:'center' }}>
              <div style={{ fontSize:12, fontWeight:700, color:BRAND, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>Quick Actions</div>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center' }}>
                 <button onClick={() => onNavigate('leads')} style={{ padding:'8px 16px', borderRadius:10, background:'var(--card)', color:'var(--text)', border:'1px solid var(--border)', fontSize:13, fontWeight:600, cursor:'pointer' }}>View All Leads →</button>
                 <button onClick={() => onNavigate('orders')} style={{ padding:'8px 16px', borderRadius:10, background:'var(--card)', color:'var(--text)', border:'1px solid var(--border)', fontSize:13, fontWeight:600, cursor:'pointer' }}>View All Orders →</button>
              </div>
           </div>
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
  const [preset, setPreset] = useState('month') // Default to month so they see active data
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
      .then(r => r.json())
      .then(d => {
        if (d.error) {
          console.error("API Error:", d.error);
          setOverviewData(null);
        } else {
          setOverviewData(d);
        }
        setOverviewLoading(false);
      })
      .catch((err) => {
        console.error("Fetch Error:", err);
        setOverviewData(null);
        setOverviewLoading(false);
      })
  }
  useEffect(() => { loadOverview() }, [])

  const greeting = () => { const h = new Date().getHours(); return h<12?'Good morning':h<17?'Good afternoon':'Good evening' }

  const tabs = [
    { key:'overview', label:'▣ Mission Control' },
    { key:'leads',    label:'◎ Lead Funnel'     },
    { key:'repeat',   label:'↻ Repeat Bookings' },
    { key:'orders',   label:'◈ Web Orders'      },
  ]

  return (
    <div style={{ padding:40, maxWidth:1300, margin:'0 auto', fontFamily:'"Plus Jakarta Sans",sans-serif', width:'100%' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes modalIn{from{opacity:0;transform:scale(0.96) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:32, flexWrap:'wrap', gap:20 }}>
        <div>
          <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:32, color:'var(--text)', margin:0, letterSpacing:'-0.02em' }}>{greeting()}, {user.name}</h1>
          <p style={{ color:'var(--text-3)', fontSize:15, marginTop:8, fontWeight:500 }}>Here is your active pipeline for {new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}.</p>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          {[['◎ Log Lead','lead','#3b82f6'],['↻ Log Repeat','repeat','#6366f1'],['◈ Log Order','online_order','#f59e0b']].map(([label,type,color]) => (
            <button key={type} onClick={() => setNewModal(type)}
              style={{ padding:'10px 18px', borderRadius:12, border:`1px solid ${color}40`, background:`${color}15`, color, fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', transition:'all 0.2s', whiteSpace:'nowrap', boxShadow:`0 4px 12px ${color}10` }}
              onMouseEnter={e => { e.currentTarget.style.background=color; e.currentTarget.style.color='#fff'; e.currentTarget.style.transform='translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.background=`${color}15`; e.currentTarget.style.color=color; e.currentTarget.style.transform='none' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters & Tabs Strip */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:32, borderBottom:'1px solid var(--border)', paddingBottom:16 }}>
        <div style={{ display:'flex', gap:4 }}>
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{ padding:'10px 20px', borderRadius:10, border:'none', background:activeTab===tab.key?'var(--text)':'transparent', color:activeTab===tab.key?'var(--bg)':'var(--text-3)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', transition:'all 0.2s', whiteSpace:'nowrap' }}
              onMouseEnter={e => { if(activeTab!==tab.key) e.currentTarget.style.color='var(--text)' }}
              onMouseLeave={e => { if(activeTab!==tab.key) e.currentTarget.style.color='var(--text-3)' }}>
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Date filter shifted right, inline with tabs */}
        <div style={{ marginBottom: '-24px' }}>
           <DateBar preset={preset} setPreset={setPreset} customFrom={customFrom} setCustomFrom={setCustomFrom} customTo={customTo} setCustomTo={setCustomTo} />
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <AEOverviewTab data={overviewData} dateFilters={dateFilters} onDrilldown={setDrilldown} onNavigate={navigate} />}
      {activeTab === 'leads'    && <AELeadsTab    dateFilters={dateFilters} onDrilldown={setDrilldown} />}
      {activeTab === 'repeat'   && <AERepeatTab   dateFilters={dateFilters} onDrilldown={setDrilldown} />}
      {activeTab === 'orders'   && <AEOrdersTab   dateFilters={dateFilters} onDrilldown={setDrilldown} />}

      {/* Drilldown + quick edit */}
      {drilldown && <DrilldownModal {...drilldown} onClose={() => setDrilldown(null)} />}

      {newModal && <NewInquiryModal defaultType={newModal} onClose={() => setNewModal(null)} onCreated={() => { setNewModal(null); loadOverview() }} />}
    </div>
  )
}