/**
 * notifications table — LLD §1.6. In-app only (spec.md §3) status-change alerts.
 * Index on (user_id, read, created_at) supports the unread-first notification
 * center list view.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.createTable('notifications', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('user_id')
      .notNullable()
      .references('id')
      .inTable('users');
    table
      .uuid('listing_id')
      .notNullable()
      .references('id')
      .inTable('listings');
    table
      .enu(
        'type',
        ['claimed', 'picked_up', 'distributed', 'delivered', 'cancelled', 'expired'],
        { useNative: true, enumName: 'notification_type' },
      )
      .notNullable();
    table.text('message').notNullable();
    table.boolean('read').notNullable().defaultTo(false);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index(['user_id', 'read', 'created_at'], 'notifications_user_read_created_index');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('notifications');
  await knex.raw('DROP TYPE IF EXISTS notification_type');
};
