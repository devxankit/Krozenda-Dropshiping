const express = require('express');
const {
  chat,
  createConversation,
  listConversations,
  getConversation,
  deleteConversation,
} = require('../Controllers/aiAssistantController');
const { protectUser } = require('../Middlewares/userAuthMiddleware');

const router = express.Router();

// Applied before every route below, with no exceptions and no opt-out — an
// unauthenticated call cannot reach a handler, so there is no path on which
// req.user could be missing and a query could go unscoped.
router.use(protectUser);

router.get('/conversations', listConversations);
router.post('/conversations', createConversation);
router.get('/conversations/:conversationId', getConversation);
router.delete('/conversations/:conversationId', deleteConversation);

// No per-user limit here by choice. This endpoint still sits behind the
// app-wide globalRateLimiter (600 requests / 15 min, see app.js), and the
// controller caps message length and replayed history, so a single turn stays
// bounded — but nothing now caps how MANY turns one account can run, and every
// turn is a paid Gemini call. Reinstate aiChatRateLimiter if spend becomes a
// concern.
router.post('/chat', chat);

module.exports = router;
