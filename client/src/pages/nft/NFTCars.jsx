import { useNFT } from './NFTApp'
const AC='#00E5CC'
export default function NFTCars() {
  return (
    <div style={{ padding:28, maxWidth:900 }}>
      <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:22, color:'#fff', marginBottom:8 }}>🚗 Cars Incentive</h1>
      <p style={{ color:'rgba(255,255,255,0.4)', marginBottom:32 }}>Earn a car by hitting your sales targets</p>
      <div style={{ background:'linear-gradient(135deg,rgba(0,229,204,0.08),rgba(124,58,237,0.08))', borderRadius:16, border:'1px solid rgba(0,229,204,0.15)', padding:'40px 48px', textAlign:'center' }}>
        <div style={{ fontSize:72, marginBottom:16 }}>🚗</div>
        <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:22, color:'#fff', marginBottom:10 }}>Coming Soon</div>
        <p style={{ color:'rgba(255,255,255,0.4)', fontSize:14, maxWidth:400, margin:'0 auto' }}>The car incentive program is being configured. Your targets and eligible vehicles will appear here once set up by management.</p>
      </div>
    </div>
  )
}
