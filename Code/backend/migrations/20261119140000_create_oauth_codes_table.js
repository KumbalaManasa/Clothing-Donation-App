/**
 * Migration: Create oauth_codes table for PKCE code challenge and state verification
 */
exports.up = async function (knex) {
  const exists = await knex.schema.hasTable('oauth_codes');
  if (!exists) {
    await knex.schema.createTable('oauth_codes', (table) => {
      table.string('code', 128).primary();
      table.string('code_challenge', 256).notNullable();
      table.string('code_challenge_method', 16).notNullable().defaultTo('S256');
      table.string('state', 128).notNullable();
      table.jsonb('profile_payload').notNullable();
      table.boolean('is_used').notNullable().defaultTo(false);
      table.timestamp('expires_at', { useTz: true }).notNullable();
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('oauth_codes');
};

