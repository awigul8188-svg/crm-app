import { useState, useEffect } from 'react'
import { TrendingUp } from 'lucide-react'

const BRAND = '#00D4C8'
// 'Jun-26' -> 'Jun'
const monthLabel = p => String(p || '').split('-')[0]
const money = n => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString()}`

// Per-rep GP for the running quarter, by month. Each user sees only their own numbers
// (server scopes to the logged-in rep). Resets automatically each quarter.
export default function QuarterGPTile() {
  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch('/api/operations/my-gp', { headers: { Authorization: `Bearer ${localStorage.getItem('crm_token')}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setData).catch(() => setFailed(true))
  }, [])

  if (failed || !data) return null
  const max = Math.max(1, ...data.months.map(m => Math.abs(m.gp)))

  return (
    <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', padding:18 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <TrendingUp size={15} style={{ color:BRAND }} />
          <span style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:14, color:'#0f172a' }}>My GP This Quarter</span>
        </div>
        <span style={{ fontSize:11, fontWeight:700, color:'#64748b', background:'#f1f5f9', borderRadius:8, padding:'3px 9px', whiteSpace:'nowrap' }}>{data.quarter}</span>
      </div>

      <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:16 }}>
        <span style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:900, fontSize:34, lineHeight:1, color: data.total_gp >= 0 ? '#10b981' : '#ef4444', fontVariantNumeric:'tabular-nums' }}>{money(data.total_gp)}</span>
        <span style={{ fontSize:12, color:'#94a3b8' }}>quarter to date</span>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {data.months.map(m => {
          const pct = Math.round(Math.abs(m.gp) / max * 100)
          const pos = m.gp >= 0
          return (
            <div key={m.month}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:4 }}>
                <span style={{ fontSize:12, color:'#475569', fontWeight:600 }}>{monthLabel(m.month)}</span>
                <span style={{ display:'flex', alignItems:'baseline', gap:6 }}>
                  <span style={{ fontSize:13, fontWeight:700, color: pos ? '#0f172a' : '#ef4444', fontVariantNumeric:'tabular-nums' }}>{money(m.gp)}</span>
                  <span style={{ fontSize:11, color:'#94a3b8' }}>{m.order_count} {m.order_count === 1 ? 'order' : 'orders'}</span>
                </span>
              </div>
              <div style={{ height:6, background:'#f1f5f9', borderRadius:6 }}>
                <div style={{ height:'100%', borderRadius:6, background: pos ? BRAND : '#ef4444', width:`${pct}%`, transition:'width 0.4s ease' }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
