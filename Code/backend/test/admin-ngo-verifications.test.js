const { test, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');
const { signSessionToken } = require('../src/services/sessionToken');

after(async () => {
  await db.destroy();
});

test('GET /admin/ngo-verifications lists both verified and not_verified NGOs with correct fields', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  const [verifiedNgo] = await db('users')
    .insert({
      name: 'Audit Verified NGO',
      email: `admin-ngo-verifications-verified-${Date.now()}@example.com`,
      phone: '+10000000090',
      role: 'ngo',
      org_name: 'Audit Verified Org',
      registration_number: `REG-AUDITVERIFIED-${Date.now()}`,
      verification_status: 'verified',
      verification_checked_at: db.fn.now(),
      verification_source_ref: 'stub-source-ref:audit-verified',
    })
    .returning(['id']);
  const [notVerifiedNgo] = await db('users')
    .insert({
      name: 'Audit Not Verified NGO',
      email: `admin-ngo-verifications-notverified-${Date.now()}@example.com`,
      phone: '+10000000091',
      role: 'ngo',
      org_name: 'Audit Not Verified Org',
      registration_number: `REG-AUDITNOTVERIFIED-${Date.now()}`,
      verification_status: 'not_verified',
      verification_checked_at: db.fn.now(),
    })
    .returning(['id']);
  const adminToken = signSessionToken({ id: 'admin-1', role: 'admin' });

  try {
    const res = await fetch(`http://localhost:${port}/admin/ngo-verifications`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const body = await res.json();

    assert.strictEqual(res.status, 200);

    const verifiedEntry = body.find((v) => v.id === verifiedNgo.id);
    const notVerifiedEntry = body.find((v) => v.id === notVerifiedNgo.id);

    assert.ok(verifiedEntry, 'the verified NGO must appear');
    assert.strictEqual(verifiedEntry.org_name, 'Audit Verified Org');
    assert.strictEqual(verifiedEntry.verification_status, 'verified');
    assert.strictEqual(verifiedEntry.verification_source_ref, 'stub-source-ref:audit-verified');
    assert.ok(verifiedEntry.verification_checked_at);

    assert.ok(notVerifiedEntry, 'the not_verified NGO must appear');
    assert.strictEqual(notVerifiedEntry.org_name, 'Audit Not Verified Org');
    assert.strictEqual(notVerifiedEntry.verification_status, 'not_verified');
    assert.strictEqual(notVerifiedEntry.verification_source_ref, null);
  } finally {
    await db('users').whereIn('id', [verifiedNgo.id, notVerifiedNgo.id]).delete();
    server.close();
  }
});
