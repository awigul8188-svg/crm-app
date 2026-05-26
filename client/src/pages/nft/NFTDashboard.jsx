import { useState, useEffect } from 'react'
import { useNFT, C } from './NFTApp'

function StatCard({ label, value, sub, accent, icon }) {
  return (
    <div style={{ background:C.card, borderRadius:14, border:`1px solid ${C.border}`, padding:'16px 20px', boxShadow:'0 1px 4px rgba(0,0,0,0.06)', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, left:0, width:4, height:'100%', background:accent, borderRadius:'14px 0 0 14px' }} />
      <div style={{ fontSize:28, marginBottom:8, opacity:0.15, position:'absolute', top:10, right:14 }}>{icon}</div>
      <div style={{ fontSize:10, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:800, color:C.black, fontFamily:'"Bricolage Grotesque",sans-serif' }}>{value||'—'}</div>
      {sub && <div style={{ fontSize:11, color:C.gray, marginTop:4 }}>{sub}</div>}
    </div>
  )
}

function ProgressRing({ pct, color, size=64 }) {
  const r = (size-8)/2, circ = 2*Math.PI*r
  return (
    <svg width={size} height={size} style={{ flexShrink:0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={4} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4} strokeDasharray={circ} strokeDashoffset={circ*(1-Math.min(pct,100)/100)} strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition:'stroke-dashoffset 0.8s ease' }} />
      <text x={size/2} y={size/2+5} textAnchor="middle" fontSize={12} fontWeight={800} fill={color}>{Math.round(pct)}%</text>
    </svg>
  )
}

export default function NFTDashboard() {
  const { user, headers, setPage } = useNFT()
  const [salary, setSalary] = useState(null)
  const [showSalary, setShowSalary] = useState(true)
  const [targets, setTargets] = useState(null)
  const [news, setNews] = useState([])
  const [orders, setOrders] = useState([])

  const month = new Date().toISOString().slice(0,7)
  const quarter = `${new Date().getFullYear()}-Q${Math.ceil((new Date().getMonth()+1)/3)}`
  const greeting = () => { const h=new Date().getHours(); return h<12?'Good morning':h<17?'Good afternoon':'Good evening' }

  useEffect(() => {
    Promise.all([
      fetch('/api/nft/salary', { headers }).then(r=>r.json()),
      fetch('/api/nft/targets', { headers }).then(r=>r.json()),
      fetch('/api/nft/news', { headers }).then(r=>r.json()),
      fetch('/api/nft/kiosk/orders', { headers }).then(r=>r.json()),
    ]).then(([sal, tgt, nws, ord]) => {
      const mySal = Array.isArray(sal) ? sal.find(s=>s.month===month&&s.user_id===user?.id) : null
      setSalary(mySal)
      const myTgt = Array.isArray(tgt) ? tgt.find(t=>t.quarter===quarter&&t.user_id===user?.id) : null
      setTargets(myTgt)
      setNews(Array.isArray(nws) ? nws.slice(0,3) : [])
      setOrders(Array.isArray(ord) ? ord.filter(o=>o.user_id===user?.id).slice(0,3) : [])
    }).catch(()=>{})
  }, [])

  const salesPct = targets?.sales_target>0 ? Math.round(targets.sales_achieved/targets.sales_target*100) : 0
  const gpPct = targets?.gp_target>0 ? Math.round(targets.gp_achieved/targets.gp_target*100) : 0

  return (
    <div style={{ padding:28, maxWidth:1100 }}>
      {/* Header */}
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:900, fontSize:26, color:C.black, margin:0 }}>
          {greeting()}, {user?.real_name?.split(' ')[0]} 👋
        </h1>
        <p style={{ color:C.gray, fontSize:13, marginTop:4 }}>{new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})} · NebulaForge Technologies</p>
      </div>

      {/* Salary widget */}
      <div style={{ background:`linear-gradient(135deg, ${C.teal}18 0%, ${C.lavender}18 100%)`, borderRadius:16, border:`1px solid ${C.teal}40`, padding:'20px 24px', marginBottom:24, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>My Salary · {month}</div>
          <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:900, fontSize:30, color:C.black }}>
            {showSalary ? (salary ? `$${((salary.base_salary||0)+(salary.bonus||0)).toLocaleString()}` : '— Not set yet') : '••••••••'}
          </div>
          {showSalary && salary?.bonus>0 && <div style={{ fontSize:12, color:C.gray, marginTop:3 }}>Base ${salary.base_salary?.toLocaleString()} + Bonus ${salary.bonus?.toLocaleString()}</div>}
        </div>
        <button onClick={()=>setShowSalary(!showSalary)} style={{ padding:'8px 20px', borderRadius:10, border:`1.5px solid ${C.teal}`, background:'#fff', color:C.tealDark, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
          {showSalary?'🙈 Hide':'👁 Show'}
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
        <StatCard label="Quarter" value={quarter} accent={C.teal} icon="📅" />
        <StatCard label="Sales Achieved" value={targets?.sales_achieved?`$${targets.sales_achieved.toLocaleString()}`:'—'} sub={targets?.sales_target?`Target: $${targets.sales_target.toLocaleString()}`:'No target set'} accent={C.lavender} icon="💰" />
        <StatCard label="GP Achieved" value={targets?.gp_achieved?`$${targets.gp_achieved.toLocaleString()}`:'—'} sub={targets?.gp_target?`Target: $${targets.gp_target.toLocaleString()}`:'No target set'} accent={C.pink} icon="📊" />
        <StatCard label="Orders" value={orders.length} sub="Kiosk this month" accent={C.tealDark} icon="🛍" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
        {/* Targets */}
        <div style={{ background:C.card, borderRadius:16, border:`1px solid ${C.border}`, padding:22, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:15, color:C.black, marginBottom:18 }}>🎯 Quarterly Targets</div>
          {!targets ? <div style={{ textAlign:'center', padding:'24px 0', color:C.gray, fontSize:13 }}>No targets set for {quarter}</div> : (
            <div style={{ display:'flex', gap:24, alignItems:'center' }}>
              <div style={{ textAlign:'center' }}>
                <ProgressRing pct={salesPct} color={C.teal} />
                <div style={{ fontSize:12, fontWeight:600, color:C.dark, marginTop:6 }}>Sales</div>
                <div style={{ fontSize:11, color:C.gray }}>Target: ${targets.sales_target?.toLocaleString()}</div>
              </div>
              <div style={{ textAlign:'center' }}>
                <ProgressRing pct={gpPct} color={C.lavender} />
                <div style={{ fontSize:12, fontWeight:600, color:C.dark, marginTop:6 }}>GP</div>
                <div style={{ fontSize:11, color:C.gray }}>Target: ${targets.gp_target?.toLocaleString()}</div>
              </div>
              <div style={{ flex:1 }}>
                {salesPct>=100 && <div style={{ fontSize:13, fontWeight:700, color:C.tealDark, marginBottom:6 }}>🎉 Sales target achieved!</div>}
                {gpPct>=100 && <div style={{ fontSize:13, fontWeight:700, color:C.lavender }}>🎉 GP target achieved!</div>}
                {salesPct<100 && <div style={{ fontSize:12, color:C.gray }}>Need ${((targets.sales_target||0)-(targets.sales_achieved||0)).toLocaleString()} more in sales</div>}
              </div>
            </div>
          )}
        </div>

        {/* News */}
        <div style={{ background:C.card, borderRadius:16, border:`1px solid ${C.border}`, padding:22, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:15, color:C.black }}>📰 Latest News</div>
            <button onClick={()=>setPage('news')} style={{ fontSize:11, color:C.tealDark, background:'none', border:'none', cursor:'pointer', fontWeight:700, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>View all →</button>
          </div>
          {!news.length ? <div style={{ textAlign:'center', padding:'24px 0', color:C.gray, fontSize:13 }}>No news yet</div> : news.map(n => (
            <div key={n.id} onClick={()=>setPage('news')} style={{ padding:'10px 0', borderBottom:`1px solid ${C.border}`, cursor:'pointer' }}>
              <div style={{ fontWeight:600, fontSize:13, color:C.dark, marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{n.title}</div>
              <div style={{ fontSize:11, color:C.gray }}>By {n.real_name} · {new Date(n.created_at).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        {[['🍕','Order Food','kiosk',C.teal],['🛍','Shop Products','shop',C.lavender],['💬','Messages','messages',C.pink],['🚗','Cars','cars',C.gray]].map(([icon,label,dest,color]) => (
          <button key={dest} onClick={()=>setPage(dest)} style={{ padding:'16px 12px', borderRadius:14, border:`1.5px solid ${color}30`, background:`${color}10`, color, fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', display:'flex', flexDirection:'column', alignItems:'center', gap:8, transition:'all 0.15s', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}
            onMouseEnter={e=>{e.currentTarget.style.background=`${color}20`;e.currentTarget.style.transform='translateY(-2px)'}}
            onMouseLeave={e=>{e.currentTarget.style.background=`${color}10`;e.currentTarget.style.transform='none'}}>
            <span style={{ fontSize:24 }}>{icon}</span><span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
