const bcrypt = require('bcryptjs');

/**
 * Dev seed data — Spec/tasks.md task 1.10: one donor, one verified NGO,
 * one not_verified NGO, one admin.
 *
 * Uses an upsert (ON CONFLICT (email) DO UPDATE) instead of delete-then-insert
 * so re-running the seed is idempotent without needing to delete rows that
 * other dev data (listings, claims, etc.) might already reference by then.
 *
 * Every seeded row gets the same known dev-only password so it's actually
 * possible to log in as any of them via POST /auth/login — this matters most
 * for the admin account (task 11.1), which has no self-service signup form by
 * design (spec.md §3/§6.6: admin accounts aren't created through the app), so
 * this seed is the only way to get one locally.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function (knex) {
  const DEV_PASSWORD_HASH = await bcrypt.hash('devpassword123', 10);
  const PAVAN_PASSWORD_HASH = await bcrypt.hash('pavan0512', 10);

  const rows = [
    {
      name: 'Dev Donor',
      email: 'dev.donor@example.com',
      phone: '+10000000001',
      role: 'donor',
      password_hash: DEV_PASSWORD_HASH,
    },
    {
      name: 'Dashboard Sample Donor',
      email: 'dashboard.sample.donor@example.com',
      phone: '+10000000005',
      role: 'donor',
      password_hash: DEV_PASSWORD_HASH,
    },
    {
      name: 'Dev Admin',
      email: 'dev.admin@example.com',
      phone: '+10000000002',
      role: 'admin',
      password_hash: DEV_PASSWORD_HASH,
    },
    {
      name: 'Pavan Kalyan',
      email: 'pavankalyangone12@gmail',
      phone: '+10000000000',
      role: 'admin',
      password_hash: PAVAN_PASSWORD_HASH,
    },
    {
      name: 'Pavan Kalyan',
      email: 'pavankalyangone12@gmail.com',
      phone: '+10000000000',
      role: 'admin',
      password_hash: PAVAN_PASSWORD_HASH,
    },
    {
      name: 'Dev Verified NGO',
      email: 'dev.ngo.verified@example.com',
      phone: '+10000000003',
      role: 'ngo',
      org_name: 'Helping Hands Foundation',
      registration_number: 'DEV-REG-VERIFIED-001',
      verification_status: 'verified',
      verification_checked_at: knex.fn.now(),
      verification_source_ref: 'seed-fixture-verified',
      password_hash: DEV_PASSWORD_HASH,
    },
    {
      name: 'Dev Not-Verified NGO',
      email: 'dev.ngo.notverified@example.com',
      phone: '+10000000004',
      role: 'ngo',
      org_name: 'Unregistered Org',
      registration_number: 'DEV-REG-NOTVERIFIED-001',
      verification_status: 'not_verified',
      verification_checked_at: knex.fn.now(),
      verification_source_ref: 'seed-fixture-not-verified',
      password_hash: DEV_PASSWORD_HASH,
    },
  ];

  await knex('users')
    .insert(rows)
    .onConflict('email')
    .merge();
};
