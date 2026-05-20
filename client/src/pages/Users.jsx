import { useState, useEffect } from 'react'
import { api } from '../api'
import { useAuth } from '../App'
import Modal from '../components/Modal'

const BRAND = '#00D4C8'
const inp = { width:'100%', boxSizing:'border-box', background:'#fff', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'10px 14px', fontSize:'13px', color:'#0f172a', fontFamily:'"Plus Jakarta Sans", sans-serif', outline:'none' }

const ROLE_INFO = {
  manager:            { label:'Manager',              color:'#7c3aed', bg:'#f5f3ff', border:'#ddd6fe' },
  ae:                 { label:'Account Executive',    color:'#16a34a', bg:'#f0fdf4', border:'#bbf7d0' },
  purchasing_manager: { label:'Purchasing Manager',   color:'#d97706', bg:'#fff7ed', border:'#fed7aa' },
  purchaser:          { label:'Purchaser',            color:'#0891b2', bg:'#ecfeff', border:'#a5f3fc' },
}

const SECTIONS = [
  { role: 'manager',            title: 'Managers',              icon: '⚙' },
  { role: 'ae',                 title: 'Account Executives',    icon: '◎' },
  { role: 'purchasing_manager', title: 'Purchasing Managers',   icon: '🔧' },
  { role: 'purchaser',          title: 'Purchasers',            icon: '🔩' },
]

function RoleBadge({ role }) {
  const r = ROLE_INFO[role] || { label: role, color:'#64748b', bg:'#f8fafc', border:'#e2e8f0' }
  return (
    <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:r.bg, color:r.color, border:`1px solid ${r.border}`, whiteSpace:'nowrap' }}>
      {r.label}
    </span>
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
  const [deletingId, setDeletingId] = useState(null)

  const load = () => api.getUsers().then(u => { setUsers(u); setLoading(false) })
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

  const handleDelete = async (id, name) => {
    if (!confirm(`Remove "${name}"? This cannot be undone.`)) return
    setDeletingId(id)
    try { await api.deleteUser(id); load() }
    catch (e) { alert(e.message) }
    finally { setDeletingId(null) }
  }

  const handleResetPasswords = async (type) => {
    const label = type === 'ae' ? 'all Account Executives' : 'all Purchasers'
    if (!confirm(`Generate new random passwords for ${label}?`)) return
    setResetting(true); setResetType(type)
    try {
      let data
      if (type === 'ae') data = await api.resetAePasswords()
      else {
        const token = localStorage.getItem('crm_token')
        const res = await fetch('/api/users/reset-purchaser-passwords', { method:'POST', headers:{ Authorization:`Bearer ${token}` } })
        data = await res.json()
      }
      setResetResults(data.results)
    } catch (e) { alert(e.message) }
    finally { setResetting(false) }
  }

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

  return (
    <div className="p-8 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-ink-900">⚙ Users</h1>
          <p className="text-ink-400 text-sm mt-0.5">
            {user.role === 'manager' ? 'Manage all team members' : 'Manage your purchasers'}
          </p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {user.role === 'manager' && (
            <>
              <button onClick={() => handleResetPasswords('ae')} disabled={resetting}
                style={{ padding:'8px 14px', borderRadius:12, background:'#fff5f5', border:'1px solid #fecaca', color:'#dc2626', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans", sans-serif' }}>
                🔑 Reset AE Passwords
              </button>
              <button onClick={() => handleResetPasswords('purchaser')} disabled={resetting}
                style={{ padding:'8px 14px', borderRadius:12, background:'#fff7ed', border:'1px solid #fed7aa', color:'#d97706', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans", sans-serif' }}>
                🔑 Reset Purchaser Passwords
              </button>
            </>
          )}
          {user.role === 'purchasing_manager' && (
            <button onClick={() => handleResetPasswords('purchaser')} disabled={resetting}
              style={{ padding:'8px 14px', borderRadius:12, background:'#fff7ed', border:'1px solid #fed7aa', color:'#d97706', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans", sans-serif' }}>
              🔑 Reset Purchaser Passwords
            </button>
          )}
          <button onClick={() => { reset(); setShowNew(true) }} className="btn-primary">+ New User</button>
        </div>
      </div>

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
                          {['Name','Username','Role','Joined','Actions'].map(h => (
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
                                    <button
                                      onClick={() => handleDelete(u.id, u.name)}
                                      disabled={deletingId === u.id}
                                      className="btn-danger btn-sm">
                                      {deletingId === u.id ? '...' : 'Delete'}
                                    </button>
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

      {/* Reset passwords results modal */}
      {resetResults && (
        <Modal title={`🔑 ${resetType === 'ae' ? 'AE' : 'Purchaser'} Passwords Reset`} onClose={() => setResetResults(null)} wide>
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
                      <button onClick={() => navigator.clipboard.writeText(r.password)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:14 }}>📋</button>
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
              {copiedAll ? '✓ Copied!' : '📋 Copy All'}
            </button>
            <button onClick={() => setResetResults(null)} style={{ flex:1, padding:11, borderRadius:12, border:'1px solid #e2e8f0', background:'#fff', color:'#475569', fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:'"Plus Jakarta Sans", sans-serif' }}>Done</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
