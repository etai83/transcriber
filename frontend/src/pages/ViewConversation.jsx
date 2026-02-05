import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { conversationApi, transcriptionApi } from '../services/api'

function ViewConversation() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [conversation, setConversation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [retryingChunks, setRetryingChunks] = useState({})
  const [showSpeakerView, setShowSpeakerView] = useState(true) // Toggle between plain and speaker view
  const [playingChunkId, setPlayingChunkId] = useState(null) // Currently playing chunk
  const audioRef = useRef(null)

  const fetchConversation = async () => {
    try {
      const data = await conversationApi.get(id)
      setConversation(data)
      setEditForm({
        title: data.title || '',
        description: data.description || '',
      })
      setError(null)
    } catch (err) {
      setError('Failed to load conversation')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConversation()
  }, [id])

  // Poll for updates if still processing
  useEffect(() => {
    if (!conversation) return
    
    const hasProcessing = conversation.chunks?.some(
      c => c.status === 'pending' || c.status === 'processing'
    )
    
    if (hasProcessing || conversation.status === 'recording' || conversation.status === 'processing') {
      const interval = setInterval(fetchConversation, 3000)
      return () => clearInterval(interval)
    }
  }, [conversation])

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this conversation and all its chunks?')) {
      return
    }

    try {
      await conversationApi.delete(id)
      navigate('/')
    } catch (err) {
      alert('Failed to delete conversation')
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await conversationApi.update(id, editForm)
      setConversation(updated)
      setIsEditing(false)
    } catch (err) {
      alert('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditForm({
      title: conversation.title || '',
      description: conversation.description || '',
    })
    setIsEditing(false)
  }

  const handleRetryChunk = async (chunkId) => {
    setRetryingChunks(prev => ({ ...prev, [chunkId]: true }))
    try {
      await transcriptionApi.retry(chunkId)
      // Refetch conversation to get updated chunk status
      await fetchConversation()
    } catch (err) {
      console.error('Error retrying chunk:', err)
      alert('Failed to retry chunk transcription')
    } finally {
      setRetryingChunks(prev => ({ ...prev, [chunkId]: false }))
    }
  }

  const handleRetryAllFailed = async () => {
    const failedChunks = conversation.chunks?.filter(c => c.status === 'failed') || []
    for (const chunk of failedChunks) {
      await handleRetryChunk(chunk.id)
    }
  }

  const handlePlayChunk = (chunkId) => {
    if (playingChunkId === chunkId) {
      // Stop playing
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
      setPlayingChunkId(null)
    } else {
      // Start playing new chunk
      if (audioRef.current) {
        audioRef.current.pause()
      }
      const audioUrl = transcriptionApi.getAudioUrl(chunkId)
      if (audioRef.current) {
        audioRef.current.src = audioUrl
        audioRef.current.play().catch(err => {
          console.error('Error playing audio:', err)
          alert('Failed to play audio')
        })
        setPlayingChunkId(chunkId)
      }
    }
  }

  const handleAudioEnded = () => {
    setPlayingChunkId(null)
  }

  const handleCopyTranscript = () => {
    let textToCopy
    if (showSpeakerView && hasDiarizationData()) {
      textToCopy = getFullTranscriptWithSpeakers()
    } else {
      textToCopy = conversation.chunks
        ?.filter(c => c.transcript_text)
        .sort((a, b) => (a.chunk_index ?? 0) - (b.chunk_index ?? 0))
        .map(c => c.transcript_text)
        .join(' ')
    }
    
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy)
      alert('Transcript copied to clipboard!')
    }
  }

  const handleDownloadTranscript = () => {
    let textToDownload
    if (showSpeakerView && hasDiarizationData()) {
      textToDownload = getFullTranscriptWithSpeakers()
    } else {
      textToDownload = conversation.chunks
        ?.filter(c => c.transcript_text)
        .sort((a, b) => (a.chunk_index ?? 0) - (b.chunk_index ?? 0))
        .map(c => c.transcript_text)
        .join('\n\n')
    }
    
    if (textToDownload) {
      const blob = new Blob([textToDownload], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${conversation.title || 'conversation'}_transcript.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  const handleCopyJson = () => {
    if (!conversation?.chunks) return

    // Sort chunks in chronological order by chunk_index
    const sortedChunks = [...conversation.chunks]
      .sort((a, b) => (a.chunk_index ?? 0) - (b.chunk_index ?? 0))

    // Build JSON structure with all chunk metadata
    const jsonData = {
      conversation: {
        id: conversation.id,
        title: conversation.title || 'Untitled Conversation',
        description: conversation.description || '',
        status: conversation.status,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
        total_duration_sec: conversation.total_duration_sec,
      },
      chunks: sortedChunks.map(chunk => {
        // Parse transcript_segments if available
        const segmentData = parseTranscriptSegments(chunk)
        
        return {
          chunk_index: chunk.chunk_index,
          id: chunk.id,
          status: chunk.status,
          duration_sec: chunk.duration_sec,
          source_language: chunk.source_language,
          transcript_text: chunk.transcript_text || '',
          // Consolidated speaker paragraphs (consecutive sentences from same speaker merged)
          speaker_paragraphs: segmentData?.segments || [],
          // Raw segments for detailed view (individual sentences with speaker labels)
          speaker_segments: segmentData?.raw_segments || segmentData?.segments || [],
          speakers: segmentData?.speakers || [],
          // Full text with speaker labels
          transcript_with_speakers: segmentData?.full_text || chunk.transcript_text || '',
          error_message: chunk.error_message || null,
          created_at: chunk.created_at,
        }
      }),
      // Summary info
      summary: {
        total_chunks: sortedChunks.length,
        completed_chunks: sortedChunks.filter(c => c.status === 'completed').length,
        failed_chunks: sortedChunks.filter(c => c.status === 'failed').length,
        all_speakers: getAllSpeakers(),
        has_diarization: hasDiarizationData(),
      }
    }

    const jsonString = JSON.stringify(jsonData, null, 2)
    navigator.clipboard.writeText(jsonString)
    alert('Conversation JSON copied to clipboard!')
  }

  const handleDownloadJson = () => {
    if (!conversation?.chunks) return

    // Sort chunks in chronological order by chunk_index
    const sortedChunks = [...conversation.chunks]
      .sort((a, b) => (a.chunk_index ?? 0) - (b.chunk_index ?? 0))

    // Build JSON structure with all chunk metadata
    const jsonData = {
      conversation: {
        id: conversation.id,
        title: conversation.title || 'Untitled Conversation',
        description: conversation.description || '',
        status: conversation.status,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
        total_duration_sec: conversation.total_duration_sec,
      },
      chunks: sortedChunks.map(chunk => {
        const segmentData = parseTranscriptSegments(chunk)
        
        return {
          chunk_index: chunk.chunk_index,
          id: chunk.id,
          status: chunk.status,
          duration_sec: chunk.duration_sec,
          source_language: chunk.source_language,
          transcript_text: chunk.transcript_text || '',
          // Consolidated speaker paragraphs (consecutive sentences from same speaker merged)
          speaker_paragraphs: segmentData?.segments || [],
          // Raw segments for detailed view (individual sentences with speaker labels)
          speaker_segments: segmentData?.raw_segments || segmentData?.segments || [],
          speakers: segmentData?.speakers || [],
          transcript_with_speakers: segmentData?.full_text || chunk.transcript_text || '',
          error_message: chunk.error_message || null,
          created_at: chunk.created_at,
        }
      }),
      summary: {
        total_chunks: sortedChunks.length,
        completed_chunks: sortedChunks.filter(c => c.status === 'completed').length,
        failed_chunks: sortedChunks.filter(c => c.status === 'failed').length,
        all_speakers: getAllSpeakers(),
        has_diarization: hasDiarizationData(),
      }
    }

    const jsonString = JSON.stringify(jsonData, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${conversation.title || 'conversation'}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
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

  const getStatusBadge = (status) => {
    const styles = {
      recording: 'bg-red-100 text-red-800',
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

  const getChunkStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <span className="w-2 h-2 bg-yellow-400 rounded-full" />
      case 'processing':
        return (
          <svg className="w-4 h-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )
      case 'completed':
        return (
          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )
      case 'failed':
        return (
          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )
      default:
        return null
    }
  }

  // Speaker color mapping for consistent colors
  const speakerColors = {
    'SPEAKER_00': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
    'SPEAKER_01': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
    'SPEAKER_02': { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
    'SPEAKER_03': { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
    'SPEAKER_04': { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-200' },
    'UNKNOWN': { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },
  }

  const getSpeakerColor = (speaker) => {
    return speakerColors[speaker] || speakerColors['UNKNOWN']
  }

  const getSpeakerLabel = (speaker) => {
    // Convert SPEAKER_00 to "Speaker 1", etc.
    if (speaker.startsWith('SPEAKER_')) {
      const num = parseInt(speaker.replace('SPEAKER_', ''), 10) + 1
      return `Speaker ${num}`
    }
    return speaker
  }

  // Parse transcript_segments JSON from chunks
  const parseTranscriptSegments = (chunk) => {
    if (!chunk.transcript_segments) return null
    try {
      const data = typeof chunk.transcript_segments === 'string' 
        ? JSON.parse(chunk.transcript_segments) 
        : chunk.transcript_segments
      return data
    } catch (e) {
      console.error('Error parsing transcript segments:', e)
      return null
    }
  }

  // Get all diarized segments from all chunks, combined
  const getAllDiarizedSegments = () => {
    if (!conversation?.chunks) return []
    
    const allSegments = []
    const sortedChunks = [...conversation.chunks].sort((a, b) => (a.chunk_index ?? 0) - (b.chunk_index ?? 0))
    
    for (const chunk of sortedChunks) {
      if (chunk.status !== 'completed') continue
      const segmentData = parseTranscriptSegments(chunk)
      if (segmentData?.segments) {
        allSegments.push(...segmentData.segments)
      }
    }
    
    return allSegments
  }

  // Get unique speakers across all chunks
  const getAllSpeakers = () => {
    const segments = getAllDiarizedSegments()
    const speakers = new Set(segments.map(s => s.speaker))
    return Array.from(speakers).sort()
  }

  // Check if we have any diarization data
  const hasDiarizationData = () => {
    return getAllDiarizedSegments().length > 0
  }

  // Get full transcript with speaker labels
  const getFullTranscriptWithSpeakers = () => {
    if (!conversation?.chunks) return ''
    
    const sortedChunks = [...conversation.chunks].sort((a, b) => (a.chunk_index ?? 0) - (b.chunk_index ?? 0))
    const lines = []
    
    for (const chunk of sortedChunks) {
      if (chunk.status !== 'completed') continue
      const segmentData = parseTranscriptSegments(chunk)
      if (segmentData?.full_text) {
        lines.push(segmentData.full_text)
      }
    }
    
    return lines.join('\n\n')
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

  if (error || !conversation) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="text-center py-8">
          <p className="text-red-500 mb-4">{error || 'Conversation not found'}</p>
          <Link to="/" className="text-blue-600 hover:text-blue-800">
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  const completedChunks = conversation.chunks?.filter(c => c.status === 'completed') || []
  const fullTranscript = completedChunks
    .sort((a, b) => (a.chunk_index ?? 0) - (b.chunk_index ?? 0))
    .map(c => c.transcript_text)
    .join(' ')

  return (
    <div className="space-y-6">
      {/* Hidden audio element for playing chunks */}
      <audio ref={audioRef} onEnded={handleAudioEnded} className="hidden" />
      
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-gray-900 mt-2">
                  {conversation.title || 'Untitled Conversation'}
                </h1>
                {conversation.description && (
                  <p className="text-gray-600 mt-1">{conversation.description}</p>
                )}
              </>
            )}
            
            <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
              <span>Created: {formatDate(conversation.created_at)}</span>
              <span>Duration: {formatDuration(conversation.total_duration_sec)}</span>
              <span>Chunks: {conversation.chunks?.length || 0}</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {getStatusBadge(conversation.status)}
            
            {!isEditing && (
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
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50"
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Full Transcript */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold">Full Transcript</h2>
            {hasDiarizationData() && (
              <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setShowSpeakerView(false)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    !showSpeakerView 
                      ? 'bg-white shadow text-gray-900' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Plain
                </button>
                <button
                  onClick={() => setShowSpeakerView(true)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    showSpeakerView 
                      ? 'bg-white shadow text-gray-900' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  With Speakers
                </button>
              </div>
            )}
          </div>
          {completedChunks.length > 0 && (
            <div className="flex space-x-2">
              <button
                onClick={handleCopyTranscript}
                className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 border border-blue-600 rounded-md hover:bg-blue-50"
                title="Copy transcript as plain text"
              >
                Copy
              </button>
              <button
                onClick={handleDownloadTranscript}
                className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 border border-blue-600 rounded-md hover:bg-blue-50"
                title="Download transcript as .txt file"
              >
                Download
              </button>
              <button
                onClick={handleCopyJson}
                className="px-3 py-1 text-sm text-green-600 hover:text-green-800 border border-green-600 rounded-md hover:bg-green-50"
                title="Copy as JSON with all metadata and speaker info"
              >
                Copy JSON
              </button>
              <button
                onClick={handleDownloadJson}
                className="px-3 py-1 text-sm text-green-600 hover:text-green-800 border border-green-600 rounded-md hover:bg-green-50"
                title="Download as .json file"
              >
                Download JSON
              </button>
            </div>
          )}
        </div>

        {/* Speaker Legend */}
        {showSpeakerView && hasDiarizationData() && (
          <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-600 font-medium">Speakers:</span>
            {getAllSpeakers().map(speaker => {
              const colors = getSpeakerColor(speaker)
              return (
                <span 
                  key={speaker}
                  className={`px-2 py-1 text-xs rounded-full ${colors.bg} ${colors.text} ${colors.border} border`}
                >
                  {getSpeakerLabel(speaker)}
                </span>
              )
            })}
          </div>
        )}

        {conversation.status === 'recording' && (
          <div className="py-8 text-center text-gray-500">
            <svg className="w-12 h-12 mx-auto text-red-400 mb-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <p>Recording in progress...</p>
          </div>
        )}

        {conversation.status !== 'recording' && completedChunks.length === 0 && (
          <div className="py-8 text-center text-gray-500">
            <svg className="w-12 h-12 mx-auto text-blue-400 mb-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p>Processing transcriptions...</p>
          </div>
        )}

        {completedChunks.length > 0 && (
          showSpeakerView && hasDiarizationData() ? (
            // Speaker view - show segments with speaker labels
            <div className="space-y-3 p-4 bg-gray-50 rounded-lg max-h-[600px] overflow-y-auto">
              {getAllDiarizedSegments().map((segment, idx) => {
                const colors = getSpeakerColor(segment.speaker)
                return (
                  <div key={idx} className={`p-3 rounded-lg border ${colors.bg} ${colors.border}`}>
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={`text-xs font-semibold ${colors.text}`}>
                        {getSpeakerLabel(segment.speaker)}
                      </span>
                      {segment.start !== undefined && (
                        <span className="text-xs text-gray-500">
                          {formatDuration(segment.start)} - {formatDuration(segment.end)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-800">{segment.text}</p>
                  </div>
                )
              })}
            </div>
          ) : (
            // Plain view - just the text
            <div className="prose max-w-none p-4 bg-gray-50 rounded-lg whitespace-pre-wrap">
              {fullTranscript || 'No transcript available'}
            </div>
          )
        )}
      </div>

      {/* Chunks List */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Chunks</h2>
          {conversation.chunks?.some(c => c.status === 'failed') && (
            <button
              onClick={handleRetryAllFailed}
              className="px-3 py-1 text-sm text-orange-600 hover:text-orange-800 border border-orange-600 rounded-md hover:bg-orange-50 flex items-center space-x-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Retry All Failed</span>
            </button>
          )}
        </div>
        
        {conversation.chunks?.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No chunks recorded yet</p>
        ) : (
          <div className="space-y-3">
            {conversation.chunks
              ?.sort((a, b) => (b.chunk_index ?? 0) - (a.chunk_index ?? 0))
              .map((chunk, index) => (
                <div 
                  key={chunk.id}
                  className="border rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {getChunkStatusIcon(chunk.status)}
                      <span className="font-medium text-gray-800">
                        Chunk {(chunk.chunk_index ?? index) + 1}
                      </span>
                      {chunk.duration_sec && (
                        <span className="text-sm text-gray-500">
                          ({formatDuration(chunk.duration_sec)})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {/* Play button */}
                      <button
                        onClick={() => handlePlayChunk(chunk.id)}
                        className={`p-1.5 rounded-full transition-colors ${
                          playingChunkId === chunk.id 
                            ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' 
                            : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                        }`}
                        title={playingChunkId === chunk.id ? 'Stop' : 'Play'}
                      >
                        {playingChunkId === chunk.id ? (
                          // Stop icon
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <rect x="6" y="6" width="12" height="12" rx="1" />
                          </svg>
                        ) : (
                          // Play icon
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </button>
                      {chunk.status === 'failed' && (
                        <button
                          onClick={() => handleRetryChunk(chunk.id)}
                          disabled={retryingChunks[chunk.id]}
                          className="px-2 py-1 text-xs text-orange-600 hover:text-orange-800 border border-orange-400 rounded hover:bg-orange-50 disabled:opacity-50 flex items-center space-x-1"
                          title="Retry transcription"
                        >
                          {retryingChunks[chunk.id] ? (
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          )}
                          <span>Retry</span>
                        </button>
                      )}
                      <span className="text-xs text-gray-400">
                        {chunk.status}
                      </span>
                    </div>
                  </div>
                  
                  {chunk.status === 'completed' && chunk.transcript_text ? (
                    <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                      {chunk.transcript_text}
                    </p>
                  ) : chunk.status === 'processing' ? (
                    <p className="text-sm text-gray-400 italic">Transcribing...</p>
                  ) : chunk.status === 'failed' ? (
                    <p className="text-sm text-red-500">{chunk.error_message || 'Failed'}</p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Waiting...</p>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ViewConversation
