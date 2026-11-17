const { test, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const app = require('../index.js');
const db = require('../src/db');
const { signSessionToken } = require('../src/services/sessionToken');

after(async () => {
  await db.destroy();
});

// Skipped until real Cloudinary credentials exist (task 0.10 — deferred).
// Fill in CLOUDINARY_* in .env and this activates automatically.
const hasCloudinaryCreds = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET,
);

test(
  "POST /claims/:id/distribute with a photo uploads it and the distribution row's photo_url matches",
  { skip: hasCloudinaryCreds ? false : 'CLOUDINARY_* not configured (task 0.10 deferred)' },
  async () => {
    const server = app.listen(0);
    const { port } = server.address();

    const [donor] = await db('users')
      .insert({
        name: 'Distribute Photo Test Donor',
        email: `claims-distribute-photo-donor-${Date.now()}@example.com`,
        phone: '+10000000060',
        role: 'donor',
      })
      .returning(['id']);
    const [listing] = await db('listings')
      .insert({
        donor_id: donor.id,
        status: 'picked_up',
        pickup_lat: 12.9,
        pickup_lng: 77.5,
        pickup_address_label: 'Test Area',
      })
      .returning(['id']);
    const [ngo] = await db('users')
      .insert({
        name: 'Distribute Photo Test NGO',
        email: `claims-distribute-photo-ngo-${Date.now()}@example.com`,
        phone: '+10000000061',
        role: 'ngo',
        org_name: 'Distribute Photo Org',
        registration_number: `REG-DISTPHOTO-${Date.now()}`,
        verification_status: 'verified',
      })
      .returning(['id']);
    const [claim] = await db('claims')
      .insert({ listing_id: listing.id, ngo_id: ngo.id })
      .returning(['id']);
    const token = signSessionToken({ id: ngo.id, role: 'ngo' });

    const imagePath = path.join(__dirname, '..', 'scripts', 'fixtures', 'test-image.png');
    const photoDataUri = `data:image/png;base64,${fs.readFileSync(imagePath).toString('base64')}`;

    try {
      const res = await fetch(`http://localhost:${port}/claims/${claim.id}/distribute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          receiver_first_name: 'Asha',
          receiver_general_area: 'Koramangala',
          photo: photoDataUri,
        }),
      });
      const body = await res.json();

      assert.strictEqual(res.status, 201);
      assert.match(body.distribution.photo_url, /^https:\/\/res\.cloudinary\.com\//);

      const row = await db('distributions').where({ listing_id: listing.id }).first();
      assert.strictEqual(row.photo_url, body.distribution.photo_url);
    } finally {
      await db('notifications').where({ listing_id: listing.id }).delete();
      await db('distributions').where({ listing_id: listing.id }).delete();
      await db('claims').where({ id: claim.id }).delete();
      await db('listings').where({ id: listing.id }).delete();
      await db('users').whereIn('id', [donor.id, ngo.id]).delete();
      server.close();
    }
  },
);
