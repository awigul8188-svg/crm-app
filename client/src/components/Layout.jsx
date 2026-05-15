import { useState, useEffect } from 'react'
import { useAuth } from '../App'
import { useNav } from '../App'
import { api } from '../api'

function TALogo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="20,2 46,2 46,14 32,14 32,10 20,10" fill="white"/>
      <rect x="32" y="14" width="14" height="16" fill="white"/>
      <rect x="2" y="14" width="28" height="22" fill="#00D4C8"/>
      <rect x="20" y="36" width="26" height="10" fill="white"/>
    </svg>
  )
}

const NAV = [
  { name: 'dashboard', label: 'Dashboard',       icon: '▣' },
  { name: 'leads',     label: 'Leads',            icon: '◎' },
  { name: 'repeat',    label: 'Repeat Inquiries', icon: '↻' },
  { name: 'orders',    label: 'Online Orders',    icon: '◈' },
  { name: 'customers', label: 'Customers',        icon: '◉' },
]

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const { page, navigate } = useNav()
  const [notifData, setNotifData] = useState({ total: 0, unreadActivity: 0 })

  const loadNotifs = () => {
    api.getNotifications()
      .then(n => setNotifData({ total: n.total, unreadActivity: n.unreadActivity || 0 }))
      .catch(() => {})
  }

  useEffect(() => {
    loadNotifs()
    const interval = setInterval(loadNotifs, 30000) // poll every 30s
    return () => clearInterval(interval)
  }, [])

  // Refresh when leaving notifications page
  useEffect(() => {
    if (page.name !== 'notifications') loadNotifs()
  }, [page.name])

  const badgeCount = notifData.total

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-[230px] flex-shrink-0 flex flex-col"
        style={{ background: '#0d0d0d', borderRight: '1px solid rgba(255,255,255,0.06)' }}>

        {/* Logo */}
        <div className="px-5 pt-6 pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-3 mb-5">
            <TALogo size={34} />
            <div>
              <div className="font-display font-bold text-white leading-none tracking-tight text-base">TECH</div>
              <div className="font-display font-bold leading-none tracking-tight text-base" style={{ color: '#00D4C8' }}>ATLANTIX</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-dark-900 text-xs font-bold flex-shrink-0"
              style={{ background: '#00D4C8' }}>
              {user.name[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-white text-xs font-semibold truncate">{user.name}</div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {user.role === 'manager' ? 'Manager' : 'Account Executive'}
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <div className="px-3 mb-2.5" style={{ color: 'rgba(255,255,255,0.2)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Main Menu
          </div>
          {NAV.map(item => (
            <button key={item.name} onClick={() => navigate(item.name)}
              className={`nav-item ${page.name === item.name ? 'nav-active' : 'nav-inactive'}`}>
              <span className="text-sm w-5 text-center flex-shrink-0">{item.icon}</span>
              <span>{item.label}</span>
              {page.name === item.name && <span className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#00D4C8' }} />}
            </button>
          ))}

          {/* Notifications with badge */}
          <button onClick={() => navigate('notifications')}
            className={`nav-item ${page.name === 'notifications' ? 'nav-active' : 'nav-inactive'}`}>
            <span className="text-sm w-5 text-center flex-shrink-0">🔔</span>
            <span>Notifications</span>
            {badgeCount > 0 && page.name !== 'notifications' && (
              <span className="ml-auto font-bold leading-none flex-shrink-0"
                style={{ background: '#00D4C8', color: '#0d0d0d', fontSize: '10px', padding: '2px 7px', borderRadius: '20px', minWidth: '20px', textAlign: 'center' }}>
                {badgeCount > 99 ? '99+' : badgeCount}
              </span>
            )}
          </button>

          {user.role === 'manager' && (
            <>
              <div className="px-3 mt-5 mb-2.5" style={{ color: 'rgba(255,255,255,0.2)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Admin
              </div>
              {[
                { name: 'import', label: 'Import Data', icon: '📥' },
                { name: 'users',  label: 'Users',       icon: '⚙' },
              ].map(item => (
                <button key={item.name} onClick={() => navigate(item.name)}
                  className={`nav-item ${page.name === item.name ? 'nav-active' : 'nav-inactive'}`}>
                  <span className="text-sm w-5 text-center">{item.icon}</span>
                  <span>{item.label}</span>
                  {page.name === item.name && <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: '#00D4C8' }} />}
                </button>
              ))}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="px-3 pb-5 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <button onClick={logout} className="nav-item nav-inactive mt-2">
            <span className="text-sm w-5 text-center">→</span>
            <span>Sign out</span>
          </button>
          <div className="text-center mt-3" style={{ color: 'rgba(255,255,255,0.12)', fontSize: '9px' }}>
            Beyond Tech · Above Integration
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-surface-50">
        {children}
      </main>
    </div>
  )
}
