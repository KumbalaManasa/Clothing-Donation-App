/** Analytics outcomes and indexes. Existing item rows remain one garment each. */
exports.up = async function (knex) {
  await knex.raw("ALTER TYPE claim_status ADD VALUE IF NOT EXISTS 'declined'");
  await knex.raw("ALTER TYPE claim_status ADD VALUE IF NOT EXISTS 'failed'");
  await knex.raw("ALTER TYPE listing_status ADD VALUE IF NOT EXISTS 'failed'");
  await knex.raw("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'declined'");
  await knex.raw("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'failed'");

  await knex.schema.alterTable('claims', (table) => {
    table.timestamp('declined_at', { useTz: true });
    table.text('decline_reason');
    table.timestamp('failed_at', { useTz: true });
    table.text('failure_reason');
  });

  await knex.schema.alterTable('listings', (table) => {
    table.timestamp('cancelled_at', { useTz: true });
  });

  await knex.schema.alterTable('listings', (table) => {
    table.index(['donor_id', 'created_at'], 'listings_donor_created_index');
    table.index(['status', 'created_at'], 'listings_status_created_index');
  });
  await knex.schema.alterTable('listing_items', (table) => {
    table.index(['condition', 'listing_id'], 'listing_items_condition_listing_index');
    table.index(['listing_id'], 'listing_items_listing_index');
  });
  await knex.schema.alterTable('claims', (table) => {
    table.index(['ngo_id', 'claimed_at'], 'claims_ngo_claimed_index');
    table.index(['status', 'claimed_at'], 'claims_status_claimed_index');
  });
  await knex.schema.alterTable('distributions', (table) => {
    table.index(['ngo_id', 'distributed_at'], 'distributions_ngo_date_index');
    table.index(['distributed_at'], 'distributions_date_index');
  });
};

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS distributions_ngo_date_index');
  await knex.raw('DROP INDEX IF EXISTS distributions_date_index');
  await knex.raw('DROP INDEX IF EXISTS claims_ngo_claimed_index');
  await knex.raw('DROP INDEX IF EXISTS claims_status_claimed_index');
  await knex.raw('DROP INDEX IF EXISTS listing_items_condition_listing_index');
  await knex.raw('DROP INDEX IF EXISTS listing_items_listing_index');
  await knex.raw('DROP INDEX IF EXISTS listings_donor_created_index');
  await knex.raw('DROP INDEX IF EXISTS listings_status_created_index');
  await knex.schema.alterTable('claims', (table) => {
    table.dropColumn('declined_at');
    table.dropColumn('decline_reason');
    table.dropColumn('failed_at');
    table.dropColumn('failure_reason');
  });
  await knex.schema.alterTable('listings', (table) => table.dropColumn('cancelled_at'));

  await knex.raw("CREATE TYPE claim_status_original AS ENUM ('active', 'fulfilled', 'expired', 'cancelled')");
  await knex.raw('ALTER TABLE claims ALTER COLUMN status TYPE claim_status_original USING status::text::claim_status_original');
  await knex.raw('DROP TYPE claim_status');
  await knex.raw('ALTER TYPE claim_status_original RENAME TO claim_status');
  await knex.raw("CREATE TYPE listing_status_original AS ENUM ('listed', 'claimed', 'picked_up', 'distributed', 'delivered', 'cancelled')");
  await knex.raw('ALTER TABLE listings ALTER COLUMN status TYPE listing_status_original USING status::text::listing_status_original');
  await knex.raw('DROP TYPE listing_status');
  await knex.raw('ALTER TYPE listing_status_original RENAME TO listing_status');
  await knex.raw("CREATE TYPE notification_type_original AS ENUM ('claimed', 'picked_up', 'distributed', 'delivered', 'cancelled', 'expired')");
  await knex.raw('ALTER TABLE notifications ALTER COLUMN type TYPE notification_type_original USING type::text::notification_type_original');
  await knex.raw('DROP TYPE notification_type');
  await knex.raw('ALTER TYPE notification_type_original RENAME TO notification_type');
};
