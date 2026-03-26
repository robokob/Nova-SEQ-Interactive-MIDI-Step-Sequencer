import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/globals.css'

// Initialize app
// Note: StrictMode removed because it causes double-execution of effects,
// which breaks timing-critical audio/MIDI sequencer loops
ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
)