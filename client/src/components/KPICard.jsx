import { colors } from '../theme'
import { TrendingUp, TrendingDown } from 'lucide-react'

export default function KPICard({ label, value, subtext, trend, trendDirection = 'up', color }) {
  return (
    <div
      className="p-6 rounded-lg border transition-all hover:shadow-md cursor-default"
      style={{ borderColor: colors.gray200, backgroundColor: colors.gray50 }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p style={{ color: colors.gray600 }} className="text-sm font-medium">
            {label}
          </p>
          <p style={{ color: colors.gray900 }} className="text-3xl font-bold mt-2">
            {typeof value === 'number' ? value?.toLocaleString() : value}
          </p>
          {subtext && (
            <p style={{ color: colors.gray500 }} className="text-xs mt-2">
              {subtext}
            </p>
          )}
        </div>
        <div
          className="p-3 rounded-lg flex-shrink-0"
          style={{ backgroundColor: color + '20' }}
        >
          {trend ? (
            <div className="flex items-center space-x-1">
              {trendDirection === 'up' ? (
                <TrendingUp size={18} style={{ color }} />
              ) : (
                <TrendingDown size={18} style={{ color }} />
              )}
              <span style={{ color }} className="text-sm font-semibold">
                {trend}
              </span>
            </div>
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{ backgroundColor: color }}
            >
              {label[0]}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}