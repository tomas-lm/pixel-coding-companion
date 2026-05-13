import './assets/styles/index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { DictationOverlay } from './overlay/DictationOverlay'

const isDictationOverlay =
  new URLSearchParams(window.location.search).get('view') === 'dictation-overlay'
if (isDictationOverlay) document.body.classList.add('dictation-overlay-document')

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isDictationOverlay ? <DictationOverlay /> : <App />}</StrictMode>
)
