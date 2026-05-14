import { useState, useEffect } from 'react'
import { api } from '../api'
import { useAuth } from '../App'
import Modal from '../components/Modal'

export default function Users() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [form, setForm] = useState({ username: '', password: '', name: '', role: 'ae' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    api.getUsers().then(u => { setUsers(u); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  const resetForm = () => { setForm({ username: '', password: '', name: '', role: 'ae' }); setError('') }

  const handleCreate = async () => {
    setSaving(true); setError('')
    try {
      await api.createUser(form)
      setShowNew(false); resetForm(); load()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const handleUpdate = async () => {
    setSaving(true); setError('')
    try {
      await api.updateUser(editUser.id, { name: form.name, role: form.role, password: form.password || undefined })
      setEditUser(null); resetForm(); load()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return
    await api.deleteUser(id)
    load()
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-900">⚙️ Users</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage team access</p>
        </div>
        <button onClick={() => { resetForm(); setShowNew(true) }} className="btn-primary">+ New User</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Name</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Username</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Role</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Joined</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 font-bold text-xs">
                        {u.name[0].toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-800">{u.name}</span>
                      {u.id === user.id && <span className="text-xs text-gray-400">(you)</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-600 font-mono">{u.username}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg border ${
                      u.role === 'manager'
                        ? 'bg-violet-50 text-violet-600 border-violet-100'
                        : 'bg-gray-50 text-gray-600 border-gray-200'
                    }`}>
                      {u.role === 'manager' ? 'Manager' : 'Account Executive'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => {
                          setEditUser(u)
                          setForm({ name: u.name, role: u.role, username: u.username, password: '' })
                          setError('')
                        }}
                        className="btn-secondary py-1 px-3"
                      >
                        Edit
                      </button>
                      {u.id !== user.id && (
                        <button onClick={() => handleDelete(u.id, u.name)} className="btn-danger py-1 px-3">
                          Delete
                        </button>
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
        <Modal title="New User" onClose={() => { setShowNew(false); resetForm() }}>
          <div className="space-y-3">
            <input className="input" placeholder="Full name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input className="input" placeholder="Username *" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
            <input type="password" className="input" placeholder="Password *" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              <option value="ae">Account Executive</option>
              <option value="manager">Manager</option>
            </select>
            {error && <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-3 py-2 rounded-xl">{error}</div>}
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setShowNew(false); resetForm() }} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleCreate} disabled={saving} className="btn-primary flex-1">{saving ? 'Creating...' : 'Create'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <Modal title={`Edit ${editUser.name}`} onClose={() => { setEditUser(null); resetForm() }}>
          <div className="space-y-3">
            <input className="input" placeholder="Full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              <option value="ae">Account Executive</option>
              <option value="manager">Manager</option>
            </select>
            <input type="password" className="input" placeholder="New password (leave blank to keep)" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            {error && <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-3 py-2 rounded-xl">{error}</div>}
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setEditUser(null); resetForm() }} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleUpdate} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
