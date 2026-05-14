import { useState, useEffect } from 'react'
import { api } from '../api'
import { useAuth } from '../App'
import Modal from './Modal'

const LEAD_SOURCES = ['Email Lead', 'Chat Lead', 'Call Lead', 'Website RFQ']
const TYPES = [
  { value: 'lead', label: '🎯 Lead' },
  { value: 'repeat', label: '🔁 Repeat Inquiry' },
  { value: 'online_order', label: '🛒 Online Order' },
]
const STATUSES = ['open', 'in_progress', 'closed', 'won', 'lost']

export default function NewInquiryModal({ defaultType = 'lead', customerId, onClose, onCreated }) {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [customers, setCustomers] = useState([])
  const [form, setForm] = useState({
    customer_id: customerId || '',
    type: defaultType,
    status: 'open',
    assigned_to: user.id,
    notes: '',
  })
  const [requirements, setRequirements] = useState([{ part_number: '', quantity: '' }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // New customer fields (if creating inline)
  const [newCustomer, setNewCustomer] = useState(false)
  const [custForm, setCustForm] = useState({ name: '', email: '', phone: '', company: '', lead_source: '' })

  useEffect(() => {
    api.getUsers().then(setUsers)
    if (!customerId) api.getCustomers().then(setCustomers)
  }, [])

  const addReq = () => setRequirements([...requirements, { part_number: '', quantity: '' }])
  const updateReq = (i, field, val) => {
    const r = [...requirements]
    r[i][field] = val
    setRequirements(r)
  }
  const removeReq = (i) => setRequirements(requirements.filter((_, idx) => idx !== i))

  const handleSubmit = async () => {
    setSaving(true)
    setError('')
    try {
      let cid = form.customer_id

      // Create customer inline if needed
      if (newCustomer) {
        if (!custForm.name.trim()) throw new Error('Customer name is required')
        const cust = await api.createCustomer({ ...custForm, assigned_to: form.assigned_to })
        cid = cust.id
      }

      if (!cid) throw new Error('Please select or create a customer')

      const validReqs = requirements.filter(r => r.part_number.trim() && r.quantity.trim())
      await api.createInquiry({ ...form, customer_id: cid, requirements: validReqs })
      onCreated()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="New Inquiry" onClose={onClose} wide>
      <div className="space-y-4">
        {/* Type */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Type</label>
          <div className="flex gap-2">
            {TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => setForm({ ...form, type: t.value })}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                  form.type === t.value
                    ? 'border-brand-400 bg-brand-50 text-brand-600'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
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
              <button
                type="button"
                onClick={() => setNewCustomer(!newCustomer)}
                className="text-xs text-brand-500 font-medium hover:text-brand-600"
              >
                {newCustomer ? '← Select existing' : '+ New customer'}
              </button>
            </div>
            {newCustomer ? (
              <div className="space-y-2 bg-gray-50 rounded-xl p-3">
                <input className="input" placeholder="Customer name *" value={custForm.name} onChange={e => setCustForm({ ...custForm, name: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <input className="input" placeholder="Email" value={custForm.email} onChange={e => setCustForm({ ...custForm, email: e.target.value })} />
                  <input className="input" placeholder="Phone" value={custForm.phone} onChange={e => setCustForm({ ...custForm, phone: e.target.value })} />
                </div>
                <input className="input" placeholder="Company" value={custForm.company} onChange={e => setCustForm({ ...custForm, company: e.target.value })} />
                <select className="input" value={custForm.lead_source} onChange={e => setCustForm({ ...custForm, lead_source: e.target.value })}>
                  <option value="">Lead source</option>
                  {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            ) : (
              <select className="input" value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })}>
                <option value="">Select customer</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Requirements */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-gray-700">Requirements</label>
            <button type="button" onClick={addReq} className="text-xs text-brand-500 font-medium hover:text-brand-600">+ Add row</button>
          </div>
          <div className="space-y-2">
            {requirements.map((r, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="Part number"
                  value={r.part_number}
                  onChange={e => updateReq(i, 'part_number', e.target.value)}
                />
                <input
                  className="input w-28"
                  placeholder="Qty"
                  value={r.quantity}
                  onChange={e => updateReq(i, 'quantity', e.target.value)}
                />
                {requirements.length > 1 && (
                  <button type="button" onClick={() => removeReq(i)} className="text-red-400 hover:text-red-500 px-1">×</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Status + Assigned */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Status</label>
            <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
          {user.role === 'manager' && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Assign to</label>
              <select className="input" value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })}>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Notes</label>
          <textarea
            className="input resize-none"
            rows={2}
            placeholder="Any additional notes..."
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
          />
        </div>

        {error && <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-3 py-2 rounded-xl">{error}</div>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
