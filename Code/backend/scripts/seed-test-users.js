/**
 * Seed Script: Creates 3 quick-test users (Donor, Verified NGO, Admin)
 * Password for all 3 users is: test1234
 */
const bcrypt = require('bcryptjs');
const db = require('../src/db');

async function seedTestUsers() {
  const passwordHash = await bcrypt.hash('test1234', 10);

  const testUsers = [
    {
      name: 'Test Donor',
      email: 'donor@test.com',
      phone: '+10000000001',
      role: 'donor',
      password_hash: passwordHash,
    },
    {
      name: 'Test NGO',
      email: 'ngo@test.com',
      phone: '+10000000002',
      role: 'ngo',
      org_name: 'Helping Hands Org',
      registration_number: 'APPROVED-NGO-001',
      verification_status: 'verified',
      verification_checked_at: db.fn.now(),
      verification_source_ref: 'seed-verified-source',
      password_hash: passwordHash,
    },
    {
      name: 'Test Admin',
      email: 'admin@test.com',
      phone: '+10000000003',
      role: 'admin',
      password_hash: passwordHash,
    },
  ];

  console.log('Seeding 3 quick-test users (password: test1234)...');

  for (const user of testUsers) {
    const [saved] = await db('users')
      .insert(user)
      .onConflict('email')
      .merge()
      .returning(['id', 'name', 'email', 'role']);

    console.log(`- [${saved.role.toUpperCase()}] ${saved.email} (${saved.name})`);
  }

  console.log('\nAll 3 test users ready:');
  console.log('1. Donor: donor@test.com / test1234');
  console.log('2. NGO:   ngo@test.com / test1234');
  console.log('3. Admin: admin@test.com / test1234');
}

seedTestUsers()
  .catch((err) => {
    console.error('Failed to seed test users:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.destroy();
  });

