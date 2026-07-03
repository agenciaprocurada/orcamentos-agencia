import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker } from './lib/push'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Registra o service worker do PWA (instalação + recebimento de push).
if (import.meta.env.PROD) {
  window.addEventListener('load', () => {
    registerServiceWorker()
  })
}
