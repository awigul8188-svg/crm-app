import { useState, useEffect } from 'react'
import { useAuth } from '../App'
import { useNav } from '../App'
import GlobalSearch from './GlobalSearch'

const BRAND = '#00D4C8'

export default function Layout({ children, page }) {
  const { user, logout } = useAuth()
  const { navigate }     = useNav()
  const [theme, setTheme]     = useState(() => localStorage.getItem('crm_theme') || 'dark')
  const [notifCount, setNotifCount] = useState(0)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('crm_theme', theme)
  }, [theme])

  useEffect(() => {
    const fetchCount = () => {
      const token = localStorage.getItem('crm_token')
      if (!token) return
      fetch('/api/notifications/count', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => setNotifCount(d.count || 0)).catch(() => {})
    }
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [page])

  const role = user?.role

  const mainNav = () => {
    if (role === 'purchaser') return [
      { name: 'dashboard',     label: 'Dashboard',     icon: '⊞' },
      { name: 'purchasing',    label: 'My Parts',      icon: '◈' },
      { name: 'notifications', label: 'Notifications', icon: '🔔', badge: notifCount },
    ]
    if (role === 'ae') return [
      { name: 'dashboard',     label: 'Dashboard',     icon: '⊞' },
      { name: 'leads',         label: 'Leads',         icon: '◎' },
      { name: 'repeat',        label: 'Repeat',        icon: '↻' },
      { name: 'orders',        label: 'Orders',        icon: '◈' },
      { name: 'customers',     label: 'Customers',     icon: '👥' },
      { name: 'notifications', label: 'Notifications', icon: '🔔', badge: notifCount },
    ]
    return [
      { name: 'dashboard',     label: 'Dashboard',     icon: '⊞' },
      { name: 'leads',         label: 'Leads',         icon: '◎' },
      { name: 'repeat',        label: 'Repeat',        icon: '↻' },
      { name: 'orders',        label: 'Orders',        icon: '◈' },
      { name: 'customers',     label: 'Customers',     icon: '👥' },
      { name: 'notifications', label: 'Notifications', icon: '🔔', badge: notifCount },
    ]
  }

  const adminNav = () => {
    if (role === 'purchaser' || role === 'ae') return []
    const items = [
      { name: 'users',         label: 'Users',         icon: '⚙' },
      { name: 'purchasing',    label: 'Purchasing',    icon: '📦' },
    ]
    if (role === 'manager') items.splice(1, 0, { name: 'import', label: 'Import Data', icon: '📥' })
    return items
  }

  const isActive = (name) => {
    if (page === name) return true
    if (name === 'dashboard' && (page === 'ae-dashboard' || page === 'purchaser-dashboard')) return true
    if (name === 'purchasing' && page === 'purchasing-parts') return true
    return false
  }

  const btn = (item) => (
    <button key={item.name} onClick={() => navigate(item.name)} style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'9px 12px', borderRadius:10, border:'none', cursor:'pointer', background:isActive(item.name)?`${BRAND}18`:'transparent', color:isActive(item.name)?BRAND:'rgba(255,255,255,0.5)', fontSize:13, fontWeight:isActive(item.name)?600:400, fontFamily:'"Plus Jakarta Sans",sans-serif', textAlign:'left', transition:'all 0.1s', position:'relative' }}
      onMouseEnter={e=>{ if(!isActive(item.name)){e.currentTarget.style.background='rgba(255,255,255,0.06)';e.currentTarget.style.color='rgba(255,255,255,0.8)'} }}
      onMouseLeave={e=>{ e.currentTarget.style.background=isActive(item.name)?`${BRAND}18`:'transparent';e.currentTarget.style.color=isActive(item.name)?BRAND:'rgba(255,255,255,0.5)' }}>
      <span style={{ width:18, textAlign:'center', flexShrink:0, fontSize:14 }}>{item.icon}</span>
      <span style={{ flex:1 }}>{item.label}</span>
      {item.badge>0&&<span style={{ background:'#ef4444', color:'#fff', fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:10 }}>{item.badge>99?'99+':item.badge}</span>}
      {isActive(item.name)&&<span style={{ position:'absolute', right:0, top:'50%', transform:'translateY(-50%)', width:3, height:18, background:BRAND, borderRadius:'2px 0 0 2px' }} />}
    </button>
  )

  const roleLabel = { manager:'Manager', purchasing_manager:'Purchasing Manager', ae:'Account Executive', purchaser:'Purchaser' }[role] || role

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'var(--bg)', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
      {/* Sidebar */}
      <div style={{ width:200, flexShrink:0, background:'#0d1117', display:'flex', flexDirection:'column', borderRight:'1px solid rgba(255,255,255,0.06)', overflow:'hidden' }}>
        {/* Logo */}
        <div style={{ padding:'16px 14px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <div style={{ width:32, height:32, borderRadius:10, background:`linear-gradient(135deg,${BRAND},#0891b2)`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="white"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          </div>
          <div>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:13, color:'#fff', lineHeight:1 }}>TECH</div>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:13, color:BRAND, lineHeight:1 }}>ATLANTIX</div>
          </div>
          <button onClick={()=>window.open(window.location.origin+'/#nft','_blank')} style={{ marginLeft:'auto', fontSize:9, fontWeight:700, color:BRAND, background:`${BRAND}15`, border:`1px solid ${BRAND}30`, borderRadius:6, padding:'3px 6px', cursor:'pointer', flexShrink:0, fontFamily:'"Plus Jakarta Sans",sans-serif', whiteSpace:'nowrap' }}>NFT ↗</button>
        </div>
        {/* Search */}
        <div style={{ padding:'10px 10px 0' }}>
          <GlobalSearch />
        </div>
        {/* Nav */}
        <nav style={{ flex:1, overflowY:'auto', padding:'6px 8px', display:'flex', flexDirection:'column', gap:1 }}>
          <div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.2)', textTransform:'uppercase', letterSpacing:'0.1em', padding:'10px 10px 4px' }}>Menu</div>
          {mainNav().map(btn)}
          {adminNav().length>0&&<>
            <div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.2)', textTransform:'uppercase', letterSpacing:'0.1em', padding:'14px 10px 4px' }}>Admin</div>
            {adminNav().map(btn)}
          </>}
        </nav>
        {/* Footer */}
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', padding:'10px', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:10, background:'rgba(255,255,255,0.04)', marginBottom:6 }}>
            <div style={{ width:28, height:28, borderRadius:8, background:`${BRAND}25`, color:BRAND, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:11, flexShrink:0 }}>{(user?.name||'?').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.8)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.name}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{roleLabel}</div>
            </div>
          </div>
          <button onClick={()=>setTheme(t=>t==='dark'?'light':'dark')} style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'7px 10px', borderRadius:8, border:'none', background:'transparent', color:'rgba(255,255,255,0.35)', cursor:'pointer', fontSize:12, fontFamily:'"Plus Jakarta Sans",sans-serif', marginBottom:2 }}>
            <span>{theme==='dark'?'☀':'🌙'}</span><span>{theme==='dark'?'Light':'Dark'}</span>
          </button>
          <button onClick={logout} style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'7px 10px', borderRadius:8, border:'none', background:'transparent', color:'rgba(255,255,255,0.35)', cursor:'pointer', fontSize:12, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
            <span>⤺</span><span>Sign out</span>
          </button>
        </div>
      </div>
      {/* Main */}
      <main style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--bg)' }}>
        {children}
      </main>
    </div>
  )
}
