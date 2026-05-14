import { useState, useEffect } from 'react'
import { api } from '../api'
import { useAuth } from '../App'
import { useNav } from '../App'
import { StatusBadge, TypeBadge, timeAgo } from '../components/Badges'
import NewInquiryModal from '../components/NewInquiryModal'

const LEAD_SOURCES = ['Email Lead', 'Chat Lead', 'Call Lead', 'Website RFQ']

export default function CustomerDetail({ id }) {
  const { user } = useAuth()
  const { navigate } = useNav()
  const [customer, setCustomer] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [showNewInquiry, setShowNewInquiry] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = () => {
    Promise.all([api.getCustomer(id), api.getUsers()]).then(([c, us]) => {
      setCustomer(c)
      setUsers(us)
      setEditForm({ name: c.name, email: c.email || '', phone: c.phone || '', company: c.company || '', lead_source: c.lead_source || '', assigned_to: c.assigned_to })
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [id])

  const handleSave = async () => {
    setSaving(true)
    await api.updateCustomer(id, editForm)
    setEditMode(false)
    setSaving(false)
    load()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!customer) return <div className="p-8 text-gray-400">Customer not found.</div>

  return (
    <div className="p-8 max-w-5xl">
      <button onClick={() => navigate('customers')} className="text-sm text-gray-500 hover:text-gray-700 mb-5 flex items-center gap-1">
        ← Customers
      </button>

      {/* Customer header */}
      <div className="card p-6 mb-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 font-bold text-xl">
              {customer.name[0].toUpperCase()}
            </div>
            <div>
              {editMode ? (
                <input className="input text-xl font-bold mb-1" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
              ) : (
                <h1 className="font-display font-bold text-xl text-gray-900">{customer.name}</h1>
              )}
              <div className="text-sm text-gray-500">{customer.company || 'No company'}</div>
            </div>
          </div>
          <div className="flex gap-2">
            {editMode ? (
              <>
                <button onClick={() => setEditMode(false)} className="btn-secondary">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button>
              </>
            ) : (
              <button onClick={() => setEditMode(true)} className="btn-secondary">✏️ Edit</button>
            )}
          </div>
        </div>

        {editMode ? (
          <div className="grid grid-cols-2 gap-3 mt-4">
            <input className="input" placeholder="Email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
            <input className="input" placeholder="Phone" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
            <input className="input" placeholder="Company" value={editForm.company} onChange={e => setEditForm({ ...editForm, company: e.target.value })} />
            <select className="input" value={editForm.lead_source} onChange={e => setEditForm({ ...editForm, lead_source: e.target.value })}>
              <option value="">Lead source</option>
              {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {user.role === 'manager' && (
              <select className="input" value={editForm.assigned_to} onChange={e => setEditForm({ ...editForm, assigned_to: e.target.value })}>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
          </div>
        ) : (
          <div className="flex gap-5 mt-4 text-sm text-gray-600">
            {customer.email && <span>📧 {customer.email}</span>}
            {customer.phone && <span>📞 {customer.phone}</span>}
            {customer.lead_source && <span>📌 {customer.lead_source}</span>}
            {customer.assigned_name && <span>👤 {customer.assigned_name}</span>}
            <span className="text-gray-400">Joined {timeAgo(customer.created_at)}</span>
          </div>
        )}
      </div>

      {/* Inquiries */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-base text-gray-900">
          Inquiries <span className="text-gray-400 font-normal">({customer.inquiries?.length || 0})</span>
        </h2>
        <button onClick={() => setShowNewInquiry(true)} className="btn-primary text-sm">
          + Add Repeat Inquiry
        </button>
      </div>

      {customer.inquiries?.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          <div className="text-3xl mb-2">📋</div>
          <div className="text-sm">No inquiries yet. Add one!</div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {customer.inquiries?.map(inq => (
            <div
              key={inq.id}
              onClick={() => navigate('inquiry-detail', { id: inq.id })}
              className="card p-4 cursor-pointer hover:shadow-md transition-all hover:border-brand-200"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <TypeBadge type={inq.type} />
                    <StatusBadge status={inq.status} />
                  </div>
                  {inq.requirements?.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {inq.requirements.map(r => (
                        <span key={r.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg font-mono">
                          {r.part_number} × {r.quantity}
                        </span>
                      ))}
                    </div>
                  ) : <span className="text-xs text-gray-400">No requirements</span>}
                </div>
                <div className="text-right text-xs text-gray-400">
                  <div className="text-gray-500 font-medium">{inq.assigned_name}</div>
                  <div>{timeAgo(inq.created_at)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNewInquiry && (
        <NewInquiryModal
          defaultType="repeat"
          customerId={id}
          onClose={() => setShowNewInquiry(false)}
          onCreated={() => { setShowNewInquiry(false); load() }}
        />
      )}
    </div>
  )
}
