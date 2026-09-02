import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { inject } from '@vercel/analytics'
import { injectSpeedInsights } from '@vercel/speed-insights'
import './styles/crt.css'
import './index.css'
import './styles/crt-retrofit.css'
import './styles/atlas-dex.css'
import './styles/sources.css'
import App from './App.jsx'

inject()
injectSpeedInsights()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
