// Layer rule: services/ is the ONLY place that imports the axios instance.
//
// Security note: not one call below sends a user id, and there is nothing to
// add — the backend derives the customer from the Bearer token that
// lib/axios.js attaches, and ignores anything else. Sending an id here would
// have no effect other than to look like it worked.

import { api } from '../../../lib/axios'
import {
  aiChatResponseSchema,
  aiConversationSchema,
  aiConversationListSchema,
  aiTranscriptSchema,
} from '../schemas/aiSchema'

// Longer than the shared 15s default: a Gemini turn that also runs database
// tools can legitimately take ~20s, and the backend caps itself at 20s + a
// little overhead, so the client should not give up first.
const CHAT_TIMEOUT_MS = 30000

export async function sendChatMessage({ conversationId, message }) {
  const response = await api.post(
    '/user/ai/chat',
    // conversationId is omitted rather than sent as null on a brand new
    // thread, which is what makes the backend mint one.
    conversationId ? { conversationId, message } : { message },
    { timeout: CHAT_TIMEOUT_MS },
  )
  return aiChatResponseSchema.parse(response.data.data)
}

export async function fetchConversations() {
  const response = await api.get('/user/ai/conversations')
  return aiConversationListSchema.parse(response.data.data.items)
}

export async function fetchConversation(conversationId) {
  const response = await api.get(`/user/ai/conversations/${conversationId}`)
  return aiTranscriptSchema.parse(response.data.data)
}

export async function createConversation() {
  const response = await api.post('/user/ai/conversations')
  return aiConversationSchema.parse(response.data.data)
}

export async function deleteConversation(conversationId) {
  const response = await api.delete(`/user/ai/conversations/${conversationId}`)
  return response.data
}
