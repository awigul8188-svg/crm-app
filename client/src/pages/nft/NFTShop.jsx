import { useState, useEffect } from 'react'
import { useNFT } from './NFTApp'
const AC='#00E5CC'
export default function NFTShop() {
  const { user, headers, profile } = useNFT()
  const canManage = user?.role==='manager'
  const [products, setProducts] = useState([]); const [orders, setOrders] = useState([]); const [cart, setCart] = useState([])
  const [tab, setTab] = useState('shop'); const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ name:'', description:'', price:'', inventory:'', category:'Merchandise' })
  const [placing, setPlacing] = useState(false)
  const loadProducts = () => fetch('/api/nft/shop/products', { headers }).then(r=>r.json()).then(d=>setProducts(Array.isArray(d)?d:[]))
  const loadOrders = () => fetch('/api/nft/shop/orders', { headers }).then(r=>r.json()).then(d=>setOrders(Array.isArray(d)?d:[]))
  useEffect(() => { loadProducts(); loadOrders() }, [])
  const addToCart = (p) => setCart(c => { const ex=c.find(x=>x.id===p.id); return ex?c.map(x=>x.id===p.id?{...x,qty:x.qty+1}:x):[...c,{...p,qty:1}] })
  const removeFromCart = (id) => setCart(c => c.map(x=>x.id===id?{...x,qty:x.qty-1}:x).filter(x=>x.qty>0))
  const cartTotal = cart.reduce((s,i)=>s+i.price*i.qty,0)
  const placeOrder = async () => {
    if (!cart.length) return; setPlacing(true)
    const r = await fetch('/api/nft/shop/orders', { method:'POST', headers:{...headers,'Content-Type':'application/json'}, body:JSON.stringify({ items:cart }) })
    const d = await r.json()
    if (!r.ok) { alert(d.error); setPlacing(false); return }
    setCart([]); setPlacing(false); loadProducts(); loadOrders(); setTab('orders')
    alert(`Order placed! $${d.total?.toFixed(2)} will be deducted from your salary.`)
  }
  const inp = { width:'100%', padding:'9px 12px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.06)', color:'#fff', fontSize:13, fontFamily:'"Plus Jakarta Sans",sans-serif', outline:'none' }
  const DEDUCT_COLOR = { pending:'#f59e0b', deducted:'#10b981' }
  return (
    <div style={{ padding:28, maxWidth:1100 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <h1 style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:800, fontSize:22, color:'#fff', margin:0 }}>🛍 NFT Shop</h1>
        {canManage && <button onClick={() => setShowNew(!showNew)} style={{ padding:'8px 16px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#00E5CC,#7C3AED)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>+ Add Product</button>}
      </div>
      <div style={{ display:'flex', gap:2, background:'rgba(255,255,255,0.06)', borderRadius:10, padding:3, marginBottom:20, width:'fit-content' }}>
        {['shop','orders'].map(t=><button key={t} onClick={()=>setTab(t)} style={{ padding:'7px 18px', borderRadius:7, border:'none', background:tab===t?AC:'transparent', color:tab===t?'#060610':'rgba(255,255,255,0.5)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif', textTransform:'capitalize' }}>{t==='orders'?(canManage?'All Orders':'My Orders'):t}</button>)}
      </div>
      {showNew && canManage && (
        <div style={{ background:'#13131f', borderRadius:14, border:'1px solid rgba(0,229,204,0.2)', padding:18, marginBottom:20 }}>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', gap:10, marginBottom:10 }}>
            <input placeholder="Product name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={inp} />
            <input placeholder="Category" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={inp} />
            <input placeholder="Price $" type="number" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} style={inp} />
            <input placeholder="Stock qty" type="number" value={form.inventory} onChange={e=>setForm(f=>({...f,inventory:e.target.value}))} style={inp} />
          </div>
          <textarea placeholder="Description" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={2} style={{ ...inp, resize:'none', marginBottom:10 }} />
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>setShowNew(false)} style={{ padding:'8px 16px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(255,255,255,0.5)', fontSize:12, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Cancel</button>
            <button onClick={async()=>{ await fetch('/api/nft/shop/products',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(form)}); loadProducts(); setShowNew(false); setForm({name:'',description:'',price:'',inventory:'',category:'Merchandise'}) }} style={{ padding:'8px 20px', borderRadius:8, border:'none', background:AC, color:'#060610', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Add Product</button>
          </div>
        </div>
      )}
      {tab==='shop' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:20 }}>
          <div>
            <div style={{ background:'rgba(0,229,204,0.08)', border:'1px solid rgba(0,229,204,0.2)', borderRadius:12, padding:'10px 16px', marginBottom:16, fontSize:12, color:AC }}>
              💡 Products are deducted from your salary. No payment required at checkout.
            </div>
            {!products.filter(p=>p.available).length ? <div style={{ textAlign:'center', padding:60, color:'rgba(255,255,255,0.25)', fontSize:16 }}>No products available yet</div> : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:14 }}>
                {products.filter(p=>p.available).map(p => {
                  const inCart=cart.find(x=>x.id===p.id)
                  return (
                    <div key={p.id} style={{ background:'#13131f', borderRadius:14, border:`1px solid ${inCart?AC+'40':'rgba(255,255,255,0.08)'}`, padding:18 }}>
                      <div style={{ fontSize:32, marginBottom:8 }}>🛍</div>
                      <div style={{ fontWeight:700, fontSize:14, color:'#fff', marginBottom:4 }}>{p.name}</div>
                      {p.description && <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:6 }}>{p.description}</div>}
                      <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)', marginBottom:8 }}>Stock: {p.inventory}</div>
                      <div style={{ fontWeight:800, fontSize:16, color:AC, marginBottom:10 }}>${p.price}</div>
                      {inCart ? (
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <button onClick={()=>removeFromCart(p.id)} style={{ width:28, height:28, borderRadius:8, border:`1px solid ${AC}40`, background:`${AC}15`, color:AC, fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
                          <span style={{ fontWeight:700, color:'#fff', flex:1, textAlign:'center' }}>{inCart.qty}</span>
                          <button onClick={()=>addToCart(p)} disabled={inCart.qty>=p.inventory} style={{ width:28, height:28, borderRadius:8, border:'none', background:AC, color:'#060610', fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800 }}>+</button>
                        </div>
                      ) : (
                        <button onClick={()=>addToCart(p)} disabled={!p.inventory} style={{ width:'100%', padding:'7px 0', borderRadius:8, border:'none', background:p.inventory?AC:'rgba(255,255,255,0.1)', color:p.inventory?'#060610':'rgba(255,255,255,0.3)', fontWeight:700, fontSize:12, cursor:p.inventory?'pointer':'not-allowed', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>{p.inventory?'Add to Cart':'Out of Stock'}</button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          {/* Cart */}
          <div style={{ background:'#13131f', borderRadius:16, border:'1px solid rgba(255,255,255,0.08)', padding:20, height:'fit-content', position:'sticky', top:20 }}>
            <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:15, color:'#fff', marginBottom:16 }}>🛒 Cart</div>
            {!cart.length ? <div style={{ textAlign:'center', color:'rgba(255,255,255,0.25)', padding:'24px 0', fontSize:13 }}>Empty</div> : <>
              {cart.map(i=><div key={i.id} style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:13 }}><span style={{ color:'rgba(255,255,255,0.7)' }}>{i.name} ×{i.qty}</span><span style={{ color:'#fff', fontWeight:700 }}>${(i.price*i.qty).toFixed(2)}</span></div>)}
              <div style={{ height:1, background:'rgba(255,255,255,0.08)', margin:'12px 0' }} />
              <div style={{ display:'flex', justifyContent:'space-between', fontWeight:700, fontSize:14, color:'#fff', marginBottom:6 }}><span>Total</span><span style={{ color:AC }}>${cartTotal.toFixed(2)}</span></div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginBottom:12 }}>Will be deducted from your salary</div>
              <button onClick={placeOrder} disabled={placing} style={{ width:'100%', padding:'11px 0', borderRadius:10, border:'none', background:'linear-gradient(135deg,#00E5CC,#7C3AED)', color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>{placing?'Processing...':'Order (Salary Deduction)'}</button>
            </>}
          </div>
        </div>
      )}
      {tab==='orders' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {!orders.length ? <div style={{ textAlign:'center', padding:60, color:'rgba(255,255,255,0.25)', fontSize:16 }}>No orders yet</div> : orders.map(o=>(
            <div key={o.id} style={{ background:'#13131f', borderRadius:12, border:'1px solid rgba(255,255,255,0.08)', padding:16, display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:13, color:'#fff', marginBottom:3 }}>{o.real_name||'You'} · <span style={{ color:AC }}>${o.total_amount?.toFixed(2)}</span></div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>{JSON.parse(o.items||'[]').map(i=>`${i.name}×${i.qty}`).join(', ')}</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)', marginTop:2 }}>{new Date(o.created_at).toLocaleString()}</div>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:'rgba(16,185,129,0.1)', color:'#34d399', border:'1px solid rgba(16,185,129,0.2)' }}>{o.status}</span>
                <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:`${DEDUCT_COLOR[o.deduction_status]||'#f59e0b'}15`, color:DEDUCT_COLOR[o.deduction_status]||'#f59e0b', border:`1px solid ${DEDUCT_COLOR[o.deduction_status]||'#f59e0b'}30` }}>Deduction: {o.deduction_status}</span>
                {canManage && <button onClick={async()=>{ await fetch(`/api/nft/shop/orders/${o.id}`,{method:'PATCH',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({deduction_status:'deducted'})}); loadOrders() }} style={{ padding:'4px 10px', borderRadius:8, border:'1px solid rgba(0,229,204,0.2)', background:'rgba(0,229,204,0.08)', color:AC, fontSize:11, cursor:'pointer', fontFamily:'"Plus Jakarta Sans",sans-serif' }}>Mark Deducted</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
