import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Plus, Trash2, FileDown } from 'lucide-react'
import { invoicesApi, operationsApi } from '../api'

const BRAND = '#00D4C8'
const DEFAULT_ADDR = 'Unit # OFC 004, 5200 Thatcher Rd, Downers Grove, Illinois 60515'
const DEFAULT_NOTE = 'If you are paying via CC, there will be additional 3% CC Charges on total amount of order.'
// Default payment-details block. EDIT this to your real remit-to / bank details.
const DEFAULT_REMIT = 'Make checks payable to Tech Atlantix.\nFor ACH / wire transfer details, please contact your account manager.'

const inp = { width: '100%', boxSizing: 'border-box', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 9, padding: '8px 10px', fontSize: 13, color: '#0f172a', fontFamily: 'inherit', outline: 'none' }
const lbl = { fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4, display: 'block' }
const num = v => { const n = parseFloat(String(v ?? '').replace(/[$,\s]/g, '')); return isNaN(n) ? 0 : n }
const money = v => `$${num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const todayISO = () => new Date().toISOString().slice(0, 10)
const fmtDate = iso => { if (!iso) return ''; const [y, m, d] = String(iso).slice(0, 10).split('-'); return d ? `${m}/${d}/${y}` : '' }

function Field({ label, children, w }) { return <div style={{ width: w || 'auto', flex: w ? 'none' : 1, minWidth: 0 }}><span style={lbl}>{label}</span>{children}</div> }
function Sub({ children }) { return <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0 12px' }}><span style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{children}</span><span style={{ flex: 1, height: 1, background: '#eef2f6' }} /></div> }
function Row({ k, v }) { return <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#475569' }}><span>{k}</span><span>{v}</span></div> }

export default function InvoiceModal({ orderId, user, onClose }) {
  const ek = `quote_prep_email_${user?.id}`, pk = `quote_prep_phone_${user?.id}`
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [date, setDate] = useState(todayISO())
  const [dueDate, setDueDate] = useState('')
  const [terms, setTerms] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [from, setFrom] = useState({ company: 'Tech Atlantix', address: DEFAULT_ADDR, name: user?.name || '', email: localStorage.getItem(ek) || '', phone: localStorage.getItem(pk) || '' })
  const [to, setTo] = useState({ name: '', company: '', email: '', phone: '', address: '' })
  const [items, setItems] = useState([])
  const [discount, setDiscount] = useState('')
  const [tax, setTax] = useState('')
  const [shipping, setShipping] = useState('')
  const [cc, setCc] = useState('')
  const [amountPaid, setAmountPaid] = useState('')
  const [remit, setRemit] = useState(DEFAULT_REMIT)
  const [note, setNote] = useState(DEFAULT_NOTE)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    Promise.all([
      operationsApi.invoiceData(orderId),
      invoicesApi.nextNumber().catch(() => ({ invoice_number: '' })),
    ]).then(([o, n]) => {
      if (!alive) return
      setOrderNumber(o.order_number || '')
      setDueDate((o.due_date || '').slice(0, 10))
      setTerms(num(o.net) > 0 ? `Net ${num(o.net)}` : (o.payment_status || 'Pre-Payment'))
      setPaymentStatus(o.payment_status || '')
      setTo({ name: o.customer_name || '', company: '', email: o.customer_email || '', phone: o.customer_phone || '', address: o.customer_address || '' })
      setItems((o.items || []).map(it => ({ part: it.part_number || '', description: it.description || it.product || '', qty: it.quantity ?? '', price: it.selling ?? '' })))
      setTax(o.tax_charged ? String(o.tax_charged) : '')
      setShipping(o.shipping_charged ? String(o.shipping_charged) : '')
      setCc(o.cc_charges ? String(o.cc_charges) : '')
      setAmountPaid(o.customer_paid ? String(o.customer_paid) : '')
      setInvoiceNumber(n.invoice_number || '')
      setLoading(false)
    }).catch(e => { if (alive) { setLoadErr(e.message || 'Could not load the order.'); setLoading(false) } })
    return () => { alive = false }
  }, [orderId])

  const setF = (k, v) => setFrom(f => ({ ...f, [k]: v }))
  const setT = (k, v) => setTo(t => ({ ...t, [k]: v }))
  const setItem = (i, k, v) => setItems(arr => arr.map((it, idx) => idx === i ? { ...it, [k]: v } : it))
  const addItem = () => setItems(a => [...a, { part: '', description: '', qty: '', price: '' }])
  const removeItem = i => setItems(a => a.filter((_, idx) => idx !== i))

  const subtotal = items.reduce((t, it) => t + num(it.price) * num(it.qty), 0)
  const total = subtotal - num(discount) + num(tax) + num(shipping) + num(cc)
  const balance = total - num(amountPaid)

  const generate = async () => {
    setBusy(true); setError('')
    try {
      let number = invoiceNumber
      try { const r = await invoicesApi.record({ order_id: orderId, invoice_number: invoiceNumber, customer_name: to.name, total }); if (r?.invoice_number) number = r.invoice_number } catch { /* keep going even if logging fails */ }
      localStorage.setItem(ek, from.email || ''); localStorage.setItem(pk, from.phone || '')
      const { generateInvoiceBlob } = await import('../lib/invoicePdf.jsx')
      const blob = await generateInvoiceBlob({
        invoiceNumber: number, orderNumber, date: fmtDate(date), dueDate: fmtDate(dueDate), terms, paymentStatus,
        from, to, items,
        discount: num(discount), tax: num(tax), shipping: num(shipping), cc: num(cc), amountPaid: num(amountPaid),
        remit, note,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `Invoice-${number || 'TA'}.pdf`; document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
      onClose()
    } catch (e) { setError(e.message || 'Could not generate the PDF.') } finally { setBusy(false) }
  }

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 920, maxHeight: '94vh', display: 'flex', flexDirection: 'column', fontFamily: '"Plus Jakarta Sans",sans-serif', boxShadow: '0 32px 90px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', fontFamily: '"Bricolage Grotesque",sans-serif' }}>Generate Invoice</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>{to.name ? `For ${to.name}` : 'Customer invoice'}{orderNumber ? ` · Order ${orderNumber}` : ''}</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 9, border: 'none', background: '#f1f5f9', cursor: 'pointer', color: '#64748b' }}><X size={16} /></button>
        </div>

        <div style={{ overflowY: 'auto', padding: '18px 22px', flex: 1, background: '#f8fafc' }}>
          {loading ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>Loading order…</div>
          ) : loadErr ? (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#dc2626' }}>⚠ {loadErr}</div>
          ) : (
            <>
              <Sub>Invoice details</Sub>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
                <Field label="Invoice #" w={150}><input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} style={inp} /></Field>
                <Field label="Order #" w={120}><input value={orderNumber} onChange={e => setOrderNumber(e.target.value)} style={inp} /></Field>
                <Field label="Date" w={140}><input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} /></Field>
                <Field label="Due date" w={140}><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inp} /></Field>
                <Field label="Terms"><input value={terms} onChange={e => setTerms(e.target.value)} style={inp} /></Field>
              </div>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 280 }}>
                  <Sub>From (your details)</Sub>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <Field label="Company"><input value={from.company} onChange={e => setF('company', e.target.value)} style={inp} /></Field>
                    <Field label="Address"><input value={from.address} onChange={e => setF('address', e.target.value)} style={inp} /></Field>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <Field label="Name"><input value={from.name} onChange={e => setF('name', e.target.value)} style={inp} /></Field>
                      <Field label="Phone"><input value={from.phone} onChange={e => setF('phone', e.target.value)} style={inp} /></Field>
                    </div>
                    <Field label="Email"><input value={from.email} onChange={e => setF('email', e.target.value)} style={inp} /></Field>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 280 }}>
                  <Sub>Bill to (customer)</Sub>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <Field label="Name"><input value={to.name} onChange={e => setT('name', e.target.value)} style={inp} /></Field>
                      <Field label="Company"><input value={to.company} onChange={e => setT('company', e.target.value)} style={inp} /></Field>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <Field label="Email"><input value={to.email} onChange={e => setT('email', e.target.value)} style={inp} /></Field>
                      <Field label="Phone"><input value={to.phone} onChange={e => setT('phone', e.target.value)} style={inp} /></Field>
                    </div>
                    <Field label="Address"><input value={to.address} onChange={e => setT('address', e.target.value)} placeholder="Customer address" style={inp} /></Field>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 18 }}>
                <Sub>Line items</Sub>
                <div style={{ display: 'flex', gap: 8, fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', padding: '0 4px 4px' }}>
                  <span style={{ width: 60 }}>Qty</span><span style={{ width: 130 }}>Part #</span><span style={{ flex: 1 }}>Description</span><span style={{ width: 110 }}>Unit price</span><span style={{ width: 90, textAlign: 'right' }}>Amount</span><span style={{ width: 26 }} />
                </div>
                {items.map((it, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 7 }}>
                    <input value={it.qty} onChange={e => setItem(i, 'qty', e.target.value)} placeholder="0" style={{ ...inp, width: 60 }} />
                    <input value={it.part} onChange={e => setItem(i, 'part', e.target.value)} placeholder="Part #" style={{ ...inp, width: 130 }} />
                    <input value={it.description} onChange={e => setItem(i, 'description', e.target.value)} placeholder="Description" style={{ ...inp, flex: 1 }} />
                    <input value={it.price} onChange={e => setItem(i, 'price', e.target.value)} placeholder="0.00" style={{ ...inp, width: 110 }} />
                    <span style={{ width: 90, textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{money(num(it.price) * num(it.qty))}</span>
                    <button onClick={() => removeItem(i)} title="Remove" style={{ width: 26, height: 26, border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={14} /></button>
                  </div>
                ))}
                <button onClick={addItem} style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: BRAND, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><Plus size={14} /> Add line</button>
              </div>

              <div style={{ display: 'flex', gap: 16, marginTop: 20, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 280 }}>
                  <Sub>Payment details (remit-to)</Sub>
                  <textarea value={remit} onChange={e => setRemit(e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} />
                  <div style={{ marginTop: 10 }}>
                    <span style={lbl}>Note (footer)</span>
                    <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} />
                  </div>
                </div>
                <div style={{ width: 260 }}>
                  <Sub>Charges</Sub>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <Field label="Discount ($)"><input value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0.00" style={inp} /></Field>
                      <Field label="Tax ($)"><input value={tax} onChange={e => setTax(e.target.value)} placeholder="0.00" style={inp} /></Field>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <Field label="Shipping ($)"><input value={shipping} onChange={e => setShipping(e.target.value)} placeholder="0.00" style={inp} /></Field>
                      <Field label="CC ($)"><input value={cc} onChange={e => setCc(e.target.value)} placeholder="0.00" style={inp} /></Field>
                    </div>
                    <Field label="Amount paid ($)"><input value={amountPaid} onChange={e => setAmountPaid(e.target.value)} placeholder="0.00" style={inp} /></Field>
                  </div>
                  <div style={{ marginTop: 12, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, fontSize: 13 }}>
                    <Row k="Subtotal" v={money(subtotal)} />
                    {num(discount) > 0 && <Row k="Discount" v={`- ${money(discount)}`} />}
                    {num(tax) > 0 && <Row k="Tax" v={money(tax)} />}
                    {num(shipping) > 0 && <Row k="Shipping" v={money(shipping)} />}
                    {num(cc) > 0 && <Row k="CC Charges" v={money(cc)} />}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', marginTop: 5, paddingTop: 5, fontWeight: 700, color: '#0f172a' }}><span>Total</span><span>{money(total)}</span></div>
                    {num(amountPaid) > 0 && <Row k="Amount paid" v={`- ${money(amountPaid)}`} />}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0f172a', marginTop: 6, paddingTop: 7 }}>
                      <b>Balance Due</b><b style={{ color: BRAND }}>{money(balance)}</b>
                    </div>
                  </div>
                </div>
              </div>

              {error && <div style={{ marginTop: 14, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '9px 12px', fontSize: 13, color: '#dc2626' }}>⚠ {error}</div>}
            </>
          )}
        </div>

        <div style={{ borderTop: '1px solid #f1f5f9', padding: '14px 22px', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={generate} disabled={busy || loading || !!loadErr} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 10, border: 'none', background: BRAND, color: '#062b29', fontWeight: 800, fontSize: 13, cursor: (busy || loading) ? 'default' : 'pointer', opacity: (busy || loading || loadErr) ? 0.7 : 1 }}>
            <FileDown size={16} /> {busy ? 'Generating…' : 'Generate & Download PDF'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
