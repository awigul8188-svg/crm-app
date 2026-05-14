import { useState, useEffect } from 'react'
import { api } from '../api'
import { useAuth } from '../App'
import { useNav } from '../App'
import { StatusBadge, TypeBadge, timeAgo, formatDate } from '../components/Badges'

const STATUSES = ['open', 'in_progress', 'closed', 'won', 'lost']

export default function InquiryDetail({ id }) {
  const { user } = useAuth()
  const { navigate } = useNav()
  const [inquiry, setInquiry] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [comment, setComment] = useState('')
  const [newFollowup, setNewFollowup] = useState({ note: '', follow_up_date: '' })
  const [showFollowupForm, setShowFollowupForm] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [requirements, setRequirements] = useState([])
  const [activeTab, setActiveTab] = useState('activity')

  const load = () => {
    Promise.all([api.getInquiry(id), api.getUsers()]).then(([inq, us]) => {
      setInquiry(inq)
      setUsers(us)
      setEditForm({ status: inq.status, assigned_to: inq.assigned_to, notes: inq.notes || '' })
      setRequirements(inq.requirements || [])
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [id])

  const handleSave = async () => {
    setSaving(true)
    await api.updateInquiry(id, { ...editForm, requirements })
    setEditMode(false)
    setSaving(false)
    load()
  }

  const handleComment = async () => {
    if (!comment.trim()) return
    await api.addComment(id, comment)
    setComment('')
    load()
  }

  const handleFollowup = async () => {
    if (!newFollowup.note.trim()) return
    await api.addFollowup(id, newFollowup)
    setNewFollowup({ note: '', follow_up_date: '' })
    setShowFollowupForm(false)
    load()
  }

  const toggleFollowup = async (fu) => {
    await api.updateFollowup(fu.id, { ...fu, completed: !fu.completed })
    load()
  }

  const addReq = () => setRequirements([...requirements, { part_number: '', quantity: '' }])
  const updateReq = (i, field, val) => {
    const r = [...requirements]; r[i][field] = val; setRequirements(r)
  }
  const removeReq = (i) => setRequirements(requirements.filter((_, idx) => idx !== i))

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!inquiry) return <div className="p-8 text-gray-400">Inquiry not found.</div>

  return (
    <div className="p-8 max-w-5xl">
      {/* Back */}
      <button onClick={() => navigate(inquiry.type === 'lead' ? 'leads' : inquiry.type === 'repeat' ? 'repeat' : 'orders')}
        className="text-sm text-gray-500 hover:text-gray-700 mb-5 flex items-center gap-1">
        ← Back
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <TypeBadge type={inquiry.type} />
            <StatusBadge status={inquiry.status} />
            <span className="text-gray-400 text-xs">#{inquiry.id}</span>
          </div>
          <h1 className="font-display font-bold text-xl text-gray-900">
            {inquiry.customer_name}
            {inquiry.customer_company && <span className="text-gray-400 font-normal ml-2 text-base">— {inquiry.customer_company}</span>}
          </h1>
          <div className="flex gap-4 text-sm text-gray-500 mt-1">
            {inquiry.customer_email && <span>📧 {inquiry.customer_email}</span>}
            {inquiry.customer_phone && <span>📞 {inquiry.customer_phone}</span>}
            {inquiry.lead_source && <span>📌 {inquiry.lead_source}</span>}
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

      <div className="grid grid-cols-3 gap-6">
        {/* Main column */}
        <div className="col-span-2 space-y-5">
          {/* Requirements */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold text-sm text-gray-900">Requirements</h3>
              {editMode && <button type="button" onClick={addReq} className="text-xs text-brand-500 font-medium">+ Add row</button>}
            </div>
            {editMode ? (
              <div className="space-y-2">
                {requirements.map((r, i) => (
                  <div key={i} className="flex gap-2">
                    <input className="input flex-1" placeholder="Part number" value={r.part_number} onChange={e => updateReq(i, 'part_number', e.target.value)} />
                    <input className="input w-28" placeholder="Qty" value={r.quantity} onChange={e => updateReq(i, 'quantity', e.target.value)} />
                    <button onClick={() => removeReq(i)} className="text-red-400 hover:text-red-500">×</button>
                  </div>
                ))}
              </div>
            ) : requirements.length ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs">
                    <th className="text-left pb-2 font-medium">Part Number</th>
                    <th className="text-left pb-2 font-medium">Quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {requirements.map(r => (
                    <tr key={r.id}>
                      <td className="py-1.5 font-mono text-gray-800 text-sm">{r.part_number}</td>
                      <td className="py-1.5 text-gray-600">{r.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="text-sm text-gray-400">No requirements added.</p>}
          </div>

          {/* Notes */}
          <div className="card p-5">
            <h3 className="font-display font-bold text-sm text-gray-900 mb-2">Notes</h3>
            {editMode ? (
              <textarea className="input resize-none" rows={3} value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
            ) : (
              <p className="text-sm text-gray-600">{inquiry.notes || <span className="text-gray-400">No notes.</span>}</p>
            )}
          </div>

          {/* Tabs: Activity + Followups */}
          <div className="card overflow-hidden">
            <div className="flex border-b">
              {[['activity', '💬 Activity'], ['followups', '📅 Follow-ups']].map(([tab, label]) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-5 py-3 text-sm font-medium transition-colors ${
                    activeTab === tab ? 'text-brand-600 border-b-2 border-brand-500 -mb-px' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="p-5">
              {activeTab === 'activity' && (
                <div>
                  {/* Comment input */}
                  <div className="flex gap-2 mb-5">
                    <input
                      className="input flex-1"
                      placeholder="Add a comment..."
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleComment()}
                    />
                    <button onClick={handleComment} className="btn-primary px-3">Send</button>
                  </div>

                  {/* Activity log */}
                  <div className="space-y-3">
                    {inquiry.activity?.length === 0 && <p className="text-sm text-gray-400">No activity yet.</p>}
                    {inquiry.activity?.map(a => (
                      <div key={a.id} className="flex gap-3">
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                          {a.user_name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-800">{a.user_name}</span>
                            <span className="text-xs text-gray-400">{timeAgo(a.created_at)}</span>
                          </div>
                          <div className="text-sm text-gray-600 mt-0.5">
                            {a.action === 'Comment' ? (
                              <span className="bg-gray-50 rounded-lg px-3 py-1.5 block mt-1 border">{a.comment}</span>
                            ) : (
                              <span className="text-gray-500">{a.action}{a.comment ? `: ${a.comment}` : ''}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'followups' && (
                <div>
                  <button onClick={() => setShowFollowupForm(!showFollowupForm)} className="btn-secondary mb-4 w-full">
                    {showFollowupForm ? 'Cancel' : '+ Add Follow-up'}
                  </button>

                  {showFollowupForm && (
                    <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2">
                      <input className="input" placeholder="Follow-up note" value={newFollowup.note} onChange={e => setNewFollowup({ ...newFollowup, note: e.target.value })} />
                      <div className="flex gap-2">
                        <input type="date" className="input flex-1" value={newFollowup.follow_up_date} onChange={e => setNewFollowup({ ...newFollowup, follow_up_date: e.target.value })} />
                        <button onClick={handleFollowup} className="btn-primary">Add</button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {inquiry.followups?.length === 0 && <p className="text-sm text-gray-400">No follow-ups yet.</p>}
                    {inquiry.followups?.map(fu => (
                      <div key={fu.id} className={`flex items-start gap-3 p-3 rounded-xl border ${fu.completed ? 'bg-gray-50 opacity-60' : 'bg-white'}`}>
                        <button onClick={() => toggleFollowup(fu)} className="mt-0.5 flex-shrink-0">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${fu.completed ? 'bg-brand-500 border-brand-500' : 'border-gray-300'}`}>
                            {fu.completed && <span className="text-white text-xs">✓</span>}
                          </div>
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${fu.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>{fu.note}</p>
                          <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                            {fu.follow_up_date && <span>📅 {formatDate(fu.follow_up_date)}</span>}
                            <span>by {fu.created_by_name}</span>
                            <span>{timeAgo(fu.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="font-display font-bold text-sm text-gray-900 mb-3">Details</h3>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-400 mb-1">Status</div>
                {editMode ? (
                  <select className="input" value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                    {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                ) : <StatusBadge status={inquiry.status} />}
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Assigned to</div>
                {editMode && user.role === 'manager' ? (
                  <select className="input" value={editForm.assigned_to} onChange={e => setEditForm({ ...editForm, assigned_to: e.target.value })}>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                ) : <span className="text-sm font-medium text-gray-700">{inquiry.assigned_name || '—'}</span>}
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Created</div>
                <span className="text-sm text-gray-600">{formatDate(inquiry.created_at)}</span>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Last updated</div>
                <span className="text-sm text-gray-600">{timeAgo(inquiry.updated_at)}</span>
              </div>
            </div>
          </div>

          {/* Customer quick link */}
          <div className="card p-4">
            <h3 className="font-display font-bold text-sm text-gray-900 mb-2">Customer</h3>
            <button
              onClick={() => navigate('customer-detail', { id: inquiry.customer_id })}
              className="text-sm text-brand-500 hover:text-brand-600 font-medium"
            >
              {inquiry.customer_name} →
            </button>
            {inquiry.customer_company && <div className="text-xs text-gray-400 mt-0.5">{inquiry.customer_company}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
