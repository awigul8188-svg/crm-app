import { useState, useEffect, createContext, useContext } from 'react'
import Layout from './components/Layout'
import Login from './pages/Login'

// ── Contexts ─────────────────────────────────────────────────
const AuthCtx = createContext(null)
const NavCtx  = createContext(null)
export const useAuth = () => useContext(AuthCtx)
export const useNav  = () => useContext(NavCtx)

// ── Lazy page imports ─────────────────────────────────────────
import Dashboard            from './pages/Dashboard'
import AEDashboard          from './pages/AEDashboard'
import PurchaserDashboard   from './pages/PurchaserDashboard'
import PurchasingManagerView from './pages/PurchasingManagerView'
import InquiryList          from './pages/InquiryList'
import InquiryDetail        from './pages/InquiryDetail'
import Customers            from './pages/Customers'
import CustomerDetail       from './pages/CustomerDetail'
import Notifications        from './pages/Notifications'
import Users                from './pages/Users'
import ImportData           from './pages/ImportData'

function Loader() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0d1117' }}>
      <div style={{ width:32, height:32, borderRadius:'50%', border:'2px solid #00D4C8', borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

export default function App() {
  const [user, setUser]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [page, setPage]           = useState('dashboard')
  const [pageProps, setPageProps] = useState({})

  useEffect(() => {
    const t = localStorage.getItem('crm_token')
    if (!t) { setLoading(false); return }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.ok ? r.json() : null)
      .then(u => {
        if (u) {
          setUser(u)
          // Set default landing page by role
          if (u.role === 'purchasing_manager') setPage('purchasing')
          else if (u.role === 'purchaser')     setPage('dashboard')
          else                                  setPage('dashboard')
        }
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
    if (data.user.role === 'purchasing_manager') setPage('purchasing')
    else if (data.user.role === 'purchaser')     setPage('dashboard')
    else                                          setPage('dashboard')
  }

  const logout = () => {
    localStorage.removeItem('crm_token')
    setUser(null)
    setPage('dashboard')
  }

  const navigate = (newPage, props = {}) => {
    setPage(newPage)
    setPageProps(props || {})
    window.scrollTo(0, 0)
  }

  if (loading) return <Loader />

  if (!user) return (
    <AuthCtx.Provider value={{ user, login, logout }}>
      <NavCtx.Provider value={{ navigate, page, pageProps }}>
        <Login />
      </NavCtx.Provider>
    </AuthCtx.Provider>
  )

  const renderPage = () => {
    const role = user.role

    // ── Purchaser: only their own parts + dashboard ──────────
    if (role === 'purchaser') {
      if (page === 'notifications') return <Notifications />
      return <PurchaserDashboard />
    }

    // ── All other roles ──────────────────────────────────────
    if (page === 'dashboard') {
      if (role === 'ae')                 return <AEDashboard />
      if (role === 'purchasing_manager') return <PurchasingManagerView />
      return <Dashboard />   // manager
    }
    if (page === 'ae-dashboard')      return <AEDashboard />
    if (page === 'purchasing')        return <PurchasingManagerView />
    if (page === 'purchasing-parts')  return <PurchasingManagerView />
    if (page === 'leads')             return <InquiryList type="lead" />
    if (page === 'repeat')            return <InquiryList type="repeat" />
    if (page === 'orders')            return <InquiryList type="online_order" />
    if (page === 'inquiry-detail')    return <InquiryDetail id={pageProps.id} />
    if (page === 'customers')         return <Customers />
    if (page === 'customer-detail')   return <CustomerDetail id={pageProps.id} />
    if (page === 'notifications')     return <Notifications />
    if (page === 'users')             return <Users />
    if (page === 'import')            return <ImportData />

    // Fallback
    if (role === 'ae')                 return <AEDashboard />
    if (role === 'purchasing_manager') return <PurchasingManagerView />
    return <Dashboard />
  }

  return (
    <AuthCtx.Provider value={{ user, login, logout }}>
      <NavCtx.Provider value={{ navigate, page, pageProps }}>
        <Layout page={page}>
          {renderPage()}
        </Layout>
      </NavCtx.Provider>
    </AuthCtx.Provider>
  )
}