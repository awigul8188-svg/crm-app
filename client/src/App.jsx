import { useState, useEffect, useRef, createContext, useContext } from 'react'
import { api } from './api'
import Login from './pages/Login'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import InquiryList from './pages/InquiryList'
import Customers from './pages/Customers'
import InquiryDetail from './pages/InquiryDetail'
import CustomerDetail from './pages/CustomerDetail'
import Users from './pages/Users'
import ImportData from './pages/ImportData'
import Notifications from './pages/Notifications'
import AEDashboard from './pages/AEDashboard'
import BuyerDashboard from './pages/BuyerDashboard'
import PurchasingManagerView from './pages/PurchasingManagerView'
import PurchaserDashboard, { PartDetailModal, PurchaserParts } from './pages/PurchaserDashboard'
import Operations from './pages/Operations'

export const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)
export const NavContext = createContext(null)
export const useNav = () => useContext(NavContext)

// Ringtone player for AEs \u2014 polls every 3 seconds
function RingtonePlayer({ userId }) {
  const audioRef = useRef(null)
  const activeRef = useRef(false)

  useEffect(() => {
    let interval = setInterval(async () => {
      try {
        const res = await fetch('/api/ringtone/status', { headers: { Authorization: `Bearer ${localStorage.getItem('crm_token')}` } })
        const data = await res.json()

        if (data.active && data.url) {
          if (!activeRef.current) {
            // Start playing
            if (!audioRef.current) {
              audioRef.current = new Audio(data.url)
              audioRef.current.loop = true
            }
            audioRef.current.play().catch(() => {})
            activeRef.current = true
          }
        } else {
          if (activeRef.current) {
            // Stop playing
            if (audioRef.current) {
              audioRef.current.pause()
              audioRef.current.currentTime = 0
            }
            activeRef.current = false
          }
        }
      } catch {}
    }, 3000)

    return () => {
      clearInterval(interval)
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    }
  }, [userId])

  return null // invisible component
}

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState({ name: 'dashboard', params: {} })

  useEffect(() => {
    const token = localStorage.getItem('crm_token')
    if (token) {
      api.me().then(u => { setUser(u); setLoading(false) })
        .catch(() => { localStorage.removeItem('crm_token'); setLoading(false) })
    } else setLoading(false)
  }, [])

  const login = async (username, password) => {
    const data = await api.login(username, password)
    localStorage.setItem('crm_token', data.token)
    setUser(data.user)
  }

  const logout = () => {
    localStorage.removeItem('crm_token')
    setUser(null)
    setPage({ name: 'dashboard', params: {} })
  }

  const navigate = (name, params = {}) => setPage({ name, params })

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f8fafc' }}>
      <div style={{ width:32, height:32, borderRadius:'50%', border:'2px solid #00D4C8', borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  )

  if (!user) return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <Login />
    </AuthContext.Provider>
  )

  // Deep link: /?part=<assignmentId> renders a single part full-page (the "Open full page" pop-out).
  // Purchasing roles only; the backend /purchasing/part route still enforces per-record ownership.
  const partParam = new URLSearchParams(window.location.search).get('part')
  if (partParam && ['purchaser', 'purchasing_manager', 'manager'].includes(user.role)) {
    return (
      <AuthContext.Provider value={{ user, login, logout }}>
        <PartDetailModal
          assignmentId={partParam}
          fullPage
          onSaved={() => {}}
          onClose={() => { try { window.close() } catch {} window.location.href = window.location.origin }}
        />
      </AuthContext.Provider>
    )
  }

  // purchasing_manager is treated as a full manager (same access). Their home is the manager Dashboard;
  // the purchasing dashboard is reachable via the Purchasing nav item.
  const MANAGER_ROLES = ['manager', 'purchasing_manager']
  const CRM_ROLES = ['manager', 'purchasing_manager', 'ae']
  const isCrm = CRM_ROLES.includes(user.role)
  const isManager = MANAGER_ROLES.includes(user.role)

  // Role-appropriate home/dashboard — also the fallback when a role hits a page it may not see.
  const home = () => {
    if (user.role === 'ae') return <AEDashboard />
    if (user.role === 'purchaser') return <PurchaserDashboard />
    if (user.role === 'buyer') return <BuyerDashboard />
    return <Dashboard />
  }

  const renderPage = () => {
    switch (page.name) {
      case 'dashboard':       return home()
      case 'leads':           return isCrm ? <InquiryList type="lead" title="Leads" /> : home()
      case 'repeat':          return isCrm ? <InquiryList type="repeat" title="Repeat Inquiries" /> : home()
      case 'orders':          return isCrm ? <InquiryList type="online_order" title="Online Orders" /> : home()
      case 'customers':       return isCrm ? <Customers /> : home()
      case 'customer-detail': return isCrm ? <CustomerDetail id={page.params.id} /> : home()
      case 'inquiry-detail':  return isCrm ? <InquiryDetail id={page.params.id} /> : home()
      case 'users':           return isManager ? <Users /> : home()
      case 'import':          return isManager ? <ImportData /> : home()
      case 'notifications':   return <Notifications />
      case 'operations':      return isManager ? <Operations /> : home()
      case 'purchasing':      return isManager ? <PurchasingManagerView /> : home()
      case 'my-parts':        return user.role === 'purchaser' ? <PurchaserParts /> : home()
      default:                return home()
    }
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <NavContext.Provider value={{ page, navigate }}>
        {/* Ringtone poller \u2014 only for AEs */}
        {user.role === 'ae' && <RingtonePlayer userId={user.id} />}
        <Layout>
          {renderPage()}
        </Layout>
      </NavContext.Provider>
    </AuthContext.Provider>
  )
}
