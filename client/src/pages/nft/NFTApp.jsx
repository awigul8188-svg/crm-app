import { useState, useEffect, useContext, createContext } from 'react'
import NFTDashboard from './NFTDashboard'
import NFTProfile from './NFTProfile'
import NFTBioData from './NFTBioData'
import NFTKiosk from './NFTKiosk'
import NFTShop from './NFTShop'
import NFTMessages from './NFTMessages'
import NFTNews from './NFTNews'
import NFTCars from './NFTCars'
import NFTAdmin from './NFTAdmin'

const AC = '#00E5CC'  // main accent
const GRAD = 'linear-gradient(135deg, #00E5CC 0%, #7C3AED 100%)'
const DARK = '#0a0a14'

export const NFTContext = createContext({})
export const useNFT = () => useContext(NFTContext)

const NAV = [
  { key:'dashboard',  icon:'▣', label:'Dashboard'      },
  { key:'profile',    icon:'👤', label:'My Profile'     },
  { key:'biodata',    icon:'📁', label:'Bio Data'       },
  { key:'news',       icon:'📰', label:'NFT News'       },
  { key:'kiosk',      icon:'🍕', label:'Kiosk'          },
  { key:'shop',       icon:'🛍', label:'NFT Shop'       },
  { key:'cars',       icon:'🚗', label:'Cars'           },
  { key:'messages',   icon:'💬', label:'Messages'       },
]
const ADMIN_NAV = [
  { key:'admin',      icon:'⚙', label:'Admin Panel'    },
]

function NFTLayout({ page, setPage, children, user, profile }) {
  const canAdmin = user?.role === 'manager' || profile?.nft_role === 'hr' || profile?.nft_role === 'admin'

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', fontFamily:'"Plus Jakarta Sans",sans-serif', background:DARK }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Bricolage+Grotesque:wght@600;700;800&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}}
        * { box-sizing:border-box; }
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:99px}
      `}</style>

      {/* Sidebar */}
      <aside style={{ width:220, background:'#0e0e1a', borderRight:'1px solid rgba(255,255,255,0.07)', display:'flex', flexDirection:'column', flexShrink:0 }}>
        {/* Logo */}
        <div style={{ padding:'20px 16px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:GRAD, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:14, color:'#fff', flexShrink:0 }}>N</div>
            <div>
              <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:11, color:'#fff', lineHeight:1.1, letterSpacing:'0.06em' }}>NEBULA</div>
              <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:11, letterSpacing:'0.06em', background:GRAD, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', lineHeight:1.1 }}>FORGE</div>
            </div>
          </div>
          <div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.2)', textTransform:'uppercase', letterSpacing:'0.14em' }}>Employee Hub</div>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:'12px 10px', overflowY:'auto', display:'flex', flexDirection:'column', gap:2 }}>
          <div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.2)', textTransform:'uppercase', letterSpacing:'0.14em', padding:'0 8px 8px' }}>Menu</div>
          {NAV.map(item => (
            <button key={item.key} onClick={() => setPage(item.key)}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:10, border:'none', cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', fontSize:13, fontWeight:500, textAlign:'left', transition:'all 0.15s', width:'100%',
                background: page===item.key ? GRAD : 'transparent',
                color: page===item.key ? '#fff' : 'rgba(255,255,255,0.45)',
                boxShadow: page===item.key ? '0 4px 16px rgba(0,229,204,0.2)' : 'none',
              }}>
              <span style={{ fontSize:14, width:18, textAlign:'center', flexShrink:0 }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
          {canAdmin && <>
            <div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.2)', textTransform:'uppercase', letterSpacing:'0.14em', padding:'16px 8px 8px' }}>Admin</div>
            {ADMIN_NAV.map(item => (
              <button key={item.key} onClick={() => setPage(item.key)}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:10, border:'none', cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', fontSize:13, fontWeight:500, textAlign:'left', transition:'all 0.15s', width:'100%',
                  background: page===item.key ? GRAD : 'transparent',
                  color: page===item.key ? '#fff' : 'rgba(255,255,255,0.45)',
                }}>
                <span style={{ fontSize:14, width:18, textAlign:'center', flexShrink:0 }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </>}
        </nav>

        {/* User card */}
        <div style={{ padding:'10px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'rgba(255,255,255,0.04)', borderRadius:12, border:'1px solid rgba(255,255,255,0.07)', marginBottom:6 }}>
            {profile?.photo_url
              ? <img src={profile.photo_url} alt="" style={{ width:32, height:32, borderRadius:8, objectFit:'cover', flexShrink:0 }} />
              : <div style={{ width:32, height:32, borderRadius:8, background:GRAD, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:13, color:'#fff', flexShrink:0 }}>{(profile?.real_name||user?.name||'?')[0].toUpperCase()}</div>}
            <div style={{ minWidth:0, flex:1 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{profile?.real_name || user?.name}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.38)', marginTop:1 }}>{profile?.job_title || 'Employee'}</div>
            </div>
          </div>
          <button onClick={() => window.close()} style={{ width:'100%', padding:'7px 0', borderRadius:10, border:'none', background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.4)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
            ✕ Close Portal
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex:1, overflowY:'auto', background:DARK, position:'relative' }}>
        <div style={{ position:'absolute', top:0, right:0, width:'40%', height:'30%', background:'radial-gradient(ellipse at top right, rgba(124,58,237,0.06) 0%, transparent 70%)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:0, left:'30%', width:'40%', height:'20%', background:'radial-gradient(ellipse at top, rgba(0,229,204,0.04) 0%, transparent 70%)', pointerEvents:'none' }} />
        <div style={{ position:'relative', zIndex:1, minHeight:'100%' }}>{children}</div>
      </main>
    </div>
  )
}

export default function NFTApp() {
  const [page, setPage] = useState('dashboard')
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const token = localStorage.getItem('crm_token')
  const headers = { Authorization:`Bearer ${token}` }

  useEffect(() => {
    if (!token) { window.location.href = '/'; return; }
    // Decode user from token
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      setUser(payload)
    } catch {}
    // Load NFT profile
    fetch('/api/nft/profiles/me', { headers }).then(r => r.json()).then(p => { setProfile(p); setLoading(false) }).catch(() => setLoading(false))
    // Handle hash navigation
    const handleHash = () => {
      const hash = window.location.hash.replace('#nft/', '').replace('#nft', '')
      if (hash && hash !== '') setPage(hash)
    }
    handleHash()
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [])

  const navigateTo = (p) => {
    setPage(p)
    window.location.hash = `#nft/${p}`
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:DARK }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:40, height:40, borderRadius:'50%', border:'3px solid rgba(0,229,204,0.3)', borderTopColor:'#00E5CC', animation:'spin 0.8s linear infinite', margin:'0 auto 16px' }} />
        <div style={{ color:'rgba(255,255,255,0.4)', fontSize:13, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Loading Employee Hub...</div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  const ctx = { user, profile, setProfile, headers, token, navigateTo }

  return (
    <NFTContext.Provider value={ctx}>
      <NFTLayout page={page} setPage={navigateTo} user={user} profile={profile}>
        {page === 'dashboard' && <NFTDashboard />}
        {page === 'profile'   && <NFTProfile userId={user?.id} />}
        {page === 'biodata'   && <NFTBioData />}
        {page === 'news'      && <NFTNews />}
        {page === 'kiosk'     && <NFTKiosk />}
        {page === 'shop'      && <NFTShop />}
        {page === 'cars'      && <NFTCars />}
        {page === 'messages'  && <NFTMessages />}
        {page === 'admin'     && <NFTAdmin />}
      </NFTLayout>
    </NFTContext.Provider>
  )
}
