import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Plus, Trash2, FileDown } from 'lucide-react'
import { quotesApi } from '../api'

const BRAND = '#00D4C8'
const DEFAULT_ADDR = 'Unit # OFC 004, 5200 Thatcher Rd, Downers Grove, Illinois 60515'
const DEFAULT_NOTE = 'If you are paying via CC, there will be additional 3% CC Charges on total amount of order.'

const inp = { width: '100%', boxSizing: 'border-box', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 9, padding: '8px 10px', fontSize: 13, color: '#0f172a', fontFamily: 'inherit', outline: 'none' }
const lbl = { fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4, display: 'block' }
const num = v => { const n = parseFloat(String(v ?? '').replace(/[$,\s]/g, '')); return isNaN(n) ? 0 : n }
const money = v => `$${num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const todayISO = () => new Date().toISOString().slice(0, 10)
const plusDaysISO = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
const fmtDate = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${m}/${d}/${y}` }

function Field({ label, children, w }) { return <div style={{ width: w || 'auto', flex: w ? 'none' : 1, minWidth: 0 }}><span style={lbl}>{label}</span>{children}</div> }
function Sub({ children }) { return <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0 12px' }}><span style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{children}</span><span style={{ flex: 1, height: 1, background: '#eef2f6' }} /></div> }

export default function QuoteModal({ inquiry, user, onClose }) {
  const ek = `quote_prep_email_${user?.id}`, pk = `quote_prep_phone_${user?.id}`
  const [quoteNumber, setQuoteNumber] = useState('')
  const [version, setVersion] = useState('1')
  const [project, setProject] = useState('NA')
  const [date, setDate] = useState(todayISO())
  const [expiration, setExpiration] = useState(plusDaysISO(5))
  const [paymentTerms, setPaymentTerms] = useState('Pre-Payment')
  const [from, setFrom] = useState({ company: 'Tech Atlantix', address: DEFAULT_ADDR, name: user?.name || '', email: localStorage.getItem(ek) || '', phone: localStorage.getItem(pk) || '' })
  const [to, setTo] = useState({ name: inquiry.customer_name || '', company: inquiry.customer_company || '', email: inquiry.customer_email || '', phone: inquiry.customer_phone || '', address: '' })
  const [items, setItems] = useState((inquiry.requirements || []).map(r => ({ part: r.part_number || '', description: '', qty: r.quantity ?? '', price: '' })))
  const [leadTime, setLeadTime] = useState('5-7 Business Days')
  const [condition, setCondition] = useState('Refurbished Grade A')
  const [warranty, setWarranty] = useState('1 Years')
  const [approvedBy, setApprovedBy] = useState('')
  const [discount, setDiscount] = useState('')
  const [tax, setTax] = useState('')
  const [shipping, setShipping] = useState('')
  const [note, setNote] = useState(DEFAULT_NOTE)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { quotesApi.nextNumber().then(r => setQuoteNumber(r.quote_number)).catch(() => {}) }, [])

  const setF = (k, v) => setFrom(f => ({ ...f, [k]: v }))
  const setT = (k, v) => setTo(t => ({ ...t, [k]: v }))
  const setItem = (i, k, v) => setItems(arr => arr.map((it, idx) => idx === i ? { ...it, [k]: v } : it))
  const addItem = () => setItems(a => [...a, { part: '', description: '', qty: '', price: '' }])
  const removeItem = i => setItems(a => a.filter((_, idx) => idx !== i))

  const subtotal = items.reduce((t, it) => t + num(it.price) * num(it.qty), 0)
  const grand = subtotal - num(discount) + num(tax) + num(shipping)

  const generate = async () => {
    setBusy(true); setError('')
    try {
      let number = quoteNumber
      try { const r = await quotesApi.record({ inquiry_id: inquiry.id, quote_number: quoteNumber, customer_name: to.name, customer_company: to.company, total: grand }); if (r?.quote_number) number = r.quote_number } catch { /* keep going even if logging fails */ }
      localStorage.setItem(ek, from.email || ''); localStorage.setItem(pk, from.phone || '')
      const { generateQuoteBlob } = await import('../lib/quotePdf.jsx')
      const blob = await generateQuoteBlob({
        quoteNumber: number, version, project, date: fmtDate(date), expiration: fmtDate(expiration), paymentTerms,
        from, to, items, leadTime, condition, warranty, approvedBy,
        discount: num(discount), tax: num(tax), shipping: num(shipping), note,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `Quote-${number || 'TA'}.pdf`; document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
      onClose()
    } catch (e) { setError(e.message || 'Could not generate the PDF.') } finally { setBusy(false) }
  }

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 920, maxHeight: '94vh', display: 'flex', flexDirection: 'column', fontFamily: '"Plus Jakarta Sans",sans-serif', boxShadow: '0 32px 90px rgba(0,0,0,0.3)' }}>
        {/* Header */}
        <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', fontFamily: '"Bricolage Grotesque",sans-serif' }}>Generate Quote</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>For {inquiry.customer_name}{inquiry.customer_company ? ` · ${inquiry.customer_company}` : ''}</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 9, border: 'none', background: '#f1f5f9', cursor: 'pointer', color: '#64748b' }}><X size={16} /></button>
        </div>

        <div style={{ overflowY: 'auto', padding: '18px 22px', flex: 1, background: '#f8fafc' }}>
          {/* Quote meta */}
          <Sub>Quote details</Sub>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
            <Field label="Quote #" w={150}><input value={quoteNumber} onChange={e => setQuoteNumber(e.target.value)} style={inp} /></Field>
            <Field label="Version" w={80}><input value={version} onChange={e => setVersion(e.target.value)} style={inp} /></Field>
            <Field label="Project" w={120}><input value={project} onChange={e => setProject(e.target.value)} style={inp} /></Field>
            <Field label="Date" w={140}><input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} /></Field>
            <Field label="Valid until" w={140}><input type="date" value={expiration} onChange={e => setExpiration(e.target.value)} style={inp} /></Field>
            <Field label="Payment terms"><input value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} style={inp} /></Field>
          </div>

          {/* From / To */}
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
              <Sub>To (customer)</Sub>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Field label="Name"><input value={to.name} onChange={e => setT('name', e.target.value)} style={inp} /></Field>
                  <Field label="Company"><input value={to.company} onChange={e => setT('company', e.target.value)} style={inp} /></Field>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Field label="Email"><input value={to.email} onChange={e => setT('email', e.target.value)} style={inp} /></Field>
                  <Field label="Phone"><input value={to.phone} onChange={e => setT('phone', e.target.value)} style={inp} /></Field>
                </div>
                <Field label="Address"><input value={to.address} onChange={e => setT('address', e.target.value)} placeholder="Type the customer's address" style={inp} /></Field>
              </div>
            </div>
          </div>

          {/* Line items */}
          <div style={{ marginTop: 18 }}>
            <Sub>Line items</Sub>
            <div style={{ display: 'flex', gap: 8, fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', padding: '0 4px 4px' }}>
              <span style={{ width: 60 }}>Qty</span><span style={{ width: 130 }}>Part #</span><span style={{ flex: 1 }}>Description</span><span style={{ width: 110 }}>Price/unit</span><span style={{ width: 90, textAlign: 'right' }}>Ext.</span><span style={{ width: 26 }} />
            </div>
            {items.map((it, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 7 }}>
                <input value={it.qty} onChange={e => setItem(i, 'qty', e.target.value)} placeholder="0" style={{ ...inp, width: 60 }} />
                <input value={it.part} onChange={e => setItem(i, 'part', e.target.value)} placeholder="Part #" style={{ ...inp, width: 130 }} />
                <input value={it.description} onChange={e => setItem(i, 'description', e.target.value)} placeholder="Product description" style={{ ...inp, flex: 1 }} />
                <input value={it.price} onChange={e => setItem(i, 'price', e.target.value)} placeholder="0.00" style={{ ...inp, width: 110 }} />
                <span style={{ width: 90, textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{money(num(it.price) * num(it.qty))}</span>
                <button onClick={() => removeItem(i)} title="Remove" style={{ width: 26, height: 26, border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={14} /></button>
              </div>
            ))}
            <button onClick={addItem} style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: BRAND, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><Plus size={14} /> Add line</button>
          </div>

          {/* Terms + charges */}
          <div style={{ display: 'flex', gap: 16, marginTop: 20, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <Sub>Terms</Sub>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Field label="Lead time"><input value={leadTime} onChange={e => setLeadTime(e.target.value)} style={inp} /></Field>
                  <Field label="Warranty"><input value={warranty} onChange={e => setWarranty(e.target.value)} style={inp} /></Field>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Field label="Condition"><input value={condition} onChange={e => setCondition(e.target.value)} style={inp} /></Field>
                  <Field label="Approved by"><input value={approvedBy} onChange={e => setApprovedBy(e.target.value)} placeholder="Name" style={inp} /></Field>
                </div>
                <Field label="Note (footer)"><textarea value={note} onChange={e => setNote(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} /></Field>
              </div>
            </div>
            <div style={{ width: 260 }}>
              <Sub>Charges</Sub>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Field label="Discount ($)"><input value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0.00" style={inp} /></Field>
                <Field label="Tax ($)"><input value={tax} onChange={e => setTax(e.target.value)} placeholder="0.00" style={inp} /></Field>
                <Field label="Shipping ($)"><input value={shipping} onChange={e => setShipping(e.target.value)} placeholder="0.00" style={inp} /></Field>
              </div>
              <div style={{ marginTop: 12, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, fontSize: 13 }}>
                <Row k="Subtotal" v={money(subtotal)} />
                {num(discount) > 0 && <Row k="Discount" v={`- ${money(discount)}`} />}
                {num(tax) > 0 && <Row k="Tax" v={money(tax)} />}
                {num(shipping) > 0 && <Row k="Shipping" v={money(shipping)} />}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0f172a', marginTop: 6, paddingTop: 7 }}>
                  <b>Grand Total</b><b style={{ color: BRAND }}>{money(grand)}</b>
                </div>
              </div>
            </div>
          </div>

          {error && <div style={{ marginTop: 14, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '9px 12px', fontSize: 13, color: '#dc2626' }}>⚠ {error}</div>}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #f1f5f9', padding: '14px 22px', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={generate} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 10, border: 'none', background: BRAND, color: '#062b29', fontWeight: 800, fontSize: 13, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}>
            <FileDown size={16} /> {busy ? 'Generating…' : 'Generate & Download PDF'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function Row({ k, v }) { return <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#475569' }}><span>{k}</span><span>{v}</span></div> }
