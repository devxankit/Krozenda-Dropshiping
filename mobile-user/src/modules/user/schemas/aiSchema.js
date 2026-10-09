import { z } from 'zod'

// Mirrors the shapes serialized by backend/Controllers/aiAssistantController.

export const aiConversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  messageCount: z.number(),
  lastMessageAt: z.union([z.string(), z.date()]),
  createdAt: z.union([z.string(), z.date()]),
})

export const aiConversationListSchema = z.array(aiConversationSchema)

export const aiMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  message: z.string(),
  createdAt: z.union([z.string(), z.date()]),
})

export const aiTranscriptSchema = z.object({
  conversation: aiConversationSchema,
  messages: z.array(aiMessageSchema),
})

export const aiChatResponseSchema = z.object({
  conversationId: z.string(),
  response: z.string(),
  messageId: z.string().optional(),
  // Diagnostics the backend chooses to expose. Loose on purpose so adding a
  // field server-side never breaks the chat for users on an older bundle.
  metadata: z.object({}).passthrough().optional(),
})
