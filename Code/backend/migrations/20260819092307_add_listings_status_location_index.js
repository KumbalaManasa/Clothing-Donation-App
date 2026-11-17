/**
 * Index to support the NGO browse/filter query (LLD §1.2, §6.4 step 1):
 * filtering open listings by status and sorting/filtering by proximity.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('listings', (table) => {
    table.index(['status', 'pickup_lat', 'pickup_lng'], 'listings_status_location_index');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.alterTable('listings', (table) => {
    table.dropIndex(['status', 'pickup_lat', 'pickup_lng'], 'listings_status_location_index');
  });
};
