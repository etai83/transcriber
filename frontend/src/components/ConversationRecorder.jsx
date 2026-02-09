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
  const [allSuggestions, setAllSuggestions] = useState([]) // Accumulated suggestions across all chunks
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [aiEnabled, setAiEnabled] = useState(true)
  const [lastProcessedChunkId, setLastProcessedChunkId] = useState(null)

  // Conversation metadata state
  const [conversationTitle, setConversationTitle] = useState(null)
  const [conversationDescription, setConversationDescription] = useState(null)
  const [metadataGenerating, setMetadataGenerating] = useState(false)
  const [backgroundContext, setBackgroundContext] = useState('')

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
          const newSuggestions = result.suggestions || []
          setAiSuggestions(newSuggestions)
          // Add to accumulated suggestions with chunk info
          if (newSuggestions.length > 0) {
            setAllSuggestions(prev => [...prev, {
              chunkIndex: latestCompleted.chunk_index,
              chunkId: latestCompleted.id,
              model: result.model,
              provider: result.provider,
              suggestions: newSuggestions,
              timestamp: new Date().toISOString()
            }])
          }
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

  // Poll for metadata updates after recording ends
  useEffect(() => {
    if (!conversationId || isRecording || !aiEnabled) return

    // Only poll if we don't have metadata yet
    if (conversationTitle && conversationDescription) return

    setMetadataGenerating(true)
    let pollCount = 0
    const maxPolls = 10 // Poll for up to 30 seconds (10 * 3s)

    const pollInterval = setInterval(async () => {
      try {
        const conversation = await conversationApi.get(conversationId)

        // Update title and description if they've been generated
        if (conversation.title && !conversation.title.startsWith('Conversation 20')) {
          setConversationTitle(conversation.title)
        }
        if (conversation.description) {
          setConversationDescription(conversation.description)
        }

        // Stop polling if we have both or reached max polls
        pollCount++
        if ((conversation.title && conversation.description) || pollCount >= maxPolls) {
          setMetadataGenerating(false)
          clearInterval(pollInterval)
        }
      } catch (err) {
        console.error('Error polling for metadata:', err)
        setMetadataGenerating(false)
        clearInterval(pollInterval)
      }
    }, 3000)

    return () => {
      clearInterval(pollInterval)
      setMetadataGenerating(false)
    }
  }, [conversationId, isRecording, conversationTitle, conversationDescription, aiEnabled])

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
        num_speakers: numSpeakers,
        background_context: backgroundContext
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
    // Reset AI state
    setAiSuggestions([])
    setAllSuggestions([])
    setLastProcessedChunkId(null)
    setAiError(null)
    // Reset metadata state
    setConversationTitle(null)
    setConversationDescription(null)
    setMetadataGenerating(false)
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
      <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
        {/* LEFT MAIN PANEL: Controls & Transcript */}
        <div className="w-full lg:w-1/3 flex flex-col gap-4 min-w-0">

          {/* Error Messages */}
          {error && (
            <div className="mb-2 p-3 bg-red-900/30 border border-red-500/30 rounded-xl text-red-400 text-sm w-full flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">error</span>
              {error}
            </div>
          )}

          {permissionDenied && (
            <div className="mb-2 p-4 bg-amber-900/20 border border-amber-500/20 rounded-xl w-full">
              <p className="text-amber-400 text-sm font-medium flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">lock</span>
                To enable microphone access:
              </p>
              <ul className="text-amber-400/80 text-sm mt-2 list-disc list-inside ml-1">
                <li>Click the lock icon in your browser's address bar</li>
                <li>Allow microphone permissions</li>
                <li>Refresh the page</li>
              </ul>
            </div>
          )}

          {/* Settings Input - Compact Mode */}
          {!isRecording && !conversationId && (
            <div className="mb-4 space-y-3 p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Conversation Context (Optional)
                </label>
                <textarea
                  value={backgroundContext}
                  onChange={(e) => setBackgroundContext(e.target.value)}
                  placeholder="E.g., 'Medical consultation with patient claiming lower back pain', 'Job interview for Senior Dev position', 'Brainstorming session for Q3 marketing'"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none h-20 placeholder:text-slate-600"
                />
              </div>
            </div>
          )}

          {/* Control Panel (Visualizer, Timer, Buttons) */}
          <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-700/50 shadow-sm relative overflow-hidden backdrop-blur-sm">
            {/* Background Glows */}
            {isRecording && !isPaused && (
              <>
                <div className="absolute top-0 left-1/4 w-32 h-32 bg-primary/20 rounded-full blur-[64px] pointer-events-none"></div>
                <div className="absolute bottom-0 right-1/4 w-32 h-32 bg-purple-500/20 rounded-full blur-[64px] pointer-events-none"></div>
              </>
            )}

            <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
              {/* Visualizer & Timer */}
              <div className="flex items-center gap-4">
                <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${isRecording
                  ? isPaused ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'
                  : 'bg-slate-800 text-slate-400'
                  }`}>
                  {isRecording && !isPaused && (
                    <div className="absolute inset-0 rounded-xl border border-red-500/20 animate-ping"></div>
                  )}
                  <span className="material-symbols-outlined text-2xl">
                    {isRecording ? 'mic' : 'mic_none'}
                  </span>
                </div>

                <div>
                  <div className={`text-xl font-mono font-bold tracking-tight ${isRecording ? 'text-white' : 'text-slate-500'}`}>
                    {formatTime(recordingTime)}
                  </div>
                  {isRecording && (
                    <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
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
                        className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-blue-600 transition-colors shadow-lg shadow-primary/20 flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-base">visibility</span>
                        View
                      </button>
                      <button
                        onClick={startNewRecording}
                        className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-700 transition-colors border border-slate-700 flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-base">add</span>
                        New
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={startRecording}
                      className="group relative flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all shadow-lg shadow-red-500/30 overflow-hidden"
                      title="Start Recording"
                    >
                      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                      <span className="material-symbols-outlined text-xl">mic</span>
                      <span className="text-sm font-bold">Start Recording</span>
                    </button>
                  )
                ) : (
                  <>
                    <button
                      onClick={pauseRecording}
                      className={`p-2.5 rounded-xl flex items-center justify-center transition-colors shadow-lg ${isPaused
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20'
                        : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                        }`}
                      title={isPaused ? 'Resume' : 'Pause'}
                    >
                      <span className="material-symbols-outlined text-xl fill-current">
                        {isPaused ? 'play_arrow' : 'pause'}
                      </span>
                    </button>

                    <button
                      onClick={stopRecording}
                      className="p-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl flex items-center justify-center transition-colors shadow-lg border border-slate-600"
                      title="Stop Recording"
                    >
                      <span className="material-symbols-outlined text-xl fill-current">stop</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Chunk Progress Bar inside control panel */}
            {isRecording && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800">
                <div
                  className="bg-primary h-full transition-all duration-1000 ease-linear shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                  style={{ width: `${(chunkTime / chunkInterval) * 100}%` }}
                />
              </div>
            )}
          </div>

          {/* AI Assistant suggestions moved to right panel */}

          {/* Auto-generated Metadata Display */}
          {!isRecording && conversationId && (conversationTitle || conversationDescription || metadataGenerating) && (
            <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/50 animate-slide-up relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 blur-[40px] rounded-full pointer-events-none"></div>
              <div className="flex items-start gap-4 relative z-10">
                <div className={`p-2 rounded-lg ${metadataGenerating ? 'bg-primary/10 text-primary' : 'bg-emerald-500/10 text-emerald-500'}`}>
                  <span className="material-symbols-outlined text-xl">
                    {metadataGenerating ? 'auto_awesome' : 'check_circle'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  {metadataGenerating ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-200">Analyzing conversation...</span>
                        <span className="flex gap-1">
                          <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                          <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                          <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce"></span>
                        </span>
                      </div>
                      <div className="space-y-2 opacity-50">
                        <div className="h-3 bg-slate-700 rounded w-3/4"></div>
                        <div className="h-2 bg-slate-700 rounded w-full"></div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {conversationTitle && (
                        <h3 className="text-base font-bold text-white leading-tight">{conversationTitle}</h3>
                      )}
                      {conversationDescription && (
                        <p className="text-sm text-slate-400 leading-relaxed">{conversationDescription}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Live Transcript Display (Full Width) */}
          {(isRecording || chunks.length > 0) && (
            <div className="bg-slate-900/50 rounded-xl border border-slate-700/50 overflow-hidden flex flex-col min-h-[400px] shadow-sm flex-1">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-slate-800/30">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">subtitles</span>
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Live Transcript</span>
                </div>
                <div className="flex items-center gap-3">
                  {processingChunks.length > 0 && (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 rounded-md border border-amber-500/10">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                      <span className="text-[10px] text-amber-500 font-bold">Processing</span>
                    </div>
                  )}
                  {uploadQueue.length > 0 && (
                    <span className="text-[10px] text-slate-500 font-medium">
                      {uploadQueue.length} queued
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 max-h-[600px] overflow-y-auto p-4 space-y-4 scroll-smooth">
                {completedChunks.length === 0 && processingChunks.length === 0 && !isRecording && (
                  <div className="flex flex-col items-center justify-center py-10 opacity-50">
                    <span className="material-symbols-outlined text-4xl text-slate-600 mb-2">text_fields</span>
                    <p className="text-slate-500 text-sm">Transcript will appear here</p>
                  </div>
                )}

                {completedChunks.length === 0 && (isRecording || processingChunks.length > 0) && (
                  <div className="flex items-center justify-center gap-3 py-8 text-slate-400">
                    <span className="material-symbols-outlined animate-spin text-xl">sync</span>
                    <span className="text-sm">Listening and transcribing...</span>
                  </div>
                )}

                {completedChunks.map((chunk, idx) => {
                  const isHebrew = chunk.transcript_text?.match(/[\u0590-\u05FF]/)
                  const isSpeakerA = idx % 2 === 0

                  return (
                    <div
                      key={chunk.id}
                      className={`relative group ${isHebrew ? 'text-right' : 'text-left'}`}
                      dir={isHebrew ? 'rtl' : 'ltr'}
                    >
                      <div className={`absolute top-0 bottom-0 w-1 rounded-full ${isHebrew ? 'right-0' : 'left-0'} ${isSpeakerA ? 'bg-blue-500' : 'bg-purple-500'}`}></div>
                      <div className={`${isHebrew ? 'mr-4' : 'ml-4'}`}>
                        <div className="flex items-center gap-2 mb-1 px-1">
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${isSpeakerA ? 'text-blue-400' : 'text-purple-400'}`}>
                            {isSpeakerA ? 'Speaker 1' : 'Speaker 2'}
                          </span>
                          <span className="text-[10px] text-slate-600 font-mono">#{chunk.chunk_index + 1}</span>
                        </div>
                        <p className="text-[15px] text-slate-200 leading-relaxed font-body">{chunk.transcript_text}</p>
                      </div>
                    </div>
                  )
                })}

                {processingChunks.map((chunk) => (
                  <div key={chunk.id} className="flex items-center gap-3 py-2 pl-4 border-l-2 border-slate-700 opacity-50">
                    <span className="material-symbols-outlined text-sm animate-spin text-slate-400">progress_activity</span>
                    <span className="text-xs text-slate-400 italic">Processing chunk {chunk.chunk_index + 1}...</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Privacy Indicator */}
          <div className="flex items-center justify-center gap-2 py-1 opacity-50 hover:opacity-100 transition-opacity">
            <span className="material-symbols-outlined text-slate-400 text-xs">shield_lock</span>
            <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wider">Secure Local Processing (Device Only)</p>
          </div>
        </div>

        {/* RIGHT SIDEBAR PANEL: AI Suggestions History */}
        <div className={`w-full lg:w-2/3 shrink-0 flex flex-col transition-all duration-500 ${isRecording || chunks.length > 0 || allSuggestions.length > 0 ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10 hidden lg:flex'}`}>
          {(isRecording || chunks.length > 0 || allSuggestions.length > 0) && (
            <div className="sticky top-4 flex flex-col gap-4">
              <div className="bg-slate-900/50 rounded-2xl border border-slate-700/50 overflow-hidden flex flex-col shadow-sm max-h-[calc(100vh-120px)] backdrop-blur-sm">
                {/* Header */}
                <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-800/50 backdrop-blur-md sticky top-0 z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-violet-500/10 rounded-lg">
                        <span className="material-symbols-outlined text-violet-400 text-sm">psychology</span>
                      </div>
                      <span className="text-xs font-bold text-violet-300 uppercase tracking-wide">
                        AI Insights
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                      {allSuggestions.length}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="overflow-y-auto p-3 space-y-3 flex-1 min-h-[200px] scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                  {allSuggestions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-center text-slate-500 px-4">
                      <div className="w-12 h-12 rounded-full bg-slate-800/50 flex items-center justify-center mb-3">
                        <span className="material-symbols-outlined text-2xl opacity-50">lightbulb</span>
                      </div>
                      <p className="text-xs font-medium text-slate-400">Listening for insights...</p>
                      <p className="text-[10px] text-slate-600 mt-1 max-w-[200px]">AI will analyze the conversation and provide suggestions here.</p>
                    </div>
                  ) : (
                    allSuggestions.map((item, groupIdx) => (
                      <div key={groupIdx} className="bg-white/5 rounded-xl p-3 border border-white/5 hover:border-violet-500/30 transition-colors animate-slide-up group">
                        <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/5">
                          <span className="text-[10px] font-bold text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded-full">
                            Chunk {item.chunkIndex + 1}
                          </span>
                          {item.model && (
                            <span className="text-[9px] text-slate-500 font-mono">
                              {item.model.split('/').pop()}
                            </span>
                          )}
                        </div>
                        <div className="space-y-2.5">
                          {item.suggestions.map((suggestion, idx) => (
                            <div key={idx} className="flex gap-3">
                              <div className="shrink-0 mt-0.5 bg-slate-800 rounded-lg w-8 h-8 flex items-center justify-center">
                                <span className="text-sm">
                                  {suggestion.type === 'clarification' ? '🤔' :
                                    suggestion.type === 'follow_up' ? '💬' : '💡'}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-200 leading-snug mb-1 group-hover:text-primary transition-colors">{suggestion.title}</p>
                                <p className="text-sm text-slate-400 leading-relaxed font-medium">{suggestion.message}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Tip Card */}
              <div className="bg-gradient-to-br from-violet-600/20 to-indigo-600/20 rounded-xl p-4 border border-violet-500/20 flex gap-3 items-start">
                <span className="material-symbols-outlined text-violet-400 text-lg mt-0.5">auto_awesome</span>
                <div>
                  <p className="text-xs font-bold text-violet-300 mb-0.5">Pro Tip</p>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Pause the recording to let the AI process the context more deeply without new audio interruption.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Full version for standalone use
  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* Main Recording Panel */}
      <div className="flex-1 p-6 flex flex-col min-h-0 bg-surface-light dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
        {/* Error Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-md text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">error</span>
            {error}
          </div>
        )}

        {permissionDenied && (
          <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-500/30 rounded-md">
            <p className="text-yellow-800 dark:text-yellow-400 text-sm font-medium flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">lock</span>
              To enable microphone access:
            </p>
            <ul className="text-yellow-700 dark:text-yellow-300 text-sm mt-2 list-disc list-inside ml-1 space-y-1">
              <li>Click the lock icon in your browser's address bar</li>
              <li>Allow microphone permissions</li>
              <li>Refresh the page</li>
            </ul>
          </div>
        )}

        {/* Recording Controls */}
        <div className="text-center py-8 flex-1 flex flex-col justify-center">
          {/* Recording Visualizer */}
          <div className="mb-8">
            <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center transition-all duration-300 relative ${isRecording
              ? isPaused
                ? 'bg-yellow-100 dark:bg-yellow-900/30'
                : 'bg-red-100 dark:bg-red-900/20'
              : 'bg-gray-100 dark:bg-gray-800'
              }`}>

              {/* Ripple Effect when recording */}
              {isRecording && !isPaused && (
                <>
                  <div className="absolute inset-0 rounded-full border border-red-500/30 animate-ping"></div>
                  <div className="absolute -inset-4 rounded-full border border-red-500/10 animate-pulse"></div>
                </>
              )}

              {isRecording ? (
                <div className="flex items-center justify-center gap-1 h-12">
                  {/* Audio Visualizer Bars */}
                  {[...Array(7)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-1.5 rounded-full transition-all duration-75 ${isPaused ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{
                        height: isPaused ? '8px' : `${Math.max(8, Math.min(48, (audioLevel / 100) * 48 * (1 + Math.random())))}px`,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <span className="material-symbols-outlined text-5xl text-gray-400 dark:text-gray-600">mic</span>
              )}
            </div>

            {/* Audio Level Meter */}
            {isRecording && (
              <div className="mt-6 max-w-xs mx-auto">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium tracking-wide uppercase">
                  <span>Mic Level</span>
                  <span className={audioLevel < 10 ? 'text-red-500' : audioLevel < 30 ? 'text-yellow-500' : 'text-green-500'}>
                    {audioLevel < 10 ? 'Too quiet!' : audioLevel < 30 ? 'Low' : 'Good'}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-100 ${audioLevel < 10 ? 'bg-red-500' : audioLevel < 30 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                    style={{ width: `${Math.min(100, audioLevel * 1.5)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Timers */}
          <div className="mb-10">
            <div className={`text-6xl font-mono font-medium tracking-tighter ${isRecording ? 'text-red-500 dark:text-red-400' : 'text-gray-300 dark:text-gray-600'}`}>
              {formatTime(recordingTime)}
            </div>
            {isRecording && (
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-3 font-medium bg-gray-100 dark:bg-gray-800/50 inline-block px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700">
                Chunk {chunkIndex + 1}: {formatTime(chunkTime)} / {formatTime(chunkInterval)}
              </div>
            )}
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-center gap-6">
            {!isRecording ? (
              conversationId ? (
                // Post-recording buttons
                <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                  <button
                    onClick={viewConversation}
                    className="flex items-center justify-center gap-2 px-8 py-4 bg-primary text-white rounded-2xl hover:bg-blue-600 transition-all shadow-lg hover:shadow-primary/30 active:scale-95 font-bold text-lg"
                  >
                    <span className="material-symbols-outlined">visibility</span>
                    View Transcript
                  </button>
                  <button
                    onClick={startNewRecording}
                    className="flex items-center justify-center gap-2 px-8 py-4 bg-surface-light dark:bg-surface-dark border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all font-bold text-lg hover:border-slate-300 dark:hover:border-slate-600"
                  >
                    <span className="material-symbols-outlined">add</span>
                    New Recording
                  </button>
                </div>
              ) : (
                // Start recording button
                <button
                  onClick={startRecording}
                  className="group relative w-20 h-20 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all shadow-xl hover:shadow-red-500/40 hover:scale-105 active:scale-95"
                  title="Start Recording"
                >
                  <div className="absolute inset-0 rounded-full border-2 border-white/20"></div>
                  <span className="material-symbols-outlined text-4xl fill-current group-hover:scale-110 transition-transform">mic</span>
                </button>
              )
            ) : (
              <>
                <button
                  onClick={pauseRecording}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg active:scale-95 ${isPaused
                    ? 'bg-green-500 hover:bg-green-600 text-white shadow-green-500/30'
                    : 'bg-yellow-500 hover:bg-yellow-600 text-white shadow-yellow-500/30'
                    }`}
                  title={isPaused ? 'Resume' : 'Pause'}
                >
                  <span className="material-symbols-outlined text-2xl fill-current">
                    {isPaused ? 'play_arrow' : 'pause'}
                  </span>
                </button>

                <button
                  onClick={stopRecording}
                  className="w-20 h-20 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white rounded-full flex items-center justify-center transition-all shadow-xl hover:shadow-slate-900/30 hover:scale-105 active:scale-95"
                  title="Stop Recording"
                >
                  <span className="material-symbols-outlined text-4xl fill-current">stop</span>
                </button>
              </>
            )}
          </div>

          {/* Status Text */}
          {isRecording && (
            <p className="mt-6 text-sm font-medium text-slate-500 dark:text-slate-400 animate-pulse">
              {isPaused ? 'Recording paused' : `Processing audio chunks every ${chunkInterval}s...`}
            </p>
          )}
        </div>

        {/* Settings (only show before recording) */}
        {!isRecording && !conversationId && (
          <div className="border-t border-gray-200 dark:border-gray-800 pt-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Conversation Context (Optional)
                </label>
                <textarea
                  value={backgroundContext}
                  onChange={(e) => setBackgroundContext(e.target.value)}
                  placeholder="E.g., 'Medical consultation with patient claiming lower back pain', 'Job interview for Senior Dev position', 'Brainstorming session for Q3 marketing'"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-gray-900 dark:text-white resize-none h-24"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Microphone Input
                </label>
                <div className="relative">
                  <select
                    value={selectedMicId}
                    onChange={(e) => setSelectedMicId(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-gray-900 dark:text-white appearance-none"
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
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[20px]">mic</span>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-[20px] pointer-events-none">expand_more</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Configuration
                </label>
                <div className="flex gap-3">
                  <select
                    value={chunkInterval}
                    onChange={(e) => setChunkInterval(Number(e.target.value))}
                    className="flex-1 px-3 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-gray-900 dark:text-white appearance-none"
                  >
                    <option value={15}>15s (Fast)</option>
                    <option value={30}>30s (Balanced)</option>
                    <option value={60}>60s (Efficient)</option>
                  </select>

                  <div className="flex items-center px-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={trimSilence}
                        onChange={(e) => setTrimSilence(e.target.checked)}
                        className="accent-primary w-4 h-4 rounded text-primary focus:ring-primary"
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Trim Silence</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Side Panel - Live Transcriptions & AI */}
      {(isRecording || chunks.length > 0) && (
        <div className="w-full lg:w-96 flex flex-col min-h-0 gap-4">
          {/* AI Suggestions Panel */}
          <div className="flex-1 bg-violet-50/50 dark:bg-violet-900/10 rounded-2xl border border-violet-200 dark:border-violet-500/20 overflow-hidden flex flex-col shadow-sm">
            <div className="px-4 py-3 border-b border-violet-200 dark:border-violet-500/20 bg-violet-50 dark:bg-violet-900/20 flex items-center gap-2">
              <span className="material-symbols-outlined text-violet-500 dark:text-violet-400">psychology</span>
              <h3 className="font-bold text-violet-700 dark:text-violet-300 text-sm uppercase tracking-wide">
                AI Insights {allSuggestions.length > 0 && `(${allSuggestions.length})`}
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Latest suggestion indicator */}
              {aiLoading && (
                <div className="flex items-center gap-3 p-3 bg-white dark:bg-surface-dark rounded-xl border border-violet-100 dark:border-violet-500/10 shadow-sm animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                    <span className="material-symbols-outlined text-violet-500 text-sm animate-spin">sync</span>
                  </div>
                  <div className="h-2 w-24 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                </div>
              )}

              {allSuggestions.length === 0 && !aiLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-60">
                  <span className="material-symbols-outlined text-4xl text-violet-300 mb-2">lightbulb</span>
                  <p className="text-sm text-violet-400 dark:text-violet-300 font-medium">Listening for insights...</p>
                  <p className="text-xs text-slate-400 mt-1">Suggestions appear as you speak</p>
                </div>
              ) : (
                allSuggestions.map((item, groupIdx) => (
                  <div key={groupIdx} className="bg-white dark:bg-surface-dark rounded-xl p-3 border border-violet-100 dark:border-violet-500/10 shadow-sm animate-slide-up">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-violet-500 bg-violet-50 dark:bg-violet-900/20 px-2 py-0.5 rounded-full">
                        Chunk {item.chunkIndex + 1}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {item.suggestions.map((suggestion, idx) => (
                        <div key={idx} className="flex gap-2">
                          <span className="mt-0.5 text-base">
                            {suggestion.type === 'clarification' ? '🤔' :
                              suggestion.type === 'follow_up' ? '💬' : '💡'}
                          </span>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{suggestion.title}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">{suggestion.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Live Transcription Logic - Consolidated */}
          <div className="flex-1 bg-surface-light dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col shadow-sm max-h-[40%]">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">subtitles</span>
                <h3 className="font-bold text-gray-700 dark:text-gray-300 text-sm uppercase tracking-wide">
                  Live Transcript
                </h3>
              </div>
              {chunks.length > 0 && (
                <span className="text-[10px] font-mono bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
                  {chunks.length} chunks
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chunks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
                  <p className="text-sm text-gray-400">Waiting for speech...</p>
                </div>
              ) : (
                chunks
                  .sort((a, b) => (b.chunk_index ?? 0) - (a.chunk_index ?? 0))
                  .map((chunk, index) => (
                    <div key={chunk.id || index} className="text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono text-gray-400">#{(chunk.chunk_index ?? index) + 1}</span>
                        {getStatusIcon(chunk.status)}
                      </div>

                      {chunk.status === 'completed' ? (
                        <p className="text-gray-700 dark:text-gray-200 leading-relaxed pl-4 border-l-2 border-primary/20">
                          {chunk.transcript_text}
                        </p>
                      ) : (
                        <p className="text-gray-400 dark:text-gray-500 italic text-xs pl-4 border-l-2 border-transparent">
                          {chunk.status === 'processing' ? 'Transcribing...' : 'Waiting...'}
                        </p>
                      )}
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ConversationRecorder
