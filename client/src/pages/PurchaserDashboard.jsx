import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../App'
import { formatDateShort, timeAgo } from '../components/Badges'

const BRAND = '#00D4C8'
const TYPE_ICONS  = { lead:'◎', repeat:'↻', online_order:'◈' }
const TYPE_COLORS = { lead:'#3b82f6', repeat:'#6366f1', online_order:'#f59e0b' }

const CONDITIONS = ['New', 'Used', 'Refurbished', 'For Parts', 'Other']
const inp = { width:'100%', boxSizing:'border-box', background:'#fff', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'10px 14px', fontSize:'13px', color:'#0f172a', fontFamily:'"Plus Jakarta Sans",sans-serif', outline:'none', transition:'border 0.15s' }
const inpF = { border:`1px solid ${BRAND}`, boxShadow:`0 0 0 3px rgba(0,212,200,0.12)` }

function SInput({ value, onChange, placeholder, type='text' }) {
  const [f, setF] = useState(false)
  return <input type={type} value={value} onChange={onChange} placeholder={placeholder}
    style={{ ...inp, ...(f ? inpF : {}) }} onFocus={() => setF(true)} onBlur={() => setF(false)} />
}

function STextarea({ value, onChange, placeholder }) {
  const [f, setF] = useState(false)
  return <textarea value={value} onChange={onChange} placeholder={placeholder} rows={2}
    style={{ ...inp, resize:'none', ...(f ? inpF : {}) }} onFocus={() => setF(true)} onBlur={() => setF(false)} />
}

// Quote form modal
function QuoteModal({ part, onClose, onSaved }) {
  const [price, setPrice] = useState(part.price || '')
  const [condition, setCondition] = useState(part.condition || '')
  const [customCondition, setCustomCondition] = useState('')
  const [leadTime, setLeadTime] = useState(part.lead_time || '')
  const [supplierName, setSupplierName] = useState(part.supplier_name || '')
  const [notes, setNotes] = useState(part.quote_notes || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const finalCondition = condition === 'Other' ? customCondition : condition
  const isEdit = !!part.quote_id

  const handleSubmit = async () => {
    if (!price) return setError('Price is required')
    if (!condition) return setError('Condition is required')
    if (condition === 'Other' && !customCondition) return setError('Please specify condition')
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/purchasing/quote', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('crm_token')}` },
        body: JSON.stringify({ assignment_id: part.assignment_id, price, condition: finalCondition, lead_time: leadTime, supplier_name: supplierName, notes })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSaved()
      onClose()
    } catch(e) { setError(e.message) }
    finally { setSaving(false) }
  }

  return createPortal(
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:20, boxShadow:'0 24px 80px rgba(0,0,0,0.25)', width:'100%', maxWidth:500, animation:'modalIn 0.18s ease-out', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
        <style>{`@keyframes modalIn{from{opacity:0;transform:scale(0.96) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>

        {/* Header */}
        <div style={{ padding:'18px 24px 14px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:16, color:'#0f172a' }}>{isEdit ? 'Update Quote' : 'Submit Quote'}</div>
            <div style={{ fontSize:12, color:'#94a3b8', marginTop:3, display:'flex', gap:8, alignItems:'center' }}>
              <span style={{ fontFamily:'monospace', fontWeight:700, color:'#0f172a', fontSize:13 }}>{part.part_number}</span>
              <span>·</span><span>Qty: {part.quantity||'—'}</span>
              {part.selling_price && <><span>·</span><span style={{ color:'#10b981', fontWeight:600 }}>Selling: ${part.selling_price}</span></>}
            </div>
            <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>{part.customer_name} {part.customer_company ? `· ${part.customer_company}` : ''}</div>
          </div>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:10, border:'none', background:'#f1f5f9', cursor:'pointer', fontSize:18, color:'#64748b', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
        </div>

        <div style={{ padding:'20px 24px 24px' }}>
          {/* Price */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Price *</div>
            <SInput value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 250.00" type="text" />
          </div>

          {/* Condition */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Condition *</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom: condition === 'Other' ? 8 : 0 }}>
              {CONDITIONS.map(c => (
                <button key={c} type="button" onClick={() => setCondition(c)}
                  style={{ padding:'7px 14px', borderRadius:10, border:`2px solid ${condition===c?BRAND:'#e2e8f0'}`, background:condition===c?`${BRAND}12`:'#fff', color:condition===c?'#00b8ad':'#64748b', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.15s', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
                  {c}
                </button>
              ))}
            </div>
            {condition === 'Other' && <SInput value={customCondition} onChange={e => setCustomCondition(e.target.value)} placeholder="Specify condition..." />}
          </div>

          {/* Lead time + Supplier */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Lead Time</div>
              <SInput value={leadTime} onChange={e => setLeadTime(e.target.value)} placeholder="e.g. 3-5 days" />
            </div>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Supplier Name</div>
              <SInput value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="e.g. ABC Electronics" />
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Notes</div>
            <STextarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional notes..." />
          </div>

          {error && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:12, padding:'10px 14px', fontSize:13, color:'#dc2626', marginBottom:14 }}>⚠ {error}</div>}

          <div style={{ display:'flex', gap:10 }}>
            <button onClick={onClose} style={{ flex:1, padding:12, borderRadius:12, border:'1px solid #e2e8f0', background:'#fff', color:'#475569', fontWeight:600, fontSize:14, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Cancel</button>
            <button onClick={handleSubmit} disabled={saving}
              style={{ flex:2, padding:12, borderRadius:12, border:'none', background:saving?'#94a3b8':BRAND, color:'#0d0d0d', fontWeight:700, fontSize:14, cursor:saving?'not-allowed':'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              {saving ? <><div style={{ width:14, height:14, borderRadius:'50%', border:'2px solid #0d0d0d', borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />Saving...</> : isEdit ? '↻ Update Quote' : '✓ Submit Quote'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

function StatCard({ label, value, color, icon }) {
  return (
    <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', padding:'16px 20px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, left:0, width:3, height:'100%', background:color, borderRadius:'14px 0 0 14px' }} />
      <div style={{ position:'absolute', top:8, right:12, fontSize:20, opacity:0.12 }}>{icon}</div>
      <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:26, fontWeight:800, color:'#0f172a', fontFamily:'"Bricolage Grotesque",sans-serif' }}>{value ?? '—'}</div>
    </div>
  )
}

export default function PurchaserDashboard() {
  const { user } = useAuth()
  const [parts, setParts] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [quotingPart, setQuotingPart] = useState(null)
  const [activeTab, setActiveTab] = useState('pending')

  const token = localStorage.getItem('crm_token')
  const headers = { Authorization:`Bearer ${token}` }

  const load = () => {
    setLoading(true)
    Promise.all([
      fetch('/api/purchasing/my-parts', { headers }).then(r => r.json()),
      fetch('/api/purchasing/stats', { headers }).then(r => r.json()),
    ]).then(([partsData, statsData]) => {
      setParts(Array.isArray(partsData) ? partsData : [])
      setStats(statsData)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const pending = parts.filter(p => p.assignment_status === 'pending')
  const quoted  = parts.filter(p => p.assignment_status === 'quoted')

  const greeting = () => { const h = new Date().getHours(); return h<12?'Good morning':h<17?'Good afternoon':'Good evening' }

  return (
    <div style={{ padding:32, maxWidth:1100, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:26, color:'#0f172a', margin:0 }}>{greeting()}, {user.name} 👋</h1>
        <p style={{ color:'#94a3b8', fontSize:14, marginTop:4 }}>Your assigned parts and quoting dashboard</p>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
          <StatCard label="Total Assigned" value={stats.totalAssigned} color="#6366f1" icon="📋" />
          <StatCard label="Pending Quote" value={stats.pending} color="#f59e0b" icon="⏳" />
          <StatCard label="Quoted" value={stats.quoted} color="#10b981" icon="✅" />
          <StatCard label="Quoted Today" value={stats.quotedToday} color={BRAND} icon="⚡" />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, background:'#f1f5f9', borderRadius:12, padding:4, marginBottom:20, width:'fit-content' }}>
        {[['pending',`⏳ Pending (${pending.length})`],['quoted',`✅ Quoted (${quoted.length})`]].map(([k,l]) => (
          <button key={k} onClick={() => setActiveTab(k)} style={{ padding:'8px 16px', borderRadius:8, border:'none', background:activeTab===k?'#fff':'transparent', color:activeTab===k?'#0f172a':'#64748b', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', boxShadow:activeTab===k?'0 1px 4px rgba(0,0,0,0.08)':'none', transition:'all 0.15s', whiteSpace:'nowrap' }}>{l}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>
          <div style={{ width:28, height:28, borderRadius:'50%', border:`2px solid ${BRAND}`, borderTopColor:'transparent', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }} />
          Loading your parts...
        </div>
      ) : (
        <div>
          {activeTab === 'pending' && (
            pending.length === 0 ? (
              <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', padding:60, textAlign:'center' }}>
                <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
                <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:18, color:'#94a3b8' }}>All caught up!</div>
                <div style={{ color:'#94a3b8', fontSize:14, marginTop:6 }}>No parts pending a quote</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {pending.map(p => (
                  <div key={p.requirement_id} style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', padding:'16px 20px', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
                    {/* Type badge */}
                    <div style={{ width:40, height:40, borderRadius:10, background:`${TYPE_COLORS[p.inquiry_type]}18`, color:TYPE_COLORS[p.inquiry_type], display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                      {TYPE_ICONS[p.inquiry_type]}
                    </div>
                    {/* Part info */}
                    <div style={{ flex:1, minWidth:180 }}>
                      <div style={{ fontFamily:'monospace', fontWeight:800, fontSize:15, color:'#0f172a' }}>{p.part_number}</div>
                      <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>Qty: {p.quantity||'—'} · {p.customer_name}{p.customer_company ? ` · ${p.customer_company}` : ''}</div>
                      <div style={{ fontSize:11, color:'#94a3b8' }}>AE: {p.ae_name||'—'} · Assigned {timeAgo(p.assigned_at)}</div>
                    </div>
                    {/* Selling price if order */}
                    {p.inquiry_type === 'online_order' && p.selling_price && (
                      <div style={{ textAlign:'center', flexShrink:0 }}>
                        <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.08em' }}>Selling Price</div>
                        <div style={{ fontSize:18, fontWeight:800, color:'#10b981', fontFamily:'"Bricolage Grotesque",sans-serif' }}>${p.selling_price}</div>
                      </div>
                    )}
                    {/* Notes */}
                    {p.inquiry_notes && (
                      <div style={{ flex:'0 0 160px', fontSize:12, color:'#64748b', background:'#f8fafc', borderRadius:8, padding:'8px 10px', border:'1px solid #f1f5f9' }}>
                        <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', marginBottom:3 }}>INQUIRY NOTES</div>
                        <div style={{ overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{p.inquiry_notes}</div>
                      </div>
                    )}
                    {/* Submit quote button */}
                    <button onClick={() => setQuotingPart(p)}
                      style={{ padding:'10px 20px', borderRadius:12, border:'none', background:BRAND, color:'#0d0d0d', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', whiteSpace:'nowrap', flexShrink:0 }}>
                      Submit Quote
                    </button>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'quoted' && (
            quoted.length === 0 ? (
              <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', padding:60, textAlign:'center', color:'#94a3b8' }}>No quotes submitted yet</div>
            ) : (
              <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', overflow:'hidden' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ background:'#f8fafc', borderBottom:'2px solid #e2e8f0' }}>
                      {['Type','Part Number','Qty','Customer','Price','Condition','Lead Time','Supplier','Quoted',''].map(h => (
                        <th key={h} style={{ textAlign:'left', padding:'10px 14px', fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {quoted.map((p, i) => (
                      <tr key={p.requirement_id} style={{ borderBottom:'1px solid #f1f5f9', background:i%2===0?'#fff':'#fafbfc' }}>
                        <td style={{ padding:'10px 14px' }}><span style={{ fontSize:14, color:TYPE_COLORS[p.inquiry_type] }}>{TYPE_ICONS[p.inquiry_type]}</span></td>
                        <td style={{ padding:'10px 14px', fontFamily:'monospace', fontWeight:700, color:'#0f172a' }}>{p.part_number}</td>
                        <td style={{ padding:'10px 14px', color:'#475569' }}>{p.quantity||'—'}</td>
                        <td style={{ padding:'10px 14px', fontWeight:500, whiteSpace:'nowrap' }}>{p.customer_name}</td>
                        <td style={{ padding:'10px 14px', fontWeight:700, color:'#10b981', fontSize:14 }}>${p.price}</td>
                        <td style={{ padding:'10px 14px' }}><span style={{ fontSize:11, background:'#f1f5f9', padding:'3px 8px', borderRadius:6 }}>{p.condition}</span></td>
                        <td style={{ padding:'10px 14px', color:'#64748b', fontSize:12 }}>{p.lead_time||'—'}</td>
                        <td style={{ padding:'10px 14px', color:'#64748b', fontSize:12 }}>{p.supplier_name||'—'}</td>
                        <td style={{ padding:'10px 14px', color:'#94a3b8', fontSize:12, whiteSpace:'nowrap' }}>{timeAgo(p.quoted_at)}</td>
                        <td style={{ padding:'10px 14px' }}>
                          <button onClick={() => setQuotingPart(p)}
                            style={{ padding:'5px 12px', borderRadius:8, border:`1px solid ${BRAND}40`, background:`${BRAND}10`, color:'#00b8ad', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', whiteSpace:'nowrap' }}>
                            Update
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}

      {quotingPart && <QuoteModal part={quotingPart} onClose={() => setQuotingPart(null)} onSaved={load} />}
    </div>
  )
}
