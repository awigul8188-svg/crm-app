import { useAuth } from '../App'
import { useNav } from '../App'

const NAV = [
  { name: 'dashboard', label: 'Dashboard', icon: '▣' },
  { name: 'leads', label: 'Leads', icon: '◎' },
  { name: 'repeat', label: 'Repeat Inquiries', icon: '↻' },
  { name: 'orders', label: 'Online Orders', icon: '◈' },
  { name: 'customers', label: 'Customers', icon: '◉' },
]

const ROLE_LABELS = { manager: 'Manager', ae: 'Account Executive' }

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const { page, navigate } = useNav()

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[220px] flex-shrink-0 flex flex-col" style={{ background: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)' }}>
        {/* Logo */}
        <div className="px-5 pt-6 pb-5">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">⚡</div>
            <span className="font-display font-bold text-white text-lg tracking-tight">CRM</span>
          </div>
          {/* User chip */}
          <div className="flex items-center gap-2.5 bg-white/8 rounded-xl px-3 py-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {user.name[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-white text-xs font-semibold truncate">{user.name}</div>
              <div className="text-white/40 text-[10px]">{ROLE_LABELS[user.role]}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto pb-2">
          <div className="text-white/25 text-[10px] font-semibold uppercase tracking-widest px-3 mb-2">Menu</div>
          {NAV.map(item => (
            <button key={item.name} onClick={() => navigate(item.name)} className={`nav-item w-full text-left ${page.name === item.name ? 'nav-active' : 'nav-inactive'}`}>
              <span className="text-base w-5 text-center flex-shrink-0">{item.icon}</span>
              <span className="text-sm">{item.label}</span>
              {page.name === item.name && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />}
            </button>
          ))}

          {user.role === 'manager' && (
            <>
              <div className="text-white/25 text-[10px] font-semibold uppercase tracking-widest px-3 mt-4 mb-2">Admin</div>
              <button onClick={() => navigate('users')} className={`nav-item w-full text-left ${page.name === 'users' ? 'nav-active' : 'nav-inactive'}`}>
                <span className="text-base w-5 text-center">⚙</span>
                <span className="text-sm">Users</span>
                {page.name === 'users' && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400" />}
              </button>
            </>
          )}
        </nav>

        {/* Logout */}
        <div className="px-3 pb-5 pt-2 border-t border-white/10">
          <button onClick={logout} className="nav-item nav-inactive w-full text-left mt-2">
            <span className="text-base w-5 text-center">→</span>
            <span className="text-sm">Sign out</span>
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto bg-surface-50">
        {children}
      </main>
    </div>
  )
}
