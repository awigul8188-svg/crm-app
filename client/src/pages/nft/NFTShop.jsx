import { useState, useEffect } from 'react'
import { useNFT, C } from './NFTApp'
const inp = { width:'100%', padding:'9px 12px', borderRadius:10, border:`1.5px solid ${C.border}`, background:'#fff', color:C.dark, fontSize:13, fontFamily:'"Plus Jakarta Sans",sans-serif', outline:'none', boxSizing:'border-box' }
export default function NFTShop() {
  const { user, headers } = useNFT()
  const canManage = ['manager','admin'].includes(user?.role)
  const canFinance = ['manager','finance'].includes(user?.role)
  const [products, setProducts] = useState([]); const [orders, setOrders] = useState([]); const [cart, setCart] = useState([])
  const [tab, setTab] = useState('shop'); const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ name:'', description:'', price:'', inventory:'', category:'Merchandise' })
  const [placing, setPlacing] = useState(false)
  const loadProducts = () => fetch('/api/nft/shop/products',{headers}).then(r=>r.json()).then(d=>setProducts(Array.isArray(d)?d:[]))
  const loadOrders = () => fetch('/api/nft/shop/orders',{headers}).then(r=>r.json()).then(d=>setOrders(Array.isArray(d)?d:[]))
  useEffect(()=>{ loadProducts(); loadOrders() },[])
  const addToCart = (p) => setCart(c=>{ const ex=c.find(x=>x.id===p.id); return ex?c.map(x=>x.id===p.id?{...x,qty:x.qty+1}:x):[...c,{...p,qty:1}] })
  const remove = (id) => setCart(c=>c.map(x=>x.id===id?{...x,qty:x.qty-1}:x).filter(x=>x.qty>0))
  const cartTotal = cart.reduce((s,i)=>s+i.price*i.qty,0)
  const placeOrder = async () => {
    if (!cart.length) return; setPlacing(true)
    const r = await fetch('/api/nft/shop/orders',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({items:cart})})
    const d = await r.json()
    if (!r.ok) { alert(d.error); setPlacing(false); return }
    setCart([]); setPlacing(false); loadProducts(); loadOrders(); setTab('orders')
    alert(`✅ Order placed! $${d.total?.toFixed(2)} will be deducted from your salary.`)
  }
  const DEDUCT_COLOR = { pending:C.pink, deducted:C.tealDark }
  return (
    <div style={{ padding:28, maxWidth:1100 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:900, fontSize:22, color:C.black, margin:0 }}>🛍 NFT Shop</h1>
        {canManage && <button onClick={()=>setShowNew(!showNew)} style={{ padding:'8px 16px', borderRadius:10, border:'none', background:C.teal, color:C.black, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>+ Add Product</button>}
      </div>
      <div style={{ display:'flex', gap:2, background:C.bg, borderRadius:10, padding:3, marginBottom:20, width:'fit-content', border:`1px solid ${C.border}` }}>
        {['shop','orders'].map(t=><button key={t} onClick={()=>setTab(t)} style={{ padding:'7px 18px', borderRadius:7, border:'none', background:tab===t?C.card:'transparent', color:tab===t?C.black:C.gray, fontSize:13, fontWeight:tab===t?700:500, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', boxShadow:tab===t?'0 1px 4px rgba(0,0,0,0.08)':'none', textTransform:'capitalize' }}>{t==='orders'?((canManage||canFinance)?'All Orders':'My Orders'):t}</button>)}
      </div>
      {showNew && canManage && (
        <div style={{ background:C.card, borderRadius:14, border:`1px solid ${C.border}`, padding:18, marginBottom:20, boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', gap:10, marginBottom:10 }}>
            <input placeholder="Product name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={inp} />
            <input placeholder="Category" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={inp} />
            <input placeholder="Price $" type="number" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} style={inp} />
            <input placeholder="Stock qty" type="number" value={form.inventory} onChange={e=>setForm(f=>({...f,inventory:e.target.value}))} style={inp} />
          </div>
          <textarea placeholder="Description" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={2} style={{ ...inp, resize:'none', marginBottom:10 }} />
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>setShowNew(false)} style={{ padding:'8px 16px', borderRadius:8, border:`1px solid ${C.border}`, background:'#fff', color:C.gray, fontSize:12, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Cancel</button>
            <button onClick={async()=>{ await fetch('/api/nft/shop/products',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(form)}); loadProducts(); setShowNew(false); setForm({name:'',description:'',price:'',inventory:'',category:'Merchandise'}) }} style={{ padding:'8px 20px', borderRadius:8, border:'none', background:C.teal, color:C.black, fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Add Product</button>
          </div>
        </div>
      )}
      {tab==='shop' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:20 }}>
          <div>
            <div style={{ background:`${C.teal}12`, border:`1px solid ${C.teal}30`, borderRadius:12, padding:'10px 16px', marginBottom:16, fontSize:12, color:C.tealDark, fontWeight:600 }}>
              💡 Products are deducted from your salary — no payment needed at checkout.
            </div>
            {!products.filter(p=>p.available).length ? <div style={{ textAlign:'center', padding:60, color:C.gray, fontSize:14 }}>No products available yet</div> : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:14 }}>
                {products.filter(p=>p.available).map(p=>{
                  const inCart=cart.find(x=>x.id===p.id)
                  return (
                    <div key={p.id} style={{ background:C.card, borderRadius:14, border:`1.5px solid ${inCart?C.teal:C.border}`, padding:18, boxShadow:'0 1px 4px rgba(0,0,0,0.06)', transition:'all 0.15s' }}>
                      <div style={{ fontSize:32, marginBottom:8 }}>🛍</div>
                      <div style={{ fontWeight:700, fontSize:14, color:C.dark, marginBottom:4 }}>{p.name}</div>
                      {p.description && <div style={{ fontSize:11, color:C.gray, marginBottom:6 }}>{p.description}</div>}
                      <div style={{ fontSize:11, color:C.gray, marginBottom:8 }}>Stock: {p.inventory}</div>
                      <div style={{ fontWeight:800, fontSize:16, color:C.tealDark, marginBottom:10 }}>${p.price}</div>
                      {inCart ? (
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <button onClick={()=>remove(p.id)} style={{ width:30, height:30, borderRadius:8, border:`1.5px solid ${C.teal}`, background:'#fff', color:C.tealDark, fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>−</button>
                          <span style={{ flex:1, textAlign:'center', fontWeight:700, color:C.dark }}>{inCart.qty}</span>
                          <button onClick={()=>addToCart(p)} disabled={inCart.qty>=p.inventory} style={{ width:30, height:30, borderRadius:8, border:'none', background:C.teal, color:C.black, fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800 }}>+</button>
                        </div>
                      ) : (
                        <button onClick={()=>addToCart(p)} disabled={!p.inventory} style={{ width:'100%', padding:'8px 0', borderRadius:8, border:'none', background:p.inventory?C.teal:C.border, color:p.inventory?C.black:C.gray, fontWeight:700, fontSize:12, cursor:p.inventory?'pointer':'not-allowed', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>{p.inventory?'Add to Cart':'Out of Stock'}</button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          {/* Cart */}
          <div style={{ background:C.card, borderRadius:16, border:`1px solid ${C.border}`, padding:20, height:'fit-content', position:'sticky', top:20, boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:15, color:C.black, marginBottom:16 }}>🛒 Cart</div>
            {!cart.length ? <div style={{ textAlign:'center', color:C.gray, padding:'24px 0', fontSize:13 }}>Empty</div> : <>
              {cart.map(i=><div key={i.id} style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:13 }}><span style={{ color:C.dark }}>{i.name} ×{i.qty}</span><span style={{ fontWeight:700, color:C.dark }}>${(i.price*i.qty).toFixed(2)}</span></div>)}
              <div style={{ height:1, background:C.border, margin:'12px 0' }} />
              <div style={{ display:'flex', justifyContent:'space-between', fontWeight:800, fontSize:14, color:C.black, marginBottom:4 }}><span>Total</span><span style={{ color:C.tealDark }}>${cartTotal.toFixed(2)}</span></div>
              <div style={{ fontSize:11, color:C.gray, marginBottom:12 }}>Will be deducted from salary</div>
              <button onClick={placeOrder} disabled={placing} style={{ width:'100%', padding:'11px 0', borderRadius:10, border:'none', background:C.teal, color:C.black, fontWeight:800, fontSize:14, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', boxShadow:`0 3px 12px ${C.teal}50` }}>{placing?'Processing...':'Order (Salary Deduction)'}</button>
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
                <div style={{ fontSize:11, color:C.gray, marginTop:2 }}>{new Date(o.created_at).toLocaleString()}</div>
              </div>
              <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:`${C.teal}12`, color:C.tealDark, border:`1px solid ${C.teal}30` }}>{o.status}</span>
                <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:`${DEDUCT_COLOR[o.deduction_status]||C.pink}12`, color:DEDUCT_COLOR[o.deduction_status]||C.pink, border:`1px solid ${DEDUCT_COLOR[o.deduction_status]||C.pink}30` }}>Deduction: {o.deduction_status}</span>
                {canFinance && o.deduction_status==='pending' && (
                  <button onClick={async()=>{ await fetch(`/api/nft/shop/orders/${o.id}`,{method:'PATCH',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({deduction_status:'deducted'})}); loadOrders() }}
                    style={{ padding:'4px 12px', borderRadius:8, border:`1.5px solid ${C.teal}`, background:'#fff', color:C.tealDark, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Mark Deducted</button>
                )}
                {canManage && o.status!=='delivered' && (
                  <button onClick={async()=>{ await fetch(`/api/nft/shop/orders/${o.id}`,{method:'PATCH',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({status:'delivered'})}); loadOrders() }}
                    style={{ padding:'4px 12px', borderRadius:8, border:`1.5px solid ${C.lavender}`, background:'#fff', color:C.lavender, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Accept as Received</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
