import { useState, useRef, useEffect } from 'react'
import { transcriptionApi } from '../services/api'

function AudioRecorder({ onRecordingComplete }) {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [language, setLanguage] = useState('auto')
  const [trimSilence, setTrimSilence] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState(null)
  const [permissionDenied, setPermissionDenied] = useState(false)

  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const timerRef = useRef(null)
  const audioRef = useRef(null)
  const streamRef = useRef(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [audioUrl])

  const startRecording = async () => {
    console.log('startRecording called')
    setError(null)
    setPermissionDenied(false)
    audioChunksRef.current = []

    // Check browser support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Your browser does not support audio recording. Please use a modern browser like Chrome, Firefox, or Safari.')
      return
    }

    // Check if we're in a secure context
    if (!window.isSecureContext) {
      setError('Audio recording requires a secure connection (HTTPS or localhost).')
      return
    }

    try {
      console.log('Requesting microphone access...')
      
      // First check permission status if available
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'microphone' })
          console.log('Microphone permission status:', permissionStatus.state)
        } catch (e) {
          console.log('Permission query not supported')
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true  // Simplified audio constraints
      })
      console.log('Microphone access granted')
      streamRef.current = stream

      // Determine best supported format
      let mimeType = 'audio/webm'
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus'
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm'
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4'
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg'
      }
      console.log('Using mimeType:', mimeType)

      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error)
        setError(`Recording error: ${event.error?.message || 'Unknown error'}`)
      }

      mediaRecorder.ondataavailable = (event) => {
        console.log('Data available:', event.data.size, 'bytes')
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        console.log('Recording stopped, chunks:', audioChunksRef.current.length)
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        setAudioBlob(blob)
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start(1000) // Collect data every second
      console.log('MediaRecorder started, state:', mediaRecorder.state)
      setIsRecording(true)
      setIsPaused(false)
      setRecordingTime(0)

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)

    } catch (err) {
      console.error('Error accessing microphone:', err)
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionDenied(true)
        setError('Microphone access denied. Please allow microphone access in your browser settings.')
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone and try again.')
      } else {
        setError(`Could not access microphone: ${err.message}`)
      }
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsPaused(false)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume()
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1)
        }, 1000)
      } else {
        mediaRecorderRef.current.pause()
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
      }
      setIsPaused(!isPaused)
    }
  }

  const discardRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
    }
    setAudioBlob(null)
    setAudioUrl(null)
    setRecordingTime(0)
    setIsPlaying(false)
  }

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleTranscribe = async () => {
    if (!audioBlob) return

    setIsUploading(true)
    setError(null)

    try {
      // Create a file from the blob
      const extension = audioBlob.type.includes('webm') ? 'webm' : 'm4a'
      const filename = `recording_${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`
      const file = new File([audioBlob], filename, { type: audioBlob.type })

      const result = await transcriptionApi.upload(file, language, trimSilence)
      
      // Clear the recording
      discardRecording()
      
      if (onRecordingComplete) {
        onRecordingComplete(result)
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to upload recording. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="p-6">
      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Permission Denied Help */}
      {permissionDenied && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-yellow-800 text-sm">
            <strong>To enable microphone access:</strong>
          </p>
          <ul className="text-yellow-700 text-sm mt-2 list-disc list-inside">
            <li>Click the lock/info icon in your browser's address bar</li>
            <li>Find "Microphone" permissions</li>
            <li>Change to "Allow"</li>
            <li>Refresh the page</li>
          </ul>
        </div>
      )}

      {/* Recording State */}
      {!audioBlob ? (
        <div className="text-center py-8">
          {/* Recording Visualizer */}
          <div className="mb-6">
            <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center transition-all duration-300 ${
              isRecording 
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
                      className={`w-1 bg-red-500 rounded-full transition-all duration-150 ${
                        isPaused ? 'h-4' : 'animate-pulse'
                      }`}
                      style={{
                        height: isPaused ? '16px' : `${Math.random() * 24 + 8}px`,
                        animationDelay: `${i * 0.1}s`
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
          </div>

          {/* Timer */}
          <div className={`text-3xl font-mono mb-6 ${isRecording ? 'text-red-600' : 'text-gray-400'}`}>
            {formatTime(recordingTime)}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center space-x-4">
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="w-16 h-16 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-lg"
                title="Start Recording"
              >
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="6" />
                </svg>
              </button>
            ) : (
              <>
                {/* Pause/Resume Button */}
                <button
                  onClick={pauseRecording}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors shadow ${
                    isPaused 
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

                {/* Stop Button */}
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

          {isRecording && (
            <p className="mt-4 text-sm text-gray-500">
              {isPaused ? 'Recording paused' : 'Recording in progress...'}
            </p>
          )}
        </div>
      ) : (
        /* Review Recording State */
        <div className="py-4">
          {/* Audio Element (hidden) */}
          <audio 
            ref={audioRef} 
            src={audioUrl} 
            onEnded={() => setIsPlaying(false)}
          />

          {/* Playback UI */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={togglePlayback}
                className="w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center transition-colors"
              >
                {isPlaying ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              <div className="flex-1">
                <p className="font-medium text-gray-800">Recording Preview</p>
                <p className="text-sm text-gray-500">Duration: {formatTime(recordingTime)}</p>
              </div>
            </div>
          </div>

          {/* Language Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Language
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

          {/* Trim Silence Option */}
          <div className="mb-4">
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
              <span className="text-xs text-gray-500">
                (removes silent parts)
              </span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={discardRecording}
              disabled={isUploading}
              className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Discard
            </button>
            <button
              onClick={handleTranscribe}
              disabled={isUploading}
              className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isUploading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Uploading...
                </span>
              ) : (
                'Transcribe'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Help Text */}
      {!isRecording && !audioBlob && (
        <p className="text-center text-sm text-gray-500 mt-4">
          Click the red button to start recording from your microphone
        </p>
      )}
    </div>
  )
}

export default AudioRecorder
