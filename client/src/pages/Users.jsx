import { useState, useEffect } from 'react'
import { api } from '../api'
import { useAuth } from '../App'
import Modal from '../components/Modal'

const ROLE_LABELS = { manager: 'Manager', ae: 'Account Executive' }
const ROLE_STYLE = { manager: 'bg-violet-50 text-violet-700 border-violet-200', ae: 'bg-slate-50 text-slate-600 border-slate-200' }

export default function Users() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [form, setForm] = useState({ username: '', password: '', name: '', role: 'ae' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => { api.getUsers().then(u => { setUsers(u); setLoading(false) }) }
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
    try { await api.updateUser(editUser.id, { name: form.name, role: form.role, password: form.password || undefined }); setEditUser(null); reset(); load() }
    catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Remove "${name}"? This cannot be undone.`)) return
    await api.deleteUser(id); load()
  }

  return (
    <div className="p-8 fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-ink-900">⚙ Users</h1>
          <p className="text-ink-400 text-sm mt-0.5">Manage team access and roles</p>
        </div>
        <button onClick={() => { reset(); setShowNew(true) }} className="btn-primary">+ New User</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24"><div className="w-7 h-7 rounded-full border-2 border-brand-400 border-t-transparent spinner" /></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="text-left px-5 py-3">Name</th>
                <th className="text-left px-5 py-3">Username</th>
                <th className="text-left px-5 py-3">Role</th>
                <th className="text-left px-5 py-3">Joined</th>
                <th className="px-5 py-3 w-32" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-surface-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 font-bold text-sm">{u.name[0].toUpperCase()}</div>
                      <div>
                        <div className="font-semibold text-ink-800 text-sm">{u.name}</div>
                        {u.id === user.id && <div className="text-xs text-ink-400">you</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-mono text-sm text-ink-500">{u.username}</td>
                  <td className="px-5 py-4"><span className={`badge ${ROLE_STYLE[u.role]}`}>{ROLE_LABELS[u.role]}</span></td>
                  <td className="px-5 py-4 text-xs text-ink-400">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-4">
                    <div className="flex gap-1.5 justify-end">
                      <button onClick={() => { setEditUser(u); setForm({ name: u.name, role: u.role, username: u.username, password: '' }); setError('') }} className="btn-secondary btn-sm">Edit</button>
                      {u.id !== user.id && <button onClick={() => handleDelete(u.id, u.name)} className="btn-danger btn-sm">Delete</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNew && (
        <Modal title="New User" onClose={() => { setShowNew(false); reset() }}>
          <div className="space-y-3">
            <input className="input" placeholder="Full name *" value={form.name} onChange={e => setF('name', e.target.value)} />
            <input className="input" placeholder="Username *" value={form.username} onChange={e => setF('username', e.target.value)} />
            <input type="password" className="input" placeholder="Password *" value={form.password} onChange={e => setF('password', e.target.value)} />
            <select className="input" value={form.role} onChange={e => setF('role', e.target.value)}>
              <option value="ae">Account Executive</option>
              <option value="manager">Manager</option>
            </select>
            {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2.5 rounded-xl">{error}</div>}
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setShowNew(false); reset() }} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleCreate} disabled={saving} className="btn-primary flex-1">{saving ? 'Creating...' : 'Create'}</button>
            </div>
          </div>
        </Modal>
      )}

      {editUser && (
        <Modal title={`Edit — ${editUser.name}`} onClose={() => { setEditUser(null); reset() }}>
          <div className="space-y-3">
            <input className="input" placeholder="Full name" value={form.name} onChange={e => setF('name', e.target.value)} />
            <select className="input" value={form.role} onChange={e => setF('role', e.target.value)}>
              <option value="ae">Account Executive</option>
              <option value="manager">Manager</option>
            </select>
            <input type="password" className="input" placeholder="New password (leave blank to keep)" value={form.password} onChange={e => setF('password', e.target.value)} />
            {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2.5 rounded-xl">{error}</div>}
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setEditUser(null); reset() }} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleUpdate} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save changes'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
