import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { purchasingApi } from '../api'
import { api } from '../api'
import { formatDateShort, timeAgo } from '../components/Badges'
import Modal from '../components/Modal'

const BRAND = '#00D4C8'
const T = { lead: { icon:'◎', label:'Lead', color:'#3b82f6' }, repeat: { icon:'↻', label:'Repeat', color:'#6366f1' }, online_order: { icon:'◈', label:'Order', color:'#f59e0b' } }
const ST = { pending:{ bg:'#fff7ed', c:'#d97706', b:'#fed7aa', l:'Pending' }, quoted:{ bg:'#f0fdf4', c:'#16a34a', b:'#bbf7d0', l:'Quoted' }, unassigned:{ bg:'#f8fafc', c:'#64748b', b:'#e2e8f0', l:'Unassigned' } }
const inp = { width:'100%', boxSizing:'border-box', background:'#fff', border:'1px solid #e2e8f0', borderRadius:'10px', padding:'8px 12px', fontSize:'12px', color:'#0f172a', fontFamily:'"Plus Jakarta Sans",sans-serif', outline:'none' }
const PAGE_SIZE = 30

function SBadge({ status }) {
  const s = ST[status || 'unassigned']
  return <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:s.bg, color:s.c, border:`1px solid ${s.b}`, whiteSpace:'nowrap' }}>{s.l}</span>
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

function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'center', padding:'16px 0' }}>
      <button onClick={() => onChange(page - 1)} disabled={page === 1} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', color: page===1?'#cbd5e1':'#475569', cursor:page===1?'not-allowed':'pointer', fontSize:12, fontWeight:600, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>← Prev</button>
      <span style={{ fontSize:12, color:'#64748b' }}>Page {page} of {pages}</span>
      <button onClick={() => onChange(page + 1)} disabled={page === pages} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', color: page===pages?'#cbd5e1':'#475569', cursor:page===pages?'not-allowed':'pointer', fontSize:12, fontWeight:600, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Next →</button>
    </div>
  )
}

// Assign dropdown
function AssignCell({ part, purchasers, onAssign }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ padding:'5px 10px', borderRadius:8, border:`1px solid ${part.purchaser_id?BRAND+'40':'#e2e8f0'}`, background:part.purchaser_id?`${BRAND}10`:'#f8fafc', color:part.purchaser_id?'#00b8ad':'#64748b', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', whiteSpace:'nowrap' }}>
        {part.purchaser_name || '+ Assign'} ▾
      </button>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:9999, background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, boxShadow:'0 8px 24px rgba(0,0,0,0.12)', minWidth:160, overflow:'hidden' }}>
          {purchasers.map(p => (
            <div key={p.id} onClick={() => { onAssign(part.requirement_id, p.id); setOpen(false) }}
              style={{ padding:'8px 14px', cursor:'pointer', fontSize:12, fontWeight:p.id===part.purchaser_id?700:400, color:p.id===part.purchaser_id?BRAND:'#0f172a', display:'flex', gap:8, alignItems:'center' }}
              onMouseEnter={e => e.currentTarget.style.background=`${BRAND}08`}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}>
              <div style={{ width:20, height:20, borderRadius:6, background:`${BRAND}20`, color:BRAND, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0 }}>{p.name[0]}</div>
              {p.name} {p.id===part.purchaser_id && '✓'}
            </div>
          ))}
          {part.purchaser_id && <>
            <div style={{ height:1, background:'#f1f5f9' }} />
            <div onClick={() => { purchasingApi.unassign(part.requirement_id).then(() => onAssign(null, null)); setOpen(false) }}
              style={{ padding:'8px 14px', cursor:'pointer', fontSize:12, color:'#ef4444' }}
              onMouseEnter={e => e.currentTarget.style.background='#fef2f2'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}>✕ Unassign</div>
          </>}
        </div>
      )}
    </div>
  )
}

// Inquiry assign modal (from notification)
function InquiryAssignModal({ inquiryId, onClose, onSaved }) {
  const [data, setData] = useState(null)
  const [purchasers, setPurchasers] = useState([])
  const [assignments, setAssignments] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([purchasingApi.getInquiryParts(inquiryId), purchasingApi.getPurchasers()])
      .then(([d, p]) => {
        setData(d)
        setPurchasers(p)
        const initAssign = {}
        d.parts?.forEach(part => { if (part.purchaser_id) initAssign[part.requirement_id] = part.purchaser_id })
        setAssignments(initAssign)
      })
  }, [inquiryId])

  const handleSave = async () => {
    setSaving(true)
    const toAssign = Object.entries(assignments).filter(([,pid]) => pid).map(([rid, pid]) => ({ requirement_id: parseInt(rid), purchaser_id: pid }))
    if (toAssign.length) await purchasingApi.assignBulk({ assignments: toAssign })
    setSaving(false)
    onSaved()
    onClose()
  }

  if (!data) return createPortal(
    <div style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'#fff', borderRadius:20, padding:40, color:'#94a3b8' }}>Loading...</div>
    </div>, document.body
  )

  const { inquiry, parts } = data
  const tInfo = T[inquiry?.type]

  return createPortal(
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:20, boxShadow:'0 24px 80px rgba(0,0,0,0.25)', width:'100%', maxWidth:640, maxHeight:'88vh', display:'flex', flexDirection:'column', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
        <div style={{ padding:'18px 24px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <span style={{ fontSize:13, fontWeight:600, color:tInfo?.color, background:`${tInfo?.color}15`, padding:'3px 8px', borderRadius:6 }}>{tInfo?.icon} {tInfo?.label}</span>
              <span style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:16, color:'#0f172a' }}>{inquiry?.customer_name}</span>
              {inquiry?.company && <span style={{ fontSize:12, color:'#94a3b8' }}>· {inquiry?.company}</span>}
            </div>
            <div style={{ fontSize:12, color:'#64748b' }}>AE: {inquiry?.ae_name||'—'} · {formatDateShort(inquiry?.created_at)} · {parts.length} part{parts.length!==1?'s':''}</div>
          </div>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:10, border:'none', background:'#f1f5f9', cursor:'pointer', fontSize:18, color:'#64748b', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
        </div>
        <div style={{ overflowY:'auto', flex:1, padding:'16px 24px' }}>
          {parts.length === 0 ? (
            <div style={{ textAlign:'center', color:'#94a3b8', padding:40 }}>No parts in this inquiry</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {parts.map(part => (
                <div key={part.requirement_id} style={{ background:'#f8fafc', borderRadius:12, padding:'14px 16px', border:'1px solid #f1f5f9', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                  <div style={{ flex:1, minWidth:160 }}>
                    <div style={{ fontFamily:'monospace', fontWeight:800, fontSize:14, color:'#0f172a' }}>{part.part_number}</div>
                    <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>Qty: {part.quantity||'—'}{part.selling_price && inquiry?.type==='online_order' ? ` · Selling: $${part.selling_price}` : ''}</div>
                    {part.quoted_at && <div style={{ fontSize:11, color:'#10b981', marginTop:2 }}>✓ Quoted: ${part.price} · {part.condition}</div>}
                  </div>
                  <div style={{ flexShrink:0 }}>
                    <select value={assignments[part.requirement_id] || ''} onChange={e => setAssignments(prev => ({ ...prev, [part.requirement_id]: e.target.value ? parseInt(e.target.value) : null }))}
                      style={{ ...inp, width:'auto', cursor:'pointer', minWidth:160 }}>
                      <option value="">— Select purchaser —</option>
                      {purchasers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ padding:'14px 24px', borderTop:'1px solid #f1f5f9', display:'flex', gap:10, flexShrink:0 }}>
          <button onClick={onClose} style={{ flex:1, padding:11, borderRadius:12, border:'1px solid #e2e8f0', background:'#fff', color:'#475569', fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex:2, padding:11, borderRadius:12, border:'none', background:saving?'#94a3b8':BRAND, color:'#0d0d0d', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
            {saving ? 'Saving...' : '✓ Save Assignments'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// Parts table (reused for each type tab)
function PartsTable({ type, purchasers, onRefresh }) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')

  const load = () => {
    setLoading(true)
    purchasingApi.getParts({ type, status: filterStatus, page }).then(d => { setResult(d); setLoading(false) })
  }

  useEffect(() => { setPage(1) }, [type, filterStatus])
  useEffect(() => { load() }, [type, filterStatus, page])

  const handleAssign = async (reqId, purchaserId) => {
    if (purchaserId) await purchasingApi.assign({ requirement_id: reqId, purchaser_id: purchaserId })
    else await purchasingApi.unassign(reqId)
    load(); onRefresh()
  }

  const filtered = (result?.parts || []).filter(p => !search || p.part_number?.toLowerCase().includes(search.toLowerCase()) || p.customer_name?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search part number, customer..."
          style={{ ...inp, width:240 }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, width:'auto', cursor:'pointer' }}>
          <option value="">All Statuses</option>
          <option value="unassigned">Unassigned</option>
          <option value="pending">Pending Quote</option>
          <option value="quoted">Quoted</option>
        </select>
        {result && <div style={{ fontSize:12, color:'#94a3b8', marginLeft:'auto' }}>{result.total} total · showing {PAGE_SIZE}/page</div>}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:48, color:'#94a3b8' }}>
          <div style={{ width:24, height:24, borderRadius:'50%', border:`2px solid ${BRAND}`, borderTopColor:'transparent', animation:'spin 0.8s linear infinite', margin:'0 auto 8px' }} />
          Loading...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', padding:48, textAlign:'center', color:'#94a3b8' }}>
          <div style={{ fontSize:32, marginBottom:8 }}>🔩</div>
          No parts found
        </div>
      ) : (
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#f8fafc', borderBottom:'2px solid #e2e8f0' }}>
                  {['Part Number','Qty','Customer','AE',...(type==='online_order'?['Selling Price']:[]),'Date','Status','Assign To','Quote'].map(h => (
                    <th key={h} style={{ textAlign:'left', padding:'10px 14px', fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={p.requirement_id} style={{ borderBottom:'1px solid #f1f5f9', background:i%2===0?'#fff':'#fafbfc' }}>
                    <td style={{ padding:'10px 14px', fontFamily:'monospace', fontWeight:700, color:'#0f172a', fontSize:13 }}>{p.part_number}</td>
                    <td style={{ padding:'10px 14px', color:'#475569' }}>{p.quantity||'—'}</td>
                    <td style={{ padding:'10px 14px', fontWeight:500, whiteSpace:'nowrap' }}>
                      {p.customer_name}
                      {p.customer_company && <div style={{ fontSize:11, color:'#94a3b8' }}>{p.customer_company}</div>}
                    </td>
                    <td style={{ padding:'10px 14px', color:'#64748b', whiteSpace:'nowrap' }}>{p.ae_name||'—'}</td>
                    {type==='online_order' && <td style={{ padding:'10px 14px', fontWeight:700, color:'#10b981' }}>{p.selling_price?`$${p.selling_price}`:'—'}</td>}
                    <td style={{ padding:'10px 14px', color:'#94a3b8', fontSize:12, whiteSpace:'nowrap' }}>{formatDateShort(p.inquiry_date)}</td>
                    <td style={{ padding:'10px 14px' }}><SBadge status={p.assignment_id ? p.assignment_status : 'unassigned'} /></td>
                    <td style={{ padding:'10px 14px' }}><AssignCell part={p} purchasers={purchasers} onAssign={handleAssign} /></td>
                    <td style={{ padding:'10px 14px', maxWidth:180 }}>
                      {p.quote_id ? (
                        <div>
                          <div style={{ fontWeight:700, color:'#10b981' }}>${p.price}</div>
                          <div style={{ fontSize:11, color:'#64748b' }}>{p.condition}{p.lead_time ? ` · ${p.lead_time}` : ''}</div>
                          <div style={{ fontSize:11, color:'#94a3b8' }}>{p.supplier_name} · {timeAgo(p.quoted_at)}</div>
                        </div>
                      ) : <span style={{ color:'#cbd5e1', fontSize:12 }}>No quote yet</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pages={result?.pages || 1} onChange={setPage} />
        </div>
      )}
    </div>
  )
}

export default function PurchasingManagerView() {
  const [stats, setStats] = useState(null)
  const [purchasers, setPurchasers] = useState([])
  const [notifications, setNotifications] = useState([])
  const [activeTab, setActiveTab] = useState('dashboard')
  const [assignInquiryId, setAssignInquiryId] = useState(null)

  // New purchaser modal
  const [showNewUser, setShowNewUser] = useState(false)
  const [newUserForm, setNewUserForm] = useState({ name:'', username:'', password:'' })
  const [savingUser, setSavingUser] = useState(false)
  const [userError, setUserError] = useState('')

  // Reset passwords modal
  const [resetting, setResetting] = useState(false)
  const [resetResults, setResetResults] = useState(null)
  const [copiedAll, setCopiedAll] = useState(false)

  const token = localStorage.getItem('crm_token')
  const headers = { Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }

  const loadStats = () => purchasingApi.getStats().then(setStats)
  const loadPurchasers = () => purchasingApi.getPurchasers().then(setPurchasers)
  const loadNotifications = () => api.getNotifications().then(n => setNotifications((n.activity || []).filter(notif => notif.inquiry_type?.endsWith('_parts'))))

  useEffect(() => { loadStats(); loadPurchasers(); loadNotifications() }, [])

  const handleCreatePurchaser = async () => {
    setSavingUser(true); setUserError('')
    try {
      const res = await fetch('/api/users', { method:'POST', headers, body:JSON.stringify({ ...newUserForm, role:'purchaser' }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setShowNewUser(false); setNewUserForm({ name:'', username:'', password:'' })
      loadPurchasers()
    } catch(e) { setUserError(e.message) }
    finally { setSavingUser(false) }
  }

  const handleResetPasswords = async () => {
    if (!confirm('Reset passwords for all purchasers?')) return
    setResetting(true)
    const data = await purchasingApi.resetPurchaserPasswords()
    setResetResults(data.results)
    setResetting(false)
  }

  const handleNotifClick = async (notif) => {
    // Mark read
    await api.markNotificationRead(notif.id).catch(() => {})
    setNotifications(prev => prev.map(n => n.id===notif.id ? {...n, read:1} : n))
    // Open assign modal - extract inquiry_id from notification
    if (notif.inquiry_id) setAssignInquiryId(notif.inquiry_id)
  }

  const tabs = [
    { key:'dashboard',     label:'📊 Dashboard'    },
    { key:'leads',         label:'◎ Leads'          },
    { key:'repeat',        label:'↻ Repeat'         },
    { key:'orders',        label:'◈ Online Orders'  },
    { key:'notifications', label:`🔔 New Parts${notifications.filter(n=>!n.read).length > 0 ? ` (${notifications.filter(n=>!n.read).length})` : ''}` },
  ]

  const ms = stats

  return (
    <div style={{ padding:28, maxWidth:1300, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:26, color:'#0f172a', margin:0 }}>🔧 Purchasing Dashboard</h1>
          <p style={{ color:'#94a3b8', fontSize:14, marginTop:4 }}>Manage part assignments and track quotes</p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button onClick={handleResetPasswords} disabled={resetting}
            style={{ padding:'8px 16px', borderRadius:12, border:'1px solid #fecaca', background:'#fff5f5', color:'#dc2626', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
            🔑 Reset Purchaser Passwords
          </button>
          <button onClick={() => setShowNewUser(true)}
            style={{ padding:'8px 18px', borderRadius:12, border:'none', background:BRAND, color:'#0d0d0d', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
            + Add Purchaser
          </button>
        </div>
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

      {/* Dashboard tab */}
      {activeTab === 'dashboard' && (
        <div>
          {/* Top stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:14, marginBottom:24 }}>
            <StatCard label="Total Parts" value={ms?.totalParts} color="#6366f1" icon="🔩" />
            <StatCard label="Unassigned" value={ms?.unassigned} color="#ef4444" icon="📋" sub="Need assignment" />
            <StatCard label="Pending Quote" value={ms?.pending} color="#f59e0b" icon="⏳" sub="Assigned, awaiting" />
            <StatCard label="Quoted" value={ms?.quoted} color="#10b981" icon="✅" sub="Completed" />
            <StatCard label="Quoted Today" value={ms?.quotedToday} color={BRAND} icon="⚡" />
            <StatCard label="New Today" value={ms?.newToday} color="#3b82f6" icon="🆕" sub="New parts added" />
          </div>

          {/* By type breakdown */}
          {ms?.byType?.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:24 }}>
              {['lead','repeat','online_order'].map(type => {
                const tData = ms.byType.find(t => t.type === type) || { total:0, unassigned:0, pending:0, quoted:0 }
                const tInfo = T[type]
                return (
                  <div key={type} style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', padding:20 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
                      <span style={{ fontSize:16, color:tInfo.color }}>{tInfo.icon}</span>
                      <span style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:14, color:'#0f172a' }}>{tInfo.label} Parts</span>
                      <span style={{ marginLeft:'auto', fontWeight:800, fontSize:18, color:'#0f172a', fontFamily:'"Bricolage Grotesque",sans-serif' }}>{tData.total}</span>
                    </div>
                    {[['Unassigned', tData.unassigned, '#ef4444'], ['Pending', tData.pending, '#f59e0b'], ['Quoted', tData.quoted, '#10b981']].map(([l, v, c]) => (
                      <div key={l} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                        <span style={{ fontSize:12, color:'#64748b' }}>{l}</span>
                        <div style={{ display:'flex', alignItems:'center', gap:8, flex:1, marginLeft:12 }}>
                          <div style={{ flex:1, height:5, background:'#f1f5f9', borderRadius:4 }}>
                            <div style={{ height:'100%', borderRadius:4, background:c, width:`${tData.total>0?Math.round(v/tData.total*100):0}%` }} />
                          </div>
                          <span style={{ fontSize:12, fontWeight:700, color:'#0f172a', minWidth:24, textAlign:'right' }}>{v}</span>
                        </div>
                      </div>
                    ))}
                    <button onClick={() => setActiveTab(type === 'online_order' ? 'orders' : type)}
                      style={{ width:'100%', marginTop:12, padding:'7px 0', borderRadius:8, border:`1px solid ${tInfo.color}30`, background:`${tInfo.color}10`, color:tInfo.color, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
                      View {tInfo.label} Parts →
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
            {/* Purchaser performance */}
            <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', padding:20 }}>
              <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:14, color:'#0f172a', marginBottom:16 }}>Purchaser Performance</div>
              {!ms?.byPurchaser?.length ? (
                <div style={{ textAlign:'center', color:'#94a3b8', padding:24 }}>No purchasers assigned yet</div>
              ) : ms.byPurchaser.map(p => (
                <div key={p.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid #f8fafc' }}>
                  <div style={{ width:32, height:32, borderRadius:8, background:`${BRAND}20`, color:BRAND, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:13, flexShrink:0 }}>{p.name[0]}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:13, color:'#0f172a' }}>{p.name}</div>
                    <div style={{ height:4, background:'#f1f5f9', borderRadius:4, marginTop:4 }}>
                      <div style={{ height:'100%', borderRadius:4, background:'#10b981', width:`${p.assigned>0?Math.round(p.quoted_count/p.assigned*100):0}%` }} />
                    </div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#10b981' }}>{p.quoted_count} quoted</div>
                    <div style={{ fontSize:11, color:'#94a3b8' }}>{p.pending_count} pending · {p.assigned} total</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Recent quotes */}
            <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', padding:20 }}>
              <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:14, color:'#0f172a', marginBottom:16 }}>Recent Quotes</div>
              {!ms?.recentQuotes?.length ? (
                <div style={{ textAlign:'center', color:'#94a3b8', padding:24 }}>No quotes yet</div>
              ) : ms.recentQuotes.map((q, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid #f8fafc' }}>
                  <span style={{ fontSize:13, color:T[q.inquiry_type]?.color }}>{T[q.inquiry_type]?.icon}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', gap:6 }}>
                      <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:12, color:'#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{q.part_number}</span>
                      <span style={{ fontSize:12, color:'#64748b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{q.customer_name}</span>
                    </div>
                    <div style={{ fontSize:11, color:'#94a3b8' }}>{q.purchaser_name} · {timeAgo(q.updated_at)}</div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontWeight:700, color:'#10b981', fontSize:'13' }}>${q.price}</div>
                    <div style={{ fontSize:11, color:'#64748b' }}>{q.condition}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Parts tabs */}
      {activeTab === 'leads'   && <PartsTable type="lead"         purchasers={purchasers} onRefresh={loadStats} />}
      {activeTab === 'repeat'  && <PartsTable type="repeat"       purchasers={purchasers} onRefresh={loadStats} />}
      {activeTab === 'orders'  && <PartsTable type="online_order" purchasers={purchasers} onRefresh={loadStats} />}

      {/* Notifications tab */}
      {activeTab === 'notifications' && (
        <div>
          <div style={{ marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontSize:12, color:'#94a3b8' }}>Click any notification to open the inquiry and assign purchasers</div>
            <button onClick={() => api.markAllRead().then(loadNotifications)} style={{ fontSize:11, color:BRAND, background:'none', border:'none', cursor:'pointer', fontWeight:600, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Mark all read</button>
          </div>
          {notifications.length === 0 ? (
            <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', padding:60, textAlign:'center' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>📭</div>
              <div style={{ color:'#94a3b8', fontSize:16, fontWeight:600 }}>No new part notifications</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {notifications.map(notif => {
                const type = notif.inquiry_type?.replace('_parts','')
                const tInfo = T[type] || { icon:'🔩', color:BRAND }
                return (
                  <div key={notif.id} onClick={() => handleNotifClick(notif)}
                    style={{ background:notif.read?'#fff':'rgba(0,212,200,0.04)', border:`1px solid ${notif.read?'#f1f5f9':'rgba(0,212,200,0.2)'}`, borderRadius:14, padding:'14px 18px', cursor:'pointer', display:'flex', gap:12, alignItems:'center', transition:'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor=BRAND; e.currentTarget.style.boxShadow=`0 2px 12px rgba(0,212,200,0.1)` }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor=notif.read?'#f1f5f9':'rgba(0,212,200,0.2)'; e.currentTarget.style.boxShadow='none' }}>
                    <div style={{ width:40, height:40, borderRadius:10, background:`${tInfo.color}15`, color:tInfo.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{tInfo.icon}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3, flexWrap:'wrap' }}>
                        <span style={{ fontWeight:700, fontSize:13, color:'#0f172a' }}>{notif.actor_name}</span>
                        <span style={{ fontSize:13, color:'#475569' }}>added parts to</span>
                        <span style={{ fontWeight:600, color:tInfo.color }}>{notif.customer_name}</span>
                      </div>
                      {notif.comment && <div style={{ fontSize:12, color:'#64748b', fontFamily:'monospace', background:'#f8fafc', padding:'4px 8px', borderRadius:6 }}>{notif.comment}</div>}
                      <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>{timeAgo(notif.created_at)} · Click to assign purchaser →</div>
                    </div>
                    {!notif.read && <div style={{ width:8, height:8, borderRadius:'50%', background:BRAND, flexShrink:0 }} />}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Inquiry assign modal */}
      {assignInquiryId && (
        <InquiryAssignModal
          inquiryId={assignInquiryId}
          onClose={() => setAssignInquiryId(null)}
          onSaved={() => { loadStats(); loadNotifications() }}
        />
      )}

      {/* Add purchaser modal */}
      {showNewUser && (
        <Modal title="Add New Purchaser" onClose={() => { setShowNewUser(false); setNewUserForm({ name:'', username:'', password:'' }); setUserError('') }}>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {[['Full Name','name','text','e.g. John Smith'],['Username','username','text','e.g. john'],['Password','password','password','Set initial password']].map(([l,k,t,ph]) => (
              <div key={k}><div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>{l}</div>
                <input type={t} placeholder={ph} value={newUserForm[k]} onChange={e => setNewUserForm(f => ({...f,[k]:e.target.value}))} style={{ ...inp, padding:'10px 14px' }} /></div>
            ))}
            {userError && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#dc2626' }}>⚠ {userError}</div>}
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setShowNewUser(false)} style={{ flex:1, padding:11, borderRadius:12, border:'1px solid #e2e8f0', background:'#fff', color:'#475569', fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Cancel</button>
              <button onClick={handleCreatePurchaser} disabled={savingUser} style={{ flex:1, padding:11, borderRadius:12, border:'none', background:BRAND, color:'#0d0d0d', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>{savingUser?'Adding...':'Add Purchaser'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reset passwords modal */}
      {resetResults && (
        <Modal title="🔑 Purchaser Passwords Reset" onClose={() => setResetResults(null)} wide>
          <div style={{ background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:12, padding:'10px 14px', marginBottom:14, fontSize:13, color:'#c2410c' }}>⚠ Save these — they won't be shown again</div>
          <div style={{ border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden', marginBottom:14 }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>{['Name','Username','New Password',''].map(h => <th key={h} style={{ textAlign:'left', padding:'8px 14px', fontSize:11, fontWeight:700, color:'#64748b' }}>{h}</th>)}</tr></thead>
              <tbody>{resetResults.map((r,i) => (
                <tr key={r.id} style={{ borderBottom:i<resetResults.length-1?'1px solid #f1f5f9':'none' }}>
                  <td style={{ padding:'10px 14px', fontWeight:600 }}>{r.name}</td>
                  <td style={{ padding:'10px 14px', fontFamily:'monospace', color:'#64748b' }}>{r.username}</td>
                  <td style={{ padding:'10px 14px' }}><span style={{ fontFamily:'monospace', fontWeight:700, background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:6, padding:'3px 8px' }}>{r.password}</span></td>
                  <td style={{ padding:'10px 14px' }}><button onClick={() => navigator.clipboard.writeText(r.password)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:14 }}>📋</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={() => { navigator.clipboard.writeText(resetResults.map(r=>`${r.name} (${r.username}): ${r.password}`).join('\n')); setCopiedAll(true); setTimeout(()=>setCopiedAll(false),2000) }}
              style={{ flex:1, padding:11, borderRadius:12, border:`1px solid ${BRAND}`, background:copiedAll?BRAND:`${BRAND}15`, color:copiedAll?'#0d0d0d':'#00b8ad', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
              {copiedAll?'✓ Copied!':'📋 Copy All'}
            </button>
            <button onClick={() => setResetResults(null)} style={{ flex:1, padding:11, borderRadius:12, border:'1px solid #e2e8f0', background:'#fff', color:'#475569', fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Done</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
