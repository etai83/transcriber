import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { transcriptionApi } from '../services/api'

function TranscriptionList({ refreshTrigger }) {
  const [transcriptions, setTranscriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchTranscriptions = async () => {
    try {
      const data = await transcriptionApi.list()
      setTranscriptions(data)
      setError(null)
    } catch (err) {
      setError('Failed to load transcriptions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTranscriptions()
  }, [refreshTrigger])

  // Poll for status updates
  useEffect(() => {
    const pendingOrProcessing = transcriptions.filter(
      (t) => t.status === 'pending' || t.status === 'processing'
    )

    if (pendingOrProcessing.length > 0) {
      const interval = setInterval(fetchTranscriptions, 3000)
      return () => clearInterval(interval)
    }
  }, [transcriptions])

  const handleDelete = async (id, e) => {
    e.preventDefault()
    e.stopPropagation()

    if (!confirm('Are you sure you want to delete this transcription?')) {
      return
    }

    try {
      await transcriptionApi.delete(id)
      setTranscriptions(transcriptions.filter((t) => t.id !== id))
    } catch (err) {
      alert('Failed to delete transcription')
    }
  }

  const handleRetry = async (id, e) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      await transcriptionApi.retry(id)
      // Update the local state to show pending status
      setTranscriptions(transcriptions.map((t) => 
        t.id === id ? { ...t, status: 'pending', error_message: null } : t
      ))
    } catch (err) {
      alert('Failed to retry transcription: ' + (err.response?.data?.detail || err.message))
    }
  }

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    }

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100'}`}>
        {status === 'processing' && (
          <svg className="inline-block w-3 h-3 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {status}
      </span>
    )
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString()
  }

  const formatDuration = (seconds) => {
    if (!seconds) return '-'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getLanguageLabel = (lang) => {
    const labels = { en: 'English', he: 'Hebrew', auto: 'Auto' }
    return labels[lang] || lang
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center py-8">
          <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="ml-3 text-gray-600">Loading transcriptions...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-8 text-red-500">{error}</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold">Transcriptions</h2>
      </div>

      {transcriptions.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <svg
            className="w-16 h-16 mx-auto text-gray-300 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <p>No transcriptions yet.</p>
          <p className="text-sm mt-1">Upload an audio file to get started!</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200">
          {transcriptions.map((transcription) => (
            <Link
              key={transcription.id}
              to={`/transcription/${transcription.id}`}
              className="block p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3">
                    <svg
                      className="w-6 h-6 text-blue-500 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                      />
                    </svg>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {transcription.title || transcription.filename}
                      </p>
                      {transcription.description && (
                        <p className="text-sm text-gray-600 truncate mt-0.5">
                          {transcription.description}
                        </p>
                      )}
                      <div className="flex items-center space-x-3 text-sm text-gray-500 mt-1">
                        <span>{formatDate(transcription.created_at)}</span>
                        <span>{formatDuration(transcription.duration_sec)}</span>
                        <span>{getLanguageLabel(transcription.detected_language || transcription.language)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3 ml-4">
                  {getStatusBadge(transcription.status)}
                  {transcription.status === 'failed' && (
                    <button
                      onClick={(e) => handleRetry(transcription.id, e)}
                      className="text-gray-400 hover:text-blue-500 p-1"
                      title="Retry transcription"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDelete(transcription.id, e)}
                    className="text-gray-400 hover:text-red-500 p-1"
                    title="Delete"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default TranscriptionList
