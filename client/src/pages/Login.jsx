import { useState } from 'react'
import { useAuth } from '../App'



// LEFT PANEL always dark regardless of app theme
const LP = {
  heading:  '#ffffff',
  subtext:  'rgba(255,255,255,0.55)',
  muted:    'rgba(255,255,255,0.35)',
  brand:    '#00D4C8',
}

export default function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true)
    try { await login(username, password) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>

      {/* ── Left brand panel — ALWAYS dark ─────────────── */}
      <div style={{
        width:'48%', minWidth:380, display:'flex', flexDirection:'column',
        justifyContent:'space-between', padding:'48px', position:'relative',
        overflow:'hidden', background:'#0b0b12',
        flexShrink: 0,
      }}>
        {/* Glows */}
        <div style={{ position:'absolute', bottom:-120, left:-80, width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle, #00D4C8 0%, transparent 70%)', opacity:0.08, pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:-80, right:-60, width:280, height:280, borderRadius:'50%', background:'radial-gradient(circle, #00D4C8 0%, transparent 70%)', opacity:0.05, pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:'30%', right:'20%', width:160, height:160, borderRadius:'50%', background:'radial-gradient(circle, #3b82f6 0%, transparent 70%)', opacity:0.04, pointerEvents:'none' }} />

        {/* Logo */}
        <div style={{ position:'relative', display:'flex', alignItems:'center', gap:16 }}>
          <img src="/logo-white.png" alt="Tech Atlantix" style={{ height:52, width:'auto', objectFit:'contain' }} />
          <div>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, color:'#ffffff', fontSize:22, lineHeight:1, letterSpacing:'0.04em' }}>TECH</div>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, color:LP.brand, fontSize:22, lineHeight:1, letterSpacing:'0.04em' }}>ATLANTIX</div>
          </div>
        </div>

        {/* Main copy */}
        <div style={{ position:'relative' }}>
          {/* Badge */}
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, borderRadius:999, padding:'6px 14px', marginBottom:24, fontSize:12, fontWeight:700, background:'rgba(0,212,200,0.12)', color:LP.brand, border:'1px solid rgba(0,212,200,0.22)' }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:LP.brand, animation:'pulse 2s infinite' }} />
            Internal Sales Portal
          </div>

          <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontSize:52, fontWeight:900, color:'#ffffff', lineHeight:1.05, marginBottom:20, letterSpacing:'-0.02em' }}>
            Track every<br />deal. Close<br />faster.
          </h1>
          <p style={{ fontSize:14, lineHeight:1.7, color:LP.subtext, maxWidth:340 }}>
            Leads, repeat inquiries, and online orders — all in one place. Real-time analytics for the whole team.
          </p>

          {/* Feature icons */}
          <div style={{ marginTop:40, display:'flex', gap:32 }}>
            {[['◎','Leads'],['↻','Repeat'],['◈','Orders'],['▣','Analytics']].map(([icon,label]) => (
              <div key={label} style={{ textAlign:'center' }}>
                <div style={{ fontSize:20, marginBottom:6, color:LP.subtext }}>{icon}</div>
                <div style={{ fontSize:12, fontWeight:600, color:LP.muted }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position:'relative', fontSize:11, color:LP.muted }}>
          Beyond Tech · Above Integration
        </div>

        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
      </div>

      {/* ── Right sign-in panel — adapts to theme ──────── */}
      <div style={{
        flex:1, display:'flex', alignItems:'center', justifyContent:'center',
        padding:40, background:'var(--bg)', overflowY:'auto',
      }}>
        <div style={{ width:'100%', maxWidth:360 }}>
          {/* Header */}
          <div style={{ marginBottom:36 }}>
            <h2 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:28, color:'var(--text)', margin:'0 0 6px' }}>Sign in</h2>
            <p style={{ fontSize:14, color:'var(--text-3)', margin:0 }}>Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:18 }}>
            {/* Username */}
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>Username</label>
              <input
                value={username} onChange={e => setUsername(e.target.value)}
                placeholder="your username" autoFocus required
                style={{
                  width:'100%', boxSizing:'border-box',
                  padding:'12px 16px', borderRadius:14,
                  border:'1.5px solid var(--input-border)',
                  background:'var(--input-bg)', color:'var(--text)',
                  fontSize:14, fontFamily:'"Plus Jakarta Sans",sans-serif', outline:'none',
                  transition:'border-color 0.15s, box-shadow 0.15s',
                }}
                onFocus={e => { e.target.style.borderColor='#00D4C8'; e.target.style.boxShadow='0 0 0 4px rgba(0,212,200,0.12)' }}
                onBlur={e => { e.target.style.borderColor='var(--input-border)'; e.target.style.boxShadow='none' }}
              />
            </div>

            {/* Password */}
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>Password</label>
              <div style={{ position:'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  style={{
                    width:'100%', boxSizing:'border-box',
                    padding:'12px 52px 12px 16px', borderRadius:14,
                    border:'1.5px solid var(--input-border)',
                    background:'var(--input-bg)', color:'var(--text)',
                    fontSize:14, fontFamily:'"Plus Jakarta Sans",sans-serif', outline:'none',
                    transition:'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onFocus={e => { e.target.style.borderColor='#00D4C8'; e.target.style.boxShadow='0 0 0 4px rgba(0,212,200,0.12)' }}
                  onBlur={e => { e.target.style.borderColor='var(--input-border)'; e.target.style.boxShadow='none' }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:12, fontWeight:700, color:'var(--text-3)', fontFamily:'"Plus Jakarta Sans",sans-serif', padding:0 }}>
                  {showPass ? 'hide' : 'show'}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--danger)', border:'1px solid var(--danger-border)', color:'var(--danger-text)', fontSize:13, padding:'10px 14px', borderRadius:12 }}>
                ⚠ {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading}
              style={{
                width:'100%', padding:'14px', borderRadius:14, border:'none',
                background:'linear-gradient(135deg, #00D4C8 0%, #0099cc 100%)',
                color:'#060610', fontWeight:800, fontSize:15,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily:'"Plus Jakarta Sans",sans-serif',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                boxShadow:'0 4px 24px rgba(0,212,200,0.3)',
                transition:'all 0.15s',
                opacity: loading ? 0.8 : 1,
                marginTop:4,
              }}
              onMouseEnter={e => { if(!loading){ e.currentTarget.style.boxShadow='0 6px 32px rgba(0,212,200,0.45)'; e.currentTarget.style.filter='brightness(1.06)' }}}
              onMouseLeave={e => { e.currentTarget.style.boxShadow='0 4px 24px rgba(0,212,200,0.3)'; e.currentTarget.style.filter='none' }}
            >
              {loading
                ? <><div style={{ width:16, height:16, borderRadius:'50%', border:'2px solid #060610', borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} /> Signing in...</>
                : <>Sign in <span style={{ opacity:0.6 }}>→</span></>}
            </button>
          </form>
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
