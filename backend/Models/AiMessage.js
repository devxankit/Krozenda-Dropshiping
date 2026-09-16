const mongoose = require('mongoose');

const ROLES = ['user', 'assistant'];

// A single turn in an AiConversation. `user` is duplicated from the parent
// conversation deliberately: it makes every ownership check a direct filter
// and means a transcript row can never be read back without naming its
// owner, even if a future query forgets to join the conversation.
const aiMessageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'AiConversation', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ROLES, required: true },
    message: { type: String, required: true, trim: true, maxlength: 8000 },
    // Non-sensitive diagnostics only — which tools ran, the model id, latency.
    // Never a prompt, a token, or raw tool output (see services/aiAssistant.js).
    metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true }
);

// Transcript replay is always "this conversation, oldest first".
aiMessageSchema.index({ conversation: 1, createdAt: 1 });

const AiMessage = mongoose.model('AiMessage', aiMessageSchema);
AiMessage.ROLES = ROLES;

module.exports = AiMessage;
