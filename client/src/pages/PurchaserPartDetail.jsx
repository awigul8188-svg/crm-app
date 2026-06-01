import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../App'
import { useNav } from '../App'

const BRAND = '#00D4C8'
const token = () => localStorage.getItem('crm_token')
const api = (path, opts={}) => fetch(`/api${path}`, { headers:{ Authorization:`Bearer ${token()}`, 'Content-Type':'application/json' }, ...opts }).then(r=>r.json())

export default function PurchaserPartDetail({ assignmentId }) {
  const { user } = useAuth(); const { navigate } = useNav()
  const [part, setPart]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [showFollowup, setShowFollowup] = useState(false)
  const [newFollowup, setNewFollowup]   = useState({ note:'', follow_up_date:'' })
  const [quote, setQuote] = useState({ price:'', condition:'', lead_time:'', supplier_name:'', notes:'' })

  const load = useCallback(async () => {
    setLoading(true)
    const d = await api(`/purchasing/part/${assignmentId}`).catch(()=>null)
    if (d) {
      setPart(d)
      setQuote({ price:d.price||'', condition:d.condition||'', lead_time:d.lead_time||'', supplier_name:d.supplier_name||'', notes:d.quote_notes||'' })
    }
    setLoading(false)
  }, [assignmentId])
  useEffect(() => { load() }, [load])

  const saveQuote = async () => {
    setSaving(true)
    await api('/purchasing/quote', { method:'POST', body: JSON.stringify({ assignment_id: parseInt(assignmentId), ...quote }) })
    setSaving(false); setEditing(false); load()
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

  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'60vh' }}>
      <div style={{ width:24,height:24,borderRadius:'50%',border:`2px solid ${BRAND}`,borderTopColor:'transparent',animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
  if (!part) return <div style={{ padding:40, color:'var(--text-3)', textAlign:'center' }}>Part not found.</div>

  const URGENCY = { critical:'#ef4444', high:'#f97316', normal:BRAND, low:'#94a3b8' }
  const inp = { width:'100%', boxSizing:'border-box', background:'var(--input-bg)', border:'1px solid var(--input-border)', borderRadius:10, padding:'9px 13px', fontSize:13, color:'var(--text)', fontFamily:'"Plus Jakarta Sans",sans-serif', outline:'none' }
  const card = { background:'var(--card)', borderRadius:16, border:'1px solid var(--border)', padding:'20px 22px', marginBottom:16 }

  return (
    <div style={{ padding:'24px 28px', flex:1, overflowY:'auto', maxWidth:900, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Back */}
      <button onClick={() => navigate('purchasing')} style={{ display:'flex',alignItems:'center',gap:6,padding:'8px 16px',borderRadius:10,border:'1px solid var(--border)',background:'var(--card)',color:'var(--text-2)',fontSize:13,fontWeight:600,cursor:'pointer',marginBottom:20,fontFamily:'inherit' }}>
        ← Back
      </button>

      {/* Header */}
      <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12 }}>
        <div>
          <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:800,fontSize:24,color:'var(--text)',margin:0 }}>{part.part_number}</h1>
          <div style={{ display:'flex',gap:10,marginTop:8,flexWrap:'wrap' }}>
            <span style={{ fontSize:12,color:'var(--text-3)' }}>Qty: <b style={{ color:'var(--text)' }}>{part.quantity||'—'}</b></span>
            <span style={{ fontSize:12,color:'var(--text-3)' }}>AE: <b style={{ color:'var(--text)' }}>{part.ae_name||'—'}</b></span>
            <span style={{ fontSize:12,color:'var(--text-3)' }}>Type: <b style={{ color:'var(--text)' }}>{part.inquiry_type}</b></span>
            <span style={{ fontSize:12,color:'var(--text-3)' }}>Date: <b style={{ color:'var(--text)' }}>{part.inquiry_date ? new Date(part.inquiry_date).toLocaleDateString() : '—'}</b></span>
          </div>
        </div>
        <div style={{ display:'flex',gap:8 }}>
          <span style={{ fontSize:12,fontWeight:700,padding:'5px 14px',borderRadius:20,background:`${URGENCY[part.urgency||'normal']}18`,color:URGENCY[part.urgency||'normal'],border:`1px solid ${URGENCY[part.urgency||'normal']}30`,textTransform:'capitalize' }}>
            {part.urgency||'normal'} urgency
          </span>
          <span style={{ fontSize:12,fontWeight:700,padding:'5px 14px',borderRadius:20,background:part.assignment_status==='quoted'?'#10b98118':'#f59e0b18',color:part.assignment_status==='quoted'?'#10b981':'#f59e0b',border:`1px solid ${part.assignment_status==='quoted'?'#10b98130':'#f59e0b30'}` }}>
            {part.not_in_stock ? 'Not in stock' : (part.assignment_status||'pending')}
          </span>
        </div>
      </div>

      {/* PM Notes */}
      {part.pm_notes && (
        <div style={{ ...card, background:`${BRAND}08`, border:`1px solid ${BRAND}30`, marginBottom:16 }}>
          <div style={{ fontSize:11,fontWeight:700,color:BRAND,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6 }}>📋 Manager Notes</div>
          <div style={{ fontSize:13,color:'var(--text)' }}>{part.pm_notes}</div>
        </div>
      )}

      {/* Quote section */}
      <div style={card}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
          <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:15,color:'var(--text)' }}>
            {part.quote_id ? 'Current Quote' : 'Submit Quote'}
          </div>
          {part.quote_id && !editing && (
            <button onClick={() => setEditing(true)} style={{ padding:'7px 16px',borderRadius:10,border:`1px solid ${BRAND}40`,background:`${BRAND}10`,color:BRAND,fontWeight:600,fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>
              Update Price
            </button>
          )}
        </div>

        {!editing && part.quote_id ? (
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:14 }}>
            {[
              { label:'Price',    value:`$${part.price}`,        color:'#10b981' },
              { label:'Condition',value:part.condition||'—',      color:'var(--text)' },
              { label:'Lead Time',value:part.lead_time||'—',      color:'var(--text)' },
              { label:'Supplier', value:part.supplier_name||'—',  color:'var(--text)' },
            ].map(f=>(
              <div key={f.label} style={{ background:'var(--card-2)',borderRadius:12,padding:'12px 14px' }}>
                <div style={{ fontSize:10,fontWeight:700,color:'var(--text-4)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4 }}>{f.label}</div>
                <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:18,color:f.color }}>{f.value}</div>
              </div>
            ))}
            {part.quote_notes && <div style={{ background:'var(--card-2)',borderRadius:12,padding:'12px 14px',gridColumn:'1/-1' }}>
              <div style={{ fontSize:10,fontWeight:700,color:'var(--text-4)',textTransform:'uppercase',marginBottom:4 }}>Notes</div>
              <div style={{ fontSize:13,color:'var(--text-2)' }}>{part.quote_notes}</div>
            </div>}
          </div>
        ) : (
          <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
              <div>
                <div style={{ fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6 }}>Price *</div>
                <input value={quote.price} onChange={e=>setQuote(q=>({...q,price:e.target.value}))} placeholder="e.g. 1250.00" style={inp} type="number" />
              </div>
              <div>
                <div style={{ fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6 }}>Condition</div>
                <select value={quote.condition} onChange={e=>setQuote(q=>({...q,condition:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                  <option value="">Select...</option>
                  {['New','Refurbished','Serviceable','Overhauled','As Removed','BER'].map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6 }}>Lead Time</div>
                <input value={quote.lead_time} onChange={e=>setQuote(q=>({...q,lead_time:e.target.value}))} placeholder="e.g. 3-5 days" style={inp} />
              </div>
              <div>
                <div style={{ fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6 }}>Supplier</div>
                <input value={quote.supplier_name} onChange={e=>setQuote(q=>({...q,supplier_name:e.target.value}))} placeholder="Supplier name" style={inp} />
              </div>
            </div>
            <div>
              <div style={{ fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6 }}>Notes</div>
              <input value={quote.notes} onChange={e=>setQuote(q=>({...q,notes:e.target.value}))} placeholder="Any additional notes" style={inp} />
            </div>
            <div style={{ display:'flex',gap:10 }}>
              <button onClick={saveQuote} disabled={!quote.price||saving} style={{ padding:'10px 24px',borderRadius:10,border:'none',background:(!quote.price||saving)?'var(--card-2)':BRAND,color:(!quote.price||saving)?'var(--text-3)':'#060610',fontWeight:700,fontSize:13,cursor:(!quote.price||saving)?'not-allowed':'pointer',fontFamily:'inherit' }}>
                {saving ? 'Saving…' : editing ? 'Update Quote' : 'Submit Quote'}
              </button>
              {editing && <button onClick={() => setEditing(false)} style={{ padding:'10px 20px',borderRadius:10,border:'1px solid var(--border)',background:'var(--card)',color:'var(--text-2)',fontWeight:600,fontSize:13,cursor:'pointer',fontFamily:'inherit' }}>Cancel</button>}
            </div>
          </div>
        )}
      </div>

      {/* Follow-ups */}
      <div style={card}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14 }}>
          <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:15,color:'var(--text)' }}>Follow-ups</div>
          <button onClick={() => setShowFollowup(v=>!v)} style={{ padding:'7px 14px',borderRadius:10,border:`1px solid ${BRAND}40`,background:`${BRAND}10`,color:BRAND,fontWeight:600,fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>+ Add</button>
        </div>
        {showFollowup && (
          <div style={{ display:'flex',gap:10,marginBottom:14,flexWrap:'wrap' }}>
            <input value={newFollowup.note} onChange={e=>setNewFollowup(f=>({...f,note:e.target.value}))} placeholder="Follow-up note..." style={{ ...inp, flex:2, minWidth:200 }} />
            <input value={newFollowup.follow_up_date} onChange={e=>setNewFollowup(f=>({...f,follow_up_date:e.target.value}))} type="date" style={{ ...inp, flex:1, minWidth:140 }} />
            <button onClick={addFollowup} style={{ padding:'9px 18px',borderRadius:10,border:'none',background:BRAND,color:'#060610',fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:'inherit',flexShrink:0 }}>Save</button>
          </div>
        )}
        {(part.followups||[]).length===0 ? (
          <div style={{ color:'var(--text-3)',fontSize:13,textAlign:'center',padding:'20px 0' }}>No follow-ups yet</div>
        ) : (
          <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
            {(part.followups||[]).map(fu=>(
              <div key={fu.id} style={{ display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:10,background:'var(--card-2)',border:`1px solid ${fu.completed?'var(--border)':fu.follow_up_date<new Date().toISOString().split('T')[0]?'#fecaca':'var(--border)'}` }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13,fontWeight:600,color:fu.completed?'var(--text-3)':'var(--text)',textDecoration:fu.completed?'line-through':'none' }}>{fu.note}</div>
                  {fu.follow_up_date&&<div style={{ fontSize:11,color:'var(--text-3)',marginTop:2 }}>{new Date(fu.follow_up_date).toLocaleDateString()}</div>}
                </div>
                {!fu.completed && <button onClick={() => completeFollowup(fu.id)} style={{ width:28,height:28,borderRadius:8,border:'1px solid var(--border)',background:'var(--card)',cursor:'pointer',fontSize:14,color:'var(--text-3)' }}>✓</button>}
                {fu.completed && <span style={{ fontSize:11,color:'#10b981',fontWeight:600 }}>✓ Done</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div style={card}>
        <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:15,color:'var(--text)',marginBottom:14 }}>Timeline</div>
        {(part.comments||[]).length===0 ? (
          <div style={{ color:'var(--text-3)',fontSize:13,textAlign:'center',padding:'20px 0' }}>No activity yet</div>
        ) : (
          <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
            {(part.comments||[]).map((c,i)=>{
              const isPriceChange = c.comment?.startsWith('Price updated:')
              return (
                <div key={c.id||i} style={{ display:'flex',gap:12,alignItems:'flex-start' }}>
                  <div style={{ width:34,height:34,borderRadius:10,background:isPriceChange?'#10b98120':`${BRAND}20`,color:isPriceChange?'#10b981':BRAND,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0 }}>
                    {isPriceChange?'💰':'📝'}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13,color:'var(--text)',lineHeight:1.4 }}>
                      <b>{c.user_name}</b> — {c.comment}
                    </div>
                    <div style={{ fontSize:11,color:'var(--text-3)',marginTop:2 }}>{c.created_at ? new Date(c.created_at).toLocaleString() : ''}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
