import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import LiveView from './pages/LiveView'
import HistoricCharts from './pages/HistoricCharts'
import Fortnite from './pages/Fortnite'
import Android from './pages/Android'
import OtherSources from './pages/OtherSources'

export default function App() {
  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/live" replace />} />
          <Route path="/live" element={<LiveView />} />
          <Route path="/historic" element={<HistoricCharts />} />
          <Route path="/fortnite" element={<Fortnite />} />
          <Route path="/android" element={<Android />} />
          <Route path="/other-sources" element={<OtherSources />} />
        </Routes>
      </main>
    </div>
  )
}
