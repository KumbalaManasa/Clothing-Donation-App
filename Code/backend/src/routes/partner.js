const express = require('express');
const db = require('../db');
const { requireApiKey } = require('../middleware/apiKeyAuth');

const router = express.Router();

// Apply API Key authentication to all partner routes
router.use(requireApiKey);

/**
 * GET /partner/ping — Backend-to-backend health & authentication check
 */
router.get('/ping', (req, res) => {
  return res.status(200).json({
    status: 'ok',
    message: 'Backend-to-backend API key authentication successful',
    client: req.apiClient,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /partner/listings/export — Bulk export of active donation listings for partner systems
 */
router.get('/listings/export', async (req, res) => {
  const listings = await db('listings')
    .whereIn('status', ['listed', 'claimed'])
    .select('id', 'donor_id', 'status', 'pickup_address_label', 'created_at')
    .orderBy('created_at', 'desc')
    .limit(50);

  res.setHeader('X-Authenticated-Client', req.apiClient.name);

  return res.status(200).json({
    exportedBy: req.apiClient.name,
    totalRecords: listings.length,
    listings,
  });
});

/**
 * GET /partner/stats — Machine-readable platform summary for external audit
 */
router.get('/stats', async (req, res) => {
  const [totalUsers] = await db('users').count('id as count');
  const [totalListings] = await db('listings').count('id as count');
  const [totalClaims] = await db('claims').count('id as count');

  return res.status(200).json({
    source: 'WearForward Backend API',
    authorizedClient: req.apiClient.name,
    stats: {
      users: parseInt(totalUsers.count, 10),
      listings: parseInt(totalListings.count, 10),
      claims: parseInt(totalClaims.count, 10),
    },
    generatedAt: new Date().toISOString(),
  });
});

module.exports = router;
