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

// PWA aberto pela tela de início do iOS: marca o <html> para o CSS aplicar o
// respiro da barra de status (navigator.standalone só existe no Safari/iOS).
if ((navigator as { standalone?: boolean }).standalone === true) {
  document.documentElement.classList.add('ios-pwa')
}

// Registra o service worker do PWA (instalação + recebimento de push).
if (import.meta.env.PROD) {
  window.addEventListener('load', () => {
    registerServiceWorker()
  })
}
