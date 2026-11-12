import React from 'react'
import { createRoot } from 'react-dom/client'
import { ThirdwebProvider } from 'thirdweb/react'
import App from './App.jsx'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <ThirdwebProvider>
    <App />
  </ThirdwebProvider>
)
