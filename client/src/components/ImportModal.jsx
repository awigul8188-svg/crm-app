import { useState, useRef } from 'react'
import Modal from './Modal'
import { importApi, operationsApi } from '../api'

const BRAND = '#00D4C8'

export default function ImportModal({ onClose, onDone, onStatsRefresh }) {
  const [file, setFile] = useState(null)
  const [importing, setImporting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [cleared, setCleared] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [drag, setDrag] = useState(false)
  const inputRef = useRef()

  const handleFile = (f) => {
    if (!f) return
    if (!f.name.match(/\.xlsx?$/i)) { setError('Please upload an .xlsx file'); return }
    setFile(f); setError('')
  }

  const handleClear = async () => {
    setClearing(true); setError('')
    try {
      await importApi.clearOperations()
      setCleared(true)
      setConfirmClear(false)
      if (onStatsRefresh) onStatsRefresh()
    } catch(e) { setError(e.message) } finally { setClearing(false) }
  }

  const handleImport = async () => {
    if (!file) return
    setImporting(true); setError('')
    try {
      const res = await importApi.importOperations(file)
      setResult(res.stats)
      if (onStatsRefresh) onStatsRefresh()
    } catch(e) { setError(e.message) } finally { setImporting(false) }
  }

  if (result) {
    return (
      <Modal title="Import Complete" onClose={onClose} wide>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ fontWeight: 700, color: '#065f46', fontSize: 16, marginBottom: 16 }}>✓ Import Successful</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {[
                { label: 'Orders', value: result.orders, color: '#0f172a' },
                { label: 'Line Items', value: result.items, color: '#0f172a' },
                { label: 'RMAs Created', value: result.rmas, color: '#ef4444' },
                { label: 'New Customers', value: result.customers, color: '#6366f1' },
                { label: 'New Suppliers', value: result.suppliers, color: '#f59e0b' },
                { label: 'Skipped (dupes)', value: result.skipped, color: '#94a3b8' },
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
              <div style={{ fontWeight: 700, color: '#9a3412', fontSize: 12, marginBottom: 8 }}>⚠ {result.errors.length} warnings</div>
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
      </Modal>
    )
  }

  return (
    <Modal title="Import Operations Data" onClose={onClose} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Step 1: Clear */}
        <div style={{
          border: `1.5px solid ${cleared ? '#bbf7d0' : '#fee2e2'}`,
          borderRadius: 16, padding: '16px 20px',
          background: cleared ? '#f0fdf4' : '#fff5f5',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: cleared ? 0 : 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: cleared ? '#065f46' : '#991b1b', display: 'flex', alignItems: 'center', gap: 6 }}>
                {cleared ? '✓ Step 1 — Data cleared' : 'Step 1 — Clear existing data'}
              </div>
              {!cleared && (
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
                  Removes all orders, items, and RMAs (pending CRM orders are preserved)
                </div>
              )}
            </div>
            {!cleared && !confirmClear && (
              <button onClick={() => setConfirmClear(true)} style={{
                background: '#ef4444', color: '#fff', border: 'none', borderRadius: 10,
                padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap'
              }}>
                Clear All Data
              </button>
            )}
            {cleared && (
              <button onClick={() => { setCleared(false); setConfirmClear(false) }} style={{
                background: 'none', border: '1px solid #bbf7d0', borderRadius: 8,
                padding: '4px 10px', fontSize: 11, color: '#065f46', cursor: 'pointer'
              }}>undo</button>
            )}
          </div>

          {confirmClear && !cleared && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, padding: '10px 14px', background: '#fee2e2', borderRadius: 10 }}>
              <span style={{ fontSize: 13, color: '#991b1b', flex: 1 }}>This will delete all imported orders. Are you sure?</span>
              <button onClick={() => setConfirmClear(false)} style={{
                background: '#fff', border: '1px solid #fca5a5', borderRadius: 8,
                padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: '#991b1b'
              }}>Cancel</button>
              <button onClick={handleClear} disabled={clearing} style={{
                background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8,
                padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
              }}>
                {clearing && <span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />}
                {clearing ? 'Clearing…' : 'Yes, delete all'}
              </button>
            </div>
          )}
        </div>

        {/* Step 2: Upload */}
        <div style={{
          border: `1.5px solid #e2e8f0`, borderRadius: 16, padding: '16px 20px',
          opacity: cleared ? 1 : 0.55,
          transition: 'opacity 0.2s',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 12 }}>
            Step 2 — Upload your Excel file
          </div>

          <div
            onClick={() => cleared && inputRef.current?.click()}
            onDragOver={e => { if (!cleared) return; e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { if (!cleared) return; e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]) }}
            style={{
              border: `2px dashed ${drag ? BRAND : file ? BRAND : '#e2e8f0'}`,
              borderRadius: 12, padding: '24px', textAlign: 'center',
              cursor: cleared ? 'pointer' : 'not-allowed',
              background: drag ? '#f0fffe' : file ? '#f0fffe' : '#f8fafc',
              transition: 'all 0.15s'
            }}
          >
            <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
            {file ? (
              <div>
                <div style={{ fontSize: 24, marginBottom: 6 }}>📊</div>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>{file.name}</div>
                <div style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>{(file.size / 1024).toFixed(0)} KB — click to change</div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 24, marginBottom: 6 }}>📂</div>
                <div style={{ fontWeight: 600, color: cleared ? '#334155' : '#94a3b8', fontSize: 13 }}>
                  {cleared ? 'Drop your .xlsx file here' : 'Clear data first (Step 1)'}
                </div>
                <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 3 }}>TA Quotes &amp; Orders sheet.xlsx</div>
              </div>
            )}
          </div>
        </div>

        {error && <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleImport}
            disabled={!file || !cleared || importing}
            title={!cleared ? 'Complete Step 1 first' : !file ? 'Select a file' : ''}>
            {importing ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                Importing…
              </span>
            ) : 'Import Data'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
