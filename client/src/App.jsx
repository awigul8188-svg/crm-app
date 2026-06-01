import { useState, useEffect, createContext, useContext, lazy, Suspense } from 'react'
import Layout from './components/Layout'
import Login from './pages/Login'
import { defaultPage, can } from './rbac'

// ── Auth context ─────────────────────────────────────────────
const AuthContext = createContext(null)
const NavContext  = createContext(null)
export const useAuth = () => useContext(AuthContext)
export const useNav  = () => useContext(NavContext)

const token = () => localStorage.getItem('crm_token')

// ── Lazy page imports ─────────────────────────────────────────
const Dashboard          = lazy(() => import('./pages/Dashboard'))
const AEDashboard        = lazy(() => import('./pages/AEDashboard'))
const PurchaserDashboard = lazy(() => import('./pages/PurchaserDashboard'))
const InquiryList        = lazy(() => import('./pages/InquiryList'))
const InquiryDetail      = lazy(() => import('./pages/InquiryDetail'))
const Customers          = lazy(() => import('./pages/Customers'))
const CustomerDetail     = lazy(() => import('./pages/CustomerDetail'))
const Notifications      = lazy(() => import('./pages/Notifications'))
const Users              = lazy(() => import('./pages/Users'))
const ImportData         = lazy(() => import('./pages/ImportData'))
const PurchasingManagerView = lazy(() => import('./pages/PurchasingManagerView'))
const PurchaserDashboardPage = lazy(() => import('./pages/PurchaserDashboard'))

function Loader() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flex:1 }}>
      <div style={{ width:28, height:28, borderRadius:'50%', border:'2px solid #00D4C8', borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ── Route guard ───────────────────────────────────────────────
function Blocked() {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', flex:1, gap:12, fontFamily:'"Plus Jakarta Sans",sans-serif' }}>
      <div style={{ fontSize:48 }}>🔒</div>
      <div style={{ fontFamily:'"Bricolage Grotesque",sans-serif', fontWeight:700, fontSize:18, color:'var(--text)' }}>Access Restricted</div>
      <div style={{ fontSize:14, color:'var(--text-3)' }}>You don't have permission to view this page.</div>
    </div>
  )
}

// ── Page renderer ─────────────────────────────────────────────
function PageRenderer({ page, pageProps, user }) {
  const role = user?.role

  // Purchaser — only dashboard and my-parts
  if (role === 'purchaser') {
    if (page === 'purchaser-dashboard' || page === 'dashboard') return <PurchaserDashboardPage />
    if (page === 'purchasing')  return <PurchasingManagerView />
    if (page === 'notifications') return <Suspense fallback={<Loader/>}><Notifications /></Suspense>
    return <PurchaserDashboardPage />
  }

  // AE — own leads/repeat/orders/customers + follow-ups
  if (role === 'ae') {
    if (page === 'ae-dashboard' || page === 'dashboard') return <Suspense fallback={<Loader/>}><AEDashboard /></Suspense>
    if (page === 'leads')          return <Suspense fallback={<Loader/>}><InquiryList type="lead" /></Suspense>
    if (page === 'repeat')         return <Suspense fallback={<Loader/>}><InquiryList type="repeat" /></Suspense>
    if (page === 'orders')         return <Suspense fallback={<Loader/>}><InquiryList type="online_order" /></Suspense>
    if (page === 'inquiry-detail') return <Suspense fallback={<Loader/>}><InquiryDetail id={pageProps?.id} /></Suspense>
    if (page === 'customers')      return <Suspense fallback={<Loader/>}><Customers /></Suspense>
    if (page === 'customer-detail')return <Suspense fallback={<Loader/>}><CustomerDetail id={pageProps?.id} /></Suspense>
    if (page === 'notifications')  return <Suspense fallback={<Loader/>}><Notifications /></Suspense>
    return <Suspense fallback={<Loader/>}><AEDashboard /></Suspense>
  }

  // Purchasing Manager — all pages, lands on purchasing
  if (role === 'purchasing_manager') {
    if (page === 'purchasing' || page === 'dashboard') return <PurchasingManagerView />
    if (page === 'leads')          return <Suspense fallback={<Loader/>}><InquiryList type="lead" /></Suspense>
    if (page === 'repeat')         return <Suspense fallback={<Loader/>}><InquiryList type="repeat" /></Suspense>
    if (page === 'orders')         return <Suspense fallback={<Loader/>}><InquiryList type="online_order" /></Suspense>
    if (page === 'inquiry-detail') return <Suspense fallback={<Loader/>}><InquiryDetail id={pageProps?.id} /></Suspense>
    if (page === 'customers')      return <Suspense fallback={<Loader/>}><Customers /></Suspense>
    if (page === 'customer-detail')return <Suspense fallback={<Loader/>}><CustomerDetail id={pageProps?.id} /></Suspense>
    if (page === 'notifications')  return <Suspense fallback={<Loader/>}><Notifications /></Suspense>
    if (page === 'users')          return <Suspense fallback={<Loader/>}><Users /></Suspense>
    return <PurchasingManagerView />
  }

  // Manager — full access
  if (role === 'manager') {
    if (page === 'dashboard')      return <Suspense fallback={<Loader/>}><Dashboard /></Suspense>
    if (page === 'leads')          return <Suspense fallback={<Loader/>}><InquiryList type="lead" /></Suspense>
    if (page === 'repeat')         return <Suspense fallback={<Loader/>}><InquiryList type="repeat" /></Suspense>
    if (page === 'orders')         return <Suspense fallback={<Loader/>}><InquiryList type="online_order" /></Suspense>
    if (page === 'inquiry-detail') return <Suspense fallback={<Loader/>}><InquiryDetail id={pageProps?.id} /></Suspense>
    if (page === 'customers')      return <Suspense fallback={<Loader/>}><Customers /></Suspense>
    if (page === 'customer-detail')return <Suspense fallback={<Loader/>}><CustomerDetail id={pageProps?.id} /></Suspense>
    if (page === 'notifications')  return <Suspense fallback={<Loader/>}><Notifications /></Suspense>
    if (page === 'users')          return <Suspense fallback={<Loader/>}><Users /></Suspense>
    if (page === 'import')         return <Suspense fallback={<Loader/>}><ImportData /></Suspense>
    if (page === 'purchasing')     return <PurchasingManagerView />
    return <Suspense fallback={<Loader/>}><Dashboard /></Suspense>
  }

  return <Blocked />
}

// ── Main App ──────────────────────────────────────────────────
export default function App() {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage]       = useState('dashboard')
  const [pageProps, setPageProps] = useState({})

  // Restore session
  useEffect(() => {
    const t = token()
    if (!t) { setLoading(false); return }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.ok ? r.json() : null)
      .then(u => {
        if (u) { setUser(u); setPage(defaultPage(u)); }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const login = async (username, password) => {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error || 'Login failed')
    localStorage.setItem('crm_token', data.token)
    setUser(data.user)
    setPage(defaultPage(data.user))
  }

  const logout = () => {
    localStorage.removeItem('crm_token')
    setUser(null)
    setPage('dashboard')
  }

  const navigate = (newPage, props = {}) => {
    setPage(newPage)
    setPageProps(props)
    window.scrollTo(0, 0)
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0d1117' }}>
      <div style={{ width:32, height:32, borderRadius:'50%', border:'2px solid #00D4C8', borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!user) return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <NavContext.Provider value={{ navigate, page, pageProps }}>
        <Login />
      </NavContext.Provider>
    </AuthContext.Provider>
  )

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <NavContext.Provider value={{ navigate, page, pageProps }}>
        <Layout currentPage={page}>
          <Suspense fallback={<Loader />}>
            <PageRenderer page={page} pageProps={pageProps} user={user} />
          </Suspense>
        </Layout>
      </NavContext.Provider>
    </AuthContext.Provider>
  )
}
