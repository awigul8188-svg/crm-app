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
      position: 'fixed', inset: 0, zIndex: 99999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#16162a',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20,
        boxShadow: '0 32px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,212,200,0.08)',
        width: '100%',
        maxWidth: wide ? 680 : 480,
        maxHeight: '90vh',
        overflowY: 'auto',
        position: 'relative',
        animation: 'modalIn 0.18s ease-out',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          position: 'sticky', top: 0,
          background: '#16162a',
          zIndex: 1, borderRadius: '20px 20px 0 0',
        }}>
          <div style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 700, fontSize: 16, color: '#fff' }}>{title}</div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 10, border: 'none',
            background: 'rgba(255,255,255,0.07)', cursor: 'pointer', fontSize: 18,
            color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
          >×</button>
        </div>
        <div style={{ padding: '20px 24px 24px' }}>{children}</div>
      </div>
    </div>,
    document.body
  )
}
