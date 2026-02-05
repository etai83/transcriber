import { useState } from 'react'
import AudioUploader from '../components/AudioUploader'
import AudioRecorder from '../components/AudioRecorder'
import ConversationRecorder from '../components/ConversationRecorder'
import RecordingList from '../components/RecordingList'

function Home() {
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [activeTab, setActiveTab] = useState('upload') // 'upload', 'record', or 'conversation'

  const handleUploadSuccess = (result) => {
    setRefreshTrigger((prev) => prev + 1)
  }

  const handleRecordingComplete = (result) => {
    setRefreshTrigger((prev) => prev + 1)
  }

  return (
    <div className="space-y-8">
      {/* Tab Selector */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
              activeTab === 'upload'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span>Upload File</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('record')}
            className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
              activeTab === 'record'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <span>Record</span>
            </div>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-0">
          {activeTab === 'upload' && (
            <AudioUploader onUploadSuccess={handleUploadSuccess} />
          )}
          {activeTab === 'record' && (
            <ConversationRecorder onRecordingComplete={handleRecordingComplete} />
          )}
        </div>
      </div>

      {/* Unified Recording List */}
      <RecordingList refreshTrigger={refreshTrigger} />
    </div>
  )
}

export default Home
