/**
 * Migration: Add google_id and avatar_url to users table for OAuth 2.0 / OIDC
 */
exports.up = async function (knex) {
  const hasGoogleId = await knex.schema.hasColumn('users', 'google_id');
  if (!hasGoogleId) {
    await knex.schema.alterTable('users', (table) => {
      table.string('google_id', 128).nullable().unique();
      table.text('avatar_url').nullable();
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('google_id');
    table.dropColumn('avatar_url');
  });
};

