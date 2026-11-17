const test = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const { signSessionToken } = require('../src/services/sessionToken');

test('POST /listings/upload-photo with a non-donor token returns 403', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const ngoToken = signSessionToken({ id: 'ngo-1', role: 'ngo' });

    const res = await fetch(`http://localhost:${port}/listings/upload-photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ngoToken}` },
      body: JSON.stringify({ photo: 'data:image/png;base64,AAAA' }),
    });

    assert.strictEqual(res.status, 403);
  } finally {
    server.close();
  }
});

test('POST /listings/upload-photo without a photo returns 400', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const donorToken = signSessionToken({ id: 'donor-1', role: 'donor' });

    const res = await fetch(`http://localhost:${port}/listings/upload-photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${donorToken}` },
      body: JSON.stringify({}),
    });

    assert.strictEqual(res.status, 400);
  } finally {
    server.close();
  }
});
