import { useState } from 'react'
import { useAuth } from '../App'

export default function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try { await login(username, password) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#f8fafc' }}>
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between p-12 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #312e81 100%)' }}>
        {/* Decorative circles */}
        <div className="absolute top-[-80px] right-[-80px] w-72 h-72 rounded-full border border-white/5" />
        <div className="absolute top-[-40px] right-[-40px] w-48 h-48 rounded-full border border-white/8" />
        <div className="absolute bottom-[-60px] left-[-60px] w-64 h-64 rounded-full border border-white/5" />

        <div className="relative flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold shadow-lg">⚡</div>
          <span className="font-display font-bold text-white text-xl">CRM</span>
        </div>

        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-3 py-1.5 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-white/70 text-xs font-medium">Your team's workspace</span>
          </div>
          <h1 className="font-display text-5xl font-extrabold text-white leading-[1.1] mb-4">
            Close more.<br />Track everything.
          </h1>
          <p className="text-white/50 text-sm leading-relaxed max-w-sm">
            Leads, repeat inquiries, and online orders — all in one place with real-time analytics.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4">
            {[['◎', 'Leads', 'Track new leads'], ['↻', 'Repeat', 'Manage follow-ups'], ['◈', 'Orders', 'Online orders']].map(([icon, label, sub]) => (
              <div key={label} className="bg-white/8 rounded-2xl p-4 backdrop-blur-sm">
                <div className="text-2xl mb-2 text-white/80">{icon}</div>
                <div className="text-white font-semibold text-sm">{label}</div>
                <div className="text-white/40 text-xs mt-0.5">{sub}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-white/20 text-xs">© 2025 CRM · Internal Use Only</div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-[360px]">
          <div className="mb-8">
            <h2 className="font-display font-bold text-2xl text-ink-900 mb-1">Sign in</h2>
            <p className="text-ink-500 text-sm">Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-ink-700 uppercase tracking-wide mb-2 block">Username</label>
              <input className="input" placeholder="your username" value={username} onChange={e => setUsername(e.target.value)} autoFocus required />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-700 uppercase tracking-wide mb-2 block">Password</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} className="input pr-10" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 text-xs">
                  {showPass ? 'hide' : 'show'}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2.5 rounded-xl">
                <span>⚠</span> {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
              {loading ? <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent spinner" /> : <>Sign in <span className="text-white/70">→</span></>}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
