const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { uploadImage } = require('../src/services/cloudinary');

// Skipped until real Cloudinary credentials exist (task 0.10 — deferred).
// Fill in CLOUDINARY_* in .env and this activates automatically, no code change needed.
const hasCloudinaryCreds = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET,
);

test(
  'uploadImage uploads a test image and returns a resolvable URL',
  { skip: hasCloudinaryCreds ? false : 'CLOUDINARY_* not configured (task 0.10 deferred)' },
  async () => {
    const imagePath = path.join(__dirname, '..', 'scripts', 'fixtures', 'test-image.png');

    const url = await uploadImage(imagePath, { folder: 'donation-app-test' });
    assert.match(url, /^https:\/\/res\.cloudinary\.com\//);

    const res = await fetch(url);
    assert.strictEqual(res.status, 200);
  },
);
