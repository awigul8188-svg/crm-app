import { useState, useEffect, useCallback } from 'react'
import { operationsApi } from '../api'
import Modal from '../components/Modal'
import { Search, Plus, Edit2, Trash2, Package, Users, Truck, RotateCcw, ChevronRight, X, AlertCircle } from 'lucide-react'

const BRAND = '#00D4C8'

const ORDER_STATUSES   = ['Order placed', 'In Process', 'Shipped to US', 'Received in US', 'Shipped to customer', 'Delivered', 'Refunded']
const LEAD_SOURCES     = ['Chat Lead', 'Email Lead', 'Call Lead', 'RFQ', 'RFQ Lead', 'Repeat', 'Outbound', 'PPC', 'Online', 'Chat']
const PAYMENT_STATUSES = ['CC Charged', 'Wire Received', 'Net']
const SHIPPED_VIA      = ['FedEx', 'UPS', 'USPS', 'Customer Account']
const RMA_STATUSES     = ['Initiated', 'In Review', 'Approved', 'Denied', 'Completed']
const PAYMENT_METHODS  = ['Pending', 'Wire Transferred', 'Paid via CC', 'Paid via PayPal', 'Net']
const CONDITIONS       = ['New', 'Refurbished', 'Used', 'Open Box', 'REF']
const REPS             = ['Ethan', 'Eddie', 'Ryan', 'Justin', 'Hector', 'Aman', 'Online']
const BUYERS           = ['Danny', 'Samit', 'Jason', 'Jorge', 'Maqsood']

const STATUS_STYLE = {
  'Order placed':        { bg: '#fef9c3', color: '#a16207' },
  'In Process':          { bg: '#fee2e2', color: '#dc2626' },
  'Shipped to US':       { bg: '#dbeafe', color: '#1d4ed8' },
  'Received in US':      { bg: '#ede9fe', color: '#6d28d9' },
  'Shipped to customer': { bg: '#d1fae5', color: '#065f46' },
  'Delivered':           { bg: '#ecfdf5', color: '#059669' },
  'Refunded':            { bg: '#fde8d8', color: '#9a3412' },
}

const RMA_STATUS_STYLE = {
  'Initiated': { bg: '#dbeafe', color: '#1d4ed8' },
  'In Review': { bg: '#fef9c3', color: '#a16207' },
  'Approved':  { bg: '#d1fae5', color: '#065f46' },
  'Denied':    { bg: '#fee2e2', color: '#dc2626' },
  'Completed': { bg: '#f1f5f9', color: '#475569' },
}

function fmt(n) { return n == null ? '—' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }

function StatusBadge({ status, styleMap }) {
  const s = (styleMap || STATUS_STYLE)[status] || { bg: '#f1f5f9', color: '#64748b' }
  return <span style={{ background: s.bg, color: s.color, borderRadius: 100, fontSize: 11, fontWeight: 700, padding: '3px 10px', whiteSpace: 'nowrap' }}>{status || '—'}</span>
}

function SectionLabel({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <div style={{ width: 3, height: 14, borderRadius: 2, background: BRAND, flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{children}</span>
    </div>
  )
}

function FinCard({ label, value, color }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: 14, padding: '14px 16px', flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || '#0f172a', fontVariantNumeric: 'tabular-nums', fontFamily: '"Bricolage Grotesque", sans-serif' }}>{value}</div>
    </div>
  )
}

function Loader() {
  return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div style={{ width: 28, height: 28, border: '3px solid #e2e8f0', borderTopColor: BRAND, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /></div>
}

function EmptyState({ icon: Icon, label, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '64px 24px' }}>
      <div style={{ width: 52, height: 52, borderRadius: 16, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <Icon size={22} color="#94a3b8" />
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#334155', marginBottom: 6 }}>No {label} found</div>
      <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>Create your first {label.toLowerCase()} to get started.</div>
      {action}
    </div>
  )
}

// ── Order Form ────────────────────────────────────────────────────────────────
function OrderForm({ order, customers, onSave, onClose }) {
  const blank = { order_number: '', order_date: new Date().toISOString().slice(0,10), customer_id: '', email: '',
    lead_source: '', rep: '', ppc_order_rep: '', buyer: '', payment_status: '', order_status: 'Order placed', due_date: '',
    tax_charged: '', shipping_charged: '', cc_charges: '', customer_paid: '', rma_amount: '', shipped_via: '',
    tracking_to_customer: '', notes: '' }
  const [form, setForm] = useState(order ? { ...blank, ...order, customer_id: order.customer_id || '', due_date: order.due_date?.slice(0,10)||'', order_date: order.order_date?.slice(0,10)||'', rma_amount: order.rma_amount||'' } : blank)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.order_number.trim()) { setErr('Order number is required'); return }
    setSaving(true); setErr('')
    try {
      const saved = order ? await operationsApi.updateOrder(order.id, form) : await operationsApi.createOrder(form)
      onSave(saved)
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  const F = ({ label, children, half }) => (
    <div style={{ flex: half ? '0 0 calc(50% - 6px)' : '1 1 100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</label>
      {children}
    </div>
  )

  return (
    <Modal title={order ? `Edit ${order.order_number}` : 'New Order'} onClose={onClose} wide>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <F label="Order Number"><input className="input" value={form.order_number} onChange={e => set('order_number', e.target.value)} placeholder="TA001234" /></F>
        <F label="Order Date" half><input className="input" type="date" value={form.order_date} onChange={e => set('order_date', e.target.value)} /></F>
        <F label="Due Date" half><input className="input" type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} /></F>

        <F label="Customer">
          <select className="input" value={form.customer_id} onChange={e => set('customer_id', e.target.value)}>
            <option value="">— select customer —</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </F>
        <F label="Email"><input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="customer@email.com" /></F>

        <F label="Lead Source" half>
          <select className="input" value={form.lead_source} onChange={e => set('lead_source', e.target.value)}>
            <option value="">—</option>
            {LEAD_SOURCES.map(s => <option key={s}>{s}</option>)}
          </select>
        </F>
        <F label="Rep" half>
          <select className="input" value={form.rep} onChange={e => set('rep', e.target.value)}>
            <option value="">—</option>
            {REPS.map(r => <option key={r}>{r}</option>)}
          </select>
        </F>

        <F label="PPC Order Rep" half>
          <select className="input" value={form.ppc_order_rep} onChange={e => set('ppc_order_rep', e.target.value)}>
            <option value="">—</option>
            {REPS.filter(r => r !== 'Online').map(r => <option key={r}>{r}</option>)}
          </select>
        </F>
        <F label="Buyer" half>
          <select className="input" value={form.buyer} onChange={e => set('buyer', e.target.value)}>
            <option value="">—</option>
            {BUYERS.map(b => <option key={b}>{b}</option>)}
          </select>
        </F>

        <F label="Order Status" half>
          <select className="input" value={form.order_status} onChange={e => set('order_status', e.target.value)}>
            {ORDER_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </F>
        <F label="Payment Status" half>
          <select className="input" value={form.payment_status} onChange={e => set('payment_status', e.target.value)}>
            <option value="">—</option>
            {PAYMENT_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </F>

        <div style={{ flex: '1 1 100%', borderTop: '1px solid #f1f5f9', paddingTop: 12 }} />

        <F label="Tax Charged ($)" half><input className="input" type="number" value={form.tax_charged} onChange={e => set('tax_charged', e.target.value)} placeholder="0.00" /></F>
        <F label="Shipping Charged ($)" half><input className="input" type="number" value={form.shipping_charged} onChange={e => set('shipping_charged', e.target.value)} placeholder="0.00" /></F>
        <F label="CC Charges ($)" half><input className="input" type="number" value={form.cc_charges} onChange={e => set('cc_charges', e.target.value)} placeholder="0.00" /></F>
        <F label="Customer Paid ($)" half><input className="input" type="number" value={form.customer_paid} onChange={e => set('customer_paid', e.target.value)} placeholder="0.00" /></F>
        <F label="RMA Amount ($)" half><input className="input" type="number" value={form.rma_amount} onChange={e => set('rma_amount', e.target.value)} placeholder="0.00" /></F>

        <div style={{ flex: '1 1 100%', borderTop: '1px solid #f1f5f9', paddingTop: 12 }} />

        <F label="Shipped Via" half>
          <select className="input" value={form.shipped_via} onChange={e => set('shipped_via', e.target.value)}>
            <option value="">—</option>
            {SHIPPED_VIA.map(s => <option key={s}>{s}</option>)}
          </select>
        </F>
        <F label="Tracking to Customer" half><input className="input" value={form.tracking_to_customer} onChange={e => set('tracking_to_customer', e.target.value)} placeholder="1Z999..." /></F>

        <F label="Notes"><textarea className="input" value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Internal notes..." style={{ resize: 'vertical' }} /></F>
      </div>

      {err && <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginTop: 12 }}>{err}</div>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : order ? 'Save Changes' : 'Create Order'}</button>
      </div>
    </Modal>
  )
}

// ── Order Item Form ───────────────────────────────────────────────────────────
function ItemForm({ item, orderId, suppliers, onSave, onClose }) {
  const blank = { part_number: '', description: '', product: '', supplier_id: '', quantity: 1,
    product_condition: '', selling: '', buying: '', cc_paid: '', tax_paid: '', shipping_paid: '',
    duty_paid: '', paid_to_supplier: '', payment_method: '', payment_due: '',
    tracking_to_warehouse: '', ta_po_number: '', serials: '' }
  const [form, setForm] = useState(item ? { ...blank, ...item, supplier_id: item.supplier_id||'', payment_due: item.payment_due?.slice(0,10)||'' } : blank)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true); setErr('')
    try {
      const saved = item ? await operationsApi.updateItem(item.id, form) : await operationsApi.addItem(orderId, form)
      onSave(saved)
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  const F = ({ label, children, half, third }) => (
    <div style={{ flex: third ? '0 0 calc(33.33% - 8px)' : half ? '0 0 calc(50% - 6px)' : '1 1 100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</label>
      {children}
    </div>
  )

  const totalSelling = (Number(form.selling)||0) * (Number(form.quantity)||0)
  const totalBuying  = (Number(form.buying)||0) * (Number(form.quantity)||0)
    + (Number(form.cc_paid)||0) + (Number(form.tax_paid)||0) + (Number(form.shipping_paid)||0) + (Number(form.duty_paid)||0)

  return (
    <Modal title={item ? 'Edit Line Item' : 'Add Line Item'} onClose={onClose} wide>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <F label="Part Number" half><input className="input" value={form.part_number} onChange={e => set('part_number', e.target.value)} placeholder="ABC-123" /></F>
        <F label="Quantity" half><input className="input" type="number" value={form.quantity} onChange={e => set('quantity', e.target.value)} min="1" /></F>
        <F label="Description"><input className="input" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Product description" /></F>

        <F label="Supplier" half>
          <select className="input" value={form.supplier_id} onChange={e => set('supplier_id', e.target.value)}>
            <option value="">— select supplier —</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.company}</option>)}
          </select>
        </F>
        <F label="Condition" half>
          <select className="input" value={form.product_condition} onChange={e => set('product_condition', e.target.value)}>
            <option value="">—</option>
            {CONDITIONS.map(c => <option key={c}>{c}</option>)}
          </select>
        </F>

        <div style={{ flex: '1 1 100%', borderTop: '1px solid #f1f5f9', paddingTop: 12 }} />

        <F label="Selling ($/unit)" third><input className="input" type="number" value={form.selling} onChange={e => set('selling', e.target.value)} placeholder="0.00" /></F>
        <F label="Buying ($/unit)" third><input className="input" type="number" value={form.buying} onChange={e => set('buying', e.target.value)} placeholder="0.00" /></F>
        <F label="Paid to Supplier ($)" third><input className="input" type="number" value={form.paid_to_supplier} onChange={e => set('paid_to_supplier', e.target.value)} placeholder="0.00" /></F>

        <F label="CC Paid ($)" third><input className="input" type="number" value={form.cc_paid} onChange={e => set('cc_paid', e.target.value)} placeholder="0.00" /></F>
        <F label="Tax Paid ($)" third><input className="input" type="number" value={form.tax_paid} onChange={e => set('tax_paid', e.target.value)} placeholder="0.00" /></F>
        <F label="Shipping Paid ($)" third><input className="input" type="number" value={form.shipping_paid} onChange={e => set('shipping_paid', e.target.value)} placeholder="0.00" /></F>
        <F label="Duty Paid ($)" third><input className="input" type="number" value={form.duty_paid} onChange={e => set('duty_paid', e.target.value)} placeholder="0.00" /></F>
        <F label="Payment Method" third>
          <select className="input" value={form.payment_method} onChange={e => set('payment_method', e.target.value)}>
            <option value="">—</option>
            {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
          </select>
        </F>
        <F label="Payment Due" third><input className="input" type="date" value={form.payment_due} onChange={e => set('payment_due', e.target.value)} /></F>

        <div style={{ flex: '1 1 100%', borderTop: '1px solid #f1f5f9', paddingTop: 12 }} />

        <F label="TA PO #" half><input className="input" value={form.ta_po_number} onChange={e => set('ta_po_number', e.target.value)} placeholder="PO-000" /></F>
        <F label="Tracking to Warehouse" half><input className="input" value={form.tracking_to_warehouse} onChange={e => set('tracking_to_warehouse', e.target.value)} placeholder="1Z999..." /></F>
        <F label="Serial Numbers"><textarea className="input" value={form.serials} onChange={e => set('serials', e.target.value)} rows={2} placeholder="One per line..." style={{ resize: 'vertical' }} /></F>
      </div>

      {(totalSelling > 0 || totalBuying > 0) && (
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <FinCard label="Total Selling" value={fmt(totalSelling)} color={BRAND} />
          <FinCard label="Total Buying"  value={fmt(totalBuying)}  color="#64748b" />
          <FinCard label="Margin"        value={fmt(totalSelling - totalBuying)} color={totalSelling - totalBuying >= 0 ? '#10b981' : '#ef4444'} />
        </div>
      )}

      {err && <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginTop: 12 }}>{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : item ? 'Save Changes' : 'Add Item'}</button>
      </div>
    </Modal>
  )
}

// ── Order Detail Modal ────────────────────────────────────────────────────────
function OrderDetail({ orderId, customers, suppliers, onClose, onUpdated }) {
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editOrder, setEditOrder] = useState(false)
  const [addItem, setAddItem] = useState(false)
  const [editItem, setEditItem] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { const o = await operationsApi.getOrder(orderId); setOrder(o) }
    catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [orderId])

  useEffect(() => { load() }, [load])

  const handleDeleteItem = async (id) => {
    if (!confirm('Delete this line item?')) return
    await operationsApi.deleteItem(id)
    load(); onUpdated && onUpdated()
  }

  if (!order && loading) return (
    <Modal title="Loading…" onClose={onClose} wide><Loader /></Modal>
  )
  if (!order) return null

  const gp       = Number(order.gp)       || 0
  const remaining = Number(order.remaining) || 0

  return (
    <>
      <Modal title={`Order ${order.order_number}`} onClose={onClose} wide>
        {loading && <div style={{ position: 'absolute', top: 12, right: 60, fontSize: 11, color: '#94a3b8' }}>Refreshing…</div>}

        {/* Status + actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <StatusBadge status={order.order_status} />
            {order.payment_status && <StatusBadge status={order.payment_status} styleMap={{ [order.payment_status]: { bg: '#dbeafe', color: '#1d4ed8' } }} />}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setEditOrder(true)}><Edit2 size={13} /> Edit Order</button>
        </div>

        {/* Financial summary */}
        <SectionLabel>Financials</SectionLabel>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
          <FinCard label="Order Amount"   value={fmt(order.order_amount)} />
          <FinCard label="Total Value"    value={fmt(order.total_order_value)} />
          <FinCard label="Total Buying"   value={fmt(order.total_buying)} color="#64748b" />
          <FinCard label="GP"             value={fmt(gp)}        color={gp >= 0 ? '#10b981' : '#ef4444'} />
          <FinCard label="Customer Paid"  value={fmt(order.customer_paid)} color={BRAND} />
          <FinCard label="Remaining"      value={fmt(remaining)} color={remaining > 0 ? '#f59e0b' : '#10b981'} />
        </div>

        {/* Order details */}
        <SectionLabel>Details</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', marginBottom: 24, fontSize: 13 }}>
          {[
            ['Customer',    order.customer_name || order.email || '—'],
            ['Order Date',  fmtDate(order.order_date)],
            ['Due Date',    fmtDate(order.due_date)],
            ['Rep',         order.rep || '—'],
            ['Lead Source', order.lead_source || '—'],
            ['Shipped Via', order.shipped_via || '—'],
            ['Tracking',    order.tracking_to_customer || '—'],
            ['Tax Charged', fmt(order.tax_charged)],
            ['Ship Charged',fmt(order.shipping_charged)],
            ['CC Charges',  fmt(order.cc_charges)],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f8fafc' }}>
              <span style={{ color: '#94a3b8', fontWeight: 600 }}>{k}</span>
              <span style={{ color: '#0f172a', fontWeight: 500, textAlign: 'right', maxWidth: '60%', wordBreak: 'break-word' }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Line items */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <SectionLabel>Line Items ({order.items?.length || 0})</SectionLabel>
          <button className="btn btn-primary btn-sm" onClick={() => setAddItem(true)}><Plus size={13} /> Add Item</button>
        </div>

        {order.items?.length > 0 ? (
          <div style={{ overflowX: 'auto', marginBottom: 24 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Part #', 'Description', 'Qty', 'Condition', 'Supplier', 'Selling', 'Buying', 'Total Sell', 'Total Buy', 'Paid', 'Tracking', ''].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {order.items.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600, color: '#0f172a' }}>{item.part_number || '—'}</td>
                    <td style={{ padding: '8px 10px', color: '#475569', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description || '—'}</td>
                    <td style={{ padding: '8px 10px' }}>{item.quantity}</td>
                    <td style={{ padding: '8px 10px', color: '#64748b' }}>{item.product_condition || '—'}</td>
                    <td style={{ padding: '8px 10px', color: '#64748b' }}>{item.supplier_name || '—'}</td>
                    <td style={{ padding: '8px 10px' }}>{fmt(item.selling)}</td>
                    <td style={{ padding: '8px 10px', color: '#64748b' }}>{fmt(item.buying)}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 600, color: BRAND }}>{fmt(item.total_selling)}</td>
                    <td style={{ padding: '8px 10px', color: '#64748b' }}>{fmt(item.total_buying)}</td>
                    <td style={{ padding: '8px 10px' }}>{fmt(item.paid_to_supplier)}</td>
                    <td style={{ padding: '8px 10px', color: '#64748b', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.tracking_to_warehouse || '—'}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px' }} onClick={() => setEditItem(item)}><Edit2 size={11} /></button>
                        <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', color: '#ef4444' }} onClick={() => handleDeleteItem(item.id)}><Trash2 size={11} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px', background: '#f8fafc', borderRadius: 12, marginBottom: 24, color: '#94a3b8', fontSize: 13 }}>
            No line items yet. Add items to track parts, buying costs, and margins.
          </div>
        )}

        {/* RMAs */}
        {order.rmas?.length > 0 && (
          <>
            <SectionLabel>RMAs ({order.rmas.length})</SectionLabel>
            {order.rmas.map(r => (
              <div key={r.id} style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', marginBottom: 8, fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: '#dc2626' }}>{r.rma_number}</span>
                <StatusBadge status={r.rma_status} styleMap={RMA_STATUS_STYLE} />
                <span style={{ color: '#64748b' }}>Refund: {fmt(r.refund_issued)}</span>
                <span style={{ color: '#64748b' }}>{fmtDate(r.rma_issue_date)}</span>
              </div>
            ))}
          </>
        )}

        {/* Notes */}
        {order.notes && (
          <>
            <SectionLabel>Notes</SectionLabel>
            <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#475569', whiteSpace: 'pre-wrap' }}>{order.notes}</div>
          </>
        )}
      </Modal>

      {editOrder && (
        <OrderForm order={order} customers={customers} onClose={() => setEditOrder(false)}
          onSave={() => { setEditOrder(false); load(); onUpdated && onUpdated() }} />
      )}
      {addItem && (
        <ItemForm orderId={order.id} suppliers={suppliers} onClose={() => setAddItem(false)}
          onSave={() => { setAddItem(false); load(); onUpdated && onUpdated() }} />
      )}
      {editItem && (
        <ItemForm item={editItem} orderId={order.id} suppliers={suppliers} onClose={() => setEditItem(null)}
          onSave={() => { setEditItem(null); load(); onUpdated && onUpdated() }} />
      )}
    </>
  )
}

// ── Orders Tab ────────────────────────────────────────────────────────────────
function OrdersTab() {
  const [orders, setOrders]       = useState([])
  const [customers, setCustomers] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState('')
  const [selected, setSelected]   = useState(null)
  const [showForm, setShowForm]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [o, c, s] = await Promise.all([
        operationsApi.getOrders({ search, status: statusFilter }),
        operationsApi.getCustomers(),
        operationsApi.getSuppliers(),
      ])
      setOrders(o); setCustomers(c); setSuppliers(s)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [search, statusFilter])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id) => {
    if (!confirm('Delete this order and all its line items?')) return
    await operationsApi.deleteOrder(id); load()
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="search-wrap" style={{ flex: 1, minWidth: 200 }}>
          <Search size={14} className="search-icon" />
          <input className="input" placeholder="Search order #, customer, email…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input" style={{ width: 180 }} value={statusFilter} onChange={e => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {ORDER_STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={15} /> New Order</button>
      </div>

      {loading ? <Loader /> : orders.length === 0 ? (
        <EmptyState icon={Package} label="Orders" action={<button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={14} /> New Order</button>} />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr className="table-header">
                {['Order #', 'Date', 'Customer', 'Rep', 'Status', 'Order Amt', 'Total Value', 'GP', 'Remaining', ''].map(h => (
                  <th key={h} className="table-cell" style={{ whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map(o => {
                const gp  = Number(o.gp) || 0
                const rem = Number(o.remaining) || 0
                return (
                  <tr key={o.id} className="table-row" style={{ cursor: 'pointer' }} onClick={() => setSelected(o.id)}>
                    <td className="table-cell" style={{ fontWeight: 700, color: BRAND }}>{o.order_number}</td>
                    <td className="table-cell" style={{ color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(o.order_date)}</td>
                    <td className="table-cell" style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.customer_name || o.email || '—'}</td>
                    <td className="table-cell" style={{ color: '#64748b' }}>{o.rep || '—'}</td>
                    <td className="table-cell"><StatusBadge status={o.order_status} /></td>
                    <td className="table-cell" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(o.order_amount)}</td>
                    <td className="table-cell" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmt(o.total_order_value)}</td>
                    <td className="table-cell" style={{ fontWeight: 700, color: gp >= 0 ? '#10b981' : '#ef4444', fontVariantNumeric: 'tabular-nums' }}>{fmt(gp)}</td>
                    <td className="table-cell" style={{ color: rem > 0 ? '#f59e0b' : '#10b981', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(rem)}</td>
                    <td className="table-cell" onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setSelected(o.id)}><ChevronRight size={14} /></button>
                        <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => handleDelete(o.id)}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <OrderDetail orderId={selected} customers={customers} suppliers={suppliers}
          onClose={() => setSelected(null)} onUpdated={load} />
      )}
      {showForm && (
        <OrderForm customers={customers} onClose={() => setShowForm(false)}
          onSave={() => { setShowForm(false); load() }} />
      )}
    </div>
  )
}

// ── Simple entity tab (Customers / Suppliers) ─────────────────────────────────
function EntityTab({ icon: Icon, label, fields, fetchFn, createFn, updateFn, deleteFn }) {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [form, setForm]       = useState(null)  // null = closed, {} = new, {...} = edit

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await fetchFn(search)) } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    try {
      if (form.id) await updateFn(form.id, form)
      else await createFn(form)
      setForm(null); load()
    } catch(e) { alert(e.message) }
  }

  const handleDelete = async (id) => {
    if (!confirm(`Delete this ${label.toLowerCase()}?`)) return
    try { await deleteFn(id); load() } catch(e) { alert(e.message) }
  }

  const blankForm = () => {
    const b = {}; fields.forEach(f => { b[f.key] = '' }); setForm(b)
  }

  const primaryField = fields[0]

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <div className="search-wrap" style={{ flex: 1, minWidth: 200 }}>
          <Search size={14} className="search-icon" />
          <input className="input" placeholder={`Search ${label.toLowerCase()}…`} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={blankForm}><Plus size={15} /> Add {label.slice(0,-1)}</button>
      </div>

      {loading ? <Loader /> : rows.length === 0 ? (
        <EmptyState icon={Icon} label={label} action={<button className="btn btn-primary" onClick={blankForm}><Plus size={14} /> Add {label.slice(0,-1)}</button>} />
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr className="table-header">
              {fields.map(f => <th key={f.key} className="table-cell">{f.label}</th>)}
              {rows[0]?.order_count !== undefined && <th className="table-cell">Orders</th>}
              <th className="table-cell"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} className="table-row">
                {fields.map((f, i) => (
                  <td key={f.key} className="table-cell" style={{ fontWeight: i === 0 ? 600 : 400, color: i === 0 ? '#0f172a' : '#475569' }}>{row[f.key] || '—'}</td>
                ))}
                {row.order_count !== undefined && <td className="table-cell"><span style={{ background: '#f1f5f9', color: '#475569', borderRadius: 100, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>{row.order_count}</span></td>}
                <td className="table-cell">
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setForm({ ...row })}><Edit2 size={13} /></button>
                    <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => handleDelete(row.id)}><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {form !== null && (
        <Modal title={form.id ? `Edit ${label.slice(0,-1)}` : `New ${label.slice(0,-1)}`} onClose={() => setForm(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {fields.map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>{f.label}</label>
                {f.textarea
                  ? <textarea className="input" value={form[f.key]||''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} rows={3} style={{ resize: 'vertical' }} />
                  : <input className="input" type={f.type||'text'} value={form[f.key]||''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder||''} />
                }
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>Save</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── RMA Tab ───────────────────────────────────────────────────────────────────
function RMATab() {
  const [rmas, setRmas]         = useState([])
  const [customers, setCustomers] = useState([])
  const [orders, setOrders]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [statusFilter, setStatus] = useState('')
  const [form, setForm]         = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r, c, o] = await Promise.all([
        operationsApi.getRMA({ search, status: statusFilter }),
        operationsApi.getCustomers(),
        operationsApi.getOrders(),
      ])
      setRmas(r); setCustomers(c); setOrders(o)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [search, statusFilter])

  useEffect(() => { load() }, [load])

  const blankForm = { rma_number: `RMA-${Date.now().toString().slice(-6)}`, order_id: '', customer_id: '', email: '',
    return_quantity: 1, return_reason: '', rma_status: 'Open', rma_issue_date: new Date().toISOString().slice(0,10),
    rma_completed_date: '', refund_issued: '', restocking_fee: '', return_tracking_number: '',
    return_shipping_paid: '', notes: '', qb_credit_memo: '' }

  const handleSave = async () => {
    try {
      if (form.id) await operationsApi.updateRMA(form.id, form)
      else await operationsApi.createRMA(form)
      setForm(null); load()
    } catch(e) { alert(e.message) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this RMA?')) return
    await operationsApi.deleteRMA(id); load()
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="search-wrap" style={{ flex: 1, minWidth: 200 }}>
          <Search size={14} className="search-icon" />
          <input className="input" placeholder="Search RMA #, customer, order…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input" style={{ width: 180 }} value={statusFilter} onChange={e => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {RMA_STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <button className="btn btn-primary" onClick={() => setForm(blankForm)}><Plus size={15} /> New RMA</button>
      </div>

      {loading ? <Loader /> : rmas.length === 0 ? (
        <EmptyState icon={RotateCcw} label="RMAs" action={<button className="btn btn-primary" onClick={() => setForm(blankForm)}><Plus size={14} /> New RMA</button>} />
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr className="table-header">
              {['RMA #', 'Order', 'Customer', 'Reason', 'Status', 'Refund', 'Restocking', 'Issue Date', 'QB Memo', ''].map(h => (
                <th key={h} className="table-cell" style={{ whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rmas.map(r => (
              <tr key={r.id} className="table-row">
                <td className="table-cell" style={{ fontWeight: 700, color: '#dc2626' }}>{r.rma_number}</td>
                <td className="table-cell" style={{ color: BRAND, fontWeight: 600 }}>{r.order_number || '—'}</td>
                <td className="table-cell">{r.customer_name || r.email || '—'}</td>
                <td className="table-cell" style={{ color: '#64748b', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.return_reason || '—'}</td>
                <td className="table-cell"><StatusBadge status={r.rma_status} styleMap={RMA_STATUS_STYLE} /></td>
                <td className="table-cell" style={{ color: '#dc2626', fontWeight: 600 }}>{fmt(r.refund_issued)}</td>
                <td className="table-cell" style={{ color: '#64748b' }}>{fmt(r.restocking_fee)}</td>
                <td className="table-cell" style={{ color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(r.rma_issue_date)}</td>
                <td className="table-cell" style={{ color: '#64748b' }}>{r.qb_credit_memo || '—'}</td>
                <td className="table-cell">
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setForm({ ...r, rma_issue_date: r.rma_issue_date?.slice(0,10)||'', rma_completed_date: r.rma_completed_date?.slice(0,10)||'' })}><Edit2 size={13} /></button>
                    <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => handleDelete(r.id)}><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {form !== null && (
        <Modal title={form.id ? `Edit ${form.rma_number}` : 'New RMA'} onClose={() => setForm(null)} wide>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {[
              { label: 'RMA Number', key: 'rma_number', half: false },
            ].map(({ label, key, half }) => (
              <div key={key} style={{ flex: half ? '0 0 calc(50% - 6px)' : '1 1 100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</label>
                <input className="input" value={form[key]||''} onChange={e => set(key, e.target.value)} />
              </div>
            ))}

            <div style={{ flex: '0 0 calc(50% - 6px)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Order</label>
              <select className="input" value={form.order_id||''} onChange={e => set('order_id', e.target.value)}>
                <option value="">— select order —</option>
                {orders.map(o => <option key={o.id} value={o.id}>{o.order_number}</option>)}
              </select>
            </div>
            <div style={{ flex: '0 0 calc(50% - 6px)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Customer</label>
              <select className="input" value={form.customer_id||''} onChange={e => set('customer_id', e.target.value)}>
                <option value="">— select customer —</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div style={{ flex: '0 0 calc(50% - 6px)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>RMA Status</label>
              <select className="input" value={form.rma_status} onChange={e => set('rma_status', e.target.value)}>
                {RMA_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ flex: '0 0 calc(50% - 6px)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Return Qty</label>
              <input className="input" type="number" value={form.return_quantity} onChange={e => set('return_quantity', e.target.value)} min="1" />
            </div>

            <div style={{ flex: '0 0 calc(50% - 6px)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Issue Date</label>
              <input className="input" type="date" value={form.rma_issue_date} onChange={e => set('rma_issue_date', e.target.value)} />
            </div>
            <div style={{ flex: '0 0 calc(50% - 6px)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Completed Date</label>
              <input className="input" type="date" value={form.rma_completed_date} onChange={e => set('rma_completed_date', e.target.value)} />
            </div>

            <div style={{ flex: '0 0 calc(50% - 6px)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Refund Issued ($)</label>
              <input className="input" type="number" value={form.refund_issued} onChange={e => set('refund_issued', e.target.value)} placeholder="0.00" />
            </div>
            <div style={{ flex: '0 0 calc(50% - 6px)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Restocking Fee ($)</label>
              <input className="input" type="number" value={form.restocking_fee} onChange={e => set('restocking_fee', e.target.value)} placeholder="0.00" />
            </div>

            <div style={{ flex: '0 0 calc(50% - 6px)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Return Tracking #</label>
              <input className="input" value={form.return_tracking_number||''} onChange={e => set('return_tracking_number', e.target.value)} />
            </div>
            <div style={{ flex: '0 0 calc(50% - 6px)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Return Shipping Paid ($)</label>
              <input className="input" type="number" value={form.return_shipping_paid} onChange={e => set('return_shipping_paid', e.target.value)} placeholder="0.00" />
            </div>

            <div style={{ flex: '0 0 calc(50% - 6px)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>QB Credit Memo #</label>
              <input className="input" value={form.qb_credit_memo||''} onChange={e => set('qb_credit_memo', e.target.value)} />
            </div>
            <div style={{ flex: '1 1 100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Return Reason</label>
              <input className="input" value={form.return_reason||''} onChange={e => set('return_reason', e.target.value)} />
            </div>
            <div style={{ flex: '1 1 100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Notes</label>
              <textarea className="input" value={form.notes||''} onChange={e => set('notes', e.target.value)} rows={3} style={{ resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>Save</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Main Operations Page ──────────────────────────────────────────────────────
export default function Operations() {
  const [tab, setTab] = useState('orders')
  const [stats, setStats] = useState(null)

  useEffect(() => {
    operationsApi.getStats().then(setStats).catch(() => {})
  }, [])

  const tabs = [
    { key: 'orders',    label: 'Orders',    icon: Package },
    { key: 'customers', label: 'Customers', icon: Users },
    { key: 'suppliers', label: 'Suppliers', icon: Truck },
    { key: 'rma',       label: 'RMA',       icon: RotateCcw },
  ]

  return (
    <div className="page-wrap fade-in">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', fontFamily: '"Bricolage Grotesque", sans-serif', margin: 0 }}>Operations</h1>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '4px 0 0' }}>Order management · Customers · Suppliers · RMA</p>
        </div>
        {stats && (
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { label: 'Total Orders', value: stats.total_orders, color: '#0f172a' },
              { label: 'In Process',   value: stats.in_process,   color: '#f59e0b' },
              { label: 'Open RMA',     value: stats.open_rma,     color: '#ef4444' },
              { label: 'Total GP',     value: fmt(stats.total_gp), color: '#10b981' },
            ].map(s => (
              <div key={s.label} style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 14, padding: '10px 16px', textAlign: 'right', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontVariantNumeric: 'tabular-nums', fontFamily: '"Bricolage Grotesque", sans-serif' }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 14, padding: 4, marginBottom: 24, width: 'fit-content' }}>
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.18s',
            background: tab === key ? '#fff' : 'transparent',
            color: tab === key ? BRAND : '#64748b',
            boxShadow: tab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
          }}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #f1f5f9', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        {tab === 'orders' && <OrdersTab />}
        {tab === 'customers' && (
          <EntityTab
            icon={Users} label="Customers"
            fields={[
              { key: 'name',    label: 'Name',    placeholder: 'Customer name' },
              { key: 'email',   label: 'Email',   type: 'email', placeholder: 'email@domain.com' },
              { key: 'phone',   label: 'Phone',   type: 'tel',   placeholder: '+1 555 000 0000' },
              { key: 'address', label: 'Address', textarea: true },
              { key: 'notes',   label: 'Notes',   textarea: true },
            ]}
            fetchFn={operationsApi.getCustomers}
            createFn={operationsApi.createCustomer}
            updateFn={operationsApi.updateCustomer}
            deleteFn={operationsApi.deleteCustomer}
          />
        )}
        {tab === 'suppliers' && (
          <EntityTab
            icon={Truck} label="Suppliers"
            fields={[
              { key: 'company',  label: 'Company',  placeholder: 'Company name' },
              { key: 'rep_name', label: 'Rep Name', placeholder: 'Contact name' },
              { key: 'email',    label: 'Email',    type: 'email', placeholder: 'rep@company.com' },
              { key: 'phone',    label: 'Phone',    type: 'tel',   placeholder: '+1 555 000 0000' },
              { key: 'notes',    label: 'Notes',    textarea: true },
            ]}
            fetchFn={operationsApi.getSuppliers}
            createFn={operationsApi.createSupplier}
            updateFn={operationsApi.updateSupplier}
            deleteFn={operationsApi.deleteSupplier}
          />
        )}
        {tab === 'rma' && <RMATab />}
      </div>
    </div>
  )
}
