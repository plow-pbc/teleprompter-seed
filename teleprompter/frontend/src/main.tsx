import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Force rebuild to bust Vite cache and pick up new env vars
createRoot(document.getElementById('root')!).render(
  <App />
)
