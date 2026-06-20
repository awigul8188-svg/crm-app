import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { purchasingApi } from '../api'
import { api } from '../api'
import { formatDateShort, timeAgo } from '../components/Badges'
import Modal from '../components/Modal'

const BRAND = '#00D4C8'
const T = {
  lead:         { icon: '◎', label: 'Lead',   color: '#3b82f6' },
  repeat:       { icon: '↻', label: 'Repeat',  color: '#6366f1' },
  online_order: { icon: '◈', label: 'Order',   color: '#f59e0b' },
}
const URGENCY = {
  critical: { label: 'Critical', color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
  high:     { label: 'High',     color: '#f97316', bg: '#fff7ed', border: '#fed7aa' },
  normal:   { label: 'Normal',   color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
  low:      { label: 'Low',      color: '#10b981', bg: '#f0fdf4', border: '#bbf7d0' },
}
const inp = { width: '100%', boxSizing: 'border-box', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px 12px', fontSize: '12px', color: '#0f172a', fontFamily: '"Plus Jakarta Sans",sans-serif', outline: 'none' }

const PRESETS = [{ label: 'Today', v: 'today' }, { label: 'Week', v: 'week' }, { label: 'Month', v: 'month' }, { label: 'All', v: 'all' }, { label: 'Custom', v: 'custom' }]
function getDateRange(preset, from, to) {
  const fmt = d => d.toISOString().split('T')[0]; const now = new Date(); const today = fmt(now)
  if (preset === 'today') return { from: today, to: today }
  if (preset === 'week') { const d = new Date(now); d.setDate(d.getDate() - 7); return { from: fmt(d), to: today } }
  if (preset === 'month') { const d = new Date(now); d.setDate(1); return { from: fmt(d), to: today } }
  if (preset === 'custom') return { from, to }
  return { from: '', to: '' }
}

/* ── Animations ─────────────────────────────────── */
const STYLES = `
@keyframes fadeUp   { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
@keyframes fadeIn   { from { opacity:0 } to { opacity:1 } }
@keyframes barGrow  { from { width:0% } to { width:var(--w) } }
@keyframes spin     { to { transform:rotate(360deg) } }
@keyframes pulse    { 0%,100%{opacity:1}50%{opacity:.5} }
@keyframes countUp  { from { opacity:0; transform:scale(0.8) } to { opacity:1; transform:scale(1) } }
.stat-card { animation: fadeUp 0.4s ease both }
.stat-card:hover { transform: translateY(-2px) !important; box-shadow: 0 8px 24px rgba(0,0,0,0.09) !important; transition: all 0.2s ease !important }
.perf-bar  { animation: barGrow 0.8s cubic-bezier(.4,0,.2,1) both }
.fade-in   { animation: fadeIn 0.3s ease both }
.tab-btn   { transition: all 0.15s ease }
`

/* ── Helpers ─────────────────────────────────────── */
function UrgencyBadge({ urgency }) {
  const u = URGENCY[urgency || 'normal']
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: u.bg, color: u.color, border: `1px solid ${u.border}`, whiteSpace: 'nowrap' }}>{u.label}</span>
}

function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: '12px 0', alignItems: 'center' }}>
      <button onClick={() => onChange(page - 1)} disabled={page === 1} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: page === 1 ? '#cbd5e1' : '#475569', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, fontFamily: '"Plus Jakarta Sans",sans-serif' }}>← Prev</button>
      <span style={{ fontSize: 12, color: '#64748b' }}>Page {page} of {pages}</span>
      <button onClick={() => onChange(page + 1)} disabled={page === pages} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: page === pages ? '#cbd5e1' : '#475569', cursor: page === pages ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, fontFamily: '"Plus Jakarta Sans",sans-serif' }}>Next →</button>
    </div>
  )
}

/* ── Stat Card ──────────────────────────────────── */
function StatCard({ label, value, color, icon, sub, warn, delay = 0 }) {
  return (
    <div className="stat-card" style={{ background: warn ? '#fff5f5' : '#fff', borderRadius: 14, border: `1px solid ${warn ? '#fecaca' : '#f1f5f9'}`, padding: '14px 18px', position: 'relative', overflow: 'hidden', cursor: 'default', animationDelay: `${delay}ms` }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: color, borderRadius: '14px 0 0 14px' }} />
      <div style={{ position: 'absolute', top: 8, right: 10, fontSize: 18, opacity: 0.14 }}>{icon}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: warn ? '#dc2626' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: warn ? '#dc2626' : '#0f172a', fontFamily: '"Bricolage Grotesque",sans-serif', animation: 'countUp 0.5s ease both', animationDelay: `${delay + 100}ms` }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 11, color: warn ? '#ef4444' : '#94a3b8', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

/* ── Assign dropdown ─────────────────────────────── */
function AssignCell({ part, purchasers, onAssign }) {
  const [open, setOpen] = useState(false); const ref = useRef()
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{ padding: '4px 10px', borderRadius: 8, border: `1px solid ${part.purchaser_id ? BRAND + '40' : '#e2e8f0'}`, background: part.purchaser_id ? `${BRAND}10` : '#f8fafc', color: part.purchaser_id ? '#00b8ad' : '#64748b', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif', whiteSpace: 'nowrap' }}>
        {part.purchaser_name || '+ Assign'} ▾
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 9999, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 160, overflow: 'hidden', animation: 'fadeIn 0.15s ease' }}>
          {purchasers.map(p => (
            <div key={p.id} onClick={() => { onAssign(part.requirement_id, p.id); setOpen(false) }}
              style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 12, color: p.id === part.purchaser_id ? BRAND : '#0f172a', fontWeight: p.id === part.purchaser_id ? 700 : 400, display: 'flex', gap: 6, alignItems: 'center' }}
              onMouseEnter={e => e.currentTarget.style.background = `${BRAND}08`}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ width: 18, height: 18, borderRadius: 5, background: `${BRAND}20`, color: BRAND, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{p.name[0]}</div>
              {p.name} {p.id === part.purchaser_id && '✓'}
            </div>
          ))}
          {part.purchaser_id && <>
            <div style={{ height: 1, background: '#f1f5f9' }} />
            <div onClick={() => { fetch(`/api/purchasing/assign/${part.requirement_id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('crm_token')}` } }).then(() => onAssign(null, null)); setOpen(false) }}
              style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 12, color: '#ef4444' }}
              onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>✕ Unassign</div>
          </>}
        </div>
      )}
    </div>
  )
}

/* ── Inquiry assign modal ──────────────────────── */
function InquiryAssignModal({ inquiryId, onClose, onSaved }) {
  const [data, setData] = useState(null); const [purchasers, setPurchasers] = useState([])
  const [assignments, setAssignments] = useState({}); const [notes, setNotes] = useState({})
  const [urgencies, setUrgencies] = useState({}); const [saving, setSaving] = useState(false)
  useEffect(() => {
    Promise.all([purchasingApi.getInquiryParts(inquiryId), purchasingApi.getPurchasers()]).then(([d, p]) => {
      setData(d); setPurchasers(p)
      const a = {}, n = {}, u = {}
      d.parts?.forEach(pt => { if (pt.purchaser_id) a[pt.requirement_id] = pt.purchaser_id; if (pt.pm_notes) n[pt.requirement_id] = pt.pm_notes; u[pt.requirement_id] = pt.urgency || 'normal' })
      setAssignments(a); setNotes(n); setUrgencies(u)
    })
  }, [inquiryId])
  const handleSave = async () => {
    setSaving(true)
    const toAssign = Object.entries(assignments).filter(([, pid]) => pid).map(([rid, pid]) => ({ requirement_id: parseInt(rid), purchaser_id: pid, pm_notes: notes[rid] || null, urgency: urgencies[rid] || 'normal' }))
    if (toAssign.length) await purchasingApi.assignBulk({ assignments: toAssign })
    setSaving(false); onSaved(); onClose()
  }
  if (!data) return createPortal(<div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ background: '#fff', borderRadius: 20, padding: 40, color: '#94a3b8' }}>Loading...</div></div>, document.body)
  const { inquiry, parts } = data; const tInfo = T[inquiry?.type]
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, boxShadow: '0 24px 80px rgba(0,0,0,0.25)', width: '100%', maxWidth: 680, maxHeight: '90vh', display: 'flex', flexDirection: 'column', fontFamily: '"Plus Jakarta Sans",sans-serif', animation: 'fadeUp 0.25s ease' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ color: tInfo?.color, fontWeight: 600, fontSize: 13 }}>{tInfo?.icon} {tInfo?.label}</span>
              <span style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 700, fontSize: 16, color: '#0f172a' }}>{inquiry?.customer_name}</span>
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>AE: {inquiry?.ae_name || '—'} · {formatDateShort(inquiry?.created_at)} · {parts.length} part{parts.length !== 1 ? 's' : ''}</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: 'none', background: '#f1f5f9', cursor: 'pointer', fontSize: 18, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 24px' }}>
          {parts.map(part => (
            <div key={part.requirement_id} style={{ background: part.is_delayed ? '#fff5f5' : '#f8fafc', borderRadius: 12, padding: '14px 16px', border: `1px solid ${part.is_delayed ? '#fecaca' : '#f1f5f9'}`, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 14, color: '#0f172a' }}>{part.part_number}</span>
                <span style={{ fontSize: 12, color: '#64748b' }}>Qty: {part.quantity || '—'}</span>
                {part.selling_price && inquiry?.type === 'online_order' && <span style={{ fontWeight: 700, color: '#10b981', fontSize: 12 }}>Selling: ${part.selling_price}</span>}
                {part.is_delayed && <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 700 }}>⚠️ Delayed</span>}
                {part.quote_id && <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>✓ Quoted: ${part.price}</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Assign To</div>
                  <select value={assignments[part.requirement_id] || ''} onChange={e => setAssignments(prev => ({ ...prev, [part.requirement_id]: e.target.value ? parseInt(e.target.value) : null }))} style={{ ...inp, width: '100%', cursor: 'pointer' }}>
                    <option value="">— Select purchaser —</option>
                    {purchasers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Urgency</div>
                  <select value={urgencies[part.requirement_id] || 'normal'} onChange={e => setUrgencies(prev => ({ ...prev, [part.requirement_id]: e.target.value }))} style={{ ...inp, width: '100%', cursor: 'pointer' }}>
                    {Object.entries(URGENCY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Notes for Purchaser</div>
                  <input value={notes[part.requirement_id] || ''} onChange={e => setNotes(prev => ({ ...prev, [part.requirement_id]: e.target.value }))} placeholder="e.g. Check supplier X first..." style={inp} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 11, borderRadius: 12, border: 'none', background: saving ? '#94a3b8' : BRAND, color: '#0d0d0d', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif' }}>{saving ? 'Saving...' : '✓ Save Assignments'}</button>
        </div>
      </div>
    </div>, document.body
  )
}

/* ── Parts table ─────────────────────────────────── */
function PartsTable({ type, purchasers, dateRange, onRefresh }) {
  const [result, setResult] = useState(null); const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1); const [filterStatus, setFilterStatus] = useState(''); const [search, setSearch] = useState('')
  const load = () => {
    setLoading(true)
    purchasingApi.getParts({ type, status: filterStatus, page, from: dateRange.from, to: dateRange.to }).then(d => { setResult(d); setLoading(false) })
  }
  useEffect(() => { setPage(1) }, [type, filterStatus, JSON.stringify(dateRange)])
  useEffect(() => { load() }, [type, filterStatus, page, JSON.stringify(dateRange)])
  const handleAssign = async (reqId, purchaserId) => { if (purchaserId) await purchasingApi.assign({ requirement_id: reqId, purchaser_id: purchaserId }); load(); onRefresh() }
  const filtered = (result?.parts || []).filter(p => !search || p.part_number?.toLowerCase().includes(search.toLowerCase()) || p.customer_name?.toLowerCase().includes(search.toLowerCase()))
  return (
    <div className="fade-in">
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search part, customer..." style={{ ...inp, width: 220 }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, width: 'auto', cursor: 'pointer' }}>
          <option value="">All Statuses</option>
          <option value="unassigned">Unassigned</option>
          <option value="pending">Pending Quote</option>
          <option value="quoted">Quoted</option>
          <option value="not_in_stock">Not In Stock</option>
        </select>
        {result && <div style={{ fontSize: 12, color: '#94a3b8', marginLeft: 'auto' }}>{result.total} total</div>}
      </div>
      {loading ? <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>Loading...</div> : filtered.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', padding: 48, textAlign: 'center', color: '#94a3b8' }}>No parts found</div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                {['Urgency', 'Part Number', 'Qty', 'Customer', 'AE', ...(type === 'online_order' ? ['Selling'] : []), 'Date', 'Assign', 'Status', 'PM Notes', 'Quote'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '9px 12px', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={p.requirement_id} style={{ borderBottom: '1px solid #f1f5f9', background: p.is_delayed ? '#fff5f5' : p.is_over_selling ? '#fff7ed' : i % 2 === 0 ? '#fff' : '#fafbfc', transition: 'background 0.15s' }}>
                    <td style={{ padding: '9px 12px' }}><UrgencyBadge urgency={p.urgency} /></td>
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>{p.part_number}</span>
                        {p.is_delayed && <span title="Delayed >4 working days" style={{ fontSize: 10, color: '#dc2626' }}>⚠️</span>}
                        {p.not_in_stock && <span style={{ fontSize: 10, color: '#ef4444', background: '#fef2f2', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>OUT</span>}
                      </div>
                    </td>
                    <td style={{ padding: '9px 12px', color: '#475569' }}>{p.quantity || '—'}</td>
                    <td style={{ padding: '9px 12px', fontWeight: 500, whiteSpace: 'nowrap' }}>{p.customer_name}<div style={{ fontSize: 11, color: '#94a3b8' }}>{p.customer_company}</div></td>
                    <td style={{ padding: '9px 12px', color: '#64748b', whiteSpace: 'nowrap' }}>{p.ae_name || '—'}</td>
                    {type === 'online_order' && <td style={{ padding: '9px 12px', fontWeight: 700, color: p.is_over_selling ? '#dc2626' : '#10b981' }}>{p.selling_price ? `$${p.selling_price}` : '—'}</td>}
                    <td style={{ padding: '9px 12px', color: '#94a3b8', fontSize: 11, whiteSpace: 'nowrap' }}>{formatDateShort(p.inquiry_date)}</td>
                    <td style={{ padding: '9px 12px' }}><AssignCell part={p} purchasers={purchasers} onAssign={handleAssign} /></td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, ...(p.not_in_stock ? { background: '#fef2f2', color: '#dc2626' } : p.assignment_id ? p.assignment_status === 'quoted' ? { background: '#f0fdf4', color: '#16a34a' } : { background: '#fff7ed', color: '#d97706' } : { background: '#f8fafc', color: '#64748b' }) }}>
                        {p.not_in_stock ? 'Not In Stock' : p.assignment_id ? p.assignment_status === 'quoted' ? 'Quoted' : 'Pending' : 'Unassigned'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px', maxWidth: 140, color: '#64748b', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.pm_notes || '—'}</td>
                    <td style={{ padding: '9px 12px', maxWidth: 160 }}>
                      {p.quote_id ? (
                        <div>
                          <div style={{ fontWeight: 700, color: p.is_over_selling ? '#dc2626' : '#10b981', fontSize: 12 }}>${p.price} {p.is_over_selling && '⚠️'}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{p.condition}{p.lead_time ? ` · ${p.lead_time}` : ''}</div>
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>{p.supplier_name}</div>
                        </div>
                      ) : <span style={{ color: '#cbd5e1', fontSize: 11 }}>No quote</span>}
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

/* ── Purchaser Performance Card ──────────────────── */
function PurchaserPerformanceCard({ purchasers }) {
  const [selected, setSelected] = useState(null)

  if (!purchasers?.length) {
    return (
      <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40, fontSize: 13 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>👤</div>
        No purchasers assigned yet
      </div>
    )
  }

  const sorted = [...purchasers].sort((a, b) => b.quoted_count - a.quoted_count)
  const topQuoted = sorted[0]?.quoted_count || 1
  const totalQuoted = purchasers.reduce((s, p) => s + (p.quoted_count || 0), 0)
  const totalAssigned = purchasers.reduce((s, p) => s + (p.assigned || 0), 0)

  return (
    <div>
      {/* Team summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'Team Quotes', value: totalQuoted, color: '#10b981', icon: '✅' },
          { label: 'Team Pending', value: totalAssigned - totalQuoted, color: '#f59e0b', icon: '⏳' },
          { label: 'Overall Rate', value: totalAssigned > 0 ? `${Math.round(totalQuoted / totalAssigned * 100)}%` : '—', color: BRAND, icon: '📈' },
        ].map(s => (
          <div key={s.label} style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, marginBottom: 2 }}>{s.icon}</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: s.color, fontFamily: '"Bricolage Grotesque",sans-serif' }}>{s.value}</div>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Per-purchaser rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {sorted.map((p, idx) => {
          const quoteRate = p.assigned > 0 ? Math.round(p.quoted_count / p.assigned * 100) : 0
          const barW = topQuoted > 0 ? Math.round(p.quoted_count / topQuoted * 100) : 0
          const isTop = idx === 0 && p.quoted_count > 0
          const isExpanded = selected === p.id
          return (
            <div key={p.id}
              onClick={() => setSelected(isExpanded ? null : p.id)}
              style={{ borderRadius: 12, border: `1px solid ${isExpanded ? BRAND + '40' : '#f1f5f9'}`, background: isExpanded ? `${BRAND}04` : '#fff', padding: '12px 14px', cursor: 'pointer', transition: 'all 0.2s ease' }}
              onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = '#f8fafc' }}
              onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = '#fff' }}>

              {/* Main row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Avatar */}
                <div style={{ width: 34, height: 34, borderRadius: 10, background: isTop ? `${BRAND}20` : '#f1f5f9', color: isTop ? BRAND : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0, position: 'relative' }}>
                  {p.name[0]}
                  {isTop && <div style={{ position: 'absolute', top: -4, right: -4, fontSize: 10 }}>🏆</div>}
                </div>

                {/* Name + bar */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{p.name}</span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>{p.assigned} parts</span>
                  </div>
                  {/* Multi-segment bar */}
                  <div style={{ height: 6, background: '#f1f5f9', borderRadius: 6, overflow: 'hidden', display: 'flex' }}>
                    {p.assigned > 0 && <>
                      <div className="perf-bar" style={{ '--w': `${Math.round(p.quoted_count / p.assigned * 100)}%`, height: '100%', background: '#10b981', width: `${Math.round(p.quoted_count / p.assigned * 100)}%`, transition: 'width 0.8s cubic-bezier(.4,0,.2,1)' }} />
                      <div style={{ height: '100%', background: '#f59e0b', width: `${Math.round((p.pending_count || 0) / p.assigned * 100)}%`, transition: 'width 0.8s cubic-bezier(.4,0,.2,1) 0.1s' }} />
                    </>}
                  </div>
                </div>

                {/* Stats */}
                <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 70 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: p.quoted_count > 0 ? '#10b981' : '#94a3b8', fontFamily: '"Bricolage Grotesque",sans-serif' }}>{p.quoted_count} <span style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8' }}>quoted</span></div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: quoteRate >= 70 ? '#10b981' : quoteRate >= 40 ? '#f59e0b' : '#ef4444' }}>{quoteRate}% rate</div>
                </div>

                <div style={{ fontSize: 12, color: '#cbd5e1', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▾</div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="fade-in" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 10 }}>
                    {[
                      { label: 'Quoted',    value: p.quoted_count,   color: '#10b981', bg: '#f0fdf4' },
                      { label: 'Pending',   value: p.pending_count,  color: '#f59e0b', bg: '#fffbeb' },
                      { label: 'Unassigned',value: Math.max(0, p.assigned - p.quoted_count - (p.pending_count||0)), color: '#ef4444', bg: '#fef2f2' },
                      { label: 'Quote Rate',value: `${quoteRate}%`,  color: BRAND,     bg: `${BRAND}10` },
                    ].map(m => (
                      <div key={m.label} style={{ background: m.bg, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                        <div style={{ fontWeight: 800, fontSize: 15, color: m.color, fontFamily: '"Bricolage Grotesque",sans-serif' }}>{m.value}</div>
                        <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                  {/* Type breakdown if available */}
                  {p.by_type && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {Object.entries(p.by_type).map(([type, cnt]) => (
                        <span key={type} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: `${T[type]?.color}15`, color: T[type]?.color, fontWeight: 600 }}>
                          {T[type]?.icon} {cnt} {T[type]?.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, marginTop: 12, paddingTop: 10, borderTop: '1px solid #f8fafc' }}>
        {[['#10b981', 'Quoted'], ['#f59e0b', 'Pending'], ['#f1f5f9', 'Unassigned']].map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#94a3b8' }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: c }} />{l}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Main view ───────────────────────────────────── */
export default function PurchasingManagerView() {
  const [stats, setStats] = useState(null); const [purchasers, setPurchasers] = useState([])
  const [notifications, setNotifications] = useState([]); const [activeTab, setActiveTab] = useState('dashboard')
  const [preset, setPreset] = useState('all'); const [customFrom, setCustomFrom] = useState(''); const [customTo, setCustomTo] = useState('')
  const [assignInquiryId, setAssignInquiryId] = useState(null)
  const [showNewUser, setShowNewUser] = useState(false); const [newUserForm, setNewUserForm] = useState({ name: '', username: '', password: '' })
  const [savingUser, setSavingUser] = useState(false); const [userError, setUserError] = useState('')
  const [resetting, setResetting] = useState(false); const [resetResults, setResetResults] = useState(null); const [copiedAll, setCopiedAll] = useState(false)

  const token = localStorage.getItem('crm_token')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const dateRange = getDateRange(preset, customFrom, customTo)

  const loadStats = () => purchasingApi.getStats().then(setStats)
  const loadPurchasers = () => purchasingApi.getPurchasers().then(setPurchasers)
  const loadNotifications = () => api.getNotifications().then(n => setNotifications((n.activity || []).filter(x => x.inquiry_type?.endsWith('_parts'))))

  useEffect(() => { loadStats(); loadPurchasers(); loadNotifications() }, [])

  const handleCreatePurchaser = async () => {
    setSavingUser(true); setUserError('')
    try {
      const res = await fetch('/api/users', { method: 'POST', headers, body: JSON.stringify({ ...newUserForm, role: 'purchaser' }) })
      const d = await res.json(); if (!res.ok) throw new Error(d.error)
      setShowNewUser(false); setNewUserForm({ name: '', username: '', password: '' }); loadPurchasers()
    } catch (e) { setUserError(e.message) } finally { setSavingUser(false) }
  }

  const handleResetPasswords = async () => {
    if (!confirm('Reset passwords for all purchasers?')) return
    setResetting(true)
    const data = await purchasingApi.resetPurchaserPasswords(); setResetResults(data.results); setResetting(false)
  }

  const ms = stats
  const unreadNotifs = notifications.filter(n => !n.read).length
  const tabs = [
    { key: 'dashboard',     label: '📊 Dashboard' },
    { key: 'leads',         label: '◎ Leads' },
    { key: 'repeat',        label: '↻ Repeat' },
    { key: 'orders',        label: '◈ Orders' },
    { key: 'quotes',        label: '✅ Quotes' },
    { key: 'notifications', label: `🔔 New Parts${unreadNotifs > 0 ? ` (${unreadNotifs})` : ''}` },
  ]

  return (
    <div style={{ padding: 28, maxWidth: 1400, fontFamily: '"Plus Jakarta Sans",sans-serif' }}>
      <style>{STYLES}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 800, fontSize: 24, color: '#0f172a', margin: 0 }}>📦 Purchasing Dashboard</h1>
          <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 3 }}>Manage part assignments, track quotes, monitor performance</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={handleResetPasswords} disabled={resetting} style={{ padding: '7px 13px', borderRadius: 10, border: '1px solid #fecaca', background: '#fff5f5', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif' }}>🔑 Reset Passwords</button>
          <button onClick={() => setShowNewUser(true)} style={{ padding: '7px 16px', borderRadius: 10, border: 'none', background: BRAND, color: '#0d0d0d', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif' }}>+ Add Purchaser</button>
        </div>
      </div>

      {/* Date filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 3, gap: 2 }}>
          {PRESETS.map(r => <button key={r.v} onClick={() => setPreset(r.v)} style={{ padding: '5px 12px', borderRadius: 7, border: 'none', background: preset === r.v ? BRAND : 'transparent', color: preset === r.v ? '#0d0d0d' : '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif', transition: 'all 0.15s' }}>{r.label}</button>)}
        </div>
        {preset === 'custom' && <>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ ...inp, width: 'auto' }} />
          <span style={{ color: '#94a3b8' }}>→</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ ...inp, width: 'auto' }} />
        </>}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, background: '#f1f5f9', borderRadius: 12, padding: 3, marginBottom: 20, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} className="tab-btn"
            style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: activeTab === t.key ? '#fff' : 'transparent', color: activeTab === t.key ? '#0f172a' : '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif', boxShadow: activeTab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Dashboard tab ── */}
      {activeTab === 'dashboard' && ms && (
        <div className="fade-in">
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: 12, marginBottom: 20 }}>
            <StatCard label="Total Parts"  value={ms.totalParts}   color="#6366f1" icon="📦" delay={0} />
            <StatCard label="Unassigned"   value={ms.unassigned}   color="#ef4444" icon="📋" delay={50} />
            <StatCard label="Pending"      value={ms.pending}      color="#f59e0b" icon="⏳" delay={100} />
            <StatCard label="Quoted"       value={ms.quoted}       color="#10b981" icon="✅" delay={150} />
            <StatCard label="Delayed"      value={ms.delayed}      color="#dc2626" icon="⚠️" warn={ms.delayed > 0} sub={ms.delayed > 0 ? 'Over 4 working days' : null} delay={200} />
            <StatCard label="Not In Stock" value={ms.notInStock}   color="#94a3b8" icon="❌" delay={250} />
            <StatCard label="Quoted Today" value={ms.quotedToday}  color={BRAND}   icon="⚡" delay={300} />
            <StatCard label="New Today"    value={ms.newToday}     color="#3b82f6" icon="✨" delay={350} />
          </div>

          {/* Financial summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', padding: '16px 20px', animation: 'fadeUp 0.4s ease 0.2s both' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Total Quoted Value</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#10b981', fontFamily: '"Bricolage Grotesque",sans-serif' }}>${parseFloat(ms.totalQuotedValue || 0).toLocaleString()}</div>
            </div>
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', padding: '16px 20px', animation: 'fadeUp 0.4s ease 0.25s both' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Avg Quote Price</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: BRAND, fontFamily: '"Bricolage Grotesque",sans-serif' }}>${parseFloat(ms.avgQuotePrice || 0).toFixed(2)}</div>
            </div>
            <div style={{ background: ms.overSellingCount > 0 ? '#fff5f5' : '#fff', borderRadius: 14, border: `1px solid ${ms.overSellingCount > 0 ? '#fecaca' : '#f1f5f9'}`, padding: '16px 20px', animation: 'fadeUp 0.4s ease 0.3s both' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: ms.overSellingCount > 0 ? '#dc2626' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>⚠️ Over Selling Price</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: ms.overSellingCount > 0 ? '#dc2626' : '#0f172a', fontFamily: '"Bricolage Grotesque",sans-serif' }}>{ms.overSellingCount}</div>
              <div style={{ fontSize: 11, color: ms.overSellingCount > 0 ? '#ef4444' : '#94a3b8', marginTop: 3 }}>{ms.overSellingCount > 0 ? 'Quotes exceed order value' : 'All quotes within range'}</div>
            </div>
          </div>

          {/* Parts by type + Purchaser performance */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 20, marginBottom: 20 }}>
            {/* By type */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', padding: 20, animation: 'fadeUp 0.4s ease 0.35s both' }}>
              <div style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 14 }}>Parts by Type</div>
              {['lead', 'repeat', 'online_order'].map(type => {
                const d = ms.byType?.find(t => t.type === type) || { total: 0, unassigned: 0, pending: 0, quoted: 0, not_in_stock: 0 }
                const tInfo = T[type]
                return (
                  <div key={type} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: tInfo.color }}>{tInfo.icon} {tInfo.label}s</span>
                      <span style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', fontFamily: '"Bricolage Grotesque",sans-serif' }}>{d.total}</span>
                    </div>
                    <div style={{ height: 8, background: '#f1f5f9', borderRadius: 6, overflow: 'hidden', display: 'flex', gap: 1 }}>
                      {[['Unassigned', d.unassigned, '#ef4444'], ['Pending', d.pending, '#f59e0b'], ['Quoted', d.quoted, '#10b981'], ['No Stock', d.not_in_stock, '#94a3b8']].map(([l, v, c]) => (
                        d.total > 0 && v > 0 && <div key={l} title={`${l}: ${v}`} style={{ height: '100%', borderRadius: 3, background: c, width: `${Math.round(v / d.total * 100)}%`, transition: 'width 0.8s cubic-bezier(.4,0,.2,1)' }} />
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 5 }}>
                      {[['Unassigned', d.unassigned, '#ef4444'], ['Pending', d.pending, '#f59e0b'], ['Quoted', d.quoted, '#10b981']].map(([l, v, c]) => (
                        <span key={l} style={{ fontSize: 11, color: c, fontWeight: 600 }}>{v} {l}</span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Purchaser performance — enhanced */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', padding: 20, animation: 'fadeUp 0.4s ease 0.4s both' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Purchaser Performance</div>
                <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>Click a purchaser to expand</span>
              </div>
              <PurchaserPerformanceCard purchasers={ms.byPurchaser} />
            </div>
          </div>

          {/* Recent quotes */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', padding: 20, animation: 'fadeUp 0.4s ease 0.45s both' }}>
            <div style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 14 }}>Recent Quotes</div>
            {!ms.recentQuotes?.length ? <div style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>No quotes yet</div> :
              ms.recentQuotes.map((q, i) => {
                const isOver = q.selling_price && parseFloat(String(q.price || '0').replace(/[$,]/g, '')) > parseFloat(String(q.selling_price).replace(/[$,]/g, ''))
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #f8fafc', background: isOver ? '#fff5f5' : '', borderRadius: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `${T[q.inquiry_type]?.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                      {T[q.inquiry_type]?.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: '#0f172a' }}>{q.part_number}</span>
                        <span style={{ fontSize: 12, color: '#64748b' }}>· {q.customer_name}</span>
                        {isOver && <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 700 }}>⚠️ Over selling</span>}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{q.purchaser_name} · {timeAgo(q.updated_at)}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 700, color: isOver ? '#dc2626' : '#10b981', fontSize: 13 }}>${q.price}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{q.condition}</div>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {activeTab === 'leads'  && <PartsTable type="lead"         purchasers={purchasers} dateRange={dateRange} onRefresh={loadStats} />}
      {activeTab === 'repeat' && <PartsTable type="repeat"       purchasers={purchasers} dateRange={dateRange} onRefresh={loadStats} />}
      {activeTab === 'orders' && <PartsTable type="online_order" purchasers={purchasers} dateRange={dateRange} onRefresh={loadStats} />}
      {activeTab === 'quotes' && <QuotesTable dateRange={dateRange} />}

      {/* Notifications tab */}
      {activeTab === 'notifications' && (
        <div className="fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Click to open inquiry and assign purchasers</div>
            <button onClick={() => api.markAllRead().then(loadNotifications)} style={{ fontSize: 11, color: BRAND, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: '"Plus Jakarta Sans",sans-serif' }}>Mark all read</button>
          </div>
          {notifications.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', padding: 60, textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🔔</div>
              No new part notifications
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {notifications.map(notif => {
                const type = notif.inquiry_type?.replace('_parts', ''); const tInfo = T[type] || { icon: '📌', color: BRAND }
                return (
                  <div key={notif.id}
                    onClick={() => { api.markNotificationRead(notif.id).catch(() => {}); setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: 1 } : n)); if (notif.inquiry_id) setAssignInquiryId(notif.inquiry_id) }}
                    style={{ background: notif.read ? '#fff' : `${BRAND}05`, border: `1px solid ${notif.read ? '#f1f5f9' : `${BRAND}30`}`, borderRadius: 14, padding: '14px 18px', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = BRAND; e.currentTarget.style.boxShadow = `0 2px 12px rgba(0,212,200,0.1)` }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = notif.read ? '#f1f5f9' : `${BRAND}30`; e.currentTarget.style.boxShadow = 'none' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: `${tInfo.color}15`, color: tInfo.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{tInfo.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{notif.actor_name}</span>
                        <span style={{ fontSize: 13, color: '#475569' }}>added parts to</span>
                        <span style={{ fontWeight: 600, color: tInfo.color }}>{notif.customer_name}</span>
                      </div>
                      {notif.comment && <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace', background: '#f8fafc', padding: '3px 8px', borderRadius: 6, marginBottom: 3 }}>{notif.comment}</div>}
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{timeAgo(notif.created_at)} · Click to assign →</div>
                    </div>
                    {!notif.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: BRAND, flexShrink: 0, animation: 'pulse 2s infinite' }} />}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {assignInquiryId && <InquiryAssignModal inquiryId={assignInquiryId} onClose={() => setAssignInquiryId(null)} onSaved={() => { loadStats(); loadNotifications() }} />}

      {/* Add purchaser modal */}
      {showNewUser && (
        <Modal title="Add New Purchaser" onClose={() => { setShowNewUser(false); setNewUserForm({ name: '', username: '', password: '' }); setUserError('') }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[['Full Name', 'name', 'text'], ['Username', 'username', 'text'], ['Password', 'password', 'password']].map(([l, k, t]) => (
              <div key={k}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{l}</div>
                <input type={t} value={newUserForm[k]} onChange={e => setNewUserForm(f => ({ ...f, [k]: e.target.value }))} style={{ ...inp, padding: '10px 14px', fontSize: '13px' }} />
              </div>
            ))}
            {userError && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#dc2626' }}>⚠ {userError}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowNewUser(false)} style={{ flex: 1, padding: 11, borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif' }}>Cancel</button>
              <button onClick={handleCreatePurchaser} disabled={savingUser} style={{ flex: 1, padding: 11, borderRadius: 12, border: 'none', background: BRAND, color: '#0d0d0d', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif' }}>{savingUser ? 'Adding...' : 'Add Purchaser'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reset passwords modal */}
      {resetResults && (
        <Modal title="🔑 Purchaser Passwords Reset" onClose={() => setResetResults(null)} wide>
          <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#c2410c' }}>⚠ Save these — won't be shown again</div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>{['Name', 'Username', 'Password', ''].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px 14px', fontSize: 11, fontWeight: 700, color: '#64748b' }}>{h}</th>)}</tr></thead>
              <tbody>{resetResults.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: i < resetResults.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600 }}>{r.name}</td>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#64748b' }}>{r.username}</td>
                  <td style={{ padding: '10px 14px' }}><span style={{ fontFamily: 'monospace', fontWeight: 700, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '3px 8px' }}>{r.password}</span></td>
                  <td style={{ padding: '10px 14px' }}><button onClick={() => navigator.clipboard.writeText(r.password)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>📋</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { navigator.clipboard.writeText(resetResults.map(r => `${r.name} (${r.username}): ${r.password}`).join('\n')); setCopiedAll(true); setTimeout(() => setCopiedAll(false), 2000) }}
              style={{ flex: 1, padding: 11, borderRadius: 12, border: `1px solid ${BRAND}`, background: copiedAll ? BRAND : `${BRAND}15`, color: copiedAll ? '#0d0d0d' : '#00b8ad', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif', transition: 'all 0.2s' }}>
              {copiedAll ? '✓ Copied!' : '📋 Copy All'}
            </button>
            <button onClick={() => setResetResults(null)} style={{ flex: 1, padding: 11, borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif' }}>Done</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

/* ── Quotes table ────────────────────────────────── */
function QuotesTable({ dateRange }) {
  const [result, setResult] = useState(null); const [loading, setLoading] = useState(true); const [page, setPage] = useState(1); const [type, setType] = useState('')
  useEffect(() => { setPage(1) }, [type, JSON.stringify(dateRange)])
  useEffect(() => {
    setLoading(true)
    purchasingApi.getQuotes({ page, type, from: dateRange.from, to: dateRange.to }).then(d => { setResult(d); setLoading(false) })
  }, [page, type, JSON.stringify(dateRange)])
  if (loading) return <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>Loading...</div>
  const quotes = result?.quotes || []
  return (
    <div className="fade-in">
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <select value={type} onChange={e => setType(e.target.value)} style={{ ...inp, width: 'auto', cursor: 'pointer' }}>
          <option value="">All Types</option>
          <option value="lead">Leads</option>
          <option value="repeat">Repeat</option>
          <option value="online_order">Online Orders</option>
        </select>
        {result && <div style={{ fontSize: 12, color: '#94a3b8', marginLeft: 'auto' }}>{result.total} total quotes</div>}
      </div>
      {quotes.length === 0 ? <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', padding: 48, textAlign: 'center', color: '#94a3b8' }}>No quotes yet</div> : (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                {['Date', 'Part', 'Qty', 'Customer', 'Type', 'AE', 'Purchaser', 'Price', 'Selling', 'Δ', 'Condition', 'Lead Time', 'Supplier'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '9px 12px', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {quotes.map((q, i) => (
                  <tr key={q.id} style={{ borderBottom: '1px solid #f1f5f9', background: q.is_over_selling ? '#fff5f5' : i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                    <td style={{ padding: '9px 12px', color: '#94a3b8', fontSize: 11, whiteSpace: 'nowrap' }}>{formatDateShort(q.updated_at)}</td>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>{q.part_number}</td>
                    <td style={{ padding: '9px 12px', color: '#475569' }}>{q.quantity || '—'}</td>
                    <td style={{ padding: '9px 12px', fontWeight: 500, whiteSpace: 'nowrap' }}>{q.customer_name}</td>
                    <td style={{ padding: '9px 12px' }}><span style={{ color: T[q.inquiry_type]?.color, fontSize: 13 }}>{T[q.inquiry_type]?.icon}</span></td>
                    <td style={{ padding: '9px 12px', color: '#64748b' }}>{q.ae_name || '—'}</td>
                    <td style={{ padding: '9px 12px', fontWeight: 600, color: BRAND }}>{q.purchaser_name}</td>
                    <td style={{ padding: '9px 12px', fontWeight: 700, color: q.is_over_selling ? '#dc2626' : '#10b981', fontSize: 13 }}>${q.price}</td>
                    <td style={{ padding: '9px 12px', color: '#64748b' }}>{q.selling_price ? `$${q.selling_price}` : '—'}</td>
                    <td style={{ padding: '9px 12px' }}>
                      {q.selling_price && q.inquiry_type === 'online_order' ? (
                        <span style={{ fontSize: 11, fontWeight: 700, color: q.is_over_selling ? '#dc2626' : '#10b981' }}>
                          {q.is_over_selling ? '⚠️ +' : '✓ '}${Math.abs(parseFloat(String(q.price || 0).replace(/[$,]/g, '')) - parseFloat(String(q.selling_price).replace(/[$,]/g, ''))).toFixed(2)}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '9px 12px' }}><span style={{ fontSize: 11, background: '#f1f5f9', padding: '2px 7px', borderRadius: 5 }}>{q.condition}</span></td>
                    <td style={{ padding: '9px 12px', color: '#64748b', fontSize: 11 }}>{q.lead_time || '—'}</td>
                    <td style={{ padding: '9px 12px', color: '#64748b', fontSize: 11 }}>{q.supplier_name || '—'}</td>
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
