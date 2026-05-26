import { useState } from 'react'
import { C } from './NFTApp'

export default function NFTLogin({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const r = await fetch('/api/nft/auth/login', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ username, password })
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      onLogin(d.token, d.user)
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', fontFamily:'"Plus Jakarta Sans",sans-serif', background:C.bg }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}} *{box-sizing:border-box}`}</style>

      {/* Left brand panel */}
      <div style={{ width:'48%', minWidth:360, display:'flex', flexDirection:'column', justifyContent:'space-between', padding:'48px', background:`linear-gradient(160deg, ${C.teal} 0%, #4dd4b4 40%, ${C.lavender} 100%)`, position:'relative', overflow:'hidden' }}>
        {/* Decorative circles */}
        <div style={{ position:'absolute', top:-80, right:-60, width:260, height:260, borderRadius:'50%', background:'rgba(255,255,255,0.12)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-60, left:-40, width:200, height:200, borderRadius:'50%', background:'rgba(255,255,255,0.08)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:'35%', right:'15%', width:120, height:120, borderRadius:'50%', background:`rgba(${C.pink},0.15)`, pointerEvents:'none' }} />

        {/* Logo */}
        <div style={{ position:'relative', display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:44, height:44, borderRadius:12, background:'rgba(255,255,255,0.25)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:20, color:'#fff', border:'1px solid rgba(255,255,255,0.3)' }}>N</div>
          <div>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:900, fontSize:20, color:'#fff', lineHeight:1.1, letterSpacing:'0.04em' }}>NEBULA</div>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:900, fontSize:20, color:'rgba(255,255,255,0.75)', lineHeight:1.1, letterSpacing:'0.04em' }}>FORGE TECHNOLOGIES</div>
          </div>
        </div>

        {/* Main copy */}
        <div style={{ position:'relative' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, borderRadius:999, padding:'6px 14px', marginBottom:24, fontSize:12, fontWeight:700, background:'rgba(255,255,255,0.2)', color:'#fff', backdropFilter:'blur(8px)' }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'#fff' }} />
            Internal Employee Portal
          </div>
          <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontSize:46, fontWeight:900, color:'#fff', lineHeight:1.08, marginBottom:18, letterSpacing:'-0.02em' }}>
            Your hub for<br />growth, rewards<br />& connection.
          </h1>
          <p style={{ fontSize:14, lineHeight:1.7, color:'rgba(255,255,255,0.8)', maxWidth:340 }}>
            Access your salary, targets, kiosk, shop, news and team communication — all in one place.
          </p>
          <div style={{ marginTop:36, display:'flex', gap:28 }}>
            {[['🎯','Targets'],['🍕','Kiosk'],['🛍','Shop'],['💬','Chat']].map(([icon,label]) => (
              <div key={label} style={{ textAlign:'center' }}>
                <div style={{ fontSize:20, marginBottom:4 }}>{icon}</div>
                <div style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.7)' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position:'relative', fontSize:11, color:'rgba(255,255,255,0.6)' }}>NebulaForge Technologies · Employee Hub</div>
      </div>

      {/* Right login panel */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:40 }}>
        <div style={{ width:'100%', maxWidth:360, animation:'fadeUp 0.3s ease-out' }}>
          <div style={{ marginBottom:36 }}>
            <h2 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:900, fontSize:28, color:C.black, margin:'0 0 6px' }}>Sign in</h2>
            <p style={{ fontSize:14, color:C.gray, margin:0 }}>Enter your NFT credentials to continue</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:18 }}>
            {[['Username','text',username,setUsername,'your username'],['Password','password',password,setPassword,'••••••••']].map(([label,type,val,setter,ph],i) => (
              <div key={label}>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>{label}</label>
                <div style={{ position:'relative' }}>
                  <input
                    type={label==='Password'&&showPass?'text':type}
                    value={val} onChange={e=>setter(e.target.value)}
                    placeholder={ph} required autoFocus={i===0}
                    style={{ width:'100%', padding:`12px ${label==='Password'?'44px':14}px 12px 14px`, borderRadius:12, border:`1.5px solid ${C.border}`, background:'#fff', color:C.dark, fontSize:14, fontFamily:'"Plus Jakarta Sans",sans-serif', outline:'none', transition:'all 0.15s', boxSizing:'border-box' }}
                    onFocus={e => { e.target.style.borderColor=C.teal; e.target.style.boxShadow=`0 0 0 3px ${C.teal}25` }}
                    onBlur={e => { e.target.style.borderColor=C.border; e.target.style.boxShadow='none' }}
                  />
                  {label==='Password' && (
                    <button type="button" onClick={()=>setShowPass(!showPass)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:12, fontWeight:700, color:C.gray, fontFamily:'"Plus Jakarta Sans",sans-serif', padding:0 }}>
                      {showPass?'hide':'show'}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {error && (
              <div style={{ display:'flex', alignItems:'center', gap:8, background:'#fff0f5', border:`1px solid ${C.pink}40`, color:C.pink, fontSize:13, padding:'10px 14px', borderRadius:12 }}>
                ⚠ {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width:'100%', padding:'14px', borderRadius:12, border:'none',
              background:loading?C.border:C.teal, color:C.black,
              fontWeight:800, fontSize:15, cursor:loading?'not-allowed':'pointer',
              fontFamily:'"Plus Jakarta Sans",sans-serif', marginTop:4,
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              boxShadow:`0 4px 20px ${C.teal}50`, transition:'all 0.15s',
            }}
            onMouseEnter={e => { if(!loading) { e.currentTarget.style.background=C.tealDark; e.currentTarget.style.boxShadow=`0 6px 28px ${C.teal}60` }}}
            onMouseLeave={e => { if(!loading) { e.currentTarget.style.background=C.teal; e.currentTarget.style.boxShadow=`0 4px 20px ${C.teal}50` }}}>
              {loading
                ? <><div style={{ width:16, height:16, borderRadius:'50%', border:'2px solid rgba(0,0,0,0.3)', borderTopColor:C.black, animation:'spin 0.8s linear infinite' }} /> Signing in...</>
                : <>Sign in →</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
