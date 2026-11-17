// Task 12.3 — integration test harness: provisions an isolated test database
// (separate from whatever DATABASE_URL points dev at), migrates it, and wipes
// every app table to a clean slate BEFORE each `npm test` run, then runs the
// suite against it with NODE_ENV=test. This is what guarantees "two tests run
// back-to-back don't leak state" — each run starts from zero rows regardless
// of whether the previous run's own cleanup finished (e.g. it crashed
// mid-suite), not by hoping every test's own try/finally cleanup succeeded.
require('dotenv').config();

const { Client } = require('pg');
const { spawnSync } = require('child_process');
const knex = require('knex');
const knexfile = require('../knexfile');

// Tables truncated between runs — every app table (knex_migrations /
// knex_migrations_lock are deliberately excluded: wiping those would make
// knex think no migration ever ran and try to re-create tables that already
// exist on the next migrate.latest()).
const APP_TABLES = ['notifications', 'distributions', 'claims', 'listing_items', 'listings', 'users'];

async function ensureTestDatabaseExists(testDatabaseUrl) {
  const target = new URL(testDatabaseUrl);
  const dbName = target.pathname.replace(/^\//, '');

  const maintenanceUrl = new URL(testDatabaseUrl);
  maintenanceUrl.pathname = '/postgres'; // always exists; used only to run CREATE DATABASE

  const client = new Client({ connectionString: maintenanceUrl.toString() });
  await client.connect();
  try {
    await client.query(`CREATE DATABASE "${dbName}"`);
    console.log(`[run-tests] created test database "${dbName}"`);
  } catch (err) {
    if (err.code !== '42P04') throw err; // 42P04 = database already exists — fine, reuse it
  } finally {
    await client.end();
  }
}

async function resetTestDatabase() {
  const db = knex(knexfile.test);
  try {
    await db.migrate.latest();
    await db.raw(`TRUNCATE TABLE ${APP_TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
    console.log('[run-tests] test database migrated and truncated to a clean slate');
  } finally {
    await db.destroy();
  }
}

async function main() {
  if (!process.env.TEST_DATABASE_URL) {
    console.error('[run-tests] TEST_DATABASE_URL is not set — see .env.example');
    process.exit(1);
  }

  await ensureTestDatabaseExists(process.env.TEST_DATABASE_URL);
  await resetTestDatabase();

  const extraArgs = process.argv.slice(2);
  const result = spawnSync('node', ['--test', ...extraArgs], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test' },
  });

  process.exit(result.status === null ? 1 : result.status);
}

main().catch((err) => {
  console.error('[run-tests] setup failed:', err);
  process.exit(1);
});
