import { useState, useEffect } from 'react'
import { useNFT, C } from './NFTApp'
const DOC_TYPES = ['FRC','MRC','Character Certificate','Education Documents','Employment Letter','Other']
const DOC_ICONS = { FRC:'🪪', MRC:'🏥', 'Character Certificate':'📜', 'Education Documents':'🎓', 'Employment Letter':'📄', Other:'📁' }
const inp = { width:'100%', padding:'9px 12px', borderRadius:10, border:`1.5px solid ${C.border}`, background:'#fff', color:C.dark, fontSize:13, fontFamily:'"Plus Jakarta Sans",sans-serif', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:10, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6, display:'block' }
export default function NFTBioData() {
  const { user, headers } = useNFT()
  const canManage = ['manager','hr'].includes(user?.role)
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(user?.id)
  const [docs, setDocs] = useState([])
  const [showUpload, setShowUpload] = useState(false)
  const [form, setForm] = useState({ doc_type:'FRC', doc_name:'' })
  const [uploading, setUploading] = useState(false)
  const load = () => fetch(`/api/nft/biodata/${selectedUser}`, { headers }).then(r=>r.json()).then(d=>setDocs(Array.isArray(d)?d:[]))
  useEffect(() => { load() }, [selectedUser])
  useEffect(() => { if (canManage) fetch('/api/nft/users', { headers }).then(r=>r.json()).then(d=>setUsers(Array.isArray(d)?d:[])) }, [])
  const handleUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return
    if (file.size > 10*1024*1024) return alert('File too large (max 10MB)')
    setUploading(true)
    const fd = new FormData(); fd.append('document', file); fd.append('doc_type', form.doc_type); fd.append('doc_name', form.doc_name||file.name)
    await fetch(`/api/nft/biodata/${selectedUser}`, { method:'POST', headers, body:fd })
    load(); setUploading(false); setShowUpload(false)
  }
  const del = async (id) => { if (!confirm('Delete?')) return; await fetch(`/api/nft/biodata/${id}`, { method:'DELETE', headers }); load() }
  return (
    <div style={{ padding:28, maxWidth:900 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:900, fontSize:22, color:C.black, margin:0 }}>📁 Bio Data</h1>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          {canManage && users.length > 0 && (
            <select value={selectedUser} onChange={e=>setSelectedUser(e.target.value)} style={{ ...inp, width:'auto', cursor:'pointer' }}>
              {users.map(u=><option key={u.id} value={u.id}>{u.real_name}</option>)}
            </select>
          )}
          {canManage && <button onClick={()=>setShowUpload(!showUpload)} style={{ padding:'8px 18px', borderRadius:10, border:'none', background:C.teal, color:C.black, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>+ Upload Document</button>}
        </div>
      </div>
      {showUpload && canManage && (
        <div style={{ background:C.card, borderRadius:14, border:`1.5px solid ${C.teal}40`, padding:20, marginBottom:20, boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <div><label style={lbl}>Document Type</label>
              <select value={form.doc_type} onChange={e=>setForm(f=>({...f,doc_type:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                {DOC_TYPES.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Document Name</label>
              <input value={form.doc_name} onChange={e=>setForm(f=>({...f,doc_name:e.target.value}))} placeholder="e.g. FRC Islamabad 2024" style={inp} />
            </div>
          </div>
          <label style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'10px 20px', borderRadius:10, border:`1.5px dashed ${C.teal}`, background:`${C.teal}08`, color:C.tealDark, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
            {uploading ? '⏳ Uploading...' : '📎 Choose File (max 10MB)'}
            <input type="file" style={{ display:'none' }} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      )}
      {DOC_TYPES.map(type => {
        const typeDocs = docs.filter(d=>d.doc_type===type)
        if (!typeDocs.length) return null
        return (
          <div key={type} style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
              {DOC_ICONS[type]} {type}
              <span style={{ background:C.bg, border:`1px solid ${C.border}`, padding:'1px 8px', borderRadius:20, fontSize:10 }}>{typeDocs.length}</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {typeDocs.map(doc=>(
                <div key={doc.id} style={{ background:C.card, borderRadius:12, border:`1px solid ${C.border}`, padding:'14px 18px', display:'flex', alignItems:'center', gap:12, boxShadow:'0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ width:40, height:40, borderRadius:10, background:`${C.teal}15`, border:`1px solid ${C.teal}30`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{DOC_ICONS[doc.doc_type]||'📁'}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:14, color:C.dark }}>{doc.doc_name}</div>
                    <div style={{ fontSize:11, color:C.gray, marginTop:2 }}>{doc.doc_type} · {(doc.file_size/1024).toFixed(1)}KB · {new Date(doc.created_at).toLocaleDateString()}</div>
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <a href={doc.file_url} target="_blank" rel="noopener" style={{ padding:'6px 14px', borderRadius:8, border:`1.5px solid ${C.teal}`, background:'#fff', color:C.tealDark, fontSize:12, fontWeight:700, textDecoration:'none' }}>View</a>
                    {canManage && <button onClick={()=>del(doc.id)} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #fecaca', background:'#fff5f5', color:'#dc2626', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Delete</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
      {!docs.length && (
        <div style={{ textAlign:'center', padding:'60px 20px', color:C.gray }}>
          <div style={{ fontSize:48, marginBottom:12, opacity:0.3 }}>📁</div>
          <div style={{ fontSize:16, fontWeight:700, color:C.dark, marginBottom:6 }}>No documents yet</div>
          <div style={{ fontSize:13 }}>HR will upload your documents here</div>
        </div>
      )}
    </div>
  )
}
