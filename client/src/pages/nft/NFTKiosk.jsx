import { useState, useEffect } from 'react'
import { useNFT, C } from './NFTApp'
const CATS = ['All','Food','Snacks','Drinks']
const inp = { width:'100%', padding:'9px 12px', borderRadius:10, border:`1.5px solid ${C.border}`, background:'#fff', color:C.dark, fontSize:13, fontFamily:'"Plus Jakarta Sans",sans-serif', outline:'none', boxSizing:'border-box' }
const STATUS_COLOR = { pending:C.pink, preparing:C.lavender, ready:C.tealDark, delivered:'#6b7280' }
const CAT_ICON = { Food:'🍔', Snacks:'🍿', Drinks:'☕' }
export default function NFTKiosk() {
  const { user, headers } = useNFT()
  const canManage = ['manager','admin'].includes(user?.role)
  const [menu, setMenu] = useState([]); const [orders, setOrders] = useState([]); const [cart, setCart] = useState([])
  const [tab, setTab] = useState('menu'); const [cat, setCat] = useState('All')
  const [showNew, setShowNew] = useState(false); const [form, setForm] = useState({ name:'', category:'Food', price:'', description:'' })
  const [placing, setPlacing] = useState(false); const [notes, setNotes] = useState('')
  const loadMenu = () => fetch('/api/nft/kiosk/menu', { headers }).then(r=>r.json()).then(d=>setMenu(Array.isArray(d)?d:[]))
  const loadOrders = () => fetch('/api/nft/kiosk/orders', { headers }).then(r=>r.json()).then(d=>setOrders(Array.isArray(d)?d:[]))
  useEffect(()=>{ loadMenu(); loadOrders() },[])
  const filtered = menu.filter(i=>i.available&&(cat==='All'||i.category===cat))
  const addToCart = (item) => setCart(c=>{ const ex=c.find(x=>x.id===item.id); return ex?c.map(x=>x.id===item.id?{...x,qty:x.qty+1}:x):[...c,{...item,qty:1}] })
  const remove = (id) => setCart(c=>c.map(x=>x.id===id?{...x,qty:x.qty-1}:x).filter(x=>x.qty>0))
  const total = cart.reduce((s,i)=>s+i.price*i.qty,0)
  const placeOrder = async () => {
    if (!cart.length) return; setPlacing(true)
    await fetch('/api/nft/kiosk/orders',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({items:cart,notes})})
    setCart([]); setNotes(''); setPlacing(false); loadOrders(); setTab('orders')
  }
  return (
    <div style={{ padding:28, maxWidth:1100 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:900, fontSize:22, color:C.black, margin:0 }}>🍕 Section Kiosk</h1>
        {canManage && <button onClick={()=>setShowNew(!showNew)} style={{ padding:'8px 16px', borderRadius:10, border:'none', background:C.teal, color:C.black, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>+ Add Item</button>}
      </div>
      {/* Tabs */}
      <div style={{ display:'flex', gap:2, background:C.bg, borderRadius:10, padding:3, marginBottom:20, width:'fit-content', border:`1px solid ${C.border}` }}>
        {['menu','orders'].map(t=><button key={t} onClick={()=>setTab(t)} style={{ padding:'7px 18px', borderRadius:7, border:'none', background:tab===t?C.card:'transparent', color:tab===t?C.black:C.gray, fontSize:13, fontWeight:tab===t?700:500, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', boxShadow:tab===t?'0 1px 4px rgba(0,0,0,0.08)':'none', textTransform:'capitalize' }}>{t==='orders'?(canManage?'All Orders':'My Orders'):t}</button>)}
      </div>
      {showNew && canManage && (
        <div style={{ background:C.card, borderRadius:14, border:`1px solid ${C.border}`, padding:18, marginBottom:20, boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:10, marginBottom:10 }}>
            <input placeholder="Item name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={inp} />
            <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>{['Food','Snacks','Drinks'].map(c=><option key={c}>{c}</option>)}</select>
            <input placeholder="Price $" type="number" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} style={inp} />
          </div>
          <input placeholder="Description (optional)" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} style={{ ...inp, marginBottom:10 }} />
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>setShowNew(false)} style={{ padding:'8px 16px', borderRadius:8, border:`1px solid ${C.border}`, background:'#fff', color:C.gray, fontSize:12, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Cancel</button>
            <button onClick={async()=>{ await fetch('/api/nft/kiosk/menu',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(form)}); loadMenu(); setShowNew(false); setForm({name:'',category:'Food',price:'',description:''}) }} style={{ padding:'8px 20px', borderRadius:8, border:'none', background:C.teal, color:C.black, fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Add Item</button>
          </div>
        </div>
      )}
      {tab==='menu' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:20 }}>
          <div>
            <div style={{ display:'flex', gap:6, marginBottom:16 }}>
              {CATS.map(c=><button key={c} onClick={()=>setCat(c)} style={{ padding:'6px 16px', borderRadius:20, border:`1.5px solid ${cat===c?C.teal:C.border}`, background:cat===c?C.teal:'#fff', color:cat===c?C.black:C.gray, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>{c}</button>)}
            </div>
            {!filtered.length ? <div style={{ textAlign:'center', padding:60, color:C.gray, fontSize:14 }}>No items available</div> : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:14 }}>
                {filtered.map(item => {
                  const inCart = cart.find(x=>x.id===item.id)
                  return (
                    <div key={item.id} style={{ background:C.card, borderRadius:14, border:`1.5px solid ${inCart?C.teal:C.border}`, padding:18, boxShadow:'0 1px 4px rgba(0,0,0,0.06)', transition:'all 0.15s' }}>
                      <div style={{ fontSize:28, marginBottom:8 }}>{CAT_ICON[item.category]||'🍽'}</div>
                      <div style={{ fontWeight:700, fontSize:14, color:C.dark, marginBottom:4 }}>{item.name}</div>
                      {item.description && <div style={{ fontSize:11, color:C.gray, marginBottom:8 }}>{item.description}</div>}
                      <div style={{ fontWeight:800, fontSize:16, color:C.tealDark, marginBottom:10 }}>${item.price}</div>
                      {inCart ? (
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <button onClick={()=>remove(item.id)} style={{ width:30, height:30, borderRadius:8, border:`1.5px solid ${C.teal}`, background:'#fff', color:C.tealDark, fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>−</button>
                          <span style={{ flex:1, textAlign:'center', fontWeight:700, color:C.dark }}>{inCart.qty}</span>
                          <button onClick={()=>addToCart(item)} style={{ width:30, height:30, borderRadius:8, border:'none', background:C.teal, color:C.black, fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800 }}>+</button>
                        </div>
                      ) : (
                        <button onClick={()=>addToCart(item)} style={{ width:'100%', padding:'8px 0', borderRadius:8, border:'none', background:C.teal, color:C.black, fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', boxShadow:`0 2px 6px ${C.teal}40` }}>Add to Order</button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          {/* Cart */}
          <div style={{ background:C.card, borderRadius:16, border:`1px solid ${C.border}`, padding:20, height:'fit-content', position:'sticky', top:20, boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:15, color:C.black, marginBottom:16 }}>🛒 Your Order</div>
            {!cart.length ? <div style={{ textAlign:'center', color:C.gray, padding:'24px 0', fontSize:13 }}>Add items to order</div> : <>
              {cart.map(i=><div key={i.id} style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:13 }}><span style={{ color:C.dark }}>{i.name} ×{i.qty}</span><span style={{ fontWeight:700, color:C.dark }}>${(i.price*i.qty).toFixed(2)}</span></div>)}
              <div style={{ height:1, background:C.border, margin:'12px 0' }} />
              <div style={{ display:'flex', justifyContent:'space-between', fontWeight:800, fontSize:14, color:C.black, marginBottom:10 }}><span>Total</span><span style={{ color:C.tealDark }}>${total.toFixed(2)}</span></div>
              <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Notes for canteen..." style={{ ...inp, marginBottom:10, fontSize:12 }} />
              <button onClick={placeOrder} disabled={placing} style={{ width:'100%', padding:'11px 0', borderRadius:10, border:'none', background:C.teal, color:C.black, fontWeight:800, fontSize:14, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', boxShadow:`0 3px 12px ${C.teal}50` }}>{placing?'Placing...':'Place Order'}</button>
            </>}
          </div>
        </div>
      )}
      {tab==='orders' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {!orders.length ? <div style={{ textAlign:'center', padding:60, color:C.gray, fontSize:14 }}>No orders yet</div> : orders.map(o=>(
            <div key={o.id} style={{ background:C.card, borderRadius:12, border:`1px solid ${C.border}`, padding:'14px 18px', display:'flex', alignItems:'center', gap:14, boxShadow:'0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:13, color:C.dark, marginBottom:3 }}>{o.real_name||'You'} · <span style={{ color:C.tealDark, fontWeight:700 }}>${o.total_amount?.toFixed(2)}</span></div>
                <div style={{ fontSize:12, color:C.gray }}>{JSON.parse(o.items||'[]').map(i=>`${i.name}×${i.qty}`).join(', ')}</div>
                {o.notes && <div style={{ fontSize:11, color:C.gray, marginTop:2 }}>Note: {o.notes}</div>}
                <div style={{ fontSize:11, color:C.gray, marginTop:2 }}>{new Date(o.created_at).toLocaleString()}</div>
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <span style={{ fontSize:11, fontWeight:700, padding:'4px 12px', borderRadius:20, background:`${STATUS_COLOR[o.status]||C.gray}15`, color:STATUS_COLOR[o.status]||C.gray, border:`1px solid ${STATUS_COLOR[o.status]||C.gray}30`, textTransform:'capitalize' }}>{o.status}</span>
                {canManage && o.status!=='delivered' && (
                  <select value={o.status} onChange={async e=>{ await fetch(`/api/nft/kiosk/orders/${o.id}/status`,{method:'PATCH',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({status:e.target.value})}); loadOrders() }}
                    style={{ ...inp, width:'auto', cursor:'pointer', fontSize:12, padding:'5px 10px' }}>
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
