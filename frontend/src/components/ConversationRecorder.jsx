import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { conversationApi, transcriptionApi, aiAssistantApi } from '../services/api'
import AIAssistant from './AIAssistant'

function ConversationRecorder({ onRecordingComplete, onRecordingStateChange, compact = false }) {
  const navigate = useNavigate()

  // Recording state
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [chunkTime, setChunkTime] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0) // 0-100 for audio meter

  // Settings
  const [language, setLanguage] = useState('auto')
  const [trimSilence, setTrimSilence] = useState(false)
  const [chunkInterval, setChunkInterval] = useState(30) // seconds
  const [numSpeakers, setNumSpeakers] = useState(2) // number of speakers for diarization
  const [availableMics, setAvailableMics] = useState([])
  const [selectedMicId, setSelectedMicId] = useState('')

  // Conversation state
  const [conversationId, setConversationId] = useState(null)
  const [chunks, setChunks] = useState([])
  const [chunkIndex, setChunkIndex] = useState(0)

  // UI state
  const [error, setError] = useState(null)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [retryingChunks, setRetryingChunks] = useState({})
  const [uploadQueue, setUploadQueue] = useState([])
  const [uploadingCount, setUploadingCount] = useState(0)

  // AI Assistant state
  const [aiSuggestions, setAiSuggestions] = useState([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [aiEnabled, setAiEnabled] = useState(true)
  const [lastProcessedChunkId, setLastProcessedChunkId] = useState(null)

  // Refs
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const timerRef = useRef(null)
  const chunkTimerRef = useRef(null)
  const streamRef = useRef(null)
  const conversationIdRef = useRef(null)
  const chunkIndexRef = useRef(0)
  const isRecordingRef = useRef(false)
  const isPausedRef = useRef(false)
  const mimeTypeRef = useRef('audio/webm')
  const isStoppingForChunkRef = useRef(false)

  // Audio analysis refs
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const animationFrameRef = useRef(null)

  // Load available microphones on mount
  useEffect(() => {
    const loadMicrophones = async () => {
      try {
        // Need to request permission first to get device labels
        await navigator.mediaDevices.getUserMedia({ audio: true })
          .then(stream => stream.getTracks().forEach(track => track.stop()))

        const devices = await navigator.mediaDevices.enumerateDevices()
        const mics = devices.filter(device => device.kind === 'audioinput')
        console.log('Available microphones:', mics)
        setAvailableMics(mics)

        // Select first mic by default if none selected
        if (mics.length > 0 && !selectedMicId) {
          setSelectedMicId(mics[0].deviceId)
        }
      } catch (err) {
        console.error('Error loading microphones:', err)
      }
    }

    loadMicrophones()
  }, [])

  // Keep refs in sync with state
  useEffect(() => {
    conversationIdRef.current = conversationId
  }, [conversationId])

  useEffect(() => {
    chunkIndexRef.current = chunkIndex
  }, [chunkIndex])

  useEffect(() => {
    isRecordingRef.current = isRecording
    // Notify parent of recording state change
    if (onRecordingStateChange) {
      onRecordingStateChange(isRecording)
    }
  }, [isRecording, onRecordingStateChange])

  useEffect(() => {
    isPausedRef.current = isPaused
  }, [isPaused])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (chunkTimerRef.current) clearInterval(chunkTimerRef.current)
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
      if (audioContextRef.current) audioContextRef.current.close()
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  // Audio level monitoring
  const startAudioMonitoring = useCallback((stream) => {
    try {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
      analyserRef.current = audioContextRef.current.createAnalyser()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)

      analyserRef.current.fftSize = 256
      const bufferLength = analyserRef.current.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      const updateLevel = () => {
        if (!isRecordingRef.current) {
          setAudioLevel(0)
          return
        }

        analyserRef.current.getByteFrequencyData(dataArray)

        // Calculate average volume
        let sum = 0
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i]
        }
        const average = sum / bufferLength

        // Convert to 0-100 scale (dataArray values are 0-255)
        const level = Math.min(100, Math.round((average / 255) * 100 * 2)) // *2 to make it more sensitive
        setAudioLevel(level)

        animationFrameRef.current = requestAnimationFrame(updateLevel)
      }

      updateLevel()
    } catch (err) {
      console.error('Error setting up audio monitoring:', err)
    }
  }, [])

  const stopAudioMonitoring = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    setAudioLevel(0)
  }, [])

  // Poll for chunk status updates
  useEffect(() => {
    if (!conversationId || chunks.length === 0) return

    const hasProcessing = chunks.some(c => c.status === 'pending' || c.status === 'processing')
    if (!hasProcessing) return

    const pollInterval = setInterval(async () => {
      try {
        const conversation = await conversationApi.get(conversationId)
        setChunks(conversation.chunks || [])
      } catch (err) {
        console.error('Error polling conversation:', err)
      }
    }, 3000)

    return () => clearInterval(pollInterval)
  }, [conversationId, chunks])

  // Fetch AI recommendations when a new chunk completes
  useEffect(() => {
    if (!conversationId || !aiEnabled || !isRecording) return

    const completedChunks = chunks.filter(c => c.status === 'completed' && c.transcript_text)
    if (completedChunks.length === 0) return

    // Get the latest completed chunk
    const latestCompleted = completedChunks[completedChunks.length - 1]

    // Only fetch if this is a new completed chunk
    if (latestCompleted.id === lastProcessedChunkId) return

    const fetchRecommendations = async () => {
      setAiLoading(true)
      setAiError(null)

      try {
        const result = await aiAssistantApi.getRecommendations(conversationId, latestCompleted.id)

        if (result.error) {
          setAiError(result.error)
        } else {
          setAiSuggestions(result.suggestions || [])
        }
        setLastProcessedChunkId(latestCompleted.id)
      } catch (err) {
        console.error('Error fetching AI recommendations:', err)
        setAiError('Failed to get AI recommendations')
      } finally {
        setAiLoading(false)
      }
    }

    fetchRecommendations()
  }, [conversationId, chunks, aiEnabled, isRecording, lastProcessedChunkId])

  const uploadChunk = useCallback(async (blob, index) => {
    if (!conversationIdRef.current) return

    const extension = blob.type.includes('webm') ? 'webm' :
      blob.type.includes('mp4') ? 'm4a' : 'webm'
    const filename = `chunk_${index}_${Date.now()}.${extension}`
    const file = new File([blob], filename, { type: blob.type })

    console.log(`Uploading chunk ${index}, size: ${blob.size} bytes, type: ${blob.type}`)

    try {
      const result = await conversationApi.addChunk(conversationIdRef.current, file, index)

      // Add to chunks list
      setChunks(prev => {
        // Check if chunk already exists (avoid duplicates)
        if (prev.some(c => c.chunk_index === index)) {
          return prev
        }
        return [...prev, {
          id: result.id,
          chunk_index: index,
          status: 'pending',
          transcript_text: null,
          filename
        }]
      })
    } catch (err) {
      console.error('Error uploading chunk:', err)
      setError(`Failed to upload chunk ${index + 1}`)
    }
  }, [])

  const handleRetryChunk = useCallback(async (chunkId) => {
    setRetryingChunks(prev => ({ ...prev, [chunkId]: true }))
    try {
      await transcriptionApi.retry(chunkId)
      // Update the chunk status locally
      setChunks(prev => prev.map(c =>
        c.id === chunkId ? { ...c, status: 'pending', error_message: null } : c
      ))
    } catch (err) {
      console.error('Error retrying chunk:', err)
      setError('Failed to retry chunk transcription')
    } finally {
      setRetryingChunks(prev => ({ ...prev, [chunkId]: false }))
    }
  }, [])

  // Process upload queue
  useEffect(() => {
    if (uploadQueue.length === 0) return

    const processingCount = chunks.filter(c => ['pending', 'processing'].includes(c.status)).length

    // Limit to 2 concurrent transcriptions (uploading + processing)
    if (processingCount + uploadingCount >= 2) return

    const nextChunk = uploadQueue[0]
    setUploadQueue(prev => prev.slice(1))
    setUploadingCount(prev => prev + 1)

    uploadChunk(nextChunk.blob, nextChunk.index).finally(() => {
      setUploadingCount(prev => prev - 1)
    })
  }, [uploadQueue, chunks, uploadingCount, uploadChunk])

  // Create a new MediaRecorder instance
  const createMediaRecorder = useCallback(() => {
    if (!streamRef.current) return null

    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType: mimeTypeRef.current,
      audioBitsPerSecond: 128000
    })

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data)
        console.log(`Data available: ${event.data.size} bytes, total parts: ${audioChunksRef.current.length}`)
      }
    }

    mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event.error)
      setError(`Recording error: ${event.error?.message || 'Unknown error'}`)
    }

    mediaRecorder.onstop = () => {
      console.log('MediaRecorder stopped, isStoppingForChunk:', isStoppingForChunkRef.current)

      // Create blob from accumulated data
      if (audioChunksRef.current.length > 0) {
        const blob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current })
        const currentIndex = chunkIndexRef.current

        console.log(`Chunk ${currentIndex} complete, blob size: ${blob.size} bytes`)

        // Only upload if there's meaningful data (more than 1KB)
        if (blob.size > 1000) {
          // Queue the chunk instead of uploading immediately
          setUploadQueue(prev => [...prev, { blob, index: currentIndex }])

          // Increment chunk index for next chunk
          setChunkIndex(prev => prev + 1)
          chunkIndexRef.current = chunkIndexRef.current + 1
        } else {
          console.log('Chunk too small, skipping upload')
        }

        // Clear for next chunk
        audioChunksRef.current = []
      }

      // If we stopped to create a chunk (not final stop), start a new recorder
      if (isStoppingForChunkRef.current && isRecordingRef.current) {
        isStoppingForChunkRef.current = false
        const newRecorder = createMediaRecorder()
        if (newRecorder) {
          mediaRecorderRef.current = newRecorder
          newRecorder.start()
          console.log('New MediaRecorder started for next chunk')
        }
      }
    }

    return mediaRecorder
  }, [uploadChunk])

  // Stop current recorder and start a new one for the next chunk
  const rotateRecorder = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      return
    }

    if (isPausedRef.current) {
      console.log('Skipping chunk rotation while paused')
      return
    }

    console.log('Rotating MediaRecorder for new chunk...')
    isStoppingForChunkRef.current = true

    // Stop will trigger onstop, which will upload the chunk and create a new recorder
    mediaRecorderRef.current.stop()
  }, [])

  const startRecording = async () => {
    setError(null)
    setPermissionDenied(false)
    audioChunksRef.current = []

    // Check browser support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Your browser does not support audio recording.')
      return
    }

    if (!window.isSecureContext) {
      setError('Audio recording requires a secure connection (HTTPS or localhost).')
      return
    }

    try {
      // Create conversation first
      const conversation = await conversationApi.create({
        language,
        trim_silence: trimSilence,
        chunk_interval_sec: chunkInterval,
        num_speakers: numSpeakers
      })
      setConversationId(conversation.id)
      conversationIdRef.current = conversation.id
      setChunks([])
      setChunkIndex(0)
      chunkIndexRef.current = 0

      // Get microphone access with specific constraints for better quality
      const audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 1
      }

      // Use selected microphone if specified
      if (selectedMicId) {
        audioConstraints.deviceId = { exact: selectedMicId }
      }

      console.log('Requesting microphone with constraints:', audioConstraints)

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints
      })
      streamRef.current = stream

      // Start audio level monitoring
      startAudioMonitoring(stream)

      // Log audio track settings
      const audioTrack = stream.getAudioTracks()[0]
      console.log('Audio track settings:', audioTrack.getSettings())

      // Determine best supported format
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeTypeRef.current = 'audio/webm;codecs=opus'
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeTypeRef.current = 'audio/webm'
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeTypeRef.current = 'audio/mp4'
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeTypeRef.current = 'audio/ogg'
      }

      console.log('Using mime type:', mimeTypeRef.current)

      // Create the first MediaRecorder
      const mediaRecorder = createMediaRecorder()
      if (!mediaRecorder) {
        setError('Failed to create media recorder')
        return
      }
      mediaRecorderRef.current = mediaRecorder

      // Start recording
      mediaRecorder.start()
      console.log('MediaRecorder started, state:', mediaRecorder.state)

      setIsRecording(true)
      setIsPaused(false)
      setRecordingTime(0)
      setChunkTime(0)
      isRecordingRef.current = true
      isPausedRef.current = false
      isStoppingForChunkRef.current = false

      // Start total time timer
      timerRef.current = setInterval(() => {
        if (!isPausedRef.current) {
          setRecordingTime(prev => prev + 1)
        }
      }, 1000)

      // Start chunk timer - rotate recorder at intervals
      chunkTimerRef.current = setInterval(() => {
        if (!isPausedRef.current && isRecordingRef.current) {
          setChunkTime(prev => {
            const newTime = prev + 1
            if (newTime >= chunkInterval) {
              // Time to rotate the recorder and upload current chunk
              rotateRecorder()
              return 0
            }
            return newTime
          })
        }
      }, 1000)

    } catch (err) {
      console.error('Error starting recording:', err)
      if (err.name === 'NotAllowedError') {
        setPermissionDenied(true)
        setError('Microphone access denied.')
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found.')
      } else {
        setError(`Could not start recording: ${err.message}`)
      }
    }
  }

  const stopRecording = async () => {
    isRecordingRef.current = false
    isStoppingForChunkRef.current = false  // This is a final stop, not a chunk rotation

    // Stop audio monitoring
    stopAudioMonitoring()

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }

    setIsRecording(false)
    setIsPaused(false)

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (chunkTimerRef.current) {
      clearInterval(chunkTimerRef.current)
      chunkTimerRef.current = null
    }

    // Stop the stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    // Mark conversation as complete after a short delay to allow final upload
    setTimeout(async () => {
      if (conversationIdRef.current) {
        try {
          await conversationApi.complete(conversationIdRef.current)
        } catch (err) {
          console.error('Error completing conversation:', err)
        }
      }
    }, 2000)
  }

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        // Resume
        if (mediaRecorderRef.current.state === 'paused') {
          mediaRecorderRef.current.resume()
        }
        isPausedRef.current = false
        setIsPaused(false)
      } else {
        // Pause
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.pause()
        }
        isPausedRef.current = true
        setIsPaused(true)
      }
    }
  }

  const viewConversation = () => {
    if (conversationId) {
      navigate(`/conversation/${conversationId}`)
    }
  }

  const startNewRecording = () => {
    setConversationId(null)
    setChunks([])
    setChunkIndex(0)
    setRecordingTime(0)
    setChunkTime(0)
    setUploadQueue([])
    setUploadingCount(0)
    setError(null)
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return (
          <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
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

  // Compact dark-themed version for use in Dashboard Record tab
  if (compact) {
    // Get completed chunks with transcripts for live display
    const completedChunks = chunks.filter(c => c.status === 'completed' && c.transcript_text)
    const processingChunks = chunks.filter(c => c.status === 'pending' || c.status === 'processing')

    return (
      <div className="flex flex-col">
        {/* Error Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-500/30 rounded-xl text-red-400 text-sm w-full">
            {error}
          </div>
        )}

        {permissionDenied && (
          <div className="mb-4 p-4 bg-amber-900/20 border border-amber-500/20 rounded-xl w-full">
            <p className="text-amber-400 text-sm font-medium">To enable microphone access:</p>
            <ul className="text-amber-400/80 text-sm mt-2 list-disc list-inside">
              <li>Click the lock icon in your browser's address bar</li>
              <li>Allow microphone permissions</li>
              <li>Refresh the page</li>
            </ul>
          </div>
        )}

        {/* Recording Controls - Compact Row */}
        <div className="flex items-center justify-between gap-4 py-4">
          {/* Visualizer + Timer */}
          <div className="flex items-center gap-3">
            <div className={`size-12 rounded-full flex items-center justify-center transition-all duration-300 ${isRecording
              ? isPaused
                ? 'bg-amber-500/20'
                : 'bg-red-500/20 animate-pulse'
              : 'bg-slate-800'
              }`}>
              {isRecording ? (
                <div className="flex items-center space-x-0.5">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1 bg-red-500 rounded-full transition-all duration-75"
                      style={{
                        height: isPaused ? '10px' : `${Math.max(4, (audioLevel / 100) * 18 + Math.random() * 4)}px`,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <span className="material-symbols-outlined text-2xl text-slate-400">mic</span>
              )}
            </div>

            <div className="flex flex-col">
              <div className={`text-xl font-mono ${isRecording ? 'text-red-500' : 'text-slate-500'}`}>
                {formatTime(recordingTime)}
              </div>
              {isRecording && (
                <div className="text-[10px] text-slate-500">
                  Chunk {chunkIndex + 1} • {formatTime(chunkTime)}/{formatTime(chunkInterval)}
                </div>
              )}
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center gap-2">
            {!isRecording ? (
              conversationId ? (
                <>
                  <button
                    onClick={viewConversation}
                    className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    View
                  </button>
                  <button
                    onClick={startNewRecording}
                    className="px-4 py-2 border border-slate-600 text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    New
                  </button>
                </>
              ) : (
                <button
                  onClick={startRecording}
                  className="size-12 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all shadow-lg shadow-red-500/30"
                  title="Start Recording"
                >
                  <span className="material-symbols-outlined text-xl">mic</span>
                </button>
              )
            ) : (
              <>
                <button
                  onClick={pauseRecording}
                  className={`size-9 rounded-full flex items-center justify-center transition-colors shadow ${isPaused
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                    : 'bg-amber-500 hover:bg-amber-600 text-white'
                    }`}
                  title={isPaused ? 'Resume' : 'Pause'}
                >
                  <span className="material-symbols-outlined text-lg">
                    {isPaused ? 'play_arrow' : 'pause'}
                  </span>
                </button>

                <button
                  onClick={stopRecording}
                  className="size-12 bg-slate-700 hover:bg-slate-600 text-white rounded-full flex items-center justify-center transition-colors shadow-lg"
                  title="Stop Recording"
                >
                  <span className="material-symbols-outlined text-xl">stop</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Chunk Progress Bar */}
        {isRecording && (
          <div className="w-full bg-slate-700 rounded-full h-1 mb-4">
            <div
              className="bg-primary h-1 rounded-full transition-all duration-1000"
              style={{ width: `${(chunkTime / chunkInterval) * 100}%` }}
            />
          </div>
        )}

        {/* AI Assistant Panel */}
        {isRecording && (
          <div className="mb-4 animate-slide-up">
            <AIAssistant
              suggestions={aiSuggestions}
              isLoading={aiLoading}
              error={aiError}
              onDismiss={() => setAiSuggestions([])}
              className="shadow-none border-t border-white/5 rounded-none bg-transparent"
            />
          </div>
        )}

        {/* Live Transcript Display */}
        {(isRecording || chunks.length > 0) && (
          <div className="bg-slate-900/50 rounded-xl border border-slate-700/50 overflow-hidden mb-4">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-sm">subtitles</span>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Live Transcript</span>
              </div>
              <div className="flex items-center gap-3">
                {processingChunks.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                    <span className="text-[10px] text-amber-500 font-medium">Processing {processingChunks.length}</span>
                  </div>
                )}
                {uploadQueue.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                    <span className="text-[10px] text-blue-400 font-medium">Queued {uploadQueue.length}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto p-3 space-y-3">
              {completedChunks.length === 0 && processingChunks.length === 0 && !isRecording && (
                <p className="text-slate-500 text-sm text-center py-4">No transcripts yet</p>
              )}

              {completedChunks.length === 0 && (isRecording || processingChunks.length > 0) && (
                <p className="text-slate-500 text-sm text-center py-4">
                  {isRecording ? 'Waiting for first chunk to complete...' : 'Processing transcription...'}
                </p>
              )}

              {completedChunks.map((chunk, idx) => {
                // Detect if Hebrew (RTL)
                const isHebrew = chunk.transcript_text?.match(/[\u0590-\u05FF]/)
                // Alternate speaker colors
                const speakerClass = idx % 2 === 0 ? 'border-l-2 border-blue-500 pl-3' : 'border-l-2 border-purple-500 pl-3'

                return (
                  <div
                    key={chunk.id}
                    className={`${isHebrew ? 'text-right border-r-2 border-l-0 pr-3 pl-0 border-emerald-500' : speakerClass}`}
                    dir={isHebrew ? 'rtl' : 'ltr'}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] text-slate-500 font-mono">Chunk {chunk.chunk_index + 1}</span>
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed">{chunk.transcript_text}</p>
                  </div>
                )
              })}

            </div>

            {/* Processing indicators */}
            {processingChunks.map((chunk) => (
              <div key={chunk.id} className="flex items-center gap-2 text-slate-500 py-2">
                <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                <span className="text-xs">Processing chunk {chunk.chunk_index + 1}...</span>
              </div>
            ))}

            {/* Queued indicators */}
            {uploadQueue.map((item) => (
              <div key={`queued-${item.index}`} className="flex items-center gap-2 text-slate-500 py-2 opacity-60">
                <span className="material-symbols-outlined text-sm">hourglass_empty</span>
                <span className="text-xs">Chunk {item.index + 1} (Queued)...</span>
              </div>
            ))}
          </div>
        )
        }

        {/* Privacy Indicator */}
        <div className="flex items-center justify-center gap-2 py-2">
          <span className="material-symbols-outlined text-slate-400 text-sm">shield_lock</span>
          <p className="text-slate-400 text-xs font-medium">Secure Local Processing (Device Only)</p>
        </div>
      </div >
    )
  }

  // Full version for standalone use
  return (
    <div className="flex gap-4">
      {/* Main Recording Panel */}
      <div className="flex-1 p-6">
        {/* Error Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
            {error}
          </div>
        )}

        {permissionDenied && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-yellow-800 text-sm font-medium">To enable microphone access:</p>
            <ul className="text-yellow-700 text-sm mt-2 list-disc list-inside">
              <li>Click the lock icon in your browser's address bar</li>
              <li>Allow microphone permissions</li>
              <li>Refresh the page</li>
            </ul>
          </div>
        )}

        {/* Recording Controls */}
        <div className="text-center py-8">
          {/* Recording Visualizer */}
          <div className="mb-6">
            <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center transition-all duration-300 ${isRecording
              ? isPaused
                ? 'bg-yellow-100'
                : 'bg-red-100 animate-pulse'
              : 'bg-gray-100'
              }`}>
              {isRecording ? (
                <div className="flex items-center space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-1 bg-red-500 rounded-full transition-all duration-75`}
                      style={{
                        height: isPaused ? '16px' : `${Math.max(8, (audioLevel / 100) * 32 + Math.random() * 8)}px`,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </div>

            {/* Audio Level Meter */}
            {isRecording && (
              <div className="mt-4 max-w-xs mx-auto">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>Mic Level</span>
                  <span className={audioLevel < 10 ? 'text-red-500 font-medium' : audioLevel < 30 ? 'text-yellow-500' : 'text-green-500'}>
                    {audioLevel < 10 ? 'Too quiet!' : audioLevel < 30 ? 'Low' : 'Good'}
                  </span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-75 ${audioLevel < 10 ? 'bg-red-500' : audioLevel < 30 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                    style={{ width: `${audioLevel}%` }}
                  />
                </div>
                {audioLevel < 10 && (
                  <p className="text-xs text-red-500 mt-2">
                    Check your microphone! The audio level is very low.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Timers */}
          <div className="mb-6">
            <div className={`text-4xl font-mono ${isRecording ? 'text-red-600' : 'text-gray-400'}`}>
              {formatTime(recordingTime)}
            </div>
            {isRecording && (
              <div className="text-sm text-gray-500 mt-2">
                Chunk {chunkIndex + 1}: {formatTime(chunkTime)} / {formatTime(chunkInterval)}
                <div className="w-48 mx-auto mt-1 bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-1000"
                    style={{ width: `${(chunkTime / chunkInterval) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-center space-x-4">
            {!isRecording ? (
              conversationId ? (
                // Post-recording buttons
                <>
                  <button
                    onClick={viewConversation}
                    className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    View Transcript
                  </button>
                  <button
                    onClick={startNewRecording}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    New Recording
                  </button>
                </>
              ) : (
                // Start recording button
                <button
                  onClick={startRecording}
                  className="w-16 h-16 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-lg"
                  title="Start Recording"
                >
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="6" />
                  </svg>
                </button>
              )
            ) : (
              <>
                <button
                  onClick={pauseRecording}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors shadow ${isPaused
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                    }`}
                  title={isPaused ? 'Resume' : 'Pause'}
                >
                  {isPaused ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    </svg>
                  )}
                </button>

                <button
                  onClick={stopRecording}
                  className="w-16 h-16 bg-gray-700 hover:bg-gray-800 text-white rounded-full flex items-center justify-center transition-colors shadow-lg"
                  title="Stop Recording"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="1" />
                  </svg>
                </button>
              </>
            )}
          </div>

          {/* Status Text */}
          {isRecording && (
            <p className="mt-4 text-sm text-gray-500">
              {isPaused ? 'Recording paused' : `Recording... Transcribing every ${chunkInterval}s`}
            </p>
          )}
        </div>

        {/* Settings (only show before recording) */}
        {!isRecording && !conversationId && (
          <div className="border-t pt-4 mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Microphone
              </label>
              <select
                value={selectedMicId}
                onChange={(e) => setSelectedMicId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {availableMics.length === 0 ? (
                  <option value="">No microphones found</option>
                ) : (
                  availableMics.map((mic) => (
                    <option key={mic.deviceId} value={mic.deviceId}>
                      {mic.label || `Microphone ${mic.deviceId.slice(0, 8)}`}
                    </option>
                  ))
                )}
              </select>
              {availableMics.length === 0 && (
                <p className="text-xs text-red-500 mt-1">
                  Please allow microphone access to see available devices
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Source Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="auto">Auto-detect</option>
                <option value="en">English</option>
                <option value="he">Hebrew</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transcription Interval
              </label>
              <select
                value={chunkInterval}
                onChange={(e) => setChunkInterval(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={15}>15 seconds</option>
                <option value={30}>30 seconds</option>
                <option value={60}>1 minute</option>
                <option value={120}>2 minutes</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Audio will be transcribed at this interval during recording
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Speakers
              </label>
              <select
                value={numSpeakers}
                onChange={(e) => setNumSpeakers(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={1}>1 speaker (monologue)</option>
                <option value={2}>2 speakers</option>
                <option value={3}>3 speakers</option>
                <option value={4}>4 speakers</option>
                <option value={5}>5 speakers</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Speaker diarization will identify who said what
              </p>
            </div>

            <div>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={trimSilence}
                  onChange={(e) => setTrimSilence(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Trim silence
                </span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Side Panel - Live Transcriptions */}
      {(isRecording || chunks.length > 0) && (
        <div className="w-80 border-l bg-gray-50 p-4 max-h-[600px] overflow-y-auto">
          {/* AI Assistant Panel */}
          {isRecording && (
            <div className="mb-4">
              <AIAssistant
                suggestions={aiSuggestions}
                isLoading={aiLoading}
                error={aiError}
                onDismiss={() => setAiSuggestions([])}
                className="shadow-sm border border-gray-200"
              />
            </div>
          )}

          <h3 className="font-semibold text-gray-800 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Live Transcriptions
          </h3>

          {chunks.length === 0 ? (
            <p className="text-sm text-gray-500 italic">
              Transcriptions will appear here as chunks complete...
            </p>
          ) : (
            <div className="space-y-3">
              {chunks
                .sort((a, b) => (b.chunk_index ?? 0) - (a.chunk_index ?? 0))
                .map((chunk, index) => (
                  <div
                    key={chunk.id || index}
                    className="bg-white rounded-lg p-3 shadow-sm border"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-500">
                        Part {(chunk.chunk_index ?? index) + 1}
                      </span>
                      <div className="flex items-center space-x-1">
                        {getStatusIcon(chunk.status)}
                        <span className="text-xs text-gray-400">
                          {chunk.status}
                        </span>
                      </div>
                    </div>

                    {chunk.status === 'completed' && chunk.transcript_text ? (
                      <p className="text-sm text-gray-700 line-clamp-4">
                        {chunk.transcript_text}
                      </p>
                    ) : chunk.status === 'processing' ? (
                      <p className="text-sm text-gray-400 italic">
                        Transcribing...
                      </p>
                    ) : chunk.status === 'failed' ? (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-red-500 flex-1">
                          {chunk.error_message || 'Transcription failed'}
                        </p>
                        <button
                          onClick={() => handleRetryChunk(chunk.id)}
                          disabled={retryingChunks[chunk.id]}
                          className="ml-2 px-2 py-1 text-xs text-orange-600 hover:text-orange-800 border border-orange-400 rounded hover:bg-orange-50 disabled:opacity-50"
                        >
                          {retryingChunks[chunk.id] ? 'Retrying...' : 'Retry'}
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 italic">
                        Waiting to process...
                      </p>
                    )}
                  </div>
                ))}
            </div>
          )}

          {/* Combined Transcript Preview */}
          {chunks.some(c => c.status === 'completed' && c.transcript_text) && (
            <div className="mt-4 pt-4 border-t">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Combined Transcript
              </h4>
              <div className="bg-white rounded-lg p-3 shadow-sm border max-h-40 overflow-y-auto">
                <p className="text-sm text-gray-700">
                  {chunks
                    .filter(c => c.status === 'completed' && c.transcript_text)
                    .sort((a, b) => (a.chunk_index ?? 0) - (b.chunk_index ?? 0))
                    .map(c => c.transcript_text)
                    .join(' ')}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ConversationRecorder
