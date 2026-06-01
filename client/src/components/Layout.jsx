import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../App'
import { useNav } from '../App'
import { navItems } from '../rbac'
import GlobalSearch from './components/GlobalSearch'

const BRAND = '#00D4C8'
const token = () => localStorage.getItem('crm_token')

// Icon map
function Icon({ name, size = 16 }) {
  const icons = {
    grid: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
    target: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
    refresh: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
    shopping: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
    users: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    bell: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
    upload: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>,
    'user-cog': <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><circle cx="19" cy="11" r="2"/></svg>,
    package: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
    logout: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    sun: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
    moon: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  }
  return icons[name] || <span>{name}</span>
}

export default function Layout({ children, currentPage }) {
  const { user, logout } = useAuth()
  const { navigate }     = useNav()
  const [theme, setTheme]       = useState(() => localStorage.getItem('crm_theme') || 'dark')
  const [notifCount, setNotifCount] = useState(0)
  const [collapsed, setCollapsed]   = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('crm_theme', theme)
  }, [theme])

  useEffect(() => {
    const fetchCount = () => {
      fetch('/api/notifications/count', { headers: { Authorization: `Bearer ${token()}` } })
        .then(r => r.json()).then(d => setNotifCount(d.count || 0)).catch(() => {})
    }
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [currentPage])

  const items = navItems(user)

  const roleLabel = {
    manager:            'Manager',
    purchasing_manager: 'Purchasing Manager',
    ae:                 'Account Executive',
    purchaser:          'Purchaser',
  }[user?.role] || user?.role

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'var(--bg)', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
      {/* Sidebar */}
      <div style={{ width: collapsed ? 60 : 200, flexShrink:0, background:'var(--sidebar,#0d1117)', display:'flex', flexDirection:'column', borderRight:'1px solid rgba(255,255,255,0.06)', transition:'width 0.2s ease', overflow:'hidden' }}>

        {/* Logo */}
        <div style={{ padding: collapsed ? '20px 0' : '20px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', gap:10, justifyContent: collapsed ? 'center' : 'flex-start', flexShrink:0 }}>
          <div style={{ width:32, height:32, borderRadius:10, background:`linear-gradient(135deg,${BRAND},${BRAND}aa)`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="white"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          </div>
          {!collapsed && (
            <div>
              <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:13, color:'#fff', lineHeight:1 }}>TECH</div>
              <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:13, color:BRAND, lineHeight:1 }}>ATLANTIX</div>
            </div>
          )}
        </div>

        {/* Search */}
        {!collapsed && (
          <div style={{ padding:'12px 12px 0' }}>
            <GlobalSearch />
          </div>
        )}

        {/* Nav items */}
        <nav style={{ flex:1, overflowY:'auto', padding:'8px 8px', display:'flex', flexDirection:'column', gap:2 }}>
          {items.map((item, i) => {
            if (item.section) {
              return !collapsed ? (
                <div key={i} style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.2)', textTransform:'uppercase', letterSpacing:'0.1em', padding:'12px 8px 4px' }}>{item.section}</div>
              ) : <div key={i} style={{ height:1, background:'rgba(255,255,255,0.06)', margin:'8px 0' }} />
            }
            const isActive = currentPage === item.key || (item.key === 'ae-dashboard' && currentPage === 'dashboard' && user?.role === 'ae') || (item.key === 'purchaser-dashboard' && currentPage === 'dashboard' && user?.role === 'purchaser')
            return (
              <button key={item.key} onClick={() => navigate(item.key)} title={collapsed ? item.label : undefined} style={{ display:'flex', alignItems:'center', gap:10, padding: collapsed ? '9px 0' : '9px 10px', borderRadius:10, border:'none', background: isActive ? `${BRAND}18` : 'transparent', color: isActive ? BRAND : 'rgba(255,255,255,0.5)', cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', fontSize:13, fontWeight: isActive ? 600 : 400, width:'100%', textAlign:'left', transition:'all 0.1s', justifyContent: collapsed ? 'center' : 'flex-start', position:'relative' }}>
                <span style={{ flexShrink:0, display:'flex' }}><Icon name={item.icon} /></span>
                {!collapsed && <span>{item.label}</span>}
                {item.key === 'notifications' && notifCount > 0 && (
                  <span style={{ marginLeft: collapsed ? 0 : 'auto', background:'#ef4444', color:'#fff', fontSize:9, fontWeight:800, padding:'1px 5px', borderRadius:10, minWidth:16, textAlign:'center', position: collapsed ? 'absolute' : 'relative', top: collapsed ? 2 : 0, right: collapsed ? 2 : 0 }}>{notifCount > 99 ? '99+' : notifCount}</span>
                )}
                {isActive && !collapsed && <div style={{ position:'absolute', right:0, top:'50%', transform:'translateY(-50%)', width:3, height:18, background:BRAND, borderRadius:'2px 0 0 2px' }} />}
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', padding: collapsed ? '12px 0' : '12px', flexShrink:0 }}>
          {!collapsed && (
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:10, background:'rgba(255,255,255,0.04)', marginBottom:8 }}>
              <div style={{ width:30, height:30, borderRadius:8, background:`${BRAND}25`, color:BRAND, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:12, flexShrink:0 }}>
                {(user?.name||'?').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.8)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.name}</div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{roleLabel}</div>
              </div>
            </div>
          )}

          {/* Theme toggle */}
          <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding: collapsed ? '8px 0' : '8px 10px', borderRadius:8, border:'none', background:'transparent', color:'rgba(255,255,255,0.35)', cursor:'pointer', fontSize:12, fontFamily:'"Plus Jakarta Sans",sans-serif', justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={14} />
            {!collapsed && <span>{theme === 'dark' ? '☀ Light' : '🌙 Dark'}</span>}
          </button>

          {/* Logout */}
          <button onClick={logout} style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding: collapsed ? '8px 0' : '8px 10px', borderRadius:8, border:'none', background:'transparent', color:'rgba(255,255,255,0.35)', cursor:'pointer', fontSize:12, fontFamily:'"Plus Jakarta Sans",sans-serif', marginTop:2, justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <Icon name="logout" size={14} />
            {!collapsed && 'Sign out'}
          </button>
        </div>
      </div>

      {/* Main content */}
      <main style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--bg)' }}>
        {children}
      </main>
    </div>
  )
}
