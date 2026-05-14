import { useAuth } from '../App'
import { useNav } from '../App'

const navItems = [
  { name: 'dashboard', label: 'Dashboard', icon: '⚡' },
  { name: 'leads', label: 'Leads', icon: '🎯' },
  { name: 'repeat', label: 'Repeat Inquiries', icon: '🔁' },
  { name: 'orders', label: 'Online Orders', icon: '🛒' },
  { name: 'customers', label: 'Customers', icon: '👥' },
]

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const { page, navigate } = useNav()

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-dark-800 flex flex-col" style={{ background: '#13131e' }}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">C</div>
            <span className="font-display font-bold text-white text-lg">CRM</span>
          </div>
          <div className="mt-3 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400 text-xs font-bold">
              {user.name[0].toUpperCase()}
            </div>
            <div>
              <div className="text-white text-xs font-semibold">{user.name}</div>
              <div className="text-white/40 text-xs capitalize">{user.role === 'ae' ? 'Account Executive' : 'Manager'}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(item => (
            <div
              key={item.name}
              onClick={() => navigate(item.name)}
              className={`nav-item ${page.name === item.name ? 'active' : 'inactive'}`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}

          {user.role === 'manager' && (
            <div
              onClick={() => navigate('users')}
              className={`nav-item ${page.name === 'users' ? 'active' : 'inactive'}`}
            >
              <span className="text-base">⚙️</span>
              <span>Users</span>
            </div>
          )}
        </nav>

        {/* Logout */}
        <div className="px-3 pb-4">
          <button
            onClick={logout}
            className="nav-item inactive w-full text-left"
          >
            <span>🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
