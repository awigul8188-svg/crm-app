import { useState, useEffect } from 'react'
import { api } from '../api'
import { useAuth } from '../App'
import { useNav } from '../App'
import { DispositionBadge, TypeBadge, LEAD_SOURCES, timeAgo, formatDate } from '../components/Badges'
import NewInquiryModal from '../components/NewInquiryModal'

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
      setCustomer(c); setUsers(us)
      setEditForm({ name: c.name, email: c.email || '', phone: c.phone || '', company: c.company || '', lead_source: c.lead_source || '', assigned_to: c.assigned_to })
      setLoading(false)
    })
  }
  useEffect(() => { load() }, [id])

  const setEF = (k, v) => setEditForm(f => ({ ...f, [k]: v }))
  const handleSave = async () => { setSaving(true); await api.updateCustomer(id, editForm); setEditMode(false); setSaving(false); load() }

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-7 h-7 rounded-full border-2 border-brand-400 border-t-transparent spinner" /></div>
  if (!customer) return <div className="p-8 text-ink-400">Customer not found.</div>

  return (
    <div className="p-8 max-w-5xl fade-in">
      <button onClick={() => navigate('customers')} className="flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink-600 font-medium mb-5 transition-colors">← Customers</button>

      {/* Customer header */}
      <div className="card p-6 mb-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 font-bold text-2xl">{customer.name[0].toUpperCase()}</div>
            <div>
              {editMode ? <input className="input text-xl font-bold mb-1" value={editForm.name} onChange={e => setEF('name', e.target.value)} />
              : <h1 className="font-display font-bold text-xl text-ink-900">{customer.name}</h1>}
              <div className="text-sm text-ink-400">{customer.company || 'No company'}</div>
            </div>
          </div>
          <div className="flex gap-2">
            {editMode
              ? <><button onClick={() => setEditMode(false)} className="btn-secondary btn-sm">Cancel</button><button onClick={handleSave} disabled={saving} className="btn-primary btn-sm">{saving ? '...' : 'Save'}</button></>
              : <button onClick={() => setEditMode(true)} className="btn-secondary btn-sm">✏️ Edit</button>}
          </div>
        </div>

        {editMode ? (
          <div className="grid grid-cols-2 gap-3 mt-4">
            <input className="input" placeholder="Email" value={editForm.email} onChange={e => setEF('email', e.target.value)} />
            <input className="input" placeholder="Phone" value={editForm.phone} onChange={e => setEF('phone', e.target.value)} />
            <input className="input" placeholder="Company" value={editForm.company} onChange={e => setEF('company', e.target.value)} />
            <select className="input" value={editForm.lead_source} onChange={e => setEF('lead_source', e.target.value)}>
              <option value="">Lead source</option>
              {LEAD_SOURCES.map(s => <option key={s}>{s}</option>)}
            </select>
            {user.role === 'manager' && <select className="input" value={editForm.assigned_to} onChange={e => setEF('assigned_to', e.target.value)}>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>}
          </div>
        ) : (
          <div className="flex flex-wrap gap-5 mt-4 text-sm text-ink-500">
            {customer.email && <span>📧 {customer.email}</span>}
            {customer.phone && <span>📞 {customer.phone}</span>}
            {customer.lead_source && <span className="badge bg-blue-50 text-blue-600 border-blue-100">📌 {customer.lead_source}</span>}
            {customer.assigned_name && <span>👤 {customer.assigned_name}</span>}
            <span className="text-ink-300">Joined {timeAgo(customer.created_at)}</span>
          </div>
        )}
      </div>

      {/* Inquiries */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-base text-ink-900">Inquiries <span className="text-ink-300 font-normal">({customer.inquiries?.length || 0})</span></h2>
        <button onClick={() => setShowNewInquiry(true)} className="btn-primary btn-sm">+ Add Inquiry</button>
      </div>

      {!customer.inquiries?.length ? (
        <div className="card p-12 text-center"><div className="text-4xl mb-2 opacity-30">📋</div><div className="text-sm text-ink-400">No inquiries yet.</div></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Disposition</th>
                <th className="text-left px-4 py-3">Parts</th>
                <th className="text-left px-4 py-3">Assigned To</th>
              </tr>
            </thead>
            <tbody>
              {customer.inquiries?.map(inq => (
                <tr key={inq.id} className="table-row" onClick={() => navigate('inquiry-detail', { id: inq.id })}>
                  <td className="table-cell text-ink-400 font-mono text-xs">{formatDate(inq.created_at)}</td>
                  <td className="table-cell"><TypeBadge type={inq.type} /></td>
                  <td className="table-cell"><DispositionBadge disposition={inq.disposition} /></td>
                  <td className="table-cell">
                    <div className="flex flex-wrap gap-1">
                      {inq.requirements?.slice(0, 2).map((r, i) => <span key={i} className="badge bg-slate-50 text-ink-600 border-slate-200 font-mono">{r.part_number} ×{r.quantity}</span>)}
                      {inq.requirements?.length > 2 && <span className="badge bg-slate-50 text-ink-400 border-slate-200">+{inq.requirements.length - 2}</span>}
                      {!inq.requirements?.length && <span className="text-ink-300 text-sm">—</span>}
                    </div>
                  </td>
                  <td className="table-cell font-medium text-ink-700">{inq.assigned_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNewInquiry && <NewInquiryModal defaultType="repeat" customerId={id} onClose={() => setShowNewInquiry(false)} onCreated={() => { setShowNewInquiry(false); load() }} />}
    </div>
  )
}
