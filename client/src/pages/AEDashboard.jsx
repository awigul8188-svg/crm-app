import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { useNav } from '../App'
import { useAuth } from '../App'
import { formatDate, timeAgo, DispositionBadge } from '../components/Badges'
import NewInquiryModal from '../components/NewInquiryModal'

const BRAND = '#00D4C8'
const CHART_COLORS = ['#00D4C8','#3b82f6','#6366f1','#f59e0b','#ef4444','#10b981','#8b5cf6','#f97316']

const TYPE_ICONS  = { lead: '◎', repeat: '↻', online_order: '◈' }
const TYPE_COLORS = { lead: '#3b82f6', repeat: '#6366f1', online_order: '#f59e0b' }
const TYPE_LABELS = { lead: 'Lead', repeat: 'Repeat', online_order: 'Online Order' }

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#0d0d0d', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:'8px 12px', fontSize:12 }}>
      <div style={{ color:'rgba(255,255,255,0.6)', marginBottom:4 }}>{label}</div>
      {payload.map(p => <div key={p.name} style={{ color:p.color||BRAND, display:'flex', gap:8 }}><span>{p.name}</span><b>{p.value}</b></div>)}
    </div>
  )
}

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:'18px 20px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, left:0, width:3, height:'100%', background:color, borderRadius:'16px 0 0 16px' }} />
      <div style={{ position:'absolute', top:10, right:14, fontSize:20, opacity:0.15 }}>{icon}</div>
      <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>{label}</div>
      <div style={{ fontSize:30, fontWeight:800, color:'#0f172a', fontFamily:'"Bricolage Grotesque",sans-serif', lineHeight:1 }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize:12, color:'#94a3b8', marginTop:6 }}>{sub}</div>}
    </div>
  )
}

function SectionTitle({ children, action }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
      <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:14, color:'#0f172a' }}>{children}</div>
      {action}
    </div>
  )
}

function FollowupRow({ fu, onNavigate, onComplete }) {
  const [completing, setCompleting] = useState(false)
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid #f8fafc', cursor:'pointer' }}
      onClick={() => onNavigate('inquiry-detail', { id: fu.inquiry_id })}>
      <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0, background: fu.overdue ? '#ef4444' : BRAND }} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:600, fontSize:13, color:'#0f172a' }}>{fu.customer_name}</div>
        <div style={{ fontSize:12, color:'#64748b', marginTop:1 }}>{fu.note}</div>
      </div>
      <div style={{ textAlign:'right', flexShrink:0 }}>
        <div style={{ fontSize:11, fontWeight:700, color: fu.overdue ? '#ef4444' : BRAND }}>{formatDate(fu.follow_up_date)}</div>
      </div>
      <button onClick={async e => { e.stopPropagation(); setCompleting(true); await fetch(`/api/notifications/followup/${fu.id}/complete`, { method:'PATCH', headers:{ Authorization:`Bearer ${localStorage.getItem('crm_token')}` }}); onComplete() }}
        disabled={completing}
        style={{ width:28, height:28, borderRadius:8, border:'2px dashed #cbd5e1', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.15s', fontSize:12, color:'#94a3b8' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor=BRAND; e.currentTarget.style.background=`${BRAND}12` }}
        onMouseLeave={e => { e.currentTarget.style.borderColor='#cbd5e1'; e.currentTarget.style.background='transparent' }}>
        {completing ? '...' : '✓'}
      </button>
    </div>
  )
}

export default function AEDashboard() {
  const { user } = useAuth()
  const { navigate } = useNav()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [newModal, setNewModal] = useState(null) // 'lead' | 'repeat' | 'online_order'

  const load = () => {
    setLoading(true)
    fetch('/api/analytics/ae', { headers: { Authorization: `Bearer ${localStorage.getItem('crm_token')}` } })
      .then(r => r.json()).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }

  const totalFollowupsUrgent = data ? data.followups.overdue.length + data.followups.today.length : 0

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
      <div style={{ width:36, height:36, borderRadius:'50%', border:`2px solid ${BRAND}`, borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <div style={{ padding:32, maxWidth:1200, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
      <style>{`@keyframes spin { to { transform:rotate(360deg); } } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>

      {/* Header + Quick Actions */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:28, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:26, color:'#0f172a', margin:0 }}>
            {greeting()}, {user.name} 👋
          </h1>
          <p style={{ color:'#94a3b8', fontSize:14, marginTop:4 }}>
            {new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}
          </p>
        </div>
        {/* Quick action buttons */}
        <div style={{ display:'flex', gap:8 }}>
          {[['◎ New Lead','lead','#3b82f6'],['↻ New Repeat','repeat','#6366f1'],['◈ New Order','online_order','#f59e0b']].map(([label,type,color]) => (
            <button key={type} onClick={() => setNewModal(type)}
              style={{ padding:'9px 16px', borderRadius:12, border:`1px solid ${color}30`, background:`${color}10`, color, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', transition:'all 0.15s', whiteSpace:'nowrap' }}
              onMouseEnter={e => { e.currentTarget.style.background=color; e.currentTarget.style.color='#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background=`${color}10`; e.currentTarget.style.color=color }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Today section ── */}
      <div style={{ marginBottom:8 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>Today</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:28 }}>
          <StatCard label="Leads Today" value={data.today.leads} color="#3b82f6" icon="◎"
            sub={<button onClick={() => navigate('leads')} style={{ color:BRAND, background:'none', border:'none', cursor:'pointer', fontSize:12, padding:0, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>View my leads →</button>} />
          <StatCard label="Repeat Today" value={data.today.repeat} color="#6366f1" icon="↻"
            sub={<button onClick={() => navigate('repeat')} style={{ color:BRAND, background:'none', border:'none', cursor:'pointer', fontSize:12, padding:0, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>View my repeat →</button>} />
          <StatCard label="Orders Today" value={data.today.orders} color="#f59e0b" icon="◈"
            sub={<button onClick={() => navigate('orders')} style={{ color:BRAND, background:'none', border:'none', cursor:'pointer', fontSize:12, padding:0, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>View my orders →</button>} />
        </div>
      </div>

      {/* ── Urgent followups banner ── */}
      {totalFollowupsUrgent > 0 && (
        <div onClick={() => navigate('notifications')} style={{ background:'linear-gradient(135deg, #fef3c7, #fde68a)', border:'1px solid #fbbf24', borderRadius:14, padding:'14px 20px', marginBottom:24, cursor:'pointer', display:'flex', alignItems:'center', gap:12, transition:'all 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 16px rgba(251,191,36,0.3)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow='none'}>
          <span style={{ fontSize:22 }}>⚠️</span>
          <div>
            <div style={{ fontWeight:700, fontSize:14, color:'#92400e' }}>
              {data.followups.overdue.length > 0 && `${data.followups.overdue.length} overdue follow-up${data.followups.overdue.length !== 1 ? 's' : ''}`}
              {data.followups.overdue.length > 0 && data.followups.today.length > 0 && ' · '}
              {data.followups.today.length > 0 && `${data.followups.today.length} due today`}
            </div>
            <div style={{ fontSize:12, color:'#b45309', marginTop:2 }}>Click to view all follow-ups →</div>
          </div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
        {/* ── My Performance ── */}
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:20 }}>
          <SectionTitle>📊 My Performance</SectionTitle>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:16 }}>
            {[
              ['This Month', data.month.won, data.month.total, data.month.win_rate, '#10b981'],
              ['This Year',  data.year.won,  data.year.total,  data.year.win_rate,  BRAND],
              ['All Time',   data.all.won,   data.all.total,   data.all.win_rate,   '#6366f1'],
            ].map(([label, won, total, rate, color]) => (
              <div key={label} style={{ background:'#f8fafc', borderRadius:12, padding:'12px 14px', textAlign:'center', border:'1px solid #f1f5f9' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>{label}</div>
                <div style={{ fontSize:22, fontWeight:800, color, fontFamily:'"Bricolage Grotesque",sans-serif' }}>{won}</div>
                <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>won of {total}</div>
                <div style={{ marginTop:8, height:4, background:'#e2e8f0', borderRadius:4 }}>
                  <div style={{ height:'100%', borderRadius:4, background:color, width:`${rate}%` }} />
                </div>
                <div style={{ fontSize:11, fontWeight:700, color, marginTop:4 }}>{rate}% win rate</div>
              </div>
            ))}
          </div>

          {/* Weekly trend */}
          {data.weeklyTrend?.length > 0 && (
            <>
              <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>10-Week Trend</div>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={data.weeklyTrend.map((w,i) => ({ ...w, week: `W${i+1}` }))}>
                  <XAxis dataKey="week" tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<Tip />} />
                  <Line type="monotone" dataKey="total" name="Total" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="won" name="Won" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </div>

        {/* ── My Pipeline ── */}
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:20 }}>
          <SectionTitle>🔄 My Active Pipeline</SectionTitle>
          {!data.pipeline?.length ? (
            <div style={{ textAlign:'center', color:'#94a3b8', padding:'32px 0', fontSize:14 }}>No active pipeline items</div>
          ) : (
            <div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={data.pipeline.slice(0,7)} layout="vertical" barSize={12}>
                  <XAxis type="number" tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="disposition" tick={{ fontSize:10, fill:'#475569' }} axisLine={false} tickLine={false} width={110} />
                  <Tooltip content={<Tip />} />
                  <Bar dataKey="count" name="Count" fill={BRAND} radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:12 }}>
                {data.pipeline.map((p, i) => (
                  <div key={p.disposition} style={{ display:'flex', alignItems:'center', gap:6, background:'#f8fafc', borderRadius:8, padding:'5px 10px', fontSize:12 }}>
                    <span style={{ width:8, height:8, borderRadius:'50%', background:CHART_COLORS[i%CHART_COLORS.length], flexShrink:0 }} />
                    <span style={{ color:'#475569' }}>{p.disposition}</span>
                    <span style={{ fontWeight:700, color:'#0f172a' }}>{p.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
        {/* ── Follow-ups ── */}
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:20 }}>
          <SectionTitle>
            📅 My Follow-ups
            <button onClick={() => navigate('notifications')} style={{ fontSize:11, color:BRAND, background:'none', border:'none', cursor:'pointer', fontWeight:600, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>View all →</button>
          </SectionTitle>

          {data.followups.overdue.length === 0 && data.followups.today.length === 0 && data.followups.upcoming.length === 0 ? (
            <div style={{ textAlign:'center', color:'#94a3b8', padding:'24px 0', fontSize:14 }}>✅ All caught up!</div>
          ) : (
            <div>
              {data.followups.overdue.length > 0 && (
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Overdue</div>
                  {data.followups.overdue.map(fu => <FollowupRow key={fu.id} fu={{ ...fu, overdue: true }} onNavigate={navigate} onComplete={load} />)}
                </div>
              )}
              {data.followups.today.length > 0 && (
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Due Today</div>
                  {data.followups.today.map(fu => <FollowupRow key={fu.id} fu={fu} onNavigate={navigate} onComplete={load} />)}
                </div>
              )}
              {data.followups.upcoming.length > 0 && (
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:BRAND, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>This Week</div>
                  {data.followups.upcoming.slice(0,3).map(fu => <FollowupRow key={fu.id} fu={fu} onNavigate={navigate} onComplete={load} />)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Needs Attention ── */}
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:20 }}>
          <SectionTitle>
            🔔 Needs Attention
            <span style={{ fontSize:11, color:'#94a3b8' }}>No activity in 7+ days</span>
          </SectionTitle>

          {!data.untouched?.length ? (
            <div style={{ textAlign:'center', color:'#94a3b8', padding:'24px 0', fontSize:14 }}>✅ Everything is up to date!</div>
          ) : (
            <div>
              {data.untouched.map(inq => (
                <div key={inq.id} onClick={() => navigate('inquiry-detail', { id: inq.id })}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid #f8fafc', cursor:'pointer', transition:'all 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.paddingLeft='6px'}
                  onMouseLeave={e => e.currentTarget.style.paddingLeft='0'}>
                  <div style={{ width:32, height:32, borderRadius:8, background:`${TYPE_COLORS[inq.type]}18`, color:TYPE_COLORS[inq.type], display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0 }}>
                    {TYPE_ICONS[inq.type]}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:13, color:'#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{inq.customer_name}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
                      <DispositionBadge disposition={inq.disposition} />
                      {inq.customer_company && <span style={{ fontSize:11, color:'#94a3b8' }}>{inq.customer_company}</span>}
                    </div>
                  </div>
                  <div style={{ fontSize:11, color:'#94a3b8', flexShrink:0 }}>
                    {inq.last_activity ? `Last: ${timeAgo(inq.last_activity)}` : `Created ${timeAgo(inq.created_at)}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Activity ── */}
      <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:20 }}>
        <SectionTitle>🕐 My Recent Activity</SectionTitle>
        {!data.recentActivity?.length ? (
          <div style={{ textAlign:'center', color:'#94a3b8', padding:'24px 0' }}>No recent activity</div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:0 }}>
            {data.recentActivity.map((a, i) => (
              <div key={a.id} onClick={() => navigate('inquiry-detail', { id: a.entity_id })}
                style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 12px', cursor:'pointer', background:i%2===0?'#fff':'#fafbfc', borderRadius:10, transition:'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background=`${BRAND}08`}
                onMouseLeave={e => e.currentTarget.style.background=i%2===0?'#fff':'#fafbfc'}>
                <div style={{ width:8, height:8, borderRadius:'50%', background: TYPE_COLORS[a.inquiry_type]||'#94a3b8', flexShrink:0, marginTop:5 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                    <span style={{ fontSize:12, fontWeight:600, color:'#0f172a' }}>{a.action}</span>
                    <span style={{ fontSize:11, color:'#64748b' }}>on</span>
                    <span style={{ fontSize:12, fontWeight:600, color:BRAND, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:120 }}>{a.customer_name}</span>
                  </div>
                  {a.comment && <div style={{ fontSize:11, color:'#64748b', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.comment}</div>}
                  <div style={{ fontSize:10, color:'#94a3b8', marginTop:2 }}>{timeAgo(a.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New inquiry modal */}
      {newModal && (
        <NewInquiryModal
          defaultType={newModal}
          onClose={() => setNewModal(null)}
          onCreated={() => { setNewModal(null); load() }}
        />
      )}
    </div>
  )
}
