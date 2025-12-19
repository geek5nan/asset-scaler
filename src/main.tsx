import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Initialize Google Analytics if GA_ID is configured
const GA_ID = import.meta.env.VITE_GA_ID
if (GA_ID) {
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
  document.head.appendChild(script)

  window.dataLayer = window.dataLayer || []
  function gtag(...args: unknown[]) {
    window.dataLayer.push(args)
  }
  // Expose gtag globally for event tracking
  window.gtag = gtag
  gtag('js', new Date())
  gtag('config', GA_ID)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
