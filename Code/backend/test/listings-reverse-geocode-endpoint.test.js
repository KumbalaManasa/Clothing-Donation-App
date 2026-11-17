const test = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const { signSessionToken } = require('../src/services/sessionToken');

test('GET /listings/reverse-geocode returns the matching area label for known coordinates', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const donorToken = signSessionToken({ id: 'donor-1', role: 'donor' });

    const res = await fetch(
      `http://localhost:${port}/listings/reverse-geocode?lat=12.9352&lng=77.6245`,
      { headers: { Authorization: `Bearer ${donorToken}` } },
    );
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.address_label, 'Koramangala');
  } finally {
    server.close();
  }
});

test('GET /listings/reverse-geocode without lat/lng returns 400', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const donorToken = signSessionToken({ id: 'donor-1', role: 'donor' });

    const res = await fetch(`http://localhost:${port}/listings/reverse-geocode`, {
      headers: { Authorization: `Bearer ${donorToken}` },
    });

    assert.strictEqual(res.status, 400);
  } finally {
    server.close();
  }
});
