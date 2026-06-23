import { useState, useEffect, useCallback, useRef } from 'react'
import { operationsApi, api } from '../api'
import Modal from '../components/Modal'
import ImportModal from '../components/ImportModal'
import { Search, Plus, Edit2, Trash2, Package, Users, Truck, RotateCcw, ChevronRight, X, AlertCircle, List, ClipboardList, Upload } from 'lucide-react'

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

// ── Shared field wrapper (must live outside form components to avoid remount on every keystroke)
function FF({ label, children, half, third, full }) {
  const flex = third ? '0 0 calc(33.33% - 8px)' : half ? '0 0 calc(50% - 6px)' : '1 1 100%'
  return (
    <div style={{ flex, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</label>
      {children}
    </div>
  )
}

// ── Order Form ────────────────────────────────────────────────────────────────
function OrderForm({ order, customers: customersProp, onSave, onClose, isPending }) {
  const blank = { order_number: '', order_date: new Date().toISOString().slice(0,10), customer_id: '', email: '',
    lead_source: '', rep: '', ppc_order_rep: '', buyer: '', payment_status: '', order_status: 'Order placed',
    net: '', due_date: '',
    tax_charged: '', shipping_charged: '', cc_charges: '', customer_paid: '', rma_amount: '', shipped_via: '',
    tracking_to_customer: '', notes: '' }
  const [form, setForm] = useState(order ? { ...blank, ...order, customer_id: order.customer_id || '', due_date: order.due_date?.slice(0,10)||'', order_date: order.order_date?.slice(0,10)||'', rma_amount: order.rma_amount||'', net: order.net||'' } : blank)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // Customer lists
  const [opsCustomers, setOpsCustomers] = useState(customersProp || [])
  const [crmCustomers, setCrmCustomers] = useState([])
  useEffect(() => {
    operationsApi.getCustomers().then(setOpsCustomers).catch(() => {})
    api.getCustomers().then(list => setCrmCustomers(list || [])).catch(() => {})
  }, [])

  // Inline new customer form
  const [addingCustomer, setAddingCustomer] = useState(false)
  const [newCust, setNewCust] = useState({ name: '', email: '', phone: '' })
  const [custSaving, setCustSaving] = useState(false)

  const handleAddCustomer = async () => {
    if (!newCust.name.trim()) return
    setCustSaving(true)
    try {
      const created = await operationsApi.createCustomer(newCust)
      setOpsCustomers(prev => [...prev, created])
      set('customer_id', created.id)
      if (created.email) set('email', created.email)
      setAddingCustomer(false)
      setNewCust({ name: '', email: '', phone: '' })
    } catch(e) {} finally { setCustSaving(false) }
  }

  const handleCustomerSelect = async (val) => {
    if (val.startsWith('crm_')) {
      // CRM customer — find it and create as op_customer
      const crmId = parseInt(val.replace('crm_', ''))
      const c = crmCustomers.find(x => x.id === crmId)
      if (!c) return
      try {
        const created = await operationsApi.createCustomer({ name: c.name, email: c.email||'', phone: c.phone||'' })
        setOpsCustomers(prev => [...prev, created])
        set('customer_id', created.id)
        if (created.email) set('email', created.email)
      } catch(e) {}
    } else {
      set('customer_id', val)
      const c = opsCustomers.find(x => String(x.id) === String(val))
      if (c?.email) set('email', c.email)
    }
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.order_number.trim()) { setErr('Order number is required'); return }
    setSaving(true); setErr('')
    try {
      const saved = order ? await operationsApi.updateOrder(order.id, form) : await operationsApi.createOrder(form)
      onSave(saved)
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  return (
    <Modal title={isPending ? `Complete Order — ${order?.order_number}` : order ? `Edit ${order.order_number}` : 'New Order'} onClose={onClose} wide>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <FF label="Order Number" half><input className="input" value={form.order_number} onChange={e => set('order_number', e.target.value)} placeholder="TA001234" /></FF>
        <FF label="Order Date" half><input className="input" type="date" value={form.order_date} onChange={e => set('order_date', e.target.value)} /></FF>
        <FF label="Due Date" half><input className="input" type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} /></FF>
        <FF label="Email" half><input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="customer@email.com" /></FF>

        <FF label="Customer">
          {addingCustomer ? (
            <div style={{ border: '1px solid #00D4C8', borderRadius: 10, padding: '10px 12px', background: '#f0fffe', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: BRAND, textTransform: 'uppercase', letterSpacing: '0.08em' }}>New Customer</div>
              <input className="input" placeholder="Name *" value={newCust.name} onChange={e => setNewCust(p => ({...p, name: e.target.value}))} autoFocus />
              <input className="input" placeholder="Email" value={newCust.email} onChange={e => setNewCust(p => ({...p, email: e.target.value}))} />
              <input className="input" placeholder="Phone" value={newCust.phone} onChange={e => setNewCust(p => ({...p, phone: e.target.value}))} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-primary" style={{ flex: 1, padding: '6px 0', fontSize: 12 }} onClick={handleAddCustomer} disabled={custSaving || !newCust.name.trim()}>{custSaving ? 'Saving…' : 'Add Customer'}</button>
                <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setAddingCustomer(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <select className="input" style={{ flex: 1 }} value={form.customer_id} onChange={e => handleCustomerSelect(e.target.value)}>
                <option value="">— select customer —</option>
                {opsCustomers.length > 0 && <optgroup label="Operations Customers">
                  {opsCustomers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>}
                {crmCustomers.filter(c => !opsCustomers.some(o => o.email && o.email === c.email)).length > 0 && (
                  <optgroup label="CRM Customers (click to import)">
                    {crmCustomers.filter(c => !opsCustomers.some(o => o.email && o.email === c.email)).map(c => (
                      <option key={`crm_${c.id}`} value={`crm_${c.id}`}>{c.name}{c.email ? ` — ${c.email}` : ''}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              <button type="button" title="Add new customer" onClick={() => setAddingCustomer(true)}
                style={{ padding: '0 10px', background: BRAND, border: 'none', borderRadius: 8, cursor: 'pointer', color: '#fff', fontWeight: 700, fontSize: 18, flexShrink: 0 }}>+</button>
            </div>
          )}
        </FF>

        <FF label="Lead Source" half>
          <select className="input" value={form.lead_source} onChange={e => set('lead_source', e.target.value)}>
            <option value="">—</option>
            {LEAD_SOURCES.map(s => <option key={s}>{s}</option>)}
          </select>
        </FF>
        <FF label="Rep" half>
          <select className="input" value={form.rep} onChange={e => set('rep', e.target.value)}>
            <option value="">—</option>
            {REPS.map(r => <option key={r}>{r}</option>)}
          </select>
        </FF>
        <FF label="PPC Order Rep" half>
          <select className="input" value={form.ppc_order_rep} onChange={e => set('ppc_order_rep', e.target.value)}>
            <option value="">—</option>
            {REPS.filter(r => r !== 'Online').map(r => <option key={r}>{r}</option>)}
          </select>
        </FF>
        <FF label="Buyer" half>
          <select className="input" value={form.buyer} onChange={e => set('buyer', e.target.value)}>
            <option value="">—</option>
            {BUYERS.map(b => <option key={b}>{b}</option>)}
          </select>
        </FF>
        <FF label="Order Status" half>
          <select className="input" value={form.order_status} onChange={e => set('order_status', e.target.value)}>
            {ORDER_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </FF>
        <FF label="Payment Status" half>
          <select className="input" value={form.payment_status} onChange={e => set('payment_status', e.target.value)}>
            <option value="">—</option>
            {PAYMENT_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </FF>
        <FF label="Net (terms)" half><input className="input" value={form.net} onChange={e => set('net', e.target.value)} placeholder="e.g. Net 30, Net 15" /></FF>

        <div style={{ flex: '1 1 100%', borderTop: '1px solid #f1f5f9', paddingTop: 12 }} />

        <FF label="Tax Charged ($)" third><input className="input" type="number" value={form.tax_charged} onChange={e => set('tax_charged', e.target.value)} placeholder="0.00" /></FF>
        <FF label="Shipping Charged ($)" third><input className="input" type="number" value={form.shipping_charged} onChange={e => set('shipping_charged', e.target.value)} placeholder="0.00" /></FF>
        <FF label="CC Charges ($)" third><input className="input" type="number" value={form.cc_charges} onChange={e => set('cc_charges', e.target.value)} placeholder="0.00" /></FF>
        <FF label="Customer Paid ($)" half><input className="input" type="number" value={form.customer_paid} onChange={e => set('customer_paid', e.target.value)} placeholder="0.00" /></FF>
        <FF label="RMA Amount ($)" half><input className="input" type="number" value={form.rma_amount} onChange={e => set('rma_amount', e.target.value)} placeholder="0.00" /></FF>

        <div style={{ flex: '1 1 100%', borderTop: '1px solid #f1f5f9', paddingTop: 12 }} />

        <FF label="Shipped Via" half>
          <select className="input" value={form.shipped_via} onChange={e => set('shipped_via', e.target.value)}>
            <option value="">—</option>
            {SHIPPED_VIA.map(s => <option key={s}>{s}</option>)}
          </select>
        </FF>
        <FF label="Tracking to Customer" half><input className="input" value={form.tracking_to_customer} onChange={e => set('tracking_to_customer', e.target.value)} placeholder="1Z999..." /></FF>

        <FF label="Notes"><textarea className="input" value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Internal notes..." style={{ resize: 'vertical' }} /></FF>
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
function ItemForm({ item, orderId, suppliers: suppliersProp, onSave, onClose }) {
  const blank = { part_number: '', description: '', product: '', supplier_id: '', quantity: 1,
    product_condition: '', selling: '', buying: '', cc_paid: '', tax_paid: '', shipping_paid: '',
    duty_paid: '', paid_to_supplier: '', payment_method: '', payment_due: '',
    tracking_to_warehouse: '', ta_po_number: '', serials: '' }
  const [form, setForm] = useState(item ? { ...blank, ...item, supplier_id: item.supplier_id||'', payment_due: item.payment_due?.slice(0,10)||'' } : blank)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // Suppliers — fetch fresh, allow inline add
  const [localSuppliers, setLocalSuppliers] = useState(suppliersProp || [])
  useEffect(() => { operationsApi.getSuppliers().then(setLocalSuppliers).catch(() => {}) }, [])

  const [addingSupplier, setAddingSupplier] = useState(false)
  const [newSup, setNewSup] = useState({ company: '', email: '', phone: '' })
  const [supSaving, setSupSaving] = useState(false)

  const handleAddSupplier = async () => {
    if (!newSup.company.trim()) return
    setSupSaving(true)
    try {
      const created = await operationsApi.createSupplier(newSup)
      setLocalSuppliers(prev => [...prev, created])
      set('supplier_id', created.id)
      setAddingSupplier(false)
      setNewSup({ company: '', email: '', phone: '' })
    } catch(e) {} finally { setSupSaving(false) }
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true); setErr('')
    try {
      const saved = item ? await operationsApi.updateItem(item.id, form) : await operationsApi.addItem(orderId, form)
      onSave(saved)
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  const totalSelling = (Number(form.selling)||0) * (Number(form.quantity)||0)
  const totalBuying  = (Number(form.buying)||0) * (Number(form.quantity)||0)
    + (Number(form.cc_paid)||0) + (Number(form.tax_paid)||0) + (Number(form.shipping_paid)||0) + (Number(form.duty_paid)||0)

  return (
    <Modal title={item ? 'Edit Line Item' : 'Add Line Item'} onClose={onClose} wide>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <FF label="Part Number" half><input className="input" value={form.part_number} onChange={e => set('part_number', e.target.value)} placeholder="ABC-123" /></FF>
        <FF label="Quantity" half><input className="input" type="number" value={form.quantity} onChange={e => set('quantity', e.target.value)} min="1" /></FF>
        <FF label="Description"><input className="input" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Product description" /></FF>

        <FF label="Supplier" half>
          {addingSupplier ? (
            <div style={{ border: '1px solid #00D4C8', borderRadius: 10, padding: '10px 12px', background: '#f0fffe', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: BRAND, textTransform: 'uppercase', letterSpacing: '0.08em' }}>New Supplier</div>
              <input className="input" placeholder="Company *" value={newSup.company} onChange={e => setNewSup(p => ({...p, company: e.target.value}))} autoFocus />
              <input className="input" placeholder="Email" value={newSup.email} onChange={e => setNewSup(p => ({...p, email: e.target.value}))} />
              <input className="input" placeholder="Phone" value={newSup.phone} onChange={e => setNewSup(p => ({...p, phone: e.target.value}))} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-primary" style={{ flex: 1, padding: '6px 0', fontSize: 12 }} onClick={handleAddSupplier} disabled={supSaving || !newSup.company.trim()}>{supSaving ? 'Saving…' : 'Add Supplier'}</button>
                <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setAddingSupplier(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <select className="input" style={{ flex: 1 }} value={form.supplier_id} onChange={e => set('supplier_id', e.target.value)}>
                <option value="">— select supplier —</option>
                {localSuppliers.map(s => <option key={s.id} value={s.id}>{s.company}</option>)}
              </select>
              <button type="button" title="Add new supplier" onClick={() => setAddingSupplier(true)}
                style={{ padding: '0 10px', background: BRAND, border: 'none', borderRadius: 8, cursor: 'pointer', color: '#fff', fontWeight: 700, fontSize: 18, flexShrink: 0 }}>+</button>
            </div>
          )}
        </FF>
        <FF label="Condition" half>
          <select className="input" value={form.product_condition} onChange={e => set('product_condition', e.target.value)}>
            <option value="">—</option>
            {CONDITIONS.map(c => <option key={c}>{c}</option>)}
          </select>
        </FF>

        <div style={{ flex: '1 1 100%', borderTop: '1px solid #f1f5f9', paddingTop: 12 }} />

        <FF label="Selling ($/unit)" third><input className="input" type="number" value={form.selling} onChange={e => set('selling', e.target.value)} placeholder="0.00" /></FF>
        <FF label="Buying ($/unit)" third><input className="input" type="number" value={form.buying} onChange={e => set('buying', e.target.value)} placeholder="0.00" /></FF>
        <FF label="Paid to Supplier ($)" third><input className="input" type="number" value={form.paid_to_supplier} onChange={e => set('paid_to_supplier', e.target.value)} placeholder="0.00" /></FF>

        <FF label="CC Paid ($)" third><input className="input" type="number" value={form.cc_paid} onChange={e => set('cc_paid', e.target.value)} placeholder="0.00" /></FF>
        <FF label="Tax Paid ($)" third><input className="input" type="number" value={form.tax_paid} onChange={e => set('tax_paid', e.target.value)} placeholder="0.00" /></FF>
        <FF label="Shipping Paid ($)" third><input className="input" type="number" value={form.shipping_paid} onChange={e => set('shipping_paid', e.target.value)} placeholder="0.00" /></FF>
        <FF label="Duty Paid ($)" third><input className="input" type="number" value={form.duty_paid} onChange={e => set('duty_paid', e.target.value)} placeholder="0.00" /></FF>
        <FF label="Payment Method" third>
          <select className="input" value={form.payment_method} onChange={e => set('payment_method', e.target.value)}>
            <option value="">—</option>
            {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
          </select>
        </FF>
        <FF label="Payment Due" third><input className="input" type="date" value={form.payment_due} onChange={e => set('payment_due', e.target.value)} /></FF>

        <div style={{ flex: '1 1 100%', borderTop: '1px solid #f1f5f9', paddingTop: 12 }} />

        <FF label="TA PO #" half><input className="input" value={form.ta_po_number} onChange={e => set('ta_po_number', e.target.value)} placeholder="PO-000" /></FF>
        <FF label="Tracking to Warehouse" half><input className="input" value={form.tracking_to_warehouse} onChange={e => set('tracking_to_warehouse', e.target.value)} placeholder="1Z999..." /></FF>
        <FF label="Serial Numbers"><textarea className="input" value={form.serials} onChange={e => set('serials', e.target.value)} rows={2} placeholder="One per line..." style={{ resize: 'vertical' }} /></FF>
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

// ── RMA Form (used from both OrderDetail and RMATab) ─────────────────────────
function RMAForm({ rma, presetOrder, orderItems, customers, orders, onSave, onClose }) {
  const blank = {
    rma_number: '', order_id: presetOrder?.id || '', order_item_id: '', customer_id: presetOrder?.customer_id || '',
    email: '', return_quantity: 1, return_reason: '', rma_status: 'Initiated',
    rma_issue_date: new Date().toISOString().slice(0,10), rma_completed_date: '',
    refund_issued: '', restocking_fee: '', return_tracking_number: '',
    return_shipping_paid: '', notes: '', qb_credit_memo: ''
  }
  const [form, setForm] = useState(rma ? {
    ...blank, ...rma,
    order_id: rma.order_id || '',
    order_item_id: rma.order_item_id || '',
    customer_id: rma.customer_id || '',
    rma_issue_date: rma.rma_issue_date?.slice(0,10) || '',
    rma_completed_date: rma.rma_completed_date?.slice(0,10) || '',
  } : blank)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [itemsForOrder, setItemsForOrder] = useState(orderItems || [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // When order changes (and no preset), load that order's items
  useEffect(() => {
    if (presetOrder) { setItemsForOrder(orderItems || []); return }
    if (!form.order_id) { setItemsForOrder([]); return }
    operationsApi.getAllItems({ order_id: form.order_id }).then(setItemsForOrder).catch(() => {})
  }, [form.order_id, presetOrder])

  const selectedItem = itemsForOrder.find(i => String(i.id) === String(form.order_item_id))
  const returnAmount = (Number(form.return_quantity) || 0) * (Number(selectedItem?.selling) || 0)

  const handleSave = async () => {
    if (!form.rma_number.trim()) { setErr('RMA number is required'); return }
    setSaving(true); setErr('')
    try {
      const saved = rma
        ? await operationsApi.updateRMA(rma.id, form)
        : await operationsApi.createRMA(form)
      onSave(saved)
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  return (
    <Modal title={rma ? `Edit ${rma.rma_number}` : 'New RMA'} onClose={onClose} wide>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <FF label="RMA Number" half><input className="input" value={form.rma_number} onChange={e => set('rma_number', e.target.value)} placeholder="RMA-001" /></FF>
        <FF label="RMA Status" half>
          <select className="input" value={form.rma_status} onChange={e => set('rma_status', e.target.value)}>
            {RMA_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </FF>

        {presetOrder ? (
          <FF label="Order"><input className="input" value={presetOrder.order_number} readOnly style={{ background: '#f8fafc', color: '#64748b' }} /></FF>
        ) : (
          <FF label="Order">
            <select className="input" value={form.order_id} onChange={e => { set('order_id', e.target.value); set('order_item_id', '') }}>
              <option value="">— select order —</option>
              {(orders||[]).map(o => <option key={o.id} value={o.id}>{o.order_number} {o.customer_name ? `· ${o.customer_name}` : ''}</option>)}
            </select>
          </FF>
        )}

        <FF label="Return Item (links to Order Item)">
          <select className="input" value={form.order_item_id} onChange={e => set('order_item_id', e.target.value)}
            disabled={!form.order_id && !presetOrder}>
            <option value="">— select item —</option>
            {itemsForOrder.map(i => (
              <option key={i.id} value={i.id}>
                {i.part_number || '(no part#)'} — {i.description || ''} (${i.selling}/unit)
              </option>
            ))}
          </select>
        </FF>

        <FF label="Customer" half>
          <select className="input" value={form.customer_id} onChange={e => set('customer_id', e.target.value)}>
            <option value="">— select customer —</option>
            {(customers||[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </FF>
        <FF label="Email" half><input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="customer@email.com" /></FF>

        <div style={{ flex: '1 1 100%', borderTop: '1px solid #f1f5f9', paddingTop: 12 }} />

        <FF label="Return Quantity" half><input className="input" type="number" min="1" value={form.return_quantity} onChange={e => set('return_quantity', e.target.value)} /></FF>
        <FF label="Return Reason" half><input className="input" value={form.return_reason} onChange={e => set('return_reason', e.target.value)} placeholder="Defective, wrong item…" /></FF>

        {selectedItem && (
          <div style={{ flex: '1 1 100%', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 20, alignItems: 'center' }}>
            <div><span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Unit Selling Price</span><div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{fmt(selectedItem.selling)}</div></div>
            <div style={{ color: '#94a3b8', fontSize: 18 }}>×</div>
            <div><span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Qty</span><div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{form.return_quantity}</div></div>
            <div style={{ color: '#94a3b8', fontSize: 18 }}>=</div>
            <div><span style={{ fontSize: 11, fontWeight: 700, color: '#064e3b', textTransform: 'uppercase' }}>Return Amount</span><div style={{ fontSize: 22, fontWeight: 900, color: '#10b981' }}>{fmt(returnAmount)}</div></div>
          </div>
        )}

        <div style={{ flex: '1 1 100%', borderTop: '1px solid #f1f5f9', paddingTop: 12 }} />

        <FF label="Issue Date" half><input className="input" type="date" value={form.rma_issue_date} onChange={e => set('rma_issue_date', e.target.value)} /></FF>
        <FF label="Completed Date" half><input className="input" type="date" value={form.rma_completed_date} onChange={e => set('rma_completed_date', e.target.value)} /></FF>
        <FF label="Refund Issued ($)" half><input className="input" type="number" value={form.refund_issued} onChange={e => set('refund_issued', e.target.value)} placeholder="0.00" /></FF>
        <FF label="Restocking Fee ($)" half><input className="input" type="number" value={form.restocking_fee} onChange={e => set('restocking_fee', e.target.value)} placeholder="0.00" /></FF>
        <FF label="Return Tracking #" half><input className="input" value={form.return_tracking_number} onChange={e => set('return_tracking_number', e.target.value)} /></FF>
        <FF label="Return Shipping Paid ($)" half><input className="input" type="number" value={form.return_shipping_paid} onChange={e => set('return_shipping_paid', e.target.value)} placeholder="0.00" /></FF>
        <FF label="QB Credit Memo #" half><input className="input" value={form.qb_credit_memo} onChange={e => set('qb_credit_memo', e.target.value)} /></FF>
        <FF label="Notes"><textarea className="input" value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} style={{ resize: 'vertical' }} /></FF>
      </div>

      {err && <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginTop: 12 }}>{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : rma ? 'Save Changes' : 'Create RMA'}</button>
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
  const [addRMA, setAddRMA] = useState(false)
  const [editRMA, setEditRMA] = useState(null)

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

  const handleDeleteRMA = async (id) => {
    if (!confirm('Delete this RMA?')) return
    await operationsApi.deleteRMA(id)
    load(); onUpdated && onUpdated()
  }

  if (!order && loading) return (
    <Modal title="Loading…" onClose={onClose} wide><Loader /></Modal>
  )
  if (!order) return null

  const gp        = Number(order.gp)        || 0
  const remaining = Number(order.remaining) || 0

  const itemCols = [
    { h: 'Part #',        render: i => <span style={{ fontWeight: 600, color: '#0f172a' }}>{i.part_number || '—'}</span> },
    { h: 'Description',   render: i => <span style={{ color: '#475569' }}>{i.description || '—'}</span> },
    { h: 'Qty',           render: i => i.quantity },
    { h: 'Condition',     render: i => i.product_condition || '—' },
    { h: 'Supplier',      render: i => i.supplier_name || '—' },
    { h: 'Sell/unit',     render: i => fmt(i.selling) },
    { h: 'Total Sell',    render: i => <span style={{ fontWeight: 700, color: BRAND }}>{fmt(i.total_selling)}</span> },
    { h: 'Buy/unit',      render: i => fmt(i.buying) },
    { h: 'Ext. Buy',      render: i => fmt(i.ext_total_buying) },
    { h: 'CC Paid',       render: i => fmt(i.cc_paid) },
    { h: 'Tax Paid',      render: i => fmt(i.tax_paid) },
    { h: 'Ship Paid',     render: i => fmt(i.shipping_paid) },
    { h: 'Duty Paid',     render: i => fmt(i.duty_paid) },
    { h: 'Paid to Sup.',  render: i => fmt(i.paid_to_supplier) },
    { h: 'Sup. Rem.',     render: i => <span style={{ color: i.supplier_remaining > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>{fmt(i.supplier_remaining)}</span> },
    { h: 'Pay Method',    render: i => i.payment_method || '—' },
    { h: 'Pay Due',       render: i => fmtDate(i.payment_due) },
    { h: 'TA PO#',        render: i => i.ta_po_number || '—' },
    { h: 'Track→WH',      render: i => i.tracking_to_warehouse || '—' },
    { h: 'Serials',       render: i => i.serials || '—' },
  ]

  return (
    <>
      <Modal title={`Order ${order.order_number}`} onClose={onClose} wide>
        {loading && <div style={{ position: 'absolute', top: 12, right: 60, fontSize: 11, color: '#94a3b8' }}>Refreshing…</div>}

        {/* Status + actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
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
          <FinCard label="RMA Amount"     value={fmt(order.rma_amount)} color="#f59e0b" />
          <FinCard label="GP"             value={fmt(gp)}        color={gp >= 0 ? '#10b981' : '#ef4444'} />
          <FinCard label="Customer Paid"  value={fmt(order.customer_paid)} color={BRAND} />
          <FinCard label="Remaining"      value={fmt(remaining)} color={remaining > 0 ? '#f59e0b' : '#10b981'} />
        </div>

        {/* Order details */}
        <SectionLabel>Details</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px', marginBottom: 24, fontSize: 13 }}>
          {[
            ['Customer',      order.customer_name || order.email || '—'],
            ['Order Date',    fmtDate(order.order_date)],
            ['Due Date',      fmtDate(order.due_date)],
            ['Rep',           order.rep || '—'],
            ['PPC Order Rep', order.ppc_order_rep || '—'],
            ['Buyer',         order.buyer || '—'],
            ['Lead Source',   order.lead_source || '—'],
            ['Net',           order.net || '—'],
            ['Shipped Via',   order.shipped_via || '—'],
            ['Tracking→Customer', order.tracking_to_customer || '—'],
            ['Tax Charged',   fmt(order.tax_charged)],
            ['Ship Charged',  fmt(order.shipping_charged)],
            ['CC Charges',    fmt(order.cc_charges)],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f8fafc' }}>
              <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: 12 }}>{k}</span>
              <span style={{ color: '#0f172a', fontWeight: 500, textAlign: 'right', maxWidth: '60%', wordBreak: 'break-word', fontSize: 12 }}>{v}</span>
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
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1100 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {[...itemCols.map(c => c.h), ''].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {order.items.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    {itemCols.map(c => (
                      <td key={c.h} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{c.render(item)}</td>
                    ))}
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <SectionLabel>RMAs ({order.rmas?.length || 0})</SectionLabel>
          <button className="btn btn-primary btn-sm" style={{ background: '#fee2e2', color: '#dc2626', borderColor: '#fecaca' }} onClick={() => setAddRMA(true)}><Plus size={13} /> Create RMA</button>
        </div>
        {order.rmas?.length > 0 ? (
          <div style={{ overflowX: 'auto', marginBottom: 24 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#fff5f5' }}>
                  {['RMA #', 'Return Item', 'Qty', 'Unit Price', 'Return Amount', 'Status', 'Issue Date', 'Refund', 'Restocking', 'QB Memo', ''].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {order.rmas.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #fee2e2' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#dc2626' }}>{r.rma_number}</td>
                    <td style={{ padding: '8px 10px', color: '#475569' }}>{r.return_item_part ? `${r.return_item_part}${r.return_item_desc ? ` — ${r.return_item_desc}` : ''}` : '—'}</td>
                    <td style={{ padding: '8px 10px' }}>{r.return_quantity}</td>
                    <td style={{ padding: '8px 10px' }}>{fmt(r.unit_selling_price)}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#10b981' }}>{fmt(r.return_amount)}</td>
                    <td style={{ padding: '8px 10px' }}><StatusBadge status={r.rma_status} styleMap={RMA_STATUS_STYLE} /></td>
                    <td style={{ padding: '8px 10px', color: '#64748b' }}>{fmtDate(r.rma_issue_date)}</td>
                    <td style={{ padding: '8px 10px' }}>{fmt(r.refund_issued)}</td>
                    <td style={{ padding: '8px 10px' }}>{fmt(r.restocking_fee)}</td>
                    <td style={{ padding: '8px 10px', color: '#64748b' }}>{r.qb_credit_memo || '—'}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px' }} onClick={() => setEditRMA(r)}><Edit2 size={11} /></button>
                        <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', color: '#ef4444' }} onClick={() => handleDeleteRMA(r.id)}><Trash2 size={11} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px', background: '#fff5f5', borderRadius: 12, marginBottom: 24, color: '#fca5a5', fontSize: 13, border: '1px dashed #fecaca' }}>
            No RMAs for this order.
          </div>
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
      {addRMA && (
        <RMAForm
          presetOrder={{ id: order.id, order_number: order.order_number, customer_id: order.customer_id }}
          orderItems={order.items || []}
          customers={customers}
          onClose={() => setAddRMA(false)}
          onSave={() => { setAddRMA(false); load(); onUpdated && onUpdated() }}
        />
      )}
      {editRMA && (
        <RMAForm
          rma={editRMA}
          presetOrder={{ id: order.id, order_number: order.order_number, customer_id: order.customer_id }}
          orderItems={order.items || []}
          customers={customers}
          onClose={() => setEditRMA(null)}
          onSave={() => { setEditRMA(null); load(); onUpdated && onUpdated() }}
        />
      )}
    </>
  )
}

// ── Orders Tab ────────────────────────────────────────────────────────────────
function OrdersTab({ jumpOrderId, onJumpHandled, initialStatus, initialLeadSource, initialPaymentStatus, onInitialFiltersHandled }) {
  const [orders, setOrders]       = useState([])
  const [customers, setCustomers] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState(initialStatus || '')
  const [filterRep, setFilterRep]       = useState('')
  const [filterPayment, setFilterPayment] = useState(initialPaymentStatus || '')
  const [filterLeadSource, setFilterLeadSource] = useState(initialLeadSource || '')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo]     = useState('')
  const [selected, setSelected]   = useState(null)
  const [showForm, setShowForm]   = useState(false)

  useEffect(() => {
    if (jumpOrderId) { setSelected(jumpOrderId); onJumpHandled && onJumpHandled() }
  }, [jumpOrderId])

  useEffect(() => {
    if (initialStatus !== undefined) { setFilterStatus(initialStatus || ''); onInitialFiltersHandled && onInitialFiltersHandled() }
  }, [initialStatus])

  useEffect(() => {
    if (initialLeadSource !== undefined) { setFilterLeadSource(initialLeadSource || ''); onInitialFiltersHandled && onInitialFiltersHandled() }
  }, [initialLeadSource])

  useEffect(() => {
    if (initialPaymentStatus !== undefined) { setFilterPayment(initialPaymentStatus || ''); onInitialFiltersHandled && onInitialFiltersHandled() }
  }, [initialPaymentStatus])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [o, c, s] = await Promise.all([
        operationsApi.getOrders({ search, status: filterStatus, rep: filterRep, lead_source: filterLeadSource, payment_status: filterPayment, date_from: filterDateFrom, date_to: filterDateTo }),
        operationsApi.getCustomers(),
        operationsApi.getSuppliers(),
      ])
      setOrders(o); setCustomers(c); setSuppliers(s)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [search, filterStatus, filterRep, filterLeadSource, filterPayment, filterDateFrom, filterDateTo])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id) => {
    if (!confirm('Delete this order and all its line items?')) return
    await operationsApi.deleteOrder(id); load()
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setShowForm(true)}><Plus size={15} /> New Order</button>
      </div>
      {/* Filter bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <input className="input" style={{ flex: '1 1 200px', minWidth: 180 }}
          placeholder="Search order #, customer, email…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input" style={{ flex: '0 0 150px' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {ORDER_STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="input" style={{ flex: '0 0 130px' }} value={filterRep} onChange={e => setFilterRep(e.target.value)}>
          <option value="">All Reps</option>
          {REPS.map(r => <option key={r}>{r}</option>)}
        </select>
        <select className="input" style={{ flex: '0 0 150px' }} value={filterPayment} onChange={e => setFilterPayment(e.target.value)}>
          <option value="">All Payment</option>
          {PAYMENT_STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="input" style={{ flex: '0 0 150px' }} value={filterLeadSource} onChange={e => setFilterLeadSource(e.target.value)}>
          <option value="">All Lead Sources</option>
          {LEAD_SOURCES.map(s => <option key={s}>{s}</option>)}
        </select>
        <input className="input" type="date" style={{ flex: '0 0 140px' }} value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} title="From date" />
        <input className="input" type="date" style={{ flex: '0 0 140px' }} value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} title="To date" />
        {(search || filterStatus || filterRep || filterPayment || filterLeadSource || filterDateFrom || filterDateTo) && (
          <button className="btn-secondary" style={{ padding: '0 14px', fontSize: 12 }}
            onClick={() => { setSearch(''); setFilterStatus(''); setFilterRep(''); setFilterPayment(''); setFilterLeadSource(''); setFilterDateFrom(''); setFilterDateTo('') }}>
            Clear filters
          </button>
        )}
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
          onSave={(saved) => { setShowForm(false); load(); if (saved?.id) setSelected(saved.id) }} />
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

// ── Order Items Tab ───────────────────────────────────────────────────────────
function OrderItemsTab({ onOpenOrder }) {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [editItem, setEditItem] = useState(null)
  const [suppliers, setSuppliers] = useState([])
  const timer = useRef(null)

  const load = useCallback(async (q) => {
    setLoading(true)
    try { setRows(await operationsApi.getAllItems({ search: q })) }
    catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    operationsApi.getSuppliers('').then(setSuppliers).catch(() => {})
  }, [])

  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => load(search), 300)
  }, [search, load])

  const handleDeleteItem = async (id) => {
    if (!confirm('Delete this line item?')) return
    try { await operationsApi.deleteItem(id); load(search) }
    catch(e) { alert(e.message) }
  }

  const cols = [
    { key: 'order_number',       label: 'Order #',      render: r => (
      <button onClick={() => onOpenOrder(r.order_id)} style={{ color: BRAND, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13 }}>{r.order_number || '—'}</button>
    )},
    { key: 'part_number',        label: 'Part #',       bold: true },
    { key: 'description',        label: 'Description'   },
    { key: 'supplier_name',      label: 'Supplier'      },
    { key: 'quantity',           label: 'Qty',          num: true },
    { key: 'product_condition',  label: 'Condition'     },
    { key: 'selling',            label: 'Selling/unit', num: true, fmt: true },
    { key: 'total_selling',      label: 'Total Selling',num: true, fmt: true, highlight: BRAND },
    { key: 'buying',             label: 'Buying/unit',  num: true, fmt: true },
    { key: 'ext_total_buying',   label: 'Ext. Buying',  num: true, fmt: true },
    { key: 'cc_paid',            label: 'CC Paid',      num: true, fmt: true },
    { key: 'tax_paid',           label: 'Tax Paid',     num: true, fmt: true },
    { key: 'shipping_paid',      label: 'Ship Paid',    num: true, fmt: true },
    { key: 'duty_paid',          label: 'Duty Paid',    num: true, fmt: true },
    { key: 'paid_to_supplier',   label: 'Paid to Sup.', num: true, fmt: true },
    { key: 'supplier_remaining', label: 'Sup. Remaining',num:true, fmt: true, colorFn: v => v > 0 ? '#ef4444' : '#10b981' },
    { key: 'payment_method',     label: 'Pay Method'    },
    { key: 'payment_due',        label: 'Pay Due',      render: r => fmtDate(r.payment_due) },
    { key: 'ta_po_number',       label: 'TA PO#'        },
    { key: 'tracking_to_warehouse', label: 'Track→WH'  },
    { key: 'serials',            label: 'Serials'       },
  ]

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <div className="search-wrap" style={{ flex: 1 }}>
          <Search size={14} className="search-icon" />
          <input className="input" placeholder="Search by part #, description, order #, supplier…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <span style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>{rows.length} items</span>
      </div>

      {loading ? <Loader /> : rows.length === 0 ? (
        <EmptyState icon={List} label="Order Items" action={null} />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1400 }}>
            <thead>
              <tr className="table-header">
                {cols.map(c => <th key={c.key} className="table-cell" style={{ whiteSpace: 'nowrap' }}>{c.label}</th>)}
                <th className="table-cell"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="table-row">
                  {cols.map(c => {
                    const val = row[c.key]
                    const display = c.render ? c.render(row) : c.fmt ? fmt(val) : (val ?? '—')
                    const color = c.colorFn ? c.colorFn(Number(val)) : c.highlight || (c.bold ? '#0f172a' : '#475569')
                    return (
                      <td key={c.key} className="table-cell" style={{ fontWeight: c.bold ? 600 : 400, color, whiteSpace: c.key === 'serials' ? 'pre-wrap' : 'nowrap', maxWidth: c.key === 'serials' ? 140 : undefined, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {display}
                      </td>
                    )
                  })}
                  <td className="table-cell">
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditItem(row)}><Edit2 size={13} /></button>
                      <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => handleDeleteItem(row.id)}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editItem && (
        <ItemForm item={editItem} orderId={editItem.order_id} suppliers={suppliers}
          onClose={() => setEditItem(null)}
          onSave={() => { setEditItem(null); load(search) }} />
      )}
    </div>
  )
}

// ── RMA Tab ───────────────────────────────────────────────────────────────────
function RMATab() {
  const [rmas, setRmas]           = useState([])
  const [customers, setCustomers] = useState([])
  const [orders, setOrders]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState('')
  const [formRMA, setFormRMA]     = useState(null)   // null=closed, {}=new, {...}=edit

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

  const handleDelete = async (id) => {
    if (!confirm('Delete this RMA?')) return
    await operationsApi.deleteRMA(id); load()
  }

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
        <button className="btn btn-primary" onClick={() => setFormRMA({})}><Plus size={15} /> New RMA</button>
      </div>

      {loading ? <Loader /> : rmas.length === 0 ? (
        <EmptyState icon={RotateCcw} label="RMAs" action={<button className="btn btn-primary" onClick={() => setFormRMA({})}><Plus size={14} /> New RMA</button>} />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr className="table-header">
                {['RMA #', 'Order', 'Return Item', 'Qty', 'Unit Price', 'Return Amount', 'Customer', 'Reason', 'Status', 'Refund', 'Restocking', 'Issue Date', 'QB Memo', ''].map(h => (
                  <th key={h} className="table-cell" style={{ whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rmas.map(r => (
                <tr key={r.id} className="table-row">
                  <td className="table-cell" style={{ fontWeight: 700, color: '#dc2626' }}>{r.rma_number}</td>
                  <td className="table-cell" style={{ color: BRAND, fontWeight: 600 }}>{r.order_number || '—'}</td>
                  <td className="table-cell" style={{ color: '#475569' }}>{r.return_item_part ? `${r.return_item_part}${r.return_item_desc ? ` — ${r.return_item_desc}` : ''}` : '—'}</td>
                  <td className="table-cell">{r.return_quantity}</td>
                  <td className="table-cell">{fmt(r.unit_selling_price)}</td>
                  <td className="table-cell" style={{ fontWeight: 700, color: '#10b981' }}>{fmt(r.return_amount)}</td>
                  <td className="table-cell">{r.customer_name || r.email || '—'}</td>
                  <td className="table-cell" style={{ color: '#64748b', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.return_reason || '—'}</td>
                  <td className="table-cell"><StatusBadge status={r.rma_status} styleMap={RMA_STATUS_STYLE} /></td>
                  <td className="table-cell" style={{ color: '#dc2626', fontWeight: 600 }}>{fmt(r.refund_issued)}</td>
                  <td className="table-cell" style={{ color: '#64748b' }}>{fmt(r.restocking_fee)}</td>
                  <td className="table-cell" style={{ color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(r.rma_issue_date)}</td>
                  <td className="table-cell" style={{ color: '#64748b' }}>{r.qb_credit_memo || '—'}</td>
                  <td className="table-cell">
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setFormRMA(r)}><Edit2 size={13} /></button>
                      <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => handleDelete(r.id)}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formRMA !== null && (
        <RMAForm
          rma={formRMA.id ? formRMA : undefined}
          orders={orders}
          customers={customers}
          onClose={() => setFormRMA(null)}
          onSave={() => { setFormRMA(null); load() }}
        />
      )}
    </div>
  )
}

// ── Operations Dashboard ─────────────────────────────────────────────────────
function BarChart({ data, valueKey, labelKey, color, fmt: fmtFn, height = 140 }) {
  if (!data?.length) return <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 24 }}>No data</div>
  const max = Math.max(...data.map(d => d[valueKey] || 0))
  if (max === 0) return <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 24 }}>No data</div>
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height, overflowX: 'auto', paddingBottom: 8 }}>
      {data.map((d, i) => {
        const pct = max > 0 ? ((d[valueKey] || 0) / max) * 100 : 0
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 36 }}>
            <div style={{ fontSize: 9, color: '#64748b', marginBottom: 2, textAlign: 'center' }}>{fmtFn ? fmtFn(d[valueKey]) : d[valueKey]}</div>
            <div style={{ width: '100%', background: color || BRAND, borderRadius: '4px 4px 0 0', height: `${Math.max(pct, 2)}%`, minHeight: 4, transition: 'height 0.3s', opacity: 0.85 }} />
            <div style={{ fontSize: 9, color: '#64748b', marginTop: 4, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{d[labelKey]}</div>
          </div>
        )
      })}
    </div>
  )
}

function DashboardCard({ label, value, sub, color, onClick, icon }) {
  return (
    <div onClick={onClick} style={{
      background: '#fff', border: '1px solid #f1f5f9', borderRadius: 16,
      padding: '18px 20px', cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.15s', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 140
    }}
    onMouseEnter={e => onClick && (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,212,200,0.15)', e.currentTarget.style.borderColor = BRAND)}
    onMouseLeave={e => onClick && (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)', e.currentTarget.style.borderColor = '#f1f5f9')}
    >
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: color || '#0f172a', fontFamily: '"Bricolage Grotesque", sans-serif', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#94a3b8' }}>{sub}</div>}
    </div>
  )
}

function DashSection({ title, children }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 16, padding: '20px 20px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  )
}

function DashboardTab({ onNavigateOrders }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    operationsApi.getDashboard().then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <Loader />
  if (!data) return <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Failed to load dashboard</div>

  const { kpis, byMonth, byRep, byStatus, byLeadSource, topCustomers, byPayment } = data
  const gpMargin = kpis.gp_margin_pct ? `${kpis.gp_margin_pct.toFixed(1)}%` : '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI Row 1 */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <DashboardCard label="Total Revenue" value={fmt(kpis.total_revenue)} color="#0f172a" onClick={() => onNavigateOrders && onNavigateOrders()} />
        <DashboardCard label="Total Cost" value={fmt(kpis.total_cost)} color="#64748b" />
        <DashboardCard label="Gross Profit" value={fmt(kpis.total_gp)} color="#10b981" sub={`${gpMargin} margin`} onClick={() => onNavigateOrders && onNavigateOrders()} />
        <DashboardCard label="Total RMA" value={fmt(kpis.total_rma)} color="#ef4444" sub={`${kpis.open_rmas} open`} />
        <DashboardCard label="Total Orders" value={kpis.total_orders} color="#0f172a" onClick={() => onNavigateOrders && onNavigateOrders()} />
      </div>

      {/* KPI Row 2 */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <DashboardCard label="Collected" value={fmt(kpis.total_collected)} color="#10b981" />
        <DashboardCard label="Outstanding" value={fmt(kpis.total_outstanding)} color={kpis.total_outstanding > 0 ? '#f59e0b' : '#10b981'} />
        <DashboardCard label="Pending Orders" value={kpis.pending_orders} color="#d97706" sub="from CRM" onClick={() => onNavigateOrders && onNavigateOrders('pending')} />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <DashSection title="Monthly Revenue (last 12 months)">
          <BarChart data={byMonth} valueKey="revenue" labelKey="month" color="#00D4C8" fmtFn={v => `$${(v/1000).toFixed(0)}k`} height={150} />
        </DashSection>
        <DashSection title="Monthly Gross Profit">
          <BarChart data={byMonth} valueKey="gp" labelKey="month" color="#10b981" fmtFn={v => `$${(v/1000).toFixed(0)}k`} height={150} />
        </DashSection>
      </div>

      {/* Rep performance + order count by month */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <DashSection title="GP by Rep">
          <BarChart data={byRep} valueKey="gp" labelKey="rep" color="#6366f1" fmtFn={v => `$${(v/1000).toFixed(0)}k`} height={140} />
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {byRep.slice(0, 6).map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid #f8fafc' }}>
                <span style={{ fontWeight: 600, color: '#334155' }}>{r.rep}</span>
                <span style={{ display: 'flex', gap: 16 }}>
                  <span style={{ color: '#64748b' }}>{r.order_count} orders</span>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>{fmt(r.gp)}</span>
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>{fmt(r.revenue)}</span>
                </span>
              </div>
            ))}
          </div>
        </DashSection>
        <DashSection title="Orders by Month">
          <BarChart data={byMonth} valueKey="order_count" labelKey="month" color="#f59e0b" height={140} />
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {byStatus.map((s, i) => {
              const st = STATUS_STYLE[s.status] || { bg: '#f1f5f9', color: '#64748b' }
              return (
                <div key={i} onClick={() => onNavigateOrders && onNavigateOrders(s.status)}
                  style={{ background: st.bg, color: st.color, borderRadius: 100, fontSize: 11, fontWeight: 700, padding: '4px 12px', cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}>
                  {s.status} <span style={{ background: 'rgba(0,0,0,0.08)', borderRadius: 100, padding: '0 6px' }}>{s.count}</span>
                </div>
              )
            })}
          </div>
        </DashSection>
      </div>

      {/* Bottom tables */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <DashSection title="Top Customers by Revenue">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ display: 'flex', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', padding: '0 0 6px', borderBottom: '1px solid #f1f5f9', gap: 8 }}>
              <span style={{ flex: 2 }}>Customer</span><span style={{ flex: 1, textAlign: 'right' }}>Orders</span><span style={{ flex: 1, textAlign: 'right' }}>Revenue</span><span style={{ flex: 1, textAlign: 'right' }}>GP</span>
            </div>
            {topCustomers.map((c, i) => (
              <div key={i} style={{ display: 'flex', fontSize: 12, padding: '7px 0', borderBottom: '1px solid #f8fafc', gap: 8, alignItems: 'center' }}>
                <span style={{ flex: 2, fontWeight: 600, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || '—'}</span>
                <span style={{ flex: 1, textAlign: 'right', color: '#64748b' }}>{c.order_count}</span>
                <span style={{ flex: 1, textAlign: 'right', color: '#0f172a', fontWeight: 600 }}>{fmt(c.revenue)}</span>
                <span style={{ flex: 1, textAlign: 'right', color: '#10b981', fontWeight: 700 }}>{fmt(c.gp)}</span>
              </div>
            ))}
          </div>
        </DashSection>
        <DashSection title="Lead Source Breakdown">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ display: 'flex', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', padding: '0 0 6px', borderBottom: '1px solid #f1f5f9', gap: 8 }}>
              <span style={{ flex: 2 }}>Source</span><span style={{ flex: 1, textAlign: 'right' }}>Orders</span><span style={{ flex: 1, textAlign: 'right' }}>% of total</span>
            </div>
            {byLeadSource.map((s, i) => {
              const totalOrders = byLeadSource.reduce((a, x) => a + x.count, 0)
              const pct = totalOrders > 0 ? ((s.count / totalOrders) * 100).toFixed(1) : 0
              return (
                <div key={i} onClick={() => onNavigateOrders && onNavigateOrders(null, s.lead_source)}
                  style={{ display: 'flex', fontSize: 12, padding: '7px 0', borderBottom: '1px solid #f8fafc', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                  <span style={{ flex: 2, fontWeight: 600, color: '#334155' }}>{s.lead_source}</span>
                  <span style={{ flex: 1, textAlign: 'right', color: '#64748b' }}>{s.count}</span>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                    <div style={{ height: 6, width: `${pct}%`, maxWidth: 50, background: BRAND, borderRadius: 3, opacity: 0.7 }} />
                    <span style={{ color: '#64748b', minWidth: 34, textAlign: 'right' }}>{pct}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </DashSection>
      </div>

      {/* Payment breakdown */}
      <DashSection title="Payment Status Breakdown">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {byPayment.map((p, i) => (
            <div key={i} onClick={() => onNavigateOrders && onNavigateOrders(null, null, p.payment_status)}
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 16px', cursor: 'pointer', flex: 1, minWidth: 120, textAlign: 'center' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = BRAND}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{p.payment_status}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', fontFamily: '"Bricolage Grotesque", sans-serif' }}>{p.count}</div>
            </div>
          ))}
        </div>
      </DashSection>
    </div>
  )
}

// ── Pending Orders Panel ──────────────────────────────────────────────────────
function PendingOrdersPanel({ onClose, onOpenOrder }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)  // order being completed
  const [customers, setCustomers] = useState([])

  const load = async () => {
    setLoading(true)
    try {
      const [o, c] = await Promise.all([operationsApi.getPendingOrders(), operationsApi.getCustomers()])
      setOrders(o); setCustomers(c)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  if (selected) {
    return (
      <OrderForm
        order={selected}
        customers={customers}
        onClose={() => setSelected(null)}
        onSave={async (saved) => {
          // mark as no longer pending
          await operationsApi.updateOrder(saved.id, { ...saved, pending: 0 })
          setSelected(null)
          load()
          onOpenOrder && onOpenOrder(saved.id)
        }}
        isPending
      />
    )
  }

  return (
    <Modal title="Pending Orders from CRM" onClose={onClose} wide>
      {loading ? <Loader /> : orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 24px', color: '#94a3b8' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#334155', marginBottom: 6 }}>No pending orders</div>
          <div style={{ fontSize: 13 }}>All Closed Won leads have been processed.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
            {orders.length} order{orders.length !== 1 ? 's' : ''} waiting to be completed by the operator
          </div>
          {orders.map(order => (
            <div key={order.id}
              onClick={() => setSelected(order)}
              style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = BRAND}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{order.customer_name || '—'}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    {order.customer_email || ''}{order.lead_source ? ` · ${order.lead_source}` : ''}{order.rep ? ` · Rep: ${order.rep}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ background: '#fef9c3', color: '#a16207', borderRadius: 100, fontSize: 11, fontWeight: 700, padding: '3px 10px' }}>Pending</span>
                  <span style={{ background: '#f1f5f9', color: '#475569', borderRadius: 100, fontSize: 11, fontWeight: 600, padding: '3px 10px' }}>{order.item_count} part{order.item_count !== 1 ? 's' : ''}</span>
                </div>
              </div>
              {order.items?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                  {order.items.map((item, i) => (
                    <span key={i} style={{ background: '#f0fdf4', color: '#065f46', borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                      {item.part_number} × {item.quantity}
                    </span>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 10, fontSize: 12, color: BRAND, fontWeight: 600 }}>Click to complete this order →</div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

// ── Main Operations Page ──────────────────────────────────────────────────────
export default function Operations() {
  const [tab, setTab] = useState('orders')
  const [stats, setStats] = useState(null)
  const [jumpOrderId, setJumpOrderId] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [showPending, setShowPending] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [dashNavStatus, setDashNavStatus] = useState(undefined)
  const [dashNavLeadSource, setDashNavLeadSource] = useState(undefined)
  const [dashNavPayment, setDashNavPayment] = useState(undefined)

  useEffect(() => {
    operationsApi.getStats().then(s => { setStats(s); setPendingCount(s.pending_orders || 0) }).catch(() => {})
  }, [])

  const handleOpenOrderFromItems = (orderId) => {
    setJumpOrderId(orderId)
    setTab('orders')
  }

  const handleNavigateOrders = (status, leadSource, paymentStatus) => {
    setDashNavStatus(status || '')
    setDashNavLeadSource(leadSource || '')
    setDashNavPayment(paymentStatus || '')
    setTab('orders')
  }

  const tabs = [
    { key: 'orders',      label: 'Orders',      icon: Package },
    { key: 'order-items', label: 'Order Items',  icon: List },
    { key: 'customers',   label: 'Customers',   icon: Users },
    { key: 'suppliers',   label: 'Suppliers',   icon: Truck },
    { key: 'rma',         label: 'RMA',         icon: RotateCcw },
    { key: 'dashboard',   label: 'Dashboard',   icon: ClipboardList },
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
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => setShowImport(true)} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12,
            padding: '9px 16px', cursor: 'pointer', transition: 'all 0.15s',
            fontSize: 13, fontWeight: 600, color: '#475569',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = BRAND; e.currentTarget.style.color = BRAND }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#475569' }}
          >
            <Upload size={15} />
            Import Data
          </button>
        {stats && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {pendingCount > 0 && (
              <button onClick={() => setShowPending(true)} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: 14,
                padding: '10px 16px', cursor: 'pointer', transition: 'all 0.15s',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#fef3c7'}
              onMouseLeave={e => e.currentTarget.style.background = '#fffbeb'}
              >
                <ClipboardList size={16} color="#d97706" />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pending Orders</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#d97706', fontFamily: '"Bricolage Grotesque", sans-serif', lineHeight: 1 }}>{pendingCount}</div>
                </div>
              </button>
            )}
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
        {tab === 'orders' && <OrdersTab
          jumpOrderId={jumpOrderId} onJumpHandled={() => setJumpOrderId(null)}
          initialStatus={dashNavStatus} initialLeadSource={dashNavLeadSource} initialPaymentStatus={dashNavPayment}
          onInitialFiltersHandled={() => { setDashNavStatus(undefined); setDashNavLeadSource(undefined); setDashNavPayment(undefined) }}
        />}
        {tab === 'order-items' && <OrderItemsTab onOpenOrder={handleOpenOrderFromItems} />}
        {tab === 'dashboard' && <DashboardTab onNavigateOrders={handleNavigateOrders} />}
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

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onDone={() => {
            setTab('orders')
            operationsApi.getStats().then(s => { setStats(s); setPendingCount(s.pending_orders||0) }).catch(()=>{})
          }}
        />
      )}

      {showPending && (
        <PendingOrdersPanel
          onClose={() => { setShowPending(false); operationsApi.getStats().then(s => { setStats(s); setPendingCount(s.pending_orders||0) }).catch(()=>{}) }}
          onOpenOrder={(orderId) => { setShowPending(false); setTab('orders') }}
        />
      )}
    </div>
  )
}
