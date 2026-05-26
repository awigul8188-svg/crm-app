import { useState, useEffect } from 'react'
import { useNFT, C } from './NFTContext'
const inp = { width:'100%', padding:'10px 14px', borderRadius:10, border:`1.5px solid ${C.border}`, background:'#fff', color:C.dark, fontSize:13, fontFamily:'"Plus Jakarta Sans",sans-serif', outline:'none', boxSizing:'border-box', transition:'border-color 0.15s' }
const lbl = { fontSize:10, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6, display:'block' }
export default function NFTProfile() {
  const { user, setUser, headers } = useNFT()
  const [profile, setProfile] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const load = () => fetch(`/api/nft/users/${user.id}`, { headers }).then(r=>r.json()).then(p=>{ setProfile(p); setForm(p||{}) }).catch(()=>{})
  useEffect(() => { load() }, [])
  const handleSave = async () => {
    setSaving(true)
    await fetch(`/api/nft/users/${user.id}`, { method:'PUT', headers:{...headers,'Content-Type':'application/json'}, body:JSON.stringify(form) })
    load(); setSaving(false); setEditing(false)
    setUser(prev => ({ ...prev, real_name:form.real_name, job_title:form.job_title }))
  }
  const handlePhoto = async (e) => {
    const file = e.target.files[0]; if (!file) return
    setUploading(true)
    const fd = new FormData(); fd.append('photo', file)
    const r = await fetch(`/api/nft/users/${user.id}/photo`, { method:'POST', headers, body:fd })
    const d = await r.json()
    setProfile(p=>({...p, photo_url:d.url})); setUser(prev=>({...prev,photo_url:d.url})); setUploading(false)
  }
  const p = profile
  return (
    <div style={{ padding:28, maxWidth:900 }}>
      <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:900, fontSize:22, color:C.black, marginBottom:24 }}>👤 My Profile</h1>
      <div style={{ display:'grid', gridTemplateColumns:'260px 1fr', gap:20 }}>
        {/* Photo card */}
        <div style={{ background:C.card, borderRadius:16, border:`1px solid ${C.border}`, padding:24, display:'flex', flexDirection:'column', alignItems:'center', gap:14, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ position:'relative' }}>
            {p?.photo_url
              ? <img src={p.photo_url} alt="" style={{ width:110, height:110, borderRadius:20, objectFit:'cover', border:`3px solid ${C.teal}` }} />
              : <div style={{ width:110, height:110, borderRadius:20, background:C.teal, display:'flex', alignItems:'center', justifyContent:'center', fontSize:42, fontWeight:900, color:C.black }}>{(p?.real_name||'?')[0]?.toUpperCase()}</div>}
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontWeight:800, fontSize:16, color:C.black }}>{p?.real_name}</div>
            <div style={{ fontSize:12, color:C.gray, marginTop:3 }}>{p?.job_title||'Employee'}</div>
            <div style={{ fontSize:11, color:C.gray }}>{p?.department}</div>
          </div>
          <label style={{ padding:'8px 20px', borderRadius:10, border:`1.5px solid ${C.teal}`, background:'#fff', color:C.tealDark, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', textAlign:'center' }}>
            {uploading?'Uploading...':'📷 Change Photo'}
            <input type="file" accept="image/*" style={{ display:'none' }} onChange={handlePhoto} disabled={uploading} />
          </label>
          <div style={{ width:'100%', paddingTop:12, borderTop:`1px solid ${C.border}` }}>
            {p?.phone && <div style={{ fontSize:12, color:C.gray, marginBottom:5 }}>📞 {p.phone}</div>}
            {p?.hire_date && <div style={{ fontSize:12, color:C.gray, marginBottom:5 }}>📅 Joined {new Date(p.hire_date).toLocaleDateString('en-US',{month:'long',year:'numeric'})}</div>}
            <span style={{ fontSize:11, padding:'3px 10px', borderRadius:20, background:`${C.teal}15`, color:C.tealDark, border:`1px solid ${C.teal}40`, textTransform:'capitalize', display:'inline-block', marginTop:4 }}>{p?.role||'employee'}</span>
          </div>
        </div>
        {/* Details */}
        <div style={{ background:C.card, borderRadius:16, border:`1px solid ${C.border}`, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:15, color:C.black }}>Employee Details</div>
            {!editing && <button onClick={()=>setEditing(true)} style={{ padding:'6px 16px', borderRadius:8, border:`1.5px solid ${C.teal}`, background:'#fff', color:C.tealDark, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>✎ Edit</button>}
          </div>
          {editing ? (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                {[['Full Name','real_name','text'],['Phone','phone','text'],['Job Title','job_title','text'],['Department','department','text'],['Hire Date','hire_date','date']].map(([l,k,t])=>(
                  <div key={k}>
                    <label style={lbl}>{l}</label>
                    <input type={t} value={form[k]||''} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} style={inp}
                      onFocus={e=>{e.target.style.borderColor=C.teal}} onBlur={e=>{e.target.style.borderColor=C.border}} />
                  </div>
                ))}
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={lbl}>Bio</label>
                <textarea value={form.bio||''} onChange={e=>setForm(f=>({...f,bio:e.target.value}))} rows={3} style={{ ...inp, resize:'none' }} placeholder="Brief bio about yourself..." onFocus={e=>{e.target.style.borderColor=C.teal}} onBlur={e=>{e.target.style.borderColor=C.border}} />
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={()=>setEditing(false)} style={{ flex:1, padding:10, borderRadius:10, border:`1px solid ${C.border}`, background:'#fff', color:C.gray, fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} style={{ flex:2, padding:10, borderRadius:10, border:'none', background:C.teal, color:C.black, fontWeight:800, fontSize:13, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', boxShadow:`0 2px 8px ${C.teal}50` }}>{saving?'Saving...':'Save Changes'}</button>
              </div>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              {[['Full Name',p?.real_name],['Phone',p?.phone],['Job Title',p?.job_title],['Department',p?.department],['Hire Date',p?.hire_date?new Date(p.hire_date).toLocaleDateString():null],['Username',p?.username]].map(([l,v])=>(
                <div key={l}>
                  <div style={{ fontSize:10, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>{l}</div>
                  <div style={{ fontSize:14, fontWeight:600, color:v?C.dark:C.border }}>{v||'—'}</div>
                </div>
              ))}
              {p?.bio && <div style={{ gridColumn:'1/-1' }}>
                <div style={{ fontSize:10, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>Bio</div>
                <div style={{ fontSize:13, color:C.gray, lineHeight:1.6 }}>{p.bio}</div>
              </div>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
