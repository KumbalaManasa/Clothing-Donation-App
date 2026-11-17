const { test } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const { signSessionToken } = require('../src/services/sessionToken');

// spec.md §3/§6.6: deliberately no manual admin fallback for NGO verification.
// This confirms it stays that way — any plausible mutating route an admin
// might expect (approve/reject/patch verification_status) simply doesn't exist.
test('no route exists to mutate an NGO\'s verification_status from the admin surface', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const adminToken = signSessionToken({ id: 'admin-1', role: 'admin' });

  const hypotheticalRoutes = [
    { method: 'PATCH', path: '/admin/ngo-verifications/some-id' },
    { method: 'PUT', path: '/admin/ngo-verifications/some-id' },
    { method: 'POST', path: '/admin/ngo-verifications/some-id/approve' },
    { method: 'POST', path: '/admin/ngo-verifications/some-id/reject' },
    { method: 'PATCH', path: '/admin/users/some-id' },
  ];

  try {
    for (const { method, path } of hypotheticalRoutes) {
      const res = await fetch(`http://localhost:${port}${path}`, {
        method,
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 404, `${method} ${path} must not exist`);
    }
  } finally {
    server.close();
  }
});
