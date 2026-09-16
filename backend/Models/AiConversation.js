const mongoose = require('mongoose');

// One AI Assistant chat thread. Named `user` (not `userId`) to match every
// other owned collection in this codebase — Order.user, Address.user,
// ReturnRequest.user — so the ownership filter looks identical everywhere.
//
// The ownership field is the ONLY thing that scopes an assistant reply to a
// customer, so nothing here is ever taken from a request body: the
// controller always writes req.user._id, resolved from the verified JWT.
const aiConversationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Seeded from the first user message (see aiAssistantController.deriveTitle)
    // and never rewritten afterwards, so a thread keeps a stable name in the
    // history list.
    title: { type: String, default: 'New chat', trim: true, maxlength: 120 },
    // Denormalised so the history list can sort/group by "last activity"
    // without a per-conversation lookup into AiMessage.
    lastMessageAt: { type: Date, default: Date.now },
    messageCount: { type: Number, default: 0, min: 0 },
    // Soft delete — history rows disappear from the customer's list but the
    // transcript is retained for support/audit, matching how the rest of the
    // project treats user-initiated deletes.
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Serves the history list query: { user, isDeleted } sorted by lastMessageAt.
aiConversationSchema.index({ user: 1, isDeleted: 1, lastMessageAt: -1 });

module.exports = mongoose.model('AiConversation', aiConversationSchema);
