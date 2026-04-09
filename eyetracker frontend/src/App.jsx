import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import NewSession from './pages/NewSession'
import SessionDetail from './pages/SessionDetail'
import StimulusViewer from './pages/StimulusViewer'
import AnalysisView from './pages/AnalysisView'
import './index.css'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/sessions/new" element={<NewSession />} />
        <Route path="/sessions/:id" element={<SessionDetail />} />
        <Route path="/sessions/:id/stimuli" element={<StimulusViewer />} />
        <Route path="/sessions/:id/analysis" element={<AnalysisView />} />
      </Routes>
    </BrowserRouter>
  )
}
