/**
 * Migration: Add target_ngo_id to listings table, and optional location fields to users table.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  const hasTargetNgoId = await knex.schema.hasColumn('listings', 'target_ngo_id');
  if (!hasTargetNgoId) {
    await knex.schema.alterTable('listings', (table) => {
      table
        .uuid('target_ngo_id')
        .references('id')
        .inTable('users')
        .onDelete('SET NULL');
    });
  }

  const hasLat = await knex.schema.hasColumn('users', 'lat');
  if (!hasLat) {
    await knex.schema.alterTable('users', (table) => {
      table.decimal('lat', 9, 6);
      table.decimal('lng', 9, 6);
      table.text('address');
      table.text('operating_area');
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  const hasTargetNgoId = await knex.schema.hasColumn('listings', 'target_ngo_id');
  if (hasTargetNgoId) {
    await knex.schema.alterTable('listings', (table) => {
      table.dropColumn('target_ngo_id');
    });
  }

  const hasLat = await knex.schema.hasColumn('users', 'lat');
  if (hasLat) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('lat');
      table.dropColumn('lng');
      table.dropColumn('address');
      table.dropColumn('operating_area');
    });
  }
};
