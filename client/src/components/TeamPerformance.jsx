import { useState, useEffect } from 'react'
import { colors } from '../theme'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Award } from 'lucide-react'

export default function TeamPerformance({ type, filters }) {
  const [teamData, setTeamData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTeamPerformance()
  }, [filters, type])

  const fetchTeamPerformance = async () => {
    try {
      setLoading(true)
      const queryParams = new URLSearchParams()
      
      if (filters?.dateRange?.from) queryParams.append('from', filters.dateRange.from)
      if (filters?.dateRange?.to) queryParams.append('to', filters.dateRange.to)
      queryParams.append('type', type)

      const res = await fetch(`/api/inquiries?${queryParams}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('crm_token')}` }
      })
      
      if (res.ok) {
        const data = await res.json()
        processTeamData(data)
      }
    } catch (err) {
      console.error('Failed to fetch team performance:', err)
    } finally {
      setLoading(false)
    }
  }

  const processTeamData = (inquiries) => {
    const byTeam = {}
    
    inquiries.forEach(inq => {
      const name = inq.assigned_name || 'Unassigned'
      if (!byTeam[name]) {
        byTeam[name] = {
          name,
          total: 0,
          won: 0,
          lost: 0,
          active: 0,
        }
      }
      byTeam[name].total += 1
      if (inq.disposition === 'Closed Won' || inq.disposition === 'Processed') {
        byTeam[name].won += 1
      } else if (inq.disposition === 'Closed Lost' || inq.disposition === 'Cancelled') {
        byTeam[name].lost += 1
      } else {
        byTeam[name].active += 1
      }
    })

    const processed = Object.values(byTeam)
      .map(member => ({
        ...member,
        conversionRate: member.total > 0 ? ((member.won / member.total) * 100).toFixed(0) : 0,
      }))
      .sort((a, b) => b.won - a.won)

    setTeamData(processed)
  }

  return (
    <div className="space-y-6">
      <h3 style={{ color: colors.gray900 }} className="text-lg font-bold">
        Team Performance
      </h3>

      {/* Team Members Grid */}
      <div className="grid grid-cols-3 gap-6">
        {teamData.map((member) => (
          <div
            key={member.name}
            className="p-6 rounded-lg border transition-all hover:shadow-md"
            style={{ borderColor: colors.gray200, backgroundColor: colors.gray50 }}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p style={{ color: colors.gray600 }} className="text-xs font-medium">
                  {member.name}
                </p>
                <p style={{ color: colors.gray900 }} className="text-2xl font-bold mt-1">
                  {member.won} Won
                </p>
              </div>
              <Award size={20} style={{ color: colors.primary }} />
            </div>

            {/* Stats */}
            <div className="space-y-2 mb-4">
              <div className="flex justify-between items-center">
                <span style={{ color: colors.gray600 }} className="text-xs">
                  Conversion Rate
                </span>
                <span style={{ color: colors.success }} className="text-sm font-bold">
                  {member.conversionRate}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: colors.gray600 }} className="text-xs">
                  Active Deals
                </span>
                <span style={{ color: colors.warning }} className="text-sm font-bold">
                  {member.active}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: colors.gray600 }} className="text-xs">
                  Lost Deals
                </span>
                <span style={{ color: colors.danger }} className="text-sm font-bold">
                  {member.lost}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 rounded-full" style={{ backgroundColor: colors.gray200 }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  backgroundColor: colors.primary,
                  width: `${member.conversionRate}%`
                }}
              ></div>
            </div>
          </div>
        ))}
      </div>

      {/* Team Comparison Bar Chart */}
      {teamData.length > 0 && (
        <div
          className="p-6 rounded-lg border"
          style={{ borderColor: colors.gray200, backgroundColor: colors.gray50 }}
        >
          <h3 style={{ color: colors.gray900 }} className="font-semibold mb-4">
            Team Comparison
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={teamData}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.gray200} />
              <XAxis dataKey="name" stroke={colors.gray500} style={{ fontSize: '12px' }} />
              <YAxis stroke={colors.gray500} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', border: `1px solid ${colors.gray200}` }}
                labelStyle={{ color: colors.gray900 }}
              />
              <Bar dataKey="won" fill={colors.success} name="Won" radius={[8, 8, 0, 0]} />
              <Bar dataKey="active" fill={colors.warning} name="Active" radius={[8, 8, 0, 0]} />
              <Bar dataKey="lost" fill={colors.danger} name="Lost" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}