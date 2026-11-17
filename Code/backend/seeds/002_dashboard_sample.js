/** Local dashboard sample records; production runs intentionally skip this seed. */
exports.seed = async function (knex) {
  if (process.env.NODE_ENV === 'production') return;

  const donor = await knex('users').where({ email: 'dashboard.sample.donor@example.com' }).first();
  const ngo = await knex('users').where({ email: 'dev.ngo.verified@example.com' }).first();
  if (!donor || !ngo) return; // Run 001_dev_users.js first.
  if (await knex('listings').where({ donor_id: donor.id }).first()) return;

  const now = new Date();
  const conditions = ['Great', 'Good', 'Average', 'A bit bad'];
  const photoUrl = 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=640&q=80';

  for (let offset = 0; offset < 12; offset += 1) {
    const createdAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 10, 12));
    const statusByOffset = ['listed', 'claimed', 'picked_up', 'failed', 'listed', 'delivered'];
    const status = statusByOffset[offset] || 'delivered';
    const [listing] = await knex('listings').insert({
      donor_id: donor.id,
      status,
      pickup_lat: 17.385,
      pickup_lng: 78.4867,
      pickup_address_label: 'Hyderabad, Telangana',
      cancellation_reason: null,
      created_at: createdAt,
      updated_at: createdAt,
    }).returning(['id']);

    const itemCount = (offset % 4) + 1;
    const items = Array.from({ length: itemCount }, (_, index) => ({
      listing_id: listing.id,
      category: ['Shirt', 'Jacket', 'Trousers', 'Dress'][index % 4],
      condition: conditions[(offset + index) % conditions.length],
      photo_url: photoUrl,
    }));
    await knex('listing_items').insert(items);

    if (status !== 'listed' || offset === 4) {
      const claimStatus = status === 'delivered' ? 'fulfilled'
        : status === 'failed' ? 'failed'
          : status === 'listed' ? 'declined' : 'active';
      const claimedAt = new Date(createdAt.getTime() + 60 * 60 * 1000);
      const [claim] = await knex('claims').insert({
        listing_id: listing.id,
        ngo_id: ngo.id,
        status: claimStatus,
        claimed_at: claimedAt,
        expires_at: new Date(claimedAt.getTime() + 48 * 60 * 60 * 1000),
        picked_up_at: ['picked_up', 'failed', 'delivered'].includes(status) ? new Date(createdAt.getTime() + 2 * 60 * 60 * 1000) : null,
        declined_at: claimStatus === 'declined' ? new Date(createdAt.getTime() + 3 * 60 * 60 * 1000) : null,
        decline_reason: claimStatus === 'declined' ? 'Outside the current distribution area' : null,
        failed_at: claimStatus === 'failed' ? new Date(createdAt.getTime() + 24 * 60 * 60 * 1000) : null,
        failure_reason: claimStatus === 'failed' ? 'Receiver could not be reached for handoff' : null,
      }).returning(['id']);

      if (status === 'delivered') {
        await knex('distributions').insert({
          listing_id: listing.id,
          ngo_id: ngo.id,
          receiver_first_name: 'Sample receiver',
          receiver_general_area: 'Hyderabad',
          photo_url: null,
          distributed_at: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000),
        });
      }
      if (!claim?.id) throw new Error('Could not create sample claim');
    }
  }
};
