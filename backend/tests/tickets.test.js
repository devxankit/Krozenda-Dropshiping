const request = require('supertest');
const app = require('../app');
const { connectTestDb, disconnectTestDb, createCustomer } = require('./helpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

describe('support ticket IDOR (regression)', () => {
  it('an unauthenticated caller cannot read a ticket that belongs to a real account', async () => {
    const { token } = await createCustomer();
    const create = await request(app)
      .post('/user/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'Private issue', message: 'sensitive details' });

    const ticketId = create.body.data.ticketId;

    const res = await request(app).get(`/user/tickets/${ticketId}`);
    expect(res.status).toBe(403);
  });

  it('a different logged-in user cannot read, reply to, or close someone else\'s ticket', async () => {
    const { token: ownerToken } = await createCustomer();
    const { token: attackerToken } = await createCustomer();

    const create = await request(app)
      .post('/user/tickets')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ subject: 'Owner only', message: 'do not leak' });
    const ticketId = create.body.data.ticketId;

    const read = await request(app).get(`/user/tickets/${ticketId}`).set('Authorization', `Bearer ${attackerToken}`);
    expect(read.status).toBe(403);

    const reply = await request(app)
      .post(`/user/tickets/${ticketId}/messages`)
      .set('Authorization', `Bearer ${attackerToken}`)
      .send({ message: 'hijack attempt' });
    expect(reply.status).toBe(403);

    const close = await request(app)
      .patch(`/user/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${attackerToken}`)
      .send({ status: 'closed' });
    expect(close.status).toBe(403);
  });

  it('the real owner can still read and reply to their own ticket', async () => {
    const { token } = await createCustomer();
    const create = await request(app)
      .post('/user/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'My issue', message: 'hello' });
    const ticketId = create.body.data.ticketId;

    const read = await request(app).get(`/user/tickets/${ticketId}`).set('Authorization', `Bearer ${token}`);
    expect(read.status).toBe(200);

    const reply = await request(app)
      .post(`/user/tickets/${ticketId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'follow up' });
    expect(reply.status).toBe(200);
  });

  it('a guest (no owner) ticket is still reachable by its id, unauthenticated', async () => {
    const create = await request(app)
      .post('/user/tickets')
      .send({ subject: 'Guest question', message: 'before I sign up', name: 'Guest', email: 'guest@test.local', phone: '9990001111' });
    expect(create.status).toBe(201);
    const ticketId = create.body.data.ticketId;

    const read = await request(app).get(`/user/tickets/${ticketId}`);
    expect(read.status).toBe(200);
  });
});
