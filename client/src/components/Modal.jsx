import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [])

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.06)',
          width: '100%',
          maxWidth: wide ? '680px' : '480px',
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
          animation: 'modalIn 0.18s ease-out',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 16px',
          borderBottom: '1px solid #f1f5f9',
          position: 'sticky', top: 0, background: '#fff', zIndex: 1,
          borderRadius: '20px 20px 0 0',
        }}>
          <div style={{ fontFamily: '"Bricolage Grotesque", sans-serif', fontWeight: 700, fontSize: '16px', color: '#0f172a' }}>{title}</div>
          <button
            onClick={onClose}
            style={{
              width: '32px', height: '32px', borderRadius: '10px', border: 'none',
              background: '#f1f5f9', cursor: 'pointer', fontSize: '18px', color: '#64748b',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.target.style.background = '#e2e8f0'}
            onMouseLeave={e => e.target.style.background = '#f1f5f9'}
          >\u00d7</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px 24px' }}>
          {children}
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  )
}
