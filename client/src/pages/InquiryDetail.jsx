import { useState, useEffect } from 'react'
import { ChevronLeft } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../App'
import { useNav } from '../App'
import { DispositionBadge, TypeBadge, DISPOSITIONS, PPC_OPTIONS, ORDER_SOURCES, VERIFICATION_OPTIONS, timeAgo, formatDate } from '../components/Badges'
import ClosedWonModal from '../components/ClosedWonModal'

export default function InquiryDetail({ id }) {
  const { user } = useAuth()
  const { navigate } = useNav()
  const [inquiry, setInquiry] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const [newFollowup, setNewFollowup] = useState({ note: '', follow_up_date: '' })
  const [showFollowupForm, setShowFollowupForm] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [requirements, setRequirements] = useState([])
  const [activeTab, setActiveTab] = useState('activity')
  const [closedWonOpen, setClosedWonOpen] = useState(false)
  const [cwPrevDisp, setCwPrevDisp] = useState('')
  const [cwCreated, setCwCreated] = useState(false)

  const load = () => {
    Promise.all([api.getInquiry(id), api.getUsers()]).then(([inq, us]) => {
      setInquiry(inq); setUsers(us)
      setEditForm({ disposition: inq.disposition || 'Initial Contact', assigned_to: inq.assigned_to, notes: inq.notes || '', ppc_or_outbound: inq.ppc_or_outbound || '', order_amount: inq.order_amount || '', order_ref: inq.order_ref || '' })
      setRequirements(inq.requirements || [])
      setLoading(false)
    })
  }
  useEffect(() => { load() }, [id])

  const setEF = (k, v) => setEditForm(f => ({ ...f, [k]: v }))
  const handleSave = async () => { setSaving(true); await api.updateInquiry(id, { ...editForm, requirements }); setEditMode(false); setSaving(false); load() }
  const handleComment = async () => {
    if (!comment.trim()) return
    setSending(true); await api.addComment(id, comment); setComment(''); setSending(false); load()
  }
  const handleFollowup = async () => {
    if (!newFollowup.note.trim()) return
    await api.addFollowup(id, newFollowup); setNewFollowup({ note: '', follow_up_date: '' }); setShowFollowupForm(false); load()
  }
  const toggleFollowup = async (fu) => { await api.updateFollowup(fu.id, { ...fu, completed: !fu.completed }); load() }
  const handleDelete = async () => {
    if (!confirm('Delete this inquiry permanently?')) return
    setDeleting(true)
    try { await api.deleteInquiry(id); navigate(inquiry.type === 'lead' ? 'leads' : inquiry.type === 'repeat' ? 'repeat' : 'orders') }
    catch (e) { alert(e.message); setDeleting(false) }
  }
  const addReq = () => setRequirements(r => [...r, { part_number: '', quantity: '' }])
  const updateReq = (i, k, v) => setRequirements(r => r.map((x, idx) => idx === i ? { ...x, [k]: v } : x))
  const removeReq = (i) => setRequirements(r => r.filter((_, idx) => idx !== i))
  const backPage = inquiry?.type === 'lead' ? 'leads' : inquiry?.type === 'repeat' ? 'repeat' : 'orders'
  const backLabel = inquiry?.type === 'lead' ? 'Leads' : inquiry?.type === 'repeat' ? 'Repeat Inquiries' : 'Online Orders'

  const dispositionsForType = inquiry?.type === 'online_order'
    ? ['Processed', 'Cancelled']
    : DISPOSITIONS.filter(d => d !== 'Processed' && d !== 'Cancelled')

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-7 h-7 rounded-full border-2 border-brand-400 border-t-transparent spinner" /></div>
  if (!inquiry) return <div className="p-8 text-ink-400">Not found.</div>

  const pendingFu = inquiry.followups?.filter(f => !f.completed).length || 0

  return (
    <div className="page-wrap max-w-5xl">
      <button onClick={() => navigate(backPage)} className="flex items-center gap-1 text-xs text-ink-400 hover:text-ink-700 font-semibold mb-5 transition-colors">
        <ChevronLeft size={14} /> {backLabel}
      </button>

      <div className="card p-6 mb-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TypeBadge type={inquiry.type} />
              <DispositionBadge disposition={inquiry.disposition} />
              <span className="text-ink-300 text-xs font-mono">#{inquiry.id}</span>
            </div>
            <h1 className="font-display font-bold text-xl text-ink-900">
              {inquiry.customer_name}
              {inquiry.customer_company && <span className="text-ink-400 font-normal ml-2 text-base">— {inquiry.customer_company}</span>}
            </h1>
            <div className="flex flex-wrap gap-4 text-sm text-ink-500 mt-2">
              {inquiry.customer_email && <a href={`mailto:${inquiry.customer_email}`} className="hover:text-brand-600 transition-colors">📧 {inquiry.customer_email}</a>}
              {inquiry.customer_phone && <span>📞 {inquiry.customer_phone}</span>}
              {inquiry.lead_source && <span className="badge bg-teal-50 text-teal-700 border-teal-200">📌 {inquiry.lead_source}</span>}
            </div>
          </div>
          <div className="flex gap-2 ml-4 flex-shrink-0">
            {user.role === 'manager' && !editMode && (
              <button onClick={handleDelete} disabled={deleting} className="btn-danger btn-sm">{deleting ? '...' : '🗑 Delete'}</button>
            )}
            {editMode
              ? <><button onClick={() => setEditMode(false)} className="btn-secondary btn-sm">Cancel</button><button onClick={handleSave} disabled={saving} className="btn-primary btn-sm">{saving ? 'Saving...' : 'Save'}</button></>
              : <button onClick={() => setEditMode(true)} className="btn-secondary btn-sm">✏️ Edit</button>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-4">
          {/* Parts */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold text-sm text-ink-900">Part Numbers</h3>
              {editMode && <button onClick={addReq} className="btn btn-ghost btn-sm text-brand-600 font-semibold">+ Add row</button>}
            </div>
            {editMode ? (
              <div className="space-y-2">
                {requirements.map((r, i) => (
                  <div key={i} className="flex gap-2">
                    <input className="input flex-1" placeholder="Part number" value={r.part_number} onChange={e => updateReq(i,'part_number',e.target.value)} />
                    <input className="input w-28" placeholder="Qty" value={r.quantity} onChange={e => updateReq(i,'quantity',e.target.value)} />
                    <button onClick={() => removeReq(i)} className="btn-icon text-red-400 hover:text-red-600 text-lg">×</button>
                  </div>
                ))}
              </div>
            ) : requirements.length ? (
              <table className="w-full">
                <thead><tr className="text-xs text-ink-400 border-b"><th className="text-left pb-2 font-semibold">Part Number</th><th className="text-left pb-2 font-semibold">Quantity</th></tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {requirements.map((r,i) => <tr key={r.id||i}><td className="py-2 font-mono text-sm text-ink-800">{r.part_number}</td><td className="py-2 text-ink-600">{r.quantity}</td></tr>)}
                </tbody>
              </table>
            ) : <p className="text-sm text-ink-300">No parts added.</p>}
          </div>

          {/* Comments */}
          <div className="card p-5">
            <h3 className="font-display font-bold text-sm text-ink-900 mb-2">Comments</h3>
            {editMode
              ? <textarea className="input resize-none" rows={3} value={editForm.notes} onChange={e => setEF('notes',e.target.value)} placeholder="Add comments..." />
              : <p className="text-sm text-ink-600 leading-relaxed">{inquiry.notes || <span className="text-ink-300">No comments yet.</span>}</p>}
          </div>

          {/* Activity / Followups */}
          <div className="card overflow-hidden">
            <div className="flex border-b border-slate-100">
              {[['activity','💬 Activity'],['followups',`📅 Follow-ups${pendingFu > 0 ? ` (${pendingFu})` : ''}`]].map(([tab, label]) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-5 py-3.5 text-sm font-semibold transition-all border-b-2 -mb-px ${activeTab===tab ? 'text-brand-600 border-brand-500' : 'text-ink-400 border-transparent hover:text-ink-600'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="p-5">
              {activeTab === 'activity' && (
                <>
                  <div className="flex gap-2 mb-5">
                    <input className="input flex-1" placeholder="Write a comment..." value={comment} onChange={e => setComment(e.target.value)} onKeyDown={e => e.key==='Enter' && !e.shiftKey && handleComment()} />
                    <button onClick={handleComment} disabled={sending||!comment.trim()} className="btn-primary px-4">{sending ? '...' : 'Send'}</button>
                  </div>
                  <div className="space-y-4">
                    {!inquiry.activity?.length && <p className="text-sm text-ink-300 text-center py-6">No activity yet</p>}
                    {inquiry.activity?.map(a => (
                      <div key={a.id} className="flex gap-3">
                        <div className="w-8 h-8 rounded-xl bg-surface-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-ink-600 flex-shrink-0">{a.user_name?.[0]?.toUpperCase()||'?'}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-ink-800">{a.user_name}</span>
                            <span className="text-xs text-ink-300">{timeAgo(a.created_at)}</span>
                          </div>
                          {a.action==='Comment'
                            ? <div className="text-sm bg-surface-50 rounded-xl px-4 py-2.5 border text-ink-700 leading-relaxed">{a.comment}</div>
                            : <span className="text-sm text-ink-400">{a.action}{a.comment ? ` — ${a.comment}` : ''}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {activeTab === 'followups' && (
                <>
                  <button onClick={() => setShowFollowupForm(!showFollowupForm)} className={`${showFollowupForm ? 'btn-secondary' : 'btn-primary'} w-full mb-4`}>
                    {showFollowupForm ? 'Cancel' : '+ Add Follow-up'}
                  </button>
                  {showFollowupForm && (
                    <div className="bg-surface-50 rounded-xl p-4 mb-4 space-y-2 border">
                      <input className="input" placeholder="Note *" value={newFollowup.note} onChange={e => setNewFollowup(f=>({...f,note:e.target.value}))} />
                      <div className="flex gap-2">
                        <input type="date" className="input flex-1" value={newFollowup.follow_up_date} onChange={e => setNewFollowup(f=>({...f,follow_up_date:e.target.value}))} />
                        <button onClick={handleFollowup} className="btn-primary">Add</button>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    {!inquiry.followups?.length && <p className="text-sm text-ink-300 text-center py-6">No follow-ups yet</p>}
                    {inquiry.followups?.map(fu => (
                      <div key={fu.id} className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${fu.completed ? 'bg-slate-50 opacity-60' : 'bg-white hover:border-brand-200'}`}>
                        <button onClick={() => toggleFollowup(fu)} className="mt-0.5 flex-shrink-0">
                          <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${fu.completed ? 'bg-brand-500 border-brand-500' : 'border-ink-300 hover:border-brand-400'}`}>
                            {fu.completed && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                        </button>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${fu.completed ? 'line-through text-ink-300' : 'text-ink-700'}`}>{fu.note}</p>
                          <div className="flex gap-3 text-xs text-ink-300 mt-1">
                            {fu.follow_up_date && <span className="text-amber-500 font-semibold">📅 {formatDate(fu.follow_up_date)}</span>}
                            <span>by {fu.created_by_name} · {timeAgo(fu.created_at)}</span>
                          </div>
                        </div>
                        {user.role === 'manager' && (
                          <button onClick={() => api.deleteFollowup(fu.id).then(load)} className="text-red-400 hover:text-red-500 text-xs flex-shrink-0">🗑</button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar details */}
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="font-display font-bold text-sm text-ink-900 mb-4">Details</h3>
            <div className="space-y-4 text-sm">
              <Detail label={inquiry.type === 'online_order' ? 'Status' : 'Disposition'}>
                {editMode
                  ? <select className="input" value={editForm.disposition} onChange={e => {
                      const val = e.target.value
                      // Marking Closed Won opens the order form; the order is created only on Save there.
                      if (val === 'Closed Won' && editForm.disposition !== 'Closed Won') {
                        setCwPrevDisp(editForm.disposition || 'Initial Contact')
                        setCwCreated(false)
                        setEF('disposition', val)
                        setClosedWonOpen(true)
                      } else {
                        setEF('disposition', val)
                      }
                    }}>
                      {dispositionsForType.map(d=><option key={d}>{d}</option>)}
                    </select>
                  : <DispositionBadge disposition={inquiry.disposition} />}
              </Detail>
              <Detail label="Assigned to">
                {editMode && user.role==='manager'
                  ? <select className="input" value={editForm.assigned_to} onChange={e => setEF('assigned_to',e.target.value)}>{users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select>
                  : <span className="font-semibold text-ink-700">{inquiry.assigned_name||'—'}</span>}
              </Detail>
              {inquiry.type==='repeat' && (
                <Detail label="PPC / Outbound">
                  {editMode
                    ? <select className="input" value={editForm.ppc_or_outbound} onChange={e => setEF('ppc_or_outbound',e.target.value)}><option value="">—</option>{PPC_OPTIONS.map(o=><option key={o}>{o}</option>)}</select>
                    : <span className="text-ink-700">{inquiry.ppc_or_outbound||'—'}</span>}
                </Detail>
              )}
              {inquiry.type==='online_order' && <>
                <Detail label="Verification">
                  {editMode
                    ? <select className="input" value={editForm.order_ref} onChange={e => setEF('order_ref',e.target.value)}>
                        <option value="">—</option>
                        {VERIFICATION_OPTIONS.map(v=><option key={v}>{v}</option>)}
                      </select>
                    : <span className={`badge ${inquiry.order_ref === 'Verified' ? 'bg-green-50 text-green-700 border-green-200' : inquiry.order_ref === 'Not Verified' ? 'bg-red-50 text-red-500 border-red-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                        {inquiry.order_ref || '—'}
                      </span>}
                </Detail>
                <Detail label="Order Amount">
                  {editMode
                    ? <input className="input" value={editForm.order_amount} onChange={e=>setEF('order_amount',e.target.value)} />
                    : <span className="font-bold text-green-700">{inquiry.order_amount ? `$${inquiry.order_amount}` : '—'}</span>}
                </Detail>
              </>}
              {inquiry.lead_source && <Detail label="Source"><span className="badge bg-teal-50 text-teal-700 border-teal-200">{inquiry.lead_source}</span></Detail>}
              <Detail label="Created"><span className="text-ink-500">{formatDate(inquiry.created_at)}</span></Detail>
              <Detail label="Updated"><span className="text-ink-500">{timeAgo(inquiry.updated_at)}</span></Detail>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="font-display font-bold text-sm text-ink-900 mb-2">Customer</h3>
            <button onClick={() => navigate('customer-detail',{id:inquiry.customer_id})} className="text-sm text-brand-600 hover:text-brand-700 font-semibold transition-colors">{inquiry.customer_name} →</button>
            {inquiry.customer_company && <div className="text-xs text-ink-400 mt-0.5">{inquiry.customer_company}</div>}
          </div>
        </div>
      </div>

      {closedWonOpen && (
        <ClosedWonModal
          inquiry={inquiry}
          requirements={requirements}
          onCreated={() => setCwCreated(true)}
          onClose={() => {
            setClosedWonOpen(false)
            if (!cwCreated) setEF('disposition', cwPrevDisp || 'Initial Contact')
          }}
        />
      )}
    </div>
  )
}

function Detail({ label, children }) {
  return (
    <div>
      <div className="text-xs font-bold text-ink-400 uppercase tracking-widest mb-1.5">{label}</div>
      {children}
    </div>
  )
}
