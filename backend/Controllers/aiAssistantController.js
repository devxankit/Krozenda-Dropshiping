const mongoose = require('mongoose');
const AiConversation = require('../Models/AiConversation');
const AiMessage = require('../Models/AiMessage');
const { generateAssistantReply, HISTORY_TURN_LIMIT } = require('../services/aiAssistant');
const { GeminiError, isConfigured } = require('../services/geminiClient');

// ---------------------------------------------------------------------------
// Every handler here is mounted behind protectUser (see Router/aiRoutes.js),
// so req.user is always a verified account. The single rule this file follows
// without exception: the owner of any row read or written is req.user._id, and
// nothing in the request body can change that. Note that no handler reads a
// userId from req.body — there is no code path in which one could.
// ---------------------------------------------------------------------------

const MAX_MESSAGE_LENGTH = 2000;
const CONVERSATION_LIST_LIMIT = 50;

function serializeConversation(conversation) {
  return {
    id: conversation._id.toString(),
    title: conversation.title,
    messageCount: conversation.messageCount,
    lastMessageAt: conversation.lastMessageAt,
    createdAt: conversation.createdAt,
  };
}

function serializeMessage(message) {
  return {
    id: message._id.toString(),
    role: message.role,
    message: message.message,
    createdAt: message.createdAt,
  };
}

// First user message -> a short thread name for the history list. Trimmed at a
// word boundary so titles don't end mid-word.
function deriveTitle(text) {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'New chat';
  if (cleaned.length <= 48) return cleaned;

  const clipped = cleaned.slice(0, 48);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${(lastSpace > 24 ? clipped.slice(0, lastSpace) : clipped).trim()}...`;
}

// The one place a conversation id from a request is turned into a document.
// Ownership is part of the query, never a comparison afterwards, so a
// conversation belonging to somebody else is indistinguishable from one that
// does not exist.
async function findOwnedConversation(conversationId, userId) {
  if (!mongoose.isValidObjectId(conversationId)) return null;
  return AiConversation.findOne({ _id: conversationId, user: userId, isDeleted: false });
}

// POST /user/ai/conversations — start a fresh thread.
// Previous conversations are untouched; "New Chat" is a create, never a clear.
async function createConversation(req, res) {
  const conversation = await AiConversation.create({ user: req.user._id });
  res.status(201).json({
    success: true,
    message: 'Conversation created',
    data: serializeConversation(conversation),
  });
}

// GET /user/ai/conversations — this customer's history list.
async function listConversations(req, res) {
  const conversations = await AiConversation.find({ user: req.user._id, isDeleted: false })
    .sort({ lastMessageAt: -1 })
    .limit(CONVERSATION_LIST_LIMIT)
    .lean();

  res.json({
    success: true,
    data: { items: conversations.map((c) => serializeConversation(c)) },
  });
}

// GET /user/ai/conversations/:conversationId — one transcript.
async function getConversation(req, res) {
  const conversation = await findOwnedConversation(req.params.conversationId, req.user._id);
  if (!conversation) {
    return res.status(404).json({ success: false, message: 'Conversation not found' });
  }

  // Filtered by user as well as conversation. Redundant given the ownership
  // check above, and kept deliberately: a transcript read is never one bug
  // away from crossing accounts.
  const messages = await AiMessage.find({ conversation: conversation._id, user: req.user._id })
    .sort({ createdAt: 1 })
    .lean();

  res.json({
    success: true,
    data: {
      conversation: serializeConversation(conversation),
      messages: messages.map((m) => serializeMessage(m)),
    },
  });
}

// DELETE /user/ai/conversations/:conversationId — soft delete.
async function deleteConversation(req, res) {
  const conversation = await findOwnedConversation(req.params.conversationId, req.user._id);
  if (!conversation) {
    return res.status(404).json({ success: false, message: 'Conversation not found' });
  }

  conversation.isDeleted = true;
  await conversation.save();

  res.json({ success: true, message: 'Conversation deleted', data: { id: conversation._id.toString() } });
}

// POST /user/ai/chat — the assistant turn.
async function chat(req, res, next) {
  const { conversationId } = req.body || {};
  const rawMessage = typeof req.body?.message === 'string' ? req.body.message.trim() : '';

  if (!rawMessage) {
    return res.status(400).json({ success: false, message: 'Message is required' });
  }

  if (rawMessage.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({
      success: false,
      message: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer`,
    });
  }

  if (!isConfigured()) {
    return res.status(503).json({
      success: false,
      message: 'AI assistant is temporarily unavailable. Please try again later.',
    });
  }

  // An unknown or someone else's conversationId is a 404, not a silent new
  // thread — writing into a fresh conversation would hide the attempt.
  let conversation;
  if (conversationId) {
    conversation = await findOwnedConversation(conversationId, req.user._id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }
  } else {
    conversation = await AiConversation.create({ user: req.user._id });
  }

  try {
    const history = await AiMessage.find({ conversation: conversation._id, user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(HISTORY_TURN_LIMIT)
      .select('role message')
      .lean();

    // Persist the question before calling out: if Gemini fails, the customer's
    // message is still in the transcript rather than lost.
    await AiMessage.create({
      conversation: conversation._id,
      user: req.user._id,
      role: 'user',
      message: rawMessage,
    });

    const { reply, metadata } = await generateAssistantReply({
      // From the verified JWT via protectUser — never from req.body.
      userId: req.user._id,
      message: rawMessage,
      history: history.reverse(),
    });

    const assistantMessage = await AiMessage.create({
      conversation: conversation._id,
      user: req.user._id,
      role: 'assistant',
      message: reply,
      metadata,
    });

    // Title is seeded from the first question only, so renaming never surprises
    // a customer mid-thread.
    const set = { lastMessageAt: new Date() };
    if (conversation.messageCount === 0) {
      set.title = deriveTitle(rawMessage);
    }
    await AiConversation.updateOne(
      { _id: conversation._id, user: req.user._id },
      { $set: set, $inc: { messageCount: 2 } }
    );

    res.json({
      success: true,
      message: 'AI response generated successfully',
      data: {
        conversationId: conversation._id.toString(),
        response: reply,
        messageId: assistantMessage._id.toString(),
        // Diagnostics only. No prompt, no raw tool output, no ids.
        metadata: { model: metadata.model, toolsUsed: metadata.toolsUsed || [] },
      },
    });
  } catch (err) {
    if (err instanceof GeminiError) {
      // Mapped to a customer-safe sentence. The upstream detail was already
      // logged by geminiClient and never reaches the response body.
      const message =
        err.code === 'GEMINI_TIMEOUT'
          ? 'The assistant took too long to respond. Please try again.'
          : err.code === 'GEMINI_RATE_LIMITED'
            ? 'The assistant is busy right now. Please try again in a moment.'
            : err.code === 'GEMINI_NOT_CONFIGURED'
              ? 'AI assistant is temporarily unavailable. Please try again later.'
              : "Sorry, I couldn't process that right now. Please try again.";

      return res.status(err.status).json({ success: false, message, data: { conversationId: conversation._id.toString() } });
    }

    return next(err);
  }
}

module.exports = {
  chat,
  createConversation,
  listConversations,
  getConversation,
  deleteConversation,
  deriveTitle,
  MAX_MESSAGE_LENGTH,
};
