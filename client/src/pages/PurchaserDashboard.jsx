import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { purchasingApi } from '../api'
import { useAuth } from '../App'
import { formatDate, formatDateShort, timeAgo } from '../components/Badges'

const BRAND = '#00D4C8'
const T = { lead:{ icon:'◎', label:'Lead', color:'#3b82f6' }, repeat:{ icon:'↻', label:'Repeat', color:'#6366f1' }, online_order:{ icon:'◈', label:'Order', color:'#f59e0b' } }
const URGENCY = { critical:{ label:'🔴 Critical', color:'#ef4444', bg:'#fef2f2', border:'#fecaca' }, high:{ label:'🟠 High', color:'#f97316', bg:'#fff7ed', border:'#fed7aa' }, normal:{ label:'🟡 Normal', color:'var(--text-2)', bg:'var(--card-2)', border:'#e2e8f0' }, low:{ label:'🟢 Low', color:'#10b981', bg:'#f0fdf4', border:'#bbf7d0' } }
const CONDITIONS = ['New','Used','Refurbished','For Parts','Other']
const inp = { width:'100%', boxSizing:'border-box', background:'var(--input-bg)', border:'1px solid var(--input-border)', borderRadius:'12px', padding:'10px 14px', fontSize:'13px', color:'var(--text)', fontFamily:'"Plus Jakarta Sans",sans-serif', outline:'none', transition:'border 0.15s' }
const inpF = { border:`1px solid ${BRAND}`, boxShadow:`0 0 0 3px rgba(0,212,200,0.12)` }

const PRESETS = [{ label:'Today',v:'today' },{ label:'Week',v:'week' },{ label:'Month',v:'month' },{ label:'All',v:'all' },{ label:'Custom',v:'custom' }]
function getDateRange(preset, from, to) {
  const fmt = d => d.toISOString().split('T')[0]; const now = new Date(); const today = fmt(now)
  if (preset==='today') return { from:today, to:today }
  if (preset==='week') { const d=new Date(now); d.setDate(d.getDate()-7); return { from:fmt(d), to:today } }
  if (preset==='month') { const d=new Date(now); d.setDate(1); return { from:fmt(d), to:today } }
  if (preset==='custom') return { from, to }
  return { from:'', to:'' }
}

function SInput({ value, onChange, placeholder, type='text' }) {
  const [f,setF] = useState(false)
  return <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={{ ...inp, ...(f?inpF:{}) }} onFocus={()=>setF(true)} onBlur={()=>setF(false)} />
}
function STextarea({ value, onChange, placeholder }) {
  const [f,setF] = useState(false)
  return <textarea value={value} onChange={onChange} placeholder={placeholder} rows={2} style={{ ...inp, resize:'none', ...(f?inpF:{}) }} onFocus={()=>setF(true)} onBlur={()=>setF(false)} />
}

function Pagination({ page, pages, onChange }) {
  if (pages<=1) return null
  return (
    <div style={{ display:'flex', gap:8, justifyContent:'center', padding:'12px 0', alignItems:'center' }}>
      <button onClick={()=>onChange(page-1)} disabled={page===1} style={{ padding:'5px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--card)', color:page===1?'#cbd5e1':'#475569', cursor:page===1?'not-allowed':'pointer', fontSize:12, fontWeight:600, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>← Prev</button>
      <span style={{ fontSize:12, color:'var(--text-2)' }}>Page {page} of {pages}</span>
      <button onClick={()=>onChange(page+1)} disabled={page===pages} style={{ padding:'5px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--card)', color:page===pages?'#cbd5e1':'#475569', cursor:page===pages?'not-allowed':'pointer', fontSize:12, fontWeight:600, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Next →</button>
    </div>
  )
}

// Full part detail modal
function PartDetailModal({ assignmentId, onClose, onSaved }) {
  const { user } = useAuth()
  const [part, setPart] = useState(null)
  const [tab, setTab] = useState('quote')
  const [price, setPrice] = useState(''); const [condition, setCondition] = useState(''); const [customCond, setCustomCond] = useState('')
  const [leadTime, setLeadTime] = useState(''); const [supplier, setSupplier] = useState(''); const [quoteNotes, setQuoteNotes] = useState('')
  const [purchaserNotes, setPurchaserNotes] = useState(''); const [savingNotes, setSavingNotes] = useState(false)
  const [comment, setComment] = useState(''); const [sendingComment, setSendingComment] = useState(false)
  const [followupNote, setFollowupNote] = useState(''); const [followupDate, setFollowupDate] = useState(''); const [savingFollowup, setSavingFollowup] = useState(false)
  const [saving, setSaving] = useState(false); const [error, setError] = useState('')

  const load = () => {
    fetch(`/api/purchasing/part/${assignmentId}`, { headers:{ Authorization:`Bearer ${localStorage.getItem('crm_token')}` } })
      .then(r=>r.json()).then(d => {
        setPart(d); setPrice(d.price||''); setCondition(d.condition||''); setLeadTime(d.lead_time||''); setSupplier(d.supplier_name||''); setQuoteNotes(d.quote_notes||''); setPurchaserNotes(d.purchaser_notes||'')
      })
  }
  useEffect(() => { load() }, [assignmentId])

  const handleQuoteSubmit = async () => {
    if (!price) return setError('Price is required')
    if (!condition) return setError('Select a condition')
    const finalCond = condition==='Other' ? customCond : condition
    setSaving(true); setError('')
    const res = await purchasingApi.submitQuote({ assignment_id: assignmentId, price, condition:finalCond, lead_time:leadTime, supplier_name:supplier, notes:quoteNotes })
    if (res.error) setError(res.error)
    else { load(); onSaved() }
    setSaving(false)
  }

  const handleSaveNotes = async () => {
    setSavingNotes(true)
    await fetch(`/api/purchasing/assignment/${assignmentId}`, { method:'PATCH', headers:{ Authorization:`Bearer ${localStorage.getItem('crm_token')}`, 'Content-Type':'application/json' }, body:JSON.stringify({ purchaser_notes: purchaserNotes }) })
    setSavingNotes(false)
  }

  const handleMarkNotInStock = async () => {
    await fetch(`/api/purchasing/assignment/${assignmentId}`, { method:'PATCH', headers:{ Authorization:`Bearer ${localStorage.getItem('crm_token')}`, 'Content-Type':'application/json' }, body:JSON.stringify({ not_in_stock: !part.not_in_stock }) })
    load(); onSaved()
  }

  const handleComment = async () => {
    if (!comment.trim()) return
    setSendingComment(true)
    await fetch(`/api/purchasing/comment/${assignmentId}`, { method:'POST', headers:{ Authorization:`Bearer ${localStorage.getItem('crm_token')}`, 'Content-Type':'application/json' }, body:JSON.stringify({ comment }) })
    setComment(''); setSendingComment(false); load()
  }

  const handleFollowup = async () => {
    if (!followupNote.trim()) return
    setSavingFollowup(true)
    await fetch(`/api/purchasing/followup/${assignmentId}`, { method:'POST', headers:{ Authorization:`Bearer ${localStorage.getItem('crm_token')}`, 'Content-Type':'application/json' }, body:JSON.stringify({ note:followupNote, follow_up_date:followupDate }) })
    setFollowupNote(''); setFollowupDate(''); setSavingFollowup(false); load()
  }

  const completeFollowup = async (id) => {
    await fetch(`/api/purchasing/followup/${id}/complete`, { method:'PATCH', headers:{ Authorization:`Bearer ${localStorage.getItem('crm_token')}` } })
    load()
  }

  if (!part) return createPortal(
    <div style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'var(--card)', borderRadius:20, padding:40, color:'var(--text-3)' }}>Loading...</div>
    </div>, document.body
  )

  const tInfo = T[part.inquiry_type]
  const urgInfo = URGENCY[part.urgency||'normal']
  const isOver = part.is_over_selling

  return createPortal(
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'var(--card)', borderRadius:20, boxShadow:'0 24px 80px rgba(0,0,0,0.25)', width:'100%', maxWidth:640, maxHeight:'92vh', display:'flex', flexDirection:'column', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
        <style>{`@keyframes modalIn{from{opacity:0;transform:scale(0.96) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>

        {/* Header */}
        <div style={{ padding:'16px 22px 12px', borderBottom:'1px solid var(--border)', flexShrink:0, background: part.is_delayed?'#fff5f5':part.not_in_stock?'var(--card-2)':'var(--card)', borderRadius:'20px 20px 0 0' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                <span style={{ fontFamily:'monospace', fontWeight:800, fontSize:16, color:'var(--text)' }}>{part.part_number}</span>
                <span style={{ fontSize:12, fontWeight:600, color:tInfo?.color, background:`${tInfo?.color}15`, padding:'2px 8px', borderRadius:6 }}>{tInfo?.icon} {tInfo?.label}</span>
                <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:12, background:urgInfo.bg, color:urgInfo.color, border:`1px solid ${urgInfo.border}` }}>{urgInfo.label}</span>
                {part.is_delayed && <span style={{ fontSize:11, fontWeight:700, color:'#dc2626', background:'#fef2f2', padding:'2px 8px', borderRadius:12 }}>⚠️ Delayed {part.working_days_pending}d</span>}
                {part.not_in_stock && <span style={{ fontSize:11, fontWeight:700, color:'#ef4444', background:'#fef2f2', padding:'2px 8px', borderRadius:12 }}>❌ Not In Stock</span>}
              </div>
              <div style={{ fontSize:12, color:'var(--text-2)' }}>Qty: {part.quantity||'—'} · {part.customer_name}{part.customer_company?` · ${part.customer_company}`:''}</div>
              <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>AE: {part.ae_name||'—'} · Assigned {timeAgo(part.assigned_at)}</div>
              {part.inquiry_type==='online_order' && part.selling_price && (
                <div style={{ fontSize:12, fontWeight:700, color:isOver?'#dc2626':'#10b981', marginTop:3 }}>
                  {isOver?`⚠️ Selling price: $${part.selling_price} — your quote is OVER`:`Selling price: $${part.selling_price}`}
                </div>
              )}
              {part.pm_notes && (
                <div style={{ marginTop:6, background:'#fef9c3', border:'1px solid #fde047', borderRadius:8, padding:'6px 10px', fontSize:12, color:'#713f12' }}>
                  <span style={{ fontWeight:700 }}>📋 PM Note: </span>{part.pm_notes}
                </div>
              )}
            </div>
            <div style={{ display:'flex', gap:6, flexShrink:0 }}>
              <button onClick={handleMarkNotInStock}
                style={{ padding:'6px 12px', borderRadius:10, border:`1px solid ${part.not_in_stock?'#10b981':'#ef4444'}`, background:part.not_in_stock?'#f0fdf4':'#fef2f2', color:part.not_in_stock?'#10b981':'#ef4444', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', whiteSpace:'nowrap' }}>
                {part.not_in_stock?'✓ Mark In Stock':'❌ Not In Stock'}
              </button>
              <button onClick={onClose} style={{ width:32, height:32, borderRadius:10, border:'none', background:'var(--row-alt)', cursor:'pointer', fontSize:18, color:'var(--text-2)', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:1, borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          {[['quote','💰 Quote'],['notes','📝 My Notes'],['comments',`💬 AE Chat (${part.comments?.length||0})`],['followups',`📅 Follow-ups (${part.followups?.filter(f=>!f.completed).length||0})`]].map(([k,l]) => (
            <button key={k} onClick={()=>setTab(k)} style={{ flex:1, padding:'10px 0', border:'none', background:'transparent', color:tab===k?'#0f172a':'#64748b', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', borderBottom:`2px solid ${tab===k?BRAND:'transparent'}`, transition:'all 0.15s' }}>{l}</button>
          ))}
        </div>

        <div style={{ overflowY:'auto', flex:1, padding:'18px 22px' }}>
          {/* Quote tab */}
          {tab==='quote' && (
            <div>
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text-2)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Price *</div>
                <SInput value={price} onChange={e=>setPrice(e.target.value)} placeholder="e.g. 250.00" />
              </div>
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text-2)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Condition *</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:condition==='Other'?8:0 }}>
                  {CONDITIONS.map(c => <button key={c} type="button" onClick={()=>setCondition(c)} style={{ padding:'6px 12px', borderRadius:10, border:`2px solid ${condition===c?BRAND:'#e2e8f0'}`, background:condition===c?`${BRAND}12`:'var(--card)', color:condition===c?'#00b8ad':'#64748b', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', transition:'all 0.15s' }}>{c}</button>)}
                </div>
                {condition==='Other' && <SInput value={customCond} onChange={e=>setCustomCond(e.target.value)} placeholder="Specify condition..." />}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <div><div style={{ fontSize:11, fontWeight:700, color:'var(--text-2)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Lead Time</div><SInput value={leadTime} onChange={e=>setLeadTime(e.target.value)} placeholder="e.g. 3-5 days" /></div>
                <div><div style={{ fontSize:11, fontWeight:700, color:'var(--text-2)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Supplier</div><SInput value={supplier} onChange={e=>setSupplier(e.target.value)} placeholder="e.g. ABC Electronics" /></div>
              </div>
              <div style={{ marginBottom:16 }}><div style={{ fontSize:11, fontWeight:700, color:'var(--text-2)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Quote Notes</div><STextarea value={quoteNotes} onChange={e=>setQuoteNotes(e.target.value)} placeholder="Additional notes about this quote..." /></div>
              {error && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#dc2626', marginBottom:12 }}>⚠ {error}</div>}
              <button onClick={handleQuoteSubmit} disabled={saving} style={{ width:'100%', padding:12, borderRadius:12, border:'none', background:saving?'#94a3b8':BRAND, color:'#0d0d0d', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                {saving?<><div style={{ width:14, height:14, borderRadius:'50%', border:'2px solid #0d0d0d', borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />Saving...</>:(part.quote_id?'↻ Update Quote':'✓ Submit Quote')}
              </button>
              {part.quote_id && (
                <div style={{ marginTop:12, background:'#f0fdf4', borderRadius:10, padding:'10px 14px', border:'1px solid #bbf7d0', fontSize:12, color:'#16a34a' }}>
                  ✓ Last quoted: ${part.price} · {part.condition} · {part.lead_time||'—'} · {timeAgo(part.quoted_at)}
                </div>
              )}
            </div>
          )}

          {/* My Notes tab */}
          {tab==='notes' && (
            <div>
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text-2)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>My Notes / Update</div>
                <STextarea value={purchaserNotes} onChange={e=>setPurchaserNotes(e.target.value)} placeholder="Add your notes, updates, or research on this part..." />
                <button onClick={handleSaveNotes} disabled={savingNotes} style={{ marginTop:8, padding:'8px 18px', borderRadius:10, border:'none', background:BRAND, color:'#0d0d0d', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
                  {savingNotes?'Saving...':'Save Notes'}
                </button>
              </div>
            </div>
          )}

          {/* Comments tab (with AE) */}
          {tab==='comments' && (
            <div>
              <div style={{ display:'flex', gap:8, marginBottom:16 }}>
                <SInput value={comment} onChange={e=>setComment(e.target.value)} placeholder="Write to the AE..." />
                <button onClick={handleComment} disabled={sendingComment||!comment.trim()} style={{ padding:'10px 16px', borderRadius:12, border:'none', background:BRAND, color:'#0d0d0d', fontWeight:700, fontSize:13, cursor:'pointer', flexShrink:0, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
                  {sendingComment?'...':'Send'}
                </button>
              </div>
              {!part.comments?.length ? <div style={{ textAlign:'center', color:'var(--text-3)', padding:32, fontSize:13 }}>No messages yet. Start a conversation with the AE.</div> : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {part.comments.map(c => {
                    const isMe = c.user_id === user.id
                    return (
                      <div key={c.id} style={{ display:'flex', flexDirection:isMe?'row-reverse':'row', gap:8 }}>
                        <div style={{ width:28, height:28, borderRadius:8, background:isMe?`${BRAND}20`:'var(--card-2)', color:isMe?BRAND:'#64748b', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:11, flexShrink:0 }}>{c.user_name?.[0]?.toUpperCase()}</div>
                        <div style={{ maxWidth:'75%' }}>
                          <div style={{ fontSize:10, color:'var(--text-3)', marginBottom:3, textAlign:isMe?'right':'left' }}>{c.user_name} ({c.user_role}) · {timeAgo(c.created_at)}</div>
                          <div style={{ background:isMe?`${BRAND}15`:'var(--card-2)', borderRadius:isMe?'12px 12px 4px 12px':'12px 12px 12px 4px', padding:'8px 12px', fontSize:13, color:'var(--text)', border:`1px solid ${isMe?`${BRAND}30`:'var(--card-2)'}` }}>
                            {c.comment}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Follow-ups tab */}
          {tab==='followups' && (
            <div>
              <div style={{ background:'var(--row-alt)', borderRadius:12, padding:14, border:'1px solid var(--border)', marginBottom:16 }}>
                <SInput value={followupNote} onChange={e=>setFollowupNote(e.target.value)} placeholder="Follow-up note (e.g. Call supplier ABC on Monday)..." />
                <div style={{ display:'flex', gap:8, marginTop:8 }}>
                  <input type="date" value={followupDate} onChange={e=>setFollowupDate(e.target.value)} style={{ ...inp, flex:1 }} />
                  <button onClick={handleFollowup} disabled={savingFollowup||!followupNote.trim()} style={{ padding:'10px 16px', borderRadius:12, border:'none', background:BRAND, color:'#0d0d0d', fontWeight:700, fontSize:13, cursor:'pointer', flexShrink:0, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Add</button>
                </div>
              </div>
              {!part.followups?.length ? <div style={{ textAlign:'center', color:'var(--text-3)', padding:24, fontSize:13 }}>No follow-ups yet</div> : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {part.followups.map(fu => (
                    <div key={fu.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:fu.completed?'var(--card-2)':'var(--card)', borderRadius:12, border:`1px solid ${fu.completed?'var(--card-2)':new Date(fu.follow_up_date)<new Date()?'#fecaca':'var(--card-2)'}`, opacity:fu.completed?0.6:1 }}>
                      <button onClick={() => completeFollowup(fu.id)} disabled={fu.completed}
                        style={{ width:22, height:22, borderRadius:6, border:`2px solid ${fu.completed?BRAND:'#cbd5e1'}`, background:fu.completed?BRAND:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {fu.completed && <span style={{ color:'white', fontSize:11 }}>✓</span>}
                      </button>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:500, color:'var(--text)', textDecoration:fu.completed?'line-through':'' }}>{fu.note}</div>
                        {fu.follow_up_date && <div style={{ fontSize:11, color: new Date(fu.follow_up_date)<new Date()&&!fu.completed?'#ef4444':BRAND, fontWeight:600, marginTop:2 }}>📅 {formatDate(fu.follow_up_date)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// Part card for the list
function PartCard({ part, onClick }) {
  const tInfo = T[part.inquiry_type]; const urgInfo = URGENCY[part.urgency||'normal']
  return (
    <div onClick={onClick} style={{ background:part.is_delayed?'#fff5f5':part.not_in_stock?'var(--card-2)':'var(--card)', borderRadius:14, border:`1px solid ${part.is_delayed?'#fecaca':part.not_in_stock?'#e2e8f0':part.urgency==='critical'?'#fecaca':part.urgency==='high'?'#fed7aa':'var(--card-2)'}`, padding:'14px 18px', cursor:'pointer', transition:'all 0.15s', display:'flex', alignItems:'flex-start', gap:14, flexWrap:'wrap' }}
      onMouseEnter={e=>{ e.currentTarget.style.borderColor=BRAND; e.currentTarget.style.boxShadow=`0 2px 12px rgba(0,212,200,0.1)` }}
      onMouseLeave={e=>{ e.currentTarget.style.borderColor=part.is_delayed?'#fecaca':part.not_in_stock?'#e2e8f0':part.urgency==='critical'?'#fecaca':part.urgency==='high'?'#fed7aa':'var(--card-2)'; e.currentTarget.style.boxShadow='none' }}>
      <div style={{ width:42, height:42, borderRadius:10, background:`${tInfo?.color}15`, color:tInfo?.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{tInfo?.icon}</div>
      <div style={{ flex:1, minWidth:180 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4 }}>
          <span style={{ fontFamily:'monospace', fontWeight:800, fontSize:15, color:'var(--text)' }}>{part.part_number}</span>
          <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:12, background:urgInfo.bg, color:urgInfo.color, border:`1px solid ${urgInfo.border}` }}>{urgInfo.label}</span>
          {part.is_delayed && <span style={{ fontSize:11, fontWeight:700, color:'#dc2626' }}>⚠️ {part.working_days_pending}d overdue</span>}
          {part.not_in_stock && <span style={{ fontSize:11, fontWeight:700, color:'#ef4444', background:'#fef2f2', padding:'2px 6px', borderRadius:6 }}>❌ Not In Stock</span>}
        </div>
        <div style={{ fontSize:12, color:'var(--text-2)' }}>Qty: {part.quantity||'—'} · {part.customer_name}{part.customer_company?` · ${part.customer_company}`:''}</div>
        <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>AE: {part.ae_name||'—'} · Assigned {timeAgo(part.assigned_at)}</div>
        {part.pm_notes && <div style={{ fontSize:11, color:'#92400e', background:'#fef9c3', padding:'3px 8px', borderRadius:6, marginTop:4, display:'inline-block' }}>📋 {part.pm_notes}</div>}
      </div>
      {part.inquiry_type==='online_order' && part.selling_price && (
        <div style={{ textAlign:'center', flexShrink:0 }}>
          <div style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase' }}>Selling</div>
          <div style={{ fontSize:16, fontWeight:800, color:'#10b981', fontFamily:'"Bricolage Grotesque",sans-serif' }}>${part.selling_price}</div>
        </div>
      )}
      {part.quote_id ? (
        <div style={{ background:'#f0fdf4', borderRadius:10, padding:'8px 12px', border:'1px solid #bbf7d0', flexShrink:0, textAlign:'center' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#16a34a', textTransform:'uppercase', marginBottom:3 }}>Quoted</div>
          <div style={{ fontWeight:800, fontSize:15, color:'#16a34a', fontFamily:'"Bricolage Grotesque",sans-serif' }}>${part.price}</div>
          <div style={{ fontSize:10, color:'var(--text-2)' }}>{part.condition}</div>
        </div>
      ) : (
        <div style={{ padding:'8px 16px', borderRadius:10, background:`${BRAND}15`, color:'#00b8ad', fontWeight:700, fontSize:12, flexShrink:0, alignSelf:'center', cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
          Submit Quote →
        </div>
      )}
    </div>
  )
}

export default function PurchaserDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null); const [activeTab, setActiveTab] = useState('dashboard')
  const [preset, setPreset] = useState('all'); const [customFrom, setCustomFrom] = useState(''); const [customTo, setCustomTo] = useState('')
  const [openPartId, setOpenPartId] = useState(null)
  const [partsResult, setPartsResult] = useState(null); const [partsLoading, setPartsLoading] = useState(false)
  const [page, setPage] = useState(1); const [statusFilter, setStatusFilter] = useState(''); const [typeFilter, setTypeFilter] = useState('')

  const dateRange = getDateRange(preset, customFrom, customTo)
  const loadStats = () => purchasingApi.getStats().then(setStats)

  const loadParts = () => {
    if (!['lead','repeat','online_order','all_parts'].includes(activeTab)) return
    const type = activeTab === 'all_parts' ? '' : activeTab
    setPartsLoading(true)
    purchasingApi.getMyParts({ type, status:statusFilter, page, from:dateRange.from, to:dateRange.to }).then(d => { setPartsResult(d); setPartsLoading(false) })
  }

  useEffect(() => { loadStats() }, [])
  useEffect(() => { setPage(1) }, [activeTab, statusFilter, JSON.stringify(dateRange)])
  useEffect(() => { loadParts() }, [activeTab, statusFilter, page, JSON.stringify(dateRange)])

  const greeting = () => { const h = new Date().getHours(); return h<12?'Good morning':h<17?'Good afternoon':'Good evening' }
  const getTypeStats = (t) => stats?.byType?.find(x=>x.type===t)||{ total:0, pending_count:0, quoted_count:0 }

  const tabs = [
    { key:'dashboard', label:'📊 Dashboard' },
    { key:'lead',      label:`◎ Leads (${getTypeStats('lead').total})` },
    { key:'repeat',    label:`↻ Repeat (${getTypeStats('repeat').total})` },
    { key:'online_order', label:`◈ Orders (${getTypeStats('online_order').total})` },
    { key:'followups', label:`📅 Follow-ups${stats?.followups?.overdue?.length>0?` (${stats.followups.overdue.length}⚠️)`:''}`},
    { key:'notifications', label:`🔔 Notifications${stats?.myNotifications?.filter(n=>!n.read).length>0?` (${stats.myNotifications.filter(n=>!n.read).length})`:''}`},
  ]

  return (
    <div style={{ padding:28, maxWidth:1200, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:24, color:'var(--text)', margin:0 }}>{greeting()}, {user.name} 👋</h1>
          <p style={{ color:'var(--text-3)', fontSize:13, marginTop:3 }}>Your assigned parts and quoting dashboard</p>
        </div>
      </div>

      {/* Date filter */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ display:'flex', background:'var(--input-bg)', border:'1px solid var(--input-border)', borderRadius:10, padding:3, gap:2 }}>
          {PRESETS.map(r => <button key={r.v} onClick={()=>setPreset(r.v)} style={{ padding:'5px 12px', borderRadius:7, border:'none', background:preset===r.v?BRAND:'transparent', color:preset===r.v?'#0d0d0d':'#64748b', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', transition:'all 0.15s' }}>{r.label}</button>)}
        </div>
        {preset==='custom' && <>
          <input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)} style={{ padding:'7px 10px', border:'1px solid var(--border)', borderRadius:8, fontSize:12, outline:'none' }} />
          <span style={{ color:'var(--text-3)' }}>→</span>
          <input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)} style={{ padding:'7px 10px', border:'1px solid var(--border)', borderRadius:8, fontSize:12, outline:'none' }} />
        </>}
        {['lead','repeat','online_order'].includes(activeTab) && (
          <div style={{ display:'flex', gap:6, marginLeft:'auto' }}>
            {[['','All'],['pending','Pending'],['quoted','Quoted'],['not_in_stock','Not In Stock']].map(([v,l]) => (
              <button key={v} onClick={()=>setStatusFilter(v)} style={{ padding:'6px 12px', borderRadius:8, border:`1px solid ${statusFilter===v?BRAND:'#e2e8f0'}`, background:statusFilter===v?`${BRAND}12`:'var(--card)', color:statusFilter===v?'#00b8ad':'#64748b', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>{l}</button>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, background:'var(--row-alt)', borderRadius:12, padding:3, marginBottom:20, flexWrap:'wrap' }}>
        {tabs.map(t => <button key={t.key} onClick={()=>setActiveTab(t.key)} style={{ padding:'8px 14px', borderRadius:9, border:'none', background:activeTab===t.key?'var(--card)':'transparent', color:activeTab===t.key?'#0f172a':'#64748b', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', boxShadow:activeTab===t.key?'0 1px 4px rgba(0,0,0,0.08)':'none', transition:'all 0.15s', whiteSpace:'nowrap' }}>{t.label}</button>)}
      </div>

      {/* Dashboard */}
      {activeTab==='dashboard' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:12, marginBottom:20 }}>
            {[['Assigned',stats?.myAssigned,'#6366f1','📋'],['Pending',stats?.myPending,'#f59e0b','⏳'],['Quoted',stats?.myQuoted,'#10b981','✅'],['Today',stats?.myToday,BRAND,'⚡'],['This Week',stats?.myWeek,'#3b82f6','📅'],['Delayed',stats?.myDelayed,'#dc2626','⚠️'],['Not In Stock',stats?.myNotInStock,'#94a3b8','❌']].map(([l,v,c,ic]) => (
              <div key={l} style={{ background:'var(--card)', borderRadius:12, border:`1px solid ${l==='Delayed'&&v>0?'#fecaca':'var(--card-2)'}`, padding:'12px 14px', position:'relative', overflow:'hidden', background:l==='Delayed'&&v>0?'#fff5f5':'var(--card)' }}>
                <div style={{ position:'absolute', top:0, left:0, width:3, height:'100%', background:c, borderRadius:'12px 0 0 12px' }} />
                <div style={{ fontSize:9, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>{l}</div>
                <div style={{ fontSize:20, fontWeight:800, color:l==='Delayed'&&v>0?'#dc2626':'#0f172a', fontFamily:'"Bricolage Grotesque",sans-serif' }}>{v??'—'}</div>
              </div>
            ))}
          </div>

          {/* Performance */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
            <div style={{ background:'var(--card)', borderRadius:14, border:'1px solid var(--border)', padding:20 }}>
              <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:14, color:'var(--text)', marginBottom:14 }}>Performance Metrics</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div style={{ background:'var(--row-alt)', borderRadius:10, padding:'12px 14px', textAlign:'center' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', marginBottom:4 }}>Avg Quote Time</div>
                  <div style={{ fontSize:20, fontWeight:800, color:BRAND, fontFamily:'"Bricolage Grotesque",sans-serif' }}>{stats?.avgHours ? `${stats.avgHours}h` : '—'}</div>
                </div>
                <div style={{ background:'var(--row-alt)', borderRadius:10, padding:'12px 14px', textAlign:'center' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', marginBottom:4 }}>Completion Rate</div>
                  <div style={{ fontSize:20, fontWeight:800, color:'#10b981', fontFamily:'"Bricolage Grotesque",sans-serif' }}>
                    {stats?.myAssigned>0 ? `${Math.round(stats.myQuoted/stats.myAssigned*100)}%` : '—'}
                  </div>
                </div>
              </div>
              <div style={{ marginTop:14 }}>
                {['lead','repeat','online_order'].map(type => {
                  const d = getTypeStats(type); const tInfo = T[type]
                  if (!d.total) return null
                  return (
                    <div key={type} style={{ marginBottom:10 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ fontSize:12, color:tInfo.color, fontWeight:600 }}>{tInfo.icon} {tInfo.label}s</span>
                        <span style={{ fontSize:12, fontWeight:700, color:'#10b981' }}>{d.quoted_count}/{d.total} quoted</span>
                      </div>
                      <div style={{ height:5, background:'var(--row-alt)', borderRadius:4 }}>
                        <div style={{ height:'100%', borderRadius:4, background:tInfo.color, width:`${d.total>0?Math.round(d.quoted_count/d.total*100):0}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Follow-ups */}
            <div style={{ background:'var(--card)', borderRadius:14, border:'1px solid var(--border)', padding:20 }}>
              <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:14, color:'var(--text)', marginBottom:14 }}>📅 My Follow-ups</div>
              {stats?.followups?.overdue?.length===0 && stats?.followups?.today?.length===0 && stats?.followups?.upcoming?.length===0
                ? <div style={{ textAlign:'center', color:'var(--text-3)', padding:24, fontSize:13 }}>✅ All caught up!</div>
                : (
                  <div>
                    {[...( stats?.followups?.overdue||[]).map(f=>({...f,urgency:'overdue'})), ...(stats?.followups?.today||[]).map(f=>({...f,urgency:'today'})), ...(stats?.followups?.upcoming||[]).map(f=>({...f,urgency:'upcoming'}))].slice(0,6).map(fu => (
                      <div key={fu.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                        <div style={{ width:6, height:6, borderRadius:'50%', flexShrink:0, background:fu.urgency==='overdue'?'#ef4444':fu.urgency==='today'?'#f59e0b':BRAND }} />
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>{fu.part_number}</div>
                          <div style={{ fontSize:11, color:'var(--text-2)' }}>{fu.note}</div>
                        </div>
                        <div style={{ fontSize:11, fontWeight:700, color:fu.urgency==='overdue'?'#ef4444':fu.urgency==='today'?'#f59e0b':BRAND, flexShrink:0 }}>{formatDate(fu.follow_up_date)}</div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Parts tabs */}
      {['lead','repeat','online_order'].includes(activeTab) && (
        <div>
          {partsLoading ? <div style={{ textAlign:'center', padding:48, color:'var(--text-3)' }}>Loading...</div>
            : !partsResult?.parts?.length ? <div style={{ background:'var(--card)', borderRadius:14, border:'1px solid var(--border)', padding:48, textAlign:'center', color:'var(--text-3)' }}><div style={{ fontSize:32, marginBottom:8 }}>{T[activeTab]?.icon}</div>No parts assigned</div>
            : (
              <div>
                <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:12 }}>{partsResult.total} parts · 30 per page · sorted by urgency</div>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {partsResult.parts.map(p => <PartCard key={p.requirement_id} part={p} onClick={() => setOpenPartId(p.assignment_id)} />)}
                </div>
                <Pagination page={page} pages={partsResult.pages||1} onChange={setPage} />
              </div>
            )
          }
        </div>
      )}

      {/* Follow-ups tab */}
      {activeTab==='followups' && (
        <div>
          {[{ label:'⚠️ Overdue', items:stats?.followups?.overdue||[], color:'#ef4444' }, { label:'📅 Today', items:stats?.followups?.today||[], color:'#f59e0b' }, { label:'📆 This Week', items:stats?.followups?.upcoming||[], color:BRAND }].map(section => (
            section.items.length > 0 && (
              <div key={section.label} style={{ marginBottom:24 }}>
                <div style={{ fontSize:11, fontWeight:700, color:section.color, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 }}>{section.label} — {section.items.length}</div>
                <div style={{ borderLeft:`2px solid ${section.color}40`, paddingLeft:16, display:'flex', flexDirection:'column', gap:8 }}>
                  {section.items.map(fu => (
                    <div key={fu.id} style={{ background:'var(--card)', borderRadius:12, border:'1px solid var(--border)', padding:'12px 16px', display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontFamily:'monospace', fontWeight:700, fontSize:13, color:'var(--text)' }}>{fu.part_number}</div>
                        <div style={{ fontSize:12, color:'var(--text-2)', marginTop:2 }}>{fu.note}</div>
                      </div>
                      <div style={{ fontSize:11, fontWeight:700, color:section.color, flexShrink:0 }}>{formatDate(fu.follow_up_date)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}
          {!stats?.followups?.overdue?.length && !stats?.followups?.today?.length && !stats?.followups?.upcoming?.length && (
            <div style={{ background:'var(--card)', borderRadius:14, border:'1px solid var(--border)', padding:60, textAlign:'center' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
              <div style={{ color:'var(--text-3)', fontSize:16, fontWeight:600 }}>All caught up!</div>
            </div>
          )}
        </div>
      )}

      {/* Notifications tab */}
      {activeTab==='notifications' && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {!stats?.myNotifications?.length ? <div style={{ background:'var(--card)', borderRadius:14, border:'1px solid var(--border)', padding:48, textAlign:'center', color:'var(--text-3)' }}>No notifications yet</div> :
            stats.myNotifications.map(n => (
              <div key={n.id} style={{ background:n.read?'var(--card)':'rgba(0,212,200,0.04)', border:`1px solid ${n.read?'var(--card-2)':'rgba(0,212,200,0.2)'}`, borderRadius:14, padding:'14px 16px', display:'flex', gap:12, alignItems:'flex-start' }}>
                <div style={{ width:36, height:36, borderRadius:10, background:n.inquiry_type==='part_assigned'?`${BRAND}20`:n.inquiry_type==='part_reassigned'?'#fef2f2':'#f0fdf4', color:n.inquiry_type==='part_assigned'?BRAND:n.inquiry_type==='part_reassigned'?'#dc2626':'#16a34a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
                  {n.inquiry_type==='part_assigned'?'🔩':n.inquiry_type==='part_reassigned'?'↩':'✅'}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:13, color:'var(--text)', marginBottom:2 }}>{n.action}</div>
                  {n.comment && <div style={{ fontSize:12, color:'var(--text-2)', fontFamily:'monospace', background:'var(--row-alt)', padding:'3px 8px', borderRadius:6, marginBottom:3 }}>{n.comment}</div>}
                  <div style={{ fontSize:11, color:'var(--text-3)' }}>{n.actor_name} · {timeAgo(n.created_at)}</div>
                </div>
                {!n.read && <div style={{ width:8, height:8, borderRadius:'50%', background:BRAND, flexShrink:0, marginTop:4 }} />}
              </div>
            ))
          }
        </div>
      )}

      {openPartId && <PartDetailModal assignmentId={openPartId} onClose={() => setOpenPartId(null)} onSaved={() => { loadStats(); loadParts() }} />}
    </div>
  )
}
