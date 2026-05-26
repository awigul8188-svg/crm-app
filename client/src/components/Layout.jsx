import { useState, useEffect } from 'react'
import { useAuth } from '../App'
import { useNav } from '../App'
import { ThemeContext } from '../App'
import { useContext } from 'react'
import { api } from '../api'
import GlobalSearch from './GlobalSearch'



const SALES_NAV = [
  { name: 'dashboard', label: 'Dashboard',    icon: '▣' },
  { name: 'leads',     label: 'Leads',         icon: '◎' },
  { name: 'repeat',    label: 'Repeat',         icon: '↻' },
  { name: 'orders',    label: 'Orders',         icon: '◈' },
  { name: 'customers', label: 'Customers',      icon: '◉' },
]
const PURCHASER_NAV = [
  { name: 'purchasing', label: 'My Parts', icon: '🔩' },
]

const ROLE_LABELS = {
  manager: 'Manager',
  ae: 'Account Executive',
  purchasing_manager: 'Purchasing Manager',
  purchaser: 'Purchaser',
}

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const { page, navigate } = useNav()
  const { theme, toggle } = useContext(ThemeContext)
  const [showSearch, setShowSearch] = useState(false)
  const [notifCount, setNotifCount] = useState(0)
  const [avatarUrl, setAvatarUrl] = useState(null)

  const loadNotifs = () => api.getNotifications().then(n => setNotifCount(n.total)).catch(() => {})

  useEffect(() => {
    const handleKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowSearch(true) }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  useEffect(() => {
    loadNotifs()
    api.getUsers().then(users => {
      const me = users.find(u => u.id === user.id)
      if (me?.avatar_url) setAvatarUrl(me.avatar_url)
    }).catch(() => {})
    const interval = setInterval(loadNotifs, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (page.name !== 'notifications') loadNotifs()
  }, [page.name])

  const NavItem = ({ item }) => {
    const active = page.name === item.name
    return (
      <button onClick={() => navigate(item.name)}
        className={`nav-item ${active ? 'nav-active' : 'nav-inactive'}`}>
        <span style={{ fontSize: 14, width: 20, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
        <span style={{ flex: 1 }}>{item.label}</span>
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-sub)' }}>

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside style={{
        width: 224,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, #0e0e18 0%, #0b0b12 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        position: 'relative',
        zIndex: 10,
      }}>
        {/* Top glow accent */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 180,
          background: 'radial-gradient(ellipse at top left, rgba(0,212,200,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Logo area */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <img
              src={theme === 'dark' ? '/logo-white.png' : '/logo-black.png'}
              alt="Tech Atlantix"
              style={{ height: 36, width: 'auto', objectFit: 'contain', flexShrink: 0 }}
            />
            <div>
              <div style={{ fontFamily: '"Bricolage Grotesque", sans-serif', fontWeight: 800, fontSize: 13, color: '#fff', letterSpacing: '0.04em', lineHeight: 1.1 }}>TECH</div>
              <div style={{ fontFamily: '"Bricolage Grotesque", sans-serif', fontWeight: 800, fontSize: 13, letterSpacing: '0.04em', lineHeight: 1.1, background: 'var(--gradient-green)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ATLANTIX</div>
            </div>
          </div>

          {/* Search bar — opens GlobalSearch */}
          <div onClick={() => setShowSearch(true)} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, padding: '8px 12px', cursor: 'pointer',
            transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.09)'; e.currentTarget.style.borderColor='rgba(0,212,200,0.3)' }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.08)' }}>
            <span style={{ fontSize: 13, opacity: 0.5 }}>⌕</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)', fontWeight: 500, flex:1 }}>Search anything...</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', fontWeight: 600, background: 'rgba(255,255,255,0.07)', padding: '2px 6px', borderRadius: 5 }}>⌘K</span>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Main menu section */}
          <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.14em', padding: '0 12px 8px' }}>
            Menu
          </div>

          {(user.role === 'purchaser' ? PURCHASER_NAV : user.role === 'purchasing_manager' ? [] : SALES_NAV).map(item => (
            <NavItem key={item.name} item={item} />
          ))}

          {/* Notifications */}
          <button onClick={() => navigate('notifications')}
            className={`nav-item ${page.name === 'notifications' ? 'nav-active' : 'nav-inactive'}`}>
            <span style={{ fontSize: 14, width: 20, textAlign: 'center', flexShrink: 0 }}>🔔</span>
            <span style={{ flex: 1 }}>Notifications</span>
            {notifCount > 0 && page.name !== 'notifications' && (
              <span style={{
                background: 'var(--gradient)',
                color: '#060610', fontSize: 9, fontWeight: 800,
                padding: '2px 6px', borderRadius: 20, minWidth: 18, textAlign: 'center',
                boxShadow: '0 2px 8px rgba(0,212,200,0.3)',
              }}>
                {notifCount > 99 ? '99+' : notifCount}
              </span>
            )}
          </button>

          {/* Manager admin section */}
          {user.role === 'manager' && (
            <>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.14em', padding: '16px 12px 8px' }}>
                Admin
              </div>
              {[
                { name: 'import',     label: 'Import Data',  icon: '📥' },
                { name: 'users',      label: 'Users',        icon: '👥' },
                { name: 'purchasing', label: 'Purchasing',   icon: '🔧' },
              ].map(item => <NavItem key={item.name} item={item} />)}
            </>
          )}

          {/* Purchasing manager section */}
          {user.role === 'purchasing_manager' && (
            <>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.14em', padding: '16px 12px 8px' }}>
                Purchasing
              </div>
              <NavItem item={{ name: 'purchasing', label: 'Parts & Quotes', icon: '🔧' }} />
            </>
          )}
        </nav>

        {/* User profile — bottom */}
        <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: '10px 12px', marginBottom: 4,
          }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={user.name} style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} onError={() => setAvatarUrl(null)} />
            ) : (
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: 'var(--gradient)', color: '#060610',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 13,
              }}>
                {user.name[0].toUpperCase()}
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{ROLE_LABELS[user.role] || user.role}</div>
            </div>
          </div>
          {/* Theme toggle */}
          <button onClick={toggle}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 10, border: 'none',
              background: 'rgba(255,255,255,0.06)', cursor: 'pointer',
              width: '100%', marginBottom: 6, transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.06)'}
          >
            <div style={{
              width: 36, height: 20, borderRadius: 10,
              background: theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'var(--brand)',
              position: 'relative', transition: 'background 0.25s', flexShrink: 0,
            }}>
              <div style={{
                width: 14, height: 14, borderRadius: 7, background: '#fff',
                position: 'absolute', top: 3,
                left: theme === 'dark' ? 3 : 19,
                transition: 'left 0.25s',
                boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
              }} />
            </div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>
              {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
            </span>
          </button>
          <button onClick={logout} className="nav-item nav-inactive" style={{ marginTop: 2 }}>
            <span style={{ fontSize: 13, width: 20, textAlign: 'center' }}>⎋</span>
            <span style={{ fontSize: 12 }}>Sign out</span>
          </button>
          <div style={{ textAlign: 'center', marginTop: 10, fontSize: 9, color: 'rgba(255,255,255,0.1)', letterSpacing: '0.06em' }}>
            Beyond Tech · Above Integration
          </div>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────── */}
      <main className="main-content" style={{ flex: 1, overflowY: 'hidden', position: 'relative', display:'flex', flexDirection:'column' }}>
        <div style={{ position: 'relative', zIndex: 1, flex:1, overflowY:'auto', display:'flex', flexDirection:'column' }}>
          {/* NFT Employee Hub Banner */}
          <div id="nft-banner" onClick={() => window.open(window.location.origin + '/#nft', '_blank', 'noopener,noreferrer')}
            style={{ flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 28px', background:'linear-gradient(135deg, rgba(0,229,204,0.12) 0%, rgba(124,58,237,0.12) 100%)', borderBottom:'1px solid rgba(0,229,204,0.15)', cursor:'pointer', transition:'all 0.15s', userSelect:'none' }}
            onMouseEnter={e => e.currentTarget.style.background='linear-gradient(135deg, rgba(0,229,204,0.18) 0%, rgba(124,58,237,0.18) 100%)'}
            onMouseLeave={e => e.currentTarget.style.background='linear-gradient(135deg, rgba(0,229,204,0.12) 0%, rgba(124,58,237,0.12) 100%)'}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#00E5CC,#7C3AED)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:12, color:'#fff', flexShrink:0 }}>N</div>
              <div>
                <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:13, color:'#fff', lineHeight:1.1 }}>NebulaForge Technologies</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.45)', lineHeight:1.1 }}>Employee Hub · Kiosk · Shop · Messages</div>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:700, color:'#00E5CC' }}>
              Open Portal <span style={{ fontSize:14 }}>↗</span>
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
