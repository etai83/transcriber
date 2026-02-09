import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { transcriptionApi } from '../services/api'
import ConfirmDialog from '../components/ConfirmDialog'

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Audio player refs and state
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // Waveform visualization fake data
  const [waveformBars, setWaveformBars] = useState([])

  const fetchTranscription = useCallback(async (isPolling = false) => {
    try {
      const data = await transcriptionApi.get(id)
      setTranscription(data)

      if (!isEditing) {
        setEditForm({
          title: data.title || '',
          description: data.description || '',
          transcript_text: data.transcript_text || '',
        })
      }

      if (!isPolling) setError(null)
    } catch (err) {
      console.error('Failed to load transcription:', err)
      if (!isPolling) {
        setError('Failed to load transcription')
      }
    } finally {
      if (!isPolling) setLoading(false)
    }
  }, [id, isEditing])

  useEffect(() => {
    fetchTranscription()
  }, [fetchTranscription])

  useEffect(() => {
    if (transcription?.status === 'pending' || transcription?.status === 'processing') {
      const interval = setInterval(() => fetchTranscription(true), 3000)
      return () => clearInterval(interval)
    }
  }, [transcription?.status, fetchTranscription])

  // Generate random waveform bars once
  useEffect(() => {
    setWaveformBars(Array.from({ length: 60 }, () => Math.random() * 0.6 + 0.2))
  }, [])

  // Audio player effects
  useEffect(() => {
    if (!transcription) return

    const audioUrl = transcriptionApi.getAudioUrl(transcription.id)
    const audio = new Audio(audioUrl)
    audioRef.current = audio

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
      if (audio.duration === Infinity) {
        audio.currentTime = 1e101;
        audio.ontimeupdate = function () {
          this.ontimeupdate = () => {
            return;
          }
          audio.currentTime = 0;
          setDuration(audio.duration)
        }
      }
    }
    const handleEnded = () => setIsPlaying(false)

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.pause()
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [transcription?.id])

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width
    const newTime = percentage * duration
    if (audioRef.current) {
      audioRef.current.currentTime = newTime
    }
  }

  const handleDelete = () => {
    setShowDeleteConfirm(true)
  }

  const confirmDelete = async () => {
    try {
      await transcriptionApi.delete(id)
      navigate('/')
    } catch (err) {
      alert('Failed to delete transcription')
    } finally {
      setShowDeleteConfirm(false)
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

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '00:00'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const formatSpeakerLabel = (speaker) => {
    if (!speaker) return 'Unknown';
    // If simplified format
    if (speaker === 'A' || speaker === '0' || speaker === 'SPEAKER_00') return 'Speaker 1';
    if (speaker === 'B' || speaker === '1' || speaker === 'SPEAKER_01') return 'Speaker 2';

    // If starts with SPEAKER_
    if (speaker.startsWith('SPEAKER_')) {
      const num = speaker.replace('SPEAKER_', '');
      return `Speaker ${parseInt(num) + 1}`; // Show 1-indexed for humans
    }

    // If literal name
    return speaker;
  }

  const getSpeakerInitials = (speaker) => {
    if (!speaker) return '?';
    if (speaker === 'A' || speaker === '0' || speaker === 'SPEAKER_00') return 'S1';
    if (speaker === 'B' || speaker === '1' || speaker === 'SPEAKER_01') return 'S2';

    if (speaker.startsWith('SPEAKER_')) {
      const num = speaker.replace('SPEAKER_', '');
      return `S${parseInt(num) + 1}`;
    }
    return speaker.substring(0, 2).toUpperCase();
  }

  const isPrimarySpeaker = (speaker) => {
    return speaker === 'A' || speaker === '0' || speaker === 'SPEAKER_00';
  }

  const renderContent = () => {
    if (isEditing) {
      return (
        <textarea
          value={editForm.transcript_text}
          onChange={(e) => setEditForm({ ...editForm, transcript_text: e.target.value })}
          className="w-full min-h-[500px] p-6 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-xl text-gray-800 dark:text-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 font-body leading-relaxed text-base shadow-sm"
          placeholder="Edit transcript..."
        />
      )
    }

    // Try to render segments if available
    let segments = []
    if (transcription.transcript_segments && transcription.transcript_segments.segments) {
      segments = transcription.transcript_segments.segments
    } else if (typeof transcription.transcript_segments === 'object' && transcription.transcript_segments !== null && Array.isArray(transcription.transcript_segments)) {
      // Handle case where it might be a direct list
      segments = transcription.transcript_segments
    }

    if (segments.length > 0) {
      return (
        <div className="space-y-6">
          {segments.map((segment, index) => {
            const isPrimary = isPrimarySpeaker(segment.speaker);
            const label = formatSpeakerLabel(segment.speaker);
            const initials = getSpeakerInitials(segment.speaker);

            return (
              <div key={index} className={`flex flex-col relative group ${isPrimary ? 'items-start' : 'items-end'}`}>
                <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm relative ${isPrimary
                    ? 'bg-white dark:bg-surface-dark rounded-tl-none border border-gray-100 dark:border-gray-800'
                    : 'bg-primary/10 dark:bg-primary/20 rounded-tr-none border border-primary/10'
                  }`}>
                  {/* Speaker Header */}
                  <div className={`flex items-center gap-2 mb-2 ${isPrimary ? 'flex-row' : 'flex-row-reverse'}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] text-white font-bold shadow-sm shrink-0 ${isPrimary ? 'bg-gradient-to-br from-blue-500 to-blue-600' : 'bg-gradient-to-br from-purple-500 to-purple-600'
                      }`}>
                      {initials}
                    </div>
                    <span className={`text-xs font-bold tracking-wide ${isPrimary ? 'text-gray-700 dark:text-gray-300' : 'text-primary dark:text-blue-300'
                      }`}>
                      {label}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono opacity-80">{formatTime(segment.start)}</span>
                  </div>

                  {/* Text */}
                  <p className="text-[15px] leading-7 text-gray-800 dark:text-gray-100 whitespace-pre-wrap font-body selection:bg-primary/20 selection:text-primary-dark">
                    {segment.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )
    }

    // Fallback to full text
    if (transcription.transcript_text) {
      return (
        <div className="bg-white dark:bg-surface-dark rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">
            <span className="material-symbols-outlined text-gray-400">description</span>
            <span className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">Full Transcript</span>
          </div>

          <p className="text-[15px] leading-8 text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-body">
            {transcription.transcript_text}
          </p>
        </div>
      )
    }

    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-white dark:bg-surface-dark rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-full">
          <span className="material-symbols-outlined text-4xl text-gray-400">text_fields</span>
        </div>
        <div>
          <p className="text-lg font-medium text-gray-900 dark:text-white">No transcript available</p>
          <p className="text-sm text-gray-500 max-w-xs mx-auto mt-1">
            The transcription text is missing or hasn't clear yet. If processing is complete, try retrying.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background-light dark:bg-background-dark gap-4">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-gray-500 animate-pulse">Loading transcription...</p>
      </div>
    )
  }

  if (error || !transcription) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background-light dark:bg-background-dark p-4">
        <div className="bg-white dark:bg-surface-dark p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-gray-100 dark:border-gray-800">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-3xl">error</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Unavailable</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8">{error || 'Transcription not found or access denied.'}</p>
          <Link
            to="/"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold hover:scale-105 transition-transform w-full"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background-light dark:bg-background-dark font-display overflow-hidden selection:bg-primary/20">
      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between px-6 py-4 bg-white/80 dark:bg-surface-dark/90 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50 shrink-0 z-40 sticky top-0 transition-colors">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all group"
          >
            <span className="material-symbols-outlined text-[20px] group-hover:-translate-x-1 transition-transform">arrow_back</span>
          </Link>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="bg-transparent border-b-2 border-primary focus:outline-none min-w-[200px]"
                    autoFocus
                  />
                ) : (
                  transcription.title || transcription.filename
                )}
              </h1>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 font-medium">
              <span>{new Date(transcription.created_at).toLocaleDateString()}</span>
              <span>•</span>
              <span>{formatTime(transcription.duration_sec)}</span>
              {transcription.status !== 'completed' && (
                <span className={`ml-2 px-2 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-wider ${transcription.status === 'processing' ? 'bg-blue-100 text-blue-700 animate-pulse' :
                    transcription.status === 'failed' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                  }`}>
                  {transcription.status}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isEditing && transcription.status === 'completed' && (
            <button
              onClick={() => setIsEditing(true)}
              className="p-2.5 text-gray-500 hover:text-primary transition-colors rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50"
              title="Edit"
            >
              <span className="material-symbols-outlined text-[20px]">edit_note</span>
            </button>
          )}

          {isEditing && (
            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center gap-2"
              >
                {saving ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <span className="material-symbols-outlined text-[18px]">save</span>
                )}
                Save
              </button>
            </div>
          )}

          {!isEditing && (
            <button
              onClick={handleDelete}
              className="p-2.5 text-gray-400 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10"
              title="Delete"
            >
              <span className="material-symbols-outlined text-[20px]">delete</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Layout: Audio Player on top, Chat below */}
      <div className="flex-1 flex flex-col items-center overflow-hidden w-full max-w-5xl mx-auto">

        {/* Audio Player Card - Floating styled */}
        <div className="w-full px-6 py-6 pb-2 shrink-0 z-10">
          <div className="bg-surface-light dark:bg-surface-dark rounded-[24px] border border-gray-200/60 dark:border-gray-700/60 shadow-xl overflow-hidden backdrop-blur-md relative">
            {/* Progress Bar Background */}
            <div
              className="absolute bottom-0 left-0 right-0 h-1 bg-gray-100 dark:bg-gray-800 cursor-pointer group"
              onClick={handleSeek}
            >
              <div
                className="h-full bg-primary relative transition-all duration-75"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white shadow-md rounded-full scale-0 group-hover:scale-100 transition-transform"></div>
              </div>
            </div>

            <div className="flex items-center p-5 gap-6">
              <button
                onClick={togglePlay}
                className="w-14 h-14 shrink-0 flex items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[32px] fill-current">
                  {isPlaying ? 'pause' : 'play_arrow'}
                </span>
              </button>

              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate mb-1">
                  {transcription.title || transcription.filename}
                </h3>
                <div className="flex items-end gap-3 h-8 mb-1">
                  {/* Fake Visualization */}
                  <div className="flex items-end gap-[2px] h-full flex-1 opacity-50 mask-image-gradient">
                    {waveformBars.map((h, i) => (
                      <div
                        key={i}
                        className="w-1.5 bg-gray-800 dark:bg-white rounded-full transition-all duration-300"
                        style={{
                          height: `${isPlaying ? Math.max(20, Math.random() * 100) : h * 100}%`,
                          opacity: i / waveformBars.length > (currentTime / duration) ? 0.3 : 1
                        }}
                      ></div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="font-mono text-sm font-medium text-gray-500 shrink-0 tabular-nums">
                <span className="text-gray-900 dark:text-white">{formatTime(currentTime)}</span>
                <span className="opacity-50 mx-1">/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Transcript Content */}
        <div className="flex-1 w-full overflow-y-auto px-6 py-4 pb-20 scroll-smooth">
          <div className="max-w-3xl mx-auto">
            {renderContent()}
          </div>
        </div>

      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Transcription"
        message="Are you sure you want to delete this transcription? This action cannot be undone."
        confirmText="Delete"
        isDestructive={true}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  )
}

export default ViewTranscription
