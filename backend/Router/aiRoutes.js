const express = require('express');
const {
  chat,
  createConversation,
  listConversations,
  getConversation,
  deleteConversation,
} = require('../Controllers/aiAssistantController');
const { protectUser } = require('../Middlewares/userAuthMiddleware');
const { aiChatRateLimiter } = require('../Middlewares/rateLimiter');

const router = express.Router();

// Applied before every route below, with no exceptions and no opt-out — an
// unauthenticated call cannot reach a handler, so there is no path on which
// req.user could be missing and a query could go unscoped.
router.use(protectUser);

router.get('/conversations', listConversations);
router.post('/conversations', createConversation);
router.get('/conversations/:conversationId', getConversation);
router.delete('/conversations/:conversationId', deleteConversation);

// Only the Gemini-backed endpoint carries the tighter per-user limit; reading
// your own history is cheap and stays on the global limiter.
router.post('/chat', aiChatRateLimiter, chat);

module.exports = router;
