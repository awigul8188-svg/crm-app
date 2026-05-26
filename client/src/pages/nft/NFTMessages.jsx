import { useState, useEffect, useRef } from 'react'
import { useNFT, C } from './NFTContext'
const inp = { flex:1, padding:'10px 14px', borderRadius:12, border:`1.5px solid ${C.border}`, background:'#fff', color:C.dark, fontSize:13, fontFamily:'"Plus Jakarta Sans",sans-serif', outline:'none', transition:'border-color 0.15s' }
export default function NFTMessages() {
  const { user, headers } = useNFT()
  const [convs, setConvs] = useState([]); const [users, setUsers] = useState([])
  const [active, setActive] = useState(null); const [messages, setMessages] = useState([])
  const [text, setText] = useState(''); const [sending, setSending] = useState(false)
  const [showNew, setShowNew] = useState(false); const [newType, setNewType] = useState('dm')
  const [selUsers, setSelUsers] = useState([]); const [groupName, setGroupName] = useState('')
  const msgRef = useRef(); const fileRef = useRef(); const pollRef = useRef()
  const loadConvs = () => fetch('/api/nft/messages/conversations',{headers}).then(r=>r.json()).then(d=>setConvs(Array.isArray(d)?d:[]))
  const loadMsgs = (id) => fetch(`/api/nft/messages/${id}`,{headers}).then(r=>r.json()).then(d=>{ setMessages(Array.isArray(d)?d:[]); setTimeout(()=>msgRef.current?.scrollTo(0,99999),50) })
  const loadUsers = () => fetch('/api/nft/users',{headers}).then(r=>r.json()).then(d=>setUsers(Array.isArray(d)?d:[]))
  useEffect(()=>{ loadConvs(); loadUsers() },[])
  useEffect(()=>{
    if (!active) return; loadMsgs(active.id)
    pollRef.current = setInterval(()=>loadMsgs(active.id), 3000)
    return ()=>clearInterval(pollRef.current)
  },[active])
  const send = async () => {
    if (!text.trim() && !fileRef.current?.files[0]) return
    setSending(true)
    const fd = new FormData()
    if (text.trim()) fd.append('content', text)
    if (fileRef.current?.files[0]) {
      const f=fileRef.current.files[0]
      if (f.size>5*1024*1024) { alert('Max 5MB per file'); setSending(false); return }
      fd.append('file', f)
    }
    await fetch(`/api/nft/messages/${active.id}`,{method:'POST',headers,body:fd})
    setText(''); if(fileRef.current)fileRef.current.value=''; setSending(false); loadMsgs(active.id)
  }
  const createConv = async () => {
    if (!selUsers.length) return
    const r = await fetch('/api/nft/messages/conversations',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({type:newType,name:groupName||null,participants:selUsers.map(Number)})})
    const d = await r.json(); await loadConvs(); setActive(d); setShowNew(false); setSelUsers([]); setGroupName('')
  }
  const convName = (c) => {
    if (c.type==='group') return c.name||'Group Chat'
    const others = (c.profiles||[]).filter(p=>String(p.user_id)!==String(user?.id))
    return others[0]?.real_name||'Chat'
  }
  const convAvatar = (c) => {
    if (c.type==='group') return <div style={{ width:36,height:36,borderRadius:10,background:C.lavender,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0 }}>👥</div>
    const other = (c.profiles||[]).find(p=>String(p.user_id)!==String(user?.id))
    return other?.photo_url ? <img src={other.photo_url} style={{ width:36,height:36,borderRadius:10,objectFit:'cover' }}/> : <div style={{ width:36,height:36,borderRadius:10,background:C.teal,color:C.black,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:14 }}>{(other?.real_name||'?')[0]}</div>
  }
  return (
    <div style={{ padding:28, maxWidth:1100, height:'calc(100vh - 56px)', display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexShrink:0 }}>
        <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:900, fontSize:22, color:C.black, margin:0 }}>💬 Messages</h1>
        <button onClick={()=>setShowNew(!showNew)} style={{ padding:'8px 16px', borderRadius:10, border:'none', background:C.teal, color:C.black, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>+ New Chat</button>
      </div>
      {showNew && (
        <div style={{ background:C.card, borderRadius:14, border:`1px solid ${C.border}`, padding:18, marginBottom:16, flexShrink:0, boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            {['dm','group'].map(t=><button key={t} onClick={()=>setNewType(t)} style={{ padding:'6px 16px', borderRadius:20, border:`1.5px solid ${newType===t?C.teal:C.border}`, background:newType===t?C.teal:'#fff', color:newType===t?C.black:C.gray, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>{t==='dm'?'Direct Message':'Group Chat'}</button>)}
          </div>
          {newType==='group' && <input value={groupName} onChange={e=>setGroupName(e.target.value)} placeholder="Group name" style={{ ...inp, display:'block', marginBottom:10, width:'100%', flex:'unset', boxSizing:'border-box' }} />}
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
            {users.filter(u=>u.id!==user?.id).map(u=>(
              <button key={u.id} onClick={()=>setSelUsers(prev=>prev.includes(u.id)?prev.filter(x=>x!==u.id):[...prev,u.id])}
                style={{ padding:'5px 14px', borderRadius:20, border:`1.5px solid ${selUsers.includes(u.id)?C.teal:C.border}`, background:selUsers.includes(u.id)?C.teal:'#fff', color:selUsers.includes(u.id)?C.black:C.gray, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
                {u.real_name}
              </button>
            ))}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>setShowNew(false)} style={{ padding:'7px 16px', borderRadius:8, border:`1px solid ${C.border}`, background:'#fff', color:C.gray, fontSize:12, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Cancel</button>
            <button onClick={createConv} style={{ padding:'7px 20px', borderRadius:8, border:'none', background:C.teal, color:C.black, fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Start Chat</button>
          </div>
        </div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'240px 1fr', gap:16, flex:1, overflow:'hidden' }}>
        {/* Conversation list */}
        <div style={{ background:C.card, borderRadius:14, border:`1px solid ${C.border}`, overflowY:'auto', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
          {!convs.length ? <div style={{ textAlign:'center', padding:32, color:C.gray, fontSize:13 }}>No conversations yet</div> : convs.map(c=>(
            <div key={c.id} onClick={()=>setActive(c)} style={{ padding:'12px 14px', cursor:'pointer', borderBottom:`1px solid ${C.border}`, background:active?.id===c.id?`${C.teal}12`:'transparent', borderLeft:`3px solid ${active?.id===c.id?C.teal:'transparent'}`, transition:'all 0.15s', display:'flex', alignItems:'center', gap:10 }}>
              {convAvatar(c)}
              <div style={{ minWidth:0, flex:1 }}>
                <div style={{ fontWeight:600, fontSize:13, color:C.dark, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{convName(c)}</div>
                {c.last_message && <div style={{ fontSize:11, color:C.gray, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:2 }}>{c.last_message}</div>}
              </div>
            </div>
          ))}
        </div>
        {/* Message area */}
        <div style={{ background:C.card, borderRadius:14, border:`1px solid ${C.border}`, display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
          {!active ? (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:C.gray, flexDirection:'column', gap:8 }}>
              <span style={{ fontSize:40, opacity:0.3 }}>💬</span>
              <span style={{ fontSize:14 }}>Select a conversation</span>
            </div>
          ) : (
            <>
              <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, fontWeight:700, fontSize:14, color:C.dark, flexShrink:0 }}>{convName(active)}</div>
              <div ref={msgRef} style={{ flex:1, overflowY:'auto', padding:'16px 18px', display:'flex', flexDirection:'column', gap:10 }}>
                {messages.map(m=>{
                  const isMe = String(m.sender_id)===String(user?.id)
                  return (
                    <div key={m.id} style={{ display:'flex', flexDirection:isMe?'row-reverse':'row', gap:8, alignItems:'flex-end' }}>
                      {!isMe && (m.photo_url ? <img src={m.photo_url} style={{ width:28,height:28,borderRadius:8,objectFit:'cover',flexShrink:0 }}/> : <div style={{ width:28,height:28,borderRadius:8,background:C.teal,color:C.black,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,flexShrink:0 }}>{m.real_name?.[0]}</div>)}
                      <div style={{ maxWidth:'70%' }}>
                        {!isMe && <div style={{ fontSize:10, color:C.gray, marginBottom:3 }}>{m.real_name}</div>}
                        <div style={{ background:isMe?C.teal:C.bg, borderRadius:isMe?'12px 12px 4px 12px':'12px 12px 12px 4px', padding:'9px 13px', border:`1px solid ${isMe?C.teal:C.border}` }}>
                          {m.content && <div style={{ fontSize:13, color:isMe?C.black:C.dark, lineHeight:1.5 }}>{m.content}</div>}
                          {m.file_url && <a href={m.file_url} target="_blank" rel="noopener" style={{ display:'flex', gap:6, alignItems:'center', fontSize:12, color:isMe?C.black:C.tealDark, textDecoration:'none', marginTop:m.content?6:0, fontWeight:600 }}>📎 {m.file_name}</a>}
                        </div>
                        <div style={{ fontSize:10, color:C.gray, marginTop:3, textAlign:isMe?'right':'left' }}>{new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ padding:'12px 16px', borderTop:`1px solid ${C.border}`, display:'flex', gap:8, flexShrink:0 }}>
                <label style={{ width:36, height:36, borderRadius:10, border:`1px solid ${C.border}`, background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:C.gray, fontSize:16, flexShrink:0 }}>
                  📎 <input ref={fileRef} type="file" style={{ display:'none' }} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" />
                </label>
                <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()} }} placeholder="Type a message..." style={inp} onFocus={e=>e.target.style.borderColor=C.teal} onBlur={e=>e.target.style.borderColor=C.border} />
                <button onClick={send} disabled={sending} style={{ padding:'10px 18px', borderRadius:10, border:'none', background:C.teal, color:C.black, fontWeight:700, fontSize:13, cursor:'pointer', flexShrink:0, fontFamily:'"Plus Jakarta Sans",sans-serif', boxShadow:`0 2px 8px ${C.teal}40` }}>{sending?'...':'Send'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
