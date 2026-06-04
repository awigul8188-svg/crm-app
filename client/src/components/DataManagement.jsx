import { useState } from 'react'
import { api } from '../api'

export default function DataManagement() {
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [message, setMessage] = useState('')

  const handleClearData = async () => {
    setLoading(true)
    try {
      const response = await api.post('/admin/clear-data', {
        confirm: 'DELETE_ALL_DATA'
      })
      
      if (response.success) {
        setMessage('✅ All CRM data cleared successfully. Ready for new data import.')
        setShowConfirm(false)
        setTimeout(() => setMessage(''), 5000)
      }
    } catch (error) {
      setMessage(`❌ Error: ${error.message}`)
      setTimeout(() => setMessage(''), 5000)
    } finally {
      setLoading(false)
    }
  }

  const BRAND = '#00D4C8'

  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      border: '1px solid #f1f5f9',
      padding: '18px 20px',
      marginTop: 16
    }}>
      <div style={{
        fontFamily: '"Bricolage Grotesque", sans-serif',
        fontWeight: 700,
        fontSize: 14,
        color: '#0f172a',
        marginBottom: 12
      }}>
        Data Management
      </div>

      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14, lineHeight: 1.5 }}>
        Clear all leads, orders, repeat customers, and related data. Your user accounts will remain. This action cannot be undone.
      </div>

      {message && (
        <div style={{
          background: message.includes('✅') ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${message.includes('✅') ? '#bbf7d0' : '#fecaca'}`,
          borderRadius: 8,
          padding: '10px 12px',
          fontSize: 12,
          color: message.includes('✅') ? '#166534' : '#991b1b',
          marginBottom: 12
        }}>
          {message}
        </div>
      )}

      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          style={{
            background: '#ef4444',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            transition: 'all 0.2s'
          }}
          onMouseOver={e => {
            e.target.style.background = '#dc2626'
            e.target.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)'
          }}
          onMouseOut={e => {
            e.target.style.background = '#ef4444'
            e.target.style.boxShadow = 'none'
          }}
        >
          🗑️ Clear All Data
        </button>
      ) : (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 10,
          padding: 14,
          marginTop: 8
        }}>
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#7f1d1d',
            marginBottom: 10
          }}>
            ⚠️ This will permanently delete:
          </div>
          <ul style={{
            fontSize: 12,
            color: '#991b1b',
            marginBottom: 12,
            paddingLeft: 20,
            lineHeight: 1.6
          }}>
            <li>All customers & leads</li>
            <li>All inquiries & orders</li>
            <li>All requirements & quotes</li>
            <li>All follow-ups & comments</li>
            <li>All notifications & activity logs</li>
          </ul>
          
          <div style={{ fontSize: 11, color: '#7f1d1d', marginBottom: 12, fontWeight: 500 }}>
            Your user accounts will be preserved.
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowConfirm(false)}
              disabled={loading}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #fecaca',
                background: '#fff',
                color: '#dc2626',
                fontSize: 12,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                fontFamily: '"Plus Jakarta Sans", sans-serif'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleClearData}
              disabled={loading}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 6,
                border: 'none',
                background: '#dc2626',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                fontFamily: '"Plus Jakarta Sans", sans-serif'
              }}
            >
              {loading ? 'Clearing...' : 'Yes, Clear All Data'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
