import { useState, useEffect, useCallback } from 'react'
import { useNav } from '../App'

const BRAND = '#00D4C8'
const token = () => localStorage.getItem('crm_token')
const URGENCY_COLOR = { critical:'#ef4444', high:'#f97316', normal:BRAND, low:'#94a3b8' }
const STATUS_COLOR  = { pending:'#f59e0b', quoted:'#10b981', not_in_stock:'#94a3b8' }
const PAGE_SIZE = 30

export default function PurchaserPartsView() {
  const { navigate } = useNav()
  const [parts, setParts]   = useState([])
  const [total, setTotal]   = useState(0)
  const [pages, setPages]   = useState(1)
  const [page, setPage]     = useState(1)
  const [loading, setLoading] = useState(true)

  // Filters
  const [status,   setStatus]   = useState('')
  const [urgency,  setUrgency]  = useState('')
  const [type,     setType]     = useState('')
  const [from,     setFrom]     = useState('')
  const [to,       setTo]       = useState('')

  const load = useCallback(() => {
    setLoading(true)
    const p = new URLSearchParams({ page })
    if (status)  p.set('status',  status)
    if (urgency) p.set('urgency', urgency)
    if (type)    p.set('type',    type)
    if (from)    p.set('from',    from)
    if (to)      p.set('to',      to)
    fetch(`/api/purchasing/my-parts?${p}`, { headers:{ Authorization:`Bearer ${token()}` } })
      .then(r => r.json())
      .then(d => { setParts(d.parts||[]); setTotal(d.total||0); setPages(d.pages||1); setLoading(false) })
      .catch(() => setLoading(false))
  }, [page, status, urgency, type, from, to])

  useEffect(() => { setPage(1) }, [status, urgency, type, from, to])
  useEffect(() => { load() }, [load])

  const clearFilters = () => { setStatus(''); setUrgency(''); setType(''); setFrom(''); setTo('') }
  const hasFilters = status || urgency || type || from || to

  const sel = { background:'var(--input-bg)', border:'1px solid var(--input-border)', borderRadius:10, padding:'8px 12px', fontSize:12, color:'var(--text)', fontFamily:'"Plus Jakarta Sans",sans-serif', outline:'none', cursor:'pointer' }
  const inp = { ...sel, cursor:'text' }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>

      {/* Header */}
      <div style={{ padding:'20px 28px 0', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div>
            <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:20, color:'var(--text)', margin:0 }}>My Parts</h1>
            <div style={{ fontSize:13, color:'var(--text-3)', marginTop:2 }}>{loading ? 'Loading…' : `${total} total`}</div>
          </div>
          <button onClick={() => navigate('dashboard')} style={{ padding:'8px 16px', borderRadius:10, border:'1px solid var(--border)', background:'var(--card)', color:'var(--text-2)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
            ← Dashboard
          </button>
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', padding:'14px 16px', background:'var(--card)', borderRadius:14, border:'1px solid var(--border)', marginBottom:16 }}>
          <select value={status} onChange={e=>setStatus(e.target.value)} style={sel}>
            <option value="">All Statuses</option>
            <option value="pending">Pending Quote</option>
            <option value="quoted">Quoted</option>
            <option value="not_in_stock">Not In Stock</option>
          </select>
          <select value={urgency} onChange={e=>setUrgency(e.target.value)} style={sel}>
            <option value="">All Urgency</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
          <select value={type} onChange={e=>setType(e.target.value)} style={sel}>
            <option value="">All Types</option>
            <option value="lead">Lead</option>
            <option value="repeat">Repeat</option>
            <option value="online_order">Online Order</option>
          </select>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:12, color:'var(--text-3)' }}>From</span>
            <input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={inp} />
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:12, color:'var(--text-3)' }}>To</span>
            <input type="date" value={to} onChange={e=>setTo(e.target.value)} style={inp} />
          </div>
          {hasFilters && (
            <button onClick={clearFilters} style={{ padding:'8px 14px', borderRadius:10, border:'1px solid var(--border)', background:'var(--card)', color:'var(--text-3)', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ flex:1, overflowY:'auto', padding:'0 28px' }}>
        {loading ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'40%' }}>
            <div style={{ width:24, height:24, borderRadius:'50%', border:`2px solid ${BRAND}`, borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : !parts.length ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'40%', color:'var(--text-3)' }}>
            <div style={{ fontSize:40, marginBottom:12, opacity:0.3 }}>🔩</div>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:18 }}>{hasFilters ? 'No results' : 'No parts assigned yet'}</div>
            {hasFilters && <button onClick={clearFilters} style={{ marginTop:12, padding:'8px 18px', borderRadius:10, border:'none', background:BRAND, color:'#060610', fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>Clear filters</button>}
          </div>
        ) : (
          <div style={{ background:'var(--card)', borderRadius:16, border:'1px solid var(--border)', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'var(--card-2)', borderBottom:'2px solid var(--border)' }}>
                  {['Part #','Qty','AE','Type','Date','Urgency','Status','Quote'].map(h => (
                    <th key={h} style={{ textAlign:'left', padding:'10px 14px', fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parts.map((p, i) => {
                  const status = p.not_in_stock ? 'not_in_stock' : (p.assignment_status || 'pending')
                  const isDelayed = p.is_delayed
                  return (
                    <tr key={p.requirement_id || i}
                      onClick={() => navigate('purchaser-part-detail', { assignmentId: p.assignment_id })}
                      style={{ borderBottom:'1px solid var(--border)', background:i%2===0?'var(--card)':'var(--row-alt)', cursor:'pointer', transition:'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background=`${BRAND}08`}
                      onMouseLeave={e => e.currentTarget.style.background=i%2===0?'var(--card)':'var(--row-alt)'}>
                      <td style={{ padding:'10px 14px', fontFamily:'monospace', fontWeight:700, color:'var(--text)' }}>
                        {p.part_number}
                        {isDelayed && <span style={{ marginLeft:6, fontSize:10, color:'#ef4444', fontWeight:700, background:'#fef2f2', padding:'1px 6px', borderRadius:8 }}>⚠ Delayed</span>}
                      </td>
                      <td style={{ padding:'10px 14px', color:'var(--text-2)' }}>{p.quantity||'—'}</td>
                      <td style={{ padding:'10px 14px', color:'var(--text-2)', whiteSpace:'nowrap' }}>{p.ae_name||'—'}</td>
                      <td style={{ padding:'10px 14px', color:'var(--text-3)', fontSize:12 }}>{p.inquiry_type==='online_order'?'Order':p.inquiry_type==='lead'?'Lead':'Repeat'}</td>
                      <td style={{ padding:'10px 14px', color:'var(--text-3)', fontSize:12, whiteSpace:'nowrap' }}>{p.inquiry_date ? new Date(p.inquiry_date).toLocaleDateString() : '—'}</td>
                      <td style={{ padding:'10px 14px' }}>
                        <span style={{ fontSize:11, fontWeight:700, padding:'2px 9px', borderRadius:20, background:`${URGENCY_COLOR[p.urgency||'normal']}18`, color:URGENCY_COLOR[p.urgency||'normal'], border:`1px solid ${URGENCY_COLOR[p.urgency||'normal']}30`, textTransform:'capitalize' }}>
                          {p.urgency||'normal'}
                        </span>
                      </td>
                      <td style={{ padding:'10px 14px' }}>
                        <span style={{ fontSize:11, fontWeight:700, padding:'2px 9px', borderRadius:20, background:`${STATUS_COLOR[status]||BRAND}18`, color:STATUS_COLOR[status]||BRAND, border:`1px solid ${STATUS_COLOR[status]||BRAND}30`, textTransform:'capitalize' }}>
                          {status.replace('_',' ')}
                        </span>
                      </td>
                      <td style={{ padding:'10px 14px', fontWeight:700, color:p.price?'#10b981':'var(--text-4)' }}>
                        {p.price ? `$${p.price}` : '—'}
                        {p.price && p.condition && <div style={{ fontSize:11, color:'var(--text-3)', fontWeight:400 }}>{p.condition}</div>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display:'flex', gap:8, justifyContent:'center', padding:'14px 0', flexShrink:0, borderTop:'1px solid var(--border)' }}>
          <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid var(--border)', background:'var(--card)', color:'var(--text-2)', cursor:page===1?'not-allowed':'pointer', fontSize:12, fontFamily:'inherit', opacity:page===1?0.4:1 }}>← Prev</button>
          <span style={{ fontSize:12, color:'var(--text-3)', alignSelf:'center' }}>Page {page} of {pages}</span>
          <button onClick={() => setPage(p=>Math.min(pages,p+1))} disabled={page===pages} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid var(--border)', background:'var(--card)', color:'var(--text-2)', cursor:page===pages?'not-allowed':'pointer', fontSize:12, fontFamily:'inherit', opacity:page===pages?0.4:1 }}>Next →</button>
        </div>
      )}
    </div>
  )
}
