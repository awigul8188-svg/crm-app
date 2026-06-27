import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../App'
import { useNav } from '../App'
import { api, purchasingApi } from '../api'

// Short two-tone "ding" for new-quote alerts (synthesized — no asset needed).
let _audioCtx = null
function playQuoteDing() {
  try {
    _audioCtx = _audioCtx || new (window.AudioContext || window.webkitAudioContext)()
    const ctx = _audioCtx
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    const now = ctx.currentTime
    ;[[880, 0], [1318.5, 0.13]].forEach(([freq, t]) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.type = 'sine'; osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, now + t)
      gain.gain.exponentialRampToValueAtTime(0.25, now + t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.25)
      osc.connect(gain); gain.connect(ctx.destination)
      osc.start(now + t); osc.stop(now + t + 0.26)
    })
  } catch {}
}
import {
  LayoutDashboard, Target, RotateCcw, ShoppingBag, Users,
  Bell, Upload, UserCog, LogOut, Settings2, Package,
} from 'lucide-react'

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

const DASHBOARD_NAV = { name: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard }
// Sales-side pages — only for CRM roles (manager + ae). Purchasing roles never see these.
const CRM_NAV = [
  { name: 'leads',     label: 'Leads',            Icon: Target },
  { name: 'repeat',    label: 'Repeat Inquiries', Icon: RotateCcw },
  { name: 'orders',    label: 'Online Orders',    Icon: ShoppingBag },
  { name: 'customers', label: 'Customers',        Icon: Users },
]
// purchasing_manager is treated as a full manager.
const MANAGER_ROLES = ['manager', 'purchasing_manager']
const CRM_ROLES = ['manager', 'purchasing_manager', 'ae']
// Purchasers get a dedicated assigned-parts list.
const PURCHASER_NAV = [{ name: 'my-parts', label: 'Assigned Parts', Icon: Package }]

const ADMIN_NAV = [
  { name: 'operations', label: 'Operations',  Icon: Settings2 },
  { name: 'purchasing', label: 'Purchasing',  Icon: Package },
  { name: 'import',     label: 'Import Data', Icon: Upload },
  { name: 'users',      label: 'Users',       Icon: UserCog },
]

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const { page, navigate } = useNav()
  const [notifCount, setNotifCount] = useState(0)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [quoteRing, setQuoteRing] = useState(false)   // brief bell pulse when a new quote lands
  // Audible+visual new-quote alert for AE + manager only (NOT purchasing manager).
  const quoteAlertOn = ['ae', 'manager'].includes(user.role)
  const lastQuoteMaxRef = useRef(null)

  // Purchasers have no CRM notifications — their badge counts unread part notifications + due follow-ups.
  const loadNotifs = () => {
    if (user.role === 'purchaser') {
      purchasingApi.getStats().then(s => {
        const unread = (s.myNotifications || []).filter(n => !n.read).length
        const dueFu = (s.followups?.overdue?.length || 0) + (s.followups?.today?.length || 0)
        setNotifCount(unread + dueFu)
      }).catch(() => {})
    } else {
      api.getNotifications().then(n => {
        setNotifCount(n.total)
        if (quoteAlertOn) {
          const maxQuoteId = (n.activity || []).filter(a => a.inquiry_type === 'quote').reduce((m, q) => Math.max(m, q.id), 0)
          if (lastQuoteMaxRef.current === null) {
            lastQuoteMaxRef.current = maxQuoteId            // baseline on first poll — don't ring for old ones
          } else if (maxQuoteId > lastQuoteMaxRef.current) {
            lastQuoteMaxRef.current = maxQuoteId
            playQuoteDing()
            setQuoteRing(true)
            setTimeout(() => setQuoteRing(false), 6000)
          }
        }
      }).catch(() => {})
    }
  }

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

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-[224px] flex-shrink-0 flex flex-col"
        style={{ background: '#0a0a0a', borderRight: '1px solid rgba(255,255,255,0.06)' }}>

        {/* Logo */}
        <div className="px-5 pt-6 pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-3 mb-5">
            <TALogo size={32} />
            <div>
              <div className="font-display font-bold text-white leading-none tracking-tight text-sm">TECH</div>
              <div className="font-display font-bold leading-none tracking-tight text-sm" style={{ color: '#00D4C8' }}>ATLANTIX</div>
            </div>
          </div>

          {/* User chip */}
          <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={user.name}
                style={{ width: 26, height: 26, borderRadius: 7, objectFit: 'cover', flexShrink: 0 }}
                onError={() => setAvatarUrl(null)} />
            ) : (
              <div className="w-[26px] h-[26px] rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: '#00D4C8', color: '#0a0a0a' }}>
                {user.name[0].toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-white text-xs font-semibold truncate">{user.name}</div>
              <div className="text-[10px] leading-none mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {user.role === 'manager' ? 'Manager'
                  : user.role === 'purchasing_manager' ? 'Purchasing Mgr'
                  : user.role === 'purchaser' ? 'Purchaser'
                  : user.role === 'buyer' ? 'Buyer'
                  : 'Account Executive'}
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <div className="px-3 mb-2"
            style={{ color: 'rgba(255,255,255,0.2)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Main Menu
          </div>

          {[DASHBOARD_NAV, ...(CRM_ROLES.includes(user.role) ? CRM_NAV : []), ...(user.role === 'purchaser' ? PURCHASER_NAV : [])].map(({ name, label, Icon }) => (
            <button key={name} onClick={() => navigate(name)}
              className={`nav-item ${page.name === name ? 'nav-active' : 'nav-inactive'}`}>
              <Icon size={15} className="flex-shrink-0" />
              <span>{label}</span>
              {page.name === name && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#00D4C8' }} />
              )}
            </button>
          ))}

          {/* Notifications */}
          <button onClick={() => { setQuoteRing(false); navigate('notifications') }}
            className={`nav-item ${page.name === 'notifications' ? 'nav-active' : 'nav-inactive'}`}>
            <span className="relative flex-shrink-0 flex items-center">
              <Bell size={15} style={quoteRing ? { color: '#00D4C8', animation: 'quoteSwing 0.6s ease-in-out infinite' } : undefined} />
              {quoteRing && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: '#f59e0b', animation: 'quotePulse 1.2s infinite' }} />}
            </span>
            <span>Notifications</span>
            {quoteRing && <style>{`@keyframes quoteSwing{0%,100%{transform:rotate(0)}25%{transform:rotate(15deg)}75%{transform:rotate(-15deg)}}@keyframes quotePulse{0%{box-shadow:0 0 0 0 rgba(245,158,11,0.6)}70%{box-shadow:0 0 0 6px rgba(245,158,11,0)}100%{box-shadow:0 0 0 0 rgba(245,158,11,0)}}`}</style>}
            {notifCount > 0 && page.name !== 'notifications' && (
              <span className="ml-auto font-bold leading-none flex-shrink-0"
                style={{ background: '#00D4C8', color: '#0a0a0a', fontSize: '10px', padding: '2px 7px', borderRadius: '20px', minWidth: '20px', textAlign: 'center' }}>
                {notifCount > 99 ? '99+' : notifCount}
              </span>
            )}
          </button>

          {/* Admin section — manager-level (manager + purchasing_manager) */}
          {MANAGER_ROLES.includes(user.role) && (
            <>
              <div className="px-3 mt-5 mb-2"
                style={{ color: 'rgba(255,255,255,0.2)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Admin
              </div>
              {ADMIN_NAV.map(({ name, label, Icon }) => (
                <button key={name} onClick={() => navigate(name)}
                  className={`nav-item ${page.name === name ? 'nav-active' : 'nav-inactive'}`}>
                  <Icon size={15} className="flex-shrink-0" />
                  <span>{label}</span>
                  {page.name === name && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#00D4C8' }} />
                  )}
                </button>
              ))}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="px-3 pb-5 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <button onClick={logout} className="nav-item nav-inactive">
            <LogOut size={15} className="flex-shrink-0" />
            <span>Sign out</span>
          </button>
          <div className="text-center mt-3" style={{ color: 'rgba(255,255,255,0.1)', fontSize: '9px' }}>
            Beyond Tech · Above Integration
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto" style={{ background: '#f8fafc' }}>
        {children}
      </main>
    </div>
  )
}
