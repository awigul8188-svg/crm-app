import { useState, useEffect, createContext, useContext } from 'react'
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

export const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)
export const NavContext = createContext(null)
export const useNav = () => useContext(NavContext)

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState({ name: 'dashboard', params: {} })

  useEffect(() => {
    const token = localStorage.getItem('crm_token')
    if (token) {
      api.me().then(u => { setUser(u); setLoading(false) }).catch(() => { localStorage.removeItem('crm_token'); setLoading(false) })
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
    <div className="min-h-screen flex items-center justify-center bg-surface-50">
      <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full spinner" />
    </div>
  )

  if (!user) return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <Login />
    </AuthContext.Provider>
  )

  const renderPage = () => {
    switch (page.name) {
      case 'dashboard':       return <Dashboard />
      case 'leads':           return <InquiryList type="lead" title="Leads" />
      case 'repeat':          return <InquiryList type="repeat" title="Repeat Inquiries" />
      case 'orders':          return <InquiryList type="online_order" title="Online Orders" />
      case 'customers':       return <Customers />
      case 'customer-detail': return <CustomerDetail id={page.params.id} />
      case 'inquiry-detail':  return <InquiryDetail id={page.params.id} />
      case 'users':           return user.role === 'manager' ? <Users /> : <Dashboard />
      case 'import':          return user.role === 'manager' ? <ImportData /> : <Dashboard />
      default:                return <Dashboard />
    }
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <NavContext.Provider value={{ page, navigate }}>
        <Layout>
          {renderPage()}
        </Layout>
      </NavContext.Provider>
    </AuthContext.Provider>
  )
}
