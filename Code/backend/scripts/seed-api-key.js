const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('../src/db');

const TEST_API_KEY = 'don_live_sec_testapikey1234567890abcdef';
const TEST_KEY_NAME = 'Government NGO Registry & Audit Partner';

async function seedApiKey() {
  const keyHash = crypto.createHash('sha256').update(TEST_API_KEY).digest('hex');
  const keyPrefix = TEST_API_KEY.slice(0, 16) + '...';

  // Check if exists
  const existing = await db('api_keys').where({ key_hash: keyHash }).first();
  if (existing) {
    console.log(`Test API Key already exists: ${existing.name} (${existing.key_prefix})`);
    return existing;
  }

  const [inserted] = await db('api_keys')
    .insert({
      name: TEST_KEY_NAME,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      is_active: true,
      rate_limit: 500,
    })
    .returning('*');

  console.log('Seeded test API key successfully:');
  console.log(`- Name:   ${inserted.name}`);
  console.log(`- Prefix: ${inserted.key_prefix}`);
  console.log(`- Raw Secret Key: ${TEST_API_KEY}`);
  return inserted;
}

if (require.main === module) {
  seedApiKey()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Failed to seed API key:', err);
      process.exit(1);
    });
}

module.exports = { TEST_API_KEY, seedApiKey };

