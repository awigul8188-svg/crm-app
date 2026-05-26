import { useState, useEffect } from 'react'
import { useNFT, C } from './NFTContext'
const inp = { width:'100%', padding:'9px 12px', borderRadius:10, border:`1.5px solid ${C.border}`, background:'#fff', color:C.dark, fontSize:13, fontFamily:'"Plus Jakarta Sans",sans-serif', outline:'none', boxSizing:'border-box' }
const btn = { padding:'9px 20px', borderRadius:10, border:'none', background:C.teal, color:C.black, fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }
const lbl = { fontSize:10, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6, display:'block' }
export default function NFTAdmin() {
  const { user, headers } = useNFT()
  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState([]); const [salaries, setSalaries] = useState([]); const [targets, setTargets] = useState([])
  const [showNew, setShowNew] = useState(false); const [form, setForm] = useState({ username:'', password:'', real_name:'', role:'employee', job_title:'', department:'' })
  const [sForm, setSForm] = useState({ user_id:'', month:new Date().toISOString().slice(0,7), base_salary:'', bonus:'', notes:'' })
  const [tForm, setTForm] = useState({ user_id:'', quarter:`${new Date().getFullYear()}-Q${Math.ceil((new Date().getMonth()+1)/3)}`, sales_target:'', gp_target:'', sales_achieved:'', gp_achieved:'' })
  const [saving, setSaving] = useState(false); const [editUser, setEditUser] = useState(null); const [eForm, setEForm] = useState({})
  const loadAll = () => {
    fetch('/api/nft/users', { headers }).then(r=>r.json()).then(d=>setUsers(Array.isArray(d)?d:[]))
    fetch('/api/nft/salary', { headers }).then(r=>r.json()).then(d=>setSalaries(Array.isArray(d)?d:[]))
    fetch('/api/nft/targets', { headers }).then(r=>r.json()).then(d=>setTargets(Array.isArray(d)?d:[]))
  }
  useEffect(() => { loadAll() }, [])
  const createUser = async () => {
    setSaving(true)
    const r = await fetch('/api/nft/users', { method:'POST', headers:{...headers,'Content-Type':'application/json'}, body:JSON.stringify(form) })
    const d = await r.json(); if(!r.ok) alert(d.error)
    setSaving(false); setShowNew(false); setForm({username:'',password:'',real_name:'',role:'employee',job_title:'',department:''}); loadAll()
  }
  const deleteUser = async (id, name) => {
    if (!confirm(`Delete ${name}?`)) return
    await fetch(`/api/nft/users/${id}`, { method:'DELETE', headers }); loadAll()
  }
  const saveSalary = async () => { setSaving(true); await fetch('/api/nft/salary', { method:'POST', headers:{...headers,'Content-Type':'application/json'}, body:JSON.stringify(sForm) }); setSaving(false); loadAll() }
  const saveTarget = async () => { setSaving(true); await fetch('/api/nft/targets', { method:'POST', headers:{...headers,'Content-Type':'application/json'}, body:JSON.stringify(tForm) }); setSaving(false); loadAll() }
  const ROLES = ['hr','finance','admin','employee']
  const ROLE_COLORS = { manager:`${C.teal}20`, hr:`${C.lavender}20`, finance:`${C.pink}20`, admin:`${C.gray}20`, employee:`#f0f0f0` }
  const ROLE_TEXT = { manager:C.tealDark, hr:C.lavender, finance:C.pink, admin:C.gray, employee:C.gray }
  return (
    <div style={{ padding:28, maxWidth:1100 }}>
      <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:900, fontSize:22, color:C.black, marginBottom:20 }}>⚙ Admin Panel</h1>
      <div style={{ display:'flex', gap:2, background:C.bg, borderRadius:10, padding:3, marginBottom:24, width:'fit-content', border:`1px solid ${C.border}` }}>
        {['users','salary','targets'].map(t=><button key={t} onClick={()=>setTab(t)} style={{ padding:'7px 18px', borderRadius:7, border:'none', background:tab===t?C.card:'transparent', color:tab===t?C.black:C.gray, fontSize:13, fontWeight:tab===t?700:500, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', boxShadow:tab===t?'0 1px 4px rgba(0,0,0,0.08)':'none', textTransform:'capitalize' }}>{t}</button>)}
      </div>
      {tab==='users' && (
        <div>
          {user?.role==='manager' && <button onClick={()=>setShowNew(!showNew)} style={{ ...btn, marginBottom:16 }}>+ Add User</button>}
          {showNew && (
            <div style={{ background:C.card, borderRadius:14, border:`1px solid ${C.border}`, padding:20, marginBottom:20, boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ fontWeight:700, fontSize:14, color:C.dark, marginBottom:14 }}>New User</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:10 }}>
                {[['Full Name','real_name','text'],['Username','username','text'],['Password','password','password'],['Job Title','job_title','text'],['Department','department','text']].map(([l,k,t])=>(
                  <div key={k}><label style={lbl}>{l}</label><input type={t} value={form[k]||''} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} style={inp} /></div>
                ))}
                <div><label style={lbl}>Role</label>
                  <select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                    {ROLES.map(r=><option key={r} value={r} style={{ textTransform:'capitalize' }}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>setShowNew(false)} style={{ padding:'8px 16px', borderRadius:8, border:`1px solid ${C.border}`, background:'#fff', color:C.gray, fontSize:12, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Cancel</button>
                <button onClick={createUser} disabled={saving} style={btn}>{saving?'Creating...':'Create User'}</button>
              </div>
            </div>
          )}
          <div style={{ background:C.card, borderRadius:14, border:`1px solid ${C.border}`, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:C.bg, borderBottom:`2px solid ${C.border}` }}>
                {['Name','Username','Role','Job Title','Department','Joined',...(user?.role==='manager'?['Actions']:[])].map(h=><th key={h} style={{ textAlign:'left', padding:'10px 14px', fontSize:10, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.08em' }}>{h}</th>)}
              </tr></thead>
              <tbody>{users.map((u,i)=>(
                <tr key={u.id} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?'#fff':'#fcfcfc' }}>
                  <td style={{ padding:'11px 14px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      {u.photo_url?<img src={u.photo_url} style={{ width:28,height:28,borderRadius:8,objectFit:'cover' }}/>:<div style={{ width:28,height:28,borderRadius:8,background:C.teal,color:C.black,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:12 }}>{u.real_name?.[0]}</div>}
                      <span style={{ fontWeight:600, color:C.dark }}>{u.real_name}</span>
                    </div>
                  </td>
                  <td style={{ padding:'11px 14px', color:C.gray, fontFamily:'monospace', fontSize:12 }}>{u.username}</td>
                  <td style={{ padding:'11px 14px' }}><span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:ROLE_COLORS[u.role]||'#f0f0f0', color:ROLE_TEXT[u.role]||C.gray, textTransform:'capitalize' }}>{u.role}</span></td>
                  <td style={{ padding:'11px 14px', color:C.gray, fontSize:12 }}>{u.job_title||'—'}</td>
                  <td style={{ padding:'11px 14px', color:C.gray, fontSize:12 }}>{u.department||'—'}</td>
                  <td style={{ padding:'11px 14px', color:C.gray, fontSize:12 }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  {user?.role==='manager' && <td style={{ padding:'11px 14px' }}>
                    {u.role!=='manager' && <button onClick={()=>deleteUser(u.id,u.real_name)} style={{ padding:'4px 12px', borderRadius:8, border:'1px solid #fecaca', background:'#fff5f5', color:'#dc2626', fontSize:11, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Delete</button>}
                  </td>}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
      {tab==='salary' && (
        <div>
          {['manager','finance'].includes(user?.role) && (
            <div style={{ background:C.card, borderRadius:14, border:`1px solid ${C.border}`, padding:20, marginBottom:20, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ fontWeight:700, fontSize:14, color:C.dark, marginBottom:14 }}>Set Salary</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:10 }}>
                <div><label style={lbl}>Employee</label><select value={sForm.user_id} onChange={e=>setSForm(f=>({...f,user_id:e.target.value}))} style={{ ...inp, cursor:'pointer' }}><option value="">Select</option>{users.map(u=><option key={u.id} value={u.id}>{u.real_name}</option>)}</select></div>
                <div><label style={lbl}>Month</label><input type="month" value={sForm.month} onChange={e=>setSForm(f=>({...f,month:e.target.value}))} style={inp} /></div>
                <div><label style={lbl}>Base Salary $</label><input type="number" value={sForm.base_salary} onChange={e=>setSForm(f=>({...f,base_salary:e.target.value}))} style={inp} /></div>
                <div><label style={lbl}>Bonus $</label><input type="number" value={sForm.bonus} onChange={e=>setSForm(f=>({...f,bonus:e.target.value}))} style={inp} /></div>
                <div><label style={lbl}>Notes</label><input value={sForm.notes} onChange={e=>setSForm(f=>({...f,notes:e.target.value}))} style={inp} /></div>
              </div>
              <button onClick={saveSalary} disabled={saving} style={btn}>{saving?'Saving...':'Save Salary'}</button>
            </div>
          )}
          <div style={{ background:C.card, borderRadius:14, border:`1px solid ${C.border}`, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:C.bg, borderBottom:`2px solid ${C.border}` }}>{['Employee','Month','Base','Bonus','Total','Notes'].map(h=><th key={h} style={{ textAlign:'left', padding:'10px 14px', fontSize:10, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.08em' }}>{h}</th>)}</tr></thead>
              <tbody>{salaries.map((s,i)=>(
                <tr key={s.id} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?'#fff':'#fcfcfc' }}>
                  <td style={{ padding:'10px 14px', fontWeight:600, color:C.dark }}>{s.real_name}</td>
                  <td style={{ padding:'10px 14px', color:C.gray }}>{s.month}</td>
                  <td style={{ padding:'10px 14px', fontWeight:700, color:C.tealDark }}>${(s.base_salary||0).toLocaleString()}</td>
                  <td style={{ padding:'10px 14px', color:C.pink, fontWeight:600 }}>{s.bonus?`$${s.bonus.toLocaleString()}`:'—'}</td>
                  <td style={{ padding:'10px 14px', fontWeight:800, color:C.dark }}>${((s.base_salary||0)+(s.bonus||0)).toLocaleString()}</td>
                  <td style={{ padding:'10px 14px', color:C.gray, fontSize:12 }}>{s.notes||'—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
      {tab==='targets' && (
        <div>
          {user?.role==='manager' && (
            <div style={{ background:C.card, borderRadius:14, border:`1px solid ${C.border}`, padding:20, marginBottom:20, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ fontWeight:700, fontSize:14, color:C.dark, marginBottom:14 }}>Set Targets</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:10 }}>
                <div><label style={lbl}>Employee</label><select value={tForm.user_id} onChange={e=>setTForm(f=>({...f,user_id:e.target.value}))} style={{ ...inp, cursor:'pointer' }}><option value="">Select</option>{users.filter(u=>u.role==='employee').map(u=><option key={u.id} value={u.id}>{u.real_name}</option>)}</select></div>
                <div><label style={lbl}>Quarter</label><input value={tForm.quarter} onChange={e=>setTForm(f=>({...f,quarter:e.target.value}))} style={inp} placeholder="e.g. 2026-Q1" /></div>
                <div><label style={lbl}>Sales Target $</label><input type="number" value={tForm.sales_target} onChange={e=>setTForm(f=>({...f,sales_target:e.target.value}))} style={inp} /></div>
                <div><label style={lbl}>GP Target $</label><input type="number" value={tForm.gp_target} onChange={e=>setTForm(f=>({...f,gp_target:e.target.value}))} style={inp} /></div>
                <div><label style={lbl}>Sales Achieved $</label><input type="number" value={tForm.sales_achieved} onChange={e=>setTForm(f=>({...f,sales_achieved:e.target.value}))} style={inp} /></div>
                <div><label style={lbl}>GP Achieved $</label><input type="number" value={tForm.gp_achieved} onChange={e=>setTForm(f=>({...f,gp_achieved:e.target.value}))} style={inp} /></div>
              </div>
              <button onClick={saveTarget} disabled={saving} style={btn}>{saving?'Saving...':'Save Targets'}</button>
            </div>
          )}
          <div style={{ background:C.card, borderRadius:14, border:`1px solid ${C.border}`, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:C.bg, borderBottom:`2px solid ${C.border}` }}>{['Employee','Quarter','Sales Target','Sales Achieved','GP Target','GP Achieved'].map(h=><th key={h} style={{ textAlign:'left', padding:'10px 14px', fontSize:10, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.08em' }}>{h}</th>)}</tr></thead>
              <tbody>{targets.map((t,i)=>{
                const sp=t.sales_target>0?Math.round(t.sales_achieved/t.sales_target*100):0
                const gp=t.gp_target>0?Math.round(t.gp_achieved/t.gp_target*100):0
                return <tr key={t.id} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?'#fff':'#fcfcfc' }}>
                  <td style={{ padding:'10px 14px', fontWeight:600, color:C.dark }}>{t.real_name}</td>
                  <td style={{ padding:'10px 14px', color:C.gray }}>{t.quarter}</td>
                  <td style={{ padding:'10px 14px', color:C.gray }}>${(t.sales_target||0).toLocaleString()}</td>
                  <td style={{ padding:'10px 14px' }}><span style={{ color:sp>=100?C.tealDark:C.dark, fontWeight:700 }}>${(t.sales_achieved||0).toLocaleString()}</span> <span style={{ color:C.gray, fontSize:11 }}>({sp}%)</span></td>
                  <td style={{ padding:'10px 14px', color:C.gray }}>${(t.gp_target||0).toLocaleString()}</td>
                  <td style={{ padding:'10px 14px' }}><span style={{ color:gp>=100?C.tealDark:C.pink, fontWeight:700 }}>${(t.gp_achieved||0).toLocaleString()}</span> <span style={{ color:C.gray, fontSize:11 }}>({gp}%)</span></td>
                </tr>
              })}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
