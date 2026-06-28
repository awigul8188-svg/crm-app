import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, Plus, Trash2, FileDown } from 'lucide-react'
import { operationsApi } from '../api'

const BRAND = '#00D4C8'
const DEFAULT_ADDR = 'Unit # OFC 004, 5200 Thatcher Rd, Downers Grove, Illinois 60515'
const DEFAULT_NOTE = 'Please confirm availability, lead time, and pricing. Reference the PO number on all shipments and invoices.'

const inp = { width: '100%', boxSizing: 'border-box', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 9, padding: '8px 10px', fontSize: 13, color: '#0f172a', fontFamily: 'inherit', outline: 'none' }
const lbl = { fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4, display: 'block' }
const num = v => { const n = parseFloat(String(v ?? '').replace(/[$,\s]/g, '')); return isNaN(n) ? 0 : n }
const money = v => `$${num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const todayISO = () => new Date().toISOString().slice(0, 10)
const fmtDate = iso => { if (!iso) return ''; const [y, m, d] = String(iso).slice(0, 10).split('-'); return d ? `${m}/${d}/${y}` : '' }

function Field({ label, children, w }) { return <div style={{ width: w || 'auto', flex: w ? 'none' : 1, minWidth: 0 }}><span style={lbl}>{label}</span>{children}</div> }
function Sub({ children }) { return <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0 12px' }}><span style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{children}</span><span style={{ flex: 1, height: 1, background: '#eef2f6' }} /></div> }

export default function POModal({ orderId, user, onClose, onGenerated }) {
  const ek = `quote_prep_email_${user?.id}`, pk = `quote_prep_phone_${user?.id}`
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState('')
  const [poNumber, setPoNumber] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [date, setDate] = useState(todayISO())
  const [terms, setTerms] = useState('')
  const [suppliers, setSuppliers] = useState([])
  const [supplierId, setSupplierId] = useState('')
  const [allItems, setAllItems] = useState([])
  const [rows, setRows] = useState([])           // editable line rows for the chosen supplier
  const [from, setFrom] = useState({ company: 'Tech Atlantix', address: DEFAULT_ADDR, name: user?.name || '', email: localStorage.getItem(ek) || '', phone: localStorage.getItem(pk) || '' })
  const [shipTo, setShipTo] = useState({ company: 'Tech Atlantix', address: DEFAULT_ADDR })
  const [note, setNote] = useState(DEFAULT_NOTE)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    Promise.all([operationsApi.poData(orderId), operationsApi.poNextNumber().catch(() => ({ po_number: '' }))])
      .then(([d, n]) => {
        if (!alive) return
        setOrderNumber(d.order_number || '')
        setSuppliers(d.suppliers || [])
        setAllItems(d.items || [])
        setSupplierId(d.suppliers?.[0]?.id != null ? String(d.suppliers[0].id) : '')
        setPoNumber(n.po_number || '')
        setLoading(false)
      }).catch(e => { if (alive) { setLoadErr(e.message || 'Could not load the order.'); setLoading(false) } })
    return () => { alive = false }
  }, [orderId])

  const supplier = useMemo(() => suppliers.find(s => String(s.id) === String(supplierId)) || null, [suppliers, supplierId])

  // When the chosen supplier changes, rebuild the editable rows from that supplier's lines.
  useEffect(() => {
    const mine = allItems.filter(it => String(it.supplier_id) === String(supplierId))
    setRows(mine.map(it => ({ id: it.id, part: it.part_number || '', description: it.description || it.product || '', qty: it.quantity ?? '', price: it.buying ?? '', condition: it.product_condition || '' })))
    const term = mine.map(it => it.supplier_terms).find(Boolean)
    setTerms(term || 'Net 30')
  }, [supplierId, allItems])

  const setRow = (i, k, v) => setRows(a => a.map((r, idx) => idx === i ? { ...r, [k]: v } : r))
  const removeRow = i => setRows(a => a.filter((_, idx) => idx !== i))
  const addRow = () => setRows(a => [...a, { id: null, part: '', description: '', qty: '', price: '', condition: '' }])

  const total = rows.reduce((t, r) => t + num(r.price) * num(r.qty), 0)
  const noSupplierCount = allItems.filter(it => !it.supplier_id).length

  const generate = async () => {
    if (!supplier) { setError('Pick a supplier first (this order has no supplier on its lines).'); return }
    setBusy(true); setError('')
    try {
      let number = poNumber
      try {
        const r = await operationsApi.recordPO({ order_id: orderId, supplier_id: supplier.id, supplier_name: supplier.company, po_number: poNumber, total, item_ids: rows.map(r => r.id).filter(Boolean) })
        if (r?.po_number) number = r.po_number
      } catch { /* keep going even if recording fails */ }
      localStorage.setItem(ek, from.email || ''); localStorage.setItem(pk, from.phone || '')
      const { generatePOBlob } = await import('../lib/poPdf.jsx')
      const blob = await generatePOBlob({
        poNumber: number, orderNumber, date: fmtDate(date), terms,
        from, vendor: { company: supplier.company, rep: supplier.rep_name, email: supplier.email, phone: supplier.phone },
        shipTo, items: rows, note,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `PO-${number || 'TA'}.pdf`; document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
      onGenerated && onGenerated()
      onClose()
    } catch (e) { setError(e.message || 'Could not generate the PDF.') } finally { setBusy(false) }
  }

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100001, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 920, maxHeight: '94vh', display: 'flex', flexDirection: 'column', fontFamily: '"Plus Jakarta Sans",sans-serif', boxShadow: '0 32px 90px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', fontFamily: '"Bricolage Grotesque",sans-serif' }}>Generate Purchase Order</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>{supplier ? `To ${supplier.company}` : 'Supplier PO'}{orderNumber ? ` · Order ${orderNumber}` : ''}</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 9, border: 'none', background: '#f1f5f9', cursor: 'pointer', color: '#64748b' }}><X size={16} /></button>
        </div>

        <div style={{ overflowY: 'auto', padding: '18px 22px', flex: 1, background: '#f8fafc' }}>
          {loading ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>Loading order…</div>
          ) : loadErr ? (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#dc2626' }}>⚠ {loadErr}</div>
          ) : suppliers.length === 0 ? (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#92400e' }}>This order has no supplier on its line items yet. Assign a supplier to a line (in the vendor form) before generating a PO.</div>
          ) : (
            <>
              <Sub>PO details</Sub>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
                <Field label="PO #" w={150}><input value={poNumber} onChange={e => setPoNumber(e.target.value)} style={inp} /></Field>
                <Field label="Date" w={140}><input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} /></Field>
                <Field label="Terms" w={150}><input value={terms} onChange={e => setTerms(e.target.value)} style={inp} /></Field>
                <Field label="Supplier">
                  <select value={supplierId} onChange={e => setSupplierId(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.company}</option>)}
                  </select>
                </Field>
              </div>
              {suppliers.length > 1 && <div style={{ fontSize: 12, color: '#64748b', marginTop: -8, marginBottom: 14 }}>This order has {suppliers.length} suppliers — one PO is generated per supplier. Switch the supplier above to make the others.</div>}

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 280 }}>
                  <Sub>Vendor</Sub>
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, fontSize: 13 }}>
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>{supplier?.company || '—'}</div>
                    {!!supplier?.rep_name && <div style={{ color: '#475569', marginTop: 2 }}>{supplier.rep_name}</div>}
                    {!!supplier?.email && <div style={{ color: '#475569' }}>{supplier.email}</div>}
                    {!!supplier?.phone && <div style={{ color: '#475569' }}>{supplier.phone}</div>}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 280 }}>
                  <Sub>Ship to</Sub>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <Field label="Company"><input value={shipTo.company} onChange={e => setShipTo(s => ({ ...s, company: e.target.value }))} style={inp} /></Field>
                    <Field label="Address"><input value={shipTo.address} onChange={e => setShipTo(s => ({ ...s, address: e.target.value }))} style={inp} /></Field>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 18 }}>
                <Sub>Line items (cost to us)</Sub>
                <div style={{ display: 'flex', gap: 8, fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', padding: '0 4px 4px' }}>
                  <span style={{ width: 60 }}>Qty</span><span style={{ width: 120 }}>Part #</span><span style={{ flex: 1 }}>Description</span><span style={{ width: 110 }}>Unit cost</span><span style={{ width: 90, textAlign: 'right' }}>Amount</span><span style={{ width: 26 }} />
                </div>
                {rows.map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 7 }}>
                    <input value={r.qty} onChange={e => setRow(i, 'qty', e.target.value)} placeholder="0" style={{ ...inp, width: 60 }} />
                    <input value={r.part} onChange={e => setRow(i, 'part', e.target.value)} placeholder="Part #" style={{ ...inp, width: 120 }} />
                    <input value={r.description} onChange={e => setRow(i, 'description', e.target.value)} placeholder="Description" style={{ ...inp, flex: 1 }} />
                    <input value={r.price} onChange={e => setRow(i, 'price', e.target.value)} placeholder="0.00" style={{ ...inp, width: 110 }} />
                    <span style={{ width: 90, textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{money(num(r.price) * num(r.qty))}</span>
                    <button onClick={() => removeRow(i)} title="Remove" style={{ width: 26, height: 26, border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={14} /></button>
                  </div>
                ))}
                {rows.length === 0 && <div style={{ fontSize: 13, color: '#94a3b8', padding: '8px 4px' }}>No lines for this supplier.</div>}
                <button onClick={addRow} style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: BRAND, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><Plus size={14} /> Add line</button>
                {noSupplierCount > 0 && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>{noSupplierCount} line{noSupplierCount > 1 ? 's have' : ' has'} no supplier and {noSupplierCount > 1 ? 'are' : 'is'} not on any PO.</div>}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <div style={{ width: 240, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: '#0f172a' }}><span>PO Total</span><span style={{ color: BRAND }}>{money(total)}</span></div>
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <span style={lbl}>Note (footer)</span>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} />
              </div>

              {error && <div style={{ marginTop: 14, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '9px 12px', fontSize: 13, color: '#dc2626' }}>⚠ {error}</div>}
            </>
          )}
        </div>

        <div style={{ borderTop: '1px solid #f1f5f9', padding: '14px 22px', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={generate} disabled={busy || loading || !!loadErr || suppliers.length === 0} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 10, border: 'none', background: BRAND, color: '#062b29', fontWeight: 800, fontSize: 13, cursor: (busy || loading) ? 'default' : 'pointer', opacity: (busy || loading || loadErr || suppliers.length === 0) ? 0.7 : 1 }}>
            <FileDown size={16} /> {busy ? 'Generating…' : 'Generate & Download PO'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
