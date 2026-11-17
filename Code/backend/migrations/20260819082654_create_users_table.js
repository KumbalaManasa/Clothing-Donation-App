/**
 * users table — LLD §1.1.
 * Column-level constraints only (types, PK, UNIQUE email, UNIQUE registration_number where set).
 * The role='ngo' ⇒ org fields NOT NULL check constraint is added separately in task 1.2.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.text('name').notNullable();
    table.text('email').notNullable().unique();
    table.text('phone').notNullable();
    table.text('password_hash');
    table
      .enu('role', ['donor', 'ngo', 'admin'], {
        useNative: true,
        enumName: 'user_role',
      })
      .notNullable();
    table.text('org_name');
    table.text('registration_number');
    table.enu('verification_status', ['verified', 'not_verified'], {
      useNative: true,
      enumName: 'ngo_verification_status',
    });
    table.timestamp('verification_checked_at', { useTz: true });
    table.text('verification_source_ref');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.unique('registration_number', {
      predicate: knex.whereNotNull('registration_number'),
    });
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('users');
  await knex.raw('DROP TYPE IF EXISTS user_role');
  await knex.raw('DROP TYPE IF EXISTS ngo_verification_status');
};
