import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { colors } from '../theme'

export default function MetricsCharts({ inquiries, type }) {
  // Disposition Breakdown
  const dispositionData = inquiries.reduce((acc, inq) => {
    const existing = acc.find(d => d.name === inq.disposition)
    if (existing) {
      existing.value += 1
    } else {
      acc.push({ name: inq.disposition || 'Unknown', value: 1 })
    }
    return acc
  }, []).sort((a, b) => b.value - a.value)

  // Daily Trend (last 14 days)
  const dailyData = inquiries.reduce((acc, inq) => {
    const date = new Date(inq.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const existing = acc.find(d => d.date === date)
    if (existing) {
      existing.count += 1
    } else {
      acc.push({ date, count: 1 })
    }
    return acc
  }, []).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-14)

  // By Assignment
  const assignmentData = inquiries.reduce((acc, inq) => {
    const name = inq.assigned_name || 'Unassigned'
    const existing = acc.find(d => d.name === name)
    if (existing) {
      existing.count += 1
    } else {
      acc.push({ name, count: 1 })
    }
    return acc
  }, []).sort((a, b) => b.count - a.count).slice(0, 8)

  const chartColors = [
    colors.primary,
    colors.secondary,
    colors.success,
    colors.warning,
    colors.danger,
    '#8B5CF6',
    '#EC4899',
    '#14B8A6',
  ]

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Disposition Pie Chart */}
      <div
        className="p-6 rounded-lg border"
        style={{ borderColor: colors.gray200, backgroundColor: colors.gray50 }}
      >
        <h3 style={{ color: colors.gray900 }} className="font-semibold mb-4">
          Disposition Breakdown
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={dispositionData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value }) => `${name}: ${value}`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {dispositionData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Daily Trend Line Chart */}
      <div
        className="p-6 rounded-lg border"
        style={{ borderColor: colors.gray200, backgroundColor: colors.gray50 }}
      >
        <h3 style={{ color: colors.gray900 }} className="font-semibold mb-4">
          Daily Trend (Last 14 Days)
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.gray200} />
            <XAxis dataKey="date" stroke={colors.gray500} style={{ fontSize: '12px' }} />
            <YAxis stroke={colors.gray500} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#fff', border: `1px solid ${colors.gray200}` }}
              labelStyle={{ color: colors.gray900 }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke={colors.primary}
              strokeWidth={2}
              dot={{ fill: colors.primary, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* By Assignment Bar Chart */}
      <div
        className="p-6 rounded-lg border col-span-2"
        style={{ borderColor: colors.gray200, backgroundColor: colors.gray50 }}
      >
        <h3 style={{ color: colors.gray900 }} className="font-semibold mb-4">
          Distribution by Team Member
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={assignmentData}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.gray200} />
            <XAxis dataKey="name" stroke={colors.gray500} style={{ fontSize: '12px' }} />
            <YAxis stroke={colors.gray500} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#fff', border: `1px solid ${colors.gray200}` }}
              labelStyle={{ color: colors.gray900 }}
            />
            <Bar dataKey="count" fill={colors.primary} radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}