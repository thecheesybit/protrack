import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { ThemeProvider } from '@/context/ThemeContext'
import { AuthProvider } from '@/context/AuthContext'
import { isTablet } from '@/desktop/isDesktop'

// Mark the tablet (Android + dev preview) surface on <html> before first paint so
// touch-only CSS affordances (safe-area gutters, always-visible controls, larger
// hit targets) apply immediately with no desktop-layout flash. Desktop/web never
// get this attribute, so their rules are completely untouched.
if (isTablet && typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-tablet', 'true')
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
