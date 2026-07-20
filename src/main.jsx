// Trial commit to verify GitHub contribution tracking with private email
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { HostelProvider } from './context/HostelContext'
import { LeaveProvider } from './context/LeaveContext'
import { StudentProvider } from './context/StudentContext'
import './index.css'
import App from './App'
import { registerSW } from 'virtual:pwa-register'

import { MenuProvider } from './context/MenuContext'

// Register PWA service worker with autoUpdate and reload handling
registerSW({
  immediate: true,
  onRegisteredSW(swUrl, registration) {
    // Periodic update checks
    if (registration) {
      setInterval(() => {
        registration.update()
      }, 60 * 1000)
    }
  },
  onNeedRefresh() {
    // Prompt reload when a new SW is waiting
    window.location.reload()
  },
  onOfflineReady() {
    console.log('App ready for offline use')
  },
})

// Force reload when a new service worker takes control
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload()
  })
}

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <BrowserRouter>
            <AuthProvider>
                <HostelProvider>
                    <StudentProvider>
                        <LeaveProvider>
                            <MenuProvider>
                                <App />
                            </MenuProvider>
                        </LeaveProvider>
                    </StudentProvider>
                </HostelProvider>
            </AuthProvider>
        </BrowserRouter>
    </StrictMode>,
)
