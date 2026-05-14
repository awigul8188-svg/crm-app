import { useState, useEffect } from 'react'
import { api } from '../api'
import { useAuth } from '../App'
import { useNav } from '../App'
import { LEAD_SOURCES } from '../components/Badges'
import Modal from '../components/Modal'

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

  const load = (s = '') => { setLoading(true); api.getCustomers(s).then(c => { setCustomers(c); setLoading(false) }) }
  useEffect(() => { load(); api.getUsers().then(setUsers) }, [])

  const handleSearch = (val) => { setSearch(val); clearTimeout(window._st); window._st = setTimeout(() => load(val), 300) }
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleCreate = async () => {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true); setError('')
    try { await api.createCustomer(form); setShowNew(false); setForm({ name: '', email: '', phone: '', company: '', lead_source: '', assigned_to: user.id }); load() }
    catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="p-8 fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-ink-900">◉ Customers</h1>
          <p className="text-ink-400 text-sm mt-0.5">{customers.length} total</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary">+ New Customer</button>
      </div>

      <div className="relative mb-5 max-w-sm">
        <input className="input pl-8" placeholder="Search name, email, company..." value={search} onChange={e => handleSearch(e.target.value)} />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300">⌕</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24"><div className="w-7 h-7 rounded-full border-2 border-brand-400 border-t-transparent spinner" /></div>
      ) : customers.length === 0 ? (
        <div className="card p-16 text-center"><div className="text-5xl mb-3 opacity-30">◉</div><div className="font-display font-bold text-ink-400">No customers yet</div></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-left px-4 py-3">Lead Source</th>
                <th className="text-left px-4 py-3">Assigned To</th>
                <th className="text-left px-4 py-3">Inquiries</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id} className="table-row" onClick={() => navigate('customer-detail', { id: c.id })}>
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 font-bold text-sm flex-shrink-0">{c.name[0].toUpperCase()}</div>
                      <div>
                        <div className="font-semibold text-ink-900 text-sm">{c.name}</div>
                        {c.company && <div className="text-xs text-ink-400">{c.company}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="table-cell text-ink-500 text-xs">{c.email || '—'}</td>
                  <td className="table-cell text-ink-500 text-xs">{c.phone || '—'}</td>
                  <td className="table-cell">{c.lead_source ? <span className="badge bg-blue-50 text-blue-600 border-blue-100">{c.lead_source}</span> : <span className="text-ink-300 text-sm">—</span>}</td>
                  <td className="table-cell font-medium text-ink-700 text-sm">{c.assigned_name || '—'}</td>
                  <td className="table-cell"><span className="badge bg-surface-100 text-ink-600 border-ink-200">{c.inquiry_count}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNew && (
        <Modal title="New Customer" onClose={() => setShowNew(false)}>
          <div className="space-y-3">
            <input className="input" placeholder="Full name *" value={form.name} onChange={e => setF('name', e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder="Email" value={form.email} onChange={e => setF('email', e.target.value)} />
              <input className="input" placeholder="Phone" value={form.phone} onChange={e => setF('phone', e.target.value)} />
            </div>
            <input className="input" placeholder="Company" value={form.company} onChange={e => setF('company', e.target.value)} />
            <select className="input" value={form.lead_source} onChange={e => setF('lead_source', e.target.value)}>
              <option value="">Select lead source</option>
              {LEAD_SOURCES.map(s => <option key={s}>{s}</option>)}
            </select>
            {user.role === 'manager' && (
              <select className="input" value={form.assigned_to} onChange={e => setF('assigned_to', e.target.value)}>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
            {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2.5 rounded-xl">{error}</div>}
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
