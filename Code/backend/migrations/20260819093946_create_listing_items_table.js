/**
 * listing_items table — LLD §1.3. One row per item in a multi-item listing bundle
 * (spec.md §3). The ≥1-item-per-listing rule is enforced at the application layer,
 * same as noted in LLD §1.3, not here.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.createTable('listing_items', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('listing_id')
      .notNullable()
      .references('id')
      .inTable('listings')
      .onDelete('CASCADE');
    table.text('category').notNullable();
    table.text('condition').notNullable();
    table.text('photo_url').notNullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('listing_items');
};
