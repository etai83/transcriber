import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { conversationApi } from '../services/api'

function ConversationList({ refreshTrigger }) {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchConversations = async () => {
    try {
      const data = await conversationApi.list()
      setConversations(data)
      setError(null)
    } catch (err) {
      setError('Failed to load conversations')
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

  const handleDelete = async (id, e) => {
    e.preventDefault()
    e.stopPropagation()

    if (!confirm('Are you sure you want to delete this conversation?')) {
      return
    }

    try {
      await conversationApi.delete(id)
      setConversations(conversations.filter((c) => c.id !== id))
    } catch (err) {
      alert('Failed to delete conversation')
    }
  }

  const getStatusBadge = (status) => {
    const styles = {
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString()
  }

  const formatDuration = (seconds) => {
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
          <span className="ml-3 text-gray-600">Loading conversations...</span>
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
        <h2 className="text-xl font-semibold">Conversations</h2>
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
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <p>No conversations yet.</p>
          <p className="text-sm mt-1">Start a conversation recording to get started!</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200">
          {conversations.map((conversation) => (
            <Link
              key={conversation.id}
              to={`/conversation/${conversation.id}`}
              className="block p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3">
                    <svg
                      className="w-6 h-6 text-purple-500 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {conversation.title || 'Untitled Conversation'}
                      </p>
                      {conversation.description && (
                        <p className="text-sm text-gray-600 truncate mt-0.5">
                          {conversation.description}
                        </p>
                      )}
                      <div className="flex items-center space-x-3 text-sm text-gray-500 mt-1">
                        <span>{formatDate(conversation.created_at)}</span>
                        <span>{formatDuration(conversation.total_duration_sec)}</span>
                        <span>{conversation.chunk_count} chunks</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3 ml-4">
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
          ))}
        </div>
      )}
    </div>
  )
}

export default ConversationList
