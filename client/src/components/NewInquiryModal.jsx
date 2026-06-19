import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../api'
import { useAuth } from '../App'
import { DISPOSITIONS, LEAD_SOURCES, ORDER_SOURCES, PPC_OPTIONS, VERIFICATION_OPTIONS } from './Badges'
import SearchableCustomerSelect from './SearchableCustomerSelect'

const BRAND = '#00D4C8'
const TYPES = [
  { value: 'lead',         label: '◎ Lead',        color: '#3b82f6' },
  { value: 'repeat',       label: '↻ Repeat',       color: '#6366f1' },
  { value: 'online_order', label: '◈ Online Order', color: '#f59e0b' },
]

const inp = { width: '100%', boxSizing: 'border-box', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px 14px', fontSize: '13px', color: '#0f172a', fontFamily: '"Plus Jakarta Sans", sans-serif', outline: 'none', transition: 'border 0.15s' }
const inpFocused = { border: `1px solid ${BRAND}`, boxShadow: `0 0 0 3px rgba(0,212,200,0.12)` }

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>{label}</div>
      {children}
    </div>
  )
}

function SInput({ value, onChange, placeholder, type = 'text' }) {
  const [f, setF] = useState(false)
  return <input type={type} value={value} onChange={onChange} placeholder={placeholder}
    style={{ ...inp, ...(f ? inpFocused : {}) }} onFocus={() => setF(true)} onBlur={() => setF(false)} />
}

function SSelect({ value, onChange, children }) {
  const [f, setF] = useState(false)
  return <select value={value} onChange={onChange} style={{ ...inp, cursor: 'pointer', ...(f ? inpFocused : {}) }}
    onFocus={() => setF(true)} onBlur={() => setF(false)}>{children}</select>
}

function STextarea({ value, onChange, placeholder }) {
  const [f, setF] = useState(false)
  return <textarea value={value} onChange={onChange} placeholder={placeholder} rows={2}
    style={{ ...inp, resize: 'none', ...(f ? inpFocused : {}) }} onFocus={() => setF(true)} onBlur={() => setF(false)} />
}

// Get today's date in YYYY-MM-DD format
function todayStr() {
  return new Date().toISOString().split('T')[0]
}

export default function NewInquiryModal({ defaultType = 'lead', customerId, onClose, onCreated }) {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [customers, setCustomers] = useState([])
  const [type, setType] = useState(defaultType)
  const [disposition, setDisposition] = useState(defaultType === 'online_order' ? 'Processed' : 'Initial Contact')
  const [assignedTo, setAssignedTo] = useState(String(user.id))
  const [notes, setNotes] = useState('')
  const [ppcOrOutbound, setPpcOrOutbound] = useState('')
  const [orderAmount, setOrderAmount] = useState('')
  const [verification, setVerification] = useState('')
  const [customDate, setCustomDate] = useState(todayStr()) // default today
  const [selectedCustomerId, setSelectedCustomerId] = useState(customerId ? String(customerId) : '')
  const [requirements, setRequirements] = useState([{ part_number: '', quantity: '' }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [isNewCustomer, setIsNewCustomer] = useState(false)
  const [custName, setCustName] = useState('')
  const [custEmail, setCustEmail] = useState('')
  const [custPhone, setCustPhone] = useState('')
  const [custCompany, setCustCompany] = useState('')
  const [custSource, setCustSource] = useState('')

  useEffect(() => {
    api.getUsers().then(setUsers)
    if (!customerId) api.getCustomers().then(setCustomers)
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleTypeChange = (t) => {
    setType(t)
    setDisposition(t === 'online_order' ? 'Processed' : 'Initial Contact')
  }

  const addReq = () => setRequirements(r => [...r, { part_number: '', quantity: '' }])
  const removeReq = (i) => setRequirements(r => r.filter((_, idx) => idx !== i))
  const updateReq = (i, k, v) => setRequirements(r => r.map((x, idx) => idx === i ? { ...x, [k]: v } : x))

  const handleSubmit = async () => {
    setSaving(true); setError('')
    try {
      let cid = customerId || selectedCustomerId
      if (!customerId && isNewCustomer) {
        if (!custName.trim()) throw new Error('Customer name is required')
        const c = await api.createCustomer({ name: custName, email: custEmail, phone: custPhone, company: custCompany, lead_source: custSource, assigned_to: assignedTo })
        cid = c.id
      }
      if (!cid) throw new Error('Please select or create a customer')
      const validReqs = requirements.filter(r => r.part_number.trim())
      await api.createInquiry({
        customer_id: cid, type, disposition,
        assigned_to: user.role === 'ae' ? user.id : assignedTo,
        notes, ppc_or_outbound: ppcOrOutbound,
        order_amount: orderAmount, order_ref: verification,
        requirements: validReqs,
        custom_date: customDate, // send selected date
      })
      onCreated()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const sourcesForType = type === 'online_order' ? ORDER_SOURCES : LEAD_SOURCES
  const dispositionsForType = type === 'online_order' ? ['Processed', 'Cancelled'] : DISPOSITIONS.filter(d => d !== 'Processed' && d !== 'Cancelled')

  const modal = (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#ffffff', borderRadius: '20px', boxShadow: '0 24px 80px rgba(0,0,0,0.25)', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', animation: 'modalIn 0.18s ease-out', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
        <style>{`@keyframes modalIn { from { opacity:0; transform:scale(0.96) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } } @keyframes spin { to { transform:rotate(360deg); } }`}</style>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', zIndex: 10, borderRadius: '20px 20px 0 0' }}>
          <div style={{ fontFamily: '"Bricolage Grotesque", sans-serif', fontWeight: 700, fontSize: '16px', color: '#0f172a' }}>New Inquiry</div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: 'none', background: '#f1f5f9', cursor: 'pointer', fontSize: 18, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        <div style={{ padding: '20px 24px 24px' }}>
          {/* Type */}
          <Field label="Type">
            <div style={{ display: 'flex', gap: '8px' }}>
              {TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => handleTypeChange(t.value)}
                  style={{ flex: 1, padding: '10px 8px', borderRadius: '12px', border: '2px solid', borderColor: type === t.value ? t.color : '#e2e8f0', background: type === t.value ? `${t.color}12` : '#fff', color: type === t.value ? t.color : '#64748b', fontWeight: 600, fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                  {t.label}
                </button>
              ))}
            </div>
          </Field>

          {/* Date + Assign row */}
          <div style={{ display: 'grid', gridTemplateColumns: user.role === 'manager' ? '1fr 1fr' : '1fr', gap: '12px', marginBottom: '14px' }}>
            <Field label="Date">
              <SInput type="date" value={customDate} onChange={e => setCustomDate(e.target.value)} />
            </Field>
            {user.role === 'manager' && (
              <Field label="Assign to">
                <SSelect value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
                  {users.map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
                </SSelect>
              </Field>
            )}
          </div>

          {/* Customer */}
          {!customerId && (
            <Field label={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span>Customer</span>
                <button type="button" onClick={() => { setIsNewCustomer(!isNewCustomer); setSelectedCustomerId('') }}
                  style={{ fontSize: '11px', color: BRAND, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textTransform: 'none', letterSpacing: 0 }}>
                  {isNewCustomer ? '← Select existing' : '+ New customer'}
                </button>
              </div>
            }>
              {isNewCustomer ? (
                <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '14px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <SInput value={custName} onChange={e => setCustName(e.target.value)} placeholder="Full name *" />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <SInput value={custEmail} onChange={e => setCustEmail(e.target.value)} placeholder="Email" type="email" />
                    <SInput value={custPhone} onChange={e => setCustPhone(e.target.value)} placeholder="Phone" />
                  </div>
                  <SInput value={custCompany} onChange={e => setCustCompany(e.target.value)} placeholder="Company" />
                  <SSelect value={custSource} onChange={e => setCustSource(e.target.value)}>
                    <option value="">Lead source</option>
                    {sourcesForType.map(s => <option key={s}>{s}</option>)}
                  </SSelect>
                </div>
              ) : (
                <SearchableCustomerSelect customers={customers} value={selectedCustomerId} onChange={setSelectedCustomerId} placeholder="Search by name, company or email..." />
              )}
            </Field>
          )}

          {/* Part Numbers */}
          <Field label={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span>Part Numbers</span>
              <button type="button" onClick={addReq} style={{ fontSize: '11px', color: BRAND, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textTransform: 'none', letterSpacing: 0 }}>+ Add row</button>
            </div>
          }>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {requirements.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}><SInput value={r.part_number} onChange={e => updateReq(i, 'part_number', e.target.value)} placeholder="Part number / SKU" /></div>
                  <div style={{ width: '100px' }}><SInput value={r.quantity} onChange={e => updateReq(i, 'quantity', e.target.value)} placeholder="Qty" /></div>
                  {requirements.length > 1 && <button type="button" onClick={() => removeReq(i)} style={{ width: 32, height: 40, border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '18px', flexShrink: 0 }}>×</button>}
                </div>
              ))}
            </div>
          </Field>

          {/* Disposition */}
          <Field label={type === 'online_order' ? 'Status' : 'Disposition'}>
            <SSelect value={disposition} onChange={e => setDisposition(e.target.value)}>
              {dispositionsForType.map(d => <option key={d}>{d}</option>)}
            </SSelect>
          </Field>

          {/* Repeat-specific */}
          {type === 'repeat' && (
            <Field label="PPC or Outbound Repeat">
              <SSelect value={ppcOrOutbound} onChange={e => setPpcOrOutbound(e.target.value)}>
                <option value="">Select...</option>
                {PPC_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </SSelect>
            </Field>
          )}

          {/* Online Order specific */}
          {type === 'online_order' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <Field label="Source">
                <SSelect value={custSource} onChange={e => setCustSource(e.target.value)}>
                  <option value="">Select...</option>
                  {ORDER_SOURCES.map(s => <option key={s}>{s}</option>)}
                </SSelect>
              </Field>
              <Field label="Verification">
                <SSelect value={verification} onChange={e => setVerification(e.target.value)}>
                  <option value="">Select...</option>
                  {VERIFICATION_OPTIONS.map(v => <option key={v}>{v}</option>)}
                </SSelect>
              </Field>
              <Field label="Order Amount">
                <SInput value={orderAmount} onChange={e => setOrderAmount(e.target.value)} placeholder="e.g. 500" />
              </Field>
            </div>
          )}

          {/* Comments */}
          <Field label="Comments">
            <STextarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add any notes or comments..." />
          </Field>

          {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '10px 14px', fontSize: '13px', color: '#dc2626', marginBottom: '14px' }}>⚠ {error}</div>}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 600, fontSize: '14px', cursor: 'pointer', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>Cancel</button>
            <button onClick={handleSubmit} disabled={saving} style={{ flex: 2, padding: '12px', borderRadius: '12px', border: 'none', background: saving ? '#94a3b8' : BRAND, color: '#0d0d0d', fontWeight: 700, fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: '"Plus Jakarta Sans", sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {saving ? <><div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #0d0d0d', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />Creating...</> : `Create ${type === 'lead' ? 'Lead' : type === 'repeat' ? 'Repeat Inquiry' : 'Online Order'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
