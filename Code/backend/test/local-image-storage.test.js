const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  uploadImage,
  ImageValidationError,
  UPLOAD_DIR,
} = require('../src/services/localImageStorage');

const imagePath = path.join(__dirname, '..', 'scripts', 'fixtures', 'test-image.png');
const testImageDataUri = `data:image/png;base64,${fs.readFileSync(imagePath).toString('base64')}`;

test('uploadImage saves a valid PNG data URI to disk and returns a resolvable local path', async () => {
  const url = await uploadImage(testImageDataUri);

  assert.match(url, /^\/uploads\/[0-9a-f-]+\.png$/);

  const savedPath = path.join(UPLOAD_DIR, path.basename(url));
  assert.strictEqual(fs.existsSync(savedPath), true);

  const written = fs.readFileSync(savedPath);
  const original = fs.readFileSync(imagePath);
  assert.deepStrictEqual(written, original);

  fs.unlinkSync(savedPath);
});

test('uploadImage rejects a non-data-URI string', async () => {
  await assert.rejects(() => uploadImage('not-a-data-uri'), ImageValidationError);
});

test('uploadImage rejects an unsupported mime type', async () => {
  const svgDataUri = `data:image/svg+xml;base64,${Buffer.from('<svg></svg>').toString('base64')}`;
  await assert.rejects(() => uploadImage(svgDataUri), ImageValidationError);
});

test('uploadImage rejects a payload over the size limit', async () => {
  const oversized = Buffer.alloc(6 * 1024 * 1024, 1).toString('base64');
  await assert.rejects(() => uploadImage(`data:image/png;base64,${oversized}`), ImageValidationError);
});

test('uploadImage rejects an empty payload', async () => {
  await assert.rejects(() => uploadImage('data:image/png;base64,'), ImageValidationError);
});
