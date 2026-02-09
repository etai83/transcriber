import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { conversationApi, transcriptionApi } from '../services/api'
import { Conversation, Transcription } from '../types'

interface RecordingListProps {
  refreshTrigger?: any
}

const RecordingList: React.FC<RecordingListProps> = ({ refreshTrigger }) => {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedConversations, setExpandedConversations] = useState<Record<number, boolean>>({})
  const [retryingChunks, setRetryingChunks] = useState<Record<number, boolean>>({})

  const fetchConversations = async () => {
    try {
      const data = await conversationApi.list()
      setConversations(data)
      setError(null)
    } catch (err) {
      setError('Failed to load recordings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConversations()
  }, [refreshTrigger])

  // Poll for status updates
  useEffect(() => {
    const hasProcessing = conversations.some(
      (c) => c.status === 'recording' || c.status === 'processing'
    )

    if (hasProcessing) {
      const interval = setInterval(fetchConversations, 3000)
      return () => clearInterval(interval)
    }
  }, [conversations])

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!confirm('Are you sure you want to delete this recording?')) {
      return
    }

    try {
      await conversationApi.delete(id)
      setConversations(conversations.filter((c) => c.id !== id))
    } catch (err) {
      alert('Failed to delete recording')
    }
  }

  const toggleExpanded = (id: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setExpandedConversations(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const handleRetryChunk = async (chunkId: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    setRetryingChunks(prev => ({ ...prev, [chunkId]: true }))
    try {
      await transcriptionApi.retry(chunkId)
      // Refresh the list to get updated status
      await fetchConversations()
    } catch (err) {
      alert('Failed to retry transcription')
    } finally {
      setRetryingChunks(prev => ({ ...prev, [chunkId]: false }))
    }
  }

  const getStatusBadge = (status: Conversation['status']) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      recording: 'bg-red-100 text-red-800',
      processing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    }

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100'}`}>
        {status === 'processing' && (
          <svg className="inline-block w-3 h-3 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {status === 'recording' && (
          <span className="inline-block w-2 h-2 mr-1 bg-red-500 rounded-full animate-pulse" />
        )}
        {status}
      </span>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center py-8">
          <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="ml-3 text-gray-600">Loading recordings...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-8 text-red-500">{error}</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold">Recordings</h2>
      </div>

      {conversations.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <svg
            className="w-16 h-16 mx-auto text-gray-300 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
          <p>No recordings yet.</p>
          <p className="text-sm mt-1">Upload an audio file or record something to get started!</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200">
          {conversations.map((conversation) => (
            <div key={conversation.id}>
              <Link
                to={`/conversation/${conversation.id}`}
                className="block p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3">
                      {/* Icon */}
                      <svg
                        className="w-6 h-6 text-blue-500 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                        />
                      </svg>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <p className="font-medium text-gray-900 truncate">
                            {conversation.title || 'Untitled Recording'}
                          </p>
                          {/* conversation.chunk_count is not in my type definition, I should add it or use chunks?.length */}
                          {/* Wait, the API returns chunks list or count? Model has chunks relationship. */}
                          {/* Assuming API returns chunk_count or we check chunks.length */}
                          {/* Based on previous code: conversation.chunk_count. Let's assume it's there or added by API serializer */}
                          {(conversation as any).chunk_count > 1 && (
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                              {(conversation as any).chunk_count} parts
                            </span>
                          )}
                        </div>
                        {conversation.description && (
                          <p className="text-sm text-gray-600 truncate mt-0.5">
                            {conversation.description}
                          </p>
                        )}
                        <div className="flex items-center space-x-3 text-sm text-gray-500 mt-1">
                          <span>{formatDate(conversation.created_at)}</span>
                          <span>{formatDuration(conversation.total_duration_sec)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    {/* Expand/Collapse button for multi-chunk conversations */}
                    {(conversation as any).chunk_count > 1 && (
                      <button
                        onClick={(e) => toggleExpanded(conversation.id, e)}
                        className="text-gray-400 hover:text-gray-600 p-1"
                        title={expandedConversations[conversation.id] ? 'Collapse' : 'Expand'}
                      >
                        <svg 
                          className={`w-5 h-5 transition-transform ${expandedConversations[conversation.id] ? 'rotate-180' : ''}`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    )}
                    {getStatusBadge(conversation.status)}
                    <button
                      onClick={(e) => handleDelete(conversation.id, e)}
                      className="text-gray-400 hover:text-red-500 p-1"
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
              </Link>

              {/* Expanded Chunks Section */}
              {expandedConversations[conversation.id] && (conversation as any).chunk_count > 1 && (
                <ChunksList 
                  conversationId={conversation.id} 
                  onRetryChunk={handleRetryChunk}
                  retryingChunks={retryingChunks}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface ChunksListProps {
  conversationId: number;
  onRetryChunk: (id: number, e: React.MouseEvent) => void;
  retryingChunks: Record<number, boolean>;
}

// Separate component to load chunks on demand
const ChunksList: React.FC<ChunksListProps> = ({ conversationId, onRetryChunk, retryingChunks }) => {
  const [chunks, setChunks] = useState<Transcription[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    const fetchChunks = async () => {
      try {
        const conversation = await conversationApi.get(conversationId)
        setChunks(conversation.chunks || [])
      } catch (err) {
        console.error('Failed to load chunks:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchChunks()
  }, [conversationId])

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getChunkStatusIcon = (status: Transcription['status']) => {
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

  if (loading) {
    return (
      <div className="px-4 pb-4 pl-14">
        <div className="text-sm text-gray-500 animate-pulse">Loading chunks...</div>
      </div>
    )
  }

  return (
    <div className="px-4 pb-4 pl-14 space-y-2">
      {chunks.sort((a, b) => ((a as any).chunk_index ?? 0) - ((b as any).chunk_index ?? 0)).map((chunk, index) => (
        <div 
          key={chunk.id} 
          className="bg-gray-50 rounded-lg p-3 border border-gray-200"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {getChunkStatusIcon(chunk.status)}
              <span className="text-sm font-medium text-gray-700">
                Part {((chunk as any).chunk_index ?? index) + 1}
              </span>
              {chunk.duration_sec && (
                <span className="text-xs text-gray-500">
                  ({formatDuration(chunk.duration_sec)})
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {chunk.status === 'failed' && (
                <button
                  onClick={(e) => onRetryChunk(chunk.id, e)}
                  disabled={retryingChunks[chunk.id]}
                  className="text-xs text-orange-600 hover:text-orange-800 disabled:opacity-50"
                >
                  {retryingChunks[chunk.id] ? 'Retrying...' : 'Retry'}
                </button>
              )}
              <span className="text-xs text-gray-400">{chunk.status}</span>
            </div>
          </div>
          {chunk.status === 'completed' && chunk.transcript_text && (
            <p className="text-sm text-gray-600 mt-2 line-clamp-2">
              {chunk.transcript_text}
            </p>
          )}
          {chunk.status === 'failed' && chunk.error_message && (
            <p className="text-xs text-red-500 mt-1">
              {chunk.error_message}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

export default RecordingList
