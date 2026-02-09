import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ConversationRecorder from '../components/ConversationRecorder'

import { conversationApi, transcriptionApi } from '../services/api'
import ConfirmDialog from '../components/ConfirmDialog'

function Dashboard({ onMenuClick, showFilesOnly = false }) {
    const navigate = useNavigate()
    const [recordings, setRecordings] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [activeMode, setActiveMode] = useState(showFilesOnly ? 'files' : 'upload') // 'upload' or 'record'
    const [isDragging, setIsDragging] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [selectedFile, setSelectedFile] = useState(null)
    const [isRecording, setIsRecording] = useState(false)
    const [menuOpenId, setMenuOpenId] = useState(null)
    const [renamingId, setRenamingId] = useState(null)
    const [renameValue, setRenameValue] = useState('')
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [recordingToDelete, setRecordingToDelete] = useState(null)
    const [filterType, setFilterType] = useState('all') // 'all', 'conversation', 'transcription'
    const fileInputRef = useRef(null)

    // Fetch recordings on mount
    useEffect(() => {
        fetchRecordings()
    }, [])

    const fetchRecordings = async () => {
        try {
            setLoading(true)
            const [conversations, transcriptions] = await Promise.all([
                conversationApi.list().catch(() => []),
                transcriptionApi.list().catch(() => [])
            ])

            const allRecordings = [
                ...conversations.map(c => ({ ...c, type: 'conversation' })),
                ...transcriptions.map(t => ({ ...t, type: 'transcription' }))
            ]

            allRecordings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            setRecordings(allRecordings)
            setError(null)
        } catch (err) {
            setError('Failed to load recordings')
            console.error('Error fetching recordings:', err)
        } finally {
            setLoading(false)
        }
    }

    // Handle file upload
    const handleFileUpload = async () => {
        if (!selectedFile) return

        setUploading(true)
        setUploadProgress(0)

        try {
            setUploadProgress(50)
            await transcriptionApi.upload(selectedFile, 'auto', false)
            await fetchRecordings()
            setUploadProgress(100)

            setTimeout(() => {
                setUploading(false)
                setUploadProgress(0)
                setSelectedFile(null)
            }, 1000)
        } catch (err) {
            console.error('Upload error:', err)
            alert('Failed to upload file. Please try again.')
            setUploading(false)
            setUploadProgress(0)
        }
    }

    const handleFileSelect = (file) => {
        if (!file) return

        const validTypes = ['audio/wav', 'audio/webm', 'audio/x-m4a', 'audio/mp4', 'audio/mpeg', 'audio/mp3']
        const validExtensions = ['.wav', '.webm', '.m4a', '.mp3', '.mp4']
        const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext))

        if (!validTypes.includes(file.type) && !hasValidExtension) {
            alert('Please upload a valid audio file (WAV, WebM, M4A, MP3)')
            return
        }

        setSelectedFile(file)
    }

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
        const file = e.dataTransfer.files[0]
        handleFileSelect(file)
    }

    const handleInputFileSelect = (e) => {
        const file = e.target.files[0]
        handleFileSelect(file)
    }

    const clearSelectedFile = () => {
        setSelectedFile(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }



    // Filter recordings based on search query and type
    const filteredRecordings = recordings.filter(recording => {
        if (!recording) return false

        // Filter by type
        if (filterType !== 'all' && recording.type !== filterType) return false

        if (!searchQuery) return true
        const query = searchQuery.toLowerCase()

        const title = String(recording.title || '').toLowerCase()
        const description = String(recording.description || '').toLowerCase()
        const date = formatDate(recording.created_at).toLowerCase()

        return title.includes(query) || description.includes(query) || date.includes(query)
    })



    const handleRecordingComplete = () => {
        fetchRecordings()
    }

    const handleRecordingStateChange = (recording) => {
        setIsRecording(recording)
    }

    // Menu handlers
    const handleMenuClick = (e, id) => {
        e.preventDefault()
        e.stopPropagation()
        setMenuOpenId(menuOpenId === id ? null : id)
    }

    useEffect(() => {
        const handleClickOutside = (e) => {
            // Don't close if clicking inside a menu or on a button
            if (e.target.closest('.menu-dropdown') || e.target.closest('button')) {
                return
            }
            setMenuOpenId(null)
        }
        window.addEventListener('click', handleClickOutside)
        return () => window.removeEventListener('click', handleClickOutside)
    }, [])

    const handleRenameStart = (e, recording) => {
        e.preventDefault()
        e.stopPropagation()
        setRenamingId(recording.id)
        setRenameValue(recording.title || '')
        setMenuOpenId(null)
    }

    const handleRenameSave = async (e) => {
        e.preventDefault()
        e.stopPropagation()

        if (!renameValue.trim()) return

        try {
            const isConversation = recordings.find(r => r.id === renamingId)?.type === 'conversation'
            const api = isConversation ? conversationApi : transcriptionApi

            await api.update(renamingId, { title: renameValue })

            setRecordings(prev => prev.map(r =>
                r.id === renamingId ? { ...r, title: renameValue } : r
            ))
            setRenamingId(null)
            setRenameValue('')
        } catch (err) {
            console.error('Rename failed:', err)
        }
    }

    const handleRenameCancel = (e) => {
        e.preventDefault()
        e.stopPropagation()
        setRenamingId(null)
        setRenameValue('')
    }

    const handleDelete = (e, recording) => {
        e.preventDefault()
        e.stopPropagation()
        setRecordingToDelete(recording)
        setShowDeleteConfirm(true)
        setMenuOpenId(null)
    }

    const confirmDelete = async () => {
        if (!recordingToDelete) return

        try {
            const api = recordingToDelete.type === 'conversation' ? conversationApi : transcriptionApi
            await api.delete(recordingToDelete.id)
            setRecordings(prev => prev.filter(r => r.id !== recordingToDelete.id))
        } catch (err) {
            console.error('Delete failed:', err)
            alert('Failed to delete recording')
        } finally {
            setShowDeleteConfirm(false)
            setRecordingToDelete(null)
        }
    }

    const getStatusBadge = (status) => {
        switch (status) {
            case 'completed':
                return (
                    <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                        <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-500 text-[14px]">check_circle</span>
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider">Completed</span>
                    </div>
                )
            case 'processing':
            case 'recording':
                return (
                    <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20">
                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                        <span className="text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider">Processing</span>
                    </div>
                )
            case 'failed':
                return (
                    <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20">
                        <span className="material-symbols-outlined text-red-500 text-[14px]">error</span>
                        <span className="text-xs font-bold text-red-500 uppercase tracking-wider">Failed</span>
                    </div>
                )
            default:
                return (
                    <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-gray-500/10 border border-gray-500/20">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{status}</span>
                    </div>
                )
        }
    }

    const formatDuration = (seconds) => {
        if (!seconds) return '--:--'
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    return (
        <>
            {/* Header */}
            <header className="flex items-center justify-between px-4 py-3 bg-background-light dark:bg-background-dark z-20 sticky top-0">
                <button
                    onClick={onMenuClick}
                    className="text-gray-900 dark:text-white p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                >
                    <span className="material-symbols-outlined text-[28px]">menu</span>
                </button>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Dashboard</h1>
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-surface-dark overflow-hidden border border-gray-300 dark:border-gray-700">
                    <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-xl">person</span>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto pb-4 px-4">
                {/* Mode Switcher Cards */}
                <div className="mt-4 mb-4 flex gap-4">
                    <button
                        onClick={() => setActiveMode('record')}
                        className={`flex-1 group relative overflow-hidden rounded-2xl h-16 shadow-sm active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 ${activeMode === 'record'
                            ? 'bg-primary shadow-lg shadow-primary/30'
                            : 'bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-700'
                            }`}
                    >
                        <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity ${activeMode === 'record' ? 'bg-white/10' : 'bg-gray-100 dark:bg-white/5'
                            }`}></div>
                        <span className={`material-symbols-outlined text-[24px] ${activeMode === 'record' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>mic</span>
                        <span className={`text-lg font-bold tracking-wide ${activeMode === 'record' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>Record</span>
                    </button>
                    <button
                        onClick={() => setActiveMode('upload')}
                        className={`flex-1 group relative overflow-hidden rounded-2xl h-16 shadow-sm active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 ${activeMode === 'upload'
                            ? 'bg-primary shadow-lg shadow-primary/30'
                            : 'bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-700'
                            }`}
                    >
                        <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity ${activeMode === 'upload' ? 'bg-white/10' : 'bg-gray-100 dark:bg-white/5'
                            }`}></div>
                        <span className={`material-symbols-outlined text-[24px] ${activeMode === 'upload' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>upload_file</span>
                        <span className={`text-lg font-bold tracking-wide ${activeMode === 'upload' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>Upload</span>
                    </button>
                </div>

                {/* Upload Mode Content */}
                {activeMode === 'upload' && (
                    <div className="mb-6 space-y-3">
                        {/* Upload Zone / File Preview */}
                        {selectedFile ? (
                            <>
                                {/* Selected File Card */}
                                <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-3 border border-gray-200 dark:border-gray-700 flex items-center justify-between shadow-sm">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                            <span className="material-symbols-outlined text-primary text-[24px]">audio_file</span>
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{selectedFile.name}</span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(selectedFile.size)}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={clearSelectedFile}
                                        className="p-2 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                                        disabled={uploading}
                                    >
                                        <span className="material-symbols-outlined text-[20px]">close</span>
                                    </button>
                                </div>

                                {/* Transcribe Button */}
                                <button
                                    onClick={handleFileUpload}
                                    disabled={uploading || isRecording}
                                    className={`w-full bg-primary text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-primary/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${(uploading || isRecording) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'
                                        }`}
                                >
                                    {uploading ? (
                                        <>
                                            <span className="material-symbols-outlined text-[24px] animate-spin">progress_activity</span>
                                            <span className="text-lg tracking-wide">Uploading... {uploadProgress}%</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-[24px]">auto_awesome</span>
                                            <span className="text-lg tracking-wide">Transcribe</span>
                                        </>
                                    )}
                                </button>
                            </>
                        ) : (
                            /* Drag & Drop Zone */
                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`group relative flex flex-col items-center gap-4 rounded-xl border-2 border-dashed px-6 py-10 cursor-pointer transition-colors ${isDragging
                                    ? 'border-primary bg-primary/10'
                                    : 'border-slate-700 bg-surface-dark hover:border-primary/50'
                                    }`}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".wav,.webm,.m4a,.mp3,.mp4,audio/*"
                                    onChange={handleInputFileSelect}
                                    className="hidden"
                                />

                                <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
                                    <span className="material-symbols-outlined text-4xl">cloud_upload</span>
                                </div>

                                <div className="flex flex-col items-center gap-1 text-center">
                                    <p className="text-white text-lg font-bold">Tap to Upload</p>
                                    <p className="text-slate-400 text-xs px-4 leading-relaxed">
                                        Browse or drop files here. Supports MP3, WAV, M4A.
                                        <br />
                                        <span className="text-primary font-medium">English & Hebrew models ready.</span>
                                    </p>
                                </div>

                                <button className="mt-4 flex w-full max-w-[200px] items-center justify-center rounded-lg h-10 bg-primary hover:bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-900/20 transition-all">
                                    Select Audio File
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Record Mode Content */}
                {activeMode === 'record' && (
                    <div className="mb-6 bg-surface-light dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-xl transition-all">
                        {/* Fake Header for "Conversation" feel */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 px-5 py-3 border-b border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`}></span>
                                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-widest">
                                    {isRecording ? 'Live Conversation' : 'Ready to Start'}
                                </h3>
                            </div>
                            {isRecording && (
                                <span className="text-xs font-mono text-primary font-bold animate-pulse">REC</span>
                            )}
                        </div>

                        <div className="p-5">
                            <ConversationRecorder
                                onRecordingComplete={handleRecordingComplete}
                                onRecordingStateChange={handleRecordingStateChange}
                                compact={true}
                            />

                            {/* Embedded AI Assistant removed, now inside ConversationRecorder */}
                        </div>
                    </div>
                )}

                {/* NOTE: AIAssistant is now embedded above within the record block */}

                {/* Search Bar */}
                <div className="mb-6">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="material-symbols-outlined text-gray-500 dark:text-gray-400">search</span>
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search transcriptions..."
                            className="block w-full pl-10 pr-3 py-3.5 border-none rounded-xl bg-surface-light dark:bg-surface-dark text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary shadow-sm text-base transition-all"
                        />
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between mb-1">
                        <h2 className="text-gray-900 dark:text-white text-lg font-bold tracking-tight">Recent Activity</h2>

                        {/* Filter Toggle */}
                        <div className="flex p-1 bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg">
                            <button
                                onClick={() => setFilterType('all')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${filterType === 'all'
                                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                            >
                                All
                            </button>
                            <button
                                onClick={() => setFilterType('conversation')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${filterType === 'conversation'
                                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                            >
                                Conversations
                            </button>
                            <button
                                onClick={() => setFilterType('transcription')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${filterType === 'transcription'
                                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                            >
                                Uploads
                            </button>
                        </div>
                    </div>

                    {/* Loading State */}
                    {loading && (
                        <div className="flex items-center justify-center py-8">
                            <span className="material-symbols-outlined text-primary text-3xl animate-spin">progress_activity</span>
                        </div>
                    )}

                    {/* Error State */}
                    {error && (
                        <div className="bg-red-900/20 border border-red-500/20 rounded-xl p-4 text-center">
                            <span className="material-symbols-outlined text-red-400 text-xl mb-2">error</span>
                            <p className="text-red-400 text-sm">{error}</p>
                            <button onClick={fetchRecordings} className="mt-2 text-xs text-primary hover:text-blue-400">
                                Try again
                            </button>
                        </div>
                    )}

                    {/* Empty State */}
                    {!loading && !error && filteredRecordings.length === 0 && (
                        <div className="text-center py-8">
                            <span className="material-symbols-outlined text-slate-600 text-4xl mb-2">mic_off</span>
                            <p className="text-slate-400 text-sm">
                                {searchQuery ? 'No recordings match your search' : 'No recordings yet'}
                            </p>
                        </div>
                    )}

                    {/* Recordings List */}
                    {!loading && !error && filteredRecordings.map((recording) => (
                        <div
                            key={`${recording.type}-${recording.id}`}
                            onClick={(e) => {
                                // Don't navigate if clicking on a button or inside a button/input
                                if (e.target.closest('button') || e.target.closest('input')) {
                                    return
                                }
                                navigate(recording.type === 'conversation' ? `/conversation/${recording.id}` : `/transcription/${recording.id}`)
                            }}
                            className="group bg-surface-light dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 hover:border-primary/30 dark:hover:border-primary/50 transition-all cursor-pointer"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                    {renamingId === recording.id ? (
                                        <div className="flex items-center gap-2" onClick={e => e.preventDefault()}>
                                            <input
                                                type="text"
                                                value={renameValue}
                                                onChange={(e) => setRenameValue(e.target.value)}
                                                className="bg-slate-800 text-white text-sm px-2 py-1 rounded border border-primary focus:outline-none w-full"
                                                autoFocus
                                                onClick={e => e.stopPropagation()}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') handleRenameSave(e)
                                                    if (e.key === 'Escape') handleRenameCancel(e)
                                                }}
                                            />
                                            <button onClick={handleRenameSave} className="text-green-500 hover:text-green-400 p-1">
                                                <span className="material-symbols-outlined text-lg">check</span>
                                            </button>
                                            <button onClick={handleRenameCancel} className="text-red-500 hover:text-red-400 p-1">
                                                <span className="material-symbols-outlined text-lg">close</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <h3
                                            className="text-base font-bold text-gray-900 dark:text-white mb-1 line-clamp-1 group-hover:text-primary transition-colors"
                                            dir={String(recording.title || '').match(/[\u0590-\u05FF]/) ? 'rtl' : 'ltr'}
                                        >
                                            {recording.title || 'Untitled Recording'}
                                        </h3>
                                    )}
                                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 font-medium">
                                        <span>{formatDate(recording.created_at)}</span>
                                        <span className="w-1 h-1 rounded-full bg-gray-400"></span>
                                        <span>{formatTime(recording.created_at)}</span>
                                    </div>
                                </div>
                                <div className="relative">
                                    <button
                                        onClick={(e) => handleMenuClick(e, recording.id)}
                                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">more_vert</span>
                                    </button>

                                    {menuOpenId === recording.id && (
                                        <div className="menu-dropdown absolute right-0 top-full mt-1 w-36 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10 overflow-hidden" onClick={e => e.stopPropagation()}>
                                            <button
                                                onClick={(e) => handleRenameStart(e, recording)}
                                                className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2"
                                            >
                                                <span className="material-symbols-outlined text-base">edit</span>
                                                Rename
                                            </button>
                                            <button
                                                onClick={(e) => handleDelete(e, recording)}
                                                className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-900/20 flex items-center gap-2"
                                            >
                                                <span className="material-symbols-outlined text-base">delete</span>
                                                Delete
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center justify-between mt-3">
                                {getStatusBadge(recording.status)}
                                <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                                    {formatDuration(recording.total_duration)}
                                </span>
                            </div>

                            {/* Transcript preview for completed items */}
                            {recording.status === 'completed' && recording.transcript_text && (
                                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50">
                                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 italic leading-relaxed">
                                        "{recording.transcript_text.substring(0, 150)}..."
                                    </p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </main>

            <ConfirmDialog
                isOpen={showDeleteConfirm}
                title="Delete Recording"
                message="Are you sure you want to delete this recording? This action cannot be undone."
                confirmText="Delete"
                isDestructive={true}
                onConfirm={confirmDelete}
                onCancel={() => {
                    setShowDeleteConfirm(false)
                    setRecordingToDelete(null)
                }}
            />
        </>
    )
}

// Helper functions
const formatDate = (dateString) => {
    if (!dateString) return ''
    try {
        const date = new Date(dateString)
        if (isNaN(date.getTime())) return ''

        const now = new Date()
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24))

        if (diffDays === 0) return 'Today'
        if (diffDays === 1) return 'Yesterday'

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        })
    } catch (err) {
        console.error('Date formatting error:', err)
        return ''
    }
}

const formatTime = (dateString) => {
    if (!dateString) return ''
    try {
        const date = new Date(dateString)
        if (isNaN(date.getTime())) return ''
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    } catch (err) {
        return ''
    }
}

const formatFileSize = (bytes) => {
    if (typeof bytes !== 'number' || isNaN(bytes)) return ''
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default Dashboard
