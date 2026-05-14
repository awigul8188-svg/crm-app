import { useState, useEffect } from 'react'
import { api } from '../api'
import { useAuth } from '../App'
import { useNav } from '../App'
import { timeAgo } from '../components/Badges'
import Modal from '../components/Modal'

const LEAD_SOURCES = ['Email Lead', 'Chat Lead', 'Call Lead', 'Website RFQ']

export default function Customers() {
  const { user } = useAuth()
  const { navigate } = useNav()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [users, setUsers] = useState([])
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', lead_source: '', assigned_to: user.id })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = (s) => {
    setLoading(true)
    api.getCustomers(s).then(c => { setCustomers(c); setLoading(false) })
  }

  useEffect(() => { load(''); api.getUsers().then(setUsers) }, [])

  const handleSearch = (val) => {
    setSearch(val)
    const t = setTimeout(() => load(val), 300)
    return () => clearTimeout(t)
  }

  const handleCreate = async () => {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    try {
      await api.createCustomer(form)
      setShowNew(false)
      setForm({ name: '', email: '', phone: '', company: '', lead_source: '', assigned_to: user.id })
      load('')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-900">👥 Customers</h1>
          <p className="text-gray-500 text-sm mt-0.5">{customers.length} customers</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary">+ New Customer</button>
      </div>

      <input
        className="input max-w-sm mb-5"
        placeholder="Search by name, email, company..."
        value={search}
        onChange={e => handleSearch(e.target.value)}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : customers.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">👥</div>
          <div className="font-medium">No customers yet</div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {customers.map(c => (
            <div
              key={c.id}
              onClick={() => navigate('customer-detail', { id: c.id })}
              className="card p-4 cursor-pointer hover:shadow-md transition-all hover:border-brand-200"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 font-bold text-sm">
                    {c.name[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">{c.name}</div>
                    <div className="text-xs text-gray-400 flex gap-2 mt-0.5">
                      {c.company && <span>{c.company}</span>}
                      {c.email && <span>{c.email}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right">
                  {c.lead_source && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-lg">{c.lead_source}</span>
                  )}
                  <div className="text-xs text-gray-400">
                    <span className="text-gray-500 font-medium">{c.inquiry_count} inquiries</span>
                    <div>{c.assigned_name && `Assigned to ${c.assigned_name}`}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <Modal title="New Customer" onClose={() => setShowNew(false)}>
          <div className="space-y-3">
            <input className="input" placeholder="Full name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              <input className="input" placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <input className="input" placeholder="Company" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
            <select className="input" value={form.lead_source} onChange={e => setForm({ ...form, lead_source: e.target.value })}>
              <option value="">Select lead source</option>
              {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {user.role === 'manager' && (
              <select className="input" value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })}>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
            {error && <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-3 py-2 rounded-xl">{error}</div>}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowNew(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleCreate} disabled={saving} className="btn-primary flex-1">{saving ? 'Creating...' : 'Create'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
