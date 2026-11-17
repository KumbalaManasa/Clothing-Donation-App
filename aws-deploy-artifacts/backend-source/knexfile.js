require('dotenv').config();

// Standard Knex "environments" shape — the knex CLI (migrate:*, seed:run) and
// src/db.js both select one of these via NODE_ENV, defaulting to
// 'development'. 'test' points at a separate database (task 12.3) so running
// the test suite never touches the dev database a developer is actively
// using, and scripts/run-tests.js resets it to a clean slate before every run.
const shared = {
  client: 'pg',
  migrations: {
    directory: './migrations',
  },
  seeds: {
    directory: './seeds',
  },
};

module.exports = {
  development: { ...shared, connection: process.env.DATABASE_URL },
  production: {
    ...shared,
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : false,
    },
    pool: { min: 0, max: Number(process.env.DATABASE_POOL_MAX) || 10 },
  },
  test: { ...shared, connection: process.env.TEST_DATABASE_URL },
};
