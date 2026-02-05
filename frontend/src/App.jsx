import { Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home'
import ViewTranscription from './pages/ViewTranscription'
import ViewConversation from './pages/ViewConversation'

function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-blue-600 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Link to="/" className="flex items-center space-x-3">
            <svg className="w-8 h-8" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="white" />
              <path d="M35 30 L35 70 M50 25 L50 75 M65 35 L65 65" stroke="#2563EB" strokeWidth="6" strokeLinecap="round" />
            </svg>
            <h1 className="text-2xl font-bold">Local Audio Transcriber</h1>
          </Link>
          <p className="text-blue-100 text-sm mt-1">Transcribe audio locally with Whisper - All output in English</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/transcription/:id" element={<ViewTranscription />} />
          <Route path="/conversation/:id" element={<ViewConversation />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-400 py-4 mt-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm">
          <p>Local Audio Transcriber - All processing happens on your machine</p>
        </div>
      </footer>
    </div>
  )
}

export default App
