import { useState, useEffect, createContext, useContext } from 'react'
import NFTLogin from './NFTLogin'
import NFTDashboard from './NFTDashboard'
import NFTProfile from './NFTProfile'
import NFTBioData from './NFTBioData'
import NFTKiosk from './NFTKiosk'
import NFTShop from './NFTShop'
import NFTMessages from './NFTMessages'
import NFTNews from './NFTNews'
import NFTCars from './NFTCars'
import NFTAdmin from './NFTAdmin'

// Brand colors
export const C = {
  teal:    '#6ce5c6',
  tealDark:'#3db99a',
  black:   '#020202',
  dark:    '#1f1f1f',
  pink:    '#ec6daa',
  lavender:'#9999e9',
  gray:    '#6a646a',
  bg:      '#f6f7f9',
  card:    '#ffffff',
  border:  '#e8e8ec',
  border2: '#d0d0d8',
}

export const NFTCtx = createContext({})
export const useNFT = () => useContext(NFTCtx)

const NAV = [
  { key:'dashboard', icon:'▣', label:'Dashboard'    },
  { key:'profile',   icon:'👤', label:'My Profile'  },
  { key:'biodata',   icon:'📁', label:'Bio Data'    },
  { key:'news',      icon:'📰', label:'NFT News'    },
  { key:'kiosk',     icon:'🍕', label:'Kiosk'       },
  { key:'shop',      icon:'🛍', label:'Shop'        },
  { key:'cars',      icon:'🚗', label:'Cars'        },
  { key:'messages',  icon:'💬', label:'Messages'    },
]

function NFTSidebar({ page, setPage, user, onLogout }) {
  const canAdmin = ['manager','admin','hr','finance'].includes(user?.role)
  return (
    <aside style={{ width:220, flexShrink:0, background:C.card, borderRight:`1px solid ${C.border}`, display:'flex', flexDirection:'column', boxShadow:'2px 0 8px rgba(0,0,0,0.06)' }}>
      {/* Logo */}
      <div style={{ padding:'20px 18px 16px', borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:C.teal, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:15, color:C.black, flexShrink:0 }}>N</div>
          <div>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:900, fontSize:13, color:C.black, lineHeight:1.1, letterSpacing:'0.04em' }}>NEBULA</div>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:900, fontSize:13, color:C.pink, lineHeight:1.1, letterSpacing:'0.04em' }}>FORGE</div>
          </div>
        </div>
        <div style={{ fontSize:9, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.12em' }}>Employee Hub</div>
      </div>

      {/* Nav */}
      <nav style={{ flex:1, padding:'12px 10px', display:'flex', flexDirection:'column', gap:2, overflowY:'auto' }}>
        <div style={{ fontSize:9, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.12em', padding:'0 8px 8px' }}>Menu</div>
        {NAV.map(item => {
          const active = page === item.key
          return (
            <button key={item.key} onClick={() => setPage(item.key)} style={{
              display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:10,
              border:'none', cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif',
              fontSize:13, fontWeight:active?700:500, textAlign:'left', width:'100%', transition:'all 0.15s',
              background: active ? C.teal : 'transparent',
              color: active ? C.black : C.dark,
            }}
            onMouseEnter={e => { if(!active) e.currentTarget.style.background=`${C.teal}20` }}
            onMouseLeave={e => { if(!active) e.currentTarget.style.background='transparent' }}>
              <span style={{ fontSize:14, width:18, textAlign:'center', flexShrink:0 }}>{item.icon}</span>
              {item.label}
            </button>
          )
        })}
        {canAdmin && <>
          <div style={{ fontSize:9, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.12em', padding:'14px 8px 8px' }}>Admin</div>
          <button onClick={() => setPage('admin')} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:10, border:'none', cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', fontSize:13, fontWeight:page==='admin'?700:500, textAlign:'left', width:'100%', transition:'all 0.15s', background:page==='admin'?C.teal:'transparent', color:page==='admin'?C.black:C.dark }}
            onMouseEnter={e => { if(page!=='admin') e.currentTarget.style.background=`${C.teal}20` }}
            onMouseLeave={e => { if(page!=='admin') e.currentTarget.style.background='transparent' }}>
            <span style={{ fontSize:14, width:18, textAlign:'center' }}>⚙</span> Admin Panel
          </button>
        </>}
      </nav>

      {/* User card */}
      <div style={{ padding:'10px', borderTop:`1px solid ${C.border}` }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:C.bg, borderRadius:12, border:`1px solid ${C.border}`, marginBottom:6 }}>
          {user?.photo_url
            ? <img src={user.photo_url} style={{ width:32, height:32, borderRadius:8, objectFit:'cover', flexShrink:0 }} />
            : <div style={{ width:32, height:32, borderRadius:8, background:C.teal, color:C.black, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:13, flexShrink:0 }}>{(user?.real_name||'?')[0].toUpperCase()}</div>}
          <div style={{ minWidth:0, flex:1 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.dark, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.real_name}</div>
            <div style={{ fontSize:10, color:C.gray, marginTop:1, textTransform:'capitalize' }}>{user?.role}</div>
          </div>
        </div>
        <button onClick={onLogout} style={{ width:'100%', padding:'7px 0', borderRadius:10, border:`1px solid ${C.border}`, background:'transparent', color:C.gray, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', transition:'all 0.15s' }}
          onMouseEnter={e=>e.currentTarget.style.background=C.bg} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
          Sign Out
        </button>
      </div>
    </aside>
  )
}

export default function NFTApp() {
  const [token, setToken] = useState(() => localStorage.getItem('nft_token'))
  const [user, setUser] = useState(null)
  const [page, setPage] = useState('dashboard')
  const [loading, setLoading] = useState(!!localStorage.getItem('nft_token'))

  const headers = token ? { Authorization:`Bearer ${token}` } : {}

  useEffect(() => {
    if (!token) { setLoading(false); return }
    fetch('/api/nft/auth/me', { headers }).then(r => {
      if (!r.ok) { localStorage.removeItem('nft_token'); setToken(null); setLoading(false); return }
      return r.json()
    }).then(u => { if(u) setUser(u); setLoading(false) }).catch(() => { localStorage.removeItem('nft_token'); setToken(null); setLoading(false) })
  }, [token])

  const handleLogin = (t, u) => { localStorage.setItem('nft_token', t); setToken(t); setUser(u) }
  const handleLogout = () => { localStorage.removeItem('nft_token'); setToken(null); setUser(null) }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:C.bg, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:36, height:36, borderRadius:'50%', border:`3px solid ${C.teal}`, borderTopColor:'transparent', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }} />
        <div style={{ color:C.gray, fontSize:13 }}>Loading...</div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  if (!token || !user) return <NFTLogin onLogin={handleLogin} />

  const ctx = { user, setUser, token, headers, page, setPage }

  return (
    <NFTCtx.Provider value={ctx}>
      <div style={{ display:'flex', height:'100vh', overflow:'hidden', fontFamily:'"Plus Jakarta Sans",sans-serif', background:C.bg }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box} ::-webkit-scrollbar{width:4px;height:4px} ::-webkit-scrollbar-thumb{background:#d0d0d8;border-radius:99px}`}</style>
        <NFTSidebar page={page} setPage={setPage} user={user} onLogout={handleLogout} />
        <main style={{ flex:1, overflowY:'auto', background:C.bg }}>
          {page==='dashboard' && <NFTDashboard />}
          {page==='profile'   && <NFTProfile />}
          {page==='biodata'   && <NFTBioData />}
          {page==='news'      && <NFTNews />}
          {page==='kiosk'     && <NFTKiosk />}
          {page==='shop'      && <NFTShop />}
          {page==='cars'      && <NFTCars />}
          {page==='messages'  && <NFTMessages />}
          {page==='admin'     && <NFTAdmin />}
        </main>
      </div>
    </NFTCtx.Provider>
  )
}
