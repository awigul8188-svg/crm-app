import { createPortal } from 'react-dom'
import { useState, useEffect, useRef } from 'react'
import { api } from '../api'
import { useAuth } from '../App'
import { useNav } from '../App'
import { DispositionBadge, DISPOSITIONS, LEAD_SOURCES, ORDER_SOURCES, formatDateShort } from '../components/Badges'
import NewInquiryModal from '../components/NewInquiryModal'
import MultiSelect from '../components/MultiSelect'

// ── Selling Price Modal (shown when AE marks Closed Won) ─────
function SellingPriceModal({ inquiry, onClose, onConfirm }) {
  const [prices, setPrices] = useState(
    (inquiry.requirements||[]).map(r => ({ requirement_id:r.id, part_number:r.part_number, quantity:r.quantity, purchase_price:null, selling_price:'' }))
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const token = () => localStorage.getItem('crm_token')

  useEffect(() => {
    fetch('/api/inquiries/'+inquiry.id+'/selling-prices', { headers:{ Authorization:'Bearer '+token() } })
      .then(r=>r.json()).then(data => {
        if (Array.isArray(data)) {
          setPrices(prev => prev.map(p => {
            const d = data.find(x=>x.requirement_id===p.requirement_id)
            return d ? { ...p, purchase_price: d.purchase_quote_price, selling_price: d.selling_price||'' } : p
          }))
        }
        setLoading(false)
      }).catch(()=>setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    await fetch('/api/inquiries/'+inquiry.id+'/selling-prices', { method:'POST', headers:{ Authorization:'Bearer '+token(), 'Content-Type':'application/json' }, body: JSON.stringify({ prices: prices.map(p=>({ requirement_id:p.requirement_id, selling_price:parseFloat(p.selling_price)||0 })) }) })
    setSaving(false); onConfirm()
  }

  const BRAND = '#00D4C8'
  const inp = { width:'100%', boxSizing:'border-box', background:'var(--input-bg)', border:'1px solid var(--input-border)', borderRadius:8, padding:'7px 10px', fontSize:12, color:'var(--text)', fontFamily:'"Plus Jakarta Sans",sans-serif', outline:'none' }

  return createPortal(
    <div onClick={onClose} style={{ position:'fixed',inset:0,zIndex:99999,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'var(--card)',borderRadius:20,boxShadow:'0 24px 80px rgba(0,0,0,0.3)',width:'100%',maxWidth:600,maxHeight:'88vh',display:'flex',flexDirection:'column',fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
        <div style={{ padding:'18px 24px',borderBottom:'1px solid var(--border)',flexShrink:0 }}>
          <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:16,color:'var(--text)' }}>Enter Selling Prices — Closed Won</div>
          <div style={{ fontSize:12,color:'var(--text-3)',marginTop:3 }}>GP = (Selling Price − Cost) × Qty per part</div>
        </div>
        <div style={{ overflowY:'auto',flex:1,padding:'16px 24px' }}>
          {loading?<div style={{ textAlign:'center',padding:40,color:'var(--text-3)' }}>Loading...</div>:(
            <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
              {prices.map((p,i)=>{
                const cost = parseFloat(p.purchase_price)||0
                const sell = parseFloat(p.selling_price)||0
                const gp = sell>0&&cost>0 ? (sell-cost)*(p.quantity||1) : null
                return (
                  <div key={p.requirement_id} style={{ background:'var(--card-2)',borderRadius:12,padding:'14px 16px' }}>
                    <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:10 }}>
                      <div style={{ fontFamily:'monospace',fontWeight:700,fontSize:14,color:'var(--text)',flex:1 }}>{p.part_number}</div>
                      <span style={{ fontSize:12,color:'var(--text-3)' }}>Qty: {p.quantity||1}</span>
                      {p.purchase_price&&<span style={{ fontSize:12,color:'var(--text-3)' }}>Cost: <b style={{ color:'var(--text)' }}>${p.purchase_price}</b></span>}
                    </div>
                    <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:5 }}>Selling Price / Unit ($)</div>
                        <input value={p.selling_price} onChange={e=>setPrices(prev=>prev.map((x,j)=>j===i?{...x,selling_price:e.target.value}:x))} placeholder="Enter selling price" style={inp} type="number" />
                      </div>
                      {gp!==null&&<div style={{ flexShrink:0,textAlign:'right' }}>
                        <div style={{ fontSize:10,fontWeight:700,color:'var(--text-4)',textTransform:'uppercase',marginBottom:3 }}>GP</div>
                        <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif',fontWeight:700,fontSize:16,color:gp>=0?'#10b981':'#ef4444' }}>{gp>=0?'+':''}{gp.toFixed(0)}</div>
                      </div>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div style={{ padding:'16px 24px',borderTop:'1px solid var(--border)',display:'flex',gap:10,flexShrink:0 }}>
          <button onClick={save} disabled={saving} style={{ flex:1,padding:'11px',borderRadius:12,border:'none',background:saving?'var(--card-2)':BRAND,color:saving?'var(--text-3)':'#060610',fontWeight:700,fontSize:13,cursor:saving?'not-allowed':'pointer',fontFamily:'inherit' }}>{saving?'Saving…':'Save & Mark Closed Won'}</button>
          <button onClick={onClose} style={{ padding:'11px 18px',borderRadius:12,border:'1px solid var(--border)',background:'var(--card)',color:'var(--text-2)',cursor:'pointer',fontFamily:'inherit' }}>Cancel</button>
        </div>
      </div>
    </div>, document.body
  )
}



const PAGE_SIZE = 50
const TYPE_ICONS  = { lead:'◎', repeat:'↻', online_order:'◈' }
const BRAND = '#00D4C8'

// Column definitions per type
const COL_DEFS = {
  lead: [
    { key:'date',        label:'Date',         always: true },
    { key:'assigned',    label:'Assigned To',  always: false },
    { key:'disposition', label:'Disposition',  always: true  },
    { key:'source',      label:'Lead Source',  always: false },
    { key:'name',        label:'Name',         always: true  },
    { key:'email',       label:'Email',        always: false },
    { key:'company',     label:'Company',      always: false },
    { key:'phone',       label:'Phone',        always: false },
    { key:'parts',       label:'Part Number',  always: false },
    { key:'qty',         label:'Qty',          always: false },
    { key:'notes',       label:'Comments',     always: false },
  ],
  repeat: [
    { key:'date',        label:'Date',         always: true  },
    { key:'disposition', label:'Disposition',  always: true  },
    { key:'assigned',    label:'Assigned To',  always: false },
    { key:'name',        label:'Name',         always: true  },
    { key:'email',       label:'Email',        always: false },
    { key:'phone',       label:'Phone',        always: false },
    { key:'company',     label:'Company',      always: false },
    { key:'parts',       label:'Part #',       always: false },
    { key:'qty',         label:'Qty',          always: false },
    { key:'notes',       label:'Comments',     always: false },
    { key:'ppc',         label:'PPC/Outbound', always: false },
  ],
  online_order: [
    { key:'date',         label:'Date',         always: true  },
    { key:'name',         label:'Name',         always: true  },
    { key:'email',        label:'Email',        always: false },
    { key:'parts',        label:'Part Number',  always: false },
    { key:'totalQty',     label:'Total Qty',    always: false },
    { key:'amount',       label:'Order Amount', always: true  },
    { key:'source',       label:'Source',       always: false },
    { key:'assigned',     label:'Assigned To',  always: false },
    { key:'notes',        label:'Comments',     always: false },
    { key:'verification', label:'Verification', always: false },
    { key:'status',       label:'Status',       always: true  },
  ],
}
const DEFAULT_VISIBLE = {
  lead:         ['date','assigned','disposition','source','name','company','parts','notes'],
  repeat:       ['date','disposition','assigned','name','company','parts','notes','ppc'],
  online_order: ['date','name','parts','totalQty','amount','assigned','verification','status'],
}

// Inline disposition edit
function InlineDispositionEdit({ inquiry, dispositions, onSave, onCancel }) {
  const ref = useRef(); const [value, setValue] = useState(inquiry.disposition||''); const [saving, setSaving] = useState(false)
  useEffect(() => {
    ref.current?.focus()
    const h = e => { if (ref.current && !ref.current.contains(e.target)) onCancel() }
    setTimeout(() => document.addEventListener('mousedown', h), 0)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const handleChange = async e => {
    const v = e.target.value; setValue(v); setSaving(true)
    // For Closed Won, trigger selling price popup via custom event
    if (v === 'Closed Won') { onSave(inquiry.id, v, true); return }
    try { await api.updateInquiry(inquiry.id, { disposition:v, assigned_to:inquiry.assigned_to, notes:inquiry.notes, requirements:inquiry.requirements, ppc_or_outbound:inquiry.ppc_or_outbound, order_amount:inquiry.order_amount, order_ref:inquiry.order_ref }); onSave(inquiry.id, v) }
    catch { onCancel() } finally { setSaving(false) }
  }
  return (
    <div ref={ref} style={{ position:'relative' }} onClick={e => e.stopPropagation()}>
      <select value={value} onChange={handleChange} disabled={saving} autoFocus
        style={{ fontSize:12, fontWeight:600, padding:'4px 8px', borderRadius:8, border:`2px solid ${BRAND}`, background:'var(--card)', cursor:'pointer', outline:'none', boxShadow:`0 0 0 3px rgba(0,212,200,0.15)`, minWidth:160, color:'var(--text)', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
        {dispositions.map(d => <option key={d}>{d}</option>)}
      </select>
      {saving && <div style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', width:10, height:10, borderRadius:'50%', border:`2px solid ${BRAND}`, borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />}
    </div>
  )
}

// Column picker dropdown
function ColumnPicker({ type, visible, onChange, onClose }) {
  const ref = useRef()
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    setTimeout(() => document.addEventListener('mousedown', h), 0)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div ref={ref} style={{ position:'absolute', top:'calc(100% + 6px)', right:0, zIndex:9999, background:'var(--card-2)', border:'1px solid var(--border-2)', borderRadius:14, boxShadow:'0 8px 32px rgba(0,0,0,0.2)', padding:'12px 4px', minWidth:200 }}>
      <div style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.1em', padding:'0 12px 8px' }}>Show / Hide Columns</div>
      {COL_DEFS[type].map(col => (
        <div key={col.key} onClick={() => { if (col.always) return; onChange(col.key) }}
          style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 12px', cursor:col.always?'default':'pointer', borderRadius:8, transition:'background 0.1s' }}
          onMouseEnter={e => { if (!col.always) e.currentTarget.style.background='var(--card-3)' }}
          onMouseLeave={e => e.currentTarget.style.background='transparent'}>
          <div style={{ width:16, height:16, borderRadius:5, border:`2px solid ${visible.includes(col.key)?BRAND:'var(--border-2)'}`, background:visible.includes(col.key)?BRAND:'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.15s' }}>
            {visible.includes(col.key) && <span style={{ color:'#060610', fontSize:9, fontWeight:800 }}>✓</span>}
          </div>
          <span style={{ fontSize:13, color:col.always?'var(--text-3)':'var(--text)', fontWeight:500 }}>{col.label}</span>
          {col.always && <span style={{ fontSize:10, color:'var(--text-4)', marginLeft:'auto' }}>always</span>}
        </div>
      ))}
      <div style={{ height:1, background:'var(--border)', margin:'8px 12px' }} />
      <div onClick={() => onChange('__all__')} style={{ padding:'7px 12px', fontSize:12, fontWeight:600, color:BRAND, cursor:'pointer', borderRadius:8 }}
        onMouseEnter={e=>e.currentTarget.style.background='var(--card-3)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
        Show all columns
      </div>
    </div>
  )
}

export default function InquiryList({ type, title }) {
  const { user } = useAuth(); const { navigate } = useNav()
  const [inquiries, setInquiries] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterDispositions, setFilterDispositions] = useState([])
  const [filterSources, setFilterSources] = useState([])
  const [filterUsers, setFilterUsers] = useState([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState(null)
  const [editingDisp, setEditingDisp] = useState(null)
  const [sellingPriceModal, setSellingPriceModal] = useState(null) // inquiry waiting for selling prices
  const [page, setPage] = useState(1)
  const [showColPicker, setShowColPicker] = useState(false)
  const [visibleCols, setVisibleCols] = useState(() => {
    try { const s = localStorage.getItem(`crm_cols_${type}`); return s ? JSON.parse(s) : DEFAULT_VISIBLE[type] }
    catch { return DEFAULT_VISIBLE[type] }
  })

  const load = () => {
    setLoading(true); setPage(1)
    api.getInquiries(type, { disposition: filterDispositions, lead_source: filterSources, assigned_to: filterUsers, from: dateFrom, to: dateTo })
      .then(d => { setInquiries(d); setLoading(false) }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [type, filterDispositions, filterSources, filterUsers, dateFrom, dateTo])
  useEffect(() => { api.getUsers().then(setUsers) }, [])
  useEffect(() => { setPage(1) }, [search])

  const filtered = inquiries.filter(i => {
    if (filterUsers.length && !filterUsers.includes(String(i.assigned_to))) return false
    if (!search) return true
    const s = search.toLowerCase()
    return i.customer_name?.toLowerCase().includes(s) || i.customer_company?.toLowerCase().includes(s) ||
      i.customer_email?.toLowerCase().includes(s) || i.requirements?.some(r => r.part_number.toLowerCase().includes(s))
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)

  const toggleCol = (key) => {
    let next
    if (key === '__all__') {
      next = COL_DEFS[type].map(c => c.key)
    } else {
      const col = COL_DEFS[type].find(c => c.key === key)
      if (col?.always) return
      next = visibleCols.includes(key) ? visibleCols.filter(k => k !== key) : [...visibleCols, key]
    }
    setVisibleCols(next)
    localStorage.setItem(`crm_cols_${type}`, JSON.stringify(next))
  }

  const isVisible = k => visibleCols.includes(k)
  const handleDispSave = (id, v, needsSP=false) => {
    setInquiries(prev => prev.map(i => i.id===id?{...i,disposition:v}:i)); setEditingDisp(null)
    if (needsSP) {
      const inq = inquiries.find(i=>i.id===id)
      if (inq?.requirements?.length>0) setSellingPriceModal(inq)
      else api.updateInquiry(id, { disposition:'Closed Won', assigned_to:inq?.assigned_to, notes:inq?.notes, requirements:inq?.requirements })
    }
  }
  const handleDelete = async (e, id) => { e.stopPropagation(); if (!confirm('Delete this inquiry?')) return; setDeleting(id); try { await api.deleteInquiry(id); load() } catch(e) { alert(e.message) } finally { setDeleting(null) } }

  const dispositionOptions = type==='online_order' ? ['Processed','Cancelled'] : DISPOSITIONS.filter(d => d!=='Processed'&&d!=='Cancelled')
  const sourceOptions = type==='online_order' ? ORDER_SOURCES : LEAD_SOURCES
  const hasFilters = filterDispositions.length || filterSources.length || filterUsers.length || search || dateFrom || dateTo
  const clearAll = () => { setFilterDispositions([]); setFilterSources([]); setFilterUsers([]); setSearch(''); setDateFrom(''); setDateTo('') }

  // Cell renderer
  const cell = (col, inq) => {
    const partNums = inq.requirements?.map(r=>`${r.part_number}${r.quantity?' ×'+r.quantity:''}`).join(' · ') || '—'
    const totalQty = inq.requirements?.reduce((s,r)=>{const n=parseInt(r.quantity);return s+(isNaN(n)?0:n)},0)
    switch(col.key) {
      case 'date':         return <td key="date"  style={{ padding:'10px 14px', color:'var(--text-3)', fontFamily:'monospace', fontSize:11, whiteSpace:'nowrap' }}>{formatDateShort(inq.created_at)}</td>
      case 'assigned':     return <td key="asgn"  style={{ padding:'10px 14px', fontWeight:600, color:'var(--text-2)', whiteSpace:'nowrap', fontSize:13 }}>{inq.assigned_name||'—'}</td>
      case 'disposition':  return (
        <td key="disp" style={{ padding:'10px 14px' }} onClick={e=>{e.stopPropagation();setEditingDisp(inq.id)}}>
          {editingDisp===inq.id ? <InlineDispositionEdit inquiry={inq} dispositions={dispositionOptions} onSave={handleDispSave} onCancel={()=>setEditingDisp(null)} /> :
            <div title="Click to change" style={{ cursor:'pointer', display:'inline-flex', alignItems:'center', gap:4 }}>
              <DispositionBadge disposition={inq.disposition} />
              <span style={{ color:'var(--text-4)', fontSize:10 }}>✎</span>
            </div>}
        </td>
      )
      case 'source':       return <td key="src"   style={{ padding:'10px 14px', color:'var(--text-3)', fontSize:12, whiteSpace:'nowrap' }}>{inq.lead_source||'—'}</td>
      case 'name':         return <td key="name"  style={{ padding:'10px 14px', fontWeight:700, color:'var(--text)', whiteSpace:'nowrap', fontSize:13 }}>{inq.customer_name}</td>
      case 'email':        return <td key="email" style={{ padding:'10px 14px', color:'var(--text-3)', fontSize:12 }}>{inq.customer_email||'—'}</td>
      case 'company':      return <td key="co"    style={{ padding:'10px 14px', color:'var(--text-2)', fontSize:12, whiteSpace:'nowrap' }}>{inq.customer_company||'—'}</td>
      case 'phone':        return <td key="ph"    style={{ padding:'10px 14px', color:'var(--text-3)', fontSize:12 }}>{inq.customer_phone||'—'}</td>
      case 'parts':        return <td key="prt"   style={{ padding:'10px 14px', fontFamily:'monospace', fontSize:12, color:'var(--text-2)', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{partNums}</td>
      case 'qty':          return <td key="qty"   style={{ padding:'10px 14px', color:'var(--text-2)', fontSize:12 }}>{inq.requirements?.map(r=>r.quantity).join(', ')||'—'}</td>
      case 'totalQty':     return <td key="tqty"  style={{ padding:'10px 14px', fontWeight:600, color:'var(--text)', fontSize:13 }}>{totalQty||'—'}</td>
      case 'amount':       return <td key="amt"   style={{ padding:'10px 14px', fontWeight:700, color:'var(--success-text)', fontSize:13 }}>{inq.order_amount?`$${inq.order_amount}`:'—'}</td>
      case 'notes':        return <td key="notes" style={{ padding:'10px 14px', color:'var(--text-3)', fontSize:12, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{inq.notes||'—'}</td>
      case 'ppc':          return (
        <td key="ppc" style={{ padding:'10px 14px' }}>
          {inq.ppc_or_outbound ? <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:20, background:'rgba(139,92,246,0.15)', color:'#a78bfa', border:'1px solid rgba(139,92,246,0.25)' }}>{inq.ppc_or_outbound}</span> : <span style={{ color:'var(--text-4)' }}>—</span>}
        </td>
      )
      case 'verification': return (
        <td key="verf" style={{ padding:'10px 14px' }}>
          {inq.order_ref ? <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:20, background:inq.order_ref==='Verified'?'var(--success)':'var(--danger)', color:inq.order_ref==='Verified'?'var(--success-text)':'var(--danger-text)', border:`1px solid ${inq.order_ref==='Verified'?'rgba(16,185,129,0.25)':'var(--danger-border)'}` }}>{inq.order_ref}</span> : <span style={{ color:'var(--text-4)' }}>—</span>}
        </td>
      )
      case 'status':       return (
        <td key="stat" style={{ padding:'10px 14px' }} onClick={e=>{e.stopPropagation();setEditingDisp(inq.id)}}>
          {editingDisp===inq.id ? <InlineDispositionEdit inquiry={inq} dispositions={dispositionOptions} onSave={handleDispSave} onCancel={()=>setEditingDisp(null)} /> :
            <div title="Click to change" style={{ cursor:'pointer', display:'inline-flex', alignItems:'center', gap:4 }}>
              <DispositionBadge disposition={inq.disposition} />
              <span style={{ color:'var(--text-4)', fontSize:10 }}>✎</span>
            </div>}
        </td>
      )
      default: return <td key={col.key} style={{ padding:'10px 14px' }}>—</td>
    }
  }

  const shownCols = COL_DEFS[type].filter(c => isVisible(c.key))

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--bg)' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── Fixed Header ─────────────────────────────────── */}
      <div style={{ flexShrink:0, padding:'20px 28px 0', background:'var(--bg)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div>
            <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:22, color:'var(--text)', margin:0, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ color:'var(--text-4)', fontSize:18 }}>{TYPE_ICONS[type]}</span> {title}
            </h1>
            <p style={{ color:'var(--text-3)', fontSize:12, marginTop:3 }}>
              {loading ? 'Loading...' : `${filtered.length} records${page>1?` · Page ${page} of ${totalPages}`:''}`}
            </p>
          </div>
          <button onClick={() => setShowNew(true)} className="btn-primary">
            + New {title}
          </button>
        </div>

        {/* Filters row */}
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:8 }}>
          {/* Date range */}
          <div style={{ display:'flex', alignItems:'center', gap:6, background:'var(--card)', border:'1px solid var(--border)', borderRadius:10, padding:'4px 10px' }}>
            <span style={{ fontSize:11, color:'var(--text-3)', fontWeight:600 }}>From</span>
            <input type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setPage(1)}}
              style={{ border:'none', outline:'none', background:'transparent', fontSize:12, color:'var(--text)', fontFamily:'"Plus Jakarta Sans",sans-serif' }} />
            <span style={{ color:'var(--text-4)' }}>→</span>
            <input type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value);setPage(1)}}
              style={{ border:'none', outline:'none', background:'transparent', fontSize:12, color:'var(--text)', fontFamily:'"Plus Jakarta Sans",sans-serif' }} />
          </div>

          {/* Search */}
          <div style={{ position:'relative' }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, part, email..."
              style={{ padding:'8px 12px 8px 32px', borderRadius:10, border:'1px solid var(--border)', fontSize:12, background:'var(--card)', outline:'none', width:220, fontFamily:'"Plus Jakarta Sans",sans-serif', color:'var(--text)' }} />
            <span style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'var(--text-4)', fontSize:13, pointerEvents:'none' }}>⌕</span>
          </div>

          <MultiSelect placeholder={type==='online_order'?'All Statuses':'All Dispositions'} options={dispositionOptions} selected={filterDispositions} onChange={v=>{setFilterDispositions(v);setPage(1)}} />
          <MultiSelect placeholder="All Sources" options={sourceOptions} selected={filterSources} onChange={v=>{setFilterSources(v);setPage(1)}} />
          {user.role==='manager' && <MultiSelect placeholder="All Team Members" options={users.map(u=>({value:String(u.id),label:u.name}))} selected={filterUsers} onChange={v=>{setFilterUsers(v);setPage(1)}} />}

          {hasFilters && (
            <button onClick={clearAll} style={{ fontSize:12, fontWeight:600, color:'var(--danger-text)', background:'var(--danger)', border:'1px solid var(--danger-border)', borderRadius:10, padding:'6px 12px', cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
              ✕ Clear
            </button>
          )}

          {/* Column picker */}
          <div style={{ position:'relative', marginLeft:'auto' }}>
            <button onClick={() => setShowColPicker(p=>!p)}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 12px', borderRadius:10, border:`1px solid ${showColPicker?BRAND:'var(--border)'}`, background:showColPicker?'var(--brand-dim)':'var(--card)', color:showColPicker?BRAND:'var(--text-2)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', transition:'all 0.15s' }}>
              <span>⊞</span> Columns ({visibleCols.length})
            </button>
            {showColPicker && <ColumnPicker type={type} visible={visibleCols} onChange={toggleCol} onClose={()=>setShowColPicker(false)} />}
          </div>
        </div>

        {/* Active filter tags */}
        {(filterDispositions.length>0||filterSources.length>0||filterUsers.length>0) && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
            {[...filterDispositions.map(d=>({k:d,l:d,t:'d'})),...filterSources.map(s=>({k:s,l:s,t:'s'})),...filterUsers.map(id=>({k:id,l:users.find(u=>String(u.id)===id)?.name||id,t:'u'}))].map(tag => (
              <span key={tag.k+tag.t} className="tag">
                {tag.l}
                <button onClick={() => { if(tag.t==='d')setFilterDispositions(f=>f.filter(v=>v!==tag.k)); else if(tag.t==='s')setFilterSources(f=>f.filter(v=>v!==tag.k)); else setFilterUsers(f=>f.filter(v=>v!==tag.k)) }}
                  style={{ marginLeft:2, color:BRAND, background:'none', border:'none', cursor:'pointer', fontSize:13 }}>×</button>
              </span>
            ))}
          </div>
        )}

        {/* Tip */}
        <div style={{ fontSize:11, color:'var(--text-4)', paddingBottom:10, display:'flex', alignItems:'center', gap:4 }}>
          💡 Click any disposition badge to edit inline
        </div>
      </div>

      {/* ── Scrollable Table ──────────────────────────────── */}
      <div style={{ flex:1, overflowY:'auto', overflowX:'auto', padding:'0 28px' }}>
        {loading ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
            <div style={{ width:28, height:28, borderRadius:'50%', border:`2px solid ${BRAND}`, borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />
          </div>
        ) : paged.length===0 ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'60%', color:'var(--text-3)' }}>
            <div style={{ fontSize:48, opacity:0.2, marginBottom:12 }}>{TYPE_ICONS[type]}</div>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:18 }}>{search||hasFilters?'No results found':'No records yet'}</div>
            <div style={{ fontSize:13, marginTop:6 }}>{search||hasFilters?'Try clearing filters':'Create your first record'}</div>
          </div>
        ) : (
          <div style={{ background:'var(--card)', borderRadius:16, border:'1px solid var(--border)', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'var(--card-2)', borderBottom:'2px solid var(--border-2)', position:'sticky', top:0, zIndex:2 }}>
                  {shownCols.map(col => (
                    <th key={col.key} style={{ textAlign:'left', padding:'10px 14px', fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', whiteSpace:'nowrap' }}>{col.label}</th>
                  ))}
                  <th style={{ textAlign:'left', padding:'10px 14px', fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', width:40 }}></th>
                </tr>
              </thead>
              <tbody>
                {paged.map((inq, i) => (
                  <tr key={inq.id}
                    onClick={() => { if(editingDisp!==inq.id) navigate('inquiry-detail',{id:inq.id}) }}
                    style={{ borderBottom:'1px solid var(--border)', background:i%2===0?'var(--card)':'var(--row-alt)', cursor:editingDisp===inq.id?'default':'pointer', transition:'background 0.1s' }}
                    onMouseEnter={e => { if(editingDisp!==inq.id) e.currentTarget.style.background=`rgba(0,212,200,0.04)` }}
                    onMouseLeave={e => e.currentTarget.style.background=i%2===0?'var(--card)':'var(--row-alt)'}>
                    {shownCols.map(col => cell(col, inq))}
                    <td style={{ padding:'10px 14px' }} onClick={e=>e.stopPropagation()}>
                      {user.role==='manager' && (
                        <button onClick={e=>handleDelete(e,inq.id)} disabled={deleting===inq.id}
                          style={{ width:28, height:28, borderRadius:8, border:'none', background:'transparent', cursor:'pointer', color:'var(--danger-text)', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', opacity:0.4, transition:'all 0.15s' }}
                          onMouseEnter={e=>{e.currentTarget.style.opacity='1';e.currentTarget.style.background='var(--danger)'}}
                          onMouseLeave={e=>{e.currentTarget.style.opacity='0.4';e.currentTarget.style.background='transparent'}}>
                          {deleting===inq.id?'…':'🗑'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Fixed Pagination ──────────────────────────────── */}
      {!loading && totalPages > 1 && (
        <div style={{ flexShrink:0, padding:'12px 28px', borderTop:'1px solid var(--border)', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontSize:12, color:'var(--text-3)' }}>
            Showing {((page-1)*PAGE_SIZE)+1}–{Math.min(page*PAGE_SIZE,filtered.length)} of <b style={{ color:'var(--text)' }}>{filtered.length}</b> records
          </div>
          <div style={{ display:'flex', gap:4, alignItems:'center' }}>
            <button onClick={()=>setPage(1)} disabled={page===1}
              style={{ padding:'5px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--card)', color:page===1?'var(--text-4)':'var(--text-2)', cursor:page===1?'not-allowed':'pointer', fontSize:12, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>«</button>
            <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}
              style={{ padding:'5px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--card)', color:page===1?'var(--text-4)':'var(--text-2)', cursor:page===1?'not-allowed':'pointer', fontSize:12, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>← Prev</button>
            {/* Page number pills */}
            {Array.from({length:Math.min(7,totalPages)},(_,i)=>{
              let p; const half=3
              if (totalPages<=7) p=i+1
              else if (page<=half+1) p=i+1
              else if (page>=totalPages-half) p=totalPages-6+i
              else p=page-half+i
              return (
                <button key={p} onClick={()=>setPage(p)}
                  style={{ width:32, height:32, borderRadius:8, border:`1px solid ${page===p?BRAND:'var(--border)'}`, background:page===p?BRAND:'var(--card)', color:page===p?'#060610':'var(--text-2)', cursor:'pointer', fontSize:12, fontWeight:page===p?700:400, fontFamily:'"Plus Jakarta Sans",sans-serif', transition:'all 0.15s' }}>
                  {p}
                </button>
              )
            })}
            <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}
              style={{ padding:'5px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--card)', color:page===totalPages?'var(--text-4)':'var(--text-2)', cursor:page===totalPages?'not-allowed':'pointer', fontSize:12, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Next →</button>
            <button onClick={()=>setPage(totalPages)} disabled={page===totalPages}
              style={{ padding:'5px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--card)', color:page===totalPages?'var(--text-4)':'var(--text-2)', cursor:page===totalPages?'not-allowed':'pointer', fontSize:12, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>»</button>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text-3)' }}>
            <span>Go to</span>
            <input type="number" min={1} max={totalPages} defaultValue={page} onKeyDown={e=>{ if(e.key==='Enter'){const v=parseInt(e.target.value);if(v>=1&&v<=totalPages)setPage(v)}}}
              style={{ width:50, padding:'4px 8px', borderRadius:8, border:'1px solid var(--border)', background:'var(--card)', color:'var(--text)', fontSize:12, textAlign:'center', outline:'none', fontFamily:'"Plus Jakarta Sans",sans-serif' }} />
          </div>
        </div>
      )}
      {!loading && totalPages <= 1 && filtered.length > 0 && (
        <div style={{ flexShrink:0, padding:'10px 28px', borderTop:'1px solid var(--border)', background:'var(--bg)', fontSize:12, color:'var(--text-4)', textAlign:'right' }}>
          {filtered.length} records · {PAGE_SIZE}/page
        </div>
      )}

      {showNew && <NewInquiryModal defaultType={type} onClose={()=>setShowNew(false)} onCreated={()=>{setShowNew(false);load()}} />}
    </div>
      {sellingPriceModal && (
        <SellingPriceModal
          inquiry={sellingPriceModal}
          onClose={()=>setSellingPriceModal(null)}
          onConfirm={async ()=>{
            await api.updateInquiry(sellingPriceModal.id, { disposition:'Closed Won', assigned_to:sellingPriceModal.assigned_to, notes:sellingPriceModal.notes, requirements:sellingPriceModal.requirements })
            setSellingPriceModal(null)
          }}
        />
      )}
    </div>
  )
}