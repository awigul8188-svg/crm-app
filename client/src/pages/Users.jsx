import { useState, useEffect, useRef } from 'react'
import { api } from '../api'
import { useAuth } from '../App'
import Modal from '../components/Modal'

const BRAND = '#00D4C8'
const inp = { width:'100%', boxSizing:'border-box', background:'#fff', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'10px 14px', fontSize:'13px', color:'#0f172a', fontFamily:'"Plus Jakarta Sans", sans-serif', outline:'none' }

function Avatar({ user, size = 36 }) {
  if (user.avatar_url) {
    return <img src={user.avatar_url} alt={user.name} style={{ width:size, height:size, borderRadius:size*0.28, objectFit:'cover', flexShrink:0 }} onError={e => { e.target.style.display='none' }} />
  }
  return (
    <div style={{ width:size, height:size, borderRadius:size*0.28, background: user.role==='manager' ? '#f5f3ff' : `${BRAND}25`, color: user.role==='manager' ? '#7c3aed' : '#00b8ad', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:size*0.38, flexShrink:0 }}>
      {user.name[0].toUpperCase()}
    </div>
  )
}

function UploadButton({ label, accept, onUpload, small }) {
  const ref = useRef()
  return (
    <>
      <input ref={ref} type="file" accept={accept} style={{ display:'none' }} onChange={e => { if (e.target.files[0]) { onUpload(e.target.files[0]); e.target.value = '' } }} />
      <button onClick={() => ref.current?.click()}
        style={{ padding: small ? '5px 10px' : '7px 14px', borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', color:'#475569', fontSize:small ? 11 : 12, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans", sans-serif', whiteSpace:'nowrap' }}>
        {label}
      </button>
    </>
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
  const [copiedAll, setCopiedAll] = useState(false)
  const [playingId, setPlayingId] = useState(null)
  const [uploading, setUploading] = useState({})

  const load = () => api.getUsers().then(u => { setUsers(u); setLoading(false) })
  useEffect(() => { load() }, [])

  // Also poll ringtone status to show which are active
  useEffect(() => {
    const interval = setInterval(() => {
      fetch('/api/ringtone/all', { headers: { Authorization: `Bearer ${localStorage.getItem('crm_token')}` } })
        .then(r => r.json())
        .then(rtUsers => {
          setUsers(prev => prev.map(u => {
            const rt = rtUsers.find(r => r.id === u.id)
            return rt ? { ...u, ringtone_active: rt.ringtone_active, ringtone_url: rt.ringtone_url } : u
          }))
        }).catch(() => {})
    }, 3000)
    return () => clearInterval(interval)
  }, [])

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
    try { await api.updateUser(editUser.id, { name:form.name, role:form.role, password:form.password||undefined }); setEditUser(null); reset(); load() }
    catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Remove "${name}"?`)) return
    await api.deleteUser(id); load()
  }

  const handleResetPasswords = async () => {
    if (!confirm('Generate new random passwords for ALL AEs?')) return
    setResetting(true)
    try { const data = await api.resetAePasswords(); setResetResults(data.results) }
    catch (e) { alert(e.message) }
    finally { setResetting(false) }
  }

  const handleUpload = async (userId, type, file) => {
    setUploading(prev => ({ ...prev, [`${type}-${userId}`]: true }))
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch(`/api/upload/${type}/${userId}`, { method:'POST', headers:{ Authorization:`Bearer ${localStorage.getItem('crm_token')}` }, body:formData })
      if (res.ok) load()
      else { const d = await res.json(); alert(d.error) }
    } catch (e) { alert(e.message) }
    finally { setUploading(prev => ({ ...prev, [`${type}-${userId}`]: false })) }
  }

  const handlePlayRingtone = async (userId) => {
    try {
      await fetch(`/api/ringtone/${userId}/play`, { method:'POST', headers:{ Authorization:`Bearer ${localStorage.getItem('crm_token')}`, 'Content-Type':'application/json' } })
      setPlayingId(userId)
    } catch (e) { alert(e.message) }
  }

  const handleStopRingtone = async (userId) => {
    try {
      await fetch(`/api/ringtone/${userId}/stop`, { method:'POST', headers:{ Authorization:`Bearer ${localStorage.getItem('crm_token')}`, 'Content-Type':'application/json' } })
      setPlayingId(null)
    } catch (e) { alert(e.message) }
  }

  const aes = users.filter(u => u.role === 'ae')
  const managers = users.filter(u => u.role === 'manager')

  return (
    <div className="p-8 fade-in">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 className="font-display font-bold text-2xl text-ink-900">⚙ Users</h1>
          <p className="text-ink-400 text-sm mt-0.5">Manage team access, photos, and ringtones</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={handleResetPasswords} disabled={resetting}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 16px', borderRadius:12, background:'#fff5f5', border:'1px solid #fecaca', color:'#dc2626', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans", sans-serif' }}>
            {resetting ? '...' : '🔑 Reset All AE Passwords'}
          </button>
          <button onClick={() => { reset(); setShowNew(true) }} className="btn-primary">+ New User</button>
        </div>
      </div>

      {loading ? (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'80px 0' }}><div style={{ width:28, height:28, borderRadius:'50%', border:`2px solid ${BRAND}`, borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} /></div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
          {/* Managers section */}
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>Managers</div>
            <div className="card overflow-hidden">
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                  {['Photo','Name','Username','Joined','Actions'].map(h => <th key={h} style={{ textAlign:'left', padding:'10px 16px', fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {managers.map(u => (
                    <tr key={u.id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                      <td style={{ padding:'12px 16px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <Avatar user={u} size={36} />
                          <UploadButton label="📷" accept="image/*" small onUpload={f => handleUpload(u.id, 'avatar', f)} />
                        </div>
                      </td>
                      <td style={{ padding:'12px 16px', fontWeight:600, color:'#0f172a', fontSize:14 }}>{u.name} {u.id === user.id && <span style={{ fontSize:11, color:'#94a3b8' }}>(you)</span>}</td>
                      <td style={{ padding:'12px 16px', fontFamily:'monospace', color:'#64748b', fontSize:13 }}>{u.username}</td>
                      <td style={{ padding:'12px 16px', fontSize:12, color:'#94a3b8' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td style={{ padding:'12px 16px' }}>
                        <div style={{ display:'flex', gap:6 }}>
                          <button onClick={() => { setEditUser(u); setForm({ name:u.name, role:u.role, username:u.username, password:'' }); setError('') }} className="btn-secondary btn-sm">Edit</button>
                          {u.id !== user.id && <button onClick={() => handleDelete(u.id, u.name)} className="btn-danger btn-sm">Delete</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* AEs section with photo + ringtone */}
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>Account Executives</div>
            <div className="card overflow-hidden">
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                  {['Photo','Name','Username','Ringtone','Actions'].map(h => <th key={h} style={{ textAlign:'left', padding:'10px 16px', fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {aes.map(u => {
                    const isPlaying = u.ringtone_active === 1
                    const isUploading = uploading[`avatar-${u.id}`] || uploading[`ringtone-${u.id}`]
                    return (
                      <tr key={u.id} style={{ borderBottom:'1px solid #f1f5f9', background: isPlaying ? 'rgba(0,212,200,0.04)' : 'transparent' }}>
                        <td style={{ padding:'12px 16px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <Avatar user={u} size={36} />
                            <UploadButton label={uploading[`avatar-${u.id}`] ? '...' : '📷'} accept="image/*" small onUpload={f => handleUpload(u.id, 'avatar', f)} />
                          </div>
                        </td>
                        <td style={{ padding:'12px 16px', fontWeight:600, color:'#0f172a', fontSize:14 }}>
                          {u.name}
                          {isPlaying && <span style={{ marginLeft:8, fontSize:10, background:'#00D4C8', color:'#0d0d0d', padding:'2px 6px', borderRadius:20, fontWeight:700, animation:'pulse 1s infinite' }}>🔔 RINGING</span>}
                        </td>
                        <td style={{ padding:'12px 16px', fontFamily:'monospace', color:'#64748b', fontSize:13 }}>{u.username}</td>
                        <td style={{ padding:'12px 16px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                            {u.ringtone_url ? (
                              <>
                                <span style={{ fontSize:11, color:'#10b981', fontWeight:600 }}>✓ Uploaded</span>
                                <UploadButton label="Replace" accept="audio/*,.mp3,.wav,.ogg,.m4a" small onUpload={f => handleUpload(u.id, 'ringtone', f)} />
                                {isPlaying ? (
                                  <button onClick={() => handleStopRingtone(u.id)}
                                    style={{ padding:'5px 12px', borderRadius:8, border:'none', background:'#ef4444', color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'"Plus Jakarta Sans", sans-serif', display:'flex', alignItems:'center', gap:4 }}>
                                    ⏹ Stop
                                  </button>
                                ) : (
                                  <button onClick={() => handlePlayRingtone(u.id)}
                                    style={{ padding:'5px 12px', borderRadius:8, border:'none', background:BRAND, color:'#0d0d0d', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'"Plus Jakarta Sans", sans-serif', display:'flex', alignItems:'center', gap:4 }}>
                                    ▶ Ring {u.name}
                                  </button>
                                )}
                              </>
                            ) : (
                              <UploadButton label={uploading[`ringtone-${u.id}`] ? 'Uploading...' : '🎵 Upload Ringtone'} accept="audio/*,.mp3,.wav,.ogg,.m4a" small onUpload={f => handleUpload(u.id, 'ringtone', f)} />
                            )}
                          </div>
                        </td>
                        <td style={{ padding:'12px 16px' }}>
                          <div style={{ display:'flex', gap:6 }}>
                            <button onClick={() => { setEditUser(u); setForm({ name:u.name, role:u.role, username:u.username, password:'' }); setError('') }} className="btn-secondary btn-sm">Edit</button>
                            <button onClick={() => handleDelete(u.id, u.name)} className="btn-danger btn-sm">Delete</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Reset passwords modal */}
      {resetResults && (
        <Modal title="🔑 New AE Passwords" onClose={() => setResetResults(null)} wide>
          <div style={{ background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:12, padding:'10px 14px', marginBottom:14, fontSize:13, color:'#c2410c' }}>
            ⚠ Save these — they won't be shown again
          </div>
          <div style={{ border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden', marginBottom:14 }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                {['Name','Username','New Password',''].map(h => <th key={h} style={{ textAlign:'left', padding:'8px 14px', fontSize:11, fontWeight:700, color:'#64748b' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {resetResults.map((r,i) => (
                  <tr key={r.id} style={{ borderBottom: i < resetResults.length-1 ? '1px solid #f1f5f9' : 'none' }}>
                    <td style={{ padding:'10px 14px', fontWeight:600 }}>{r.name}</td>
                    <td style={{ padding:'10px 14px', fontFamily:'monospace', color:'#64748b' }}>{r.username}</td>
                    <td style={{ padding:'10px 14px' }}><span style={{ fontFamily:'monospace', fontWeight:700, background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:6, padding:'3px 8px' }}>{r.password}</span></td>
                    <td style={{ padding:'10px 14px' }}><button onClick={() => navigator.clipboard.writeText(r.password)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:14 }}>📋</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={() => { navigator.clipboard.writeText(resetResults.map(r => `${r.name} (${r.username}): ${r.password}`).join('\n')); setCopiedAll(true); setTimeout(() => setCopiedAll(false), 2000) }}
              style={{ flex:1, padding:11, borderRadius:12, border:`1px solid ${BRAND}`, background: copiedAll ? BRAND : `${BRAND}15`, color: copiedAll ? '#0d0d0d' : '#00b8ad', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'"Plus Jakarta Sans", sans-serif' }}>
              {copiedAll ? '✓ Copied!' : '📋 Copy All'}
            </button>
            <button onClick={() => setResetResults(null)} style={{ flex:1, padding:11, borderRadius:12, border:'1px solid #e2e8f0', background:'#fff', color:'#475569', fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:'"Plus Jakarta Sans", sans-serif' }}>Done</button>
          </div>
        </Modal>
      )}

      {/* New User */}
      {showNew && (
        <Modal title="New User" onClose={() => { setShowNew(false); reset() }}>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {[['Full Name','name','text','e.g. Ryan Smith'],['Username','username','text','e.g. ryan'],['Password','password','password','Set initial password']].map(([label,key,type,ph]) => (
              <div key={key}><div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>{label}</div><input type={type} style={inp} placeholder={ph} value={form[key]} onChange={e => setF(key, e.target.value)} /></div>
            ))}
            <div><div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Role</div>
              <select style={{ ...inp, cursor:'pointer' }} value={form.role} onChange={e => setF('role', e.target.value)}><option value="ae">Account Executive</option><option value="manager">Manager</option></select></div>
            {error && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#dc2626' }}>⚠ {error}</div>}
            <div style={{ display:'flex', gap:10, paddingTop:4 }}>
              <button onClick={() => { setShowNew(false); reset() }} className="btn-secondary" style={{ flex:1 }}>Cancel</button>
              <button onClick={handleCreate} disabled={saving} className="btn-primary" style={{ flex:1 }}>{saving ? 'Creating...' : 'Create'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit User */}
      {editUser && (
        <Modal title={`Edit — ${editUser.name}`} onClose={() => { setEditUser(null); reset() }}>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div><div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Full Name</div><input style={inp} value={form.name} onChange={e => setF('name', e.target.value)} /></div>
            <div><div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Role</div><select style={{ ...inp, cursor:'pointer' }} value={form.role} onChange={e => setF('role', e.target.value)}><option value="ae">Account Executive</option><option value="manager">Manager</option></select></div>
            <div><div style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>New Password</div><input type="password" style={inp} placeholder="Leave blank to keep current" value={form.password} onChange={e => setF('password', e.target.value)} /><div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>Only fill in if you want to change it</div></div>
            {error && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#dc2626' }}>⚠ {error}</div>}
            <div style={{ display:'flex', gap:10, paddingTop:4 }}>
              <button onClick={() => { setEditUser(null); reset() }} className="btn-secondary" style={{ flex:1 }}>Cancel</button>
              <button onClick={handleUpdate} disabled={saving} className="btn-primary" style={{ flex:1 }}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </Modal>
      )}
      <style>{`@keyframes spin { to { transform:rotate(360deg); } } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </div>
  )
}
