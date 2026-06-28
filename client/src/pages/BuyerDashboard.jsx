import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Package, Truck, CheckCircle2, ClipboardList, Search, X, ArrowUpDown, ArrowUp, ArrowDown, SlidersHorizontal } from 'lucide-react'
import { operationsApi } from '../api'
import { useAuth } from '../App'
import { OP_CONDITIONS } from '../components/Badges'
import SearchableSelect from '../components/SearchableSelect'
import { ColumnPicker, useColumnPrefs } from '../components/ColumnPicker'
import InvoiceModal from '../components/InvoiceModal'
import POModal from '../components/POModal'

const BRAND = '#00D4C8'
const STAGES = ['Awaiting PO', 'PO Placed', 'Shipped to Warehouse', 'Received', 'Shipped to Customer', 'Delivered']
const STAGE_COLOR = {
  'Awaiting PO': '#ef4444', 'PO Placed': '#f59e0b', 'Shipped to Warehouse': '#6366f1',
  'Received': '#3b82f6', 'Shipped to Customer': '#8b5cf6', 'Delivered': '#10b981',
}
const money = n => `$${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}`
const inp = { width: '100%', boxSizing: 'border-box', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '9px 12px', fontSize: 13, color: '#0f172a', fontFamily: '"Plus Jakarta Sans",sans-serif', outline: 'none' }
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

// Subsection divider-label inside the vendor form, to break the long field list into scannable groups.
function Sub({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 11px' }}>
      <span style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: '#eef2f6' }} />
    </div>
  )
}

// Trim float noise (e.g. 95.30999999999997 → 95.31) for display; keep blanks blank so placeholders show.
const cleanNum = v => (v === null || v === undefined || v === '') ? '' : (Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) / 100 : v)

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
  const [dirty, setDirty] = useState(false)
  const [showInvoice, setShowInvoice] = useState(false)
  const [showPO, setShowPO] = useState(false)
  const [purchasers, setPurchasers] = useState([])
  const { user } = useAuth()
  const attemptClose = () => { if (dirty && !window.confirm('Discard unsaved changes?')) return; onClose() }

  useEffect(() => { operationsApi.getPurchasers().then(setPurchasers).catch(() => {}) }, [])
  const purchaserNames = purchasers.map(p => p.name)

  const load = useCallback(() => {
    operationsApi.buyerOrder(id).then(o => {
      setOrder(o)
      // Round the money fields on load so stored float noise doesn't show in the inputs.
      setItems((o.items || []).map(i => ({
        ...i, selling: cleanNum(i.selling), buying: cleanNum(i.buying),
        cc_paid: cleanNum(i.cc_paid), tax_paid: cleanNum(i.tax_paid),
        shipping_paid: cleanNum(i.shipping_paid), duty_paid: cleanNum(i.duty_paid),
      })))
      setFulfillment(o.fulfillment_status || 'Awaiting PO')
      setShippedVia(o.shipped_via || '')
      setTrackingCust(o.tracking_to_customer || '')
      setBuyer(o.buyer || '')
    }).catch(e => setError(e.message))
  }, [id])
  useEffect(() => { load() }, [load])

  const setItem = (i, k, v) => { setDirty(true); setItems(arr => arr.map((it, idx) => idx === i ? { ...it, [k]: v } : it)) }

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
          id: it.id, part_number: it.part_number, quantity: it.quantity, product_condition: it.product_condition, selling: it.selling,
          supplier_id: it.supplier_id, buying: it.buying, cc_paid: it.cc_paid, tax_paid: it.tax_paid,
          shipping_paid: it.shipping_paid, duty_paid: it.duty_paid, payment_method: it.payment_method,
          payment_due: it.payment_due, supplier_terms: it.supplier_terms, ta_po_number: it.ta_po_number,
          tracking_to_warehouse: it.tracking_to_warehouse, serials: it.serials, sourced_by: it.sourced_by,
        })),
        fulfillment_status: fulfillment, shipped_via: shippedVia, tracking_to_customer: trackingCust, buyer,
        // complete folded into the same request → save + mark-complete is atomic (no half-applied state).
        ...(markComplete !== undefined ? { complete: markComplete } : {}),
      })
      setDirty(false); onSaved(); onClose()
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  const supItems = suppliers.map(s => ({ value: s.id, label: s.company, sub: s.rep_name || '' }))
  const sellTotal = items.reduce((s, it) => s + (Number(it.selling) || 0) * (Number(it.quantity) || 0), 0)
  // Landed cost = buying×qty + the per-line cc/tax/shipping/duty paid, so the margin reflects true cost.
  const buyTotal = items.reduce((s, it) => s + (Number(it.buying) || 0) * (Number(it.quantity) || 0)
    + (Number(it.cc_paid) || 0) + (Number(it.tax_paid) || 0) + (Number(it.shipping_paid) || 0) + (Number(it.duty_paid) || 0), 0)

  return createPortal(
    <div onClick={attemptClose} style={{ position: "fixed", inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, boxShadow: '0 32px 100px rgba(0,0,0,0.3)', width: '100%', maxWidth: 940, maxHeight: '92vh', display: 'flex', flexDirection: 'column', fontFamily: '"Plus Jakarta Sans",sans-serif' }}>
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
          <button onClick={attemptClose} style={{ width: 32, height: 32, borderRadius: 10, border: 'none', background: '#f1f5f9', cursor: 'pointer', fontSize: 18, color: '#64748b' }}>×</button>
        </div>

        {!order ? <Loader /> : (
          <div style={{ overflowY: 'auto', padding: '20px 26px', flex: 1, background: '#f8fafc' }}>
            {/* Per-item vendor fields */}
            {items.map((it, i) => (
              <div key={it.id} style={{ border: '1px solid #eef2f6', borderRadius: 16, padding: '20px 22px', marginBottom: 16, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                {/* Card header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', fontFamily: '"Bricolage Grotesque",sans-serif' }}>
                    {items.length > 1 ? `Item ${i + 1} of ${items.length}` : 'Line item'}{it.part_number ? <span style={{ color: '#94a3b8', fontWeight: 600 }}> · {it.part_number}</span> : ''}
                  </span>
                </div>

                {/* Sales side — editable so the buyer can fix AE typos */}
                <Sub>Sales side</Sub>
                <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 0.8fr 1.2fr 1fr', gap: 14, marginBottom: 18 }}>
                  <Field label="Part #"><input value={it.part_number || ''} onChange={e => setItem(i, 'part_number', e.target.value)} placeholder="Part #" style={inp} /></Field>
                  <Field label="Qty"><input value={it.quantity ?? ''} onChange={e => setItem(i, 'quantity', e.target.value)} placeholder="0" style={inp} /></Field>
                  <Field label="Condition">
                    <select value={it.product_condition || ''} onChange={e => setItem(i, 'product_condition', e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                      <option value="">—</option>
                      {[...OP_CONDITIONS, ...(it.product_condition && !OP_CONDITIONS.includes(it.product_condition) ? [it.product_condition] : [])].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Selling (unit)"><input value={it.selling ?? ''} onChange={e => setItem(i, 'selling', e.target.value)} placeholder="0" style={inp} /></Field>
                </div>

                {/* Vendor sourcing */}
                <Sub>Vendor &amp; sourcing</Sub>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.2fr', gap: 14, marginBottom: 18, alignItems: 'start' }}>
                  <Field label="Supplier">
                    <SearchableSelect items={supItems} value={it.supplier_id || ''} onChange={(v) => setItem(i, 'supplier_id', v ? Number(v) : null)} placeholder="Pick supplier…" />
                    {addingFor === i ? (
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <input value={newSup} onChange={e => setNewSup(e.target.value)} placeholder="New supplier name" style={{ ...inp, padding: '6px 9px' }} onKeyDown={e => e.key === 'Enter' && addSupplier(i)} />
                        <button onClick={() => addSupplier(i)} style={{ border: 'none', background: BRAND, color: '#062b29', borderRadius: 8, padding: '0 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Add</button>
                      </div>
                    ) : (
                      <button onClick={() => { setAddingFor(i); setNewSup('') }} style={{ marginTop: 6, fontSize: 11, color: BRAND, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>+ New supplier</button>
                    )}
                  </Field>
                  <Field label="Buying (unit)"><input value={it.buying ?? ''} onChange={e => setItem(i, 'buying', e.target.value)} placeholder="0" style={inp} /></Field>
                  <Field label="PO #"><input value={it.ta_po_number || ''} onChange={e => setItem(i, 'ta_po_number', e.target.value)} placeholder="PO-…" style={inp} /></Field>
                  <Field label="Buyer / sourced by">
                    <select value={it.sourced_by || ''} onChange={e => setItem(i, 'sourced_by', e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                      <option value="">— Select purchaser —</option>
                      {!!it.sourced_by && !purchaserNames.includes(it.sourced_by) && <option value={it.sourced_by}>{it.sourced_by} (current)</option>}
                      {purchasers.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                  </Field>
                </div>

                {/* Landed costs */}
                <Sub>Landed costs paid</Sub>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14, marginBottom: 18 }}>
                  <Field label="CC paid"><input value={it.cc_paid ?? ''} onChange={e => setItem(i, 'cc_paid', e.target.value)} placeholder="0" style={inp} /></Field>
                  <Field label="Tax paid"><input value={it.tax_paid ?? ''} onChange={e => setItem(i, 'tax_paid', e.target.value)} placeholder="0" style={inp} /></Field>
                  <Field label="Shipping paid"><input value={it.shipping_paid ?? ''} onChange={e => setItem(i, 'shipping_paid', e.target.value)} placeholder="0" style={inp} /></Field>
                  <Field label="Duty paid"><input value={it.duty_paid ?? ''} onChange={e => setItem(i, 'duty_paid', e.target.value)} placeholder="0" style={inp} /></Field>
                </div>

                {/* Payment */}
                <Sub>Payment to supplier</Sub>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 18 }}>
                  <Field label="Payment method"><input value={it.payment_method || ''} onChange={e => setItem(i, 'payment_method', e.target.value)} placeholder="Wire / CC / …" style={inp} /></Field>
                  <Field label="Supplier terms"><input value={it.supplier_terms || ''} onChange={e => setItem(i, 'supplier_terms', e.target.value)} placeholder="Net 30 / Prepaid" style={inp} /></Field>
                  <Field label="Payment due"><input type="date" value={it.payment_due || ''} onChange={e => setItem(i, 'payment_due', e.target.value)} style={inp} /></Field>
                </div>

                {/* Receiving */}
                <Sub>Receiving</Sub>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
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
                  <select value={fulfillment} onChange={e => { setDirty(true); setFulfillment(e.target.value) }} style={{ ...inp, cursor: 'pointer' }}>
                    {STAGES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Shipped via"><input value={shippedVia} onChange={e => { setDirty(true); setShippedVia(e.target.value) }} placeholder="FedEx / UPS…" style={inp} /></Field>
                <Field label="Tracking → customer"><input value={trackingCust} onChange={e => { setDirty(true); setTrackingCust(e.target.value) }} placeholder="Tracking #" style={inp} /></Field>
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: '#64748b' }}>Buy total so far: <b style={{ color: '#0f172a' }}>{money(buyTotal)}</b> · Margin: <b style={{ color: sellTotal - buyTotal >= 0 ? '#10b981' : '#ef4444' }}>{money(sellTotal - buyTotal)}</b></div>
            </div>

            {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#dc2626', marginTop: 14 }}>⚠ {error}</div>}
          </div>
        )}

        {/* Footer actions */}
        {order && (
          <div style={{ borderTop: '1px solid #f1f5f9', padding: '14px 24px', display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowPO(true)} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#0f172a', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>🧾 Generate PO</button>
              <button onClick={() => setShowInvoice(true)} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#0f172a', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>📄 Generate Invoice</button>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={attemptClose} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button onClick={() => save(undefined)} disabled={saving} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#0f172a', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Save'}</button>
            {order.vendor_complete
              ? <button onClick={() => save(false)} disabled={saving} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: '#f59e0b', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Reopen</button>
              : <button onClick={() => save(true)} disabled={saving} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: BRAND, color: '#062b29', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Save & Mark Complete</button>}
            </div>
          </div>
        )}
      </div>
      {showInvoice && <InvoiceModal orderId={id} user={user} onClose={() => setShowInvoice(false)} />}
      {showPO && <POModal orderId={id} user={user} onClose={() => setShowPO(false)} />}
    </div>,
    document.body
  )
}

// Fill status of an order line-up: how much of the vendor side is done.
const fillState = o => o.item_count > 0 && o.items_filled >= o.item_count ? 'filled' : o.items_filled > 0 ? 'partial' : 'unfilled'
const FILL_OPTS = [{ key: 'all', label: 'All fill states' }, { key: 'unfilled', label: 'Unfilled' }, { key: 'partial', label: 'Partially filled' }, { key: 'filled', label: 'Fully filled' }]
const stageOf = o => o.fulfillment_status || 'Awaiting PO'

const selStyle = { ...inp, width: 'auto', minWidth: 0, cursor: 'pointer', padding: '8px 28px 8px 11px', appearance: 'none', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2364748b\' stroke-width=\'3\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 9px center' }

// Buyer order-table columns. Order/Customer locked (always shown); the last four are opt-in via the picker.
// `sortKey` (when present) wires the header into the existing sort state. `td` renders the cell.
const td = { padding: '11px 16px', whiteSpace: 'nowrap' }
const BUYER_COLS = [
  { key: 'order', label: 'Order', locked: true, sortKey: 'order_number', tdStyle: { ...td, fontFamily: 'monospace', fontSize: 12, color: '#475569' }, render: o => o.order_number },
  { key: 'customer', label: 'Customer', locked: true, sortKey: 'customer_name', tdStyle: { padding: '11px 16px', fontWeight: 600, color: '#0f172a' }, render: o => o.customer_name || '—' },
  { key: 'rep', label: 'Rep', sortKey: 'rep', tdStyle: { ...td, color: '#64748b' }, render: o => o.rep || '—' },
  { key: 'items', label: 'Items', sortKey: 'fill', tdStyle: { ...td, color: '#64748b' }, render: o => <span><span style={{ color: o.items_filled >= o.item_count && o.item_count > 0 ? '#10b981' : '#f59e0b', fontWeight: 700 }}>{o.items_filled}</span>/{o.item_count}</span> },
  { key: 'sell', label: 'Sell', sortKey: 'order_amount', align: 'right', tdStyle: { ...td, color: '#0f172a', fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }, render: o => money(o.order_amount) },
  { key: 'stage', label: 'Stage', sortKey: 'stage', tdStyle: { padding: '11px 16px' }, render: o => <StageBadge stage={o.fulfillment_status} /> },
  { key: 'source', label: 'Source', tdStyle: { ...td, color: '#64748b' }, render: o => o.lead_source || '—' },
  { key: 'sourced', label: 'Sourced By', tdStyle: { ...td, color: '#64748b' }, render: o => o.buyer || '—' },
  { key: 'carrier', label: 'Carrier', tdStyle: { ...td, color: '#64748b' }, render: o => o.shipped_via || '—' },
  { key: 'tracking', label: 'Tracking #', tdStyle: { ...td, color: '#64748b', fontFamily: 'monospace', fontSize: 12 }, render: o => o.tracking_to_customer || '—' },
]
const BUYER_DEFAULT_HIDDEN = ['source', 'sourced', 'carrier', 'tracking']

// ── Dashboard ───────────────────────────────────────────────────────────────
export default function BuyerDashboard() {
  const { user } = useAuth()
  const [scope, setScope] = useState('todo')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [suppliers, setSuppliers] = useState([])
  const [editId, setEditId] = useState(null)
  // Filter / search / sort state (all client-side over the loaded scope).
  const [q, setQ] = useState('')
  const [stageF, setStageF] = useState('all')
  const [repF, setRepF] = useState('all')
  const [fillF, setFillF] = useState('all')
  const [sort, setSort] = useState({ key: null, dir: 'asc' }) // null → server order (newest first)
  const { visibleColumns, hidden, toggle, reset } = useColumnPrefs('buyer-orders', BUYER_COLS, BUYER_DEFAULT_HIDDEN)

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

  // Distinct reps present in the current scope, for the Rep filter dropdown.
  const reps = useMemo(() => [...new Set(orders.map(o => o.rep).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [orders])
  // Stages actually present, so we don't offer empty filter options.
  const stagesPresent = useMemo(() => STAGES.filter(s => orders.some(o => stageOf(o) === s)), [orders])

  const toggleSort = key => setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let list = orders.filter(o => {
      if (stageF !== 'all' && stageOf(o) !== stageF) return false
      if (repF !== 'all' && (o.rep || '') !== repF) return false
      if (fillF !== 'all' && fillState(o) !== fillF) return false
      if (needle) {
        const hay = [o.order_number, o.customer_name, o.rep, o.buyer, o.lead_source, o.tracking_to_customer, o.shipped_via].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
    if (sort.key) {
      const dir = sort.dir === 'asc' ? 1 : -1
      const val = o => {
        switch (sort.key) {
          case 'order_number': return o.order_number || ''
          case 'customer_name': return (o.customer_name || '').toLowerCase()
          case 'rep': return (o.rep || '').toLowerCase()
          case 'fill': return o.item_count ? o.items_filled / o.item_count : -1
          case 'order_amount': return Number(o.order_amount) || 0
          case 'stage': return STAGES.indexOf(stageOf(o))
          default: return ''
        }
      }
      list = [...list].sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * dir })
    }
    return list
  }, [orders, q, stageF, repF, fillF, sort])

  const filtersActive = q.trim() || stageF !== 'all' || repF !== 'all' || fillF !== 'all'
  const clearFilters = () => { setQ(''); setStageF('all'); setRepF('all'); setFillF('all') }
  // Reset filters that no longer make sense when the scope changes.
  useEffect(() => { clearFilters(); setSort({ key: null, dir: 'asc' }) }, [scope])

  const SortHead = ({ label, sk, align }) => (
    <th onClick={sk ? () => toggleSort(sk) : undefined}
      style={{ textAlign: align || 'left', padding: '11px 16px', fontSize: 11, fontWeight: 700, color: sort.key === sk ? '#0f172a' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', cursor: sk ? 'pointer' : 'default', userSelect: 'none' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexDirection: align === 'right' ? 'row-reverse' : 'row' }}>
        {label}
        {sk && (sort.key === sk ? (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} style={{ opacity: 0.35 }} />)}
      </span>
    </th>
  )

  return (
    <div className="page-wrap" style={{ maxWidth: 1200 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div className="mb-6">
        <h1 className="font-display font-extrabold text-2xl text-ink-900">{greeting()}, {user.name} 👋</h1>
        <p className="text-ink-400 text-sm mt-1">Vendor & fulfillment — fill the supplier side of closed-won orders and track shipments.</p>
      </div>

      {/* Stat tiles — click to jump to that scope */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Awaiting Vendor Info', scope: 'todo', value: stats?.todo, color: '#ef4444', Icon: ClipboardList },
          { label: 'In Transit', scope: 'transit', value: stats?.transit, color: '#6366f1', Icon: Truck },
          { label: 'Delivered', scope: 'delivered', value: stats?.delivered, color: '#10b981', Icon: CheckCircle2 },
        ].map(s => {
          const active = scope === s.scope
          return (
            <button key={s.label} onClick={() => setScope(s.scope)} aria-pressed={active}
              style={{ textAlign: 'left', background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.06)', padding: '18px 20px', cursor: 'pointer', transition: 'box-shadow .15s, transform .15s',
                boxShadow: active ? `0 0 0 2px ${s.color}, 0 6px 16px ${s.color}22` : '0 2px 8px rgba(0,0,0,0.04)' }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.08)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <s.Icon size={14} style={{ color: s.color }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</span>
                </div>
                {active && <span style={{ fontSize: 10, fontWeight: 800, color: s.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Viewing</span>}
              </div>
              <div style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontSize: 40, fontWeight: 900, lineHeight: 1, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.value ?? '—'}</div>
            </button>
          )
        })}
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

      {/* Toolbar — search + filters (hidden until there's something to filter) */}
      {!loading && orders.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search order #, customer, rep, tracking…"
              style={{ ...inp, paddingLeft: 34, paddingRight: q ? 32 : 11, borderRadius: 100 }} />
            {q && <button onClick={() => setQ('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: '#f1f5f9', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}><X size={12} /></button>}
          </div>
          {/* Stage filter */}
          <select value={stageF} onChange={e => setStageF(e.target.value)} style={selStyle} title="Filter by stage">
            <option value="all">All stages</option>
            {stagesPresent.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {/* Rep filter */}
          {reps.length > 1 && (
            <select value={repF} onChange={e => setRepF(e.target.value)} style={selStyle} title="Filter by rep">
              <option value="all">All reps</option>
              {reps.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          )}
          {/* Fill-status filter */}
          <select value={fillF} onChange={e => setFillF(e.target.value)} style={selStyle} title="Filter by vendor-fill status">
            {FILL_OPTS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          {filtersActive && (
            <button onClick={clearFilters} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: 100, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              <X size={13} /> Clear
            </button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {filtersActive ? `${filtered.length} of ${orders.length}` : `${orders.length} order${orders.length === 1 ? '' : 's'}`}
            </span>
            <ColumnPicker columns={BUYER_COLS} hidden={hidden} toggle={toggle} reset={reset} />
          </div>
        </div>
      )}

      {/* Orders */}
      {loading ? <Loader /> : orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', fontSize: 14, background: '#fff', borderRadius: 16, border: '1px solid #f1f5f9' }}>
          {scope === 'todo' ? 'All caught up — no orders awaiting vendor info 🎉' : 'Nothing here yet.'}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 50, color: '#94a3b8', fontSize: 14, background: '#fff', borderRadius: 16, border: '1px solid #f1f5f9' }}>
          <SlidersHorizontal size={22} style={{ opacity: 0.4, marginBottom: 8 }} />
          <div>No orders match these filters.</div>
          <button onClick={clearFilters} style={{ marginTop: 12, padding: '7px 16px', borderRadius: 100, border: 'none', background: BRAND, color: '#062b29', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Clear filters</button>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {visibleColumns.map(c => <SortHead key={c.key} label={c.label} sk={c.sortKey} align={c.align} />)}
                <th style={{ borderBottom: '2px solid #e2e8f0' }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((o, i) => (
                <tr key={o.id} onClick={() => setEditId(o.id)} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 ? '#fafbfc' : '#fff', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = `${BRAND}08`}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 ? '#fafbfc' : '#fff'}>
                  {visibleColumns.map(c => <td key={c.key} style={c.tdStyle}>{c.render(o)}</td>)}
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
