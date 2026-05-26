import { useState, useEffect } from 'react'
import { useNFT } from './NFTApp'
const AC='#00E5CC'
export default function NFTAdmin() {
  const { user, profile, headers } = useNFT()
  const [tab, setTab] = useState('salary'); const [users, setUsers] = useState([])
  const [form, setForm] = useState({ user_id:'', month:new Date().toISOString().slice(0,7), base_salary:'', bonus:'', notes:'' })
  const [tForm, setTForm] = useState({ user_id:'', quarter:`${new Date().getFullYear()}-Q${Math.ceil((new Date().getMonth()+1)/3)}`, sales_target:'', gp_target:'', sales_achieved:'', gp_achieved:'' })
  const [saving, setSaving] = useState(false); const [salaries, setSalaries] = useState([]); const [targets, setTargets] = useState([])
  const loadData = () => {
    fetch('/api/nft/profiles', { headers }).then(r=>r.json()).then(d=>setUsers(Array.isArray(d)?d:[]))
    fetch('/api/nft/salary', { headers }).then(r=>r.json()).then(d=>setSalaries(Array.isArray(d)?d:[]))
    fetch('/api/nft/targets', { headers }).then(r=>r.json()).then(d=>setTargets(Array.isArray(d)?d:[]))
  }
  useEffect(() => { loadData() }, [])
  const inp = { width:'100%', padding:'9px 12px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.06)', color:'#fff', fontSize:13, fontFamily:'"Plus Jakarta Sans",sans-serif', outline:'none' }
  const saveSalary = async () => {
    setSaving(true)
    await fetch('/api/nft/salary', { method:'POST', headers:{...headers,'Content-Type':'application/json'}, body:JSON.stringify(form) })
    setSaving(false); loadData()
  }
  const saveTarget = async () => {
    setSaving(true)
    await fetch('/api/nft/targets', { method:'POST', headers:{...headers,'Content-Type':'application/json'}, body:JSON.stringify(tForm) })
    setSaving(false); loadData()
  }
  return (
    <div style={{ padding:28, maxWidth:1000 }}>
      <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:22, color:'#fff', marginBottom:20 }}>⚙ Admin Panel</h1>
      <div style={{ display:'flex', gap:2, background:'rgba(255,255,255,0.06)', borderRadius:10, padding:3, marginBottom:24, width:'fit-content' }}>
        {['salary','targets','employees'].map(t=><button key={t} onClick={()=>setTab(t)} style={{ padding:'7px 18px', borderRadius:7, border:'none', background:tab===t?AC:'transparent', color:tab===t?'#060610':'rgba(255,255,255,0.5)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', textTransform:'capitalize' }}>{t}</button>)}
      </div>
      {tab==='salary' && (
        <div>
          <div style={{ background:'#13131f', borderRadius:14, border:'1px solid rgba(255,255,255,0.08)', padding:20, marginBottom:20 }}>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:14, color:'#fff', marginBottom:14 }}>Set Salary</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:10 }}>
              <select value={form.user_id} onChange={e=>setForm(f=>({...f,user_id:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                <option value="">Select Employee</option>
                {users.map(u=><option key={u.user_id} value={u.user_id}>{u.real_name}</option>)}
              </select>
              <input type="month" value={form.month} onChange={e=>setForm(f=>({...f,month:e.target.value}))} style={inp} />
              <input type="number" placeholder="Base Salary $" value={form.base_salary} onChange={e=>setForm(f=>({...f,base_salary:e.target.value}))} style={inp} />
              <input type="number" placeholder="Bonus $" value={form.bonus} onChange={e=>setForm(f=>({...f,bonus:e.target.value}))} style={inp} />
              <input placeholder="Notes" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={inp} />
            </div>
            <button onClick={saveSalary} disabled={saving} style={{ padding:'9px 24px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#00E5CC,#7C3AED)', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>{saving?'Saving...':'Save Salary'}</button>
          </div>
          <div style={{ background:'#13131f', borderRadius:14, border:'1px solid rgba(255,255,255,0.08)', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:'rgba(255,255,255,0.04)', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                {['Employee','Month','Base Salary','Bonus','Total','Notes'].map(h=><th key={h} style={{ textAlign:'left', padding:'10px 14px', fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{h}</th>)}
              </tr></thead>
              <tbody>{salaries.map((s,i)=>(
                <tr key={s.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.05)', background:i%2===0?'transparent':'rgba(255,255,255,0.02)' }}>
                  <td style={{ padding:'10px 14px', fontWeight:600, color:'#fff' }}>{s.real_name}</td>
                  <td style={{ padding:'10px 14px', color:'rgba(255,255,255,0.5)' }}>{s.month}</td>
                  <td style={{ padding:'10px 14px', color:AC, fontWeight:700 }}>${s.base_salary?.toLocaleString()}</td>
                  <td style={{ padding:'10px 14px', color:'#f59e0b', fontWeight:700 }}>{s.bonus?`$${s.bonus?.toLocaleString()}`:'—'}</td>
                  <td style={{ padding:'10px 14px', color:'#10b981', fontWeight:800 }}>${((s.base_salary||0)+(s.bonus||0)).toLocaleString()}</td>
                  <td style={{ padding:'10px 14px', color:'rgba(255,255,255,0.4)', fontSize:12 }}>{s.notes||'—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
      {tab==='targets' && (
        <div>
          <div style={{ background:'#13131f', borderRadius:14, border:'1px solid rgba(255,255,255,0.08)', padding:20, marginBottom:20 }}>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:14, color:'#fff', marginBottom:14 }}>Set Quarterly Targets</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:10 }}>
              <select value={tForm.user_id} onChange={e=>setTForm(f=>({...f,user_id:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                <option value="">Select Employee</option>
                {users.map(u=><option key={u.user_id} value={u.user_id}>{u.real_name}</option>)}
              </select>
              <input placeholder="Quarter e.g. 2026-Q1" value={tForm.quarter} onChange={e=>setTForm(f=>({...f,quarter:e.target.value}))} style={inp} />
              <input type="number" placeholder="Sales Target $" value={tForm.sales_target} onChange={e=>setTForm(f=>({...f,sales_target:e.target.value}))} style={inp} />
              <input type="number" placeholder="GP Target $" value={tForm.gp_target} onChange={e=>setTForm(f=>({...f,gp_target:e.target.value}))} style={inp} />
              <input type="number" placeholder="Sales Achieved $" value={tForm.sales_achieved} onChange={e=>setTForm(f=>({...f,sales_achieved:e.target.value}))} style={inp} />
              <input type="number" placeholder="GP Achieved $" value={tForm.gp_achieved} onChange={e=>setTForm(f=>({...f,gp_achieved:e.target.value}))} style={inp} />
            </div>
            <button onClick={saveTarget} disabled={saving} style={{ padding:'9px 24px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#00E5CC,#7C3AED)', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>{saving?'Saving...':'Save Target'}</button>
          </div>
          <div style={{ background:'#13131f', borderRadius:14, border:'1px solid rgba(255,255,255,0.08)', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:'rgba(255,255,255,0.04)', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                {['Employee','Quarter','Sales Target','Sales Achieved','GP Target','GP Achieved'].map(h=><th key={h} style={{ textAlign:'left', padding:'10px 14px', fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{h}</th>)}
              </tr></thead>
              <tbody>{targets.map((t,i)=>{
                const sp=t.sales_target>0?Math.round(t.sales_achieved/t.sales_target*100):0
                const gp=t.gp_target>0?Math.round(t.gp_achieved/t.gp_target*100):0
                return (
                  <tr key={t.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.05)', background:i%2===0?'transparent':'rgba(255,255,255,0.02)' }}>
                    <td style={{ padding:'10px 14px', fontWeight:600, color:'#fff' }}>{t.real_name}</td>
                    <td style={{ padding:'10px 14px', color:'rgba(255,255,255,0.5)' }}>{t.quarter}</td>
                    <td style={{ padding:'10px 14px', color:'rgba(255,255,255,0.5)' }}>${t.sales_target?.toLocaleString()}</td>
                    <td style={{ padding:'10px 14px' }}><span style={{ color:sp>=100?'#10b981':AC, fontWeight:700 }}>${t.sales_achieved?.toLocaleString()}</span> <span style={{ color:'rgba(255,255,255,0.3)', fontSize:11 }}>({sp}%)</span></td>
                    <td style={{ padding:'10px 14px', color:'rgba(255,255,255,0.5)' }}>${t.gp_target?.toLocaleString()}</td>
                    <td style={{ padding:'10px 14px' }}><span style={{ color:gp>=100?'#10b981':'#f59e0b', fontWeight:700 }}>${t.gp_achieved?.toLocaleString()}</span> <span style={{ color:'rgba(255,255,255,0.3)', fontSize:11 }}>({gp}%)</span></td>
                  </tr>
                )
              })}</tbody>
            </table>
          </div>
        </div>
      )}
      {tab==='employees' && (
        <div style={{ background:'#13131f', borderRadius:14, border:'1px solid rgba(255,255,255,0.08)', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:'rgba(255,255,255,0.04)', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
              {['Employee','Job Title','Department','CRM Role','NFT Role'].map(h=><th key={h} style={{ textAlign:'left', padding:'10px 14px', fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{h}</th>)}
            </tr></thead>
            <tbody>{users.map((u,i)=>(
              <tr key={u.user_id} style={{ borderBottom:'1px solid rgba(255,255,255,0.05)', background:i%2===0?'transparent':'rgba(255,255,255,0.02)' }}>
                <td style={{ padding:'10px 14px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    {u.photo_url?<img src={u.photo_url} alt="" style={{ width:28, height:28, borderRadius:8, objectFit:'cover' }}/>:<div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#00E5CC,#7C3AED)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:12, color:'#fff' }}>{u.real_name?.[0]}</div>}
                    <span style={{ fontWeight:600, color:'#fff' }}>{u.real_name}</span>
                  </div>
                </td>
                <td style={{ padding:'10px 14px', color:'rgba(255,255,255,0.5)' }}>{u.job_title||'—'}</td>
                <td style={{ padding:'10px 14px', color:'rgba(255,255,255,0.5)' }}>{u.department||'—'}</td>
                <td style={{ padding:'10px 14px' }}><span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:'rgba(0,229,204,0.08)', color:AC, border:`1px solid ${AC}20` }}>{u.crm_role}</span></td>
                <td style={{ padding:'10px 14px' }}><span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:'rgba(124,58,237,0.1)', color:'#a78bfa', border:'1px solid rgba(124,58,237,0.2)' }}>{u.nft_role||'employee'}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}
