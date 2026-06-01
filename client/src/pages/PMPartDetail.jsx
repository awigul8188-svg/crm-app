import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../App'
import { useNav } from '../App'

const BRAND = '#00D4C8'
const token = () => localStorage.getItem('crm_token')
const api = (path, opts={}) => fetch(`/api${path}`, { headers:{ Authorization:`Bearer ${token()}`, 'Content-Type':'application/json' }, ...opts }).then(r=>r.json())

export default function PMPartDetail({ assignmentId }) {
  const { user } = useAuth(); const { navigate } = useNav()
  const [part, setPart]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [showNote, setShowNote]     = useState(false)
  const [showFollowup, setShowFollowup] = useState(false)
  const [note, setNote]             = useState('')
  const [newFollowup, setNewFollowup] = useState({ note:'', follow_up_date:'' })
  const [urgencyEdit, setUrgencyEdit] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const d = await api(`/purchasing/part/${assignmentId}`).catch(()=>null)
    if (d) setPart(d)
    setLoading(false)
  }, [assignmentId])
  useEffect(() => { load() }, [load])

  const saveUrgency = async (urgency) => {
    await api(`/purchasing/assignment/${assignmentId}`, { method:'PATCH', body: JSON.stringify({ urgency }) })
    setUrgencyEdit(false); load()
  }

  const saveNote = async () => {
    if (!note.trim()) return
    setSaving(true)
    await api(`/purchasing/comment/${assignmentId}`, { method:'POST', body: JSON.stringify({ comment: note.trim() }) })
    setNote(''); setShowNote(false); setSaving(false); load()
  }

  const addFollowup = async () => {
    if (!newFollowup.note.trim()) return
    await api(`/purchasing/followup/${assignmentId}`, { method:'POST', body: JSON.stringify(newFollowup) })
    setNewFollowup({ note:'', follow_up_date:'' }); setShowFollowup(false); load()
  }

  const completeFollowup = async (id) => {
    await api(`/purchasing/followup/${id}/complete`, { method:'PATCH' })
    load()
  }

  if (loading) return <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'60vh' }}><div style={{ width:24,height:24,borderRadius:'50%',border:`2px solid ${BRAND}`,borderTopColor:'transparent',animation:'spin 0.8s linear infinite' }}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
  if (!part) return <div style={{ padding:40,color:'var(--text-3)',textAlign:'center' }}>Part not found.</div>

  const URGENCY = { critical:'#ef4444', high:'#f97316', normal:BRAND, low:'#94a3b8' }
  const inp = { width:'100%', boxSizing:'border-box', background:'var(--input-bg)', border:'1px solid var(--input-border)', borderRadius:10, padding:'9px 13px', fontSize:13, color:'var(--text)', fontFamily:'"Plus Jakarta Sans",sans-serif', outline:'none' }
  const card = { background:'var(--card)', borderRadius:16, border:'1px solid var(--border)', padding:'20px 22px', marginBottom:16 }

  return (
    <div style={{ padding:'24px 28px', flex:1, overflowY:'auto', maxWidth:900, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <button onClick={() => navigate('purchasing')} style={{ display:'flex',alignItems:'center',gap:6,padding:'8px 16px',borderRadius:10,border:'1px solid var(--border)',background:'var(--card)',color:'var(--text-2)',fontSize:13,fontWeight:600,cursor:'pointer',marginBottom:20,fontFamily:'inherit' }}>← Back</button>

      {/* Header */}
      <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12 }}>
        <div>
          <h1 style={{ fontFamily:'monospace',fontWeight:800,fontSize:24,color:'var(--text)',margin:0 }}>{part.part_number}</h1>
          <div style={{ display:'flex',gap:12,marginTop:8,flexWrap:'wrap',fontSize:12,color:'var(--text-3)' }}>
            <span>Qty: <b style={{ color:'var(--text)' }}>{part.quantity||'—'}</b></span>
            <span>Customer: <b style={{ color:'var(--text)' }}>{part.customer_name||'—'}</b>{part.customer_company&&<span style={{ color:'var(--text-3)' }}> · {part.customer_company}</span>}</span>
            <span>AE: <b style={{ color:'var(--text)' }}>{part.ae_name||'—'}</b></span>
            <span>Type: <b style={{ color:'var(--text)' }}>{part.inquiry_type}</b></span>
            <span>Date: <b style={{ color:'var(--text)' }}>{part.inquiry_date ? new Date(part.inquiry_date).toLocaleDateString() : '—'}</b></span>
            {part.purchaser_name && <span>Purchaser: <b style={{ color:BRAND }}>{part.purchaser_name}</b></span>}
          </div>
        </div>
        {/* Urgency */}
        <div style={{ display:'flex',gap:8,alignItems:'center' }}>
          {urgencyEdit ? (
            <select autoFocus defaultValue={part.urgency||'normal'} onChange={e=>saveUrgency(e.target.value)} onBlur={()=>setUrgencyEdit(false)}
              style={{ ...inp, width:'auto', padding:'6px 12px', fontSize:12 }}>
              {['critical','high','normal','low'].map(u=><option key={u} value={u} style={{ textTransform:'capitalize' }}>{u.charAt(0).toUpperCase()+u.slice(1)}</option>)}
            </select>
          ) : (
            <span onClick={()=>setUrgencyEdit(true)} title="Click to change urgency" style={{ fontSize:12,fontWeight:700,padding:'5px 14px',borderRadius:20,background:`${URGENCY[part.urgency||'normal']}18`,color:URGENCY[part.urgency||'normal'],border:`1px solid ${URGENCY[part.urgency||'normal']}30`,textTransform:'capitalize',cursor:'pointer' }}>
              {part.urgency||'normal'} urgency ✏
            </span>
          )}
          <span style={{ fontSize:12,fontWeight:700,padding:'5px 14px',borderRadius:20,background:part.assignment_status==='quoted'?'#10b98118':'#f59e0b18',color:part.assignment_status==='quoted'?'#10b981':'#f59e0b',border:`1px solid ${part.assignment_status==='quoted'?'#10b98130':'#f59e0b30'}` }}>
            {part.not_in_stock ? 'Not in stock' : (part.assignment_status||'pending')}
          </span>
        </div>
      </div>

      {/* Quote info */}
      {part.quote_id && (
        <div style={card}>
          <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:15,color:'var(--text)',marginBottom:14 }}>Quote</div>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:12 }}>
            {[{label:'Price',value:`$${part.price}`,color:'#10b981'},{label:'Condition',value:part.condition||'—'},{label:'Lead Time',value:part.lead_time||'—'},{label:'Supplier',value:part.supplier_name||'—'}].map(f=>(
              <div key={f.label} style={{ background:'var(--card-2)',borderRadius:12,padding:'12px 14px' }}>
                <div style={{ fontSize:10,fontWeight:700,color:'var(--text-4)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4 }}>{f.label}</div>
                <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:17,color:f.color||'var(--text)' }}>{f.value}</div>
              </div>
            ))}
          </div>
          {part.selling_price && (
            <div style={{ marginTop:12,padding:'10px 14px',borderRadius:10,background:part.is_over_selling?'#fef2f2':'#f0fdf4',border:`1px solid ${part.is_over_selling?'#fecaca':'#bbf7d0'}`,fontSize:13,color:part.is_over_selling?'#ef4444':'#10b981',fontWeight:600 }}>
              {part.is_over_selling ? `⚠ Quote ($${part.price}) is OVER selling price ($${part.selling_price})` : `✓ Within selling price ($${part.selling_price})`}
            </div>
          )}
        </div>
      )}

      {/* PM Notes */}
      <div style={card}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14 }}>
          <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:15,color:'var(--text)' }}>Internal Notes</div>
          <button onClick={()=>setShowNote(v=>!v)} style={{ padding:'7px 14px',borderRadius:10,border:`1px solid ${BRAND}40`,background:`${BRAND}10`,color:BRAND,fontWeight:600,fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>+ Add Note</button>
        </div>
        {showNote && (
          <div style={{ display:'flex',gap:10,marginBottom:14 }}>
            <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Internal note..." style={{ ...inp, flex:1 }} onKeyDown={e=>e.key==='Enter'&&saveNote()} />
            <button onClick={saveNote} disabled={saving} style={{ padding:'9px 18px',borderRadius:10,border:'none',background:BRAND,color:'#060610',fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:'inherit',flexShrink:0 }}>Save</button>
          </div>
        )}
        {part.pm_notes && <div style={{ padding:'12px 14px',background:'var(--card-2)',borderRadius:10,fontSize:13,color:'var(--text-2)',marginBottom:8 }}><b>PM Notes:</b> {part.pm_notes}</div>}
        {(part.comments||[]).length===0 && !part.pm_notes ? (
          <div style={{ color:'var(--text-3)',fontSize:13,textAlign:'center',padding:'16px 0' }}>No notes yet</div>
        ) : (
          <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
            {(part.comments||[]).map((c,i)=>(
              <div key={c.id||i} style={{ display:'flex',gap:12,alignItems:'flex-start',padding:'10px 14px',borderRadius:10,background:'var(--card-2)' }}>
                <div style={{ width:32,height:32,borderRadius:10,background:`${BRAND}20`,color:BRAND,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,flexShrink:0 }}>{(c.user_name||'?').split(' ').map(n=>n[0]).join('').slice(0,2)}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13,color:'var(--text)' }}><b>{c.user_name}</b> — {c.comment}</div>
                  <div style={{ fontSize:11,color:'var(--text-3)',marginTop:2 }}>{c.created_at ? new Date(c.created_at).toLocaleString() : ''}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Follow-ups */}
      <div style={card}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14 }}>
          <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:15,color:'var(--text)' }}>Follow-ups</div>
          <button onClick={()=>setShowFollowup(v=>!v)} style={{ padding:'7px 14px',borderRadius:10,border:`1px solid ${BRAND}40`,background:`${BRAND}10`,color:BRAND,fontWeight:600,fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>+ Add</button>
        </div>
        {showFollowup && (
          <div style={{ display:'flex',gap:10,marginBottom:14,flexWrap:'wrap' }}>
            <input value={newFollowup.note} onChange={e=>setNewFollowup(f=>({...f,note:e.target.value}))} placeholder="Follow-up note..." style={{ ...inp, flex:2, minWidth:200 }} />
            <input value={newFollowup.follow_up_date} onChange={e=>setNewFollowup(f=>({...f,follow_up_date:e.target.value}))} type="date" style={{ ...inp, flex:1, minWidth:140 }} />
            <button onClick={addFollowup} style={{ padding:'9px 18px',borderRadius:10,border:'none',background:BRAND,color:'#060610',fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:'inherit',flexShrink:0 }}>Save</button>
          </div>
        )}
        {!(part.followups||[]).length ? (
          <div style={{ color:'var(--text-3)',fontSize:13,textAlign:'center',padding:'16px 0' }}>No follow-ups yet</div>
        ) : (
          <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
            {(part.followups||[]).map(fu=>(
              <div key={fu.id} style={{ display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:10,background:'var(--card-2)',border:`1px solid ${!fu.completed&&fu.follow_up_date<new Date().toISOString().split('T')[0]?'#fecaca':'var(--border)'}` }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13,fontWeight:600,color:fu.completed?'var(--text-3)':'var(--text)',textDecoration:fu.completed?'line-through':'none' }}>{fu.note}</div>
                  {fu.follow_up_date&&<div style={{ fontSize:11,color:'var(--text-3)',marginTop:2 }}>{new Date(fu.follow_up_date).toLocaleDateString()}</div>}
                </div>
                {!fu.completed && <button onClick={()=>completeFollowup(fu.id)} style={{ width:28,height:28,borderRadius:8,border:'1px solid var(--border)',background:'var(--card)',cursor:'pointer',fontSize:14,color:'var(--text-3)' }}>✓</button>}
                {fu.completed && <span style={{ fontSize:11,color:'#10b981',fontWeight:600 }}>✓ Done</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
