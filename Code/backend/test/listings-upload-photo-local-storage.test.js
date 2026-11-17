const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const app = require('../index.js');
const { signSessionToken } = require('../src/services/sessionToken');
const { UPLOAD_DIR } = require('../src/services/localImageStorage');

// Confirms Task 13A end-to-end: with the default IMAGE_STORAGE_DRIVER=local,
// a donor's uploaded photo lands on disk under backend/uploads/ and is
// actually retrievable back over HTTP via the static /uploads route — the
// same round trip the frontend relies on to display it.
test('POST /listings/upload-photo (local driver) saves the file and serves it back over HTTP', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  const imagePath = path.join(__dirname, '..', 'scripts', 'fixtures', 'test-image.png');
  const photoDataUri = `data:image/png;base64,${fs.readFileSync(imagePath).toString('base64')}`;
  const donorToken = signSessionToken({ id: 'donor-local-1', role: 'donor' });

  try {
    const uploadRes = await fetch(`http://localhost:${port}/listings/upload-photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${donorToken}` },
      body: JSON.stringify({ photo: photoDataUri }),
    });
    const uploadBody = await uploadRes.json();

    assert.strictEqual(uploadRes.status, 201);
    assert.match(uploadBody.photo_url, /^\/uploads\/[0-9a-f-]+\.png$/);

    const savedPath = path.join(UPLOAD_DIR, path.basename(uploadBody.photo_url));
    assert.strictEqual(fs.existsSync(savedPath), true);

    const fetchedRes = await fetch(`http://localhost:${port}${uploadBody.photo_url}`);
    assert.strictEqual(fetchedRes.status, 200);
    assert.match(fetchedRes.headers.get('content-type') || '', /^image\/png/);

    fs.unlinkSync(savedPath);
  } finally {
    server.close();
  }
});

test('POST /listings/upload-photo (local driver) rejects a non-image payload with 400', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const donorToken = signSessionToken({ id: 'donor-local-2', role: 'donor' });

  try {
    const res = await fetch(`http://localhost:${port}/listings/upload-photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${donorToken}` },
      body: JSON.stringify({ photo: 'data:text/plain;base64,aGVsbG8=' }),
    });

    assert.strictEqual(res.status, 400);
  } finally {
    server.close();
  }
});
