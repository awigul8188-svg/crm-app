import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

// Lazy-load both apps — defined OUTSIDE the component so they're only created once
const App    = React.lazy(() => import('./App.jsx'))
const NFTApp = React.lazy(() => import('./pages/nft/NFTApp.jsx'))

function Root() {
  const isNFT = window.location.hash.startsWith('#nft')
  return (
    <React.Suspense fallback={
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'sans-serif', color:'#6a646a', background:'#f6f7f9' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:13 }}>Loading...</div>
        </div>
      </div>
    }>
      {isNFT ? <NFTApp /> : <App />}
    </React.Suspense>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
