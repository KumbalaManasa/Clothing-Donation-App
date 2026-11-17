/**
 * claims table — LLD §1.4. Columns only; the partial unique index enforcing
 * "one active claim per listing" is added separately in task 1.7.
 *
 * expires_at can't reference claimed_at directly in a column DEFAULT (Postgres
 * DEFAULT expressions can't read other columns of the same row), so both default
 * independently off now() — they still land on the same instant for a normal
 * insert since now() is stable within one statement/transaction, matching
 * LLD §1.4's "expires_at = claimed_at + 48h" for the app's actual insert pattern
 * (LLD §3.4: claim creation always uses "now" for both).
 *
 * ngo_id references users(id) generally — restricting it to role='ngo' AND
 * verification_status='verified' isn't expressible as a plain FK/CHECK constraint
 * (no cross-table CHECK in Postgres) and is enforced at the application layer,
 * same pattern as listings.donor_id in task 1.3.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.createTable('claims', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('listing_id')
      .notNullable()
      .references('id')
      .inTable('listings');
    table
      .uuid('ngo_id')
      .notNullable()
      .references('id')
      .inTable('users');
    table.timestamp('claimed_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table
      .timestamp('expires_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.raw("now() + interval '48 hours'"));
    table.timestamp('picked_up_at', { useTz: true });
    table
      .enu('status', ['active', 'fulfilled', 'expired', 'cancelled'], {
        useNative: true,
        enumName: 'claim_status',
      })
      .notNullable()
      .defaultTo('active');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('claims');
  await knex.raw('DROP TYPE IF EXISTS claim_status');
};
