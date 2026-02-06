import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import Header from '../components/Header'
import ConversationRecorder from '../components/ConversationRecorder'
import { conversationApi, transcriptionApi } from '../services/api'

function Dashboard({ onMenuClick }) {
    const [recordings, setRecordings] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [activeTab, setActiveTab] = useState('upload') // 'upload' or 'record'
    const [isDragging, setIsDragging] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [menuOpenId, setMenuOpenId] = useState(null)
    const [renamingId, setRenamingId] = useState(null)
    const [renameValue, setRenameValue] = useState('')
    const fileInputRef = useRef(null)

    // Fetch recordings on mount
    useEffect(() => {
        fetchRecordings()
    }, [])

    const fetchRecordings = async () => {
        try {
            setLoading(true)
            // Fetch both conversations and transcriptions
            const [conversations, transcriptions] = await Promise.all([
                conversationApi.list().catch(() => []),
                transcriptionApi.list().catch(() => [])
            ])

            // Merge and add type identifier
            const allRecordings = [
                ...conversations.map(c => ({ ...c, type: 'conversation' })),
                ...transcriptions.map(t => ({ ...t, type: 'transcription' }))
            ]

            // Sort by created_at descending
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
    const handleFileUpload = async (file) => {
        if (!file) return

        // Validate file type
        const validTypes = ['audio/wav', 'audio/webm', 'audio/x-m4a', 'audio/mp4', 'audio/mpeg', 'audio/mp3']
        const validExtensions = ['.wav', '.webm', '.m4a', '.mp3', '.mp4']
        const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext))

        if (!validTypes.includes(file.type) && !hasValidExtension) {
            alert('Please upload a valid audio file (WAV, WebM, M4A, MP3)')
            return
        }

        setUploading(true)
        setUploadProgress(0)

        try {
            // Use the existing transcriptionApi.upload endpoint
            // This creates a Transcription record (not a Conversation)
            setUploadProgress(50) // Show progress since we don't have real progress from this API

            await transcriptionApi.upload(file, 'auto', false)

            // Refresh recordings list
            await fetchRecordings()
            setUploadProgress(100)

            // Reset after short delay
            setTimeout(() => {
                setUploading(false)
                setUploadProgress(0)
            }, 1000)
        } catch (err) {
            console.error('Upload error:', err)
            alert('Failed to upload file. Please try again.')
            setUploading(false)
            setUploadProgress(0)
        }
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
        handleFileUpload(file)
    }

    const handleFileSelect = (e) => {
        const file = e.target.files[0]
        handleFileUpload(file)
    }

    // Filter recordings based on search query
    const filteredRecordings = recordings.filter(recording => {
        if (!searchQuery) return true
        const query = searchQuery.toLowerCase()
        return (
            (recording.title || '').toLowerCase().includes(query) ||
            (recording.description || '').toLowerCase().includes(query) ||
            formatDate(recording.created_at).toLowerCase().includes(query)
        )
    })

    const getStatusBadge = (status) => {
        switch (status) {
            case 'completed':
                return (
                    <span className="text-xs text-emerald-500 font-medium">Completed</span>
                )
            case 'processing':
            case 'recording':
                return (
                    <span className="text-xs text-amber-500 font-medium">Processing...</span>
                )
            case 'failed':
                return (
                    <span className="text-xs text-red-500 font-medium">Failed</span>
                )
            default:
                return (
                    <span className="text-xs text-slate-400 font-medium">{status}</span>
                )
        }
    }

    const getStatusIcon = (status) => {
        switch (status) {
            case 'completed':
                return (
                    <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                        <span className="material-symbols-outlined text-xl">check_circle</span>
                    </div>
                )
            case 'processing':
            case 'recording':
                return (
                    <div className="size-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                        <span className="material-symbols-outlined text-xl animate-spin">progress_activity</span>
                    </div>
                )
            case 'failed':
                return (
                    <div className="size-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                        <span className="material-symbols-outlined text-xl">error</span>
                    </div>
                )
            default:
                return (
                    <div className="size-10 rounded-lg bg-slate-500/10 flex items-center justify-center text-slate-400 shrink-0">
                        <span className="material-symbols-outlined text-xl">audio_file</span>
                    </div>
                )
        }
    }

    const formatDate = (dateString) => {
        const date = new Date(dateString)
        const now = new Date()
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24))

        if (diffDays === 0) return 'Today'
        if (diffDays === 1) return 'Yesterday'

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        })
    }

    const formatTime = (dateString) => {
        const date = new Date(dateString)
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    }

    const handleRecordingComplete = () => {
        fetchRecordings()
    }

    // Menu handlers
    const handleMenuClick = (e, id) => {
        e.preventDefault()
        e.stopPropagation()
        setMenuOpenId(menuOpenId === id ? null : id)
    }

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setMenuOpenId(null)
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
            // Could add toast notification here
        }
    }

    const handleRenameCancel = (e) => {
        e.preventDefault()
        e.stopPropagation()
        setRenamingId(null)
        setRenameValue('')
    }

    const handleDelete = async (e, recording) => {
        e.preventDefault()
        e.stopPropagation()

        if (!confirm('Are you sure you want to delete this recording?')) return

        try {
            const api = recording.type === 'conversation' ? conversationApi : transcriptionApi
            await api.delete(recording.id)
            setRecordings(prev => prev.filter(r => r.id !== recording.id))
            setMenuOpenId(null)
        } catch (err) {
            console.error('Delete failed:', err)
            alert('Failed to delete recording')
        }
    }

    return (
        <>
            <Header
                title="Dashboard"
                onMenuClick={onMenuClick}
            />

            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Mode Switcher Tabs */}
                <div className="px-4 py-2 shrink-0">
                    <div className="relative flex h-12 w-full items-center rounded-xl bg-surface-dark p-1">
                        <label
                            className={`group relative flex flex-1 cursor-pointer h-full items-center justify-center rounded-lg transition-all duration-200 ${activeTab === 'upload'
                                ? 'bg-primary text-white'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            <input
                                type="radio"
                                name="mode"
                                value="upload"
                                checked={activeTab === 'upload'}
                                onChange={() => setActiveTab('upload')}
                                className="sr-only"
                            />
                            <span className="material-symbols-outlined mr-2 text-[20px]">upload_file</span>
                            <span className="text-sm font-bold">Upload</span>
                        </label>
                        <label
                            className={`group relative flex flex-1 cursor-pointer h-full items-center justify-center rounded-lg transition-all duration-200 ${activeTab === 'record'
                                ? 'bg-primary text-white'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            <input
                                type="radio"
                                name="mode"
                                value="record"
                                checked={activeTab === 'record'}
                                onChange={() => setActiveTab('record')}
                                className="sr-only"
                            />
                            <span className="material-symbols-outlined mr-2 text-[20px]">mic</span>
                            <span className="text-sm font-bold">Record</span>
                        </label>
                    </div>
                </div>

                {/* Upload Tab Content */}
                {activeTab === 'upload' && (
                    <div className="flex flex-col p-4 shrink-0">
                        {/* Upload Zone */}
                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`group relative flex flex-col items-center gap-4 rounded-xl border-2 border-dashed px-6 py-10 cursor-pointer transition-colors ${isDragging
                                ? 'border-primary bg-primary/10'
                                : 'border-slate-700 bg-[#151f2e] hover:border-primary/50'
                                } ${uploading ? 'pointer-events-none opacity-70' : ''}`}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".wav,.webm,.m4a,.mp3,.mp4,audio/*"
                                onChange={handleFileSelect}
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

                            {uploading ? (
                                <div className="mt-4 w-full max-w-[200px]">
                                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary transition-all duration-300"
                                            style={{ width: `${uploadProgress}%` }}
                                        />
                                    </div>
                                    <p className="text-center text-xs text-slate-400 mt-2">Uploading... {uploadProgress}%</p>
                                </div>
                            ) : (
                                <button className="mt-4 flex w-full max-w-[200px] items-center justify-center rounded-lg h-10 bg-primary hover:bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-900/20 transition-all">
                                    Select Audio File
                                </button>
                            )}
                        </div>

                        {/* Privacy Indicator */}
                        <div className="flex items-center justify-center gap-2 py-4">
                            <span className="material-symbols-outlined text-slate-400 text-sm">shield_lock</span>
                            <p className="text-slate-400 text-xs font-medium">Secure Local Processing (Device Only)</p>
                        </div>
                    </div>
                )}

                {/* Record Tab Content */}
                {activeTab === 'record' && (
                    <div className="px-4 py-2 shrink-0">
                        <ConversationRecorder onRecordingComplete={handleRecordingComplete} compact={true} />
                    </div>
                )}

                {/* Recent Activity Section */}
                <div className="flex-1 flex flex-col bg-[#0d121a]/50 rounded-t-3xl border-t border-slate-800/50 overflow-hidden">
                    <div className="flex items-center justify-between p-6 pb-4 shrink-0">
                        <h3 className="text-white text-base font-bold">Recent Activity</h3>
                        <button className="text-primary text-sm font-semibold hover:underline">View All</button>
                    </div>

                    {/* Search Bar */}
                    <div className="px-6 pb-4 shrink-0">
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="material-symbols-outlined text-slate-400 text-lg group-focus-within:text-primary transition-colors">search</span>
                            </div>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search recordings..."
                                className="block w-full pl-10 pr-4 py-2.5 bg-surface-dark border border-slate-700 rounded-xl text-sm font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                        </div>
                    </div>

                    {/* Recordings List */}
                    <div className="flex-1 overflow-y-auto px-6 pb-6 hide-scrollbar">
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
                                <button
                                    onClick={fetchRecordings}
                                    className="mt-2 text-xs text-primary hover:text-blue-400"
                                >
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
                        {!loading && !error && (
                            <div className="flex flex-col gap-3">
                                {filteredRecordings.map((recording) => (
                                    <Link
                                        key={`${recording.type}-${recording.id}`}
                                        to={recording.type === 'conversation'
                                            ? `/conversation/${recording.id}`
                                            : `/transcription/${recording.id}`}
                                        className="flex items-center gap-4 p-3 rounded-xl bg-surface-dark border border-slate-700/50 shadow-sm hover:border-primary/30 transition-all"
                                    >
                                        {getStatusIcon(recording.status)}
                                        <div className="flex flex-col flex-1 min-w-0">
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
                                                <p className="text-white text-sm font-semibold truncate">
                                                    {recording.title || 'Untitled Recording'}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {getStatusBadge(recording.status)}
                                                <span className="text-[10px] text-slate-400">
                                                    • {formatDate(recording.created_at)} • {formatTime(recording.created_at)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="relative">
                                            <button
                                                onClick={(e) => handleMenuClick(e, recording.id)}
                                                className={`text-slate-400 hover:text-slate-200 transition-colors ${menuOpenId === recording.id ? 'text-slate-200' : ''}`}
                                            >
                                                <span className="material-symbols-outlined">more_vert</span>
                                            </button>

                                            {menuOpenId === recording.id && (
                                                <div className="absolute right-0 top-full mt-1 w-36 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10 overflow-hidden" onClick={e => e.stopPropagation()}>
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
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </>
    )
}

export default Dashboard
