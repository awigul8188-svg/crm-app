import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../App'
import { useNav } from '../App'
import { purchasingApi } from '../api'

const BRAND = '#00D4C8'
const DAYS = ['M','T','W','T','F','S','S']
const HOURS = ['12a','1','2','3','4','5','6a','7','8','9','10','11','12p','1','2','3','4','5','6p','7','8','9','10','11']

// ── Donut chart ────────────────────────────────────────────
function DonutChart({ segments, total, label }) {
  const r = 70, cx = 90, cy = 90, strokeW = 16
  const circ = 2 * Math.PI * r
  let offset = 0
  const arcs = segments.map(s => {
    const dash = (s.value / total) * circ
    const arc = { ...s, dash, offset }
    offset += dash
    return arc
  })
  return (
    <svg width={180} height={180} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--card-2)" strokeWidth={strokeW} />
      {arcs.map((s, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none"
          stroke={s.color} strokeWidth={strokeW}
          strokeDasharray={`${s.dash} ${circ - s.dash}`}
          strokeDashoffset={circ / 4 - s.offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      ))}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={28} fontWeight={900} fill="var(--text)" fontFamily='"Bricolage Grotesque",sans-serif'>{total}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--text-3)" letterSpacing="0.08em" textTransform="uppercase">{label}</text>
    </svg>
  )
}

// ── Sparkline ─────────────────────────────────────────────
function Sparkline({ data = [], color = BRAND, width = 80, height = 30 }) {
  if (!data.length) return <svg width={width} height={height} />
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`)
  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length-1].split(',')[0]} cy={pts[pts.length-1].split(',')[1]} r={3} fill={color} />
    </svg>
  )
}

// ── Bar chart ─────────────────────────────────────────────
function WeekBars({ data = [], today = 2 }) {
  const max = Math.max(...data, 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 48 }}>
      {DAYS.map((d, i) => {
        const h = data[i] ? (data[i] / max) * 44 : 4
        const isToday = i === today
        return (
          <div key={d} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
            <div style={{ width: '100%', height: h, background: isToday ? BRAND : 'rgba(255,255,255,0.15)', borderRadius: 4, transition: 'height 0.5s ease', minHeight: 4 }} />
            <span style={{ fontSize: 9, color: isToday ? BRAND : 'rgba(255,255,255,0.3)', fontWeight: isToday ? 700 : 400 }}>{d}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Throughput heat row ────────────────────────────────────
function HeatRow({ data = [], label }) {
  const max = Math.max(...data, 1)
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {data.map((v, i) => {
        const pct = v / max
        const bg = pct > 0.7 ? BRAND : pct > 0.4 ? `${BRAND}80` : pct > 0.1 ? `${BRAND}35` : 'var(--card-2)'
        return <div key={i} style={{ width: 18, height: 18, borderRadius: 4, background: bg, flexShrink: 0, transition: 'background 0.3s' }} title={`${HOURS[i]}: ${v}`} />
      })}
    </div>
  )
}

// ── Completion bar ─────────────────────────────────────────
function CompBar({ pct, color = BRAND }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--card-2)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', minWidth: 36, textAlign: 'right' }}>{pct}%</span>
    </div>
  )
}

export default function PurchasingManagerView() {
  const { user } = useAuth()
  const { navigate } = useNav()
  const [stats, setStats] = useState(null)
  const [parts, setParts] = useState([])
  const [loading, setLoading] = useState(true)
  const [throughputMode, setThroughputMode] = useState('day')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, p] = await Promise.all([
        purchasingApi.getStats(),
        purchasingApi.getParts({ page: 1 }),
      ])
      setStats(s)
      setParts(Array.isArray(p?.parts) ? p.parts : [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [])

  // Computed values
  const today = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1
  const totalParts = (stats?.totalAssigned || 0)
  const unassigned = stats?.unassigned || 0
  const pending = stats?.pending || 0
  const quoted = stats?.quoted || 0
  const noStock = stats?.notInStock || 0
  const delayed = stats?.delayed || 0
  const critical = stats?.critical || 0
  const overSelling = stats?.overSelling || 0
  const todayQuotes = stats?.todayQuotes || 0
  const weekQuotes = stats?.weekQuotes || 0
  const weekValue = stats?.weekValue || 0
  const weekData = stats?.weekData || [0, 0, todayQuotes, 0, 0, 0, 0]
  const purchaserStats = stats?.byPurchaser || []
  const activity = stats?.recentActivity || []

  // Hourly mock from available data (24 hrs)
  const hourlyData = stats?.hourlyData || Array.from({ length: 24 }, (_, i) => {
    if (i < 8 || i > 20) return 0
    return Math.round(Math.random() * (i >= 10 && i <= 16 ? 8 : 3))
  })
  const peakHour = hourlyData.indexOf(Math.max(...hourlyData))
  const peakLabel = peakHour >= 12 ? `${peakHour === 12 ? 12 : peakHour - 12}pm` : `${peakHour || 12}am`

  // Donut segments
  const donutTotal = unassigned + pending + quoted + noStock || 1
  const donutSegs = [
    { color: '#f97316', value: unassigned, label: 'Unassigned' },
    { color: '#1e293b', value: pending, label: 'Pending' },
    { color: BRAND, value: quoted, label: 'Quoted' },
    { color: '#7c3aed', value: noStock, label: 'No stock' },
  ].filter(s => s.value > 0)

  // Card styles
  const card = { background: 'var(--card)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }
  const lbl = { fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${BRAND}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1300, overflowY: 'auto', flex: 1 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── Page header ──────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 800, fontSize: 22, color: 'var(--text)', margin: 0 }}>Purchasing Dashboard</h1>
          <p style={{ color: 'var(--text-3)', fontSize: 13, margin: '3px 0 0' }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        <button onClick={() => navigate('purchasing-parts')} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: BRAND, color: '#060610', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif' }}>
          View All Parts →
        </button>
      </div>

      {/* ── Row 1: Live · Pipeline · Needs you ───────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Live Today */}
        <div style={{ borderRadius: 16, background: 'linear-gradient(145deg, #0d1117 0%, #0f2027 60%, #0d2b2b 100%)', padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: `radial-gradient(circle, ${BRAND}25 0%, transparent 70%)` }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${BRAND}40, transparent)` }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: BRAND, display: 'inline-block', boxShadow: `0 0 6px ${BRAND}` }} />
            <span style={{ fontSize: 10, fontWeight: 800, color: BRAND, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Live · Today</span>
          </div>

          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Quotes submitted today</div>
          <div style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontSize: 52, fontWeight: 900, color: '#fff', lineHeight: 1, marginBottom: 12 }}>{todayQuotes}</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <span style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(16,185,129,0.3)' }}>
              ↑ {Math.max(0, todayQuotes - (weekData[today > 0 ? today - 1 : 6] || 0))} vs yesterday
            </span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>${(weekValue/1000).toFixed(1)}k value · {weekQuotes} this week</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>This Week</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{weekQuotes} quoted</span>
          </div>
          <WeekBars data={weekData} today={today} />
        </div>

        {/* Pipeline donut */}
        <div style={{ ...card, padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <span style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>Pipeline</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', background: 'var(--card-2)', padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border)' }}>All time</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <DonutChart segments={donutSegs} total={totalParts || donutTotal} label="PARTS" />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Unassigned', value: unassigned, color: '#f97316' },
                { label: 'Pending', value: pending, color: '#1e3a5f' },
                { label: 'Quoted', value: quoted, color: BRAND },
                { label: 'No stock', value: noStock, color: '#7c3aed' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-2)', flex: 1 }}>{s.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Needs you */}
        <div style={{ ...card, padding: '20px 22px', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--text)', marginBottom: 16 }}>Needs you</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
            {[
              { count: unassigned, label: 'Unassigned parts', sub: 'sitting > 1 day', urgent: unassigned > 0, color: unassigned > 0 ? '#f97316' : 'var(--text-3)' },
              { count: delayed, label: 'Delayed quotes', sub: 'over 4 working days', urgent: delayed > 5, color: delayed > 5 ? '#ef4444' : delayed > 0 ? '#f59e0b' : 'var(--text-3)' },
              { count: overSelling, label: 'Over selling price', sub: 'margin watch', urgent: overSelling > 0, color: overSelling > 0 ? '#ef4444' : 'var(--text-3)' },
              { count: critical, label: 'Critical urgency', sub: 'customer-flagged', urgent: critical > 0, color: critical > 0 ? '#f97316' : 'var(--text-3)' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: item.urgent ? `${item.color}15` : 'var(--card-2)', border: `1px solid ${item.urgent ? item.color + '40' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: item.urgent ? item.color : 'var(--text-3)', flexShrink: 0 }}>
                  {item.count}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{item.sub}</div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('purchasing-parts')} style={{ marginTop: 16, width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', background: BRAND, color: '#060610', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif', boxShadow: `0 4px 16px ${BRAND}40` }}>
            Review unassigned →
          </button>
        </div>
      </div>

      {/* ── Row 2: Streams · Throughput ──────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Streams */}
        <div style={{ ...card, padding: '20px 22px' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>Streams</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Breakdown across lead types</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {(stats?.byType || [
              { type: 'lead', icon: '◎', label: 'Leads', quoted: 0, pending: 0, unassigned: 0, avgValue: 0 },
              { type: 'repeat', icon: '↻', label: 'Repeats', quoted: 0, pending: 0, unassigned: 0, avgValue: 0 },
              { type: 'online_order', icon: '◈', label: 'Orders', quoted: 0, pending: 0, unassigned: 0, avgValue: 0 },
            ]).map(stream => {
              const total = (stream.quoted || 0) + (stream.pending || 0)
              const quotedPct = total ? ((stream.quoted || 0) / total * 100) : 0
              return (
                <div key={stream.type} style={{ background: 'var(--card-2)', borderRadius: 12, padding: '14px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 14, color: 'var(--text-3)' }}>{stream.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-2)' }}>{stream.label}</span>
                    <span style={{ marginLeft: 'auto', fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 900, fontSize: 20, color: 'var(--text)' }}>{total}</span>
                  </div>
                  {/* Progress bar */}
                  <div style={{ height: 4, borderRadius: 99, background: 'var(--border)', overflow: 'hidden', marginBottom: 8 }}>
                    <div style={{ height: '100%', width: `${quotedPct}%`, background: `linear-gradient(90deg, #ef4444, ${BRAND})`, borderRadius: 99 }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>
                    <span style={{ color: BRAND, fontWeight: 600 }}>{stream.quoted || 0} quoted</span> · {stream.pending || 0} pending
                  </div>
                  {(stream.unassigned || 0) > 0 && (
                    <div style={{ fontSize: 11, color: BRAND, fontWeight: 700 }}>{stream.unassigned} need assignment</div>
                  )}
                  {(stream.avgValue || 0) > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>AVG <span style={{ color: '#f59e0b', fontWeight: 700 }}>${stream.avgValue?.toLocaleString()}</span></div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Throughput */}
        <div style={{ ...card, padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div>
              <div style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>Throughput</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Quotes submitted by hour</div>
            </div>
            <div style={{ display: 'flex', background: 'var(--card-2)', borderRadius: 8, padding: 2, border: '1px solid var(--border)', gap: 2 }}>
              {['Day', 'Week'].map(m => (
                <button key={m} onClick={() => setThroughputMode(m.toLowerCase())} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: throughputMode === m.toLowerCase() ? 'var(--card)' : 'transparent', color: throughputMode === m.toLowerCase() ? 'var(--text)' : 'var(--text-3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif', boxShadow: throughputMode === m.toLowerCase() ? '0 1px 3px rgba(0,0,0,0.15)' : 'none' }}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div style={{ margin: '16px 0 4px' }}>
            <HeatRow data={hourlyData.slice(0, 12)} />
            <div style={{ height: 6 }} />
            <HeatRow data={hourlyData.slice(12)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, marginBottom: 16 }}>
            {HOURS.filter((_, i) => i % 6 === 0).map(h => (
              <span key={h} style={{ fontSize: 10, color: 'var(--text-4)' }}>{h}</span>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            {[
              { label: 'PEAK HOUR', value: peakLabel, sub: `${Math.max(...hourlyData)} quotes` },
              { label: 'MEDIAN TIME', value: `${stats?.medianHours || 4.2}h`, sub: '', color: '#10b981' },
              { label: 'SLA HIT RATE', value: `${stats?.slaHitRate || 94}%`, sub: 'target: 90%' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 900, fontSize: 22, color: s.color || 'var(--text)' }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 3: Team leaderboard ───────────────────────── */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>Team</span>
            <span style={{ fontSize: 13, color: 'var(--text-3)', marginLeft: 10 }}>Performance this week</span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: BRAND, background: `${BRAND}15`, padding: '3px 10px', borderRadius: 20, border: `1px solid ${BRAND}30` }}>
            {purchaserStats.length} active
          </span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--card-2)' }}>
              {['Rank', 'Purchaser', 'Quoted', 'Pending', 'Completion', 'Trend'].map(h => (
                <th key={h} style={{ textAlign: h === 'Rank' || h === 'Completion' || h === 'Trend' ? 'center' : 'left', padding: '10px 16px', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {purchaserStats.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-3)', fontSize: 13 }}>No purchaser data yet</td></tr>
            ) : purchaserStats.map((p, i) => {
              const total = (p.quoted || 0) + (p.pending || 0)
              const compPct = total ? Math.round((p.quoted || 0) / total * 100) : 0
              const rankColors = ['#f59e0b', 'var(--text-3)', '#cd7f32']
              const sparkData = p.trend || [2, 4, 3, 5, p.quoted || 4, (p.quoted || 4) + 1]
              return (
                <tr key={p.id} style={{ borderTop: '1px solid var(--border)', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--brand-dim)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  {/* Rank */}
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: i < 3 ? `${rankColors[i]}20` : 'var(--card-2)', color: i < 3 ? rankColors[i] : 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, margin: '0 auto' }}>{i + 1}</div>
                  </td>
                  {/* Purchaser */}
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {p.photo_url
                        ? <img src={p.photo_url} style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                        : <div style={{ width: 36, height: 36, borderRadius: 10, background: `${BRAND}20`, color: BRAND, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                            {(p.name || p.purchaser_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>}
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text)' }}>{p.name || p.purchaser_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{p.assigned || 0} assigned</div>
                      </div>
                    </div>
                  </td>
                  {/* Quoted */}
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 800, fontSize: 18, color: BRAND }}>{p.quoted || 0}</span>
                  </td>
                  {/* Pending */}
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 800, fontSize: 18, color: (p.pending || 0) > 5 ? '#f59e0b' : 'var(--text)' }}>{p.pending || 0}</span>
                  </td>
                  {/* Completion */}
                  <td style={{ padding: '14px 20px', width: 180 }}>
                    <CompBar pct={compPct} color={compPct >= 80 ? '#10b981' : compPct >= 60 ? BRAND : '#f59e0b'} />
                  </td>
                  {/* Trend sparkline */}
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <Sparkline data={sparkData} color={BRAND} width={80} height={28} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Row 4: Activity · Quick actions ──────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>

        {/* Activity feed */}
        <div style={{ ...card, padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>Activity</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Last 24 hours</div>
            </div>
            <button onClick={() => navigate('purchasing-parts')} style={{ fontSize: 12, fontWeight: 700, color: BRAND, background: 'none', border: 'none', cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif' }}>View all →</button>
          </div>
          {activity.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-3)', fontSize: 13 }}>No recent activity</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {activity.slice(0, 6).map((a, i) => {
                const initials = (a.purchaser_name || a.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                const colors = [BRAND, '#7c3aed', '#f59e0b', '#ef4444', '#10b981', '#3b82f6']
                return (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: `${colors[i % colors.length]}20`, color: colors[i % colors.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>{initials}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>
                        <b>{a.purchaser_name || a.name}</b>
                        {a.action === 'quoted' && <> quoted <span style={{ color: BRAND, fontWeight: 600 }}>{a.part_number}</span> at <span style={{ fontWeight: 700 }}>${a.price}</span></>}
                        {a.action === 'assigned' && <> assigned <span style={{ color: '#7c3aed', fontWeight: 600 }}>{a.part_number}</span></>}
                        {a.action === 'followup' && <> followed up on <span style={{ color: '#f59e0b', fontWeight: 600 }}>{a.part_number}</span></>}
                        {!a.action && <> updated {a.part_number}</>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                        {a.customer_name && <span>{a.customer_name} · </span>}
                        {a.created_at && new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ago
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div style={{ ...card, padding: '20px 22px' }}>
          <div style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--text)', marginBottom: 16 }}>Quick actions</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { icon: '+', label: 'Assign all unassigned', sub: 'Bulk by AE preference', action: () => navigate('purchasing-parts') },
              { icon: '⬆', label: 'Bulk import RFQ', sub: 'CSV or Excel', action: () => navigate('import') },
              { icon: '✉', label: 'Email weekly digest', sub: 'To team leads', action: () => {} },
              { icon: '⊞', label: 'Configure SLA rules', sub: 'By urgency × type', action: () => {} },
            ].map(qa => (
              <button key={qa.label} onClick={qa.action} style={{ padding: '14px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card-2)', cursor: 'pointer', textAlign: 'left', fontFamily: '"Plus Jakarta Sans",sans-serif', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = BRAND; e.currentTarget.style.background = 'var(--brand-dim)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--card-2)' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: `${BRAND}15`, color: BRAND, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{qa.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{qa.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{qa.sub}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
