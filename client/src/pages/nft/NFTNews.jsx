import { useState, useEffect, useRef } from 'react'
import { useNFT } from './NFTApp'
const AC='#00E5CC'
export default function NFTNews() {
  const { user, profile, headers } = useNFT()
  const canPost = user?.role==='manager' || profile?.nft_role==='hr'
  const [news, setNews] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ title:'', content:'' })
  const [posting, setPosting] = useState(false)
  const fileRef = useRef()
  const load = () => fetch('/api/nft/news', { headers }).then(r=>r.json()).then(d => setNews(Array.isArray(d)?d:[]))
  useEffect(() => { load() }, [])
  const handlePost = async () => {
    if (!form.title || !form.content) return
    setPosting(true)
    const fd = new FormData(); fd.append('title', form.title); fd.append('content', form.content)
    if (fileRef.current?.files[0]) fd.append('image', fileRef.current.files[0])
    await fetch('/api/nft/news', { method:'POST', headers, body:fd })
    setForm({ title:'', content:'' }); setShowNew(false); setPosting(false); load()
  }
  const inp = { width:'100%', padding:'10px 14px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.06)', color:'#fff', fontSize:13, fontFamily:'"Plus Jakarta Sans",sans-serif', outline:'none' }
  return (
    <div style={{ padding:28, maxWidth:800 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:22, color:'#fff', margin:0 }}>📰 NFT News</h1>
        {canPost && <button onClick={() => setShowNew(!showNew)} style={{ padding:'8px 18px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#00E5CC,#7C3AED)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>+ Post News</button>}
      </div>
      {showNew && canPost && (
        <div style={{ background:'#13131f', borderRadius:14, border:'1px solid rgba(0,229,204,0.2)', padding:20, marginBottom:24 }}>
          <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="News title..." style={{ ...inp, marginBottom:10, fontSize:15, fontWeight:600 }} />
          <textarea value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))} rows={4} placeholder="Write the news content..." style={{ ...inp, resize:'vertical', marginBottom:10 }} />
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <label style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, border:'1px dashed rgba(255,255,255,0.15)', color:'rgba(255,255,255,0.5)', fontSize:12, cursor:'pointer' }}>
              🖼 Add Photo <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} />
            </label>
            <div style={{ flex:1 }} />
            <button onClick={() => setShowNew(false)} style={{ padding:'8px 16px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(255,255,255,0.5)', fontSize:13, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Cancel</button>
            <button onClick={handlePost} disabled={posting} style={{ padding:'8px 20px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#00E5CC,#7C3AED)', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>{posting?'Posting...':'Publish'}</button>
          </div>
        </div>
      )}
      {!news.length ? <div style={{ textAlign:'center', padding:60, color:'rgba(255,255,255,0.25)' }}><div style={{ fontSize:40, marginBottom:12 }}>📰</div><div style={{ fontSize:16, fontWeight:600 }}>No news yet</div></div> : (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {news.map(n => (
            <div key={n.id} style={{ background:'#13131f', borderRadius:16, border:'1px solid rgba(255,255,255,0.08)', overflow:'hidden' }}>
              {n.image_url && <img src={n.image_url} alt="" style={{ width:'100%', maxHeight:280, objectFit:'cover' }} />}
              <div style={{ padding:'18px 22px' }}>
                <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:18, color:'#fff', marginBottom:10 }}>{n.title}</div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,0.6)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>{n.content}</div>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:14, paddingTop:14, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                  {n.author_photo ? <img src={n.author_photo} alt="" style={{ width:28, height:28, borderRadius:8, objectFit:'cover' }} /> : <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#00E5CC,#7C3AED)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:'#fff' }}>{n.real_name?.[0]}</div>}
                  <span style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>By <b style={{ color:'rgba(255,255,255,0.7)' }}>{n.real_name}</b> · {new Date(n.created_at).toLocaleDateString()}</span>
                  {canPost && <button onClick={async()=>{ if(confirm('Delete?')){ await fetch(`/api/nft/news/${n.id}`,{method:'DELETE',headers}); load() }}} style={{ marginLeft:'auto', padding:'4px 12px', borderRadius:8, border:'1px solid rgba(239,68,68,0.25)', background:'rgba(239,68,68,0.08)', color:'#f87171', fontSize:11, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Delete</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
