/**
 * Migration: Create api_keys table for Type 5 (API Key Authentication for backend-to-backend routes)
 */
exports.up = async function (knex) {
  const exists = await knex.schema.hasTable('api_keys');
  if (!exists) {
    await knex.schema.createTable('api_keys', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('name', 100).notNullable();
      table.string('key_hash', 128).notNullable().unique();
      table.string('key_prefix', 20).notNullable(); // e.g. "don_live_9f8a..." for safe admin display
      table.boolean('is_active').notNullable().defaultTo(true);
      table.integer('rate_limit').notNullable().defaultTo(100);
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('api_keys');
};

