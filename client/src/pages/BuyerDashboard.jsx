import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Package, Truck, CheckCircle2, ClipboardList } from 'lucide-react'
import { operationsApi } from '../api'
import { useAuth } from '../App'
import SearchableSelect from '../components/SearchableSelect'

const BRAND = '#00D4C8'
const STAGES = ['Awaiting PO', 'PO Placed', 'Shipped to Warehouse', 'Received', 'Shipped to Customer', 'Delivered']
const STAGE_COLOR = {
  'Awaiting PO': '#ef4444', 'PO Placed': '#f59e0b', 'Shipped to Warehouse': '#6366f1',
  'Received': '#3b82f6', 'Shipped to Customer': '#8b5cf6', 'Delivered': '#10b981',
}
const money = n => `$${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}`
const inp = { width: '100%', boxSizing: 'border-box', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 11px', fontSize: 13, color: '#0f172a', fontFamily: '"Plus Jakarta Sans",sans-serif', outline: 'none' }
const lbl = { fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }

function Loader() {
  return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><div style={{ width: 26, height: 26, borderRadius: '50%', border: `2px solid ${BRAND}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} /></div>
}

function StageBadge({ stage }) {
  const s = stage || 'Awaiting PO'
  const c = STAGE_COLOR[s] || '#94a3b8'
  return <span style={{ fontSize: 11, fontWeight: 700, color: c, background: `${c}15`, border: `1px solid ${c}30`, borderRadius: 8, padding: '2px 9px', whiteSpace: 'nowrap' }}>{s}</span>
}

function Field({ label, children }) {
  return <div><div style={lbl}>{label}</div>{children}</div>
}

// ── Vendor-fill modal ───────────────────────────────────────────────────────
function VendorModal({ id, suppliers, onAddSupplier, onClose, onSaved }) {
  const [order, setOrder] = useState(null)
  const [items, setItems] = useState([])
  const [fulfillment, setFulfillment] = useState('')
  const [shippedVia, setShippedVia] = useState('')
  const [trackingCust, setTrackingCust] = useState('')
  const [buyer, setBuyer] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newSup, setNewSup] = useState('')
  const [addingFor, setAddingFor] = useState(null) // item index showing the "+ new supplier" input

  const load = useCallback(() => {
    operationsApi.buyerOrder(id).then(o => {
      setOrder(o)
      setItems((o.items || []).map(i => ({ ...i })))
      setFulfillment(o.fulfillment_status || 'Awaiting PO')
      setShippedVia(o.shipped_via || '')
      setTrackingCust(o.tracking_to_customer || '')
      setBuyer(o.buyer || '')
    }).catch(e => setError(e.message))
  }, [id])
  useEffect(() => { load() }, [load])

  const setItem = (i, k, v) => setItems(arr => arr.map((it, idx) => idx === i ? { ...it, [k]: v } : it))

  const addSupplier = async (i) => {
    if (!newSup.trim()) return
    const s = await onAddSupplier(newSup.trim())
    if (s) { setItem(i, 'supplier_id', s.id); setNewSup(''); setAddingFor(null) }
  }

  const save = async (markComplete) => {
    setSaving(true); setError('')
    try {
      await operationsApi.buyerSaveOrder(id, {
        items: items.map(it => ({
          id: it.id, supplier_id: it.supplier_id, buying: it.buying, cc_paid: it.cc_paid, tax_paid: it.tax_paid,
          shipping_paid: it.shipping_paid, duty_paid: it.duty_paid, payment_method: it.payment_method,
          payment_due: it.payment_due, supplier_terms: it.supplier_terms, ta_po_number: it.ta_po_number,
          tracking_to_warehouse: it.tracking_to_warehouse, serials: it.serials,
        })),
        fulfillment_status: fulfillment, shipped_via: shippedVia, tracking_to_customer: trackingCust, buyer,
      })
      if (markComplete !== undefined) await operationsApi.buyerSetComplete(id, markComplete)
      onSaved(); onClose()
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  const supItems = suppliers.map(s => ({ value: s.id, label: s.company, sub: s.rep_name || '' }))
  const sellTotal = items.reduce((s, it) => s + (Number(it.selling) || 0) * (Number(it.quantity) || 0), 0)
  const buyTotal = items.reduce((s, it) => s + (Number(it.buying) || 0) * (Number(it.quantity) || 0), 0)

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, boxShadow: '0 32px 100px rgba(0,0,0,0.3)', width: '100%', maxWidth: 860, maxHeight: '92vh', display: 'flex', flexDirection: 'column', fontFamily: '"Plus Jakarta Sans",sans-serif' }}>
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          {!order ? <div style={{ fontWeight: 700 }}>Loading…</div> : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
                <span style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 700, fontSize: 16, color: '#0f172a' }}>{order.customer_name || '—'}</span>
                <StageBadge stage={fulfillment} />
                {!!order.vendor_complete && <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981' }}>✓ Vendor complete</span>}
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{order.order_number} · Rep: {order.rep || '—'} · Sell {money(sellTotal)}</div>
            </div>
          )}
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: 'none', background: '#f1f5f9', cursor: 'pointer', fontSize: 18, color: '#64748b' }}>×</button>
        </div>

        {!order ? <Loader /> : (
          <div style={{ overflowY: 'auto', padding: '18px 24px', flex: 1 }}>
            {/* Per-item vendor fields */}
            {items.map((it, i) => (
              <div key={it.id} style={{ border: '1px solid #f1f5f9', borderRadius: 14, padding: 16, marginBottom: 14, background: '#fafbfc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                  <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{it.part_number || '(no part #)'}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Qty {it.quantity} · Sell {money(it.selling)}</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <Field label="Supplier">
                    <SearchableSelect items={supItems} value={it.supplier_id || ''} onChange={(v) => setItem(i, 'supplier_id', v ? Number(v) : null)} placeholder="Pick supplier…" />
                    {addingFor === i ? (
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <input value={newSup} onChange={e => setNewSup(e.target.value)} placeholder="New supplier name" style={{ ...inp, padding: '6px 9px' }} onKeyDown={e => e.key === 'Enter' && addSupplier(i)} />
                        <button onClick={() => addSupplier(i)} style={{ border: 'none', background: BRAND, color: '#062b29', borderRadius: 8, padding: '0 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Add</button>
                      </div>
                    ) : (
                      <button onClick={() => { setAddingFor(i); setNewSup('') }} style={{ marginTop: 5, fontSize: 11, color: BRAND, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>+ New supplier</button>
                    )}
                  </Field>
                  <Field label="Buying (unit)"><input value={it.buying ?? ''} onChange={e => setItem(i, 'buying', e.target.value)} placeholder="0" style={inp} /></Field>
                  <Field label="PO #"><input value={it.ta_po_number || ''} onChange={e => setItem(i, 'ta_po_number', e.target.value)} placeholder="PO-…" style={inp} /></Field>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <Field label="CC paid"><input value={it.cc_paid ?? ''} onChange={e => setItem(i, 'cc_paid', e.target.value)} placeholder="0" style={inp} /></Field>
                  <Field label="Tax paid"><input value={it.tax_paid ?? ''} onChange={e => setItem(i, 'tax_paid', e.target.value)} placeholder="0" style={inp} /></Field>
                  <Field label="Shipping paid"><input value={it.shipping_paid ?? ''} onChange={e => setItem(i, 'shipping_paid', e.target.value)} placeholder="0" style={inp} /></Field>
                  <Field label="Duty paid"><input value={it.duty_paid ?? ''} onChange={e => setItem(i, 'duty_paid', e.target.value)} placeholder="0" style={inp} /></Field>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <Field label="Payment method"><input value={it.payment_method || ''} onChange={e => setItem(i, 'payment_method', e.target.value)} placeholder="Wire / CC / …" style={inp} /></Field>
                  <Field label="Supplier terms"><input value={it.supplier_terms || ''} onChange={e => setItem(i, 'supplier_terms', e.target.value)} placeholder="Net 30 / Prepaid" style={inp} /></Field>
                  <Field label="Payment due"><input type="date" value={it.payment_due || ''} onChange={e => setItem(i, 'payment_due', e.target.value)} style={inp} /></Field>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Field label="Tracking → warehouse"><input value={it.tracking_to_warehouse || ''} onChange={e => setItem(i, 'tracking_to_warehouse', e.target.value)} placeholder="Tracking #" style={inp} /></Field>
                  <Field label="Serials"><input value={it.serials || ''} onChange={e => setItem(i, 'serials', e.target.value)} placeholder="Serial numbers" style={inp} /></Field>
                </div>
              </div>
            ))}
            {items.length === 0 && <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px 0', fontSize: 13 }}>This order has no line items.</div>}

            {/* Order-level fulfillment */}
            <div style={{ border: `1px solid ${BRAND}30`, borderRadius: 14, padding: 16, background: `${BRAND}06` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>📦 Fulfillment & shipping to customer</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <Field label="Stage">
                  <select value={fulfillment} onChange={e => setFulfillment(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                    {STAGES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Shipped via"><input value={shippedVia} onChange={e => setShippedVia(e.target.value)} placeholder="FedEx / UPS…" style={inp} /></Field>
                <Field label="Tracking → customer"><input value={trackingCust} onChange={e => setTrackingCust(e.target.value)} placeholder="Tracking #" style={inp} /></Field>
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: '#64748b' }}>Buy total so far: <b style={{ color: '#0f172a' }}>{money(buyTotal)}</b> · Margin: <b style={{ color: sellTotal - buyTotal >= 0 ? '#10b981' : '#ef4444' }}>{money(sellTotal - buyTotal)}</b></div>
            </div>

            {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#dc2626', marginTop: 14 }}>⚠ {error}</div>}
          </div>
        )}

        {/* Footer actions */}
        {order && (
          <div style={{ borderTop: '1px solid #f1f5f9', padding: '14px 24px', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
            <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button onClick={() => save(undefined)} disabled={saving} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#0f172a', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Save'}</button>
            {order.vendor_complete
              ? <button onClick={() => save(false)} disabled={saving} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: '#f59e0b', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Reopen</button>
              : <button onClick={() => save(true)} disabled={saving} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: BRAND, color: '#062b29', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Save & Mark Complete</button>}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

// ── Dashboard ───────────────────────────────────────────────────────────────
export default function BuyerDashboard() {
  const { user } = useAuth()
  const [scope, setScope] = useState('todo')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [suppliers, setSuppliers] = useState([])
  const [editId, setEditId] = useState(null)

  const loadOrders = useCallback(() => {
    setLoading(true)
    operationsApi.buyerOrders(scope).then(d => { setOrders(Array.isArray(d) ? d : []); setLoading(false) }).catch(() => setLoading(false))
  }, [scope])
  const loadStats = () => operationsApi.buyerStats().then(setStats).catch(() => {})
  const loadSuppliers = () => operationsApi.getSuppliers().then(d => setSuppliers(Array.isArray(d) ? d : [])).catch(() => {})

  useEffect(() => { loadOrders() }, [loadOrders])
  useEffect(() => { loadStats(); loadSuppliers() }, [])

  const addSupplier = async (company) => {
    try { const s = await operationsApi.createSupplier({ company }); await loadSuppliers(); return s } catch { return null }
  }

  const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }

  const tabs = [
    { key: 'todo', label: 'To Do', Icon: ClipboardList, count: stats?.todo },
    { key: 'transit', label: 'In Transit', Icon: Truck, count: stats?.transit },
    { key: 'delivered', label: 'Delivered', Icon: CheckCircle2, count: stats?.delivered },
  ]

  return (
    <div className="page-wrap" style={{ maxWidth: 1200 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div className="mb-6">
        <h1 className="font-display font-extrabold text-2xl text-ink-900">{greeting()}, {user.name} 👋</h1>
        <p className="text-ink-400 text-sm mt-1">Vendor & fulfillment — fill the supplier side of closed-won orders and track shipments.</p>
      </div>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Awaiting Vendor Info', value: stats?.todo, color: '#ef4444', Icon: ClipboardList },
          { label: 'In Transit', value: stats?.transit, color: '#6366f1', Icon: Truck },
          { label: 'Delivered', value: stats?.delivered, color: '#10b981', Icon: CheckCircle2 },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.06)', padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <s.Icon size={14} style={{ color: s.color }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</span>
            </div>
            <div style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontSize: 40, fontWeight: 900, lineHeight: 1, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.value ?? '—'}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, background: '#f1f5f9', borderRadius: 14, padding: 4, marginBottom: 20, width: 'fit-content' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setScope(t.key)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, border: 'none', background: scope === t.key ? '#fff' : 'transparent', color: scope === t.key ? '#0f172a' : '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: scope === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
            <t.Icon size={13} />{t.label}
            {t.count > 0 && <span style={{ marginLeft: 4, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 100, background: scope === t.key ? BRAND : '#cbd5e1', color: scope === t.key ? '#062b29' : '#fff', fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Orders */}
      {loading ? <Loader /> : orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', fontSize: 14, background: '#fff', borderRadius: 16, border: '1px solid #f1f5f9' }}>
          {scope === 'todo' ? 'All caught up — no orders awaiting vendor info 🎉' : 'Nothing here yet.'}
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Order', 'Customer', 'Rep', 'Items', 'Sell', 'Stage', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '11px 16px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o, i) => (
                <tr key={o.id} onClick={() => setEditId(o.id)} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 ? '#fafbfc' : '#fff', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = `${BRAND}08`}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 ? '#fafbfc' : '#fff'}>
                  <td style={{ padding: '11px 16px', fontFamily: 'monospace', fontSize: 12, color: '#475569', whiteSpace: 'nowrap' }}>{o.order_number}</td>
                  <td style={{ padding: '11px 16px', fontWeight: 600, color: '#0f172a' }}>{o.customer_name || '—'}</td>
                  <td style={{ padding: '11px 16px', color: '#64748b' }}>{o.rep || '—'}</td>
                  <td style={{ padding: '11px 16px', color: '#64748b', whiteSpace: 'nowrap' }}>
                    <span style={{ color: o.items_filled >= o.item_count && o.item_count > 0 ? '#10b981' : '#f59e0b', fontWeight: 700 }}>{o.items_filled}</span>/{o.item_count}
                  </td>
                  <td style={{ padding: '11px 16px', color: '#0f172a', fontWeight: 600, whiteSpace: 'nowrap' }}>{money(o.order_amount)}</td>
                  <td style={{ padding: '11px 16px' }}><StageBadge stage={o.fulfillment_status} /></td>
                  <td style={{ padding: '11px 16px', textAlign: 'right' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: BRAND, whiteSpace: 'nowrap' }}>{o.vendor_complete ? 'View →' : 'Fill →'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editId && (
        <VendorModal
          id={editId}
          suppliers={suppliers}
          onAddSupplier={addSupplier}
          onClose={() => setEditId(null)}
          onSaved={() => { loadOrders(); loadStats() }}
        />
      )}
    </div>
  )
}
