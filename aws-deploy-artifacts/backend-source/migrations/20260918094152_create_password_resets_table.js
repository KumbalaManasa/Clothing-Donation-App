/**
 * password_resets table — forgot-password feature. One row per reset
 * attempt (not per user): a user can request a fresh code/link at any time,
 * and each request gets its own row rather than overwriting a single
 * per-user column, so a stale outstanding request can't collide with a new
 * one. `secret_hash` covers both delivery methods (a 6-digit code or a long
 * random link token) — never store the raw secret, same principle as
 * users.password_hash. `method` is kept alongside purely so the verify
 * routes can tell which flow issued a given row without guessing from
 * secret shape.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.createTable('password_resets', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table
      .enu('method', ['code', 'link'], {
        useNative: true,
        enumName: 'password_reset_method',
      })
      .notNullable();
    table.text('secret_hash').notNullable();
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.boolean('used').notNullable().defaultTo(false);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('password_resets');
  await knex.raw('DROP TYPE IF EXISTS password_reset_method');
};
