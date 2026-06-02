import { Search, Bell, Menu } from 'lucide-react'
import { colors } from '../theme'
import { useState } from 'react'

export default function TopBar({ onMenuClick }) {
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <header
      className="border-b"
      style={{ borderColor: colors.gray200, backgroundColor: '#FAFAFA' }}
    >
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onMenuClick}
            className="p-2 hover:bg-gray-200 rounded-lg transition-all"
            title="Toggle Sidebar"
          >
            <Menu size={20} style={{ color: colors.gray700 }} />
          </button>

          {/* Search Bar */}
          <div
            className="hidden md:flex items-center space-x-2 px-4 py-2 rounded-lg transition-all"
            style={{ backgroundColor: colors.gray100 }}
          >
            <Search size={18} style={{ color: colors.gray500 }} />
            <input
              type="text"
              placeholder="Search customers, leads, orders..."
              className="bg-transparent outline-none w-64 text-sm"
              style={{ color: colors.gray700 }}
            />
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-4">
          {/* Mobile Search Toggle */}
          <button className="md:hidden p-2 hover:bg-gray-200 rounded-lg">
            <Search size={20} style={{ color: colors.gray700 }} />
          </button>

          {/* Notifications */}
          <button className="relative p-2 hover:bg-gray-200 rounded-lg transition-all">
            <Bell size={20} style={{ color: colors.gray700 }} />
            <span
              className="absolute top-1 right-1 w-2 h-2 rounded-full"
              style={{ backgroundColor: colors.danger }}
            ></span>
          </button>

          {/* Settings */}
          <button className="p-2 hover:bg-gray-200 rounded-lg transition-all">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{ color: colors.gray700 }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}