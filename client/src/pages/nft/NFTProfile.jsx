import { useState, useEffect } from 'react'
import { useNFT } from './NFTApp'

const AC = '#00E5CC'

export default function NFTProfile({ userId }) {
  const { user, profile: myProfile, setProfile, headers, navigateTo } = useNFT()
  const isOwnProfile = !userId || String(userId) === String(user?.id)
  const canEdit = isOwnProfile || user?.role === 'manager'
  const [profile, setLocalProfile] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const load = () => {
    const uid = userId || user?.id
    fetch(`/api/nft/profiles/${uid}`, { headers }).then(r=>r.json()).then(p => { setLocalProfile(p); setForm(p||{}) })
  }
  useEffect(() => { load() }, [userId])

  const handleSave = async () => {
    setSaving(true)
    const uid = userId || user?.id
    await fetch(`/api/nft/profiles/${uid}`, { method:'PUT', headers:{ ...headers, 'Content-Type':'application/json' }, body: JSON.stringify(form) })
    if (isOwnProfile) setProfile(prev => ({ ...prev, ...form }))
    load(); setSaving(false); setEditing(false)
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return
    setUploadingPhoto(true)
    const fd = new FormData(); fd.append('photo', file)
    const uid = userId || user?.id
    const r = await fetch(`/api/nft/profiles/${uid}/photo`, { method:'POST', headers, body:fd })
    const d = await r.json()
    load(); if (isOwnProfile) setProfile(prev => ({ ...prev, photo_url: d.url }))
    setUploadingPhoto(false)
  }

  const inp = { width:'100%', padding:'10px 14px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.06)', color:'#fff', fontSize:13, fontFamily:'"Plus Jakarta Sans",sans-serif', outline:'none' }
  const lbl = { fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.38)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6, display:'block' }
  const p = profile

  return (
    <div style={{ padding:28, maxWidth:900 }}>
      <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:22, color:'#fff', marginBottom:24 }}>👤 {isOwnProfile ? 'My Profile' : p?.real_name}</div>

      <div style={{ display:'grid', gridTemplateColumns:'260px 1fr', gap:20 }}>
        {/* Photo card */}
        <div style={{ background:'#13131f', borderRadius:16, border:'1px solid rgba(255,255,255,0.08)', padding:24, display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
          <div style={{ position:'relative' }}>
            {p?.photo_url
              ? <img src={p.photo_url} alt="" style={{ width:120, height:120, borderRadius:20, objectFit:'cover', border:`3px solid ${AC}` }} />
              : <div style={{ width:120, height:120, borderRadius:20, background:'linear-gradient(135deg, #00E5CC, #7C3AED)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:44, fontWeight:900, color:'#fff' }}>{(p?.real_name||'?')[0].toUpperCase()}</div>}
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontWeight:800, fontSize:16, color:'#fff', marginBottom:4 }}>{p?.real_name}</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)' }}>{p?.job_title || 'Employee'}</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)' }}>{p?.department}</div>
          </div>
          {canEdit && (
            <label style={{ padding:'8px 18px', borderRadius:10, border:`1px solid ${AC}30`, background:`${AC}12`, color:AC, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', textAlign:'center' }}>
              {uploadingPhoto ? 'Uploading...' : '📷 Change Photo'}
              <input type="file" accept="image/*" style={{ display:'none' }} onChange={handlePhotoUpload} />
            </label>
          )}
          <div style={{ width:'100%', padding:'12px 0', borderTop:'1px solid rgba(255,255,255,0.07)' }}>
            {p?.phone && <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)', marginBottom:6 }}>📞 {p.phone}</div>}
            {p?.hire_date && <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)', marginBottom:6 }}>📅 Joined {p.hire_date}</div>}
            <div style={{ fontSize:11, padding:'3px 10px', borderRadius:20, background:'rgba(0,229,204,0.1)', color:AC, border:`1px solid ${AC}30`, display:'inline-block', marginTop:4 }}>
              {p?.nft_role || 'employee'}
            </div>
          </div>
        </div>

        {/* Details card */}
        <div style={{ background:'#13131f', borderRadius:16, border:'1px solid rgba(255,255,255,0.08)', padding:24 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:14, color:'#fff' }}>Employee Details</div>
            {canEdit && !editing && (
              <button onClick={() => setEditing(true)} style={{ padding:'6px 14px', borderRadius:8, border:`1px solid ${AC}30`, background:`${AC}12`, color:AC, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>✎ Edit</button>
            )}
          </div>

          {editing ? (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {[['Full Name','real_name'],['Job Title','job_title'],['Department','department'],['Phone','phone'],['Hire Date','hire_date']].map(([l,k]) => (
                  <div key={k}>
                    <label style={lbl}>{l}</label>
                    <input value={form[k]||''} onChange={e => setForm(f=>({...f,[k]:e.target.value}))} style={inp} type={k==='hire_date'?'date':'text'} />
                  </div>
                ))}
                {user?.role==='manager' && (
                  <div><label style={lbl}>NFT Role</label>
                    <select value={form.nft_role||'employee'} onChange={e=>setForm(f=>({...f,nft_role:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                      {['employee','hr','admin','canteen','manager'].map(r=><option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label style={lbl}>Bio</label>
                <textarea value={form.bio||''} onChange={e=>setForm(f=>({...f,bio:e.target.value}))} rows={3} style={{ ...inp, resize:'none' }} placeholder="Brief bio..." />
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => setEditing(false)} style={{ flex:1, padding:10, borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(255,255,255,0.5)', fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} style={{ flex:2, padding:10, borderRadius:10, border:'none', background:'linear-gradient(135deg, #00E5CC, #7C3AED)', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>{saving?'Saving...':'Save Changes'}</button>
              </div>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              {[['Full Name',p?.real_name],['Job Title',p?.job_title],['Department',p?.department],['Phone',p?.phone],['Hire Date',p?.hire_date],['CRM Username',p?.username]].map(([l,v]) => (
                <div key={l}>
                  <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>{l}</div>
                  <div style={{ fontSize:14, fontWeight:600, color:v?'#fff':'rgba(255,255,255,0.25)' }}>{v||'—'}</div>
                </div>
              ))}
              {p?.bio && <div style={{ gridColumn:'1/-1' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>Bio</div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,0.6)', lineHeight:1.6 }}>{p.bio}</div>
              </div>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
