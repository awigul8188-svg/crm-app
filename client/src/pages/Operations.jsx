import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { operationsApi, api } from '../api'
import Modal from '../components/Modal'
import ImportModal from '../components/ImportModal'
import SearchableSelect from '../components/SearchableSelect'
import MultiSelect from '../components/MultiSelect'
import { Search, Plus, Edit2, Trash2, Package, Users, Truck, RotateCcw, ChevronRight, X, AlertCircle, List, ClipboardList, Upload, DollarSign, CreditCard, CheckCircle2, Info } from 'lucide-react'

const BRAND = '#00D4C8'

const ORDER_STATUSES   = ['Order placed', 'In Process', 'On Hold', 'Shipped to US', 'Received in US', 'Shipped to customer', 'Delivered', 'Refunded', 'Cancelled', 'RMA']
const LEAD_SOURCES     = ['Chat Lead', 'Email Lead', 'Call Lead', 'RFQ', 'RFQ Lead', 'Repeat', 'Outbound', 'PPC', 'Online', 'Chat']
const PAYMENT_STATUSES = ['CC Charged', 'Wire Received', 'Net']
// Customer payment terms → number of days until due. Picking a term auto-fills the order's Due Date.
const NET_TERMS = [
  { label: 'Due on receipt', days: 0 },
  { label: 'Net 7',  days: 7 },
  { label: 'Net 10', days: 10 },
  { label: 'Net 15', days: 15 },
  { label: 'Net 30', days: 30 },
  { label: 'Net 45', days: 45 },
  { label: 'Net 60', days: 60 },
]
// Add `days` to a YYYY-MM-DD date and return YYYY-MM-DD (UTC-safe, no timezone drift).
function addDays(dateStr, days) {
  if (!dateStr) return ''
  const d = new Date(`${dateStr}T00:00:00Z`)
  if (isNaN(d.getTime())) return ''
  d.setUTCDate(d.getUTCDate() + (Number(days) || 0))
  return d.toISOString().slice(0, 10)
}
const SHIPPED_VIA      = ['FedEx', 'UPS', 'USPS', 'Customer Account']
const RMA_STATUSES     = ['Initiated', 'In Review', 'Approved', 'Denied', 'Completed']
const PAYMENT_METHODS  = ['Pending', 'Wire Transferred', 'Paid via CC', 'Paid via PayPal', 'Net']
const RECEIVE_METHODS  = ['Wire', 'Credit Card', 'PayPal', 'Check', 'Cash', 'Zelle', 'Other']
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
    <div className="fin-card" style={{ borderLeftColor: color || BRAND, padding: '14px 16px', flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || '#0f172a', fontVariantNumeric: 'tabular-nums', fontFamily: '"Bricolage Grotesque", sans-serif' }}>{value}</div>
    </div>
  )
}

function Loader() {
  return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div style={{ width: 28, height: 28, border: '3px solid #e2e8f0', borderTopColor: BRAND, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /></div>
}

// Pill switch for binary state (Galaxy: giant-swan → brand). on = checked.
function Toggle({ checked, onChange, disabled }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={!!checked} disabled={disabled}
        onChange={e => onChange && onChange(e.target.checked)} />
      <span className="track" />
    </label>
  )
}

// Bouncing-dots loader for inline / button busy states (Galaxy: silent-quail → brand).
function Dots({ onBrand }) {
  return <span className={`dots-loader${onBrand ? ' on-brand' : ''}`} role="status" aria-label="Loading"><span /><span /><span /></span>
}

// Shimmering placeholder rows shown while a table tab is fetching.
function SkeletonRows({ rows = 7, cols = 5 }) {
  return (
    <div style={{ padding: '6px 0' }} aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'flex', gap: 16, padding: '13px 16px', alignItems: 'center', borderBottom: '1px solid #f8fafc' }}>
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="skeleton" style={{ height: 12, flex: c === 0 ? 2.2 : 1, opacity: 1 - r * 0.07 }} />
          ))}
        </div>
      ))}
    </div>
  )
}

// Rounded search field with inline icon (Galaxy: kind-treefrog → brand).
function SearchPill({ value, onChange, placeholder, style }) {
  return (
    <div className="search-pill" style={style}>
      <Search size={15} className="search-icon" />
      <input value={value} onChange={onChange} placeholder={placeholder} />
    </div>
  )
}

// ── Toast feedback ────────────────────────────────────────────────────────────
// Module-level emitter so any handler can fire a toast: toast('Saved', 'success').
const _toastSubs = new Set()
let _toastSeq = 0
function toast(message, type = 'success') {
  const t = { id: ++_toastSeq, message, type }
  _toastSubs.forEach(fn => fn(t))
}
const TOAST_STYLE = {
  success: { bg: '#ecfdf5', bd: '#a7f3d0', fg: '#065f46', Icon: CheckCircle2 },
  error:   { bg: '#fef2f2', bd: '#fecaca', fg: '#991b1b', Icon: AlertCircle },
  info:    { bg: '#eff6ff', bd: '#bfdbfe', fg: '#1e40af', Icon: Info },
}
// ── Confirm dialog ────────────────────────────────────────────────────────────
// Promise-based styled confirm. Usage: if (!await confirmAction({ title, message, danger })) return
const _confirmSubs = new Set()
function confirmAction(opts = {}) {
  return new Promise(resolve => {
    if (!_confirmSubs.size) { resolve(window.confirm(opts.message || opts.title || 'Are you sure?')); return }
    _confirmSubs.forEach(fn => fn({ ...opts, resolve }))
  })
}
function ConfirmHost() {
  const [active, setActive] = useState(null)
  useEffect(() => {
    const open = (o) => setActive(o)
    _confirmSubs.add(open)
    return () => _confirmSubs.delete(open)
  }, [])
  useEffect(() => {
    if (!active) return
    const h = (e) => { if (e.key === 'Escape') { active.resolve(false); setActive(null) } }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [active])
  if (!active) return null
  const close = (val) => { active.resolve(val); setActive(null) }
  const danger = active.danger !== false
  return createPortal(
    <div onClick={() => close(false)} style={{ position: 'fixed', inset: 0, zIndex: 100001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(10,10,10,0.30)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}>
      <div onClick={e => e.stopPropagation()} className="modal-in" style={{ background: '#fff', borderRadius: 16, padding: '22px 24px', width: '100%', maxWidth: 380, boxShadow: '0 24px 60px rgba(0,0,0,0.22)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: danger ? '#fef2f2' : '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertCircle size={20} color={danger ? '#dc2626' : '#2563eb'} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{active.title || 'Are you sure?'}</div>
            {active.message && <div style={{ fontSize: 13, color: '#64748b', marginTop: 3, lineHeight: 1.5 }}>{active.message}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={() => close(false)}>{active.cancelLabel || 'Cancel'}</button>
          <button className={danger ? 'btn btn-danger' : 'btn btn-primary'} onClick={() => close(true)}>{active.confirmLabel || 'Confirm'}</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
function ToastHost() {
  const [items, setItems] = useState([])
  useEffect(() => {
    const add = (t) => {
      setItems(list => [...list, t])
      setTimeout(() => setItems(list => list.filter(x => x.id !== t.id)), 3400)
    }
    _toastSubs.add(add)
    return () => _toastSubs.delete(add)
  }, [])
  const dismiss = id => setItems(list => list.filter(x => x.id !== id))
  return createPortal(
    <div style={{ position: 'fixed', top: 18, right: 18, zIndex: 100002, display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none' }}>
      {items.map(t => {
        const s = TOAST_STYLE[t.type] || TOAST_STYLE.success
        return (
          <div key={t.id} className="slide-down" style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 10, minWidth: 240, maxWidth: 400,
            background: s.bg, border: `1px solid ${s.bd}`, color: s.fg, borderRadius: 12, padding: '11px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.10)', fontSize: 13, fontWeight: 600 }}>
            <s.Icon size={16} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{t.message}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" style={{ background: 'none', border: 'none', cursor: 'pointer', color: s.fg, opacity: 0.55, display: 'flex', padding: 0 }}><X size={14} /></button>
          </div>
        )
      })}
    </div>,
    document.body
  )
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
  // Advanced financial fields hidden by default (auto-open when editing an order that has any set)
  const [showMore, setShowMore] = useState(!!(order && (order.tax_charged || order.shipping_charged || order.cc_charges || order.customer_paid || order.rma_amount)))

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

  // Payment terms ⇄ due date: picking a term (or changing the order date) auto-fills the due date.
  const termDays = (label) => NET_TERMS.find(t => t.label === label)?.days
  const onTermsChange = (label) => setForm(f => {
    const days = termDays(label)
    return { ...f, net: label, due_date: (days !== undefined && f.order_date) ? addDays(f.order_date, days) : f.due_date }
  })
  const onOrderDateChange = (val) => setForm(f => {
    const days = termDays(f.net)
    return { ...f, order_date: val, due_date: (days !== undefined && val) ? addDays(val, days) : f.due_date }
  })

  const handleSave = async () => {
    if (!form.order_number.trim()) { setErr('Order number is required'); return }
    setSaving(true); setErr('')
    try {
      const saved = order ? await operationsApi.updateOrder(order.id, form) : await operationsApi.createOrder(form)
      toast(order ? 'Order updated' : 'Order created')
      onSave(saved)
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  return (
    <Modal title={isPending ? `Complete Order — ${order?.order_number}` : order ? `Edit ${order.order_number}` : 'New Order'} onClose={onClose} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Order */}
        <div>
          <SectionLabel>Order</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <FF label="Order Number" third><input className="input" value={form.order_number} onChange={e => set('order_number', e.target.value)} placeholder="TA001234" /></FF>
            <FF label="Order Date" third><input className="input" type="date" value={form.order_date} onChange={e => onOrderDateChange(e.target.value)} /></FF>
            <FF label="Payment Terms" third>
              <select className="input" value={form.net} onChange={e => onTermsChange(e.target.value)}>
                <option value="">—</option>
                {form.net && !NET_TERMS.some(t => t.label === form.net) && <option value={form.net}>{form.net} (custom)</option>}
                {NET_TERMS.map(t => <option key={t.label}>{t.label}</option>)}
              </select>
            </FF>
            <FF label="Due Date" third>
              <input className="input" type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
              {termDays(form.net) !== undefined && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>Auto-set from terms · editable</div>}
            </FF>
          </div>
        </div>

        {/* Customer */}
        <div>
          <SectionLabel>Customer</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <FF label="Customer" half>
              {addingCustomer ? (
                <div style={{ border: '1px solid #00D4C8', borderRadius: 10, padding: '10px 12px', background: '#f0fffe', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: BRAND, textTransform: 'uppercase', letterSpacing: '0.08em' }}>New Customer</div>
                  <input className="input" placeholder="Name *" value={newCust.name} onChange={e => setNewCust(p => ({...p, name: e.target.value}))} autoFocus />
                  <input className="input" placeholder="Email" value={newCust.email} onChange={e => setNewCust(p => ({...p, email: e.target.value}))} />
                  <input className="input" placeholder="Phone" value={newCust.phone} onChange={e => setNewCust(p => ({...p, phone: e.target.value}))} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-primary" style={{ flex: 1, padding: '6px 0', fontSize: 12 }} onClick={handleAddCustomer} disabled={custSaving || !newCust.name.trim()}>{custSaving ? <Dots onBrand /> : 'Add Customer'}</button>
                    <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setAddingCustomer(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <SearchableSelect
                      items={[
                        ...opsCustomers.map(c => ({ value: String(c.id), label: c.name, sub: c.email || '', group: 'Operations Customers' })),
                        ...crmCustomers.filter(c => !opsCustomers.some(o => o.email && o.email === c.email))
                          .map(c => ({ value: `crm_${c.id}`, label: c.name, sub: c.email || '', group: 'CRM Customers (import on select)' })),
                      ]}
                      value={form.customer_id}
                      onChange={v => handleCustomerSelect(v)}
                      placeholder="— select customer —"
                      emptyText="No customers"
                    />
                  </div>
                  <button type="button" title="Add new customer" onClick={() => setAddingCustomer(true)}
                    style={{ padding: '0 12px', background: BRAND, border: 'none', borderRadius: 8, cursor: 'pointer', color: '#fff', fontWeight: 700, fontSize: 18, flexShrink: 0 }}>+</button>
                </div>
              )}
            </FF>
            <FF label="Email" half><input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="customer@email.com" /></FF>
          </div>
        </div>

        {/* Status & Routing */}
        <div>
          <SectionLabel>Status &amp; Routing</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <FF label="Rep" third>
              <select className="input" value={form.rep} onChange={e => set('rep', e.target.value)}>
                <option value="">—</option>
                {REPS.map(r => <option key={r}>{r}</option>)}
              </select>
            </FF>
            <FF label="PPC Order Rep" third>
              <select className="input" value={form.ppc_order_rep} onChange={e => set('ppc_order_rep', e.target.value)}>
                <option value="">—</option>
                {REPS.filter(r => r !== 'Online').map(r => <option key={r}>{r}</option>)}
              </select>
            </FF>
            <FF label="Buyer" third>
              <select className="input" value={form.buyer} onChange={e => set('buyer', e.target.value)}>
                <option value="">—</option>
                {BUYERS.map(b => <option key={b}>{b}</option>)}
              </select>
            </FF>
            <FF label="Lead Source" third>
              <select className="input" value={form.lead_source} onChange={e => set('lead_source', e.target.value)}>
                <option value="">—</option>
                {LEAD_SOURCES.map(s => <option key={s}>{s}</option>)}
              </select>
            </FF>
            <FF label="Order Status" third>
              <select className="input" value={form.order_status} onChange={e => set('order_status', e.target.value)}>
                {ORDER_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </FF>
            <FF label="Payment Status" third>
              <select className="input" value={form.payment_status} onChange={e => set('payment_status', e.target.value)}>
                <option value="">—</option>
                {PAYMENT_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </FF>
          </div>
        </div>

        {/* Shipping */}
        <div>
          <SectionLabel>Shipping</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <FF label="Shipped Via" half>
              <select className="input" value={form.shipped_via} onChange={e => set('shipped_via', e.target.value)}>
                <option value="">—</option>
                {SHIPPED_VIA.map(s => <option key={s}>{s}</option>)}
              </select>
            </FF>
            <FF label="Tracking to Customer" half><input className="input" value={form.tracking_to_customer} onChange={e => set('tracking_to_customer', e.target.value)} placeholder="1Z999..." /></FF>
          </div>
        </div>

        {/* Advanced financial details — hidden by default */}
        <div>
          <button type="button" onClick={() => setShowMore(s => !s)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, fontWeight: 700, color: BRAND, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {showMore ? '▾ Hide financial details' : '▸ More details — charges, terms, RMA'}
          </button>
          {showMore && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 14 }}>
              <FF label="Tax Charged ($)" third><input className="input" type="number" value={form.tax_charged} onChange={e => set('tax_charged', e.target.value)} placeholder="0.00" /></FF>
              <FF label="Shipping Charged ($)" third><input className="input" type="number" value={form.shipping_charged} onChange={e => set('shipping_charged', e.target.value)} placeholder="0.00" /></FF>
              <FF label="CC Charges ($)" third><input className="input" type="number" value={form.cc_charges} onChange={e => set('cc_charges', e.target.value)} placeholder="0.00" /></FF>
              <FF label="RMA Amount ($)" third><input className="input" type="number" value={form.rma_amount} onChange={e => set('rma_amount', e.target.value)} placeholder="0.00" /></FF>
            </div>
          )}
        </div>

        {/* Notes */}
        <FF label="Notes"><textarea className="input" value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Internal notes..." style={{ resize: 'vertical' }} /></FF>
      </div>

      {err && <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginTop: 12 }}>{err}</div>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? <Dots onBrand /> :order ? 'Save Changes' : 'Create Order'}</button>
      </div>
    </Modal>
  )
}

// ── Order Item Form ───────────────────────────────────────────────────────────
function ItemForm({ item, orderId, orderDate, suppliers: suppliersProp, onSave, onClose }) {
  const blank = { part_number: '', description: '', product: '', supplier_id: '', quantity: 1,
    product_condition: '', selling: '', buying: '', cc_paid: '', tax_paid: '', shipping_paid: '',
    duty_paid: '', paid_to_supplier: '', payment_method: '', payment_due: '', supplier_terms: '',
    tracking_to_warehouse: '', ta_po_number: '', serials: '', line_status: 'processed' }
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

  // Supplier terms → payment-due date (= order date + N days). Editable afterward.
  const onSupplierTerms = (label) => setForm(f => {
    const days = NET_TERMS.find(t => t.label === label)?.days
    return { ...f, supplier_terms: label, payment_due: (days !== undefined && orderDate) ? addDays(orderDate.slice(0,10), days) : f.payment_due }
  })

  const handleSave = async () => {
    setSaving(true); setErr('')
    try {
      const saved = item ? await operationsApi.updateItem(item.id, form) : await operationsApi.addItem(orderId, form)
      toast(item ? 'Line item updated' : 'Line item added')
      onSave(saved)
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  const totalSelling = (Number(form.selling)||0) * (Number(form.quantity)||0)
  const totalBuying  = (Number(form.buying)||0) * (Number(form.quantity)||0)
    + (Number(form.cc_paid)||0) + (Number(form.tax_paid)||0) + (Number(form.shipping_paid)||0) + (Number(form.duty_paid)||0)

  return (
    <Modal title={item ? 'Edit Line Item' : 'Add Line Item'} onClose={onClose} wide>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <FF label="Line Status">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Toggle checked={(form.line_status || 'processed') === 'processed'}
              onChange={on => set('line_status', on ? 'processed' : 'pending')} />
            <span style={{ fontSize: 13, fontWeight: 700, color: (form.line_status || 'processed') === 'processed' ? '#10b981' : '#f59e0b' }}>
              {(form.line_status || 'processed') === 'processed' ? 'Processed' : 'Pending'}
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 5 }}>Pending lines are excluded from dashboard revenue &amp; GP until set to Processed.</div>
        </FF>

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
                <button className="btn-primary" style={{ flex: 1, padding: '6px 0', fontSize: 12 }} onClick={handleAddSupplier} disabled={supSaving || !newSup.company.trim()}>{supSaving ? <Dots onBrand /> : 'Add Supplier'}</button>
                <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setAddingSupplier(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <SearchableSelect
                  items={localSuppliers.map(s => ({ value: s.id, label: s.company, sub: s.email || s.rep_name || '' }))}
                  value={form.supplier_id}
                  onChange={v => set('supplier_id', v)}
                  placeholder="— select supplier —"
                  emptyText="No suppliers"
                />
              </div>
              <button type="button" title="Add new supplier" onClick={() => setAddingSupplier(true)}
                style={{ padding: '0 12px', background: BRAND, border: 'none', borderRadius: 8, cursor: 'pointer', color: '#fff', fontWeight: 700, fontSize: 18, flexShrink: 0 }}>+</button>
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
        <FF label="Supplier Terms" third>
          <select className="input" value={form.supplier_terms} onChange={e => onSupplierTerms(e.target.value)}>
            <option value="">—</option>
            {form.supplier_terms && !NET_TERMS.some(t => t.label === form.supplier_terms) && <option value={form.supplier_terms}>{form.supplier_terms} (custom)</option>}
            {NET_TERMS.map(t => <option key={t.label}>{t.label}</option>)}
          </select>
        </FF>
        <FF label="Payment Due" third>
          <input className="input" type="date" value={form.payment_due} onChange={e => set('payment_due', e.target.value)} />
          {NET_TERMS.some(t => t.label === form.supplier_terms) && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>Auto-set from terms · editable</div>}
        </FF>

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
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? <Dots onBrand /> :item ? 'Save Changes' : 'Add Item'}</button>
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
    return_shipping_paid: '', notes: '', qb_credit_memo: '', cost_recovered: 1
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
  // GP reduction this RMA will apply to the order — ONLY once status = Completed.
  // = qty×selling − (recovered ? qty×buying : 0) − restocking_fee + return_shipping_paid
  const recovered  = Number(form.cost_recovered) !== 0
  const costBack   = recovered ? (Number(form.return_quantity) || 0) * (Number(selectedItem?.buying) || 0) : 0
  const gpImpact   = returnAmount - costBack - (Number(form.restocking_fee) || 0) + (Number(form.return_shipping_paid) || 0)
  const isCompleted = form.rma_status === 'Completed'

  const handleSave = async () => {
    if (!form.rma_number.trim()) { setErr('RMA number is required'); return }
    setSaving(true); setErr('')
    try {
      const saved = rma
        ? await operationsApi.updateRMA(rma.id, form)
        : await operationsApi.createRMA(form)
      toast(rma ? 'RMA updated' : 'RMA created')
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

        <FF label="Cost recovered? (goods back to vendor / restocked)" half>
          <select className="input" value={form.cost_recovered} onChange={e => set('cost_recovered', Number(e.target.value))}>
            <option value={1}>Yes — cost recovered (vendor credit / restocked)</option>
            <option value={0}>No — scrapped, we eat the cost</option>
          </select>
        </FF>

        {selectedItem && (
          <div style={{ flex: '1 1 100%', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <div><span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Unit Selling Price</span><div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{fmt(selectedItem.selling)}</div></div>
            <div style={{ color: '#94a3b8', fontSize: 18 }}>×</div>
            <div><span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Qty</span><div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{form.return_quantity}</div></div>
            <div style={{ color: '#94a3b8', fontSize: 18 }}>=</div>
            <div><span style={{ fontSize: 11, fontWeight: 700, color: '#064e3b', textTransform: 'uppercase' }}>Return Amount</span><div style={{ fontSize: 22, fontWeight: 900, color: '#10b981' }}>{fmt(returnAmount)}</div></div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#7c2d12', textTransform: 'uppercase' }}>GP Impact {isCompleted ? '' : '(on Completed)'}</span>
              <div style={{ fontSize: 22, fontWeight: 900, color: gpImpact > 0 ? '#dc2626' : '#10b981' }}>{gpImpact > 0 ? '−' : '+'}{fmt(Math.abs(gpImpact))}</div>
            </div>
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
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? <Dots onBrand /> :rma ? 'Save Changes' : 'Create RMA'}</button>
      </div>
    </Modal>
  )
}

// ── Order Detail Modal ────────────────────────────────────────────────────────
// ── Customer payment (AR receipt) form ───────────────────────────────────────
function PaymentForm({ orderId, payment, onSaved, onClose }) {
  const blank = { amount: '', payment_date: new Date().toISOString().slice(0,10), method: '', reference: '', notes: '' }
  const [form, setForm] = useState(payment ? { ...blank, ...payment, payment_date: payment.payment_date?.slice(0,10) || '' } : blank)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const handleSave = async () => {
    if (!(Number(form.amount) > 0)) { setErr('Enter a payment amount greater than 0'); return }
    setSaving(true); setErr('')
    try {
      if (payment) await operationsApi.updatePayment(payment.id, form)
      else await operationsApi.addPayment(orderId, form)
      toast(payment ? 'Payment updated' : 'Payment recorded')
      onSaved()
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }
  return (
    <Modal title={payment ? 'Edit Payment' : 'Record Payment'} onClose={onClose}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <FF label="Amount Received ($)" half><input className="input" type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" autoFocus /></FF>
        <FF label="Date Received" half><input className="input" type="date" value={form.payment_date} onChange={e => set('payment_date', e.target.value)} /></FF>
        <FF label="Method" half>
          <select className="input" value={form.method} onChange={e => set('method', e.target.value)}>
            <option value="">—</option>
            {RECEIVE_METHODS.map(m => <option key={m}>{m}</option>)}
          </select>
        </FF>
        <FF label="Reference" half><input className="input" value={form.reference} onChange={e => set('reference', e.target.value)} placeholder="txn / check #" /></FF>
        <FF label="Notes"><input className="input" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="optional" /></FF>
      </div>
      {err && <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginTop: 12 }}>{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? <Dots onBrand /> :payment ? 'Save Changes' : 'Record Payment'}</button>
      </div>
    </Modal>
  )
}

// ── Supplier payments (AP) manager for one line item ─────────────────────────
function SupplierPaymentsModal({ item, onClose, onChanged }) {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const blank = { amount: '', payment_date: new Date().toISOString().slice(0,10), method: '', reference: '', notes: '' }
  const [form, setForm] = useState(blank)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const extCost = item.ext_total_buying != null
    ? Number(item.ext_total_buying) || 0
    : (Number(item.buying)||0)*(Number(item.quantity)||0) + (Number(item.cc_paid)||0)+(Number(item.tax_paid)||0)+(Number(item.shipping_paid)||0)+(Number(item.duty_paid)||0)

  const load = () => { setLoading(true); operationsApi.getItemPayments(item.id).then(p => setPayments(p || [])).catch(() => {}).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [])

  const paid = payments.reduce((a, p) => a + (Number(p.amount) || 0), 0)
  const balance = extCost - paid
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const save = async () => {
    if (!(Number(form.amount) > 0)) { setErr('Enter an amount greater than 0'); return }
    setSaving(true); setErr('')
    try {
      if (editId) await operationsApi.updateItemPayment(editId, form)
      else await operationsApi.addItemPayment(item.id, form)
      setForm(blank); setEditId(null); load(); onChanged && onChanged()
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }
  const edit = (p) => { setEditId(p.id); setForm({ amount: p.amount, payment_date: p.payment_date?.slice(0,10) || '', method: p.method || '', reference: p.reference || '', notes: p.notes || '' }) }
  const del = async (id) => { if (!await confirmAction({ title: 'Delete payment?', message: 'This supplier payment record will be removed.', confirmLabel: 'Delete' })) return; try { await operationsApi.deleteItemPayment(id); toast('Supplier payment deleted'); if (editId === id) { setEditId(null); setForm(blank) } load(); onChanged && onChanged() } catch(e) { toast(e.message || 'Could not delete payment', 'error') } }

  const st = balance <= 0.005 && extCost > 0 ? { label: 'Paid', bg: '#dcfce7', color: '#15803d' }
    : paid > 0.005 ? { label: 'Partial', bg: '#fef3c7', color: '#b45309' }
    : { label: 'Unpaid', bg: '#f1f5f9', color: '#64748b' }

  return (
    <Modal title={`Supplier Payments — ${item.part_number || 'line item'}`} onClose={onClose}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <FinCard label="Cost" value={fmt(extCost)} color="#64748b" />
        <FinCard label="Paid" value={fmt(paid)} color="#10b981" />
        <FinCard label="Balance" value={fmt(balance)} color={balance > 0.005 ? '#ef4444' : '#10b981'} />
      </div>
      <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '2px 9px', borderRadius: 100, background: st.bg, color: st.color }}>{st.label}</span>
        {item.supplier_name && <span style={{ fontSize: 12, color: '#64748b' }}>{item.supplier_name}</span>}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', background: '#f8fafc', borderRadius: 12, padding: 12, marginBottom: 12 }}>
        <FF label="Amount ($)" third><input className="input" type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" /></FF>
        <FF label="Date Paid" third><input className="input" type="date" value={form.payment_date} onChange={e => set('payment_date', e.target.value)} /></FF>
        <FF label="Method" third>
          <select className="input" value={form.method} onChange={e => set('method', e.target.value)}>
            <option value="">—</option>{RECEIVE_METHODS.map(m => <option key={m}>{m}</option>)}
          </select>
        </FF>
        <FF label="Reference"><input className="input" value={form.reference} onChange={e => set('reference', e.target.value)} placeholder="txn / wire ref" /></FF>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? '…' : editId ? 'Update' : 'Add Payment'}</button>
          {editId && <button className="btn btn-secondary btn-sm" onClick={() => { setEditId(null); setForm(blank) }}>Cancel</button>}
        </div>
      </div>
      {err && <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 10, padding: '8px 12px', fontSize: 13, marginBottom: 10 }}>{err}</div>}

      {loading ? <Loader /> : payments.length === 0 ? (
        <div style={{ fontSize: 13, color: '#94a3b8', padding: '6px 0' }}>No supplier payments recorded yet.</div>
      ) : (
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <thead><tr style={{ textAlign: 'left', color: '#94a3b8', fontSize: 10, textTransform: 'uppercase' }}>
            <th style={{ padding: '6px 8px' }}>Date</th><th style={{ padding: '6px 8px' }}>Amount</th><th style={{ padding: '6px 8px' }}>Method</th><th style={{ padding: '6px 8px' }}>Ref</th><th /></tr></thead>
          <tbody>
            {payments.map(p => (
              <tr key={p.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: '7px 8px' }}>{fmtDate(p.payment_date)}</td>
                <td style={{ padding: '7px 8px', fontWeight: 700, color: '#10b981' }}>{fmt(p.amount)}</td>
                <td style={{ padding: '7px 8px' }}>{p.method || '—'}</td>
                <td style={{ padding: '7px 8px', color: '#64748b' }}>{p.reference || '—'}</td>
                <td style={{ padding: '7px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button onClick={() => edit(p)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}><Edit2 size={13} /></button>
                  <button onClick={() => del(p.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}><Trash2 size={13} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  )
}

function OrderDetail({ orderId, customers, suppliers, onClose, onUpdated }) {
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editOrder, setEditOrder] = useState(false)
  const [addItem, setAddItem] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [addRMA, setAddRMA] = useState(false)
  const [editRMA, setEditRMA] = useState(null)
  const [payments, setPayments] = useState([])
  const [payForm, setPayForm] = useState(null)   // false-y = closed; true = new; object = edit
  const [supPayItem, setSupPayItem] = useState(null)  // line item whose AP payments modal is open

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const o = await operationsApi.getOrder(orderId); setOrder(o)
      const p = await operationsApi.getPayments(orderId); setPayments(p || [])
    }
    catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [orderId])

  const handleDeletePayment = async (id) => {
    if (!await confirmAction({ title: 'Delete payment?', message: 'This customer payment record will be removed.', confirmLabel: 'Delete' })) return
    try { await operationsApi.deletePayment(id); toast('Payment deleted'); load(); onUpdated && onUpdated() }
    catch(e) { toast(e.message || 'Could not delete payment', 'error') }
  }

  useEffect(() => { load() }, [load])

  const handleDeleteItem = async (id) => {
    if (!await confirmAction({ title: 'Delete line item?', message: 'This line item and its amounts will be removed from the order.', confirmLabel: 'Delete' })) return
    try { await operationsApi.deleteItem(id); toast('Line item deleted'); load(); onUpdated && onUpdated() }
    catch(e) { toast(e.message || 'Could not delete line item', 'error') }
  }

  const handleDeleteRMA = async (id) => {
    if (!await confirmAction({ title: 'Delete RMA?', message: 'This RMA record will be removed.', confirmLabel: 'Delete' })) return
    try { await operationsApi.deleteRMA(id); toast('RMA deleted'); load(); onUpdated && onUpdated() }
    catch(e) { toast(e.message || 'Could not delete RMA', 'error') }
  }

  // Move order / line items (or a partial quantity of a line) to the next reporting month
  const [selectedItems, setSelectedItems] = useState([])
  const [moveQty, setMoveQty] = useState({})   // item id → units to move
  const [moving, setMoving] = useState(false)
  const toggleItemSel = (item) => {
    const id = item.id
    if (selectedItems.includes(id)) { setSelectedItems(s => s.filter(x => x !== id)) }
    else { setSelectedItems(s => [...s, id]); setMoveQty(q => ({ ...q, [id]: q[id] ?? item.quantity })) }
  }
  const handleMoveWhole = async () => {
    if (!await confirmAction({ title: 'Move order to next month?', message: 'The whole order moves to the next reporting month.', danger: false, confirmLabel: 'Move' })) return
    setMoving(true)
    try { await operationsApi.moveOrderNext(order.id); toast('Order moved to next month'); setSelectedItems([]); setMoveQty({}); load(); onUpdated && onUpdated() }
    catch(e) { toast(e.message || 'Could not move order', 'error') } finally { setMoving(false) }
  }
  const handleMovePartial = async () => {
    if (!selectedItems.length) return
    const items = selectedItems.map(id => {
      const it = order.items.find(x => x.id === id)
      const q = Math.max(1, Math.min(Number(moveQty[id]) || it.quantity, it.quantity))
      return { id, quantity: q, partial: q < it.quantity }
    })
    const anyPartial = items.some(m => m.partial)
    if (!await confirmAction({ title: 'Move selected items?', message: `Move ${items.length} line item(s)${anyPartial ? ' (some partial quantities)' : ''} to the next month. They split into a new order with the same order #.`, danger: false, confirmLabel: 'Move' })) return
    setMoving(true)
    try { await operationsApi.splitOrderNext(order.id, items.map(({ id, quantity }) => ({ id, quantity }))); toast('Items moved to next month'); setSelectedItems([]); setMoveQty({}); load(); onUpdated && onUpdated() }
    catch(e) { toast(e.message || 'Could not move items', 'error') } finally { setMoving(false) }
  }

  if (!order && loading) return (
    <Modal title="Loading…" onClose={onClose} wide><Loader /></Modal>
  )
  if (!order) return null

  const gp        = Number(order.gp)        || 0
  const remaining = Number(order.remaining) || 0

  const itemCols = [
    { h: 'Part #',        render: i => (
        <button type="button" onClick={() => setEditItem(i)} title="Edit line item"
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600, color: BRAND, fontSize: 'inherit', fontFamily: 'inherit', textAlign: 'left' }}
          onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
          onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>
          {i.part_number || '(no part#)'}
        </button>
      ) },
    { h: 'Status',        render: i => {
        const pending = (i.line_status || 'processed') === 'pending'
        return <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
          padding: '2px 8px', borderRadius: 100, whiteSpace: 'nowrap',
          background: pending ? '#fef3c7' : '#dcfce7', color: pending ? '#b45309' : '#15803d' }}>
          {pending ? 'Pending' : 'Processed'}</span>
      } },
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
            {order.reporting_period && <span style={{ fontSize: 11, fontWeight: 700, color: '#334155', background: '#f1f5f9', borderRadius: 100, padding: '3px 10px' }}>📅 {order.reporting_period}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={handleMoveWhole} disabled={moving} title="Move this whole order to the next month">
              <ChevronRight size={13} /> Move to next month
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setEditOrder(true)}><Edit2 size={13} /> Edit Order</button>
          </div>
        </div>

        {/* Financial summary */}
        <SectionLabel>Financials</SectionLabel>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
          <FinCard label="Order Amount"   value={fmt(order.order_amount)} />
          <FinCard label="Total Value"    value={fmt(order.total_order_value)} />
          <FinCard label="Total Buying"   value={fmt(order.total_buying)} color="#64748b" />
          <FinCard label="RMA Amount"     value={fmt(order.rma_amount)} color="#f59e0b" />
          <FinCard label="GP"             value={fmt(gp)}        color={gp >= 0 ? '#10b981' : '#ef4444'} />
        </div>

        {/* Customer payments (AR) — Received & Balance derive from the payment log below */}
        {(() => {
          const charged = Number(order.total_order_value) || 0
          const received = Number(order.customer_paid) || 0
          const bal = charged - received
          const overdue = bal > 0.005 && order.due_date && new Date(order.due_date) < new Date(new Date().toISOString().slice(0,10))
          const st = bal <= 0.005 && charged > 0 ? { label: 'Paid', bg: '#dcfce7', color: '#15803d' }
            : overdue ? { label: 'Overdue', bg: '#fee2e2', color: '#b91c1c' }
            : received > 0.005 ? { label: 'Partial', bg: '#fef3c7', color: '#b45309' }
            : { label: 'Unpaid', bg: '#f1f5f9', color: '#64748b' }
          return (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <SectionLabel>Customer Payments</SectionLabel>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '2px 9px', borderRadius: 100, background: st.bg, color: st.color }}>{st.label}</span>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => setPayForm(true)}><Plus size={13} /> Record Payment</button>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <FinCard label="Charged" value={fmt(charged)} />
                <FinCard label="Received" value={fmt(received)} color={BRAND} />
                <FinCard label="Balance Due" value={fmt(bal)} color={bal > 0.005 ? '#f59e0b' : '#10b981'} />
              </div>
              {payments.length === 0 ? (
                <div style={{ fontSize: 13, color: '#94a3b8', padding: '6px 0' }}>No payments recorded yet.</div>
              ) : (
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: '#94a3b8', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <th style={{ padding: '6px 8px' }}>Date</th><th style={{ padding: '6px 8px' }}>Amount</th>
                      <th style={{ padding: '6px 8px' }}>Method</th><th style={{ padding: '6px 8px' }}>Reference</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map(p => (
                      <tr key={p.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '7px 8px' }}>{fmtDate(p.payment_date)}</td>
                        <td style={{ padding: '7px 8px', fontWeight: 700, color: '#10b981' }}>{fmt(p.amount)}</td>
                        <td style={{ padding: '7px 8px' }}>{p.method || '—'}</td>
                        <td style={{ padding: '7px 8px', color: '#64748b' }}>{p.reference || '—'}{p.notes ? ` · ${p.notes}` : ''}</td>
                        <td style={{ padding: '7px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button onClick={() => setPayForm(p)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}><Edit2 size={13} /></button>
                          <button onClick={() => handleDeletePayment(p.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}><Trash2 size={13} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )
        })()}

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
          <div style={{ display: 'flex', gap: 8 }}>
            {selectedItems.length > 0 && (
              <button className="btn btn-secondary btn-sm" onClick={handleMovePartial} disabled={moving}
                style={{ background: '#fff7ed', color: '#c2410c', borderColor: '#fed7aa' }}>
                <ChevronRight size={13} /> Move {selectedItems.length} to next month
              </button>
            )}
            <button className="btn btn-primary btn-sm" onClick={() => setAddItem(true)}><Plus size={13} /> Add Item</button>
          </div>
        </div>
        {order.items?.length > 0 ? (
          <div style={{ overflowX: 'auto', marginBottom: 24 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1100 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '8px 10px', width: 28 }}></th>
                  {[...itemCols.map(c => c.h), ''].map((h, hi) => (
                    <th key={h || `blank-${hi}`} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {order.items.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', background: selectedItems.includes(item.id) ? '#fff7ed' : 'transparent' }}>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="checkbox" checked={selectedItems.includes(item.id)} onChange={() => toggleItemSel(item)} title="Select to move to next month" style={{ cursor: 'pointer' }} />
                        {selectedItems.includes(item.id) && item.quantity > 1 && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }} title="Units to move to next month">
                            <input type="number" min={1} max={item.quantity}
                              value={moveQty[item.id] ?? item.quantity}
                              onChange={e => setMoveQty(q => ({ ...q, [item.id]: Math.max(1, Math.min(Number(e.target.value) || 1, item.quantity)) }))}
                              style={{ width: 48, padding: '2px 4px', fontSize: 11, border: '1px solid #fed7aa', borderRadius: 4 }} />
                            <span style={{ fontSize: 10, color: '#94a3b8' }}>of {item.quantity}</span>
                          </span>
                        )}
                      </div>
                    </td>
                    {itemCols.map(c => (
                      <td key={c.h} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{c.render(item)}</td>
                    ))}
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', color: '#10b981' }} title="Supplier payments" onClick={() => setSupPayItem(item)}><DollarSign size={11} /></button>
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
      {payForm && (
        <PaymentForm orderId={order.id} payment={payForm === true ? null : payForm}
          onClose={() => setPayForm(null)}
          onSaved={() => { setPayForm(null); load(); onUpdated && onUpdated() }} />
      )}
      {addItem && (
        <ItemForm orderId={order.id} orderDate={order.order_date} suppliers={suppliers} onClose={() => setAddItem(false)}
          onSave={() => { setAddItem(false); load(); onUpdated && onUpdated() }} />
      )}
      {editItem && (
        <ItemForm item={editItem} orderId={order.id} orderDate={order.order_date} suppliers={suppliers} onClose={() => setEditItem(null)}
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
      {supPayItem && (
        <SupplierPaymentsModal
          item={supPayItem}
          onClose={() => setSupPayItem(null)}
          onChanged={() => { load(); onUpdated && onUpdated() }}
        />
      )}
    </>
  )
}

// ── Orders Tab ────────────────────────────────────────────────────────────────
function OrdersTab({ jumpOrderId, onJumpHandled, initialStatus, initialLeadSource, initialPaymentStatus, initialRep, initialPeriod, onInitialFiltersHandled, resetToken, onSummary }) {
  const [orders, setOrders]       = useState([])
  const [customers, setCustomers] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState(initialStatus || '')
  const [filterRep, setFilterRep]       = useState(initialRep || '')
  const [filterPayment, setFilterPayment] = useState(initialPaymentStatus || '')
  const [filterLeadSource, setFilterLeadSource] = useState(initialLeadSource || '')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo]     = useState('')
  const [filterPeriod, setFilterPeriod]     = useState(initialPeriod || '')

  // Reset all filters when parent signals (e.g. after reimport)
  useEffect(() => {
    if (!resetToken) return
    setSearch(''); setFilterStatus(''); setFilterRep(''); setFilterPayment('')
    setFilterLeadSource(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterPeriod('')
  }, [resetToken])
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

  useEffect(() => {
    if (initialRep !== undefined) { setFilterRep(initialRep || ''); onInitialFiltersHandled && onInitialFiltersHandled() }
  }, [initialRep])

  useEffect(() => {
    if (initialPeriod !== undefined) { setFilterPeriod(initialPeriod || ''); onInitialFiltersHandled && onInitialFiltersHandled() }
  }, [initialPeriod])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [o, c, s] = await Promise.all([
        operationsApi.getOrders({ search, status: filterStatus, rep: filterRep, lead_source: filterLeadSource, payment_status: filterPayment, date_from: filterDateFrom, date_to: filterDateTo, reporting_period: filterPeriod }),
        operationsApi.getCustomers(),
        operationsApi.getSuppliers(),
      ])
      setOrders(o); setCustomers(c); setSuppliers(s)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [search, filterStatus, filterRep, filterLeadSource, filterPayment, filterDateFrom, filterDateTo, filterPeriod])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id) => {
    if (!await confirmAction({ title: 'Delete order?', message: 'This order and all of its line items will be permanently removed.', confirmLabel: 'Delete order' })) return
    try { await operationsApi.deleteOrder(id); toast('Order deleted'); load() }
    catch(e) { toast(e.message || 'Could not delete order', 'error') }
  }

  const orderTotals = orders.reduce((a, o) => ({
    amt: a.amt + (Number(o.order_amount) || 0),
    val: a.val + (Number(o.total_order_value) || 0),
    gp:  a.gp  + (Number(o.gp) || 0),
    rem: a.rem + (Number(o.remaining) || 0),
  }), { amt: 0, val: 0, gp: 0, rem: 0 })

  // Report the filtered-list summary up so the page header mirrors exactly what's shown below.
  useEffect(() => {
    if (onSummary) onSummary({ count: orders.length, ...orderTotals })
  }, [orders])

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
        <select className="input" style={{ flex: '0 0 120px' }} value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}>
          <option value="">All Months</option>
          {['Jan-26','Feb-26','Mar-26','Apr-26','May-26','Jun-26'].map(p => <option key={p}>{p}</option>)}
        </select>
        <select className="input" style={{ flex: '0 0 130px' }} value={filterRep} onChange={e => setFilterRep(e.target.value)}>
          <option value="">All Reps</option>
          {REPS.map(r => <option key={r}>{r}</option>)}
        </select>
        <select className="input" style={{ flex: '0 0 150px' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {ORDER_STATUSES.map(s => <option key={s}>{s}</option>)}
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
        {(search || filterStatus || filterRep || filterPayment || filterLeadSource || filterDateFrom || filterDateTo || filterPeriod) && (
          <button className="btn-secondary" style={{ padding: '0 14px', fontSize: 12 }}
            onClick={() => { setSearch(''); setFilterStatus(''); setFilterRep(''); setFilterPayment(''); setFilterLeadSource(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterPeriod('') }}>
            Clear filters
          </button>
        )}
      </div>

      {loading ? <SkeletonRows cols={6} /> : orders.length === 0 ? (
        <EmptyState icon={Package} label="Orders" action={<button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={14} /> New Order</button>} />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr className="table-header">
                {[{h:'Order #'},{h:'Date'},{h:'Customer'},{h:'Rep'},{h:'Status'},{h:'Order Amt',num:1},{h:'Total Value',num:1},{h:'GP',num:1},{h:'Remaining',num:1},{h:''}].map(c => (
                  <th key={c.h} className="table-cell" style={{ whiteSpace: 'nowrap', textAlign: c.num ? 'right' : 'left' }}>{c.h}</th>
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
                    <td className="table-cell" style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{fmt(o.order_amount)}</td>
                    <td className="table-cell" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, textAlign: 'right' }}>{fmt(o.total_order_value)}</td>
                    <td className="table-cell" style={{ fontWeight: 700, color: gp >= 0 ? '#10b981' : '#ef4444', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{fmt(gp)}</td>
                    <td className="table-cell" style={{ color: rem > 0 ? '#f59e0b' : '#10b981', fontWeight: 600, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{fmt(rem)}</td>
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
            <tfoot>
              <tr style={{ position: 'sticky', bottom: 0, background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                <td className="table-cell" colSpan={5} style={{ fontWeight: 700, color: '#475569' }}>{orders.length} order{orders.length === 1 ? '' : 's'}</td>
                <td className="table-cell" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: '#475569' }}>{fmt(orderTotals.amt)}</td>
                <td className="table-cell" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{fmt(orderTotals.val)}</td>
                <td className="table-cell" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 800, color: orderTotals.gp >= 0 ? '#10b981' : '#ef4444' }}>{fmt(orderTotals.gp)}</td>
                <td className="table-cell" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: orderTotals.rem > 0 ? '#f59e0b' : '#10b981' }}>{fmt(orderTotals.rem)}</td>
                <td className="table-cell" />
              </tr>
            </tfoot>
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
      toast(form.id ? `${label.slice(0,-1)} updated` : `${label.slice(0,-1)} added`)
      setForm(null); load()
    } catch(e) { toast(e.message || 'Could not save', 'error') }
  }

  const handleDelete = async (id) => {
    if (!await confirmAction({ title: `Delete ${label.slice(0,-1).toLowerCase()}?`, message: 'This record will be permanently removed.', confirmLabel: 'Delete' })) return
    try { await deleteFn(id); toast(`${label.slice(0,-1)} deleted`); load() } catch(e) { toast(e.message || 'Could not delete', 'error') }
  }

  const blankForm = () => {
    const b = {}; fields.forEach(f => { b[f.key] = '' }); setForm(b)
  }

  const primaryField = fields[0]

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <SearchPill style={{ flex: 1, minWidth: 200 }} placeholder={`Search ${label.toLowerCase()}…`} value={search} onChange={e => setSearch(e.target.value)} />
        <button className="btn btn-primary" onClick={blankForm}><Plus size={15} /> Add {label.slice(0,-1)}</button>
      </div>

      {loading ? <SkeletonRows cols={6} /> : rows.length === 0 ? (
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
    if (!await confirmAction({ title: 'Delete line item?', message: 'This line item and its amounts will be removed.', confirmLabel: 'Delete' })) return
    try { await operationsApi.deleteItem(id); toast('Line item deleted'); load(search) }
    catch(e) { toast(e.message || 'Could not delete line item', 'error') }
  }

  const cols = [
    { key: 'order_number',       label: 'Order #',      render: r => (
      <button onClick={() => onOpenOrder(r.order_id)} style={{ color: BRAND, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13 }}>{r.order_number || '—'}</button>
    )},
    { key: 'part_number',        label: 'Part #',       render: r => (
      <button onClick={() => setEditItem(r)} title="Edit line item" style={{ color: BRAND, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, textAlign: 'left' }}
        onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>{r.part_number || '(no part#)'}</button>
    )},
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
        <SearchPill style={{ flex: 1 }} placeholder="Search by part #, description, order #, supplier…" value={search} onChange={e => setSearch(e.target.value)} />
        <span style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>{rows.length} items</span>
      </div>

      {loading ? <SkeletonRows cols={6} /> : rows.length === 0 ? (
        <EmptyState icon={List} label="Order Items" action={null} />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1400 }}>
            <thead>
              <tr className="table-header">
                {cols.map(c => <th key={c.key} className="table-cell" style={{ whiteSpace: 'nowrap', textAlign: c.num ? 'right' : 'left' }}>{c.label}</th>)}
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
                      <td key={c.key} className="table-cell" style={{ fontWeight: c.bold ? 600 : 400, color, textAlign: c.num ? 'right' : 'left', fontVariantNumeric: c.num ? 'tabular-nums' : undefined, whiteSpace: c.key === 'serials' ? 'pre-wrap' : 'nowrap', maxWidth: c.key === 'serials' ? 140 : undefined, overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
        <ItemForm item={editItem} orderId={editItem.order_id} orderDate={editItem.order_date} suppliers={suppliers}
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
    if (!await confirmAction({ title: 'Delete RMA?', message: 'This RMA record will be removed.', confirmLabel: 'Delete' })) return
    try { await operationsApi.deleteRMA(id); toast('RMA deleted'); load() }
    catch(e) { toast(e.message || 'Could not delete RMA', 'error') }
  }

  const rmaTotals = rmas.reduce((a, r) => ({
    ret:     a.ret     + (Number(r.return_amount) || 0),
    refund:  a.refund  + (Number(r.refund_issued) || 0),
    restock: a.restock + (Number(r.restocking_fee) || 0),
  }), { ret: 0, refund: 0, restock: 0 })

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <SearchPill style={{ flex: 1, minWidth: 200 }} placeholder="Search RMA #, customer, order…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input" style={{ width: 180 }} value={statusFilter} onChange={e => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {RMA_STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <button className="btn btn-primary" onClick={() => setFormRMA({})}><Plus size={15} /> New RMA</button>
      </div>

      {loading ? <SkeletonRows cols={6} /> : rmas.length === 0 ? (
        <EmptyState icon={RotateCcw} label="RMAs" action={<button className="btn btn-primary" onClick={() => setFormRMA({})}><Plus size={14} /> New RMA</button>} />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr className="table-header">
                {[{h:'RMA #'},{h:'Order'},{h:'Return Item'},{h:'Qty',num:1},{h:'Unit Price',num:1},{h:'Return Amount',num:1},{h:'Customer'},{h:'Reason'},{h:'Status'},{h:'Refund',num:1},{h:'Restocking',num:1},{h:'Issue Date'},{h:'QB Memo'},{h:''}].map(c => (
                  <th key={c.h} className="table-cell" style={{ whiteSpace: 'nowrap', textAlign: c.num ? 'right' : 'left' }}>{c.h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rmas.map(r => (
                <tr key={r.id} className="table-row">
                  <td className="table-cell" style={{ fontWeight: 700, color: '#dc2626' }}>{r.rma_number}</td>
                  <td className="table-cell" style={{ color: BRAND, fontWeight: 600 }}>{r.order_number || '—'}</td>
                  <td className="table-cell" style={{ color: '#475569' }}>{r.return_item_part ? `${r.return_item_part}${r.return_item_desc ? ` — ${r.return_item_desc}` : ''}` : '—'}</td>
                  <td className="table-cell" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.return_quantity}</td>
                  <td className="table-cell" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.unit_selling_price)}</td>
                  <td className="table-cell" style={{ fontWeight: 700, color: '#10b981', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.return_amount)}</td>
                  <td className="table-cell">{r.customer_name || r.email || '—'}</td>
                  <td className="table-cell" style={{ color: '#64748b', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.return_reason || '—'}</td>
                  <td className="table-cell"><StatusBadge status={r.rma_status} styleMap={RMA_STATUS_STYLE} /></td>
                  <td className="table-cell" style={{ color: '#dc2626', fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.refund_issued)}</td>
                  <td className="table-cell" style={{ color: '#64748b', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.restocking_fee)}</td>
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
            <tfoot>
              <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                <td className="table-cell" colSpan={5} style={{ fontWeight: 700, color: '#475569' }}>{rmas.length} RMA{rmas.length === 1 ? '' : 's'}</td>
                <td className="table-cell" style={{ textAlign: 'right', fontWeight: 700, color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>{fmt(rmaTotals.ret)}</td>
                <td className="table-cell" colSpan={3} />
                <td className="table-cell" style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>{fmt(rmaTotals.refund)}</td>
                <td className="table-cell" style={{ textAlign: 'right', fontWeight: 700, color: '#475569', fontVariantNumeric: 'tabular-nums' }}>{fmt(rmaTotals.restock)}</td>
                <td className="table-cell" colSpan={3} />
              </tr>
            </tfoot>
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
const MONTH_ABBR = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmtMonthLabel(raw) {
  // "2024-03" → "Mar 24"
  if (!raw) return raw
  const m = String(raw).match(/^(\d{4})-(\d{2})$/)
  if (!m) return raw
  const yr = m[1].slice(2)
  const mo = parseInt(m[2])
  return `${MONTH_ABBR[mo] || mo} ${yr}`
}

function BarChart({ data, valueKey, labelKey, color, fmtFn, height = 140, isMonth }) {
  if (!data?.length) return <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 24 }}>No data</div>
  const max = Math.max(...data.map(d => d[valueKey] || 0))
  if (max === 0) return <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 24 }}>No data</div>
  const minBarW = data.length > 24 ? 28 : 36
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height, overflowX: 'auto', paddingBottom: 4 }}>
      {data.map((d, i) => {
        const val = d[valueKey] || 0
        const pct = max > 0 ? (val / max) * 100 : 0
        const label = isMonth ? fmtMonthLabel(d[labelKey]) : d[labelKey]
        return (
          <div key={i} title={`${label}: ${fmtFn ? fmtFn(val) : val}`}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: minBarW, cursor: 'default' }}>
            <div style={{ fontSize: 9, color: '#64748b', marginBottom: 2, textAlign: 'center', lineHeight: 1.2 }}>
              {fmtFn ? fmtFn(val) : val}
            </div>
            <div style={{ width: '80%', background: color || BRAND, borderRadius: '3px 3px 0 0', height: `${Math.max(pct, 2)}%`, minHeight: 4, transition: 'height 0.3s', opacity: 0.85 }} />
            <div style={{ fontSize: 8, color: '#94a3b8', marginTop: 3, textAlign: 'center', whiteSpace: 'nowrap' }}>{label}</div>
          </div>
        )
      })}
    </div>
  )
}

function DashboardCard({ label, value, sub, color, onClick, icon }) {
  return (
    <div onClick={onClick} className={`fin-card${onClick ? ' clickable' : ''}`} style={{
      borderLeftColor: color || BRAND, padding: '18px 20px',
      display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 140
    }}>
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

function DashboardTab({ onNavigateOrders, onDateFilterChange }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]   = useState('')
  const [selectedMonths, setSelectedMonths] = useState([])
  const [periods, setPeriods] = useState([])
  const [closeConfirm, setCloseConfirm] = useState(null) // 'close' | 'reopen' | null
  const [closeLoading, setCloseLoading] = useState(false)
  const [openPeriod, setOpenPeriod] = useState(null)     // current OPEN month (new orders land here)

  const loadPeriods = () => operationsApi.getReportingPeriods().then(setPeriods).catch(() => {})
  const loadOpen = () => operationsApi.getOpenPeriod().then(d => setOpenPeriod(d.open_period)).catch(() => {})

  useEffect(() => { loadPeriods(); loadOpen() }, [])

  // 'Jun-26' → 'Jul-26', 'Dec-26' → 'Jan-27'
  const PERIOD_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const nextPeriodLabel = (period) => {
    if (!period) return ''
    const [mon, yr] = String(period).split('-')
    let idx = PERIOD_MONTHS.indexOf(mon)
    if (idx === -1 || yr === undefined) return ''
    let year = parseInt(yr, 10); idx += 1
    if (idx > 11) { idx = 0; year += 1 }
    return `${PERIOD_MONTHS[idx]}-${String(year).padStart(2, '0')}`
  }

  const load = (from, to, months) => {
    setLoading(true)
    const params = {}
    if (months && months.length) { params.reporting_period = months.join(',') }
    else { if (from) params.date_from = from; if (to) params.date_to = to }
    operationsApi.getDashboard(params).then(setData).catch(() => {}).finally(() => setLoading(false))
    if (onDateFilterChange) onDateFilterChange(from, to)
  }

  useEffect(() => { load('', '', []) }, [])

  // Quarters derived from the available reporting periods (e.g. Apr-26/May-26/Jun-26 → Q2-26).
  const QUARTER_OF = { Jan: 'Q1', Feb: 'Q1', Mar: 'Q1', Apr: 'Q2', May: 'Q2', Jun: 'Q2',
    Jul: 'Q3', Aug: 'Q3', Sep: 'Q3', Oct: 'Q4', Nov: 'Q4', Dec: 'Q4' }
  const quarters = (() => {
    const map = {}
    periods.forEach(p => {
      const [mon, yr] = p.reporting_period.split('-')
      const q = QUARTER_OF[mon]; if (!q) return
      const key = `${q}-${yr}`
      ;(map[key] = map[key] || []).push(p.reporting_period)
    })
    return Object.entries(map).map(([label, months]) => ({ label, months })).sort((a, b) => a.label.localeCompare(b.label))
  })()
  // Quarter labels currently fully covered by the month selection (drives the Quarters dropdown).
  const selectedQuarterLabels = quarters.filter(q => q.months.length && q.months.every(m => selectedMonths.includes(m))).map(q => q.label)
  const applyMonths = (months) => { setSelectedMonths(months); setDateFrom(''); setDateTo(''); load('', '', months) }
  const onQuartersChange = (newLabels) => {
    const added = newLabels.filter(l => !selectedQuarterLabels.includes(l))
    const removed = selectedQuarterLabels.filter(l => !newLabels.includes(l))
    let months = [...selectedMonths]
    quarters.forEach(q => {
      if (added.includes(q.label)) months = [...new Set([...months, ...q.months])]
      if (removed.includes(q.label)) months = months.filter(m => !q.months.includes(m))
    })
    applyMonths(months)
  }

  const handleApply = () => load(dateFrom, dateTo, [])
  const handleClear = () => {
    setDateFrom(''); setDateTo(''); setSelectedMonths([])
    load('', '', [])
  }

  const handleCloseOpenMonth = async () => {
    setCloseLoading(true)
    try {
      await operationsApi.closeMonth()
      await Promise.all([loadOpen(), loadPeriods()])
      load('', '', selectedMonths)
      toast('Month closed')
    } catch(e) { toast(e.message || 'Could not close month', 'error') }
    setCloseLoading(false); setCloseConfirm(null)
  }
  const handleReopenLast = async () => {
    setCloseLoading(true)
    try {
      await operationsApi.reopenMonth()
      await Promise.all([loadOpen(), loadPeriods()])
      load('', '', selectedMonths)
    } catch(e) {}
    setCloseLoading(false); setCloseConfirm(null)
  }

  if (loading) return <Loader />
  if (!data) return <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Failed to load dashboard</div>

  const { kpis, byMonth, byRep, bySource, byBuyer, byStatus, byLeadSource, topCustomers, byPayment } = data
  const gpMargin = kpis.gp_margin_pct ? `${kpis.gp_margin_pct.toFixed(1)}%` : '—'

  // Marketing metrics — specific lead sources shown individually + a combined total.
  // Matchers are mutually exclusive so the Total never double-counts a source.
  const MKT_BUCKETS = [
    { label: 'Chat',       match: s => /chat/i.test(s || '') && !/lead/i.test(s || '') }, // website-closed chat orders
    { label: 'Chat Lead',  match: s => /chat/i.test(s || '') && /lead/i.test(s || '') },  // chat-originated, rep-closed
    { label: 'Call Lead',  match: s => /call|inbound/i.test(s || '') },                    // 'Call lead' + 'Inbound call'
    { label: 'RFQ Lead',   match: s => /rfq|form/i.test(s || '') },                         // 'RFQ Lead' + 'Web RFQ Lead' + 'Form lead'
    { label: 'Email Lead', match: s => /email/i.test(s || '') },
    { label: 'Online',     match: s => /online/i.test(s || '') },
  ]
  const sum = (arr, k) => arr.reduce((a, r) => a + (r[k] || 0), 0)
  const marketingRows = MKT_BUCKETS.map(b => {
    const rs = (bySource || []).filter(r => b.match(r.lead_source))
    return { label: b.label, order_count: sum(rs, 'order_count'), revenue: sum(rs, 'revenue'), gp: sum(rs, 'gp') }
  })
  const marketingTotal = {
    order_count: sum(marketingRows, 'order_count'),
    revenue: sum(marketingRows, 'revenue'),
    gp: sum(marketingRows, 'gp'),
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: '#fff', border: '1px solid #f1f5f9', borderRadius: 14, padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        {/* Quarters dropdown — selecting a quarter toggles its months */}
        {quarters.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Quarter</span>
            <MultiSelect options={quarters.map(q => q.label)} selected={selectedQuarterLabels} onChange={onQuartersChange} placeholder="All quarters" />
          </div>
        )}

        {/* Months dropdown — multi-select */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Month</span>
          <MultiSelect
            options={periods.map(p => ({ value: p.reporting_period, label: `${p.closed ? '🔒 ' : ''}${p.reporting_period}` }))}
            selected={selectedMonths}
            onChange={applyMonths}
            placeholder="All months"
          />
        </div>

        {periods.length > 0 && <span style={{ color: '#e2e8f0', fontSize: 18, margin: '0 4px' }}>|</span>}

        {/* Date range — hidden when months are selected */}
        {selectedMonths.length === 0 && <>
          <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ flex: '0 0 140px', fontSize: 13 }} />
          <span style={{ color: '#94a3b8', fontSize: 13 }}>—</span>
          <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ flex: '0 0 140px', fontSize: 13 }} />
          <button className="btn btn-primary" onClick={handleApply} style={{ padding: '7px 14px', fontSize: 13 }}>Apply</button>
        </>}

        {(dateFrom || dateTo || selectedMonths.length > 0) && (
          <button className="btn btn-secondary" onClick={handleClear} style={{ padding: '7px 12px', fontSize: 13 }}>Clear</button>
        )}

        {/* Open-month boundary control — close the open month, advancing to the next */}
        {openPeriod && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
              Open month: <span style={{ fontWeight: 800, color: '#0f172a' }}>{openPeriod}</span>
            </span>
            {periods.some(p => p.closed) && (
              <button onClick={() => setCloseConfirm('reopen-last')} style={{ fontSize: 11, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                Reopen last
              </button>
            )}
            <button onClick={() => setCloseConfirm('close-open')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700, background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              🔐 Close {openPeriod} → open {nextPeriodLabel(openPeriod)}
            </button>
          </div>
        )}
      </div>

      {/* Close / Reopen open-month confirmation dialog */}
      {closeConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 440, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>
              {closeConfirm === 'reopen-last' ? 'Reopen previous month?' : `Close ${openPeriod}?`}
            </div>
            <div style={{ fontSize: 14, color: '#64748b', marginBottom: 20, lineHeight: 1.6 }}>
              {closeConfirm === 'reopen-last'
                ? 'This reopens the most recently closed month and makes it the open month again — new orders will go back into it.'
                : <>This finalizes <b>{openPeriod}</b> and opens <b>{nextPeriodLabel(openPeriod)}</b>. New orders will be tagged to <b>{nextPeriodLabel(openPeriod)}</b> from now on. Existing orders stay fully editable.</>}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setCloseConfirm(null)} disabled={closeLoading}>Cancel</button>
              <button onClick={closeConfirm === 'reopen-last' ? handleReopenLast : handleCloseOpenMonth} disabled={closeLoading}
                style={{ padding: '8px 20px', fontSize: 13, fontWeight: 700, background: closeConfirm === 'reopen-last' ? '#00D4C8' : '#dc2626', color: '#fff', border: 'none', borderRadius: 8, cursor: closeLoading ? 'not-allowed' : 'pointer', opacity: closeLoading ? 0.7 : 1 }}>
                {closeLoading ? 'Saving…' : closeConfirm === 'reopen-last' ? 'Yes, Reopen' : `Yes, Close ${openPeriod}`}
              </button>
            </div>
          </div>
        </div>
      )}
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

      {/* AR / AP Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ background: '#fff', border: '1.5px solid #fee2e2', borderRadius: 14, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            AR — Accounts Receivable
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: kpis.ar_outstanding > 0 ? '#dc2626' : '#10b981', fontFamily: '"Bricolage Grotesque", sans-serif' }}>
                {fmt(kpis.ar_outstanding)}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Outstanding (owed to us)</div>
            </div>
            {kpis.ar_partial > 0 && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b', fontFamily: '"Bricolage Grotesque", sans-serif' }}>
                  {fmt(kpis.ar_partial)}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Partially paid</div>
              </div>
            )}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1.5px solid #fef3c7', borderRadius: 14, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            AP — Accounts Payable
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: kpis.ap_outstanding > 0 ? '#d97706' : '#10b981', fontFamily: '"Bricolage Grotesque", sans-serif' }}>
                {fmt(kpis.ap_outstanding)}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Outstanding (we owe)</div>
            </div>
            {kpis.ap_partial > 0 && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b', fontFamily: '"Bricolage Grotesque", sans-serif' }}>
                  {fmt(kpis.ap_partial)}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Partially paid</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <DashSection title="Monthly Revenue">
          <BarChart data={byMonth} valueKey="revenue" labelKey="month" color="#00D4C8" fmtFn={v => `$${(v/1000).toFixed(0)}k`} height={150} isMonth />
        </DashSection>
        <DashSection title="Monthly Gross Profit">
          <BarChart data={byMonth} valueKey="gp" labelKey="month" color="#10b981" fmtFn={v => `$${(v/1000).toFixed(0)}k`} height={150} isMonth />
        </DashSection>
      </div>

      {/* Rep performance + order count by month */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <DashSection title="GP by Rep">
          <BarChart data={byRep} valueKey="gp" labelKey="rep" color="#6366f1" fmtFn={v => `$${(v/1000).toFixed(0)}k`} height={140} />
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {byRep.slice(0, 6).map((r, i) => (
              <div key={i}
                onClick={() => onNavigateOrders && onNavigateOrders('', '', '', r.rep, selectedMonths.length === 1 ? selectedMonths[0] : '')}
                style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background='#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <span style={{ fontWeight: 600, color: '#334155' }}>{r.rep} <span style={{ fontSize: 10, color: '#00D4C8', fontWeight: 500 }}>→ view orders</span></span>
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
          <BarChart data={byMonth} valueKey="order_count" labelKey="month" color="#f59e0b" height={140} isMonth />
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

      {/* Marketing Metrics — selected lead sources individually + a combined total */}
      <DashSection title="Marketing Metrics — Revenue & GP by Source">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {marketingRows.map((r, i) => (
            <div key={i}
              style={{ flex: 1, minWidth: 165, background: '#fff', border: '1px solid #f1f5f9', borderRadius: 14, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{r.label}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 8 }}>Revenue</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', fontFamily: '"Bricolage Grotesque", sans-serif', lineHeight: 1.15 }}>{fmt(r.revenue)}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 6 }}>Gross Profit</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981', fontFamily: '"Bricolage Grotesque", sans-serif', lineHeight: 1.15 }}>{fmt(r.gp)}</div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 7 }}>{r.order_count} orders</div>
            </div>
          ))}
          {/* Combined total of all marketing sources */}
          <div style={{ flex: 1, minWidth: 165, background: '#0f172a', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#7dd3fc', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Marketing Total</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 8 }}>Revenue</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', fontFamily: '"Bricolage Grotesque", sans-serif', lineHeight: 1.15 }}>{fmt(marketingTotal.revenue)}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 6 }}>Gross Profit</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#4ade80', fontFamily: '"Bricolage Grotesque", sans-serif', lineHeight: 1.15 }}>{fmt(marketingTotal.gp)}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 7 }}>{marketingTotal.order_count} orders</div>
          </div>
        </div>
      </DashSection>

      {/* Marketing & Buyer metrics — GP / Revenue by Source and by Buyer */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <DashSection title="GP & Revenue by Source">
          <BarChart data={bySource} valueKey="gp" labelKey="lead_source" color="#0ea5e9" fmtFn={v => `$${(v/1000).toFixed(0)}k`} height={140} />
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', padding: '0 8px 4px', gap: 8 }}>
              <span style={{ flex: 2 }}>Source</span><span style={{ flex: 1, textAlign: 'right' }}>Orders</span><span style={{ flex: 1, textAlign: 'right' }}>GP</span><span style={{ flex: 1, textAlign: 'right' }}>Revenue</span>
            </div>
            {bySource.slice(0, 8).map((s, i) => (
              <div key={i}
                onClick={() => onNavigateOrders && onNavigateOrders(null, s.lead_source)}
                style={{ display: 'flex', fontSize: 12, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', gap: 8, transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background='#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <span style={{ flex: 2, fontWeight: 600, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.lead_source}</span>
                <span style={{ flex: 1, textAlign: 'right', color: '#64748b' }}>{s.order_count}</span>
                <span style={{ flex: 1, textAlign: 'right', color: '#10b981', fontWeight: 700 }}>{fmt(s.gp)}</span>
                <span style={{ flex: 1, textAlign: 'right', color: '#0f172a', fontWeight: 600 }}>{fmt(s.revenue)}</span>
              </div>
            ))}
          </div>
        </DashSection>
        <DashSection title="GP & Revenue by Buyer">
          <BarChart data={byBuyer} valueKey="gp" labelKey="buyer" color="#8b5cf6" fmtFn={v => `$${(v/1000).toFixed(0)}k`} height={140} />
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', padding: '0 8px 4px', gap: 8 }}>
              <span style={{ flex: 2 }}>Buyer</span><span style={{ flex: 1, textAlign: 'right' }}>Orders</span><span style={{ flex: 1, textAlign: 'right' }}>GP</span><span style={{ flex: 1, textAlign: 'right' }}>Revenue</span>
            </div>
            {byBuyer.slice(0, 8).map((b, i) => (
              <div key={i} style={{ display: 'flex', fontSize: 12, padding: '6px 8px', borderRadius: 8, gap: 8 }}>
                <span style={{ flex: 2, fontWeight: 600, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.buyer}</span>
                <span style={{ flex: 1, textAlign: 'right', color: '#64748b' }}>{b.order_count}</span>
                <span style={{ flex: 1, textAlign: 'right', color: '#10b981', fontWeight: 700 }}>{fmt(b.gp)}</span>
                <span style={{ flex: 1, textAlign: 'right', color: '#0f172a', fontWeight: 600 }}>{fmt(b.revenue)}</span>
              </div>
            ))}
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
      {loading ? <SkeletonRows cols={6} /> : orders.length === 0 ? (
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

// ── Payables (AP) tab — open supplier balances with aging ────────────────────
function PayablesTab() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [supPayItem, setSupPayItem] = useState(null)
  const [expanded, setExpanded] = useState({})  // supplier_id → bool

  const load = () => {
    setLoading(true)
    operationsApi.getPayables().then(r => setRows(r || [])).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const today = new Date().toISOString().slice(0, 10)
  const overdueByDays = (due) => { if (!due) return 0; const d = Math.floor((new Date(today) - new Date(due)) / 86400000); return d > 0 ? d : 0 }

  const enriched = rows.map(r => {
    const balance = (Number(r.ext_cost) || 0) - (Number(r.paid) || 0)
    const od = overdueByDays(r.payment_due)
    const bucket = od === 0 ? 'current' : od <= 30 ? '1-30' : od <= 60 ? '31-60' : '60+'
    return { ...r, balance, od, bucket }
  })

  // Group by supplier
  const supplierMap = {}
  enriched.forEach(r => {
    const key = r.supplier_id || '__none__'
    if (!supplierMap[key]) supplierMap[key] = { supplier_id: r.supplier_id, supplier_name: r.supplier_name || 'Unknown Supplier', items: [], totalCost: 0, totalPaid: 0, totalBal: 0 }
    supplierMap[key].items.push(r)
    supplierMap[key].totalCost += Number(r.ext_cost) || 0
    supplierMap[key].totalPaid += Number(r.paid) || 0
    supplierMap[key].totalBal  += r.balance
  })
  const suppliers = Object.values(supplierMap).sort((a, b) => b.totalBal - a.totalBal)

  const totalOut = enriched.reduce((a, r) => a + r.balance, 0)
  const bSum = (b) => enriched.filter(r => r.bucket === b).reduce((a, r) => a + r.balance, 0)
  const bCnt = (b) => enriched.filter(r => r.bucket === b).length
  const overdue = enriched.filter(r => r.od > 0)
  const overdueAmt = overdue.reduce((a, r) => a + r.balance, 0)
  const oldest = overdue.reduce((m, r) => Math.max(m, r.od), 0)

  if (loading) return <Loader />

  const th = { padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }
  const td = { padding: '9px 12px', fontSize: 13, whiteSpace: 'nowrap' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {supPayItem && (
        <SupplierPaymentsModal item={supPayItem} onClose={() => setSupPayItem(null)} onChanged={() => { setSupPayItem(null); load() }} />
      )}

      {/* Overdue alert banner */}
      {overdue.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px' }}>
          <AlertCircle size={20} color="#dc2626" />
          <div style={{ fontSize: 13, color: '#7f1d1d' }}>
            <strong style={{ fontWeight: 800 }}>{overdue.length} line item{overdue.length !== 1 ? 's' : ''} overdue to pay</strong> — <strong style={{ fontWeight: 800 }}>{fmt(overdueAmt)}</strong> outstanding{oldest > 0 ? `, oldest ${oldest} days past due` : ''}.
          </div>
        </div>
      )}

      {/* Aging summary */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <DashboardCard label="Total Payable" value={fmt(totalOut)} color="#0f172a" sub={`${enriched.length} open line items`} />
        <DashboardCard label="Current (not due)" value={fmt(bSum('current'))} sub={`${bCnt('current')} items`} color="#10b981" />
        <DashboardCard label="1–30 days over" value={fmt(bSum('1-30'))} sub={`${bCnt('1-30')} items`} color="#f59e0b" />
        <DashboardCard label="31–60 days over" value={fmt(bSum('31-60'))} sub={`${bCnt('31-60')} items`} color="#ea580c" />
        <DashboardCard label="60+ days over" value={fmt(bSum('60+'))} sub={`${bCnt('60+')} items`} color="#dc2626" />
      </div>

      {suppliers.length === 0 ? (
        <EmptyState icon={DollarSign} label="open payables" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {suppliers.map(sup => {
            const key = sup.supplier_id || '__none__'
            const isOpen = !!expanded[key]
            const supOverdue = sup.items.filter(r => r.od > 0)
            return (
              <div key={key} style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                {/* Supplier header row */}
                <div onClick={() => setExpanded(e => ({ ...e, [key]: !e[key] }))}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', cursor: 'pointer', background: isOpen ? '#f8fafc' : '#fff' }}
                  onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = '#f8fafc' }}
                  onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <ChevronRight size={14} style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', color: '#94a3b8' }} />
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{sup.supplier_name}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{sup.items.length} item{sup.items.length !== 1 ? 's' : ''}</span>
                    {supOverdue.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 100, background: '#fee2e2', color: '#b91c1c' }}>{supOverdue.length} overdue</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Owed</div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{fmt(sup.totalCost)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Paid</div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#10b981' }}>{fmt(sup.totalPaid)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Balance</div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#f59e0b' }}>{fmt(sup.totalBal)}</div>
                    </div>
                  </div>
                </div>

                {/* Drill-in line items */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid #f1f5f9', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr style={{ borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                        <th style={th}>Order</th><th style={th}>Part #</th><th style={th}>Description</th>
                        <th style={th}>Month</th><th style={{ ...th, textAlign: 'right' }}>Ext. Cost</th>
                        <th style={{ ...th, textAlign: 'right' }}>Paid</th><th style={{ ...th, textAlign: 'right' }}>Balance</th>
                        <th style={th}>Pay Due</th><th style={th}>Overdue</th><th style={th}></th>
                      </tr></thead>
                      <tbody>
                        {sup.items.map(r => (
                          <tr key={r.item_id} style={{ borderBottom: '1px solid #f8fafc' }}>
                            <td style={{ ...td, fontWeight: 600, color: '#0f172a' }}>{r.order_number}</td>
                            <td style={{ ...td, fontWeight: 600 }}>{r.part_number || '—'}</td>
                            <td style={{ ...td, color: '#475569', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.description || '—'}</td>
                            <td style={{ ...td, color: '#64748b' }}>{r.reporting_period || '—'}</td>
                            <td style={{ ...td, textAlign: 'right' }}>{fmt(r.ext_cost)}</td>
                            <td style={{ ...td, textAlign: 'right', color: '#10b981' }}>{fmt(r.paid)}</td>
                            <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#f59e0b' }}>{fmt(r.balance)}</td>
                            <td style={{ ...td, color: '#64748b' }}>{fmtDate(r.payment_due)}</td>
                            <td style={{ ...td, color: r.od > 60 ? '#dc2626' : r.od > 0 ? '#ea580c' : '#94a3b8', fontWeight: r.od > 0 ? 700 : 400 }}>{r.od > 0 ? `${r.od}d` : '—'}</td>
                            <td style={{ ...td }}>
                              <button className="btn btn-secondary btn-sm" style={{ fontSize: 11, padding: '3px 8px' }}
                                onClick={() => setSupPayItem({ id: r.item_id, order_number: r.order_number, part_number: r.part_number, description: r.description, ext_total_buying: r.ext_cost, paid_to_supplier: r.paid, payment_due: r.payment_due, supplier_terms: r.supplier_terms })}>
                                <DollarSign size={11} /> Pay
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Receivables (AR) tab — open customer balances with aging ──────────────────
function ReceivablesTab({ onOpenOrder }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    operationsApi.getReceivables().then(r => setRows(r || [])).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const today = new Date().toISOString().slice(0, 10)
  const overdueByDays = (due) => { if (!due) return 0; const d = Math.floor((new Date(today) - new Date(due)) / 86400000); return d > 0 ? d : 0 }
  const enriched = rows.map(r => {
    const balance = (Number(r.charged) || 0) - (Number(r.received) || 0)
    const od = overdueByDays(r.due_date)
    const bucket = od === 0 ? 'current' : od <= 30 ? '1-30' : od <= 60 ? '31-60' : '60+'
    const partial = (Number(r.received) || 0) > 0.005
    return { ...r, balance, od, bucket, partial }
  })
  const totalOut = enriched.reduce((a, r) => a + r.balance, 0)
  const bSum = (b) => enriched.filter(r => r.bucket === b).reduce((a, r) => a + r.balance, 0)
  const bCnt = (b) => enriched.filter(r => r.bucket === b).length

  if (loading) return <Loader />

  const overdue = enriched.filter(r => r.od > 0)
  const overdueAmt = overdue.reduce((a, r) => a + r.balance, 0)
  const oldest = overdue.reduce((m, r) => Math.max(m, r.od), 0)

  const th = { padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }
  const td = { padding: '9px 12px', fontSize: 13, whiteSpace: 'nowrap' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Overdue alert banner */}
      {overdue.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px' }}>
          <AlertCircle size={20} color="#dc2626" />
          <div style={{ fontSize: 13, color: '#7f1d1d' }}>
            <strong style={{ fontWeight: 800 }}>{overdue.length} order{overdue.length !== 1 ? 's' : ''} overdue</strong> for collection — <strong style={{ fontWeight: 800 }}>{fmt(overdueAmt)}</strong> outstanding{oldest > 0 ? `, oldest ${oldest} days past due` : ''}.
          </div>
        </div>
      )}

      {/* Aging summary */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <DashboardCard label="Total Outstanding" value={fmt(totalOut)} color="#0f172a" sub={`${enriched.length} open orders`} />
        <DashboardCard label="Current (not due)" value={fmt(bSum('current'))} sub={`${bCnt('current')} orders`} color="#10b981" />
        <DashboardCard label="1–30 days over" value={fmt(bSum('1-30'))} sub={`${bCnt('1-30')} orders`} color="#f59e0b" />
        <DashboardCard label="31–60 days over" value={fmt(bSum('31-60'))} sub={`${bCnt('31-60')} orders`} color="#ea580c" />
        <DashboardCard label="60+ days over" value={fmt(bSum('60+'))} sub={`${bCnt('60+')} orders`} color="#dc2626" />
      </div>

      {enriched.length === 0 ? (
        <EmptyState icon={DollarSign} label="open receivables" />
      ) : (
        <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 14, overflow: 'auto', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <th style={th}>Order</th><th style={th}>Customer</th><th style={th}>Month</th>
              <th style={{ ...th, textAlign: 'right' }}>Charged</th><th style={{ ...th, textAlign: 'right' }}>Received</th>
              <th style={{ ...th, textAlign: 'right' }}>Balance</th><th style={th}>Due</th><th style={th}>Overdue</th><th style={th}>Status</th>
            </tr></thead>
            <tbody>
              {enriched.map(r => {
                const st = r.od > 0 ? { label: 'Overdue', bg: '#fee2e2', color: '#b91c1c' }
                  : r.partial ? { label: 'Partial', bg: '#fef3c7', color: '#b45309' }
                  : { label: 'Unpaid', bg: '#f1f5f9', color: '#64748b' }
                return (
                  <tr key={r.id} onClick={() => onOpenOrder(r.id)} style={{ borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ ...td, fontWeight: 600, color: '#0f172a' }}>{r.order_number}</td>
                    <td style={td}>{r.customer_name || '—'}</td>
                    <td style={{ ...td, color: '#64748b' }}>{r.reporting_period || '—'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmt(r.charged)}</td>
                    <td style={{ ...td, textAlign: 'right', color: '#10b981' }}>{fmt(r.received)}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#f59e0b' }}>{fmt(r.balance)}</td>
                    <td style={{ ...td, color: '#64748b' }}>{fmtDate(r.due_date)}</td>
                    <td style={{ ...td, color: r.od > 60 ? '#dc2626' : r.od > 0 ? '#ea580c' : '#94a3b8', fontWeight: r.od > 0 ? 700 : 400 }}>{r.od > 0 ? `${r.od}d` : '—'}</td>
                    <td style={td}><span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 100, background: st.bg, color: st.color }}>{st.label}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main Operations Page ──────────────────────────────────────────────────────
export default function Operations() {
  const [tab, setTabState] = useState(() => { try { return localStorage.getItem('ops_tab') || 'orders' } catch { return 'orders' } })
  const setTab = (k) => { setTabState(k); try { localStorage.setItem('ops_tab', k) } catch {} }
  const [stats, setStats] = useState(null)
  const [jumpOrderId, setJumpOrderId] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [showPending, setShowPending] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [ordersResetToken, setOrdersResetToken] = useState(0)
  const [ordersSummary, setOrdersSummary] = useState(null)
  const [dashNavStatus, setDashNavStatus] = useState(undefined)
  const [dashNavLeadSource, setDashNavLeadSource] = useState(undefined)
  const [dashNavPayment, setDashNavPayment] = useState(undefined)
  const [overdueCount, setOverdueCount] = useState(0)
  const [overduePayCount, setOverduePayCount] = useState(0)

  useEffect(() => {
    operationsApi.getStats().then(s => { setStats(s); setPendingCount(s.pending_orders || 0) }).catch(() => {})
  }, [])

  // Overdue AR/AP counts for tab badges. Refreshed when navigating tabs.
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    operationsApi.getReceivables()
      .then(rows => setOverdueCount((rows || []).filter(r => r.due_date && r.due_date < today && (Number(r.charged) - Number(r.received)) > 0.005).length))
      .catch(() => {})
    operationsApi.getPayables()
      .then(rows => setOverduePayCount((rows || []).filter(r => r.payment_due && r.payment_due < today).length))
      .catch(() => {})
  }, [tab])

  const handleOpenOrderFromItems = (orderId) => {
    setJumpOrderId(orderId)
    setTab('orders')
  }

  const [dashNavRep, setDashNavRep] = useState(undefined)
  const [dashNavPeriod, setDashNavPeriod] = useState(undefined)

  const handleNavigateOrders = (status, leadSource, paymentStatus, rep, period) => {
    setDashNavStatus(status || '')
    setDashNavLeadSource(leadSource || '')
    setDashNavPayment(paymentStatus || '')
    setDashNavRep(rep || '')
    setDashNavPeriod(period || '')
    setTab('orders')
  }

  const tabs = [
    { key: 'orders',      label: 'Orders',      icon: Package },
    { key: 'order-items', label: 'Order Items',  icon: List },
    { key: 'customers',   label: 'Customers',   icon: Users },
    { key: 'suppliers',   label: 'Suppliers',   icon: Truck },
    { key: 'rma',         label: 'RMA',         icon: RotateCcw },
    { key: 'receivables', label: 'Receivables', icon: DollarSign },
    { key: 'payables',    label: 'Payables',    icon: CreditCard },
    { key: 'dashboard',   label: 'Dashboard',   icon: ClipboardList },
  ]

  return (
    <div className="page-wrap fade-in">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <ToastHost />
      <ConfirmHost />

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
            {(tab === 'orders' && ordersSummary
              ? [
                  { label: 'Orders',      value: ordersSummary.count,      color: '#0f172a' },
                  { label: 'Order Amt',   value: fmt(ordersSummary.amt),   color: '#64748b' },
                  { label: 'Total Value', value: fmt(ordersSummary.val),   color: '#0f172a' },
                  { label: 'GP',          value: fmt(ordersSummary.gp),    color: ordersSummary.gp >= 0 ? '#10b981' : '#ef4444' },
                  { label: 'Remaining',   value: fmt(ordersSummary.rem),   color: ordersSummary.rem > 0 ? '#f59e0b' : '#10b981' },
                ]
              : [
                  { label: 'Total Orders', value: stats.total_orders, color: '#0f172a' },
                  { label: 'In Process',   value: stats.in_process,   color: '#f59e0b' },
                  { label: 'Open RMA',     value: stats.open_rma,     color: '#ef4444' },
                  { label: 'Total GP',     value: fmt(stats.total_gp), color: '#10b981' },
                ]
            ).map(s => (
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
            {key === 'receivables' && overdueCount > 0 && (
              <span style={{ minWidth: 16, height: 16, padding: '0 5px', borderRadius: 100, background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{overdueCount}</span>
            )}
            {key === 'payables' && overduePayCount > 0 && (
              <span style={{ minWidth: 16, height: 16, padding: '0 5px', borderRadius: 100, background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{overduePayCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #f1f5f9', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        {tab === 'orders' && <OrdersTab
          jumpOrderId={jumpOrderId} onJumpHandled={() => setJumpOrderId(null)}
          initialStatus={dashNavStatus} initialLeadSource={dashNavLeadSource} initialPaymentStatus={dashNavPayment}
          initialRep={dashNavRep} initialPeriod={dashNavPeriod}
          onInitialFiltersHandled={() => { setDashNavStatus(undefined); setDashNavLeadSource(undefined); setDashNavPayment(undefined); setDashNavRep(undefined); setDashNavPeriod(undefined) }}
          resetToken={ordersResetToken}
          onSummary={setOrdersSummary}
        />}
        {tab === 'order-items' && <OrderItemsTab onOpenOrder={handleOpenOrderFromItems} />}
        {tab === 'dashboard' && <DashboardTab onNavigateOrders={handleNavigateOrders}
          onDateFilterChange={(from, to) => {
            const params = {}
            if (from) params.date_from = from
            if (to)   params.date_to   = to
            operationsApi.getStats(params).then(s => { setStats(s); setPendingCount(s.pending_orders || 0) }).catch(() => {})
          }}
        />}
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
        {tab === 'receivables' && <ReceivablesTab onOpenOrder={handleOpenOrderFromItems} />}
        {tab === 'payables' && <PayablesTab />}
      </div>

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onStatsRefresh={() => operationsApi.getStats().then(s => { setStats(s); setPendingCount(s.pending_orders||0) }).catch(()=>{})}
          onDone={() => {
            setOrdersResetToken(t => t + 1)
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
