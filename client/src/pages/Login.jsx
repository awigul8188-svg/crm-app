import { useState } from 'react'
import { useAuth } from '../App'
import TALogo from '../components/TALogo'

export default function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true)
    try { await login(username, password) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left — brand panel, near-black matching logo */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: '#0d0d0d' }}>

        {/* Decorative cyan glow */}
        <div className="absolute bottom-[-120px] left-[-80px] w-96 h-96 rounded-full opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #00D4C8 0%, transparent 70%)' }} />
        <div className="absolute top-[-80px] right-[-60px] w-64 h-64 rounded-full opacity-5 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #00D4C8 0%, transparent 70%)' }} />

        {/* Logo */}
        <div className="relative flex items-center gap-4">
          <TALogo size={44} />
          <div>
            <div className="font-display font-bold text-white text-2xl leading-none tracking-tight">TECH</div>
            <div className="font-display font-bold text-2xl leading-none tracking-tight" style={{ color: '#00D4C8' }}>ATLANTIX</div>
          </div>
        </div>

        {/* Main copy */}
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 mb-6 text-xs font-semibold"
            style={{ background: 'rgba(0,212,200,0.12)', color: '#00D4C8', border: '1px solid rgba(0,212,200,0.2)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#00D4C8' }} />
            Internal Sales Portal
          </div>
          <h1 className="font-display text-5xl font-extrabold text-white leading-[1.05] mb-4 tracking-tight">
            Track every<br />deal. Close<br />faster.
          </h1>
          <p className="text-sm leading-relaxed max-w-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Leads, repeat inquiries, and online orders — all in one place. Real-time analytics for the whole team.
          </p>

          {/* Stats row */}
          <div className="mt-10 flex gap-8">
            {[['◎', 'Leads'], ['↻', 'Repeat'], ['◈', 'Orders'], ['▣', 'Analytics']].map(([icon, label]) => (
              <div key={label} className="text-center">
                <div className="text-xl mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{icon}</div>
                <div className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>
          Beyond Tech · Above Integration
        </div>
      </div>

      {/* Right — sign in form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-surface-50">
        <div className="w-full max-w-[360px]">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <TALogo size={32} light />
            <div>
              <div className="font-display font-bold text-ink-900 text-lg leading-none">TECH</div>
              <div className="font-display font-bold text-lg leading-none" style={{ color: '#00D4C8' }}>ATLANTIX</div>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="font-display font-bold text-2xl text-ink-900 mb-1">Sign in</h2>
            <p className="text-ink-400 text-sm">Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-ink-600 uppercase tracking-widest mb-2 block">Username</label>
              <input className="input" placeholder="your username" value={username} onChange={e => setUsername(e.target.value)} autoFocus required />
            </div>
            <div>
              <label className="text-xs font-bold text-ink-600 uppercase tracking-widest mb-2 block">Password</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} className="input pr-10" placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)} required />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-ink-400 hover:text-ink-600 transition-colors">
                  {showPass ? 'hide' : 'show'}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2.5 rounded-xl">
                ⚠ {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="btn-primary w-full py-3 mt-2 text-dark-900 font-bold"
              style={{ background: '#00D4C8' }}>
              {loading
                ? <span className="w-4 h-4 rounded-full border-2 border-dark-900 border-t-transparent spinner" />
                : <>Sign in <span className="opacity-60">→</span></>}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
