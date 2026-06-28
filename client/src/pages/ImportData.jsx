import { useState, useRef } from 'react'
import { Upload, Lock } from 'lucide-react'
import { useAuth } from '../App'
import { importApi } from '../api'
import PageHeader from '../components/PageHeader'

export default function ImportData() {
  const { user } = useAuth()
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef()

  // Step 1 — clear existing CRM data before importing fresh (mirrors the Operations import flow)
  const [cleared, setCleared] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)

  if (!['manager', 'purchasing_manager'].includes(user.role)) return (
    <div className="page-wrap text-center">
      <Lock size={36} className="mx-auto mb-3 text-ink-300" />
      <div className="font-semibold text-ink-500">Managers only</div>
    </div>
  )

  const handleFile = (f) => {
    if (!f) return
    if (!f.name.endsWith('.xlsx') && !f.name.endsWith('.xls')) {
      setError('Please upload an Excel file (.xlsx or .xls)')
      return
    }
    setFile(f)
    setResult(null)
    setError('')
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false)
    if (!cleared) return
    handleFile(e.dataTransfer.files[0])
  }

  const handleClear = async () => {
    setClearing(true); setError('')
    try {
      await importApi.clearCrm()
      setCleared(true); setConfirmClear(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setClearing(false)
    }
  }

  const handleImport = async () => {
    if (!file || !cleared) return
    setLoading(true); setError(''); setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const token = localStorage.getItem('crm_token')
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import failed')
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-wrap max-w-2xl">
      <PageHeader
        icon={<Upload size={18} />}
        title="Import Data"
        subtitle="Clear existing data, then upload your Excel file to import Leads, Repeat Inquiries, and Online Orders"
      />

      {/* Instructions */}
      <div className="card p-4 mb-5 bg-brand-50 border-brand-200">
        <div className="text-sm font-semibold text-brand-700 mb-2">📋 Expected Sheet Names</div>
        <div className="space-y-1 text-sm text-brand-600">
          <div className="flex items-center gap-2"><span className="font-mono bg-brand-100 px-1.5 py-0.5 rounded text-xs">New Leads</span> → Imports as Leads</div>
          <div className="flex items-center gap-2"><span className="font-mono bg-brand-100 px-1.5 py-0.5 rounded text-xs">Repeat Inquiries</span> → Imports as Repeat Inquiries</div>
          <div className="flex items-center gap-2"><span className="font-mono bg-brand-100 px-1.5 py-0.5 rounded text-xs">Online Orders</span> → Imports as Online Orders</div>
        </div>
        <div className="text-xs text-brand-500 mt-2">Other sheets (Dashboard, Chat Orders, etc.) are ignored.</div>
      </div>

      {/* Step 1 — Clear existing data */}
      <div className={`card p-5 mb-4 ${cleared ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className={`text-sm font-bold ${cleared ? 'text-green-700' : 'text-red-700'}`}>
              {cleared ? '✓ Step 1 — Data cleared' : 'Step 1 — Clear existing data'}
            </div>
            {!cleared && (
              <div className="text-xs text-ink-400 mt-1">Removes all current CRM data. Your user accounts are preserved.</div>
            )}
          </div>
          {!cleared && !confirmClear && (
            <button onClick={() => setConfirmClear(true)} className="btn-danger btn-sm whitespace-nowrap">🗑️ Clear All Data</button>
          )}
          {cleared && (
            <button onClick={() => { setCleared(false); setConfirmClear(false) }}
              title="Data is already cleared — this only resets the import step, it does not restore deleted data"
              className="text-xs text-slate-600 border border-slate-200 rounded-lg px-2.5 py-1 hover:bg-slate-100 transition-colors">↺ Reset step</button>
          )}
        </div>

        {confirmClear && !cleared && (
          <div className="mt-3 bg-red-100 border border-red-200 rounded-xl p-4">
            <div className="text-sm font-semibold text-red-800 mb-2">⚠️ This will permanently delete:</div>
            <ul className="text-xs text-red-700 mb-3 pl-5 list-disc space-y-0.5 leading-relaxed">
              <li>All customers &amp; leads</li>
              <li>All inquiries &amp; orders</li>
              <li>All requirements &amp; purchasing quotes/assignments</li>
              <li>All follow-ups &amp; comments</li>
              <li>All notifications &amp; activity logs</li>
            </ul>
            <div className="text-xs text-red-800 font-medium mb-3">Your user accounts will be preserved. This cannot be undone.</div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmClear(false)} disabled={clearing}
                className="flex-1 border border-red-200 bg-white text-red-600 rounded-lg py-2 text-xs font-semibold disabled:opacity-60">Cancel</button>
              <button onClick={handleClear} disabled={clearing}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-xs font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                {clearing && <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white spinner" />}
                {clearing ? 'Clearing…' : 'Yes, Clear All Data'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Step 2 — Upload & import (gated until cleared) */}
      <div className={`transition-opacity ${cleared ? 'opacity-100' : 'opacity-55'}`}>
        <div className="text-sm font-bold text-ink-600 mb-2">Step 2 — Upload your Excel file</div>
        <div
          onDragOver={e => { if (!cleared) return; e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => cleared && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all mb-4 ${
            !cleared ? 'border-ink-200 cursor-not-allowed' :
            dragging ? 'border-brand-400 bg-brand-50 cursor-pointer' : file ? 'border-green-400 bg-green-50 cursor-pointer' : 'border-ink-200 hover:border-brand-300 hover:bg-surface-100 cursor-pointer'
          }`}
        >
          <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => handleFile(e.target.files[0])} />
          {file ? (
            <div>
              <div className="text-3xl mb-2">📊</div>
              <div className="font-semibold text-green-700">{file.name}</div>
              <div className="text-sm text-green-600 mt-0.5">{(file.size / 1024).toFixed(0)} KB · Ready to import</div>
              <button onClick={e => { e.stopPropagation(); setFile(null); setResult(null) }} className="text-xs text-red-500 hover:text-red-600 mt-2">Remove</button>
            </div>
          ) : (
            <div>
              <div className="text-4xl mb-3 opacity-30">📁</div>
              <div className="font-semibold text-ink-600">{cleared ? 'Drop your Excel file here' : 'Clear data first (Step 1)'}</div>
              {cleared && <div className="text-sm text-ink-400 mt-1">or click to browse</div>}
              <div className="text-xs text-ink-300 mt-2">.xlsx or .xls only</div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">
            ⚠ {error}
          </div>
        )}

        <button
          onClick={handleImport}
          disabled={!file || !cleared || loading}
          title={!cleared ? 'Complete Step 1 first' : ''}
          className="btn-primary w-full py-3 mb-6"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 rounded-full border-2 border-dark-900 border-t-transparent spinner" />
              Importing {file?.name}...
            </span>
          ) : <><Upload size={15} /> Start Import</>}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className={`card p-5 ${result.created > 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="text-3xl">{result.created > 0 ? '✅' : '⚠️'}</div>
            <div>
              <div className="font-display font-bold text-lg text-ink-900">{result.created} records imported successfully</div>
              {result.errors?.length > 0 && <div className="text-sm text-amber-600">{result.errors.length} rows had issues (see below)</div>}
            </div>
          </div>

          {result.errors?.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-bold text-ink-500 uppercase tracking-widest mb-2">Rows with issues:</div>
              <div className="bg-white rounded-xl border p-3 max-h-48 overflow-y-auto space-y-1">
                {result.errors.map((e, i) => (
                  <div key={i} className="text-xs text-red-600 font-mono">{e}</div>
                ))}
              </div>
            </div>
          )}

          {result.created > 0 && (
            <div className="mt-4 text-sm text-green-700 font-medium">
              Your data is now in the CRM. Head to Leads, Repeat Inquiries, or Online Orders to see it.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
