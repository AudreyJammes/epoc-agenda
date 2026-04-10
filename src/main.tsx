import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

// Enregistrement du Service Worker PWA
registerSW({
  onNeedRefresh() {
    // Mise à jour silencieuse — l'app sera rechargée au prochain démarrage
  },
  onOfflineReady() {
    console.log('Agenda EPOC disponible hors ligne')
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
