import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import NewSession from './pages/NewSession'
import SessionDetail from './pages/SessionDetail'
import './index.css'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/sessions/new" element={<NewSession />} />
        <Route path="/sessions/:id" element={<SessionDetail />} />
      </Routes>
    </BrowserRouter>
  )
}
