import { useState, useEffect } from 'react'
import Modal from './Modal'
import { operationsApi } from '../api'
import { CheckCircle, Package } from 'lucide-react'

const BRAND = '#00D4C8'
const BUYERS = ['Danny', 'Samit', 'Jason', 'Jorge', 'Maqsood']
const REPS = ['Ethan', 'Eddie', 'Ryan', 'Justin', 'Hector', 'Aman', 'Online']
const ORDER_STATUSES = ['Order placed', 'In Process', 'Shipped to US', 'Received in US', 'Shipped to customer', 'Delivered', 'Refunded']
const PAYMENT_STATUSES = ['CC Charged', 'Wire Received', 'Net']
const SHIPPED_VIA = ['FedEx', 'UPS', 'USPS', 'Customer Account']

function Field({ label, children, half }) {
  return (
    <div style={{ flex: half ? '0 0 calc(50% - 6px)' : '1 1 100%', display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</label>
      {children}
    </div>
  )
}

function ReadOnly({ value }) {
  return (
    <div style={{ padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 13, color: '#475569', fontWeight: 500 }}>
      {value || '—'}
    </div>
  )
}

export default function ClosedWonModal({ inquiry, requirements, onClose, onCreated }) {
  // Fields auto-populated from CRM
  const repName = inquiry.assigned_name || ''

  const [form, setForm] = useState({
    order_number: '',
    buyer: '',
    payment_status: '',
    order_status: 'Order placed',
    net: '',
    due_date: '',
    tax_charged: '',
    shipping_charged: '',
    cc_charges: '',
    customer_paid: '',
    shipped_via: '',
    tracking_to_customer: '',
    notes: '',
  })
  const [opCustomers, setOpCustomers] = useState([])
  const [matchedCustomerId, setMatchedCustomerId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(null) // { orderNumber, itemCount }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Try to find or suggest a matching customer in op_customers
  useEffect(() => {
    operationsApi.getCustomers(inquiry.customer_name || '').then(list => {
      setOpCustomers(list)
      const match = list.find(c =>
        c.name?.toLowerCase() === inquiry.customer_name?.toLowerCase() ||
        (c.email && c.email === inquiry.customer_email)
      )
      if (match) setMatchedCustomerId(match.id)
    }).catch(() => {})
  }, [])

  const handleCreate = async () => {
    if (!form.order_number.trim()) { setErr('Order number is required'); return }
    setSaving(true); setErr('')
    try {
      // 1. Find or create op_customer
      let customerId = matchedCustomerId
      if (!customerId) {
        const created = await operationsApi.createCustomer({
          name: inquiry.customer_name || '',
          email: inquiry.customer_email || '',
          phone: inquiry.customer_phone || '',
        })
        customerId = created.id
      }

      // 2. Create the order pre-filled from CRM
      const order = await operationsApi.createOrder({
        ...form,
        customer_id: customerId,
        email: inquiry.customer_email || '',
        lead_source: inquiry.lead_source || '',
        rep: repName,
        order_date: new Date().toISOString().slice(0, 10),
        tax_charged: form.tax_charged || 0,
        shipping_charged: form.shipping_charged || 0,
        cc_charges: form.cc_charges || 0,
        customer_paid: form.customer_paid || 0,
      })

      // 3. Pre-create one line item per requirement (part # + qty, no pricing)
      const reqs = requirements.filter(r => r.part_number?.trim())
      for (const req of reqs) {
        await operationsApi.addItem(order.id, {
          part_number: req.part_number,
          quantity: req.quantity || 1,
          selling: 0,
          buying: 0,
        })
      }

      setDone({ orderNumber: order.order_number, itemCount: reqs.length, orderId: order.id })
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <Modal title="Order Created" onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <CheckCircle size={28} color="#10b981" />
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', fontFamily: '"Bricolage Grotesque", sans-serif', marginBottom: 6 }}>
            Order {done.orderNumber} created
          </div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
            {done.itemCount > 0
              ? `${done.itemCount} line item${done.itemCount > 1 ? 's' : ''} pre-populated from CRM requirements. Pricing needs to be filled in by the buyer.`
              : 'No requirements were attached — add line items from the Operations tab.'}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={onClose}
              style={{ padding: '10px 20px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              Stay here
            </button>
            <button
              onClick={() => onCreated(done.orderId)}
              style={{ padding: '10px 20px', borderRadius: 12, border: 'none', background: BRAND, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Open in Operations →
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="🎉 Closed Won — Create Order" onClose={onClose} wide>
      {/* CRM data summary — read only */}
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
          Auto-filled from CRM
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', fontSize: 13 }}>
          {[
            ['Customer',   inquiry.customer_name],
            ['Email',      inquiry.customer_email],
            ['Phone',      inquiry.customer_phone],
            ['Lead Source',inquiry.lead_source],
            ['Rep',        repName],
            ['Order Date', new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })],
          ].map(([k, v]) => v ? (
            <div key={k}>
              <span style={{ color: '#6ee7b7', fontWeight: 600 }}>{k}: </span>
              <span style={{ color: '#064e3b', fontWeight: 700 }}>{v}</span>
            </div>
          ) : null)}
        </div>
        {requirements.filter(r => r.part_number?.trim()).length > 0 && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Package size={12} /> Parts from Requirements
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {requirements.filter(r => r.part_number?.trim()).map((r, i) => (
                <span key={i} style={{ background: '#d1fae5', color: '#064e3b', borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
                  {r.part_number} × {r.quantity || 1}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Op customer match */}
      {matchedCustomerId ? (
        <div style={{ fontSize: 12, color: '#10b981', fontWeight: 600, marginBottom: 14 }}>
          ✓ Matched to existing Operations customer record
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600, marginBottom: 14 }}>
          ⚠ Customer not found in Operations — a new customer record will be created automatically
        </div>
      )}

      {/* Operator fills in */}
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
        Operator fills in
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <Field label="Order Number *">
          <input className="input" value={form.order_number} onChange={e => set('order_number', e.target.value)}
            placeholder="TA001234" style={{ borderColor: !form.order_number ? '#fca5a5' : undefined }} />
        </Field>

        <Field label="Buyer" half>
          <select className="input" value={form.buyer} onChange={e => set('buyer', e.target.value)}>
            <option value="">— select buyer —</option>
            {BUYERS.map(b => <option key={b}>{b}</option>)}
          </select>
        </Field>

        <Field label="Payment Status" half>
          <select className="input" value={form.payment_status} onChange={e => set('payment_status', e.target.value)}>
            <option value="">—</option>
            {PAYMENT_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>

        <Field label="Order Status" half>
          <select className="input" value={form.order_status} onChange={e => set('order_status', e.target.value)}>
            {ORDER_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>

        <Field label="Net (terms)" half>
          <input className="input" value={form.net} onChange={e => set('net', e.target.value)} placeholder="Net 30, Net 15…" />
        </Field>

        <Field label="Due Date" half>
          <input className="input" type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
        </Field>

        <div style={{ flex: '1 1 100%', borderTop: '1px solid #f1f5f9', paddingTop: 12 }} />

        <Field label="Tax Charged ($)" half>
          <input className="input" type="number" value={form.tax_charged} onChange={e => set('tax_charged', e.target.value)} placeholder="0.00" />
        </Field>
        <Field label="Shipping Charged ($)" half>
          <input className="input" type="number" value={form.shipping_charged} onChange={e => set('shipping_charged', e.target.value)} placeholder="0.00" />
        </Field>
        <Field label="CC Charges ($)" half>
          <input className="input" type="number" value={form.cc_charges} onChange={e => set('cc_charges', e.target.value)} placeholder="0.00" />
        </Field>
        <Field label="Customer Paid ($)" half>
          <input className="input" type="number" value={form.customer_paid} onChange={e => set('customer_paid', e.target.value)} placeholder="0.00" />
        </Field>

        <div style={{ flex: '1 1 100%', borderTop: '1px solid #f1f5f9', paddingTop: 12 }} />

        <Field label="Shipped Via" half>
          <select className="input" value={form.shipped_via} onChange={e => set('shipped_via', e.target.value)}>
            <option value="">—</option>
            {SHIPPED_VIA.map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Tracking to Customer" half>
          <input className="input" value={form.tracking_to_customer} onChange={e => set('tracking_to_customer', e.target.value)} placeholder="1Z999…" />
        </Field>

        <Field label="Notes">
          <textarea className="input" value={form.notes} onChange={e => set('notes', e.target.value)}
            rows={2} placeholder="Internal notes…" style={{ resize: 'vertical' }} />
        </Field>
      </div>

      {err && (
        <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginTop: 12 }}>{err}</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
        <button onClick={onClose}
          style={{ padding: '10px 20px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          Cancel
        </button>
        <button onClick={handleCreate} disabled={saving}
          style={{ padding: '10px 24px', borderRadius: 12, border: 'none', background: BRAND, color: '#fff', fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Creating…' : 'Create Order in Operations'}
        </button>
      </div>
    </Modal>
  )
}
