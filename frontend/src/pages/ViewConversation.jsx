import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { conversationApi, transcriptionApi } from '../services/api'
import Header from '../components/Header'
import AudioPlayerNew from '../components/AudioPlayerNew'
import AIAssistant from '../components/AIAssistant'

function ViewConversation({ onMenuClick }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [conversation, setConversation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [retryingChunks, setRetryingChunks] = useState({})
  const [showSpeakerView, setShowSpeakerView] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [seekToTime, setSeekToTime] = useState(null)
  const [editingSegmentId, setEditingSegmentId] = useState(null)
  const [editedText, setEditedText] = useState('')
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
    if (!confirm('Are you sure you want to delete this recording?')) {
      return
    }
    try {
      await conversationApi.delete(id)
      navigate('/')
    } catch (err) {
      alert('Failed to delete')
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
      await fetchConversation()
    } catch (err) {
      console.error('Error retrying chunk:', err)
      alert('Failed to retry transcription')
    } finally {
      setRetryingChunks(prev => ({ ...prev, [chunkId]: false }))
    }
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

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Speaker color mapping for dark theme
  const speakerColorsDark = {
    'SPEAKER_00': { bg: 'bg-blue-900/30', text: 'text-blue-400', border: 'border-blue-500/30', avatar: 'bg-blue-500' },
    'SPEAKER_01': { bg: 'bg-emerald-900/30', text: 'text-emerald-400', border: 'border-emerald-500/30', avatar: 'bg-emerald-500' },
    'SPEAKER_02': { bg: 'bg-purple-900/30', text: 'text-purple-400', border: 'border-purple-500/30', avatar: 'bg-purple-500' },
    'SPEAKER_03': { bg: 'bg-orange-900/30', text: 'text-orange-400', border: 'border-orange-500/30', avatar: 'bg-orange-500' },
    'SPEAKER_04': { bg: 'bg-pink-900/30', text: 'text-pink-400', border: 'border-pink-500/30', avatar: 'bg-pink-500' },
    'UNKNOWN': { bg: 'bg-slate-800', text: 'text-slate-400', border: 'border-slate-600', avatar: 'bg-slate-500' },
  }

  const getSpeakerColor = (speaker) => {
    return speakerColorsDark[speaker] || speakerColorsDark['UNKNOWN']
  }

  const getSpeakerLabel = (speaker) => {
    if (speaker.startsWith('SPEAKER_')) {
      const num = parseInt(speaker.replace('SPEAKER_', ''), 10) + 1
      return `Speaker ${num}`
    }
    return speaker
  }

  const getSpeakerInitial = (speaker) => {
    if (speaker.startsWith('SPEAKER_')) {
      const num = parseInt(speaker.replace('SPEAKER_', ''), 10) + 1
      return `S${num}`
    }
    return speaker.charAt(0).toUpperCase()
  }

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

  const getAllDiarizedSegments = () => {
    if (!conversation?.chunks) return []

    const allSegments = []
    const sortedChunks = [...conversation.chunks].sort((a, b) => (a.chunk_index ?? 0) - (b.chunk_index ?? 0))

    for (const chunk of sortedChunks) {
      if (chunk.status !== 'completed') continue
      const segmentData = parseTranscriptSegments(chunk)
      if (segmentData?.segments) {
        allSegments.push(...segmentData.segments.map((s, idx) => ({
          ...s,
          id: `${chunk.id}-${idx}`,
          chunkId: chunk.id
        })))
      }
    }

    return allSegments
  }

  const getAllSpeakers = () => {
    const segments = getAllDiarizedSegments()
    const speakers = new Set(segments.map(s => s.speaker))
    return Array.from(speakers).sort()
  }

  const hasDiarizationData = () => {
    return getAllDiarizedSegments().length > 0
  }

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

  // Check if a segment is currently playing
  const isSegmentPlaying = (segment) => {
    if (!segment.start || !segment.end) return false
    return currentTime >= segment.start && currentTime < segment.end
  }

  const handleSegmentClick = (segment) => {
    if (segment.start !== undefined) {
      setSeekToTime(segment.start)
    }
  }

  // Get audio URL for first completed chunk
  const getAudioUrl = () => {
    const completedChunks = conversation?.chunks?.filter(c => c.status === 'completed') || []
    if (completedChunks.length > 0) {
      return transcriptionApi.getAudioUrl(completedChunks[0].id)
    }
    return null
  }

  // Loading state
  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background-dark">
        <span className="material-symbols-outlined text-primary text-4xl animate-spin">progress_activity</span>
        <p className="mt-4 text-slate-400">Loading...</p>
      </div>
    )
  }

  // Error state
  if (error || !conversation) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background-dark">
        <span className="material-symbols-outlined text-red-400 text-4xl">error</span>
        <p className="mt-4 text-red-400">{error || 'Recording not found'}</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 text-primary hover:text-blue-400"
        >
          Back to Dashboard
        </button>
      </div>
    )
  }

  const completedChunks = conversation.chunks?.filter(c => c.status === 'completed') || []
  const audioUrl = getAudioUrl()
  const allSegments = getAllDiarizedSegments()

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <Header
        title={isEditing ? 'Edit Recording' : (conversation.title || 'Untitled Recording')}
        subtitle={!isEditing ? formatDuration(conversation.total_duration_sec) : undefined}
        showBackButton={true}
        onBackClick={() => navigate('/')}
        rightContent={
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="size-9 flex items-center justify-center rounded-full hover:bg-slate-700 transition-colors text-slate-300"
                  title="Edit"
                >
                  <span className="material-symbols-outlined text-xl">edit</span>
                </button>
                <button
                  onClick={handleDelete}
                  className="size-9 flex items-center justify-center rounded-full hover:bg-red-900/30 transition-colors text-slate-300 hover:text-red-400"
                  title="Delete"
                >
                  <span className="material-symbols-outlined text-xl">delete</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-blue-600 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="px-4 py-2 bg-slate-700 text-white text-sm font-semibold rounded-xl hover:bg-slate-600"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Edit Form */}
      {isEditing && (
        <div className="px-5 pb-4 space-y-3 border-b border-slate-800">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Title</label>
            <input
              type="text"
              value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              className="w-full px-4 py-3 bg-surface-dark border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="Enter title..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Description</label>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              rows={2}
              className="w-full px-4 py-3 bg-surface-dark border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              placeholder="Add description..."
            />
          </div>
        </div>
      )}

      {/* Audio Player */}
      {audioUrl && !isEditing && (
        <AudioPlayerNew
          audioUrl={audioUrl}
          onTimeUpdate={setCurrentTime}
          currentSegmentTime={seekToTime}
        />
      )}

      {/* Content */}
      <main className="flex-1 overflow-y-auto hide-scrollbar">
        {/* Status: Recording/Processing */}
        {(conversation.status === 'recording' || conversation.status === 'processing') && (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="material-symbols-outlined text-primary text-5xl animate-spin mb-4">progress_activity</span>
            <p className="text-slate-400">
              {conversation.status === 'recording' ? 'Recording in progress...' : 'Processing transcription...'}
            </p>
          </div>
        )}

        {/* Toolbar */}
        {completedChunks.length > 0 && !isEditing && (
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
            {/* View Toggle */}
            {hasDiarizationData() && (
              <div className="flex items-center bg-slate-800 rounded-xl p-1">
                <button
                  onClick={() => setShowSpeakerView(false)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${!showSpeakerView
                    ? 'bg-surface-dark text-white shadow'
                    : 'text-slate-400 hover:text-white'
                    }`}
                >
                  Plain
                </button>
                <button
                  onClick={() => setShowSpeakerView(true)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${showSpeakerView
                    ? 'bg-surface-dark text-white shadow'
                    : 'text-slate-400 hover:text-white'
                    }`}
                >
                  Speakers
                </button>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyTranscript}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                title="Copy transcript"
              >
                <span className="material-symbols-outlined text-xl">content_copy</span>
              </button>
              <button
                onClick={handleDownloadTranscript}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                title="Download transcript"
              >
                <span className="material-symbols-outlined text-xl">download</span>
              </button>
            </div>
          </div>
        )}

        {/* Transcript Content */}
        {completedChunks.length > 0 && !isEditing && (
          <div className="px-5 py-4 space-y-4">
            {showSpeakerView && hasDiarizationData() ? (
              // Speaker View
              allSegments.map((segment, idx) => {
                const colors = getSpeakerColor(segment.speaker)
                const isPlaying = isSegmentPlaying(segment)

                return (
                  <div
                    key={idx}
                    onClick={() => handleSegmentClick(segment)}
                    className={`group flex gap-3 p-3 rounded-2xl cursor-pointer transition-all ${isPlaying
                      ? `${colors.bg} ${colors.border} border`
                      : 'hover:bg-slate-800/50'
                      }`}
                  >
                    {/* Avatar */}
                    <div className={`size-10 rounded-full ${colors.avatar} flex items-center justify-center shrink-0 text-white font-bold text-sm`}>
                      {getSpeakerInitial(segment.speaker)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Header */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold ${colors.text}`}>
                          {getSpeakerLabel(segment.speaker)}
                        </span>
                        {segment.start !== undefined && (
                          <span className="text-[10px] text-slate-500 font-medium">
                            {formatDuration(segment.start)}
                          </span>
                        )}
                      </div>

                      {/* Text */}
                      <p className={`text-sm leading-relaxed ${isPlaying ? 'text-white' : 'text-slate-300'}`}>
                        {segment.text}
                      </p>
                    </div>
                  </div>
                )
              })
            ) : (
              // Plain View
              <div className="prose prose-invert max-w-none">
                <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {completedChunks
                    .sort((a, b) => (a.chunk_index ?? 0) - (b.chunk_index ?? 0))
                    .map(c => c.transcript_text)
                    .join(' ') || 'No transcript available'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Failed Chunks */}
        {conversation.chunks?.some(c => c.status === 'failed') && (
          <div className="px-5 pb-4">
            <div className="bg-red-900/20 border border-red-500/20 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-red-400 font-semibold text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">warning</span>
                  Failed Chunks
                </span>
                <button
                  onClick={() => conversation.chunks?.filter(c => c.status === 'failed').forEach(c => handleRetryChunk(c.id))}
                  className="text-xs text-red-400 hover:text-red-300 font-medium"
                >
                  Retry All
                </button>
              </div>
              {conversation.chunks
                ?.filter(c => c.status === 'failed')
                .map(chunk => (
                  <div key={chunk.id} className="flex items-center justify-between py-2 border-t border-red-500/10">
                    <span className="text-sm text-slate-400">
                      Chunk {(chunk.chunk_index ?? 0) + 1}: {chunk.error_message || 'Failed'}
                    </span>
                    <button
                      onClick={() => handleRetryChunk(chunk.id)}
                      disabled={retryingChunks[chunk.id]}
                      className="text-xs text-primary hover:text-blue-400 disabled:opacity-50"
                    >
                      {retryingChunks[chunk.id] ? 'Retrying...' : 'Retry'}
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        <div className="h-8"></div>
      </main>

      {/* Saved AI Suggestions */}
      {!isEditing && completedChunks.some(c => c.ai_suggestions?.length > 0) && (
        <div className="px-5 pb-4">
          <div className="bg-violet-900/20 border border-violet-500/20 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-violet-400 text-lg">psychology</span>
              <span className="text-violet-400 font-semibold text-sm">AI Suggestions</span>
              <span className="text-violet-400/60 text-xs ml-auto">
                {completedChunks.filter(c => c.ai_suggestions?.length > 0).length} chunks with suggestions
              </span>
            </div>

            <div className="space-y-3">
              {completedChunks
                .filter(c => c.ai_suggestions?.length > 0)
                .sort((a, b) => (a.chunk_index ?? 0) - (b.chunk_index ?? 0))
                .map(chunk => (
                  <div key={chunk.id} className="border-t border-violet-500/10 pt-3 first:border-0 first:pt-0">
                    <div className="text-[10px] text-violet-400/60 uppercase tracking-wider mb-2">
                      Chunk {(chunk.chunk_index ?? 0) + 1}
                    </div>
                    <div className="space-y-2">
                      {(Array.isArray(chunk.ai_suggestions) ? chunk.ai_suggestions : []).map((suggestion, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2 p-2 bg-violet-900/20 rounded-lg"
                        >
                          <span className="material-symbols-outlined text-violet-400 text-sm mt-0.5">
                            {suggestion.type === 'clarification' ? 'help' :
                              suggestion.type === 'follow_up' ? 'chat' : 'sticky_note_2'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-violet-300">{suggestion.title}</div>
                            <div className="text-xs text-slate-400">{suggestion.message}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ViewConversation
