import { useNav, useAuth } from '../App'
import { colors } from '../theme'
import { ChevronDown, LogOut, Settings, User, ChevronLeft } from 'lucide-react'
import { useState } from 'react'

export default function Sidebar({ isOpen, onToggle }) {
  const { user, logout } = useAuth()
  const { navigate, page } = useNav()
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const menuItems = {
    manager: [
      { label: 'Dashboard', icon: '📊', page: 'dashboard' },
      { label: 'Leads', icon: '🎯', page: 'leads' },
      { label: 'Online Orders', icon: '🛒', page: 'orders' },
      { label: 'Repeat Inquiries', icon: '🔄', page: 'repeat' },
      { label: 'Customers', icon: '👥', page: 'customers' },
      { label: 'Purchasing', icon: '📦', page: 'purchasing' },
      { label: 'Users', icon: '👨‍💼', page: 'users' },
      { label: 'Notifications', icon: '🔔', page: 'notifications' },
    ],
    ae: [
      { label: 'Dashboard', icon: '📊', page: 'ae-dashboard' },
      { label: 'Leads', icon: '🎯', page: 'leads' },
      { label: 'Online Orders', icon: '🛒', page: 'orders' },
      { label: 'Repeat Inquiries', icon: '🔄', page: 'repeat' },
      { label: 'Customers', icon: '👥', page: 'customers' },
      { label: 'Notifications', icon: '🔔', page: 'notifications' },
    ],
    purchasing_manager: [
      { label: 'Dashboard', icon: '📊', page: 'dashboard' },
      { label: 'Purchasing', icon: '📦', page: 'purchasing' },
      { label: 'Users', icon: '👨‍💼', page: 'users' },
      { label: 'Notifications', icon: '🔔', page: 'notifications' },
    ],
    purchaser: [
      { label: 'Dashboard', icon: '📊', page: 'dashboard' },
      { label: 'My Parts', icon: '📦', page: 'purchasing' },
      { label: 'Notifications', icon: '🔔', page: 'notifications' },
    ],
  };

  const items = menuItems[user?.role] || menuItems.ae;
  const isActive = (itemPage) => page === itemPage;

  return (
    <aside
      className={`${isOpen ? 'w-64' : 'w-20'} transition-all duration-300 flex flex-col h-screen`}
      style={{ backgroundColor: colors.sidebar }}
    >
      {/* Logo/Brand */}
      <div className="p-6 border-b border-white border-opacity-20">
        {isOpen ? (
          <div>
            <h1 className="text-2xl font-bold text-white">CRM</h1>
            <p className="text-xs text-gray-300">Sales Platform</p>
          </div>
        ) : (
          <div className="text-2xl font-bold text-white text-center">C</div>
        )}
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto">
        {items.map((item) => (
          <button
            key={item.page}
            onClick={() => navigate(item.page)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
              isActive(item.page)
                ? 'bg-white text-gray-900 font-semibold shadow-md'
                : 'text-gray-200 hover:bg-gray-700'
            }`}
            title={item.label}
          >
            <span className="text-xl flex-shrink-0">{item.icon}</span>
            {isOpen && <span className="truncate text-sm">{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* User Menu */}
      <div className="border-t border-white border-opacity-20 p-3">
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="w-full flex items-center space-x-2 px-4 py-3 rounded-lg hover:bg-gray-700 transition-all text-gray-200"
          >
            <div className="w-8 h-8 bg-blue-400 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
            {isOpen && (
              <>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
                  <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
                </div>
                <ChevronDown size={14} className="flex-shrink-0" />
              </>
            )}
          </button>

          {/* User Dropdown */}
          {userMenuOpen && isOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50">
              <button className="w-full flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 text-sm">
                <User size={16} />
                <span>Profile</span>
              </button>
              <button className="w-full flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 text-sm">
                <Settings size={16} />
                <span>Settings</span>
              </button>
              <button
                onClick={() => {
                  logout()
                  setUserMenuOpen(false)
                }}
                className="w-full flex items-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 text-sm border-t border-gray-200"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="m-3 p-2 hover:bg-gray-700 rounded-lg transition-all text-gray-200"
        title={isOpen ? 'Collapse' : 'Expand'}
      >
        <ChevronLeft size={20} className={`transition-transform ${!isOpen ? 'rotate-180' : ''}`} />
      </button>
    </aside>
  )
}