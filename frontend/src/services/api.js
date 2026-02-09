import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const transcriptionApi = {
  /**
   * Upload an audio file for transcription
   */
  upload: async (file, language = 'auto', trimSilence = false) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('language', language)
    formData.append('trim_silence', trimSilence)

    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  /**
   * Get list of all transcriptions
   */
  list: async (status = null) => {
    const params = status ? { status } : {}
    const response = await api.get('/transcriptions', { params })
    return response.data
  },

  /**
   * Get a single transcription by ID
   */
  get: async (id) => {
    const response = await api.get(`/transcriptions/${id}`)
    return response.data
  },

  /**
   * Get the status of a transcription
   */
  getStatus: async (id) => {
    const response = await api.get(`/status/${id}`)
    return response.data
  },

  /**
   * Get the transcript text
   */
  getTranscript: async (id) => {
    const response = await api.get(`/transcriptions/${id}/transcript`)
    return response.data
  },

  /**
   * Get the audio file URL
   */
  getAudioUrl: (id) => {
    return `${API_BASE_URL}/transcriptions/${id}/audio`
  },

  /**
   * Delete a transcription
   */
  delete: async (id) => {
    const response = await api.delete(`/transcriptions/${id}`)
    return response.data
  },

  /**
   * Retry a failed transcription
   */
  retry: async (id) => {
    const response = await api.post(`/transcriptions/${id}/retry`)
    return response.data
  },

  /**
   * Update a transcription (title, description, transcript_text)
   */
  update: async (id, data) => {
    const response = await api.patch(`/transcriptions/${id}`, data)
    return response.data
  },

  /**
   * Get supported languages
   */
  getLanguages: async () => {
    const response = await api.get('/languages')
    return response.data
  },
}

export const conversationApi = {
  /**
   * Create a new conversation
   */
  create: async (data) => {
    const response = await api.post('/conversations', data)
    return response.data
  },

  /**
   * List all conversations
   */
  list: async (status = null) => {
    const params = status ? { status } : {}
    const response = await api.get('/conversations', { params })
    return response.data
  },

  /**
   * Get a single conversation with all chunks
   */
  get: async (id) => {
    const response = await api.get(`/conversations/${id}`)
    return response.data
  },

  /**
   * Add an audio chunk to a conversation
   */
  addChunk: async (conversationId, file, chunkIndex) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('chunk_index', chunkIndex)

    const response = await api.post(`/conversations/${conversationId}/chunks`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  /**
   * Mark a conversation as complete
   */
  complete: async (id) => {
    const response = await api.post(`/conversations/${id}/complete`)
    return response.data
  },

  /**
   * Get full transcript for a conversation
   */
  getTranscript: async (id) => {
    const response = await api.get(`/conversations/${id}/transcript`)
    return response.data
  },

  /**
   * Update a conversation (title, description)
   */
  update: async (id, data) => {
    const response = await api.patch(`/conversations/${id}`, data)
    return response.data
  },

  /**
   * Delete a conversation and all its chunks
   */
  delete: async (id) => {
    const response = await api.delete(`/conversations/${id}`)
    return response.data
  },

  /**
   * Refresh a conversation's status based on its chunks
   */
  refreshStatus: async (id) => {
    const response = await api.post(`/conversations/${id}/refresh-status`)
    return response.data
  },

  /**
   * Upload an audio file and create a conversation
   */
  upload: async (formData, onProgress) => {
    const response = await api.post('/conversations/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = progressEvent.loaded / progressEvent.total
          onProgress(progress)
        }
      },
    })
    return response.data
  },

  /**
   * Trigger AI metadata generation manually
   */
  generateMetadata: async (id) => {
    const response = await api.post(`/conversations/${id}/generate-metadata`)
    return response.data
  },
}

export const aiAssistantApi = {
  /**
   * Get AI recommendations for a conversation
   */
  getRecommendations: async (conversationId, chunkId = null) => {
    const response = await api.post('/ai-assistant/recommendations', {
      conversation_id: conversationId,
      chunk_id: chunkId,
    })
    return response.data
  },

  /**
   * Get AI assistant status
   */
  getStatus: async () => {
    const response = await api.get('/ai-assistant/status')
    return response.data
  },

  /**
   * Get AI assistant settings
   */
  getSettings: async () => {
    const response = await api.get('/ai-assistant/settings')
    return response.data
  },
}

export default api
