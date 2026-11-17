/**
 * listings table — LLD §1.2. Status enum and GPS/address columns only;
 * the (status, pickup_lat, pickup_lng) index is added separately in task 1.4.
 *
 * donor_id references users(id) generally — restricting it to role='donor' specifically
 * isn't expressible as a plain FK/CHECK constraint (no cross-table CHECK in Postgres)
 * and is enforced at the application layer instead, same pattern as LLD §1.3's
 * "≥1 item" rule.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.createTable('listings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('donor_id')
      .notNullable()
      .references('id')
      .inTable('users');
    table
      .enu(
        'status',
        ['listed', 'claimed', 'picked_up', 'distributed', 'delivered', 'cancelled'],
        { useNative: true, enumName: 'listing_status' },
      )
      .notNullable()
      .defaultTo('listed');
    table.decimal('pickup_lat', 9, 6).notNullable();
    table.decimal('pickup_lng', 9, 6).notNullable();
    table.text('pickup_address_label').notNullable();
    table.text('cancellation_reason');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('listings');
  await knex.raw('DROP TYPE IF EXISTS listing_status');
};
