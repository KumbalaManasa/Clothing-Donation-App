/**
 * Migration: Create refresh_tokens table for Type 4 (Access + Refresh Token with Rotation)
 */
exports.up = async function (knex) {
  const exists = await knex.schema.hasTable('refresh_tokens');
  if (!exists) {
    await knex.schema.createTable('refresh_tokens', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('token_hash', 128).notNullable().unique();
      table
        .uuid('user_id')
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE');
      table.uuid('family_id').notNullable(); // Token family for rotation reuse detection
      table.boolean('is_revoked').notNullable().defaultTo(false);
      table.timestamp('expires_at', { useTz: true }).notNullable();
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

      table.index(['user_id']);
      table.index(['family_id']);
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('refresh_tokens');
};
