import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', handler); document.body.style.overflow = '' }
  }, [])

  return createPortal(
    <div onClick={onClose} style={{
      position:'fixed', inset:0, zIndex:99999,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16,
      background:'rgba(0,0,0,0.65)', backdropFilter:'blur(8px)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:'var(--modal-bg)',
        border:'1px solid var(--modal-border)',
        borderRadius:20,
        boxShadow:'0 32px 100px rgba(0,0,0,0.5)',
        width:'100%', maxWidth: wide ? 680 : 480,
        maxHeight:'90vh', overflowY:'auto',
        animation:'modalIn 0.18s ease-out',
      }}>
        {/* Header */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'20px 24px 16px',
          borderBottom:'1px solid var(--border)',
          position:'sticky', top:0,
          background:'var(--modal-bg)',
          zIndex:1, borderRadius:'20px 20px 0 0',
        }}>
          <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:16, color:'var(--text)' }}>{title}</div>
          <button onClick={onClose} style={{
            width:32, height:32, borderRadius:10, border:'none',
            background:'var(--card-2)', cursor:'pointer', fontSize:18,
            color:'var(--text-3)', display:'flex', alignItems:'center', justifyContent:'center',
            transition:'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background='var(--card-3)'; e.currentTarget.style.color='var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.background='var(--card-2)'; e.currentTarget.style.color='var(--text-3)' }}
          >×</button>
        </div>
        <div style={{ padding:'20px 24px 24px' }}>{children}</div>
      </div>
      <style>{`@keyframes modalIn{from{opacity:0;transform:scale(0.96) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
    </div>,
    document.body
  )
}
