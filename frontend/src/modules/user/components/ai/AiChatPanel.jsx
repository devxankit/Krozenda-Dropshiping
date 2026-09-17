import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  HiArrowPath,
  HiOutlineClock,
  HiOutlinePaperAirplane,
  HiOutlinePlus,
  HiXMark,
} from 'react-icons/hi2'
import { AiSparkIcon } from './AiSparkIcon'
import { AiChatHistory } from './AiChatHistory'

// Shown on an empty thread. Phrased as the customer would ask, and every one
// of them is answerable from the tools the backend exposes.
const SUGGESTED_QUESTIONS = [
  'Tell me everything about my account',
  'How much balance is in my wallet?',
  'Where is my latest order?',
  'How many orders have I placed?',
  "What's in my cart and wishlist?",
  'Show my support tickets and returns',
]

const MAX_MESSAGE_LENGTH = 2000

function formatTime(value) {
  return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function MessageBubble({ role, message, createdAt }) {
  const isUser = role === 'user'

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-2xs ${
            isUser
              ? 'rounded-br-md bg-blue-600 font-medium text-white'
              : 'rounded-bl-md border border-slate-200 bg-white font-medium text-slate-800'
          }`}
        >
          {message}
        </div>
        <span className="mt-1 px-1 text-[10px] font-semibold text-slate-400">{formatTime(createdAt)}</span>
      </div>
    </div>
  )
}

function ThinkingBubble() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3.5 py-3 shadow-2xs">
        <span className="flex gap-1">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
        <span className="text-xs font-semibold text-slate-500">AI is thinking...</span>
      </div>
    </div>
  )
}

// `assistant` is the useAiAssistantController() result, owned by
// AiAssistantLauncher so the transcript survives closing this sheet.
export function AiChatPanel({ assistant, onClose = () => {} }) {
  const {
    conversationId,
    messages,
    status,
    error,
    isSending,
    canRetry,
    send,
    retry,
    startNewChat,
    openConversation,
    removeConversation,
    conversations,
    isHistoryLoading,
  } = assistant

  const [draft, setDraft] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  const isEmpty = messages.length === 0

  // Auto-scroll on every new bubble and while the thinking indicator is up, so
  // the latest turn is always in view.
  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages, isSending])

  // Escape closes the history overlay first, then the panel — the usual
  // layered-dismiss behaviour.
  useEffect(() => {
    function onKeyDown(event) {
      if (event.key !== 'Escape') return
      if (showHistory) setShowHistory(false)
      else onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showHistory, onClose])

  const handleSubmit = (event) => {
    event?.preventDefault()
    const text = draft.trim()
    if (!text || isSending) return
    setDraft('')
    send(text)
  }

  const handleSuggestion = (question) => {
    if (isSending) return
    send(question)
  }

  const handleKeyDown = (event) => {
    // Enter sends, Shift+Enter makes a new line. On a touch keyboard the
    // Enter key inserts a newline instead, which is what mobile users expect.
    if (event.key === 'Enter' && !event.shiftKey && !('ontouchstart' in window)) {
      handleSubmit(event)
    }
  }

  const activeTitle = useMemo(() => {
    const match = conversations.find((c) => c.id === conversationId)
    return match?.title || 'Krozenda Assistant'
  }, [conversations, conversationId])

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      {/* Scrim */}
      <button
        type="button"
        aria-label="Close AI assistant"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
      />

      {/* Bottom sheet on mobile, centred card from sm up.
          100dvh tracks the visual viewport, so the composer stays above an
          open mobile keyboard instead of being pushed under it. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Krozenda AI Assistant"
        className="relative flex h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-slate-50 shadow-2xl sm:h-[640px] sm:max-h-[88dvh] sm:rounded-3xl"
      >
        {/* Header */}
        <div className="relative z-10 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <div className="relative shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 shadow-sm">
              <AiSparkIcon className="h-5 w-5 text-white" accent="#FBBF24" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold text-slate-900">{activeTitle}</p>
            <p className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Online
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowHistory(true)}
            aria-label="Chat history"
            className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          >
            <HiOutlineClock className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={startNewChat}
            aria-label="New chat"
            className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          >
            <HiOutlinePlus className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close assistant"
            className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          >
            <HiXMark className="h-5 w-5" />
          </button>
        </div>

        {/* Transcript */}
        <div ref={scrollRef} className="no-scrollbar flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {isEmpty && (
            <div className="flex h-full flex-col items-center justify-center px-2 text-center">
              <div className="relative mb-3 flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 shadow-[0_8px_20px_-6px_rgba(37,99,235,0.55)]">
                <span className="pointer-events-none absolute inset-x-2 top-1 h-3.5 rounded-full bg-white/25 blur-[6px]" />
                <AiSparkIcon className="relative h-8 w-8 text-white" accent="#FBBF24" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">Hi! How can I help?</h3>
              <p className="mt-1 max-w-[16rem] text-xs font-medium text-slate-500">
                Ask me about your orders, deliveries and purchases.
              </p>

              <div className="mt-5 w-full space-y-2">
                {SUGGESTED_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => handleSuggestion(question)}
                    disabled={isSending}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-xs font-bold text-slate-700 shadow-2xs transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <MessageBubble key={message.id} {...message} />
          ))}

          {isSending && <ThinkingBubble />}

          {status === 'error' && error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-3">
              <p className="text-xs font-semibold text-rose-700">{error}</p>
              {canRetry && (
                <button
                  type="button"
                  onClick={retry}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-rose-700"
                >
                  <HiArrowPath className="h-3.5 w-3.5" />
                  Retry
                </button>
              )}
            </div>
          )}
        </div>

        {/* Composer. pb-[env(safe-area-inset-bottom)] keeps it clear of the
            iOS home indicator when the sheet is flush with the screen edge. */}
        <form
          onSubmit={handleSubmit}
          className="relative z-10 border-t border-slate-200 bg-white px-3 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]"
        >
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              value={draft}
              onChange={(event) => setDraft(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your orders..."
              enterKeyHint="send"
              className="max-h-28 min-h-[42px] flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-400 focus:bg-white"
            />
            <button
              type="submit"
              disabled={isSending || !draft.trim()}
              aria-label="Send message"
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xs transition-all hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            >
              <HiOutlinePaperAirplane className="h-5 w-5" />
            </button>
          </div>
        </form>

        {showHistory && (
          <AiChatHistory
            conversations={conversations}
            isLoading={isHistoryLoading}
            activeConversationId={conversationId}
            onSelect={(id) => {
              openConversation(id)
              setShowHistory(false)
            }}
            onDelete={removeConversation}
            onNewChat={() => {
              startNewChat()
              setShowHistory(false)
            }}
            onClose={() => setShowHistory(false)}
          />
        )}
      </div>
    </div>
  )
}

export default AiChatPanel
