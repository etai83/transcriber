import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { transcriptionApi } from '../services/api'
import AudioPlayer from '../components/AudioPlayer'

function ViewTranscription() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [transcription, setTranscription] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    transcript_text: '',
  })
  const [saving, setSaving] = useState(false)

  const fetchTranscription = async () => {
    try {
      const data = await transcriptionApi.get(id)
      setTranscription(data)
      setEditForm({
        title: data.title || '',
        description: data.description || '',
        transcript_text: data.transcript_text || '',
      })
      setError(null)
    } catch (err) {
      setError('Failed to load transcription')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTranscription()
  }, [id])

  // Poll for updates if still processing
  useEffect(() => {
    if (transcription?.status === 'pending' || transcription?.status === 'processing') {
      const interval = setInterval(fetchTranscription, 3000)
      return () => clearInterval(interval)
    }
  }, [transcription?.status])

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this transcription?')) {
      return
    }

    try {
      await transcriptionApi.delete(id)
      navigate('/')
    } catch (err) {
      alert('Failed to delete transcription')
    }
  }

  const handleRetry = async () => {
    try {
      await transcriptionApi.retry(id)
      // Update local state to show pending
      setTranscription({ ...transcription, status: 'pending', error_message: null })
    } catch (err) {
      alert('Failed to retry transcription: ' + (err.response?.data?.detail || err.message))
    }
  }

  const handleCopyText = () => {
    const textToCopy = isEditing ? editForm.transcript_text : transcription?.transcript_text
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy)
      alert('Transcript copied to clipboard!')
    }
  }

  const handleDownloadText = () => {
    const textToDownload = isEditing ? editForm.transcript_text : transcription?.transcript_text
    if (textToDownload) {
      const blob = new Blob([textToDownload], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${transcription.filename.replace(/\.[^/.]+$/, '')}_transcript.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const updatedData = await transcriptionApi.update(id, {
        title: editForm.title || null,
        description: editForm.description || null,
        transcript_text: editForm.transcript_text || null,
      })
      setTranscription(updatedData)
      setIsEditing(false)
    } catch (err) {
      alert('Failed to save changes: ' + (err.response?.data?.detail || err.message))
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditForm({
      title: transcription.title || '',
      description: transcription.description || '',
      transcript_text: transcription.transcript_text || '',
    })
    setIsEditing(false)
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

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    }

    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status] || 'bg-gray-100'}`}>
        {status === 'processing' && (
          <svg className="inline-block w-4 h-4 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {status}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="flex items-center justify-center py-8">
          <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="ml-3 text-gray-600">Loading...</span>
        </div>
      </div>
    )
  }

  if (error || !transcription) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="text-center py-8">
          <p className="text-red-500 mb-4">{error || 'Transcription not found'}</p>
          <Link to="/" className="text-blue-600 hover:text-blue-800">
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Link to="/" className="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-block">
              &larr; Back to list
            </Link>
            
            {isEditing ? (
              <div className="mt-2 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    placeholder={transcription.filename}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    placeholder="Add a description..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-gray-900 mt-2">
                  {transcription.title || transcription.filename}
                </h1>
                {transcription.description && (
                  <p className="text-gray-600 mt-1">{transcription.description}</p>
                )}
              </>
            )}
            
            <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
              <span>Created: {formatDate(transcription.created_at)}</span>
              <span>Duration: {formatDuration(transcription.duration_sec)}</span>
              <span>Language: {getLanguageLabel(transcription.detected_language || transcription.language)}</span>
            </div>
            {transcription.updated_at && transcription.updated_at !== transcription.created_at && (
              <div className="text-xs text-gray-400 mt-1">
                Last updated: {formatDate(transcription.updated_at)}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-3">
            {getStatusBadge(transcription.status)}
            
            {/* Edit/Save/Cancel buttons */}
            {transcription.status === 'completed' && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                title="Edit"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            
            {isEditing && (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
            
            <button
              onClick={handleDelete}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
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
      </div>

      {/* Audio Player */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold mb-4">Audio</h2>
        <AudioPlayer transcriptionId={transcription.id} />
      </div>

      {/* Transcript */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Transcript</h2>
          {transcription.status === 'completed' && (
            <div className="flex space-x-2">
              <button
                onClick={handleCopyText}
                className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 border border-blue-600 rounded-md hover:bg-blue-50 transition-colors"
              >
                Copy
              </button>
              <button
                onClick={handleDownloadText}
                className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 border border-blue-600 rounded-md hover:bg-blue-50 transition-colors"
              >
                Download
              </button>
            </div>
          )}
        </div>

        {transcription.status === 'pending' && (
          <div className="py-8 text-center text-gray-500">
            <svg className="w-12 h-12 mx-auto text-yellow-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>Waiting to start transcription...</p>
          </div>
        )}

        {transcription.status === 'processing' && (
          <div className="py-8 text-center text-gray-500">
            <svg className="w-12 h-12 mx-auto text-blue-400 mb-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p>Transcription in progress...</p>
            <p className="text-sm mt-1">This may take a few minutes depending on the audio length.</p>
          </div>
        )}

        {transcription.status === 'completed' && (
          isEditing ? (
            <textarea
              value={editForm.transcript_text}
              onChange={(e) => setEditForm({ ...editForm, transcript_text: e.target.value })}
              className="w-full p-4 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y min-h-[200px]"
              dir={transcription.detected_language === 'he' ? 'rtl' : 'ltr'}
              placeholder="Enter transcript text..."
            />
          ) : (
            <div 
              className="prose max-w-none p-4 bg-gray-50 rounded-lg whitespace-pre-wrap"
              dir={transcription.detected_language === 'he' ? 'rtl' : 'ltr'}
            >
              {transcription.transcript_text || 'No transcript available'}
            </div>
          )
        )}

        {transcription.status === 'failed' && (
          <div className="py-8 text-center">
            <svg className="w-12 h-12 mx-auto text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-500">Transcription failed</p>
            {transcription.error_message && (
              <p className="text-sm text-gray-500 mt-2">{transcription.error_message}</p>
            )}
            <button
              onClick={handleRetry}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors inline-flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Retry Transcription</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ViewTranscription
