import { useState, useEffect } from 'react'
import { useNFT } from './NFTApp'

const AC = '#00E5CC'
const GRAD = 'linear-gradient(135deg, #00E5CC 0%, #7C3AED 100%)'

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div style={{ background:'#13131f', borderRadius:14, border:'1px solid rgba(255,255,255,0.08)', padding:'16px 20px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, left:0, width:3, height:'100%', background:color, borderRadius:'14px 0 0 14px' }} />
      <div style={{ position:'absolute', top:10, right:14, fontSize:18, opacity:0.1 }}>{icon}</div>
      <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.38)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:800, color:'#fff', fontFamily:'"Bricolage Grotesque",sans-serif' }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize:11, color:'rgba(255,255,255,0.38)', marginTop:4 }}>{sub}</div>}
    </div>
  )
}

function ProgressBar({ label, achieved, target, color }) {
  const pct = target > 0 ? Math.min(100, Math.round(achieved / target * 100)) : 0
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:12 }}>
        <span style={{ color:'rgba(255,255,255,0.6)', fontWeight:600 }}>{label}</span>
        <span style={{ fontWeight:700, color: pct >= 100 ? '#10b981' : '#fff' }}>{pct}%</span>
      </div>
      <div style={{ height:6, background:'rgba(255,255,255,0.08)', borderRadius:99, overflow:'hidden' }}>
        <div style={{ height:'100%', borderRadius:99, background: pct>=100 ? '#10b981' : color, width:`${pct}%`, transition:'width 0.8s ease', boxShadow: pct>0 ? `0 0 8px ${color}` : 'none' }} />
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:4, fontSize:10, color:'rgba(255,255,255,0.3)' }}>
        <span>${achieved?.toLocaleString()}</span>
        <span>Target: ${target?.toLocaleString()}</span>
      </div>
    </div>
  )
}

export default function NFTDashboard() {
  const { user, profile, headers, navigateTo } = useNFT()
  const [salary, setSalary] = useState(null)
  const [showSalary, setShowSalary] = useState(true)
  const [targets, setTargets] = useState([])
  const [news, setNews] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  const month = new Date().toISOString().slice(0, 7)
  const quarter = `${new Date().getFullYear()}-Q${Math.ceil((new Date().getMonth()+1)/3)}`

  useEffect(() => {
    Promise.all([
      fetch('/api/nft/salary', { headers }).then(r=>r.json()),
      fetch('/api/nft/targets', { headers }).then(r=>r.json()),
      fetch('/api/nft/news', { headers }).then(r=>r.json()),
      fetch('/api/nft/kiosk/orders', { headers }).then(r=>r.json()),
    ]).then(([sal, tgt, nws, ord]) => {
      const myMonth = Array.isArray(sal) ? sal.find(s => s.month===month && s.user_id===user?.id) : null
      setSalary(myMonth)
      const myQ = Array.isArray(tgt) ? tgt.find(t => t.quarter===quarter && (t.user_id===user?.id || user?.role==='manager')) : null
      if(myQ) setTargets([myQ])
      else if(Array.isArray(tgt)) setTargets(tgt.slice(0,3))
      setNews(Array.isArray(nws) ? nws.slice(0,3) : [])
      setOrders(Array.isArray(ord) ? ord.slice(0,5) : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const greeting = () => { const h=new Date().getHours(); return h<12?'Good morning':h<17?'Good afternoon':'Good evening' }
  const myTarget = targets.find(t => t.user_id===user?.id) || targets[0]

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}><div style={{ width:28, height:28, borderRadius:'50%', border:`2px solid ${AC}`, borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} /></div>

  return (
    <div style={{ padding:28, maxWidth:1200 }}>
      {/* Header */}
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:26, color:'#fff', margin:0 }}>
          {greeting()}, {profile?.real_name?.split(' ')[0] || user?.name} 👋
        </h1>
        <p style={{ color:'rgba(255,255,255,0.4)', fontSize:13, marginTop:4 }}>
          {new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })} · NebulaForge Technologies
        </p>
      </div>

      {/* Salary Widget */}
      <div style={{ background:'linear-gradient(135deg, rgba(0,229,204,0.12) 0%, rgba(124,58,237,0.12) 100%)', borderRadius:16, border:'1px solid rgba(0,229,204,0.2)', padding:'20px 24px', marginBottom:24, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.38)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>
            My Salary — {month}
          </div>
          <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:900, fontSize:32, color:'#fff' }}>
            {showSalary
              ? salary ? `$${(salary.base_salary + (salary.bonus||0)).toLocaleString()}` : '— Not set yet'
              : '••••••••'}
          </div>
          {showSalary && salary?.bonus > 0 && <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)', marginTop:4 }}>Base: ${salary.base_salary?.toLocaleString()} + Bonus: ${salary.bonus?.toLocaleString()}</div>}
          {showSalary && salary?.notes && <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', marginTop:3 }}>{salary.notes}</div>}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setShowSalary(!showSalary)}
            style={{ padding:'8px 18px', borderRadius:10, border:`1px solid rgba(0,229,204,0.3)`, background:'rgba(0,229,204,0.1)', color:AC, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
            {showSalary ? '🙈 Hide' : '👁 Show'}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
        <StatCard label="Current Quarter" value={quarter} color="#7c3aed" icon="📅" />
        <StatCard label="Sales Achieved" value={myTarget?.sales_achieved ? `$${myTarget.sales_achieved.toLocaleString()}` : '—'} color={AC} icon="💰" sub={myTarget?.sales_target ? `Target: $${myTarget.sales_target.toLocaleString()}` : null} />
        <StatCard label="GP Achieved" value={myTarget?.gp_achieved ? `$${myTarget.gp_achieved.toLocaleString()}` : '—'} color="#f59e0b" icon="📊" sub={myTarget?.gp_target ? `Target: $${myTarget.gp_target.toLocaleString()}` : null} />
        <StatCard label="Orders Today" value={orders.filter(o=>o.created_at?.startsWith(new Date().toISOString().split('T')[0])).length} color="#10b981" icon="🛍" sub="Kiosk & Shop" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
        {/* Targets */}
        <div style={{ background:'#13131f', borderRadius:16, border:'1px solid rgba(255,255,255,0.08)', padding:20 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:14, color:'#fff' }}>🎯 Quarterly Targets</div>
            <span style={{ fontSize:11, color:'rgba(255,255,255,0.3)' }}>{quarter}</span>
          </div>
          {!myTarget ? (
            <div style={{ textAlign:'center', padding:'24px 0', color:'rgba(255,255,255,0.3)', fontSize:13 }}>No targets set yet</div>
          ) : (
            <>
              <ProgressBar label="Sales Target" achieved={myTarget.sales_achieved||0} target={myTarget.sales_target||0} color={AC} />
              <ProgressBar label="GP Target" achieved={myTarget.gp_achieved||0} target={myTarget.gp_target||0} color="#7c3aed" />
            </>
          )}
        </div>

        {/* Recent News */}
        <div style={{ background:'#13131f', borderRadius:16, border:'1px solid rgba(255,255,255,0.08)', padding:20 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:14, color:'#fff' }}>📰 Latest News</div>
            <button onClick={() => navigateTo('news')} style={{ fontSize:11, color:AC, background:'none', border:'none', cursor:'pointer', fontWeight:600, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>View all →</button>
          </div>
          {!news.length ? <div style={{ textAlign:'center', padding:'24px 0', color:'rgba(255,255,255,0.3)', fontSize:13 }}>No news yet</div> : news.map(n => (
            <div key={n.id} onClick={() => navigateTo('news')} style={{ padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,0.05)', cursor:'pointer' }}>
              <div style={{ fontWeight:600, fontSize:13, color:'#fff', marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{n.title}</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.38)' }}>By {n.real_name} · {new Date(n.created_at).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        {[['🍕','Order Food','kiosk',AC],['🛍','Shop Products','shop','#7c3aed'],['💬','Messages','messages','#f59e0b'],['🚗','Cars','cars','#10b981']].map(([icon,label,dest,color]) => (
          <button key={dest} onClick={() => navigateTo(dest)}
            style={{ padding:'16px 12px', borderRadius:14, border:`1px solid ${color}30`, background:`${color}10`, color, fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', display:'flex', flexDirection:'column', alignItems:'center', gap:8, transition:'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background=`${color}20`; e.currentTarget.style.transform='translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.background=`${color}10`; e.currentTarget.style.transform='none' }}>
            <span style={{ fontSize:24 }}>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
