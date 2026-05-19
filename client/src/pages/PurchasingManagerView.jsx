import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../App'
import { formatDateShort, timeAgo } from '../components/Badges'
import Modal from '../components/Modal'

const BRAND = '#00D4C8'
const TYPE_ICONS  = { lead:'◎', repeat:'↻', online_order:'◈' }
const TYPE_COLORS = { lead:'#3b82f6', repeat:'#6366f1', online_order:'#f59e0b' }
const STATUS_STYLE = {
  pending: { bg:'#fff7ed', color:'#d97706', border:'#fed7aa', label:'Pending' },
  quoted:  { bg:'#f0fdf4', color:'#16a34a', border:'#bbf7d0', label:'Quoted'  },
  unassigned: { bg:'#f8fafc', color:'#64748b', border:'#e2e8f0', label:'Unassigned' },
}
const inp = { width:'100%', boxSizing:'border-box', background:'#fff', border:'1px solid #e2e8f0', borderRadius:'10px', padding:'8px 12px', fontSize:'12px', color:'#0f172a', fontFamily:'"Plus Jakarta Sans",sans-serif', outline:'none' }

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status || 'unassigned']
  return <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:s.bg, color:s.color, border:`1px solid ${s.border}` }}>{s.label}</span>
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

// Assign dropdown for a single part row
function AssignDropdown({ part, purchasers, onAssign, onUnassign }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const handleAssign = async (purchaserId) => {
    setOpen(false)
    await onAssign(part.requirement_id, purchaserId)
  }
  const handleUnassign = async () => {
    setOpen(false)
    await onUnassign(part.requirement_id)
  }

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ padding:'5px 12px', borderRadius:8, border:`1px solid ${part.purchaser_id ? BRAND+'40' : '#e2e8f0'}`, background: part.purchaser_id ? `${BRAND}10` : '#f8fafc', color: part.purchaser_id ? '#00b8ad' : '#64748b', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', whiteSpace:'nowrap' }}>
        {part.purchaser_name || '+ Assign'} {part.purchaser_id ? '▾' : '▾'}
      </button>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:9999, background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, boxShadow:'0 8px 24px rgba(0,0,0,0.12)', minWidth:160, overflow:'hidden' }}>
          {purchasers.map(p => (
            <div key={p.id} onClick={() => handleAssign(p.id)}
              style={{ padding:'9px 14px', cursor:'pointer', fontSize:12, fontWeight: p.id === part.purchaser_id ? 700 : 400, color: p.id === part.purchaser_id ? BRAND : '#0f172a', background: p.id === part.purchaser_id ? `${BRAND}08` : 'transparent', display:'flex', alignItems:'center', gap:8 }}
              onMouseEnter={e => e.currentTarget.style.background=`${BRAND}08`}
              onMouseLeave={e => e.currentTarget.style.background=p.id===part.purchaser_id?`${BRAND}08`:'transparent'}>
              <div style={{ width:20, height:20, borderRadius:6, background:`${BRAND}25`, color:'#00b8ad', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0 }}>{p.name[0]}</div>
              {p.name}
              {p.id === part.purchaser_id && <span style={{ marginLeft:'auto', color:BRAND }}>✓</span>}
            </div>
          ))}
          {part.purchaser_id && (
            <>
              <div style={{ height:1, background:'#f1f5f9', margin:'4px 0' }} />
              <div onClick={handleUnassign} style={{ padding:'9px 14px', cursor:'pointer', fontSize:12, color:'#ef4444', display:'flex', alignItems:'center', gap:6 }}
                onMouseEnter={e => e.currentTarget.style.background='#fef2f2'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                ✕ Unassign
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function PurchasingManagerView() {
  const { user } = useAuth()
  const [parts, setParts] = useState([])
  const [quotes, setQuotes] = useState([])
  const [purchasers, setPurchasers] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('parts')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPurchaser, setFilterPurchaser] = useState('')
  const [filterType, setFilterType] = useState('')
  const [search, setSearch] = useState('')

  // New purchaser modal
  const [showNewUser, setShowNewUser] = useState(false)
  const [newUserForm, setNewUserForm] = useState({ name:'', username:'', password:'' })
  const [savingUser, setSavingUser] = useState(false)
  const [userError, setUserError] = useState('')

  const token = localStorage.getItem('crm_token')
  const headers = { Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }

  const load = async () => {
    setLoading(true)
    const qs = new URLSearchParams()
    if (filterStatus) qs.set('status', filterStatus)
    if (filterPurchaser) qs.set('purchaser_id', filterPurchaser)
    if (filterType) qs.set('type', filterType)
    const [partsRes, quotesRes, purchasersRes, statsRes] = await Promise.all([
      fetch(`/api/purchasing/parts?${qs}`, { headers }).then(r => r.json()),
      fetch('/api/purchasing/quotes', { headers }).then(r => r.json()),
      fetch('/api/purchasing/purchasers', { headers }).then(r => r.json()),
      fetch('/api/purchasing/stats', { headers }).then(r => r.json()),
    ])
    setParts(Array.isArray(partsRes) ? partsRes : [])
    setQuotes(Array.isArray(quotesRes) ? quotesRes : [])
    setPurchasers(Array.isArray(purchasersRes) ? purchasersRes : [])
    setStats(statsRes)
    setLoading(false)
  }

  useEffect(() => { load() }, [filterStatus, filterPurchaser, filterType])

  const handleAssign = async (requirementId, purchaserId) => {
    await fetch('/api/purchasing/assign', { method:'POST', headers, body: JSON.stringify({ requirement_id: requirementId, purchaser_id: purchaserId }) })
    load()
  }

  const handleUnassign = async (requirementId) => {
    await fetch(`/api/purchasing/assign/${requirementId}`, { method:'DELETE', headers })
    load()
  }

  const handleCreatePurchaser = async () => {
    setSavingUser(true); setUserError('')
    try {
      const res = await fetch('/api/users', { method:'POST', headers, body: JSON.stringify({ ...newUserForm, role:'purchaser' }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setShowNewUser(false); setNewUserForm({ name:'', username:'', password:'' }); load()
    } catch(e) { setUserError(e.message) }
    finally { setSavingUser(false) }
  }

  const filtered = parts.filter(p => {
    if (!search) return true
    const s = search.toLowerCase()
    return p.part_number?.toLowerCase().includes(s) || p.customer_name?.toLowerCase().includes(s) || p.ae_name?.toLowerCase().includes(s)
  })

  const ms = stats?.managerStats

  return (
    <div style={{ padding:32, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:26, color:'#0f172a', margin:0 }}>🔧 Purchasing Manager</h1>
          <p style={{ color:'#94a3b8', fontSize:14, marginTop:4 }}>Assign part numbers, track quotes</p>
        </div>
        <button onClick={() => setShowNewUser(true)}
          style={{ padding:'9px 18px', borderRadius:12, border:'none', background:BRAND, color:'#0d0d0d', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
          + Add Purchaser
        </button>
      </div>

      {/* Stats */}
      {ms && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
          <StatCard label="Total Part Numbers" value={ms.totalParts} color="#6366f1" icon="🔩" />
          <StatCard label="Unassigned" value={ms.totalUnassigned} color="#ef4444" icon="📋" />
          <StatCard label="Pending Quote" value={ms.totalPending} color="#f59e0b" icon="⏳" />
          <StatCard label="Quoted" value={ms.totalQuoted} color="#10b981" icon="✅" />
        </div>
      )}

      {/* Per-purchaser quick stats */}
      {ms?.byPurchaser?.length > 0 && (
        <div style={{ display:'flex', gap:12, marginBottom:24, flexWrap:'wrap' }}>
          {ms.byPurchaser.map(p => (
            <div key={p.name} style={{ background:'#fff', borderRadius:12, border:'1px solid #f1f5f9', padding:'12px 16px', display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:32, height:32, borderRadius:8, background:`${BRAND}20`, color:BRAND, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:13 }}>{p.name[0]}</div>
              <div>
                <div style={{ fontWeight:700, fontSize:13, color:'#0f172a' }}>{p.name}</div>
                <div style={{ fontSize:11, color:'#94a3b8' }}>{p.assigned} assigned · <span style={{ color:'#10b981', fontWeight:600 }}>{p.quoted_count} quoted</span></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, background:'#f1f5f9', borderRadius:12, padding:4, marginBottom:20, width:'fit-content' }}>
        {[['parts','🔩 Part Numbers'],['quotes','✅ Quotes Received']].map(([k,l]) => (
          <button key={k} onClick={() => setActiveTab(k)} style={{ padding:'8px 16px', borderRadius:8, border:'none', background:activeTab===k?'#fff':'transparent', color:activeTab===k?'#0f172a':'#64748b', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', boxShadow:activeTab===k?'0 1px 4px rgba(0,0,0,0.08)':'none', transition:'all 0.15s', whiteSpace:'nowrap' }}>{l}</button>
        ))}
      </div>

      {activeTab === 'parts' && (
        <>
          {/* Filters */}
          <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search part numbers..."
              style={{ ...inp, width:220, padding:'9px 12px 9px 12px' }} />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, width:'auto', cursor:'pointer' }}>
              <option value="">All Statuses</option>
              <option value="unassigned">Unassigned</option>
              <option value="assigned">Pending Quote</option>
              <option value="quoted">Quoted</option>
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ ...inp, width:'auto', cursor:'pointer' }}>
              <option value="">All Types</option>
              <option value="lead">Leads</option>
              <option value="repeat">Repeat</option>
              <option value="online_order">Online Orders</option>
            </select>
            <select value={filterPurchaser} onChange={e => setFilterPurchaser(e.target.value)} style={{ ...inp, width:'auto', cursor:'pointer' }}>
              <option value="">All Purchasers</option>
              {purchasers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {(filterStatus || filterType || filterPurchaser || search) && (
              <button onClick={() => { setFilterStatus(''); setFilterType(''); setFilterPurchaser(''); setSearch('') }}
                style={{ fontSize:12, color:'#ef4444', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', fontWeight:600 }}>✕ Clear</button>
            )}
          </div>

          {loading ? (
            <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', padding:60, textAlign:'center', color:'#94a3b8' }}>No parts found</div>
          ) : (
            <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', overflow:'hidden' }}>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ background:'#f8fafc', borderBottom:'2px solid #e2e8f0' }}>
                      {['Type','Part Number','Qty','Customer','AE','Selling Price','Status','Assigned To','Quote Summary',''].map(h => (
                        <th key={h} style={{ textAlign:'left', padding:'10px 14px', fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p, i) => (
                      <tr key={p.requirement_id} style={{ borderBottom:'1px solid #f1f5f9', background:i%2===0?'#fff':'#fafbfc' }}>
                        <td style={{ padding:'10px 14px' }}>
                          <span style={{ fontSize:12, fontWeight:600, color:TYPE_COLORS[p.inquiry_type], background:`${TYPE_COLORS[p.inquiry_type]}15`, padding:'3px 8px', borderRadius:6 }}>
                            {TYPE_ICONS[p.inquiry_type]} {p.inquiry_type === 'online_order' ? 'Order' : p.inquiry_type === 'lead' ? 'Lead' : 'Repeat'}
                          </span>
                        </td>
                        <td style={{ padding:'10px 14px', fontFamily:'monospace', fontWeight:700, color:'#0f172a', fontSize:13 }}>{p.part_number}</td>
                        <td style={{ padding:'10px 14px', color:'#475569' }}>{p.quantity||'—'}</td>
                        <td style={{ padding:'10px 14px', color:'#0f172a', fontWeight:500, whiteSpace:'nowrap' }}>
                          {p.customer_name}
                          {p.customer_company && <div style={{ fontSize:11, color:'#94a3b8' }}>{p.customer_company}</div>}
                        </td>
                        <td style={{ padding:'10px 14px', color:'#64748b', whiteSpace:'nowrap' }}>{p.ae_name||'—'}</td>
                        <td style={{ padding:'10px 14px' }}>
                          {p.inquiry_type === 'online_order' && p.selling_price
                            ? <span style={{ fontWeight:700, color:'#10b981' }}>${p.selling_price}</span>
                            : <span style={{ color:'#94a3b8' }}>—</span>}
                        </td>
                        <td style={{ padding:'10px 14px' }}><StatusBadge status={p.assignment_id ? p.assignment_status : 'unassigned'} /></td>
                        <td style={{ padding:'10px 14px' }}>
                          <AssignDropdown part={p} purchasers={purchasers} onAssign={handleAssign} onUnassign={handleUnassign} />
                        </td>
                        <td style={{ padding:'10px 14px', maxWidth:200 }}>
                          {p.quote_id ? (
                            <div>
                              <div style={{ fontWeight:700, color:'#10b981', fontSize:13 }}>${p.price}</div>
                              <div style={{ fontSize:11, color:'#64748b' }}>{p.condition} {p.lead_time ? `· ${p.lead_time}` : ''}</div>
                              <div style={{ fontSize:11, color:'#94a3b8' }}>{p.supplier_name}</div>
                              <div style={{ fontSize:10, color:'#94a3b8' }}>{timeAgo(p.quoted_at)}</div>
                            </div>
                          ) : <span style={{ color:'#94a3b8', fontSize:12 }}>No quote yet</span>}
                        </td>
                        <td style={{ padding:'10px 14px' }}>
                          {p.inquiry_notes && (
                            <div style={{ fontSize:11, color:'#94a3b8', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={p.inquiry_notes}>{p.inquiry_notes}</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'quotes' && (
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#f8fafc', borderBottom:'2px solid #e2e8f0' }}>
                  {['Date','Part Number','Qty','Customer','AE','Type','Purchaser','Price','Condition','Lead Time','Supplier','Notes'].map(h => (
                    <th key={h} style={{ textAlign:'left', padding:'10px 14px', fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quotes.length === 0 ? (
                  <tr><td colSpan={12} style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>No quotes submitted yet</td></tr>
                ) : quotes.map((q, i) => (
                  <tr key={q.id} style={{ borderBottom:'1px solid #f1f5f9', background:i%2===0?'#fff':'#fafbfc' }}>
                    <td style={{ padding:'10px 14px', fontFamily:'monospace', fontSize:12, color:'#64748b', whiteSpace:'nowrap' }}>{formatDateShort(q.updated_at)}</td>
                    <td style={{ padding:'10px 14px', fontFamily:'monospace', fontWeight:700, color:'#0f172a' }}>{q.part_number}</td>
                    <td style={{ padding:'10px 14px', color:'#475569' }}>{q.quantity||'—'}</td>
                    <td style={{ padding:'10px 14px', fontWeight:500, whiteSpace:'nowrap' }}>{q.customer_name}</td>
                    <td style={{ padding:'10px 14px', color:'#64748b' }}>{q.ae_name}</td>
                    <td style={{ padding:'10px 14px' }}><span style={{ fontSize:11, color:TYPE_COLORS[q.inquiry_type] }}>{TYPE_ICONS[q.inquiry_type]}</span></td>
                    <td style={{ padding:'10px 14px', fontWeight:600, color:BRAND }}>{q.purchaser_name}</td>
                    <td style={{ padding:'10px 14px', fontWeight:700, color:'#10b981' }}>${q.price}</td>
                    <td style={{ padding:'10px 14px' }}><span style={{ fontSize:11, background:'#f1f5f9', padding:'2px 8px', borderRadius:6 }}>{q.condition}</span></td>
                    <td style={{ padding:'10px 14px', color:'#64748b', fontSize:12 }}>{q.lead_time||'—'}</td>
                    <td style={{ padding:'10px 14px', color:'#64748b', fontSize:12 }}>{q.supplier_name||'—'}</td>
                    <td style={{ padding:'10px 14px', color:'#94a3b8', fontSize:12, maxWidth:150, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{q.notes||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Purchaser Modal */}
      {showNewUser && (
        <Modal title="Add New Purchaser" onClose={() => { setShowNewUser(false); setNewUserForm({ name:'', username:'', password:'' }); setUserError('') }}>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {[['Full Name','name','text','e.g. John Smith'],['Username','username','text','e.g. john'],['Password','password','password','Set initial password']].map(([label,key,type,ph]) => (
              <div key={key}>
                <div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>{label}</div>
                <input type={type} placeholder={ph} value={newUserForm[key]} onChange={e => setNewUserForm(f => ({...f,[key]:e.target.value}))} style={{ ...inp, padding:'10px 14px' }} />
              </div>
            ))}
            {userError && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#dc2626' }}>⚠ {userError}</div>}
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setShowNewUser(false)} style={{ flex:1, padding:11, borderRadius:12, border:'1px solid #e2e8f0', background:'#fff', color:'#475569', fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Cancel</button>
              <button onClick={handleCreatePurchaser} disabled={savingUser} style={{ flex:1, padding:11, borderRadius:12, border:'none', background:BRAND, color:'#0d0d0d', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>{savingUser ? 'Adding...' : 'Add Purchaser'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
