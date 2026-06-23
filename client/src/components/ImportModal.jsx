import { useState, useRef } from 'react'
import Modal from './Modal'
import { importApi } from '../api'

const BRAND = '#00D4C8'

export default function ImportModal({ onClose, onDone }) {
  const [file, setFile] = useState(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [drag, setDrag] = useState(false)
  const inputRef = useRef()

  const handleFile = (f) => {
    if (!f) return
    if (!f.name.match(/\.xlsx?$/i)) { setError('Please upload an .xlsx file'); return }
    setFile(f); setError(''); setResult(null)
  }

  const handleImport = async () => {
    if (!file) return
    setImporting(true); setError('')
    try {
      const res = await importApi.importOperations(file)
      setResult(res.stats)
    } catch(e) { setError(e.message) } finally { setImporting(false) }
  }

  return (
    <Modal title="Import Operations Data" onClose={onClose} wide>
      {!result ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
            Upload your <strong>TA Quotes &amp; Orders</strong> Excel sheet (.xlsx). The system will automatically:
            <ul style={{ marginTop: 8, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li>Create customers and suppliers if they don't exist</li>
              <li>Import all orders and line items</li>
              <li>Convert "Refunded" rows to RMA records</li>
              <li>Skip orders that are already in the system (by order number)</li>
            </ul>
          </div>

          {/* Drop zone */}
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]) }}
            style={{
              border: `2px dashed ${drag ? BRAND : file ? BRAND : '#e2e8f0'}`,
              borderRadius: 16, padding: '32px 24px', textAlign: 'center', cursor: 'pointer',
              background: drag ? '#f0fffe' : file ? '#f0fffe' : '#f8fafc',
              transition: 'all 0.15s'
            }}
          >
            <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
            {file ? (
              <div>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{file.name}</div>
                <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>{(file.size / 1024).toFixed(0)} KB — click to change</div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
                <div style={{ fontWeight: 600, color: '#334155', fontSize: 14 }}>Drop your .xlsx file here</div>
                <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>or click to browse</div>
              </div>
            )}
          </div>

          {error && <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>{error}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleImport} disabled={!file || importing}>
              {importing ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                  Importing…
                </span>
              ) : 'Import Data'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ fontWeight: 700, color: '#065f46', fontSize: 16, marginBottom: 16 }}>✓ Import Complete</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {[
                { label: 'Orders', value: result.orders, color: '#0f172a' },
                { label: 'Line Items', value: result.items, color: '#0f172a' },
                { label: 'RMAs Created', value: result.rmas, color: '#ef4444' },
                { label: 'New Customers', value: result.customers, color: '#6366f1' },
                { label: 'New Suppliers', value: result.suppliers, color: '#f59e0b' },
                { label: 'Skipped (duplicates)', value: result.skipped, color: '#94a3b8' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center', background: '#fff', borderRadius: 10, padding: '12px 8px' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: s.color, fontFamily: '"Bricolage Grotesque", sans-serif' }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {result.errors?.length > 0 && (
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontWeight: 700, color: '#9a3412', fontSize: 12, marginBottom: 8 }}>⚠ {result.errors.length} warnings during import</div>
              <div style={{ maxHeight: 120, overflowY: 'auto', fontSize: 11, color: '#7c2d12', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {result.errors.slice(0, 20).map((e, i) => <div key={i}>{e}</div>)}
                {result.errors.length > 20 && <div style={{ color: '#94a3b8' }}>...and {result.errors.length - 20} more</div>}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
            <button className="btn btn-primary" onClick={() => { onClose(); onDone && onDone() }}>View Orders</button>
          </div>
        </div>
      )}
    </Modal>
  )
}
