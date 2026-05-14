import { useState, useEffect } from 'react'
import { api } from '../api'
import { useAuth } from '../App'
import Modal from './Modal'
import { DISPOSITIONS, LEAD_SOURCES, PPC_OPTIONS } from './Badges'

const TYPES = [
  { value: 'lead', label: '🎯 Lead' },
  { value: 'repeat', label: '🔁 Repeat Inquiry' },
  { value: 'online_order', label: '🛒 Online Order' },
]

export default function NewInquiryModal({ defaultType = 'lead', customerId, onClose, onCreated }) {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [customers, setCustomers] = useState([])
  const [form, setForm] = useState({
    customer_id: customerId || '',
    type: defaultType,
    disposition: 'Initial Contact',
    assigned_to: user.id,
    notes: '',
    ppc_or_outbound: '',
    order_amount: '',
    order_ref: '',
  })
  const [requirements, setRequirements] = useState([{ part_number: '', quantity: '' }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newCustomer, setNewCustomer] = useState(false)
  const [custForm, setCustForm] = useState({ name: '', email: '', phone: '', company: '', lead_source: '' })

  useEffect(() => {
    api.getUsers().then(setUsers)
    if (!customerId) api.getCustomers().then(setCustomers)
  }, [])

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const addReq = () => setRequirements(r => [...r, { part_number: '', quantity: '' }])
  const updateReq = (i, k, v) => setRequirements(r => r.map((x, idx) => idx === i ? { ...x, [k]: v } : x))
  const removeReq = (i) => setRequirements(r => r.filter((_, idx) => idx !== i))

  const handleSubmit = async () => {
    setSaving(true); setError('')
    try {
      let cid = form.customer_id
      if (newCustomer) {
        if (!custForm.name.trim()) throw new Error('Customer name is required')
        const c = await api.createCustomer({ ...custForm, assigned_to: form.assigned_to })
        cid = c.id
      }
      if (!cid) throw new Error('Please select or create a customer')
      const validReqs = requirements.filter(r => r.part_number.trim())
      await api.createInquiry({ ...form, customer_id: cid, requirements: validReqs })
      onCreated()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <Modal title="New Inquiry" onClose={onClose} wide>
      <div className="space-y-4">
        {/* Type selector */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Type</label>
          <div className="flex gap-2">
            {TYPES.map(t => (
              <button key={t.value} type="button" onClick={() => setF('type', t.value)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${form.type === t.value ? 'border-brand-400 bg-brand-50 text-brand-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Customer */}
        {!customerId && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-700">Customer</label>
              <button type="button" onClick={() => setNewCustomer(!newCustomer)} className="text-xs text-brand-500 font-medium hover:text-brand-600">
                {newCustomer ? '← Select existing' : '+ New customer'}
              </button>
            </div>
            {newCustomer ? (
              <div className="space-y-2 bg-gray-50 rounded-xl p-3">
                <input className="input" placeholder="Full name *" value={custForm.name} onChange={e => setCustForm(f => ({ ...f, name: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <input className="input" placeholder="Email" value={custForm.email} onChange={e => setCustForm(f => ({ ...f, email: e.target.value }))} />
                  <input className="input" placeholder="Phone" value={custForm.phone} onChange={e => setCustForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <input className="input" placeholder="Company" value={custForm.company} onChange={e => setCustForm(f => ({ ...f, company: e.target.value }))} />
                <select className="input" value={custForm.lead_source} onChange={e => setCustForm(f => ({ ...f, lead_source: e.target.value }))}>
                  <option value="">Lead source</option>
                  {LEAD_SOURCES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            ) : (
              <select className="input" value={form.customer_id} onChange={e => setF('customer_id', e.target.value)}>
                <option value="">Select customer</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>)}
              </select>
            )}
          </div>
        )}

        {/* Requirements */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-gray-700">Part Numbers</label>
            <button type="button" onClick={addReq} className="text-xs text-brand-500 font-medium">+ Add row</button>
          </div>
          <div className="space-y-2">
            {requirements.map((r, i) => (
              <div key={i} className="flex gap-2">
                <input className="input flex-1" placeholder="Part number" value={r.part_number} onChange={e => updateReq(i, 'part_number', e.target.value)} />
                <input className="input w-28" placeholder="Qty" value={r.quantity} onChange={e => updateReq(i, 'quantity', e.target.value)} />
                {requirements.length > 1 && <button type="button" onClick={() => removeReq(i)} className="text-red-400 hover:text-red-500 px-1 text-lg">×</button>}
              </div>
            ))}
          </div>
        </div>

        {/* Disposition + Assign */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Disposition</label>
            <select className="input" value={form.disposition} onChange={e => setF('disposition', e.target.value)}>
              {DISPOSITIONS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          {user.role === 'manager' && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Assign to</label>
              <select className="input" value={form.assigned_to} onChange={e => setF('assigned_to', e.target.value)}>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Repeat-specific: PPC or Outbound */}
        {form.type === 'repeat' && (
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">PPC or Outbound Repeat</label>
            <select className="input" value={form.ppc_or_outbound} onChange={e => setF('ppc_or_outbound', e.target.value)}>
              <option value="">Select...</option>
              {PPC_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        )}

        {/* Online order-specific fields */}
        {form.type === 'online_order' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Order #</label>
              <input className="input" placeholder="Order reference" value={form.order_ref} onChange={e => setF('order_ref', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Order Amount</label>
              <input className="input" placeholder="e.g. $500" value={form.order_amount} onChange={e => setF('order_amount', e.target.value)} />
            </div>
          </div>
        )}

        {/* Comments/Notes */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Comments</label>
          <textarea className="input resize-none" rows={2} placeholder="Add comments..." value={form.notes} onChange={e => setF('notes', e.target.value)} />
        </div>

        {error && <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-3 py-2 rounded-xl">{error}</div>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">{saving ? 'Creating...' : 'Create'}</button>
        </div>
      </div>
    </Modal>
  )
}
