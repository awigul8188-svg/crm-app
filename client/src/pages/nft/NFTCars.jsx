import { C } from './NFTContext'
export default function NFTCars() {
  return (
    <div style={{ padding:28, maxWidth:900 }}>
      <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:900, fontSize:22, color:C.black, marginBottom:8 }}>🚗 Cars Incentive</h1>
      <p style={{ color:C.gray, marginBottom:32, fontSize:13 }}>Earn a car by hitting your quarterly sales targets</p>
      <div style={{ background:C.card, borderRadius:16, border:`1.5px solid ${C.teal}40`, padding:'48px', textAlign:'center', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize:72, marginBottom:16 }}>🚗</div>
        <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:900, fontSize:22, color:C.black, marginBottom:10 }}>Coming Soon</div>
        <p style={{ color:C.gray, fontSize:14, maxWidth:400, margin:'0 auto', lineHeight:1.7 }}>
          The car incentive program is being configured. Your targets and eligible vehicles will appear here once set up by management.
        </p>
        <div style={{ marginTop:24, display:'inline-flex', alignItems:'center', gap:6, padding:'8px 20px', borderRadius:20, background:`${C.teal}15`, color:C.tealDark, fontSize:12, fontWeight:700, border:`1px solid ${C.teal}40` }}>
          ✦ Hit your targets to unlock rewards
        </div>
      </div>
    </div>
  )
}
