import { useState, useEffect } from 'react'
import { api } from '../api'
import { useAuth } from '../App'
import Modal from '../components/Modal'

const BRAND = '#00D4C8'

const ROLE_BADGE = {
  manager: { label: 'Manager',           style: { background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' } },
  ae:      { label: 'Account Executive', style: { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' } },
}

export default function Users() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [form, setForm] = useState({ username: '', password: '', name: '', role: 'ae' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Reset passwords state
  const [resetting, setResetting] = useState(false)
  const [resetResults, setResetResults] = useState(null)
  const [copiedAll, setCopiedAll] = useState(false)

  const load = () => api.getUsers().then(u => { setUsers(u); setLoading(false) })
  useEffect(() => { load() }, [])

  const reset = () => { setForm({ username: '', password: '', name: '', role: 'ae' }); setError('') }
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
      await api.updateUser(editUser.id, { name: form.name, role: form.role, password: form.password || undefined })
      setEditUser(null); reset(); load()
    }
    catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Remove "${name}"? This cannot be undone.`)) return
    await api.deleteUser(id); load()
  }

  const handleResetPasswords = async () => {
    if (!confirm('This will generate NEW random passwords for ALL Account Executives. Continue?')) return
    setResetting(true)
    try {
      const data = await api.resetAePasswords()
      setResetResults(data.results)
    } catch (e) { alert(e.message) }
    finally { setResetting(false) }
  }

  const copyAll = () => {
    const text = resetResults.map(r => `${r.name} (${r.username}): ${r.password}`).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopiedAll(true)
      setTimeout(() => setCopiedAll(false), 2000)
    })
  }

  const inp = { width: '100%', boxSizing: 'border-box', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px 14px', fontSize: '13px', color: '#0f172a', fontFamily: '"Plus Jakarta Sans", sans-serif', outline: 'none' }

  return (
    <div className="p-8 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-ink-900">⚙ Users</h1>
          <p className="text-ink-400 text-sm mt-0.5">Manage team access and roles</p>
        </div>
        <div className="flex gap-2">
          {/* Reset AE passwords */}
          <button
            onClick={handleResetPasswords}
            disabled={resetting}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '9px 16px', borderRadius: '12px',
              background: resetting ? '#f1f5f9' : '#fff5f5',
              border: '1px solid', borderColor: resetting ? '#e2e8f0' : '#fecaca',
              color: resetting ? '#94a3b8' : '#dc2626',
              fontSize: '13px', fontWeight: 600, cursor: resetting ? 'not-allowed' : 'pointer',
              fontFamily: '"Plus Jakarta Sans", sans-serif', transition: 'all 0.15s',
            }}
          >
            {resetting
              ? <><div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #94a3b8', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />Resetting...</>
              : <>🔑 Reset All AE Passwords</>}
          </button>

          <button onClick={() => { reset(); setShowNew(true) }} className="btn-primary">+ New User</button>
        </div>
      </div>

      {/* Reset results modal */}
      {resetResults && (
        <Modal title="🔑 New AE Passwords Generated" onClose={() => setResetResults(null)} wide>
          <div>
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#c2410c' }}>
              ⚠ Save these passwords now — they won't be shown again. Share each password with the respective team member securely.
            </div>

            {/* Password table */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '14px', overflow: 'hidden', marginBottom: '16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Name</th>
                    <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Username</th>
                    <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>New Password</th>
                    <th style={{ padding: '10px 16px', width: '40px' }} />
                  </tr>
                </thead>
                <tbody>
                  {resetResults.map((r, i) => (
                    <tr key={r.id} style={{ borderBottom: i < resetResults.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>{r.name}</td>
                      <td style={{ padding: '12px 16px', color: '#64748b', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px' }}>{r.username}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '13px', fontWeight: 700, color: '#0f172a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '4px 10px', letterSpacing: '0.05em' }}>
                          {r.password}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <button
                          onClick={() => navigator.clipboard.writeText(r.password)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '14px', padding: '2px 4px' }}
                          title="Copy password"
                        >📋</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={copyAll}
                style={{ flex: 1, padding: '11px', borderRadius: '12px', border: `1px solid ${BRAND}`, background: copiedAll ? BRAND : `${BRAND}15`, color: copiedAll ? '#0d0d0d' : '#00b8ad', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: '"Plus Jakarta Sans", sans-serif', transition: 'all 0.15s' }}>
                {copiedAll ? '✓ Copied!' : '📋 Copy All Passwords'}
              </button>
              <button onClick={() => setResetResults(null)}
                style={{ flex: 1, padding: '11px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Users table */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-7 h-7 rounded-full border-2 border-t-transparent spinner" style={{ borderColor: `${BRAND} transparent transparent` }} />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="text-left px-5 py-3">Name</th>
                <th className="text-left px-5 py-3">Username</th>
                <th className="text-left px-5 py-3">Role</th>
                <th className="text-left px-5 py-3">Joined</th>
                <th className="px-5 py-3 w-40" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-surface-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{ background: u.role === 'manager' ? '#f5f3ff' : `${BRAND}18`, color: u.role === 'manager' ? '#7c3aed' : '#00b8ad' }}>
                        {u.name[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-ink-800 text-sm">{u.name}</div>
                        {u.id === user.id && <div className="text-xs text-ink-400">you</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-mono text-sm text-ink-500">{u.username}</td>
                  <td className="px-5 py-4">
                    <span style={{ ...ROLE_BADGE[u.role].style, fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', display: 'inline-block' }}>
                      {ROLE_BADGE[u.role].label}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-ink-400">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => { setEditUser(u); setForm({ name: u.name, role: u.role, username: u.username, password: '' }); setError('') }}
                        className="btn-secondary btn-sm">
                        Edit
                      </button>
                      {u.id !== user.id && (
                        <button onClick={() => handleDelete(u.id, u.name)} className="btn-danger btn-sm">Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New User Modal */}
      {showNew && (
        <Modal title="New User" onClose={() => { setShowNew(false); reset() }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div><div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>Full Name</div>
              <input style={inp} placeholder="e.g. Ryan Smith" value={form.name} onChange={e => setF('name', e.target.value)} /></div>
            <div><div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>Username</div>
              <input style={inp} placeholder="e.g. ryan" value={form.username} onChange={e => setF('username', e.target.value)} /></div>
            <div><div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>Password</div>
              <input type="password" style={inp} placeholder="Set initial password" value={form.password} onChange={e => setF('password', e.target.value)} /></div>
            <div><div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>Role</div>
              <select style={{ ...inp, cursor: 'pointer' }} value={form.role} onChange={e => setF('role', e.target.value)}>
                <option value="ae">Account Executive</option>
                <option value="manager">Manager</option>
              </select></div>
            {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: '#dc2626' }}>⚠ {error}</div>}
            <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
              <button onClick={() => { setShowNew(false); reset() }} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleCreate} disabled={saving} className="btn-primary" style={{ flex: 1 }}>{saving ? 'Creating...' : 'Create User'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <Modal title={`Edit — ${editUser.name}`} onClose={() => { setEditUser(null); reset() }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div><div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>Full Name</div>
              <input style={inp} value={form.name} onChange={e => setF('name', e.target.value)} /></div>
            <div><div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>Role</div>
              <select style={{ ...inp, cursor: 'pointer' }} value={form.role} onChange={e => setF('role', e.target.value)}>
                <option value="ae">Account Executive</option>
                <option value="manager">Manager</option>
              </select></div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>New Password</div>
              <input type="password" style={inp} placeholder="Leave blank to keep current" value={form.password} onChange={e => setF('password', e.target.value)} />
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Only fill in if you want to change it</div>
            </div>
            {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: '#dc2626' }}>⚠ {error}</div>}
            <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
              <button onClick={() => { setEditUser(null); reset() }} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleUpdate} disabled={saving} className="btn-primary" style={{ flex: 1 }}>{saving ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
