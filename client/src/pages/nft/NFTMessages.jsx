import { useState, useEffect, useRef } from 'react'
import { useNFT } from './NFTApp'
const AC='#00E5CC'
export default function NFTMessages() {
  const { user, profile, headers } = useNFT()
  const [convs, setConvs] = useState([]); const [users, setUsers] = useState([])
  const [activeConv, setActiveConv] = useState(null); const [messages, setMessages] = useState([])
  const [text, setText] = useState(''); const [sending, setSending] = useState(false)
  const [showNew, setShowNew] = useState(false); const [newType, setNewType] = useState('dm'); const [selectedUsers, setSelectedUsers] = useState([]); const [groupName, setGroupName] = useState('')
  const msgRef = useRef(); const fileRef = useRef(); const pollRef = useRef()
  const loadConvs = () => fetch('/api/nft/messages/conversations', { headers }).then(r=>r.json()).then(d=>setConvs(Array.isArray(d)?d:[]))
  const loadMessages = (id) => fetch(`/api/nft/messages/${id}`, { headers }).then(r=>r.json()).then(d=>{ setMessages(Array.isArray(d)?d:[]); setTimeout(()=>msgRef.current?.scrollTo(0,99999),50) })
  const loadUsers = () => fetch('/api/nft/profiles', { headers }).then(r=>r.json()).then(d=>setUsers(Array.isArray(d)?d:[]))
  useEffect(() => { loadConvs(); loadUsers() }, [])
  useEffect(() => {
    if (!activeConv) return
    loadMessages(activeConv.id)
    pollRef.current = setInterval(() => loadMessages(activeConv.id), 3000)
    return () => clearInterval(pollRef.current)
  }, [activeConv])
  const sendMessage = async () => {
    if (!text.trim() && !fileRef.current?.files[0]) return
    setSending(true)
    const fd = new FormData()
    if (text.trim()) fd.append('content', text)
    if (fileRef.current?.files[0]) {
      const f=fileRef.current.files[0]
      if (f.size>5*1024*1024) { alert('Max 5MB per file'); setSending(false); return }
      fd.append('file', f)
    }
    await fetch(`/api/nft/messages/${activeConv.id}`, { method:'POST', headers, body:fd })
    setText(''); if (fileRef.current) fileRef.current.value=''; setSending(false); loadMessages(activeConv.id)
  }
  const createConv = async () => {
    if (!selectedUsers.length) return
    const r = await fetch('/api/nft/messages/conversations', { method:'POST', headers:{...headers,'Content-Type':'application/json'}, body:JSON.stringify({ type:newType, name:groupName||null, participants:selectedUsers.map(Number) }) })
    const d = await r.json(); await loadConvs(); setActiveConv(d); setShowNew(false); setSelectedUsers([]); setGroupName('')
  }
  const getConvName = (c) => {
    if (c.type==='group') return c.name||'Group Chat'
    const others = (c.profiles||[]).filter(p=>String(p.user_id)!==String(user?.id))
    return others[0]?.real_name || 'Chat'
  }
  const inp = { flex:1, padding:'10px 14px', borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.06)', color:'#fff', fontSize:13, fontFamily:'"Plus Jakarta Sans",sans-serif', outline:'none' }
  return (
    <div style={{ padding:28, maxWidth:1100, height:'calc(100vh - 56px)', display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexShrink:0 }}>
        <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:22, color:'#fff', margin:0 }}>💬 Messages</h1>
        <button onClick={() => setShowNew(!showNew)} style={{ padding:'8px 16px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#00E5CC,#7C3AED)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>+ New Chat</button>
      </div>
      {showNew && (
        <div style={{ background:'#13131f', borderRadius:14, border:'1px solid rgba(0,229,204,0.2)', padding:18, marginBottom:16, flexShrink:0 }}>
          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            {['dm','group'].map(t=><button key={t} onClick={()=>setNewType(t)} style={{ padding:'6px 16px', borderRadius:20, border:`1px solid ${newType===t?AC:'rgba(255,255,255,0.1)'}`, background:newType===t?`${AC}15`:'transparent', color:newType===t?AC:'rgba(255,255,255,0.5)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', textTransform:'capitalize' }}>{t==='dm'?'Direct Message':'Group Chat'}</button>)}
          </div>
          {newType==='group' && <input value={groupName} onChange={e=>setGroupName(e.target.value)} placeholder="Group name" style={{ ...inp, display:'block', marginBottom:10, width:'100%', flex:'unset' }} />}
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
            {users.filter(u=>String(u.user_id)!==String(user?.id)).map(u=>(
              <button key={u.user_id} onClick={()=>setSelectedUsers(prev=>prev.includes(u.user_id)?prev.filter(x=>x!==u.user_id):[...prev,u.user_id])}
                style={{ padding:'5px 12px', borderRadius:20, border:`1px solid ${selectedUsers.includes(u.user_id)?AC:'rgba(255,255,255,0.1)'}`, background:selectedUsers.includes(u.user_id)?`${AC}15`:'transparent', color:selectedUsers.includes(u.user_id)?AC:'rgba(255,255,255,0.5)', fontSize:12, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
                {u.real_name}
              </button>
            ))}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>setShowNew(false)} style={{ padding:'7px 16px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(255,255,255,0.5)', fontSize:12, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Cancel</button>
            <button onClick={createConv} style={{ padding:'7px 20px', borderRadius:8, border:'none', background:AC, color:'#060610', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Start Chat</button>
          </div>
        </div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'240px 1fr', gap:16, flex:1, overflow:'hidden' }}>
        {/* Conversation list */}
        <div style={{ background:'#13131f', borderRadius:14, border:'1px solid rgba(255,255,255,0.08)', overflowY:'auto', display:'flex', flexDirection:'column' }}>
          {!convs.length ? <div style={{ textAlign:'center', padding:32, color:'rgba(255,255,255,0.25)', fontSize:13 }}>No conversations yet</div> : convs.map(c=>(
            <div key={c.id} onClick={()=>setActiveConv(c)}
              style={{ padding:'12px 14px', cursor:'pointer', borderBottom:'1px solid rgba(255,255,255,0.05)', background:activeConv?.id===c.id?`${AC}10`:'transparent', borderLeft:activeConv?.id===c.id?`3px solid ${AC}`:'3px solid transparent', transition:'all 0.15s' }}>
              <div style={{ fontWeight:600, fontSize:13, color:'#fff', marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{getConvName(c)}</div>
              {c.last_message && <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.last_message}</div>}
            </div>
          ))}
        </div>
        {/* Message area */}
        <div style={{ background:'#13131f', borderRadius:14, border:'1px solid rgba(255,255,255,0.08)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
          {!activeConv ? (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,0.2)', fontSize:16, flexDirection:'column', gap:8 }}>
              <span style={{ fontSize:40 }}>💬</span>Select a conversation
            </div>
          ) : (
            <>
              <div style={{ padding:'14px 18px', borderBottom:'1px solid rgba(255,255,255,0.07)', fontWeight:700, fontSize:14, color:'#fff', flexShrink:0 }}>{getConvName(activeConv)}</div>
              <div ref={msgRef} style={{ flex:1, overflowY:'auto', padding:'16px 18px', display:'flex', flexDirection:'column', gap:10 }}>
                {messages.map(m=>{
                  const isMe=String(m.sender_id)===String(user?.id)
                  return (
                    <div key={m.id} style={{ display:'flex', flexDirection:isMe?'row-reverse':'row', gap:8, alignItems:'flex-end' }}>
                      {!isMe && (m.photo_url?<img src={m.photo_url} alt="" style={{ width:28, height:28, borderRadius:8, objectFit:'cover', flexShrink:0 }}/>:<div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#00E5CC,#7C3AED)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:'#fff', flexShrink:0 }}>{m.real_name?.[0]}</div>)}
                      <div style={{ maxWidth:'70%' }}>
                        {!isMe && <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', marginBottom:3 }}>{m.real_name}</div>}
                        <div style={{ background:isMe?`${AC}20`:'rgba(255,255,255,0.07)', borderRadius:isMe?'12px 12px 4px 12px':'12px 12px 12px 4px', padding:'8px 12px', border:`1px solid ${isMe?AC+'30':'rgba(255,255,255,0.08)'}` }}>
                          {m.content && <div style={{ fontSize:13, color:'#fff', lineHeight:1.5 }}>{m.content}</div>}
                          {m.file_url && <a href={m.file_url} target="_blank" rel="noopener" style={{ display:'flex', gap:6, alignItems:'center', fontSize:12, color:AC, textDecoration:'none', marginTop:m.content?6:0 }}>📎 {m.file_name}</a>}
                        </div>
                        <div style={{ fontSize:10, color:'rgba(255,255,255,0.25)', marginTop:3, textAlign:isMe?'right':'left' }}>{new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ padding:'12px 16px', borderTop:'1px solid rgba(255,255,255,0.07)', display:'flex', gap:8, flexShrink:0 }}>
                <label style={{ width:36, height:36, borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'rgba(255,255,255,0.4)', fontSize:16, flexShrink:0 }}>
                  📎 <input ref={fileRef} type="file" style={{ display:'none' }} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" />
                </label>
                <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage()}}} placeholder="Type a message..." style={inp} />
                <button onClick={sendMessage} disabled={sending} style={{ padding:'10px 18px', borderRadius:10, border:'none', background:AC, color:'#060610', fontWeight:700, fontSize:13, cursor:'pointer', flexShrink:0, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>{sending?'...':'Send'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
