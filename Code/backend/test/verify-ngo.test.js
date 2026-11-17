const test = require('node:test');
const assert = require('node:assert');
const { verifyNgo } = require('../src/services/verifyNgo');

test('verifyNgo resolves verified for an approved registration number', async () => {
  const result = await verifyNgo('APPROVED-001');
  assert.strictEqual(result.status, 'verified');
  assert.ok(result.source_ref);
});

test('verifyNgo resolves not_verified for an unrecognized registration number', async () => {
  const result = await verifyNgo('UNKNOWN-999');
  assert.strictEqual(result.status, 'not_verified');
  assert.strictEqual(result.source_ref, null);
});

test('verifyNgo fails safe to not_verified when the source times out', async () => {
  const result = await verifyNgo('TIMEOUT-001');
  assert.strictEqual(result.status, 'not_verified');
  assert.strictEqual(result.source_ref, null);
});
