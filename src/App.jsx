import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import About from './pages/About'
import Retro from './pages/Retro'

export default function App() {
  return (
    <div className="flex flex-col md:flex-row min-h-screen md:h-screen bg-slate-50 font-sans">
      <Sidebar />
      <main className="flex-1 md:overflow-y-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/about" element={<About />} />
          <Route path="/how-it-went" element={<Retro />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
