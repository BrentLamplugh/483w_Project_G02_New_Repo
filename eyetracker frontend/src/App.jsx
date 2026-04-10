import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import NewSession from './pages/NewSession'
import SessionDetail from './pages/SessionDetail'
import StimulusViewer from './pages/StimulusViewer'
import AnalysisView from './pages/AnalysisView'
import './index.css'

const THEME_STORAGE_KEY = 'eyetrack-theme'

function getInitialTheme() {
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export default function App() {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  const isLight = theme === 'light'

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/sessions/new" element={<NewSession />} />
          <Route path="/sessions/:id" element={<SessionDetail />} />
          <Route path="/sessions/:id/stimuli" element={<StimulusViewer />} />
          <Route path="/sessions/:id/analysis" element={<AnalysisView />} />

        </Routes>
      </BrowserRouter>

      <button
        type="button"
        className="theme-toggle"
        onClick={() => setTheme(isLight ? 'dark' : 'light')}
        aria-label={`Switch to ${isLight ? 'dark' : 'light'} mode`}
      >
        {isLight ? 'Dark Mode' : 'Light Mode'}
      </button>
    </>
  )
}
