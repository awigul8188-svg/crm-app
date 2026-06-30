import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { purchasingApi } from '../api'
import { useAuth } from '../App'
import { formatDate, formatDateShort, timeAgo, OP_CONDITIONS } from '../components/Badges'
import SearchableSelect from '../components/SearchableSelect'
import { ColumnPicker, useColumnPrefs } from '../components/ColumnPicker'

const BRAND = '#00D4C8'
// Make a non-button clickable element keyboard-activatable (Enter/Space), paired with role="button" + tabIndex={0}.
const onActivate = (fn) => (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn() } }
const T = { lead:{ icon:'◎', label:'Lead', color:'#3b82f6' }, repeat:{ icon:'↻', label:'Repeat', color:'#6366f1' }, online_order:{ icon:'◈', label:'Order', color:'#f59e0b' } }
const URGENCY = { critical:{ label:'Critical', color:'#ef4444', bg:'#fef2f2', border:'#fecaca' }, high:{ label:'High', color:'#f97316', bg:'#fff7ed', border:'#fed7aa' }, normal:{ label:'Normal', color:'#64748b', bg:'#f8fafc', border:'#e2e8f0' }, low:{ label:'Low', color:'#10b981', bg:'#f0fdf4', border:'#bbf7d0' } }
const CONDITIONS = OP_CONDITIONS
const inp = { width:'100%', boxSizing:'border-box', background:'#fff', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'10px 14px', fontSize:'13px', color:'#0f172a', fontFamily:'"Plus Jakarta Sans",sans-serif', outline:'none', transition:'border 0.15s' }
const inpF = { border:`1px solid ${BRAND}`, boxShadow:`0 0 0 3px rgba(0,212,200,0.12)` }

// Render a price stored as a raw string ("250", "$250", "1,200") as a single clean "$250" — avoids "$$250".
const money = (v) => {
  if (v === null || v === undefined || v === '') return '—'
  const s = String(v).replace(/[$,]/g,'').trim()
  return /^\d/.test(s) ? `$${s}` : (s || '—')
}

const PRESETS = [{ label:'Today',v:'today' },{ label:'Week',v:'week' },{ label:'Month',v:'month' },{ label:'All',v:'all' },{ label:'Custom',v:'custom' }]
function getDateRange(preset, from, to) {
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; const now = new Date(); const today = fmt(now)
  if (preset==='today') return { from:today, to:today }
  if (preset==='week') { const d=new Date(now); d.setDate(d.getDate()-7); return { from:fmt(d), to:today } }
  if (preset==='month') { const d=new Date(now); d.setDate(1); return { from:fmt(d), to:today } }
  if (preset==='custom') return { from, to }
  return { from:'', to:'' }
}

function SInput({ value, onChange, placeholder, type='text', onKeyDown, ariaLabel }) {
  const [f,setF] = useState(false)
  return <input type={type} aria-label={ariaLabel} value={value} onChange={onChange} onKeyDown={onKeyDown} placeholder={placeholder} style={{ ...inp, ...(f?inpF:{}) }} onFocus={()=>setF(true)} onBlur={()=>setF(false)} />
}
function STextarea({ value, onChange, placeholder, ariaLabel }) {
  const [f,setF] = useState(false)
  return <textarea value={value} onChange={onChange} aria-label={ariaLabel} placeholder={placeholder} rows={2} style={{ ...inp, resize:'none', ...(f?inpF:{}) }} onFocus={()=>setF(true)} onBlur={()=>setF(false)} />
}

function Pagination({ page, pages, onChange }) {
  if (pages<=1) return null
  return (
    <div style={{ display:'flex', gap:8, justifyContent:'center', padding:'12px 0', alignItems:'center' }}>
      <button onClick={()=>onChange(page-1)} disabled={page===1} style={{ padding:'5px 12px', borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', color:page===1?'#cbd5e1':'#475569', cursor:page===1?'not-allowed':'pointer', fontSize:12, fontWeight:600, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>← Prev</button>
      <span style={{ fontSize:12, color:'#64748b' }}>Page {page} of {pages}</span>
      <button onClick={()=>onChange(page+1)} disabled={page===pages} style={{ padding:'5px 12px', borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', color:page===pages?'#cbd5e1':'#475569', cursor:page===pages?'not-allowed':'pointer', fontSize:12, fontWeight:600, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Next →</button>
    </div>
  )
}

// Full part detail modal. `fullPage` renders it as a standalone full-screen view (used by the
// popped-out browser tab) instead of a centered modal over a dimmed backdrop.
export function PartDetailModal({ assignmentId, onClose, onSaved, fullPage = false, page = false }) {
  const { user } = useAuth()
  const [part, setPart] = useState(null)
  const [loadErr, setLoadErr] = useState(null)  // set when /part fails (e.g. 403 after being reassigned away)
  const [tab, setTab] = useState('quote')
  // Multi-supplier sourcing: one or more entries, each supplier/qty/price/condition/lead time.
  const [entries, setEntries] = useState([])
  const [purchaserNotes, setPurchaserNotes] = useState(''); const [savingNotes, setSavingNotes] = useState(false)
  const [comment, setComment] = useState(''); const [sendingComment, setSendingComment] = useState(false)
  const [followupNote, setFollowupNote] = useState(''); const [followupDate, setFollowupDate] = useState(''); const [savingFollowup, setSavingFollowup] = useState(false)
  const [saving, setSaving] = useState(false); const [error, setError] = useState('')
  const [flash, setFlash] = useState(null); const [dirty, setDirty] = useState(false)
  const [suppliers, setSuppliers] = useState([])
  const [addingSupplier, setAddingSupplier] = useState(false); const [newSup, setNewSup] = useState({ company:'', rep_name:'', email:'' }); const [supSaving, setSupSaving] = useState(false)
  const showFlash = (type, msg) => { setFlash({ type, msg }); setTimeout(() => setFlash(null), 2500) }
  const authHeaders = { Authorization:`Bearer ${localStorage.getItem('crm_token')}`, 'Content-Type':'application/json' }

  const load = () => {
    setLoadErr(null)
    fetch(`/api/purchasing/part/${assignmentId}`, { headers:{ Authorization:`Bearer ${localStorage.getItem('crm_token')}` } })
      .then(async r => ({ ok: r.ok, status: r.status, d: await r.json().catch(() => ({})) }))
      .then(({ ok, status, d }) => {
        if (!ok || d.error) { setLoadErr(status === 403 ? 'This part is no longer assigned to you.' : (d.error || 'Could not load this part.')); return }
        setPart(d)
        const qs = (d.quotes || []).map(q => ({ supplier_name:q.supplier_name||'', quantity:q.quantity ?? '', price:q.price ?? '', condition:q.condition||'', lead_time:q.lead_time||'', offered_part:q.offered_part||'' }))
        setEntries(qs.length ? qs : [{ supplier_name:'', quantity:d.quantity ?? '', price:'', condition:'', lead_time:'', offered_part:'' }])
        setPurchaserNotes(d.purchaser_notes||''); setDirty(false)
      })
      .catch(() => setLoadErr('Could not load this part.'))
  }
  useEffect(() => { load() }, [assignmentId])
  useEffect(() => { purchasingApi.getSuppliers().then(setSuppliers).catch(() => {}) }, [])

  const handleAddSupplier = async () => {
    if (!newSup.company.trim()) return
    setSupSaving(true)
    try {
      const created = await purchasingApi.createSupplier(newSup)
      setSuppliers(prev => prev.some(s => s.id === created.id) ? prev : [...prev, created])
      setAddingSupplier(false); setNewSup({ company:'', rep_name:'', email:'' })
      showFlash('ok', `Supplier "${created.company}" added — pick it in any line`)
    } catch(e) { showFlash('err', e.message || 'Could not add supplier') }
    setSupSaving(false)
  }

  // Backdrop / × close — warn if there are unsaved quote or notes edits.
  const attemptClose = () => { if (dirty && !window.confirm('Discard unsaved changes?')) return; onClose() }

  const numV = (v) => { const n = parseFloat(String(v ?? '').replace(/[$,]/g, '')); return isNaN(n) ? 0 : n }
  const updateEntry = (i, k, v) => { setEntries(es => es.map((e, idx) => idx === i ? { ...e, [k]: v } : e)); setDirty(true) }
  const addEntry = () => { setEntries(es => [...es, { supplier_name:'', quantity:'', price:'', condition:'', lead_time:'', offered_part:'' }]); setDirty(true) }
  const removeEntry = (i) => { setEntries(es => es.filter((_, idx) => idx !== i)); setDirty(true) }

  const handleQuoteSubmit = async () => {
    // Keep only real lines: a supplier with a quantity > 0. Blank/partial/zero-qty lines are dropped, not errored.
    const clean = entries.filter(e => e.supplier_name && e.supplier_name.trim() && (Number(e.quantity) || 0) > 0)
    if (!clean.length) return setError('Add at least one supplier line with a quantity')
    for (const e of clean) {
      if (e.price === '' || e.price == null) return setError(`Enter a price for ${e.supplier_name.trim()}`)
    }
    setSaving(true); setError('')
    try {
      const res = await purchasingApi.submitQuote({ assignment_id: assignmentId, entries: clean })
      if (res.error) setError(res.error)
      else { showFlash('ok','Quote saved'); load(); onSaved() }
    } catch(e) { setError(e.message || 'Could not save quote') }
    setSaving(false)
  }

  const handleSaveNotes = async () => {
    setSavingNotes(true)
    try {
      const r = await fetch(`/api/purchasing/assignment/${assignmentId}`, { method:'PATCH', headers:authHeaders, body:JSON.stringify({ purchaser_notes: purchaserNotes }) })
      if (!r.ok) throw new Error('Save failed')
      setDirty(false); showFlash('ok','Notes saved')
    } catch(e) { showFlash('err', e.message || 'Could not save notes') }
    setSavingNotes(false)
  }

  const handleMarkNotInStock = async () => {
    try {
      const next = !part.not_in_stock
      const r = await fetch(`/api/purchasing/assignment/${assignmentId}`, { method:'PATCH', headers:authHeaders, body:JSON.stringify({ not_in_stock: next }) })
      if (!r.ok) throw new Error('Update failed')
      // Update locally — do NOT reload (a full load() would overwrite any unsaved quote lines being typed).
      setPart(p => ({ ...p, not_in_stock: next ? 1 : 0 })); onSaved()
    } catch(e) { showFlash('err', e.message || 'Could not update stock status') }
  }

  const handleComment = async () => {
    if (!comment.trim()) return
    setSendingComment(true)
    try {
      const r = await fetch(`/api/purchasing/comment/${assignmentId}`, { method:'POST', headers:authHeaders, body:JSON.stringify({ comment }) })
      if (!r.ok) throw new Error('Send failed')
      setComment(''); load(); showFlash('ok','Message sent')
    } catch(e) { showFlash('err', e.message || 'Could not send message') }
    setSendingComment(false)
  }

  const handleFollowup = async () => {
    if (!followupNote.trim()) return
    setSavingFollowup(true)
    try {
      const r = await fetch(`/api/purchasing/followup/${assignmentId}`, { method:'POST', headers:authHeaders, body:JSON.stringify({ note:followupNote, follow_up_date:followupDate }) })
      if (!r.ok) throw new Error('Save failed')
      setFollowupNote(''); setFollowupDate(''); load(); showFlash('ok','Follow-up added')
    } catch(e) { showFlash('err', e.message || 'Could not add follow-up') }
    setSavingFollowup(false)
  }

  const completeFollowup = async (id) => {
    try {
      const r = await fetch(`/api/purchasing/followup/${id}/complete`, { method:'PATCH', headers:{ Authorization:`Bearer ${localStorage.getItem('crm_token')}` } })
      if (!r.ok) throw new Error('Update failed')
      load(); onSaved()
    } catch(e) { showFlash('err', e.message || 'Could not complete follow-up') }
  }

  // Supplier options for the searchable picker. If the saved supplier isn't a known op_supplier
  // (legacy free-text quotes), surface it so the current value still shows selected.
  const supplierItemsFor = (val) => {
    const items = suppliers.map(s => ({ value: s.company, label: s.company, sub: s.rep_name || '' }))
    if (val && !items.some(i => String(i.value) === String(val))) items.unshift({ value: val, label: val, sub: '(current)' })
    return items
  }

  // Backdrop (dimmed overlay) vs full-page (plain white, fills the tab). Card adapts to match.
  const backdropStyle = fullPage
    ? { position:'fixed', inset:0, zIndex:99999, background:'#f8fafc', display:'flex', alignItems:'stretch', justifyContent:'center' }
    : { position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }
  const cardStyle = page
    ? { background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', width:'100%', display:'flex', flexDirection:'column', fontFamily:'"Plus Jakarta Sans",sans-serif' }
    : fullPage
    ? { background:'#fff', width:'100%', maxWidth:820, maxHeight:'100vh', display:'flex', flexDirection:'column', fontFamily:'"Plus Jakarta Sans",sans-serif' }
    : { background:'#fff', borderRadius:20, boxShadow:'0 24px 80px rgba(0,0,0,0.25)', width:'100%', maxWidth:640, maxHeight:'92vh', display:'flex', flexDirection:'column', fontFamily:'"Plus Jakarta Sans",sans-serif' }

  // Failed to load (e.g. 403 after being reassigned away) — show a clear message + a way out, not an endless spinner.
  const errBody = (
    <div style={{ textAlign:'center', padding:40, color:'#64748b' }}>
      <div style={{ fontSize:32, marginBottom:10 }}>🚫</div>
      <div style={{ fontWeight:700, color:'#0f172a', marginBottom:6 }}>{loadErr}</div>
      <div style={{ fontSize:13, marginBottom:18 }}>It may have been reassigned to another purchaser.</div>
      <button onClick={onClose} className="btn btn-secondary" style={{ padding:'8px 18px', borderRadius:10, border:'1px solid #e2e8f0', background:'#fff', cursor:'pointer', fontWeight:600 }}>← Back</button>
    </div>
  )
  // `page` mode renders in-flow inside the app Layout (sidebar visible) like the lead/order pages.
  if (page && !part) return <div className="page-wrap" style={{ maxWidth:900 }}>{loadErr ? errBody : <div style={{ padding:40, color:'#94a3b8' }}>Loading…</div>}</div>
  if (!part) return createPortal(
    <div onClick={loadErr ? onClose : undefined} style={fullPage ? backdropStyle : { position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:fullPage?0:20, padding:loadErr?0:40, color:'#94a3b8', margin:'auto', minWidth:300 }}>{loadErr ? errBody : 'Loading...'}</div>
    </div>, document.body
  )

  const tInfo = T[part.inquiry_type]
  const urgInfo = URGENCY[part.urgency||'normal']
  const isOver = part.is_over_selling
  // In full-page mode the whole surface is the card — backdrop clicks must NOT close it.
  const openFullPage = () => window.open(`${window.location.origin}/?part=${assignmentId}`, '_blank')

  // When there's room (full-page or popped-out tab) My Notes lives in a persistent side panel
  // instead of a tab, so the purchaser can jot research while quoting. Narrow modal keeps the tab.
  const wide = page || fullPage
  const notesEditor = (
    <>
      <STextarea value={purchaserNotes} onChange={e=>setPurchaserNotes(e.target.value)} ariaLabel="My notes" placeholder="Add your notes, updates, or research on this part…" />
      <button onClick={handleSaveNotes} disabled={savingNotes} style={{ marginTop:8, padding:'8px 18px', borderRadius:10, border:'none', background:BRAND, color:'#0d0d0d', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
        {savingNotes?'Saving…':'Save Notes'}
      </button>
    </>
  )
  const notesPanel = (
    <div style={{ width:340, flexShrink:0, alignSelf:'flex-start', position:'sticky', top:16, background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', boxShadow:'0 1px 3px rgba(0,0,0,0.04)', padding:'18px 20px', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
        <span aria-hidden="true" style={{ fontSize:14 }}>📝</span>
        <span style={{ fontWeight:800, fontSize:14, color:'#0f172a' }}>My Notes</span>
      </div>
      {notesEditor}
      <div style={{ fontSize:11, color:'#94a3b8', marginTop:10, lineHeight:1.5 }}>Private to you — your research and updates on this part.</div>
    </div>
  )

  const card = (
      <div onClick={e=>e.stopPropagation()} style={cardStyle}>
        <style>{`@keyframes modalIn{from{opacity:0;transform:scale(0.96) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>

        {/* Header */}
        <div style={{ padding:'16px 22px 12px', borderBottom:'1px solid #f1f5f9', flexShrink:0, background: part.is_delayed?'#fff5f5':part.not_in_stock?'#f8fafc':'#fff', borderRadius:fullPage?0:'20px 20px 0 0' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                <span style={{ fontFamily:'monospace', fontWeight:800, fontSize:16, color:'#0f172a' }}>{part.part_number}</span>
                <span style={{ fontSize:12, fontWeight:600, color:tInfo?.color, background:`${tInfo?.color}15`, padding:'2px 8px', borderRadius:6 }}>{tInfo?.icon} {tInfo?.label}</span>
                <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:12, background:urgInfo.bg, color:urgInfo.color, border:`1px solid ${urgInfo.border}` }}>{urgInfo.label}</span>
                {part.is_delayed && <span style={{ fontSize:11, fontWeight:700, color:'#dc2626', background:'#fef2f2', padding:'2px 8px', borderRadius:12 }}>⚠️ Delayed {part.working_days_pending}d</span>}
                {!!part.not_in_stock && <span style={{ fontSize:11, fontWeight:700, color:'#ef4444', background:'#fef2f2', padding:'2px 8px', borderRadius:12 }}>❌ Not In Stock</span>}
              </div>
              <div style={{ fontSize:12, color:'#64748b' }}>Qty: {part.quantity||'—'} · {part.customer_name}{part.customer_company?` · ${part.customer_company}`:''}</div>
              <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>AE: {part.ae_name||'—'} · Assigned {timeAgo(part.assigned_at)}</div>
              {part.inquiry_type==='online_order' && Number(part.selling_price) > 0 && (
                <div style={{ fontSize:12, fontWeight:700, color:isOver?'#dc2626':'#10b981', marginTop:3 }}>
                  {isOver
                    ? `⚠️ OVER — total buying ${money(part.quoted_total_cost)} exceeds selling ${money(part.selling_price)}`
                    : `Selling price: ${money(part.selling_price)}`}
                </div>
              )}
              {part.pm_notes && (
                <div style={{ marginTop:6, background:'#fef9c3', border:'1px solid #fde047', borderRadius:8, padding:'6px 10px', fontSize:12, color:'#713f12' }}>
                  <span style={{ fontWeight:700 }}>📌 PM Note: </span>{part.pm_notes}
                </div>
              )}
            </div>
            <div style={{ display:'flex', gap:6, flexShrink:0 }}>
              <button onClick={handleMarkNotInStock}
                style={{ padding:'6px 12px', borderRadius:10, border:`1px solid ${part.not_in_stock?'#10b981':'#ef4444'}`, background:part.not_in_stock?'#f0fdf4':'#fef2f2', color:part.not_in_stock?'#10b981':'#ef4444', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', whiteSpace:'nowrap' }}>
                {part.not_in_stock?'✓ Mark In Stock':'❌ Not In Stock'}
              </button>
              {!fullPage && !page && (
                <button onClick={openFullPage} title="Open in a new tab (full page)" aria-label="Open in a new tab"
                  style={{ width:32, height:32, borderRadius:10, border:'1px solid #e2e8f0', background:'#fff', cursor:'pointer', fontSize:14, color:'#64748b', display:'flex', alignItems:'center', justifyContent:'center' }}>⤢</button>
              )}
              <button onClick={attemptClose} aria-label="Close" style={{ width:32, height:32, borderRadius:10, border:'none', background:'#f1f5f9', cursor:'pointer', fontSize:18, color:'#64748b', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:1, borderBottom:'1px solid #f1f5f9', flexShrink:0 }}>
          {[['quote','💰 Quote'],...(wide?[]:[['notes','📝 My Notes']]),['comments',`💬 AE Chat (${part.comments?.length||0})`],['followups',`📅 Follow-ups (${part.followups?.filter(f=>!f.completed).length||0})`]].map(([k,l]) => (
            <button key={k} onClick={()=>setTab(k)} style={{ flex:1, padding:'10px 0', border:'none', background:'transparent', color:tab===k?'#0f172a':'#64748b', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', borderBottom:`2px solid ${tab===k?BRAND:'transparent'}`, transition:'all 0.15s' }}>{l}</button>
          ))}
        </div>

        <div onInput={()=>setDirty(true)} style={{ overflowY:'auto', flex:1, padding:'18px 22px' }}>
          {/* Quote tab — multi-supplier sourcing */}
          {tab==='quote' && (() => {
            const sourcedQty = entries.reduce((s,e)=> s + (Number(e.quantity)||0), 0)
            const totalCost = entries.reduce((s,e)=> s + numV(e.price)*(Number(e.quantity)||0), 0)
            const reqQty = Number(part.quantity)||0
            const shortQty = Math.max(0, reqQty - sourcedQty)
            const over = part.inquiry_type==='online_order' && Number(part.selling_price)>0 && totalCost > numV(part.selling_price)
            const ri = { boxSizing:'border-box', width:'100%', border:'1px solid #e2e8f0', borderRadius:8, padding:'7px 9px', fontSize:12, fontFamily:'"Plus Jakarta Sans",sans-serif' }
            const rl = { fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3 }
            return (
            <div>
              {/* Sourced summary */}
              <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap', marginBottom:14, background:'#f8fafc', border:'1px solid #f1f5f9', borderRadius:12, padding:'10px 14px', fontSize:13 }}>
                <span style={{ color:'#64748b' }}>Required <b style={{ color:'#0f172a' }}>{reqQty}</b></span>
                <span style={{ color:'#64748b' }}>Sourced <b style={{ color: sourcedQty>=reqQty&&reqQty>0?'#10b981':'#0f172a' }}>{sourcedQty}</b></span>
                {shortQty>0
                  ? <span style={{ color:'#dc2626', fontWeight:700 }}>⚠ {shortQty} short</span>
                  : reqQty>0 && <span style={{ color:'#10b981', fontWeight:700 }}>✓ fully sourced</span>}
                <span style={{ marginLeft:'auto', color:'#64748b' }}>Total cost <b style={{ color: over?'#dc2626':'#0f172a' }}>{money(totalCost)}{over?' ⚠️':''}</b></span>
              </div>
              {over && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'8px 12px', fontSize:12, color:'#dc2626', marginBottom:12 }}>⚠️ Total buying cost exceeds the selling price ({money(part.selling_price)}).</div>}

              {/* Add a supplier to the master list */}
              <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:8 }}>
                {!addingSupplier && <button type="button" onClick={()=>setAddingSupplier(true)} style={{ fontSize:11, fontWeight:700, color:BRAND, background:'none', border:'none', cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>+ New supplier</button>}
              </div>
              {addingSupplier && (
                <div style={{ border:`1px solid ${BRAND}`, borderRadius:12, padding:'10px 12px', background:'#f0fffe', display:'flex', flexDirection:'column', gap:8, marginBottom:12 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:BRAND, textTransform:'uppercase', letterSpacing:'0.08em' }}>New Supplier</div>
                  <input value={newSup.company} onChange={e=>setNewSup(p=>({...p, company:e.target.value}))} placeholder="Company *" aria-label="Supplier company" autoFocus style={{ ...inp, padding:'8px 12px' }} />
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    <input value={newSup.rep_name} onChange={e=>setNewSup(p=>({...p, rep_name:e.target.value}))} placeholder="Rep name" aria-label="Supplier rep name" style={{ ...inp, padding:'8px 12px' }} />
                    <input type="email" value={newSup.email} onChange={e=>setNewSup(p=>({...p, email:e.target.value}))} placeholder="Email" aria-label="Supplier email" autoComplete="off" spellCheck={false} style={{ ...inp, padding:'8px 12px' }} />
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button type="button" onClick={handleAddSupplier} disabled={supSaving||!newSup.company.trim()} style={{ padding:'7px 14px', borderRadius:10, border:'none', background:newSup.company.trim()?BRAND:'#cbd5e1', color:'#0d0d0d', fontWeight:700, fontSize:12, cursor:newSup.company.trim()?'pointer':'not-allowed', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>{supSaving?'Saving…':'Add supplier'}</button>
                    <button type="button" onClick={()=>{ setAddingSupplier(false); setNewSup({ company:'', rep_name:'', email:'' }) }} style={{ padding:'7px 14px', borderRadius:10, border:'1px solid #e2e8f0', background:'#fff', color:'#64748b', fontWeight:600, fontSize:12, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Supplier lines */}
              {entries.map((e,i) => (
                <div key={i} style={{ border:'1px solid #f1f5f9', borderRadius:12, padding:12, marginBottom:10, background:'#fafbfc' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8' }}>Supplier line {i+1}</div>
                    {entries.length>1 && <button type="button" onClick={()=>removeEntry(i)} style={{ fontSize:11, color:'#ef4444', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>✕ remove</button>}
                  </div>
                  <div style={{ marginBottom:8 }}>
                    <div style={rl}>Supplier</div>
                    <SearchableSelect items={supplierItemsFor(e.supplier_name)} value={e.supplier_name} onChange={(v)=>updateEntry(i,'supplier_name',v||'')} placeholder="Search suppliers…" emptyText="No suppliers — add one above" />
                  </div>
                  <div style={{ marginBottom:8 }}>
                    <div style={rl}>Offered part #  <span style={{ textTransform:'none', fontWeight:400, color:'#94a3b8', letterSpacing:0 }}>— only if sourcing a substitute</span></div>
                    <input style={ri} aria-label={`Supplier line ${i+1} offered / substitute part number`} value={e.offered_part||''} onChange={ev=>updateEntry(i,'offered_part',ev.target.value)} placeholder={part.part_number ? `Leave blank if it's ${part.part_number}` : 'Alternative part number'} />
                    {!!(e.offered_part && e.offered_part.trim() && e.offered_part.trim().toLowerCase() !== (part.part_number||'').trim().toLowerCase()) &&
                      <div style={{ fontSize:11, fontWeight:700, color:'#b45309', marginTop:4 }}>⇄ Substitute for {part.part_number} — the AE will be notified to confirm with the customer</div>}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                    <div><div style={rl}>Qty *</div><input style={ri} inputMode="decimal" aria-label={`Supplier line ${i+1} quantity`} value={e.quantity} onChange={ev=>updateEntry(i,'quantity',ev.target.value)} placeholder={reqQty?`of ${reqQty}`:'qty'} /></div>
                    <div><div style={rl}>Unit price *</div><input style={ri} inputMode="decimal" aria-label={`Supplier line ${i+1} unit price`} value={e.price} onChange={ev=>updateEntry(i,'price',ev.target.value)} placeholder="$" /></div>
                    <div><div style={rl}>Condition</div><select style={{ ...ri, cursor:'pointer' }} aria-label={`Supplier line ${i+1} condition`} value={e.condition} onChange={ev=>updateEntry(i,'condition',ev.target.value)}><option value="">—</option>{[...CONDITIONS, ...(e.condition && !CONDITIONS.includes(e.condition) ? [e.condition] : [])].map(c=><option key={c}>{c}</option>)}</select></div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8, alignItems:'end' }}>
                    <div><div style={rl}>Lead time</div><input style={ri} aria-label={`Supplier line ${i+1} lead time`} value={e.lead_time} onChange={ev=>updateEntry(i,'lead_time',ev.target.value)} placeholder="e.g. 3-5 days" /></div>
                    <div style={{ fontSize:11, color:'#64748b', textAlign:'right' }}>Line cost: <b style={{ color:'#0f172a' }}>{money(numV(e.price)*(Number(e.quantity)||0))}</b></div>
                  </div>
                </div>
              ))}
              <button type="button" onClick={addEntry} style={{ width:'100%', padding:'9px', borderRadius:10, border:`1.5px dashed ${BRAND}80`, background:`${BRAND}08`, color:'#0f766e', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', marginBottom:14 }}>+ Add another supplier line</button>

              {error && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#dc2626', marginBottom:12 }}>⚠ {error}</div>}
              <button onClick={handleQuoteSubmit} disabled={saving} style={{ width:'100%', padding:12, borderRadius:12, border:'none', background:saving?'#94a3b8':BRAND, color:'#0d0d0d', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                {saving?<><div style={{ width:14, height:14, borderRadius:'50%', border:'2px solid #0d0d0d', borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />Saving...</>:(part.quote_count?'↻ Update Sourcing':'✓ Submit Sourcing')}
              </button>
            </div>
            )
          })()}

          {/* My Notes tab (only in narrow modal — wide layouts show the persistent side panel) */}
          {tab==='notes' && !wide && (
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>My Notes / Update</div>
              {notesEditor}
            </div>
          )}

          {/* Comments tab (with AE) */}
          {tab==='comments' && (
            <div>
              <div style={{ display:'flex', gap:8, marginBottom:16 }}>
                <SInput value={comment} onChange={e=>setComment(e.target.value)} ariaLabel="Message to the AE" onKeyDown={e=>{ if(e.key==='Enter' && comment.trim()){ e.preventDefault(); handleComment() } }} placeholder="Write to the AE…" />
                <button onClick={handleComment} disabled={sendingComment||!comment.trim()} style={{ padding:'10px 16px', borderRadius:12, border:'none', background:BRAND, color:'#0d0d0d', fontWeight:700, fontSize:13, cursor:'pointer', flexShrink:0, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
                  {sendingComment?'...':'Send'}
                </button>
              </div>
              {!part.comments?.length ? <div style={{ textAlign:'center', color:'#94a3b8', padding:32, fontSize:13 }}>No messages yet. Start a conversation with the AE.</div> : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {part.comments.map(c => {
                    const isMe = c.user_id === user.id
                    return (
                      <div key={c.id} style={{ display:'flex', flexDirection:isMe?'row-reverse':'row', gap:8 }}>
                        <div style={{ width:28, height:28, borderRadius:8, background:isMe?`${BRAND}20`:'#f1f5f9', color:isMe?BRAND:'#64748b', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:11, flexShrink:0 }}>{c.user_name?.[0]?.toUpperCase()}</div>
                        <div style={{ maxWidth:'75%' }}>
                          <div style={{ fontSize:10, color:'#94a3b8', marginBottom:3, textAlign:isMe?'right':'left' }}>{c.user_name} ({c.user_role}) · {timeAgo(c.created_at)}</div>
                          <div style={{ background:isMe?`${BRAND}15`:'#f8fafc', borderRadius:isMe?'12px 12px 4px 12px':'12px 12px 12px 4px', padding:'8px 12px', fontSize:13, color:'#0f172a', border:`1px solid ${isMe?`${BRAND}30`:'#f1f5f9'}` }}>
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
              <div style={{ background:'#f8fafc', borderRadius:12, padding:14, border:'1px solid #e2e8f0', marginBottom:16 }}>
                <SInput value={followupNote} onChange={e=>setFollowupNote(e.target.value)} ariaLabel="Follow-up note" placeholder="Follow-up note (e.g. Call supplier ABC on Monday)…" />
                <div style={{ display:'flex', gap:8, marginTop:8 }}>
                  <input type="date" aria-label="Follow-up date" value={followupDate} onChange={e=>setFollowupDate(e.target.value)} style={{ ...inp, flex:1 }} />
                  <button onClick={handleFollowup} disabled={savingFollowup||!followupNote.trim()} style={{ padding:'10px 16px', borderRadius:12, border:'none', background:BRAND, color:'#0d0d0d', fontWeight:700, fontSize:13, cursor:'pointer', flexShrink:0, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Add</button>
                </div>
              </div>
              {!part.followups?.length ? <div style={{ textAlign:'center', color:'#94a3b8', padding:24, fontSize:13 }}>No follow-ups yet</div> : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {part.followups.map(fu => (
                    <div key={fu.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:fu.completed?'#f8fafc':'#fff', borderRadius:12, border:`1px solid ${fu.completed?'#f1f5f9':new Date(fu.follow_up_date)<new Date()?'#fecaca':'#f1f5f9'}`, opacity:fu.completed?0.6:1 }}>
                      <button onClick={() => completeFollowup(fu.id)} disabled={fu.completed}
                        aria-label={fu.completed ? 'Follow-up completed' : 'Mark follow-up complete'} aria-pressed={!!fu.completed}
                        style={{ width:22, height:22, borderRadius:6, border:`2px solid ${fu.completed?BRAND:'#cbd5e1'}`, background:fu.completed?BRAND:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {fu.completed && <span style={{ color:'white', fontSize:11 }} aria-hidden="true">✓</span>}
                      </button>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:500, color:'#0f172a', textDecoration:fu.completed?'line-through':'' }}>{fu.note}</div>
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
  )
  const flashEl = flash ? (
    <div role="status" aria-live="polite" style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', zIndex:100000, background:flash.type==='ok'?'#0f172a':'#dc2626', color:'#fff', padding:'10px 18px', borderRadius:10, fontSize:13, fontWeight:600, boxShadow:'0 8px 24px rgba(0,0,0,0.25)' }}>
      {flash.type==='ok'?'✓ ':'⚠ '}{flash.msg}
    </div>
  ) : null

  if (page) return (
    <div className="page-wrap" style={{ maxWidth:1240 }}>
      <button onClick={onClose} style={{ display:'flex', alignItems:'center', gap:4, fontSize:13, color:'#64748b', background:'none', border:'none', cursor:'pointer', fontWeight:600, marginBottom:14, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>← Back</button>
      <div style={{ display:'flex', gap:20, alignItems:'flex-start' }}>
        <div style={{ flex:1, minWidth:0 }}>{card}</div>
        {notesPanel}
      </div>
      {flashEl}
    </div>
  )
  return createPortal(
    <div onClick={fullPage ? undefined : attemptClose} style={backdropStyle}>
      {fullPage
        ? <div onClick={e=>e.stopPropagation()} style={{ display:'flex', gap:18, alignItems:'flex-start', width:'100%', maxWidth:1200, margin:'auto', padding:'24px 20px' }}><div style={{ flex:1, minWidth:0 }}>{card}</div>{notesPanel}</div>
        : card}
      {flashEl}
    </div>,
    document.body
  )
}

// Part card for the list
function PartCard({ part, onClick }) {
  const tInfo = T[part.inquiry_type]; const urgInfo = URGENCY[part.urgency||'normal']
  return (
    <div onClick={onClick} role="button" tabIndex={0} onKeyDown={onActivate(onClick)} aria-label={`Open part ${part.part_number}`} style={{ background:part.is_delayed?'#fff5f5':part.not_in_stock?'#fafafa':'#fff', borderRadius:14, border:`1px solid ${part.is_delayed?'#fecaca':part.not_in_stock?'#e2e8f0':part.urgency==='critical'?'#fecaca':part.urgency==='high'?'#fed7aa':'#f1f5f9'}`, padding:'14px 18px', cursor:'pointer', transition:'all 0.15s', display:'flex', alignItems:'flex-start', gap:14, flexWrap:'wrap' }}
      onMouseEnter={e=>{ e.currentTarget.style.borderColor=BRAND; e.currentTarget.style.boxShadow=`0 2px 12px rgba(0,212,200,0.1)` }}
      onMouseLeave={e=>{ e.currentTarget.style.borderColor=part.is_delayed?'#fecaca':part.not_in_stock?'#e2e8f0':part.urgency==='critical'?'#fecaca':part.urgency==='high'?'#fed7aa':'#f1f5f9'; e.currentTarget.style.boxShadow='none' }}>
      <div style={{ width:42, height:42, borderRadius:10, background:`${tInfo?.color}15`, color:tInfo?.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{tInfo?.icon}</div>
      <div style={{ flex:1, minWidth:180 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4 }}>
          <span style={{ fontFamily:'monospace', fontWeight:800, fontSize:15, color:'#0f172a' }}>{part.part_number}</span>
          <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:12, background:urgInfo.bg, color:urgInfo.color, border:`1px solid ${urgInfo.border}` }}>{urgInfo.label}</span>
          {part.is_delayed && <span style={{ fontSize:11, fontWeight:700, color:'#dc2626' }}>⚠️ {part.working_days_pending}d overdue</span>}
          {!!part.not_in_stock && <span style={{ fontSize:11, fontWeight:700, color:'#ef4444', background:'#fef2f2', padding:'2px 6px', borderRadius:6 }}>❌ Not In Stock</span>}
        </div>
        <div style={{ fontSize:12, color:'#64748b' }}>Qty: {part.quantity||'—'} · {part.customer_name}{part.customer_company?` · ${part.customer_company}`:''}</div>
        <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>AE: {part.ae_name||'—'} · Assigned {timeAgo(part.assigned_at)}</div>
        {part.pm_notes && <div style={{ fontSize:11, color:'#92400e', background:'#fef9c3', padding:'3px 8px', borderRadius:6, marginTop:4, display:'inline-block' }}>📌 {part.pm_notes}</div>}
      </div>
      {part.inquiry_type==='online_order' && Number(part.selling_price) > 0 && (
        <div style={{ textAlign:'center', flexShrink:0 }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase' }}>Selling</div>
          <div style={{ fontSize:16, fontWeight:800, color:'#10b981', fontFamily:'"Bricolage Grotesque",sans-serif' }}>{money(part.selling_price)}</div>
        </div>
      )}
      {part.quote_id ? (
        <div style={{ background:'#f0fdf4', borderRadius:10, padding:'8px 12px', border:'1px solid #bbf7d0', flexShrink:0, textAlign:'center' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#16a34a', textTransform:'uppercase', marginBottom:3 }}>Quoted</div>
          <div style={{ fontWeight:800, fontSize:15, color:'#16a34a', fontFamily:'"Bricolage Grotesque",sans-serif' }}>{money(part.price)}</div>
          <div style={{ fontSize:10, color:'#64748b' }}>{part.condition}</div>
        </div>
      ) : (
        <div style={{ padding:'8px 16px', borderRadius:10, background:`${BRAND}15`, color:'#00b8ad', fontWeight:700, fontSize:12, flexShrink:0, alignSelf:'center', cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
          Submit Quote →
        </div>
      )}
    </div>
  )
}

// ── Assigned Parts: full filterable/sortable table (sidebar destination) ──────
const STATUS_META = {
  pending:      { label:'Pending',      color:'#b45309', bg:'#fffbeb' },
  quoted:       { label:'Quoted',       color:'#16a34a', bg:'#f0fdf4' },
  not_in_stock: { label:'Not In Stock', color:'#dc2626', bg:'#fef2f2' },
}
const statusOf = (p) => p.not_in_stock ? 'not_in_stock' : (p.quote_id ? 'quoted' : 'pending')

const PP_COLS = [
  { key:'part_number', label:'Part #', locked:true }, { key:'customer_name', label:'Customer' }, { key:'inquiry_type', label:'Type' },
  { key:'quantity', label:'Qty' }, { key:'urgency', label:'Urgency' }, { key:'status', label:'Status' },
  { key:'price', label:'Quote' }, { key:'assigned_at', label:'Assigned' },
]

export function PurchaserParts() {
  const [parts, setParts] = useState([])
  const [loading, setLoading] = useState(true)
  const [openPartId, setOpenPartId] = useState(null)
  const [f, setF] = useState({ part:'', customer:'', type:'', urgency:'', status:'' })
  const [sort, setSort] = useState({ key:'', dir:1 })
  const { visibleColumns, hidden, toggle, reset } = useColumnPrefs('purchaser-parts', PP_COLS, [])
  const show = (k) => visibleColumns.some(c => c.key === k)

  const load = () => { setLoading(true); purchasingApi.getMyParts({ all:1 }).then(d => { setParts(d.parts||[]); setLoading(false) }).catch(()=>setLoading(false)) }
  useEffect(() => { load() }, [])

  const setFilter = (k,v) => setF(p => ({ ...p, [k]:v }))

  let rows = parts.filter(p =>
    (!f.part || (p.part_number||'').toLowerCase().includes(f.part.toLowerCase())) &&
    (!f.customer || (p.customer_name||'').toLowerCase().includes(f.customer.toLowerCase())) &&
    (!f.type || p.inquiry_type === f.type) &&
    (!f.urgency || (p.urgency||'normal') === f.urgency) &&
    (!f.status || statusOf(p) === f.status)
  )
  if (sort.key) {
    rows = [...rows].sort((a,b) => {
      let av=a[sort.key], bv=b[sort.key]
      if (sort.key==='price'||sort.key==='quantity') { av=Number(String(av).replace(/[$,]/g,''))||0; bv=Number(String(bv).replace(/[$,]/g,''))||0 }
      else { av=String(av||'').toLowerCase(); bv=String(bv||'').toLowerCase() }
      return av<bv ? -sort.dir : av>bv ? sort.dir : 0
    })
  }
  const toggleSort = (key) => setSort(s => s.key===key ? { key, dir:-s.dir } : { key, dir:1 })

  const th = (label, key, num) => (
    <th onClick={key?()=>toggleSort(key):undefined} style={{ textAlign:num?'right':'left', padding:'10px 12px', fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', cursor:key?'pointer':'default', whiteSpace:'nowrap', position:'sticky', top:0, background:'#f8fafc', borderBottom:'1px solid #e2e8f0', zIndex:1 }}>
      {label}{sort.key===key?(sort.dir>0?' ▲':' ▼'):''}
    </th>
  )
  const fStyle = { padding:'6px 8px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:12, width:'100%', boxSizing:'border-box', background:'#fff', fontFamily:'"Plus Jakarta Sans",sans-serif' }

  // Open a part as a full page (in-flow, sidebar stays) instead of a popup.
  if (openPartId) return <PartDetailModal page assignmentId={openPartId} onClose={()=>setOpenPartId(null)} onSaved={load} />

  return (
    <div style={{ padding:28, maxWidth:1200, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
        <div>
          <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:24, color:'#0f172a', margin:'0 0 4px' }}>📦 Assigned Parts</h1>
          <p style={{ color:'#94a3b8', fontSize:13, margin:'0 0 18px' }}>All parts assigned to you · showing {rows.length} of {parts.length}</p>
        </div>
        <ColumnPicker columns={PP_COLS} hidden={hidden} toggle={toggle} reset={reset} />
      </div>

      <div style={{ background:'#fff', border:'1px solid #f1f5f9', borderRadius:14, overflow:'hidden' }}>
        <div style={{ maxHeight:'calc(100vh - 230px)', overflow:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr>{show('part_number')&&th('Part #','part_number')}{show('customer_name')&&th('Customer','customer_name')}{show('inquiry_type')&&th('Type','inquiry_type')}{show('quantity')&&th('Qty','quantity',true)}{show('urgency')&&th('Urgency','urgency')}{show('status')&&th('Status')}{show('price')&&th('Quote','price',true)}{show('assigned_at')&&th('Assigned','assigned_at')}</tr>
              <tr style={{ background:'#fff', position:'sticky', top:39, zIndex:1 }}>
                {show('part_number') && <td style={{ padding:'6px 8px' }}><input value={f.part} onChange={e=>setFilter('part',e.target.value)} placeholder="Search…" aria-label="Filter by part number" style={fStyle} /></td>}
                {show('customer_name') && <td style={{ padding:'6px 8px' }}><input value={f.customer} onChange={e=>setFilter('customer',e.target.value)} placeholder="Search…" aria-label="Filter by customer" style={fStyle} /></td>}
                {show('inquiry_type') && <td style={{ padding:'6px 8px' }}><select value={f.type} onChange={e=>setFilter('type',e.target.value)} aria-label="Filter by type" style={fStyle}><option value="">All</option><option value="lead">Lead</option><option value="repeat">Repeat</option><option value="online_order">Order</option></select></td>}
                {show('quantity') && <td />}
                {show('urgency') && <td style={{ padding:'6px 8px' }}><select value={f.urgency} onChange={e=>setFilter('urgency',e.target.value)} aria-label="Filter by urgency" style={fStyle}><option value="">All</option><option value="critical">Critical</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select></td>}
                {show('status') && <td style={{ padding:'6px 8px' }}><select value={f.status} onChange={e=>setFilter('status',e.target.value)} aria-label="Filter by status" style={fStyle}><option value="">All</option><option value="pending">Pending</option><option value="quoted">Quoted</option><option value="not_in_stock">Not In Stock</option></select></td>}
                {show('price') && <td />}{show('assigned_at') && <td />}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={visibleColumns.length} style={{ padding:48, textAlign:'center', color:'#94a3b8' }}>Loading…</td></tr>
              ) : rows.length===0 ? (
                <tr><td colSpan={visibleColumns.length} style={{ padding:48, textAlign:'center', color:'#94a3b8' }}>No parts match your filters</td></tr>
              ) : rows.map(p => {
                const st = STATUS_META[statusOf(p)]; const urg = URGENCY[p.urgency||'normal']; const ti = T[p.inquiry_type]
                return (
                  <tr key={p.assignment_id} onClick={()=>setOpenPartId(p.assignment_id)} tabIndex={0} onKeyDown={onActivate(()=>setOpenPartId(p.assignment_id))} style={{ cursor:'pointer', borderBottom:'1px solid #f1f5f9', background:p.is_delayed?'#fff8f8':'#fff' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'} onMouseLeave={e=>e.currentTarget.style.background=p.is_delayed?'#fff8f8':'#fff'}>
                    {show('part_number') && <td style={{ padding:'10px 12px', fontFamily:'monospace', fontWeight:700, color:'#0f172a' }}>{p.part_number}{p.is_delayed && <span style={{ color:'#dc2626', fontSize:11, marginLeft:6 }}>⚠️{p.working_days_pending}d</span>}</td>}
                    {show('customer_name') && <td style={{ padding:'10px 12px', color:'#0f172a' }}>{p.customer_name}{p.customer_company?<span style={{ color:'#94a3b8' }}> · {p.customer_company}</span>:''}</td>}
                    {show('inquiry_type') && <td style={{ padding:'10px 12px' }}><span style={{ fontSize:12, color:ti?.color }}>{ti?.icon} {ti?.label}</span></td>}
                    {show('quantity') && <td style={{ padding:'10px 12px', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{p.quantity||'—'}</td>}
                    {show('urgency') && <td style={{ padding:'10px 12px' }}><span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:12, background:urg.bg, color:urg.color, border:`1px solid ${urg.border}` }}>{urg.label}</span></td>}
                    {show('status') && <td style={{ padding:'10px 12px' }}><span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:12, background:st.bg, color:st.color }}>{st.label}</span></td>}
                    {show('price') && <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:700, color:p.quote_id?'#16a34a':'#cbd5e1', fontVariantNumeric:'tabular-nums' }}>{p.quote_id?money(p.price):'—'}</td>}
                    {show('assigned_at') && <td style={{ padding:'10px 12px', color:'#64748b', whiteSpace:'nowrap' }}>{timeAgo(p.assigned_at)}</td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function PurchaserDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null); const [activeTab, setActiveTab] = useState('dashboard')
  const [preset, setPreset] = useState('all'); const [customFrom, setCustomFrom] = useState(''); const [customTo, setCustomTo] = useState('')
  const [openPartId, setOpenPartId] = useState(null)
  const [partsResult, setPartsResult] = useState(null); const [partsLoading, setPartsLoading] = useState(false)
  const [page, setPage] = useState(1); const [statusFilter, setStatusFilter] = useState('')

  const dateRange = getDateRange(preset, customFrom, customTo)
  const loadStats = () => purchasingApi.getStats().then(setStats).catch(() => {})

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
  ]

  // Open a part as a full page (in-flow, sidebar stays) instead of a popup.
  if (openPartId) return <PartDetailModal page assignmentId={openPartId} onClose={()=>setOpenPartId(null)} onSaved={()=>{ loadStats(); loadParts() }} />

  return (
    <div style={{ padding:28, maxWidth:1200, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:24, color:'#0f172a', margin:0 }}>{greeting()}, {user.name} 👋</h1>
          <p style={{ color:'#94a3b8', fontSize:13, marginTop:3 }}>Your assigned parts and quoting dashboard</p>
        </div>
      </div>

      {/* Date filter — only on the parts-list tabs, where it actually filters the list (it does not affect dashboard stats) */}
      {['lead','repeat','online_order'].includes(activeTab) && (
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ display:'flex', background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, padding:3, gap:2 }}>
          {PRESETS.map(r => <button key={r.v} onClick={()=>setPreset(r.v)} style={{ padding:'5px 12px', borderRadius:7, border:'none', background:preset===r.v?BRAND:'transparent', color:preset===r.v?'#0d0d0d':'#64748b', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', transition:'all 0.15s' }}>{r.label}</button>)}
        </div>
        {preset==='custom' && <>
          <input type="date" aria-label="From date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)} style={{ padding:'7px 10px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:12 }} />
          <span style={{ color:'#94a3b8' }} aria-hidden="true">→</span>
          <input type="date" aria-label="To date" value={customTo} onChange={e=>setCustomTo(e.target.value)} style={{ padding:'7px 10px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:12 }} />
        </>}
        {['lead','repeat','online_order'].includes(activeTab) && (
          <div style={{ display:'flex', gap:6, marginLeft:'auto' }}>
            {[['','All'],['pending','Pending'],['quoted','Quoted'],['not_in_stock','Not In Stock']].map(([v,l]) => (
              <button key={v} onClick={()=>setStatusFilter(v)} style={{ padding:'6px 12px', borderRadius:8, border:`1px solid ${statusFilter===v?BRAND:'#e2e8f0'}`, background:statusFilter===v?`${BRAND}12`:'#fff', color:statusFilter===v?'#00b8ad':'#64748b', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>{l}</button>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, background:'#f1f5f9', borderRadius:12, padding:3, marginBottom:20, flexWrap:'wrap' }}>
        {tabs.map(t => <button key={t.key} onClick={()=>setActiveTab(t.key)} style={{ padding:'8px 14px', borderRadius:9, border:'none', background:activeTab===t.key?'#fff':'transparent', color:activeTab===t.key?'#0f172a':'#64748b', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', boxShadow:activeTab===t.key?'0 1px 4px rgba(0,0,0,0.08)':'none', transition:'all 0.15s', whiteSpace:'nowrap' }}>{t.label}</button>)}
      </div>

      {/* Dashboard */}
      {activeTab==='dashboard' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px, 1fr))', gap:12, marginBottom:20 }}>
            {[['Assigned',stats?.myAssigned,'#6366f1'],['Pending',stats?.myPending,'#f59e0b'],['Quoted',stats?.myQuoted,'#10b981'],['Today',stats?.myToday,BRAND],['This Week',stats?.myWeek,'#3b82f6'],['Delayed',stats?.myDelayed,'#dc2626'],['Not In Stock',stats?.myNotInStock,'#94a3b8']].map(([l,v,c]) => (
              <div key={l} style={{ background:l==='Delayed'&&v>0?'#fff5f5':'#fff', borderRadius:12, border:`1px solid ${l==='Delayed'&&v>0?'#fecaca':'#f1f5f9'}`, padding:'12px 14px', position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:0, left:0, width:3, height:'100%', background:c, borderRadius:'12px 0 0 12px' }} />
                <div style={{ fontSize:9, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>{l}</div>
                <div style={{ fontSize:20, fontWeight:800, color:l==='Delayed'&&v>0?'#dc2626':'#0f172a', fontFamily:'"Bricolage Grotesque",sans-serif' }}>{v??'—'}</div>
              </div>
            ))}
          </div>

          {/* Performance */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
            <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', padding:20 }}>
              <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:14, color:'#0f172a', marginBottom:14 }}>Performance Metrics</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {[
                  ['Avg Quote Time', stats?.avgHours ? `${stats.avgHours}h` : '—', BRAND],
                  ['On-Time Rate', stats?.onTimeRate!=null ? `${stats.onTimeRate}%` : '—', (stats?.onTimeRate!=null && stats.onTimeRate<70) ? '#f59e0b' : '#10b981'],
                  ['Completion Rate', stats?.myAssigned>0 ? `${Math.round(stats.myQuoted/stats.myAssigned*100)}%` : '—', '#10b981'],
                  ['Quotes This Month', stats?.myMonth ?? '—', '#6366f1'],
                ].map(([l,v,c]) => (
                  <div key={l} style={{ background:'#f8fafc', borderRadius:10, padding:'12px 14px', textAlign:'center' }}>
                    <div style={{ fontSize:9, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', marginBottom:4 }}>{l}</div>
                    <div style={{ fontSize:20, fontWeight:800, color:c, fontFamily:'"Bricolage Grotesque",sans-serif' }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:10, color:'#94a3b8', marginTop:8 }}>On-time = quoted within 4 working days of assignment.</div>
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
                      <div style={{ height:5, background:'#f1f5f9', borderRadius:4 }}>
                        <div style={{ height:'100%', borderRadius:4, background:tInfo.color, width:`${d.total>0?Math.round(d.quoted_count/d.total*100):0}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Follow-ups */}
            <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', padding:20 }}>
              <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:14, color:'#0f172a', marginBottom:14 }}>📅 My Follow-ups</div>
              {stats?.followups?.overdue?.length===0 && stats?.followups?.today?.length===0 && stats?.followups?.upcoming?.length===0
                ? <div style={{ textAlign:'center', color:'#94a3b8', padding:24, fontSize:13 }}>✅ All caught up!</div>
                : (
                  <div>
                    {[...( stats?.followups?.overdue||[]).map(f=>({...f,urgency:'overdue'})), ...(stats?.followups?.today||[]).map(f=>({...f,urgency:'today'})), ...(stats?.followups?.upcoming||[]).map(f=>({...f,urgency:'upcoming'}))].slice(0,6).map(fu => (
                      <div key={fu.id} onClick={() => fu.assignment_id && setOpenPartId(fu.assignment_id)} role={fu.assignment_id ? 'button' : undefined} tabIndex={fu.assignment_id ? 0 : undefined} onKeyDown={fu.assignment_id ? onActivate(() => setOpenPartId(fu.assignment_id)) : undefined} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0', borderBottom:'1px solid #f8fafc', cursor: fu.assignment_id ? 'pointer' : 'default' }}>
                        <div style={{ width:6, height:6, borderRadius:'50%', flexShrink:0, background:fu.urgency==='overdue'?'#ef4444':fu.urgency==='today'?'#f59e0b':BRAND }} />
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:12, fontWeight:600, color:'#0f172a' }}>{fu.part_number}</div>
                          <div style={{ fontSize:11, color:'#64748b' }}>{fu.note}</div>
                        </div>
                        <div style={{ fontSize:11, fontWeight:700, color:fu.urgency==='overdue'?'#ef4444':fu.urgency==='today'?'#f59e0b':BRAND, flexShrink:0 }}>{formatDate(fu.follow_up_date)}</div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>

          {/* Needs Attention — actionable areas to improve */}
          <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', padding:20, marginBottom:20 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, flexWrap:'wrap', gap:8 }}>
              <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:14, color:'#0f172a' }}>🎯 Needs Attention</div>
              {stats?.oldestPendingDays>0 && <span style={{ fontSize:11, color:'#94a3b8' }}>Oldest pending: <b style={{ color:stats.oldestPendingDays>=4?'#dc2626':'#64748b' }}>{stats.oldestPendingDays} working day{stats.oldestPendingDays===1?'':'s'}</b></span>}
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
              {[
                ['Delayed', stats?.myDelayed||0, '#dc2626'],
                ['Overdue follow-ups', stats?.followups?.overdue?.length||0, '#ef4444'],
                ['Not in stock', stats?.myNotInStock||0, '#94a3b8'],
                ['Quotes over selling', stats?.myOverSelling||0, '#f97316'],
              ].map(([l,v,c]) => (
                <div key={l} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', borderRadius:10, background:v>0?`${c}10`:'#f8fafc', border:`1px solid ${v>0?`${c}33`:'#f1f5f9'}` }}>
                  <span style={{ fontSize:18, fontWeight:800, color:v>0?c:'#cbd5e1', fontFamily:'"Bricolage Grotesque",sans-serif' }}>{v}</span>
                  <span style={{ fontSize:11, color:'#64748b', fontWeight:600 }}>{l}</span>
                </div>
              ))}
            </div>
            {stats?.needsAttention?.length>0 ? (
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Delayed — quote these first</div>
                {stats.needsAttention.map(p => (
                  <div key={p.assignment_id} onClick={()=>setOpenPartId(p.assignment_id)} role="button" tabIndex={0} onKeyDown={onActivate(()=>setOpenPartId(p.assignment_id))} aria-label={`Quote ${p.part_number}`} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:10, cursor:'pointer', border:'1px solid #fee2e2', background:'#fff8f8', marginBottom:6 }}
                    onMouseEnter={e=>e.currentTarget.style.background='#fef2f2'} onMouseLeave={e=>e.currentTarget.style.background='#fff8f8'}>
                    <span style={{ fontSize:11, fontWeight:700, color:'#dc2626', background:'#fef2f2', borderRadius:8, padding:'3px 8px', flexShrink:0 }}>⚠️ {p.days}d</span>
                    <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:13, color:'#0f172a' }}>{p.part_number}</span>
                    <span style={{ fontSize:12, color:'#64748b', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.customer_name}</span>
                    <span style={{ fontSize:11, color:BRAND, fontWeight:700, flexShrink:0 }}>Quote →</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign:'center', color:'#94a3b8', padding:'12px 0', fontSize:13 }}>✅ Nothing overdue — you're on top of it!</div>
            )}
          </div>
        </div>
      )}

      {/* Parts tabs */}
      {['lead','repeat','online_order'].includes(activeTab) && (
        <div>
          {partsLoading ? <div style={{ textAlign:'center', padding:48, color:'#94a3b8' }}>Loading...</div>
            : !partsResult?.parts?.length ? <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', padding:48, textAlign:'center', color:'#94a3b8' }}><div style={{ fontSize:32, marginBottom:8 }}>{T[activeTab]?.icon}</div>No parts assigned</div>
            : (
              <div>
                <div style={{ fontSize:12, color:'#94a3b8', marginBottom:12 }}>{partsResult.total} parts · 30 per page · sorted by urgency</div>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {partsResult.parts.map(p => <PartCard key={p.requirement_id} part={p} onClick={() => setOpenPartId(p.assignment_id)} />)}
                </div>
                <Pagination page={page} pages={partsResult.pages||1} onChange={setPage} />
              </div>
            )
          }
        </div>
      )}

    </div>
  )
}
