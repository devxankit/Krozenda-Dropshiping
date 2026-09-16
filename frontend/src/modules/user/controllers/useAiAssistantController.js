// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing components are allowed to call into.

import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  sendChatMessage,
  fetchConversations,
  fetchConversation,
  deleteConversation,
} from '../services/aiService'

const CONVERSATIONS_KEY = ['user', 'ai', 'conversations']

// Optimistic rows get a client-side id so React keys stay stable until the
// server's real ids arrive. Never sent to the backend.
let localId = 0
const nextLocalId = () => `local-${(localId += 1)}`

/**
 * Owns one open chat session: the visible transcript, which conversation it
 * belongs to, and the request lifecycle.
 *
 * Status model (idle | loading | error) is explicit rather than inferred, so
 * the UI can show "AI is thinking..." and a retry affordance rather than an
 * indefinite spinner.
 */
export function useAiAssistantController({ historyEnabled = true } = {}) {
  const queryClient = useQueryClient()

  const [conversationId, setConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  // Kept so the retry button can resend the exact text that failed without
  // asking the customer to retype it. State rather than a ref because the
  // returned `canRetry` flag is read during render.
  const [failedMessage, setFailedMessage] = useState(null)

  const historyQuery = useQuery({
    queryKey: CONVERSATIONS_KEY,
    queryFn: fetchConversations,
    // The hook is mounted for the whole customer app so chat state survives
    // closing the sheet, but a customer who never opens the assistant should
    // not pay for a history request. The launcher flips this on first open.
    enabled: historyEnabled,
    // The list is only ever read while the history drawer is open, so a short
    // stale window keeps it fresh without polling.
    staleTime: 30_000,
  })

  const chatMutation = useMutation({ mutationFn: sendChatMessage })

  const send = useCallback(
    async (rawText) => {
      const text = String(rawText || '').trim()
      if (!text || status === 'loading') return

      setError(null)
      setStatus('loading')
      setFailedMessage(null)

      // Echo immediately — the customer sees their message land before the
      // round trip starts.
      const pending = { id: nextLocalId(), role: 'user', message: text, createdAt: new Date().toISOString() }
      setMessages((prev) => [...prev, pending])

      try {
        const result = await chatMutation.mutateAsync({ conversationId, message: text })

        // First message of a brand new thread: adopt the id the backend minted
        // so every later turn lands in the same conversation.
        if (!conversationId) setConversationId(result.conversationId)

        setMessages((prev) => [
          ...prev,
          {
            id: result.messageId || nextLocalId(),
            role: 'assistant',
            message: result.response,
            createdAt: new Date().toISOString(),
          },
        ])
        setStatus('idle')

        // A new thread (or a retitled one) changes the history list.
        queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY })
      } catch (err) {
        // Roll the optimistic bubble back out so the retry does not duplicate
        // it, and hand the text to the retry button.
        setMessages((prev) => prev.filter((m) => m.id !== pending.id))
        setFailedMessage(text)
        setError(err?.message || "Sorry, I couldn't process that right now. Please try again.")
        setStatus('error')
      }
    },
    [chatMutation, conversationId, queryClient, status],
  )

  const retry = useCallback(() => {
    if (failedMessage) send(failedMessage)
  }, [failedMessage, send])

  // "New Chat": clears the visible transcript only. The previous conversation
  // stays in the database and in the history list — nothing is deleted, and
  // the new thread is not created server-side until its first message, so
  // opening New Chat and closing again leaves no empty rows behind.
  const startNewChat = useCallback(() => {
    setConversationId(null)
    setMessages([])
    setStatus('idle')
    setError(null)
    setFailedMessage(null)
  }, [])

  const openConversation = useCallback(async (id) => {
    setStatus('loading')
    setError(null)
    try {
      const { conversation, messages: rows } = await fetchConversation(id)
      setConversationId(conversation.id)
      setMessages(rows)
      setStatus('idle')
    } catch (err) {
      setError(err?.message || 'Could not open that conversation.')
      setStatus('error')
    }
  }, [])

  const removeConversation = useCallback(
    async (id) => {
      await deleteConversation(id)
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY })
      // Deleting the thread currently on screen drops you into a fresh one.
      setConversationId((current) => {
        if (current === id) {
          setMessages([])
          return null
        }
        return current
      })
    },
    [queryClient],
  )

  return {
    conversationId,
    messages,
    status,
    error,
    isSending: status === 'loading',
    canRetry: status === 'error' && Boolean(failedMessage),
    send,
    retry,
    startNewChat,
    openConversation,
    removeConversation,
    conversations: historyQuery.data || [],
    isHistoryLoading: historyQuery.isLoading,
    refetchHistory: historyQuery.refetch,
  }
}
