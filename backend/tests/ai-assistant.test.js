// The Gemini call is the one thing these tests must NOT make: a paid network
// round trip would make the suite slow, flaky and non-deterministic. The mock
// captures what the assistant was asked to do so the tool-scoping assertions
// can inspect it.
jest.mock('../services/geminiClient', () => {
  const actual = jest.requireActual('../services/geminiClient');
  return {
    ...actual,
    isConfigured: jest.fn(() => true),
    generateContent: jest.fn(),
  };
});

const request = require('supertest');
const app = require('../app');
const gemini = require('../services/geminiClient');
const Order = require('../Models/Order');
const AiConversation = require('../Models/AiConversation');
const AiMessage = require('../Models/AiMessage');
const aiTools = require('../services/aiTools');
const { connectTestDb, disconnectTestDb, createCustomer, createProduct } = require('./helpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(() => jest.clearAllMocks());

// Makes the mocked model answer with plain text, no tool call.
function respondWithText(text) {
  gemini.generateContent.mockResolvedValue({ role: 'model', parts: [{ text }] });
}

// Makes the mocked model call `name` with `args` on its first turn, then
// summarise on its second — the real two-round shape.
function respondWithToolCall(name, args = {}, finalText = 'Done.') {
  gemini.generateContent
    .mockResolvedValueOnce({ role: 'model', parts: [{ functionCall: { name, args } }] })
    .mockResolvedValueOnce({ role: 'model', parts: [{ text: finalText }] });
}

async function placeOrder(userId, overrides = {}) {
  const product = await createProduct({ price: 1299 });
  return Order.create({
    user: userId,
    items: [
      {
        product: product._id,
        name: 'Wireless Earphones',
        price: 1299,
        quantity: 1,
        status: overrides.itemStatus || 'PENDING',
        trackingNumber: overrides.trackingNumber || '',
        courierName: overrides.courierName || '',
      },
    ],
    shippingAddress: {
      fullName: 'Test Buyer',
      phone: '9998887771',
      line1: '123 Test Street',
      city: 'Mumbai',
      state: 'MH',
      pincode: '400001',
    },
    subtotal: 1299,
    total: 1299,
    paymentMethod: 'COD',
    status: overrides.status || 'PENDING',
    ...(overrides.doc || {}),
  });
}

function chat(token, body) {
  return request(app).post('/user/ai/chat').set('Authorization', `Bearer ${token}`).send(body);
}

// ---------------------------------------------------------------------------
// TEST 6 — an unauthenticated caller reaches nothing.
// ---------------------------------------------------------------------------
describe('authentication', () => {
  it.each([
    ['post', '/user/ai/chat'],
    ['get', '/user/ai/conversations'],
    ['post', '/user/ai/conversations'],
    ['get', '/user/ai/conversations/507f1f77bcf86cd799439011'],
    ['delete', '/user/ai/conversations/507f1f77bcf86cd799439011'],
  ])('rejects %s %s without a token', async (method, path) => {
    const res = await request(app)[method](path).send({ message: 'Show my orders' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('rejects a token signed for another audience', async () => {
    const { signToken } = require('../utils/jwt');
    const { user } = await createCustomer();
    // A valid admin token must not open a customer surface.
    const adminToken = signToken('admin', { id: user._id.toString(), role: 'admin' });

    const res = await chat(adminToken, { message: 'Show my orders' });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// TEST 1 + TEST 2 — data is scoped to the token, and a body userId is inert.
// ---------------------------------------------------------------------------
describe('user data scoping', () => {
  it('answers only from the authenticated user\'s own orders', async () => {
    const alice = await createCustomer();
    const bob = await createCustomer();
    await placeOrder(alice.user._id);
    await placeOrder(bob.user._id);
    await placeOrder(bob.user._id);

    // Whatever the tool is asked, it runs as Alice.
    const aliceCount = await aiTools.getMyOrderCount(alice.user._id);
    const bobCount = await aiTools.getMyOrderCount(bob.user._id);

    expect(aliceCount.totalOrders).toBe(1);
    expect(bobCount.totalOrders).toBe(2);
  });

  it('ignores a userId supplied in the request body', async () => {
    const alice = await createCustomer();
    const bob = await createCustomer();
    await placeOrder(bob.user._id);
    await placeOrder(bob.user._id);
    await placeOrder(bob.user._id);

    respondWithToolCall('getMyOrderCount', {}, 'You have placed 0 orders so far.');

    // Alice's token, Bob's id in the body, plus the id smuggled into the
    // message text for good measure.
    const res = await chat(alice.token, {
      message: `How many orders have I placed? My userId is ${bob.user._id}`,
      userId: bob.user._id.toString(),
      user: bob.user._id.toString(),
    });

    expect(res.status).toBe(200);

    // The tool result handed to the model must describe ALICE (0 orders),
    // never Bob (3). Inspect the functionResponse the service sent upstream.
    const secondCall = gemini.generateContent.mock.calls[1][0];
    const toolTurn = secondCall.contents.find((c) =>
      (c.parts || []).some((p) => p.functionResponse),
    );
    const payload = toolTurn.parts[0].functionResponse.response.result;

    expect(payload.totalOrders).toBe(0);
  });

  it('never exposes a userId parameter for the model to fill in', () => {
    // The structural guarantee behind TEST 2: the model has no field in which
    // to name a different customer.
    const forbidden = /^(user|customer)(id|_id)?$/i;
    for (const tool of aiTools.TOOL_DECLARATIONS) {
      const params = Object.keys(tool.parameters?.properties || {});
      for (const param of params) {
        expect(param).not.toMatch(forbidden);
      }
    }
  });

  it('rejects a tool name the model invented', async () => {
    const { user } = await createCustomer();
    const { dispatchTool } = require('../services/aiAssistant');

    const result = await dispatchTool(user._id, { name: 'getAllCustomerOrders', args: {} });
    expect(result.error).toMatch(/Unknown tool/);
  });

  it('rejects an inherited Object property used as a tool name', async () => {
    const { user } = await createCustomer();
    const { dispatchTool } = require('../services/aiAssistant');

    const result = await dispatchTool(user._id, { name: 'constructor', args: {} });
    expect(result.error).toMatch(/Unknown tool/);
  });
});

// ---------------------------------------------------------------------------
// TEST 3 — another customer's order id is "not found", never "not yours".
// ---------------------------------------------------------------------------
describe('order ownership', () => {
  it('returns not-found for an order belonging to another customer', async () => {
    const alice = await createCustomer();
    const bob = await createCustomer();
    const bobsOrder = await placeOrder(bob.user._id);

    const byId = await aiTools.getMyOrderById(alice.user._id, { orderId: bobsOrder._id.toString() });
    const byStatus = await aiTools.getMyOrderStatus(alice.user._id, { orderId: bobsOrder._id.toString() });

    expect(byId.found).toBe(false);
    expect(byStatus.found).toBe(false);
    // The wording must not confirm the order exists elsewhere.
    expect(JSON.stringify(byId)).not.toMatch(/another|other user|unauthor|forbidden/i);
  });

  it('returns not-found for another customer\'s short order reference', async () => {
    const alice = await createCustomer();
    const bob = await createCustomer();
    const bobsOrder = await placeOrder(bob.user._id);
    const shortRef = aiTools.orderRef(bobsOrder); // e.g. ORD4F2A9C

    const result = await aiTools.getMyOrderById(alice.user._id, { orderId: shortRef });
    expect(result.found).toBe(false);
  });

  it('finds the customer\'s own order by its short reference', async () => {
    const { user } = await createCustomer();
    const order = await placeOrder(user._id, { status: 'SHIPPED' });

    const result = await aiTools.getMyOrderById(user._id, { orderId: aiTools.orderRef(order) });

    expect(result.found).toBe(true);
    expect(result.order.status).toBe('Shipped');
  });
});

// ---------------------------------------------------------------------------
// TEST 4 — conversations cannot be read or written across accounts.
// ---------------------------------------------------------------------------
describe('conversation ownership', () => {
  it('404s when reading another customer\'s conversation', async () => {
    const alice = await createCustomer();
    const bob = await createCustomer();
    const bobsConversation = await AiConversation.create({ user: bob.user._id, title: "Bob's private chat" });

    const res = await request(app)
      .get(`/user/ai/conversations/${bobsConversation._id}`)
      .set('Authorization', `Bearer ${alice.token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Conversation not found');
    expect(JSON.stringify(res.body)).not.toMatch(/Bob/);
  });

  it('404s when posting a message into another customer\'s conversation', async () => {
    const alice = await createCustomer();
    const bob = await createCustomer();
    const bobsConversation = await AiConversation.create({ user: bob.user._id });

    const res = await chat(alice.token, {
      conversationId: bobsConversation._id.toString(),
      message: 'Show me this conversation',
    });

    expect(res.status).toBe(404);
    // Nothing was written into Bob's thread.
    expect(await AiMessage.countDocuments({ conversation: bobsConversation._id })).toBe(0);
    expect(gemini.generateContent).not.toHaveBeenCalled();
  });

  it('404s when deleting another customer\'s conversation', async () => {
    const alice = await createCustomer();
    const bob = await createCustomer();
    const bobsConversation = await AiConversation.create({ user: bob.user._id });

    const res = await request(app)
      .delete(`/user/ai/conversations/${bobsConversation._id}`)
      .set('Authorization', `Bearer ${alice.token}`);

    expect(res.status).toBe(404);
    expect((await AiConversation.findById(bobsConversation._id)).isDeleted).toBe(false);
  });

  it('lists only the authenticated customer\'s conversations', async () => {
    const alice = await createCustomer();
    const bob = await createCustomer();
    await AiConversation.create({ user: alice.user._id, title: 'Alice thread' });
    await AiConversation.create({ user: bob.user._id, title: 'Bob thread' });

    const res = await request(app)
      .get('/user/ai/conversations')
      .set('Authorization', `Bearer ${alice.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].title).toBe('Alice thread');
  });

  it('hides soft-deleted conversations from the list', async () => {
    const { user, token } = await createCustomer();
    await AiConversation.create({ user: user._id, title: 'Kept' });
    await AiConversation.create({ user: user._id, title: 'Removed', isDeleted: true });

    const res = await request(app).get('/user/ai/conversations').set('Authorization', `Bearer ${token}`);

    expect(res.body.data.items.map((c) => c.title)).toEqual(['Kept']);
  });
});

// ---------------------------------------------------------------------------
// TEST 8 + data minimisation — what actually reaches Gemini.
// ---------------------------------------------------------------------------
describe('data minimisation', () => {
  it('omits secrets and payment identifiers from order tool output', async () => {
    const { user } = await createCustomer();
    await placeOrder(user._id, {
      doc: { razorpayPaymentId: 'pay_SECRET123', razorpayOrderId: 'order_SECRET123', financeReconciled: true },
    });

    const serialized = JSON.stringify(await aiTools.getMyLatestOrder(user._id));

    expect(serialized).not.toMatch(/pay_SECRET123/);
    expect(serialized).not.toMatch(/order_SECRET123/);
    expect(serialized).not.toMatch(/razorpay/i);
    expect(serialized).not.toMatch(/financeReconciled/);
    // Nor the recipient's name/phone/street — city/state/pincode is enough.
    expect(serialized).not.toMatch(/9998887771/);
    expect(serialized).not.toMatch(/123 Test Street/);
  });

  it('returns the caller own profile in full but never a password', async () => {
    const email = `rahul${Date.now()}@example.com`;
    const { user } = await createCustomer({ name: 'Rahul', email, password: 'secret123' });

    const profile = await aiTools.getMyProfile(user._id);

    // Their own details are returned unmasked — the Edit Profile screen
    // already shows these, so redacting them here only crippled the answers.
    // The boundary that matters is that userId is the authenticated id.
    expect(profile.name).toBe('Rahul');
    expect(profile.email).toBe(email);
    expect(profile.mobileNumber).toBe(user.mobileNumber);

    // Credentials, however, are never in reach.
    expect(Object.keys(profile)).not.toContain('password');
    expect(JSON.stringify(profile)).not.toMatch(/secret123/);
    expect(JSON.stringify(profile)).not.toMatch(/\$2[aby]\$/);
  });

  it('never sends a password hash or token to the model', async () => {
    const { user, token } = await createCustomer({ password: 'secret123' });
    await placeOrder(user._id);
    respondWithToolCall('getMyProfile', {}, 'You joined in 2026.');

    await chat(token, { message: 'What is my account info?' });

    const everythingSentUpstream = JSON.stringify(gemini.generateContent.mock.calls);
    expect(everythingSentUpstream).not.toMatch(/secret123/);
    expect(everythingSentUpstream).not.toMatch(/\$2[aby]\$/); // bcrypt hash prefix
    expect(everythingSentUpstream).not.toMatch(token);
  });

  it('reports no estimated delivery date rather than inventing one', async () => {
    const { user } = await createCustomer();
    await placeOrder(user._id, { status: 'SHIPPED' });

    const result = await aiTools.getMyLatestOrder(user._id);

    expect(result.order.expectedDeliveryDate).toBeNull();
    expect(result.order.expectedDeliveryNote).toMatch(/does not store an estimated delivery date/);
  });

  it('omits tracking fields entirely when the order has none', async () => {
    const { user } = await createCustomer();
    await placeOrder(user._id, { status: 'SHIPPED' });

    const status = await aiTools.getMyOrderStatus(user._id, {
      orderId: (await Order.findOne({ user: user._id }))._id.toString(),
    });

    expect(status.shipments).toEqual([]);
  });

  it('surfaces real tracking when the order has it', async () => {
    const { user } = await createCustomer();
    await placeOrder(user._id, {
      status: 'SHIPPED',
      itemStatus: 'SHIPPED',
      trackingNumber: 'TRK99887',
      courierName: 'Delhivery',
    });

    const order = await Order.findOne({ user: user._id });
    const status = await aiTools.getMyOrderStatus(user._id, { orderId: order._id.toString() });

    expect(status.shipments).toHaveLength(1);
    expect(status.shipments[0]).toMatchObject({ trackingNumber: 'TRK99887', courier: 'Delhivery' });
  });
});

// ---------------------------------------------------------------------------
// Chat + history behaviour.
// ---------------------------------------------------------------------------
describe('chat flow', () => {
  it('creates a conversation, persists both turns and titles the thread', async () => {
    const { user, token } = await createCustomer();
    await placeOrder(user._id);
    respondWithToolCall('getMyOrderCount', {}, 'You have placed 1 order so far.');

    const res = await chat(token, { message: 'How many orders have I placed?' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: 'AI response generated successfully' });
    expect(res.body.data.response).toBe('You have placed 1 order so far.');
    expect(res.body.data.conversationId).toBeTruthy();

    const messages = await AiMessage.find({ conversation: res.body.data.conversationId }).sort({ createdAt: 1 });
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ role: 'user', message: 'How many orders have I placed?' });
    expect(messages[1].role).toBe('assistant');
    // Both rows carry the authenticated owner.
    expect(messages.every((m) => m.user.equals(user._id))).toBe(true);

    const conversation = await AiConversation.findById(res.body.data.conversationId);
    expect(conversation.title).toBe('How many orders have I placed?');
    expect(conversation.messageCount).toBe(2);
  });

  it('continues an existing conversation and replays prior turns', async () => {
    const { token } = await createCustomer();
    respondWithText('First answer.');
    const first = await chat(token, { message: 'Hello' });

    jest.clearAllMocks();
    respondWithText('Second answer.');
    const second = await chat(token, {
      conversationId: first.body.data.conversationId,
      message: 'And my orders?',
    });

    expect(second.body.data.conversationId).toBe(first.body.data.conversationId);

    // The model saw the earlier turns plus the new question.
    const contents = gemini.generateContent.mock.calls[0][0].contents;
    expect(contents.map((c) => c.parts[0].text)).toEqual(['Hello', 'First answer.', 'And my orders?']);
    expect(await AiMessage.countDocuments({ conversation: first.body.data.conversationId })).toBe(4);
  });

  it('starts a new conversation without touching the previous one', async () => {
    const { user, token } = await createCustomer();
    respondWithText('Answer one.');
    const first = await chat(token, { message: 'First question' });

    respondWithText('Answer two.');
    const second = await chat(token, { message: 'Second question' });

    expect(second.body.data.conversationId).not.toBe(first.body.data.conversationId);
    // The original thread is intact — New Chat never deletes.
    expect(await AiMessage.countDocuments({ conversation: first.body.data.conversationId })).toBe(2);
    expect(await AiConversation.countDocuments({ user: user._id, isDeleted: false })).toBe(2);
  });

  it('caps the replayed history instead of growing without bound', async () => {
    const { user, token } = await createCustomer();
    const conversation = await AiConversation.create({ user: user._id, messageCount: 60 });

    for (let i = 0; i < 30; i += 1) {
      await AiMessage.create({
        conversation: conversation._id,
        user: user._id,
        role: i % 2 === 0 ? 'user' : 'assistant',
        message: `turn ${i}`,
      });
    }

    respondWithText('Bounded.');
    await chat(token, { conversationId: conversation._id.toString(), message: 'latest' });

    const { HISTORY_TURN_LIMIT } = require('../services/aiAssistant');
    const contents = gemini.generateContent.mock.calls[0][0].contents;
    // Prior turns, capped, plus the new message.
    expect(contents.length).toBe(HISTORY_TURN_LIMIT + 1);
    expect(contents[contents.length - 1].parts[0].text).toBe('latest');
  });

  it('soft-deletes a conversation and keeps the transcript', async () => {
    const { user, token } = await createCustomer();
    respondWithText('Answer.');
    const created = await chat(token, { message: 'A question' });
    const id = created.body.data.conversationId;

    const res = await request(app)
      .delete(`/user/ai/conversations/${id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect((await AiConversation.findById(id)).isDeleted).toBe(true);
    // Retained for support/audit, just no longer listed.
    expect(await AiMessage.countDocuments({ conversation: id })).toBe(2);

    const list = await request(app).get('/user/ai/conversations').set('Authorization', `Bearer ${token}`);
    expect(list.body.data.items).toHaveLength(0);
    // And it can no longer be reopened.
    expect(
      (await request(app).get(`/user/ai/conversations/${id}`).set('Authorization', `Bearer ${token}`)).status,
    ).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Input validation and upstream failure handling.
// ---------------------------------------------------------------------------
describe('validation and error handling', () => {
  it('rejects an empty message', async () => {
    const { token } = await createCustomer();
    const res = await chat(token, { message: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Message is required');
    expect(gemini.generateContent).not.toHaveBeenCalled();
  });

  it('rejects an over-long message', async () => {
    const { token } = await createCustomer();
    const res = await chat(token, { message: 'x'.repeat(2001) });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/2000 characters or fewer/);
    expect(gemini.generateContent).not.toHaveBeenCalled();
  });

  it('404s on a malformed conversationId', async () => {
    const { token } = await createCustomer();
    const res = await chat(token, { conversationId: 'not-an-object-id', message: 'Hi' });

    expect(res.status).toBe(404);
  });

  it('returns a customer-safe message on a Gemini timeout', async () => {
    const { token } = await createCustomer();
    const { GeminiError } = jest.requireActual('../services/geminiClient');
    gemini.generateContent.mockRejectedValue(
      new GeminiError('upstream detail that must not leak', { status: 504, code: 'GEMINI_TIMEOUT' }),
    );

    const res = await chat(token, { message: 'Where is my order?' });

    expect(res.status).toBe(504);
    expect(res.body.message).toBe('The assistant took too long to respond. Please try again.');
    expect(JSON.stringify(res.body)).not.toMatch(/upstream detail/);
  });

  it('keeps the customer\'s message when the model call fails', async () => {
    const { token } = await createCustomer();
    const { GeminiError } = jest.requireActual('../services/geminiClient');
    gemini.generateContent.mockRejectedValue(new GeminiError('boom', { status: 502, code: 'GEMINI_ERROR' }));

    const res = await chat(token, { message: 'Where is my order?' });
    const conversationId = res.body.data.conversationId;

    const messages = await AiMessage.find({ conversation: conversationId });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ role: 'user', message: 'Where is my order?' });
  });

  it('returns 503 when no Gemini key is configured', async () => {
    const { token } = await createCustomer();
    gemini.isConfigured.mockReturnValueOnce(false);

    const res = await chat(token, { message: 'Hello' });

    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/temporarily unavailable/);
  });

  it('falls back to a safe reply when the model is blocked', async () => {
    const { token } = await createCustomer();
    gemini.generateContent.mockResolvedValue({ role: 'model', parts: [], blocked: true, finishReason: 'SAFETY' });

    const res = await chat(token, { message: 'Hello' });

    const { FALLBACK_REPLY } = require('../services/aiAssistant');
    expect(res.status).toBe(200);
    expect(res.body.data.response).toBe(FALLBACK_REPLY);
  });

  it('stops after the tool-round limit instead of looping', async () => {
    const { token } = await createCustomer();
    // The model never stops asking for tools.
    gemini.generateContent.mockResolvedValue({
      role: 'model',
      parts: [{ functionCall: { name: 'getMyOrderCount', args: {} } }],
    });

    const res = await chat(token, { message: 'How many orders?' });

    const { MAX_TOOL_ROUNDS, FALLBACK_REPLY } = require('../services/aiAssistant');
    expect(gemini.generateContent).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS);
    expect(res.body.data.response).toBe(FALLBACK_REPLY);
  });

  it('rejects an unknown status without querying', async () => {
    const { user } = await createCustomer();
    const result = await aiTools.getMyOrderCountByStatus(user._id, { status: 'OUT_FOR_DELIVERY' });

    expect(result.error).toMatch(/Unknown status/);
    expect(result.validStatuses).toEqual(Order.STATUSES);
  });

  it('caps how many orders one tool call can return', async () => {
    const { user } = await createCustomer();
    for (let i = 0; i < 12; i += 1) await placeOrder(user._id);

    // The model asks for 500; it gets the ceiling.
    const result = await aiTools.getMyRecentOrders(user._id, { limit: 500 });
    expect(result.orders).toHaveLength(10);
  });
});
