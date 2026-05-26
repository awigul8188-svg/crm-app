import { useState, useEffect, useRef } from 'react'
import { useNFT, C } from './NFTContext'
export default function NFTNews() {
  const { user, headers } = useNFT()
  const canPost = ['manager','hr'].includes(user?.role)
  const [news, setNews] = useState([]); const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ title:'', content:'' }); const [posting, setPosting] = useState(false)
  const fileRef = useRef()
  const load = () => fetch('/api/nft/news',{headers}).then(r=>r.json()).then(d=>setNews(Array.isArray(d)?d:[]))
  useEffect(()=>{ load() },[])
  const post = async () => {
    if (!form.title || !form.content) return; setPosting(true)
    const fd = new FormData(); fd.append('title',form.title); fd.append('content',form.content)
    if (fileRef.current?.files[0]) fd.append('image',fileRef.current.files[0])
    await fetch('/api/nft/news',{method:'POST',headers,body:fd})
    setForm({title:'',content:''}); setShowNew(false); setPosting(false); load()
  }
  const inp = { width:'100%', padding:'10px 14px', borderRadius:10, border:`1.5px solid ${C.border}`, background:'#fff', color:C.dark, fontSize:13, fontFamily:'"Plus Jakarta Sans",sans-serif', outline:'none', boxSizing:'border-box' }
  return (
    <div style={{ padding:28, maxWidth:800 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:900, fontSize:22, color:C.black, margin:0 }}>📰 NFT News</h1>
        {canPost && <button onClick={()=>setShowNew(!showNew)} style={{ padding:'8px 18px', borderRadius:10, border:'none', background:C.teal, color:C.black, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>+ Post News</button>}
      </div>
      {showNew && canPost && (
        <div style={{ background:C.card, borderRadius:14, border:`1.5px solid ${C.teal}40`, padding:20, marginBottom:24, boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
          <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="News title..." style={{ ...inp, marginBottom:10, fontSize:15, fontWeight:700 }} onFocus={e=>e.target.style.borderColor=C.teal} onBlur={e=>e.target.style.borderColor=C.border} />
          <textarea value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))} rows={4} placeholder="Write the news content..." style={{ ...inp, resize:'vertical', marginBottom:10 }} onFocus={e=>e.target.style.borderColor=C.teal} onBlur={e=>e.target.style.borderColor=C.border} />
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <label style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, border:`1.5px dashed ${C.border}`, color:C.gray, fontSize:12, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
              🖼 Add Photo <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} />
            </label>
            <div style={{ flex:1 }} />
            <button onClick={()=>setShowNew(false)} style={{ padding:'8px 16px', borderRadius:8, border:`1px solid ${C.border}`, background:'#fff', color:C.gray, fontSize:13, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Cancel</button>
            <button onClick={post} disabled={posting} style={{ padding:'8px 20px', borderRadius:8, border:'none', background:C.teal, color:C.black, fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>{posting?'Publishing...':'Publish'}</button>
          </div>
        </div>
      )}
      {!news.length ? (
        <div style={{ textAlign:'center', padding:60, color:C.gray }}>
          <div style={{ fontSize:48, marginBottom:12, opacity:0.3 }}>📰</div>
          <div style={{ fontSize:16, fontWeight:700, color:C.dark, marginBottom:6 }}>No news yet</div>
          <div style={{ fontSize:13 }}>Managers and HR will post company news here</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          {news.map(n=>(
            <div key={n.id} style={{ background:C.card, borderRadius:16, border:`1px solid ${C.border}`, overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
              {n.image_url && <img src={n.image_url} alt="" style={{ width:'100%', maxHeight:280, objectFit:'cover' }} />}
              <div style={{ padding:'20px 24px' }}>
                <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:900, fontSize:18, color:C.black, marginBottom:10 }}>{n.title}</div>
                <div style={{ fontSize:13, color:C.dark, lineHeight:1.7, whiteSpace:'pre-wrap' }}>{n.content}</div>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:16, paddingTop:14, borderTop:`1px solid ${C.border}` }}>
                  {n.author_photo ? <img src={n.author_photo} style={{ width:28,height:28,borderRadius:8,objectFit:'cover' }}/> : <div style={{ width:28,height:28,borderRadius:8,background:C.teal,color:C.black,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:800 }}>{n.real_name?.[0]}</div>}
                  <span style={{ fontSize:12, color:C.gray }}>By <b style={{ color:C.dark }}>{n.real_name}</b> · {new Date(n.created_at).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</span>
                  {canPost && <button onClick={async()=>{ if(confirm('Delete?')){ await fetch(`/api/nft/news/${n.id}`,{method:'DELETE',headers}); load() }}} style={{ marginLeft:'auto', padding:'4px 12px', borderRadius:8, border:'1px solid #fecaca', background:'#fff5f5', color:'#dc2626', fontSize:11, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Delete</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
