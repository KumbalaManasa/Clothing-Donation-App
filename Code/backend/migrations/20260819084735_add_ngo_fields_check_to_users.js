/**
 * Enforce LLD §1.1's check constraint: role='ngo' implies org_name, registration_number,
 * and verification_status are all set; any other role implies all three are null
 * (individual volunteers not supported — spec.md §2).
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.raw(`
    ALTER TABLE users
    ADD CONSTRAINT users_ngo_fields_check CHECK (
      (
        role = 'ngo'
        AND org_name IS NOT NULL
        AND registration_number IS NOT NULL
        AND verification_status IS NOT NULL
      )
      OR (
        role != 'ngo'
        AND org_name IS NULL
        AND registration_number IS NULL
        AND verification_status IS NULL
      )
    )
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.raw('ALTER TABLE users DROP CONSTRAINT users_ngo_fields_check');
};
