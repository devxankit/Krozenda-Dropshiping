import React from 'react'
import { HiOutlineChatBubbleLeftRight, HiOutlinePlus, HiOutlineTrash, HiXMark } from 'react-icons/hi2'

// Groups threads the way a customer thinks about them, not by raw timestamp.
function groupByDay(conversations) {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000)
  const startOfWeek = new Date(startOfToday.getTime() - 7 * 86400000)

  const groups = { Today: [], Yesterday: [], 'Previous 7 days': [], Earlier: [] }

  for (const conversation of conversations) {
    const at = new Date(conversation.lastMessageAt)
    if (at >= startOfToday) groups.Today.push(conversation)
    else if (at >= startOfYesterday) groups.Yesterday.push(conversation)
    else if (at >= startOfWeek) groups['Previous 7 days'].push(conversation)
    else groups.Earlier.push(conversation)
  }

  return Object.entries(groups).filter(([, items]) => items.length > 0)
}

export function AiChatHistory({
  conversations = [],
  isLoading = false,
  activeConversationId = null,
  onSelect = () => {},
  onDelete = () => {},
  onNewChat = () => {},
  onClose = () => {},
}) {
  const groups = groupByDay(conversations)

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-extrabold text-slate-900">Chat history</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat history"
          className="rounded-full p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
        >
          <HiXMark className="h-5 w-5" />
        </button>
      </div>

      <div className="px-4 pt-3">
        <button
          type="button"
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-100"
        >
          <HiOutlinePlus className="h-4 w-4" />
          New Chat
        </button>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto px-4 py-3">
        {isLoading && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        )}

        {!isLoading && conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
              <HiOutlineChatBubbleLeftRight className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-bold text-slate-700">No conversations yet</p>
            <p className="mt-1 text-xs text-slate-500">Your past chats will show up here.</p>
          </div>
        )}

        {groups.map(([label, items]) => (
          <div key={label} className="mb-4">
            <p className="mb-1.5 px-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              {label}
            </p>
            <div className="space-y-1">
              {items.map((conversation) => {
                const isActive = conversation.id === activeConversationId
                return (
                  <div
                    key={conversation.id}
                    className={`group flex items-center gap-2 rounded-2xl border px-3 py-2.5 transition-colors ${
                      isActive
                        ? 'border-blue-200 bg-blue-50'
                        : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(conversation.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p
                        className={`truncate text-sm font-bold ${isActive ? 'text-blue-800' : 'text-slate-800'}`}
                      >
                        {conversation.title}
                      </p>
                      <p className="text-[11px] font-medium text-slate-400">
                        {new Date(conversation.lastMessageAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(conversation.id)}
                      aria-label={`Delete conversation ${conversation.title}`}
                      // Always reachable on touch (no hover there); fades in on
                      // pointer devices so the list stays clean.
                      className="rounded-full p-1.5 text-slate-400 opacity-100 transition-colors hover:bg-rose-50 hover:text-rose-600 md:opacity-0 md:group-hover:opacity-100"
                    >
                      <HiOutlineTrash className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default AiChatHistory
