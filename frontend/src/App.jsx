import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import ViewTranscription from './pages/ViewTranscription'
import ViewConversation from './pages/ViewConversation'
import Settings from './pages/Settings'
import SideMenu from './components/SideMenu'

function App() {
  const [sideMenuOpen, setSideMenuOpen] = useState(false)

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-background-dark text-white font-display antialiased selection:bg-primary/30">
      {/* Side Menu */}
      <SideMenu
        isOpen={sideMenuOpen}
        onClose={() => setSideMenuOpen(false)}
      />

      {/* Main Content */}
      <Routes>
        <Route
          path="/"
          element={<Dashboard onMenuClick={() => setSideMenuOpen(true)} />}
        />
        <Route path="/transcription/:id" element={<ViewTranscription />} />
        <Route
          path="/conversation/:id"
          element={<ViewConversation onMenuClick={() => setSideMenuOpen(true)} />}
        />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </div>
  )
}

export default App
