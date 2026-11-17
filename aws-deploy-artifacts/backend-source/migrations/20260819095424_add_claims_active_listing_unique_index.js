/**
 * Partial unique index — LLD §1.4: a listing can have at most one *active* claim
 * at a time, consistent with the single-path status pipeline (LLD §2). Once a claim
 * is no longer 'active' (fulfilled/expired/cancelled), a new active claim on the
 * same listing is allowed again.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('claims', (table) => {
    table.unique('listing_id', {
      indexName: 'claims_active_listing_unique',
      predicate: knex.whereRaw("status = 'active'"),
    });
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.alterTable('claims', (table) => {
    table.dropUnique('listing_id', 'claims_active_listing_unique');
  });
};
