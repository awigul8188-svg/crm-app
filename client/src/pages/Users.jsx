import { useState, useEffect } from 'react'
import { UserCog, KeyRound, Copy, Check, UserPlus } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../App'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'

const BRAND = '#00D4C8'
const inp = { width:'100%', boxSizing:'border-box', background:'#fff', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'10px 14px', fontSize:'13px', color:'#0f172a', fontFamily:'"Plus Jakarta Sans", sans-serif', outline:'none' }

const ROLE_INFO = {
  manager:            { label:'Manager',              color:'#7c3aed', bg:'#f5f3ff', border:'#ddd6fe' },
  ae:                 { label:'Account Executive',    color:'#16a34a', bg:'#f0fdf4', border:'#bbf7d0' },
  purchasing_manager: { label:'Purchasing Manager',   color:'#d97706', bg:'#fff7ed', border:'#fed7aa' },
  purchaser:          { label:'Purchaser',            color:'#0891b2', bg:'#ecfeff', border:'#a5f3fc' },
}

const SECTIONS = [
  { role: 'manager',            title: 'Managers',              icon: '◆' },
  { role: 'ae',                 title: 'Account Executives',    icon: '◈' },
  { role: 'purchasing_manager', title: 'Purchasing Managers',   icon: '◉' },
  { role: 'purchaser',          title: 'Purchasers',            icon: '◎' },
]

function RoleBadge({ role }) {
  const r = ROLE_INFO[role] || { label: role, color:'#64748b', bg:'#f8fafc', border:'#e2e8f0' }
  return (
    <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:r.bg, color:r.color, border:`1px solid ${r.border}`, whiteSpace:'nowrap' }}>
      {r.label}
    </span>
  )
}

// In-app confirmation dialog (replaces window.confirm). Runs an async action with busy + error state.
function ConfirmModal({ state, onClose }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  if (!state) return null
  const go = async () => {
    setBusy(true); setErr('')
    try { await state.action(); onClose() }
    catch (e) { setErr(e.message || 'Something went wrong') }
    finally { setBusy(false) }
  }
  return (
    <Modal title={state.title} onClose={() => { if (!busy) onClose() }}>
      <div style={{ fontSize:14, color:'#475569', lineHeight:1.6, marginBottom:16 }}>{state.message}</div>
      {err && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#dc2626', marginBottom:12 }}>⚠ {err}</div>}
      <div style={{ display:'flex', gap:10 }}>
        <button onClick={onClose} disabled={busy} className="btn-secondary" style={{ flex:1 }}>Cancel</button>
        <button onClick={go} disabled={busy} className={state.danger ? 'btn-danger' : 'btn-primary'} style={{ flex:1 }}>
          {busy ? 'Working…' : (state.confirmLabel || 'Confirm')}
        </button>
      </div>
    </Modal>
  )
}

export default function Users() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [form, setForm] = useState({ username:'', password:'', name:'', role:'ae' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetResults, setResetResults] = useState(null)
  const [resetType, setResetType] = useState('ae')
  const [copiedAll, setCopiedAll] = useState(false)
  const [confirmState, setConfirmState] = useState(null)
  const [showBuyers, setShowBuyers] = useState(false)
  const [buyerCandidates, setBuyerCandidates] = useState([])
  const [buyerLoading, setBuyerLoading] = useState(false)
  const [selectedBuyers, setSelectedBuyers] = useState(new Set())
  const [creatingBuyers, setCreatingBuyers] = useState(false)

  const load = () => api.getUsers().then(u => { setUsers(u); setLoading(false) }).catch(e => { setError(e.message || 'Could not load users'); setLoading(false) })
  useEffect(() => { load() }, [])

  const reset = () => { setForm({ username:'', password:'', name:'', role:'ae' }); setError('') }
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleCreate = async () => {
    setSaving(true); setError('')
    try { await api.createUser(form); setShowNew(false); reset(); load() }
    catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const handleUpdate = async () => {
    setSaving(true); setError('')
    try {
      await api.updateUser(editUser.id, {
        name: form.name,
        role: form.role,
        username: form.username !== editUser.username ? form.username : undefined,
        password: form.password || undefined,
      })
      setEditUser(null); reset(); load()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const askDelete = (u) => setConfirmState({
    title: 'Delete user?',
    message: `Remove "${u.name}"? This permanently deletes their account. Customers and inquiries assigned to them are unassigned (not deleted), and their purchasing records are removed. This cannot be undone.`,
    confirmLabel: 'Delete user',
    danger: true,
    action: async () => { await api.deleteUser(u.id); load() },
  })

  const openBuyers = async () => {
    setShowBuyers(true); setBuyerLoading(true); setError('')
    try {
      const list = await api.getBuyerCandidates()
      setBuyerCandidates(list)
      setSelectedBuyers(new Set(list.filter(b => !b.exists).map(b => b.buyer)))
    } catch (e) { setError(e.message || 'Could not load buyers') }
    finally { setBuyerLoading(false) }
  }
  const toggleBuyer = (name) => setSelectedBuyers(s => { const n = new Set(s); n.has(name) ? n.delete(name) : n.add(name); return n })
  const handleCreateBuyers = async () => {
    const list = [...selectedBuyers]
    if (!list.length) return
    setCreatingBuyers(true); setError('')
    try {
      const data = await api.createPurchasersFromBuyers(list)
      setShowBuyers(false); setSelectedBuyers(new Set())
      setResetType('buyer'); setResetResults(data.results || [])
      load()
    } catch (e) { setError(e.message || 'Could not create purchasers') }
    finally { setCreatingBuyers(false) }
  }

  const doReset = async (type) => {
    setResetting(true); setResetType(type)
    try {
      const data = type === 'ae' ? await api.resetAePasswords() : await api.resetPurchaserPasswords()
      setResetResults(data.results || [])
    } finally { setResetting(false) }
  }
  const askReset = (type) => setConfirmState({
    title: type === 'ae' ? 'Reset AE passwords?' : 'Reset Purchaser passwords?',
    message: `Generate new random passwords for ${type === 'ae' ? 'all Account Executives' : 'all Purchasers'}? You'll get a copyable list to hand out, and their old passwords stop working.`,
    confirmLabel: 'Reset passwords',
    danger: false,
    action: async () => { await doReset(type) },
  })

  // Determine what roles this user can manage
  const canManageRole = (targetRole) => {
    if (user.role === 'manager') return true
    if (user.role === 'purchasing_manager') return targetRole === 'purchaser'
    return false
  }

  const canCreateRole = (role) => {
    if (user.role === 'manager') return true
    if (user.role === 'purchasing_manager') return role === 'purchaser'
    return false
  }

  const availableRoles = user.role === 'manager'
    ? ['ae','manager','purchasing_manager','purchaser']
    : ['purchaser']

  const visibleSections = SECTIONS.filter(s =>
    users.some(u => u.role === s.role) || (s.role === 'ae' || canManageRole(s.role))
  )

  const headerActions = (
    <div className="flex items-center gap-2 flex-wrap">
      {user.role === 'manager' && (
        <>
          <button onClick={() => askReset('ae')} disabled={resetting}
            className="btn btn-sm text-red-600 bg-red-50 border border-red-100 hover:bg-red-100">
            <KeyRound size={13} /> Reset AE Passwords
          </button>
          <button onClick={() => askReset('purchaser')} disabled={resetting}
            className="btn btn-sm text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100">
            <KeyRound size={13} /> Reset Purchaser Passwords
          </button>
          <button onClick={openBuyers}
            className="btn btn-sm text-cyan-700 bg-cyan-50 border border-cyan-100 hover:bg-cyan-100">
            <UserPlus size={13} /> Import Buyers
          </button>
        </>
      )}
      {user.role === 'purchasing_manager' && (
        <button onClick={() => askReset('purchaser')} disabled={resetting}
          className="btn btn-sm text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100">
          <KeyRound size={13} /> Reset Purchaser Passwords
        </button>
      )}
      <button onClick={() => { reset(); setShowNew(true) }} className="btn-primary">+ New User</button>
    </div>
  )

  return (
    <div className="page-wrap">
      <PageHeader
        icon={<UserCog size={18} />}
        title="Users"
        subtitle={user.role === 'manager' ? 'Manage all team members' : 'Manage your purchasers'}
        action={headerActions}
      />

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-7 h-7 rounded-full border-2 border-t-transparent spinner" style={{ borderColor:`${BRAND} transparent transparent` }} />
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
          {visibleSections.map(section => {
            const sectionUsers = users.filter(u => u.role === section.role)
            if (sectionUsers.length === 0 && !canManageRole(section.role)) return null
            return (
              <div key={section.role}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                  <span style={{ fontSize:14 }}>{section.icon}</span>
                  <span style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.1em' }}>{section.title}</span>
                  <span style={{ fontSize:11, color:'#cbd5e1' }}>({sectionUsers.length})</span>
                </div>
                {sectionUsers.length === 0 ? (
                  <div style={{ background:'#f8fafc', borderRadius:14, border:'1px dashed #e2e8f0', padding:'20px 24px', color:'#94a3b8', fontSize:13 }}>
                    No {section.title.toLowerCase()} yet. Click "+ New User" to add one.
                  </div>
                ) : (
                  <div className="card overflow-hidden">
                    <table style={{ width:'100%', borderCollapse:'collapse' }}>
                      <thead>
                        <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                          {['Name','Username','Role','Joined','Created By','Actions'].map(h => (
                            <th key={h} style={{ textAlign:'left', padding:'10px 16px', fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sectionUsers.map(u => (
                          <tr key={u.id} style={{ borderBottom:'1px solid #f1f5f9', transition:'background 0.1s' }}
                            onMouseEnter={e => e.currentTarget.style.background='#fafbfc'}
                            onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                            <td style={{ padding:'12px 16px' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                                {u.avatar_url
                                  ? <img src={u.avatar_url} alt={u.name} style={{ width:34, height:34, borderRadius:8, objectFit:'cover', flexShrink:0 }} />
                                  : <div style={{ width:34, height:34, borderRadius:8, background:`${BRAND}20`, color:BRAND, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:13, flexShrink:0 }}>{u.name[0].toUpperCase()}</div>
                                }
                                <div>
                                  <div style={{ fontWeight:600, fontSize:14, color:'#0f172a' }}>
                                    {u.name}
                                    {u.id === user.id && <span style={{ marginLeft:6, fontSize:11, color:'#94a3b8' }}>(you)</span>}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding:'12px 16px', fontFamily:'monospace', fontSize:13, color:'#64748b' }}>{u.username}</td>
                            <td style={{ padding:'12px 16px' }}><RoleBadge role={u.role} /></td>
                            <td style={{ padding:'12px 16px', fontSize:12, color:'#94a3b8' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                            <td style={{ padding:'12px 16px', fontSize:12, color:u.created_by_name?'#64748b':'#cbd5e1' }}>{u.created_by_name || '—'}</td>
                            <td style={{ padding:'12px 16px' }}>
                              {canManageRole(u.role) ? (
                                <div style={{ display:'flex', gap:6 }}>
                                  <button
                                    onClick={() => {
                                      setEditUser(u)
                                      setForm({ name:u.name, role:u.role, username:u.username, password:'' })
                                      setError('')
                                    }}
                                    className="btn-secondary btn-sm">Edit</button>
                                  {u.id !== user.id && (
                                    <button onClick={() => askDelete(u)} className="btn-danger btn-sm">Delete</button>
                                  )}
                                </div>
                              ) : (
                                <span style={{ fontSize:12, color:'#cbd5e1' }}>—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* New User Modal */}
      {showNew && (
        <Modal title="New User" onClose={() => { setShowNew(false); reset() }}>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Full Name</div>
              <input style={inp} placeholder="e.g. John Smith" value={form.name} onChange={e => setF('name', e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Username</div>
              <input style={inp} placeholder="e.g. john" value={form.username} onChange={e => setF('username', e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Password</div>
              <input type="password" style={inp} placeholder="Set initial password" value={form.password} onChange={e => setF('password', e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Role</div>
              <select style={{ ...inp, cursor:'pointer' }} value={form.role} onChange={e => setF('role', e.target.value)}>
                {availableRoles.map(r => <option key={r} value={r}>{ROLE_INFO[r]?.label || r}</option>)}
              </select>
            </div>
            {error && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#dc2626' }}>⚠ {error}</div>}
            <div style={{ display:'flex', gap:10, paddingTop:4 }}>
              <button onClick={() => { setShowNew(false); reset() }} className="btn-secondary" style={{ flex:1 }}>Cancel</button>
              <button onClick={handleCreate} disabled={saving} className="btn-primary" style={{ flex:1 }}>{saving ? 'Creating...' : 'Create User'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <Modal title={`Edit — ${editUser.name}`} onClose={() => { setEditUser(null); reset() }}>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Full Name</div>
              <input style={inp} value={form.name} onChange={e => setF('name', e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Username</div>
              <input style={inp} value={form.username} onChange={e => setF('username', e.target.value)} />
              <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>Change this to update their login username</div>
            </div>
            {user.role === 'manager' && (
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Role</div>
                <select style={{ ...inp, cursor:'pointer' }} value={form.role} onChange={e => setF('role', e.target.value)}>
                  {availableRoles.map(r => <option key={r} value={r}>{ROLE_INFO[r]?.label || r}</option>)}
                </select>
              </div>
            )}
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>New Password</div>
              <input type="password" style={inp} placeholder="Leave blank to keep current" value={form.password} onChange={e => setF('password', e.target.value)} />
              <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>Only fill in if you want to change it</div>
            </div>
            {error && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#dc2626' }}>⚠ {error}</div>}
            <div style={{ display:'flex', gap:10, paddingTop:4 }}>
              <button onClick={() => { setEditUser(null); reset() }} className="btn-secondary" style={{ flex:1 }}>Cancel</button>
              <button onClick={handleUpdate} disabled={saving} className="btn-primary" style={{ flex:1 }}>{saving ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Import Buyers as Purchasers modal */}
      {showBuyers && (
        <Modal title="Import Buyers as Purchasers" onClose={() => setShowBuyers(false)} wide>
          {buyerLoading ? (
            <div style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>Loading buyers…</div>
          ) : buyerCandidates.length === 0 ? (
            <div style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>No buyers found in Operations orders.</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ fontSize:13, color:'#64748b' }}>
                Each selected buyer becomes a <b>purchaser</b>. Username = first name (lowercased); password = username + <code style={{ background:'#f1f5f9', padding:'1px 5px', borderRadius:5 }}>123</code>. Duplicates get a number suffix.
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:12, color:'#94a3b8' }}>{selectedBuyers.size} selected · {buyerCandidates.filter(b=>b.exists).length} already exist</span>
                <div style={{ display:'flex', gap:12 }}>
                  <button onClick={()=>setSelectedBuyers(new Set(buyerCandidates.filter(b=>!b.exists).map(b=>b.buyer)))} style={{ fontSize:12, color:BRAND, background:'none', border:'none', cursor:'pointer', fontWeight:700 }}>Select all new</button>
                  <button onClick={()=>setSelectedBuyers(new Set())} style={{ fontSize:12, color:'#64748b', background:'none', border:'none', cursor:'pointer', fontWeight:700 }}>Clear</button>
                </div>
              </div>
              <div style={{ border:'1px solid #e2e8f0', borderRadius:12, maxHeight:'46vh', overflow:'auto' }}>
                {buyerCandidates.map(b => (
                  <label key={b.buyer} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderBottom:'1px solid #f1f5f9', cursor:b.exists?'default':'pointer', opacity:b.exists?0.55:1 }}>
                    <input type="checkbox" disabled={b.exists} checked={selectedBuyers.has(b.buyer)} onChange={()=>toggleBuyer(b.buyer)} />
                    <span style={{ fontWeight:600, fontSize:13, color:'#0f172a', flex:1 }}>{b.buyer}</span>
                    <span style={{ fontFamily:'monospace', fontSize:12, color:'#94a3b8' }}>→ {b.username}</span>
                    {b.exists && <span style={{ fontSize:11, fontWeight:700, color:'#94a3b8', background:'#f1f5f9', borderRadius:20, padding:'2px 8px' }}>already a user</span>}
                  </label>
                ))}
              </div>
              {error && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#dc2626' }}>⚠ {error}</div>}
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => setShowBuyers(false)} className="btn-secondary" style={{ flex:1 }}>Cancel</button>
                <button onClick={handleCreateBuyers} disabled={creatingBuyers || selectedBuyers.size===0} className="btn-primary" style={{ flex:1 }}>{creatingBuyers ? 'Creating…' : `Create ${selectedBuyers.size} Purchaser${selectedBuyers.size===1?'':'s'}`}</button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Reset passwords results modal */}
      {resetResults && (
        <Modal title={resetType === 'buyer' ? 'New Purchasers Created' : `${resetType === 'ae' ? 'AE' : 'Purchaser'} Passwords Reset`} onClose={() => setResetResults(null)} wide>
          <div style={{ background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:12, padding:'10px 14px', marginBottom:14, fontSize:13, color:'#c2410c' }}>
            ⚠ Save these — they won't be shown again
          </div>
          <div style={{ border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden', marginBottom:14 }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                  {['Name','Username','New Password',''].map(h => (
                    <th key={h} style={{ textAlign:'left', padding:'8px 14px', fontSize:11, fontWeight:700, color:'#64748b' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resetResults.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: i < resetResults.length-1 ? '1px solid #f1f5f9' : 'none' }}>
                    <td style={{ padding:'10px 14px', fontWeight:600 }}>{r.name}</td>
                    <td style={{ padding:'10px 14px', fontFamily:'monospace', color:'#64748b' }}>{r.username}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ fontFamily:'monospace', fontWeight:700, background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:6, padding:'3px 8px' }}>{r.password}</span>
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      <button onClick={() => navigator.clipboard.writeText(r.password)} className="btn-icon btn-sm"><Copy size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={() => {
              navigator.clipboard.writeText(resetResults.map(r => `${r.name} (${r.username}): ${r.password}`).join('\n'))
              setCopiedAll(true); setTimeout(() => setCopiedAll(false), 2000)
            }} style={{ flex:1, padding:11, borderRadius:12, border:`1px solid ${BRAND}`, background:copiedAll?BRAND:`${BRAND}15`, color:copiedAll?'#0d0d0d':'#00b8ad', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'"Plus Jakarta Sans", sans-serif' }}>
              {copiedAll ? '✓ Copied!' : 'Copy All'}
            </button>
            <button onClick={() => setResetResults(null)} style={{ flex:1, padding:11, borderRadius:12, border:'1px solid #e2e8f0', background:'#fff', color:'#475569', fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:'"Plus Jakarta Sans", sans-serif' }}>Done</button>
          </div>
        </Modal>
      )}

      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
    </div>
  )
}
