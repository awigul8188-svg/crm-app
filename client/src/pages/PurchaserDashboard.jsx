import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { purchasingApi } from '../api'
import { useAuth } from '../App'
import { formatDateShort, timeAgo } from '../components/Badges'

const BRAND = '#00D4C8'
const T = { lead:{ icon:'◎', label:'Lead', color:'#3b82f6' }, repeat:{ icon:'↻', label:'Repeat', color:'#6366f1' }, online_order:{ icon:'◈', label:'Order', color:'#f59e0b' } }
const CONDITIONS = ['New','Used','Refurbished','For Parts','Other']
const inp = { width:'100%', boxSizing:'border-box', background:'#fff', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'10px 14px', fontSize:'13px', color:'#0f172a', fontFamily:'"Plus Jakarta Sans",sans-serif', outline:'none', transition:'border 0.15s' }
const inpF = { border:`1px solid ${BRAND}`, boxShadow:`0 0 0 3px rgba(0,212,200,0.12)` }

function SInput({ value, onChange, placeholder, type='text' }) {
  const [f, setF] = useState(false)
  return <input type={type} value={value} onChange={onChange} placeholder={placeholder}
    style={{ ...inp, ...(f?inpF:{}) }} onFocus={() => setF(true)} onBlur={() => setF(false)} />
}

function STextarea({ value, onChange, placeholder }) {
  const [f, setF] = useState(false)
  return <textarea value={value} onChange={onChange} placeholder={placeholder} rows={2}
    style={{ ...inp, resize:'none', ...(f?inpF:{}) }} onFocus={() => setF(true)} onBlur={() => setF(false)} />
}

function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'center', padding:'14px 0' }}>
      <button onClick={() => onChange(page-1)} disabled={page===1}
        style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', color:page===1?'#cbd5e1':'#475569', cursor:page===1?'not-allowed':'pointer', fontSize:12, fontWeight:600, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>← Prev</button>
      <span style={{ fontSize:12, color:'#64748b' }}>Page {page} of {pages}</span>
      <button onClick={() => onChange(page+1)} disabled={page===pages}
        style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', color:page===pages?'#cbd5e1':'#475569', cursor:page===pages?'not-allowed':'pointer', fontSize:12, fontWeight:600, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Next →</button>
    </div>
  )
}

function StatCard({ label, value, color, icon, sub }) {
  return (
    <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', padding:'16px 18px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, left:0, width:3, height:'100%', background:color, borderRadius:'14px 0 0 14px' }} />
      <div style={{ position:'absolute', top:8, right:12, fontSize:18, opacity:0.12 }}>{icon}</div>
      <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:24, fontWeight:800, color:'#0f172a', fontFamily:'"Bricolage Grotesque",sans-serif' }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>{sub}</div>}
    </div>
  )
}

// Quote modal
function QuoteModal({ part, onClose, onSaved }) {
  const [price, setPrice] = useState(part.price || '')
  const [condition, setCondition] = useState(part.condition || '')
  const [customCond, setCustomCond] = useState('')
  const [leadTime, setLeadTime] = useState(part.lead_time || '')
  const [supplier, setSupplier] = useState(part.supplier_name || '')
  const [notes, setNotes] = useState(part.quote_notes || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!part.quote_id
  const finalCond = condition === 'Other' ? customCond : condition

  const handleSubmit = async () => {
    if (!price) return setError('Price is required')
    if (!condition) return setError('Please select a condition')
    if (condition === 'Other' && !customCond) return setError('Please specify the condition')
    setSaving(true); setError('')
    try {
      const res = await purchasingApi.submitQuote({ assignment_id: part.assignment_id, price, condition: finalCond, lead_time: leadTime, supplier_name: supplier, notes })
      if (res.error) throw new Error(res.error)
      onSaved(); onClose()
    } catch(e) { setError(e.message) }
    finally { setSaving(false) }
  }

  return createPortal(
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:20, boxShadow:'0 24px 80px rgba(0,0,0,0.25)', width:'100%', maxWidth:500, animation:'modalIn 0.18s ease-out', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
        <style>{`@keyframes modalIn{from{opacity:0;transform:scale(0.96) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>

        <div style={{ padding:'18px 24px 14px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:16, color:'#0f172a' }}>{isEdit ? 'Update Quote' : 'Submit Quote'}</div>
            <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:4, flexWrap:'wrap' }}>
              <span style={{ fontFamily:'monospace', fontWeight:800, fontSize:14, color:'#0f172a' }}>{part.part_number}</span>
              <span style={{ fontSize:12, color:'#64748b' }}>· Qty: {part.quantity||'—'}</span>
              {part.inquiry_type === 'online_order' && part.selling_price && <span style={{ fontWeight:700, color:'#10b981', fontSize:13 }}>· Selling: ${part.selling_price}</span>}
            </div>
            <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>{part.customer_name}{part.customer_company ? ` · ${part.customer_company}` : ''} · AE: {part.ae_name||'—'}</div>
          </div>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:10, border:'none', background:'#f1f5f9', cursor:'pointer', fontSize:18, color:'#64748b', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>×</button>
        </div>

        <div style={{ padding:'18px 24px 24px' }}>
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Price *</div>
            <SInput value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 250.00" />
          </div>

          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Condition *</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:condition==='Other'?8:0 }}>
              {CONDITIONS.map(c => (
                <button key={c} type="button" onClick={() => setCondition(c)}
                  style={{ padding:'7px 14px', borderRadius:10, border:`2px solid ${condition===c?BRAND:'#e2e8f0'}`, background:condition===c?`${BRAND}12`:'#fff', color:condition===c?'#00b8ad':'#64748b', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.15s', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
                  {c}
                </button>
              ))}
            </div>
            {condition==='Other' && <SInput value={customCond} onChange={e => setCustomCond(e.target.value)} placeholder="Specify condition..." />}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
            <div><div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Lead Time</div><SInput value={leadTime} onChange={e => setLeadTime(e.target.value)} placeholder="e.g. 3-5 days" /></div>
            <div><div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Supplier Name</div><SInput value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="e.g. ABC Electronics" /></div>
          </div>

          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Notes</div>
            <STextarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes..." />
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

// Parts list for one type
function TypePartsList({ type, statusFilter, onRefresh }) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [quotingPart, setQuotingPart] = useState(null)

  const load = () => {
    setLoading(true)
    purchasingApi.getMyParts({ type, status: statusFilter, page }).then(d => { setResult(d); setLoading(false) })
  }

  useEffect(() => { setPage(1) }, [type, statusFilter])
  useEffect(() => { load() }, [type, statusFilter, page])

  const parts = result?.parts || []
  const tInfo = T[type]

  if (loading) return (
    <div style={{ textAlign:'center', padding:48, color:'#94a3b8' }}>
      <div style={{ width:24, height:24, borderRadius:'50%', border:`2px solid ${BRAND}`, borderTopColor:'transparent', animation:'spin 0.8s linear infinite', margin:'0 auto 8px' }} />
      Loading...
    </div>
  )

  if (parts.length === 0) return (
    <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', padding:60, textAlign:'center' }}>
      <div style={{ fontSize:32, marginBottom:8, color:tInfo.color }}>{tInfo.icon}</div>
      <div style={{ color:'#94a3b8', fontSize:16, fontWeight:600 }}>No {tInfo.label} parts assigned</div>
      <div style={{ color:'#94a3b8', fontSize:13, marginTop:4 }}>Your purchasing manager will assign parts to you</div>
    </div>
  )

  return (
    <div>
      <div style={{ fontSize:12, color:'#94a3b8', marginBottom:12 }}>{result.total} total parts · showing {Math.min(30, parts.length)} per page</div>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {parts.map(p => (
          <div key={p.requirement_id} style={{ background:'#fff', borderRadius:14, border:`1px solid ${p.assignment_status==='pending'?'#f1f5f9':'#bbf7d0'}`, padding:'16px 20px', display:'flex', alignItems:'flex-start', gap:14, flexWrap:'wrap', transition:'all 0.15s' }}>
            {/* Type indicator */}
            <div style={{ width:42, height:42, borderRadius:10, background:`${tInfo.color}15`, color:tInfo.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{tInfo.icon}</div>

            {/* Part info */}
            <div style={{ flex:1, minWidth:200 }}>
              <div style={{ fontFamily:'monospace', fontWeight:800, fontSize:15, color:'#0f172a' }}>{p.part_number}</div>
              <div style={{ fontSize:12, color:'#64748b', marginTop:3 }}>
                Qty: <b>{p.quantity||'—'}</b> · {p.customer_name}
                {p.customer_company ? ` · ${p.customer_company}` : ''}
              </div>
              <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>
                AE: {p.ae_name||'—'} · Assigned {timeAgo(p.assigned_at)} · {formatDateShort(p.inquiry_date)}
              </div>
              {p.inquiry_notes && (
                <div style={{ marginTop:6, background:'#f8fafc', borderRadius:8, padding:'6px 10px', fontSize:12, color:'#64748b', border:'1px solid #f1f5f9' }}>
                  <span style={{ fontWeight:600, color:'#94a3b8', fontSize:10 }}>NOTES: </span>{p.inquiry_notes}
                </div>
              )}
            </div>

            {/* Selling price for orders */}
            {type === 'online_order' && p.selling_price && (
              <div style={{ textAlign:'center', flexShrink:0 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.08em' }}>Selling</div>
                <div style={{ fontSize:18, fontWeight:800, color:'#10b981', fontFamily:'"Bricolage Grotesque",sans-serif' }}>${p.selling_price}</div>
              </div>
            )}

            {/* Existing quote summary */}
            {p.quote_id && (
              <div style={{ background:'#f0fdf4', borderRadius:10, padding:'10px 14px', border:'1px solid #bbf7d0', flexShrink:0, minWidth:160 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#16a34a', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Your Quote</div>
                <div style={{ fontWeight:800, fontSize:16, color:'#16a34a', fontFamily:'"Bricolage Grotesque",sans-serif' }}>${p.price}</div>
                <div style={{ fontSize:11, color:'#64748b' }}>{p.condition} · {p.lead_time||'—'}</div>
                <div style={{ fontSize:11, color:'#94a3b8' }}>{p.supplier_name||'—'}</div>
                <div style={{ fontSize:10, color:'#94a3b8', marginTop:2 }}>{timeAgo(p.quoted_at)}</div>
              </div>
            )}

            {/* Action button */}
            <div style={{ flexShrink:0, alignSelf:'center' }}>
              <button onClick={() => setQuotingPart(p)}
                style={{ padding:'10px 20px', borderRadius:12, border:'none', background:p.quote_id?`${BRAND}15`:BRAND, color:p.quote_id?'#00b8ad':'#0d0d0d', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', whiteSpace:'nowrap' }}>
                {p.quote_id ? '↻ Update' : 'Submit Quote'}
              </button>
            </div>
          </div>
        ))}
      </div>
      <Pagination page={page} pages={result?.pages||1} onChange={setPage} />
      {quotingPart && <QuoteModal part={quotingPart} onClose={() => setQuotingPart(null)} onSaved={() => { load(); onRefresh() }} />}
    </div>
  )
}

export default function PurchaserDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [statusFilter, setStatusFilter] = useState('')

  const loadStats = () => purchasingApi.getStats().then(setStats)
  useEffect(() => { loadStats() }, [])

  const greeting = () => { const h = new Date().getHours(); return h<12?'Good morning':h<17?'Good afternoon':'Good evening' }

  const getTypeStats = (type) => stats?.byType?.find(t => t.type === type) || { total:0, pending_count:0, quoted_count:0 }

  const tabs = [
    { key:'dashboard', label:'📊 Dashboard' },
    { key:'lead',      label:`◎ Leads (${getTypeStats('lead').total})` },
    { key:'repeat',    label:`↻ Repeat (${getTypeStats('repeat').total})` },
    { key:'online_order', label:`◈ Orders (${getTypeStats('online_order').total})` },
  ]

  return (
    <div style={{ padding:28, maxWidth:1200, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:26, color:'#0f172a', margin:0 }}>{greeting()}, {user.name} 👋</h1>
          <p style={{ color:'#94a3b8', fontSize:14, marginTop:4 }}>Your assigned parts and quoting dashboard</p>
        </div>
        {activeTab !== 'dashboard' && (
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <span style={{ fontSize:12, color:'#64748b' }}>Show:</span>
            {[['','All'],['pending','Pending'],['quoted','Quoted']].map(([v,l]) => (
              <button key={v} onClick={() => setStatusFilter(v)}
                style={{ padding:'7px 14px', borderRadius:10, border:`1px solid ${statusFilter===v?BRAND:'#e2e8f0'}`, background:statusFilter===v?`${BRAND}12`:'#fff', color:statusFilter===v?'#00b8ad':'#64748b', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
                {l}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, background:'#f1f5f9', borderRadius:14, padding:4, marginBottom:24, flexWrap:'wrap' }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{ padding:'9px 16px', borderRadius:10, border:'none', background:activeTab===tab.key?'#fff':'transparent', color:activeTab===tab.key?'#0f172a':'#64748b', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', boxShadow:activeTab===tab.key?'0 1px 4px rgba(0,0,0,0.08)':'none', transition:'all 0.15s', whiteSpace:'nowrap' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'dashboard' && (
        <div>
          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:14, marginBottom:28 }}>
            <StatCard label="Total Assigned" value={stats?.myAssigned} color="#6366f1" icon="📋" />
            <StatCard label="Pending Quote" value={stats?.myPending} color="#f59e0b" icon="⏳" sub="Need your quote" />
            <StatCard label="Quoted" value={stats?.myQuoted} color="#10b981" icon="✅" />
            <StatCard label="Quoted Today" value={stats?.myToday} color={BRAND} icon="⚡" />
            <StatCard label="This Week" value={stats?.myThisWeek} color="#3b82f6" icon="📅" />
          </div>

          {/* By type breakdown */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:24 }}>
            {['lead','repeat','online_order'].map(type => {
              const tData = getTypeStats(type)
              const tInfo = T[type]
              return (
                <div key={type} style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', padding:20 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
                    <span style={{ fontSize:18, color:tInfo.color }}>{tInfo.icon}</span>
                    <span style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:15, color:'#0f172a' }}>{tInfo.label}s</span>
                    <span style={{ marginLeft:'auto', fontWeight:800, fontSize:20, color:'#0f172a', fontFamily:'"Bricolage Grotesque",sans-serif' }}>{tData.total}</span>
                  </div>
                  {[['Pending', tData.pending_count, '#f59e0b'],['Quoted', tData.quoted_count, '#10b981']].map(([l,v,c]) => (
                    <div key={l} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                      <span style={{ fontSize:12, color:'#64748b' }}>{l}</span>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flex:1, marginLeft:12 }}>
                        <div style={{ flex:1, height:5, background:'#f1f5f9', borderRadius:4 }}>
                          <div style={{ height:'100%', borderRadius:4, background:c, width:`${tData.total>0?Math.round(v/tData.total*100):0}%` }} />
                        </div>
                        <span style={{ fontSize:12, fontWeight:700, color:'#0f172a', minWidth:20, textAlign:'right' }}>{v}</span>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setActiveTab(type)}
                    style={{ width:'100%', marginTop:12, padding:'7px 0', borderRadius:8, border:`1px solid ${tInfo.color}30`, background:`${tInfo.color}10`, color:tInfo.color, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
                    View {tInfo.label} Parts →
                  </button>
                </div>
              )
            })}
          </div>

          {stats?.myPending > 0 && (
            <div style={{ background:'linear-gradient(135deg, #fff7ed, #fde68a)', border:'1px solid #fbbf24', borderRadius:14, padding:'16px 20px', display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:24 }}>⏳</span>
              <div>
                <div style={{ fontWeight:700, fontSize:15, color:'#92400e' }}>You have {stats.myPending} pending part{stats.myPending!==1?'s':''} to quote</div>
                <div style={{ fontSize:13, color:'#b45309', marginTop:2 }}>Click the Leads/Repeat/Orders tabs to submit your quotes</div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'lead'         && <TypePartsList type="lead"         statusFilter={statusFilter} onRefresh={loadStats} />}
      {activeTab === 'repeat'       && <TypePartsList type="repeat"       statusFilter={statusFilter} onRefresh={loadStats} />}
      {activeTab === 'online_order' && <TypePartsList type="online_order" statusFilter={statusFilter} onRefresh={loadStats} />}
    </div>
  )
}
