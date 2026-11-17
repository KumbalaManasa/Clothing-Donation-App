const test = require('node:test');
const assert = require('node:assert');
const { startClaimExpiryJob, getIntervalMs, DEFAULT_INTERVAL_MS } = require('../src/jobs/claimExpiryJob');

test('startClaimExpiryJob fires the callback on the configured interval (mocked clock)', (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });

  const originalEnv = process.env.CLAIM_EXPIRY_JOB_INTERVAL_MS;
  process.env.CLAIM_EXPIRY_JOB_INTERVAL_MS = '300000'; // 5 minutes

  let callCount = 0;
  const timer = startClaimExpiryJob(() => {
    callCount += 1;
  });

  try {
    assert.strictEqual(callCount, 0, 'must not fire immediately');

    t.mock.timers.tick(299999);
    assert.strictEqual(callCount, 0, 'must not fire before the interval elapses');

    t.mock.timers.tick(1);
    assert.strictEqual(callCount, 1, 'must fire once the interval elapses');

    t.mock.timers.tick(300000);
    assert.strictEqual(callCount, 2, 'must keep firing on every subsequent interval');
  } finally {
    clearInterval(timer);
    if (originalEnv === undefined) {
      delete process.env.CLAIM_EXPIRY_JOB_INTERVAL_MS;
    } else {
      process.env.CLAIM_EXPIRY_JOB_INTERVAL_MS = originalEnv;
    }
  }
});

test('getIntervalMs defaults to 5 minutes when CLAIM_EXPIRY_JOB_INTERVAL_MS is not set', () => {
  const originalEnv = process.env.CLAIM_EXPIRY_JOB_INTERVAL_MS;
  delete process.env.CLAIM_EXPIRY_JOB_INTERVAL_MS;

  try {
    assert.strictEqual(getIntervalMs(), DEFAULT_INTERVAL_MS);
    assert.strictEqual(DEFAULT_INTERVAL_MS, 5 * 60 * 1000);
  } finally {
    if (originalEnv !== undefined) {
      process.env.CLAIM_EXPIRY_JOB_INTERVAL_MS = originalEnv;
    }
  }
});
