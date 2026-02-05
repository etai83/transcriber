import { useState, useRef } from 'react'
import { conversationApi } from '../services/api'

function AudioUploader({ onUploadSuccess }) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [language, setLanguage] = useState('auto')
  const [trimSilence, setTrimSilence] = useState(false)
  const [enableDiarization, setEnableDiarization] = useState(true)
  const [numSpeakers, setNumSpeakers] = useState(2)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const supportedFormats = ['.mp3', '.wav', '.m4a', '.flac', '.ogg', '.webm', '.mp4']

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleFileSelect = (file) => {
    setError(null)
    const ext = '.' + file.name.split('.').pop().toLowerCase()
    if (!supportedFormats.includes(ext)) {
      setError(`Unsupported format. Supported: ${supportedFormats.join(', ')}`)
      return
    }
    setSelectedFile(file)
  }

  const handleInputChange = (e) => {
    if (e.target.files.length > 0) {
      handleFileSelect(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    setError(null)

    try {
      // Create a conversation for this upload
      const conversation = await conversationApi.create({
        title: selectedFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
        language,
        trim_silence: trimSilence,
        chunk_interval_sec: 0,
        num_speakers: enableDiarization ? numSpeakers : null
      })

      // Add the file as a single chunk
      await conversationApi.addChunk(conversation.id, selectedFile, 0)
      
      // Mark as complete
      await conversationApi.complete(conversation.id)

      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      if (onUploadSuccess) {
        onUploadSuccess(conversation)
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="p-6">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={supportedFormats.join(',')}
          onChange={handleInputChange}
          className="hidden"
        />
        <svg
          className="w-12 h-12 mx-auto text-gray-400 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <p className="text-gray-600 mb-2">
          Drag and drop your audio file here, or click to browse
        </p>
        <p className="text-gray-400 text-sm">
          Supported: {supportedFormats.join(', ')}
        </p>
      </div>

      {/* Selected File */}
      {selectedFile && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <svg
              className="w-8 h-8 text-blue-500"
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
            <div>
              <p className="font-medium text-gray-800">{selectedFile.name}</p>
              <p className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setSelectedFile(null)
            }}
            className="text-gray-400 hover:text-red-500"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Language Selection */}
      <div className="mt-4">
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
      <div className="mt-4">
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
            (removes silent parts from audio)
          </span>
        </label>
      </div>

      {/* Speaker Diarization Option */}
      <div className="mt-4">
        <label className="flex items-center space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={enableDiarization}
            onChange={(e) => setEnableDiarization(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">
            Speaker diarization
          </span>
          <span className="text-xs text-gray-500">
            (detect who spoke when)
          </span>
        </label>
        
        {enableDiarization && (
          <div className="mt-2 ml-7">
            <label className="block text-sm text-gray-600 mb-1">
              Number of speakers
            </label>
            <select
              value={numSpeakers}
              onChange={(e) => setNumSpeakers(parseInt(e.target.value))}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                <option key={n} value={n}>{n} speaker{n > 1 ? 's' : ''}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Upload Button */}
      <button
        onClick={handleUpload}
        disabled={!selectedFile || isUploading}
        className={`mt-4 w-full py-3 px-4 rounded-md font-medium transition-colors ${
          selectedFile && !isUploading
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
      >
        {isUploading ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Uploading...
          </span>
        ) : (
          'Upload & Transcribe'
        )}
      </button>
    </div>
  )
}

export default AudioUploader
