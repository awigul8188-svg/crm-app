import { useState, useEffect } from 'react'
import { useNFT } from './NFTApp'

const AC = '#00E5CC'
const DOC_TYPES = ['FRC','MRC','Character Certificate','Education Documents','Employment Letter','Other']

export default function NFTBioData() {
  const { user, profile, headers } = useNFT()
  const canManage = user?.role === 'manager' || profile?.nft_role === 'hr'
  const [docs, setDocs] = useState([])
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(user?.id)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({ doc_type:'FRC', doc_name:'' })
  const [showUpload, setShowUpload] = useState(false)

  const load = () => fetch(`/api/nft/biodata/${selectedUser}`, { headers }).then(r=>r.json()).then(setDocs).catch(()=>[])
  const loadUsers = () => fetch('/api/nft/profiles', { headers }).then(r=>r.json()).then(setUsers)

  useEffect(() => { load() }, [selectedUser])
  useEffect(() => { if (canManage) loadUsers() }, [])

  const handleUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return
    if (file.size > 10*1024*1024) return alert('File too large (max 10MB)')
    setUploading(true)
    const fd = new FormData()
    fd.append('document', file)
    fd.append('doc_type', form.doc_type)
    fd.append('doc_name', form.doc_name || file.name)
    await fetch(`/api/nft/biodata/${selectedUser}`, { method:'POST', headers, body:fd })
    load(); setUploading(false); setShowUpload(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this document?')) return
    await fetch(`/api/nft/biodata/${id}`, { method:'DELETE', headers })
    load()
  }

  const DOC_ICONS = { FRC:'🪪', MRC:'🏥', 'Character Certificate':'📜', 'Education Documents':'🎓', 'Employment Letter':'📄', Other:'📁' }
  const inp = { width:'100%', padding:'9px 12px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.06)', color:'#fff', fontSize:13, fontFamily:'"Plus Jakarta Sans",sans-serif', outline:'none' }

  return (
    <div style={{ padding:28, maxWidth:900 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:22, color:'#fff', margin:0 }}>📁 Bio Data</h1>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          {canManage && users.length > 0 && (
            <select value={selectedUser} onChange={e=>setSelectedUser(e.target.value)} style={{ ...inp, width:'auto', cursor:'pointer' }}>
              {users.map(u => <option key={u.user_id} value={u.user_id}>{u.real_name}</option>)}
            </select>
          )}
          {canManage && (
            <button onClick={() => setShowUpload(!showUpload)} style={{ padding:'8px 18px', borderRadius:10, border:'none', background:'linear-gradient(135deg, #00E5CC, #7C3AED)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
              + Upload Document
            </button>
          )}
        </div>
      </div>

      {/* Upload form */}
      {showUpload && canManage && (
        <div style={{ background:'#13131f', borderRadius:14, border:'1px solid rgba(0,229,204,0.2)', padding:20, marginBottom:20 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <div>
              <label style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.38)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6, display:'block' }}>Document Type</label>
              <select value={form.doc_type} onChange={e=>setForm(f=>({...f,doc_type:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.38)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6, display:'block' }}>Document Name</label>
              <input value={form.doc_name} onChange={e=>setForm(f=>({...f,doc_name:e.target.value}))} placeholder="e.g. FRC Islamabad 2024" style={inp} />
            </div>
          </div>
          <label style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'10px 20px', borderRadius:10, border:`1px dashed ${AC}50`, background:`${AC}08`, color:AC, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
            {uploading ? '⏳ Uploading...' : '📎 Choose File (max 10MB)'}
            <input type="file" style={{ display:'none' }} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      )}

      {/* Documents grouped by type */}
      {DOC_TYPES.map(type => {
        const typeDocs = docs.filter(d => d.doc_type === type)
        if (!typeDocs.length) return null
        return (
          <div key={type} style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
              <span>{DOC_ICONS[type]||'📁'}</span> {type} <span style={{ background:'rgba(255,255,255,0.08)', padding:'2px 8px', borderRadius:20, fontSize:10 }}>{typeDocs.length}</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {typeDocs.map(doc => (
                <div key={doc.id} style={{ background:'#13131f', borderRadius:12, border:'1px solid rgba(255,255,255,0.08)', padding:'14px 18px', display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:40, height:40, borderRadius:10, background:'rgba(0,229,204,0.1)', border:`1px solid ${AC}20`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{DOC_ICONS[doc.doc_type]||'📁'}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:14, color:'#fff' }}>{doc.doc_name}</div>
                    <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:2 }}>
                      {doc.doc_type} · {(doc.file_size/1024).toFixed(1)}KB · {new Date(doc.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <a href={doc.file_url} target="_blank" rel="noopener" style={{ padding:'6px 14px', borderRadius:8, border:`1px solid ${AC}30`, background:`${AC}10`, color:AC, fontSize:12, fontWeight:700, textDecoration:'none' }}>View</a>
                    {canManage && <button onClick={() => handleDelete(doc.id)} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid rgba(239,68,68,0.25)', background:'rgba(239,68,68,0.08)', color:'#f87171', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Delete</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
      {!docs.length && <div style={{ textAlign:'center', padding:60, color:'rgba(255,255,255,0.2)' }}><div style={{ fontSize:40, marginBottom:12 }}>📁</div><div style={{ fontSize:16, fontWeight:600 }}>No documents uploaded yet</div><div style={{ fontSize:13, marginTop:6 }}>HR will upload your documents here</div></div>}
    </div>
  )
}
