import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

// Route to NFT portal or CRM based on URL hash — must be outside App to avoid Rules of Hooks violation
function Root() {
  if (window.location.hash.startsWith('#nft')) {
    const NFTApp = React.lazy(() => import('./pages/nft/NFTApp.jsx'))
    return (
      <React.Suspense fallback={<div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'sans-serif', color:'#6a646a' }}>Loading...</div>}>
        <NFTApp />
      </React.Suspense>
    )
  }
  const App = React.lazy(() => import('./App.jsx'))
  return (
    <React.Suspense fallback={null}>
      <App />
    </React.Suspense>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
