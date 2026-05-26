import { useState, useEffect } from 'react'
import { useNFT } from './NFTApp'
const AC='#00E5CC'
const CATS=['Food','Snacks','Drinks','All']
export default function NFTKiosk() {
  const { user, profile, headers } = useNFT()
  const canManage = user?.role==='manager' || ['admin','canteen'].includes(profile?.nft_role)
  const [menu, setMenu] = useState([]); const [orders, setOrders] = useState([]); const [cart, setCart] = useState([])
  const [cat, setCat] = useState('All'); const [tab, setTab] = useState('menu')
  const [showNew, setShowNew] = useState(false); const [form, setForm] = useState({ name:'', category:'Food', price:'', description:'' })
  const [placing, setPlacing] = useState(false); const [notes, setNotes] = useState('')
  const loadMenu = () => fetch('/api/nft/kiosk/menu', { headers }).then(r=>r.json()).then(d => setMenu(Array.isArray(d)?d:[]))
  const loadOrders = () => fetch('/api/nft/kiosk/orders', { headers }).then(r=>r.json()).then(d => setOrders(Array.isArray(d)?d:[]))
  useEffect(() => { loadMenu(); loadOrders() }, [])
  const filtered = menu.filter(i => i.available && (cat==='All' || i.category===cat))
  const addToCart = (item) => setCart(c => { const ex=c.find(x=>x.id===item.id); return ex ? c.map(x=>x.id===item.id?{...x,qty:x.qty+1}:x) : [...c,{...item,qty:1}] })
  const removeFromCart = (id) => setCart(c => c.map(x=>x.id===id?{...x,qty:x.qty-1}:x).filter(x=>x.qty>0))
  const cartTotal = cart.reduce((s,i)=>s+i.price*i.qty,0)
  const placeOrder = async () => {
    if (!cart.length) return; setPlacing(true)
    await fetch('/api/nft/kiosk/orders', { method:'POST', headers:{ ...headers, 'Content-Type':'application/json' }, body:JSON.stringify({ items:cart, notes }) })
    setCart([]); setNotes(''); setPlacing(false); loadOrders()
  }
  const inp = { width:'100%', padding:'9px 12px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.06)', color:'#fff', fontSize:13, fontFamily:'"Plus Jakarta Sans",sans-serif', outline:'none' }
  const STATUS_COLOR = { pending:'#f59e0b', preparing:'#3b82f6', ready:AC, delivered:'#10b981' }
  return (
    <div style={{ padding:28, maxWidth:1100 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:22, color:'#fff', margin:0 }}>🍕 Section Kiosk</h1>
        {canManage && <button onClick={() => setShowNew(!showNew)} style={{ padding:'8px 16px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#00E5CC,#7C3AED)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>+ Add Item</button>}
      </div>
      {/* Tabs */}
      <div style={{ display:'flex', gap:2, background:'rgba(255,255,255,0.06)', borderRadius:10, padding:3, marginBottom:20, width:'fit-content' }}>
        {['menu','orders'].map(t => <button key={t} onClick={() => setTab(t)} style={{ padding:'7px 18px', borderRadius:7, border:'none', background:tab===t?AC:'transparent', color:tab===t?'#060610':'rgba(255,255,255,0.5)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', textTransform:'capitalize' }}>{t==='orders'?(canManage?'All Orders':'My Orders'):t}</button>)}
      </div>
      {showNew && canManage && (
        <div style={{ background:'#13131f', borderRadius:14, border:'1px solid rgba(0,229,204,0.2)', padding:18, marginBottom:20 }}>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:10, marginBottom:10 }}>
            <input placeholder="Item name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={inp} />
            <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
              {['Food','Snacks','Drinks'].map(c=><option key={c}>{c}</option>)}
            </select>
            <input placeholder="Price $" type="number" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} style={inp} />
          </div>
          <input placeholder="Description (optional)" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} style={{ ...inp, marginBottom:10 }} />
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => setShowNew(false)} style={{ padding:'8px 16px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(255,255,255,0.5)', fontSize:12, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Cancel</button>
            <button onClick={async()=>{ await fetch('/api/nft/kiosk/menu', {method:'POST', headers:{...headers,'Content-Type':'application/json'}, body:JSON.stringify(form)}); loadMenu(); setShowNew(false); setForm({name:'',category:'Food',price:'',description:''}) }} style={{ padding:'8px 20px', borderRadius:8, border:'none', background:AC, color:'#060610', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Add Item</button>
          </div>
        </div>
      )}
      {tab==='menu' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:20 }}>
          <div>
            <div style={{ display:'flex', gap:6, marginBottom:16 }}>
              {CATS.map(c => <button key={c} onClick={()=>setCat(c)} style={{ padding:'6px 14px', borderRadius:20, border:`1px solid ${cat===c?AC:'rgba(255,255,255,0.1)'}`, background:cat===c?`${AC}15`:'transparent', color:cat===c?AC:'rgba(255,255,255,0.5)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>{c}</button>)}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:12 }}>
              {filtered.map(item => {
                const inCart = cart.find(x=>x.id===item.id)
                return (
                  <div key={item.id} style={{ background:'#13131f', borderRadius:14, border:`1px solid ${inCart?AC+'40':'rgba(255,255,255,0.08)'}`, padding:16, transition:'all 0.15s' }}>
                    <div style={{ fontSize:28, marginBottom:8 }}>{item.category==='Food'?'🍔':item.category==='Drinks'?'☕':'🍿'}</div>
                    <div style={{ fontWeight:700, fontSize:14, color:'#fff', marginBottom:4 }}>{item.name}</div>
                    {item.description && <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:8 }}>{item.description}</div>}
                    <div style={{ fontWeight:800, fontSize:16, color:AC, marginBottom:10 }}>${item.price}</div>
                    {inCart ? (
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <button onClick={()=>removeFromCart(item.id)} style={{ width:28, height:28, borderRadius:8, border:`1px solid ${AC}40`, background:`${AC}15`, color:AC, fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
                        <span style={{ fontWeight:700, color:'#fff', flex:1, textAlign:'center' }}>{inCart.qty}</span>
                        <button onClick={()=>addToCart(item)} style={{ width:28, height:28, borderRadius:8, border:'none', background:AC, color:'#060610', fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800 }}>+</button>
                      </div>
                    ) : (
                      <button onClick={()=>addToCart(item)} style={{ width:'100%', padding:'7px 0', borderRadius:8, border:'none', background:AC, color:'#060610', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Add to Order</button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          {/* Cart */}
          <div style={{ background:'#13131f', borderRadius:16, border:'1px solid rgba(255,255,255,0.08)', padding:20, height:'fit-content', position:'sticky', top:20 }}>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:15, color:'#fff', marginBottom:16 }}>🛒 Your Order</div>
            {!cart.length ? <div style={{ textAlign:'center', color:'rgba(255,255,255,0.25)', padding:'24px 0', fontSize:13 }}>Add items to order</div> : <>
              {cart.map(i => <div key={i.id} style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:13 }}><span style={{ color:'rgba(255,255,255,0.7)' }}>{i.name} ×{i.qty}</span><span style={{ color:'#fff', fontWeight:700 }}>${(i.price*i.qty).toFixed(2)}</span></div>)}
              <div style={{ height:1, background:'rgba(255,255,255,0.08)', margin:'12px 0' }} />
              <div style={{ display:'flex', justifyContent:'space-between', fontWeight:700, fontSize:14, color:'#fff', marginBottom:12 }}><span>Total</span><span style={{ color:AC }}>${cartTotal.toFixed(2)}</span></div>
              <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Any notes for canteen?" style={{ ...inp, fontSize:12, marginBottom:10 }} />
              <button onClick={placeOrder} disabled={placing} style={{ width:'100%', padding:'11px 0', borderRadius:10, border:'none', background:'linear-gradient(135deg,#00E5CC,#7C3AED)', color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>{placing?'Placing...':'Place Order'}</button>
            </>}
          </div>
        </div>
      )}
      {tab==='orders' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {!orders.length ? <div style={{ textAlign:'center', padding:60, color:'rgba(255,255,255,0.25)', fontSize:16 }}>No orders yet</div> : orders.map(o => (
            <div key={o.id} style={{ background:'#13131f', borderRadius:12, border:'1px solid rgba(255,255,255,0.08)', padding:16, display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:13, color:'#fff', marginBottom:3 }}>{o.real_name||'You'} · <span style={{ color:AC }}>${o.total_amount?.toFixed(2)}</span></div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>{JSON.parse(o.items||'[]').map(i=>`${i.name}×${i.qty}`).join(', ')}</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)', marginTop:2 }}>{new Date(o.created_at).toLocaleString()}</div>
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:`${STATUS_COLOR[o.status]||'#64748b'}20`, color:STATUS_COLOR[o.status]||'#94a3b8', border:`1px solid ${STATUS_COLOR[o.status]||'#64748b'}30` }}>{o.status}</span>
                {canManage && o.status!=='delivered' && (
                  <select value={o.status} onChange={async e=>{ await fetch(`/api/nft/kiosk/orders/${o.id}/status`,{method:'PATCH',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({status:e.target.value})}); loadOrders() }} style={{ ...inp, width:'auto', cursor:'pointer', fontSize:12, padding:'5px 10px' }}>
                    {['pending','preparing','ready','delivered'].map(s=><option key={s}>{s}</option>)}
                  </select>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
