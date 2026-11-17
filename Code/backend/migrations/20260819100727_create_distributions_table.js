/**
 * distributions table — LLD §1.5. Records the handover to a receiver
 * (spec.md §6.4 step 4): minimal, non-identifying receiver info + optional photo.
 * UNIQUE(listing_id) enforces one distribution per listing.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.createTable('distributions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('listing_id')
      .notNullable()
      .unique()
      .references('id')
      .inTable('listings');
    table
      .uuid('ngo_id')
      .notNullable()
      .references('id')
      .inTable('users');
    table.text('receiver_first_name').notNullable();
    table.text('receiver_general_area').notNullable();
    table.text('photo_url');
    table.timestamp('distributed_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('distributions');
};
