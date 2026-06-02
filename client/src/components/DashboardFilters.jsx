import { useState, useEffect } from 'react'
import { colors } from '../theme'
import { Calendar, Users, Filter, X } from 'lucide-react'

export default function DashboardFilters({ filters, onFiltersChange }) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [users, setUsers] = useState([])
  const dispositions = [
    'New',
    'Initial Contact',
    'Proposal Sent',
    'Closed Won',
    'Closed Lost',
    'Processed',
    'Cancelled',
    'Fake Lead',
  ]

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${localStorage.getItem('crm_token')}` }
      })
      if (res.ok) {
        setUsers(await res.json())
      }
    } catch (err) {
      console.error('Failed to fetch users:', err)
    }
  }

  const handleDateChange = (field, value) => {
    onFiltersChange({
      ...filters,
      dateRange: { ...filters.dateRange, [field]: value }
    })
  }

  const handleDispositionToggle = (disp) => {
    const updated = filters.dispositions.includes(disp)
      ? filters.dispositions.filter(d => d !== disp)
      : [...filters.dispositions, disp]
    onFiltersChange({ ...filters, dispositions: updated })
  }

  const clearFilters = () => {
    onFiltersChange({
      dateRange: { from: null, to: null },
      assignedTo: [],
      dispositions: [],
    })
  }

  const hasActiveFilters = 
    filters.dateRange.from || 
    filters.dateRange.to || 
    filters.assignedTo.length > 0 || 
    filters.dispositions.length > 0

  return (
    <div className="space-y-4">
      {/* Quick Filters */}
      <div
        className="p-4 rounded-lg border"
        style={{ borderColor: colors.gray200, backgroundColor: colors.gray50 }}
      >
        <div className="flex flex-wrap items-center gap-4">
          {/* Date Range */}
          <div className="flex items-center space-x-2">
            <Calendar size={18} style={{ color: colors.gray600 }} />
            <input
              type="date"
              value={filters.dateRange.from || ''}
              onChange={(e) => handleDateChange('from', e.target.value)}
              className="px-3 py-2 border rounded text-sm font-medium"
              style={{ borderColor: colors.gray300, color: colors.gray700 }}
            />
            <span style={{ color: colors.gray500 }} className="text-sm">to</span>
            <input
              type="date"
              value={filters.dateRange.to || ''}
              onChange={(e) => handleDateChange('to', e.target.value)}
              className="px-3 py-2 border rounded text-sm font-medium"
              style={{ borderColor: colors.gray300, color: colors.gray700 }}
            />
          </div>

          {/* Assigned To */}
          <div className="flex items-center space-x-2">
            <Users size={18} style={{ color: colors.gray600 }} />
            <select
              multiple
              value={filters.assignedTo}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, option => parseInt(option.value))
                onFiltersChange({ ...filters, assignedTo: selected })
              }}
              className="px-3 py-2 border rounded text-sm font-medium"
              style={{ borderColor: colors.gray300, color: colors.gray700 }}
            >
              <option value="">Select team members...</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          {/* Advanced Toggle & Clear */}
          <div className="ml-auto flex items-center space-x-2">
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="p-2 hover:bg-gray-200 rounded transition-all"
                title="Clear filters"
              >
                <X size={16} style={{ color: colors.gray600 }} />
              </button>
            )}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="px-4 py-2 text-sm font-medium rounded border transition-all"
              style={{
                borderColor: colors.gray300,
                color: colors.primary,
                backgroundColor: showAdvanced ? colors.primary + '10' : 'transparent'
              }}
            >
              <Filter size={16} className="inline mr-2" />
              {showAdvanced ? 'Hide' : 'Show'} Advanced
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div
          className="p-4 rounded-lg border"
          style={{ borderColor: colors.gray200, backgroundColor: colors.gray50 }}
        >
          <h3 style={{ color: colors.gray900 }} className="font-semibold mb-3">
            Disposition Filters
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {dispositions.map(disp => (
              <label key={disp} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-2 rounded">
                <input
                  type="checkbox"
                  checked={filters.dispositions.includes(disp)}
                  onChange={() => handleDispositionToggle(disp)}
                  className="w-4 h-4 rounded accent-blue-600"
                />
                <span style={{ color: colors.gray700 }} className="text-sm font-medium">
                  {disp}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}