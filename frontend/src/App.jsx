import { useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import ViewTranscription from './pages/ViewTranscription'
import ViewConversation from './pages/ViewConversation'
import Settings from './pages/Settings'
import SideMenu from './components/SideMenu'
import BottomNav from './components/BottomNav'

function App() {
  const [sideMenuOpen, setSideMenuOpen] = useState(false)
  const location = useLocation()

  // Hide bottom nav on detail pages
  const showBottomNav = ['/', '/files', '/settings'].includes(location.pathname)

  return (
    <div className="min-h-screen w-full flex justify-center overflow-x-hidden bg-background-light dark:bg-background-dark">
      <div className="w-full max-w-md bg-background-light dark:bg-background-dark min-h-screen flex flex-col relative shadow-2xl overflow-hidden">
        {/* Side Menu */}
        <SideMenu
          isOpen={sideMenuOpen}
          onClose={() => setSideMenuOpen(false)}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Routes>
            <Route
              path="/"
              element={<Dashboard onMenuClick={() => setSideMenuOpen(true)} />}
            />
            <Route path="/files" element={<Dashboard onMenuClick={() => setSideMenuOpen(true)} showFilesOnly />} />
            <Route path="/transcription/:id" element={<ViewTranscription />} />
            <Route
              path="/conversation/:id"
              element={<ViewConversation onMenuClick={() => setSideMenuOpen(true)} />}
            />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>

        {/* Bottom Navigation */}
        {showBottomNav && <BottomNav />}
      </div>
    </div>
  )
}

export default App
