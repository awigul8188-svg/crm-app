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

export const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)
export const NavContext = createContext(null)
export const useNav = () => useContext(NavContext)

// Ringtone player for AEs — polls every 3 seconds
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

  const renderPage = () => {
    switch (page.name) {
      case 'dashboard':       return user.role === 'ae' ? <AEDashboard /> : <Dashboard />
      case 'leads':           return <InquiryList type="lead" title="Leads" />
      case 'repeat':          return <InquiryList type="repeat" title="Repeat Inquiries" />
      case 'orders':          return <InquiryList type="online_order" title="Online Orders" />
      case 'customers':       return <Customers />
      case 'customer-detail': return <CustomerDetail id={page.params.id} />
      case 'inquiry-detail':  return <InquiryDetail id={page.params.id} />
      case 'users':           return user.role === 'manager' ? <Users /> : <Dashboard />
      case 'import':          return user.role === 'manager' ? <ImportData /> : <Dashboard />
      case 'notifications':   return <Notifications />
      default:                return <Dashboard />
    }
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <NavContext.Provider value={{ page, navigate }}>
        {/* Ringtone poller — only for AEs */}
        {user.role === 'ae' && <RingtonePlayer userId={user.id} />}
        <Layout>
          {renderPage()}
        </Layout>
      </NavContext.Provider>
    </AuthContext.Provider>
  )
}
