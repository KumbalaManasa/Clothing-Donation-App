const test = require('node:test');
const assert = require('node:assert');
const { createAuthMiddleware } = require('../src/middleware/auth');

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test('valid token calls next() and attaches req.user', async () => {
  const middleware = createAuthMiddleware(async (token) => {
    assert.strictEqual(token, 'valid-token');
    return { uid: 'user-123' };
  });

  const req = { headers: { authorization: 'Bearer valid-token' } };
  const res = mockRes();
  let nextCalled = false;

  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true);
  assert.deepStrictEqual(req.user, { uid: 'user-123' });
  assert.strictEqual(res.statusCode, null);
});

test('missing Authorization header returns 401', async () => {
  const middleware = createAuthMiddleware(async () => ({ uid: 'should-not-be-reached' }));
  const req = { headers: {} };
  const res = mockRes();

  await middleware(req, res, () => {
    throw new Error('next() should not be called');
  });

  assert.strictEqual(res.statusCode, 401);
});

test('invalid/expired token returns 401', async () => {
  const middleware = createAuthMiddleware(async () => {
    throw new Error('Firebase: token expired');
  });
  const req = { headers: { authorization: 'Bearer bad-token' } };
  const res = mockRes();

  await middleware(req, res, () => {
    throw new Error('next() should not be called');
  });

  assert.strictEqual(res.statusCode, 401);
});

test('malformed Authorization header (no Bearer scheme) returns 401', async () => {
  const middleware = createAuthMiddleware(async () => ({ uid: 'should-not-be-reached' }));
  const req = { headers: { authorization: 'Basic sometoken' } };
  const res = mockRes();

  await middleware(req, res, () => {
    throw new Error('next() should not be called');
  });

  assert.strictEqual(res.statusCode, 401);
});
