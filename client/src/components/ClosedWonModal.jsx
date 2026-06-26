import { useState } from 'react'
import Modal from './Modal'
import { operationsApi } from '../api'
import { CheckCircle, Package, Plus, Trash2 } from 'lucide-react'

const BRAND = '#00D4C8'
const PAYMENT_STATUSES = ['CC Charged', 'Wire Received', 'Net']
const CONDITIONS = ['', 'NEW', 'REF', 'USED', 'PULL', 'NEW OEM']

const money = (n) => '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Closed-Won → create a PENDING Operations order. The rep fills the sales side
// (customer charges + line items + selling). Buying/supplier/AP is left for ops/buyer.
export default function ClosedWonModal({ inquiry, requirements = [], onClose, onCreated, z = 99999 }) {
  const repName = inquiry.assigned_name || ''

  const [header, setHeader] = useState({
    payment_status: '', net: '', due_date: '', tax_charged: '', shipping_charged: '', cc_charges: '', notes: '',
  })
  const setH = (k, v) => setHeader(f => ({ ...f, [k]: v }))

  const [items, setItems] = useState(() => {
    const reqs = (requirements || []).filter(r => r.part_number?.trim())
    const base = reqs.length ? reqs : [{}]
    return base.map(r => ({ part_number: r.part_number || '', description: '', quantity: r.quantity || 1, product_condition: '', selling: '' }))
  })
  const setItem = (i, k, v) => setItems(list => list.map((it, idx) => idx === i ? { ...it, [k]: v } : it))
  const addRow = () => setItems(list => [...list, { part_number: '', description: '', quantity: 1, product_condition: '', selling: '' }])
  const removeRow = (i) => setItems(list => list.length > 1 ? list.filter((_, idx) => idx !== i) : list)

  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(null)

  const totalSelling = items.reduce((s, it) => s + (Number(it.selling) || 0) * (Number(it.quantity) || 0), 0)

  const handleCreate = async () => {
    const lines = items.filter(it => it.part_number?.trim() || Number(it.selling) > 0)
    if (!lines.length) { setErr('Add at least one line item.'); return }
    setSaving(true); setErr('')
    try {
      const res = await operationsApi.createFromCRM({
        customer_name: inquiry.customer_name, customer_email: inquiry.customer_email, customer_phone: inquiry.customer_phone,
        lead_source: inquiry.lead_source, rep: repName, crm_inquiry_id: inquiry.id,
        ...header,
        items: lines,
      })
      if (onCreated) onCreated(res.order_id)   // signal the inquiry that conversion succeeded
      setDone({ orderNumber: res.order_number, existing: res.existing, orderId: res.order_id, itemCount: res.item_count })
    } catch (e) { setErr(e.message) } finally { setSaving(false) }
  }

  if (done) {
    return (
      <Modal title="Order Created" onClose={onClose} zIndex={z}>
        <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <CheckCircle size={28} color="#10b981" />
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', fontFamily: '"Bricolage Grotesque", sans-serif', marginBottom: 6 }}>
            {done.existing ? `Order ${done.orderNumber} already exists` : `Pending order ${done.orderNumber} created`}
          </div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
            {done.existing
              ? 'This inquiry was already converted to an order — opening the existing one.'
              : 'It lands as a pending order. The buyer/ops team fills in cost, supplier and AP, then marks it complete.'}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={onClose} style={{ padding: '10px 24px', borderRadius: 12, border: 'none', background: BRAND, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Done</button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Closed Won — Create Order" onClose={onClose} wide zIndex={z}>
      {/* CRM data summary — read only */}
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '14px 16px', marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Auto-filled from CRM</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', fontSize: 13 }}>
          {[['Customer', inquiry.customer_name], ['Email', inquiry.customer_email], ['Phone', inquiry.customer_phone], ['Lead Source', inquiry.lead_source], ['Rep', repName]].map(([k, v]) => v ? (
            <div key={k}><span style={{ color: '#10b981', fontWeight: 600 }}>{k}: </span><span style={{ color: '#064e3b', fontWeight: 700 }}>{v}</span></div>
          ) : null)}
        </div>
      </div>

      {/* Line items the rep confirms / fills */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Package size={13} /> Line items
        </div>
        <button onClick={addRow} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Plus size={13} /> Add line</button>
      </div>
      <div style={{ overflowX: 'auto', border: '1px solid #f1f5f9', borderRadius: 10, marginBottom: 18 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Part #', 'Description', 'Qty', 'Condition', 'Selling/unit', ''].map((h, i) => (
                <th key={h} style={{ textAlign: i === 2 || i === 4 ? 'right' : 'left', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '8px 10px', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: '6px 8px' }}><input className="input" value={it.part_number} onChange={e => setItem(i, 'part_number', e.target.value)} placeholder="ABC-123" style={{ minWidth: 110 }} /></td>
                <td style={{ padding: '6px 8px' }}><input className="input" value={it.description} onChange={e => setItem(i, 'description', e.target.value)} placeholder="optional" style={{ minWidth: 120 }} /></td>
                <td style={{ padding: '6px 8px' }}><input className="input" type="number" min="1" value={it.quantity} onChange={e => setItem(i, 'quantity', e.target.value)} style={{ width: 64, textAlign: 'right' }} /></td>
                <td style={{ padding: '6px 8px' }}>
                  <select className="input" value={it.product_condition} onChange={e => setItem(i, 'product_condition', e.target.value)} style={{ width: 100 }}>
                    {CONDITIONS.map(c => <option key={c} value={c}>{c || '—'}</option>)}
                  </select>
                </td>
                <td style={{ padding: '6px 8px' }}><input className="input" type="number" value={it.selling} onChange={e => setItem(i, 'selling', e.target.value)} placeholder="0.00" style={{ width: 90, textAlign: 'right' }} /></td>
                <td style={{ padding: '6px 8px' }}><button onClick={() => removeRow(i)} title="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', padding: 4 }}><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
              <td colSpan={4} style={{ padding: '8px 10px', fontWeight: 700, color: '#475569', fontSize: 12 }}>{items.length} line{items.length === 1 ? '' : 's'}</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: BRAND, fontVariantNumeric: 'tabular-nums' }}>{money(totalSelling)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Sales-side header fields */}
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Charges &amp; terms (optional)</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <Field label="Payment Status" half>
          <select className="input" value={header.payment_status} onChange={e => setH('payment_status', e.target.value)}>
            <option value="">—</option>{PAYMENT_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Net (terms)" half><input className="input" value={header.net} onChange={e => setH('net', e.target.value)} placeholder="Net 30…" /></Field>
        <Field label="Due Date" half><input className="input" type="date" value={header.due_date} onChange={e => setH('due_date', e.target.value)} /></Field>
        <Field label="Tax Charged ($)" half><input className="input" type="number" value={header.tax_charged} onChange={e => setH('tax_charged', e.target.value)} placeholder="0.00" /></Field>
        <Field label="Shipping Charged ($)" half><input className="input" type="number" value={header.shipping_charged} onChange={e => setH('shipping_charged', e.target.value)} placeholder="0.00" /></Field>
        <Field label="CC Charges ($)" half><input className="input" type="number" value={header.cc_charges} onChange={e => setH('cc_charges', e.target.value)} placeholder="0.00" /></Field>
        <Field label="Notes"><textarea className="input" value={header.notes} onChange={e => setH('notes', e.target.value)} rows={2} style={{ resize: 'vertical' }} placeholder="Internal notes…" /></Field>
      </div>

      {err && <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginTop: 12 }}>{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
        <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
        <button onClick={handleCreate} disabled={saving} style={{ padding: '10px 24px', borderRadius: 12, border: 'none', background: BRAND, color: '#fff', fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Creating…' : 'Create Pending Order'}
        </button>
      </div>
    </Modal>
  )
}

function Field({ label, children, half }) {
  return (
    <div style={{ flex: half ? '0 0 calc(50% - 6px)' : '1 1 100%', display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</label>
      {children}
    </div>
  )
}
