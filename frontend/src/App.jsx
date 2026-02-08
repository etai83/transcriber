import { Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import LiveRecording from './pages/LiveRecording'
import ViewConversation from './pages/ViewConversation'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/record" element={<LiveRecording />} />
      <Route path="/conversation/:id" element={<ViewConversation />} />
    </Routes>
  )
}

export default App
