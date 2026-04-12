import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './config/firebase.js'
import './index.css'
import App from './App.jsx'

// Vite base와 동일하게 하위 경로(예: GitHub Pages /ncgame/)에서 라우팅이 맞도록 함
const routerBasename =
  import.meta.env.BASE_URL.replace(/\/$/, '') || undefined

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={routerBasename}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
