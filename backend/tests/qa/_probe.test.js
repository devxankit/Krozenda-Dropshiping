const request = require('supertest');
const h = require('./qaHelpers');
beforeAll(h.connectTestDb); afterAll(h.disconnectTestDb);
test('probe', async () => {
  const out = {};
  out.inj = (await request(h.app).post('/admin/auth/login').send({ email: { $ne: null }, password: 'x' })).status;
  const st = []; for (let i=0;i<25;i++) st.push((await request(h.app).post('/admin/auth/login').send({ email: 'nobody@x.y', password: 'w'+i })).status);
  out.bf = [...new Set(st)];
  const m='9222200099'; await request(h.app).post('/auth/send-otp').send({ mobileNumber: m });
  for (let i=0;i<5;i++) await request(h.app).post('/auth/verify-otp').send({ mobileNumber: m, otp: '000000' });
  out.locked = (await request(h.app).post('/auth/verify-otp').send({ mobileNumber: m, otp: '000000' })).body.message;
  out.resend = (await request(h.app).post('/auth/send-otp').send({ mobileNumber: m })).status;
  out.afterResend = (await request(h.app).post('/auth/verify-otp').send({ mobileNumber: m, otp: '000001' })).body.message;
  let prod; process.env.ENV='production'; process.env.ALLOWED_ORIGINS='https://a.example'; jest.isolateModules(()=>{prod=require('../../app')}); process.env.ENV='test';
  const c = await request(prod).get('/health').set('Origin','https://evil.example'); out.cors=[c.status,c.body.message];
  console.log('PROBE', JSON.stringify(out));
});
